// services/pembelian/invoiceService.js
const db = require("../../config/database");

/**
 * Browse Invoice — paritas Delphi ufrmBrowseInvoice.btnRefreshClick:
 * header + subquery Retur (tret_hdr) + Dpp per tanggal PPN.
 */
const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT Nomor, Nobukti, Tanggal, Jthtempo, Memo, Supplier, NoPajak,
            Total, Retur, Ppn, Dpp, Bayar, StatusBayar, Pajak
     FROM (
       SELECT h.inv_nomor AS Nomor,
              IFNULL(h.inv_nobukti, '') AS Nobukti,
              DATE_FORMAT(h.inv_tanggal, '%Y-%m-%d') AS Tanggal,
              DATE_FORMAT(h.inv_jthtempo, '%Y-%m-%d') AS Jthtempo,
              IFNULL(h.inv_memo, '') AS Memo,
              IFNULL(s.sup_nama, '') AS Supplier,
              IFNULL(h.inv_nopajak, '') AS NoPajak,
              IFNULL(h.inv_amount, 0) AS Total,
              IFNULL((SELECT SUM(r.ret_amount) FROM tret_hdr r
                      WHERE r.ret_inv_nomor = h.inv_nomor), 0) AS Retur,
              IFNULL(h.inv_taxamount, 0) AS Ppn,
              IFNULL(h.inv_bayar, 0) AS Bayar,
              IF(h.inv_isbayar = 0, 'Belum', 'Sudah') AS StatusBayar,
              IF(h.inv_ispajak = 1, 'Ya', 'Tidak') AS Pajak,
              IFNULL(h.inv_amount, 0) - IFNULL(h.inv_taxamount, 0)
                - IFNULL((SELECT SUM(r.ret_amount) FROM tret_hdr r
                          WHERE r.ret_inv_nomor = h.inv_nomor), 0)
                  / IF(IFNULL(h.inv_taxamount, 0) > 0,
                       IF(h.inv_tanggal < '2022-04-01', 1.1, 1.11), 1)
                AS Dpp
       FROM tinv_hdr h
       INNER JOIN tbpb_hdr b ON b.bpb_nomor = h.inv_bpb_nomor
       INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
       INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
       INNER JOIN tinv_dtl d ON d.invd_inv_nomor = h.inv_nomor
       WHERE h.inv_tanggal BETWEEN ? AND ?
       GROUP BY h.inv_nomor, h.inv_tanggal, h.inv_memo, s.sup_nama
     ) final
     ORDER BY Nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

