-- =============================================================
-- Isi fpd_hpp untuk baris FP yang belum punya avgcost DO.
-- Sumber biaya: tbarang.brg_hrgbeli.
-- Penghubung: fp_do_nomor = mst_noreferensi
--             dan fpd_brg_kode = mst_brg_kode.
-- =============================================================

-- 1) fpd_hpp = fpd_qty × brg_hrgbeli untuk DO+barang yang avgcost-nya kosong
UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
LEFT JOIN (
  SELECT mst_noreferensi, mst_brg_kode, MAX(mst_avgcost) AS avgcost
    FROM tmasterstok
   WHERE mst_noreferensi LIKE '%DO%'
     AND mst_stok_out > 0
   GROUP BY mst_noreferensi, mst_brg_kode
) a ON a.mst_noreferensi = f.fp_do_nomor
   AND a.mst_brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * b.brg_hrgbeli
WHERE IFNULL(f.fp_do_nomor, '') <> ''
  AND a.avgcost IS NULL
  AND IFNULL(b.brg_hrgbeli, 0) > 0;

-- 2) Lengkapi mst_avgcost DO yang masih 0 dari brg_hrgbeli
UPDATE tmasterstok m
INNER JOIN tbarang b ON b.brg_kode = m.mst_brg_kode
SET m.mst_avgcost = b.brg_hrgbeli
WHERE m.mst_noreferensi LIKE '%DO%'
  AND IFNULL(m.mst_avgcost, 0) = 0
  AND IFNULL(b.brg_hrgbeli, 0) > 0;

-- Verifikasi
SELECT COUNT(*) AS fpd_tanpa_avg,
       SUM(IFNULL(d.fpd_hpp,0)) AS hpp_tanpa_avg
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
  LEFT JOIN (
    SELECT mst_noreferensi, mst_brg_kode, MAX(mst_avgcost) AS avgcost
      FROM tmasterstok
     WHERE mst_noreferensi LIKE '%DO%' AND mst_stok_out > 0
     GROUP BY mst_noreferensi, mst_brg_kode
  ) a ON a.mst_noreferensi = f.fp_do_nomor AND a.mst_brg_kode = d.fpd_brg_kode
 WHERE IFNULL(f.fp_do_nomor,'') <> ''
   AND a.avgcost IS NULL;

SELECT COUNT(*) AS do_avg_0
  FROM tmasterstok
 WHERE mst_noreferensi LIKE '%DO%'
   AND IFNULL(mst_avgcost,0) = 0;
