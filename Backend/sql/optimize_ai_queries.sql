-- ============================================================
-- Optimasi MySQL untuk kecepatan query AI & laporan (krm)
-- Jalankan via HeidiSQL/phpMyAdmin/cmd: mysql -u root -p < file ini
-- Catatan: XAMPP = MariaDB, mendukung IF NOT EXISTS utk index.
-- ============================================================

USE krm;

-- 1. Filter jatuh tempo (dipakai AI & laporan faktur outstanding)
ALTER TABLE tfp_hdr ADD INDEX IF NOT EXISTS idx_fp_jthtempo (FP_jthtempo);

-- 2. Index covering utk agregasi per customer (jumlah sisa piutang)
ALTER TABLE tfp_hdr ADD INDEX IF NOT EXISTS idx_fp_cus_aging
  (FP_cus_kode, FP_jthtempo, FP_amount, FP_DP, FP_bayar);

-- 3. Index pelengkap rantai salesman: faktur -> surat jalan -> pesanan
ALTER TABLE tdo_hdr ADD INDEX IF NOT EXISTS idx_do_so_nomor (do_so_nomor);

-- 4. Segarkan statistik optimizer setelah index dibuat
ANALYZE TABLE tfp_hdr, tcustomer, tdo_hdr, tso_hdr, kartu_piutang, transaksi_harian;

-- ============================================================
-- Verifikasi: query ini harus selesai < 1-2 detik setelah index.
-- Sebelumnya: 30-60+ detik (atau timeout).
-- ============================================================
SELECT c.Cus_nama, SUM(f.FP_amount - f.FP_DP - f.FP_bayar) AS sisa
FROM tfp_hdr f
JOIN tcustomer c ON c.Cus_kode = f.FP_cus_kode
WHERE f.FP_jthtempo < CURDATE()
  AND (f.FP_amount - f.FP_DP - f.FP_bayar) > 0
GROUP BY c.Cus_nama
ORDER BY sisa DESC
LIMIT 10;

-- Cek ukuran buffer pool saat ini (biasanya 128M di XAMPP):
-- SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
