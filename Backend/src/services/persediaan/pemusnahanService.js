const db = require("../../config/database");

/**
 * Browse Pemusnahan — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       a.mus_nomor AS Nomor,
       DATE_FORMAT(a.mus_tanggal, '%Y-%m-%d') AS Tanggal,
       b.gdg_nama AS Gudang,
       IFNULL(a.mus_notes, '') AS Keterangan,
       IFNULL(a.mus_total, 0) AS Total
     FROM tmus_hdr a
     INNER JOIN tgudang b ON b.gdg_kode = a.mus_gdg_kode
     WHERE a.mus_tanggal BETWEEN ? AND ?
     GROUP BY a.mus_nomor, a.mus_tanggal, a.mus_notes
     ORDER BY a.mus_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Pemusnahan — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       h.mus_nomor AS Nomor,
       d.musd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       DATE_FORMAT(d.musd_tgl_expired, '%Y-%m-%d') AS Expired,
       d.musd_brg_satuan AS Satuan,
       d.musd_qty AS QtyMusnah,
       d.musd_harga AS Harga
     FROM tmus_dtl d
     INNER JOIN tmus_hdr h ON h.mus_nomor = d.musd_mus_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.musd_brg_kode
     WHERE d.musd_mus_nomor = ?
     ORDER BY d.musd_nourut`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };