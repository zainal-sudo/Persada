-- sql/backfill_fp_so.sql
-- Backfill manual untuk migrasi relasi FP → SO.
--
-- 1. Isi tfp_hdr.fp_so_nomor dari fp_do_nomor → do_so_nomor (data lama).
-- 2. Tandai tso_hdr.so_isinvoice = 1 untuk SO yang ter-backfill
--    (konsisten dgn 1 SO = 1 invoice).
--
-- NOTE: jalankan 3 statement dalam SATU sesi/koneksi (temp table hidup per sesi).

CREATE TEMPORARY TABLE tmp_fp_so AS
SELECT f.fp_nomor, d.do_so_nomor AS so_nomor
FROM tfp_hdr f
INNER JOIN tdo_hdr d ON d.do_nomor = f.fp_do_nomor
WHERE f.fp_so_nomor IS NULL OR f.fp_so_nomor = '';

UPDATE tfp_hdr f
INNER JOIN tmp_fp_so t ON t.fp_nomor = f.fp_nomor
SET f.fp_so_nomor = t.so_nomor;

UPDATE tso_hdr s
INNER JOIN (SELECT DISTINCT so_nomor FROM tmp_fp_so) t
  ON t.so_nomor = s.so_nomor
SET s.so_isinvoice = 1;