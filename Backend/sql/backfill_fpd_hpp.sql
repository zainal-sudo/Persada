-- sql/backfill_fpd_hpp.sql
-- Backfill HPP freeze (Opsi 2) untuk FP data lama sebelum kolom fpd_hpp
-- diperkenalkan / sebelum freeze di saveData.
--
-- fpd_hpp = SUM(mst_stok_out * mst_hargabeli) — cost saat barang keluar.
-- - FP lama (fp_do_nomor terisi): pakai baris stok MILIK DO TSB saja
--   (FP lama = 1 FP : 1 DO, jangan ikut DO lain di SO yang sama).
-- - FP SO-based (fp_do_nomor kosong): semua DO milik SO.
--
-- Idempoten: hanya update baris yang fpd_hpp = 0.
-- NOTE: jalankan 2 statement dalam SATU sesi/koneksi (temp table per sesi).

CREATE TEMPORARY TABLE tmp_hpp AS
SELECT d.fpd_fp_nomor AS fp_nomor,
       d.fpd_brg_kode AS brg_kode,
       COALESCE(SUM(m.mst_stok_out * m.mst_hargabeli), 0) AS hpp
FROM tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tmasterstok m ON m.mst_brg_kode = d.fpd_brg_kode
  AND (
        -- FP lama: referensi DO sendiri (satu DO per FP)
        (IFNULL(f.fp_do_nomor, '') <> '' AND m.mst_noreferensi = f.fp_do_nomor)
     OR -- FP SO-based: semua DO milik SO
        (IFNULL(f.fp_do_nomor, '') = '' AND IFNULL(f.fp_so_nomor, '') <> ''
         AND m.mst_noreferensi IN (
               SELECT do_nomor FROM tdo_hdr WHERE do_so_nomor = f.fp_so_nomor))
      )
GROUP BY d.fpd_fp_nomor, d.fpd_brg_kode;

UPDATE tfp_dtl d
INNER JOIN tmp_hpp t ON t.fp_nomor = d.fpd_fp_nomor
                    AND t.brg_kode = d.fpd_brg_kode
SET d.fpd_hpp = t.hpp
WHERE d.fpd_hpp = 0;