// services/transaksi/soService.js
const db = require("../../config/database");

/**
 * Browse SO — sesuai SQLMaster Delphi:
 * SELECT ... FROM tso_hdr
 * INNER JOIN tcustomer ON cus_kode = so_cus_kode
 * INNER JOIN tsalesmanaktif ON sla_kode = so_sla_kode
 * WHERE so_tanggal BETWEEN startDate AND endDate
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.so_nomor          AS Nomor,
       DATE_FORMAT(h.so_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.so_memo, '') AS Memo,
       IFNULL(c.cus_nama, '') AS Customer,
       IF(h.so_isclosed = 0, 'Belum', 'Sudah') AS Closed,
       IFNULL(h.so_amount, 0) AS Total,
       IFNULL(h.so_taxamount, 0) AS Ppn,
       IFNULL(s.sla_nama, '') AS Salesman,
       IF(h.so_iskirim = 0, 'Belum', 'Sudah') AS Kirim,
       IF(h.so_isecer = 0, 'Tidak', 'Ya') AS Eceran,
       IFNULL(h.user_create, '') AS User_create,
       DATE_FORMAT(h.date_create, '%Y-%m-%d %H:%i:%s') AS date_create
     FROM tso_hdr h
     INNER JOIN tcustomer c ON c.cus_kode = h.so_cus_kode
     INNER JOIN tsalesmanaktif s ON s.sla_kode = h.so_sla_kode
     WHERE h.so_tanggal BETWEEN ? AND ?
     GROUP BY h.so_nomor, h.so_tanggal, h.so_memo, c.cus_nama
     ORDER BY h.so_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail SO — sesuai SQLDetail Delphi:
 * SELECT ... FROM tso_dtl
 * INNER JOIN tso_hdr ON sod_so_nomor = so_nomor
 * INNER JOIN tbarang ON sod_brg_kode = brg_kode
 * WHERE so_tanggal BETWEEN startDate AND endDate
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.sod_so_nomor     AS Nomor,
       d.sod_brg_kode     AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(d.sod_brg_satuan, '') AS Satuan,
       IFNULL(d.sod_qty, 0) AS Jumlah,
       IFNULL(d.sod_harga, 0) AS Harga,
       IFNULL(d.sod_discpr, 0) AS Disc,
       ROUND(d.sod_harga * d.sod_qty * (100 - IFNULL(d.sod_discpr, 0)) / 100, 2) AS Nilai,
       IFNULL(d.sod_qty_kirim, 0) AS Terkirim
     FROM tso_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.sod_brg_kode
     WHERE d.sod_so_nomor = ?
     ORDER BY d.sod_nourut ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[so]] = await db.query(
    `SELECT so_isclosed, so_iskirim FROM tso_hdr WHERE so_nomor = ?`,
    [nomor]
  );
  if (!so) throw new Error("Data SO tidak ditemukan.");
  if (Number(so.so_isclosed) === 1) throw new Error("SO sudah closed. Tidak bisa dihapus.");
  if (Number(so.so_iskirim) === 1) throw new Error("SO sudah dikirim. Tidak bisa dihapus.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tso_dtl WHERE sod_so_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tso_hdr WHERE so_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data print (slip SO) ──────────────────────────────────────────────
const getPrintData = async (nomor) => {
  // 1. Header SO + Customer + Salesman
  const [[header]] = await db.query(
    `
    SELECT
      h.so_nomor        AS nomor,
      DATE_FORMAT(h.so_tanggal, '%d/%m/%Y') AS tanggal,
      IFNULL(h.so_memo, '') AS memo,
      IFNULL(h.so_shipaddress, '') AS shipaddress,
      IFNULL(h.so_amount, 0) AS amount,
      IFNULL(h.so_taxamount, 0) AS taxamount,
      IFNULL(h.so_dp, 0) AS dp,
      IFNULL(h.so_disc_faktur, 0) AS disc_faktur,
      IFNULL(h.so_disc_fakturpr, 0) AS disc_fakturpr,
      IFNULL(c.cus_nama, '') AS cus_nama,
      IFNULL(c.cus_alamat, '') AS cus_alamat,
      IFNULL(c.cus_telp, '') AS cus_telp,
      IFNULL(c.cus_fax, '') AS cus_fax,
      IFNULL(s.sla_nama, '') AS salesman
    FROM tso_hdr h
    INNER JOIN tcustomer c ON c.cus_kode = h.so_cus_kode
    LEFT JOIN tsalesmanaktif s ON s.sla_kode = h.so_sla_kode
    WHERE h.so_nomor = ?
    `,
    [nomor]
  );
  if (!header) throw new Error("Data SO tidak ditemukan.");

  // 2. Detail items
  const [detail] = await db.query(
    `
    SELECT
      d.sod_nourut      AS nourut,
      d.sod_brg_kode    AS kode,
      IFNULL(b.brg_nama, '') AS nama,
      IFNULL(d.sod_brg_satuan, '') AS satuan,
      IFNULL(d.sod_qty, 0) AS qty,
      IFNULL(d.sod_harga, 0) AS harga,
      IFNULL(d.sod_discpr, 0) AS discpr
    FROM tso_dtl d
    INNER JOIN tbarang b ON b.brg_kode = d.sod_brg_kode
    WHERE d.sod_so_nomor = ?
    ORDER BY d.sod_nourut ASC
    `,
    [nomor]
  );

  // 3. Company info
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  // 4. Hitung nilai & total
  const amount = Number(header.amount);
  const taxamount = Number(header.taxamount);
  const dp = Number(header.dp);
  const discFakturPr = Number(header.disc_fakturpr);

  const nett = discFakturPr > 0
    ? ((amount - taxamount) + Number(header.disc_faktur)) / (100 - discFakturPr) * 100
    : amount - taxamount;

  const discFaktur = (discFakturPr * nett) / 100 + Number(header.disc_faktur);
  const nilai = amount - taxamount;

  // Terbilang via SQL (sama seperti Delphi: terbilang(amount))
  let terbilangText = '';
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [amount]);
    terbilangText = terb?.t || '';
  } catch {
    terbilangText = '';
  }

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    memo: header.memo,
    shipaddress: header.shipaddress,
    amount,
    taxamount,
    dp,
    discFaktur,
    nilai,
    total: amount,
    cus_nama: header.cus_nama,
    cus_alamat: header.cus_alamat,
    cus_telp: header.cus_telp,
    cus_fax: header.cus_fax,
    salesman: header.salesman,
    terbilang: terbilangText,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      kota: perusahaan.perush_kota,
      notelp: perusahaan.perush_NOtelp,
    } : { nama: '', alamat: '', kota: '', notelp: '' },
    detail,
  };
};

/**
 * Ambil jumlah baris per halaman dari tabel barisslip
 * Delphi: getbarisslip('SO')
 */
const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20; // default 20 baris kalau tidak ada setting
};

/**
 * Toggle Closed SO — sesuai Delphi TfrmBrowsePesanan.cxButton4Click
 * UPDATE tSO_hdr set SO_ISCLOSED=0/1
 */
const toggleClose = async (nomor) => {
  const [[so]] = await db.query(
    `SELECT so_isclosed FROM tso_hdr WHERE so_nomor = ?`,
    [nomor]
  );
  if (!so) throw new Error("Data SO tidak ditemukan.");

  const newStatus = Number(so.so_isclosed) === 0 ? 1 : 0;
  await db.query(
    `UPDATE tso_hdr SET so_isclosed = ? WHERE so_nomor = ?`,
    [newStatus, nomor]
  );
  return { closed: newStatus === 1 };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip, toggleClose };