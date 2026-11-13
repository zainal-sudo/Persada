// services/penjualan/doService.js
const db = require("../../config/database");
const { syncSO } = require("./doFormService");

// ── Browse DO ────────────────────────────────────────────────────────
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.do_nomor AS Nomor,
       DATE_FORMAT(h.do_tanggal, '%Y-%m-%d') AS Tanggal,
       h.do_so_nomor AS Nomor_SO,
       IFNULL(s.sla_nama, '') AS Salesman,
       IFNULL(c.cus_nama, '') AS Customer,
       IF(h.do_isInvoice = 0, 'Belum', 'Sudah') AS Invoiced,
       IFNULL(h.do_iskembali, 0) AS Kembali
     FROM tdo_hdr h
     INNER JOIN tso_hdr so ON so.so_nomor = h.do_so_nomor
     INNER JOIN tsalesmanaktif s ON s.sla_kode = so.so_sla_kode
     INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
     WHERE h.do_tanggal BETWEEN ? AND ?
     GROUP BY h.do_nomor, h.do_tanggal, c.cus_nama
     ORDER BY h.do_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

// ── Browse Detail DO ─────────────────────────────────────────────────
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.dod_do_nomor AS Nomor,
       d.dod_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.dod_brg_satuan AS Satuan,
       d.dod_qty AS Jumlah,
       d.dod_qty_invoice AS Jumlah_Invoiced,
       DATE_FORMAT(d.dod_tgl_expired, '%Y-%m-%d') AS Expired,
       IFNULL(d.dod_idbatch, '') AS Batch
     FROM tdo_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.dod_brg_kode
     WHERE d.dod_do_nomor = ?
     ORDER BY d.dod_nourut ASC`,
    [nomor]
  );
  return rows;
};

// ── Data print (slip DO / Surat Jalan) ───────────────────────────────
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      h.do_nomor        AS nomor,
      DATE_FORMAT(h.do_tanggal, '%d/%m/%Y') AS tanggal,
      IFNULL(h.do_shipaddress, '') AS shipaddress,
      IFNULL(s.sla_nama, '') AS salesman,
      IFNULL(c.cus_nama, '') AS cus_nama,
      IFNULL(c.cus_alamat, '') AS cus_alamat,
      IFNULL(c.cus_telp, '') AS cus_telp,
      IFNULL(c.cus_fax, '') AS cus_fax
    FROM tdo_hdr h
    INNER JOIN tso_hdr so ON so.so_nomor = h.do_so_nomor
    INNER JOIN tcustomer c ON c.cus_kode = so.so_cus_kode
    LEFT JOIN tsalesmanaktif s ON s.sla_kode = so.so_sla_kode
    WHERE h.do_nomor = ?
    `,
    [nomor]
  );
  if (!header) throw new Error("Data DO tidak ditemukan.");

  const [detail] = await db.query(
    `
    SELECT
      IFNULL(d.dod_nourut, 0) AS nourut,
      d.dod_brg_kode    AS kode,
      IFNULL(b.brg_nama, '') AS nama,
      IFNULL(d.dod_brg_satuan, '') AS satuan,
      IFNULL(d.dod_qty, 0) AS qty,
      IFNULL(g.gdg_nama, '') AS gudang,
      IFNULL(d.dod_tgl_expired, NULL) AS tgl_expired
    FROM tdo_dtl d
    INNER JOIN tbarang b ON b.brg_kode = d.dod_brg_kode
    LEFT JOIN tgudang g ON g.gdg_kode = d.dod_gdg_kode
    WHERE d.dod_do_nomor = ?
    ORDER BY d.dod_nourut ASC
    `,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    shipaddress: header.shipaddress,
    cus_nama: header.cus_nama,
    cus_alamat: header.cus_alamat,
    cus_telp: header.cus_telp,
    cus_fax: header.cus_fax,
    salesman: header.salesman,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      kota: perusahaan.perush_kota,
      notelp: perusahaan.perush_NOtelp,
    } : { nama: '', alamat: '', kota: '', notelp: '' },
    detail,
  };
};

const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

// ── Delete DO ────────────────────────────────────────────────────────
const deleteData = async (nomor) => {
  const [[doHeader]] = await db.query(
    `SELECT do_isInvoice, do_iskembali, do_so_nomor FROM tdo_hdr WHERE do_nomor = ?`,
    [nomor]
  );

  if (!doHeader) throw new Error("Data DO tidak ditemukan.");
  if (Number(doHeader.do_isInvoice) === 1) throw new Error("DO sudah di-invoice. Tidak bisa dihapus.");

  const nomorSO = doHeader.do_so_nomor;

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tdo_dtl WHERE dod_do_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tdo_hdr WHERE do_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  // Perbaikan dari bug Delphi: hapus DO tak re-sync SO → sod_qty_kirim/so_iskirim
  // over-count. Sinkronkan ulang SO sumber setelah DO terhapus (fail-safe).
  await syncSO(nomorSO);
};

// ── Toggle status Kembali (paritas Delphi UpdateStatusKembali1Click) ──
const toggleKembali = async (nomor) => {
  const [[dohdr]] = await db.query(
    `SELECT do_iskembali FROM tdo_hdr WHERE do_nomor = ?`,
    [nomor]
  );
  if (!dohdr) throw new Error("Data DO tidak ditemukan.");

  const newStatus = Number(dohdr.do_iskembali) === 0 ? 1 : 0;
  await db.query(
    `UPDATE tdo_hdr SET do_iskembali = ? WHERE do_nomor = ?`,
    [newStatus, nomor]
  );
  return { kembali: newStatus === 1 };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip, toggleKembali };