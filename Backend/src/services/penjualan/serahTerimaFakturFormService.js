// services/penjualan/serahTerimaFakturFormService.js
// Form Serah Terima Faktur, varian tabel tanpa suffix "2".
// Migrasi dari Delphi ufrmSerahTerimaFaktur.pas.
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");

// ── Nomor: <cabang>-ST.<yymm>.NNNN ───────────────────────────────────
// Delphi getmaxkode: max(right(sth_nomor,4)) lalu 10000 + max + 1.
const getMaxNomor = async (tanggal, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-ST.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(sth_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tserahterimafaktur_hdr WHERE sth_nomor LIKE ?`,
    [`${prefix}%`]
  );

  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
};

// ── Lookup penyerah/penerima: tuser yang user_faktur = 1 ─────────────
const getUserFaktur = async () => {
  const [rows] = await db.query(
    `SELECT user_kode AS kode, user_nama AS nama
       FROM tuser WHERE user_faktur = 1 ORDER BY user_nama`
  );
  return rows;
};

// ── Antrean faktur milik satu pihak (fp_status_faktur = penyerah) ────
// Delphi loaddataInvoice. Filter nilai (having) memang dimatikan di sumber.
const getInvoice = async (penyerah) => {
  if (!penyerah) return [];

  const [rows] = await db.query(
    `SELECT
       sls.sls_nama AS salesman,
       fp.fp_nomor AS faktur,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(fp.fp_taxamount, 0) AS ppn,
       IFNULL(fp.fp_amount, 0) AS nilai,
       IFNULL(c.cus_nama, '') AS customer
     FROM tfp_hdr fp
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
     LEFT JOIN tsalesman sls ON sls.sls_kode = so.so_sls_kode
     WHERE fp.fp_status_faktur = ?
     ORDER BY fp.fp_tanggal, fp.fp_nomor`,
    [penyerah]
  );

  return rows.map((r) => ({
    salesman: r.salesman || "",
    faktur: r.faktur,
    tanggal: r.tanggal,
    ppn: Number(r.ppn || 0),
    nilai: Number(r.nilai || 0),
    customer: r.customer || "",
    check: 0,
  }));
};

// ── Load form edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor, user) => {
  const [[h]] = await db.query(
    `SELECT sth_nomor AS nomor,
            DATE_FORMAT(sth_tanggal, '%Y-%m-%d') AS tanggal,
            sth_serah AS serah,
            sth_terima AS terima,
            IFNULL(sth_memo, '') AS memo,
            sth_realisasi AS realisasi
       FROM tserahterimafaktur_hdr WHERE sth_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!h) throw new Error("Data tidak ditemukan.");

  const [[nama]] = await db.query(
    `SELECT (SELECT user_nama FROM tuser WHERE user_kode = ? LIMIT 1) AS serahNama,
            (SELECT user_nama FROM tuser WHERE user_kode = ? LIMIT 1) AS terimaNama`,
    [h.serah, h.terima]
  );

  // Delphi loaddataall memuat antrean dengan fp_status_faktur = kode user login,
  // bukan nilai penyerah dokumen. Perilaku itu dipertahankan apa adanya.
  const detail = await getInvoice(user?.kode || "");

  const [rows] = await db.query(
    `SELECT std_fp_nomor AS faktur FROM tserahterimafaktur_dtl WHERE std_sth_nomor = ?`,
    [nomor]
  );
  const dipilih = new Set(rows.map((r) => r.faktur));
  for (const d of detail) {
    if (dipilih.has(d.faktur)) d.check = 1;
  }

  return {
    ...h,
    serahNama: nama?.serahNama || "",
    terimaNama: nama?.terimaNama || "",
    detail,
  };
};

// ── Simpan (transaksional) ───────────────────────────────────────────
// Delphi simpandata: update/insert header, lalu SELALU hapus detail nomor itu
// dan insert ulang baris yang tercentang. Delphi tanpa transaksi; web memakai
// transaksi supaya tidak menyisakan header tanpa detail.
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, serah, terima, memo } = payload;
  const detail = Array.isArray(payload.detail) ? payload.detail : [];

  if (!terima) throw new Error("Penerima belum di pilih.");

  // Delphi cxButton1Click: cekTutupPeriode(dtTanggal.Date) sebelum cekdata.
  if (await cekTutupPeriode(tanggal))
    throw new Error("Periode ini sudah di tutup.");

  const kodeUser = user?.kode || "";

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tserahterimafaktur_hdr
            SET sth_terima = ?, sth_memo = ?, sth_tanggal = ?, sth_serah = ?,
                date_modify = NOW(), user_modify = ?
          WHERE sth_nomor = ?`,
        [terima, memo, tanggal, serah, kodeUser, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user?.cabang || "01");
      await conn.query(
        `INSERT INTO tserahterimafaktur_hdr
           (sth_nomor, sth_tanggal, sth_serah, sth_terima, sth_memo, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, serah, terima, memo, kodeUser]
      );
    }

    await conn.query(
      `DELETE FROM tserahterimafaktur_dtl WHERE std_sth_nomor = ?`,
      [actualNomor]
    );

    for (const d of detail) {
      if (Number(d.check) === 1) {
        await conn.query(
          `INSERT INTO tserahterimafaktur_dtl (std_sth_nomor, std_fp_nomor) VALUES (?, ?)`,
          [actualNomor, d.faktur]
        );
      }
    }

    await conn.commit();
    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMaxNomor,
  getUserFaktur,
  getInvoice,
  getDetailForm,
  saveData,
};
