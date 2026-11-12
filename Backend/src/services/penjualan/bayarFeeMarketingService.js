// services/penjualan/bayarFeeMarketingService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       a.byf_nomor AS Nomor,
       DATE_FORMAT(a.byf_tanggal, '%Y-%m-%d') AS Tanggal,
       c.cus_nama AS Customer,
       (SELECT DISTINCT s.sla_nama 
        FROM tbayarfm_dtl d
        INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.byfd_fp_nomor
        LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
        INNER JOIN tsalesmanaktif s ON s.sla_sls_kode = so.so_sls_kode
        WHERE d.byfd_byf_nomor = a.byf_nomor LIMIT 1) AS Salesman,
       IFNULL(a.byf_nilai, 0) AS Nilai,
       (SELECT rek_nama FROM trekening WHERE rek_kode = a.byf_rek_kode) AS Rekening,
       IFNULL(a.byf_keterangan, '') AS Keterangan
     FROM tbayarfm_hdr a
     INNER JOIN tcustomer c ON c.cus_kode = a.byf_cus_kode
     WHERE a.byf_tanggal BETWEEN ? AND ?
     ORDER BY a.byf_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.byfd_byf_nomor AS Nomor,
       d.byfd_fp_nomor AS Invoice,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tgl_Invoice,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(d.byfd_bayar, 0) AS Bayar
     FROM tbayarfm_dtl d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.byfd_fp_nomor
     WHERE d.byfd_byf_nomor = ?
     ORDER BY d.byfd_byf_nomor ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT byf_nomor FROM tbayarfm_hdr WHERE byf_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tbayarfm_dtl WHERE byfd_byf_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tbayarfm_hdr WHERE byf_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data cetak BUKTI PENERIMAAN KAS/BANK (paritas doslip + report BYF.fr3) ──
// Cetak via browser (A5), BUKAN dot matrix. Tanpa update flag cetak (paritas Delphi).
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      a.byf_nomor AS nomor,
      DATE_FORMAT(a.byf_tanggal, '%m/%d/%Y') AS tanggal,
      IFNULL(a.byf_nilai, 0) AS nilai,
      IFNULL(a.byf_keterangan, '') AS keterangan,
      IFNULL(c.cus_nama, '') AS cusNama,
      IFNULL(r.rek_nama, '') AS rekNama,
      terbilang(IFNULL(a.byf_nilai, 0)) AS terbilang
    FROM tbayarfm_hdr a
    INNER JOIN tcustomer c ON c.cus_kode = a.byf_cus_kode
    LEFT JOIN trekening r ON r.rek_kode = a.byf_rek_kode
    WHERE a.byf_nomor = ?
    LIMIT 1
    `,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const [detail] = await db.query(
    `
    SELECT
      d.byfd_fp_nomor AS fpNomor,
      DATE_FORMAT(fp.fp_tanggal, '%m/%d/%Y') AS fpTanggal,
      DATE_FORMAT(fp.fp_jthtempo, '%m/%d/%Y') AS fpJthTempo,
      d.byfd_bayar AS bayar
    FROM tbayarfm_dtl d
    INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.byfd_fp_nomor
    WHERE d.byfd_byf_nomor = ?
    ORDER BY d.byfd_fp_nomor ASC
    `,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_notelp FROM tperusahaan LIMIT 1`
  );

  const detailRows = detail.map((r, i) => ({
    no: i + 1,
    fpNomor: r.fpNomor,
    fpTanggal: r.fpTanggal,
    fpJthTempo: r.fpJthTempo,
    bayar: Number(r.bayar) || 0,
  }));

  const totalBayar = detailRows.reduce((s, r) => s + r.bayar, 0);

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    cusNama: header.cusNama,
    nilai: Number(header.nilai) || 0,
    rekNama: header.rekNama,
    terbilang: header.terbilang || "",
    memo: header.keterangan,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      notelp: perusahaan.perush_notelp,
    } : { nama: "", alamat: "", notelp: "" },
    detail: detailRows,
    totalBayar,
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };