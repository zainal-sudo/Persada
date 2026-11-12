// services/penjualan/listJualPerItemAkumulatifService.js
// Migrasi dari Delphi ufrmListJual4.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const query =
    " SELECT month(fp_tanggal) Bulan, year(fp_tanggal) Tahun,"
    + " brg_kode Kode, brg_nama Nama, fpd_brg_satuan Satuan, ktg_nama Kategori,"
    + " sum(fpd_qty) Qty,"
    + " sum((100-fpd_discpr)*(fpd_harga*fpd_qty)/100*if(fp_istax=1,if(fp_tanggal<\"2022/04/01\",1.1,1.11),1)) Nilai"
    + " FROM tfp_dtl"
    + " INNER JOIN tfp_hdr ON fpd_fp_nomor = fp_nomor"
    + " INNER JOIN tbarang ON fpd_brg_kode = brg_kode"
    + " INNER JOIN tcustomer ON fp_cus_kode = cus_kode"
    + " LEFT JOIN tkategori ON brg_ktg_kode = ktg_kode"
    + " "
    + " LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor"
    + " LEFT JOIN tsalesman ON sls_kode = so_sls_kode"
    + " WHERE fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + " GROUP BY month(fp_tanggal), year(fp_tanggal), brg_kode, brg_nama, fpd_brg_satuan";

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

module.exports = { getBrowse };