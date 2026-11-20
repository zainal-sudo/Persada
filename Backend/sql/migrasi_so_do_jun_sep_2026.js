const db = require("../src/config/database");

const START = "2026-06-01";
const END = "2026-10-01";
const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];
const TAG = "MIG-SODO";
const BATCH = 200;

const num = (v) => Number(v) || 0;
const ymOf = (s) => { const [y, m] = String(s).split("-"); return String(y).slice(2) + m; };
const expOf = (s) => (!s || String(s).startsWith("0000") ? "9999-12-31" : s);
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const pickGudang = (lines) => {
  const m = new Map();
  for (const l of lines) {
    const g = l.fpd_gdg_kode || "";
    if (!g) continue;
    m.set(g, (m.get(g) || 0) + num(l.fpd_qty));
  }
  let best = "";
  let max = -1;
  for (const [g, q] of m) {
    if (q > max) {
      max = q;
      best = g;
    }
  }
  return best || lines[0]?.fpd_gdg_kode || "GDG001";
};

const getMaxSeq = async (conn, table, col, prefix) => {
  const [[r]] = await conn.query(
    `SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(${col}, '-', -1) AS UNSIGNED)), 0) AS max_val
     FROM ${table} WHERE ${col} LIKE ?`,
    [`${prefix}%`]
  );
  return Number(r?.max_val) || 0;
};

const insertBatch = async (conn, sql, rows) => {
  for (const part of chunk(rows, BATCH)) {
    await conn.query(sql, [part]);
  }
};

