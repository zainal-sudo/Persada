const db = require("../../config/database");

/**
 * Browse Group Produk Fokus — sesuai SQLMaster Delphi:
 * SELECT bpf_periode Periode, bpf_tahun Tahun, bpf_brg_kode Kode,
 *        bpf_nama Nama, bpf_grup Grup, bpf_het Het,
 *        bpf_dept Dept, bpf_hna HNA
 * FROM tbarangpf
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       bpf_periode AS Periode,
       bpf_tahun AS Tahun,
       bpf_brg_kode AS Kode,
       IFNULL(bpf_nama, '') AS Nama,
       IFNULL(bpf_grup, '') AS Grup,
       IFNULL(bpf_het, 0) AS Het,
       IFNULL(bpf_dept, '') AS Dept,
       IFNULL(bpf_hna, 0) AS HNA
     FROM tbarangpf
     ORDER BY bpf_periode, bpf_tahun, bpf_brg_kode`
  );
  return rows;
};

module.exports = { getBrowse };