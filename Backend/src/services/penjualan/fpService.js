// services/penjualan/fpService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.fp_nomor AS Nomor,
       h.fp_so_nomor AS SO_Nomor,
       DATE_FORMAT(h.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(h.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(h.fp_memo, '') AS Memo,
       IF(h.fp_istax = 1, 'PPn', 'Non Ppn') AS Tax,
       IFNULL(s.sla_nama, '') AS Salesman,
       IFNULL(c.cus_kode, '') AS Kode_Cust,
       IFNULL(c.cus_nama, '') AS Customer,
       IFNULL(h.fp_amount, 0) AS Total,
       IFNULL(h.fp_taxamount, 0) AS Ppn,
       IFNULL((SELECT SUM(r.retj_amount) FROM tretj_hdr r WHERE r.retj_fp_nomor = h.fp_nomor), 0) AS Retur,
       ROUND(((h.fp_disc_fakturpr * (((h.fp_amount - h.fp_taxamount) + h.fp_disc_faktur) / (100 - h.fp_disc_fakturpr) * 100)) / 100) + h.fp_disc_faktur, 2) AS Disc_Faktur,
       ROUND(((h.fp_biayapr * (h.fp_amount - h.fp_taxamount - IFNULL((SELECT SUM(r.retj_amount) FROM tretj_hdr r WHERE r.retj_fp_nomor = h.fp_nomor), 0))) / 100) + h.fp_biayarp, 2) AS Biaya_Promosi,
       IFNULL(h.fp_cn, 0) AS Kontrak,
       IFNULL(h.fp_freight, 0) AS Freight,
       IFNULL(h.fp_bayar, 0) AS Bayar,
       IF(h.fp_isbayar = 0, 'Belum', 'Sudah') AS Status_Bayar,
       IFNULL(h.fp_iskembali, 0) AS Kembali,
       IF((SELECT COUNT(*) FROM tjatuhtempofp j WHERE j.jt_fp_nomor = h.fp_nomor) > 0, 'Angsur', '') AS Keterangan,
       IFNULL(h.fp_status_faktur, '') AS Status_Faktur,
       IF(h.fp_iscetak = 1, 'Sudah', 'Belum') AS Status_Cetak,
       IF(h.fp_tipecash = 1, 'Cash', 'Non Cash') AS Tipe,
       IF(h.fp_isDTP = 1, 'Ya', 'Tidak') AS DTP,
       IF(h.fp_iscatalog = 1, 'Ya', 'Tidak') AS IsCatalog
     FROM tfp_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
     LEFT JOIN tso_hdr so ON so.so_nomor = h.fp_so_nomor
     LEFT JOIN tsalesmanaktif s ON s.sla_kode = so.so_sla_kode
     WHERE h.fp_tanggal BETWEEN ? AND ?
     GROUP BY h.fp_nomor, h.fp_tanggal, h.fp_memo, c.cus_nama
     ORDER BY h.fp_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.fpd_fp_nomor AS Nomor,
       d.fpd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.fpd_brg_satuan AS Satuan,
       d.fpd_qty AS Jumlah,
       d.fpd_harga AS Harga,
       d.fpd_discpr AS Disc,
       ROUND(d.fpd_harga * d.fpd_qty * (100 - IFNULL(d.fpd_discpr, 0)) / 100, 2) AS Nilai,
       IFNULL(d.fpd_cn, 0) AS Kontrak,
       DATE_FORMAT(d.fpd_expired, '%Y-%m-%d') AS ED,
       IFNULL(d.fpd_idbatch, '') AS Batch
     FROM tfp_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE d.fpd_fp_nomor = ?
       AND d.fpd_qty > 0
     ORDER BY d.fpd_nourut ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[fp]] = await db.query(
    `SELECT fp_iscetak, fp_isbayar, COALESCE(fp_so_nomor, '') AS soNomor
     FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!fp) throw new Error("Data FP tidak ditemukan.");
  if (Number(fp.fp_iscetak) === 1) throw new Error("FP sudah dicetak. Tidak bisa dihapus.");
  if (Number(fp.fp_isbayar) === 1) throw new Error("FP sudah dibayar. Tidak bisa dihapus.");

  const [dtl] = await db.query(
    `SELECT fpd_brg_kode AS brgKode, fpd_qty AS qty FROM tfp_dtl WHERE fpd_fp_nomor = ?`,
    [nomor]
  );

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tfp_dtl WHERE fpd_fp_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tfp_hdr WHERE fp_nomor = ?`, [nomor]);

    // Kembalikan qty ter-invoice & buka SO untuk bisa di-invoice ulang
    if (fp.soNomor) {
      for (const d of dtl || []) {
        await conn.query(
          `UPDATE tso_dtl SET sod_qty_invoice = GREATEST(0, sod_qty_invoice - ?)
           WHERE sod_so_nomor = ? AND sod_brg_kode = ?`,
          [Number(d.qty) || 0, fp.soNomor, d.brgKode]
        );
      }
      await conn.query(`UPDATE tso_hdr SET so_isinvoice = 0 WHERE so_nomor = ?`, [fp.soNomor]);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data print (slip FP / Faktur Penjualan) ──────────────────────────
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      h.fp_nomor        AS nomor,
      DATE_FORMAT(h.fp_tanggal, '%d/%m/%Y') AS tanggal,
      DATE_FORMAT(h.fp_jthtempo, '%d/%m/%Y') AS jthtempo,
      IFNULL(h.fp_memo, '') AS memo,
      IFNULL(h.fp_amount, 0) AS amount,
      IFNULL(h.fp_taxamount, 0) AS taxamount,
      IFNULL(h.fp_freight, 0) AS freight,
      IFNULL(h.fp_dp, 0) AS dp,
      IFNULL(h.fp_disc_faktur, 0) AS disc_faktur,
      IFNULL(h.fp_disc_fakturpr, 0) AS disc_fakturpr,
      IFNULL(c.cus_nama, '') AS cus_nama,
      IFNULL(c.cus_alamat, '') AS cus_alamat,
      IFNULL(s.sla_nama, '') AS salesman,
      IF(h.fp_istax = 1, 1, 0) AS istax,
      IFNULL(c.cus_top, 0) AS cus_top
    FROM tfp_hdr h
    INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
    LEFT JOIN tso_hdr so ON so.so_nomor = h.fp_so_nomor
    LEFT JOIN tsalesmanaktif s ON s.sla_kode = so.so_sla_kode
    WHERE h.fp_nomor = ?
    `,
    [nomor]
  );
  if (!header) throw new Error("Data FP tidak ditemukan.");

  // Detail FP. Catatan: fpd_expired diformat "%m.%Y" (titik) untuk paritas
  // slip doslip2/doslip4 — jangan pakai "%m/%Y".
  // Komentar harus DI LUAR template literal; "//" di dalam backtick
  // ikut terkirim ke MariaDB dan menggagalkan parsing.
  const [detail] = await db.query(
    `
    SELECT
      IFNULL(d.fpd_nourut, 0) AS nourut,
      d.fpd_brg_kode    AS kode,
      IFNULL(b.brg_nama, '') AS nama,
      IFNULL(d.fpd_brg_satuan, '') AS satuan,
      IFNULL(d.fpd_qty, 0) AS qty,
      IFNULL(d.fpd_harga, 0) AS harga,
      IFNULL(d.fpd_discpr, 0) AS discpr,
      DATE_FORMAT(d.fpd_expired, '%m.%Y') AS expired
    FROM tfp_dtl d
    INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
    WHERE d.fpd_fp_nomor = ?
    ORDER BY d.fpd_nourut ASC
    `,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp, perush_npwp, perush_pak, perush_pj, perush_pj_no, perush_rekening
     FROM tperusahaan LIMIT 1`
  );

  // Hitung nett (seperti di Delphi)
  const anilai = header.amount - header.taxamount - header.freight;
  const nett = ((header.amount - header.taxamount) + header.disc_faktur) / (100 - header.disc_fakturpr) * 100;
  const adiscfaktur = ((header.disc_fakturpr * nett) / 100) + header.disc_faktur;
  const atotal = header.amount;

  // Terbilang via SQL (mirip Delphi: terbilang(fp_amount))
  let terbilangText = '';
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [header.amount]);
    terbilangText = terb?.t || '';
  } catch {
    terbilangText = '';
  }

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    jthtempo: header.jthtempo,
    memo: header.memo,
    amount: header.amount,
    taxamount: header.taxamount,
    freight: header.freight,
    dp: header.dp,
    disc_faktur: header.disc_faktur,
    disc_fakturpr: header.disc_fakturpr,
    anilai,
    adiscfaktur,
    atotal,
    istax: header.istax,
    cus_top: header.cus_top,
    terbilang: terbilangText,
    cus_nama: header.cus_nama,
    cus_alamat: header.cus_alamat,
    salesman: header.salesman,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      kota: perusahaan.perush_kota,
      notelp: perusahaan.perush_NOtelp,
      npwp: perusahaan.perush_npwp,
      pak: perusahaan.perush_pak,
      pj: perusahaan.perush_pj,
      pj_no: perusahaan.perush_pj_no,
    } : { nama: '', alamat: '', kota: '', notelp: '', npwp: '', pak: '', pj: '', pj_no: '' },
    rekening: perusahaan?.perush_rekening || '',
    detail,
  };
};