const processMonth = async (conn, ym) => {
  const y = ym.slice(0, 4);
  const m = ym.slice(5, 7);
  const start = `${y}-${m}-01`;
  const soPrefix = `SO-${ymOf(ym)}-`;
  const doPrefix = `DO-${ymOf(ym)}-`;

  const [fps] = await conn.query(
    `SELECT f.fp_nomor, DATE_FORMAT(f.FP_tanggal, '%Y-%m-%d') AS fp_tanggal,
            DATE_FORMAT(f.FP_jthtempo, '%Y-%m-%d') AS fp_jthtempo,
            f.FP_cus_kode AS fp_cus_kode, f.FP_memo AS fp_memo, f.FP_istax AS fp_istax,
            f.FP_disc_faktur AS fp_disc_faktur, f.FP_disc_fakturpr AS fp_disc_fakturpr,
            f.FP_amount AS fp_amount, f.FP_taxamount AS fp_taxamount, f.fp_sla_kode
     FROM tfp_hdr f
     WHERE f.FP_tanggal >= ? AND f.FP_tanggal < DATE_ADD(?, INTERVAL 1 MONTH)
       AND IFNULL(f.fp_so_nomor, '') = '' AND IFNULL(f.fp_do_nomor, '') = ''
     ORDER BY f.FP_tanggal, f.fp_nomor`,
    [start, start]
  );

  const [partial] = await conn.query(
    `SELECT COUNT(*) AS n FROM tfp_hdr
     WHERE FP_tanggal >= ? AND FP_tanggal < DATE_ADD(?, INTERVAL 1 MONTH)
       AND (IFNULL(fp_so_nomor, '') <> '' OR IFNULL(fp_do_nomor, '') <> '')
       AND NOT (IFNULL(fp_so_nomor, '') <> '' AND IFNULL(fp_do_nomor, '') <> '')`,
    [start, start]
  );

  console.log(`\n[${ym}] FP belum terhubung: ${fps.length}; parsial: ${partial[0].n}`);
  if (!fps.length) {
    await conn.commit();
    return 0;
  }

  const fpNos = fps.map((x) => x.fp_nomor);
  const [details] = await conn.query(
    `SELECT FPd_FP_nomor AS fpd_fp_nomor, FPd_brg_kode AS fpd_brg_kode,
            FPd_brg_satuan AS fpd_brg_satuan, FPd_qty AS fpd_qty,
            FPd_harga AS fpd_harga, FPd_discpr AS fpd_discpr,
            FPd_nourut AS fpd_nourut, DATE_FORMAT(fpd_expired, '%Y-%m-%d') AS fpd_expired,
            fpd_gdg_kode, fpd_idbatch
     FROM tfp_dtl WHERE FPd_FP_nomor IN (?) ORDER BY FPd_FP_nomor, FPd_nourut`,
    [fpNos]
  );

  const detailBy = new Map();
  for (const d of details) {
    if (!detailBy.has(d.fpd_fp_nomor)) detailBy.set(d.fpd_fp_nomor, []);
    detailBy.get(d.fpd_fp_nomor).push(d);
  }

  const slaCodes = [...new Set(fps.map((x) => x.fp_sla_kode).filter(Boolean))];
  const slsBy = new Map();
  if (slaCodes.length) {
    const [sla] = await conn.query(
      `SELECT slad_sla_kode, MIN(slad_sls_kode) AS sls
       FROM tsalesmanaktif_dtl WHERE slad_sla_kode IN (?) GROUP BY slad_sla_kode`,
      [slaCodes]
    );
    for (const s of sla) slsBy.set(s.slad_sla_kode, s.sls || "");
  }

  let soSeq = await getMaxSeq(conn, "tso_hdr", "so_nomor", soPrefix);
  let doSeq = await getMaxSeq(conn, "tdo_hdr", "do_nomor", doPrefix);

  const soHdr = [];
  const soDtl = [];
  const doHdr = [];
  const doDtl = [];
  const links = [];

  for (const h of fps) {
    const lines = detailBy.get(h.fp_nomor) || [];
    if (!lines.length) {
      console.log(`  SKIP ${h.fp_nomor}: tanpa detail`);
      continue;
    }

    soSeq += 1;
    doSeq += 1;
    const so = `${soPrefix}${String(soSeq).padStart(5, "0")}`;
    const doNo = `${doPrefix}${String(doSeq).padStart(5, "0")}`;
    const gdg = pickGudang(lines);

    soHdr.push([
      so, h.fp_tanggal, String(h.fp_memo || "").slice(0, 100), h.fp_cus_kode || "", "",
      String(slsBy.get(h.fp_sla_kode) || "").slice(0, 10), h.fp_sla_kode || "",
      num(h.fp_disc_faktur), num(h.fp_disc_fakturpr), num(h.fp_amount), num(h.fp_taxamount),
      0, 1, 1, num(h.fp_istax), h.fp_jthtempo, h.fp_tanggal, h.fp_tanggal,
      TAG, "", "", "", 1, 0
    ]);

    for (const l of lines) {
      soDtl.push([
        so, l.fpd_brg_kode, l.fpd_brg_satuan || "PCS", num(l.fpd_qty), 0, num(l.fpd_qty),
        num(l.fpd_discpr), num(l.fpd_harga), 1, 0, num(l.fpd_nourut), "", "-"
      ]);
    }

    doHdr.push([
      doNo, h.fp_tanggal, so, h.fp_cus_kode || "", "", String(h.fp_memo || "").slice(0, 100),
      gdg, 1, h.fp_tanggal, h.fp_tanggal, TAG, "", 1, 0
    ]);

    for (const l of lines) {
      doDtl.push([
        doNo, l.fpd_brg_kode, l.fpd_brg_satuan || "PCS", num(l.fpd_qty), expOf(l.fpd_expired),
        num(l.fpd_nourut), 0, num(l.fpd_qty), 1, l.fpd_gdg_kode || gdg, l.fpd_idbatch || ""
      ]);
    }

    links.push([h.fp_nomor, so, doNo]);
  }

  console.log(`  insert ${soHdr.length} SO/${soDtl.length} detail ...`);
  await insertBatch(
    conn,
    `INSERT INTO tso_hdr
      (so_nomor, so_tanggal, so_memo, so_cus_kode, so_shipaddress, so_sls_kode, so_sla_kode,
       so_disc_faktur, so_disc_fakturpr, so_amount, so_taxamount, so_DP, so_iskirim, so_isclosed,
       so_istax, so_jthtempo, date_create, date_modified, user_create, user_modified,
       so_rek_dp, so_nopesanan, so_isinvoice, so_isecer)
     VALUES ?`,
    soHdr
  );
  await insertBatch(
    conn,
    `INSERT INTO tso_dtl
      (sod_so_nomor, sod_brg_kode, sod_brg_satuan, sod_qty, sod_qty_kirim, sod_qty_invoice,
       sod_discpr, sod_harga, sod_iskirim, sod_isclosed, sod_nourut, sod_keterangan, brg_kode_lama)
     VALUES ?`,
    soDtl
  );

  console.log(`  insert ${doHdr.length} DO/${doDtl.length} detail (trigger stok) ...`);
  await insertBatch(
    conn,
    `INSERT INTO tdo_hdr
      (do_nomor, do_tanggal, do_so_nomor, do_cus_Kode, do_shipaddress, do_memo, do_gdg_kode,
       do_isinvoice, date_create, date_modified, user_create, user_modified, do_isclosed, do_iskembali)
     VALUES ?`,
    doHdr
  );
  await insertBatch(
    conn,
    `INSERT INTO tdo_dtl
      (dod_do_nomor, dod_brg_kode, dod_brg_satuan, dod_qty, dod_tgl_expired, dod_nourut,
       dod_status, dod_qty_invoice, dod_isclosed, dod_gdg_kode, dod_idbatch)
     VALUES ?`,
    doDtl
  );

  console.log(`  link ${links.length} FP ...`);
  for (const [fp, so, doNo] of links) {
    await conn.query(
      `UPDATE tfp_hdr SET fp_so_nomor = ?, fp_do_nomor = ?, user_modified = ?
       WHERE fp_nomor = ?`,
      [so, doNo, TAG, fp]
    );
  }

  await conn.commit();
  return links.length;
};

