// services/otorisasiService.js
const db = require("../config/database");
const aiCfg = require("../config/ai");
const fpFormService = require("./penjualan/fpFormService");
const listJualMarginSvc = require("./laporan/listJualPerFakturMarginService");

// Format tanggal YYYY-MM-DD lewat UTC (hindari geser ±1 hari, §7.g dokumen AI).
const ymd = (v) =>
  v instanceof Date
    ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
    : String(v || "");

const ymLabel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Kode otorisasi berbasis waktu server: HHMMSS (variant 1)
 * atau 99HHMMSS (variant 2, harga bawah lastcost) — paritas
 * UfrmOtorisasi.getnomorterakhir.
 */
const generateKode = (variant = 1) => {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const nn = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  return (variant === 2 ? "99" : "") + hh + nn + ss;
};

const hitungAlasan = (net, lastcost, hET, minMargin) => {
  if (net < lastcost) return "below_lastcost";
  if (hET > 0 && net < hET) return "below_het";
  if (lastcost > 0 && ((net - lastcost) / lastcost) * 100 < minMargin) return "below_margin";
  return "";
};

/**
 * Registry per jenis (bukan if berantai): 1 entri per modul.
 * Tambah modul baru (RETUR/CUSTOMER/dll) = tambah 1 fungsi di map ini.
 * Fungsi menerima konteks {form, detail} dan wajib query DB fresh.
 */
