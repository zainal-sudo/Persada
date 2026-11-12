// services/pembelian/invoiceFormService.js
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");

// ── Lookup Supplier ───────────────────────────────────────────────────
const getSupplier = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sup_kode AS kode, sup_nama AS nama, sup_alamat AS alamat,
            sup_telp AS telp, IFNULL(sup_top, 0) AS top
     FROM tsupplier
     WHERE sup_nama LIKE ? OR sup_kode LIKE ?
     ORDER BY sup_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup BPB belum invoice (paritas Delphi ufrmInvoice.edtNomorBPBClickBtn)
const getOpenBPB = async (search = "") => {
  const [rows] = await db.query(
    `SELECT b.bpb_nomor AS nomor,
            DATE_FORMAT(b.bpb_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(s.sup_nama, '') AS supplier,
            IFNULL(p.po_sup_kode, '') AS supKode,
            IFNULL(p.po_istax, 0) AS isTax,
            IFNULL(p.po_disc_faktur, 0) AS poDiscFaktur,
            IFNULL(p.po_disc_fakturpr, 0) AS poDiscFakturPr,
            IFNULL(s.sup_top, 0) AS top
     FROM tbpb_hdr b
     INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     WHERE b.bpb_isinvoice = 0 AND (b.bpb_nomor LIKE ? OR s.sup_nama LIKE ?)
     ORDER BY b.bpb_nomor DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load item BPB → item invoice (paritas Delphi ufrmInvoice.loaddataBPB)
const getDetailByBPB = async (nomorBPB) => {
  const [rows] = await db.query(
    `SELECT
       b.bpb_nomor AS bpbNomor,
       DATE_FORMAT(b.bpb_tanggal, '%Y-%m-%d') AS bpbTanggal,
       IFNULL(p.po_sup_kode, '') AS supKode,
       IFNULL(p.po_istax, 0) AS isTax,
       IFNULL(s.sup_top, 0) AS top,
       IFNULL(p.po_disc_faktur, 0) AS discFaktur,
       IFNULL(p.po_disc_fakturpr, 0) AS discFakturPr,
       d.bpbd_brg_kode AS brgKode,
       IFNULL(br.brg_nama, '') AS brgNama,
       IFNULL(d.bpbd_brg_satuan, '') AS satuan,
       IFNULL(d.bpbd_qty, 0) AS qty,
       DATE_FORMAT(d.bpbd_tgl_expired, '%Y-%m-%d') AS expired,
       IFNULL(d.bpbd_idbatch, '') AS idBatch,
       IFNULL(pd.pod_harga, 0) AS harga,
       IFNULL(pd.pod_discpr, 0) AS discPr,
       ROUND(IFNULL(d.bpbd_qty, 0) * IFNULL(pd.pod_harga, 0) * (100 - IFNULL(pd.pod_discpr, 0)) / 100, 2) AS total
     FROM tbpb_hdr b
     INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     INNER JOIN tbpb_dtl d ON d.bpbd_bpb_nomor = b.bpb_nomor
     LEFT JOIN tbarang br ON br.brg_kode = d.bpbd_brg_kode
     LEFT JOIN tpo_dtl pd ON pd.pod_po_nomor = p.po_nomor AND pd.pod_brg_kode = d.bpbd_brg_kode
     WHERE b.bpb_nomor = ?
     ORDER BY d.bpbd_nourut`,
    [nomorBPB]
  );
  return rows;
};

// ── TOP supplier (paritas Delphi ufrmInvoice.gettop) ──────────────────
const getTop = async (supKode) => {
  const [[row]] = await db.query(
    `SELECT IFNULL(sup_top, 0) AS top FROM tsupplier WHERE sup_kode = ?`,
    [supKode]
  );
  return row ? Number(row.top) : 0;
};

// ── Cek nomor bukti kembar (paritas Delphi ufrmInvoice.edtNobuktiExit)
const checkNoBukti = async (nobukti, excludeNomor = "") => {
  if (!nobukti) return { exists: false };
  const [[row]] = await db.query(
    `SELECT inv_nomor FROM tinv_hdr WHERE inv_nobukti = ? AND inv_nomor <> ? LIMIT 1`,
    [nobukti, excludeNomor]
  );
  return { exists: !!row, nomor: row?.inv_nomor || "" };
};

// ── Generate Nomor INV (paritas Delphi ufrmInvoice.getmaxkode) ────────
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-INV.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(inv_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tinv_hdr
       WHERE inv_nomor LIKE ? AND inv_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(inv_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tinv_hdr
       WHERE inv_nomor LIKE ? AND inv_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  }
};

// ── Cek perubahan net harga beli vs last cost (paritas Delphi cekLastCost)
const getToleransiHbl = async () => {
  const [[row]] = await db.query(
    `SELECT IFNULL(set_tgl, 0) AS toleransi FROM tsetting WHERE set_kode = 'INV' LIMIT 1`
  );
  return row ? Number(row.toleransi) : 0;
};

const cekLastCost = async (brgKode, nilai) => {
  const [[row]] = await db.query(
    `SELECT mst_hargabeli AS hargabeli
     FROM tmasterstok
     WHERE mst_noreferensi LIKE 'RI%' AND mst_brg_kode = ?
     ORDER BY mst_tanggal DESC LIMIT 1`,
    [brgKode]
  );
  if (!row) return { ok: true, lastCost: 0 };

  const lastCost = Number(row.hargabeli) || 0;
  const toleransi = (await getToleransiHbl()) / 100 * lastCost;
  const ok =
    !((lastCost - nilai > toleransi) || (nilai - lastCost > toleransi));
  return { ok, lastCost, toleransi };
};

// ── Load Form Edit (paritas Delphi ufrmInvoice.loaddataall) ───────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT h.inv_nomor AS nomor,
            IFNULL(h.inv_nobukti, '') AS nobukti,
            DATE_FORMAT(h.inv_tanggal, '%Y-%m-%d') AS tanggal,
            DATE_FORMAT(h.inv_jthtempo, '%Y-%m-%d') AS jthtempo,
            IFNULL(h.inv_bpb_nomor, '') AS bpbNomor,
            IFNULL(h.inv_memo, '') AS memo,
            IFNULL(h.inv_istax, 0) AS isTax,
            IFNULL(h.inv_disc_faktur, 0) AS discFaktur,
            IFNULL(h.inv_disc_fakturpr, 0) AS discFakturPr,
            IFNULL(h.inv_freight, 0) AS freight,
            IFNULL(h.inv_isbayar, 0) AS isBayar,
            IFNULL(h.inv_bayar, 0) AS bayar,
            IFNULL(h.inv_ispajak, 0) AS isPajak,
            IFNULL(h.inv_nopajak, '') AS nopajak,
            DATE_FORMAT(h.inv_tglbukti, '%Y-%m-%d') AS tglBukti,
            IFNULL(p.po_sup_kode, '') AS supKode,
            IFNULL(s.sup_top, 0) AS top
     FROM tinv_hdr h
     INNER JOIN tbpb_hdr b ON b.bpb_nomor = h.inv_bpb_nomor
     INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     WHERE h.inv_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("Invoice tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama AS supNama, sup_alamat AS alamat FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [h.supKode]
  );

  const [detail] = await db.query(
    `SELECT d.invd_brg_kode AS brgKode,
            IFNULL(b.brg_nama, '') AS brgNama,
            IFNULL(d.invd_brg_satuan, '') AS satuan,
            IFNULL(d.invd_qty, 0) AS qty,
            IFNULL(d.invd_harga, 0) AS harga,
            IFNULL(d.invd_discpr, 0) AS discPr,
            IFNULL(d.invd_otorisasi, 0) AS otorisasi,
            DATE_FORMAT(d.invd_expired, '%Y-%m-%d') AS expired,
            IFNULL(d.invd_idbatch, '') AS idBatch,
            ROUND(d.invd_qty * d.invd_harga * (100 - IFNULL(d.invd_discpr, 0)) / 100, 2) AS total
     FROM tinv_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.invd_brg_kode
     WHERE d.invd_inv_nomor = ?
     ORDER BY d.invd_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    detail,
  };
};

