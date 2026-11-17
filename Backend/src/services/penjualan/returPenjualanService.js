// services/penjualan/returPenjualanService.js
const db = require("../../config/database");
const { deleteJurnal } = require("../jurnalHelper");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       h.retj_nomor AS Nomor,
       DATE_FORMAT(h.retj_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.retj_memo, '') AS Memo,
       c.cus_nama AS Customer,
       s.sls_nama AS Salesman,
       IFNULL(h.retj_amount, 0) AS Total,
       IFNULL(h.retj_taxamount, 0) AS Ppn,
       IFNULL(h.retj_cn, 0) AS Retur_CN,
       h.retj_fp_nomor AS Nomor_Faktur
     FROM tretj_hdr h
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = h.retj_fp_nomor
     LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
     INNER JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     WHERE h.retj_tanggal BETWEEN ? AND ?
     GROUP BY h.retj_nomor, h.retj_tanggal, h.retj_memo, c.cus_nama
     ORDER BY h.retj_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.retjd_retj_nomor AS Nomor,
       d.retjd_brg_kode AS Kode,
       b.brg_nama AS Nama,
       d.retjd_brg_satuan AS Satuan,
       d.retjd_qty AS Jumlah,
       d.retjd_harga AS Harga,
       d.retjd_discpr AS Disc,
       ROUND(d.retjd_harga * d.retjd_qty * (100 - IFNULL(d.retjd_discpr, 0)) / 100, 2) AS Nilai
     FROM tretj_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.retjd_brg_kode
     WHERE d.retjd_retj_nomor = ?
     ORDER BY d.retjd_nourut ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT retj_nomor FROM tretj_hdr WHERE retj_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  // Blokir bila retur sudah dipakai untuk setle penerimaan customer
  const [[dipakai]] = await db.query(
    `SELECT bycd_byc_nomor FROM tbayarcus_dtl WHERE bycd_fp_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (dipakai) {
    throw new Error(`Retur sudah dipakai penerimaan ${dipakai.bycd_byc_nomor}. Hapus penerimaan terlebih dahulu.`);
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tretj_dtl WHERE retjd_retj_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tretj_hdr WHERE retj_nomor = ?`, [nomor]);
    // Jurnal retur dibuat dari Node (bukan trigger) → ikut dihapus
    await deleteJurnal(conn, nomor);
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
       h.retj_nomor AS nomor,
       DATE_FORMAT(h.retj_tanggal, '%d/%m/%Y') AS tanggal,
       h.retj_fp_nomor AS atasFaktur,
       h.retj_amount AS atotal,
       h.retj_taxamount AS appn,
       h.retj_disc_faktur AS discFaktur,
       h.retj_disc_fakturpr AS discFakturPr,
       c.cus_nama AS cusNama,
       c.cus_alamat AS cusAlamat,
       s.sls_nama AS salesman,
       terbilang(h.retj_amount) AS terbilang,
       d.retjd_brg_kode AS kode,
       b.brg_nama AS nama,
       d.retjd_brg_satuan AS satuan,
       d.retjd_qty AS qty,
       d.retjd_discpr AS discpr,
       d.retjd_harga AS harga,
       ROUND(d.retjd_harga * d.retjd_qty * (100 - IFNULL(d.retjd_discpr, 0)) / 100, 2) AS total,
       IFNULL(d.retjd_nourut, 1000) AS nourut
     FROM tretj_hdr h
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = h.retj_fp_nomor
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
     LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
     LEFT JOIN tretj_dtl d ON d.retjd_retj_nomor = h.retj_nomor
     LEFT JOIN tbarang b ON b.brg_kode = d.retjd_brg_kode
     WHERE h.retj_nomor = ?
     ORDER BY nourut`,
    [nomor]
  );

  if (rows.length === 0) throw new Error("Data tidak ditemukan.");

  const h = rows[0];
  const anilai = Number(h.atotal || 0) - Number(h.appn || 0);
  const adiscfaktur = ((Number(h.discFakturPr || 0) * anilai) / 100) + Number(h.discFaktur || 0);

  // Data perusahaan
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama AS nama, perush_alamat AS alamat, perush_kota AS kota, perush_notelp AS notelp
     FROM tperusahaan LIMIT 1`
  );

  // Baris slip
  const [[slip]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = 'RETJ' LIMIT 1`
  );

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    atasFaktur: h.atasFaktur,
    cusNama: h.cusNama,
    cusAlamat: h.cusAlamat,
    salesman: h.salesman || "",
    baris: Number(slip?.baris || 20),
    terbilang: h.terbilang || "",
    discFakturPr: Number(h.discFakturPr || 0),
    discFaktur: Number(h.discFaktur || 0),
    adiscfaktur,
    anilai,
    appn: Number(h.appn || 0),
    atotal: Number(h.atotal || 0),
    perusahaan: perusahaan || { nama: "", alamat: "", kota: "", notelp: "" },
    detail: rows.filter(r => r.kode).map((r, i) => ({
      no: i + 1,
      kode: r.kode,
      nama: r.nama || "",
      satuan: r.satuan || "",
      qty: Number(r.qty || 0),
      discpr: Number(r.discpr || 0),
      harga: Number(r.harga || 0),
      total: Number(r.total || 0),
    })),
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };