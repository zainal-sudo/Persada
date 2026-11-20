-- =============================================================
-- Backfill Oktober-November 2026 dari sumber CETAR:
--   tfp_dtl.fpd_hpp   = fpd_qty x cetar hpp_asli
--   tfp_hdr.fp_sla_kode = salesman (POF) per faktur
--
-- Kolom fp_sla_kode dibuat oleh backfill_fp_sla_hpp_jun_sep.sql.
-- Jika belum ada, jalankan ALTER berikut lebih dulu:
--   ALTER TABLE tfp_hdr
--     ADD COLUMN fp_sla_kode VARCHAR(10) NULL AFTER fp_so_nomor;
--
-- FP manual November yang tidak ada di cetar tidak diubah.
-- =============================================================

CREATE TEMPORARY TABLE tmp_src_fp (
  no_faktur VARCHAR(50) NOT NULL,
  id_produk VARCHAR(50) NULL,
  jumlah_produk DECIMAL(18,4) NULL,
  hpp_asli DECIMAL(18,4) NULL,
  id_pof BIGINT NULL,
  rn INT NOT NULL,
  PRIMARY KEY (no_faktur, rn),
  KEY idx_pof (id_pof)
) ENGINE=InnoDB
SELECT no_faktur, id_produk, jumlah_produk, hpp_asli, id_pof,
       ROW_NUMBER() OVER (PARTITION BY no_faktur ORDER BY created_at, id) AS rn
  FROM (
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan
     WHERE tgl_nota >= '2026-10-01' AND tgl_nota < '2026-12-01'
    UNION ALL
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan_btj
     WHERE tgl_nota >= '2026-10-01' AND tgl_nota < '2026-12-01'
    UNION ALL
    SELECT no_faktur, id, created_at, id_produk, jumlah_produk, hpp_asli, id_pof
      FROM cetar.pg_penjualan_otc
     WHERE tgl_nota >= '2026-10-01' AND tgl_nota < '2026-12-01'
  ) x;

UPDATE tfp_dtl d
INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
INNER JOIN tmp_src_fp s ON s.no_faktur = d.fpd_fp_nomor AND s.rn = d.fpd_nourut
SET d.fpd_hpp = IFNULL(d.fpd_qty, 0) * s.hpp_asli
WHERE f.fp_tanggal >= '2026-10-01' AND f.fp_tanggal < '2026-12-01';

CREATE TEMPORARY TABLE tmp_fp_sla (
  no_faktur VARCHAR(50) NOT NULL PRIMARY KEY,
  sla_kode VARCHAR(10) NULL
) ENGINE=InnoDB;

INSERT INTO tmp_fp_sla (no_faktur)
SELECT no_faktur FROM tmp_src_fp GROUP BY no_faktur;

UPDATE tmp_fp_sla t
INNER JOIN (
  SELECT no_faktur, MAX(id_pof) AS id_pof
    FROM tmp_src_fp
   GROUP BY no_faktur
) s ON s.no_faktur = t.no_faktur
INNER JOIN cetar.pg_pof p ON p.id = s.id_pof
INNER JOIN (
  SELECT sla_nama, MIN(sla_kode) AS sla_kode
    FROM tsalesmanaktif
   GROUP BY sla_nama
) sla ON sla.sla_nama = TRIM(p.nama_pof)
SET t.sla_kode = sla.sla_kode;

UPDATE tfp_hdr f
INNER JOIN tmp_fp_sla t ON t.no_faktur = f.fp_nomor
SET f.fp_sla_kode = t.sla_kode
WHERE f.fp_tanggal >= '2026-10-01' AND f.fp_tanggal < '2026-12-01'
  AND t.sla_kode IS NOT NULL;

DROP TEMPORARY TABLE tmp_fp_sla;
DROP TEMPORARY TABLE tmp_src_fp;

SELECT DATE_FORMAT(f.fp_tanggal,'%Y-%m') periode,
       COUNT(*) n,
       SUM(IF(IFNULL(d.fpd_hpp,0)=0,1,0)) zero_,
       SUM(IFNULL(d.fpd_hpp,0)) hpp
  FROM tfp_dtl d
 INNER JOIN tfp_hdr f ON f.fp_nomor = d.fpd_fp_nomor
 WHERE f.fp_tanggal >= '2026-10-01' AND f.fp_tanggal < '2026-12-01'
 GROUP BY periode ORDER BY periode;
