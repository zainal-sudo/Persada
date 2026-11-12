// services/laporan/listFakturOutstandingService.js
// Migrasi dari Delphi ufrmListFOS.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, customer } = params;

  const customerClause = customer ? " AND (cus_nama LIKE ? OR cus_kode LIKE ?)" : "";
  const query =
    " SELECT month(tanggal) Bulan, year(tanggal) Tahun, Nomor, Tanggal, JthTempo, Rayon, Salesman,"
    + " Tax, Customer, Total, ifnull(CN_User,0) Biaya_Promosi,"
    + " ifnull(Kontrak,0) Kontrak, ifnull(DP,0) DP, ifnull(Bayar,0) Bayar, ifnull(Retur,0) Retur,"
    + " Sisa_Piutang - ifnull(Retur,0) Sisa_piutang, Overdue,"
    + " (CASE WHEN overdue < 0 THEN ' Belum'"
    + "  WHEN overdue >= 0 AND overdue <= 30 THEN '0 sd 30'"
    + "  WHEN overdue >= 31 AND overdue <= 60 THEN '31 s/d 60'"
    + "  WHEN overdue >= 61 AND overdue <= 90 THEN '61 s/d 90'"
    + "  WHEN overdue >= 91 AND overdue <= 120 THEN '91 s/d 120'"
    + "  ELSE 'x > 120' END) Range_overdue,"
    + " if(fp_tipecash=1,'Cash','Non Cash') Tipe"
    + " FROM ("
    + " SELECT fp_nomor Nomor, fp_tanggal Tanggal, fp_jthtempo JthTempo, fp_Memo Memo,"
    + " sls_nama Rayon,"
    + " (SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = so_sla_kode) Salesman,"
    + " if(fp_istax=1,'PPN','Non PPN') Tax, cus_kode, cus_nama Customer, fp_amount Total,"
    + " (fp_biayapr*(fp_amount-fp_taxamount)/100)+fp_biayarp CN_User,"
    + " fp_cn Kontrak, fp_DP DP, fp_bayar Bayar, fp_istax,"
    + " (SELECT sum(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = z.fp_nomor) Retur,"
    + " (FP_AMOUNT-fp_dp-fp_bayar) Sisa_Piutang,"
    + " DATEDIFF(?, fp_jthtempo) OVERDUE, fp_tipecash"
    + " FROM tfp_hdr z"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " LEFT JOIN tso_hdr ON so_nomor = z.fp_so_nomor"
    + " LEFT JOIN Tsalesman ON sls_kode = so_sls_kode"
    + " WHERE (FP_AMOUNT-fp_dp-fp_bayar) > 0" + customerClause
    + " GROUP BY fp_nomor, fp_tanggal, fp_memo, cus_nama"
    + " ) a"
    + " WHERE (sisa_piutang - ifnull(Retur,0)) > 1 AND tanggal <= ?"
    + " ORDER BY Overdue";

  const [rows] = await db.query(
    query,
    customer
      ? [startDate, "%" + customer + "%", "%" + customer + "%", endDate]
      : [startDate, endDate],
  );
  return rows;
};

module.exports = { getBrowse };