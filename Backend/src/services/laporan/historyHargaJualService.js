// services/laporan/historyHargaJualService.js
// Migrasi dari Delphi ufrmBrowseHistoryHargaJual.pas (btnRefreshClick)
// Master: barang yang terjual pada bulan/tahun. Detail (expandable per Kode):
// harga jual per customer pada bulan/tahun utk barang tsb.
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { bulan, tahun } = params;
  const query =
    " SELECT DISTINCT brg_kode Kode, brg_nama Nama, brg_satuan Satuan, ktg_nama Kategori, brg_merk Merk"
    + " FROM tbarang"
    + " INNER JOIN tfp_dtl ON fpd_brg_kode = brg_kode"
    + " INNER JOIN tkategori ON ktg_kode = brg_ktg_kode"
    + " INNER JOIN tfp_hdr ON fpd_fp_nomor = fp_nomor"
    + " WHERE MONTH(fp_tanggal) = ? AND YEAR(fp_tanggal) = ?"
    + " ORDER BY brg_kode";
  const [rows] = await db.query(query, [bulan, tahun]);
  return rows;
};

const getDetail = async (params) => {
  const { bulan, tahun, kode } = params;
  const query =
    " SELECT DISTINCT fpd_brg_kode Kode, cus_nama Customer, fpd_harga Harga, fpd_discpr Disc, fpd_cn Kontrak,"
    + " ((100 - fpd_cn) / 100 * ((100 - fpd_discpr) * fpd_harga / 100)) HargaNet,"
    + " sls_nama Salesman, IF(fp_istax = 1, 'PPN', 'Non PPN') Status"
    + " FROM tfp_dtl"
    + " INNER JOIN tfp_hdr ON fpd_fp_nomor = fp_nomor"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor"
    + " INNER JOIN tsalesman ON sls_kode = so_sls_kode"
    + " WHERE MONTH(fp_tanggal) = ? AND YEAR(fp_tanggal) = ? AND fpd_brg_kode = ?"
    + " ORDER BY fpd_brg_kode, cus_nama";
  const [rows] = await db.query(query, [bulan, tahun, kode]);
  return rows;
};

module.exports = { getBrowse, getDetail };