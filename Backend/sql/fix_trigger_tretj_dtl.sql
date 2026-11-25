-- sql/fix_trigger_tretj_dtl.sql
-- Fix: "Column 'mst_hargabeli' cannot be null" saat Simpan Retur Penjualan.
--
-- Penyebab:
--   Trigger lama (tretj_dtl_after_insert) mencari harga beli HANYA lewat
--   tfp_hdr.fp_do_nomor. Untuk model FP -> SO, satu SO bisa punya banyak DO
--   dan fp_do_nomor bisa menunjuk DO yang tidak memuat barang tsb (mis. DO
--   tanpa detail stok). Bila SELECT tidak menemukan baris, variabel
--   ahargabeli tetap NULL -> INSERT ke tmasterstok gagal karena kolom
--   mst_hargabeli NOT NULL.
--   Catatan: file fix sebelumnya (tretj_dtl_ai) tidak pernah menimpa trigger
--   live yang bernama tretj_dtl_after_insert, sehingga error tetap muncul.
--
-- Perbaikan:
--   1) Cari HPP dari DO milik SO (semua DO, bukan hanya fp_do_nomor),
--      pilih DO terakhir yang memuat barang tsb.
--   2) Fallback: DO langsung di header FP.
--   3) Fallback: harga beli terakhir barang di tmasterstok.
--   4) Fallback: tbarang.brg_hrgbeli, lalu 0 (jangan pernah NULL).
--   5) Expired kosong diseragamkan ke 1899-12-30 (konvensi sistem),
--      mst_idbatch ikut disimpan.
--
-- Eksekusi manual berurutan (DROP lalu CREATE). Berlaku untuk semua DB cabang.

DELIMITER $$

DROP TRIGGER IF EXISTS tretj_dtl_ai $$
DROP TRIGGER IF EXISTS tretj_dtl_ad $$
DROP TRIGGER IF EXISTS tretj_dtl_after_insert $$
DROP TRIGGER IF EXISTS tretj_dtl_after_delete $$

-- ============================================================
-- AFTER INSERT
-- ============================================================
CREATE TRIGGER tretj_dtl_after_insert AFTER INSERT ON tretj_dtl
FOR EACH ROW
BEGIN
  DECLARE agudang VARCHAR(10);
  DECLARE aso VARCHAR(30) DEFAULT '';
  DECLARE adonomor VARCHAR(20) DEFAULT '';
  DECLARE ahargabeli DOUBLE DEFAULT NULL;
  DECLARE atanggal DATE;
  DECLARE aexpired DATE;
  DECLARE abatch VARCHAR(30);

  SELECT retj_gdg_kode, IFNULL(fp_so_nomor, ''), IFNULL(fp_do_nomor, ''), retj_tanggal
    INTO agudang, aso, adonomor, atanggal
    FROM tretj_hdr
    INNER JOIN tfp_hdr ON retj_fp_nomor = fp_nomor
    WHERE retj_nomor = NEW.retjd_retj_nomor;

  SET aexpired = IF(NEW.retjd_expired IS NULL OR YEAR(NEW.retjd_expired) < 1900,
                    '1899-12-30', NEW.retjd_expired);
  SET abatch = IFNULL(NEW.retjd_idbatch, '');

  -- 1. HPP dari DO milik SO (1 SO bisa banyak DO), DO terakhir yang memuat barang.
  IF aso <> '' THEN
    SELECT m.mst_hargabeli INTO ahargabeli
      FROM tmasterstok m
      INNER JOIN tdo_hdr do ON do.do_nomor = m.mst_noreferensi
      INNER JOIN tdo_dtl d ON d.dod_do_nomor = do.do_nomor
                          AND d.dod_brg_kode = NEW.retjd_brg_kode
      WHERE do.do_so_nomor = aso
        AND m.mst_brg_kode = NEW.retjd_brg_kode
        AND IFNULL(m.mst_stok_out, 0) > 0
        AND (abatch = '' OR m.mst_idbatch = abatch OR m.mst_expired_date = aexpired)
      ORDER BY do.do_tanggal DESC, do.do_nomor DESC
      LIMIT 1;
  END IF;

  -- 2. Fallback: DO langsung di header FP (FP lama, non SO-based).
  IF (ahargabeli IS NULL OR ahargabeli <= 0) AND adonomor <> '' THEN
    SELECT mst_hargabeli INTO ahargabeli
      FROM tmasterstok
      WHERE mst_brg_kode = NEW.retjd_brg_kode
        AND mst_noreferensi = adonomor
        AND IFNULL(mst_stok_out, 0) > 0
      ORDER BY mst_tanggal DESC
      LIMIT 1;
  END IF;

  -- 3. Fallback: harga beli terakhir barang.
  IF ahargabeli IS NULL OR ahargabeli <= 0 THEN
    SELECT IFNULL(mst_hargabeli, IFNULL(mst_avgcost, 0)) INTO ahargabeli
      FROM tmasterstok
      WHERE mst_brg_kode = NEW.retjd_brg_kode
        AND IFNULL(mst_hargabeli, 0) > 0
      ORDER BY mst_tanggal DESC
      LIMIT 1;
  END IF;

  -- 4. Fallback: harga beli master barang.
  IF ahargabeli IS NULL OR ahargabeli <= 0 THEN
    SELECT IFNULL(brg_hrgbeli, 0) INTO ahargabeli
      FROM tbarang WHERE brg_kode = NEW.retjd_brg_kode;
  END IF;

  -- Jangan pernah NULL (kolom NOT NULL).
  SET ahargabeli = IFNULL(ahargabeli, 0);

  INSERT INTO tmasterstok
    (mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
     mst_expired_date, mst_noreferensi, mst_hargabeli, mst_tanggal, mst_idbatch)
  VALUES
    (NEW.retjd_brg_kode, agudang, NEW.retjd_qty, 0,
     aexpired, NEW.retjd_retj_nomor, ahargabeli, atanggal, abatch);

  UPDATE tbarang SET brg_stok = brg_stok + NEW.retjd_qty
    WHERE brg_kode = NEW.retjd_brg_kode;
END $$

-- ============================================================
-- AFTER DELETE
-- ============================================================
CREATE TRIGGER tretj_dtl_after_delete AFTER DELETE ON tretj_dtl
FOR EACH ROW
BEGIN
  DECLARE aexpired DATE;

  SET aexpired = IF(OLD.retjd_expired IS NULL OR YEAR(OLD.retjd_expired) < 1900,
                    '1899-12-30', OLD.retjd_expired);

  DELETE FROM tmasterstok
    WHERE mst_brg_kode = OLD.retjd_brg_kode
      AND mst_noreferensi = OLD.retjd_retj_nomor
      AND (mst_expired_date = aexpired OR mst_expired_date IS NULL)
      AND (IFNULL(OLD.retjd_idbatch, '') = '' OR mst_idbatch = OLD.retjd_idbatch);

  UPDATE tbarang SET brg_stok = brg_stok - OLD.retjd_qty
    WHERE brg_kode = OLD.retjd_brg_kode;
END $$

DELIMITER ;
