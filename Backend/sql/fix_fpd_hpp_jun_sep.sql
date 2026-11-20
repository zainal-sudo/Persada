-- =============================================================
-- SUPERSEDED: Juni s.d. September 2026 sekarang memakai HPP asli
-- dari cetar.pg_penjualan*.hpp_asli, lihat
-- backfill_fp_sla_hpp_jun_sep.sql. File ini disimpan sebagai
-- fallback bila sumber cetar tidak tersedia.
--
-- HPP FP Juni s.d. September 2026 (tanpa relasi SO/DO).
-- Aturan:
--   1. avg beli = rata-rata mst_hargabeli stok masuk per barang.
--   2. Jika avg > 0 dan avg < fpd_harga -> pakai avg.
--   3. Selain itu -> pakai tbarang.brg_hrgbeli.
--   4. Fallback terakhir -> avg (bila brg_hrgbeli kosong).
-- =============================================================

CREATE TEMPORARY TABLE tmp_avg_hb AS
SELECT mst_brg_kode,
       AVG(mst_hargabeli) AS avg_hb
  FROM tmasterstok
 WHERE mst_stok_in > 0
   AND IFNULL(mst_hargabeli, 0) > 0
 GROUP BY mst_brg_kode;

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
LEFT JOIN tmp_avg_hb a ON a.mst_brg_kode = d.fpd_brg_kode
LEFT JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * CASE
      WHEN IFNULL(a.avg_hb, 0) > 0 AND a.avg_hb < d.fpd_harga THEN a.avg_hb
      WHEN IFNULL(b.brg_hrgbeli, 0) > 0 THEN b.brg_hrgbeli
      ELSE IFNULL(a.avg_hb, 0)
    END
WHERE f.fp_tanggal >= '2026-06-01'
  AND f.fp_tanggal < '2026-10-01';

DROP TEMPORARY TABLE tmp_avg_hb;

SELECT DATE_FORMAT(f.fp_tanggal, '%Y-%m') periode,
       COUNT(*) n,
       SUM(IF(IFNULL(d.fpd_hpp,0)=0,1,0)) hpp_0,
       SUM(IFNULL(d.fpd_hpp,0)) total_hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE f.fp_tanggal >= '2026-06-01' AND f.fp_tanggal < '2026-10-01'
 GROUP BY periode ORDER BY periode;
