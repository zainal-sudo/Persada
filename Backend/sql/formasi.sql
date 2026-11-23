-- Master Formasi + target formasi
-- Struktur mengikuti pg_formasi / pg_target_sales (cetar), nama tabel ikut konvensi ampersada.
-- Untuk migrasi data + idempoten, gunakan: node sql/migrasi_formasi_cetar.js

CREATE TABLE IF NOT EXISTS tformasi (
  tf_id          BIGINT NOT NULL AUTO_INCREMENT,
  tf_nama        VARCHAR(255) NOT NULL,
  tf_divisi      VARCHAR(50) NOT NULL DEFAULT '',
  tf_type        VARCHAR(20) NOT NULL DEFAULT '',
  tf_sla_kode    CHAR(10) NULL,
  tf_atasan_kode CHAR(10) NULL,
  date_create    DATETIME NULL,
  user_create    VARCHAR(20) NULL,
  date_modified  DATETIME NULL,
  user_modified  VARCHAR(20) NULL,
  PRIMARY KEY (tf_id),
  KEY idx_tf_sla_kode (tf_sla_kode),
  KEY idx_tf_atasan_kode (tf_atasan_kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tformasitarget (
  tft_id                       BIGINT NOT NULL AUTO_INCREMENT,
  tft_tf_id                    BIGINT NOT NULL,
  tft_bulan                    DATE NOT NULL,
  tft_target                   DECIMAL(20,4) NOT NULL DEFAULT 0,
  tft_target_jenis             LONGTEXT NULL,
  tft_additional_target_produk LONGTEXT NULL,
  tft_last_edited_at           DATETIME NULL,
  date_create                  DATETIME NULL,
  user_create                  VARCHAR(20) NULL,
  date_modified                DATETIME NULL,
  user_modified                VARCHAR(20) NULL,
  PRIMARY KEY (tft_id),
  UNIQUE KEY uq_tft_formasi_bulan (tft_tf_id, tft_bulan),
  KEY idx_tft_bulan (tft_bulan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE tsalesman
  ADD COLUMN sls_formasi_id BIGINT NULL DEFAULT NULL;

ALTER TABLE tsalesmanaktif
  ADD COLUMN sla_formasi_id BIGINT NULL DEFAULT NULL;

INSERT INTO tmenu
  (MEN_ID, MEN_NAMA, MEN_KETERANGAN, men_modul, men_menu_name,
   men_menu_name2, MEN_NAMA2, men_icon, men_route, men_parent_id,
   men_order, men_view)
SELECT (SELECT IFNULL(MAX(MEN_ID), 0) + 1 FROM tmenu),
       'frmFormasi', 'Master Formasi', 1, 'dxFormasi',
       'Formasi1', 'Formasi', 'pi pi-sitemap', '/daftar/formasi',
       5, 9, 'daftar/FormasiView'
WHERE NOT EXISTS (SELECT 1 FROM tmenu WHERE men_route = '/daftar/formasi');
