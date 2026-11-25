-- Fix: "Column 'mst_hargabeli' cannot be null" saat Realisasi Mutasi Gudang.
-- Penyebab: trigger tmutasi_hdr_after_update mencari harga beli dengan pola
--   mst_noreferensi like 'RI%', padahal referensi penerimaan berformat 'AM-RI.xxxx'
--   (prefix kode cabang), sehingga tidak match -> ahargabeli NULL -> INSERT gagal
--   karena kolom tmasterstok.mst_hargabeli NOT NULL.
-- Perbaikan:
--   1) Pola 'RI%' -> '%RI%' agar cocok dengan 'AM-RI...' (dan varian prefix lain).
--   2) Fallback ke tbarang.brg_hrgbeli lalu 0 bila tetap tidak ada harga.
--   3) IFNULL pada nilai insert sebagai pengaman terakhir.

DROP TRIGGER IF EXISTS tmutasi_hdr_after_update;
CREATE TRIGGER tmutasi_hdr_after_update AFTER UPDATE ON tmutasi_hdr
FOR EACH ROW
BEGIN
DECLARE done INT DEFAULT FALSE;
declare ckodebarang varchar(20);
declare cjumlah,ahargabeli double;
declare cexpired date;
declare cbatch varchar(20);
DECLARE cur CURSOR FOR SELECT mutd_brg_kode,mutd_qty,mutd_expired,IFNULL(mutd_idbatch,'') FROM tmutasi_dtl WHERE mutd_mut_nomor=NEW.mut_nomor;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  if new.mut_status_realisasi=1 then
    OPEN cur;
    ins_loop: LOOP
      FETCH cur INTO ckodebarang,cjumlah,cexpired,cbatch;
      IF done THEN
        LEAVE ins_loop;
      END IF;

      -- Harga beli dari stok masuk (penerimaan/koreksi). Pola diperbaiki agar
      -- menangkap referensi berprefix cabang, mis. 'AM-RI.2611.0012'.
      SET ahargabeli = NULL;
      select ifnull(MST_HARGABELI,0) into ahargabeli from tmasterstok
       where mst_brg_kode=ckodebarang and mst_hargabeli > 1
         and (mst_noreferensi like '%RI%' or mst_noreferensi like '%KOR%')
       order by mst_tanggal desc LIMIT 1;

      -- Fallback 1: harga beli master barang.
      if ahargabeli is null or ahargabeli <= 0 then
        select ifnull(brg_hrgbeli,0) into ahargabeli from tbarang where brg_kode=ckodebarang;
      end if;

      -- Fallback 2: jangan pernah NULL (kolom NOT NULL).
      set ahargabeli = ifnull(ahargabeli,0);

      insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_tanggal,mst_hargabeli,mst_idbatch)
      values (ckodebarang,new.MUT_GDG_tujuan,cjumlah,0,cexpired,new.mut_nomor,new.mut_tanggal,ahargabeli,cbatch);
      insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_tanggal,mst_hargabeli,mst_idbatch)
      values (ckodebarang,new.MUT_GDG_asal,0,cjumlah,cexpired,new.mut_nomor,new.mut_tanggal,ahargabeli,cbatch);
    END LOOP;
    CLOSE cur;
  end if;

  if new.mut_status_realisasi=0 then
    delete from tmasterstok where mst_noreferensi = new.mut_nomor;
  end if;
END;
