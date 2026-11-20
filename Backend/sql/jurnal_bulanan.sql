USE AMPersada;

DROP PROCEDURE IF EXISTS sp_cek_bpb_terinvoice;

DELIMITER //

CREATE PROCEDURE sp_cek_bpb_terinvoice(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vBelum INT DEFAULT 0;

  IF pBulan < 1 OR pBulan > 12 OR pTahun < 2000 OR pTahun > 2100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bulan atau tahun tidak valid';
  END IF;

  SELECT COUNT(*) INTO vBelum
  FROM tbpb_hdr
  WHERE MONTH(bpb_tanggal) = pBulan
    AND YEAR(bpb_tanggal) = pTahun
    AND IFNULL(bpb_isinvoice, 0) <> 1;

  IF vBelum > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BPB pada periode ini belum semua ter-invoice';
  END IF;
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_inv;

DELIMITER //

CREATE PROCEDURE jurnal_inv(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vNomor VARCHAR(20);
  DECLARE vSubtotal DOUBLE DEFAULT 0;
  DECLARE vFreight DOUBLE DEFAULT 0;
  DECLARE vMaterai DOUBLE DEFAULT 0;
  DECLARE vPPN DOUBLE DEFAULT 0;
  DECLARE vPotongan DOUBLE DEFAULT 0;
  DECLARE vHutang DOUBLE DEFAULT 0;
  DECLARE vPersediaan DOUBLE DEFAULT 0;

  CALL sp_cek_bpb_terinvoice(pBulan, pTahun);

  SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));
  SET vNomor = CONCAT('J.INV.', LPAD(pBulan, 2, '0'), pTahun);

  SELECT
    IFNULL(SUM(x.total), 0),
    IFNULL(SUM(h.inv_freight), 0),
    IFNULL(SUM(h.inv_materai), 0),
    IFNULL(SUM(h.inv_taxamount), 0),
    IFNULL(SUM(h.inv_amount), 0)
  INTO vSubtotal, vFreight, vMaterai, vPPN, vHutang
  FROM tinv_hdr h
  LEFT JOIN (
    SELECT invd_inv_nomor, SUM(invd_qty * invd_harga * (100 - IFNULL(invd_discpr, 0)) / 100) AS total
    FROM tinv_dtl
    GROUP BY invd_inv_nomor
  ) x ON x.invd_inv_nomor = h.inv_nomor
  WHERE MONTH(h.inv_tanggal) = pBulan
    AND YEAR(h.inv_tanggal) = pTahun;

  SET vPersediaan = vSubtotal + vFreight;
  SET vPotongan = vSubtotal + vFreight + vMaterai + vPPN - vHutang;

  DELETE FROM tjurnalitem WHERE jurd_jur_no = vNomor;
  DELETE FROM tjurnal WHERE jur_no = vNomor;

  INSERT INTO tjurnal
    (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
  VALUES
    (vNomor, vTanggal, 'Jurnal INV', CONCAT('otomatis ', LPAD(pBulan, 2, '0'), '/', pTahun), 1, NOW(), 'Admin');

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.001', vPersediaan, 0, 1);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '16.001', vPPN, 0, 2);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '23.019', vMaterai, 0, 3);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '21.005', 0, vPotongan, 4);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '19.002', 0, vHutang, 5);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_koreksi;

DELIMITER //

CREATE PROCEDURE jurnal_koreksi(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vNomor VARCHAR(20);
  DECLARE vNilai DOUBLE DEFAULT 0;

  CALL sp_cek_bpb_terinvoice(pBulan, pTahun);

  SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));
  SET vNomor = CONCAT('J.KOR.', LPAD(pBulan, 2, '0'), pTahun);

  SELECT IFNULL(SUM((m.mst_stok_out - m.mst_stok_in) * IF(IFNULL(m.mst_avgcost, 0) > 0, m.mst_avgcost, IFNULL(m.mst_hargabeli, 0))), 0)
  INTO vNilai
  FROM tmasterstok m
  INNER JOIN tkor_hdr h ON h.korh_nomor = m.mst_noreferensi
  WHERE MONTH(h.korh_tanggal) = pBulan
    AND YEAR(h.korh_tanggal) = pTahun;

  DELETE FROM tjurnalitem WHERE jurd_jur_no = vNomor;
  DELETE FROM tjurnal WHERE jur_no = vNomor;

  INSERT INTO tjurnal
    (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
  VALUES
    (vNomor, vTanggal, 'Jurnal Koreksi Stok', CONCAT('otomatis ', LPAD(pBulan, 2, '0'), '/', pTahun), 1, NOW(), 'Admin');

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.001', vNilai, 0, 1);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '23.016', 0, vNilai, 2);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_pemusnahan;

DELIMITER //

CREATE PROCEDURE jurnal_pemusnahan(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vNomor VARCHAR(20);
  DECLARE vNilai DOUBLE DEFAULT 0;

  CALL sp_cek_bpb_terinvoice(pBulan, pTahun);

  SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));
  SET vNomor = CONCAT('J.MUS.', LPAD(pBulan, 2, '0'), pTahun);

  SELECT IFNULL(SUM(m.mst_hargabeli * m.mst_stok_out), 0)
  INTO vNilai
  FROM tmasterstok m
  INNER JOIN tmus_hdr h ON h.mus_nomor = m.mst_noreferensi
  WHERE MONTH(h.mus_tanggal) = pBulan
    AND YEAR(h.mus_tanggal) = pTahun
    AND m.mst_stok_out > 0;

  DELETE FROM tjurnalitem WHERE jurd_jur_no = vNomor;
  DELETE FROM tjurnal WHERE jur_no = vNomor;

  INSERT INTO tjurnal
    (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
  VALUES
    (vNomor, vTanggal, 'Jurnal Pemusnahan', CONCAT('otomatis ', LPAD(pBulan, 2, '0'), '/', pTahun), 1, NOW(), 'Admin');

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '23.044', vNilai, 0, 1);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.001', 0, vNilai, 2);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_do;

