-- =============================================================
-- Baris FP yang avgcost DO-nya >= harga jual FP.
-- fpd_hpp diambil dari tbarang.brg_hrgbeli, bukan avgcost.
-- =============================================================

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
INNER JOIN (
  SELECT mst_noreferensi, mst_brg_kode, MAX(mst_avgcost) AS avgcost
    FROM tmasterstok
   WHERE mst_noreferensi LIKE '%DO%'
     AND mst_stok_out > 0
   GROUP BY mst_noreferensi, mst_brg_kode
) a ON a.mst_noreferensi = f.fp_do_nomor
   AND a.mst_brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * b.brg_hrgbeli
WHERE IFNULL(f.fp_do_nomor, '') <> ''
  AND a.avgcost >= d.fpd_harga
  AND IFNULL(b.brg_hrgbeli, 0) > 0;

SELECT COUNT(*) AS sisa_avg_ge_harga,
       SUM(IFNULL(d.fpd_hpp,0)) AS hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 INNER JOIN (
   SELECT mst_noreferensi, mst_brg_kode, MAX(mst_avgcost) AS avgcost
     FROM tmasterstok
    WHERE mst_noreferensi LIKE '%DO%' AND mst_stok_out > 0
    GROUP BY mst_noreferensi, mst_brg_kode
 ) a ON a.mst_noreferensi = f.fp_do_nomor AND a.mst_brg_kode = d.fpd_brg_kode
 WHERE IFNULL(f.fp_do_nomor,'') <> ''
   AND a.avgcost >= d.fpd_harga;
