-- ══════════════════════════════════════════════════════════════════════
-- Titip Barang Konsinyasi (barang masuk konsinyasi)
-- Tabel: ttitip_hdr / ttitip_dtl — nomor format TB.yymm.NNNN
-- Gudang: hanya gudang konsinyasi. Barang: hanya barang konsinyasi.
-- Stok masuk ke tmasterstok di gudang konsinyasi (trigger).
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ttitip_hdr (
  titip_nomor VARCHAR(20) NOT NULL,
  titip_tanggal DATE,
  titip_gdg_kode VARCHAR(10),
  titip_memo VARCHAR(100),
  date_create DATETIME,
  date_modified DATETIME,
  user_create VARCHAR(20),
  user_modified VARCHAR(20),
  PRIMARY KEY (titip_nomor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ttitip_dtl (
  titd_titip_nomor VARCHAR(20) NOT NULL,
  titd_brg_kode INT(11) NOT NULL,
  titd_brg_satuan VARCHAR(10),
  titd_qty DOUBLE,
  titd_tgl_expired DATE NOT NULL,
  titd_idbatch VARCHAR(20),
  titd_nourut INT(11) NOT NULL,
  KEY idx_titd_nomor (titd_titip_nomor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Trigger insert: stok IN di gudang konsinyasi ──────────────────────
DROP TRIGGER IF EXISTS ttitip_dtl_after_insert;
CREATE TRIGGER ttitip_dtl_after_insert AFTER INSERT ON ttitip_dtl
FOR EACH ROW
BEGIN
  DECLARE agudang VARCHAR(10);
  DECLARE aavgcost, ahargabeli DOUBLE;
  DECLARE anum, aden DOUBLE;
  DECLARE atanggal DATE;

  SELECT titip_gdg_kode, titip_tanggal INTO agudang, atanggal
    FROM ttitip_hdr WHERE titip_nomor = NEW.titd_titip_nomor;

  -- Hargabeli terakhir dari penerimaan (RI/KOR) — paritas trigger DO
  SELECT IFNULL(mst_hargabeli, 0) INTO ahargabeli
    FROM tmasterstok
   WHERE mst_brg_kode = NEW.titd_brg_kode
     AND mst_hargabeli > 1
     AND (mst_noreferensi LIKE '%RI%' OR mst_noreferensi LIKE '%KOR%')
   ORDER BY mst_tanggal DESC LIMIT 1;

  -- Avgcost berjalan — paritas trigger DO
  SELECT IFNULL(SUM(IF(mst_avgcost > 0, mst_avgcost, mst_hargabeli) * (mst_stok_in - mst_stok_out)), 0),
         IFNULL(SUM(mst_stok_in - mst_stok_out), 0)
    INTO anum, aden
    FROM tmasterstok
   WHERE mst_brg_kode = NEW.titd_brg_kode
     AND mst_tanggal <= atanggal AND mst_tanggal > '2020/01/01';

  IF aden = 0 THEN
    SET aavgcost = ahargabeli;
  ELSE
    SET aavgcost = anum / aden;
  END IF;
  IF aavgcost IS NULL OR aavgcost <= 0 THEN
    SET aavgcost = ahargabeli;
  END IF;

  INSERT IGNORE INTO tmasterstok
    (mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
     mst_expired_date, mst_noreferensi, mst_hargabeli, mst_tanggal,
     mst_avgcost, mst_idbatch)
  VALUES
    (NEW.titd_brg_kode, agudang, NEW.titd_qty, 0,
     NEW.titd_tgl_expired, NEW.titd_titip_nomor, ahargabeli, atanggal,
     aavgcost, IFNULL(NEW.titd_idbatch, ''));

  UPDATE tbarang SET brg_stok = IFNULL(brg_stok, 0) + NEW.titd_qty
   WHERE brg_kode = NEW.titd_brg_kode;
END;

-- ── Trigger delete: hapus entri stok by noreferensi ───────────────────
DROP TRIGGER IF EXISTS ttitip_dtl_after_delete;
CREATE TRIGGER ttitip_dtl_after_delete AFTER DELETE ON ttitip_dtl
FOR EACH ROW
BEGIN
  DELETE FROM tmasterstok
   WHERE mst_brg_kode = OLD.titd_brg_kode
     AND mst_expired_date = OLD.titd_tgl_expired
     AND mst_noreferensi = OLD.titd_titip_nomor;

  UPDATE tbarang SET brg_stok = IFNULL(brg_stok, 0) - OLD.titd_qty
   WHERE brg_kode = OLD.titd_brg_kode;
END;
