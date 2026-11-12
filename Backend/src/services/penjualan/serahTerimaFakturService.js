// services/penjualan/serahTerimaFakturService.js
// Serah Terima Faktur, varian tabel tanpa suffix "2" (tserahterimafaktur_hdr/_dtl).
// Migrasi dari Delphi ufrmBrowseSerahTerimaFaktur.pas.
// Jangan tertukar dengan serahTerimaFakturSalesmanService.js (tabel ..._hdr2/_dtl2).
const db = require("../../config/database");

// ── Browse ───────────────────────────────────────────────────────────
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.sth_nomor AS Nomor,
       DATE_FORMAT(h.sth_tanggal, '%Y-%m-%d') AS Tanggal,
       h.sth_serah AS Serah,
       h.sth_terima AS Terima,
       IF(h.sth_realisasi = 0, 'Belum', 'Sudah') AS Realisasi,
       IFNULL(h.sth_memo, '') AS Note
     FROM tserahterimafaktur_hdr h
     WHERE h.sth_tanggal BETWEEN ? AND ?
     ORDER BY h.sth_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.std_sth_nomor AS Nomor,
       d.std_fp_nomor AS Faktur,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(fp.fp_amount, 0) AS Nilai,
       IFNULL(c.cus_nama, '') AS Customer
     FROM tserahterimafaktur_dtl d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.std_fp_nomor
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     WHERE d.std_sth_nomor = ?
     ORDER BY d.std_sth_nomor ASC`,
    [nomor]
  );
  return rows;
};

// ── Realisasi: aturan peran replikasi persis Delphi ──────────────────
// ufrmBrowseSerahTerimaFaktur.pas cxButton4Click. Perbandingan kode user
// dilakukan apa adanya (case-sensitive terhadap data), bukan di-uppercase.
const PERAN_GUDANG = ["GUDANG", "SALESMAN", "DRIVER"];
const PERAN_PIUTANG = ["piutang", "COLLECTOR", "LEGAL"];

const bolehRealisasi = (kodeUser, sthTerima) => {
  if (kodeUser === "GUDANG") return PERAN_GUDANG.includes(sthTerima);
  if (kodeUser === "piutang") return PERAN_PIUTANG.includes(sthTerima);
  return sthTerima === kodeUser;
};

const realisasi = async (nomor, user) => {
  const kodeUser = user?.kode || "";

  const [[row]] = await db.query(
    `SELECT sth_nomor, sth_terima FROM tserahterimafaktur_hdr WHERE sth_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!row) throw new Error("Data tidak ditemukan.");
  if (!bolehRealisasi(kodeUser, row.sth_terima))
    throw new Error("Anda tidak berhak Realisasi transaksi ini");

  await db.query(
    `UPDATE tserahterimafaktur_hdr SET sth_realisasi = 1 WHERE sth_nomor = ?`,
    [nomor]
  );
  return { nomor };
};

// ── Data cetak (dipakai mode "st" dan mode "slip") ───────────────────
// SQL mengikuti doslip: salesman diambil dari tsalesmanaktif (orang) via
// so_sla_kode, bukan dari tsalesman (itu rayon).
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT sth_nomor AS nomor,
            DATE_FORMAT(sth_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(sth_memo, '') AS memo,
            sth_serah AS serah,
            sth_terima AS terima,
            sth_realisasi AS realisasi
       FROM tserahterimafaktur_hdr WHERE sth_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT
       fp.fp_nomor AS faktur,
       IFNULL(c.cus_nama, '') AS customer,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(fp.fp_amount, 0) AS nilai,
       IFNULL((SELECT sla_nama FROM tsalesmanaktif WHERE sla_kode = so.so_sla_kode LIMIT 1), '') AS salesman
     FROM tserahterimafaktur_dtl d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.std_fp_nomor
     LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     WHERE d.std_sth_nomor = ?
     ORDER BY c.cus_nama, fp.fp_tanggal`,
    [nomor]
  );

  return {
    header,
    detail: detail.map((r) => ({ ...r, nilai: Number(r.nilai || 0) })),
  };
};

module.exports = {
  getBrowse,
  getBrowseDetail,
  realisasi,
  getPrintData,
  bolehRealisasi,
};
