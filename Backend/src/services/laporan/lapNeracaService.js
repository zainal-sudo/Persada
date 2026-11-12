// services/laporan/lapNeracaService.js
// Migrasi dari Delphi ufrmLapNeraca.pas (Laporan Neraca).
// Aktiva : tkelompok.ISNERACA = 1 dan keterangan = 'D'
// Pasiva : tkelompok.ISNERACA = 1 dan keterangan = 'K'
// Nilai  : SUM(debet - kredit) kumulatif s/d periode terpilih
//          (seluruh tahun < tahun terpilih + tahun terpilih s/d bulan terpilih).
const db = require("../../config/database");

async function getRekening(keterangan, tahun, bulan) {
  const [rows] = await db.query(
    `SELECT r.rek_kode AS kode, r.rek_nama AS akun,
            SUM(IFNULL(d.jurd_debet, 0) - IFNULL(d.jurd_kredit, 0)) AS nilai
       FROM tjurnal j
       INNER JOIN tjurnalitem d ON d.jurd_jur_no = j.jur_no
       INNER JOIN trekening r ON r.rek_kode = d.jurd_rek_kode
       INNER JOIN tkelompok k ON k.KOL_ID = r.rek_kol_id
      WHERE k.ISNERACA = 1 AND k.keterangan = ?
        AND (YEAR(j.jur_tanggal) < ?
             OR (YEAR(j.jur_tanggal) = ? AND MONTH(j.jur_tanggal) <= ?))
      GROUP BY r.rek_kode, r.rek_nama, k.KOL_ID
      ORDER BY k.KOL_ID, r.rek_nama`,
    [keterangan, tahun, tahun, bulan]
  );

  return rows.map((x) => ({
    kode: x.kode,
    akun: x.akun,
    nilai: Number(x.nilai) || 0,
  }));
}

async function getBrowse({ tahun, bulan }) {
  const [aktiva, pasiva] = await Promise.all([
    getRekening("D", tahun, bulan),
    getRekening("K", tahun, bulan),
  ]);
  return { aktiva, pasiva };
}

module.exports = { getBrowse };
