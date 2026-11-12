// services/laporan/omsetVsKategoriService.js
// Migrasi dari Delphi ufrmOmsetvsOmsetKategori.pas (btnRefreshClick)
// Pivot manual per kategori terpilih (maks 3) + total Omset, per outlet (cus_nama).
// Sumber: tfp_dtl - tfp_hdr - tbarang - tcustomer + retur tretj.
const db = require("../../config/database");

// Tabel kategori tingkat 3 untuk dropdown
const getKategori = async () => {
  const [rows] = await db.query(
    `SELECT ktg_kode AS kode, ktg_nama AS kategori
       FROM tkategori
      WHERE ktg_tingkat = 3
      ORDER BY ktg_nama`
  );
  return rows;
};

// Rumus nilai bersih sebuah baris faktur (net of retur & CN & biaya promosi)
const OM = (qtyAlias) =>
  `(100 - fpd_discpr) * (fpd_harga * (${qtyAlias})) / 100`
  + ` - fpd_cn * ((100 - fpd_discpr) * fpd_harga / 100) * (${qtyAlias}) / 100`
  + ` - ((${qtyAlias}) * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr / 100) + (fpd_qty * fpd_bp_rp))`
  + ` - ((${qtyAlias}) * (((100 - fpd_discpr) * fpd_harga / 100) * fpd_bp_pr2 / 100) + (fpd_qty * fpd_bp_rp2))`;

const getBrowse = async ({ startDate, endDate, kategori1, kategori2, kategori3 }) => {
  if (!startDate || !endDate) throw new Error("startDate dan endDate wajib.");

  const ktgList = [kategori1, kategori2, kategori3]
    .filter((k) => k !== undefined && k !== null && k !== "");

  // ── SELECT: Outlet + kolom per kategori + kolom Omset ──
  let select = "cus_nama AS Outlet";
  const binds = [];

  for (const kode of ktgList) {
    // alias kolom = kode kategori (di-sanitasi). Header title di FE pakai ktg_nama.
    const alias = kode.replace(/[^a-zA-Z0-9_]/g, "_");
    select += `, COALESCE(SUM(CASE WHEN ktg_kode = ? THEN ${OM("fpd_qty - IFNULL(retjd_qty, 0)")} END), 0) AS \`${alias}\``;
    binds.push(kode);
  }

  select += `, COALESCE(SUM(${OM("fpd_qty - IFNULL(retjd_qty, 0)")}), 0) AS Omset`;

  // ── Query final ──
  const sql = `
    SELECT ${select}
      FROM tfp_dtl
      INNER JOIN tfp_hdr   ON fpd_fp_nomor = fp_nomor
      INNER JOIN tbarang   ON fpd_brg_kode = brg_kode
      INNER JOIN tcustomer ON fp_cus_kode  = cus_kode
      LEFT JOIN tkategori  ON ktg_kode     = brg_ktg_kode
      LEFT JOIN tretj_hdr  ON retj_fp_nomor = fp_nomor
      LEFT JOIN tretj_dtl  ON retjd_retj_nomor = retj_nomor
                          AND retjd_brg_kode = fpd_brg_kode
                          AND fpd_expired = retjd_expired
     WHERE fp_tanggal BETWEEN ? AND ?
     GROUP BY cus_nama
     ORDER BY cus_nama
  `;

  const dateBinds = [
    startDate,
    `${endDate} 23:59:59`,
  ];

  const [rows] = await db.query(sql, [...binds, ...dateBinds]);
  return rows;
};

module.exports = { getKategori, getBrowse };
