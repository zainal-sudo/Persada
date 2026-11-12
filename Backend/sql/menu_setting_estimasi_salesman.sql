-- =====================================================================
-- Menu: Utility > Setting Estimasi Salesman
-- Sumber: Delphi ufrmEstimasiSales (grup Utility1, setelah Proses Fee Marketing)
-- Idempoten: aman dijalankan berulang kali.
-- =====================================================================

-- 1) Grup menu Utility (biarkan jika sudah ada)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTILITY', 'Utility', '', 99, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTILITY');

-- 2) Baris menu (formname = nama form Delphi, konsisten dengan menu lain)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTL_ESTSALES', 'Setting Estimasi Salesman', 'UTILITY', 62, 'ufrmEstimasiSales', 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTL_ESTSALES');

-- 3) Templat hak akses (idempoten)
INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
SELECT kodeuser, 'UTL_ESTSALES', 1, 1, 1, 0
FROM thakuser
WHERE namaform = 'UTL_PROSFEE' AND NOT EXISTS (
  SELECT 1 FROM thakuser h2
  WHERE h2.kodeuser = thakuser.kodeuser AND h2.namaform = 'UTL_ESTSALES'
);

-- 3b) Alternatif: salin hak dari menu Proses Fee Marketing (jalankan manual bila perlu)
-- INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
-- SELECT kodeuser, 'UTL_ESTSALES', cekview, cekinsert, cekedit, cekdelete
-- FROM thakuser WHERE namaform = 'UTL_PROSFEE';
