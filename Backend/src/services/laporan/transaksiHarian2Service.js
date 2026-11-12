// services/laporan/transaksiHarian2Service.js
// Migrasi dari Delphi ufrmListTransaksiHarian2.pas (loaddata) — "List Transaksi Harian by Customer"
// Agregat per Tanggal+Customer (+Salesman). Bulan ikut dikembalikan krn
// pivot Delphi pakai Kolom = Bulan (tidak ada di daftar kolom grid).
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, customer } = params;

  let sql =
    " SELECT Tanggal, sls_nama Salesman, Customer, cus_nama Nama, Tax,"
    + " SUM(Bruto) Bruto, SUM(Disc) Disc, SUM(Dpp) Dpp, SUM(Pajak) Pajak, SUM(Total) Total,"
    + " SUM(freight) Freight,"
    + " SUM(Biaya_Promosi) Biaya_Promosi, SUM(Kontrak) Kontrak, SUM(Retur) Retur,"
    + " SUM(Bayar_Cash) Bayar_Cash, SUM(Bayar_Transfer) Bayar_Transfer, SUM(Giro) Giro,"
    + " SUM(Deposit) Deposit, SUM(Hutang_Internal) Hutang_Internal, SUM(koreksi_lr) Koreksi_LR,"
    + " SUM(UM_Penjualan) UM_Penjualan, SUM(Ppn_keluaran) PPn_Keluaran, SUM(pph_22) PPh_22,"
    + " SUM(Potongan) Potongan,"
    + " MONTH(Tanggal) Bulan"
    + " FROM transaksi_harian A"
    + " INNER JOIN tcustomer ON cus_kode = customer"
    + " INNER JOIN tsalesman C ON a.salesman = C.sls_kode"
    + " WHERE Tanggal BETWEEN ? AND date_add(?, interval 1 day)";

  const values = [startDate, endDate];

  if (customer) {
    sql += " AND customer LIKE ?";
    values.push(`${customer}%`);
  }

  sql += " GROUP BY Tanggal, customer, cus_nama, Tax, sls_nama, MONTH(Tanggal) ORDER BY Tanggal";

  const [rows] = await db.query(sql, values);
  return rows;
};

module.exports = { getBrowse };