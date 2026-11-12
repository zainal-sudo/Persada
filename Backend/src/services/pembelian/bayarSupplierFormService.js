// services/pembelian/bayarSupplierFormService.js
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");

// ── Lookup Supplier ───────────────────────────────────────────────────
const getSupplier = async (search = "") => {
  const [rows] = await db.query(
    `SELECT sup_kode AS kode, sup_nama AS nama, sup_alamat AS alamat, sup_telp AS telp
     FROM tsupplier
     WHERE sup_nama LIKE ? OR sup_kode LIKE ?
     ORDER BY sup_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Lookup Rekening (paritas Delphi CDSRekening) ──────────────────────
const getRekening = async (search = "") => {
  const [rows] = await db.query(
    `SELECT rek_kode AS kode, rek_nama AS nama
     FROM trekening
     WHERE rek_nama LIKE ? OR rek_kode LIKE ?
     ORDER BY rek_nama LIMIT 50`,
    [`%${search}%`, `%${search}%`]
  );
  return rows;
};

// ── Load Invoice belum lunas / berbayar (paritas Delphi loaddataInvoice)
const getInvoiceBySupplier = async (supKode, isTax, isEdit = false, nomorBys = "") => {
  const [rows] = await db.query(
    `SELECT
       i.inv_nomor AS invoice,
       IFNULL(i.inv_nobukti, '') AS nobukti,
       IFNULL(i.inv_nopajak, '') AS nopajak,
       DATE_FORMAT(i.inv_tanggal, '%Y-%m-%d') AS tanggal,
       DATE_FORMAT(i.inv_jthtempo, '%Y-%m-%d') AS jthTempo,
       IFNULL(i.inv_amount, 0) - IFNULL((SELECT SUM(r.ret_amount) FROM tret_hdr r WHERE r.ret_inv_nomor = i.inv_nomor), 0) AS nilai,
       IFNULL(i.inv_bayar, 0) AS terbayar,
       IFNULL(this.bysd_bayar, 0) AS bayarLama
     FROM tinv_hdr i
     INNER JOIN tbpb_hdr b ON b.bpb_nomor = i.inv_bpb_nomor
     INNER JOIN tpo_hdr p ON p.po_nomor = b.bpb_po_nomor
     LEFT JOIN (
       SELECT bysd_inv_nomor, bysd_bayar FROM tbayarsup_dtl WHERE bysd_bys_nomor = ?
     ) this ON this.bysd_inv_nomor = i.inv_nomor
     WHERE p.po_sup_kode = ? AND i.inv_istax = ?
       AND (
         ? = 1
         OR (IFNULL(i.inv_amount, 0) - IFNULL((SELECT SUM(r.ret_amount) FROM tret_hdr r WHERE r.ret_inv_nomor = i.inv_nomor), 0) > IFNULL(i.inv_bayar, 0))
         OR (IFNULL(this.bysd_bayar, 0) > 0)
       )
     ORDER BY i.inv_tanggal ASC`,
    [nomorBys, supKode, Number(isTax) || 0, isEdit ? 1 : 0]
  );

  return rows.map((r) => {
    const terbayarNet = Number(r.terbayar) - Number(r.bayarLama);
    const nilai = Number(r.nilai);
    const bayarDefault = isEdit ? Number(r.bayarLama) : 0;
    return {
      invoice: r.invoice,
      nobukti: r.nobukti,
      nopajak: r.nopajak,
      tanggal: r.tanggal,
      jthTempo: r.jthTempo,
      nilai,
      terbayar: terbayarNet,
      bayar: bayarDefault,
      pay: bayarDefault > 0 ? 1 : 0,
    };
  });
};

// ── Generate Nomor VP (paritas Delphi ufrmBayarSupplier.getmaxkode) ────
const getMaxNomor = async (tanggal, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-VP.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(bys_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tbayarsup_hdr
     WHERE bys_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4).padStart(4, "0")}`;
};

// ── Load Form Edit (paritas Delphi ufrmBayarSupplier.loaddataall) ─────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT bys_nomor AS nomor,
            DATE_FORMAT(bys_tanggal, '%Y-%m-%d') AS tanggal,
            IFNULL(bys_sup_kode, '') AS supKode,
            IFNULL(bys_rek_kode, '') AS rekKode,
            IFNULL(bys_memo, '') AS memo,
            IFNULL(bys_nogiro, '') AS giro,
            DATE_FORMAT(bys_tglcair, '%Y-%m-%d') AS tglCair,
            IFNULL(bys_nilai, 0) AS nilai,
            IFNULL(bys_istax, 0) AS isTax
     FROM tbayarsup_hdr WHERE bys_nomor = ?`,
    [nomor]
  );
  if (!h) throw new Error("Pembayaran Supplier tidak ditemukan.");

  const [[supplier]] = await db.query(
    `SELECT sup_nama AS supNama, sup_alamat AS alamat FROM tsupplier WHERE sup_kode = ? LIMIT 1`,
    [h.supKode]
  );
  const [[rekening]] = await db.query(
    `SELECT rek_nama AS rekNama FROM trekening WHERE rek_kode = ? LIMIT 1`,
    [h.rekKode]
  );

  const detail = await getInvoiceBySupplier(h.supKode, h.isTax, true, nomor);

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    rekNama: rekening?.rekNama || "",
    detail,
  };
};

// ── Save Data (paritas Delphi ufrmBayarSupplier.simpandata) ───────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, supKode, rekKode, memo,
    giro, tglCair, nilai, isTax, detail,
  } = payload;

  if (await cekTutupPeriode(tanggal))
    throw new Error("Periode sudah ditutup. Transaksi tidak bisa disimpan.");

  if (!supKode) throw new Error("supplier belum di pilih");
  if (!rekKode) throw new Error("Rekening belum di pilih");
  if (!Array.isArray(detail) || detail.length === 0)
    throw new Error("Detail faktur belum diisi.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tbayarsup_hdr SET
           bys_sup_kode = ?, bys_memo = ?, bys_tanggal = ?,
           bys_rek_kode = ?, bys_nogiro = ?, bys_tglcair = ?,
           bys_nilai = ?, bys_istax = ?,
           date_modified = NOW(), user_modified = ?
         WHERE bys_nomor = ?`,
        [
          supKode, memo, tanggal, rekKode, giro || "",
          tglCair, nilai, isTax, user.kode, nomor,
        ]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tbayarsup_hdr
           (bys_nomor, bys_tanggal, bys_sup_kode, bys_rek_kode,
            bys_memo, bys_nogiro, bys_tglcair, bys_nilai, bys_istax,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualNomor, tanggal, supKode, rekKode, memo,
          giro || "", tglCair, nilai, isTax, user.kode,
        ]
      );
    }

    await conn.query(`DELETE FROM tbayarsup_dtl WHERE bysd_bys_nomor = ?`, [actualNomor]);

    for (const d of detail) {
      const bayar = Number(d.bayar) || 0;
      if (bayar > 0) {
        await conn.query(
          `INSERT INTO tbayarsup_dtl (bysd_bys_nomor, bysd_inv_nomor, bysd_bayar)
           VALUES (?, ?, ?)`,
          [actualNomor, d.invoice, bayar]
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
  getSupplier,
  getRekening,
  getInvoiceBySupplier,
  getMaxNomor,
  getDetailForm,
  saveData,
};
