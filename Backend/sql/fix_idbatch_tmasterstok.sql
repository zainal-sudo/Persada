-- Perbaikan idbatch pada tmasterstok (dijalankan 14/11/2026)
-- [SUDAH TERAPLIKASI di DB live] 1) ALTER tretj_dtl ADD retjd_idbatch
-- [SUDAH TERAPLIKASI di DB live] 2) backfill + MODIFY mst_idbatch NOT NULL DEFAULT ''
ALTER TABLE tmasterstok
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (mst_brg_kode, mst_gdg_kode, mst_expired_date, mst_noreferensi, mst_hargabeli, mst_idbatch);

-- 3) Trigger INSERT yang menulis tmasterstok kini membawa idbatch
--    (trigger DELETE tidak diubah: menghapus per noreferensi+SKU+expired
--     sudah benar karena edit = hapus semua baris detail lalu insert ulang)

DROP TRIGGER IF EXISTS tinv_dtl_after_insert;
CREATE TRIGGER tinv_dtl_after_insert AFTER INSERT ON tinv_dtl
FOR EACH ROW
BEGIN
declare atotaldiscfaktur,adiscperitem double ;
declare ahargapokok double;
declare anilai double;
declare anoreferensi varchar(20);
declare agudang varchar(10);
declare atanggal date ;
select inv_bpb_nomor,bpb_gdg_kode,inv_tanggal into anoreferensi,agudang,atanggal from tinv_hdr inner join tbpb_hdr on inv_bpb_nomor=bpb_nomor and inv_nomor=new.invd_inv_nomor;
select (((inv_amount-inv_taxamount)+inv_disc_faktur)/(100-inv_disc_fakturpr)*100),
(inv_amount-inv_taxamount)-(((inv_amount-inv_taxamount)+inv_disc_faktur)/(100-inv_disc_fakturpr)*100) into anilai,atotaldiscfaktur  from tinv_hdr where inv_nomor=new.INVD_INV_NOMOR;

set ahargapokok = new.invd_harga - (new.invd_harga*new.invd_discpr/100);

insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.invd_brg_kode,agudang,new.invd_qty,0,new.invd_expired,anoreferensi,ahargapokok,atanggal,IFNULL(new.invd_idbatch,''))  on duplicate key
update  tmasterstok.mst_hargabeli=ahargapokok ;

	update tbarang
			set brg_stok = brg_stok + new.invd_qty
		 		where brg_kode=new.invd_brg_kode ;

if ahargapokok > 1 then
   update tbarang set brg_hrgbeli=ahargapokok,brg_lastcost=ahargapokok where brg_kode= new.invd_brg_kode;
end if;
END;

DROP TRIGGER IF EXISTS tdo_dtl_after_insert;
CREATE TRIGGER tdo_dtl_after_insert AFTER INSERT ON tdo_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare anomorso varchar(20);
declare ajumlah int;
declare aavgcost,ahargabeli double;
declare atanggal date;
select do_gdg_kode,do_so_nomor,do_tanggal into agudang,anomorso,atanggal from tdo_hdr where do_nomor=new.dod_do_nomor;

select ifnull(MST_HARGABELI,0) into ahargabeli  from tmasterstok where mst_brg_kode=new.dod_brg_kode and mst_hargabeli > 1
and (mst_noreferensi like '%RI%' or mst_noreferensi like '%KOR%')
order by mst_tanggal desc LIMIT 1;

select sum(if(mst_avgcost > 0,mst_avgcost,mst_hargabeli)*(mst_stok_in-mst_stok_out))/sum(mst_stok_in-mst_stok_out)
into aavgcost
from tmasterstok
where mst_brg_kode=new.dod_brg_kode  and mst_tanggal <= atanggal AND mst_tanggal > "2020/01/01";

if aavgcost <= 0 then
   set aavgcost = ahargabeli;
end if;

insert ignore into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_avgcost,mst_idbatch)
values (new.dod_brg_kode,new.dod_gdg_kode,0,new.dod_qty,new.dod_tgl_expired,new.dod_do_nomor,ahargabeli,atanggal,aavgcost,IFNULL(new.dod_idbatch,''));

	update tbarang
			set brg_stok = brg_stok - new.dod_qty
		 		where brg_kode=new.dod_brg_kode ;
	update tso_dtl
			set sod_qty_kirim=sod_qty_kirim+new.dod_qty
		 		where sod_so_nomor =anomorso and sod_brg_kode=new.dod_brg_kode;

if new.dod_status =1 then
update tso_dtl set sod_isclosed=1 where sod_brg_kode=new.dod_brg_kode and sod_so_nomor =anomorso;
else
update tso_dtl set sod_isclosed=0 where sod_brg_kode=new.dod_brg_kode and sod_so_nomor =anomorso;
end if;

update tso_dtl set sod_isclosed=1 where sod_brg_kode=new.dod_brg_kode and sod_qty_kirim=sod_qty and sod_so_nomor =anomorso;

update tso_hdr set so_iskirim=1 where so_nomor=anomorso;
select count(*) into ajumlah from tso_dtl where sod_brg_kode= new.dod_brg_kode and sod_so_nomor=anomorso and sod_isclosed=0;
if ajumlah = 0 then
update tso_hdr set so_isclosed=1 where so_nomor=anomorso;
else
update tso_hdr set so_isclosed=0 where so_nomor=anomorso;
END IF;
END;

