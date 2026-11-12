// services/laporan/doRealisasiService.js
// Migrasi dari Delphi ufrmLapDORealisasi.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const query =
    " SELECT do_nomor Nomor, do_tanggal Tanggal, MONTH(do_tanggal) Bulan, YEAR(do_tanggal) Tahun,"
    + " Cus_nama Customer,"
    + " CASE WHEN pod_foto IS NOT NULL AND pod_foto <> '' THEN 'Terkirim' ELSE 'Belum Terkirim' END AS Status,"
    + " pod_tanggal POD_Tanggal, pod_foto Foto, 1 AS Tampung"
    + " FROM tdo_hdr"
    + " LEFT JOIN tpod_hdr ON do_nomor = pod_do_nomor"
    + " INNER JOIN tcustomer ON Cus_kode = do_cus_Kode"
    + " WHERE do_tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + " ORDER BY do_tanggal, do_nomor";

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

module.exports = { getBrowse };