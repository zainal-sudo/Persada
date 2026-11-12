// services/laporan/saldoPiutangService.js
// Migrasi dari Delphi ufrmListSaldoPiutang.pas (loaddata) — "Saldo Piutang"
// Saldo awal dari kartu_piutang (tanggal < startDate), mutasi dari transaksi_harian
// selama periode, Saldo_Akhir = (Saldo_Awal + Total) - (retur & pembayaran & potongan).
// Filter customer: ditambahkan utk kebutuhan AI (opsional, LIKE nama/kode).
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, customer } = params;

  const customerClause = customer ? " WHERE (cus_nama LIKE ? OR final.customer LIKE ?)" : "";
  const sql =
    " SELECT final.Customer, cus_nama Nama, final.Tax,"
    + " IFNULL(Saldo_awal, 0) Saldo_Awal,"
    + " IFNULL(Total, 0) Total,"
    + " IFNULL(retur, 0) Retur,"
    + " Bayar_cash, Bayar_transfer, Giro, Potongan, Deposit, Koreksi_LR,"
    + " Hutang_Internal, UM_Penjualan, PPN_Keluaran, PPh_22,"
    + " (IFNULL(Saldo_awal, 0) + IFNULL(Total, 0)) - ("
    + "   IFNULL(retur, 0) + IFNULL(bayar_cash, 0) + IFNULL(bayar_transfer, 0)"
    + "   + IFNULL(giro, 0) + IFNULL(potongan, 0) + IFNULL(deposit, 0)"
    + "   + IFNULL(KOREKSI_LR, 0) + IFNULL(um_penjualan, 0) + IFNULL(hutang_internal, 0)"
    + "   + IFNULL(ppn_keluaran, 0) + IFNULL(pph_22, 0)"
    + " ) Saldo_Akhir"
    + " FROM ("
    + "   SELECT aa.customer, aa.tax, sa.Saldo_Awal,"
    + "     SUM(Bruto) Bruto, SUM(Disc) Disc, SUM(Dpp) Dpp,"
    + "     SUM(Pajak) Pajak, SUM(Total) Total, SUM(Biaya_Promosi) Biaya_Promosi,"
    + "     SUM(Kontrak) Kontrak, SUM(freight) Freight,"
    + "     SUM(Retur) Retur, SUM(Bayar_Cash) Bayar_Cash, SUM(Bayar_Transfer) Bayar_Transfer,"
    + "     SUM(Giro) Giro, SUM(Deposit) Deposit, SUM(Potongan) Potongan,"
    + "     SUM(koreksi_lr) koreksi_lr, SUM(hutang_internal) Hutang_Internal,"
    + "     SUM(um_penjualan) Um_Penjualan, SUM(PPn_Keluaran) PPn_Keluaran, SUM(PPh_22) PPh_22"
    + "   FROM (SELECT customer, tax FROM transaksi_harian GROUP BY customer, tax) aa"
    + "   LEFT JOIN ("
    + "     SELECT fh.fp_cus_kode customer,"
    + "       IF(fh.fp_istax = 1, 'PPN', 'Non PPn') COLLATE utf8mb4_general_ci tax,"
    + "       SUM(kp.kredit - kp.debet) Saldo_Awal"
    + "     FROM kartu_piutang kp"
    + "     INNER JOIN tfp_hdr fh ON fh.fp_nomor = kp.noreferensi"
    + "     WHERE kp.Tanggal < ?"
    + "     GROUP BY fh.fp_cus_kode, IF(fh.fp_istax = 1, 'PPN', 'Non PPn')"
    + "   ) sa ON sa.customer = aa.customer AND sa.tax = aa.tax"
    + "   LEFT JOIN transaksi_harian A ON aa.customer = A.customer AND A.tax = aa.tax"
    + "     AND tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + "   GROUP BY aa.customer, aa.tax, sa.Saldo_Awal"
    + " ) final"
    + " INNER JOIN tcustomer ON cus_kode = final.customer"
    + customerClause
    + " ORDER BY final.Customer";

  const [rows] = await db.query(
    sql,
    customer
      ? [startDate, startDate, endDate, "%" + customer + "%", "%" + customer + "%"]
      : [startDate, startDate, endDate],
  );
  return rows;
};

module.exports = { getBrowse };