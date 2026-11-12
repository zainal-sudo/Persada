// services/penjualan/bayarCustomerService.js
const db = require("../../config/database");

const getBrowse = async (startDate, endDate) => {
  const [rows] = await db.query(
    `SELECT 
       a.byc_nomor AS Nomor,
       DATE_FORMAT(a.byc_tanggal, '%Y-%m-%d') AS Tanggal,
       IF(a.byc_istax = 1, 'PPN', 'Non PPN') AS Status,
       c.cus_kode AS Kode_Cust,
       c.cus_nama AS Customer,
       (SELECT DISTINCT sla_nama 
        FROM tbayarcus_dtl d
        INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bycd_fp_nomor
        LEFT JOIN tso_hdr so ON so.so_nomor = fp.fp_so_nomor
        INNER JOIN tsalesmanaktif ON sla_sls_kode = so.so_sls_kode
        WHERE d.bycd_byc_nomor = a.byc_nomor LIMIT 1) AS Salesman,
       IFNULL(a.byc_cash, 0) AS Cash,
       IFNULL(a.byc_transfer, 0) AS Transfer,
       IFNULL(a.byc_potongan, 0) AS Potongan,
       IFNULL(a.byc_giro, 0) AS Giro,
       IFNULL(a.byc_nogiro, '') AS GiroNumber,
       DATE_FORMAT(a.byc_tglcair, '%Y-%m-%d') AS TglCair,
       (SELECT rek_nama FROM trekening WHERE rek_kode = a.byc_rek_cash) AS Rekening_Cash,
       (SELECT rek_nama FROM trekening WHERE rek_kode = a.byc_rek_transfer) AS Rekening_Transfer,
       IFNULL(a.byc_ppn, 0) AS PPN,
       IFNULL(a.byc_pph, 0) AS PPH,
       IFNULL(a.byc_ntpn, '') AS NTPN,
       (SELECT COUNT(*) FROM tfp_hdr 
        INNER JOIN tbayarcus_dtl ON bycd_fp_nomor = fp_nomor AND fp_isdtp = 1 
        WHERE bycd_byc_nomor = a.byc_nomor) AS Dtp,
       DATE_FORMAT(a.date_create, '%Y-%m-%d %H:%i:%s') AS date_create,
       DATE_FORMAT(a.date_modified, '%Y-%m-%d %H:%i:%s') AS date_modified
     FROM tbayarcus_hdr a
     INNER JOIN tcustomer c ON c.cus_kode = a.byc_cus_kode
     WHERE a.byc_tanggal BETWEEN ? AND ?
     ORDER BY a.byc_nomor ASC`,
    [startDate, endDate]
  );
  return rows;
};

const getBrowseDetail = async (nomor) => {
  const [rows] = await db.query(
    `SELECT 
       d.bycd_byc_nomor AS Nomor,
       d.bycd_fp_nomor AS Invoice,
       DATE_FORMAT(fp.fp_tanggal, '%Y-%m-%d') AS Tgl_Invoice,
       DATE_FORMAT(fp.fp_jthtempo, '%Y-%m-%d') AS JthTempo,
       IFNULL(fp.fp_amount, 0) AS Nilai,
       IFNULL(d.bycd_bayar, 0) AS Bayar
     FROM tbayarcus_dtl d
     INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bycd_fp_nomor
     WHERE d.bycd_byc_nomor = ?
     ORDER BY d.bycd_byc_nomor ASC`,
    [nomor]
  );
  return rows;
};

