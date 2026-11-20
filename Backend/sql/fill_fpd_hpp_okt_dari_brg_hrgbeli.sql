-- =============================================================
-- Isi HPP Oktober 2026 yang masih 0 dari tbarang.brg_hrgbeli.
-- Hanya baris dengan fpd_hpp = 0 dan brg_hrgbeli > 0.
-- Baris dengan brg_hrgbeli = 0 dibiarkan (tidak ada harga beli).
-- =============================================================

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * b.brg_hrgbeli
WHERE f.fp_tanggal >= '2026-10-01' AND f.fp_tanggal < '2026-11-01'
  AND IFNULL(d.fpd_hpp, 0) = 0
  AND IFNULL(b.brg_hrgbeli, 0) > 0;

SELECT COUNT(*) detail,
       SUM(IF(IFNULL(d.fpd_hpp,0)=0,1,0)) zero_,
       SUM(IFNULL(d.fpd_hpp,0)) hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE f.fp_tanggal >= '2026-10-01' AND f.fp_tanggal < '2026-11-01';
