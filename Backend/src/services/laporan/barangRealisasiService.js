// services/laporan/barangRealisasiService.js
// Migrasi dari Delphi ufrmBrowseBarangRealisasi.pas (btnRefreshClick)
// Tidak ada filter tanggal/global: query berdasarkan pb_isclosed = 0 & pbd_qty > pbd_qtyterima
const db = require("../../config/database");

const MASTER =
  " SELECT brg_kode SKU, brg_nama NamaBarang,"
  + " SUM(pbd_qty) Minta, SUM(pbd_qtyterima) Terima, SUM(pbd_qty - pbd_qtyterima) Kurang"
  + " FROM tbarang"
  + " INNER JOIN tpermintaanbarang_dtl ON pbd_brg_kode = brg_kode"
  + " INNER JOIN tpermintaanbarang_hdr ON pb_nomor = pbd_pb_nomor"
  + " WHERE pbd_qty > pbd_qtyterima AND pb_isclosed = 0"
  + " GROUP BY brg_kode, brg_nama";

const getBrowse = async () => {
  const [rows] = await db.query(MASTER);
  return rows;
};

const getDetail = async (params) => {
  const { kode } = params;
  const query =
    " SELECT pbd_pb_nomor Nomor, pbd_qty Minta, pbd_qtyterima Terima,"
    + " pbd_qty - pbd_qtyterima Kurang, brg_kode SKU"
    + " FROM tbarang"
    + " INNER JOIN tpermintaanbarang_dtl ON pbd_brg_kode = brg_kode"
    + " INNER JOIN tpermintaanbarang_hdr ON pb_nomor = pbd_pb_nomor"
    + " WHERE pbd_qty > pbd_qtyterima AND pb_isclosed = 0 AND brg_kode = ?"
    + " ORDER BY brg_kode";

  const [rows] = await db.query(query, [kode]);
  return rows;
};

module.exports = { getBrowse, getDetail };