const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

// ── Tandai FP sudah cetak (paritas Delphi doslip*: set fp_iscetak + cekcetak) ──
const setPrinted = async (nomor) => {
  const [[fp]] = await db.query(
    `SELECT fp_iscetak FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!fp) throw new Error("Data FP tidak ditemukan.");
  const wasPrinted = Number(fp.fp_iscetak) === 1;
  if (!wasPrinted) {
    await db.query(`UPDATE tfp_hdr SET fp_iscetak = 1 WHERE fp_nomor = ?`, [nomor]);
  }
  return { wasPrinted };
};

// ── Toggle status Kembali (paritas Delphi UpdateStatusKembali1Click) ──
const toggleKembali = async (nomor) => {
  const [[fp]] = await db.query(
    `SELECT fp_iskembali FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!fp) throw new Error("Data FP tidak ditemukan.");

  const newStatus = Number(fp.fp_iskembali) === 0 ? 1 : 0;
  await db.query(
    `UPDATE tfp_hdr SET fp_iskembali = ? WHERE fp_nomor = ?`,
    [newStatus, nomor]
  );
  return { kembali: newStatus === 1 };
};

// ── Toggle status Bayar (paritas UpdateStatusPembayaran1Click) ───────
// Delphi: hanya berlaku bila user = FINANCE (KDUSER).
const toggleBayar = async (nomor, userKode) => {
  if (String(userKode || "").toUpperCase() !== "FINANCE") {
    throw new Error("Hanya user FINANCE yang dapat mengubah status pembayaran.");
  }
  const [[fp]] = await db.query(
    `SELECT fp_isbayar FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!fp) throw new Error("Data FP tidak ditemukan.");

  const newStatus = Number(fp.fp_isbayar) === 0 ? 1 : 0;
  await db.query(
    `UPDATE tfp_hdr SET fp_isbayar = ? WHERE fp_nomor = ?`,
    [newStatus, nomor]
  );
  return { bayar: newStatus === 1 };
};

// ── History pembayaran FP (paritas HistoryPembayaran1Click) ──────────
const getHistoryBayar = async (nomorFP) => {
  const [rows] = await db.query(
    `SELECT bycd_byc_nomor AS Nomor,
            DATE_FORMAT(byc_tanggal, '%Y-%m-%d') AS Tanggal,
            bycd_fp_nomor AS NomorFP,
            bycd_bayar AS Bayar
     FROM tbayarcus_dtl
     INNER JOIN tfp_hdr ON bycd_fp_nomor = fp_nomor
     INNER JOIN tbayarcus_hdr ON bycd_byc_nomor = byc_nomor
     WHERE bycd_fp_nomor = ?
     ORDER BY byc_tanggal ASC`,
    [nomorFP]
  );
  return rows;
};

// ── Data print "Cetak V RET" (paritas doslip4: faktur dikoreksi retur) ──
// Detail baris = fpd_qty - retjd_qty (baris <= 0 dilewati);
// anilai  = fp_amount - (retj_amount - retj_taxamount) - fp_taxamount - fp_freight
// appn    = fp_taxamount - retj_taxamount
// atotal  = fp_amount - retj_amount
// terbilang atas (fp_amount - retj_amount)
const getPrintDataRetur = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      h.fp_nomor        AS nomor,
      DATE_FORMAT(h.fp_tanggal, '%d/%m/%Y') AS tanggal,
      DATE_FORMAT(h.fp_jthtempo, '%d/%m/%Y') AS jthtempo,
      IFNULL(h.fp_memo, '') AS memo,
      IFNULL(h.fp_amount, 0) AS amount,
      IFNULL(h.fp_taxamount, 0) AS taxamount,
      IFNULL(h.fp_freight, 0) AS freight,
      IFNULL((SELECT SUM(r.retj_amount) FROM tretj_hdr r WHERE r.retj_fp_nomor = h.fp_nomor), 0) AS retj_amount,
      IFNULL((SELECT SUM(r.retj_taxamount) FROM tretj_hdr r WHERE r.retj_fp_nomor = h.fp_nomor), 0) AS retj_taxamount,
      IFNULL(c.cus_nama, '') AS cus_nama,
      IFNULL(c.cus_alamat, '') AS cus_alamat,
      IFNULL(s.sla_nama, '') AS salesman
    FROM tfp_hdr h
    INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
    LEFT JOIN tso_hdr so ON so.so_nomor = h.fp_so_nomor
    LEFT JOIN tsalesmanaktif s ON s.sla_kode = so.so_sla_kode
    WHERE h.fp_nomor = ?
    `,
    [nomor]
  );
  if (!header) throw new Error("Data FP tidak ditemukan.");

  // Paritas doslip4: LEFT JOIN tretj_hdr + tretj_dtl per brg + expired.
  // fpd_expired diformat "%m.%Y" (titik) — sama seperti getPrintData di atas.
  // Komentar harus DI LUAR template literal; "//" di dalam backtick ikut
  // terkirim ke MariaDB dan menggagalkan parsing.
  const [detail] = await db.query(
    `
    SELECT
      IFNULL(d.fpd_nourut, 0) AS nourut,
      d.fpd_brg_kode    AS kode,
      IFNULL(b.brg_nama, '') AS nama,
      IFNULL(d.fpd_brg_satuan, '') AS satuan,
      d.fpd_qty - IFNULL(rd.retjd_qty, 0) AS qty,
      IFNULL(d.fpd_harga, 0) AS harga,
      IFNULL(d.fpd_discpr, 0) AS discpr,
      DATE_FORMAT(d.fpd_expired, '%m.%Y') AS expired
    FROM tfp_dtl d
    INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
    LEFT JOIN tretj_hdr rh ON rh.retj_fp_nomor = d.fpd_fp_nomor
    LEFT JOIN tretj_dtl rd ON rd.retjd_retj_nomor = rh.retj_nomor
      AND rd.retjd_brg_kode = d.fpd_brg_kode
      AND rd.retjd_expired = d.fpd_expired
    WHERE d.fpd_fp_nomor = ?
      AND (d.fpd_qty - IFNULL(rd.retjd_qty, 0)) > 0
    ORDER BY d.fpd_nourut ASC
    `,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp, perush_npwp, perush_pak, perush_pj, perush_pj_no, perush_rekening
     FROM tperusahaan LIMIT 1`
  );

  // Paritas doslip4: angka terkoreksi retur
  const amount = Number(header.amount);
  const taxamount = Number(header.taxamount);
  const freight = Number(header.freight);
  const retjAmount = Number(header.retj_amount);
  const retjTax = Number(header.retj_taxamount);

  const anilai = amount - (retjAmount - retjTax) - taxamount - freight;
  const appn = taxamount - retjTax;
  const atotal = amount - retjAmount;

  let terbilangText = '';
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [atotal]);
    terbilangText = terb?.t || '';
  } catch {
    terbilangText = '';
  }

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    jthtempo: header.jthtempo,
    memo: header.memo,
    amount,
    taxamount: appn,
    freight,
    anilai,
    atotal,
    terbilang: terbilangText,
    cus_nama: header.cus_nama,
    cus_alamat: header.cus_alamat,
    salesman: header.salesman,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      kota: perusahaan.perush_kota,
      notelp: perusahaan.perush_NOtelp,
      npwp: perusahaan.perush_npwp,
      pak: perusahaan.perush_pak,
      pj: perusahaan.perush_pj,
      pj_no: perusahaan.perush_pj_no,
    } : { nama: '', alamat: '', kota: '', notelp: '', npwp: '', pak: '', pj: '', pj_no: '' },
    rekening: perusahaan?.perush_rekening || '',
    detail,
  };
};

// ── Edit JT — load angsuran (paritas ufrmEditJT.loaddataall) ──────────
const getEditJt = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT h.fp_nomor AS nomor,
            DATE_FORMAT(h.fp_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(h.fp_amount, 0) AS amount,
            DATE_FORMAT(h.fp_jthtempo, '%Y-%m-%d') AS jthTempo,
            IFNULL(c.cus_nama, '') AS cusNama
     FROM tfp_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
     WHERE h.fp_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("FP tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT DATE_FORMAT(jt_tanggaljt, '%Y-%m-%d') AS tanggaljt,
            jt_nilai AS total
     FROM tjatuhtempofp
     WHERE jt_fp_nomor = ?
     ORDER BY jt_tanggaljt ASC`,
    [nomor]
  );

  return { ...h, detail };
};

