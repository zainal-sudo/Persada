// services/laporan/lapLabaRugiService.js
// Migrasi dari Delphi ufrmLapLabaRugi.pas (Laporan Laba Rugi).
// Hanya rekening dengan tkelompok.ISNERACA = 0.
// Nilai per bulan = SUM(kredit - debet).
// Struktur baris (sama seperti Delphi):
//   - akun kelompok 10 (PENDAPATAN USAHA)
//   - TOTAL PENJUALAN            = SUM(kol 10)
//   - akun kelompok 9 (BPP)
//   - LABA KOTOR                 = SUM(kol 10, 9)
//   - akun kelompok 12, 13 (BIAYA)
//   - TOTAL BIAYA                = SUM(kol 12, 13)
//   - akun kelompok 11, 14 (PENDAPATAN DILUAR USAHA)
//   - TOTAL PENDAPATAN           = SUM(kol 11, 14)
//   - LABA BERSIH                = SUM(semua kol ISNERACA = 0)
const db = require("../../config/database");

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sept", "Okt", "Nov", "Des",
];

async function getBrowse({ tahun, bulan1, bulan2 }) {
  const b1 = Math.min(bulan1, bulan2);
  const b2 = Math.max(bulan1, bulan2);

  const [accounts] = await db.query(
    `SELECT k.KOL_ID AS kolId, r.rek_kode AS kode, r.rek_nama AS akun
       FROM trekening r
       INNER JOIN tkelompok k ON k.KOL_ID = r.rek_kol_id
      WHERE k.ISNERACA = 0 AND k.KOL_ID IN (9, 10, 11, 12, 13, 14)
      ORDER BY r.rek_urutan, r.rek_nama`
  );

  const [perRek] = await db.query(
    `SELECT MONTH(j.jur_tanggal) AS bulan, d.jurd_rek_kode AS kode,
            SUM(IFNULL(d.jurd_kredit, 0) - IFNULL(d.jurd_debet, 0)) AS nilai
       FROM tjurnal j
       INNER JOIN tjurnalitem d ON d.jurd_jur_no = j.jur_no
       INNER JOIN trekening r ON r.rek_kode = d.jurd_rek_kode
       INNER JOIN tkelompok k ON k.KOL_ID = r.rek_kol_id
      WHERE k.ISNERACA = 0 AND YEAR(j.jur_tanggal) = ?
        AND MONTH(j.jur_tanggal) BETWEEN ? AND ?
      GROUP BY bulan, d.jurd_rek_kode`,
    [tahun, b1, b2]
  );

  const [perKol] = await db.query(
    `SELECT MONTH(j.jur_tanggal) AS bulan, k.KOL_ID AS kolId,
            SUM(IFNULL(d.jurd_kredit, 0) - IFNULL(d.jurd_debet, 0)) AS nilai
       FROM tjurnal j
       INNER JOIN tjurnalitem d ON d.jurd_jur_no = j.jur_no
       INNER JOIN trekening r ON r.rek_kode = d.jurd_rek_kode
       INNER JOIN tkelompok k ON k.KOL_ID = r.rek_kol_id
      WHERE k.ISNERACA = 0 AND YEAR(j.jur_tanggal) = ?
        AND MONTH(j.jur_tanggal) BETWEEN ? AND ?
      GROUP BY bulan, k.KOL_ID`,
    [tahun, b1, b2]
  );

  const months = [];
  for (let m = b1; m <= b2; m++) {
    months.push({ bulan: m, label: MONTH_LABELS[m - 1] || String(m) });
  }

  const rekMap = new Map();
  for (const row of perRek) {
    if (!rekMap.has(row.kode)) rekMap.set(row.kode, {});
    rekMap.get(row.kode)[row.bulan] = Number(row.nilai) || 0;
  }

  const kolMap = new Map();
  for (const row of perKol) {
    if (!kolMap.has(row.kolId)) kolMap.set(row.kolId, {});
    kolMap.get(row.kolId)[row.bulan] = Number(row.nilai) || 0;
  }

  const rows = [];

  const pushAccounts = (kols) => {
    for (const a of accounts) {
      if (!kols.includes(a.kolId)) continue;
      rows.push({
        keterangan: a.akun,
        isTotal: false,
        nilai: rekMap.get(a.kode) || {},
      });
    }
  };

  const pushTotal = (label, kols) => {
    const nilai = {};
    for (const m of months) {
      let v = 0;
      for (const kol of kols) {
        const byMonth = kolMap.get(kol);
        if (byMonth && byMonth[m.bulan] != null) v += byMonth[m.bulan];
      }
      nilai[m.bulan] = v;
    }
    rows.push({ keterangan: label, isTotal: true, nilai });
  };

  pushAccounts([10]);
  pushTotal("TOTAL PENJUALAN", [10]);
  pushAccounts([9]);
  pushTotal("LABA KOTOR", [10, 9]);
  pushAccounts([12, 13]);
  pushTotal("TOTAL BIAYA", [12, 13]);
  pushAccounts([11, 14]);
  pushTotal("TOTAL PENDAPATAN", [11, 14]);
  pushTotal("LABA BERSIH", [9, 10, 11, 12, 13, 14]);

  const result = rows.map((r) => {
    let total = 0;
    for (const m of months) total += r.nilai[m.bulan] || 0;
    return { ...r, total };
  });

  return { months, rows: result };
}

module.exports = { getBrowse };
