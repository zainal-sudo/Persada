// services/penjualan/serahTerimaFakturSalesmanFormService.js
const db = require("../../config/database");

// ── Generate Nomor ───────────────────────────────────────────────────
const getMaxNomor = async (tanggal, cabang = "01") => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang}-ST.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(sth2_nomor, 4) AS UNSIGNED)), 0) AS max_val
     FROM tserahterimafaktur_hdr2 WHERE sth2_nomor LIKE ?`,
    [`${prefix}%`]
  );
  const nextNum = 10000 + Number(row.max_val) + 1;
  const shortNum = String(nextNum).slice(-4);
  return `${prefix}${shortNum.padStart(4, "0")}`;
};

// ── Get Salesman ─────────────────────────────────────────────────────
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
     FROM tsalesman
     ORDER BY sls_nama`
  );
  return rows;
};

// ── Get Invoice ──────────────────────────────────────────────────────
const getInvoice = async (slsKode) => {
  const [rows] = await db.query(
    `SELECT 
       c.cus_nama AS customer,
       fp.fp_nomor AS faktur,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS tanggal,
       IFNULL(fp.fp_taxamount, 0) AS ppn,
       IFNULL(fp.fp_amount, 0) AS nilai,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS jatuhTempo,
       DATEDIFF(CURDATE(), fp.fp_jthtempo) AS overdue,
       CASE 
         WHEN DATEDIFF(CURDATE(), fp.fp_jthtempo) < 0 THEN 'Belum'
         WHEN DATEDIFF(CURDATE(), fp.fp_jthtempo) BETWEEN 0 AND 30 THEN '0 s/d 30'
         WHEN DATEDIFF(CURDATE(), fp.fp_jthtempo) BETWEEN 31 AND 60 THEN '31 s/d 60'
         WHEN DATEDIFF(CURDATE(), fp.fp_jthtempo) BETWEEN 61 AND 90 THEN '61 s/d 90'
         WHEN DATEDIFF(CURDATE(), fp.fp_jthtempo) BETWEEN 91 AND 120 THEN '91 s/d 120'
         ELSE 'x > 120'
       END AS rangeOverdue
     FROM tfp_hdr fp
     INNER JOIN tcustomer c ON c.cus_kode = fp.fp_cus_kode
     LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
     WHERE so.so_sls_kode = ?
       AND (fp.fp_amount - fp.fp_dp - IFNULL(fp.fp_bayar, 0) -
            IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0)) > 1
     ORDER BY fp.fp_tanggal, fp.fp_nomor`,
    [slsKode]
  );

  return rows.map((r) => ({
    customer: r.customer || "",
    faktur: r.faktur,
    tanggal: r.tanggal,
    ppn: Number(r.ppn || 0),
    nilai: Number(r.nilai || 0),
    jatuhTempo: r.jatuhTempo,
    overdue: String(r.overdue || 0),
    rangeOverdue: r.rangeOverdue || "",
    check: 0,
  }));
};

// ── Load Form Edit ───────────────────────────────────────────────────
const getDetailForm = async (nomor) => {
  const [[h]] = await db.query(
    `SELECT sth2_nomor AS nomor, DATE_FORMAT(sth2_tanggal, '%Y-%m-%d') AS tanggal,
            sth2_sls_kode AS slsKode, sth2_memo AS memo
     FROM tserahterimafaktur_hdr2 WHERE sth2_nomor = ?`,
    [nomor]
  );

  if (!h) throw new Error("Data tidak ditemukan.");

  const [[salesman]] = await db.query(
    `SELECT sls_nama FROM tsalesman WHERE sls_kode = ? LIMIT 1`,
    [h.slsKode]
  );

  // Load invoice untuk salesman ini
  const invoices = await getInvoice(h.slsKode);

  // Ambil detail yang sudah dicentang
  const [details] = await db.query(
    `SELECT std2_fp_nomor AS faktur
     FROM tserahterimafaktur_dtl2 WHERE std2_sth2_nomor = ?`,
    [nomor]
  );

  const checkedSet = new Set(details.map((d) => d.faktur));

  for (const inv of invoices) {
    if (checkedSet.has(inv.faktur)) {
      inv.check = 1;
    }
  }

  return {
    ...h,
    slsNama: salesman?.sls_nama || "",
    detail: invoices,
  };
};

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { isEdit, nomor, tanggal, slsKode, memo, detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    let actualNomor = nomor;

    if (isEdit) {
      await conn.query(
        `UPDATE tserahterimafaktur_hdr2 SET
           sth2_sls_kode = ?, sth2_memo = ?, sth2_tanggal = ?,
           date_modify = NOW(), user_modify = ?
         WHERE sth2_nomor = ?`,
        [slsKode, memo, tanggal, user.kode, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user.cabang);
      await conn.query(
        `INSERT INTO tserahterimafaktur_hdr2
           (sth2_nomor, sth2_tanggal, sth2_sls_kode, sth2_memo, date_create, user_create)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [actualNomor, tanggal, slsKode, memo, user.kode]
      );
    }

    await conn.query(`DELETE FROM tserahterimafaktur_dtl2 WHERE std2_sth2_nomor = ?`, [actualNomor]);

    for (const d of detail) {
      if (Number(d.check) === 1) {
        await conn.query(
          `INSERT INTO tserahterimafaktur_dtl2 (std2_sth2_nomor, std2_fp_nomor)
           VALUES (?, ?)`,
          [actualNomor, d.faktur]
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
  getSalesman,
  getInvoice,
  getDetailForm,
  saveData,
};