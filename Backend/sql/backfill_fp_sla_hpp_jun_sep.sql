-- =============================================================
-- Backfill Juni s.d. September 2026 dari sumber migrasi CETAR:
--   1. tfp_dtl.fpd_hpp  = fpd_qty x cetar hpp_asli
--   2. tfp_hdr.fp_sla_kode = salesman (POF) per faktur
--
-- Penghubung baris: fp_nomor + fpd_nourut = ROW_NUMBER()
--   sumber diurutkan sama seperti migrasi (created_at, id).
-- Jalankan sekali; ALTER kolom fp_sla_kode hanya jika belum ada.
-- =============================================================

ALTER TABLE tfp_hdr
  ADD COLUMN fp_sla_kode VARCHAR(10) NULL AFTER fp_so_nomor;

CREATE TEMPORARY TABLE tmp_src_fp AS
SELECT no_faktur,
       id_produk,
       jumlah_produk,
       hpp_asli,
       id_pof,
       ROW_NUMBER() OVER (PARTITION BY no_faktur ORDER BY created_at, id) AS rn
  FROM (
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan
     WHERE tgl_nota >= '2026-06-01' AND tgl_nota < '2026-10-01'
    UNION ALL
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan_btj
     WHERE tgl_nota >= '2026-06-01' AND tgl_nota < '2026-10-01'
    UNION ALL
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan_otc
     WHERE tgl_nota >= '2026-06-01' AND tgl_nota < '2026-10-01'
  ) x;

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tmp_src_fp s ON s.no_faktur = d.fpd_fp_nomor AND s.rn = d.fpd_nourut
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * s.hpp_asli
WHERE f.fp_tanggal >= '2026-06-01' AND f.fp_tanggal < '2026-10-01';

UPDATE tfp_hdr f
INNER JOIN (
  SELECT no_faktur, MAX(id_pof) AS id_pof
    FROM tmp_src_fp
   GROUP BY no_faktur
) s ON s.no_faktur = f.fp_nomor
INNER JOIN cetar.pg_pof p ON p.id = s.id_pof
INNER JOIN (
  SELECT sla_nama, MIN(sla_kode) AS sla_kode
    FROM tsalesmanaktif
   GROUP BY sla_nama
) sla ON sla.sla_nama = TRIM(p.nama_pof)
SET f.fp_sla_kode = sla.sla_kode
WHERE f.fp_tanggal >= '2026-06-01' AND f.fp_tanggal < '2026-10-01';

DROP TEMPORARY TABLE tmp_src_fp;

SELECT DATE_FORMAT(f.fp_tanggal,'%Y-%m') periode,
       COUNT(*) n,
       SUM(IFNULL(d.fpd_hpp,0)) hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE f.fp_tanggal >= '2026-06-01' AND f.fp_tanggal < '2026-10-01'
 GROUP BY periode ORDER BY periode;

SELECT COUNT(*) n,
       SUM(IF(IFNULL(fp_sla_kode,'')='',1,0)) tanpa_salesman
  FROM tfp_hdr
 WHERE fp_tanggal >= '2026-06-01' AND fp_tanggal < '2026-10-01';
