-- sql/migrasi_inv_materai.sql
-- Biaya materai pada Invoice Pembelian (tinv_hdr), sejajar dengan inv_freight.
-- Nilai materai ikut terhitung dalam inv_amount dan dijurnal sebagai
-- DEBET ke rekening 23.019 (Biaya Materai).

ALTER TABLE tinv_hdr
  ADD COLUMN inv_materai DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER inv_freight;

-- Jalankan ulang prosedur bulanan setelah migrasi ini:
--   SOURCE sql/jurnal_bulanan.sql
-- agar jurnal_inv mengenali kolom inv_materai.
