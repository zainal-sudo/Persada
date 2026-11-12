// services/penjualan/returPenjualanFormService.js
const db = require("../../config/database");

// ── Generate Nomor ───────────────────────────────────────────────────
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-RETJ.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(retj_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tretj_hdr WHERE retj_nomor LIKE ? AND retj_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(retj_nomor, 3) AS UNSIGNED)), 0) AS max_val
       FROM tretj_hdr WHERE retj_nomor LIKE ? AND retj_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    const shortNum = String(nextNum).slice(-4);
    return `${prefix}${shortNum.padStart(4, "0")}`;
  }
};

// ── Search FP ────────────────────────────────────────────────────────
const searchFP = async (search = "") => {
  const [rows] = await db.query(
    `SELECT fp_nomor AS nomor, DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
            fp_cus_kode AS kode, c.cus_nama AS customer, fp_amount AS total
     FROM tfp_hdr fp
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     WHERE fp.fp_nomor LIKE ? OR c.cus_nama LIKE ?
     ORDER BY fp.fp_tanggal DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Get FP Info ──────────────────────────────────────────────────────
const getFP = async (nomor, excludeNomor = "") => {
  const [[row]] = await db.query(
    `SELECT fp_nomor, fp_istax, fp_cus_kode, fp_amount, fp_bayar,
            DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal
     FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomor]
  );
  if (!row) throw new Error("Faktur tidak ditemukan.");

  // Cek sudah pernah retur (skip dokumen sendiri saat edit)
  const [[returExist]] = await db.query(
    `SELECT COUNT(*) AS total FROM tretj_hdr WHERE retj_fp_nomor = ? AND retj_nomor <> ?`,
    [nomor, excludeNomor || ""]
  );
  if (Number(returExist?.total || 0) > 0) {
    throw new Error("Faktur ini sudah pernah diretur.");
  }

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [row.fp_cus_kode]
  );

  // Cek sudah faktur pajak (paritas cekfakturpajak Delphi)
  const [[fakturPajak]] = await db.query(
    `SELECT 1 FROM tfakturpajak_hdr WHERE fp_nomor = ? LIMIT 1`,
    [nomor]
  );
  const sudahFakturPajak = !!fakturPajak;

  // Umur faktur (hari)
  const umurHari = Math.floor((Date.now() - new Date(row.tanggal).getTime()) / 86400000);

  return {
    nomor: row.fp_nomor,
    isTax: row.fp_istax,
    cusKode: row.fp_cus_kode,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    sisaPiutang: Number(row.fp_amount || 0) - Number(row.fp_bayar || 0),
    tanggal: row.tanggal,
    umurHari,
    sudahFakturPajak,
  };
};

// ── Search Barang ────────────────────────────────────────────────────
const searchBarang = async (nomorFaktur, search = "") => {
  const [rows] = await db.query(
    `SELECT b.brg_kode AS sku,
            DATE_FORMAT(d.fpd_expired, '%Y-%m-%d') AS expired,
            b.brg_nama AS namaBarang,
            b.brg_satuan AS satuan,
            d.fpd_idbatch AS idBatch,
            d.fpd_harga AS harga,
            d.fpd_discpr AS discPr,
            d.fpd_qty AS qtyFaktur
     FROM tfp_dtl d
     INNER JOIN tbarang b ON b.brg_kode = d.fpd_brg_kode
     WHERE d.fpd_fp_nomor = ?
       AND d.fpd_qty > 0
       AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)
     ORDER BY b.brg_nama
     LIMIT 50`,
    [nomorFaktur, `%${search}%`, `%${search}%`]
  );

  return rows.map((r) => ({
    sku: r.sku,
    expired: r.expired,
    namaBarang: r.namaBarang,
    satuan: r.satuan,
    idBatch: r.idBatch || "",
    harga: Number(r.harga),
    discPr: Number(r.discPr),
    qtyFaktur: Number(r.qtyFaktur),
  }));
};

// ── Get Gudang ───────────────────────────────────────────────────────
const getGudang = async () => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama FROM tgudang ORDER BY gdg_nama`
  );
  return rows;
};

// ── Get Sisa Piutang ─────────────────────────────────────────────────
const getSisaPiutang = async (nomorFaktur) => {
  const [[row]] = await db.query(
    `SELECT fp_amount - fp_bayar AS sisa FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomorFaktur]
  );
  return Number(row?.sisa || 0);
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT retj_nomor AS nomor, DATE_FORMAT(retj_tanggal, '%Y-%m-%d') AS tanggal,
            retj_fp_nomor AS nomorFaktur, retj_cus_kode AS cusKode,
            retj_gdg_kode AS gdgKode, retj_memo AS memo,
            retj_istax AS isTax, retj_disc_fakturpr AS discFakturPr,
            retj_disc_faktur AS discFaktur, retj_amount AS amount,
            retj_taxamount AS taxAmount, retj_cn AS cn
     FROM tretj_hdr WHERE retj_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("Data tidak ditemukan.");

  const [[customer]] = await db.query(
    `SELECT cus_nama, cus_alamat FROM tcustomer WHERE cus_kode = ? LIMIT 1`,
    [h.cusKode]
  );

  // Cek apakah faktur sudah dibayar (paritas cekbayar Delphi)
  const [[fp]] = await db.query(
    `SELECT fp_isbayar FROM tfp_hdr WHERE fp_nomor = ?`,
    [h.nomorFaktur]
  );
  const locked = Number(fp?.fp_isbayar) === 1;

  const [[gudang]] = await db.query(
    `SELECT gdg_nama FROM tgudang WHERE gdg_kode = ? LIMIT 1`,
    [h.gdgKode]
  );

  const [details] = await db.query(
    `SELECT d.retjd_brg_kode AS brgKode, b.brg_nama AS brgNama,
            d.retjd_idbatch AS idBatch, d.retjd_brg_satuan AS satuan,
            d.retjd_qty AS qty, d.retjd_harga AS harga,
            d.retjd_discpr AS discPr,
            ROUND(d.retjd_harga * d.retjd_qty * (100 - IFNULL(d.retjd_discpr,0)) / 100, 2) AS total,
            DATE_FORMAT(d.retjd_expired, '%Y-%m-%d') AS expired
     FROM tretj_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.retjd_brg_kode
     WHERE d.retjd_retj_nomor = ?
     ORDER BY d.retjd_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    cusNama: customer?.cus_nama || "",
    alamat: customer?.cus_alamat || "",
    gdgNama: gudang?.gdg_nama || "",
    locked,
    detail: details.map((d) => ({
      ...d,
      cn: 0,
      nilaiCN: 0,
    })),
  };
};

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, nomorFaktur, cusKode, gdgKode, memo,
    isTax, discFakturPr, discFaktur, amount, taxAmount, cn, detail,
  } = payload;

  // ── Validasi (paritas cekdata Delphi) ──────────────────────────────
  // 1. cekTutupPeriode
  const dTgl = new Date(tanggal);
  const [[periode]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [dTgl.getMonth() + 1, dTgl.getFullYear()]
  );
  if (periode) throw new Error("Periode ini sudah di tutup.");

  // 2. Customer wajib
  if (!cusKode) throw new Error("Customer belum di pilih.");

  // 3. Sisa piutang faktur
  const [[fp]] = await db.query(
    `SELECT fp_amount - fp_bayar AS sisa FROM tfp_hdr WHERE fp_nomor = ?`,
    [nomorFaktur]
  );
  if (Number(amount) > Number(fp?.sisa || 0)) {
    throw new Error("Total Retur Melebihi sisa Piutang");
  }

  // 4. SKU wajib per baris qty>0
  for (const d of detail || []) {
    if (Number(d.qty) > 0 && !Number(d.brgKode)) {
      throw new Error("SKU Baris belum dipilih");
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tretj_hdr SET
           retj_cus_kode = ?, retj_tanggal = ?, retj_fp_nomor = ?,
           retj_memo = ?, retj_disc_faktur = ?, retj_disc_fakturpr = ?,
           retj_amount = ?, retj_taxamount = ?, retj_istax = ?,
           retj_gdg_kode = ?, retj_cn = ?,
           date_modified = NOW(), user_modified = ?
         WHERE retj_nomor = ?`,
        [cusKode, tanggal, nomorFaktur, memo, discFaktur, discFakturPr,
         amount, taxAmount, isTax, gdgKode, cn, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tretj_hdr
           (retj_nomor, retj_fp_nomor, retj_tanggal, retj_gdg_kode, retj_memo,
            retj_cus_kode, retj_disc_faktur, retj_disc_fakturpr, retj_amount,
            retj_taxamount, retj_istax, retj_cn, date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, nomorFaktur, tanggal, gdgKode, memo, cusKode,
         discFaktur, discFakturPr, amount, taxAmount, isTax, cn, user.kode]
      );
    }

    await conn.query(`DELETE FROM tretj_dtl WHERE retjd_retj_nomor = ?`, [actualNomor]);

    // Validasi qty tidak melebihi qty faktur per baris (paritas clQTYPropertiesValidate Delphi)
    for (const d of detail || []) {
      if (Number(d.qty) <= 0) continue;
      const [[{ qtyFaktur }]] = await conn.query(
        `SELECT IFNULL(SUM(fpd_qty), 0) AS qtyFaktur FROM tfp_dtl
         WHERE fpd_fp_nomor = ? AND fpd_brg_kode = ?`,
        [nomorFaktur, d.brgKode]
      );
      if (Number(d.qty) > Number(qtyFaktur)) {
        throw new Error(`Qty melebihi qty faktur untuk SKU ${d.brgKode}`);
      }
    }

    let nourut = 1;
    for (const d of detail) {
      if (Number(d.qty) > 0) {
        await conn.query(
          `INSERT INTO tretj_dtl
             (retjd_retj_nomor, retjd_brg_kode, retjd_brg_satuan, retjd_qty,
              retjd_discpr, retjd_harga, retjd_nourut, retjd_idbatch, retjd_expired)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [actualNomor, d.brgKode, d.satuan, d.qty, d.discPr, d.harga,
           nourut, d.idBatch, d.expired]
        );
        nourut++;
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

// ── CN Faktur-Level (paritas chkCNClick Delphi) ──────────────────────
const getCNFaktur = async (cusKode, tanggal) => {
  const [[row]] = await db.query(
    `SELECT cn_potong_invoice FROM tpiutangcn
     WHERE cn_cus_kode = ? AND cn_startdate <= ? AND cn_enddate >= ?
     LIMIT 1`,
    [cusKode, tanggal, tanggal]
  );
  return Number(row?.cn_potong_invoice || 0);
};

module.exports = {
  getMaxNomor,
  searchFP,
  getFP,
  searchBarang,
  getGudang,
  getSisaPiutang,
  getDetailForm,
  saveData,
  getCNFaktur,
};