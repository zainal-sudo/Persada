-- =============================================================
-- Menu: Laporan Neraca & Laporan Laba Rugi (grup "Laporan")
-- Migrasi dari Delphi:
--   MainMenu1 -> Laporan -> "Laporan Neraca"    (LaporanNeraca1)
--   ufrmLapNeraca.pas  (TfrmlapNeraca)
--   MainMenu1 -> Laporan -> "Laporan Laba Rugi" (LaporanLabaRugi1)
--   ufrmLapLabaRugi.pas (Tfrmlaplabarugi)
--
-- Jalankan PER DATABASE CABANG (dan database pusat bila perlu).
-- Idempoten: aman diulang.
--
-- Catatan susunan kolom (lihat BE-Krm/src/services/menuService.js):
--   MEN_ID      = PK, TIDAK auto_increment -> diisi manual (MAX+1)
--   MEN_NAMA    = nama class form Delphi (dipakai ceKVIEW di Delphi)
--   MEN_NAMA2   = nama item menu Delphi (dipakai ApplyHakAkses)
--   men_route   = path web, dicocokkan dengan req.baseUrl oleh
--                 middleware resolveMenuId.js (TANPA prefix /api)
--   men_modul   = 1 = modul Finance (yang ditampilkan web)
--   men_view    = nama view Vue (keterangan)
-- Atribut grup (men_parent_id / men_parent_id2) & urutan disalin/disambung
-- dari menu laporan acuan (lap-ytd) agar ikut struktur sidebar.
-- =============================================================

-- -------------------------------------------------------------
-- 0) Atribut acuan dari menu laporan (lap-ytd)
-- -------------------------------------------------------------
SET @ref_menu    := (SELECT MEN_ID        FROM tmenu WHERE men_route = '/laporan/lap-ytd' LIMIT 1);
SET @ref_parent  := (SELECT men_parent_id FROM tmenu WHERE men_route = '/laporan/lap-ytd' LIMIT 1);
SET @ref_parent2 := (SELECT men_parent_id2 FROM tmenu WHERE men_route = '/laporan/lap-ytd' LIMIT 1);
SET @ref_order   := (SELECT IFNULL(MAX(men_order), 0) FROM tmenu WHERE men_parent_id2 = @ref_parent2);

-- -------------------------------------------------------------
-- 1) Menu: /laporan/lap-neraca
-- -------------------------------------------------------------
SET @menu_neraca := (SELECT MEN_ID FROM tmenu WHERE men_route = '/laporan/lap-neraca' LIMIT 1);
SET @next_id     := (SELECT IFNULL(MAX(MEN_ID), 0) + 1 FROM tmenu);

INSERT INTO tmenu
  (MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_parent_id2, men_order, men_view, men_modul)
SELECT @next_id, 'ufrmLapNeraca', 'Laporan Neraca', 'Laporan Neraca',
       '/laporan/lap-neraca', 'pi pi-table',
       @ref_parent, @ref_parent2, @ref_order + 1, 'LapNeracaView', 1
 WHERE @menu_neraca IS NULL AND @ref_parent IS NOT NULL;

SET @menu_neraca := (SELECT MEN_ID FROM tmenu WHERE men_route = '/laporan/lap-neraca' LIMIT 1);

UPDATE tmenu
   SET MEN_NAMA2 = 'Laporan Neraca',
       MEN_KETERANGAN = 'Laporan Neraca'
 WHERE men_route = '/laporan/lap-neraca';

-- -------------------------------------------------------------
-- 2) Menu: /laporan/lap-laba-rugi
-- -------------------------------------------------------------
SET @menu_lr := (SELECT MEN_ID FROM tmenu WHERE men_route = '/laporan/lap-laba-rugi' LIMIT 1);
SET @next_id := (SELECT IFNULL(MAX(MEN_ID), 0) + 1 FROM tmenu);

INSERT INTO tmenu
  (MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_parent_id2, men_order, men_view, men_modul)
SELECT @next_id, 'ufrmLapLabaRugi', 'Laporan Laba Rugi', 'Laporan Laba Rugi',
       '/laporan/lap-laba-rugi', 'pi pi-chart-line',
       @ref_parent, @ref_parent2, @ref_order + 2, 'LapLabaRugiView', 1
 WHERE @menu_lr IS NULL AND @ref_parent IS NOT NULL;

SET @menu_lr := (SELECT MEN_ID FROM tmenu WHERE men_route = '/laporan/lap-laba-rugi' LIMIT 1);

UPDATE tmenu
   SET MEN_NAMA2 = 'Laporan Laba Rugi',
       MEN_KETERANGAN = 'Laporan Laba Rugi'
 WHERE men_route = '/laporan/lap-laba-rugi';

-- -------------------------------------------------------------
-- 3) Hak akses user: samakan dengan menu laporan acuan (lap-ytd)
--    Menu hanya muncul untuk user yang punya baris di thakuser.
--    Admin ('ADMIN') melewati pemeriksaan ini.
-- -------------------------------------------------------------
INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT h.HAK_USER_KODE, @menu_neraca, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID = @ref_menu
   AND @menu_neraca IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser x
                    WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
                      AND x.HAK_MEN_ID = @menu_neraca);

INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT h.HAK_USER_KODE, @menu_lr, h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID = @ref_menu
   AND @menu_lr IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser x
                    WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
                      AND x.HAK_MEN_ID = @menu_lr);

-- -------------------------------------------------------------
-- 4) Verifikasi
-- -------------------------------------------------------------
SELECT MEN_ID, MEN_NAMA, MEN_NAMA2, men_route, men_parent_id, men_parent_id2, men_order, men_modul
  FROM tmenu
 WHERE men_route IN ('/laporan/lap-ytd', '/laporan/lap-neraca', '/laporan/lap-laba-rugi');

SELECT h.HAK_USER_KODE, h.HAK_MEN_ID,
       h.hak_men_insert, h.hak_men_edit, h.hak_men_delete
  FROM thakuser h
 WHERE h.HAK_MEN_ID IN (@menu_neraca, @menu_lr);
