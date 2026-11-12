// services/laporan/inkasoBawahHetService.js
// Migrasi dari Delphi ufrmBrowseInkasoBawahHet.pas (btnRefreshClick)
// Master: penerimaan (kartu_piutang nomor CR) yang membayar faktur berisi
// barang terjual di bawah HET. Detail: daftar barang di bawah HET per faktur.
const db = require("../../config/database");

// Net sebuah baris faktur (tanpa retur) — formula persis Delphi
const NET = "(fpd_harga*(100-fpd_discpr)/100)"
  + " - (fpd_cn*((100-fpd_discpr)*fpd_harga/100)/100)"
  + " - (((100-fpd_discpr)*fpd_harga/100)*fpd_bp_pr/100)"
  + " - fpd_bp_rp";

const getBrowse = async ({ bulan, tahun }) => {
  if (!bulan || !tahun) throw new Error("bulan dan tahun wajib.");

  const sql = `
    SELECT Noreferensi, sls_nama AS Salesman, kredit AS Bayar,
           tanggal AS Tgl_Bayar, fp_tanggal AS Tanggal_Faktur,
           DATEDIFF(tanggal, fp_tanggal) AS SelisihHari,
           (SELECT SUM(fpd_harga*(100-fpd_discpr)/100 * fpd_qty)
              FROM tfp_dtl
              INNER JOIN tfp_hdr  ON fp_nomor = fpd_fp_nomor
              LEFT JOIN tso_hdr  ON so_nomor = fp_so_nomor
              INNER JOIN tsalesman ON sls_kode = so_sls_kode
              INNER JOIN tbarang  ON brg_kode = fpd_brg_kode
              INNER JOIN tcustomer ON fp_cus_kode = cus_kode
             WHERE fpd_fp_nomor = noreferensi
               AND fpd_hrg_min > 0
               AND brg_isproductfocus = 1
               AND ${NET} < fpd_hrg_min) * (kredit / fp_amount) AS pengurang,
           (SELECT cus_nama FROM tcustomer WHERE cus_kode = a.fp_cus_kode LIMIT 1) AS Customer
      FROM kartu_piutang a
      INNER JOIN tsalesman ON sls_kode = salesman
      INNER JOIN tfp_hdr  ON fp_nomor = noreferensi
     WHERE MONTH(tanggal) = ?
       AND YEAR(tanggal)  = ?
       AND nomor LIKE '%CR%'
     HAVING pengurang > 0
     ORDER BY noreferensi
  `;

  const [rows] = await db.query(sql, [Number(bulan), Number(tahun)]);
  return rows;
};

const getDetail = async (noreferensi) => {
  const sql = `
    SELECT fpd_fp_nomor AS Noreferensi, brg_nama,
           fpd_qty AS qty,
           (${NET}) AS Net,
           fpd_hrg_min AS HET
      FROM tfp_dtl
      INNER JOIN tfp_hdr  ON fp_nomor = fpd_fp_nomor
      LEFT JOIN tso_hdr  ON so_nomor = fp_so_nomor
      INNER JOIN tsalesman ON sls_kode = so_sls_kode
      INNER JOIN tbarang  ON brg_kode = fpd_brg_kode
      INNER JOIN tcustomer ON fp_cus_kode = cus_kode
     WHERE fpd_fp_nomor = ?
       AND fpd_hrg_min > 0
       AND brg_isproductfocus = 1
       AND (${NET}) < fpd_hrg_min
     ORDER BY brg_nama
  `;

  const [rows] = await db.query(sql, [noreferensi]);
  return rows;
};

module.exports = { getBrowse, getDetail };
