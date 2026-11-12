// services/pembelian/bayarSupplierService.js
const db = require("../../config/database");

/**
 * Browse Pembayaran Supplier — paritas Delphi ufrmBrowseBayarSupplier.btnRefreshClick
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT
       h.bys_nomor AS Nomor,
       DATE_FORMAT(h.bys_tanggal, '%Y-%m-%d') AS Tanggal,
       IFNULL(h.bys_memo, '') AS Memo,
       IF(h.bys_istax = 1, 'PPN', 'Non PPN') AS Tax,
       IFNULL(s.sup_kode, '') AS Kode,
       IFNULL(s.sup_nama, '') AS Supplier,
       IFNULL(h.bys_nilai, 0) AS Total,
       IFNULL(h.bys_nogiro, '') AS Giro,
       DATE_FORMAT(h.bys_tglcair, '%Y-%m-%d') AS TglCair,
       IFNULL(r.rek_nama, '') AS Rekening
     FROM tbayarsup_hdr h
     INNER JOIN tsupplier s ON s.sup_kode = h.bys_sup_kode
     LEFT JOIN trekening r ON r.rek_kode = h.bys_rek_kode
     WHERE h.bys_tanggal BETWEEN ? AND ?
     ORDER BY h.bys_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Pembayaran Supplier — paritas Delphi SQLDetail
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.bysd_bys_nomor AS Nomor,
       d.bysd_inv_nomor AS Invoice,
       IFNULL(i.inv_nobukti, '') AS Nobukti,
       DATE_FORMAT(i.inv_tanggal, '%Y-%m-%d') AS Tgl_Invoice,
       DATE_FORMAT(i.inv_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(i.inv_amount, 0) AS Nilai,
       IFNULL((SELECT SUM(r.ret_amount) FROM tret_hdr r WHERE r.ret_inv_nomor = i.inv_nomor), 0) AS Retur,
       IFNULL(d.bysd_bayar, 0) AS Bayar
     FROM tbayarsup_dtl d
     INNER JOIN tbayarsup_hdr h ON h.bys_nomor = d.bysd_bys_nomor
     INNER JOIN tinv_hdr i ON i.inv_nomor = d.bysd_inv_nomor
     WHERE d.bysd_bys_nomor = ?
     ORDER BY d.bysd_bys_nomor DESC`,
    [nomor]
  );
  return rows;
};

/**
 * Hapus Pembayaran Supplier — urutan: DELETE tbayarsup_dtl
 * (trigger tbayarsup_dtl_after_delete mengurangi inv_bayar)
 * → DELETE tbayarsup_hdr.
 */
const deleteData = async (nomor) => {
  const [[bys]] = await db.query(
    `SELECT bys_nomor FROM tbayarsup_hdr WHERE bys_nomor = ?`,
    [nomor]
  );
  if (!bys) throw new Error("Data Pembayaran Supplier tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tbayarsup_dtl WHERE bysd_bys_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tbayarsup_hdr WHERE bys_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data print (slip Pembayaran Supplier) ────────────────────────────
const getPrintData = async (nomor) => {
  const [detail] = await db.query(
    `SELECT
       h.bys_nomor AS nomor,
       DATE_FORMAT(h.bys_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(h.bys_memo, '') AS memo,
       IFNULL(h.bys_nogiro, '') AS nogiro,
       DATE_FORMAT(h.bys_tglcair, '%Y-%m-%d') AS tglcair,
       IFNULL(h.bys_nilai, 0) AS bys_nilai,
       IFNULL(s.sup_nama, '') AS sup_nama,
       IFNULL(s.sup_alamat, '') AS sup_alamat,
       IFNULL(r.rek_nama, '') AS rek_nama,
       d.bysd_inv_nomor AS inv_nomor,
       IFNULL(i.inv_nobukti, '') AS inv_nobukti,
       DATE_FORMAT(i.inv_tanggal, '%Y-%m-%d') AS inv_tanggal,
       IFNULL(d.bysd_bayar, 0) AS bysd_bayar
     FROM tbayarsup_hdr h
     INNER JOIN tbayarsup_dtl d ON d.bysd_bys_nomor = h.bys_nomor
     INNER JOIN tinv_hdr i ON i.inv_nomor = d.bysd_inv_nomor
     INNER JOIN tsupplier s ON s.sup_kode = h.bys_sup_kode
     INNER JOIN trekening r ON r.rek_kode = h.bys_rek_kode
     WHERE h.bys_nomor = ?`,
    [nomor]
  );
  if (!detail.length) throw new Error("Data Pembayaran Supplier tidak ditemukan.");

  const h = detail[0];
  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  const totalBayar = Number(h.bys_nilai);
  let terbilangText = "";
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [totalBayar]);
    terbilangText = terb?.t || "";
  } catch {
    terbilangText = "";
  }

  return {
    nomor: h.nomor,
    tanggal: h.tanggal,
    memo: h.memo,
    nogiro: h.nogiro,
    tglcair: h.tglcair,
    bys_nilai: totalBayar,
    sup_nama: h.sup_nama,
    sup_alamat: h.sup_alamat,
    rek_nama: h.rek_nama,
    terbilang: terbilangText,
    perusahaan: perusahaan
      ? {
          nama: perusahaan.perush_nama,
          alamat: perusahaan.perush_alamat,
          kota: perusahaan.perush_kota,
          notelp: perusahaan.perush_NOtelp,
        }
      : { nama: "", alamat: "", kota: "", notelp: "" },
    detail: detail.map((d) => ({
      invoice: d.inv_nomor,
      nobukti: d.inv_nobukti,
      tanggal: d.inv_tanggal,
      bayar: Number(d.bysd_bayar),
    })),
  };
};

const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip };
