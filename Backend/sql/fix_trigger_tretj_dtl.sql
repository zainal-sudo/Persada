-- sql/fix_trigger_tretj_dtl.sql
-- Perbaikan trigger retur penjualan (tretj_dtl) untuk model FP → SO.
--
-- Perubahan:
--  1. Hargabeli retur diambil dari DO TERAKHIR milik SO (1 SO = banyak DO),
--     fallback DO langsung utk FP lama yang masih pakai fp_do_nomor.
--  2. Expired kosong (FP SO-based, tanpa batch) diseragamkan ke 1899-12-30
--     supaya konsisten dgn konvensi sistem & query stok.
--  3. HPP retur tersimpan di tmasterstok (mst_hargabeli) — dipakai laporan
--     List Jual Per Item di blok retur.
--
-- NOTE: eksekusi manual berurutan: DROP lalu CREATE per trigger.
-- Sesuaikan nama trigger aktual di DB bila berbeda (SHOW TRIGGERS).

-- ============================================================
-- AFTER INSERT
-- ============================================================
DROP TRIGGER IF EXISTS tretj_dtl_ai;

CREATE TRIGGER tretj_dtl_ai AFTER INSERT ON tretj_dtl
FOR EACH ROW
BEGIN
  DECLARE agudang VARCHAR(10);
  DECLARE aso VARCHAR(30);
  DECLARE adonomor VARCHAR(20);
  DECLARE ahargabeli DOUBLE;
  DECLARE atanggal DATE;
  DECLARE aexpired DATE;

  SELECT retj_gdg_kode, COALESCE(fp_so_nomor, ''), COALESCE(fp_do_nomor, ''), retj_tanggal
    INTO agudang, aso, adonomor, atanggal
    FROM tretj_hdr
    INNER JOIN tfp_hdr ON retj_fp_nomor = fp_nomor
    WHERE retj_nomor = new.retjd_retj_nomor;

  -- Seragamkan expired kosong ke 1899-12-30 (konvensi sistem)
  SET aexpired = IF(IFNULL(new.retjd_expired, '') = '' OR YEAR(new.retjd_expired) < 1900,
                    '1899-12-30', new.retjd_expired);

  -- Hargabeli: DO TERAKHIR milik SO (FP SO-based)
  IF aso <> '' THEN
    SELECT m.mst_hargabeli INTO ahargabeli
      FROM tmasterstok m
      INNER JOIN (
        SELECT do.do_nomor FROM tdo_hdr do
        INNER JOIN tdo_dtl d ON d.dod_do_nomor = do.do_nomor
        WHERE do.do_so_nomor = aso AND d.dod_brg_kode = new.retjd_brg_kode
        ORDER BY do.do_tanggal DESC, do.do_nomor DESC LIMIT 1
      ) ld ON m.mst_noreferensi = ld.do_nomor
      WHERE m.mst_brg_kode = new.retjd_brg_kode
        AND (aexpired = '1899-12-30' OR m.mst_expired_date = aexpired)
      LIMIT 1;
  -- Fallback: FP lama terikat DO langsung (paritas Delphi)
  ELSEIF adonomor <> '' THEN
    SELECT mst_hargabeli INTO ahargabeli
      FROM tmasterstok
      WHERE mst_brg_kode = new.retjd_brg_kode
        AND mst_noreferensi = adonomor
        AND (aexpired = '1899-12-30' OR mst_expired_date = aexpired)
      LIMIT 1;
  END IF;

  INSERT INTO tmasterstok
    (mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
     mst_expired_date, mst_noreferensi, mst_hargabeli, mst_tanggal)
  VALUES
    (new.retjd_brg_kode, agudang, new.retjd_qty, 0,
     aexpired, new.retjd_retj_nomor, IFNULL(ahargabeli, 0), atanggal);

  UPDATE tbarang SET brg_stok = brg_stok + new.retjd_qty
    WHERE brg_kode = new.retjd_brg_kode;
END;

-- ============================================================
-- AFTER DELETE
-- ============================================================
DROP TRIGGER IF EXISTS tretj_dtl_ad;

CREATE TRIGGER tretj_dtl_ad AFTER DELETE ON tretj_dtl
FOR EACH ROW
BEGIN
  DECLARE aexpired DATE;

  SET aexpired = IF(IFNULL(old.retjd_expired, '') = '' OR YEAR(old.retjd_expired) < 1900,
                    '1899-12-30', old.retjd_expired);

  DELETE FROM tmasterstok
    WHERE mst_brg_kode = old.retjd_brg_kode
      AND mst_expired_date = aexpired
      AND mst_noreferensi = old.retjd_retj_nomor;

  UPDATE tbarang SET brg_stok = brg_stok - old.retjd_qty
    WHERE brg_kode = old.retjd_brg_kode;
END;