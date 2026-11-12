// services/penjualan/bayarBiayaPromosiService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       a.byb_nomor AS Nomor,
       DATE_FORMAT(a.byb_tanggal, '%Y-%m-%d') AS Tanggal,
       c.cus_nama AS Customer,
       (SELECT DISTINCT s.sls_nama 
        FROM tbayarbp_dtl d
        INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bybd_fp_nomor
        LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
        INNER JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
        WHERE d.bybd_byb_nomor = a.byb_nomor LIMIT 1) AS Salesman,
       IFNULL(a.byb_nilai, 0) AS Nilai,
       (SELECT rek_nama FROM trekening WHERE rek_kode = a.byb_rek_kode) AS Rekening,
       IFNULL(a.byb_keterangan, '') AS Keterangan
     FROM tbayarbp_hdr a
     INNER JOIN tcustomer c ON c.cus_kode = a.byb_cus_kode
     WHERE a.byb_tanggal BETWEEN ? AND ?
     ORDER BY a.byb_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.bybd_byb_nomor AS Nomor,
       d.bybd_fp_nomor AS Invoice,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tgl_Invoice,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(d.bybd_bayar, 0) AS Bayar
     FROM tbayarbp_dtl d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bybd_fp_nomor
     WHERE d.bybd_byb_nomor = ?
     ORDER BY d.bybd_byb_nomor ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT byb_nomor FROM tbayarbp_hdr WHERE byb_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tbayarbp_dtl WHERE bybd_byb_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tbayarbp_hdr WHERE byb_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data cetak BUKTI PENERIMAAN KAS/BANK (paritas doslip + report BYB.fr3) ──
// Cetak via browser (A5), BUKAN dot matrix. Tanpa update flag cetak (paritas Delphi).
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      a.byb_nomor AS nomor,
      DATE_FORMAT(a.byb_tanggal, '%m/%d/%Y') AS tanggal,
      IFNULL(a.byb_nilai, 0) AS nilai,
      IFNULL(a.byb_keterangan, '') AS keterangan,
      IFNULL(c.cus_nama, '') AS cusNama,
      IFNULL(r.rek_nama, '') AS rekNama,
      terbilang(IFNULL(a.byb_nilai, 0)) AS terbilang
    FROM tbayarbp_hdr a
    INNER JOIN tcustomer c ON c.cus_kode = a.byb_cus_kode
    LEFT JOIN trekening r ON r.rek_kode = a.byb_rek_kode
    WHERE a.byb_nomor = ?
    LIMIT 1
    `,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const [detail] = await db.query(
    `
    SELECT
      d.bybd_fp_nomor AS fpNomor,
      DATE_FORMAT(fp.fp_tanggal, '%m/%d/%Y') AS fpTanggal,
      DATE_FORMAT(fp.fp_jthtempo, '%m/%d/%Y') AS fpJthTempo,
      d.bybd_bayar AS bayar
    FROM tbayarbp_dtl d
    INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bybd_fp_nomor
    WHERE d.bybd_byb_nomor = ?
    ORDER BY d.bybd_fp_nomor ASC
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