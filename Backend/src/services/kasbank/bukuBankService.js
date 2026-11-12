const db = require("../../config/database");

// â”€â”€ Get Rekening â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getRekening = async () => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     ORDER BY rek_kode`
  );
  return rows;
};

// â”€â”€ Buku Bank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Paritas ufrmListKas.pas (61-104): transaksi periode dari DUA blok UNION â€”
//   * sendiri=1  : jurnal utk rekening ini cuma 1 baris -> pakai jurd_kredit->Debet, jurd_debet->Kredit (rekan)
//   * sendiri>1  : jurnal multi-baris -> DISTINCT, a.kredit->Debet, a.debet->Kredit
// Definisi "sendiri" = banyak baris debet/kredit >0 pada rekening ini di jurnal tersebut.
const getBukuBank = async (rekkode, startDate, endDate) => {
  // â”€â”€ Step 1: Saldo Awal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [[saldoAwalRow]] = await db.query(
    `SELECT IFNULL(SUM(jurd_debet - jurd_kredit), 0) AS saldo
     FROM tjurnalitem
     INNER JOIN tjurnal ON jurd_jur_no = jur_no
     WHERE jurd_rek_kode = ?
       AND jur_tanggal < ?`,
    [rekkode, startDate]
  );
  const saldoAwal = Number(saldoAwalRow.saldo) || 0;

  // Subquery baris rekening yang disorot (dipakai kedua blok).
  const subRek = `(
       SELECT jurd_jur_no AS nomor, jur_tanggal AS tanggal, jur_tipetransaksi,
              jur_keterangan, jurd_debet AS debet, jurd_kredit AS kredit,
              jurd_cc_kode AS cc
       FROM tjurnalitem
       INNER JOIN tjurnal ON jurd_jur_no = jur_no
       WHERE jurd_rek_kode = ? AND jur_tanggal BETWEEN ? AND ?
     )`;

  // "sendiri": jumlah baris rekening ini di jurnal tsb (paritas Delphi).
  const sendiriExpr = `(CASE WHEN a.debet > 0
        THEN (SELECT COUNT(*) FROM tjurnalitem WHERE jurd_jur_no = a.nomor AND jurd_debet > 0)
        ELSE (SELECT COUNT(*) FROM tjurnalitem WHERE jurd_jur_no = a.nomor AND jurd_kredit > 0)
      END)`;

  // â”€â”€ Blok A: jurnal dengan 1 baris di rekening ini (sendiri = 1) â”€â”€â”€â”€â”€
  const blokA = `
    SELECT b.jurd_jur_no AS Nomor,
           DATE_FORMAT(a.tanggal, '%Y-%m-%d') AS Tanggal,
           a.jur_keterangan AS Keterangan,
           rek_nama AS Rekening,
           b.jurd_kredit AS Debet,
           b.jurd_debet AS Kredit,
           0 AS Saldo,
           a.cc AS Memo,
           ${sendiriExpr} AS vself
    FROM tjurnalitem b
    INNER JOIN ${subRek} a ON b.jurd_jur_no = a.nomor
    INNER JOIN trekening ON rek_kode = jurd_rek_kode
    WHERE jurd_rek_kode <> ?`;

  // â”€â”€ Blok B: jurnal multi-baris di rekening ini (sendiri > 1) â”€â”€â”€â”€â”€â”€â”€â”€
  const blokB = `
    SELECT DISTINCT b.jurd_jur_no AS Nomor,
           DATE_FORMAT(a.tanggal, '%Y-%m-%d') AS Tanggal,
           a.jur_keterangan AS Keterangan,
           (CASE WHEN a.debet > 0 THEN
                (SELECT rek_nama FROM tjurnalitem
                 INNER JOIN trekening ON rek_kode = jurd_rek_kode
                 WHERE jurd_jur_no = b.jurd_jur_no AND jurd_kredit > 0 LIMIT 1)
            ELSE
                (SELECT rek_nama FROM tjurnalitem
                 INNER JOIN trekening ON rek_kode = jurd_rek_kode
                 WHERE jurd_jur_no = b.jurd_jur_no AND jurd_debet > 0 LIMIT 1)
            END) AS Rekening,
           (CASE WHEN a.debet > 0 THEN a.debet ELSE 0 END) AS Kredit,
           (CASE WHEN a.kredit > 0 THEN a.kredit ELSE 0 END) AS Debet,
           0 AS Saldo,
           a.cc AS Memo,
           ${sendiriExpr} AS vself
    FROM tjurnalitem b
    INNER JOIN ${subRek} a ON b.jurd_jur_no = a.nomor
    INNER JOIN trekening ON rek_kode = jurd_rek_kode
    WHERE jurd_rek_kode <> ?`;

const params = [rekkode, startDate, endDate, rekkode];

  // Ambil baris turunan TANPA filter lapisan; pisahkan sendiri=1 / sendiri>1
  // di JS. (MySQL: `WHERE` terhadap kolom turunan di derived + placeholder
  // parameterized tidak konsisten — membeda-bedakan hasil; filter di JS aman
  // dan jumlah baris kecil.)
  const [allA] = await db.query(
    `SELECT Nomor, Tanggal, Keterangan, Rekening, Debet, Kredit, Saldo, Memo, vself
       FROM (${blokA}) xA`,
    params,
  );
  const [allB] = await db.query(
    `SELECT Nomor, Tanggal, Keterangan, Rekening, Debet, Kredit, Saldo, Memo, vself
       FROM (${blokB}) xB`,
    params,
  );
  const rows = [
    ...allA.filter((r) => Number(r.vself) === 1),
    ...allB.filter((r) => Number(r.vself) > 1),
  ].sort((x, y) =>
    x.Tanggal === y.Tanggal ? String(x.Nomor).localeCompare(String(y.Nomor)) : String(x.Tanggal).localeCompare(String(y.Tanggal)),
  );

  // â”€â”€ Step 3: Hitung running saldo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let xsaldo = saldoAwal;
  const result = [];

  // Baris Saldo Awal
  result.push({
    Nomor: "",
    Tanggal: startDate,
    Keterangan: "Saldo Awal",
    Rekening: "",
    Debet: 0,
    Kredit: 0,
    Saldo: saldoAwal,
    Memo: "",
  });

  for (const row of rows) {
    xsaldo = xsaldo + Number(row.Debet) - Number(row.Kredit);
    result.push({
      Nomor: row.Nomor,
      Tanggal: row.Tanggal,
      Keterangan: row.Keterangan,
      Rekening: row.Rekening,
      Debet: Number(row.Debet),
      Kredit: Number(row.Kredit),
      Saldo: xsaldo,
      Memo: row.Memo,
    });
  }

  return result;
};

module.exports = { getRekening, getBukuBank };