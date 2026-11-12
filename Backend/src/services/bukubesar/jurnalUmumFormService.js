const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-JUR.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(jur_no, 4) AS UNSIGNED)), 0) AS max_val
     FROM tjurnal
     WHERE jur_no LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// ── Search Account ───────────────────────────────────────────────────
const searchAccount = async (search = "") => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     WHERE rek_isaktif = 1
       AND (rek_nama LIKE ? OR rek_kode LIKE ?)
     ORDER BY rek_nama
     LIMIT 100`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Search Cost Center ───────────────────────────────────────────────
const searchCostCenter = async () => {
  const [rows] = await db.query(
    `SELECT cc_kode AS kode, cc_nama AS nama FROM tcostcenter ORDER BY cc_nama`
  );
  return rows;
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       jur_no AS nomor,
       DATE_FORMAT(jur_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(jur_keterangan, '') AS keterangan
     FROM tjurnal
     WHERE jur_no = ?`,
    [nomor]
  );

  if (!header) throw new Error("Jurnal umum tidak ditemukan.");

  // Cek IsClosed (paritas Delphi guard edit)
  const [[closedRow]] = await db.query(
    `SELECT jur_isclosed FROM tjurnal WHERE jur_no = ?`, [nomor]);
  const locked = Number(closedRow?.jur_isclosed) === 1;

  const [detailRows] = await db.query(
    `SELECT
       jurd_rek_kode AS account,
       rek_nama AS accountName,
       jurd_debet AS debet,
       jurd_kredit AS kredit,
       IFNULL(jurd_keterangan, '') AS memo,
       IFNULL(jurd_cc_kode, '') AS costCenter
     FROM tjurnalitem
     INNER JOIN trekening ON rek_kode = jurd_rek_kode
     WHERE jurd_jur_no = ?
     ORDER BY jurd_nourut`,
    [nomor]
  );

  return {
    ...header,
    locked,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      account: d.account,
      accountName: d.accountName,
      debet: Number(d.debet),
      kredit: Number(d.kredit),
      memo: d.memo,
      costCenter: d.costCenter,
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
  const { isEdit, nomor, tanggal, keterangan, detail } = payload;

  // cekTutupPeriode (paritas Delphi)
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
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
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tjurnal
           (jur_no, jur_tanggal, jur_keterangan, jur_tipetransaksi, date_create, user_create)
         VALUES (?, ?, ?, 'Jurnal Umum', NOW(), ?)`,
        [actualNomor, tanggal, keterangan, user.kode]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM tjurnalitem WHERE jurd_jur_no = ?`,
      [actualNomor]
    );

    // Insert detail
    let nourut = 1;
    for (const d of detail) {
      if (d.account && (Number(d.debet) > 0 || Number(d.kredit) > 0)) {
        await conn.query(
          `INSERT INTO tjurnalitem
             (jurd_jur_no, jurd_rek_kode, jurd_debet, jurd_kredit, jurd_cc_kode, jurd_keterangan, jurd_nourut)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.account, d.debet, d.kredit,
            d.costCenter, d.memo, nourut,
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
  searchCostCenter,
  cekTutupPeriode,
  getDetailForm,
  saveData,
};