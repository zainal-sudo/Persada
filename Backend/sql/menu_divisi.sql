-- =============================================================
-- Menu: Master Divisi (grup Daftar)
-- Tabel: tdivisi (div_kode, div_nama, div_prefix)
-- =============================================================

-- 1) Pastikan parent group "Daftar" (atau sejenisnya di tmenuparent) ada.
-- Mari kita cek parent group yang sudah ada untuk menu Daftar (misal Supplier, Customer, Ekspedisi).
-- Biasanya mp_nama = 'Daftar' atau 'Master' atau di bawah grup Daftar (dxNavBar2Group2 / dll).
-- Mari lihat parent group dari Ekspedisi atau Salesman:
SELECT mp_id, mp_nama, mp_menubar FROM tmenuparent WHERE mp_nama LIKE '%Daftar%' OR mp_nama LIKE '%Master%';

-- Misal kita temukan mp_id untuk Daftar atau Master. Mari buat script robust:
SET @mp_daftar := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Daftar' LIMIT 1);

-- Jika 'Daftar' belum ada, buat baru:
INSERT INTO tmenuparent (mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 'Daftar', 'pi pi-list', 10, 0, 1
WHERE @mp_daftar IS NULL;

SET @mp_daftar := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Daftar' LIMIT 1);

-- 2) Masukkan tmenu untuk Master Divisi
SET @ada_divisi := (SELECT MEN_ID FROM tmenu WHERE men_route = '/daftar/divisi' LIMIT 1);
SET @order_divisi := (SELECT IFNULL(MAX(men_order), 0) + 10 FROM tmenu WHERE men_parent_id = @mp_daftar);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmMasterDivisi',
       'Master Divisi',
       'dxMasterDivisi',
       '/daftar/divisi',
       'pi pi-sitemap',
       @mp_daftar,
       @order_divisi,
       'daftar/DivisiView',
       1
WHERE @ada_divisi IS NULL;

SET @menu_divisi := (SELECT MEN_ID FROM tmenu WHERE men_route = '/daftar/divisi' LIMIT 1);

-- 3) Tambahkan baris form / form route jika diperlukan oleh backend permission resolveMenuId
SET @ada_divisi_form := (SELECT MEN_ID FROM tmenu WHERE men_route = '/daftar/divisi/form' LIMIT 1);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmMasterDivisiForm',
       'Master Divisi (form)',
       'dxMasterDivisi',
       '/daftar/divisi/form',
       'pi pi-sitemap',
       NULL,
       @order_divisi,
       'daftar/DivisiView',
       1
WHERE @ada_divisi_form IS NULL;

SET @menu_divisi_form := (SELECT MEN_ID FROM tmenu WHERE men_route = '/daftar/divisi/form' LIMIT 1);

-- 4) Berikan hak akses otomatis ke Admin / user yang punya hak Ekspedisi atau Salesman
-- (Atau insert ke thakuser untuk ADMIN / user lain jika diperlukan)
INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT DISTINCT h.HAK_USER_KODE, @menu_divisi, 'Y', 'Y', 'Y'
  FROM thakuser h
 WHERE @menu_divisi IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser x WHERE x.HAK_USER_KODE = h.HAK_USER_KODE AND x.HAK_MEN_ID = @menu_divisi);

INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT DISTINCT h.HAK_USER_KODE, @menu_divisi_form, 'Y', 'Y', 'Y'
  FROM thakuser h
 WHERE @menu_divisi_form IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser x WHERE x.HAK_USER_KODE = h.HAK_USER_KODE AND x.HAK_MEN_ID = @menu_divisi_form);
