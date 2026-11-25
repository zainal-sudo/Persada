-- sql/alter_tjurnalitem_kilometer.sql
-- Tambah kolom detail jurnal yang dipakai form Pembayaran Lain
-- (ekspedisi / kendaraan / kilometer). Kolom ini sudah ada di DB ampersada;
-- file ini untuk DB cabang lain yang skemanya masih versi lama (mis. sip).
-- MariaDB mendukung ADD COLUMN IF NOT EXISTS sehingga aman dijalankan berulang.

ALTER TABLE tjurnalitem
  ADD COLUMN IF NOT EXISTS jurd_kar_nik VARCHAR(30) NULL AFTER jurd_cus_kode,
  ADD COLUMN IF NOT EXISTS jurd_nopol VARCHAR(30) NULL AFTER jurd_kar_nik,
  ADD COLUMN IF NOT EXISTS jurd_ekspedisi VARCHAR(50) NULL AFTER jurd_nopol,
  ADD COLUMN IF NOT EXISTS jurd_kilometer DOUBLE NULL AFTER jurd_ekspedisi;
