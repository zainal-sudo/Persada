// services/utility/tutupPeriodeService.js
// Migrasi dari Delphi ufrmtutupperiode.pas (Tutup Periode)
// Tutup: generate jurnal LBT (LABA RUGI) bulan berjalan + LBD (LABA DITAHAN) bila Januari.
// Buka  : hapus record ttutupperiode.
const db = require("../../config/database");

const pad = (n) => String(n).padStart(2, "0");

const valPeriod = (bulan, tahun) => {
  const m = Number(bulan);
  const t = Number(tahun);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Bulan tidak valid.");
  if (!Number.isInteger(t) || t < 2000 || t > 2100) throw new Error("Tahun tidak valid.");
  return { m, t };
};

// Sum laba: delta debet-kredit jurnal non-neraca (isneraca=0), opsi filter bulan pada tahun tertentu.
const sumLaba = async (conn, tahun, bulan) => {
  const sql = `
    SELECT SUM(jurd_debet - jurd_kredit) AS nilai
    FROM tjurnal
    INNER JOIN tjurnalitem ON jurd_jur_no = jur_no
    INNER JOIN trekening ON REK_KODE = jurd_rek_kode
    INNER JOIN tkelompok ON KOL_ID = REK_KOL_ID
    WHERE YEAR(jur_tanggal) = ? AND ISNERACA = 0
    ${bulan ? "AND MONTH(jur_tanggal) = ?" : ""}`;
  const params = bulan ? [tahun, bulan] : [tahun];
  const [rows] = await conn.query(sql, params);
  return Number(rows[0]?.nilai) || 0;
};

// Hapus + insert satu jurnal penutup beserta 2 item (debet 0 / kredit nilai dan kebalikannya).
const tulisJurnal = async (conn, { nomor, tanggal, tipetransaksi, keterangan, nilai, rekKredit, rekDebet, userKode }) => {
  await conn.query("DELETE FROM tjurnalitem WHERE jurd_jur_no = ?", [nomor]);
  await conn.query("DELETE FROM tjurnal WHERE jur_no = ?", [nomor]);

  await conn.query(
    `INSERT INTO tjurnal
       (jur_no, jur_tanggal, jur_tipetransaksi, jur_keterangan, jur_isclosed, date_create, user_create)
     VALUES (?, ?, ?, ?, 1, NOW(), ?)`,
    [nomor, tanggal, tipetransaksi, keterangan, userKode]
  );
  await conn.query(
    `INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_kredit, jurd_debet, jurd_nourut)
     VALUES (?, ?, ?, 0, 1)`,
    [nomor, rekKredit, nilai]
  );
  await conn.query(
    `INSERT INTO tjurnalitem (jurd_jur_no, jurd_rek_kode, jurd_kredit, jurd_debet, jurd_nourut)
     VALUES (?, ?, 0, ?, 2)`,
    [nomor, rekDebet, nilai]
  );
};

const getLast = async () => {
  const [rows] = await db.query(
    `SELECT TUTUP_BULAN AS bulan, TUTUP_TAHUN AS tahun
     FROM ttutupperiode
     ORDER BY TUTUP_TAHUN DESC, TUTUP_BULAN DESC
     LIMIT 1`
  );
  return rows[0] || null;
};

const proses = async (payload, user) => {
  const { m, t } = valPeriod(payload.bulan, payload.tahun);
  // Tanggal terakhir bulan (akhir = EndOfTheMonth pada Delphi)
  const akhir = new Date(t, m, 0);
  const lastDate = `${t}-${pad(m)}-${pad(akhir.getDate())}`;
  const kode = (user && user.kode) || "";

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    // Januari → jurnal LABA DITAHAN (laba tahun sebelumnya)
    if (m === 1) {
      const nilai = await sumLaba(conn, t - 1);
      await tulisJurnal(conn, {
        nomor: `LBD${m}${t}`,
        tanggal: lastDate,
        tipetransaksi: "LABA DITAHAN",
        keterangan: "LR TAHUNAN",
        nilai,
        rekKredit: "20.004", // LABA TAHUN BERJALAN
        rekDebet: "20.002", // LABA DITAHAN
        userKode: kode,
      });
    }

    // Jurnal LABA RUGI bulan berjalan — selalu
    const nilai = await sumLaba(conn, t, m);
    await tulisJurnal(conn, {
      nomor: `LBT${m}${t}`,
      tanggal: lastDate,
      tipetransaksi: "LABA RUGI",
      keterangan: "LR",
      nilai,
      rekKredit: "27.001", // LABA RUGI
      rekDebet: "20.004", // LABA TAHUN BERJALAN
      userKode: kode,
    });

    await conn.query(
      "INSERT IGNORE INTO ttutupperiode (TUTUP_BULAN, TUTUP_TAHUN) VALUES (?, ?)",
      [m, t]
    );

    await conn.commit();
    return { bulan: m, tahun: t };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const buka = async (payload) => {
  const { m, t } = valPeriod(payload.bulan, payload.tahun);
  await db.query("DELETE FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ?", [m, t]);
};

module.exports = { getLast, proses, buka };