const enrich = {
  FP: async ({ form = {}, detail = [] } = {}) => {
    const rows = [];
    for (const d of detail) {
      const m = await fpFormService.getMarginData(
        Number(d.brgKode),
        d.expired || "",
        form.nomorSO || "",
        form.cusKode || ""
      );
      const harga = Number(d.harga || 0);
      const discPr = Number(d.discPr || 0);
      const cn = Number(d.cn || 0);
      const promosiRp = Number(d.promosiRp || 0);
      const promosiPr = Number(d.promosiPr || 0);
      const feeRp = Number(d.feeRp || 0);
      const feePr = Number(d.feePr || 0);

      const hargaNet = (harga * (100 - discPr)) / 100;
      const net =
        hargaNet -
        (cn * hargaNet) / 100 -
        promosiRp -
        (promosiPr * hargaNet) / 100 -
        feeRp -
        (feePr * hargaNet) / 100;
      const marginPct = m.lastcost > 0 ? ((net - m.lastcost) / m.lastcost) * 100 : 999;

      const [[brg]] = await db.query(
        `SELECT brg_nama AS nama FROM tbarang WHERE brg_kode = ? LIMIT 1`,
        [Number(d.brgKode)]
      );

      rows.push({
        brgKode: Number(d.brgKode),
        brgNama: brg?.nama || "",
        qty: Number(d.qty || 0),
        satuan: d.satuan || "",
        harga,
        discPr,
        hargaNet: Number(hargaNet.toFixed(2)),
        net: Number(net.toFixed(2)),
        lastcost: m.lastcost,
        hET: m.hET,
        marginPct: Number(marginPct.toFixed(2)),
        minMargin: m.minMargin || 0,
        alasan: hitungAlasan(net, m.lastcost, m.hET, m.minMargin || 0),
      });
    }

    let cusNama = "";
    if (form.cusKode) {
      const [[c]] = await db.query(
        `SELECT cus_nama AS nama FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
        [form.cusKode]
      );
      cusNama = c?.nama || "";
    }

    return {
      judul: "Otorisasi Harga Bawah Lastcost",
      form: { ...form, cusNama },
      detail: rows,
      totalNet: Number(rows.reduce((s, r) => s + r.net, 0).toFixed(2)),
    };
  },

  // Buka customer (Open/Unlock) — bahan keputusan manager finance.
  // Otak bisnis dari pola chat WA kasir→finance: piutang per bulan (bulan
  // faktur outstanding), faktur tertua + lewat tempo terlama, bayar terakhir
  // (tanggal + nominal), total bayar bulan lalu, omzet bulan berjalan s.d.
  // hari ini, terakhir belanja. Manager yang memutuskan — sistem tidak auto-tolak.
  CUSTOMER: async ({ form = {} } = {}) => {
    const empty = {
      judul: "Otorisasi Buka Customer",
      form: {}, piutang: { total: 0, jumlahFaktur: 0, perBulan: [] },
      bayarTerakhir: null, bayarBulanLalu: null, omzetBulanIni: null,
      detail: [], totalNet: 0,
    };
    const cusKode = String(form.cusKode || "");
    if (!cusKode) return empty;

    const today = new Date();
    const todayStr = ymd(today);
    const firstOfMonth = `${ymLabel(today)}-01`;
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const [[cus]] = await db.query(
      `SELECT c.cus_kode, c.cus_nama, c.cus_alamat, c.cus_kota, IFNULL(c.cus_top,0) cus_top,
              (SELECT s.sls_nama FROM tsalescustomer sc
               INNER JOIN tsalesman s ON s.sls_kode = sc.sc_sls_kode
               WHERE sc.sc_cus_kode = c.cus_kode LIMIT 1) marketing,
              (SELECT MAX(fp_tanggal) FROM tfp_hdr WHERE fp_cus_kode = c.cus_kode) terakhir_belanja
       FROM tcustomer c WHERE c.cus_kode = ? LIMIT 1`,
      [cusKode]
    );
    if (!cus) return empty;

    // Piutang live per bulan faktur — formula FOS (listFakturOutstandingService):
    // sisa = (fp_amount - fp_dp - fp_bayar) - retur. Lewat tempo = DATEDIFF(hari ini, fp_jthtempo).
    const [piutangRows] = await db.query(
      `SELECT DATE_FORMAT(z.fp_tanggal, '%Y-%m') bulan,
              COUNT(*) jumlah_faktur,
              ROUND(SUM((z.fp_amount - IFNULL(z.fp_dp,0) - IFNULL(z.fp_bayar,0))
                        - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = z.fp_nomor),0))) total,
              MAX(DATEDIFF(?, z.fp_jthtempo)) max_overdue,
              MIN(z.fp_tanggal) tanggal_tertua
       FROM tfp_hdr z
       WHERE z.fp_cus_kode = ? AND (z.fp_amount - IFNULL(z.fp_dp,0) - IFNULL(z.fp_bayar,0)) > 0
       GROUP BY bulan ORDER BY bulan ASC`,
      [todayStr, cusKode]
    );

    const perBulan = (piutangRows || []).map((r) => ({
      bulan: r.bulan,
      jumlahFaktur: Number(r.jumlah_faktur),
      total: Number(r.total) || 0,
    }));
    const piutangTotal = perBulan.reduce((s, r) => s + r.total, 0);

    // Bayar terakhir: dokumen tbayarcus terbaru + jumlahnya.
    const [[byr]] = await db.query(
      `SELECT h.byc_tanggal, ROUND(SUM(IFNULL(d.bycd_bayar,0))) total
       FROM tbayarcus_hdr h
       INNER JOIN tbayarcus_dtl d ON d.bycd_byc_nomor = h.byc_nomor
       WHERE h.byc_cus_kode = ?
       GROUP BY h.byc_nomor, h.byc_tanggal
       ORDER BY h.byc_tanggal DESC LIMIT 1`,
      [cusKode]
    );

    // Total bayar bulan kalender lalu (pola tunai bulanan komisiSalesmanService).
    const [[byrLalu]] = await db.query(
      `SELECT ROUND(SUM(IFNULL(d.bycd_bayar,0))) total
       FROM tbayarcus_hdr h
       INNER JOIN tbayarcus_dtl d ON d.bycd_byc_nomor = h.byc_nomor
       WHERE h.byc_cus_kode = ? AND YEAR(h.byc_tanggal) = ? AND MONTH(h.byc_tanggal) = ?`,
      [cusKode, lastMonth.getFullYear(), lastMonth.getMonth() + 1]
    );

    // Omzet bulan berjalan (1 tgl s.d. hari ini) — basis omzet kotor dashboard.
    const [[omzet]] = await db.query(
      `SELECT ROUND(SUM(IFNULL(z.fp_amount,0) - IFNULL(z.fp_freight,0))) total
       FROM tfp_hdr z WHERE z.fp_cus_kode = ? AND z.fp_tanggal BETWEEN ? AND ?`,
      [cusKode, firstOfMonth, todayStr]
    );

    return {
      judul: "Otorisasi Buka Customer",
      form: {
        cusKode: cus.cus_kode,
        cusNama: cus.cus_nama || "",
        cusAlamat: cus.cus_alamat || "",
        cusKota: cus.cus_kota || "",
        top: Number(cus.cus_top) || 0,
        marketing: cus.marketing || "",
        terakhirBelanja: ymd(cus.terakhir_belanja),
      },
      piutang: {
        total: piutangTotal,
        jumlahFaktur: perBulan.reduce((s, r) => s + r.jumlahFaktur, 0),
        bulanTertua: perBulan[0]?.bulan || "",
        maxOverdue: Math.max(0, ...(piutangRows || []).map((r) => Number(r.max_overdue) || 0)),
        perBulan,
      },
      bayarTerakhir: byr
        ? { tanggal: ymd(byr.byc_tanggal), nominal: Number(byr.total) || 0 }
        : null,
      bayarBulanLalu: { bulan: ymLabel(lastMonth), total: Number(byrLalu?.total) || 0 },
      omzetBulanIni: { bulan: ymLabel(today), total: Number(omzet?.total) || 0 },
      detail: perBulan,
      totalNet: piutangTotal,
    };
  },

  // Serah Terima Ekspedisi — baris tipe FP yang rasionya (margin/nilai) < 10%.
  // Nilai Net/HPP/Margin diambil dari laporan "List Jual Per Faktur (Margin)"
  // per no faktur (sumber resmi, formula tidak diduplikasi di sini).
  STE: async ({ form = {} } = {}) => {
    const fpNomor = String(form.fpNomor || "");
    const base = {
      judul: "Otorisasi Serah Terima Ekspedisi",
      form: {
        fpNomor,
        steNomor: form.steNomor || "",
        tipe: form.tipe || "",
        customer: form.cusNama || "",
      },
      detail: [],
      totalNet: 0,
    };
    if (!fpNomor) return base;

    // Paksa user finance agar Hpp/Margin tidak di-strip oleh gate service.
    const user = { kode: aiCfg.financeKodes[0] || "FINANCE" };
    const rows = await listJualMarginSvc.getBrowse({ nomor: fpNomor }, user);
    const r = rows && rows[0];
    if (!r) {
      return {
        ...base,
        detail: [{ nomor: fpNomor, customer: base.form.customer, net: 0, hpp: 0, margin: 0, marginPct: null, tersedia: false }],
      };
    }

    const net = Number(r.Net) || 0;
    const hpp = Number(r.Hpp) || 0;
    const margin = Number(r.Margin) || 0;
    const marginPct = net !== 0 ? Number(((margin / net) * 100).toFixed(2)) : null;

    return {
      ...base,
      form: { ...base.form, customer: r.Customer || base.form.customer, tanggal: ymd(r.Tanggal) },
      detail: [{ nomor: fpNomor, customer: r.Customer || "", net, hpp, margin, marginPct, tersedia: true }],
      totalNet: net,
    };
  },
};

const defaultEnricher = async () => ({ judul: "Otorisasi", detail: [], totalNet: 0 });

const request = async ({ jenis, variant = 1, userKode = "", cabang = "", database = "", konteks }) => {
  if (!jenis || !konteks) throw new Error("jenis dan konteks wajib.");
  const kode = generateKode(Number(variant) || 1);
  await db.systemPool.query(
    `INSERT INTO totorisasi (kode, jenis, cabang, dbase, user_kode, konteks, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
     ON DUPLICATE KEY UPDATE konteks = VALUES(konteks), status = 'PENDING',
                             hasil = NULL, diverifikasi_pada = NULL, ref_nomor = NULL,
                             cabang = VALUES(cabang), dbase = VALUES(dbase), user_kode = VALUES(user_kode)`,
    [kode, jenis, cabang, database, userKode, JSON.stringify(konteks)]
  );
  return { kode };
};

const getDetail = async (kode) => {
  if (!kode) throw new Error("kode wajib.");

  // Tabel GLOBAL di database pusat (DB_NAME). Cabang peminta tersimpan di baris.
  const [[row]] = await db.systemPool.query(
    `SELECT kode, jenis, cabang, dbase, status, ref_nomor, konteks
     FROM totorisasi WHERE kode = ? LIMIT 1`,
    [kode]
  );
  if (!row) return null;

  const cabangNama = "Kali Rejo Makmur";

  // Query detail (lastcost dll) harus berjalan di DB cabang peminta.
  return db.run(row.dbase, async () => {
    let konteks = {};
    try {
      konteks = JSON.parse(row.konteks);
    } catch {
      /* konteks korup → detail default */
    }

    const enricher = enrich[row.jenis] || defaultEnricher;
    const hasil = await enricher(konteks);

    await db.systemPool.query(
      `UPDATE totorisasi SET hasil = ? WHERE kode = ?`,
      [JSON.stringify(hasil), kode]
    );

    return {
      kode: row.kode,
      jenis: row.jenis,
      status: row.status,
      refNomor: row.ref_nomor,
      cabang: row.cabang,
      cabangNama,
      dbase: row.dbase,
      ...hasil,
    };
  });
};

const verify = async (kode, password) => {
  if (!kode || password === undefined || password === "")
    throw new Error("kode dan password wajib.");

  const [[row]] = await db.systemPool.query(
    `SELECT kode FROM totorisasi WHERE kode = ? LIMIT 1`,
    [kode]
  );
  if (!row) return { approved: false, reason: "Kode tidak ditemukan." };

  const kodeNum = Number(kode);
  const passNum = Number(password);
  const ok = !isNaN(kodeNum) && !isNaN(passNum) && kodeNum * 21 + 53 * 4 === passNum;
  if (!ok) return { approved: false, reason: "Otorisasi salah." };

  await db.systemPool.query(
    `UPDATE totorisasi SET status = 'DONE', diverifikasi_pada = NOW()
     WHERE kode = ?`,
    [kode]
  );

  return { approved: true };
};

module.exports = { request, getDetail, verify, generateKode };