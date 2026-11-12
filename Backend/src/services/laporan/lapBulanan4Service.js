// services/laporan/lapBulanan4Service.js
// Laporan Sales Bulanan New. Rumus riil + retur mengikuti
// BSN\ufrmLapBulanan4.pas (JKT). Catatan asal:
//  - Several bagian sengaja TIDAK mengikuti JKT, karena versi web yang benar:
//    seed kolom nama (rayon + nama salesman dari tsalesmanaktif) dan
//    7 kategori rsklinik (RS,KL,PS,RSA,RSB,RSC,RSD). Di JKT, kolom "Salesman"
//    sebenarnya berisi nama rayon dan rsklinik hanya 3 kategori.
//  - Subquery retur masih join salesman lewat fp_so_nomor, JKT lewat tdo_hdr.
//    Belum diverifikasi apakah keduanya selalu sama.
//
// OPTIMASI (hasil angka tetap sama dengan Delphi untuk bagian yang mengikuti):
//  - 8 query riil digabung jadi 2 (conditional aggregation); retur dihitung sekali
//    per (salesman, tahun, bulan) lalu dijumlahkan sesuai periode.
//  - Filter bulan memakai range tanggal (tanggal >= awal AND < akhir+1hari), bukan
//    MONTH()/YEAR(), supaya index terpakai.
//  - NOT IN diganti LEFT JOIN ... IS NULL.
//  - Query-query yang saling bebas dijalankan paralel (Promise.all).
const db = require("../../config/database");

const KTG_N3 = "4%";

const pad = (n) => String(n).padStart(2, "0");
// hari terakhir bulan (mm 1..12)
const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
const awalBulan = (yy, mm) => `${yy}-${pad(mm)}-01`;
const akhirBulan = (yy, mm) => `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`;

// ── Rumus retur (persis seperti versi Delphi) ─────────────────────
function returFormula(ktgMode, pretur) {
  const ktgCond = ktgMode === "pf"
    ? `b2.brg_ktg_kode LIKE '${KTG_N3}'`
    : `(b2.brg_ktg_kode NOT LIKE '${KTG_N3}' OR b2.brg_ktg_kode IS NULL)`;
  // Join tfp_dtl d4. Tanpa ini nilai retur memakai tretj_dtl.retjd_harga yang
  // GROSS (bukti: pf query di BSN:989 mengali(..., 1.1/1.11)), sementara
  // penjualan dihitung dari dpp yang NET, jadi retur jadi terlalu besar dan
  // riil omset terlalu kecil. FPd_harga sudah net → net dikurangi net.
  // Paritas BSN:518-521 (EXISTS) dan BSN:531-534 (SUM).
  const d4Join = `INNER JOIN tfp_dtl d4
     ON d4.FPd_FP_nomor = h.retj_fp_nomor
    AND d4.FPd_brg_kode = d2.retjd_brg_kode
    AND d4.FPd_expired = d2.retjd_expired`;
  const netRetur =
    `IFNULL(SUM((100 - IFNULL(d4.FPd_discpr,0)) * d4.FPd_harga * d2.retjd_qty / 100), 0)`;
  return `CASE
      WHEN YEAR(h.retj_tanggal) <= 2021 THEN IFNULL(h.retj_amount, 0)
      ${pretur}
      ELSE CASE WHEN EXISTS (
                 SELECT 1 FROM tretj_dtl d2
                 INNER JOIN tbarang b2 ON b2.brg_kode = d2.retjd_brg_kode
                 ${d4Join}
                 WHERE d2.retjd_retj_nomor = h.retj_nomor AND ${ktgCond}
               ) THEN (
                 SELECT ${netRetur}
                 FROM tretj_dtl d2
                 INNER JOIN tbarang b2 ON b2.brg_kode = d2.retjd_brg_kode
                 ${d4Join}
                 WHERE d2.retjd_retj_nomor = h.retj_nomor AND ${ktgCond}
               ) ELSE 0 END
    END`;
}

