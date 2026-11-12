// services/laporan/listInkasoService.js
// Migrasi dari Delphi ufrmListInkaso.pas (loaddata)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate } = params;

  const query =
    " SELECT Nomor, Tanggal, Customer, Tax, Salesman, Nama_Salesman, Terbayar,"
    + " if(Tax=1, Terbayar*0.1, 0) Ppn, BiayaPromosi, Kontrak, TglBayar,"
    + " month(TglBayar) Bulan, year(TglBayar) Tahun,"
    + " datediff(TglBayar, Tanggal) Selisih_Hari, Range_Hari"
    + " FROM ("
    + " SELECT * ,"
    + " CASE WHEN cicilan = 0 THEN biaya_promosi ELSE 0 END BiayaPromosi,"
    + " if(cicilan = 0, FP_CN, 0) Kontrak,"
    + " CASE WHEN datediff(tglBayar, tanggal) < 41 THEN '0 - 40'"
    + "      WHEN datediff(tglBayar, tanggal) < 60 THEN '41 - 60'"
    + "      ELSE 'x > 60' END Range_Hari"
    + " FROM ("
    +     " SELECT fp_nomor Nomor, fp_tanggal Tanggal, fp_istax Tax, cus_nama Customer,"
    + " sls_nama Salesman,"
    + " (SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = so_sla_kode limit 1) Nama_Salesman,"
    + " bycd_bayar Terbayar,"
    + " CASE WHEN byc_nogiro <> '' THEN"
    + "   (SELECT cg_tanggalcair FROM tpencairangiro WHERE cg_gironumber = byc_nogiro LIMIT 1)"
    + " ELSE byc_tanggal END TglBayar,"
    + " byc_tanggal TglBayar2,"
    + " ((Fp_biayapr*((fp_amount-fp_taxamount-ifnull((SELECT sum(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100) + fp_biayarp) Biaya_Promosi,"
    + " fp_cn,"
    + " (SELECT count(*) FROM tbayarcus_hdr INNER JOIN tbayarcus_dtl ON byc_nomor = bycd_byc_nomor"
    + "  WHERE bycd_fp_nomor = y.bycd_fp_nomor AND byc_tanggal <> x.byc_tanggal) cicilan"
    + " FROM tbayarcus_hdr X"
    + " INNER JOIN tbayarcus_dtl y ON byc_nomor = bycd_byc_nomor"
    + " INNER JOIN tfp_hdr ON bycd_fp_nomor = fp_nomor"
    + " INNER JOIN tcustomer ON cus_kode = fp_cus_kode"
    + " LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor"
    + " LEFT JOIN tsalesman ON so_sls_kode = sls_kode"
    + " ) a"
    + " ) b"
    + " WHERE TglBayar BETWEEN ? AND date_add(?, interval 1 day)";

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

module.exports = { getBrowse };