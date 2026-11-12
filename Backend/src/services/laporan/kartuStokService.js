// services/laporan/kartuStokService.js
// Migrasi dari Delphi ufrmBrowseKartuStok.pas (btnRefreshClick)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, gudang } = params;
  const gudangLike = `${gudang || ""}%`;

  const query =
    " SELECT brg_kode Kode, brg_nama Nama, Kategori, brg_hrgbeli Hbeli,"
    + " ifnull(saldoawal,0) _Awal, ifnull(qty_in,0) _In, ifnull(qty_out,0) _Out,"
    + " ifnull(saldoawal,0) + ifnull(qty_in,0) - ifnull(qty_out,0) _Akhir"
    + " FROM ("
    + " SELECT brg_kode, brg_nama, ktg_nama Kategori, brg_hrgbeli,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal < ? AND mst_gdg_kode LIKE ?) saldoawal,"
    + " (SELECT sum(mst_stok_in) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day) AND mst_gdg_kode LIKE ?) qty_in,"
    + " (SELECT sum(mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day) AND mst_gdg_kode LIKE ?) qty_out,"
    + " (SELECT sum(mst_stok_in-mst_stok_out) FROM tmasterstok"
    + "  WHERE mst_brg_kode = a.brg_kode AND mst_tanggal <= date_add(?, interval 1 day) AND mst_gdg_kode LIKE ?) akhir"
    + " FROM tbarang a INNER JOIN tkategori ON ktg_kode = brg_ktg_kode"
    + " ) final"
    + " WHERE ifnull(saldoawal,0) > 0 OR ifnull(qty_in,0) > 0 OR ifnull(qty_out,0) > 0"
    + " ORDER BY brg_kode";

  const [rows] = await db.query(query, [
    startDate, gudangLike,
    startDate, endDate, gudangLike,
    startDate, endDate, gudangLike,
    endDate, gudangLike,
  ]);
  return rows;
};

const getDetail = async (params) => {
  const { kode, startDate, endDate, gudang } = params;
  const gudangLike = `${gudang || ""}%`;

  const query =
    " SELECT mst_brg_kode Kode, mst_noreferensi Nomor, mst_tanggal Tanggal,"
    + " if(mst_noreferensi like '%MTG%','Mutasi Gudang',"
    + "  if(mst_noreferensi like '%MTCI%','Mutasi In Cabang',"
    + "   if(mst_noreferensi like '%MTC.%','Mutasi Out Cabang',"
    + "    if(mst_noreferensi like '%RETJ%','Retur Penjualan',"
    + "     if(mst_noreferensi like '%KOR%','Koreksi',"
    + "      if(mst_noreferensi like '%MUS%','Pemusnahan','Penjualan')))))) Keterangan,"
    + " gdg_nama Gudang, mst_stok_in _IN, mst_stok_out _OUT, mst_expired_date Expired, mst_hargabeli Hargabeli,"
    + " (SELECT cus_nama FROM tcustomer"
    + "  INNER JOIN tso_hdr ON tso_hdr.so_cus_kode = tcustomer.cus_kode"
    + "  INNER JOIN tdo_hdr ON tso_hdr.so_nomor = tdo_hdr.do_so_nomor"
    + "  WHERE tdo_hdr.do_nomor = mst_noreferensi LIMIT 1) Customer,"
    + " (SELECT fp_nomor FROM tfp_hdr WHERE (fp_so_nomor IS NOT NULL AND fp_so_nomor <> '' AND fp_so_nomor = (SELECT do_so_nomor FROM tdo_hdr WHERE do_nomor = mst_noreferensi LIMIT 1)) OR (fp_do_nomor = mst_noreferensi) LIMIT 1) no_Faktur"
    + " FROM tmasterstok INNER JOIN tgudang ON gdg_kode = mst_gdg_kode"
    + " WHERE mst_brg_kode = ? AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day) AND mst_gdg_kode LIKE ?"
    + " ORDER BY mst_tanggal";

  const [rows] = await db.query(query, [kode, startDate, endDate, gudangLike]);
  return rows;
};

module.exports = { getBrowse, getDetail };