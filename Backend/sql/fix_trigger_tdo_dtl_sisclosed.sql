-- fix_trigger_tdo_dtl_sisclosed.sql
-- Bug: SO langsung closed padahal DO parsial (satu SO = beberapa DO).
--
-- Penyebab: trigger tdo_dtl_after_insert menghitung baris SO yang masih
-- terbuka HANYA untuk barang yang ada di DO tersebut
-- (filter sod_brg_kode = new.dod_brg_kode). Akibatnya begitu satu item
-- terkirim penuh, count = 0 dan tso_hdr.so_isclosed langsung di-set 1,
-- walau item lain pada SO yang sama belum terkirim sama sekali.
--
-- Fix: hitung seluruh baris detail SO (tanpa filter brg_kode).
-- SO hanya closed bila SEMUA item-nya sudah terkirim penuh / di-close manual.
USE AMPersada;

DROP TRIGGER IF EXISTS tdo_dtl_after_insert;

DELIMITER //

CREATE TRIGGER tdo_dtl_after_insert AFTER INSERT ON tdo_dtl
FOR EACH ROW
BEGIN
declare agudang varchar(10);
declare anomorso varchar(20);
declare ajumlah int;
declare aavgcost,ahargabeli double;
declare anum,aden double;
declare atanggal date;
select do_gdg_kode,do_so_nomor,do_tanggal into agudang,anomorso,atanggal from tdo_hdr where do_nomor=new.dod_do_nomor;

select ifnull(MST_HARGABELI,0) into ahargabeli  from tmasterstok where mst_brg_kode=new.dod_brg_kode and mst_hargabeli > 1
and (mst_noreferensi like '%RI%' or mst_noreferensi like '%KOR%')
order by mst_tanggal desc LIMIT 1;

-- FIX division by 0 (errno 1365): dengan sql_mode ERROR_FOR_DIVISION_BY_ZERO,
-- SELECT..INTO yang menyimpan hasil x/0 langsung error bila penyebut 0
-- (stok net barang bisa 0). Hitung pembilang & penyebut terpisah, guard dulu.
select ifnull(sum(if(mst_avgcost > 0,mst_avgcost,mst_hargabeli)*(mst_stok_in-mst_stok_out)),0),
       ifnull(sum(mst_stok_in-mst_stok_out),0)
into anum, aden
from tmasterstok
where mst_brg_kode=new.dod_brg_kode  and mst_tanggal <= atanggal AND mst_tanggal > "2020/01/01";

if aden = 0 then
   set aavgcost = ahargabeli;
else
   set aavgcost = anum/aden;
end if;

if aavgcost is null or aavgcost <= 0 then
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

-- FIX: hitung SEMUA baris detail SO (tanpa filter sod_brg_kode).
-- Sebelumnya hanya barang yang ada di DO ini yang dihitung, sehingga SO
-- langsung closed walau item lain belum terkirim.
select count(*) into ajumlah from tso_dtl where sod_so_nomor=anomorso and sod_isclosed=0;
if ajumlah = 0 then
update tso_hdr set so_isclosed=1 where so_nomor=anomorso;
else
update tso_hdr set so_isclosed=0 where so_nomor=anomorso;
END IF;
END//

DELIMITER ;
