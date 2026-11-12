const db = require("../../config/database");

// ── Get Rekening ─────────────────────────────────────────────────────
const getRekening = async () => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     ORDER BY rek_kode`
  );
  return rows;
};

// ── Kas Harian ───────────────────────────────────────────────────────
const getKasHarian = async (rekkode, tanggal) => {
  // ── Step 1: Saldo Awal ─────────────────────────────────────────────
  const [[saldoAwalRow]] = await db.query(
    `SELECT IFNULL(SUM(jurd_debet - jurd_kredit), 0) AS saldo
     FROM tjurnalitem
     INNER JOIN tjurnal ON jurd_jur_no = jur_no
     WHERE jurd_rek_kode = ?
       AND jur_tanggal < ?`,
    [rekkode, tanggal]
  );
  const saldoAwal = Number(saldoAwalRow.saldo) || 0;

  // ── Step 2: Rekap harian ────────────────────────────────────────────
  const [rows] = await db.query(
    `SELECT
       IFNULL(s.sls_nama, j.jur_keterangan) AS Keterangan,
       SUM(d.jurd_debet) AS Debet,
       SUM(d.jurd_kredit) AS Kredit
     FROM tjurnalitem d
     INNER JOIN tjurnal j ON j.jur_no = d.jurd_jur_no
     LEFT JOIN pembayaran p ON j.jur_no = p.nomor
     LEFT JOIN tsalesman s ON s.sls_kode = p.salesman
     WHERE d.jurd_rek_kode = ?
       AND j.jur_tanggal = ?
     GROUP BY IFNULL(s.sls_nama, j.jur_keterangan)
     ORDER BY Keterangan`,
    [rekkode, tanggal]
  );

  // ── Step 3: Hitung running saldo ───────────────────────────────────
  let xsaldo = saldoAwal;
  const result = [];

  // Baris Saldo Awal
  result.push({
    Keterangan: "Saldo Awal",
    Debet: 0,
    Kredit: 0,
    Saldo: saldoAwal,
  });

  for (const row of rows) {
    xsaldo = xsaldo + Number(row.Debet) - Number(row.Kredit);
    result.push({
      Keterangan: row.Keterangan,
      Debet: Number(row.Debet),
      Kredit: Number(row.Kredit),
      Saldo: xsaldo,
    });
  }

  return result;
};

module.exports = { getRekening, getKasHarian };