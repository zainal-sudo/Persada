const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang, tipe) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-${tipe}.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(jur_no, 4) AS UNSIGNED)), 0) AS max_val
     FROM tjurnal
     WHERE jur_no LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// Escape % dan _ yang diketik user supaya tidak diperlakukan sebagai
// wildcard MySQL. Delphi memakai operator Contains yang memperlakukannya
// sebagai huruf biasa (ufrmPenerimaanLain.pas bantuanaccount).
const escapeLike = (s) => String(s).replace(/[\\%_]/g, (m) => `\\${m}`);

// ── Search Account ───────────────────────────────────────────────────
// Ada dua daftar, persis seperti Delphi — dibedakan oleh field yang diklik:
//
// scope "header" → kotak Account di header. WAJIB tetap tersaring: kalau
//   filter ini dilepas, kas-masuk bisa ter-debit ke akun biaya.
//   Sumber: ufrmPenerimaanLain.pas edtAccountClickBtn
//     where rek_kol_id=1 and rek_isaktif=1 and rek_kode like '11%' (Kas) / '12%' (Bank)
//
// scope "detail" → kolom Account di grid detail. TIDAK boleh disaring.
//   Sumber: ufrmPenerimaanLain.pas bantuanaccount
//     select rek_kode Account, rek_nama AccountName from Trekening where rek_isaktif=1
//   Akun di sini adalah sisi lawan dari kas, jadi bisa berupa akun biaya
//   (rek_kol_id 12/13, kode 23.0xx) — semua itu dicek oleh cekbiaya/cekaccount.
const searchAccount = async (search = "", tipe = "KM", scope = "header") => {
  const detail = scope === "detail";
  const q = `%${escapeLike(search)}%`;

  const [rows] = await db.query(
    detail
      ? `SELECT rek_kode AS kode, rek_nama AS nama
         FROM trekening
         WHERE rek_isaktif = 1
           AND (rek_nama LIKE ? OR rek_kode LIKE ?)
         ORDER BY rek_nama
         LIMIT 500`
      : `SELECT rek_kode AS kode, rek_nama AS nama
         FROM trekening
         WHERE rek_kol_id = 1 AND rek_isaktif = 1
           AND rek_kode LIKE ?
           AND (rek_nama LIKE ? OR rek_kode LIKE ?)
         ORDER BY rek_nama
         LIMIT 100`,
    detail ? [q, q] : [`${tipe === "KM" ? "11" : "12"}%`, q, q]
  );
  return rows;
};

// ── Get Account By Kode ──────────────────────────────────────────────
const getAccountByKode = async (kode) => {
  const [[row]] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening WHERE rek_kode = ?`,
    [kode]
  );
  if (!row) throw new Error("Account tidak ditemukan.");
  return row;
};

// ── Search Cost Center ───────────────────────────────────────────────
const searchCostCenter = async () => {
  const [rows] = await db.query(
    `SELECT cc_kode AS kode, cc_nama AS nama FROM tcostcenter ORDER BY cc_nama`
  );
  return rows;
};

// ── Search Customer ──────────────────────────────────────────────────
const searchCustomer = async (search = "") => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama
     FROM tcustomer
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     ORDER BY cus_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Cek Biaya (REK_STATUS = 1) ──────────────────────────────────────
const cekBiaya = async (account) => {
  const [[row]] = await db.query(
    `SELECT rek_status FROM trekening WHERE rek_kode = ?`,
    [account]
  );
  return row ? Number(row.rek_status) === 1 : false;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
        jur_no AS nomor,
        DATE_FORMAT(jur_tanggal, '%Y-%m-%d') AS tanggal,
        IFNULL(jur_keterangan, '') AS keterangan,
        jur_isclosed,
       (SELECT jurd_rek_kode FROM tjurnalitem WHERE jurd_jur_no = ? AND jurd_debet > 0 LIMIT 1) AS account,
       (SELECT jurd_debet FROM tjurnalitem WHERE jurd_jur_no = ? AND jurd_debet > 0 LIMIT 1) AS nilai
     FROM tjurnal
     WHERE jur_no = ?`,
    [nomor, nomor, nomor]
  );

  if (!header) throw new Error("Penerimaan lain tidak ditemukan.");

  const tipe = header.nomor.includes("BM") ? "BM" : "KM";

  const [[namaAccount]] = await db.query(
    `SELECT rek_nama AS nama FROM trekening WHERE rek_kode = ?`,
    [header.account]
  );

  const [detailRows] = await db.query(
    `SELECT
       jurd_rek_kode AS account,
       rek_nama AS accountName,
       jurd_kredit AS nilai,
       IFNULL(jurd_keterangan, '') AS memo,
       IFNULL(jurd_cc_kode, '') AS costCenter,
       IFNULL(jurd_cus_kode, '') AS customer
     FROM tjurnalitem
     INNER JOIN trekening ON rek_kode = jurd_rek_kode
     WHERE jurd_jur_no = ? AND jurd_kredit > 0
     ORDER BY jurd_nourut`,
    [nomor]
  );

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    keterangan: header.keterangan,
    nilai: Number(header.nilai),
    account: header.account,
    namaAccount: namaAccount?.nama || "",
    tipe,
    locked: Number(header.jur_isclosed) === 1 ? 1 : 0,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      account: d.account,
      accountName: d.accountName,
      nilai: Number(d.nilai),
      memo: d.memo,
      costCenter: d.costCenter,
      customer: d.customer,
    })),
  };
};