const deleteData = async (nomor) => {
  const [[header]] = await db.query(
    `SELECT byc_nomor FROM tbayarcus_hdr WHERE byc_nomor = ?`,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    await conn.query(`DELETE FROM tbayarcus_dtl WHERE bycd_byc_nomor = ?`, [nomor]);
    await conn.query(`DELETE FROM tbayarcus_hdr WHERE byc_nomor = ?`, [nomor]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Data cetak PENERIMAAN CUSTOMER (paritas doslip + report BYC.fr3) ──
// Cetak via browser (A5), BUKAN dot matrix. Tanpa update flag cetak (paritas Delphi).
const getPrintData = async (nomor) => {
  const [[header]] = await db.query(
    `
    SELECT
      a.byc_nomor AS nomor,
      DATE_FORMAT(a.byc_tanggal, '%m/%d/%Y') AS tanggal,
      IFNULL(a.byc_nogiro, '') AS noGiro,
      DATE_FORMAT(a.byc_tglcair, '%m/%d/%Y') AS tglCair,
      IFNULL(a.byc_cash, 0) AS cash,
      IFNULL(a.byc_transfer, 0) AS transfer,
      IFNULL(a.byc_potongan, 0) AS potongan,
      IFNULL(a.byc_giro, 0) AS giro,
      IFNULL(a.byc_ppn, 0) AS ppn,
      IFNULL(a.byc_pph, 0) AS pph,
      IFNULL(a.byc_memo, '') AS memo,
      IFNULL(c.cus_nama, '') AS cusNama,
      IFNULL(c.cus_alamat, '') AS cusAlamat,
      IFNULL(rb.rek_nama, '') AS rekCash,
      IFNULL(rt.rek_nama, '') AS rekTransfer,
      IFNULL(rg.rek_nama, '') AS rekGiro,
      IFNULL(rp.rek_nama, '') AS rekPotongan,
      IFNULL(rpn.rek_nama, '') AS rekPPN,
      IFNULL(rph.rek_nama, '') AS rekPPH,
      terbilang(IFNULL(a.byc_cash,0) + IFNULL(a.byc_transfer,0) + IFNULL(a.byc_giro,0) + IFNULL(a.byc_potongan,0) + IFNULL(a.byc_ppn,0) + IFNULL(a.byc_pph,0)) AS terbilang
    FROM tbayarcus_hdr a
    INNER JOIN tcustomer c ON c.cus_kode = a.byc_cus_kode
    LEFT JOIN trekening rb ON rb.rek_kode = a.byc_rek_cash
    LEFT JOIN trekening rt ON rt.rek_kode = a.byc_rek_transfer
    LEFT JOIN trekening rg ON rg.rek_kode = a.byc_rek_giro
    LEFT JOIN trekening rp ON rp.rek_kode = a.byc_rek_potongan
    LEFT JOIN trekening rpn ON rpn.rek_kode = a.byc_rek_ppn
    LEFT JOIN trekening rph ON rph.rek_kode = a.byc_rek_pph
    WHERE a.byc_nomor = ?
    LIMIT 1
    `,
    [nomor]
  );
  if (!header) throw new Error("Data tidak ditemukan.");

  const [detail] = await db.query(
    `
    SELECT
      d.bycd_fp_nomor AS fpNomor,
      DATE_FORMAT(fp.fp_tanggal, '%m/%d/%Y') AS fpTanggal,
      DATE_FORMAT(fp.fp_jthtempo, '%m/%d/%Y') AS fpJthTempo,
      IFNULL(fp.fp_amount, 0) AS fpAmount,
      IFNULL(fp.fp_dp, 0) AS fpDp,
      IFNULL(fp.fp_cn, 0) AS fpCn,
      IFNULL(fp.fp_bayar, 0) AS fpBayar,
      IFNULL((SELECT SUM(retj_amount) FROM tretj_hdr WHERE retj_fp_nomor = fp.fp_nomor), 0) AS retur,
      d.bycd_bayar AS bayar
    FROM tbayarcus_dtl d
    INNER JOIN tfp_hdr fp ON fp.fp_nomor = d.bycd_fp_nomor
    WHERE d.bycd_byc_nomor = ?
    ORDER BY d.bycd_fp_nomor ASC
    `,
    [nomor]
  );

  const [[perusahaan]] = await db.query(
    `SELECT perush_nama, perush_alamat, perush_kota, perush_notelp, perush_nofax
     FROM tperusahaan LIMIT 1`
  );

  // Kolom laporan: Jumlah = amount - DP - CN - retur; Terutang = amount - bayar(fp) - DP - CN - retur
  const detailRows = detail.map((r, i) => {
    const jumlah = Number(r.fpAmount) - Number(r.fpDp) - Number(r.fpCn) - Number(r.retur);
    const terutang = Number(r.fpAmount) - Number(r.fpBayar) - Number(r.fpDp) - Number(r.fpCn) - Number(r.retur);
    return {
      no: i + 1,
      fpNomor: r.fpNomor,
      fpTanggal: r.fpTanggal,
      fpJthTempo: r.fpJthTempo,
      jumlah,
      terutang,
      bayar: Number(r.bayar) || 0,
    };
  });

  const nilaiTotal =
    Number(header.cash) + Number(header.transfer) +
    Number(header.giro) + Number(header.potongan);
  const totalBayar = detailRows.reduce((s, r) => s + Number(r.bayar || 0), 0);

  return {
    nomor: header.nomor,
    tanggal: header.tanggal,
    noGiro: header.noGiro,
    tglCair: header.tglCair,
    cusNama: header.cusNama,
    cusAlamat: header.cusAlamat,
    // Rekening: nama untuk slip. Cash/Giro/Potongan ikut dikembalikan —
    // sebelumnya hanya Transfer yang dir-forward, padahal query-nya
    // sudah join keempatnya.
    rekCash: header.rekCash,
    rekTransfer: header.rekTransfer,
    rekGiro: header.rekGiro,
    rekPotongan: header.rekPotongan,
    rekPPN: header.rekPPN,
    rekPPH: header.rekPPH,
    nilaiTotal,
    terbilang: header.terbilang || "",
    memo: header.memo,
    perusahaan: perusahaan ? {
      nama: perusahaan.perush_nama,
      alamat: perusahaan.perush_alamat,
      kota: perusahaan.perush_kota,
      notelp: perusahaan.perush_notelp,
      nofax: perusahaan.perush_nofax,
    } : { nama: "", alamat: "", kota: "", notelp: "", nofax: "" },
    detail: detailRows,
    totalBayar,
  };
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData };