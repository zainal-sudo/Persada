// services/laporan/stokExpiredService.js
// Migrasi dari Delphi ufrmBrowseStokExpired.pas (btnRefreshClick)
const db = require("../../config/database");

const getBrowse = async (params) => {
  const { startDate, gudang } = params;
  const gudangLike = `${gudang || ""}%`;

  const query =
    " SELECT mst_brg_kode Kode, brg_nama Nama, mst_expired_date Expired, mst_hargabeli HargaBeli,"
    + " sum(mst_stok_in-mst_stok_out) Stok"
    + " FROM tmasterstok INNER JOIN tbarang ON brg_kode = mst_brg_kode"
    + " WHERE mst_expired_date < ? AND mst_expired_date > '2000-01-01'"
    + " AND mst_gdg_kode LIKE ?"
    + " GROUP BY mst_brg_kode, mst_expired_date"
    + " HAVING Stok > 0"
    + " ORDER BY mst_brg_kode";

  const [rows] = await db.query(query, [startDate, gudangLike]);
  return rows;
};

module.exports = { getBrowse };