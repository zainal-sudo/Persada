// services/laporan/lapBulanan5Service.js
// Migrasi dari Delphi ufrmLapBulanan5.pas (loaddata) — "Laporan Sales Departemen"
// Grid per departemen: Target, Omset Bulan Ini, Omset sd Bulan Ini,
// Omset Bln ini (Thn Lalu), Omset sd Bln ini (Thn Lalu), Target Thnan, Ratio.
// Kolom Piutang/PlusTunai/ProductFocus/NewCustomer/RSKLINIK tersembunyi di dfm
// dan query-nya dikomentari di pas (dead) -> tidak dihitung.
const db = require("../../config/database");

const WAHID = "( SELECT sls_kode FROM tsalesman WHERE sls_nama LIKE '%WAHID%' AND sls_kode IS NOT NULL )";

// retur CTE per departemen (r dari tretj_hdr), mirip blok retur Delphi
// ktgLike = "4%" (main N3) / "!4" (NOT LIKE "4%") untuk OTHER
// ifEquals = true -> MONTH = bln ; false -> <= bln
function returDeptCte({ bln, thn, ifEquals, ktgLike, wheresls2, dateMode }) {
  const monthCmp = ifEquals ? " = ?" : " <= ?";
  const ktgCond = ktgLike === "4%"
    ? `tb.brg_ktg_kode LIKE '4%'`
    : `(tb.brg_ktg_kode NOT LIKE '4%' OR tb.brg_ktg_kode IS NULL)`;
  const periode = dateMode
    ? `th.retj_tanggal BETWEEN ? AND date_add(?, interval 1 day)`
    : `MONTH(th.retj_tanggal)${monthCmp} AND YEAR(th.retj_tanggal) = ?`;
  // Join tfp_dtl d4 tanpa ini retur memakai tretj_dtl.retjd_harga yang GROSS,
  // sementara penjualan dihitung dari dpp yang NET -> retur terlalu besar dan
  // riil omset terlalu kecil (selisih 4.149.108 untuk Sept 2026). Paritas dengan
  // lapBulanan4Service.js:38-43 (EXISTS/SUM d4, kode BSN:518-534).
  return `(
    SELECT SUBSTRING_INDEX(tb.brg_ktg_kode, '.', 2) AS dept_kode,
      SUM((100 - IFNULL(d4.FPd_discpr, 0)) * d4.FPd_harga * td.retjd_qty / 100) AS total_retur
    FROM tretj_hdr th
    INNER JOIN tretj_dtl td ON td.retjd_retj_nomor = th.retj_nomor
    INNER JOIN tbarang tb ON tb.brg_kode = td.retjd_brg_kode
    INNER JOIN tfp_hdr ON th.retj_fp_nomor = fp_nomor
    LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
    INNER JOIN tsalesmantarget st ON (st.st_sls_Kode = tso_hdr.so_sls_kode AND st_periode = ? AND st_tahun = ?)
    INNER JOIN tfp_dtl d4 ON d4.FPd_FP_nomor = th.retj_fp_nomor
      AND d4.FPd_brg_kode = td.retjd_brg_kode
      AND d4.FPd_expired = td.retjd_expired
    WHERE ${ktgCond} AND ${periode} ${wheresls2}
    GROUP BY SUBSTRING_INDEX(tb.brg_ktg_kode, '.', 2)
  )`;
}

// View penjualanN3bydepartemennew / penjualanN3nondepartemennew memfilter tanggal
// lewat fungsi tg1()/tg2() yang membaca @tg1/@tg2. Tanpa SET, keduanya NULL dan
// view mengembalikan 0 baris. SET + SELECT harus di koneksi yang sama (pool bisa
// memberi koneksi berbeda), makanya query view selalu lewat conn dari getBrowse.
async function setTglRange(conn, bMonth, y, tg1, tg2) {
  await conn.query(
    `SET @bulan1=${bMonth}, @tahun1=${y}, @tg1='${tg1}', @tg2='${tg2}'`);
}

// riil per departemen dari tabel sales (salesTable) utk rentang tanggal
// ktgLike: '4%' main (N3), '!4' OTHER (non N3)
async function deptRiilQuery(conn, salesTable, { from, to, bln, thn, ktgLike, wheresls, wheresls2 }) {
  const sql = `SELECT b.ktg_kode AS dept_kode,
        SUM(IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak)
          - COALESCE(r.total_retur, 0) AS riil
       FROM ${salesTable} a
       INNER JOIN tsalesmantarget st ON (st.st_sls_Kode = a.salesman AND st_periode = ? AND st_tahun = ?)
       INNER JOIN tkategori b ON b.ktg_kode = a.departemen
       LEFT JOIN ${returDeptCte({ bln, thn, ifEquals: true, ktgLike, wheresls2 })} r
         ON r.dept_kode = b.ktg_kode
       WHERE a.tanggal BETWEEN ? AND date_add(?, interval 1 day) ${wheresls}
       GROUP BY b.ktg_kode`;
  const [rows] = await conn.query(sql, [bln, thn, bln, thn, bln, thn, from, to]);
  return rows;
}

