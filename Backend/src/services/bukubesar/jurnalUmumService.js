const db = require("../../config/database");

/**
 * Browse Jurnal Umum — sesuai SQLMaster Delphi
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       j.jur_no AS Nomor,
       DATE_FORMAT(j.jur_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(j.jur_keterangan, '') AS Keterangan,
       IF(j.jur_isclosed = 1, 'Sudah', 'Belum') AS IsClosed,
       SUM(d.jurd_debet) AS NilaiDebet,
       SUM(d.jurd_kredit) AS NilaiKredit
     FROM tjurnal j
     INNER JOIN tjurnalitem d ON j.jur_no = d.jurd_jur_no
     WHERE j.jur_tipetransaksi = 'Jurnal Umum'
       AND j.jur_tanggal BETWEEN ? AND ?
     GROUP BY j.jur_no, j.jur_tanggal, j.jur_keterangan, j.jur_isclosed
     ORDER BY j.jur_no`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Jurnal Umum — sesuai SQLDetail Delphi
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       j.jur_no AS Nomor,
       d.jurd_rek_kode AS Account,
       r.rek_nama AS AccountName,
       d.jurd_debet AS Debet,
       d.jurd_kredit AS Kredit,
       IFNULL(c.cc_nama, '') AS CostCenter
     FROM tjurnal j
     INNER JOIN tjurnalitem d ON j.jur_no = d.jurd_jur_no
     INNER JOIN trekening r ON r.rek_kode = d.jurd_rek_kode
     LEFT JOIN tcostcenter c ON c.cc_kode = d.jurd_cc_kode
     WHERE j.jur_no = ?
     ORDER BY j.jur_no, d.jurd_nourut`,
    [nomor]
  );
  return rows;
};

// ── Delete ─────────────────────────────────────────────────────────
const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT jur_no, jur_tanggal FROM tjurnal WHERE jur_no = ?`, [nomor]);
  if (!header) throw new Error("Data tidak ditemukan.");

  // Guard periode tutup
  const d = new Date(header.jur_tanggal);
  const [[periode]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [d.getMonth() + 1, d.getFullYear()]
  );
  if (periode) throw new Error("Periode ini sudah di tutup.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tjurnalitem WHERE jurd_jur_no = ?`, [nomor]);
    await conn.query(`DELETE FROM tjurnal WHERE jur_no = ?`, [nomor]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

// ── Print Data (browser A5 JURNALUMUM) ──────────────────────────────
const getPrintData = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       a.jur_no AS nomor,
       DATE_FORMAT(a.jur_tanggal, '%d/%m/%Y') AS tanggal,
       IFNULL(a.jur_keterangan, '') AS keterangan,
       r.rek_nama AS rekkredit,
       (SELECT SUM(jurd_kredit) FROM tjurnalitem WHERE jurd_jur_no = a.jur_no) AS kredit,
       terbilang((SELECT SUM(jurd_kredit) FROM tjurnalitem WHERE jurd_jur_no = a.jur_no)) AS bilang
     FROM tjurnal a
     INNER JOIN tjurnalitem b ON a.jur_no = b.jurd_jur_no
     INNER JOIN trekening c ON c.rek_kode = b.jurd_rek_kode
     INNER JOIN trekening r ON r.rek_kode = b.jurd_rek_kode
     LEFT JOIN tcostcenter d ON d.cc_kode = b.jurd_cc_kode
     WHERE a.jur_no = ?
       AND b.jurd_debet > 0
     LIMIT 1`,
    [nomor]
  );

  if (rows.length === 0) throw new Error("Data tidak ditemukan.");
  const h = rows[0];

  // Detail debet
  const [detail] = await db.query(
    `SELECT
       b.jurd_rek_kode AS account,
       r.rek_nama AS accountName,
       b.jurd_debet AS debet,
       IFNULL(d.cc_nama, '') AS costCenter
     FROM tjurnalitem b
     INNER JOIN trekening r ON r.rek_kode = b.jurd_rek_kode
     LEFT JOIN tcostcenter d ON d.cc_kode = b.jurd_cc_kode
     WHERE b.jurd_jur_no = ?
       AND b.jurd_debet > 0
     ORDER BY b.jurd_nourut`,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama AS nama, perush_alamat AS alamat, perush_kota AS kota, perush_notelp AS notelp
     FROM tperusahaan LIMIT 1`
  );

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    keterangan: h.keterangan,
    rekkredit: h.rekkredit,
    kredit: Number(h.kredit || 0),
    terbilang: h.bilang || '',
    perusahaan: perusahaan || { nama: '', alamat: '', kota: '', notelp: '' },
    detail,
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };