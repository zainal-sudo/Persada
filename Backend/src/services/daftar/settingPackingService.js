const db = require("../../config/database");

/**
 * Browse Setting Packing — sesuai SQLMaster Delphi:
 * SELECT pck_nomor Nomor, pck_brg_kode Kode, pck_nama Nama
 * FROM tpacking_hdr
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       pck_nomor AS Nomor,
       pck_brg_kode AS Kode,
       IFNULL(pck_nama, '') AS Nama
     FROM tpacking_hdr
     ORDER BY pck_nomor`
  );
  return rows;
};

/**
 * Browse Detail Setting Packing — sesuai SQLDetail Delphi:
 * SELECT pckd_pck_nomor Nomor, pckd_brg_kode Kode, brg_nama Nama, pckd_qty Qty
 * FROM tpacking_dtl
 * INNER JOIN tbarang ON brg_kode = pckd_brg_kode
 * WHERE pckd_pck_nomor = ?
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.pckd_pck_nomor AS Nomor,
       d.pckd_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(d.pckd_qty, 0) AS Qty
     FROM tpacking_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.pckd_brg_kode
     WHERE d.pckd_pck_nomor = ?
     ORDER BY d.pckd_brg_kode`,
    [nomor]
  );
  return rows;
};

module.exports = { getBrowse, getBrowseDetail };