// ── Cek periode sudah ditutup (paritas Delphi cekTutupPeriode) ────────
const cekTutupPeriode = async (tanggal) => {
  const d = new Date(tanggal);
  const [[row]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [d.getMonth() + 1, d.getFullYear()]
  );
  return !!row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, keterangan, nilai, account, detail, tipe,
  } = payload;

  // Paritas Delphi cxButton1/2Click: blok bila periode sudah ditutup
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }

  // Lapis 2: transaksi yang sudah tutup periode tidak boleh diedit
  if (isEdit) {
    const [[hdr]] = await db.query(
      `SELECT jur_isclosed FROM tjurnal WHERE jur_no = ?`,
      [nomor]
    );
    if (hdr && Number(hdr.jur_isclosed) === 1) {
      throw new Error("Transaksi ini sudah tutup Periode,Tidak dapat di edit");
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tjurnal SET
           jur_tanggal = ?, jur_keterangan = ?,
           date_modified = NOW(), user_modified = ?
         WHERE jur_no = ?`,
        [tanggal, keterangan, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang, tipe);
      await conn.query(
        `INSERT INTO tjurnal
           (jur_no, jur_tanggal, jur_keterangan, jur_tipetransaksi, date_create, user_create)
         VALUES (?, ?, ?, 'Penerimaan Lain', NOW(), ?)`,
        [actualNomor, tanggal, keterangan, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tjurnalitem WHERE jurd_jur_no = ?`,
      [actualNomor]
    );

    // Insert header (debet)
    await conn.query(
      `INSERT INTO tjurnalitem
         (jurd_jur_no, jurd_rek_kode, jurd_kredit, jurd_debet, jurd_cc_kode, jurd_keterangan, jurd_nourut)
       VALUES (?, ?, 0, ?, '', ?, 0)`,
      [actualNomor, account, nilai, keterangan]
    );

    // Insert detail (kredit)
    let nourut = 1;
    for (const d of detail) {
      if (Number(d.nilai) > 0 && d.account) {
        await conn.query(
          `INSERT INTO tjurnalitem
             (jurd_jur_no, jurd_rek_kode, jurd_kredit, jurd_debet, jurd_cc_kode, jurd_keterangan, jurd_nourut, jurd_cus_kode)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            actualNomor, d.account, d.nilai, d.costCenter,
            d.memo, nourut, d.customer,
          ]
        );
        nourut++;
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
  searchAccount,
  getAccountByKode,
  searchCostCenter,
  searchCustomer,
  cekBiaya,
  cekTutupPeriode,
  getDetailForm,
  saveData,
};