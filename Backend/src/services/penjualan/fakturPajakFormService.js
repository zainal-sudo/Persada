// services/penjualan/fakturPajakFormService.js
const db = require("../../config/database");

// ── Refresh — Load FP yang belum punya nomor pajak ───────────────────
const refresh = async (startDate, endDate, isManual) => {
  let sql = "";

  if (Number(isManual) === 1) {
    // Dari tfp_hdr_bayangan
    sql = `
      SELECT 
        COALESCE(a.fp_so_nomor, a.fp_do_nomor) AS fp_do_nomor,
        s.sls_nama AS salesman,
        c.cus_kode AS kodeCust,
        c.cus_nama AS customer,
        a.fp_nomor AS invoice,
        DATE_FORMAT(a.fp_tanggal, '%Y-%m-%d') AS tanggal,
        IFNULL(a.fp_taxamount, 0) AS ppn,
        IFNULL(a.fp_amount, 0) AS nilai,
        0 AS status,
        0 AS negri,
        1 AS ismanual,
        '' AS noPajak,
        NULL AS tanggalPajak,
        IFNULL(a.fp_isDTP, 0) AS isDTP,
        0 AS adaRetur
      FROM tfp_hdr_bayangan a
      LEFT JOIN tso_hdr so ON so.so_nomor = a.fp_so_nomor
      LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
      LEFT JOIN tcustomer c ON c.cus_kode = a.fp_cus_kode
      LEFT JOIN tfakturpajak_hdr x ON x.fp_nomor = a.fp_nomor
      WHERE a.fp_istax = 1
        AND a.fp_tanggal BETWEEN ? AND ?
        AND x.fp_fakturpajak IS NULL
      ORDER BY a.fp_nomor`;
  } else {
    // Dari tfp_hdr
    sql = `
      SELECT 
        COALESCE(a.fp_so_nomor, a.fp_do_nomor) AS fp_do_nomor,
        s.sls_nama AS salesman,
        c.cus_kode AS kodeCust,
        c.cus_nama AS customer,
        a.fp_nomor AS invoice,
        DATE_FORMAT(a.fp_tanggal, '%Y-%m-%d') AS tanggal,
        IFNULL(a.fp_taxamount, 0) - IFNULL((SELECT SUM(retj_taxamount) FROM tretj_hdr WHERE retj_fp_nomor = a.fp_nomor), 0) AS ppn,
        IFNULL(a.fp_amount, 0) - IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = a.fp_nomor), 0) AS nilai,
        0 AS status,
        0 AS negri,
        (SELECT COUNT(*) FROM tfp_hdr_bayangan WHERE fp_nomor = a.fp_nomor) AS ismanual,
        '' AS noPajak,
        NULL AS tanggalPajak,
        IFNULL(a.fp_isDTP, 0) AS isDTP,
        IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = a.fp_nomor), 0) AS adaRetur
      FROM tfp_hdr a
      LEFT JOIN tso_hdr so ON so.so_nomor = a.fp_so_nomor
      LEFT JOIN tsalesman s ON s.sls_kode = so.so_sls_kode
      LEFT JOIN tcustomer c ON c.cus_kode = a.fp_cus_kode
      LEFT JOIN tfakturpajak_hdr x ON x.fp_nomor = a.fp_nomor
      WHERE a.fp_istax = 1
        AND a.fp_isecer = 0
        AND a.fp_tanggal BETWEEN ? AND ?
        AND x.fp_fakturpajak IS NULL
      ORDER BY a.fp_nomor`;
  }

  const [rows] = await db.query(sql, [startDate, endDate]);

  return rows.map((r) => ({
    salesman: r.salesman || "",
    customer: r.customer || "",
    kodeCust: r.kodeCust || "",
    doNomor: r.fp_do_nomor || "",
    invoice: r.invoice,
    tanggal: r.tanggal,
    ppn: Number(r.ppn || 0),
    nilai: Number(r.nilai || 0),
    status: 0,
    negri: 0,
    ismanual: Number(r.ismanual || 0),
    noPajak: "",
    tanggalPajak: "",
    isDTP: Number(r.isDTP || 0),
    adaRetur: Number(r.adaRetur || 0),
  }));
};

// ── Save ─────────────────────────────────────────────────────────────
const saveData = async (payload, user) => {
  const { detail } = payload;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    for (const d of detail) {
      if (Number(d.status) > 0) {
        // Delete existing
        await conn.query(`DELETE FROM tfakturpajak_hdr WHERE fp_nomor = ?`, [d.invoice]);
        await conn.query(`DELETE FROM tfakturpajak_dtl WHERE fpd_fp_nomor = ?`, [d.invoice]);

        // Insert header
        await conn.query(
          `INSERT INTO tfakturpajak_hdr
             (fp_nomor, fp_do_nomor, fp_tanggal, fp_fakturpajak, fp_tanggalpajak,
              fp_cus_kode, fp_disc_faktur, fp_disc_fakturpr, fp_amount, fp_taxamount,
              fp_istax, ismanual, date_create, user_create)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, ?, NOW(), ?)`,
          [d.invoice, d.doNomor, d.tanggal, d.noPajak, d.tanggalPajak,
           d.kodeCust, d.nilai, d.ppn, d.ismanual, user.kode]
        );

        // Insert detail
        if (Number(d.ismanual) === 1) {
          await conn.query(
            `INSERT INTO tfakturpajak_dtl 
               (fpd_fp_nomor, fpd_brg_kode, fpd_brg_nama, fpd_brg_satuan, fpd_qty,
                fpd_discpr, fpd_harga, fpd_nourut, fpd_expired, fpd_cn, fpd_gdg_kode)
             SELECT fpd_fp_nomor, fpd_brg_kode, brg_nama, fpd_brg_satuan, fpd_qty,
                    fpd_discpr, fpd_harga, fpd_nourut, fpd_expired, fpd_cn, fpd_gdg_kode
             FROM tfp_dtl_bayangan 
             INNER JOIN tbarang ON brg_kode = fpd_brg_kode
             WHERE fpd_fp_nomor = ?`,
            [d.invoice]
          );
        } else {
          await conn.query(
            `INSERT INTO tfakturpajak_dtl 
               (fpd_fp_nomor, fpd_brg_kode, fpd_brg_nama, fpd_brg_satuan, fpd_qty,
                fpd_discpr, fpd_harga, fpd_nourut, fpd_expired, fpd_cn, fpd_gdg_kode)
             SELECT fpd_fp_nomor, fpd_brg_kode, brg_nama, fpd_brg_satuan,
                    fpd_qty - (SELECT IFNULL(SUM(retjd_qty), 0) 
                               FROM tretj_dtl 
                               INNER JOIN tretj_hdr ON retj_nomor = retjd_retj_nomor 
                               WHERE retj_fp_nomor = fpd_fp_nomor 
                                 AND retjd_brg_kode = fpd_brg_kode) AS qty,
                    fpd_discpr, fpd_harga, fpd_nourut, fpd_expired, fpd_cn, fpd_gdg_kode
             FROM tfp_dtl 
             INNER JOIN tbarang ON brg_kode = fpd_brg_kode
             WHERE fpd_fp_nomor = ?`,
            [d.invoice]
          );
        }
      }
    }

    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { refresh, saveData };