DELIMITER //

CREATE PROCEDURE jurnal_do(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vNomor VARCHAR(20);
  DECLARE vNilai DOUBLE DEFAULT 0;

  CALL sp_cek_bpb_terinvoice(pBulan, pTahun);

  SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));
  SET vNomor = CONCAT('J.DO.', LPAD(pBulan, 2, '0'), pTahun);

  SELECT IFNULL(SUM(m.mst_stok_out * IF(IFNULL(m.mst_avgcost, 0) > 0, m.mst_avgcost, IFNULL(m.mst_hargabeli, 0))), 0)
  INTO vNilai
  FROM tmasterstok m
  INNER JOIN tdo_hdr d ON d.do_nomor = m.mst_noreferensi
  WHERE MONTH(d.do_tanggal) = pBulan
    AND YEAR(d.do_tanggal) = pTahun
    AND m.mst_stok_out > 0;

  DELETE FROM tjurnalitem WHERE jurd_jur_no = vNomor;
  DELETE FROM tjurnal WHERE jur_no = vNomor;

  INSERT INTO tjurnal
    (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
  VALUES
    (vNomor, vTanggal, 'Jurnal DO', CONCAT('otomatis ', LPAD(pBulan, 2, '0'), '/', pTahun), 1, NOW(), 'Admin');

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.002', vNilai, 0, 1);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.001', 0, vNilai, 2);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_fp;

DELIMITER //

