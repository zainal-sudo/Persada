-- =============================================================
-- Menambahkan dukungan menu bar (toolbar) pada aplikasi web.
-- Kolom baru: mp_menubar di tabel tmenuparent
--   mp_menubar = 0 -> grup tampil di SIDEBAR
--   mp_menubar = 1 -> grup tampil sebagai DROPDOWN MENU di TOOLBAR
-- Jalankan per masing-masing database cabang (dan database pusat).
-- =============================================================

ALTER TABLE `tmenuparent`
  ADD COLUMN `mp_menubar` TINYINT NOT NULL DEFAULT 0 COMMENT '0=sidebar, 1=menubar/toolbar' AFTER `mp_order`;

-- Opsional: tandai grup utama agar tampil sebagai menu bar (sesuai menu Delphi)
-- UPDATE `tmenuparent`
--    SET `mp_menubar` = 1
--  WHERE `mp_nama` IN ('File','Daftar','Persediaan','Penjualan','Kas Bank','Utility','Laporan','Komisi');
