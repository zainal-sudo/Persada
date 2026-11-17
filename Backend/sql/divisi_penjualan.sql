-- ============================================================
-- Fitur Divisi Penjualan + Konsinyasi DO
-- DB TARGET : ampersada
-- 1. tso_hdr.so_div_kode   : divisi SO (penentu prefix nomor)
-- 2. tdo_dtl.dod_gdg_kons  : gudang konsinyasi per detail DO
-- 3. Trigger tdo_dtl_after_insert : stok keluar di gudang HEADER,
--    plus entri kedua di gudang konsinyasi bila dod_gdg_kons diisi
-- ============================================================

ALTER TABLE tso_hdr
  ADD COLUMN so_div_kode CHAR(3) NULL AFTER so_isproforma;

ALTER TABLE tdo_dtl
  ADD COLUMN dod_gdg_kons VARCHAR(10) NULL AFTER dod_gdg_kode;

DROP TRIGGER IF EXISTS tdo_dtl_after_insert;

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

-- Guard pembagi 0 (sql_mode ERROR_FOR_DIVISION_BY_ZERO)
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

-- Entri 1: stok keluar di gudang HEADER (do_gdg_kode)
insert ignore into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_avgcost,mst_idbatch)
values (new.dod_brg_kode,agudang,0,new.dod_qty,new.dod_tgl_expired,new.dod_do_nomor,ahargabeli,atanggal,aavgcost,IFNULL(new.dod_idbatch,''));

-- Entri 2 (konsinyasi): stok keluar juga di gudang konsinyasi detail
IF new.dod_gdg_kons IS NOT NULL AND new.dod_gdg_kons <> '' THEN
insert ignore into tmasterstok (mst_brg_kode,mst_gdg_kode,mst_stok_in,mst_stok_out,mst_expired_date,mst_noreferensi,mst_hargabeli,mst_tanggal,mst_avgcost,mst_idbatch)
values (new.dod_brg_kode,new.dod_gdg_kons,0,new.dod_qty,new.dod_tgl_expired,new.dod_do_nomor,ahargabeli,atanggal,aavgcost,IFNULL(new.dod_idbatch,''));
END IF;

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

-- Hitung SEMUA baris detail SO (tanpa filter sod_brg_kode) untuk so_isclosed
select count(*) into ajumlah from tso_dtl where sod_so_nomor=anomorso and sod_isclosed=0;
if ajumlah = 0 then
update tso_hdr set so_isclosed=1 where so_nomor=anomorso;
else
update tso_hdr set so_isclosed=0 where so_nomor=anomorso;
END IF;
END
