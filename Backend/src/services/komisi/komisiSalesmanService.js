// services/komisi/komisiSalesmanService.js
// Migrasi dari Delphi ufrmKomisiSalesman.pas (loaddata)
// 2 grid: grid1 (ds3) rekap penjualan/piutang per salesman,
//         grid2 (ds32) rincian komisi per salesman.
// Query Delphi diport hampir verbatim; nilai periode disisipkan literal
// (bulan/tahun int + tanggal ISO), karena komersial Delphi membangun SQL string.
//
// 2026: blok PIUTANG (grid1: target_piutang / realisasi_tempo / realisasi_all)
// dan pengurang margin (grid2 q5) berpindah dari VIEW kartu_piutang ke
// tabel tkartupiutang (lihat sql/tkartupiutang.sql). Definisi mengikuti
// LapBulanan4, bukan Delphi komisi:
//   - target_piutang  = Target_ALL lapbulanan4 (TermAsync)
//   - realisasi_tempo = realisasipiutang lapbulanan4
//   - realisasi_all   = realisasiall lapbulanan4 (= tempo + CR belum jt tempo)
// Batas tanggal piutang = piutangAkhir (akhir bulan-1) & piutangAkhir2
// (akhir bulan terpilih), SAMA dengan LapBulanan4.
// q2 lama + q5 lama memakai kartu_piutang; sudah tidak tersisa query
// kartu_piutang di file ini (hanya komentar).
//
// Catatan q3: literal tax="PPN" perlu COLLATE utf8mb4_general_ci karena
// kolom Tax pada VIEW transaksi_harian collates general_ci, sedangkan
// session collation_connection = utf8mb4_unicode_ci. Pola sama dengan
// saldoPiutangService.js.
const db = require("../../config/database");

