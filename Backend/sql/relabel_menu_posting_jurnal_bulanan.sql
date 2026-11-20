-- sql/relabel_menu_posting_jurnal_bulanan.sql
-- Caption menu (sidebar & menu bar) diambil dari MEN_NAMA2.
-- Ubah label teknis 'PostingJurnalBulanan1' menjadi caption yang mudah dibaca.

USE AMPersada;

UPDATE tmenu
   SET MEN_NAMA2 = 'Posting Jurnal Bulanan',
       MEN_KETERANGAN = 'Posting Jurnal Bulanan'
 WHERE men_route = '/utility/posting-jurnal-bulanan';

SELECT MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route
  FROM tmenu
 WHERE men_route = '/utility/posting-jurnal-bulanan';
