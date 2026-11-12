-- =============================================================
-- Menu: Proses Fee Marketing (grup Utility)
-- Migrasi dari Delphi:
--   MainMenu1 -> Utility -> "Proses Fee Marketing" (ProsesFeeMarketing1)
--   ufrmProsesFeeMarketing.pas
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
--   men_view           = nama view Vue, hanya keterangan
-- =============================================================

-- -------------------------------------------------------------
-- 1) Pastikan grup "Utility" ada dan tampil sebagai menubar
--    (idempoten; script menu sebelumnya juga melakukan ini)
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
-- 2) Baris menu: /utility/proses-fee-marketing
-- -------------------------------------------------------------
SET @ada_pfm := (SELECT MEN_ID FROM tmenu
                  WHERE men_route = '/utility/proses-fee-marketing' LIMIT 1);

SET @order_pfm := (SELECT IFNULL(MAX(men_order), 0) + 10
                    FROM tmenu WHERE men_parent_id = @mp_utility);

INSERT INTO tmenu
  (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT 'ufrmProsesFeeMarketing',
       'Proses Fee Marketing',
       'ProsesFeeMarketing1',
       '/utility/proses-fee-marketing',
       'pi pi-play',
       @mp_utility,
       @order_pfm,
       'ProsesFeeMarketingView',
       1
 WHERE @ada_pfm IS NULL;

SET @menu_pfm := (SELECT MEN_ID FROM tmenu
                   WHERE men_route = '/utility/proses-fee-marketing' LIMIT 1);

-- -------------------------------------------------------------
-- 3) (OPSIONAL) Hak akses user
--    Menu hanya muncul untuk user yang punya baris di thakuser.
--    Admin ('ADMIN') melewati pemeriksaan ini.
--    Hak insert dipakai untuk tombol Proses; view untuk membuka halaman.
-- -------------------------------------------------------------
-- 3a) Beri hak ke satu user tertentu (ulangi per user):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT 'KODEUSER', @menu_pfm, 'Y', 'N', 'N'
--  WHERE @menu_pfm IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM thakuser h
--                     WHERE h.HAK_USER_KODE = 'KODEUSER'
--                       AND h.HAK_MEN_ID = @menu_pfm);

-- 3b) Samakan hak dengan menu "Proses Biaya Promosi" (operator yang
--     menjalankan proses biaya promosi umumnya juga yang menjalankan
--     proses fee marketing — struktur kedua modul identik):
-- INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
-- SELECT h.HAK_USER_KODE, @menu_pfm, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
--   FROM thakuser h
--  WHERE h.HAK_MEN_ID = (SELECT MEN_ID FROM tmenu
--                         WHERE men_route = '/utility/proses-biaya-promosi' LIMIT 1)
--    AND @menu_pfm IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM thakuser x
--                     WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
--                       AND x.HAK_MEN_ID = @menu_pfm);

-- -------------------------------------------------------------
-- 4) Verifikasi
-- -------------------------------------------------------------
SELECT mp_id, mp_nama, mp_menubar, mp_order
  FROM tmenuparent WHERE mp_nama = 'Utility';

SELECT MEN_ID, MEN_NAMA, MEN_NAMA2, men_route, men_parent_id, men_order, men_modul
  FROM tmenu
 WHERE men_route = '/utility/proses-fee-marketing';

SELECT h.HAK_USER_KODE, h.HAK_MEN_ID,
       h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID = @menu_pfm;
