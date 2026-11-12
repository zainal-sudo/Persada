-- =============================================================
-- Duplikasi menu ke dua grup (sidebar + menubar).
-- Kolom baru: men_parent_id2 di tabel tmenu
--   men_parent_id  -> grup utama (tempat item tampil pertama)
--   men_parent_id2 -> grup tambahan (opsional), item JUGa tampil di sini
--   NULL = item hanya tampil di kelompok utama.
-- Jalankan per masing-masing database cabang (dan database pusat).
-- =============================================================

ALTER TABLE `tmenu`
  ADD COLUMN `men_parent_id2` INT NULL AFTER `men_parent_id`;

-- Contoh pemakaian:
-- Set men_parent_id2 = 10 (grup menubar 'Laporan') pada item MEN_ID tertentu
--   UPDATE `tmenu` SET `men_parent_id2` = 10 WHERE `MEN_ID` = 100;