// riil YTD (dari Jan s/d tanggal akhir)
async function deptRiilYtdQuery(conn, salesTable, { from, to, bln, thn, ktgLike, wheresls, wheresls2 }) {
  const sql = `SELECT b.ktg_kode AS dept_kode,
        SUM(IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak)
          - COALESCE(r.total_retur, 0) AS riil
       FROM ${salesTable} a
       INNER JOIN tsalesmantarget st ON (st.st_sls_Kode = a.salesman AND st_periode = ? AND st_tahun = ?)
       INNER JOIN tkategori b ON b.ktg_kode = a.departemen
       LEFT JOIN ${returDeptCte({ bln, thn, ifEquals: false, ktgLike, wheresls2 })} r
         ON r.dept_kode = b.ktg_kode
       WHERE a.tanggal BETWEEN ? AND date_add(?, interval 1 day) ${wheresls}
       GROUP BY b.ktg_kode`;
  const [rows] = await conn.query(sql, [bln, thn, bln, thn, bln, thn, from, to]);
  return rows;
}

// target OTHER (non N3) = riil tahun lalu, utk berbagai rentang
async function otherTargetQuery(conn, { from, to, bln, thn, ifEquals, wheresls, wheresls2, dateMode }) {
  const cte = returDeptCte({ bln, thn, ifEquals, ktgLike: "!4", wheresls2, dateMode });
  const sql = `SELECT SUM(p.riil - COALESCE(r.total_retur, 0)) AS target
    FROM (SELECT b.ktg_kode,
            SUM(IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak) AS riil
          FROM Penjualannonn3bydepartemennew a
          INNER JOIN tsalesmantarget st ON (st.st_sls_Kode = a.salesman AND st_periode = ? AND st_tahun = ?)
          INNER JOIN tkategori b ON b.ktg_kode = a.departemen
          WHERE a.tanggal BETWEEN ? AND date_add(?, interval 1 day) ${wheresls}
          GROUP BY b.ktg_kode) p
    LEFT JOIN ${cte} r ON r.dept_kode = p.ktg_kode`;
  const params = [bln, thn, from, to, bln, thn];
  if (dateMode) params.push(from, to);
  else params.push(bln, thn);
  const [rows] = await conn.query(sql, params);
  return rows[0]?.target ?? 0;
}

async function getBrowse(params) {
  // Satu koneksi khusus untuk seluruh query view: @tg1/@tg2 harus di-set pada
  // koneksi yang sama dengan SELECT-nya, dan satu rentang terlebar sudah cukup
  // karena tiap query sudah punya WHERE tanggal sendiri.
  const conn = await db.getConnection();
  try {
    const y = Number(params.tahun);
    const bMonth = Number(params.bulan);
    const fmtDate = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    await setTglRange(
      conn,
      bMonth,
      y,
      `${y - 1}-01-01`,                                   // cAwalPrevJan
      fmtDate(new Date(y, bMonth, 0)),                    // cAkhirBulan
    );
    return await buildReport(conn, params);
  } finally {
    conn.release();
  }
}

