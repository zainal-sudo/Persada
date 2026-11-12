// services/penjualan/fakturManualService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.fp_nomor AS Nomor,
       h.fp_so_nomor AS SO_Nomor,
       DATE_FORMAT(h.fp_tanggal, '%Y-%m-%d') AS Tanggal,
       DATE_FORMAT(h.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(h.fp_memo, '') AS Memo,
       IFNULL(s.sls_nama, '') AS Salesman,
       IFNULL(c.cus_nama, '') AS Customer,
       IFNULL(h.fp_amount, 0) AS Total,
       IFNULL(h.fp_taxamount, 0) AS Ppn,
       ROUND(((h.fp_disc_fakturpr * (((h.fp_amount - h.fp_taxamount) + h.fp_disc_faktur) / (100 - h.fp_disc_fakturpr) * 100)) / 100) + h.fp_disc_faktur, 2) AS Disc_Faktur,
       IFNULL(h.fp_cn, 0) AS CN,
       IFNULL(h.fp_freight, 0) AS Freight,
       IFNULL(h.fp_bayar, 0) AS Bayar,
       IF(h.fp_isbayar = 0, 'Belum', 'Sudah') AS Status_Bayar
     FROM tfp_hdr_bayangan h
     INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
     LEFT JOIN tso_hdr so ON so.so_nomor = h.fp_so_nomor
     LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     WHERE h.fp_tanggal BETWEEN ? AND ?
     GROUP BY h.fp_nomor, h.fp_tanggal, h.fp_memo, c.cus_nama
     ORDER BY h.fp_nomor ASC`,
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
       ROUND(d.fpd_harga * d.fpd_qty * (100 - IFNULL(d.fpd_discpr, 0)) / 100, 2) AS Nilai
     FROM tfp_dtl_bayangan d
     INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE d.fpd_fp_nomor = ?
       AND d.fpd_qty > 0
     ORDER BY d.fpd_nourut ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT fp_nomor FROM tfp_hdr_bayangan WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tfp_dtl_bayangan WHERE fpd_fp_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tfp_hdr_bayangan WHERE fp_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Print Data (paritas doslip2 Delphi) ──────────────────────────────
const getPrintData = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       h.fp_nomor AS nomor,
       DATE_FORMAT(h.fp_tanggal, '%d/%m/%Y') AS tanggal,
       DATE_FORMAT(h.fp_jthtempo, '%d/%m/%Y') AS jthTempo,
       h.fp_do_nomor AS nomorDO,
       COALESCE(h.fp_so_nomor, '') AS nomorSO,
       IFNULL(h.fp_memo, '') AS memo,
       h.fp_amount AS atotal,
       h.fp_taxamount AS appn,
       h.fp_freight AS afreight,
       h.fp_disc_faktur AS discFaktur,
       h.fp_disc_fakturpr AS discFakturPr,
       c.cus_nama AS cusNama,
       c.cus_alamat AS cusAlamat,
       s.sls_nama AS salesman,
       terbilang(h.fp_amount) AS terbilang,
       d.fpd_brg_kode AS kode,
       b.brg_nama AS nama,
       d.fpd_brg_satuan AS satuan,
       d.fpd_idbatch AS idBatch,
       d.fpd_qty AS qty,
       d.fpd_discpr AS discpr,
       d.fpd_harga AS harga,
       DATE_FORMAT(d.fpd_expired, '%Y-%m-%d') AS expired,
       ROUND(d.fpd_harga * d.fpd_qty * (100 - IFNULL(d.fpd_discpr, 0)) / 100, 2) AS total,
       IFNULL(d.fpd_nourut, 1000) AS nourut
     FROM tfp_hdr_bayangan h
     LEFT JOIN tso_hdr so ON so.so_nomor = h.fp_so_nomor
     INNER JOIN tcustomer c ON c.cus_kode = h.fp_cus_kode
     LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     LEFT JOIN tfp_dtl_bayangan d ON d.fpd_fp_nomor = h.fp_nomor
     LEFT JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE h.fp_nomor = ?
     ORDER BY nourut`,
    [nomor]
  );

  if (rows.length === 0) throw new Error("Data tidak ditemukan.");

  const h = rows[0];
  const anilai = Number(h.atotal || 0) - Number(h.appn || 0);
  const adiscfaktur = ((Number(h.discFakturPr || 0) * anilai) / 100) + Number(h.discFaktur || 0);

  // Data perusahaan
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama AS nama, perush_alamat AS alamat, perush_kota AS kota, perush_notelp AS notelp, perush_npwp AS npwp
     FROM tperusahaan LIMIT 1`
  );

  // Baris slip
  const [[slip]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = 'FP' LIMIT 1`
  );

  // Expand nama barang: fpd_brg_nama + ' / mm.yyyy' bila expired tahun > 2000 (paritas Delphi)
  const detail = rows.filter(r => r.kode).map((r, i) => {
    let namaDisplay = r.nama || '';
    if (r.expired) {
      const yr = new Date(r.expired).getFullYear();
      if (yr > 2000) {
        const exp = new Date(r.expired);
        const mm = String(exp.getMonth() + 1).padStart(2, '0');
        const yy = String(exp.getFullYear()).slice(-2);
        namaDisplay += ' / ' + mm + '.' + yy;
      }
    }
    return {
      no: i + 1,
      kode: r.kode,
      nama: namaDisplay,
      satuan: r.satuan || '',
      idBatch: r.idBatch || '',
      qty: Number(r.qty || 0),
      discpr: Number(r.discpr || 0),
      harga: Number(r.harga || 0),
      total: Number(r.total || 0),
    };
  });

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    jthTempo: h.jthTempo,
    nomorDO: h.nomorDO || '',
    nomorSO: h.nomorSO || '',
    memo: h.memo || '',
    cusNama: h.cusNama,
    cusAlamat: h.cusAlamat,
    salesman: h.salesman || '',
    baris: Number(slip?.baris || 20),
    terbilang: h.terbilang || '',
    discFakturPr: Number(h.discFakturPr || 0),
    discFaktur: Number(h.discFaktur || 0),
    adiscfaktur,
    anilai,
    appn: Number(h.appn || 0),
    afreight: Number(h.afreight || 0),
    atotal: Number(h.atotal || 0),
    perusahaan: perusahaan || { nama: '', alamat: '', kota: '', notelp: '', npwp: '' },
    detail,
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };