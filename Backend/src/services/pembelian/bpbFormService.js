// services/pembelian/bpbFormService.js
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");

// ── Lookup Supplier ───────────────────────────────────────────────────
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

// ── Lookup Gudang (paritas Delphi CDSGudang) ──────────────────────────
const getGudang = async () => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama FROM tgudang ORDER BY gdg_nama`
  );
  return rows;
};

// ── Lookup PO belum closed (paritas Delphi ufrmBPB.edtNomorPOClickBtn) ─
const getOpenPO = async (search = "") => {
  const [rows] = await db.query(
    `SELECT p.po_nomor AS nomor,
            DATE_FORMAT(p.po_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(s.sup_nama, '') AS supplier,
            IFNULL(p.po_sup_kode, '') AS supKode,
            IFNULL(p.po_istax, 0) AS isTax
     FROM tpo_hdr p
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     WHERE p.po_isclosed = 0 AND (p.po_nomor LIKE ? OR s.sup_nama LIKE ?)
     ORDER BY p.po_nomor DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load item PO (paritas Delphi ufrmBPB.loaddataPO) ──────────────────
const getDetailByPO = async (nomorPO) => {
  const [rows] = await db.query(
    `SELECT
       d.pod_brg_kode AS brgKode,
       IFNULL(b.brg_nama, '') AS brgNama,
       IFNULL(d.pod_brg_satuan, '') AS satuan,
       IFNULL(d.pod_qty, 0) AS qtyPO,
       IFNULL(d.pod_qty_terima, 0) AS sudah,
       IFNULL(d.pod_qty, 0) - IFNULL(d.pod_qty_terima, 0) AS kurang,
       IFNULL(d.pod_isclosed, 0) AS closed
     FROM tpo_hdr h
     LEFT JOIN tpo_dtl d ON d.pod_po_nomor = h.po_nomor
     LEFT JOIN tbarang b ON b.brg_kode = d.pod_brg_kode
     WHERE h.po_nomor = ?
     ORDER BY d.pod_nourut`,
    [nomorPO]
  );
  return rows;
};

// ── Cek barang wajib expired (paritas Delphi ufrmBPB.getstatusexpired) ─
const getStatusexpired = async (brgKode) => {
  const [[row]] = await db.query(
    `SELECT brg_isexpired AS isExpired FROM tbarang WHERE brg_kode = ?`,
    [brgKode]
  );
  return row ? Number(row.isExpired) : 0;
};

// ── Generate Nomor BPB (paritas Delphi ufrmBPB.getmaxkode) ────────────
// Pajak mengikuti po_istax PO sumber.
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-RI.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(h.bpb_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tbpb_hdr h
       INNER JOIN tpo_hdr p ON p.po_nomor = h.bpb_po_nomor
       WHERE h.bpb_nomor LIKE ? AND p.po_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(h.bpb_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tbpb_hdr h
       INNER JOIN tpo_hdr p ON p.po_nomor = h.bpb_po_nomor
       WHERE h.bpb_nomor LIKE ? AND p.po_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  }
};

// ── Load Form Edit (paritas Delphi ufrmBPB.loaddataall) ───────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT h.bpb_nomor AS nomor,
            DATE_FORMAT(h.bpb_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(h.bpb_po_nomor, '') AS poNomor,
            IFNULL(h.bpb_memo, '') AS memo,
            IFNULL(h.bpb_gdg_kode, '') AS gdgKode,
            IFNULL(h.bpb_isinvoice, 0) AS isInvoice,
            IFNULL(p.po_sup_kode, '') AS supKode,
            IFNULL(p.po_istax, 0) AS isTax
     FROM tbpb_hdr h
     INNER JOIN tpo_hdr p ON p.po_nomor = h.bpb_po_nomor
     WHERE h.bpb_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("BPB tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama AS supNama, sup_alamat AS alamat FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [h.supKode]
  );
  const [[gudang]] = await db.query(
    `SELECT gdg_nama AS gdgNama FROM tgudang WHERE gdg_kode = ? LIMIT 1`,
    [h.gdgKode]
  );

  const [detail] = await db.query(
    `SELECT d.bpbd_brg_kode AS brgKode,
            IFNULL(b.brg_nama, '') AS brgNama,
            IFNULL(d.bpbd_brg_satuan, '') AS satuan,
            IFNULL(d.bpbd_qty, 0) AS qty,
       DATE_FORMAT(d.bpbd_tgl_expired, '%Y-%m-%d') AS expired,
       IFNULL(d.bpbd_idbatch, '') AS idBatch,
       IFNULL(d.bpbd_status, 0) AS closed,
            IFNULL((SELECT p.pod_qty_terima FROM tpo_dtl p
                    WHERE p.pod_po_nomor = ? AND p.pod_brg_kode = d.bpbd_brg_kode), 0)
              - IFNULL(d.bpbd_qty, 0) AS sudah,
            IFNULL((SELECT p.pod_qty FROM tpo_dtl p
                    WHERE p.pod_po_nomor = ? AND p.pod_brg_kode = d.bpbd_brg_kode), 0)
              - IFNULL((SELECT p.pod_qty_terima FROM tpo_dtl p
                    WHERE p.pod_po_nomor = ? AND p.pod_brg_kode = d.bpbd_brg_kode), 0)
              + IFNULL(d.bpbd_qty, 0) AS kurang
     FROM tbpb_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.bpbd_brg_kode
     WHERE d.bpbd_bpb_nomor = ?
     ORDER BY d.bpbd_nourut ASC`,
    [h.poNomor, h.poNomor, h.poNomor, nomor]
  );

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    gdgNama: gudang?.gdgNama || "",
    detail,
  };
};