// ── 1 query riil per tabel penjualan → 4 periode sekaligus ───────
function riilCombined(salesTable, { ktgMode, pretur, p }) {
  const { thn, bln, prevThn, awalBulanThn, akhirBulanThn, janThn,
          awalBulanPrev, akhirBulanPrev, janPrev, rentangAwal, rentangAkhir } = p;

  // Penjualan: 4 periode lewat conditional aggregation
  const penjualanSql = `SELECT a.salesman,
      SUM(CASE WHEN a.tanggal >= ? AND a.tanggal < date_add(?, interval 1 day)
               THEN IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak ELSE 0 END) AS riil_bulan,
      SUM(CASE WHEN a.tanggal >= ? AND a.tanggal < date_add(?, interval 1 day)
               THEN IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak ELSE 0 END) AS riil_ytd,
      SUM(CASE WHEN a.tanggal >= ? AND a.tanggal < date_add(?, interval 1 day)
               THEN IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak ELSE 0 END) AS riil_bulan_lalu,
      SUM(CASE WHEN a.tanggal >= ? AND a.tanggal < date_add(?, interval 1 day)
               THEN IF(YEAR(a.tanggal) > 2021, a.dpp, a.total) - a.biaya_promosi - a.fee_marketing - a.kontrak ELSE 0 END) AS riil_ytd_lalu
    FROM ${salesTable} a
    WHERE a.tanggal >= ? AND a.tanggal < date_add(?, interval 1 day)
    GROUP BY a.salesman`;

  // Retur: dihitung sekali per (salesman, tahun, bulan)
  const returSql = `SELECT so_sls_kode,
      SUM(CASE WHEN y = ? AND m = ?  THEN total_retur ELSE 0 END) AS r_bulan,
      SUM(CASE WHEN y = ? AND m <= ? THEN total_retur ELSE 0 END) AS r_ytd,
      SUM(CASE WHEN y = ? AND m = ?  THEN total_retur ELSE 0 END) AS r_bulan_lalu,
      SUM(CASE WHEN y = ? AND m <= ? THEN total_retur ELSE 0 END) AS r_ytd_lalu
    FROM (
      SELECT so_sls_kode, YEAR(h.retj_tanggal) y, MONTH(h.retj_tanggal) m,
        SUM(${returFormula(ktgMode, pretur)}) AS total_retur
      FROM tretj_hdr h
      INNER JOIN tfp_hdr ON h.retj_fp_nomor = fp_nomor
      LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
      WHERE YEAR(h.retj_tanggal) IN (?, ?) AND MONTH(h.retj_tanggal) <= ?
      GROUP BY so_sls_kode, YEAR(h.retj_tanggal), MONTH(h.retj_tanggal)
    ) x
    GROUP BY so_sls_kode`;

  const sql = `SELECT b.sls_nama AS rayon,
      p.riil_bulan      - COALESCE(r.r_bulan, 0)      AS riil_bulan,
      p.riil_ytd        - COALESCE(r.r_ytd, 0)        AS riil_ytd,
      p.riil_bulan_lalu - COALESCE(r.r_bulan_lalu, 0) AS riil_bulan_lalu,
      p.riil_ytd_lalu   - COALESCE(r.r_ytd_lalu, 0)   AS riil_ytd_lalu
    FROM (${penjualanSql}) p
    INNER JOIN tsalesman b ON b.sls_kode = p.salesman
    LEFT JOIN (${returSql}) r ON r.so_sls_kode = p.salesman`;

  const params = [
    // penjualan conditional: bulan, ytd, bulan lalu, ytd lalu
    awalBulanThn, akhirBulanThn,
    janThn, akhirBulanThn,
    awalBulanPrev, akhirBulanPrev,
    janPrev, akhirBulanPrev,
    // penjualan WHERE (rentang terluas)
    rentangAwal, rentangAkhir,
    // retur conditional
    thn, bln,
    thn, bln,
    prevThn, bln,
    prevThn, bln,
    // retur WHERE
    thn, prevThn, bln,
  ];

  return { sql, params };
}

