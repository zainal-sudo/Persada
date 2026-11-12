// services/penjualan/bayarBiayaPromosiFormService.js
const db = require("../../config/database");

// ── Generate Nomor ───────────────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-CB.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(byb_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tbayarbp_hdr WHERE byb_nomor LIKE ?`,
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
const getRekening = async () => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening WHERE rek_isaktif = 1
     ORDER BY rek_nama LIMIT 100`
  );
  return rows;
};

// ── Get Invoice ──────────────────────────────────────────────────────
// includePaid: true saat load form edit — HAVING dicabut (paritas Delphi
// loaddataInvoice: HAVING hanya untuk dokumen baru / FLAGEDIT=False),
// invoice yang sudah klaim habis tetap tampil supaya baris tersimpan tidak hilang.
const getInvoice = async (cusKode, includePaid = false) => {
  const [rows] = await db.query(
    `SELECT 
       fp.fp_nomor AS invoice,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS tanggal,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS jthTempo,
       ((fp.fp_biayapr * (fp.fp_amount - fp.fp_taxamount - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0)) / 100) + fp.fp_biayarp) AS biayaPromosi,
       IFNULL((SELECT SUM(bybd_bayar) FROM tbayarbp_dtl WHERE bybd_fp_nomor = fp.fp_nomor), 0) AS klaim,
       CASE WHEN fp.fp_isbayar = 1 THEN 'Sudah' ELSE 'Belum' END AS status
     FROM tfp_hdr fp
     WHERE fp.fp_cus_kode = ?
     ${includePaid ? "" : "HAVING klaim < biayaPromosi AND biayaPromosi > 0"}
     ORDER BY fp.fp_tanggal`,
    [cusKode]
  );

  return rows.map((r) => ({
    invoice: r.invoice,
    tanggal: r.tanggal,
    jthTempo: r.jthTempo,
    biayaPromosi: Number(r.biayaPromosi || 0) - Number(r.klaim || 0),
    bayar: 0,
    pay: 0,
    status: r.status || "Belum",
  }));
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT byb_nomor AS nomor, 
            DATE_FORMAT(byb_tanggal, '%Y-%m-%d') AS tanggal,
            byb_cus_kode AS cusKode, byb_keterangan AS keterangan,
            byb_nilai AS nilai, byb_rek_kode AS rekKode
     FROM tbayarbp_hdr WHERE byb_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("Data tidak ditemukan.");

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  const [[rekening]] = await db.query(
    `SELECT rek_nama FROM trekening WHERE rek_kode = ? LIMIT 1`,
    [h.rekKode]
  );

  // Load invoice (includePaid=true saat edit — paritas loaddataInvoice FLAGEDIT)
  const invoices = await getInvoice(h.cusKode, true);

  // Ambil detail dari database
  const [details] = await db.query(
    `SELECT bybd_fp_nomor AS invoice, bybd_bayar AS bayar, bybd_biaya_promosi AS biayaPromosi
     FROM tbayarbp_dtl WHERE bybd_byb_nomor = ?`,
    [nomor]
  );

  // Gabungkan — paritas Delphi loaddataall:
  // biayaPromosi = sisa (total − klaim semua) + klaim dokumen ini
  // = sisa yang MASIH BISA dibayar di dokumen ini
  const detailMap = new Map(details.map((d) => [d.invoice, d]));

  for (const inv of invoices) {
    const paid = detailMap.get(inv.invoice);
    if (paid !== undefined) {
      inv.bayar = Number(paid.bayar);
      inv.biayaPromosi = inv.biayaPromosi + Number(paid.bayar);
      inv.pay = 1;
    }
  }

  return {
    ...h,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    rekNama: rekening?.rek_nama || "",
    detail: invoices,
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

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, cusKode, rekKode, nilai, keterangan, detail } = payload;

  // Paritas Delphi cekTutupPeriode (cxButton1/2Click)
  if (await cekTutupPeriode(tanggal)) {
    throw new Error("Periode ini sudah di tutup.");
  }

  // Paritas Delphi cekdata — catatan: modul ini TIDAK memakai guard getbatas('CB')
  if (!cusKode) throw new Error("customer belum di pilih");
  if (!rekKode) throw new Error("Rekening belum di pilih");
  for (const d of detail || []) {
    if (Number(d.pay) === 1 && Number(d.bayar) === 0) {
      throw new Error("Pembayaran masih nol");
    }
  }

  // Paritas Delphi cekdata — balance toleransi 1 (BUKAN 10 seperti BayarCustomer)
  const totalDetail = (detail || []).reduce((s, d) => s + Number(d.bayar || 0), 0);
  const selisih = totalDetail - Number(nilai || 0);
  if (selisih > 1 || selisih < -1) {
    throw new Error(`Pembayaran dengan Total ${totalDetail} yang di bayar Beda ${nilai}`);
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tbayarbp_hdr SET
           byb_cus_kode = ?, byb_tanggal = ?, byb_nilai = ?,
           byb_rek_kode = ?, byb_keterangan = ?,
           date_modified = NOW(), user_modified = ?
         WHERE byb_nomor = ?`,
        [cusKode, tanggal, nilai, rekKode, keterangan, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tbayarbp_hdr
           (byb_nomor, byb_tanggal, byb_cus_kode, byb_keterangan, byb_nilai, byb_rek_kode, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, cusKode, keterangan, nilai, rekKode, user.kode]
      );
    }

    await conn.query(`DELETE FROM tbayarbp_dtl WHERE bybd_byb_nomor = ?`, [actualNomor]);

    for (const d of detail) {
      if (Number(d.bayar) > 0) {
        await conn.query(
          `INSERT INTO tbayarbp_dtl (bybd_byb_nomor, bybd_fp_nomor, bybd_biaya_promosi, bybd_bayar)
           VALUES (?, ?, ?, ?)`,
          [actualNomor, d.invoice, d.biayaPromosi, d.bayar]
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
};