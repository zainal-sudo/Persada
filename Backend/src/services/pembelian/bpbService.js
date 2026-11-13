// services/pembelian/bpbService.js
const db = require("../../config/database");

/**
 * Browse BPB — paritas Delphi ufrmBrowseBPB.btnRefreshClick:
 * SELECT ... FROM tbpb_hdr INNER JOIN tpo_hdr INNER JOIN tsupplier
 * WHERE bpb_tanggal BETWEEN startDate AND endDate
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.bpb_nomor AS Nomor,
       DATE_FORMAT(h.bpb_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.bpb_po_nomor, '') AS PO,
       IFNULL(s.sup_nama, '') AS Supplier,
       IF(h.bpb_isinvoice = 0, 'Belum', 'Sudah') AS Status,
       IFNULL(h.bpb_memo, '') AS Memo,
       IFNULL(g.gdg_nama, '') AS Gudang,
       IFNULL(h.user_create, '') AS User_create,
       DATE_FORMAT(h.date_create, '%Y-%m-%d %H:%i:%s') AS date_create
     FROM tbpb_hdr h
     INNER JOIN tpo_hdr p ON p.po_nomor = h.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     LEFT JOIN tgudang g ON g.gdg_kode = h.bpb_gdg_kode
     WHERE h.bpb_tanggal BETWEEN ? AND ?
     ORDER BY h.bpb_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail BPB — paritas Delphi SQLDetail
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.bpbd_bpb_nomor AS Nomor,
       d.bpbd_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(d.bpbd_brg_satuan, '') AS Satuan,
       IFNULL(d.bpbd_qty, 0) AS Jumlah,
       DATE_FORMAT(d.bpbd_tgl_expired, '%Y-%m-%d') AS Expired,
       IFNULL(d.bpbd_idbatch, '') AS IdBatch,
       IFNULL(d.bpbd_status, 0) AS Status
     FROM tbpb_dtl d
     INNER JOIN tbpb_hdr h ON h.bpb_nomor = d.bpbd_bpb_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.bpbd_brg_kode
     WHERE d.bpbd_bpb_nomor = ?
     ORDER BY d.bpbd_nourut ASC`,
    [nomor]
  );
  return rows;
};

/**
 * Hapus BPB — paritas Delphi ufrmBrowseBPB.cxButton4Click:
 * Guard: BPB yang sudah ada invoice tidak boleh dihapus.
 * Urutan: DELETE tbpb_dtl (trigger tbpb_dtl_after_delete mengembalikan
 * pod_qty_terima PO) → DELETE tbpb_hdr.
 */
const deleteData = async (nomor) => {
  const [[bpb]] = await db.query(
    `SELECT bpb_isinvoice, bpb_po_nomor FROM tbpb_hdr WHERE bpb_nomor = ?`,
    [nomor]
  );
  if (!bpb) throw new Error("Data BPB tidak ditemukan.");
  if (Number(bpb.bpb_isinvoice) === 1)
    throw new Error("Transaksi ini sudah ada Invoice, tidak dapat dihapus.");
  const poNomor = bpb.bpb_po_nomor;

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tbpb_dtl WHERE bpbd_bpb_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tbpb_hdr WHERE bpb_nomor = ?`, [nomor]);

    // Pengembalian qty terima PO tidak hanya mengandalkan trigger
    // tbpb_dtl_after_delete — dihitung ulang eksplisit dari BPB yang
    // masih ada supaya selalu kembali utuh.
    await conn.query(
      `UPDATE tpo_dtl d
       LEFT JOIN (
         SELECT b.bpbd_brg_kode AS brg, SUM(b.bpbd_qty) AS q
         FROM tbpb_dtl b JOIN tbpb_hdr h2 ON h2.bpb_nomor = b.bpbd_bpb_nomor
         WHERE h2.bpb_po_nomor = ?
         GROUP BY b.bpbd_brg_kode
       ) r ON r.brg = d.pod_brg_kode
       SET d.pod_qty_terima = IFNULL(r.q, 0)
       WHERE d.pod_po_nomor = ?`,
      [poNomor, poNomor]
    );
    await conn.query(
      `UPDATE tpo_dtl
       SET pod_isclosed = IF(pod_qty > 0 AND pod_qty_terima < pod_qty, 0, 1)
       WHERE pod_po_nomor = ?`,
      [poNomor]
    );
    await conn.query(
      `UPDATE tpo_hdr h
       LEFT JOIN (
         SELECT MAX(pod_qty_terima > 0) AS ada,
                SUM(pod_isclosed = 0) AS open_rows
         FROM tpo_dtl WHERE pod_po_nomor = ?
       ) s ON 1 = 1
       SET h.po_status_rec = IF(IFNULL(s.ada, 0) = 1, 1, 0),
           h.po_isclosed = IF(IFNULL(s.ada, 0) = 1 AND IFNULL(s.open_rows, 0) = 0, 1, 0)
       WHERE h.po_nomor = ?`,
      [poNomor, poNomor]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data print (slip BPB) ─────────────────────────────────────────────
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       h.bpb_nomor AS nomor,
       DATE_FORMAT(h.bpb_tanggal, '%d/%m/%Y') AS tanggal,
       IFNULL(h.bpb_memo, '') AS memo,
       IFNULL(h.bpb_po_nomor, '') AS po_nomor,
       IFNULL(s.sup_nama, '') AS sup_nama,
       IFNULL(s.sup_alamat, '') AS sup_alamat,
       IFNULL(g.gdg_nama, '') AS gdg_nama,
       IFNULL(p.po_pemesan, '') AS pemesan
     FROM tbpb_hdr h
     INNER JOIN tpo_hdr p ON p.po_nomor = h.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     LEFT JOIN tgudang g ON g.gdg_kode = h.bpb_gdg_kode
     WHERE h.bpb_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data BPB tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT
       d.bpbd_nourut AS nourut,
       d.bpbd_brg_kode AS kode,
       IFNULL(b.brg_nama, '') AS nama,
       IFNULL(d.bpbd_brg_satuan, '') AS satuan,
       IFNULL(d.bpbd_qty, 0) AS qty,
       DATE_FORMAT(d.bpbd_tgl_expired, '%d/%m/%Y') AS expired
     FROM tbpb_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.bpbd_brg_kode
     WHERE d.bpbd_bpb_nomor = ?
     ORDER BY d.bpbd_nourut ASC`,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    memo: header.memo,
    po_nomor: header.po_nomor,
    sup_nama: header.sup_nama,
    sup_alamat: header.sup_alamat,
    gdg_nama: header.gdg_nama,
    pemesan: header.pemesan,
    perusahaan: perusahaan
      ? {
          nama: perusahaan.perush_nama,
          alamat: perusahaan.perush_alamat,
          kota: perusahaan.perush_kota,
          notelp: perusahaan.perush_NOtelp,
        }
      : { nama: "", alamat: "", kota: "", notelp: "" },
    detail,
  };
};

/**
 * Ambil jumlah baris per halaman dari tabel barisslip
 * Delphi: getbarisslip('BPB')
 */
const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip };
