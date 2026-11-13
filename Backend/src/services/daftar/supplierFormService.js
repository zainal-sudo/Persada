const db = require("../../config/database");

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (kode) => {
  const [[row]] = await db.query(
    `SELECT
       Sup_kode AS kode,
       Sup_nama AS nama,
       IFNULL(Sup_alamat, '') AS alamat,
       IFNULL(Sup_kota, '') AS kota,
       IFNULL(Sup_telp, '') AS telp,
       IFNULL(Sup_fax, '') AS fax,
       IFNULL(Sup_CP, '') AS cp,
       IFNULL(sup_email, '') AS email,
       IFNULL(Sup_top, 0) AS top,
       IFNULL(sup_bank, '') AS bank,
       IFNULL(sup_rekening, '') AS rekening,
       IFNULL(sup_atasnama, '') AS atasnama
     FROM tsupplier
     WHERE Sup_kode = ?`,
    [kode]
  );

  if (!row) throw new Error("Supplier tidak ditemukan.");

  return row;
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit,
    kode,
    nama,
    alamat,
    kota,
    telp,
    fax,
    cp,
    email,
    top,
    bank,
    rekening,
    atasnama,
    cabang,
  } = payload;

  if (!kode || !String(kode).trim()) {
    throw new Error("Kode supplier wajib diisi.");
  }
  if (!nama || !String(nama).trim()) {
    throw new Error("Nama supplier wajib diisi.");
  }

  const actualKode = String(kode).trim().toUpperCase();
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const [[existing]] = await conn.query(
      `SELECT Sup_kode FROM tsupplier WHERE Sup_kode = ?`,
      [actualKode]
    );

    if (isEdit) {
      if (!existing) throw new Error("Supplier tidak ditemukan.");
      await conn.query(
        `UPDATE tsupplier SET
           Sup_nama = ?, Sup_alamat = ?, Sup_kota = ?,
           Sup_telp = ?, Sup_fax = ?, Sup_CP = ?,
           sup_email = ?, Sup_top = ?, sup_bank = ?,
           sup_rekening = ?, sup_atasnama = ?,
           date_modified = NOW(), user_modified = ?
         WHERE Sup_kode = ?`,
        [
          nama, alamat, kota, telp, fax, cp,
          email, Number(top) || 0, bank, rekening, atasnama,
          user.kode, actualKode,
        ]
      );
    } else {
      if (existing) throw new Error("Kode supplier sudah dipakai.");
      await conn.query(
        `INSERT INTO tsupplier
           (Sup_kode, Sup_nama, Sup_alamat, Sup_kota, Sup_telp,
            Sup_fax, Sup_CP, sup_email, Sup_top, sup_bank,
            sup_rekening, sup_atasnama, sup_cabang,
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          actualKode, nama, alamat, kota, telp,
          fax, cp, email, Number(top) || 0, bank,
          rekening, atasnama, cabang || user.cabang, user.kode,
        ]
      );
    }

    await conn.commit();
    return { kode: actualKode };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getDetailForm,
  saveData,
};
