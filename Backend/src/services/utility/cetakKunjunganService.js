// services/utility/cetakKunjunganService.js
// Migrasi dari Delphi ufrmCetakKunjungan.pas
// (menu Utility -> "Cetak Kunjungan", MAIN.pas CetakKunjungan1Click).
//
// Modul LAPORAN read-only: filter periode + salesman -> daftar kunjungan
// (tkunjungan) -> cetak pratinjau + export Excel. Tidak ada simpan.
//
// Catatan migrasi:
// - Delphi loaddata: SELECT DISTINCT ... FROM tkunjungan x
//   INNER JOIN tkaryawan ON kar_nama=user
//   INNER JOIN <db cabang>.tcustomer a ON a.cus_kode=x.cus_kode
//   WHERE tanggal between ... and user like '<nama>' order by tanggal.
//   Query itu jalan di MyConnection1 = tsetingdb 'default4' (adatabase `krm`),
//   jadi tkunjungan & tkaryawan ditulis `krm.`; tcustomer tetap DB cabang
//   (tabel tkunjungan cabang tak dipakai: tanpa kolom jarak, data stop 2025-03).
// - `user like` DIPERTAHANKAN verbatim (tidak diganti =) — Delphi memang begitu;
//   FE mengirim nama persis dari picker salesman.
// - jarak dibagi 1000 saat mengisi grid di Delphi (meter -> km); di SQL: jarak/1000.
// - Hari: dayname Inggris dipetakan manual ke Indonesia (verbatim Delphi).
// - Koordinat: IF(latitude <> '', 'Ada', 'Kosong').
// - Delphi mencetak via tabel staging tampung2 (insertketampungan + fr3
//   cetakkunjungan.fr3); web render pratinjau langsung dari rows — hasil
//   kolom ekuivalen (kode, nama, tanggal, jam, hari, koordinat, jarak).
// - doslip (cetak teks 120 kolom) di Delphi adalah DEAD CODE (tidak pernah
//   dipanggil) — tidak dimigrasi.
// - bacafile2 membuka DB pusat untuk query ini; di web cukup prefix `krm.`.
const db = require("../../config/database");

// ── Salesman aktif (Delphi: edtKodeClickBtn -> frmbantuan) ──
// Nama diambil dari tsalesmanaktif (orang) yang masih aktif, bukan tsalesman (rayon).
// Alias sengaja huruf kecil: MySQL memakai case alias inner apa adanya, sedangkan
// FE membaca `kode`/`nama` (Delphi memakai 'Kode','Nama' sebagai caption grid saja).
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT kode, nama FROM (
       SELECT sls_kode kode,
              (SELECT sla_nama FROM tsalesmanaktif
                WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 LIMIT 1) nama
         FROM tsalesman
     ) a
      WHERE Nama IS NOT NULL
      ORDER BY kode`
  );
  return rows;
};

// ── Daftar kunjungan (Delphi: loaddata, SQL verbatim) ────────────────
// Return rows grid: kode, nama, tanggal, jam, hari, koordinat, jarak (km),
// user + kar_cabang (kar_cabang ikut DISTINCT di Delphi, tidak ditampilkan grid).
const getKunjungan = async ({ startDate, endDate, salesman }) => {
  if (!startDate || !endDate) throw new Error("Periode harus di isi.");
  // user like verbatim Delphi (bukan =) — param dikirim apa adanya oleh FE.
  const like = salesman === undefined || salesman === null ? "" : String(salesman);

  const [rows] = await db.query(
    `SELECT DISTINCT
       x.user,
       x.cus_kode,
       a.cus_nama,
       x.tanggal,
       DATE_FORMAT(x.tanggal, '%H:%i:%s') AS jam,
       k.kar_cabang,
       IF(DAYNAME(x.tanggal) = 'Monday', 'Senin',
       IF(DAYNAME(x.tanggal) = 'Tuesday', 'Selasa',
       IF(DAYNAME(x.tanggal) = 'Wednesday', 'Rabu',
       IF(DAYNAME(x.tanggal) = 'Thursday', 'Kamis',
       IF(DAYNAME(x.tanggal) = 'Friday', 'Jumat',
       IF(DAYNAME(x.tanggal) = 'Saturday', 'Sabtu', 'Minggu')))))) AS hari,
       IF(x.latitude <> '', 'Ada', 'Kosong') AS koordinat,
       (x.jarak / 1000) AS jarak
      FROM krm.tkunjungan x
      INNER JOIN krm.tkaryawan k ON k.kar_nama = x.user
      INNER JOIN tcustomer a ON a.cus_kode = x.cus_kode
     WHERE x.tanggal BETWEEN ? AND ?
       AND x.user LIKE ?
     ORDER BY x.tanggal`,
    [startDate, endDate, like]
  );
  return rows;
};

// ── Header perusahaan (Delphi: doslip memakai tperusahaan; fr3 memakai
//    NMCABANG config — web memakai tperusahaan sebagai identitas cabang) ──
const getPerusahaan = async () => {
  const [rows] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota FROM tperusahaan LIMIT 1`
  );
  return rows[0] || null;
};

module.exports = { getSalesman, getKunjungan, getPerusahaan };
