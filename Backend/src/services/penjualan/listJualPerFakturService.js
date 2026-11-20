// services/penjualan/listJualPerFakturService.js
// Migrasi dari Delphi ufrmListJual2.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const query =
    " SELECT Nomor, month(tanggal) Bulan, year(tanggal) Tahun, Tanggal, JthTempo,"
    + " Area, Salesman, Customer, Total,"
    + " ifnull(Biaya_promosi,0) Biaya_Promosi, ifnull(Retur,0) Retur, Kontrak,"
    + " Total - Kontrak - ifnull(Retur,0) - ifnull(Biaya_promosi,0) Riil, Tax"
    + " FROM ("
    + " SELECT fp_nomor Nomor, fp_tanggal Tanggal, fp_jthtempo JthTempo, fp_Memo Memo,"
    + " sls.sls_nama Area, COALESCE(sla.sla_nama, fsa.sla_nama) Salesman,"
    + " cus_nama Customer, fp_amount Total,"
    + " ((fp_biayapr*(fp_amount-fp_taxamount)/100)+fp_biayarp) Biaya_Promosi,"
    + " fp_cn Kontrak, fp_DP DP, fp_bayar Bayar,"
    + " (SELECT sum(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = z.fp_nomor) Retur,"
    + " if(fp_istax=1, 'PPN', 'Non PPN') Tax"
    + " FROM tfp_hdr z"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " LEFT JOIN tso_hdr ON so_nomor = z.fp_so_nomor"
    + " LEFT JOIN tsalesman sls ON sls.sls_kode = so_sls_kode"
    + " LEFT JOIN tsalesmanaktif sla ON sla.sla_kode = so_sla_kode"
    + " LEFT JOIN tsalesmanaktif fsa ON fsa.sla_kode = z.fp_sla_kode"
    + " WHERE fp_tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + " GROUP BY fp_nomor, fp_tanggal, cus_nama"
    + " ) a";

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

module.exports = { getBrowse };
