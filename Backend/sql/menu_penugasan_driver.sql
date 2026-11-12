-- =====================================================================
-- Menu: Utility > Penugasan Driver
-- Sumber: Delphi ufrmPenugasanDriver.pas
-- (MAIN.dfm: Utility1 -> PenugasanDriver1 'Penugasan Driver', terakhir
--  dalam grup Utility, setelah Laporan Absensi)
-- Idempoten: aman dijalankan berulang kali.
-- =====================================================================

-- 1) Grup menu Utility (biarkan jika sudah ada)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTILITY', 'Utility', '', 99, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTILITY');

-- 2) Baris menu (formname = nama form Delphi, konsisten dengan menu lain)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTL_PNGDRIVER', 'Penugasan Driver', 'UTILITY', 65, 'ufrmPenugasanDriver', 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTL_PNGDRIVER');

-- 3) Templat hak akses (idempoten) — assign memakai hak EDIT
INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
SELECT kodeuser, 'UTL_PNGDRIVER', 1, 0, 1, 0
FROM thakuser
WHERE namaform = 'UTL_CETKUNJ' AND NOT EXISTS (
  SELECT 1 FROM thakuser h2
  WHERE h2.kodeuser = thakuser.kodeuser AND h2.namaform = 'UTL_PNGDRIVER'
);
