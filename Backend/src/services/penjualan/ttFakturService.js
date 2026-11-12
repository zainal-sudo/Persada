// services/penjualan/ttFakturService.js
const db = require("../../config/database");

// ── Nama database kedua (default2) ───────────────────────────────────
// Paritas Delphi: koneksi utama tetap DB cabang (login); hanya tabel
// ttt_hdr/ttt_dtl yang di-prefixed {adatabase}. (1 host, beda database).
const getAdatabase = async () => {
  const [[config]] = await db.query(
    `SELECT adatabase FROM tsetingdb WHERE nama = 'default2'`
  );
  if (!config?.adatabase) throw new Error("Konfigurasi database kedua tidak ditemukan.");
  return config.adatabase;
};

const getBrowse = async (startDate, endDate) => {
  const adatabase = await getAdatabase();
  const [rows] = await db.query(
    `SELECT
       h.tt_nomor AS Nomor,
       DATE_FORMAT(h.tt_tanggal, '%Y-%m-%d') AS Tanggal,
       (SELECT sla_nama FROM tsalesmanaktif
        WHERE sla_sls_kode = h.tt_sls_kode AND sla_isaktif = 1 LIMIT 1) AS Salesman,
       c.cus_nama AS Customer,
       IFNULL((SELECT SUM(fp.fp_amount - fp.fp_bayar)
               FROM tfp_hdr fp
               INNER JOIN \`${adatabase}\`.ttt_dtl d ON d.ttd_fp_nomor = fp.fp_nomor
               WHERE d.ttd_tt_nomor = h.tt_nomor), 0) AS Total
     FROM \`${adatabase}\`.ttt_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.tt_cus_kode
     WHERE h.tt_tanggal BETWEEN ? AND ?
     ORDER BY h.tt_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const adatabase = await getAdatabase();
  const [rows] = await db.query(
    `SELECT
       d.ttd_tt_nomor AS Nomor,
       d.ttd_fp_nomor AS No_Faktur,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JT_Tempo,
       IFNULL(fp.fp_amount, 0) AS Nilai,
       IFNULL(fp.fp_amount - fp.fp_bayar, 0) AS Sisa_piutang
     FROM \`${adatabase}\`.ttt_dtl d
     INNER JOIN \`${adatabase}\`.ttt_hdr h ON h.tt_nomor = d.ttd_tt_nomor
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.ttd_fp_nomor
     WHERE d.ttd_tt_nomor = ?
     ORDER BY d.ttd_fp_nomor`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const adatabase = await getAdatabase();
  const [[header]] = await db.query(
    `SELECT tt_nomor FROM \`${adatabase}\`.ttt_hdr WHERE tt_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM \`${adatabase}\`.ttt_dtl WHERE ttd_tt_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM \`${adatabase}\`.ttt_hdr WHERE tt_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Print Data (paritas Delphi cxButton3Click, dot-matrix 120 kolom) ──
const getPrintData = async (nomor) => {
  const adatabase = await getAdatabase();
  const [rows] = await db.query(
    `SELECT
       h.tt_nomor AS nomor,
       DATE_FORMAT(h.tt_tanggal, '%d/%m/%Y') AS tanggal,
       c.cus_nama AS cusNama,
       c.cus_alamat AS cusAlamat,
       (SELECT sla_nama FROM tsalesmanaktif
        WHERE sla_sls_kode = h.tt_sls_kode AND sla_isaktif = 1 LIMIT 1) AS salesman,
       d.ttd_fp_nomor AS fpNomor,
       DATE_FORMAT(fp.fp_tanggal, '%d/%m/%Y') AS fpTanggal,
       ADDDATE(fp.fp_tanggal, INTERVAL 30 DAY) AS jt,
       (fp.fp_amount - fp.fp_dp - fp.fp_bayar - IF(fp.fp_isdtp = 1, fp.fp_taxamount, 0)) AS nilai,
       IFNULL((SELECT SUM(r.retj_amount) FROM tretj_hdr r WHERE r.retj_fp_nomor = fp.fp_nomor), 0) AS retur
     FROM \`${adatabase}\`.ttt_hdr h
     INNER JOIN \`${adatabase}\`.ttt_dtl d ON d.ttd_tt_nomor = h.tt_nomor
     INNER JOIN tcustomer c ON c.cus_kode = h.tt_cus_kode
     LEFT JOIN tfp_hdr fp ON fp.fp_nomor = d.ttd_fp_nomor
     WHERE h.tt_nomor = ?
     ORDER BY d.ttd_fp_nomor`,
    [nomor]
  );

  if (rows.length === 0) throw new Error("Data tidak ditemukan.");

  const h = rows[0];

  // Data perusahaan (dari db cabang)
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama AS nama, perush_alamat AS alamat, perush_kota AS kota, perush_notelp AS notelp
     FROM tperusahaan LIMIT 1`
  );

  const detail = rows.filter(r => r.fpNomor).map((r, i) => ({
    no: i + 1,
    fpNomor: r.fpNomor || '',
    tanggal: r.fpTanggal || '',
    jt: r.jt ? new Date(r.jt).toISOString().slice(0, 10) : '',
    nilai: Number(r.nilai || 0) - Number(r.retur || 0),
  }));

  const total = detail.reduce((sum, d) => sum + d.nilai, 0);

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    cusNama: h.cusNama,
    cusAlamat: h.cusAlamat,
    salesman: h.salesman || '',
    baris: 13,
    perusahaan: perusahaan || { nama: '', alamat: '', kota: '', notelp: '' },
    detail,
    total,
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };
