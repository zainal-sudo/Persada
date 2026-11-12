// services/pembelian/returBeliFormService.js
const db = require("../../config/database");

// ── Generate Nomor RET (paritas Delphi ufrmReturBeli.getmaxkode) ──────
// Pajak    : dasar 10000
// Non pajak: dasar 15000
const getMaxNomor = async (tanggal, isTax, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-RET.${yy}${mm}.`;

  if (Number(isTax) === 1) {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(ret_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tret_hdr WHERE ret_nomor LIKE ? AND ret_istax = 1`,
      [`${prefix}%`]
    );
    const nextNum = 10000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  } else {
    const [[row]] = await db.query(
      `SELECT IFNULL(MAX(CAST(RIGHT(ret_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tret_hdr WHERE ret_nomor LIKE ? AND ret_istax = 0`,
      [`${prefix}%`]
    );
    const nextNum = 15000 + Number(row.max_val) + 1;
    return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
  }
};

// ── Search Invoice (paritas Delphi edtNomorInvoiceClickBtn) ──────────
const searchInvoice = async (search = "") => {
  const [rows] = await db.query(
    `SELECT i.inv_nomor AS nomor, i.inv_sup_kode AS kode,
            s.sup_nama AS supplier,
            DATE_FORMAT(i.inv_tanggal, '%Y-%m-%d') AS tanggal,
            i.inv_amount AS total
     FROM tinv_hdr i
     INNER JOIN tsupplier s ON s.sup_kode = i.inv_sup_kode
     WHERE i.inv_isbayar = 0
       AND (i.inv_nomor LIKE ? OR s.sup_nama LIKE ?)
     ORDER BY i.inv_tanggal DESC LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Info Invoice (paritas Delphi getpajak + auto supplier) ───────────
const getInvoice = async (nomor, rfid) => {
  const [[row]] = await db.query(
    `SELECT inv_nomor, inv_istax, inv_sup_kode,
            DATE_FORMAT(inv_tanggal, '%Y-%m-%d') AS tanggal
     FROM tinv_hdr WHERE inv_nomor = ?`,
    [nomor]
  );
  if (!row) throw new Error("Invoice tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama, sup_alamat FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [row.inv_sup_kode]
  );

  return {
    nomor: row.inv_nomor,
    isTax: row.inv_istax,
    supKode: row.inv_sup_kode,
    supNama: supplier?.sup_nama || "",
    alamat: supplier?.sup_alamat || "",
    tanggal: row.tanggal,
    rfid: rfid || 0,
  };
};

// ── Search Barang (paritas Delphi bantuansku) ────────────────────────
// Item yang boleh diretur = item pada invoice dipilih + stok gudang dipilih.
const searchBarang = async (nomorInvoice, gdgKode, search = "") => {
  const [rows] = await db.query(
    `SELECT b.brg_kode AS sku,
            DATE_FORMAT(t.mst_expired_date, '%Y-%m-%d') AS expired,
            b.brg_nama AS namaBarang,
            b.brg_satuan AS satuan,
            SUM(t.mst_stok_in - t.mst_stok_out) AS stok,
            invd.harga AS harga,
            invd.discpr AS discPr,
            invd.qtyInvoice AS qtyInvoice
     FROM tbarang b
     INNER JOIN tmasterstok t
       ON t.mst_brg_kode = b.brg_kode
      AND t.mst_gdg_kode = ?
     INNER JOIN (
       SELECT invd_brg_kode, invd_expired,
              MAX(invd_harga) AS harga, MAX(invd_discpr) AS discpr,
              MAX(invd_qty) AS qtyInvoice
       FROM tinv_dtl
       WHERE invd_inv_nomor = ?
       GROUP BY invd_brg_kode, invd_expired
     ) invd
       ON invd.invd_brg_kode = b.brg_kode
      AND invd.invd_expired = t.mst_expired_date
     WHERE (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)
     GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, t.mst_expired_date
     ORDER BY b.brg_nama
     LIMIT 50`,
    [gdgKode, nomorInvoice, `%${search}%`, `%${search}%`]
  );

  return rows.map((r) => ({
    sku: r.sku,
    expired: r.expired,
    namaBarang: r.namaBarang,
    satuan: r.satuan,
    stok: Number(r.stok || 0),
    harga: Number(r.harga || 0),
    discPr: Number(r.discPr || 0),
    qtyInvoice: Number(r.qtyInvoice || 0),
  }));
};

// ── Get Gudang ───────────────────────────────────────────────────────
const getGudang = async () => {
  const [rows] = await db.query(
    `SELECT gdg_kode AS kode, gdg_nama AS nama FROM tgudang ORDER BY gdg_nama`
  );
  return rows;
};

// ── Load Form Edit (paritas Delphi loaddataall) ──────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT ret_nomor AS nomor,
            DATE_FORMAT(ret_tanggal, '%Y-%m-%d') AS tanggal,
            ret_inv_nomor AS nomorInvoice,
            ret_gdg_kode AS gdgKode,
            ret_sup_kode AS supKode,
            IFNULL(ret_memo, '') AS memo,
            ret_istax AS isTax,
            IFNULL(ret_disc_fakturpr, 0) AS discFakturPr,
            IFNULL(ret_disc_faktur, 0) AS discFaktur,
            IFNULL(ret_amount, 0) AS amount,
            IFNULL(ret_taxamount, 0) AS taxAmount
     FROM tret_hdr WHERE ret_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("Data Retur Beli tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama AS supNama, sup_alamat AS alamat FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [h.supKode]
  );
  const [[gudang]] = await db.query(
    `SELECT gdg_nama FROM tgudang WHERE gdg_kode = ? LIMIT 1`,
    [h.gdgKode]
  );

  // Cek invoice sudah dibayar (paritas cekbayar Delphi) → locked
  const [[inv]] = await db.query(
    `SELECT inv_isbayar FROM tinv_hdr WHERE inv_nomor = ?`,
    [h.nomorInvoice]
  );
  const locked = Number(inv?.inv_isbayar) === 1;

  const [details] = await db.query(
    `SELECT d.retd_brg_kode AS brgKode, b.brg_nama AS brgNama,
            IFNULL(d.retd_idbatch, '') AS idBatch,
            d.retd_brg_satuan AS satuan,
            d.retd_qty AS qty,
            d.retd_harga AS harga,
            d.retd_discpr AS discPr,
            ROUND(d.retd_harga * d.retd_qty * (100 - IFNULL(d.retd_discpr, 0)) / 100, 2) AS total,
            DATE_FORMAT(d.retd_expired, '%Y-%m-%d') AS expired
     FROM tret_dtl d
     LEFT JOIN tbarang b ON b.brg_kode = d.retd_brg_kode
     WHERE d.retd_ret_nomor = ?
     ORDER BY d.retd_nourut ASC`,
    [nomor]
  );

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    gdgNama: gudang?.gdg_nama || "",
    locked,
    detail: details,
  };
};

// ── Save (paritas Delphi simpandata + cekdata + clQTYPropertiesValidate)
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, nomorInvoice, supKode, gdgKode, memo,
    isTax, discFakturPr, discFaktur, amount, taxAmount, detail,
  } = payload;

  // cekTutupPeriode
  const dTgl = new Date(tanggal);
  const [[periode]] = await db.query(
    `SELECT 1 FROM ttutupperiode WHERE TUTUP_BULAN = ? AND TUTUP_TAHUN = ? LIMIT 1`,
    [dTgl.getMonth() + 1, dTgl.getFullYear()]
  );
  if (periode) throw new Error("Periode ini sudah di tutup.");

  // cekdata: supplier wajib
  if (!supKode) throw new Error("supplier belum di pilih");
  if (!nomorInvoice) throw new Error("Nomor invoice belum dipilih.");

  // SKU wajib per baris
  for (const d of detail || []) {
    if (Number(d.qty) > 0 && !Number(d.brgKode)) {
      throw new Error("SKU Baris : belum dipilih");
    }
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tret_hdr SET
           ret_sup_kode = ?, ret_inv_nomor = ?, ret_tanggal = ?,
           ret_gdg_kode = ?, ret_memo = ?,
           ret_disc_faktur = ?, ret_disc_fakturpr = ?,
           ret_amount = ?, ret_taxamount = ?, ret_istax = ?,
           date_modified = NOW(), user_modified = ?
         WHERE ret_nomor = ?`,
        [supKode, nomorInvoice, tanggal, gdgKode, memo,
         discFaktur, discFakturPr, amount, taxAmount, isTax,
         user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, isTax, user.cabang);
      await conn.query(
        `INSERT INTO tret_hdr
           (ret_nomor, ret_inv_nomor, ret_tanggal, ret_gdg_kode, ret_memo, ret_sup_kode,
            ret_disc_faktur, ret_disc_fakturpr, ret_amount, ret_taxamount, ret_istax,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, nomorInvoice, tanggal, gdgKode, memo, supKode,
         discFaktur, discFakturPr, amount, taxAmount, isTax, user.kode]
      );
    }

    await conn.query(`DELETE FROM tret_dtl WHERE retd_ret_nomor = ?`, [actualNomor]);

    // Validasi qty tidak melebihi qty invoice (paritas clQTYPropertiesValidate)
    for (const d of detail || []) {
      if (Number(d.qty) <= 0) continue;
      const [[inv]] = await conn.query(
        `SELECT invd_qty FROM tinv_dtl
         WHERE invd_inv_nomor = ? AND invd_brg_kode = ? AND invd_expired = ?`,
        [nomorInvoice, d.brgKode, d.expired]
      );
      if (Number(d.qty) > Number(inv?.invd_qty || 0)) {
        throw new Error(`Qty melebihi qty invoice untuk SKU ${d.brgKode}`);
      }
    }

    let nourut = 1;
    for (const d of detail || []) {
      if (Number(d.qty) > 0) {
        await conn.query(
          `INSERT INTO tret_dtl
             (retd_ret_nomor, retd_brg_kode, retd_brg_satuan, retd_idbatch, retd_qty,
              retd_discpr, retd_harga, retd_nourut, retd_expired)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [actualNomor, d.brgKode, d.satuan, d.idBatch || "", d.qty,
           d.discPr, d.harga, nourut, d.expired]
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

module.exports = {
  getMaxNomor,
  searchInvoice,
  getInvoice,
  searchBarang,
  getGudang,
  getDetailForm,
  saveData,
};