// ── Save Data (paritas Delphi ufrmInvoice.simpandata) ─────────────────
// Urutan identik Delphi: UPDATE/INSERT header → DELETE tinv_dtl →
// INSERT tinv_dtl. Trigger menangani: tmasterstok+brg_stok (dtl insert),
// hapus tmasterstok (dtl delete), sup_hutang+bpb_isinvoice (hdr).
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, jthtempo, bpbNomor, nobukti, memo,
    supKode, discFaktur, discFakturPr, amount, taxAmount,
    isTax, freight, tglBukti, detail,
  } = payload;

  if (await cekTutupPeriode(tanggal))
    throw new Error("Periode sudah ditutup. Transaksi tidak bisa disimpan.");

  if (!supKode) throw new Error("supplier belum di pilih");
  if (!Array.isArray(detail) || detail.length === 0)
    throw new Error("Detail barang belum diisi.");

  for (let i = 0; i < detail.length; i++) {
    const d = detail[i];
    const brgKode = Number(d.brgKode) || 0;
    const qty = Number(d.qty) || 0;
    if (!brgKode) throw new Error(`SKU Baris : ${i + 1} Belum dipilih`);
    if (qty === 0) throw new Error(`QTY Baris : ${i + 1} Belum diisi`);
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let actualNomor = nomor;

    if (isEdit) {
      const [[inv]] = await conn.query(
        `SELECT inv_isbayar FROM tinv_hdr WHERE inv_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!inv) throw new Error("Invoice tidak ditemukan.");
      if (Number(inv.inv_isbayar) === 1)
        throw new Error(
          "Transaksi ini sudah ada pembayaran, tidak dapat diedit"
        );

      await conn.query(
        `UPDATE tinv_hdr SET
           inv_sup_kode = ?, inv_bpb_nomor = ?, inv_memo = ?,
           inv_nobukti = ?, inv_disc_faktur = ?, inv_disc_fakturpr = ?,
           inv_amount = ?, inv_taxamount = ?, inv_istax = ?,
           inv_jthtempo = ?, inv_tglbukti = ?, inv_freight = ?,
           date_modified = NOW(), user_modified = ?
         WHERE inv_nomor = ?`,
        [
          supKode, bpbNomor, memo, nobukti, discFaktur, discFakturPr,
          amount, taxAmount, isTax, jthtempo, tglBukti, freight,
          user.kode, nomor,
        ]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tinv_hdr
           (inv_nomor, inv_bpb_nomor, inv_nobukti, inv_tanggal, inv_jthtempo,
            inv_memo, inv_sup_kode, inv_disc_faktur, inv_disc_fakturpr,
            inv_amount, inv_taxamount, inv_istax, inv_freight, inv_tglbukti,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, bpbNomor, nobukti, tanggal, jthtempo, memo,
          supKode, discFaktur, discFakturPr, amount, taxAmount,
          isTax, freight, tglBukti, user.kode,
        ]
      );
    }

    await conn.query(`DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?`, [actualNomor]);

    let nourut = 1;
    for (const d of detail) {
      const qty = Number(d.qty) || 0;
      const brgKode = Number(d.brgKode) || 0;
      if (!brgKode) throw new Error(`SKU Baris : ${nourut} Belum dipilih`);
      if (qty <= 0) continue; // Paritas Delphi: hanya baris qty > 0 disimpan

      await conn.query(
        `INSERT INTO tinv_dtl
           (invd_inv_nomor, invd_brg_kode, invd_brg_satuan, invd_qty,
            invd_discpr, invd_harga, invd_nourut, invd_otorisasi, invd_expired,
            invd_idbatch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, brgKode, d.satuan, qty, d.discPr, d.harga,
          nourut, Number(d.otorisasi) || 0, d.expired || null, d.idBatch || "",
        ]
      );
      nourut++;
    }

    await conn.commit();
    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getSupplier,
  getOpenBPB,
  getDetailByBPB,
  getTop,
  checkNoBukti,
  getMaxNomor,
  getToleransiHbl,
  cekLastCost,
  getDetailForm,
  saveData,
};