// ── Save Data (paritas Delphi ufrmBPB.simpandata) ─────────────────────
// Urutan identik: UPDATE/INSERT header → DELETE detail → INSERT detail.
// Trigger tbpb_dtl_after_delete/after_insert menyesuaikan pod_qty_terima PO.
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, poNomor, memo, gdgKode, detail } = payload;

  // Paritas Delphi cxButton1/2Click: cekTutupPeriode sebelum cekdata
  if (await cekTutupPeriode(tanggal))
    throw new Error("Periode sudah ditutup. Transaksi tidak bisa disimpan.");

  if (!poNomor) throw new Error("Nomor PO belum dipilih.");
  if (!gdgKode) throw new Error("Gudang belum di pilih.");
  if (!Array.isArray(detail) || detail.length === 0)
    throw new Error("Detail barang belum diisi.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let actualNomor = nomor;
    let effPoNomor = poNomor;
    let isTax = 1;

    if (isEdit) {
      const [[bpb]] = await conn.query(
        `SELECT h.bpb_isinvoice, h.bpb_po_nomor
         FROM tbpb_hdr h WHERE h.bpb_nomor = ? FOR UPDATE`,
        [nomor]
      );
      if (!bpb) throw new Error("BPB tidak ditemukan.");
      if (Number(bpb.bpb_isinvoice) === 1)
        throw new Error(
          "Transaksi ini sudah ada Invoice, tidak dapat diedit"
        );
      effPoNomor = bpb.bpb_po_nomor;

      await conn.query(
        `UPDATE tbpb_hdr SET
           bpb_gdg_kode = ?, bpb_memo = ?, bpb_tanggal = ?,
           date_modified = NOW(), user_modified = ?
         WHERE bpb_nomor = ?`,
        [gdgKode, memo, tanggal, user.kode, nomor]
      );
    } else {
      const [[po]] = await conn.query(
        `SELECT po_sup_kode, po_istax FROM tpo_hdr WHERE po_nomor = ? FOR UPDATE`,
        [poNomor]
      );
      if (!po) throw new Error("PO tidak ditemukan.");
      effPoNomor = poNomor;
      isTax = Number(po.po_istax) || 0;

      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tbpb_hdr
           (bpb_nomor, bpb_tanggal, bpb_po_nomor, bpb_memo, bpb_gdg_kode,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, poNomor, memo, gdgKode, user.kode]
      );
    }

    await conn.query(`DELETE FROM tbpb_dtl WHERE bpbd_bpb_nomor = ?`, [actualNomor]);

    // Validasi qty ≤ sisa PO (paritas Delphi clQTYPropertiesValidate).
    // Saat edit, trigger delete sudah mengembalikan pod_qty_terima sehingga
    // sisa = pod_qty - pod_qty_terima.
    const [poItems] = await conn.query(
      `SELECT pod_brg_kode AS brgKode, pod_qty AS qtyPO, pod_qty_terima AS qtyTerima
       FROM tpo_dtl WHERE pod_po_nomor = ?`,
      [effPoNomor]
    );
    const poMap = new Map(
      poItems.map((r) => [
        Number(r.brgKode),
        { qtyPO: Number(r.qtyPO) || 0, kurang: (Number(r.qtyPO) || 0) - (Number(r.qtyTerima) || 0) },
      ])
    );

    const qtyPerSku = new Map();
    for (const d of detail) {
      const brgKode = Number(d.brgKode) || 0;
      const qty = Number(d.qty) || 0;
      if (brgKode && qty > 0)
        qtyPerSku.set(brgKode, (qtyPerSku.get(brgKode) || 0) + qty);
    }
    for (const [brgKode, qtyTotal] of qtyPerSku) {
      const po = poMap.get(brgKode);
      if (!po) throw new Error(`Barang SKU ${brgKode} tidak ada di PO.`);
      if (qtyTotal > po.kurang)
        throw new Error(
          `Qty SKU ${brgKode} melebihi qty kurang PO (${po.kurang}).`
        );
    }

    // Cek status expired per barang (paritas Delphi cekdata)
    let nourut = 1;
    const seen = new Set();
    for (const d of detail) {
      const qty = Number(d.qty) || 0;
      const brgKode = Number(d.brgKode) || 0;
      if (!brgKode) throw new Error(`SKU Baris : ${nourut} Belum dipilih`);
      if (qty <= 0) continue; // Paritas Delphi: hanya baris qty > 0 disimpan

      // PK tbpb_dtl = (nomor, brg_kode, expired): 1 baris per SKU+expired
      const expKey = String(d.expired || "");
      const key = `${brgKode}|${expKey}`;
      if (expKey && seen.has(key))
        throw new Error(
          `SKU ${brgKode} dengan Expired ${expKey} sudah ada di baris lain. Gunakan tanggal expired berbeda untuk batch baru.`
        );
      if (expKey) seen.add(key);

      // Cek status expired per barang (paritas Delphi cekdata)
      const isExp = await getStatusexpired(brgKode);
      if (isExp === 1 && !d.expired)
        throw new Error(`Expired Baris : ${nourut} Belum diisi`);

      await conn.query(
        `INSERT INTO tbpb_dtl
           (bpbd_bpb_nomor, bpbd_brg_kode, bpbd_brg_satuan, bpbd_qty,
            bpbd_tgl_expired, bpbd_nourut, bpbd_status, bpbd_idbatch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, brgKode, d.satuan, qty,
          d.expired || null, nourut, Number(d.closed) || 0, d.idBatch || "",
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
  getGudang,
  getOpenPO,
  getDetailByPO,
  getStatusexpired,
  getMaxNomor,
  getDetailForm,
  saveData,
};
