-- Master Salesman (tsalesmanaktif) + detail multi Area/Rayon
-- 1 salesman bisa handle beberapa area/rayon (master tsalesman = Area/Rayon).

CREATE TABLE IF NOT EXISTS tsalesmanaktif_dtl (
  slad_sla_kode char(10) NOT NULL,
  slad_sls_kode char(10) NOT NULL,
  slad_nourut   int NOT NULL DEFAULT 1,
  PRIMARY KEY (slad_sla_kode, slad_sls_kode),
  KEY idx_slad_sls_kode (slad_sls_kode)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Menu Master Salesman (grup Daftar / parent 5)
INSERT INTO tmenu
  (MEN_ID, MEN_NAMA, MEN_KETERANGAN, men_modul, men_menu_name, men_menu_name2,
   MEN_NAMA2, men_route, men_parent_id, men_order, men_view)
SELECT 114, 'frmSalesmanAktif', 'Master Salesman', 1, 'dxSalesmanAktif', 'SalesmanAktif1',
       'Salesman', '/daftar/salesman-aktif', 5, 7, 'daftar/SalesmanAktifView'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE MEN_ID = 114);