DROP TRIGGER IF EXISTS tkor_dtl_after_insert;
CREATE TRIGGER tkor_dtl_after_insert AFTER INSERT ON tkor_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare atanggal date;
declare astok double;
select korh_gdg_kode,korh_tanggal into agudang,atanggal from tkor_hdr where korh_nomor=new.kord_korh_nomor;

if new.kord_QTY < 0 then
insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.kord_brg_kode,agudang,0,-1*new.kord_qty,new.kord_expired,new.kord_korh_nomor,new.kord_harga,atanggal,IFNULL(new.kord_idbatch,''));
end if;
if new.kord_QTY > 0 then
insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.kord_brg_kode,agudang,new.kord_qty,0,new.kord_expired,new.kord_korh_nomor,new.kord_harga,atanggal,IFNULL(new.kord_idbatch,''));
end if ;

select sum(mst_stok_in-mst_stok_out) into astok from tmasterstok where mst_brg_kode=new.kord_brg_kode;
	update tbarang
			set brg_stok = astok
		 		where brg_kode=new.kord_brg_kode ;
END;

DROP TRIGGER IF EXISTS tmus_dtl_after_insert;
CREATE TRIGGER tmus_dtl_after_insert AFTER INSERT ON tmus_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare astok double;
declare atanggal date;
select mus_gdg_kode,mus_tanggal into agudang,atanggal from tmus_hdr where mus_nomor=new.musd_mus_nomor;

insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.musd_brg_kode,agudang,0,new.musd_qty,new.musd_tgl_expired,new.musd_mus_nomor,new.musd_harga,atanggal,IFNULL(new.musd_idbatch,''));

select sum(mst_stok_in-mst_stok_out) into astok from tmasterstok where mst_brg_kode=new.musd_brg_kode;
	update tbarang
			set brg_stok = astok
		 		where brg_kode=new.musd_brg_kode ;
END;

DROP TRIGGER IF EXISTS tret_dtl_after_insert;
CREATE TRIGGER tret_dtl_after_insert AFTER INSERT ON tret_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare anomorinv varchar(20);
declare ajumlah int;
declare ahargabeli double;
declare atanggal date;
select ret_gdg_kode,inv_bpb_nomor,ret_tanggal into agudang,anomorinv,atanggal from tret_hdr inner join tinv_hdr on inv_nomor=ret_inv_nomor where ret_nomor=new.retd_ret_nomor;
select mst_hargabeli into ahargabeli from tmasterstok where mst_brg_kode=new.retd_brg_kode and mst_expired_date=new.retd_expired
and mst_noreferensi=anomorinv limit 1;

insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.retd_brg_kode,agudang,0,new.retd_qty,new.retd_expired,new.retd_ret_nomor,ahargabeli,atanggal,IFNULL(new.retd_idbatch,''));

	update tbarang
			set brg_stok = brg_stok - new.retd_qty
		 		where brg_kode=new.retd_brg_kode ;
END;

DROP TRIGGER IF EXISTS tretj_dtl_after_insert;
CREATE TRIGGER tretj_dtl_after_insert AFTER INSERT ON tretj_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare anomordo varchar(20);
declare ajumlah int;
declare ahargabeli double;
declare atanggal date;

select retj_gdg_kode,fp_do_nomor,retj_tanggal into agudang,anomordo,atanggal from tretj_hdr inner join tfp_hdr on retj_fp_nomor=fp_nomor where retj_nomor=new.retjd_retj_nomor;
select mst_hargabeli into ahargabeli from tmasterstok where mst_brg_kode=new.retjd_brg_kode and mst_expired_date=new.retjd_expired
and mst_noreferensi=anomordo limit 1;

insert into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_idbatch)
values (new.retjd_brg_kode,agudang,new.retjd_qty,0,new.retjd_expired,new.retjd_retj_nomor,ahargabeli,atanggal,IFNULL(new.retjd_idbatch,''));

	update tbarang
			set brg_stok = brg_stok + new.retjd_qty
		 		where brg_kode=new.retjd_brg_kode ;
END;

DROP TRIGGER IF EXISTS tmutasi_hdr_after_update;
CREATE TRIGGER tmutasi_hdr_after_update AFTER UPDATE ON tmutasi_hdr
FOR EACH ROW
BEGIN
DECLARE done INT DEFAULT FALSE;
declare ajumlah2 int;
declare ckodebarang varchar(20);
declare cjumlah,ahargabeli double;
declare cexpired date;
declare cbatch varchar(20);
DECLARE cur CURSOR FOR SELECT mutd_brg_kode,mutd_qty,mutd_expired,IFNULL(mutd_idbatch,'') FROM tmutasi_dtl  WHERE mutd_mut_nomor=NEW.mut_nomor;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  if new.mut_status_realisasi=1 then
  	OPEN cur;
        ins_loop: LOOP
            FETCH cur INTO ckodebarang,cjumlah,cexpired,cbatch;
            IF done THEN
                LEAVE ins_loop;
            END IF;
               select ifnull(MST_HARGABELI,0) into ahargabeli  from tmasterstok where mst_brg_kode=ckodebarang and mst_hargabeli > 1
and (mst_noreferensi like 'RI%' or mst_noreferensi like '%KOR%')
order by mst_tanggal desc LIMIT 1;
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
