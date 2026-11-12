// services/utility/prosesBiayaPromosiService.js
// Migrasi dari Delphi ufrmProsesBiayaPromosi.pas (Proses Biaya Promosi).
// Menu Delphi: Utility -> "Proses Biaya Promosi" (ProsesBiayaPromosi1Click).
//
// Inti proses (cxButton1Click) hanya DUA statement UPDATE yang memindahkan
// setting klaim biaya promosi per customer+barang (tbiayapromosi_dtl) ke
// detail faktur penjualan (tfp_dtl.fpd_bp_pr / fpd_bp_rp), lalu menjumlahkan
// ulang biaya promosi per header faktur (tfp_hdr.fp_biayarp).
// Delphi mengeksekusi keduanya satu per satu tanpa transaksi; web memakai
// transaksi (aturan "web lebih baik -> pertahankan", pola modul lain).
const db = require("../../config/database");

// ── Validasi periode ─────────────────────────────────────────────────
// Delphi: bulan dari cbbBulan.ItemIndex (0..11 -> 1..12), tahun dari
// edtTahun.Text (textbox bebas). Web: angka dengan batas wajar.
const valPeriod = (bulan, tahun) => {
  const m = Number(bulan);
  const t = Number(tahun);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Bulan tidak valid.");
  if (!Number.isInteger(t) || t < 2000 || t > 2100) throw new Error("Tahun tidak valid.");
  return { m, t };
};

// ── Statement 1 (paritas verbatim Delphi) ────────────────────────────
// Salin setting biaya promosi ke detail faktur yang cocok customer+barang.
// Perhatikan: tanpa filter cabang/periode selain month+year fp_tanggal —
// seluruh penyesuaian di bawah ini menjaga semantik Delphi persis.
const SQL_SALIN_DETAIL = `
  UPDATE tbiayapromosi_hdr
    INNER JOIN tbiayapromosi_dtl ON bph_nomor = bpd_bph_nomor
    INNER JOIN tfp_hdr ON fp_cus_kode = bph_cus_kode
    INNER JOIN tfp_dtl ON fpd_fp_nomor = fp_nomor AND fpd_brg_kode = bpd_brg_kode
  SET fpd_bp_rp = bpd_rupiah, fpd_bp_pr = bpd_persen
  WHERE MONTH(fp_tanggal) = ? AND YEAR(fp_tanggal) = ?`;

// ── Statement 2 (paritas verbatim Delphi) ────────────────────────────
// Jumlahkan ulang nilai biaya promosi per faktur ke fp_biayarp.
// Formula per baris: ((100-fpd_discpr)*fpd_harga*(qty-qty_retur)/100)*bp_pr/100
//                    + bp_rp*(qty-qty_retur)
// Retur di-netting per (faktur, barang) via tretj_hdr/tretj_dtl.
// Hanya faktur yang punya bp_pr>0 atau bp_rp>0 (setelah statement 1) di-update;
// faktur tanpa setting promosi tidak disentuh.
const SQL_REKAP_HEADER = `
  UPDATE tfp_hdr b
    INNER JOIN (
      SELECT fp_nomor,
             SUM(
               (((100 - fpd_discpr) * fpd_harga * (fpd_qty - IFNULL(retjd_qty, 0)) / 100) * fpd_bp_pr / 100)
               + fpd_bp_rp * (fpd_qty - IFNULL(retjd_qty, 0))
             ) AS nilai
        FROM tfp_hdr
        INNER JOIN tfp_dtl ON fp_nomor = fpd_fp_nomor
        LEFT JOIN tretj_hdr ON retj_fp_nomor = fp_nomor
        LEFT JOIN tretj_dtl ON retjd_retj_nomor = retj_nomor AND fpd_brg_kode = retjd_brg_kode
       WHERE MONTH(fp_tanggal) = ? AND YEAR(fp_tanggal) = ?
         AND (fpd_bp_pr > 0 OR fpd_bp_rp > 0)
       GROUP BY fp_nomor
    ) a ON a.fp_nomor = b.fp_nomor
  SET b.fp_biayarp = a.nilai`;

// ── Proses (transaksional) ───────────────────────────────────────────
const proses = async (payload, user) => {
  const { m, t } = valPeriod(payload.bulan, payload.tahun);

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const [r1] = await conn.query(SQL_SALIN_DETAIL, [m, t]);
    const [r2] = await conn.query(SQL_REKAP_HEADER, [m, t]);
    await conn.commit();

    const affectedRows = Number(r1?.affectedRows) || 0;
    const fakturDiperbarui = Number(r2?.affectedRows) || 0;

    return {
      bulan: m,
      tahun: t,
      detailTersalin: affectedRows,
      fakturDiperbarui,
      user: user?.kode || "",
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Pratinjau (nilai yang AKAN terjadi bila proses dijalankan) ───────
// Web lebih baik: Delphi langsung UPDATE tanpa konfirmasi apa pun selain
// wait-window. Pratinjau membantu operator meyakinkan diri; tidak mengubah
// semantik proses.
const pratinjau = async (query) => {
  const { m, t } = valPeriod(query.bulan, query.tahun);

  const [setting] = await db.query(
    `SELECT COUNT(*) AS jml
       FROM tbiayapromosi_hdr h
       INNER JOIN tbiayapromosi_dtl d ON bpd_bph_nomor = bph_nomor`,
  );

  const [faktur] = await db.query(
    `SELECT COUNT(*) AS jml
       FROM tfp_hdr
      WHERE MONTH(fp_tanggal) = ? AND YEAR(fp_tanggal) = ?`,
    [m, t]
  );

  const [denganPromosi] = await db.query(
    `SELECT COUNT(DISTINCT fp.fp_nomor) AS jml
       FROM tbiayapromosi_hdr h
       INNER JOIN tbiayapromosi_dtl d ON bpd_bph_nomor = bph_nomor
       INNER JOIN tfp_hdr fp ON fp.fp_cus_kode = h.bph_cus_kode
        AND MONTH(fp.fp_tanggal) = ? AND YEAR(fp.fp_tanggal) = ?`,
    [m, t]
  );

  return {
    bulan: m,
    tahun: t,
    jmlSetting: Number(setting[0]?.jml) || 0,
    jmlFaktur: Number(faktur[0]?.jml) || 0,
    jmlFakturTerkaitPromosi: Number(denganPromosi[0]?.jml) || 0,
  };
};

module.exports = { proses, pratinjau };
