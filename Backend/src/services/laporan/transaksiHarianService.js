// services/laporan/transaksiHarianService.js
// Migrasi dari Delphi ufrmListTransaksiHarian.pas (loaddata)
// Daftar transaksi harian dari view transaksi_harian, difilter rentang tanggal
// (+ opsi customer prefix). Kembalikan kolom mentah (tanpa /1000) persis Delphi.
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, endDate, customer } = params;

  let sql =
    " SELECT Tanggal, Nomor, Customer, cus_nama Nama, Tax, Bruto, Disc, Dpp, Pajak,"
    + " Total, Biaya_Promosi, Kontrak, Retur, Bayar_Cash, Bayar_Transfer, Giro,"
    + " MONTH(Tanggal) Bulan, YEAR(Tanggal) Tahun"
    + " FROM transaksi_harian"
    + " INNER JOIN tcustomer ON cus_kode = Customer"
    + " WHERE Tanggal BETWEEN ? AND date_add(?, interval 1 day)";

  const values = [startDate, endDate];

  if (customer) {
    sql += " AND customer LIKE ?";
    values.push(`${customer}%`);
  }

  sql += " ORDER BY Tanggal";

  const [rows] = await db.query(sql, values);
  return rows;
};

module.exports = { getBrowse };