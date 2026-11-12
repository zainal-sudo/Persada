-- sql/migrasi_fp_so.sql
-- Migrasi relasi FP (Faktur Penjualan) dari DO ke SO.
--
-- 1 SO = 1 invoice. FP baru mengacu ke SO (fp_so_nomor); fp_do_nomor
-- dibiarkan untuk data lama. Stok keluar tetap lewat DO/surat jalan.
--
-- NOTE: backfill data lama (isi fp_so_nomor = so_nomor dari fp_do_nomor)
-- dilakukan manual oleh user. Script ini HANYA menambah kolom.

ALTER TABLE tfp_hdr
  ADD COLUMN fp_so_nomor VARCHAR(30) NULL AFTER fp_do_nomor;

ALTER TABLE tfp_hdr_bayangan
  ADD COLUMN fp_so_nomor VARCHAR(30) NULL AFTER fp_do_nomor;

-- Qty SO yang sudah di-invoice (dipakai form FP: qty faktur = sod_qty - sod_qty_invoice)
ALTER TABLE tso_dtl
  ADD COLUMN sod_qty_invoice DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Status SO sudah dibuatkan invoice (1 = sudah, 0 = belum).
-- FP lookup: so_isclosed = 1 AND so_isinvoice = 0.
-- Faktur Manual lookup: so_isclosed = 1 AND so_isinvoice = 1 (SO yang sudah di-invoice FP utama).
ALTER TABLE tso_hdr
  ADD COLUMN so_isinvoice TINYINT(1) NOT NULL DEFAULT 0;

-- HPP per baris detail FP (Opsi 2: freeze cost saat barang keluar).
-- Diisi saat saveData FP dari SUM(mst_stok_out*mst_hargabeli) atas semua DO milik SO.
ALTER TABLE tfp_dtl
  ADD COLUMN fpd_hpp DECIMAL(18,2) NOT NULL DEFAULT 0;