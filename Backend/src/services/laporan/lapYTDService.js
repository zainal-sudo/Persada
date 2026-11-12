// services/laporan/lapYTDService.js
// Migrasi dari Delphi ufrmLapYTD.pas (loaddata) — "Laporan Year to Date"
// Satuan per periode (bulan): Tahun, Bulan, Target, Pencapaian(Riil), presentase,
// PencapaianLalu(Riil Tahun Lalu), growth. Nilai langsung (tanpa /1000) persis Delphi.
const db = require("../../config/database");

const EXCL = "'KONTRAK','ONLINE','SEWA','KANTOR','INTERNAL'";

// Subquery riil per bulan/tahun dari tfp_hdr (derived A di Delphi), utk dipakai
// di dua tempat (pencapaian & pencapaianLalu). Kolom: Bulan, Tahun, riil.
function riilDerived() {
  return `(
    SELECT MONTH(zzz.fp_tanggal) Bulan, YEAR(zzz.fp_tanggal) Tahun,
      SUM(zzz.fp_amount) Realisasi,
      SUM((zzz.Fp_biayapr * (zzz.fp_amount - zzz.fp_taxamount) / 100) + zzz.fp_biayarp) Biaya_promosi,
      SUM(zzz.fp_cn) Kontrak,
      (SELECT SUM(IFNULL(th.retj_amount, 0))
        FROM tretj_hdr th
        INNER JOIN tfp_hdr ON th.retj_fp_nomor = fp_nomor
        LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
        INNER JOIN tsalesman ON sls_kode = so_sls_kode
        WHERE YEAR(th.retj_tanggal) = YEAR(zzz.fp_tanggal)
          AND MONTH(th.retj_tanggal) = MONTH(zzz.fp_tanggal)
          AND sls_nama NOT IN (${EXCL})) Retur
    FROM tfp_hdr zzz
    LEFT JOIN tso_hdr zz ON so_nomor = zzz.fp_so_nomor
    RIGHT JOIN tsalesman z ON sls_kode = so_sls_kode
    WHERE z.sls_nama NOT IN (${EXCL})
    GROUP BY MONTH(zzz.fp_tanggal), YEAR(zzz.fp_tanggal)
  ) A`;
}

async function getBrowse(params) {
  const { bulan, tahun } = params;

  const sql =
    " SELECT st_tahun Tahun,"
    + " CASE st_periode"
    + "   WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' WHEN 3 THEN 'Maret' WHEN 4 THEN 'April'"
    + "   WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni' WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus'"
    + "   WHEN 9 THEN 'September' WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' ELSE 'Desember' END Bulan,"
    + " target,"
    + " pencapaian,"
    + " pencapaian / target * 100 presentase,"
    + " PencapaianLalu,"
    + " pencapaian / pencapaianLalu * 100 growth"
    + " FROM ("
    + "   SELECT f.st_tahun, f.st_periode, SUM(f.st_targetsales) target,"
    + "     (SELECT riil FROM ("
    + "       SELECT Realisasi - Kontrak - Biaya_promosi - IFNULL(Retur, 0) riil, Bulan, Tahun FROM " + riilDerived()
    + "     ) R WHERE R.Bulan = f.st_periode AND R.Tahun = f.st_tahun) pencapaian,"
    + "     (SELECT riil FROM ("
    + "       SELECT Realisasi - Kontrak - Biaya_promosi - IFNULL(Retur, 0) riil, Bulan, Tahun FROM " + riilDerived()
    + "     ) R WHERE R.Bulan = f.st_periode AND R.Tahun = f.st_tahun - 1) PencapaianLalu"
    + "   FROM tsalesmantarget f"
    + "   WHERE f.st_tahun = ? AND f.st_periode <= ?"
    + "   GROUP BY f.st_periode"
    + " ) final";

  const [rows] = await db.query(sql, [tahun, bulan]);
  return rows;
}

module.exports = { getBrowse };