// services/laporan/listJualPerFakturMarginService.js
// Migrasi dari Delphi ufrmListJual5.pas (loaddata)
const db = require("../../config/database");
const aiCfg = require("../../config/ai");

const getBrowse = async (params, user = {}) => {
  const { startDate, endDate, nomor } = params;

  // nomor = filter satu faktur (dipakai otorisasi STE); jika ada, lewati rentang tanggal.
  const where = nomor
    ? " WHERE fp_nomor = ?"
    : " WHERE fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)";

  const query =
    " SELECT Nomor, month(tanggal) Bulan, year(tanggal) Tahun, Tanggal, JthTempo,"
    + " Salesman, Customer, Total, ifnull(CN,0) Kontrak, ifnull(Biaya_promosi,0) Biaya_Promosi,"
    + " Total - ifnull(Biaya_promosi,0) - ifnull(CN,0) Riil, Net, Hpp, net-hpp Margin"
    + " FROM ("
    + " SELECT fp_nomor Nomor, fp_tanggal Tanggal, fp_jthtempo JthTempo, fp_Memo Memo,"
    + " sls_nama Salesman, cus_nama Customer, fp_amount Total,"
    + " fp_cn CN, ifnull((fp_biayapr*(fp_amount-fp_taxamount)/100)+fp_biayarp,0) Biaya_Promosi,"
    + " fp_DP DP, fp_bayar Bayar,"
    + " fp_amount-fp_taxamount-ifnull((fp_biayapr*(fp_amount-fp_taxamount)/100)+fp_biayarp,0)-ifnull(fp_cn,0)-ifnull(fp_freight,0) net,"
    + " sum(mst_stok_out*mst_hargabeli) hpp"
    + " FROM tfp_hdr z"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " INNER JOIN tmasterstok ON mst_noreferensi = fp_do_nomor"
    + " LEFT JOIN tdo_hdr ON fp_do_nomor = do_nomor"
    + " LEFT JOIN tso_hdr ON so_nomor = COALESCE(z.fp_so_nomor, do_so_nomor)"
    + " LEFT JOIN Tsalesman ON sls_kode = so_sls_kode"
    + where
    + " GROUP BY fp_nomor, fp_tanggal, cus_nama"
    + " ) a";

  const [rows] = await db.query(query, nomor ? [nomor] : [startDate, endDate]);
  // HPP & Margin hanya untuk FINANCE (lapisan server).
  if (aiCfg.isFinanceUser(user)) return rows;
  return rows.map(({ Hpp, Margin, ...rest }) => rest);
};

module.exports = { getBrowse };