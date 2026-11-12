-- sql/fix_view_penjualan_bydepartemen.sql
-- Perbaikan view keberbagian DEPARTEMEN (dipakai LapBulanan5):
--   penjualann3bydepartemen      (kategori '4%')
--   penjualannonn3bydepartemen   (kategori bukan '4%')
--
-- Perubahan (konsisten dengan fix_view_penjualan_salesman.sql):
--  1. Subquery salesman: FP_DO_nomor (relasi lama) → fp_so_nomor (relasi baru).
--  2. DPP = Bruto - Disc (dulu = Bruto, diskon tidak dikurangi).
--  3. Pajak/Total = rasio pajak header x DPP baru.
--  4. Biaya_Promosi/Fee_Marketing/Kontrak dari harga setelah diskon.
--
-- Kolom departemen, filter kategori, tg1()/tg2(), group by dipertahankan.

-- 0) BACKUP dulu (jalankan, simpan outputnya):
-- SHOW CREATE VIEW penjualann3bydepartemen;
-- SHOW CREATE VIEW penjualannonn3bydepartemen;

-- ============================================================
-- 1) VIEW penjualann3bydepartemen (kategori '4%')
-- ============================================================
DROP VIEW IF EXISTS penjualann3bydepartemen;

CREATE DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `penjualann3bydepartemen` AS
select `tfp_hdr`.`FP_tanggal` AS `Tanggal`,
       `tfp_hdr`.`FP_jthtempo` AS `Jthtempo`,
       `tfp_hdr`.`FP_nomor` AS `Nomor`,
       `tfp_hdr`.`FP_cus_kode` AS `Customer`,
       (select `tso_hdr`.`so_sls_kode` from `tso_hdr`
         where `tso_hdr`.`so_nomor` = `tfp_hdr`.`fp_so_nomor` limit 1) AS `salesman`,
       substring_index(`tbarang`.`brg_ktg_kode`, '.', 2) AS `departemen`,
       if(`tfp_hdr`.`FP_istax` = 1, 'PPN', 'Non PPN') AS `Tax`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Bruto`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) AS `Disc`,
       -- ==== DPP = Bruto - Disc ====
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
       - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) AS `DPP`,
       -- ==== Pajak = rasio pajak header x DPP baru ====
       `tfp_hdr`.`FP_taxamount` / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`)
       * ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
           - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) ) AS `Pajak`,
       -- ==== Total = DPP + Pajak ====
       ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
         - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) )
       + `tfp_hdr`.`FP_taxamount` / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`)
       * ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
           - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) ) AS `Total`,
       0 AS `Bayar`,
       0 AS `Freight`,
       -- ==== Biaya_Promosi: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_bp_pr` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`)
       + sum(`tfp_dtl`.`fpd_bp_rp` * `tfp_dtl`.`FPd_qty`) AS `Biaya_Promosi`,
       -- ==== Fee_Marketing: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_bp_pr2` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`)
       + sum(`tfp_dtl`.`fpd_bp_rp2` * `tfp_dtl`.`FPd_qty`) AS `Fee_Marketing`,
       -- ==== Kontrak: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_cn` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`) AS `Kontrak`,
       0 AS `Retur`,
       0 AS `Bayar_Cash`,
       0 AS `Bayar_Transfer`,
       0 AS `Giro`,
       0 AS `Potongan`
from ((`tfp_hdr`
join `tfp_dtl` on(`tfp_dtl`.`FPd_FP_nomor` = `tfp_hdr`.`FP_nomor`))
join `tbarang` on(`tbarang`.`brg_kode` = `tfp_dtl`.`FPd_brg_kode` and `tbarang`.`brg_ktg_kode` like '4%'))
where `tfp_hdr`.`FP_tanggal` between `tg1`() and `tg2`()
group by `tfp_hdr`.`FP_nomor`, `tfp_hdr`.`FP_tanggal`, `tfp_hdr`.`FP_jthtempo`,
         `tfp_hdr`.`FP_cus_kode`, `tfp_hdr`.`FP_istax`, `tfp_hdr`.`FP_amount`,
         `tfp_hdr`.`FP_taxamount`, `tfp_hdr`.`fp_so_nomor`,
         substring_index(`tbarang`.`brg_ktg_kode`, '.', 2);

-- ============================================================
-- 2) VIEW penjualannonn3bydepartemen (kategori bukan '4%')
-- ============================================================
DROP VIEW IF EXISTS penjualannonn3bydepartemen;

CREATE DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `penjualannonn3bydepartemen` AS
select `tfp_hdr`.`FP_tanggal` AS `Tanggal`,
       `tfp_hdr`.`FP_jthtempo` AS `Jthtempo`,
       `tfp_hdr`.`FP_nomor` AS `Nomor`,
       `tfp_hdr`.`FP_cus_kode` AS `Customer`,
       (select `tso_hdr`.`so_sls_kode` from `tso_hdr`
         where `tso_hdr`.`so_nomor` = `tfp_hdr`.`fp_so_nomor` limit 1) AS `salesman`,
       substring_index(`tbarang`.`brg_ktg_kode`, '.', 2) AS `departemen`,
       if(`tfp_hdr`.`FP_istax` = 1, 'PPN', 'Non PPN') AS `Tax`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Bruto`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) AS `Disc`,
       -- ==== DPP = Bruto - Disc ====
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
       - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) AS `DPP`,
       -- ==== Pajak = rasio pajak header x DPP baru ====
       `tfp_hdr`.`FP_taxamount` / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`)
       * ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
           - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) ) AS `Pajak`,
       -- ==== Total = DPP + Pajak ====
       ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
         - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) )
       + `tfp_hdr`.`FP_taxamount` / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`)
       * ( sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`)
           - sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) ) AS `Total`,
       0 AS `Bayar`,
       0 AS `Freight`,
       -- ==== Biaya_Promosi: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_bp_pr` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`)
       + sum(`tfp_dtl`.`fpd_bp_rp` * `tfp_dtl`.`FPd_qty`) AS `Biaya_Promosi`,
       -- ==== Fee_Marketing: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_bp_pr2` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`)
       + sum(`tfp_dtl`.`fpd_bp_rp2` * `tfp_dtl`.`FPd_qty`) AS `Fee_Marketing`,
       -- ==== Kontrak: persen dari harga setelah diskon ====
       sum(`tfp_dtl`.`fpd_cn` / 100
           * (`tfp_dtl`.`FPd_harga` * (100 - `tfp_dtl`.`FPd_discpr`) / 100)
           * `tfp_dtl`.`FPd_qty`) AS `Kontrak`,
       0 AS `Retur`,
       0 AS `Bayar_Cash`,
       0 AS `Bayar_Transfer`,
       0 AS `Giro`,
       0 AS `Potongan`
from ((`tfp_hdr`
join `tfp_dtl` on(`tfp_dtl`.`FPd_FP_nomor` = `tfp_hdr`.`FP_nomor`))
join `tbarang` on(`tbarang`.`brg_kode` = `tfp_dtl`.`FPd_brg_kode`
    and (`tbarang`.`brg_ktg_kode` not like '4%' or `tbarang`.`brg_ktg_kode` is null)))
where `tfp_hdr`.`FP_tanggal` between `tg1`() and `tg2`()
group by `tfp_hdr`.`FP_nomor`,
         substring_index(`tbarang`.`brg_ktg_kode`, '.', 2);

-- ============================================================
-- VERIFIKASI (setelah eksekusi):
-- SET @tg1='2026-01-01'; SET @tg2='2026-12-31';
-- SELECT Nomor, Bruto, Disc, DPP, (Bruto - Disc) AS cek_dpp
--   FROM penjualann3bydepartemen WHERE Nomor = '<nomor-faktur>' LIMIT 1;
-- Buka menu LapBulanan5 -> salesman & DPP terisi, tidak ER_VIEW_INVALID.
-- ============================================================