/**
 * Browse Detail Invoice — paritas Delphi SQLDetail
 */
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT
       d.invd_inv_nomor AS Nomor,
       d.invd_brg_kode AS Kode,
       IFNULL(b.brg_nama, '') AS Nama,
       IFNULL(d.invd_brg_satuan, '') AS Satuan,
       IFNULL(d.invd_qty, 0) AS Jumlah,
       IFNULL(d.invd_harga, 0) AS Harga,
       IFNULL(d.invd_discpr, 0) AS Disc,
       ROUND(IFNULL(d.invd_harga, 0) * IFNULL(d.invd_qty, 0) * (100 - IFNULL(d.invd_discpr, 0)) / 100, 2) AS Nilai
     FROM tinv_dtl d
     INNER JOIN tinv_hdr h ON h.inv_nomor = d.invd_inv_nomor
     INNER JOIN tbarang b ON b.brg_kode = d.invd_brg_kode
     WHERE d.invd_inv_nomor = ?
     ORDER BY d.invd_nourut ASC`,
    [nomor]
  );
  return rows;
};

/**
 * Hapus Invoice — guard: sudah ada pembayaran tidak boleh dihapus.
 * Urutan: DELETE tinv_dtl (trigger before_delete hapus tmasterstok)
 * → DELETE tinv_hdr (trigger after_delete kurangi sup_hutang,
 *   bpb_isinvoice=0).
 */
const deleteData = async (nomor) => {
  const [[inv]] = await db.query(
    `SELECT inv_isbayar FROM tinv_hdr WHERE inv_nomor = ?`,
    [nomor]
  );
  if (!inv) throw new Error("Data Invoice tidak ditemukan.");
  if (Number(inv.inv_isbayar) === 1)
    throw new Error(
      "Transaksi ini sudah ada pembayaran, tidak dapat dihapus."
    );

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tinv_hdr WHERE inv_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/**
 * Toggle status pajak — paritas Delphi ufrmBrowseInvoice.UpdateStatusKembali1Click
 * UPDATE tinv_hdr set inv_ispajak=0/1
 */
const togglePajak = async (nomor) => {
  const [[inv]] = await db.query(
    `SELECT inv_ispajak FROM tinv_hdr WHERE inv_nomor = ?`,
    [nomor]
  );
  if (!inv) throw new Error("Data Invoice tidak ditemukan.");

  const newVal = Number(inv.inv_ispajak) === 1 ? 0 : 1;
  await db.query(
    `UPDATE tinv_hdr SET inv_ispajak = ? WHERE inv_nomor = ?`,
    [newVal, nomor]
  );
  return { pajak: newVal === 1 };
};

/**
 * Input No Pajak — paritas Delphi ufrmBrowseInvoice.cxButton5Click
 */
const setNoPajak = async (nomor, nopajak) => {
  const [[inv]] = await db.query(
    `SELECT inv_nomor FROM tinv_hdr WHERE inv_nomor = ?`,
    [nomor]
  );
  if (!inv) throw new Error("Data Invoice tidak ditemukan.");

  await db.query(
    `UPDATE tinv_hdr SET inv_nopajak = ? WHERE inv_nomor = ?`,
    [nopajak, nomor]
  );
  return { nopajak };
};

/**
 * History pembayaran invoice — paritas Delphi HistoryPembayaran1Click
 */
const getHistoryPembayaran = async (nomor) => {
  const [rows] = await db.query(
    `SELECT d.bysd_bys_nomor AS Nomor,
            d.bysd_inv_nomor AS NomorInv,
            IFNULL(d.bysd_bayar, 0) AS Bayar,
            IFNULL(h.bys_nilai, 0) AS Nilai,
            DATE_FORMAT(h.bys_tanggal, '%Y-%m-%d') AS Tanggal
     FROM tbayarsup_dtl d
     INNER JOIN tinv_hdr i ON i.inv_nomor = d.bysd_inv_nomor
     INNER JOIN tbayarsup_hdr h ON h.bys_nomor = d.bysd_bys_nomor
     WHERE d.bysd_inv_nomor = ?`,
    [nomor]
  );
  return rows;
};

// ── Data print (slip INV) ─────────────────────────────────────────────
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       h.inv_nomor AS nomor,
       IFNULL(h.inv_nobukti, '') AS nobukti,
       DATE_FORMAT(h.inv_tanggal, '%d/%m/%Y') AS tanggal,
       DATE_FORMAT(h.inv_jthtempo, '%d/%m/%Y') AS jthtempo,
       IFNULL(h.inv_memo, '') AS memo,
       IFNULL(h.inv_amount, 0) AS amount,
       IFNULL(h.inv_taxamount, 0) AS taxamount,
       IFNULL(h.inv_freight, 0) AS freight,
       IFNULL(h.inv_materai, 0) AS materai,
       IFNULL(h.inv_disc_faktur, 0) AS disc_faktur,
       IFNULL(h.inv_disc_fakturpr, 0) AS disc_fakturpr,
       IFNULL(h.inv_nopajak, '') AS nopajak,
       IFNULL(s.sup_nama, '') AS sup_nama,
       IFNULL(s.sup_alamat, '') AS sup_alamat,
       IFNULL(s.sup_telp, '') AS sup_telp,
       IFNULL(b.bpb_nomor, '') AS bpb_nomor,
       IFNULL(p.po_nomor, '') AS po_nomor
     FROM tinv_hdr h
     INNER JOIN tbpb_hdr b ON b.bpb_nomor = h.inv_bpb_nomor
     INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
     INNER JOIN tsupplier s ON s.sup_kode = p.po_sup_kode
     WHERE h.inv_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data Invoice tidak ditemukan.");

  const [detail] = await db.query(
    `SELECT
       d.invd_nourut AS nourut,
       d.invd_brg_kode AS kode,
       IFNULL(b.brg_nama, '') AS nama,
       IFNULL(d.invd_brg_satuan, '') AS satuan,
       IFNULL(d.invd_qty, 0) AS qty,
       IFNULL(d.invd_harga, 0) AS harga,
       IFNULL(d.invd_discpr, 0) AS discpr,
       DATE_FORMAT(d.invd_expired, '%d/%m/%Y') AS expired
     FROM tinv_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.invd_brg_kode
     WHERE d.invd_inv_nomor = ?
     ORDER BY d.invd_nourut ASC`,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_NOtelp
     FROM tperusahaan LIMIT 1`
  );

  const amount = Number(header.amount);
  let terbilangText = "";
  try {
    const [[terb]] = await db.query(`SELECT terbilang(?) AS t`, [amount]);
    terbilangText = terb?.t || "";
  } catch {
    terbilangText = "";
  }

  return {
    nomor: header.nomor,
    nobukti: header.nobukti,
    tanggal: header.tanggal,
    jthtempo: header.jthtempo,
    memo: header.memo,
    amount,
    taxamount: Number(header.taxamount),
    freight: Number(header.freight),
    materai: Number(header.materai),
    discFaktur: Number(header.disc_faktur),
    discFakturPr: Number(header.disc_fakturpr),
    nopajak: header.nopajak,
    sup_nama: header.sup_nama,
    sup_alamat: header.sup_alamat,
    sup_telp: header.sup_telp,
    bpb_nomor: header.bpb_nomor,
    po_nomor: header.po_nomor,
    terbilang: terbilangText,
    perusahaan: perusahaan
      ? {
          nama: perusahaan.perush_nama,
          alamat: perusahaan.perush_alamat,
          kota: perusahaan.perush_kota,
          notelp: perusahaan.perush_NOtelp,
        }
      : { nama: "", alamat: "", kota: "", notelp: "" },
    detail,
  };
};

/**
 * Ambil jumlah baris per halaman dari tabel barisslip
 * Delphi: getbarisslip('INV')
 */
const getBarisSlip = async (nama) => {
  const [[row]] = await db.query(
    `SELECT baris FROM barisslip WHERE Nama = ? LIMIT 1`,
    [nama]
  );
  return row ? Number(row.baris) : 20;
};

module.exports = {
  getBrowse,
  getBrowseDetail,
  deleteData,
  togglePajak,
  setNoPajak,
  getHistoryPembayaran,
  getPrintData,
  getBarisSlip,
};
