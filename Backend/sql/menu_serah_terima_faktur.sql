-- =============================================================
-- Menu: Serah Terima Faktur (grup Utility, tampil sebagai menubar/toolbar)
-- Migrasi dari Delphi:
--   MainMenu1 -> Utility -> "Serah Terima Faktur" (SerahTerimaFaktur1)
--   ufrmBrowseSerahTerimaFaktur.pas  (browse)
--   ufrmSerahTerimaFaktur.pas        (form)
--
-- Jalankan PER DATABASE CABANG (bila grup Utility juga dipakai di
-- database pusat, jalankan juga di sana). Idempoten: aman diulang.
--
-- Catatan susunan kolom (lihat BE-Krm/src/services/menuService.js):
--   MEN_NAMA           = nama class form Delphi, dipakai ceKVIEW di Delphi
--   MEN_NAMA2          = nama item menu Delphi, dipakai ApplyHakAkses
--   men_route          = path web, dicocokkan dengan req.baseUrl oleh
--                        middleware resolveMenuId.js (TANPA prefix /api)
--   men_modul = 1      = modul Finance (yang ditampilkan web)
--   men_parent_id      = grup utama (tampil di sidebar/menubar)
--   men_parent_id2     = grup tambahan (opsional, lihat menu_dualujung.sql)
--   men_view           = nama view Vue, hanya keterangan
-- =============================================================

-- -------------------------------------------------------------
-- 1) Pastikan grup "Utility" ada dan tampil sebagai menubar
--    (mp_menubar = 1, kolom dari sql/menubar_toolbar.sql)
-- -------------------------------------------------------------
SET @mp_utility := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Utility' LIMIT 1);

INSERT INTO tmenuparent (mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 'Utility',
       'pi pi-cog',
       (SELECT IFNULL(MAX(mp_order), 0) + 10 FROM tmenuparent),
       1,
       1
 WHERE @mp_utility IS NULL;

UPDATE tmenuparent
   SET mp_menubar = 1
 WHERE mp_nama = 'Utility'
   AND IFNULL(mp_menubar, 0) <> 1;

SET @mp_utility := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Utility' LIMIT 1);

-- -------------------------------------------------------------
-- 2) Baris menu browse: /penjualan/serah-terima-faktur
--    (satu baris tmenu = satu menu + pagar hak akses di BE)
-- -------------------------------------------------------------
SET @ada_st := (SELECT MEN_ID FROM tmenu
                 WHERE men_route = '/penjualan/serah-terima-faktur' LIMIT 1);

SET @order_st := (SELECT IFNULL(MAX(men_order), 0) + 10
                    FROM tmenu WHERE men_parent_id = @mp_utility);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmBrowseSerahTerimaFaktur',
       'Serah Terima Faktur',
       'SerahTerimaFaktur1',
       '/penjualan/serah-terima-faktur',
       'pi pi-file-plus',
       @mp_utility,
       @order_st,
       'SerahTerimaFakturBrowseView',
       1
 WHERE @ada_st IS NULL;

SET @menu_st := (SELECT MEN_ID FROM tmenu
                  WHERE men_route = '/penjualan/serah-terima-faktur' LIMIT 1);

-- -------------------------------------------------------------
-- 3) Baris menu untuk endpoint /form
--    middleware/resolveMenuId.js mencocokkan req.baseUrl PERSIS, jadi
--    route /penjualan/serah-terima-faktur/form butuh barisnya sendiri
--    agar checkPermission tidak dilewati (lihat GAP-SO-11).
--    men_parent_id sengaja NULL supaya TIDAK muncul sebagai item menu
--    kedua di sidebar; FE sudah memetakan route form ke menu browse
--    lewat pemotongan segmen path (permissionStore.getMenuIdByRoute).
--
--    Sebelum menjalankan, periksa dulu konvensi yang sudah ada:
--      SELECT MEN_ID, MEN_NAMA, men_route, men_parent_id FROM tmenu
--       WHERE men_route LIKE '%/form' ORDER BY MEN_ID LIMIT 20;
--    Bila di DB Anda baris form justru punya men_parent_id terisi,
--    samakan dengan konvensi tersebut.
-- -------------------------------------------------------------
SET @ada_st_form := (SELECT MEN_ID FROM tmenu
                      WHERE men_route = '/penjualan/serah-terima-faktur/form' LIMIT 1);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmSerahTerimaFaktur',
       'Serah Terima Faktur (form)',
       'SerahTerimaFaktur1',
       '/penjualan/serah-terima-faktur/form',
       'pi pi-file-plus',
       NULL,
       @order_st,
       'SerahTerimaFakturFormView',
       1
 WHERE @ada_st_form IS NULL;

-- -------------------------------------------------------------
-- 4) (OPSIONAL) Hak akses user
--    Menu hanya muncul untuk user yang punya baris di thakuser.
--    Admin ('ADMIN') melewati pemeriksaan ini.
--    Pilih salah satu cara di bawah, buka komentarnya sesuai kebutuhan.
-- -------------------------------------------------------------

-- 4a) Beri hak ke satu user tertentu (ulangi per user):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT 'KODEUSER', @menu_st, 'Y', 'Y', 'N'
--  WHERE @menu_st IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM (SELECT 1) x
--                     WHERE EXISTS (SELECT 1 FROM thakuser h
--                                    WHERE h.HAK_USER_KODE = 'KODEUSER'
--                                      AND h.HAK_MEN_ID = @menu_st));

-- 4b) Samakan hak dengan menu saudara "Serah Faktur ke Salesman"
--     (user yang sudah boleh membuka menu itu otomatis boleh menu ini):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT h.HAK_USER_KODE, @menu_st, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
--   FROM thakuser h
--  WHERE h.HAK_MEN_ID = (SELECT MEN_ID FROM tmenu
--                         WHERE men_route = '/penjualan/serah-terima-faktur-salesman' LIMIT 1)
--    AND @menu_st IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM thakuser x
--                     WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
--                       AND x.HAK_MEN_ID = @menu_st);

-- -------------------------------------------------------------
-- 5) Verifikasi
-- -------------------------------------------------------------
SELECT mp_id, mp_nama, mp_menubar, mp_order
  FROM tmenuparent WHERE mp_nama = 'Utility';

SELECT MEN_ID, MEN_NAMA, MEN_NAMA2, men_route, men_parent_id, men_order, men_modul
  FROM tmenu
 WHERE men_route IN ('/penjualan/serah-terima-faktur',
                     '/penjualan/serah-terima-faktur/form');

SELECT h.HAK_USER_KODE, h.HAK_MEN_ID,
       h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID = @menu_st;
