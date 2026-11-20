-- =============================================================
-- Perbaikan biaya stok keluar DO (tmasterstok)
--
-- 1) mst_hargabeli baris DO diambil dari tbarang:
--    brg_lastcost, fallback brg_hrgbeli.
-- 2) mst_avgcost baris DO = rata-rata mst_hargabeli stok masuk
--    (mst_stok_in > 0) per barang.
-- 3) fpd_hpp diisi fpd_qty × mst_avgcost hanya bila:
--    mst_avgcost > 0 DAN mst_avgcost < fpd_harga (harga jual FP).
--    Penghubung: fp_do_nomor = mst_noreferensi
--                dan fpd_brg_kode = mst_brg_kode.
-- =============================================================

-- 1) Harga beli DO dari master barang
UPDATE tmasterstok m
INNER JOIN tbarang b ON b.brg_kode = m.mst_brg_kode
SET m.mst_hargabeli = CASE
      WHEN IFNULL(b.brg_lastcost, 0) > 0 THEN b.brg_lastcost
      WHEN IFNULL(b.brg_hrgbeli, 0) > 0 THEN b.brg_hrgbeli
      ELSE m.mst_hargabeli
    END
WHERE m.mst_noreferensi LIKE '%DO%';

-- 2) Avgcost DO = rata-rata harga beli stok masuk per barang
CREATE TEMPORARY TABLE tmp_avg_hb AS
SELECT mst_brg_kode,
       AVG(mst_hargabeli) AS avg_hb
  FROM tmasterstok
 WHERE mst_stok_in > 0
   AND IFNULL(mst_hargabeli, 0) > 0
 GROUP BY mst_brg_kode;

UPDATE tmasterstok m
INNER JOIN tmp_avg_hb a ON a.mst_brg_kode = m.mst_brg_kode
SET m.mst_avgcost = a.avg_hb
WHERE m.mst_noreferensi LIKE '%DO%';

DROP TEMPORARY TABLE tmp_avg_hb;

-- 3) Freeze HPP FP hanya jika avgcost wajar di bawah harga jual
UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN (
  SELECT mst_noreferensi,
         mst_brg_kode,
         MAX(mst_avgcost) AS avgcost
    FROM tmasterstok
   WHERE mst_noreferensi LIKE '%DO%'
     AND mst_stok_out > 0
   GROUP BY mst_noreferensi, mst_brg_kode
) m ON m.mst_noreferensi = f.fp_do_nomor
   AND m.mst_brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * m.avgcost
WHERE IFNULL(f.fp_do_nomor, '') <> ''
  AND m.avgcost > 0
  AND m.avgcost < d.fpd_harga;

-- Verifikasi
SELECT COUNT(*) AS do_rows,
       SUM(IF(IFNULL(mst_hargabeli,0)>0,1,0)) AS hb_terisi,
       SUM(IF(IFNULL(mst_avgcost,0)>0,1,0)) AS avg_terisi,
       MIN(mst_avgcost) AS min_avg,
       MAX(mst_avgcost) AS max_avg
  FROM tmasterstok
 WHERE mst_noreferensi LIKE '%DO%';

SELECT COUNT(*) AS fp_rows,
       SUM(IF(IFNULL(d.fpd_hpp,0)>0,1,0)) AS hpp_terisi,
       SUM(IFNULL(d.fpd_hpp,0)) AS total_hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE IFNULL(f.fp_do_nomor, '') <> '';
