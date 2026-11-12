// services/penjualan/listJualPerOutletService.js
// Migrasi dari Delphi ufrmListJual3.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const query =
    " SELECT Salesman, Customer, Golongan, month(tanggal) Bulan, year(tanggal) Tahun,"
    + " sum(Total) Total, sum(ifnull(Retur,0)) Retur, sum(IFNULL(CN,0)) Kontrak,"
    + " sum(ifnull(Biaya_Promosi,0)) Biaya_promosi,"
    + " SUM(Total - IFNULL(CN,0) - IFNULL(Biaya_Promosi,0) - ifnull(Retur,0)) Riil"
    + " FROM ("
    + " SELECT fp_nomor Nomor, fp_tanggal Tanggal, fp_jthtempo JthTempo, fp_Memo Memo,"
    + " sls_nama Salesman, cus_nama Customer, gc_nama Golongan,"
    + " sum(fp_amount) Total, sum(fp_cn) CN, sum(fp_DP) DP, sum(fp_bayar) Bayar,"
    + " sum(((fp_biayapr*(fp_amount-fp_taxamount)/100)+fp_biayarp)) Biaya_Promosi,"
    + " (SELECT sum(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = z.fp_nomor) Retur"
    + " FROM tfp_hdr z"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " LEFT JOIN tgolongancustomer ON gc_kode = cus_gc_kode"
    + " "
    + " LEFT JOIN tso_hdr ON so_nomor = z.fp_so_nomor"
    + " LEFT JOIN tsalesman ON sls_kode = so_sls_kode"
    + " WHERE fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + " GROUP BY fp_nomor"
    + " ) a"
    + " GROUP BY year(tanggal), month(tanggal), Customer"
    + " ORDER BY Riil";

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

module.exports = { getBrowse };