const lastDayISO = (y, m) => {
  // y tahun, m bulan 1..12 , kembalikan YYYY-MM-DD hari terakhir bulan
  const d = new Date(y, m, 0);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const pad2 = (n) => String(n).padStart(2, "0");

const dq = (s) => `'${s}'`; // quote date literal utk MySQL

const getBrowse = async ({ bulan, tahun, cabang }) => {
  if (!bulan || !tahun) throw new Error("bulan dan tahun wajib.");
  const bulanInt = Number(bulan); // 1..12
  const tahunInt = Number(tahun);

  // ── Periode (setara Delphi EndOfTheMonth) ──
  const akhir = lastDayISO(tahunInt, bulanInt); // akhir bulan terpilih, tahun ini
  const akhir2 = lastDayISO(bulanInt === 12 ? tahunInt + 1 : tahunInt, bulanInt + 1); // akhir bulan berikutnya (wrap tahun)
  const akhir3 = lastDayISO(tahunInt - 1, bulanInt); // tahun lalu
  const akhir4 = lastDayISO(bulanInt === 12 ? tahunInt : tahunInt - 1, bulanInt + 1); // thn lalu bulan berikutnya
  // Batas piutang mengikuti definisi LapBulanan4 (piutangAkhir = akhir bulan
  // SEBELUM terpilih, piutangAkhir2 = akhir bulan TERPILIH). Bukan akhir2.
  const piutangAkhir  = bulanInt === 1 ? `${tahunInt - 1}-12-31` : lastDayISO(tahunInt, bulanInt - 1);
  const piutangAkhir2 = akhir;
  const awalBulan = `${tahunInt}-${pad2(bulanInt)}-01`;

  // ── QUERY 1: ds3 (grid1) master penjualan/others/pf ────────────────
  const q1 = `
    SELECT Salesman AS Rayon, sls_nama AS Nama,
      (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 limit 1) AS Salesman,
      cast(0 as decimal(5,2)) ratiopf, cast(0 as decimal(15,2)) realisasiall,
      cast(0 as decimal(5,2)) persentaseall,
      (select st_targetsales from tsalesmantarget where st_periode=${bulanInt} and st_tahun=${tahunInt} and st_sls_kode=a.salesman) AS Target_Jual,
      (select sum(total-biaya_promosi-fee_marketing-kontrak-retur)
       from transaksi_hariann3
       where month(tanggal)=${bulanInt} and year(tanggal)=${tahunInt} and salesman=a.salesman) AS Realisasi_Jual,
      (select sum(total-biaya_promosi-fee_marketing-kontrak-retur)
       from transaksi_hariann3
       where month(tanggal)=${bulanInt} and year(tanggal)=${tahunInt} and salesman=a.salesman)/
      (select st_targetsales from tsalesmantarget where st_periode=${bulanInt} and st_tahun=${tahunInt} and st_sls_kode=a.salesman)*100 AS Presentase2,
      ( SELECT SUM(total - biaya_promosi - fee_marketing - kontrak - retur)
        FROM transaksi_harianothers
        WHERE MONTH(tanggal) = ${bulanInt} AND YEAR(tanggal) = ${tahunInt - 1} AND salesman = a.salesman ) AS Target_Jual_Other,
      ( SELECT SUM(total - biaya_promosi - fee_marketing - kontrak - retur)
        FROM transaksi_harianothers
        WHERE MONTH(tanggal) = ${bulanInt} AND YEAR(tanggal) = ${tahunInt} AND salesman = a.salesman ) AS Realisasi_Jual_Other,
      ( SELECT SUM(total - biaya_promosi - fee_marketing - kontrak - retur)
        FROM transaksi_harianothers
        WHERE MONTH(tanggal) = ${bulanInt} AND YEAR(tanggal) = ${tahunInt} AND salesman = a.salesman ) /
      ( SELECT SUM(total - biaya_promosi - fee_marketing - kontrak - retur)
        FROM transaksi_harianothers
        WHERE MONTH(tanggal) = ${bulanInt} AND YEAR(tanggal) = ${tahunInt - 1} AND salesman = a.salesman ) * 100 AS PresentaseOther,
      piutang AS Piutang, ifnull(tunai2,0) AS Tunai, (Piutang+ifnull(tunai2,0)) AS Target_Piutang,
      ifnull(inkaso,0) AS Realisasi, inkaso/(Piutang+ifnull(tunai2,0))*100 AS Persentase,
      (select
        sum((100-fpd_discpr)*(fpd_harga*fpd_qty)/100*if(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1)) -
        sum(fpd_cn*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100) -
        sum(fpd_bp_pr*((100-fpd_discpr)*fpd_harga/100)*fpd_qty/100)+sum(fpd_bp_rp*fpd_qty) Nilai
        from tfp_dtl inner join tfp_hdr on fp_nomor=fpd_fp_nomor
        left join tso_hdr on so_nomor =fp_so_nomor
        inner join tbarang on brg_kode=fpd_brg_kode
        and month(fp_tanggal)=${bulanInt} and year(fp_tanggal)=${tahunInt}
        and brg_isproductfocus=1 where so_sls_kode=a.salesman) AS pf
    FROM (
      SELECT salesman,
        sum(IF ((select count(*) from tjatuhtempofp where jt_fp_nomor=nomor) > 0,
          (select sum(jt_nilai) from tjatuhtempofp where jt_fp_nomor=nomor and jt_tanggaljt <= ${dq(akhir2)}), total)) -
        ifnull((select sum(bayar_cash+bayar_transfer+giro+potongan+ppn+pph-
          ifnull((select sum(bycd_bayar) from tbayarcus_dtl inner join tfp_hdr on fp_nomor=bycd_fp_nomor
            where bycd_byc_nomor=xx.nomor and fp_jthtempo > ${dq(akhir2)}),0))
          from pembayaran xx where salesman=a.salesman and tanggal <= ${dq(akhir)}),0) -
        ifnull((select sum(retur) from retur inner join tfp_hdr on fp_nomor=retj_fp_nomor
          where fp_jthtempo <= ${dq(akhir2)} and salesman=a.salesman and tanggal <= ${dq(akhir)}),0) AS piutang,
        (select sum(bycd_bayar) from tbayarcus_dtl inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
          inner join tfp_hdr on fp_nomor=bycd_fp_nomor
          left join tso_hdr on so_nomor=fp_so_nomor
          where so_sls_kode=a.salesman and fp_tanggal > ${dq(akhir)}
          and month(byc_tanggal)=${bulanInt}) AS tunai,
        (select sum(bycd_bayar) from tbayarcus_dtl inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
          inner join tfp_hdr on fp_nomor=bycd_fp_nomor
          left join tso_hdr on so_nomor=fp_so_nomor
          where so_sls_kode=a.salesman and fp_jthtempo > ${dq(akhir2)}
          and month(byc_tanggal)=${bulanInt} and year(byc_tanggal)=${tahunInt}) AS tunai2,
        (select sum(ifnull(bayar_cash,0)+ifnull(bayar_transfer,0)+ifnull(giro,0)+ifnull(potongan,0)+ifnull(pph,0)+ifnull(ppn,0))
          from pembayaran where month(tanggal)=${bulanInt} and year(tanggal)=${tahunInt}
          and salesman=a.salesman) AS inkaso
      FROM penjualan2 a
        inner join tfp_hdr on fp_nomor=nomor
      WHERE fp_jthtempo <= ${dq(akhir2)}
      GROUP BY salesman) a
    INNER JOIN tsalesman ON a.salesman=sls_kode AND sls_insentif=1
  `;

  const [q1rows] = await db.query(q1);
  const grid1 = q1rows.map((r) => ({
    rayon: r.Nama || "",
    salesman: r.Salesman || "",
    kode: r.Rayon || "",
    target_jual: Number(r.Target_Jual) || 0,
    realisasi_jual: Number(r.Realisasi_Jual) || 0,
    persentase_jual: 0,
    target_other: Number(r.Target_Jual_Other) || 0,
    realisasi_other: Number(r.Realisasi_Jual_Other) || 0,
    persentase_other: Number(r.PresentaseOther) || 0,
    realisasi_pf: Number(r.pf) || 0,
    ratio_pf: 0,
    target_piutang: 0,
    realisasi_tempo: 0,
    realisasi_all: 0,
    persentase_piutang: 0,
    persentase_tempo: 0,
  }));

  const mapG1 = new Map();
  grid1.forEach((g) => {
    if (!mapG1.has(String(g.salesman).toLowerCase())) mapG1.set(String(g.salesman).toLowerCase(), g);
  });

  if (grid1.length === 0) return { grid1: [], grid2: [] };

  // Set persentase_jual (Presentase2) dari query (kalau target>0)
  grid1.forEach((g) => {
    if (g.target_jual > 0) g.persentase_jual = (g.realisasi_jual / g.target_jual) * 100;
  });

  // ── QUERY 2 (PIUTANG): update target_piutang/realisasi/persentase/realisasiall ──
  // Sumber berpindah dari VIEW kartu_piutang ke tkartupiutang. Definisinya
  // mengikuti LapBulanan4 (bukan Delphi komisi), jadi:
  //   target_piutang   = value Target_ALL lapbulanan4 (Tagihan jatuh tempo,
  //                        minus pembayaran/retur yang jatuh temponya sudah
  //                        lewat; termin sudah termaterialisasi di tabel)
  //   realisasi_tempo  = CR yang kp_jthtempo-nya <= piutangAkhir2
  //   realisasi_all    = realisasi_tempo + [CR yang kp_jthtempo > piutangAkhir2]
  const kpTgtSql = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = kp2.sls_kode AND sla_isaktif = 1 LIMIT 1) AS rayon,
      SUM(kp_debit - kp_kredit) AS nilai
      FROM tkartupiutang
      INNER JOIN tsalesman kp2 ON kp2.sls_kode = kp_rayon AND kp2.sls_insentif = 1
      WHERE kp_tanggal <= ${dq(piutangAkhir)}
        AND ( (kp_jthtempo <= ${dq(piutangAkhir2)} AND kp_noref LIKE '%FP.%')
           OR kp_noref NOT LIKE '%FP.%' )
      GROUP BY sls_nama
  `;
  const kpRealSql = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = kp2.sls_kode AND sla_isaktif = 1 LIMIT 1) AS rayon,
      SUM(kp_kredit) AS nilai
      FROM tkartupiutang
      INNER JOIN tsalesman kp2 ON kp2.sls_kode = kp_rayon AND kp2.sls_insentif = 1
      WHERE kp_tanggal >= ${dq(awalBulan)} AND kp_tanggal <= ${dq(akhir)}
        AND kp_jthtempo <= ${dq(piutangAkhir2)}
        AND kp_noref LIKE '%CR.%'
      GROUP BY sls_nama
  `;
  const kpNotDueSql = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = kp2.sls_kode AND sla_isaktif = 1 LIMIT 1) AS rayon,
      SUM(kp_kredit) AS nilai
      FROM tkartupiutang
      INNER JOIN tsalesman kp2 ON kp2.sls_kode = kp_rayon AND kp2.sls_insentif = 1
      WHERE kp_tanggal >= ${dq(awalBulan)} AND kp_tanggal <= ${dq(akhir)}
        AND kp_jthtempo > ${dq(piutangAkhir2)}
        AND kp_noref LIKE '%CR.%'
      GROUP BY sls_nama
  `;
  // retur yang belum jatuh tempo — komponen Target_ALL lapbulanan4
  const kpReturNotDueSql = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = kp2.sls_kode AND sla_isaktif = 1 LIMIT 1) AS rayon,
      SUM(kp_kredit) AS nilai
      FROM tkartupiutang
      INNER JOIN tsalesman kp2 ON kp2.sls_kode = kp_rayon AND kp2.sls_insentif = 1
      WHERE kp_tanggal >= ${dq(awalBulan)} AND kp_tanggal <= ${dq(akhir)}
        AND kp_jthtempo > ${dq(piutangAkhir2)}
        AND kp_noref LIKE '%RETJ%'
      GROUP BY sls_nama
  `;

  let kpTgt = [], kpReal = [], kpNotDue = [], kpReturNotDue = [];
  try { const [r] = await db.query(kpTgtSql); kpTgt = r; } catch (e) { kpTgt = []; }
  try { const [r] = await db.query(kpRealSql); kpReal = r; } catch (e) { kpReal = []; }
  try { const [r] = await db.query(kpNotDueSql); kpNotDue = r; } catch (e) { kpNotDue = []; }
  try { const [r] = await db.query(kpReturNotDueSql); kpReturNotDue = r; } catch (e) { kpReturNotDue = []; }

  for (const r of kpTgt) {
    const g = mapG1.get(String(r.rayon || "").toLowerCase());
    if (!g) continue;
    g._targetBase = Number(r.nilai) / 1000;
  }
  for (const r of kpReal) {
    const g = mapG1.get(String(r.rayon || "").toLowerCase());
    if (!g) continue;
    g.realisasi_tempo = Number(r.nilai) / 1000;
  }
  for (const r of kpNotDue) {
    const g = mapG1.get(String(r.rayon || "").toLowerCase());
    if (!g) continue;
    g._crNotDue = Number(r.nilai) / 1000;
  }
  for (const r of kpReturNotDue) {
    const g = mapG1.get(String(r.rayon || "").toLowerCase());
    if (!g) continue;
    g._returNotDue = Number(r.nilai) / 1000;
  }
  // loop kedua (nilai turunan) — tiap rayon dapat 3 kolom piutang,
  // walau query piutang tidak punya baris utk rayon itu.
  // target_piutang = Target_ALL lapbulanan4 = target + crNotDue + returNotDue
  for (const g of mapG1.values()) {
    g.realisasi_tempo = Number(g.realisasi_tempo) || 0;
    g.target_piutang = (Number(g._targetBase) || 0) + (Number(g._crNotDue) || 0) + (Number(g._returNotDue) || 0);
    g.realisasi_all = g.realisasi_tempo + (Number(g._crNotDue) || 0);
    if (g.target_piutang !== 0) {
      g.persentase_piutang = (g.realisasi_all / g.target_piutang) * 100;
      g.persentase_tempo = (g.realisasi_tempo / g.target_piutang) * 100;
    }
  }

  // ── ratio_pf (Delphi ds3 loop setelah query2) ──
  grid1.forEach((g) => {
    if (g.realisasi_pf > 0 && g.target_jual > 0) g.ratio_pf = (g.realisasi_pf / g.target_jual) * 100;
  });

  // ════════════════ GRID 2 (ds32) ════════════════
  // ── QUERY 3: dasar komisi (inkaso riil, giro, pengurang, pengali) ──
  const q3 = `
    SELECT Salesman, batas,
      (riil+riil2+riil3+riil4) AS riil,
      (riil+IFNULL(girolalu,0)-batas-kontrak-biaya_promosi-fee_marketing) AS pengali,
      (riil2+IFNULL(girolalu2,0)-kontrak2-biaya_promosi2-fee_marketing2) AS pengali2,
      (riil3+IFNULL(girolalu3,0)-kontrak3-biaya_promosi3-fee_marketing3) AS pengali3,
      (riil4+IFNULL(girolalu4,0)-kontrak4-biaya_promosi4-fee_marketing4) AS pengali4,
      riil AS komisi_jual, riil2 AS persen, riil3 AS nilai, riil4 AS total,
      riil2 AS persen2, riil3 AS nilai2, riil2 AS persen3, riil3 AS nilai3,
      riil2 AS persen4, riil3 AS nilai4, cast(0 as decimal) komisipf, cast(0 as decimal) komisiothers,
      IFNULL(girolalu,0)+IFNULL(girolalu2,0)+IFNULL(girolalu3,0)+IFNULL(girolalu4,0) AS girolalu,
      IFNULL(kontrak,0)+IFNULL(kontrak2,0)+IFNULL(kontrak3,0)+IFNULL(kontrak4,0) AS kontrak,
      IFNULL(biaya_promosi,0)+IFNULL(biaya_promosi2,0)+IFNULL(biaya_promosi3,0)+IFNULL(biaya_promosi4,0) AS biaya_promosi,
      IFNULL(fee_marketing,0)+IFNULL(fee_marketing2,0)+IFNULL(fee_marketing3,0)+IFNULL(fee_marketing4,0) AS fee_marketing
    FROM (
      SELECT salesman, SUM(ifnull(riil,0)) riil, SUM(ifnull(riil2,0)) riil2, SUM(ifnull(riil3,0)) riil3, SUM(ifnull(riil4,0)) riil4,
        SUM(biaya_promosi) biaya_promosi, SUM(kontrak) kontrak,
        SUM(biaya_promosi2) biaya_promosi2, SUM(kontrak2) kontrak2,
        SUM(biaya_promosi3) biaya_promosi3, SUM(kontrak3) kontrak3,
        SUM(biaya_promosi4) biaya_promosi4, SUM(kontrak4) kontrak4,
        SUM(fee_marketing) fee_marketing, SUM(fee_marketing2) fee_marketing2,
        SUM(fee_marketing3) fee_marketing3, SUM(fee_marketing4) fee_marketing4,
        (SELECT ksh_batas_inkaso FROM tkomisisales_hdr LIMIT 1) AS Batas,
        (SELECT SUM(bycd_bayar/ IF(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1))
          FROM tpencairangiro a INNER JOIN tbayarcus_hdr ON byc_nogiro=cg_gironumber
          INNER JOIN tbayarcus_dtl ON byc_nomor=bycd_byc_nomor INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
          LEFT JOIN tso_hdr ON so_nomor=fp_so_nomor
          WHERE MONTH(byc_tanggal) <> MONTH(cg_tanggalcair) AND cg_gironumber <>
          "" AND MONTH(cg_tanggalcair)=${bulanInt} AND YEAR(cg_tanggalcair)=${tahunInt} AND so_sls_kode=sls_kode
          and datediff(cg_tanggalcair,fp_tanggal)>7 and datediff(cg_tanggalcair,fp_tanggal)<=40) AS girolalu,
        (SELECT SUM(bycd_bayar/ IF(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1))
          FROM tpencairangiro a INNER JOIN tbayarcus_hdr ON byc_nogiro=cg_gironumber
          INNER JOIN tbayarcus_dtl ON byc_nomor=bycd_byc_nomor INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
          LEFT JOIN tso_hdr ON so_nomor=fp_so_nomor
          WHERE MONTH(byc_tanggal) <> MONTH(cg_tanggalcair) AND cg_gironumber <>
          "" AND MONTH(cg_tanggalcair)=${bulanInt} AND YEAR(cg_tanggalcair)=${tahunInt} AND so_sls_kode=sls_kode
          and datediff(cg_tanggalcair,fp_tanggal)>40 and datediff(cg_tanggalcair,fp_tanggal)<=60) AS girolalu2,
        (SELECT SUM(bycd_bayar/ IF(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1))
          FROM tpencairangiro a INNER JOIN tbayarcus_hdr ON byc_nogiro=cg_gironumber
          INNER JOIN tbayarcus_dtl ON byc_nomor=bycd_byc_nomor INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
          LEFT JOIN tso_hdr ON so_nomor=fp_so_nomor
          WHERE MONTH(byc_tanggal) <> MONTH(cg_tanggalcair) AND cg_gironumber <>
          "" AND MONTH(cg_tanggalcair)=${bulanInt} AND YEAR(cg_tanggalcair)=${tahunInt} AND so_sls_kode=sls_kode
          and datediff(cg_tanggalcair,fp_tanggal)>60) AS girolalu3,
        (SELECT SUM(bycd_bayar/ IF(fp_istax=1,if(fp_tanggal<"2022/04/01",1.1,1.11),1))
          FROM tpencairangiro a INNER JOIN tbayarcus_hdr ON byc_nogiro=cg_gironumber
          INNER JOIN tbayarcus_dtl ON byc_nomor=bycd_byc_nomor INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
          LEFT JOIN tso_hdr ON so_nomor=fp_so_nomor
          WHERE MONTH(byc_tanggal) <> MONTH(cg_tanggalcair) AND cg_gironumber <>
          "" AND MONTH(cg_tanggalcair)=${bulanInt} AND YEAR(cg_tanggalcair)=${tahunInt} AND so_sls_kode=sls_kode
          and datediff(cg_tanggalcair,fp_tanggal)<=7) AS girolalu4
      FROM (
        SELECT sls_kode,(SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 LIMIT 1) AS salesman,
          nomor, TANGGAL,
          ((select sum(bycd_bayar) from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
            where bycd_byc_nomor=nomor and datediff(tanggal,fp_tanggal)>7 and datediff(tanggal,fp_tanggal)<=40) -
           IF((SELECT COUNT(*) FROM tbayarcus_hdr INNER JOIN tpencairangiro ON cg_gironumber=byc_nogiro
             WHERE byc_nomor=nomor AND cg_tanggalcair <= ${dq(akhir2)})>0,0,
           (select ifnull(sum(bycd_bayar)/(bayar_cash+bayar_transfer+giro+hutang_internal+um_penjualan+ppn_keluaran+pph_22),0)
             from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
             inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor inner join tpencairangiro ON cg_gironumber=byc_nogiro
             where bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal)>7 and datediff(byc_tanggal,fp_tanggal)<=40)*giro))
          / IF(tax="PPN" COLLATE utf8mb4_general_ci,if(tanggal<"2022/04/01",1.1,1.11),1) riil,
          ((select sum(bycd_bayar) from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
            where bycd_byc_nomor=nomor and datediff(tanggal,fp_tanggal)>40 and datediff(tanggal,fp_tanggal)<=60) -
           IF((SELECT COUNT(*) FROM tbayarcus_hdr INNER JOIN tpencairangiro ON cg_gironumber=byc_nogiro
             WHERE byc_nomor=nomor AND cg_tanggalcair <= ${dq(akhir2)})>0,0,
           (select ifnull(sum(bycd_bayar)/(bayar_cash+bayar_transfer+giro+hutang_internal+um_penjualan+ppn_keluaran+pph_22),0)
             from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
             inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor inner join tpencairangiro ON cg_gironumber=byc_nogiro
             where bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal)>40 and datediff(byc_tanggal,fp_tanggal)<=60)*giro))
          / IF(tax="PPN" COLLATE utf8mb4_general_ci,if(tanggal<"2022/04/01",1.1,1.11),1) riil2,
          ((select sum(bycd_bayar) from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
            where bycd_byc_nomor=nomor and datediff(tanggal,fp_tanggal)>60) -
           IF((SELECT COUNT(*) FROM tbayarcus_hdr INNER JOIN tpencairangiro ON cg_gironumber=byc_nogiro
             WHERE byc_nomor=nomor AND cg_tanggalcair <= ${dq(akhir2)})>0,0,
           (select ifnull(sum(bycd_bayar)/(bayar_cash+bayar_transfer+giro+hutang_internal+um_penjualan+ppn_keluaran+pph_22),0)
             from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
             inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor inner join tpencairangiro ON cg_gironumber=byc_nogiro
             where bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal)>60)*giro))
          / IF(tax="PPN" COLLATE utf8mb4_general_ci,if(tanggal<"2022/04/01",1.1,1.11),1) riil3,
          ((select sum(bycd_bayar) from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
            where bycd_byc_nomor=nomor and datediff(tanggal,fp_tanggal)<=7) -
           IF((SELECT COUNT(*) FROM tbayarcus_hdr INNER JOIN tpencairangiro ON cg_gironumber=byc_nogiro
             WHERE byc_nomor=nomor AND cg_tanggalcair <= ${dq(akhir2)})>0,0,
           (select ifnull(sum(bycd_bayar)/(bayar_cash+bayar_transfer+giro+hutang_internal+um_penjualan+ppn_keluaran+pph_22),0)
             from tbayarcus_dtl inner join tfp_hdr on bycd_fp_nomor=fp_nomor
             inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor inner join tpencairangiro ON cg_gironumber=byc_nogiro
             where bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal)<=7)*giro))
          / IF(tax="PPN" COLLATE utf8mb4_general_ci,if(tanggal<"2022/04/01",1.1,1.11),1) riil4,
          (SELECT SUM((bycd_bayar/fp_amount)*((Fp_biayapr*((fp_amount-fp_taxamount- IFNULL((
            SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100) + fp_biayarp))
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 7 and datediff(byc_tanggal,fp_tanggal) <=40) AS Biaya_Promosi,
          (SELECT SUM((bycd_bayar/fp_amount)*((Fp_biayapr*((fp_amount-fp_taxamount- IFNULL((
            SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100) + fp_biayarp))
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 40 and datediff(byc_tanggal,fp_tanggal) <=60) AS Biaya_Promosi2,
          (SELECT SUM((bycd_bayar/fp_amount)*((Fp_biayapr*((fp_amount-fp_taxamount- IFNULL((
            SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100) + fp_biayarp))
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 60) AS Biaya_Promosi3,
          (SELECT SUM((bycd_bayar/fp_amount)*((Fp_biayapr*((fp_amount-fp_taxamount- IFNULL((
            SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100) + fp_biayarp))
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) <= 7) AS Biaya_Promosi4,
          (SELECT SUM((Fp_biayapr2 * (fp_amount - fp_taxamount - IFNULL(
              (SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100 + fp_biayarp2)
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
            WHERE bycd_byc_nomor = nomor AND DATEDIFF(byc_tanggal,fp_tanggal) > 7 AND DATEDIFF(byc_tanggal,fp_tanggal) <= 40) AS Fee_Marketing,
          (SELECT SUM((Fp_biayapr2 * (fp_amount - fp_taxamount - IFNULL(
              (SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100 + fp_biayarp2)
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
            WHERE bycd_byc_nomor = nomor AND DATEDIFF(byc_tanggal,fp_tanggal) > 40 AND DATEDIFF(byc_tanggal,fp_tanggal) <= 60) AS Fee_Marketing2,
          (SELECT SUM((Fp_biayapr2 * (fp_amount - fp_taxamount - IFNULL(
              (SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100 + fp_biayarp2)
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
            WHERE bycd_byc_nomor = nomor AND DATEDIFF(byc_tanggal,fp_tanggal) > 60) AS Fee_Marketing3,
          (SELECT SUM((Fp_biayapr2 * (fp_amount - fp_taxamount - IFNULL(
              (SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp_nomor),0)))/100 + fp_biayarp2)
            FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor = bycd_fp_nomor INNER JOIN tbayarcus_hdr ON byc_nomor = bycd_byc_nomor
            WHERE bycd_byc_nomor = nomor AND DATEDIFF(byc_tanggal,fp_tanggal) <= 7) AS Fee_Marketing4,
          (SELECT SUM(fp_cn) FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 7 and datediff(byc_tanggal,fp_tanggal) <=40) AS Kontrak,
          (SELECT SUM(fp_cn) FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 40 and datediff(byc_tanggal,fp_tanggal) <=60) AS Kontrak2,
          (SELECT SUM(fp_cn) FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) > 60) AS Kontrak3,
          (SELECT SUM(fp_cn) FROM tbayarcus_dtl INNER JOIN tfp_hdr ON fp_nomor=bycd_fp_nomor
            inner join tbayarcus_hdr on byc_nomor=bycd_byc_nomor
            WHERE bycd_byc_nomor=nomor and datediff(byc_tanggal,fp_tanggal) <= 7) AS Kontrak4
      FROM transaksi_harian a
        INNER JOIN tsalesman b ON salesman=sls_kode AND sls_insentif=1
      WHERE MONTH(tanggal)= ${bulanInt} AND YEAR(tanggal) = ${tahunInt} AND nomor LIKE "%CR%") a
    GROUP BY salesman) final
  `;

  let q3rows = [];
  try {
    const [r3] = await db.query(q3);
    q3rows = r3;
  } catch (e) {
    q3rows = [];
  }

  const grid2 = q3rows.map((r, idx) => ({
    no: idx + 1,
    salesman: r.Salesman || "",
    riil: Number(r.riil) || 0,
    girolalu: Number(r.girolalu) || 0,
    biaya_promosi: Number(r.biaya_promosi) || 0,
    fee_marketing: Number(r.fee_marketing) || 0,
    kontrak: Number(r.kontrak) || 0,
    batas: Number(r.batas) || 0,
    pengali: Number(r.pengali) || 0,
    pengali2: Number(r.pengali2) || 0,
    pengali3: Number(r.pengali3) || 0,
    pengali4: Number(r.pengali4) || 0,
    komisi_jual: 0,
    persen: 0, nilai: 0,
    persen2: 0, nilai2: 0,
    persen3: 0, nilai3: 0,
    persen4: 0, nilai4: 0,
    komisipf: 0,
    komisiothers: 0,
    total: 0,
  }));

  const mapG2 = new Map();
  grid2.forEach((g) => {
    if (!mapG2.has(String(g.salesman).toLowerCase())) mapG2.set(String(g.salesman).toLowerCase(), g);
  });

  const flag2 = grid2.length > 0;

  // ── Margin di bawah lima (overdue) − kurangi pengali ──
  const q4 = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 limit 1) AS salesman,
      SUM(minus * bycd_bayar/fp_amount) AS total,
      if(s < 7,"Cash",if(s<41,"40 Hari",if(s < 60,"60 Hari","lebih dari 60"))) AS overdue
    FROM (
      SELECT sls_nama, sls_kode, fp_nomor, byc_tanggal, fp_tanggal, DATEDIFF(byc_tanggal,fp_tanggal) s,
        bycd_bayar, fp_amount,
        (SELECT SUM((100-fpd_discpr)/100*fpd_harga*fpd_qty) FROM tfp_dtl
          INNER JOIN tfp_hdr ON fp_nomor=fpd_fp_nomor
          inner join tbarang on fpd_brg_kode=brg_kode
          inner join tmasterstok on mst_noreferensi =fp_do_nomor and fpd_brg_kode=mst_brg_kode and fpd_expired=mst_expired_date
          WHERE fpd_fp_nomor=x.fp_nomor
          AND (((100-fpd_discpr)/100*fpd_harga)-mst_hargabeli)/mst_hargabeli*100 < 5
          and (fpd_hrg_min < 1 or brg_isproductfocus <> 1)) AS minus
      FROM tBAYARcus_dtl
        INNER JOIN tbayarcus_hdr ON byc_nomor=bycd_byc_nomor
        INNER JOIN tfp_hdr x ON fp_nomor=bycd_fp_nomor
        LEFT JOIN tso_hdr ON so_nomor=x.fp_so_nomor
        INNER JOIN tsalesman ON sls_kode=so_sls_kode
      WHERE MONTH(byc_tanggal)=${bulanInt} AND YEAR(byc_tanggal)=${tahunInt}) final
    GROUP BY sls_nama, overdue HAVING total IS NOT NULL
  `;
  let q4rows = [];
  try { const [r] = await db.query(q4); q4rows = r; } catch (e) { q4rows = []; }
  for (const r of q4rows) {
    const g = mapG2.get(String(r.salesman || "").toLowerCase());
    if (!g) continue;
    const t = Number(r.total) || 0;
    if (r.overdue === "Cash") { /* pengali4 tidak dikurang */ }
    else if (r.overdue === "40 Hari") g.pengali = g.pengali - t;
    else if (r.overdue === "60 Hari") g.pengali2 = g.pengali2 - t;
    else if (r.overdue === "lebih dari 60") g.pengali3 = g.pengali3 - t;
  }

  // ── Margin hrg_min (pengurang) − kurangi pengali ──
  // Sumber: tkartupiutang (dulu VIEW kartu_piutang). Join ke tfp_hdr
  // lewat kp_fpref (nomor FP yang dibayar) — pengganti noreferensi.
  // Kolom view -> kolom tabel: kredit -> kp_kredit, tanggal -> kp_tanggal,
  // noreferensi -> kp_fpref (join fp_nomor), fp_tanggal -> fh.fp_tanggal.
  const q5 = `
    SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = sls_kode AND sla_isaktif = 1 limit 1) AS salesman,
      sum(if(selisihhari <=7,pengurang,0)) AS cash,
      sum(if((selisihhari <=40) AND (selisihhari>7),pengurang,0)) AS empat,
      sum(if((selisihhari <=60) AND (selisihhari>40),pengurang,0)) AS enam,
      sum(if(selisihhari>60,pengurang,0)) AS sembilan
    FROM (
      SELECT sls_nama, sls_kode, kp.kp_kredit kredit, kp.kp_tanggal tanggal, fh.fp_nomor noreferensi,
        fh.fp_tanggal, DATEDIFF(kp.kp_tanggal, fh.fp_tanggal) selisihhari,
        (SELECT sum(((fpd_harga*(100-fpd_discpr)/100)-(fpd_cn*((100-fpd_discpr)*fpd_harga/100)/100)-
          (((100-fpd_discpr)*fpd_harga/100)*fpd_bp_pr/100)-fpd_bp_rp) * fpd_qty)
          FROM tfp_dtl INNER JOIN tfp_hdr td2 ON fp_nomor=fpd_fp_nomor
          LEFT JOIN tso_hdr ON so_nomor= fp_so_nomor
          INNER JOIN tsalesman ON sls_kode=so_sls_kode INNER JOIN tbarang ON brg_kode=fpd_brg_kode
          INNER JOIN tcustomer ON fp_cus_kode=cus_kode
          WHERE fpd_fp_nomor = fh.fp_nomor AND fpd_hrg_min > 0 AND brg_isproductfocus=1
          AND (fpd_harga*(100-fpd_discpr)/100)-(fpd_cn*((100-fpd_discpr)*fpd_harga/100)/100)-
          (((100-fpd_discpr)*fpd_harga/100)*fpd_bp_pr/100)-fpd_bp_rp < fpd_hrg_min ) *(kp.kp_kredit/fh.fp_amount) pengurang
      FROM tkartupiutang kp
        INNER JOIN tsalesman ON sls_kode=kp_rayon
        INNER JOIN tfp_hdr fh ON fh.fp_nomor = kp.kp_fpref
        WHERE MONTH(kp.kp_tanggal)=${bulanInt} AND YEAR(kp.kp_tanggal)=${tahunInt} AND kp.kp_noref LIKE "01-CR.%"
      HAVING pengurang > 0) final
    GROUP BY sls_nama
  `;
  let q5rows = [];
  try { const [r] = await db.query(q5); q5rows = r; } catch (e) { q5rows = []; }
  for (const r of q5rows) {
    const g = mapG2.get(String(r.salesman || "").toLowerCase());
    if (!g) continue;
    g.pengali4 = g.pengali4 - (Number(r.cash) || 0);
    g.pengali = g.pengali - (Number(r.empat) || 0);
    g.pengali2 = g.pengali2 - (Number(r.enam) || 0);
    g.pengali3 = g.pengali3 - (Number(r.sembilan) || 0);
  }

  // ── Tabel komisi (batch) utk helper getkomisijual & getperseninkaso ──
  let tabJual = [];
  let tabInkaso = [];
  if (flag2) {
    try {
      const [rj] = await db.query("SELECT ksj_bawah, ksj_atas, ksj_komisi FROM tkomisisales_jual");
      tabJual = rj;
    } catch (e) { tabJual = []; }
    try {
      const [ri] = await db.query("SELECT ksj_bawah, ksj_atas, ksj_komisi, ksj_komisi2, ksj_komisi3, ksj_komisi4 FROM tkomisisales_inkaso");
      tabInkaso = ri;
    } catch (e) { tabInkaso = []; }
  }

  const lookupKomisi = (rows, col, p) => {
    for (const r of rows) {
      if (Number(r.ksj_bawah) <= p && Number(r.ksj_atas) >= p) return Number(r[col]) || 0;
    }
    return 0;
  };

  // Masa kerja salesman (cekmasakerja): sla_nama → banyak bulan > 3
  const masaKerja = new Map();
  const loadMasaKerja = async (nama) => {
    const key = String(nama).toLowerCase();
    if (masaKerja.has(key)) return masaKerja.get(key);
    let ok = false;
    try {
      const [rows] = await db.query(
        "SELECT TIMESTAMPDIFF(MONTH, sla_tgl_masuk, CURDATE()) AS masuk FROM tsalesmanaktif WHERE sla_nama = ?",
        [nama]
      );
      ok = rows.length > 0 && Number(rows[0].masuk) > 3;
    } catch (e) { ok = false; }
    masaKerja.set(key, ok);
    return ok;
  };

  // ── Hitung komisi per salesman (Delphi per-bar ds32 loop) ──
  for (const g of grid2) {
    const g1 = mapG1.get(String(g.salesman).toLowerCase()) || {
      target_jual: 0, persentase_jual: 0,
      persentase_tempo: 0, persentase_piutang: 0,
      realisasi_other: 0, persentase_other: 0,
    };
    const arealisasijual = g1.persentase_jual;
    const arealisasiinkaso = g1.persentase_piutang;

    const apotong = g1.target_jual < 100000000 ? 0.5 : 1;
    const apotong2 = (g1.persentase_tempo < 70 && arealisasiinkaso > 70) ? 0.5 : 1;

    g.komisi_jual = apotong * lookupKomisi(tabJual, "ksj_komisi", arealisasijual);

    const kerja = await loadMasaKerja(g.salesman);
    if ((arealisasiinkaso >= 70) && (g1.persentase_jual >= 70) && (g.komisi_jual > 0) && kerja) {
      g.persen = apotong2 * apotong * lookupKomisi(tabInkaso, "ksj_komisi", arealisasiinkaso);
      g.nilai = g.persen * g.pengali / 100;
      g.persen2 = apotong2 * apotong * lookupKomisi(tabInkaso, "ksj_komisi2", arealisasiinkaso);
      g.nilai2 = g.persen2 * g.pengali2 / 100;
      g.persen3 = apotong2 * apotong * lookupKomisi(tabInkaso, "ksj_komisi3", arealisasiinkaso);
      g.nilai3 = g.persen3 * g.pengali3 / 100;
      g.persen4 = apotong2 * apotong * lookupKomisi(tabInkaso, "ksj_komisi4", arealisasiinkaso);
      g.nilai4 = g.persen4 * g.pengali4 / 100;
    }

    g.komisipf = 0;
    g.komisiothers = 0;
    if (g1.persentase_other >= 120 && g1.realisasi_other >= 100000000) g.komisiothers = 400000;

    g.total = g.komisipf + g.komisiothers + g.komisi_jual + g.nilai + g.nilai2 + g.nilai3 + g.nilai4;
  }

  return { grid1, grid2 };
};

module.exports = { getBrowse };
