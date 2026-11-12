// services/pembelian/poFormService.js
const db = require("../../config/database");

// ── Lookup Supplier (paritas Delphi CDSSupplier) ──────────────────────
const getSupplier = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sup_kode AS kode, sup_nama AS nama, sup_alamat AS alamat, sup_telp AS telp
     FROM tsupplier
     WHERE sup_nama LIKE ? OR sup_kode LIKE ?
     ORDER BY sup_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Barang (paritas Delphi initViewSKU — brg_isaktif=1) ────────
const getBarang = async (search = "") => {
  const [rows] = await db.query(
    `SELECT brg_kode AS kode, brg_nama AS nama, brg_hrgbeli AS hargaBeli,
            brg_satuan AS satuan
     FROM tbarang
     WHERE brg_isaktif = 1 AND (brg_nama LIKE ? OR brg_kode LIKE ?)
     ORDER BY brg_nama LIMIT 200`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Ambil isi Hitung Stok per Gudang (paritas Delphi ufrmPO.cxButton3Click)
const getHitungStok = async (gdgKode) => {
  const [rows] = await db.query(
    `SELECT hitd_brg_kode AS brgKode, hitd_satuan AS satuan,
            SUM(hitd_qty) AS qty, brg_hrgbeli AS hargaBeli
     FROM thitungstok_dtl
     INNER JOIN thitungstok ON hitd_hit_nomor = hit_nomor
     INNER JOIN tbarang ON brg_kode = hitd_brg_kode
     WHERE hit_gdg_kode = ?
     GROUP BY hitd_brg_kode, hitd_satuan, brg_hrgbeli`,
    [gdgKode]
  );
  return rows;
};

// ── Generate Nomor PO (paritas Delphi ufrmPO.getmaxkode) ──────────────
// Pajak  : 10000 + max(4 digit) + 1 → PO.yymm.0001..
// Non    : 15000 + max(3 digit) + 1 → PO.yymm.0001..
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-PO.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(po_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tpo_hdr
       WHERE po_nomor LIKE ? AND po_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(po_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tpo_hdr
       WHERE po_nomor LIKE ? AND po_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  }
};

// ── Load Form Edit (paritas Delphi ufrmPO.loaddataall) ────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT po_nomor AS nomor,
            DATE_FORMAT(po_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(po_memo, '') AS memo,
            IFNULL(po_sup_kode, '') AS supKode,
            IFNULL(po_pemesan, '') AS pemesan,
            IFNULL(po_disc_faktur, 0) AS discFaktur,
            IFNULL(po_disc_fakturpr, 0) AS discFakturPr,
            IFNULL(po_istax, 0) AS isTax,
            IFNULL(po_isclosed, 0) AS isClosed,
            IFNULL(po_status_rec, 0) AS statusRec,
            DATE_FORMAT(po_dateline, '%Y-%m-%d') AS dateline
     FROM tpo_hdr WHERE po_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("PO tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama AS supNama, sup_alamat AS alamat, sup_telp AS telp
     FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [h.supKode]
  );

  const [detail] = await db.query(
    `SELECT d.pod_brg_kode AS brgKode, b.brg_nama AS brgNama,
            d.pod_brg_satuan AS satuan, d.pod_qty AS qty,
            d.pod_harga AS harga, d.pod_discpr AS discPr,
            IFNULL(d.pod_keterangan, '') AS keterangan,
            ROUND(d.pod_harga * d.pod_qty * (100 - IFNULL(d.pod_discpr, 0)) / 100, 2) AS total
     FROM tpo_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.pod_brg_kode
     WHERE d.pod_po_nomor = ?
     ORDER BY d.pod_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    telp: supplier?.telp || "",
    detail,
  };
};

// ── Save Data (paritas Delphi ufrmPO.simpandata) ──────────────────────
// Urutan identik Delphi: UPDATE/INSERT header → DELETE detail → INSERT detail.
// PO tidak punya trigger; efek receipt ditangani trigger tbpb_dtl_after_insert.
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, memo, supKode, pemesan,
    discFaktur, discFakturPr, amount, taxAmount,
    isTax, dateline, detail,
  } = payload;

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
      const [[po]] = await conn.query(
        `SELECT po_status_rec FROM tpo_hdr WHERE po_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!po) throw new Error("PO tidak ditemukan.");
      if (Number(po.po_status_rec) === 1)
        throw new Error(
          "Transaksi ini sudah ada Receipt Barang, tidak dapat diedit"
        );

      await conn.query(
        `UPDATE tpo_hdr SET
           po_sup_kode = ?, po_memo = ?, po_disc_faktur = ?,
           po_disc_fakturpr = ?, po_amount = ?, po_taxamount = ?,
           po_istax = ?, po_dateline = ?, po_pemesan = ?,
           date_modified = NOW(), user_modified = ?
         WHERE po_nomor = ?`,
        [
          supKode, memo, discFaktur, discFakturPr, amount, taxAmount,
          isTax, dateline, pemesan, user.kode, nomor,
        ]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tpo_hdr
           (po_nomor, po_tanggal, po_memo, po_sup_kode, po_disc_faktur,
            po_disc_fakturpr, po_amount, po_taxamount, po_istax,
            po_dateline, po_pemesan, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, tanggal, memo, supKode, discFaktur,
          discFakturPr, amount, taxAmount, isTax,
          dateline, pemesan, user.kode,
        ]
      );
    }

    await conn.query(`DELETE FROM tpo_dtl WHERE pod_po_nomor = ?`, [actualNomor]);

    let nourut = 1;
    for (const d of detail) {
      await conn.query(
        `INSERT INTO tpo_dtl
           (pod_po_nomor, pod_brg_kode, pod_brg_satuan, pod_qty,
            pod_discpr, pod_harga, pod_keterangan, pod_nourut)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, d.brgKode, d.satuan, d.qty, d.discPr,
          d.harga, d.keterangan || "", nourut,
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

// ── Riwayat harga beli per supplier (paritas Delphi clHargaPropertiesButtonClick)
const getRiwayatHarga = async (brgKode, supKode, excludeNomor = "") => {
  const [rows] = await db.query(
    `SELECT b.brg_nama AS Nama, d.invd_harga AS Harga, d.invd_discpr AS Disc,
            DATE_FORMAT(d.invd_expired, '%Y-%m-%d') AS Expired,
            DATE_FORMAT(h.inv_tanggal, '%Y-%m-%d') AS Tanggal,
            d.invd_qty AS Qty
     FROM tinv_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.invd_brg_kode
     INNER JOIN tinv_hdr h ON h.inv_nomor = d.invd_inv_nomor
     WHERE h.inv_nomor <> ?
       AND b.brg_kode = ?
       AND h.inv_sup_kode = ?
     ORDER BY h.inv_tanggal DESC
     LIMIT 50`,
    [excludeNomor, brgKode, supKode]
  );
  return rows;
};

module.exports = {
  getSupplier,
  getBarang,
  getHitungStok,
  getMaxNomor,
  getDetailForm,
  saveData,
  getRiwayatHarga,
};
