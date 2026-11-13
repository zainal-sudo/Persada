-- =============================================================
-- Fix: sidebar kosong & halaman "Hak User" tidak ditemukan
-- Database: ampersada
--
-- Temuan:
--  1) tabel tmenuparent KOSONG -> semua grup sidebar hilang
--  2) tmenu.men_view beberapa menu kosong/salah -> route dinamis
--     tidak didaftarkan -> "Halaman Tidak Ditemukan"
--
-- Idempoten: aman diulang.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Isi tmenuparent (id diambil dari men_parent_id/men_parent_id2
--    yang sudah terpakai di tmenu: 4,5,6,7,8,10,11,12,14)
-- -------------------------------------------------------------
INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 4,  'File',       'pi pi-file',        10, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 4);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 5,  'Daftar',     'pi pi-address-book', 20, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 5);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 6,  'Persediaan', 'pi pi-box',          30, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 6);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 7,  'Penjualan',  'pi pi-shopping-cart', 40, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 7);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 8,  'Kas Bank',   'pi pi-wallet',        50, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 8);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 11, 'Laporan',    'pi pi-chart-bar',     60, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 11);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 14, 'Pembelian',  'pi pi-truck',         70, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 14);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 12, 'Utility',    'pi pi-cog',           80, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 12);

INSERT INTO tmenuparent (mp_id, mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 10, 'Setting',    'pi pi-sliders-h',     90, 0, 1
 WHERE NOT EXISTS (SELECT 1 FROM tmenuparent WHERE mp_id = 10);

-- -------------------------------------------------------------
-- 2) Perbaiki men_view yang kosong/salah
--    (resolveView frontend: "/src/views/<men_view>.vue")
--    113 = /setting/hak-user, 5 = /daftar/customer, 8 = /persediaan/barang
-- -------------------------------------------------------------
UPDATE tmenu SET men_view = 'tools/MasterUserView'
 WHERE MEN_ID = 113 AND (men_view IS NULL OR men_view = '');

UPDATE tmenu SET men_view = 'daftar/CustomerView'
 WHERE MEN_ID = 5 AND (men_view IS NULL OR men_view = '');

UPDATE tmenu SET men_view = 'persediaan/BarangView'
 WHERE MEN_ID = 8 AND (men_view IS NULL OR men_view = '');

-- slash depan bikin glob gagal
UPDATE tmenu SET men_view = 'persediaan/SubBarangView'
 WHERE MEN_ID = 7 AND men_view = '/persediaan/SubBarangView';

-- file ada di views/laporan/
UPDATE tmenu SET men_view = 'laporan/LapNeracaView'
 WHERE MEN_ID = 106 AND men_view = 'LapNeracaView';

UPDATE tmenu SET men_view = 'laporan/LapLabaRugiView'
 WHERE MEN_ID = 107 AND men_view = 'LapLabaRugiView';

-- -------------------------------------------------------------
-- 3) Verifikasi
-- -------------------------------------------------------------
SELECT mp_id, mp_nama, mp_order, mp_menubar, mp_aktif
  FROM tmenuparent ORDER BY mp_order;

SELECT MEN_ID, MEN_KETERANGAN, men_route, men_view
  FROM tmenu
 WHERE MEN_ID IN (5, 7, 8, 106, 107, 113);
