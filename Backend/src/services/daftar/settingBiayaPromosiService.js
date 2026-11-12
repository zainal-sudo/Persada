const db = require("../../config/database");

/**
 * Browse Setting Biaya Promosi — sesuai SQLMaster Delphi:
 * SELECT bph_nomor Nomor, bph_cus_kode Kode, cus_nama Customer
 * FROM tbiayapromosi_hdr
 * INNER JOIN tcustomer ON cus_kode = bph_cus_kode
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       h.bph_nomor AS Nomor,
       h.bph_cus_kode AS Kode,
       IFNULL(c.cus_nama, '') AS Customer
     FROM tbiayapromosi_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.bph_cus_kode
     ORDER BY h.bph_nomor`
  );
  return rows;
};

/**
 * Browse Detail Setting Biaya Promosi — sesuai SQLDetail Delphi:
 * SELECT bpd_bph_nomor Nomor, bpd_brg_kode Kode, brg_nama Nama,
 *        ktg_nama Kategori, bpd_persen Persen, bpd_rupiah Rupiah
 * FROM Tbiayapromosi_dtl
 * INNER JOIN tbarang ON brg_kode = bpd_brg_kode
 * INNER JOIN tkategori ON ktg_kode = brg_ktg_kode
 * WHERE bpd_bph_nomor = ?
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.bpd_bph_nomor AS Nomor,
       d.bpd_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(k.ktg_nama, '') AS Kategori,
       IFNULL(d.bpd_persen, 0) AS Persen,
       IFNULL(d.bpd_rupiah, 0) AS Rupiah
     FROM tbiayapromosi_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.bpd_brg_kode
     INNER JOIN tkategori k ON k.ktg_kode = b.brg_ktg_kode
     WHERE d.bpd_bph_nomor = ?
     ORDER BY d.bpd_brg_kode`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };