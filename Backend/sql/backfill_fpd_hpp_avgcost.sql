-- =============================================================
-- Backfill tfp_dtl.fpd_hpp dari biaya stok keluar DO
--
-- Aturan:
--   HPP baris = fpd_qty × unit cost
--   unit cost  = mst_avgcost; jika 0/NULL pakai mst_hargabeli
--   penghubung = tfp_hdr.fp_do_nomor = tmasterstok.mst_noreferensi
--                dan tfp_dtl.fpd_brg_kode = tmasterstok.mst_brg_kode
--
-- Bila batch detail cocok (fpd_idbatch), unit cost diambil dari baris
-- stok batch tersebut. Jika tidak, dipakai rata-rata tertimbang
-- SUM(stok_out × cost) / SUM(stok_out) untuk DO + barang tsb, supaya
-- barang yang sama dengan beberapa batch tidak dihitung dobel.
--
-- Hanya mengisi baris yang fpd_hpp = 0/NULL (idempoten).
-- =============================================================

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * COALESCE(
      -- 1) unit cost dari batch yang sama (bila ada dan bernilai > 0)
      NULLIF(
        (SELECT AVG(IF(IFNULL(m.mst_avgcost, 0) > 0,
                       m.mst_avgcost,
                       IFNULL(m.mst_hargabeli, 0)))
           FROM tmasterstok m
          WHERE m.mst_noreferensi = f.fp_do_nomor
            AND m.mst_brg_kode = d.fpd_brg_kode
            AND IFNULL(m.mst_idbatch, '') = IFNULL(d.fpd_idbatch, '')
            AND m.mst_stok_out > 0),
        0),
      -- 2) fallback: rata-rata tertimbang per DO + barang
      (SELECT SUM(m.mst_stok_out
                  * IF(IFNULL(m.mst_avgcost, 0) > 0,
                       m.mst_avgcost,
                       IFNULL(m.mst_hargabeli, 0)))
              / NULLIF(SUM(m.mst_stok_out), 0)
         FROM tmasterstok m
        WHERE m.mst_noreferensi = f.fp_do_nomor
          AND m.mst_brg_kode = d.fpd_brg_kode
          AND m.mst_stok_out > 0),
      0)
WHERE IFNULL(f.fp_do_nomor, '') <> ''
  AND IFNULL(d.fpd_hpp, 0) = 0;

-- Verifikasi
SELECT COUNT(*) AS masih_nol
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE IFNULL(f.fp_do_nomor, '') <> ''
   AND IFNULL(d.fpd_hpp, 0) = 0;

SELECT f.fp_nomor, f.fp_tanggal, d.fpd_brg_kode, d.fpd_qty,
       d.fpd_hpp, d.fpd_idbatch, f.fp_do_nomor
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE IFNULL(f.fp_do_nomor, '') <> ''
 ORDER BY f.fp_tanggal DESC, f.fp_nomor, d.fpd_nourut
 LIMIT 20;
