// services/laporan/itemMarginMinusService.js
// Migrasi dari Delphi ufrmListItemMinus.pas — "List Item Margin Minus (Lastcost)"
// Item terjual di bawah last cost: net jual < hpp/brg_lastcost. Filter periode.
// Catatan: prefix schema "krm." di sumber Delphi dibuang (web memakai schema aktif).
const db = require("../../config/database");
const aiCfg = require("../../config/ai");

const getBrowse = async (params, user = {}) => {
  const { startDate, endDate } = params;

  const sql =
    " SELECT mst_brg_kode Kode, brg_nama Nama, mst_noreferensi Nomor_DO, fp_nomor Nomor,"
    + " fp_tanggal Tanggal, cus_nama Customer, mst_hargabeli hpp, net, brg_lastcost Lastcost"
    + " FROM ("
    + "   SELECT mst_brg_kode, brg_nama, mst_noreferensi, fp_nomor, fp_tanggal, fp_cus_kode,"
    + "     mst_hargabeli,"
    + "     (fpd_harga - (fpd_harga * fpd_discpr / 100)) Net, brg_lastcost"
    + "   FROM tmasterstok"
    + "   INNER JOIN tbarang ON brg_kode = mst_brg_kode"
    + "     AND mst_tanggal BETWEEN ? AND date_add(?, interval 1 day)"
    + "   INNER JOIN tfp_hdr ON fp_do_nomor = mst_noreferensi"
    + "   INNER JOIN tfp_dtl ON fpd_fp_nomor = fp_nomor AND fpd_brg_kode = mst_brg_kode"
    + "   WHERE mst_noreferensi LIKE '%DO%'"
    + " ) a"
    + " INNER JOIN tcustomer ON fp_cus_kode = cus_kode"
    + " WHERE net < mst_hargabeli AND brg_lastcost IS NOT NULL"
    + " ORDER BY Customer";

  const [rows] = await db.query(sql, [startDate, endDate]);
  // HPP & Lastcost hanya untuk FINANCE (lapisan server).
  if (aiCfg.isFinanceUser(user)) return rows;
  return rows.map(({ hpp, Lastcost, ...rest }) => rest);
};

module.exports = { getBrowse };