const verifyMonth = async (conn, ym) => {
  const y = ym.slice(0, 4);
  const m = ym.slice(5, 7);
  const start = `${y}-${m}-01`;
  const soPrefix = `SO-${ymOf(ym)}-%`;
  const doPrefix = `DO-${ymOf(ym)}-%`;
  const [[fp]] = await conn.query(
    `SELECT COUNT(*) AS n,
            SUM(IF(fp_so_nomor LIKE ? AND fp_do_nomor LIKE ?, 1, 0)) AS linked
     FROM tfp_hdr WHERE FP_tanggal >= ? AND FP_tanggal < DATE_ADD(?, INTERVAL 1 MONTH)`,
    [soPrefix, doPrefix, start, start]
  );
  const [[so]] = await conn.query(
    `SELECT COUNT(*) AS h, IFNULL(SUM(so_amount),0) AS amount
     FROM tso_hdr WHERE so_nomor LIKE ?`,
    [soPrefix]
  );
  const [[sod]] = await conn.query(
    `SELECT COUNT(*) AS n FROM tso_dtl WHERE sod_so_nomor LIKE ?`,
    [soPrefix]
  );
  const [[doo]] = await conn.query(
    `SELECT COUNT(*) AS h FROM tdo_hdr WHERE do_nomor LIKE ?`,
    [doPrefix]
  );
  const [[dod]] = await conn.query(
    `SELECT COUNT(*) AS n, IFNULL(SUM(dod_qty),0) AS qty FROM tdo_dtl WHERE dod_do_nomor LIKE ?`,
    [doPrefix]
  );
  const [[mst]] = await conn.query(
    `SELECT COUNT(*) AS n, IFNULL(SUM(mst_stok_out),0) AS qty
     FROM tmasterstok WHERE mst_noreferensi LIKE ?`,
    [doPrefix]
  );
  const [[orphanSo]] = await conn.query(
    `SELECT COUNT(*) AS n FROM tso_hdr h LEFT JOIN tso_dtl d ON d.sod_so_nomor = h.so_nomor
     WHERE h.so_nomor LIKE ? AND d.sod_so_nomor IS NULL`,
    [soPrefix]
  );
  const [[orphanDo]] = await conn.query(
    `SELECT COUNT(*) AS n FROM tdo_hdr h LEFT JOIN tdo_dtl d ON d.dod_do_nomor = h.do_nomor
     WHERE h.do_nomor LIKE ? AND d.dod_do_nomor IS NULL`,
    [doPrefix]
  );

  return {
    fp: fp.n, linked: Number(fp.linked) || 0, so: so.h, soAmount: Number(so.amount) || 0,
    soDetail: sod.n, do: doo.h, doDetail: dod.n, doQty: Number(dod.qty) || 0,
    stokOutRows: mst.n, stokOutQty: Number(mst.qty) || 0,
    orphanSo: orphanSo.n, orphanDo: orphanDo.n
  };
};

(async () => {
  const only = process.argv[2];
  const months = only ? MONTHS.filter((x) => x === only) : MONTHS;
  if (!months.length) throw new Error(`Bulan tidak dikenal: ${only}`);

  console.log(`Target: ${START} .. ${END}; bulan: ${months.join(", ")}`);
  for (const ym of months) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const n = await processMonth(conn, ym);
      const v = await verifyMonth(conn, ym);
      console.log(`[${ym}] selesai: ${n} FP`);
      console.log(JSON.stringify(v, null, 2));
    } catch (e) {
      await conn.rollback().catch(() => {});
      console.error(`[${ym}] GAGAL, rollback: ${e.message}`);
      console.error(e.sql || "");
      conn.release();
      process.exit(1);
    } finally {
      conn.release();
    }
  }
  console.log("\nSEMUA SELESAI");
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