async function getBrowse(params) {
  const { bulan, tahun } = params; // bulan 1..12
  const y = Number(tahun);
  const bMonth = Number(bulan);
  const prevThn = y - 1;

  const p = {
    thn: y,
    bln: bMonth,
    prevThn,
    awalBulanThn: awalBulan(y, bMonth),
    akhirBulanThn: akhirBulan(y, bMonth),
    janThn: awalBulan(y, 1),
    awalBulanPrev: awalBulan(prevThn, bMonth),
    akhirBulanPrev: akhirBulan(prevThn, bMonth),
    janPrev: awalBulan(prevThn, 1),
    rentangAwal: awalBulan(prevThn, 1),
    rentangAkhir: akhirBulan(y, bMonth),
  };

  const isOld = y <= 2025;
  // View *new = versi dengan diskon baris (FPd_discpr) ikut diperhitungkan di
  // DPP dan ketiga komponen biaya. View tanpa akhiran "new" sengaja dibiarkan
  // untuk pembanding, jangan di-drop.
  const salesTable = isOld ? "penjualan" : "penjualann3bysalesmannew";
  const pretur = isOld
    ? "WHEN YEAR(h.retj_tanggal) <= 2025 THEN IFNULL(h.retj_amount - h.retj_taxamount, 0)"
    : "";

  // ── Seed salesman (harus duluan, dipakai semua map) ──
  const [seedRows] = await db.query(
    " SELECT DISTINCT sls_kode, sls_nama rayon,"
    + " (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1) salesman"
    + " FROM tsalesman INNER JOIN tsalesmantarget ON sls_kode = st_sls_kode"
    + " WHERE st_tahun = ?",
    [tahun],
  );
  const hasil = new Map();
  for (const r of seedRows) hasil.set(r.rayon, { rayon: r.rayon, salesman: r.salesman });
  if (hasil.size === 0) return [];

  // ── Tanggal piutang (akhir/akhir2 dari blok atas Delphi) ──
  // Paritas BSN:372-381. cbbBulan.ItemIndex 0-based dan ShortDateFormat
  // 'M/d/yyyy' (MAIN.pas:534), jadi untuk Sept (ItemIndex=8):
  //   akhir  = EndOfTheMonth(StrToDate('8/01/2026'))  -> 31 AGUSTUS
  //   akhir2 = EndOfTheMonth(StrToDate('9/01/2026'))  -> 30 SEPTEMBER
  // Artinya `akhir` = akhir bulan SEBELUM terpilih, `akhir2` = akhir bulan
  // terpilih. Versi sebelumnya memakai akhirBulan(bMonth) & akhirBulan(bMonth+1)
  // — meleset satu bulan ke depan, sehingga seluruh kolom Piutang (Target,
  // Realisasi Tempo, Plus Tunai) berbeda dari Delphi.
  let piutangAkhir, piutangAkhir2;
  if (bMonth === 1) {
    // bMonth-1 = 0 tidak sah untuk akhirBulan(); Delphi pakai 12/01/(tahun-1).
    piutangAkhir = `${prevThn}-12-31`;
    piutangAkhir2 = p.akhirBulanThn;
  } else {
    piutangAkhir = akhirBulan(y, bMonth - 1);
    piutangAkhir2 = p.akhirBulanThn;
  }

  // Catatan: pola norefYymm (FormatDateTime('yymm', akhir2), paritas BSN:1018)
  // sudah tidak dipakai. Semula query Tunai memakai ini supaya nomor referensi
  // bulan lain tidak ikut terhitung; Tunai sendiri sudah dibuang dari Realisasi All
  // dan tidak ada kolomnya di laporan. Bulanan 10/2026 -> "%.2610.%"

  // ── semua query sisanya dijalankan paralel ──
  // riil memakai VIEW penjualan* yang outputnya bergantung pada session var
  // @tg1/@tg2 (lewat fungsi tg1()/tg2()). Jadi SET var + SELECT harus di
  // jalankan pada satu koneksi yang sama (pool bisa pakai koneksi beda).
  const riilN3 = riilCombined(salesTable, { ktgMode: "pf", pretur, p });
  // pretur hanya untuk blok N3 (BSN:510,637,759,885). Empat blok non-N3 di
  // BSN tidak memakainya (BSN:1128 langsung ke ELSE), jadi di sini dikosongkan.
  const riilNon = riilCombined("penjualannonn3bysalesmannew", { ktgMode: "other", pretur: "", p });

  const setVars = `SET @bulan1=${bMonth}, @tahun1=${y}, @tg1='${p.rentangAwal}', @tg2='${p.rentangAkhir}'`;
  const runRiil = async () => {
    const conn = await db.getConnection();
    try {
      await conn.query(setVars);
      return [
        await conn.query(riilN3.sql, riilN3.params),
        await conn.query(riilNon.sql, riilNon.params),
      ];
    } finally {
      conn.release();
    }
  };
  const riilPromise = runRiil();

  // TARGET PIUTANG — dibaca dari tkartupiutang (tabel base yang sudah
  // dimaterialisasi), bukan dari kartu_piutang. kartu_piutang itu VIEW
  // 3-branch yang tiap dipanggil_join ulang ke tfp_hdr/tdo_hdr/tso_hdr;
  // materialize sekali di sql/tkartupiutang.sql jauh lebih murah.
  //
  // Definisi: sisa piutang berjalan = seluruh tagihan (debit) dikurangi
  // seluruh pelunasan dan retur (kredit), untuk rayon yang punya target
  // di periode ini.
  //
  // Batas tanggal memakai <= dari variabel yang sudah ada:
  //   kp_tanggal  <= piutangAkhir   ≡ kp_tanggal  < (piutangAkhir + 1 hari)
  //   kp_jthtempo <= piutangAkhir2  ≡ kp_jthtempo < (piutangAkhir2 + 1 hari)
  // Bulan 10/2026 -> piutangAkhir = 2026-09-30, piutangAkhir2 = 2026-10-31,
  // jadi tagihan s/d 30 Sep dan jatuh tempo s/d 31 Okt.
  //
  // Jatuh tempo hanya membatasi baris FP. Baris CR dan retur (kp_noref
  // berawalan 01-CR./01-RETJ.) tetap ikut tanpa filter jatuh tempo,
  // karena itu baris pelunasan — yg belum jatuh tempo tetap mengurangi.
  //
  // Kurung di dalam WHERE WAJIB. Tanpa kurung, AND didahulukan OR sehingga
  // cabang FP lepas dari filter EXISTS dan semua 22 rayon ikut masuk
  // (13 di antaranya tanpa target).
  const targetSql = `SELECT sls_nama rayon,
      SUM(kp_debit - kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal <= ?
      AND ( (kp_jthtempo <= ? AND kp_noref LIKE '%FP.%')
         OR kp_noref NOT LIKE '%FP.%' )
      AND EXISTS (SELECT 1 FROM tsalesmantarget a
                  WHERE a.st_sls_kode = kp_rayon
                    AND a.st_periode = ? AND a.st_tahun = ?)
    GROUP BY sls_nama`;

  // REALISASI TEMPO (pelunasan CR) dan RETUR — dua query terpisah, satu
  // per kolom laporan. Jangan digabung jadi SUM(IF(...)) dalam satu
  // query: rayon yang nol retur ikut hilang dari kolom Realisasi Tempo.
  //
  // kp_noref tidak pernah mengandung huruf 'byc' — prefix itu ada di NAMA
  // kolom tbayarcus_hdr.byc_nomor, sedangkan nilainya '01-CR.1701.0001'.
  // Jadi klausanya harus '01-CR.%', bukan '%BYC%' (yang matching 0 baris).
  // Aliasnya 'nilai', bukan 'real' — REAL itu reserved word di MariaDB.
  // Join tsalesman wajib: hasil Map di bawah di-key dengan sls_nama, jadi
  // query ini harus mengembalikan NAMA rayon, bukan kp_rayon.
  const realTempoSql = `SELECT sls_nama rayon, SUM(kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal >= ? AND kp_tanggal <= ? AND kp_jthtempo <= ?
      AND kp_noref LIKE '%CR.%'
    GROUP BY sls_nama`;

  const returSql = `SELECT sls_nama rayon, SUM(kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal >= ? AND kp_tanggal <= ? AND kp_jthtempo <= ?
      AND kp_noref LIKE '%RETJ%'
    GROUP BY sls_nama`;

  // TARGET ALL — Target dikurangi pembayarannya yang jatuh tempo sudah lewat
  // batas, jadi sama dengan definisi Delphi: semua baris (tagihan, CR, retur)
  // dibatasi kp_jthtempo <= piutangAkhir2.
  //
  // BUKAN sekadar Target tanpa filter jatuh tempo (itu keliru — versi itu juga
  // memasukkan FP yang jatuh tempo setelah bulan laporan). Selisihnya 271.689
  // ribu: pembayaran dan retur atas faktur yang belum jatuh tempo.
  //
  // Parameternya sama dengan targetSql: [piutangAkhir, piutangAkhir2, ...]
  const targetAllSql = `SELECT sls_nama rayon,
      SUM(kp_debit - kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal <= ?
      AND ( (kp_jthtempo <= ? AND kp_noref LIKE '%FP.%')
         OR kp_noref NOT LIKE '%FP.%' )
      AND EXISTS (SELECT 1 FROM tsalesmantarget a
                  WHERE a.st_sls_kode = kp_rayon
                    AND a.st_periode = ? AND a.st_tahun = ?)
    GROUP BY sls_nama`;

  // BELUM JATUH TEMPO — pelunasan CR dan retur RETJ yang kp_jthtempo-nya
  // sudah MELEBIHI batas akhir bulan laporan.
  //
  // Operatornya ">" bukan ">=". Dua kelompok ("sudah jatuh tempo" <= batas dan
  // "belum" > batas) akan tumpang tindih kalau pakai >=, karena baris yang
  // kp_jthtempo-nya tepat sama dengan batas ikut keduanya — di Oktober 2026
  // retur 01-RETJ.2610.0001 (444 juta) punya jthtempo tepat 31 Okt, jadi
  // terhitung dua kali.
  //
  // Dipakai untuk menyusun kolom "All": sengaja TIDAK digabung dengan query
  // lain, supaya penjumlahannya kelihatan di loop assignment.
  const crNotDueSql = `SELECT sls_nama rayon, SUM(kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal >= ? AND kp_tanggal <= ? AND kp_jthtempo > ?
      AND kp_noref LIKE '%CR.%'
    GROUP BY sls_nama`;

  const returNotDueSql = `SELECT sls_nama rayon, SUM(kp_kredit) AS nilai
    FROM tkartupiutang
    INNER JOIN tsalesman ON sls_kode = kp_rayon
    WHERE kp_tanggal >= ? AND kp_tanggal <= ? AND kp_jthtempo > ?
      AND kp_noref LIKE '%RETJ%'
    GROUP BY sls_nama`;

  const pfSql = `SELECT sls_nama rayon,
      SUM((100-fpd_discpr)*(fpd_harga*fpd_qty)/100*IF(fp_istax=1,IF(fp_tanggal<"2022/04/01",1.1,1.11),1))
        - SUM(fpd_cn*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100)
        - SUM(fpd_bp_pr*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100) + SUM(fpd_bp_rp*fpd_qty)
        - (SELECT IFNULL(SUM((retjd_harga*retjd_qty)*(100-IFNULL(retjd_discpr,0))/100),0)
           * IF(fp_istax=1,IF(fp_tanggal<"2022/04/01",1.1,1.11),1)
           FROM tretj_dtl INNER JOIN tretj_hdr ON retjd_retj_nomor = retj_nomor
           INNER JOIN tfp_hdr ON retj_fp_nomor = fp_nomor
           LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor INNER JOIN tbarang ON retjd_brg_kode = brg_kode
           WHERE so_sls_kode = sls_kode AND retj_tanggal >= ? AND retj_tanggal < date_add(?, interval 1 day)
             AND brg_isproductfocus = 1) AS pf
      FROM tfp_dtl INNER JOIN tfp_hdr ON fp_nomor = fpd_fp_nomor
      LEFT JOIN tso_hdr ON so_nomor = fp_so_nomor
      INNER JOIN tbarang ON brg_kode = fpd_brg_kode
        AND fp_tanggal >= ? AND fp_tanggal < date_add(?, interval 1 day) AND brg_isproductfocus = 1
      INNER JOIN tsalesman ON sls_kode = so_sls_kode
      GROUP BY so_sls_kode`;

  // new customer: NOT IN diganti LEFT JOIN ... IS NULL
  const ncSql = `SELECT sls_nama rayon, COUNT(*) newcustomer FROM (
      SELECT DISTINCT sls_nama, f.fp_cus_kode FROM tfp_hdr f
      LEFT JOIN tso_hdr ON so_nomor = f.fp_so_nomor
      INNER JOIN tsalesman ON sls_kode = so_sls_kode
      INNER JOIN tcustomer ON cus_kode = f.fp_cus_kode
      LEFT JOIN (SELECT DISTINCT fp_cus_kode FROM tfp_hdr WHERE fp_tanggal <= ?) old
        ON old.fp_cus_kode = f.fp_cus_kode
      WHERE f.fp_tanggal >= ? AND f.fp_tanggal < date_add(?, interval 1 day)
        AND old.fp_cus_kode IS NULL
    ) final GROUP BY sls_nama`;

  // RS/PUSK/KLINIK: tanpa derived table DISTINCT berlapis
  const rkSql = `SELECT sls_nama rayon, COUNT(DISTINCT f.fp_cus_kode) rsklinik
    FROM tfp_hdr f
    LEFT JOIN tso_hdr ON so_nomor = f.fp_so_nomor
    INNER JOIN tsalesman ON sls_kode = so_sls_kode
    INNER JOIN tcustomer ON cus_kode = f.fp_cus_kode
    WHERE f.fp_tanggal >= ? AND f.fp_tanggal < date_add(?, interval 1 day)
      AND cus_gc_kode IN ("RS","KL","PS","RSA","RSB","RSC","RSD")
    GROUP BY sls_nama`;

const [
    tBulan, tYtd, tTahun,
    tgt, tgtAll, realTempo, retur, crNotDue, returNotDue,
    pfRows, nc, rk,
  ] = await Promise.all([
    db.query(" SELECT sls_nama rayon, st_targetsales target FROM tsalesmantarget"
      + " INNER JOIN tsalesman ON sls_kode = st_sls_kode WHERE st_periode = ? AND st_tahun = ?",
      [bMonth, tahun]),
    db.query(" SELECT sls_nama rayon, SUM(st_targetsales) targetsdbulanini FROM tsalesmantarget"
      + " INNER JOIN tsalesman ON sls_kode = st_sls_kode WHERE st_periode <= ? AND st_tahun = ? GROUP BY sls_nama",
      [bMonth, tahun]),
    db.query(" SELECT sls_nama rayon, SUM(st_targetsales) targettahunan FROM tsalesmantarget"
      + " INNER JOIN tsalesman ON sls_kode = st_sls_kode WHERE st_tahun = ? GROUP BY sls_nama",
      [tahun]),
    db.query(targetSql, [piutangAkhir, piutangAkhir2, bMonth, tahun]),
    db.query(targetAllSql, [piutangAkhir, piutangAkhir2, bMonth, tahun]),
    db.query(realTempoSql, [p.awalBulanThn, p.akhirBulanThn, piutangAkhir2]),
    db.query(returSql, [p.awalBulanThn, p.akhirBulanThn, piutangAkhir2]),
    db.query(crNotDueSql, [p.awalBulanThn, p.akhirBulanThn, piutangAkhir2]),
    db.query(returNotDueSql, [p.awalBulanThn, p.akhirBulanThn, piutangAkhir2]),
    db.query(pfSql, [p.awalBulanThn, p.akhirBulanThn, p.awalBulanThn, p.akhirBulanThn]),
    db.query(ncSql, [piutangAkhir, p.awalBulanThn, p.akhirBulanThn]),
    db.query(rkSql, [p.awalBulanThn, p.akhirBulanThn]),
  ]);
  const [rowsN3, rowsNon] = await riilPromise;

  const rows = (r) => r[0];

  // TARGET bulan berjalan
  for (const r of rows(tBulan)) if (hasil.has(r.rayon)) hasil.get(r.rayon).targetbulanini = r.target / 1000;
  // TARGET sd bulan ini
  for (const r of rows(tYtd)) if (hasil.has(r.rayon)) hasil.get(r.rayon).targetsdbulanini = r.targetsdbulanini / 1000;

  // RIIL N3
  for (const r of rows(rowsN3)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.riilbulanini = r.riil_bulan / 1000;
    if (r.riil_bulan > 0 && row.targetbulanini) row.persenbulanini = (r.riil_bulan / 1000) / row.targetbulanini * 100;
    row.riilsdbulanini = r.riil_ytd / 1000;
    if (row.targetsdbulanini > 0) row.persensdbulanini = row.riilsdbulanini / row.targetsdbulanini * 100;
    row.riilbulaninilalu = r.riil_bulan_lalu / 1000;
    if (r.riil_bulan_lalu > 0 && row.riilbulanini) row.growth = (row.riilbulanini / (r.riil_bulan_lalu / 1000)) * 100;
    row.riilsdbulaninilalu = r.riil_ytd_lalu / 1000;
    if (r.riil_ytd_lalu > 0 && row.riilsdbulanini) row.growth2 = (row.riilsdbulanini / (r.riil_ytd_lalu / 1000)) * 100;
  }

  // TARGET TAHUNAN
  for (const r of rows(tTahun)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.targettahunan = r.targettahunan / 1000;
    if (r.targettahunan > 0) row.ratio = row.riilsdbulanini / (r.targettahunan / 1000) * 100;
  }

  // PIUTANG — nilai dasar per rayon. Kolom "All" disusun dari angka-angka ini
  // di loop terakhir, bukan di query.
  for (const r of rows(tgt)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.targetpiutang = r.nilai / 1000;
  }

  for (const r of rows(tgtAll)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.targetallbase = r.nilai / 1000;
  }

  for (const r of rows(realTempo)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.realisasipiutang = r.nilai / 1000;
  }

  for (const r of rows(retur)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.returpiutang = r.nilai / 1000;
  }

  for (const r of rows(crNotDue)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.crNotDue = r.nilai / 1000;
  }

  for (const r of rows(returNotDue)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.returNotDue = r.nilai / 1000;
  }

  // TURUNAN — iterasi hasil SEED, bukan baris query. 8 dari 9 rayon tidak punya
  // satu pun baris realTempo/crNotDue/returNotDue; kalau dihitung dari baris
  // query, realisasipiutang miliknya ikut hilang.
  //
  // Kolom "All" = versi jatuh tempo + versi yang belum jatuh tempo:
  //   realisasiall    = realTempo + crNotDue      (tanpa Tunai)
  //   returallpiutang = retur     + returNotDue
  //   targetallpiutang= targetAll + crNotDue + returNotDue
  //   ratiopiutang    = (realTempo + retur) / target   — retur ikut, tidak seperti realisasiall
  for (const row of hasil.values()) {
    const tempo = (row.realisasipiutang ?? 0) + (row.returpiutang ?? 0);
    row.ratiopiutang = row.targetpiutang > 0 ? tempo / row.targetpiutang * 100 : 0;

    const belumJtTempo = (row.crNotDue ?? 0) + (row.returNotDue ?? 0);
    row.realisasiall = (row.realisasipiutang ?? 0) + (row.crNotDue ?? 0);
    row.returallpiutang = (row.returpiutang ?? 0) + (row.returNotDue ?? 0);
    row.targetallpiutang = (row.targetallbase ?? 0) + belumJtTempo;
    row.allratio = row.targetallpiutang > 0
      ? row.realisasiall / row.targetallpiutang * 100 : 0;
  }

  // PRODUCT FOCUS
  for (const r of rows(pfRows)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.pf = r.pf / 1000;
    if (row.targetbulanini > 0) row.pfratio = row.pf / row.targetbulanini * 100;
  }

  // RIIL non-N3 (Others)
  for (const r of rows(rowsNon)) {
    const row = hasil.get(r.rayon);
    if (!row) continue;
    row.riilbulanininonn3 = r.riil_bulan / 1000;
    if (r.riil_bulan > 0 && row.targetbulanini) row.persenbulanininonn3 = (r.riil_bulan / 1000) / row.targetbulanini * 100;
    row.riilsdbulanininonn3 = r.riil_ytd / 1000;
    if (row.targetsdbulanini > 0) row.persensdbulanininonn3 = row.riilsdbulanininonn3 / row.targetsdbulanini * 100;
    row.riilbulaninilalunonn3 = r.riil_bulan_lalu / 1000;
    if (r.riil_bulan_lalu > 0 && row.riilbulanininonn3) row.growthnonn3 = row.riilbulanininonn3 / (r.riil_bulan_lalu / 1000) * 100;
    row.riilsdbulaninilalunonn3 = r.riil_ytd_lalu / 1000;
    if (r.riil_ytd_lalu > 0 && row.riilsdbulanininonn3) row.growth2nonn3 = row.riilsdbulanininonn3 / (r.riil_ytd_lalu / 1000) * 100;
  }

  // NEW CUSTOMER
  for (const r of rows(nc)) if (hasil.has(r.rayon)) hasil.get(r.rayon).newcustomer = Number(r.newcustomer);
  // RS / PUSK / KLINIK
  for (const r of rows(rk)) if (hasil.has(r.rayon)) hasil.get(r.rayon).rsklinik = Number(r.rsklinik);

  return [...hasil.values()].map((r) => ({
    rayon: r.rayon,
    salesman: r.salesman,
    targetbulanini: r.targetbulanini ?? 0,
    targetsdbulanini: r.targetsdbulanini ?? 0,
    riilbulanini: r.riilbulanini ?? 0,
    persenbulanini: r.persenbulanini ?? 0,
    riilsdbulanini: r.riilsdbulanini ?? 0,
    persensdbulanini: r.persensdbulanini ?? 0,
    riilbulaninilalu: r.riilbulaninilalu ?? 0,
    growth: r.growth ?? 0,
    riilsdbulaninilalu: r.riilsdbulaninilalu ?? 0,
    growth2: r.growth2 ?? 0,
    targettahunan: r.targettahunan ?? 0,
    ratio: r.ratio ?? 0,
    targetpiutang: r.targetpiutang ?? 0,
    targetallpiutang: r.targetallpiutang ?? 0,
    realisasipiutang: r.realisasipiutang ?? 0,
    returpiutang: r.returpiutang ?? 0,
    returallpiutang: r.returallpiutang ?? 0,
    ratiopiutang: r.ratiopiutang ?? 0,
    pf: r.pf ?? 0,
    pfratio: r.pfratio ?? 0,
    realisasiall: r.realisasiall ?? 0,
    allratio: r.allratio ?? 0,
    newcustomer: r.newcustomer ?? 0,
    rsklinik: r.rsklinik ?? 0,
    riilbulanininonn3: r.riilbulanininonn3 ?? 0,
    persenbulanininonn3: r.persenbulanininonn3 ?? 0,
    riilsdbulanininonn3: r.riilsdbulanininonn3 ?? 0,
    persensdbulanininonn3: r.persensdbulanininonn3 ?? 0,
    riilbulaninilalunonn3: r.riilbulaninilalunonn3 ?? 0,
    growthnonn3: r.growthnonn3 ?? 0,
    riilsdbulaninilalunonn3: r.riilsdbulaninilalunonn3 ?? 0,
    growth2nonn3: r.growth2nonn3 ?? 0,
  }));
}

module.exports = { getBrowse };
