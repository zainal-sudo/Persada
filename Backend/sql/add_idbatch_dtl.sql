-- sql/add_idbatch_dtl.sql
-- Menambahkan kolom Id Batch pada detail transaksi yang belum memilikinya.
-- Jalankan sekali pada database krm.
--
-- Catatan:
--  - tdo_dtl.dod_idbatch dan tfp_dtl.fpd_idbatch sudah ada (tidak diubah).
--  - tkor_dtl.kord_idbatch & tmus_dtl.musd_idbatch sudah dipakai oleh
--    koreksiStokFormService / pemusnahanFormService tetapi kolomnya belum ada.

ALTER TABLE tbpb_dtl
  ADD COLUMN bpbd_idbatch VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE tinv_dtl
  ADD COLUMN invd_idbatch VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE tmutasi_dtl
  ADD COLUMN mutd_idbatch VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE tkor_dtl
  ADD COLUMN kord_idbatch VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE tmus_dtl
  ADD COLUMN musd_idbatch VARCHAR(50) NOT NULL DEFAULT '';
