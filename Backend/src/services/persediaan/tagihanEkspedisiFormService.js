const db = require("../../config/database");

// ── Generate Nomor Otomatis ──────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-TE.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(teh_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM ttagihanekspedisi_hdr
     WHERE teh_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  return `${prefix}${String(nextNum).slice(-4)}`;
};

// ── Load FP (belum ditagihkan) ──────────────────────────────────────
// mode = 'fp'  : FP langsung (periode fp_tanggal) — paritas v1 btnRefresh.
// mode = 'ste' : FP dari Serah Terima Ekspedisi (periode ste_tanggal) —
//                paritas v2 btnRefresh (tambah kolom ste_nomor).
const loadFP = async (startDate, endDate, mode = "fp") => {
  const isSte = mode === "ste";
  let queriedRows;
  if (isSte) {
    [queriedRows] = await db.query(
      `SELECT
         a.fp_nomor AS nomor,
         cus.cus_nama AS nama,
         DATE_FORMAT(a.fp_tanggal, '%Y-%m-%d') AS tanggal,
         (a.fp_amount - a.fp_taxamount) AS nilai,
         ste_hdr.ste_nomor AS ste
       FROM tserahterimaekspedisi_hdr ste_hdr
       INNER JOIN tserahterimaekspedisi_dtl ste_dtl
         ON ste_dtl.sted_ste_nomor = ste_hdr.ste_nomor
       INNER JOIN tfp_hdr a ON a.fp_nomor = ste_dtl.sted_fp_nomor
       INNER JOIN tcustomer cus ON cus.Cus_kode = a.FP_cus_kode
       WHERE ste_hdr.ste_tanggal BETWEEN ? AND ?
         AND a.fp_nomor NOT IN (SELECT tehd_fp_nomor FROM ttagihanekspedisi_dtl)
       ORDER BY a.fp_nomor ASC`,
      [startDate, endDate]
    );
  } else {
    [queriedRows] = await db.query(
      `SELECT
         a.fp_nomor AS nomor,
         b.cus_nama AS nama,
         DATE_FORMAT(a.fp_tanggal, '%Y-%m-%d') AS tanggal,
         (a.fp_amount - a.fp_taxamount) AS nilai
       FROM tfp_hdr a
       INNER JOIN tcustomer b ON b.Cus_kode = a.FP_cus_kode
       WHERE a.fp_tanggal BETWEEN ? AND ?
         AND a.fp_nomor NOT IN (SELECT tehd_fp_nomor FROM ttagihanekspedisi_dtl)
       ORDER BY a.fp_nomor ASC`,
      [startDate, endDate]
    );
  }
  return queriedRows.map((r) => ({
    nomor: r.nomor,
    nama: r.nama,
    tanggal: r.tanggal,
    nilai: Number(r.nilai),
    ste: r.ste || "",
  }));
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT
       teh_nomor AS nomor,
       DATE_FORMAT(teh_tanggal, '%Y-%m-%d') AS tanggal,
       DATE_FORMAT(teh_tg1, '%Y-%m-%d') AS tg1,
       DATE_FORMAT(teh_tg2, '%Y-%m-%d') AS tg2,
       IFNULL(teh_namaekspedisi, '') AS namaEkspedisi,
       IFNULL(teh_keterangan, '') AS keterangan
     FROM ttagihanekspedisi_hdr
     WHERE teh_nomor = ?`,
    [nomor]
  );

  if (!header) throw new Error("Tagihan ekspedisi tidak ditemukan.");

  const [detailRows] = await db.query(
    `SELECT
       tehd_fp_nomor AS nomor,
       tehd_cus_nama AS nama,
       DATE_FORMAT(tehd_tanggal, '%Y-%m-%d') AS tanggal,
       tehd_nilai AS nilai,
       tehd_biaya AS biaya,
       IFNULL(tehd_ste_nomor, '') AS ste
     FROM ttagihanekspedisi_dtl
     WHERE tehd_teh_nomor = ?
     ORDER BY tehd_fp_nomor ASC`,
    [nomor]
  );

  return {
    ...header,
    detail: detailRows.map((d, i) => ({
      no: i + 1,
      nomor: d.nomor,
      nama: d.nama,
      tanggal: d.tanggal || "",
      nilai: Number(d.nilai),
      biaya: Number(d.biaya),
      uoc: Number(d.nilai) > 0 ? (Number(d.biaya) / Number(d.nilai)) * 100 : 0,
      ste: d.ste,
    })),
  };
};

// ── Save Data ────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, tg1, tg2, namaEkspedisi, keterangan, detail,
  } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE ttagihanekspedisi_hdr SET
           teh_tanggal = ?, teh_tg1 = ?, teh_tg2 = ?,
           teh_namaekspedisi = ?, teh_keterangan = ?
         WHERE teh_nomor = ?`,
        [tanggal, tg1, tg2, namaEkspedisi, keterangan, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO ttagihanekspedisi_hdr
           (teh_nomor, teh_tanggal, teh_tg1, teh_tg2, teh_namaekspedisi, teh_keterangan)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [actualNomor, tanggal, tg1, tg2, namaEkspedisi, keterangan]
      );
    }

    // Delete detail lama
    await conn.query(
      `DELETE FROM ttagihanekspedisi_dtl WHERE tehd_teh_nomor = ?`,
      [actualNomor]
    );

    // Insert detail baru (hanya biaya > 0)
    for (const d of detail) {
      if (Number(d.biaya) > 0) {
        await conn.query(
          `INSERT INTO ttagihanekspedisi_dtl
             (tehd_teh_nomor, tehd_fp_nomor, tehd_nilai, tehd_biaya, tehd_cus_nama, tehd_tanggal, tehd_ste_nomor)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actualNomor, d.nomor || "ANTARCABANG", d.nilai, d.biaya,
            d.nama, d.tanggal || null, d.ste || "",
          ]
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
  loadFP,
  getDetailForm,
  saveData,
};