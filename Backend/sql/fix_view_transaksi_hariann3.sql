-- sql/fix_view_transaksi_hariann3.sql
-- Perbaikan view transaksi_hariann3 (dipakai laporan komisi) —
-- relasi FP → SO (bukan DO).
--
-- Perubahan: 3 subquery `salesman` yang memakai relasi lama
-- (tfp → tdo → tso via FP_DO_nomor) diganti ke relasi baru
-- (tfp.fp_so_nomor → tso). FP SO-based punya FP_do_nomor kosong,
-- subquery lama mengembalikan NULL → salesman/rayon hilang.
--
-- Kolom lain, GROUP BY, dan filter brg_ktg_kode LIKE '4%' tidak diubah.

-- 0) BACKUP dulu (jalankan, simpan outputnya):
-- SHOW CREATE VIEW transaksi_hariann3;

ALTER ALGORITHM = UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `transaksi_hariann3` AS

-- ── Blok 1: PENJUALAN (tfp_hdr + tfp_dtl) ──
select `tfp_hdr`.`FP_tanggal` AS `Tanggal`,
       `tfp_hdr`.`FP_nomor` AS `Nomor`,
       `tfp_hdr`.`FP_cus_kode` AS `Customer`,
       (select `tso_hdr`.`so_sls_kode` from `tso_hdr`
         where `tso_hdr`.`so_nomor` = `tfp_hdr`.`fp_so_nomor` limit 1) AS `salesman`,
       if(`tfp_hdr`.`FP_istax` = 1, 'PPN', 'Non PPn') AS `Tax`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Bruto`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty` * `tfp_dtl`.`FPd_discpr` / 100) AS `Disc`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`) * (`tfp_hdr`.`FP_disc_fakturpr` * (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`) / 100 + `tfp_hdr`.`FP_disc_faktur`) AS `Disc_Faktur`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `DPP`,
       `tfp_hdr`.`FP_taxamount` / (`tfp_hdr`.`FP_amount` - `tfp_hdr`.`FP_taxamount`) * sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Pajak`,
       sum(`tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Total`,
       `tfp_hdr`.`fp_freight` AS `Freight`,
       sum(`tfp_dtl`.`fpd_bp_pr` / 100 * `tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) + sum(`tfp_dtl`.`fpd_bp_rp` * `tfp_dtl`.`FPd_qty`) AS `Biaya_Promosi`,
       sum(`tfp_dtl`.`fpd_bp_pr2` / 100 * `tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) + sum(`tfp_dtl`.`fpd_bp_rp2` * `tfp_dtl`.`FPd_qty`) AS `Fee_Marketing`,
       sum(`tfp_dtl`.`fpd_cn` / 100 * `tfp_dtl`.`FPd_harga` * `tfp_dtl`.`FPd_qty`) AS `Kontrak`,
       0 AS `Retur`,
       0 AS `Bayar_Cash`,
       0 AS `Bayar_Transfer`,
       0 AS `Giro`,
       0 AS `Deposit`,
       0 AS `Koreksi_LR`,
       0 AS `Hutang_Internal`,
       0 AS `UM_Penjualan`,
       0 AS `PPn_Keluaran`,
       0 AS `PPh_22`,
       0 AS `Potongan`
from ((`tfp_hdr`
join `tfp_dtl` on(`tfp_dtl`.`FPd_FP_nomor` = `tfp_hdr`.`FP_nomor`))
join `tbarang` on(`tbarang`.`brg_kode` = `tfp_dtl`.`FPd_brg_kode` and `tbarang`.`brg_ktg_kode` like '4%'))
group by `tfp_hdr`.`FP_nomor`, `tfp_hdr`.`FP_tanggal`, `tfp_hdr`.`FP_cus_kode`,
         `tfp_hdr`.`FP_istax`, `tfp_hdr`.`FP_taxamount`, `tfp_hdr`.`FP_amount`,
         `tfp_hdr`.`fp_freight`

union

-- ── Blok 2: PEMBAYARAN (tbayarcus_hdr x) ──
select `x`.`byc_tanggal` AS `Tanggal`,
       `x`.`byc_nomor` AS `Nomor`,
       `x`.`byc_cus_kode` AS `Customer`,
       (select `tso_hdr`.`so_sls_kode`
          from (`tbayarcus_dtl`
                join `tfp_hdr` on(`tfp_hdr`.`FP_nomor` = `tbayarcus_dtl`.`bycd_fp_nomor`)
                join `tso_hdr` on(`tso_hdr`.`so_nomor` = `tfp_hdr`.`fp_so_nomor`))
         where `tbayarcus_dtl`.`bycd_byc_nomor` = `x`.`byc_nomor` limit 1) AS `salesman`,
       if(`x`.`byc_istax` = 1, 'PPN', 'Non PPn') AS `Tax`,
       0 AS `Bruto`,
       0 AS `Disc`,
       0 AS `Disc_Faktur`,
       0 AS `DPP`,
       0 AS `Pajak`,
       0 AS `Total`,
       0 AS `Freight`,
       0 AS `Biaya_Promosi`,
       0 AS `Fee_Marketing`,
       0 AS `Kontrak`,
       0 AS `Retur`,
       `x`.`byc_cash` AS `Bayar_Cash`,
       `x`.`byc_transfer` AS `Bayar_Transfer`,
       `x`.`byc_giro` AS `Giro`,
       ifnull((select `tbayarcus_hdr`.`byc_potongan` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_potongan` = '11.004'),0) AS `Deposit`,
       ifnull((select `tbayarcus_hdr`.`byc_potongan` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_potongan` = '25.001'),0) AS `Koreksi_LR`,
       ifnull((select `tbayarcus_hdr`.`byc_potongan` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_potongan` in ('19.004','14.005')),0) AS `Hutang_Internal`,
       ifnull((select `tbayarcus_hdr`.`byc_potongan` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_potongan` = '19.001'),0) AS `UM_Penjualan`,
       ifnull((select `tbayarcus_hdr`.`byc_ppn` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_ppn` = '19.005'),0) AS `PPn_Keluaran`,
       ifnull((select `tbayarcus_hdr`.`byc_pph` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_pph` = '19.006'),0) AS `PPh_22`,
       ifnull((select `tbayarcus_hdr`.`byc_potongan` from `tbayarcus_hdr` where `tbayarcus_hdr`.`byc_nomor` = `x`.`byc_nomor` and `tbayarcus_hdr`.`byc_rek_potongan` not in ('11.004','25.001','19.004','14.005','19.005','19.006','19.001')),0) AS `Potongan`
from `tbayarcus_hdr` `x`

union

-- ── Blok 3: RETUR (tretj_hdr) ──
select `tretj_hdr`.`retj_tanggal` AS `Tanggal`,
       `tretj_hdr`.`retj_nomor` AS `Nomor`,
       `tretj_hdr`.`retj_cus_kode` AS `Customer`,
       (select `tso_hdr`.`so_sls_kode`
          from (`tfp_hdr`
                join `tso_hdr` on(`tso_hdr`.`so_nomor` = `tfp_hdr`.`fp_so_nomor`))
         where `tfp_hdr`.`FP_nomor` = `tretj_hdr`.`retj_fp_nomor` limit 1) AS `salesman`,
       if(`tretj_hdr`.`retj_istax` = 1, 'PPN', 'Non PPn') AS `Tax`,
       0 AS `Bruto`,
       0 AS `Disc`,
       0 AS `Disc_Faktur`,
       0 AS `DPP`,
       0 AS `Pajak`,
       0 AS `Total`,
       0 AS `Freight`,
       0 AS `Biaya_Promosi`,
       0 AS `Fee_Marketing`,
       0 AS `Kontrak`,
       sum(`tretj_dtl`.`retjd_harga` * `tretj_dtl`.`retjd_qty`) AS `Retur`,
       0 AS `Bayar_Cash`,
       0 AS `Bayar_Transfer`,
       0 AS `Giro`,
       0 AS `Deposit`,
       0 AS `Koreksi_LR`,
       0 AS `Hutang_Internal`,
       0 AS `UM_Penjualan`,
       0 AS `PPn_Keluaran`,
       0 AS `PPh_22`,
       0 AS `Potongan`
from ((`tretj_hdr`
join `tretj_dtl` on(`tretj_dtl`.`retjd_retj_nomor` = `tretj_hdr`.`retj_nomor`))
join `tbarang` on(`tbarang`.`brg_kode` = `tretj_dtl`.`retjd_brg_kode` and `tbarang`.`brg_ktg_kode` like '4%'))
group by `tretj_hdr`.`retj_nomor`, `tretj_hdr`.`retj_tanggal`, `tretj_hdr`.`retj_cus_kode`,
         `tretj_hdr`.`retj_istax`, `tretj_hdr`.`retj_taxamount`, `tretj_hdr`.`retj_amount`;

-- ============================================================
-- VERIFIKASI (setelah eksekusi):
-- SHOW CREATE VIEW transaksi_hariann3;
-- SELECT DISTINCT salesman FROM transaksi_hariann3
--   WHERE Nomor = '<nomor-faktur-so-based>' LIMIT 5;
-- Buka laporan Komisi Salesman / Transaksi Harian N3 -> salesman terisi.
-- ============================================================