CREATE PROCEDURE jurnal_fp(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vNomor VARCHAR(20);
  DECLARE vPiutang DOUBLE DEFAULT 0;
  DECLARE vPenjualan DOUBLE DEFAULT 0;
  DECLARE vPotongan DOUBLE DEFAULT 0;
  DECLARE vPPN DOUBLE DEFAULT 0;
  DECLARE vFreight DOUBLE DEFAULT 0;
  DECLARE vHPP DOUBLE DEFAULT 0;

  CALL sp_cek_bpb_terinvoice(pBulan, pTahun);

  SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));
  SET vNomor = CONCAT('J.FP.', LPAD(pBulan, 2, '0'), pTahun);

  SELECT
    IFNULL(SUM(x.penjualan), 0),
    IFNULL(SUM((IFNULL(x.disc_fakturpr, 0) * x.penjualan / 100) + IFNULL(x.disc_faktur, 0)), 0),
    IFNULL(SUM(x.taxamount), 0),
    IFNULL(SUM(x.freight), 0),
    IFNULL(SUM(x.amount), 0)
  INTO vPenjualan, vPotongan, vPPN, vFreight, vPiutang
  FROM (
    SELECT
      h.fp_nomor,
      IFNULL(h.fp_disc_fakturpr, 0) AS disc_fakturpr,
      IFNULL(h.fp_disc_faktur, 0) AS disc_faktur,
      IFNULL(h.fp_taxamount, 0) AS taxamount,
      IFNULL(h.fp_freight, 0) AS freight,
      IFNULL(h.fp_amount, 0) AS amount,
      (((IFNULL(h.fp_amount, 0) - IFNULL(h.fp_freight, 0) - IFNULL(h.fp_taxamount, 0)) + IFNULL(h.fp_disc_faktur, 0))
        / NULLIF(100 - IFNULL(h.fp_disc_fakturpr, 0), 0)) * 100 AS penjualan
    FROM tfp_hdr h
    WHERE MONTH(h.fp_tanggal) = pBulan
      AND YEAR(h.fp_tanggal) = pTahun
  ) x;

  SELECT IFNULL(SUM(d.fpd_hpp), 0)
  INTO vHPP
  FROM tfp_dtl d
  INNER JOIN tfp_hdr h ON h.fp_nomor = d.fpd_fp_nomor
  WHERE MONTH(h.fp_tanggal) = pBulan
    AND YEAR(h.fp_tanggal) = pTahun;

  DELETE FROM tjurnalitem WHERE jurd_jur_no = vNomor;
  DELETE FROM tjurnal WHERE jur_no = vNomor;

  INSERT INTO tjurnal
    (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
  VALUES
    (vNomor, vTanggal, 'Jurnal FP', CONCAT('otomatis ', LPAD(pBulan, 2, '0'), '/', pTahun), 1, NOW(), 'Admin');

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '14.001', vPiutang, 0, 1);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '21.004', vPotongan, 0, 2);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '21.001', 0, vPenjualan, 3);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '19.005', 0, vPPN, 4);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '23.008', 0, vFreight, 5);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '26.001', vHPP, 0, 6);

  INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_nourut)
  VALUES (vNomor, '17.002', 0, vHPP, 7);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS jurnal_bulanan;

DELIMITER //

CREATE PROCEDURE jurnal_bulanan(IN pBulan INT, IN pTahun INT)
BEGIN
  CALL jurnal_inv(pBulan, pTahun);
  CALL jurnal_koreksi(pBulan, pTahun);
  CALL jurnal_pemusnahan(pBulan, pTahun);
  CALL jurnal_do(pBulan, pTahun);
  CALL jurnal_fp(pBulan, pTahun);
END//

DELIMITER ;

DROP PROCEDURE IF EXISTS preview_jurnal_bulanan;

DELIMITER //

