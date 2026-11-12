-- =====================================================================
-- Menu: Utility > Cetak Kunjungan
-- Sumber: Delphi ufrmCetakKunjungan.pas
-- (MAIN.dfm: Utility1 -> CetakKunjungan1 'Cetak Kunjungan', setelah
--  Surat Jalan Barang)
-- Idempoten: aman dijalankan berulang kali.
-- =====================================================================

-- 1) Grup menu Utility (biarkan jika sudah ada)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTILITY', 'Utility', '', 99, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTILITY');

-- 2) Baris menu (formname = nama form Delphi, konsisten dengan menu lain)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTL_CETKUNJ', 'Cetak Kunjungan', 'UTILITY', 64, 'ufrmCetakKunjungan', 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTL_CETKUNJ');

-- 3) Templat hak akses (idempoten) — modul laporan: cukup view
INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
SELECT kodeuser, 'UTL_CETKUNJ', 1, 0, 0, 0
FROM thakuser
WHERE namaform = 'UTL_JADWAL' AND NOT EXISTS (
  SELECT 1 FROM thakuser h2
  WHERE h2.kodeuser = thakuser.kodeuser AND h2.namaform = 'UTL_CETKUNJ'
);

-- 3b) Alternatif: salin hak dari menu Setting Jadwal Sales (jalankan manual bila perlu)
-- INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
-- SELECT kodeuser, 'UTL_CETKUNJ', cekview, 0, 0, 0
-- FROM thakuser WHERE namaform = 'UTL_JADWAL';
