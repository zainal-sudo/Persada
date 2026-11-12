const db = require("../../config/database");

/**
 * Browse Setting Fee Marketing — sesuai SQLMaster Delphi:
 * SELECT fmh_nomor Nomor, fmh_cus_kode Kode, cus_nama Customer
 * FROM tfeemarketing_hdr
 * INNER JOIN tcustomer ON cus_kode = fmh_cus_kode
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       h.fmh_nomor AS Nomor,
       h.fmh_cus_kode AS Kode,
       IFNULL(c.cus_nama, '') AS Customer
     FROM tfeemarketing_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.fmh_cus_kode
     ORDER BY h.fmh_nomor`
  );
  return rows;
};

/**
 * Browse Detail Setting Fee Marketing — sesuai SQLDetail Delphi:
 * SELECT fmd_fmh_nomor Nomor, fmd_brg_kode Kode, brg_nama Nama,
 *        ktg_nama Kategori, fmd_persen Persen, fmd_rupiah Rupiah
 * FROM tfeemarketing_dtl
 * INNER JOIN tbarang ON brg_kode = fmd_brg_kode
 * INNER JOIN tkategori ON ktg_kode = brg_ktg_kode
 * WHERE fmd_fmh_nomor = ?
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.fmd_fmh_nomor AS Nomor,
       d.fmd_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(k.ktg_nama, '') AS Kategori,
       IFNULL(d.fmd_persen, 0) AS Persen,
       IFNULL(d.fmd_rupiah, 0) AS Rupiah
     FROM tfeemarketing_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.fmd_brg_kode
     INNER JOIN tkategori k ON k.ktg_kode = b.brg_ktg_kode
     WHERE d.fmd_fmh_nomor = ?
     ORDER BY d.fmd_brg_kode`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };