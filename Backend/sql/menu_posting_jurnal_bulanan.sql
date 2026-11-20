USE AMPersada;

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

SET @ada_pjb := (SELECT MEN_ID FROM tmenu
                   WHERE men_route = '/utility/posting-jurnal-bulanan' LIMIT 1);
SET @id_pjb := (SELECT IFNULL(MAX(MEN_ID), 0) + 1 FROM tmenu);

SET @order_pjb := (SELECT IFNULL(MAX(men_order), 0) + 10
                     FROM tmenu WHERE men_parent_id = @mp_utility);

INSERT INTO tmenu
  (MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon,
   men_parent_id, men_order, men_view, men_modul)
SELECT @id_pjb,
       'ufrmPostingJurnalBulanan',
       'Posting Jurnal Bulanan',
       'Posting Jurnal Bulanan',
       '/utility/posting-jurnal-bulanan',
       'pi pi-play',
       @mp_utility,
       @order_pjb,
       'utility/PostingJurnalBulananView',
       1
  WHERE @ada_pjb IS NULL;

UPDATE tmenu
   SET MEN_NAMA2 = 'Posting Jurnal Bulanan',
       MEN_KETERANGAN = 'Posting Jurnal Bulanan',
       men_parent_id = @mp_utility,
       men_view = 'utility/PostingJurnalBulananView',
       men_modul = 1
 WHERE men_route = '/utility/posting-jurnal-bulanan';

UPDATE tmenu
   SET MEN_ID = @id_pjb
 WHERE men_route = '/utility/posting-jurnal-bulanan'
   AND MEN_ID = 0;

UPDATE thakuser
   SET HAK_MEN_ID = @id_pjb
 WHERE HAK_MEN_ID = 0
   AND @ada_pjb = 0;

SET @menu_pjb := (SELECT MEN_ID FROM tmenu
                    WHERE men_route = '/utility/posting-jurnal-bulanan' LIMIT 1);

INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT 'ADMIN', @menu_pjb, 'Y', 'N', 'N'
 WHERE @menu_pjb IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser h
                    WHERE h.HAK_USER_KODE = 'ADMIN'
                      AND h.HAK_MEN_ID = @menu_pjb);

INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
SELECT 'FINANCE', @menu_pjb, 'Y', 'N', 'N'
 WHERE @menu_pjb IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM thakuser h
                    WHERE h.HAK_USER_KODE = 'FINANCE'
                      AND h.HAK_MEN_ID = @menu_pjb);

UPDATE thakuser
   SET hak_men_insert = 'Y'
 WHERE HAK_MEN_ID = @menu_pjb
   AND HAK_USER_KODE IN ('ADMIN', 'admin', 'FINANCE')
   AND IFNULL(hak_men_insert, 'N') <> 'Y';

SELECT MEN_ID, MEN_NAMA, MEN_NAMA2, men_route, men_view, men_parent_id, men_modul
  FROM tmenu
 WHERE men_route = '/utility/posting-jurnal-bulanan';

SELECT HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete
  FROM thakuser
 WHERE HAK_MEN_ID = @menu_pjb;
