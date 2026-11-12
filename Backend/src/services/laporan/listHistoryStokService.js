// services/laporan/listHistoryStokService.js
// Migrasi dari Delphi ufrmListMutasiStok2.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const BETWEEN = " mst_brg_kode = a.brg_kode AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)";

  const query =
    " SELECT brg_kode Kode, brg_nama Nama, Kategori,"
    + " ifnull(HAwal,0) HAwal, ifnull(Awal,0) Awal,"
    + " ifnull(qty_MTCIN,0) Qty_MTCIn, ifnull(H_MTCIN,0) H_MTCIn,"
    + " ifnull(qty_Ret,0) Qty_Ret, ifnull(H_Ret,0) H_Ret,"
    + " ifnull(qty_kor,0) Qty_Kor, ifnull(H_kor,0) H_Kor,"
    + " ifnull(qty_mus,0) Qty_Mus, ifnull(H_mus,0) H_Mus,"
    + " ifnull(qty_jual,0) Qty_Jual, ifnull(H_jual,0) H_Jual,"
    + " ifnull(qty_MTCout_00,0) Qty_MTCOut_00, ifnull(H_MTCout_00,0) H_MTCOut_00,"
    + " ifnull(qty_MTCout_01,0) Qty_MTCOut_01, ifnull(H_MTCout_01,0) H_MTCOut_01,"
    + " ifnull(qty_MTCout_02,0) Qty_MTCOut_02, ifnull(H_MTCout_02,0) H_MTCOut_02,"
    + " ifnull(Akhir,0) Akhir, ifnull(HAkhir,0) HAkhir"
    + " FROM ("
    + " SELECT brg_kode, brg_nama, ktg_nama Kategori, brg_hrgbeli,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal < ?) saldoawal,"
    + " (SELECT sum((mst_stok_in-mst_stok_out)*mst_hargabeli) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal < ?) Hsaldoawal,"
    + " (SELECT sum(mst_stok_in) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%MTCI%') qty_MTCIN,"
    + " (SELECT sum(mst_stok_in*mst_hargabeli) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%MTCI%') H_MTCin,"
    + " (SELECT sum(mst_stok_in) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%RETJ%') qty_Ret,"
    + " (SELECT sum(mst_stok_in*mst_hargabeli) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%RETJ%') H_Ret,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%KOR%') qty_Kor,"
    + " (SELECT sum((mst_stok_in-mst_stok_out)*mst_hargabeli) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%KOR%') H_Kor,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%MUS%') qty_Mus,"
    + " (SELECT sum((mst_stok_out)*mst_hargabeli) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%MUS%') H_Mus,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '00'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') qty_MTCout_00,"
    + " (SELECT sum(mst_stok_out*mst_hargabeli) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '00'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') H_MTCout_00,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '01'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') qty_MTCout_01,"
    + " (SELECT sum(mst_stok_out*mst_hargabeli) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '01'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') H_MTCout_01,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '02'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') qty_MTCout_02,"
    + " (SELECT sum(mst_stok_out*mst_hargabeli) FROM tmasterstok INNER JOIN tmutcab_hdr ON mutc_nomor = mst_noreferensi AND mutc_cbg_tujuan = '02'"
    + "  WHERE " + BETWEEN + " AND mst_noreferensi like '%MTC%') H_MTCout_02,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%DO%') qty_Jual,"
    + " (SELECT sum(mst_stok_out*mst_hargabeli) FROM tmasterstok WHERE " + BETWEEN + " AND mst_noreferensi like '%DO%') H_Jual,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal <= date_add(?, interval 1 day)) akhir,"
    + " (SELECT sum((mst_stok_in-mst_stok_out)*mst_hargabeli) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal <= date_add(?, interval 1 day)) Hakhir"
    + " FROM tbarang a LEFT JOIN tkategori ON ktg_kode = brg_ktg_kode"
    + " ) final";

  const betweenPair = [startDate, endDate];
  const paramsArr = [
    startDate, startDate,
    ...betweenPair, ...betweenPair, ...betweenPair, ...betweenPair,
    ...betweenPair, ...betweenPair, ...betweenPair, ...betweenPair,
    ...betweenPair, ...betweenPair, ...betweenPair, ...betweenPair,
    ...betweenPair, ...betweenPair, ...betweenPair, ...betweenPair,
    endDate, endDate,
  ];

  const [rows] = await db.query(query, paramsArr);
  return rows;
};

module.exports = { getBrowse };