async function buildReport(conn, params) {
  const { bulan, tahun, onlySalesman } = params; // bulan 1..12
  const g = Number(onlySalesman) === 0;
  const wheresls = g ? "" : ` AND a.salesman NOT IN ${WAHID}`;
  const wheresls2 = g ? "" : ` AND tso_hdr.so_sls_kode NOT IN ${WAHID}`;

  const y = Number(tahun);
  const bMonth = Number(bulan);
  const dateEndOf = (yy, mm) => new Date(yy, mm, 0);
  const fmtDate = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  const cAwalBulan = `${y}-${String(bMonth).padStart(2, "0")}-01`;
  const cAkhirBulan = fmtDate(dateEndOf(y, bMonth));
  const cAwalYtd = `${y}-01-01`;
  const cAwalPrev = `${y - 1}-${String(bMonth).padStart(2, "0")}-01`;
  const cAkhirPrev = fmtDate(dateEndOf(y - 1, bMonth));
  const cAwalPrevJan = `${y - 1}-01-01`;

  // era tabel tidak dipakai di lapBulanan5: query Delphi (ufrmLapBulanan5.pas:643,834,1022,1211)
  // selalu memakai penjualanN3bydepartemen, cabang tahun di :278-280 tidak pernah dipakai.
  // View *new = versi dengan diskon baris (FPd_discpr) ikut diperhitungkan di DPP
  // dan ketiga komponen biaya. View tanpa akhiran "new" dibiarkan untuk pembanding.
  const salesTable = "penjualann3bydepartemennew";

  // Seed = semua departemen N3 yang ada di tkategori, bukan hanya yang punya
  // target. Sebelumnya INNER JOIN tdepartementarget membuat 4.10 N3 GCU hilang
  // padahal riil-nya 55.241.563; baris tanpa target tetap ditampilkan dengan
  // Target/%/Ratio kosong (lihat return di bawah).
  // Kode departemen = 2 segmen hasil substring_index(brg_ktg_kode,'.',2) di
  // view, jadi yang dipakai di sini juga tepat 2 segmen: satu titik saja.
  // '4.%' + satu titik menyisakan 4.1 (bukan 4.1.1/4.1.10), 4.10, dst.
  const [seedRows] = await db.query(
    " SELECT ktg_kode, ktg_nama departemen FROM tkategori"
    + " WHERE ktg_kode LIKE '4.%' AND LOCATE('.', ktg_kode, 3) = 0",
  );
  const hasil = new Map();
  for (const r of seedRows) hasil.set(r.ktg_kode, { departemen: r.departemen, ktg_kode: r.ktg_kode });
  hasil.set("TOTAL", { departemen: "TOTAL", ktg_kode: "TOTAL" });
  hasil.set("OTHER", { departemen: "OTHER", ktg_kode: "OTHER" });

  // ---- TARGET BULAN INI (main dari tdepartementarget) ----
  const [tBulan] = await db.query(
    " SELECT ktg_kode, dt_targetsales target FROM tdepartementarget"
    + " INNER JOIN tkategori ON ktg_kode = dt_ktg_kode"
    + " WHERE dt_periode = ? AND dt_tahun = ?",
    [bMonth, tahun],
  );
  let totalTargetBulanini = 0;
  for (const r of tBulan) {
    if (hasil.has(r.ktg_kode)) {
      hasil.get(r.ktg_kode).targetbulanini = r.target / 1000;
      // Penanda departure ini punya target; yang tidak → kolom Target/%/Ratio null.
      hasil.get(r.ktg_kode).hasTarget = true;
    }
    totalTargetBulanini += r.target / 1000;
  }
  // TARGET BULAN INI OTHER (tahun lalu bulan sama)
  const otherTargetBulanini = await otherTargetQuery(conn, {
    from: cAwalPrev, to: cAkhirPrev, bln: bMonth, thn: y - 1, ifEquals: true, wheresls, wheresls2,
  });
  hasil.get("OTHER").targetbulanini = otherTargetBulanini / 1000;
  hasil.get("TOTAL").targetbulanini = totalTargetBulanini;
  // TOTAL & OTHER selalu punya target (dihitung dari riil tahun lalu /
  // jumlah tdepartementarget), jadi kolomnya tidak dikosongkan.
  hasil.get("OTHER").hasTarget = true;
  hasil.get("TOTAL").hasTarget = true;

  // ---- TARGET SD BULAN INI (main) ----
  const [tYtd] = await db.query(
    " SELECT ktg_kode, SUM(dt_targetsales) targetsd FROM tdepartementarget"
    + " INNER JOIN tkategori ON ktg_kode = dt_ktg_kode"
    + " WHERE dt_periode <= ? AND dt_tahun = ? GROUP BY ktg_kode",
    [bMonth, tahun],
  );
  let totalTargetSdBulanini = 0;
  for (const r of tYtd) {
    if (hasil.has(r.ktg_kode)) hasil.get(r.ktg_kode).targetsdbulanini = r.targetsd / 1000;
    totalTargetSdBulanini += r.targetsd / 1000;
  }
  const otherTargetSd = await otherTargetQuery(conn, {
    from: cAwalPrevJan, to: cAkhirPrev, bln: bMonth, thn: y - 1, ifEquals: false, wheresls, wheresls2,
  });
  hasil.get("OTHER").targetsdbulanini = otherTargetSd / 1000;
  hasil.get("TOTAL").targetsdbulanini = totalTargetSdBulanini;

  // ---- RIIL CAPAIAN BULAN INI (main N3) ----
  const riilBulan = await deptRiilQuery(conn, salesTable, { from: cAwalBulan, to: cAkhirBulan, bln: bMonth, thn: y, ktgLike: "4%", wheresls, wheresls2 });
  let totalRiilBulanini = 0;
  for (const r of riilBulan) {
    const row = hasil.get(r.dept_kode);
    if (!row) continue;
    row.riilbulanini = r.riil / 1000;
    // Divisor harus target asli: `|| 1` lama membuat baris tanpa target
    // menampilkan persentase raksasa (riil x 100), bukan 0.
    if (row.targetbulanini > 0) row.persenbulanini = row.riilbulanini / row.targetbulanini * 100;
    totalRiilBulanini += r.riil / 1000;
  }

  // RIIL OTHER bulan ini (tahun sekarang)
  const riilOtherBulan = await deptRiilQuery(conn, "penjualannonn3bydepartemennew", { from: cAwalBulan, to: cAkhirBulan, bln: bMonth, thn: y, ktgLike: "!4", wheresls, wheresls2 });
  const otherBulan = riilOtherBulan.reduce((s, r) => s + (r.riil || 0), 0) / 1000;
  hasil.get("OTHER").riilbulanini = otherBulan;
  if (otherBulan > 0) hasil.get("OTHER").persenbulanini = otherBulan / (hasil.get("OTHER").targetbulanini || 1) * 100;

  // TOTAL bulan ini
  hasil.get("TOTAL").riilbulanini = totalRiilBulanini;
  if (totalRiilBulanini > 0 && hasil.get("TOTAL").targetbulanini > 0)
    hasil.get("TOTAL").persenbulanini = totalRiilBulanini / hasil.get("TOTAL").targetbulanini * 100;

  // ---- RIIL sd BULAN INI (main) ----
  const riilYtd = await deptRiilYtdQuery(conn, salesTable, { from: cAwalYtd, to: cAkhirBulan, bln: bMonth, thn: y, ktgLike: "4%", wheresls, wheresls2 });
  let totalRiilSdBulanini = 0;
  for (const r of riilYtd) {
    const row = hasil.get(r.dept_kode);
    if (!row) continue;
    row.riilsdbulanini = r.riil / 1000;
    if (row.targetsdbulanini > 0) row.persensdbulanini = row.riilsdbulanini / row.targetsdbulanini * 100;
    totalRiilSdBulanini += r.riil / 1000;
  }
  const riilOtherYtd = await deptRiilYtdQuery(conn, "penjualannonn3bydepartemennew", { from: cAwalYtd, to: cAkhirBulan, bln: bMonth, thn: y, ktgLike: "!4", wheresls, wheresls2 });
  const otherYtd = riilOtherYtd.reduce((s, r) => s + (r.riil || 0), 0) / 1000;
  hasil.get("OTHER").riilsdbulanini = otherYtd;
  if (otherYtd > 0 && hasil.get("OTHER").targetsdbulanini > 0)
    hasil.get("OTHER").persensdbulanini = otherYtd / hasil.get("OTHER").targetsdbulanini * 100;
  hasil.get("TOTAL").riilsdbulanini = totalRiilSdBulanini;
  if (totalRiilSdBulanini > 0 && hasil.get("TOTAL").targetsdbulanini > 0)
    hasil.get("TOTAL").persensdbulanini = totalRiilSdBulanini / hasil.get("TOTAL").targetsdbulanini * 100;

  // ---- RIIL BULAN INI TAHUN LALU (main) ----
  const riilPrev = await deptRiilQuery(conn, salesTable, { from: cAwalPrev, to: cAkhirPrev, bln: bMonth, thn: y - 1, ktgLike: "4%", wheresls, wheresls2 });
  let totalRiilBulaniniLalu = 0;
  for (const r of riilPrev) {
    const row = hasil.get(r.dept_kode);
    if (!row) continue;
    row.riilbulaninilalu = r.riil / 1000;
    if (r.riil > 0) row.growth = row.riilbulanini / (r.riil / 1000) * 100;
    totalRiilBulaniniLalu += r.riil / 1000;
  }
  const riilOtherPrev = await deptRiilQuery(conn, "penjualannonn3bydepartemennew", { from: cAwalPrev, to: cAkhirPrev, bln: bMonth, thn: y - 1, ktgLike: "!4", wheresls, wheresls2 });
  const otherPrev = riilOtherPrev.reduce((s, r) => s + (r.riil || 0), 0) / 1000;
  hasil.get("OTHER").riilbulaninilalu = otherPrev;
  if (otherPrev > 0) hasil.get("OTHER").growth = otherBulan / otherPrev * 100;
  hasil.get("TOTAL").riilbulaninilalu = totalRiilBulaniniLalu;
  if (totalRiilBulaniniLalu > 0)
    hasil.get("TOTAL").growth = totalRiilBulanini / totalRiilBulaniniLalu * 100;

  // ---- RIIL sd BULAN INI TAHUN LALU (main) ----
  const riilYtdPrev = await deptRiilYtdQuery(conn, salesTable, { from: cAwalPrevJan, to: cAkhirPrev, bln: bMonth, thn: y - 1, ktgLike: "4%", wheresls, wheresls2 });
  let totalRiilSdBulaniniLalu = 0;
  for (const r of riilYtdPrev) {
    const row = hasil.get(r.dept_kode);
    if (!row) continue;
    row.riilsdbulaninilalu = r.riil / 1000;
    if (r.riil > 0) row.growth2 = row.riilsdbulanini / (r.riil / 1000) * 100;
    totalRiilSdBulaniniLalu += r.riil / 1000;
  }
  const riilOtherYtdPrev = await deptRiilYtdQuery(conn, "penjualannonn3bydepartemennew", { from: cAwalPrevJan, to: cAkhirPrev, bln: bMonth, thn: y - 1, ktgLike: "!4", wheresls, wheresls2 });
  const otherYtdPrev = riilOtherYtdPrev.reduce((s, r) => s + (r.riil || 0), 0) / 1000;
  hasil.get("OTHER").riilsdbulaninilalu = otherYtdPrev;
  if (otherYtdPrev > 0) hasil.get("OTHER").growth2 = otherYtd / otherYtdPrev * 100;
  hasil.get("TOTAL").riilsdbulaninilalu = totalRiilSdBulaniniLalu;
  if (totalRiilSdBulaniniLalu > 0)
    hasil.get("TOTAL").growth2 = totalRiilSdBulanini / totalRiilSdBulaniniLalu * 100;

  // ---- TARGET TAHUNAN (main) ----
  const [tTahunan] = await db.query(
    " SELECT ktg_kode, SUM(dt_targetsales) target FROM tdepartementarget"
    + " INNER JOIN tkategori ON ktg_kode = dt_ktg_kode"
    + " WHERE dt_tahun = ? GROUP BY ktg_kode",
    [tahun],
  );
  let totalTargetTahunan = 0;
  for (const r of tTahunan) {
    const row = hasil.get(r.ktg_kode);
    if (!row) continue;
    row.targettahunan = r.target / 1000;
    if (row.targettahunan > 0) row.ratio = row.riilsdbulanini / row.targettahunan * 100;
    totalTargetTahunan += r.target / 1000;
  }
  // target tahunan OTHER = riil tahun lalu penuh (non N3), retur via tanggal
  const otherTargetTahunan = await otherTargetQuery(conn, {
    from: cAwalPrevJan, to: `${y - 1}-12-31`, bln: bMonth, thn: y - 1, ifEquals: false, wheresls, wheresls2, dateMode: true,
  });
  hasil.get("OTHER").targettahunan = otherTargetTahunan / 1000;
  if (otherTargetTahunan > 0) hasil.get("OTHER").ratio = otherYtd / (otherTargetTahunan / 1000) * 100;
  // TOTAL
  hasil.get("TOTAL").targettahunan = totalTargetTahunan;
  if (totalTargetTahunan > 0) hasil.get("TOTAL").ratio = totalRiilSdBulanini / totalTargetTahunan * 100;

  // Kolom Target/%/Ratio bernilai null (bukan 0) untuk departemen tanpa target:
// 0 berarti "punya target dan tidak tercapai", null berarti "tidak ada target
// sama sekali". Riil & Growth selalu angka — riil itu hasil penjualan nyata.
  return [...hasil.values()].map((r) => {
    const t = r.hasTarget;
    return {
      Departemen: r.departemen,
      ktg_kode: r.ktg_kode,
      hasTarget: t,
      TargetBulanini: t ? r.targetbulanini ?? 0 : null,
      Targetsdbulanini: t ? r.targetsdbulanini ?? 0 : null,
      riilbulanini: r.riilbulanini ?? 0,
      persenbulanini: t ? r.persenbulanini ?? 0 : null,
      riilsdbulanini: r.riilsdbulanini ?? 0,
      persensdbulanini: t ? r.persensdbulanini ?? 0 : null,
      riilbulaninilalu: r.riilbulaninilalu ?? 0,
      growth: r.growth ?? 0,
      riilsdbulaniniLalu: r.riilsdbulaninilalu ?? 0,
      growth2: r.growth2 ?? 0,
      targettahunan: t ? r.targettahunan ?? 0 : null,
      ratio: t ? r.ratio ?? 0 : null,
    };
  });
}

module.exports = { getBrowse };