// ── Cek periode ditutup (untuk save Edit JT) ─────────────────────────
const cekTutupPeriode = async (tanggal) => {
  const d = new Date(tanggal);
  const [[row]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [d.getMonth() + 1, d.getFullYear()]
  );
  return !!row;
};

// ── Edit JT — simpan angsuran (paritas ufrmEditJT.simpandata) ────────
// Validasi: selisih |sum angsuran - fp_amount| <= 100, baris total > 0,
// delete-then-insert dalam satu transaksi.
const saveEditJt = async (nomor, detail) => {
  const [[h]] = await db.query(
    `SELECT fp_nomor, fp_amount, fp_tanggal FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("FP tidak ditemukan.");

  if (await cekTutupPeriode(h.fp_tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }

  const totalAngsuran = (detail || []).reduce((s, d) => s + Number(d.total || 0), 0);
  const selisih = totalAngsuran - Number(h.fp_amount);
  if (selisih > 100 || selisih < -100) {
    throw new Error("Total faktur dengan total angsurang selisih");
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tjatuhtempofp WHERE jt_fp_nomor = ?`, [nomor]);
    for (const d of detail || []) {
      if (Number(d.total) > 0) {
        await conn.query(
          `INSERT INTO tjatuhtempofp (jt_fp_nomor, jt_tanggaljt, jt_nilai) VALUES (?, ?, ?)`,
          [nomor, d.tanggaljt, d.total]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { nomor };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip, toggleKembali, toggleBayar, getHistoryBayar, getPrintDataRetur, getEditJt, saveEditJt, setPrinted };