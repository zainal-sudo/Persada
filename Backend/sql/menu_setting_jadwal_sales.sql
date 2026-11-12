-- =====================================================================
-- Menu: Utility > Setting Jadwal Sales
-- Sumber: Delphi ufrmBrowseSetingJadwalSales.pas + ufrmSetingJadwalSales.pas
-- (MAIN.dfm: Utility1 -> SettinhJadwalSales1 'Setting Jadwal Sales')
-- Idempoten: aman dijalankan berulang kali.
-- =====================================================================

-- 1) Grup menu Utility (biarkan jika sudah ada)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTILITY', 'Utility', '', 99, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTILITY');

-- 2) Baris menu (formname = nama browse form Delphi, konsisten dengan menu lain)
INSERT INTO tmenu (menukode, menunama, parentkode, urutan, formname, isaktif)
SELECT 'UTL_JADWAL', 'Setting Jadwal Sales', 'UTILITY', 63, 'frmBrowseSetingJadwalSales', 1
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE menukode = 'UTL_JADWAL');

-- 3) Templat hak akses (idempoten)
INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
SELECT kodeuser, 'UTL_JADWAL', 1, 1, 1, 1
FROM thakuser
WHERE namaform = 'UTL_PROSFEE' AND NOT EXISTS (
  SELECT 1 FROM thakuser h2
  WHERE h2.kodeuser = thakuser.kodeuser AND h2.namaform = 'UTL_JADWAL'
);

-- 3b) Alternatif: salin hak dari menu Proses Fee Marketing (jalankan manual bila perlu)
-- INSERT INTO thakuser (kodeuser, namaform, cekview, cekinsert, cekedit, cekdelete)
-- SELECT kodeuser, 'UTL_JADWAL', cekview, cekinsert, cekedit, cekdelete
-- FROM thakuser WHERE namaform = 'UTL_PROSFEE';
