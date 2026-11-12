// services/pembelian/poService.js
const db = require("../../config/database");

/**
 * Browse PO — paritas Delphi ufrmBrowsePO.btnRefreshClick:
 * SELECT ... FROM tpo_hdr INNER JOIN tsupplier INNER JOIN tpo_dtl
 * WHERE po_tanggal BETWEEN startDate AND endDate
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.po_nomor AS Nomor,
       DATE_FORMAT(h.po_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.po_memo, '') AS Memo,
       IFNULL(s.sup_nama, '') AS Supplier,
       IF(h.po_isclosed = 0, 'Belum', 'Sudah') AS Closed,
       IFNULL(h.po_amount, 0) AS Total,
       IFNULL(h.po_taxamount, 0) AS Ppn,
       IF(h.po_status_rec = 0, 'Belum', 'Sudah') AS Receipt
     FROM tpo_hdr h
     INNER JOIN tsupplier s ON s.sup_kode = h.po_sup_kode
     INNER JOIN tpo_dtl d ON d.pod_po_nomor = h.po_nomor
     WHERE h.po_tanggal BETWEEN ? AND ?
     GROUP BY h.po_nomor, h.po_tanggal, h.po_memo, s.sup_nama,
              h.po_isclosed, h.po_amount, h.po_taxamount, h.po_status_rec
     ORDER BY h.po_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail PO — paritas Delphi SQLDetail:
 * SELECT ... FROM tpo_dtl INNER JOIN tpo_hdr INNER JOIN tbarang
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.pod_po_nomor AS Nomor,
       d.pod_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(d.pod_brg_satuan, '') AS Satuan,
       IFNULL(d.pod_qty, 0) AS Jumlah,
       IFNULL(d.pod_harga, 0) AS Harga,
       IFNULL(d.pod_discpr, 0) AS Disc,
       ROUND(IFNULL(d.pod_harga, 0) * IFNULL(d.pod_qty, 0) * (100 - IFNULL(d.pod_discpr, 0)) / 100, 2) AS Nilai,
       IFNULL(d.pod_qty_terima, 0) AS Terima
     FROM tpo_dtl d
     INNER JOIN tpo_hdr h ON h.po_nomor = d.pod_po_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.pod_brg_kode
     WHERE d.pod_po_nomor = ?
     ORDER BY d.pod_nourut ASC`,
    [nomor]
  );
  return rows;
};

/**
 * Hapus PO — Delphi browse tidak menyediakan hapus resmi, tetapi web
 * menyediakan dengan guard: PO yang sudah ada receipt tidak boleh dihapus
 * (paritas Delphi ufrmBrowsePO.cxButton1Click — edit terkunci saat receipt).
 */
const deleteData = async (nomor) => {
  const [[po]] = await db.query(
    `SELECT po_status_rec, po_isclosed FROM tpo_hdr WHERE po_nomor = ?`,
    [nomor]
  );
  if (!po) throw new Error("Data PO tidak ditemukan.");
  if (Number(po.po_status_rec) === 1)
    throw new Error("PO sudah ada Receipt Barang. Tidak bisa dihapus.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tpo_dtl WHERE pod_po_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tpo_hdr WHERE po_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/**
 * Toggle Closed PO — paritas Delphi ufrmBrowsePO.cxButton4Click:
 * UPDATE tpo_hdr set po_isclosed=0/1
 */
const toggleClose = async (nomor) => {
  const [[po]] = await db.query(
    `SELECT po_isclosed FROM tpo_hdr WHERE po_nomor = ?`,
    [nomor]
  );
  if (!po) throw new Error("Data PO tidak ditemukan.");

  const newStatus = Number(po.po_isclosed) === 0 ? 1 : 0;
  await db.query(
    `UPDATE tpo_hdr SET po_isclosed = ? WHERE po_nomor = ?`,
    [newStatus, nomor]
  );
  return { closed: newStatus === 1 };
};

/**
 * Cek receipt (po_status_rec) — paritas Delphi ufrmBrowsePO.cekreceipt
 */
const cekReceipt = async (nomor) => {
  const [[po]] = await db.query(
    `SELECT po_status_rec FROM tpo_hdr WHERE po_nomor = ?`,
    [nomor]
  );
  return po ? Number(po.po_status_rec) : 0;
};

// ── Data print (slip PO) ──────────────────────────────────────────────
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       h.po_nomor AS nomor,
       DATE_FORMAT(h.po_tanggal, '%d/%m/%Y') AS tanggal,
       IFNULL(h.po_memo, '') AS memo,
       IFNULL(h.po_amount, 0) AS amount,
       IFNULL(h.po_taxamount, 0) AS taxamount,
       IFNULL(h.po_disc_faktur, 0) AS disc_faktur,
       IFNULL(h.po_disc_fakturpr, 0) AS disc_fakturpr,
       IFNULL(h.po_pemesan, '') AS pemesan,
       DATE_FORMAT(h.po_dateline, '%d/%m/%Y') AS dateline,
       IFNULL(s.sup_nama, '') AS sup_nama,
       IFNULL(s.sup_alamat, '') AS sup_alamat,
       IFNULL(s.sup_telp, '') AS sup_telp
     FROM tpo_hdr h
     INNER JOIN tsupplier s ON s.sup_kode = h.po_sup_kode
     WHERE h.po_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data PO tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT
       d.pod_nourut AS nourut,
       d.pod_brg_kode AS kode,
       IFNULL(b.brg_nama, '') AS nama,
       IFNULL(d.pod_brg_satuan, '') AS satuan,
       IFNULL(d.pod_qty, 0) AS qty,
       IFNULL(d.pod_harga, 0) AS harga,
       IFNULL(d.pod_discpr, 0) AS discpr,
       IFNULL(d.pod_keterangan, '') AS keterangan
     FROM tpo_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.pod_brg_kode
     WHERE d.pod_po_nomor = ?
     ORDER BY d.pod_nourut ASC`,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  const amount = Number(header.amount);
  let terbilangText = "";
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [amount]);
    terbilangText = terb?.t || "";
  } catch {
    terbilangText = "";
  }

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    memo: header.memo,
    amount,
    taxamount: Number(header.taxamount),
    discFaktur: Number(header.disc_faktur),
    discFakturPr: Number(header.disc_fakturpr),
    pemesan: header.pemesan,
    dateline: header.dateline,
    sup_nama: header.sup_nama,
    sup_alamat: header.sup_alamat,
    sup_telp: header.sup_telp,
    terbilang: terbilangText,
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
 * Delphi: getbarisslip('PO')
 */
const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

module.exports = {
  getBrowse,
  getBrowseDetail,
  deleteData,
  toggleClose,
  cekReceipt,
  getPrintData,
  getBarisSlip,
};