CREATE PROCEDURE preview_jurnal_bulanan(IN pBulan INT, IN pTahun INT)
BEGIN
  DECLARE vTanggal DATE;
  DECLARE vBisa INT DEFAULT 1;
  DECLARE vAlasan VARCHAR(250) DEFAULT '';
  DECLARE vBelum INT DEFAULT 0;
  DECLARE vInvSubtotal DOUBLE DEFAULT 0;
  DECLARE vInvFreight DOUBLE DEFAULT 0;
  DECLARE vInvMaterai DOUBLE DEFAULT 0;
  DECLARE vInvPPN DOUBLE DEFAULT 0;
  DECLARE vInvPotongan DOUBLE DEFAULT 0;
  DECLARE vInvHutang DOUBLE DEFAULT 0;
  DECLARE vInvPersediaan DOUBLE DEFAULT 0;
  DECLARE vKoreksi DOUBLE DEFAULT 0;
  DECLARE vMusnah DOUBLE DEFAULT 0;
  DECLARE vDo DOUBLE DEFAULT 0;
  DECLARE vFpPenjualan DOUBLE DEFAULT 0;
  DECLARE vFpPotongan DOUBLE DEFAULT 0;
  DECLARE vFpPPN DOUBLE DEFAULT 0;
  DECLARE vFpFreight DOUBLE DEFAULT 0;
  DECLARE vFpPiutang DOUBLE DEFAULT 0;
  DECLARE vFpHpp DOUBLE DEFAULT 0;

  IF pBulan < 1 OR pBulan > 12 OR pTahun < 2000 OR pTahun > 2100 THEN
    SET vBisa = 0;
    SET vAlasan = 'Bulan atau tahun tidak valid';
  ELSE
    SET vTanggal = LAST_DAY(STR_TO_DATE(CONCAT(LPAD(pBulan, 2, '0'), '/01/', pTahun), '%m/%d/%Y'));

    SELECT COUNT(*) INTO vBelum
    FROM tbpb_hdr
    WHERE MONTH(bpb_tanggal) = pBulan
      AND YEAR(bpb_tanggal) = pTahun
      AND IFNULL(bpb_isinvoice, 0) <> 1;

    IF vBelum > 0 THEN
      SET vBisa = 0;
      SET vAlasan = 'BPB pada periode ini belum semua ter-invoice';
    END IF;
  END IF;

  SELECT
    IFNULL(SUM(x.total), 0),
    IFNULL(SUM(h.inv_freight), 0),
    IFNULL(SUM(h.inv_materai), 0),
    IFNULL(SUM(h.inv_taxamount), 0),
    IFNULL(SUM(h.inv_amount), 0)
  INTO vInvSubtotal, vInvFreight, vInvMaterai, vInvPPN, vInvHutang
  FROM tinv_hdr h
  LEFT JOIN (
    SELECT invd_inv_nomor, SUM(invd_qty * invd_harga * (100 - IFNULL(invd_discpr, 0)) / 100) AS total
    FROM tinv_dtl
    GROUP BY invd_inv_nomor
  ) x ON x.invd_inv_nomor = h.inv_nomor
  WHERE MONTH(h.inv_tanggal) = pBulan
    AND YEAR(h.inv_tanggal) = pTahun;

  SET vInvPersediaan = vInvSubtotal + vInvFreight;
  SET vInvPotongan = vInvSubtotal + vInvFreight + vInvMaterai + vInvPPN - vInvHutang;

  SELECT IFNULL(SUM((m.mst_stok_out - m.mst_stok_in) * IF(IFNULL(m.mst_avgcost, 0) > 0, m.mst_avgcost, IFNULL(m.mst_hargabeli, 0))), 0)
  INTO vKoreksi
  FROM tmasterstok m
  INNER JOIN tkor_hdr h ON h.korh_nomor = m.mst_noreferensi
  WHERE MONTH(h.korh_tanggal) = pBulan
    AND YEAR(h.korh_tanggal) = pTahun;

  SELECT IFNULL(SUM(m.mst_hargabeli * m.mst_stok_out), 0)
  INTO vMusnah
  FROM tmasterstok m
  INNER JOIN tmus_hdr h ON h.mus_nomor = m.mst_noreferensi
  WHERE MONTH(h.mus_tanggal) = pBulan
    AND YEAR(h.mus_tanggal) = pTahun
    AND m.mst_stok_out > 0;

  SELECT IFNULL(SUM(m.mst_stok_out * IF(IFNULL(m.mst_avgcost, 0) > 0, m.mst_avgcost, IFNULL(m.mst_hargabeli, 0))), 0)
  INTO vDo
  FROM tmasterstok m
  INNER JOIN tdo_hdr d ON d.do_nomor = m.mst_noreferensi
  WHERE MONTH(d.do_tanggal) = pBulan
    AND YEAR(d.do_tanggal) = pTahun
    AND m.mst_stok_out > 0;

  SELECT
    IFNULL(SUM(x.penjualan), 0),
    IFNULL(SUM((IFNULL(x.disc_fakturpr, 0) * x.penjualan / 100) + IFNULL(x.disc_faktur, 0)), 0),
    IFNULL(SUM(x.taxamount), 0),
    IFNULL(SUM(x.freight), 0),
    IFNULL(SUM(x.amount), 0)
  INTO vFpPenjualan, vFpPotongan, vFpPPN, vFpFreight, vFpPiutang
  FROM (
    SELECT
      h.fp_nomor,
      IFNULL(h.fp_disc_fakturpr, 0) AS disc_fakturpr,
      IFNULL(h.fp_disc_faktur, 0) AS disc_faktur,
      IFNULL(h.fp_taxamount, 0) AS taxamount,
      IFNULL(h.fp_freight, 0) AS freight,
      IFNULL(h.fp_amount, 0) AS amount,
      (((IFNULL(h.fp_amount, 0) - IFNULL(h.fp_freight, 0) - IFNULL(h.fp_taxamount, 0)) + IFNULL(h.fp_disc_faktur, 0))
        / NULLIF(100 - IFNULL(h.fp_disc_fakturpr, 0), 0)) * 100 AS penjualan
    FROM tfp_hdr h
    WHERE MONTH(h.fp_tanggal) = pBulan
      AND YEAR(h.fp_tanggal) = pTahun
  ) x;

  SELECT IFNULL(SUM(d.fpd_hpp), 0)
  INTO vFpHpp
  FROM tfp_dtl d
  INNER JOIN tfp_hdr h ON h.fp_nomor = d.fpd_fp_nomor
  WHERE MONTH(h.fp_tanggal) = pBulan
    AND YEAR(h.fp_tanggal) = pTahun;

  SELECT 'INV' AS jenis,
         CONCAT('J.INV.', LPAD(pBulan, 2, '0'), pTahun) AS nomor,
         vTanggal AS tanggal,
         'Jurnal INV' AS keterangan,
          vInvPersediaan + vInvPPN + vInvMaterai AS total_debet,
          vInvHutang + vInvPotongan AS total_kredit,
         vBisa AS bisa_diposting,
         vAlasan AS alasan
  UNION ALL
  SELECT 'KOR', CONCAT('J.KOR.', LPAD(pBulan, 2, '0'), pTahun), vTanggal,
         'Jurnal Koreksi Stok', vKoreksi, vKoreksi, vBisa, vAlasan
  UNION ALL
  SELECT 'MUS', CONCAT('J.MUS.', LPAD(pBulan, 2, '0'), pTahun), vTanggal,
         'Jurnal Pemusnahan', vMusnah, vMusnah, vBisa, vAlasan
  UNION ALL
  SELECT 'DO', CONCAT('J.DO.', LPAD(pBulan, 2, '0'), pTahun), vTanggal,
         'Jurnal DO', vDo, vDo, vBisa, vAlasan
  UNION ALL
  SELECT 'FP', CONCAT('J.FP.', LPAD(pBulan, 2, '0'), pTahun), vTanggal,
         'Jurnal FP', vFpPiutang + vFpPotongan + vFpHpp,
          vFpPenjualan + vFpPPN + vFpFreight + vFpHpp, vBisa, vAlasan
  ORDER BY nomor;
END//

DELIMITER ;
