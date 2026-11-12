-- ============================================================
-- tclientcert — mapping Client Certificate (mTLS) → scope cabang
-- DB TARGET : krm (database sistem)
-- Jalankan manual via: mysql -u <user> -p krm < tclientcert.sql
-- atau lewat phpMyAdmin → Import.
-- ============================================================

CREATE TABLE IF NOT EXISTS `tclientcert` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cn` VARCHAR(100) NOT NULL COMMENT 'CN di client cert (unik per mesin)',
  `allowed_cabang` TEXT NOT NULL COMMENT '"*" = semua cabang, atau CSV kode cabang (P01,P02)',
  `default_cabang` VARCHAR(10) NULL COMMENT 'default cabang saat login; null + "*" => pusat 00',
  `aktif` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uqc_cn` (`cn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Seed contoh ───────────────────────────────────────────────
-- Sesuaikan CN dengan client cert yang akan dibuat per mesin.
-- `allowed_cabang`:
--   '*':       boleh semua cabang (default login otomatis ke pusat `00`)
--   'P01':     hanya cabang P01 (dropdown terkunci)
--   'P01,P02': hanya cabang P01 & P02 (custom multi)
-- Untuk mencabut akses mesin tanpa regenerate cert: set `aktif = 0`.

INSERT INTO `tclientcert` (`cn`, `allowed_cabang`, `default_cabang`, `aktif`) VALUES
('mesin-pusat-01', '*',        NULL,  1),  -- akses semua, default pusat (00)
('mesin-pbr-01',   'P01',      'P01', 1),  -- terbatas 1 cabang (dropdown terkunci)
('mesin-mkt-01',   'P01,P02',  'P00', 1);  -- custom multi cabang