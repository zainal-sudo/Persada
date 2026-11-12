const db = require("../../config/database");

/**
 * Browse Tagihan Ekspedisi — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       teh_nomor AS Nomor,
       DATE_FORMAT(teh_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(teh_tg1, '%Y-%m-%d') AS Tgl1,
       DATE_FORMAT(teh_tg2, '%Y-%m-%d') AS Tgl2
     FROM ttagihanekspedisi_hdr
     WHERE teh_tanggal BETWEEN ? AND ?
     ORDER BY teh_nomor`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Tagihan Ekspedisi — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.tehd_teh_nomor AS Nomor,
       d.tehd_fp_nomor AS NomorFP,
       CASE WHEN d.tehd_fp_nomor = 'ANTARCABANG' THEN d.tehd_cus_nama
            ELSE COALESCE(c.cus_nama, d.tehd_cus_nama) END AS Customer,
       DATE_FORMAT(
         CASE WHEN d.tehd_fp_nomor = 'ANTARCABANG' THEN d.tehd_tanggal
              ELSE COALESCE(f.fp_tanggal, d.tehd_tanggal) END, '%Y-%m-%d') AS TanggalFP,
       d.tehd_nilai AS Nilai,
       d.tehd_biaya AS Biaya,
       CASE WHEN d.tehd_fp_nomor = 'ANTARCABANG' THEN 0
            ELSE (d.tehd_biaya / NULLIF(d.tehd_nilai, 0)) * 100 END AS UOC
     FROM ttagihanekspedisi_dtl d
     INNER JOIN ttagihanekspedisi_hdr h ON h.teh_nomor = d.tehd_teh_nomor
     LEFT JOIN tfp_hdr f ON f.fp_nomor = d.tehd_fp_nomor
     LEFT JOIN tcustomer c ON c.cus_kode = f.fp_cus_kode
     WHERE d.tehd_teh_nomor = ?
     ORDER BY d.tehd_fp_nomor ASC`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };