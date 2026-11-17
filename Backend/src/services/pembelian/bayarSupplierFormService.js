// services/pembelian/bayarSupplierFormService.js
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");
const { REK, insertJurnal, deleteJurnal } = require("../jurnalHelper");

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
// Retur TIDAK lagi dipotong otomatis di picker — retur dipilih di header
// dan dipakai langsung mengurangi pembayaran.
const getInvoiceBySupplier = async (supKode, isTax, isEdit = false, nomorBys = "") => {
  const [rows] = await db.query(
    `SELECT
       i.inv_nomor AS invoice,
       IFNULL(i.inv_nobukti, '') AS nobukti,
       IFNULL(i.inv_nopajak, '') AS nopajak,
       DATE_FORMAT(i.inv_tanggal, '%Y-%m-%d') AS tanggal,
       DATE_FORMAT(i.inv_jthtempo, '%Y-%m-%d') AS jthTempo,
       IFNULL(i.inv_amount, 0) AS nilai,
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
         OR (IFNULL(i.inv_amount, 0) > IFNULL(i.inv_bayar, 0))
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

// ── List Retur Pembelian milik supplier (untuk setle di header pembayaran)
// Retur dianggap terpakai bila sudah muncul di tbayarsup_dtl dokumen lain.
const getReturBySupplier = async (supKode, nomorBys = "") => {
  const [rows] = await db.query(
    `SELECT
       h.ret_nomor AS nomor,
       DATE_FORMAT(h.ret_tanggal, '%Y-%m-%d') AS tanggal,
       h.ret_inv_nomor AS invoice,
       IFNULL(h.ret_amount, 0) AS amount,
       IFNULL(h.ret_memo, '') AS memo
     FROM tret_hdr h
     WHERE h.ret_sup_kode = ?
       AND NOT EXISTS (
         SELECT 1 FROM tbayarsup_dtl d
         WHERE d.bysd_inv_nomor = h.ret_nomor
           AND d.bysd_bys_nomor <> ?
       )
     ORDER BY h.ret_tanggal DESC`,
    [supKode, nomorBys || ""]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
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

  // Retur yang sudah dipakai untuk setle di dokumen ini — tandai checked
  const retur = await getReturBySupplier(h.supKode, nomor);
  const [appliedRetur] = await db.query(
    `SELECT bysd_inv_nomor FROM tbayarsup_dtl WHERE bysd_bys_nomor = ?`,
    [nomor]
  );
  const appliedSet = new Set(appliedRetur.map((r) => r.bysd_inv_nomor));
  for (const r of retur) r.checked = appliedSet.has(r.nomor) ? 1 : 0;

  return {
    ...h,
    supNama: supplier?.supNama || "",
    alamat: supplier?.alamat || "",
    rekNama: rekening?.rekNama || "",
    detail,
    retur,
  };
};

// ── Save Data (paritas Delphi ufrmBayarSupplier.simpandata) ───────────
// payload.retur: array [{ nomor }] retur pembelian yang dipakai setle.
// Nilai pembayaran = Σ bayar invoice − Σ amount retur.
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, supKode, rekKode, memo,
    giro, tglCair, nilai, isTax, detail, retur,
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

    // ── Validasi retur (sebelum tulis header) ────────────────────────
    const listRetur = [];
    for (const r of retur || []) {
      if (!r || !r.nomor) continue;
      const [[h]] = await conn.query(
        `SELECT ret_nomor, ret_sup_kode, ret_amount FROM tret_hdr WHERE ret_nomor = ?`,
        [r.nomor]
      );
      if (!h) throw new Error(`Retur ${r.nomor} tidak ditemukan.`);
      if (h.ret_sup_kode !== supKode)
        throw new Error(`Retur ${r.nomor} bukan milik supplier ini.`);
      const [[dipakai]] = await conn.query(
        `SELECT bysd_bys_nomor FROM tbayarsup_dtl
         WHERE bysd_inv_nomor = ? AND bysd_bys_nomor <> ? LIMIT 1`,
        [r.nomor, nomor]
      );
      if (dipakai)
        throw new Error(`Retur ${r.nomor} sudah dipakai pembayaran ${dipakai.bysd_bys_nomor}.`);
      listRetur.push({ nomor: h.ret_nomor, amount: Number(h.ret_amount) || 0 });
    }

    const totalInv = detail.reduce((s, d) => s + (Number(d.bayar) || 0), 0);
    const totalRetur = listRetur.reduce((s, r) => s + r.amount, 0);

    if (totalRetur > totalInv)
      throw new Error("Total retur melebihi total pembayaran invoice.");
    if (Math.abs((Number(nilai) || 0) - (totalInv - totalRetur)) > 10)
      throw new Error("Nilai pembayaran tidak sesuai (nilai = bayar invoice − retur).");

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

    // Baris retur: bysd_inv_nomor = nomor retur (bukan invoice) — trigger
    // tinv_hdr dari DB akan no-op karena nomor tidak match.
    for (const r of listRetur) {
      await conn.query(
        `INSERT INTO tbayarsup_dtl (bysd_bys_nomor, bysd_inv_nomor, bysd_bayar)
         VALUES (?, ?, ?)`,
        [actualNomor, r.nomor, r.amount]
      );
    }

    // ── Jurnal setle retur: RK HUTANG kembali ke HUTANG DAGANG ───────
    // HUTANG (19.002) Debit = retur | RK HUTANG (19.014) Kredit = retur
    // Jurnal utama pembayaran tetap dibangun trigger DB; jurnal setle
    // ini dibangun di Node dengan jur_no = {nomor}R.
    await deleteJurnal(conn, `${actualNomor}R`);
    if (totalRetur > 0) {
      await insertJurnal(conn, {
        nomor: `${actualNomor}R`,
        tanggal,
        tipetransaksi: "Setle Retur Pembelian",
        keterangan: `Setle Retur Pembayaran ${actualNomor}`,
        user,
        items: [
          { rek: REK.hutang, debit: totalRetur, kredit: 0 },
          { rek: REK.rkHutang, debit: 0, kredit: totalRetur },
        ],
      });
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
  getReturBySupplier,
  getMaxNomor,
  getDetailForm,
  saveData,
};
