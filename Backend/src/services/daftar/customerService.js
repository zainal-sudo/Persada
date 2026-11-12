const db = require("../../config/database");

/**
 * Browse Customer — sesuai SQLMaster Delphi:
 * SELECT cus_kode Kode, cus_nama Nama, cus_alamat Alamat,
 *        gc_nama Golongan, cus_kota Kota, cus_Telp Telp,
 *        cus_fax Fax, cus_CP Contact, cus_piutang Piutang,
 *        jc_nama Jenis_Customer, cus_npwp NPWP,
 *        cus_namanpwp NAMANPWP, cus_alamatnpwp ALAMATNPWP,
 *        (SELECT byc_tanggal FROM tbayarcus_hdr WHERE byc_cus_kode = cus_kode
 *         ORDER BY byc_tanggal DESC LIMIT 1) last_paid,
 *        cus_top Top, IF(cus_locked=0,'Open','Locked') Locked,
 *        (SELECT sls_nama FROM tsalescustomer
 *         INNER JOIN tsalesman ON sls_kode = sc_sls_kode
 *         WHERE sc_cus_kode = cus_kode LIMIT 1) Marketing
 * FROM tcustomer
 * LEFT JOIN tgolongancustomer ON cus_gc_kode = gc_kode
 * LEFT JOIN tjeniscustomer ON jc_kode = cus_jc_kode
 * WHERE cus_cabang = ?
 */
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT
       c.cus_kode                                       AS Kode,
       c.cus_nama                                       AS Nama,
       IFNULL(c.cus_alamat, '')                         AS Alamat,
       IFNULL(g.gc_nama, '')                            AS Golongan,
       IFNULL(c.cus_kota, '')                           AS Kota,
       IFNULL(c.cus_telp, '')                           AS Telp,
       IFNULL(c.cus_fax, '')                            AS Fax,
       IFNULL(c.cus_CP, '')                             AS Contact,
       IFNULL(c.cus_piutang, 0)                         AS Piutang,
       IFNULL(j.jc_nama, '')                            AS Jenis_Customer,
       IFNULL(c.cus_npwp, '')                           AS NPWP,
       IFNULL(c.cus_namanpwp, '')                       AS NAMANPWP,
       IFNULL(c.cus_alamatnpwp, '')                     AS ALAMATNPWP,
       DATE_FORMAT(
         (SELECT byc_tanggal
          FROM tbayarcus_hdr
          WHERE byc_cus_kode = c.cus_kode
          ORDER BY byc_tanggal DESC
          LIMIT 1), '%Y-%m-%d')                         AS last_paid,
       IFNULL(c.cus_top, 0)                             AS Top,
       IF(c.cus_locked = 0, 'Open', 'Locked')           AS Locked,
       IFNULL(
         (SELECT s.sls_nama
          FROM tsalescustomer sc
          INNER JOIN tsalesman s ON s.sls_kode = sc.sc_sls_kode
          WHERE sc.sc_cus_kode = c.cus_kode
          LIMIT 1), '')                                 AS Marketing
     FROM tcustomer c
     LEFT JOIN tgolongancustomer g ON g.gc_kode = c.cus_gc_kode
     LEFT JOIN tjeniscustomer j ON j.jc_kode = c.cus_jc_kode
     ORDER BY c.cus_kode`
  );
  return rows;
};

/**
 * Update status Locked — paritas klik-kanan Delphi (Open/Update Status Locked).
 */
const updateLocked = async (kode, locked) => {
  const val = Number(locked) === 1 ? 1 : 0;
  await db.query(`UPDATE tcustomer SET cus_locked = ? WHERE cus_kode = ?`, [val, kode]);
  return { locked: val };
};

module.exports = { getBrowse, updateLocked };