-- =============================================================
-- Menu: Serah Terima Ekspedisi (grup Persediaan)
-- Migrasi dari Delphi:
--   MAIN.dfm: dxNavBar2Group3 'Persediaan' -> dxSerahTerimaEkspedisi
--             (setelah dxListPersediaan, sebelum dxtagihanekspedisi)
--   MAIN.pas: dxSerahTerimaEkspedisiClick -> ShowForm(TfrmBrowseSerahTerimaEkspedisi)
--   ufrmBrowseSerahTerimaEkspedisi.pas  (browse)
--   ufrmSerahTerimaEkspedisi.pas        (form + slip STE.fr3 / STE2.fr3)
--
-- Jalankan PER DATABASE CABANG. Idempoten: aman diulang.
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
-- 1) Pastikan grup "Persediaan" ada
--    (mp_menubar sengaja tidak disentuh: Persediaan tampil di sidebar)
-- -------------------------------------------------------------
SET @mp_persediaan := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Persediaan' LIMIT 1);

INSERT INTO tmenuparent (mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif)
SELECT 'Persediaan',
       'pi pi-box',
       (SELECT IFNULL(MAX(mp_order), 0) + 10 FROM tmenuparent),
       0,
       1
 WHERE @mp_persediaan IS NULL;

SET @mp_persediaan := (SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Persediaan' LIMIT 1);

-- -------------------------------------------------------------
-- 2) Baris menu browse: /persediaan/serah-terima-ekspedisi
-- -------------------------------------------------------------
SET @ada_ste := (SELECT MEN_ID FROM tmenu
                  WHERE men_route = '/persediaan/serah-terima-ekspedisi' LIMIT 1);

SET @order_ste := (SELECT IFNULL(MAX(men_order), 0) + 10
                     FROM tmenu WHERE men_parent_id = @mp_persediaan);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmBrowseSerahTerimaEkspedisi',
       'Serah Terima Ekspedisi',
       'dxSerahTerimaEkspedisi',
       '/persediaan/serah-terima-ekspedisi',
       'pi pi-truck',
       @mp_persediaan,
       @order_ste,
       'SerahTerimaEkspedisiView',
       1
 WHERE @ada_ste IS NULL;

SET @menu_ste := (SELECT MEN_ID FROM tmenu
                   WHERE men_route = '/persediaan/serah-terima-ekspedisi' LIMIT 1);

-- -------------------------------------------------------------
-- 3) Baris menu untuk endpoint /form
--    resolveMenuId mencocokkan req.baseUrl PERSIS, jadi route
--    /persediaan/serah-terima-ekspedisi/form butuh barisnya sendiri
--    agar checkPermission tidak dilewati (lihat GAP-SO-11 / GAP-DO-11).
--    men_parent_id sengaja NULL supaya tidak muncul sebagai item menu
--    kedua; FE memetakan route form ke menu browse lewat pemotongan
--    segmen path (permissionStore.getMenuIdByRoute).
--
--    Sebelum menjalankan, periksa dulu konvensi yang sudah ada:
--      SELECT MEN_ID, MEN_NAMA, men_route, men_parent_id FROM tmenu
--       WHERE men_route LIKE '%/form' ORDER BY MEN_ID LIMIT 20;
--    Bila di DB Anda baris form justru punya men_parent_id terisi,
--    samakan dengan konvensi tersebut.
-- -------------------------------------------------------------
SET @ada_ste_form := (SELECT MEN_ID FROM tmenu
                       WHERE men_route = '/persediaan/serah-terima-ekspedisi/form' LIMIT 1);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmSerahTerimaEkspedisi',
       'Serah Terima Ekspedisi (form)',
       'dxSerahTerimaEkspedisi',
       '/persediaan/serah-terima-ekspedisi/form',
       'pi pi-truck',
       NULL,
       @order_ste,
       'SerahTerimaEkspedisiFormView',
       1
 WHERE @ada_ste_form IS NULL;

SET @menu_ste_form := (SELECT MEN_ID FROM tmenu
                        WHERE men_route = '/persediaan/serah-terima-ekspedisi/form' LIMIT 1);

-- -------------------------------------------------------------
-- 4) (OPSIONAL) Hak akses user
--    Menu hanya muncul untuk user yang punya baris di thakuser.
--    Admin ('ADMIN') melewati pemeriksaan ini.
--    Baris form ikut diberi hak yang sama agar save tidak ditolak.
-- -------------------------------------------------------------

-- 4a) Beri hak ke satu user tertentu (ulangi per user):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT 'KODEUSER', @menu_ste, 'Y', 'Y', 'Y'
--  WHERE @menu_ste IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM (SELECT 1) x
--                     WHERE EXISTS (SELECT 1 FROM thakuser h
--                                    WHERE h.HAK_USER_KODE = 'KODEUSER'
--                                      AND h.HAK_MEN_ID = @menu_ste));
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT 'KODEUSER', @menu_ste_form, 'Y', 'Y', 'Y'
--  WHERE @menu_ste_form IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM (SELECT 1) x
--                     WHERE EXISTS (SELECT 1 FROM thakuser h
--                                    WHERE h.HAK_USER_KODE = 'KODEUSER'
--                                      AND h.HAK_MEN_ID = @menu_ste_form));

-- 4b) Samakan hak dengan menu saudara "Tagihan Ekspedisi"
--     (user yang sudah boleh membuka tagihannya otomatis boleh menu ini):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT h.HAK_USER_KODE, @menu_ste, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
--   FROM thakuser h
--  WHERE h.HAK_MEN_ID = (SELECT MEN_ID FROM tmenu
--                         WHERE men_route = '/persediaan/tagihan-ekspedisi' LIMIT 1)
--    AND @menu_ste IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM thakuser x
--                     WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
--                       AND x.HAK_MEN_ID = @menu_ste);
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT h.HAK_USER_KODE, @menu_ste_form, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
--   FROM thakuser h
--  WHERE h.HAK_MEN_ID = @menu_ste
--    AND @menu_ste_form IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM thakuser x
--                     WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
--                       AND x.HAK_MEN_ID = @menu_ste_form);

-- -------------------------------------------------------------
-- 5) Verifikasi
-- -------------------------------------------------------------
SELECT mp_id, mp_nama, mp_menubar, mp_order
  FROM tmenuparent WHERE mp_nama = 'Persediaan';

SELECT MEN_ID, MEN_NAMA, MEN_NAMA2, men_route, men_parent_id, men_order, men_modul
  FROM tmenu
 WHERE men_route IN ('/persediaan/serah-terima-ekspedisi',
                     '/persediaan/serah-terima-ekspedisi/form');

SELECT h.HAK_USER_KODE, h.HAK_MEN_ID,
       h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID IN (@menu_ste, @menu_ste_form);
