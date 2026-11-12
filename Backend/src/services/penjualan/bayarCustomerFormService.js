// services/penjualan/bayarCustomerFormService.js
const db = require("../../config/database");

// ── Generate Nomor ───────────────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-CR.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(byc_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tbayarcus_hdr WHERE byc_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  const shortNum = String(nextNum).slice(-4);
  return `${prefix}${shortNum.padStart(4, "0")}`;
};

// ── Get Customer ─────────────────────────────────────────────────────
const getCustomer = async (search = "") => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama, cus_alamat AS alamat, cus_telp AS telp
     FROM tcustomer
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     ORDER BY cus_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get Rekening ─────────────────────────────────────────────────────
// Paritas Delphi GetCDSRekeningPotongan: non-FINANCE/PIUTANG tidak boleh
// memakai rekening potongan khusus 14.004.
const getRekening = async (jenis = "cash", userKode = "") => {
  let whereClause = "";

  if (jenis === "cash" || jenis === "transfer") {
    whereClause = `WHERE rek_kol_id = 1 AND rek_isaktif = 1 AND rek_nama LIKE 'B%'`;
  } else if (jenis === "giro") {
    whereClause = `WHERE rek_isaktif = 1 AND rek_nama LIKE '%giro%'`;
  } else if (jenis === "potongan") {
    whereClause = isFinanceRole(userKode)
      ? `WHERE rek_isaktif = 1`
      : `WHERE rek_isaktif = 1 AND rek_kode NOT LIKE '14.004'`;
  } else if (jenis === "ppn") {
    whereClause = `WHERE rek_isaktif = 1 AND rek_nama LIKE 'PPN%'`;
  } else if (jenis === "pph") {
    whereClause = `WHERE rek_isaktif = 1 AND rek_nama LIKE 'PPH%'`;
  }

  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening ${whereClause}
     ORDER BY rek_nama LIMIT 50`
  );
  return rows;
};

// ── Get Invoice ──────────────────────────────────────────────────────
// includePaid: true saat load form edit — invoice yang sudah lunas/dipilih
// tetap ditampilkan (Delphi: filter HAVING hanya untuk dokumen baru / FLAGEDIT=False).
// ── Format tanggal utk hasil getInvoice ──
// Database.js memakai timezone +07:00; mysql2 memberi Date; format lokal.
const fmtDate = (v) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
};

const getInvoice = async (cusKode, isTax, includePaid = false) => {
  // Dua bagian query bergabung dalam UNION ALL:
  //   A) faktur ANGSUR (punya tjatuhtempofp) → SATU BARIS PER TERMIN.
  //      nilai = jt_nilai, jthTempo = jt_tanggaljt.
  //      terbayar = jumlah pembayaran utk termin itu
  //      (bycd_fp_nomor = fp_nomor AND bycd_jthtempo = jt_tanggaljt).
  //   B) faktur BIASA → satu baris per faktur (perilaku lama).
  const taxCond = Number(isTax) === 1 ? "fp_istax = 1" : "fp_istax <> 1";

  const sql = `
    SELECT Salesman, Invoice, Tanggal, JthTempo, Retur, PPN, Nilai, Terbayar, DPP, PPH, Memo, Angsur
    FROM (
      SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = so.so_sls_kode AND sla_isaktif = 1 LIMIT 1) AS salesman,
        fp.fp_nomor AS Invoice, fp.fp_tanggal AS Tanggal,
        j.jt_tanggaljt AS JthTempo,
        IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0) AS Retur,
        0 AS PPN, j.jt_nilai AS Nilai,
        IFNULL((SELECT SUM(bycd_bayar) FROM tbayarcus_dtl
                 WHERE bycd_fp_nomor = fp.fp_nomor AND bycd_jthtempo = j.jt_tanggaljt), 0) AS Terbayar,
        0 AS DPP, 0 AS PPH, IFNULL(fp.fp_memo, '') AS Memo, 1 AS Angsur
      FROM tfp_hdr fp
      LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
      INNER JOIN tjatuhtempofp j ON j.jt_fp_nomor = fp.fp_nomor
      WHERE fp.fp_cus_kode = ? AND ${taxCond}
      UNION ALL
      SELECT (SELECT sla_nama FROM tsalesmanaktif WHERE sla_sls_kode = so.so_sls_kode AND sla_isaktif = 1 LIMIT 1) AS salesman,
        fp.fp_nomor AS Invoice, fp.fp_tanggal AS Tanggal,
        fp.fp_jthtempo AS JthTempo,
        IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0) AS Retur,
        IFNULL(fp.fp_taxamount, 0) AS PPN,
        ${Number(isTax) === 1
          ? "fp.fp_amount - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0) - IFNULL(fp.fp_dp, 0)"
          : "fp.fp_amount - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0) - IFNULL(fp.fp_dp, 0)"} AS Nilai,
        IFNULL(fp.fp_bayar, 0) AS Terbayar,
        ${Number(isTax) === 1 ? "fp.fp_amount - IFNULL(fp.fp_taxamount, 0)" : "0"} AS DPP,
        ${Number(isTax) === 1 ? "IF((fp.fp_amount - fp.fp_taxamount) > 2000000, 1.5 * (fp.fp_amount - fp.fp_taxamount) / 100, 0)" : "0"} AS PPH,
        IFNULL(fp.fp_memo, '') AS Memo, 0 AS Angsur
      FROM tfp_hdr fp
      LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
      WHERE fp.fp_cus_kode = ? AND ${taxCond}
        AND NOT EXISTS (SELECT 1 FROM tjatuhtempofp j WHERE j.jt_fp_nomor = fp.fp_nomor)
    ) final
    ${includePaid ? "" : "WHERE (Nilai - Terbayar) > 1"}
    ORDER BY Tanggal, Invoice, JthTempo
  `;

  const [rows] = await db.query(sql, [cusKode, cusKode]);

  return rows.map((r) => ({
    salesman: r.Salesman || "",
    invoice: r.Invoice,
    tanggal: fmtDate(r.Tanggal),
    jthTempo: fmtDate(r.JthTempo),
    retur: Number(r.Retur || 0),
    ppn: Number(r.PPN || 0),
    nilai: Number(r.Nilai || 0),
    terbayar: Number(r.Terbayar || 0),
    bayar: 0,
    pay: 0,
    net: Number(r.DPP || 0) - Number(r.PPH || 0),
    memo: r.Memo || "",
    angsur: Number(r.Angsur || 0),
  }));
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT byc_nomor AS nomor, 
            DATE_FORMAT(byc_tanggal, '%Y-%m-%d') AS tanggal,
            byc_cus_kode AS cusKode, byc_memo AS memo,
            byc_cash AS cash, byc_rek_cash AS rekCash,
            byc_transfer AS transfer, byc_rek_transfer AS rekTransfer,
            byc_potongan AS potongan, byc_rek_potongan AS rekPotongan,
            byc_giro AS giro, byc_rek_giro AS rekGiro,
            byc_nogiro AS noGiro, DATE_FORMAT(byc_tglcair, '%Y-%m-%d') AS tglCair,
            byc_istax AS isTax, byc_ppn AS ppn, byc_rek_ppn AS rekPPN,
            byc_pph AS pph, byc_rek_pph AS rekPPH, byc_NTPN AS ntpn
     FROM tbayarcus_hdr WHERE byc_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("Data tidak ditemukan.");

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  // Load invoice dengan isTax — saat edit, invoice yang sudah dibayar/dipilih
  // tetap dimuat supaya baris detail yang tersimpan tetap tercentang (pay=1)
  const invoices = await getInvoice(h.cusKode, h.isTax, true);

  // Ambil detail dari database — kunci utk mencocokkan adalah pasangan
  // (bycd_fp_nomor, bycd_jthtempo): satu faktur angsur bisa punya banyak
  // baris (per termin), jadi key by invoice saja tidak cukup.
  const [details] = await db.query(
    `SELECT bycd_fp_nomor AS invoice,
            DATE_FORMAT(bycd_jthtempo, '%Y-%m-%d') AS jthTempo,
            bycd_bayar AS bayar
     FROM tbayarcus_dtl WHERE bycd_byc_nomor = ?`,
    [nomor]
  );

  // Gabungkan: key = invoice|jthTempo. bycd_jthtempo yang NULL
  // (CR lama sebelum kolom ada) dicocokkan lewat invoice saja.
  const detailMap = new Map();
  for (const d of details) {
    if (d.jthTempo) detailMap.set(`${d.invoice}|${d.jthTempo}`, d.bayar);
    else if (!detailMap.has(d.invoice)) detailMap.set(d.invoice, d.bayar);
  }

  for (const inv of invoices) {
    const key = `${inv.invoice}|${inv.jthTempo}`;
    const paid = detailMap.get(key) ?? detailMap.get(inv.invoice);
    if (paid !== undefined) {
      inv.bayar = Number(paid);
      inv.pay = 1;
      inv.terbayar = inv.terbayar - inv.bayar;
    }
  }

  // Nama rekening untuk 6 field. tbayarcus_hdr hanya menyimpan kode
  // (byc_rek_*, varchar(8)) — tidak ada kolom nama — jadi nama di-resolve
  // saat tampil, seperti yang dilakukan browse/print.
  //
  // SENGAJA tanpa filter rek_isaktif: dokumen lama bisa memakai rekening
  // yang sekarang nonaktif, dan namanya tetap harus tampil. Filter
  // isaktif hanya boleh di getRekening (untuk memilih).
  //
  // Kode yang baris trekening-nya sudah hilang akan menghasilkan nama "";
  // FE lalu menampilkan kodenya sebagai gantinya — lihat BayarCustomerFormView.
  const kodeRek = [h.rekCash, h.rekTransfer, h.rekPotongan, h.rekGiro, h.rekPPN, h.rekPPH]
    .filter((k) => k && k !== "0");
  const namaRek = {};
  if (kodeRek.length) {
    const [rek] = await db.query(
      `SELECT rek_kode, rek_nama FROM trekening WHERE rek_kode IN (?)`,
      [kodeRek]
    );
    for (const r of rek) namaRek[r.rek_kode] = r.rek_nama;
  }

  return {
    ...h,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    rekCashNama: namaRek[h.rekCash] || "",
    rekTransferNama: namaRek[h.rekTransfer] || "",
    rekPotonganNama: namaRek[h.rekPotongan] || "",
    rekGiroNama: namaRek[h.rekGiro] || "",
    rekPPNNama: namaRek[h.rekPPN] || "",
    rekPPHNama: namaRek[h.rekPPH] || "",
    detail: invoices.filter((inv) => inv.pay === 1 || inv.nilai - inv.terbayar > 0),
  };
};

// ── Cek periode sudah ditutup (paritas Delphi cekTutupPeriode) ────────
const cekTutupPeriode = async (tanggal) => {
  const d = new Date(tanggal);
  const [[row]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [d.getMonth() + 1, d.getFullYear()]
  );
  return !!row;
};

// ── Batas tanggal (paritas Delphi getbatas: tsetting set_tgl) ─────────
const getBatas = async (kode) => {
  const [[row]] = await db.query(
    `SELECT set_tgl FROM tsetting WHERE set_kode = ? LIMIT 1`,
    [kode]
  );
  return Number(row?.set_tgl || 0);
};

const isFinanceRole = (userKode) =>
  ["FINANCE", "PIUTANG"].includes(String(userKode || "").toUpperCase());

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, cusKode, memo, isTax,
    cash, rekCash, transfer, rekTransfer, potongan, rekPotongan,
    giro, rekGiro, noGiro, tglCair, ppn, rekPPN, pph, rekPPH, ntpn,
    detail,
  } = payload;

  // Paritas Delphi cxButton1Click: blok bila periode sudah ditutup
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }

  // Paritas Delphi cekdata (berlaku insert & edit — tidak cek FLAGEDIT):
  // blok bila tanggal beda bulan dan hari ini sudah lewat batas tsetting 'CR'
  const dTgl = new Date(tanggal);
  const now = new Date();
  if (dTgl.getMonth() !== now.getMonth()) {
    const batas = await getBatas("CR");
    if (batas > 0 && now.getDate() > batas) {
      throw new Error("Sudah Tidak bisa diedit pembayaran beda periode");
    }
  }

  // Paritas Delphi cekdata: potongan <= 50000 untuk non-FINANCE/PIUTANG
  if (Number(potongan) > 50000 && !isFinanceRole(user.kode)) {
    throw new Error("nilai potongan melebihi batas");
  }

  // Paritas Delphi cekdata: total bayar harus seimbang dengan metode
  // pembayaran (toleransi 10) — dipaksa juga di server.
  const totalDetail = (detail || []).reduce((s, d) => s + Number(d.bayar || 0), 0);
  const totalMetode =
    Number(cash) + Number(transfer) + Number(potongan) +
    Number(giro) + Number(ppn) + Number(pph);
  const selisih = totalDetail - totalMetode;
  if (selisih > 10 || selisih < -10) {
    throw new Error(
      `Pembayaran dengan Total ${totalDetail} yang di bayar Beda ${totalMetode}`
    );
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tbayarcus_hdr SET
           byc_cus_kode = ?, byc_memo = ?, byc_tanggal = ?,
           byc_cash = ?, byc_rek_cash = ?,
           byc_transfer = ?, byc_rek_transfer = ?,
           byc_potongan = ?, byc_rek_potongan = ?,
           byc_giro = ?, byc_rek_giro = ?, byc_nogiro = ?, byc_tglcair = ?,
           byc_istax = ?, byc_ppn = ?, byc_rek_ppn = ?,
           byc_pph = ?, byc_rek_pph = ?, byc_ntpn = ?,
           date_modified = NOW(), user_modified = ?
         WHERE byc_nomor = ?`,
        [
          cusKode, memo, tanggal, cash, rekCash,
          transfer, rekTransfer, potongan, rekPotongan,
          giro, rekGiro, noGiro, tglCair,
          isTax, ppn, rekPPN, pph, rekPPH, ntpn,
          user.kode, nomor,
        ]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tbayarcus_hdr
           (byc_nomor, byc_tanggal, byc_cus_kode, byc_memo,
            byc_cash, byc_rek_cash, byc_transfer, byc_rek_transfer,
            byc_potongan, byc_rek_potongan, byc_giro, byc_rek_giro,
            byc_nogiro, byc_tglcair, byc_istax,
            byc_ppn, byc_rek_ppn, byc_pph, byc_rek_pph, byc_ntpn,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, tanggal, cusKode, memo,
          cash, rekCash, transfer, rekTransfer,
          potongan, rekPotongan, giro, rekGiro,
          noGiro, tglCair, isTax,
          ppn, rekPPN, pph, rekPPH, ntpn,
          user.kode,
        ]
      );
    }

    await conn.query(`DELETE FROM tbayarcus_dtl WHERE bycd_byc_nomor = ?`, [actualNomor]);

    for (const d of detail) {
      if (Number(d.bayar) > 0) {
        const jthTempo = String(d.jthTempo || "").slice(0, 10) || null;
        await conn.query(
          `INSERT INTO tbayarcus_dtl (bycd_byc_nomor, bycd_fp_nomor, bycd_bayar, bycd_jthtempo)
           VALUES (?, ?, ?, ?)`,
          [actualNomor, d.invoice, d.bayar, jthTempo]
        );
      }
    }

    await conn.commit();
    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMaxNomor,
  getCustomer,
  getRekening,
  getInvoice,
  getDetailForm,
  saveData,
  getBatas,
};