-- ============================================================
-- totorisasi — catatan otorisasi terikat transaksi (FP dulu)
-- DB TARGET : database Sistem (pusat) = DB_NAME pada .env
--            (bukan per database cabang — satu tabel saja)
-- Jalankan manual via: mysql -u <user> -p krm < totorisasi.sql
-- atau lewat phpMyAdmin → Import (database sistem).
--
-- Kode berbasis waktu (HHMMSS / 99HHMMSS). Karena tabel GLOBAL,
-- dua request menit+jenis sama (bahkan beda cabang) bisa bentrok.
-- ON DUPLICATE KEY UPDATE di service men-*refresh* konteks baris
-- yang sama (edge diterima — lihat otorisasiService.request).
-- Kolom cabang/dbase menunjuk ke DB cabang tempat detail
-- transaksi (tmasterstok dll) di-query saat GET/verify.
-- ============================================================

CREATE TABLE IF NOT EXISTS `totorisasi` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `kode` VARCHAR(10) NOT NULL COMMENT 'HHMMSS / 99HHMMSS (prefix 99 = harga bawah lastcost)',
  `jenis` VARCHAR(20) NOT NULL COMMENT 'FP (extensible: RETUR, CUSTOMER, ...)',
  `cabang` VARCHAR(10) NOT NULL COMMENT 'cbg_kode cabang peminta (routing query detail)',
  `dbase` VARCHAR(50) NOT NULL COMMENT 'database cabang peminta (routing query detail)',
  `user_kode` VARCHAR(20) NOT NULL COMMENT 'kasir peminta',
  `konteks` JSON NOT NULL COMMENT 'input utk query: {form, detail} — bukan hasil',
  `hasil` JSON NULL COMMENT 'hasil query fresh saat GET (cache tampilan mobile)',
  `status` VARCHAR(10) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING / DONE',
  `ref_nomor` VARCHAR(40) NULL COMMENT 'nomor dokumen final (diisi saat save)',
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diverifikasi_pada` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kode` (`kode`),
  KEY `idx_status` (`status`),
  KEY `idx_ref` (`ref_nomor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;