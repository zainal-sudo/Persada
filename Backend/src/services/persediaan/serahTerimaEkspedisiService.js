// services/persediaan/serahTerimaEkspedisiService.js
// Serah Terima Ekspedisi (browse + cetak + hapus).
// Migrasi dari Delphi ufrmBrowseSerahTerimaEkspedisi.pas
// dan teslip/steslip3 di ufrmSerahTerimaEkspedisi.pas.
const db = require("../../config/database");
const { tipeTersedia, selTipe } = require("./serahTerimaEkspedisiFormService");

// ── Browse (SQLMaster Delphi) ─────────────────────────────────────────
const getBrowse = async (startDate, endDate) => {
  const adaTipe = await tipeTersedia();
  const [rows] = await db.query(
    `SELECT ste_nomor AS Nomor,
            DATE_FORMAT(ste_tanggal, '%Y-%m-%d') AS Tanggal,
            DATE_FORMAT(ste_tanggal1, '%Y-%m-%d') AS Tanggal1,
            DATE_FORMAT(ste_tanggal2, '%Y-%m-%d') AS Tanggal2,
            ste_serah AS Serah,
            IFNULL(ste_namaekspedisi, '') AS NamaEkspedisi,
            IF(ste_realisasi = 0, 'Belum', 'Sudah') AS Realisasi,
            IFNULL(ste_keterangan, '') AS Note,
            ${selTipe(adaTipe, "Tipe")}
       FROM tserahterimaekspedisi_hdr
      WHERE ste_tanggal BETWEEN ? AND ?
      ORDER BY ste_nomor DESC`,
    [startDate, endDate]
  );
  return rows;
};

// ── Browse detail (SQLDetail Delphi) ──────────────────────────────────
const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT d.sted_ste_nomor AS Nomor,
            d.sted_fp_nomor AS NomorFP,
            IFNULL(c.cus_nama, d.sted_cus_nama) AS Customer,
            DATE_FORMAT(COALESCE(f.fp_tanggal, d.sted_tanggal), '%Y-%m-%d') AS TanggalFP,
            d.sted_nilai AS Nilai,
            d.sted_berat AS Berat,
            d.sted_kubikasi AS Kubikasi,
            d.sted_biaya AS Biaya
       FROM tserahterimaekspedisi_dtl d
       INNER JOIN tserahterimaekspedisi_hdr h ON h.ste_nomor = d.sted_ste_nomor
       LEFT JOIN tfp_hdr f ON f.fp_nomor = d.sted_fp_nomor
       LEFT JOIN tcustomer c ON c.cus_kode = f.fp_cus_kode
      WHERE d.sted_ste_nomor = ?
      ORDER BY d.sted_fp_nomor ASC`,
    [nomor]
  );
  return rows.map((r) => ({
    ...r,
    Nilai: Number(r.Nilai || 0),
    Berat: Number(r.Berat || 0),
    Kubikasi: Number(r.Kubikasi || 0),
    Biaya: Number(r.Biaya || 0),
  }));
};

// ── Kode user yang boleh edit/hapus dokumen yang sudah dicetak ─────────
// Delphi: "if (Realisasi = 'Sudah') and (KDUSER <> 'FINANCE')
//          and (KDUSER <> 'PIUTANG') then tolak".
const bolehUbah = (kodeUser, realisasi) =>
  !(realisasi === "Sudah" && !["FINANCE", "PIUTANG"].includes(String(kodeUser).toUpperCase()));

// ── Hapus (Delphi cxButton4Click) ─────────────────────────────────────
const deleteDoc = async (nomor, user) => {
  const [[row]] = await db.query(
    `SELECT ste_realisasi FROM tserahterimaekspedisi_hdr WHERE ste_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!row) throw new Error("Data tidak ditemukan.");
  if (!bolehUbah(user?.kode || "", row.ste_realisasi ? "Sudah" : "Belum"))
    throw new Error("Transaksi ini sudah dicetak, tidak dapat dihapus.");

  const conn = await db.getConnection();
  try {
    await conn.query(`DELETE FROM tserahterimaekspedisi_dtl WHERE sted_ste_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tserahterimaekspedisi_hdr WHERE ste_nomor = ?`, [nomor]);
  } finally {
    conn.release();
  }
  return { nomor };
};

// ── Data cetak: mode dipilih dari ste_tipe ────────────────────────────
// Delphi cxButton3Click: Tipe = 'MUTASI' → steslip3 (STE2, rincian barang
// dari tmutcab_dtl + tbarang); selain itu → teslip (STE, per faktur).
const getPrintData = async (nomor) => {
  const adaTipe = await tipeTersedia();
  const [[header]] = await db.query(
    `SELECT ste_nomor AS nomor,
            DATE_FORMAT(ste_tanggal, '%Y-%m-%d') AS tanggal,
            ste_serah AS serah,
            ste_terima AS terima,
            IFNULL(ste_namaekspedisi, '') AS namaEkspedisi,
            IFNULL(ste_keterangan, '') AS keterangan,
            ${selTipe(adaTipe, "tipe")}
       FROM tserahterimaekspedisi_hdr WHERE ste_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  // TTSReport tidak menyebut QPerusahaan di kedua template, jadi blok
  // perusahaan tidak perlu diquery.
  const mode = header.tipe === "MUTASI" ? "ste2" : "ste";
  const [detail] = await db.query(
    mode === "ste2"
      ? `SELECT d.sted_fp_nomor AS nomor,
                d.sted_cus_nama AS tujuan,
                b.brg_nama AS nama,
                IFNULL(b.brg_satuan, '') AS satuan,
                m.mutcd_qty AS qty,
                d.sted_berat AS berat,
                d.sted_kubikasi AS kubikasi
           FROM tserahterimaekspedisi_dtl d
           INNER JOIN tmutcab_dtl m ON m.mutcd_mutc_nomor = d.sted_fp_nomor
           INNER JOIN tbarang b ON b.brg_kode = m.mutcd_brg_kode
          WHERE d.sted_ste_nomor = ?`
      : `SELECT d.sted_fp_nomor AS nomor,
                IFNULL(c.cus_nama, d.sted_cus_nama) AS nama,
                DATE_FORMAT(f.fp_tanggal, '%Y-%m-%d') AS tanggal,
                d.sted_nilai AS nilai,
                d.sted_berat AS berat,
                d.sted_kubikasi AS kubikasi
           FROM tserahterimaekspedisi_dtl d
           LEFT JOIN tfp_hdr f ON f.fp_nomor = d.sted_fp_nomor
           LEFT JOIN tcustomer c ON c.cus_kode = f.fp_cus_kode
          WHERE d.sted_ste_nomor = ?
          ORDER BY d.sted_fp_nomor DESC`,
    [nomor]
  );

  return {
    mode,
    header,
    detail: detail.map((r) => ({
      ...r,
      nilai: Number(r.nilai || 0),
      berat: Number(r.berat || 0),
      kubikasi: Number(r.kubikasi || 0),
      qty: r.qty == null ? null : Number(r.qty),
    })),
  };
};

// ── Tandai sudah dicetak ───────────────────────────────────────────────
// Delphi teslip/steslip3: update ste_realisasi = 1 sebelum ShowReport.
const setRealisasi = async (nomor) => {
  await db.query(
    `UPDATE tserahterimaekspedisi_hdr SET ste_realisasi = 1 WHERE ste_nomor = ?`,
    [nomor]
  );
  return { nomor };
};

module.exports = {
  getBrowse,
  getBrowseDetail,
  deleteDoc,
  getPrintData,
  setRealisasi,
  bolehUbah,
};
