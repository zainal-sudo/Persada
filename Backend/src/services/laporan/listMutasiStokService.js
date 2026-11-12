// services/laporan/listMutasiStokService.js
// Migrasi dari Delphi ufrmListMutasiStok.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, gudang } = params;
  const gudangLike = `${gudang || ""}%`;

  const query =
    " SELECT brg_kode Kode, brg_nama Nama, Kategori,"
    + " ifnull(saldoawal,0) _Awal, ifnull(value_saldoawal,0) V_Awal,"
    + " ifnull(qty_in,0) _In, ifnull(V_qty_in,0) V_In,"
    + " ifnull(qty_out,0) _Out, ifnull(v_qty_out,0) V_Out,"
    + " ifnull(saldoawal,0) + ifnull(qty_in,0) - ifnull(qty_out,0) _Akhir,"
    + " ifnull(value_saldoawal,0) + ifnull(V_qty_in,0) - ifnull(V_qty_out,0) V_Akhir"
    + " FROM ("
    + " SELECT brg_kode, brg_nama, ktg_nama Kategori,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal < ?) saldoawal,"
    + " (SELECT sum((mst_stok_in-mst_stok_out)*(if(mst_avgcost > 0, mst_avgcost, mst_hargabeli))) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal < ?) value_saldoawal,"
    + " (SELECT sum(mst_stok_in) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)) qty_in,"
    + " (SELECT sum((mst_stok_in)*(if(mst_avgcost > 0, mst_avgcost, mst_hargabeli))) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)) V_qty_in,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)) qty_out,"
    + " (SELECT sum((mst_stok_out)*(if(mst_avgcost > 0, mst_avgcost, mst_hargabeli))) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)) V_qty_out,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_gdg_kode LIKE ? AND mst_tanggal <= date_add(?, interval 1 day)) akhir"
    + " FROM tbarang a INNER JOIN tkategori ON ktg_kode = brg_ktg_kode"
    + " ) final"
    + " WHERE ifnull(saldoawal,0) > 0 OR ifnull(qty_in,0) > 0 OR ifnull(qty_out,0) > 0";

  const paramsArr = [
    gudangLike, startDate,
    gudangLike, startDate,
    gudangLike, startDate, endDate,
    gudangLike, startDate, endDate,
    gudangLike, startDate, endDate,
    gudangLike, startDate, endDate,
    gudangLike, endDate,
  ];

  const [rows] = await db.query(query, paramsArr);
  return rows;
};

module.exports = { getBrowse };