const db = require("../../config/database");

/**
 * Browse Barang — sesuai SQLMaster Delphi
 */
const getBrowse = async (search = "") => {
  const [rows] = await db.query(
    `SELECT *
     FROM (
       SELECT
         brg_kode AS Kode,
         brg_nama AS Nama,
         brg_satuan AS Satuan,
         ktg_nama AS Kategori,
         gr_nama AS Tipe,
         brg_hrgjual AS HargaJual,
         (SELECT SUM(mst_stok_in - mst_stok_out)
          FROM tmasterstok WHERE mst_brg_kode = brg_kode) AS Stok,
         brg_min_stok AS Min,
         brg_disc_sales AS Disc_Salesman,
         brg_merk AS Merk,
         brg_isaktif AS Aktif,
         brg_isproductfocus AS Product_Focus,
         DATE_FORMAT(
           (SELECT mst_tanggal FROM tmasterstok
            WHERE mst_brg_kode = brg_kode AND mst_noreferensi LIKE '%DO%'
            ORDER BY mst_tanggal DESC LIMIT 1), '%Y-%m-%d') AS Last_Sale,
         (SELECT SUM(mst_stok_in - mst_stok_out)
          FROM tmasterstok
          WHERE mst_brg_kode = brg_kode AND mst_gdg_kode = 'WH-01') AS Stok_Baik,
         (SELECT IFNULL(SUM(fpd_qty), 0) / 3
          FROM tfp_dtl
          INNER JOIN tfp_hdr ON fp_nomor = fpd_fp_nomor
          WHERE fpd_brg_kode = brg_kode
            AND fp_tanggal >= DATE_ADD(NOW(), INTERVAL -90 DAY)) AS Avgs_Sales_per_Bulan,
         DATE_FORMAT(brg_tanggal_in, '%Y-%m-%d') AS IN_Terakhir
       FROM tbarang
       INNER JOIN tkategori ON ktg_kode = brg_ktg_kode
       INNER JOIN tgroup ON gr_kode = brg_gr_kode
       WHERE brg_nama LIKE ?
     ) final
     ORDER BY Kode`,
    [`%${search}%`]
  );

  // Hitung TOR
  return rows.map((r) => ({
    ...r,
    TOR: Number(r.Avgs_Sales_per_Bulan) > 0
      ? Number(r.Stok_Baik) / Number(r.Avgs_Sales_per_Bulan)
      : 0,
  }));
};

/**
 * Browse Detail Barang — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (kode) => {
  const [rows] = await db.query(
    `SELECT
       mst_brg_kode AS Kode,
       mst_gdg_kode AS KD_Gudang,
       gdg_nama AS Gudang,
       DATE_FORMAT(mst_expired_date, '%Y-%m-%d') AS Expired,
       SUM(mst_stok_in - mst_stok_out) AS stok
     FROM tmasterstok
     INNER JOIN tgudang ON gdg_kode = mst_gdg_kode
     WHERE mst_brg_kode = ?
     GROUP BY mst_brg_kode, mst_gdg_kode, mst_expired_date`,
    [kode]
  );
  return rows;
};

/**
 * Toggle Aktif/Nonaktif barang (pengganti hapus — soft-disable, paritas brg_isaktif Delphi).
 */
const toggleAktif = async (kode) => {
  const [[row]] = await db.query(
    `SELECT brg_isaktif FROM tbarang WHERE brg_kode = ?`,
    [kode]
  );
  if (!row) throw new Error("Barang tidak ditemukan.");
  const newStatus = Number(row.brg_isaktif) === 1 ? 0 : 1;
  await db.query(`UPDATE tbarang SET brg_isaktif = ? WHERE brg_kode = ?`, [
    newStatus,
    kode,
  ]);
  return { aktif: newStatus === 1 };
};

module.exports = { getBrowse, getBrowseDetail, toggleAktif };   