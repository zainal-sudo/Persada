const db = require("../../config/database");

/**
 * Browse Penyesuaian Stok — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       a.korh_nomor AS Nomor,
       DATE_FORMAT(a.korh_tanggal, '%Y-%m-%d') AS Tanggal,
       b.gdg_nama AS Gudang,
       IFNULL(a.korh_notes, '') AS Keterangan,
       IFNULL(a.korh_total, 0) AS Total,
       IFNULL(a.korh_total, 0) * 2 AS Total_Price
     FROM tkor_hdr a
     INNER JOIN tgudang b ON b.gdg_kode = a.korh_gdg_kode
     WHERE a.korh_tanggal BETWEEN ? AND ?
     GROUP BY a.korh_nomor, a.korh_tanggal, a.korh_notes
     ORDER BY a.korh_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Penyesuaian Stok — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       h.korh_nomor AS Nomor,
       d.kord_brg_kode AS Kode,
       b.brg_nama AS Nama,
       DATE_FORMAT(d.kord_expired, '%Y-%m-%d') AS Expired,
       d.kord_satuan AS Satuan,
       d.kord_qty AS QtyKorksi,
       d.kord_nilai AS Nilai,
       d.kord_nilai * 2 AS Nilai_Price
     FROM tkor_dtl d
     INNER JOIN tkor_hdr h ON h.korh_nomor = d.kord_korh_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.kord_brg_kode
     WHERE d.kord_korh_nomor = ?
     ORDER BY d.kord_nourut`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };