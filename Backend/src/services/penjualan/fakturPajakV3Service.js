// services/penjualan/fakturPajakV3Service.js
const db = require("../../config/database");
const ExcelJS = require("exceljs");

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

// DPP / DPP Nilai Lain / PPN untuk satu baris detail — paritas
// ufrmFakturPajak3.pas:430-433. Delphi menghitung dari qty baris ini (untuk
// non-manual: qty yang sudah dikurangi retur) sementara diskon tetap dari qty
// bruto, dan PPN dihitung dari DPP mentah (bukan dari DPP yang sudah dibulatkan).
const hitungPajak = (r) => {
  const dppRaw = round2(r.hargaSatuan) * Number(r.jumlah) - Number(r.totalDiskon);
  return {
    dpp: round2(dppRaw),
    dppNilaiLain: round2((11 / 12) * dppRaw),
    ppn: round2((12 / 100) * (11 / 12) * dppRaw),
  };
};

// ── Get FNPWP ────────────────────────────────────────────────────────
const getFNPWP = async () => {
  const [[row]] = await db.query(
    `SELECT perush_npwp FROM tperusahaan LIMIT 1`
  );
  const npwp = row?.perush_npwp || "";
  let clean = npwp.replace(/\./g, "").replace(/-/g, "");
  // Buang digit 0 paling depan bila ada — Delphi: CONCAT('0', fnpwp, '000000')
  // expecting fnpwp tanpa leading zero supaya idtkupenjual hanya 1 nol di depan.
  if (clean.startsWith("0")) clean = clean.slice(1);
  return clean;
};

// ── Refresh — Load FP untuk export ───────────────────────────────────
const refresh = async (startDate, endDate, isManual) => {
  const fnpwp = await getFNPWP();
  let sql = "";

  if (Number(isManual) === 1) {
    sql = `
      SELECT 
        0 AS baris,
        DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
        'Normal' AS jenisFaktur,
        '04' AS kodeTransaksi,
        ' ' AS keteranganTambahan,
        ' ' AS dokumenPendukung,
        ' ' AS periodeDokPendukung,
        fp_nomor AS referensi,
        ' ' AS capFasilitas,
        CONCAT('0', ?, '000000') AS idTkuPenjual,
        cus_npwp AS npwpPembeli,
        'TIN' AS jenisIdPembeli,
        'IDN' AS negaraPembeli,
        '-' AS nomorDokumenPembeli,
        cus_namanpwp AS namaPembeli,
        cus_alamatnpwp AS alamatPembeli,
        '-' AS emailPembeli,
        CONCAT(cus_npwp, '000000') AS idTkuPembeli
      FROM tfp_hdr_bayangan
      INNER JOIN tcustomer ON cus_kode = fp_cus_kode
      WHERE fp_tanggal BETWEEN ? AND ?`;
  } else {
    sql = `
      SELECT 
        0 AS baris,
        DATE_FORMAT(fp_tanggal, '%Y-%m-%d') AS tanggal,
        'Normal' AS jenisFaktur,
        '04' AS kodeTransaksi,
        ' ' AS keteranganTambahan,
        ' ' AS dokumenPendukung,
        ' ' AS periodeDokPendukung,
        fp_nomor AS referensi,
        ' ' AS capFasilitas,
        CONCAT('0', ?, '000000') AS idTkuPenjual,
        cus_npwp AS npwpPembeli,
        'TIN' AS jenisIdPembeli,
        'IDN' AS negaraPembeli,
        '-' AS nomorDokumenPembeli,
        cus_namanpwp AS namaPembeli,
        cus_alamatnpwp AS alamatPembeli,
        '-' AS emailPembeli,
        CONCAT(cus_npwp, '000000') AS idTkuPembeli
      FROM tfp_hdr
      INNER JOIN tcustomer ON cus_kode = fp_cus_kode
      WHERE fp_tanggal BETWEEN ? AND ?
        AND cus_npwp <> ''`;
  }

  const [rows] = await db.query(sql, [fnpwp, startDate, endDate]);

  return rows.map((r, idx) => ({
    baris: idx + 1,
    tanggal: r.tanggal,
    jenisFaktur: r.jenisFaktur,
    kodeTransaksi: r.kodeTransaksi,
    keteranganTambahan: r.keteranganTambahan,
    dokumenPendukung: r.dokumenPendukung,
    periodeDokPendukung: r.periodeDokPendukung,
    referensi: r.referensi,
    capFasilitas: r.capFasilitas,
    idTkuPenjual: r.idTkuPenjual,
    npwpPembeli: (r.npwpPembeli || "").replace(/\./g, "").replace(/-/g, ""),
    jenisIdPembeli: r.jenisIdPembeli,
    negaraPembeli: r.negaraPembeli,
    nomorDokumenPembeli: r.nomorDokumenPembeli,
    namaPembeli: r.namaPembeli,
    alamatPembeli: r.alamatPembeli,
    emailPembeli: r.emailPembeli,
    idTkuPembeli: (r.idTkuPembeli || "").replace(/\./g, "").replace(/-/g, ""),
  }));
};

// ── Get Detail Faktur untuk Excel ────────────────────────────────────
const getDetailFaktur = async (nomorFP, isManual) => {
  let sql = "";

  if (Number(isManual) === 1) {
    sql = `
      SELECT 0 AS baris, 'A' AS barangJasa, '000000' AS kodeBarang,
             brg_nama AS namaBarang, kode AS namaSatuan,
             fpd_harga AS hargaSatuan, fpd_qty AS jumlah,
             ROUND(fpd_discpr * fpd_harga * fpd_qty / 100, 2) AS totalDiskon,
             12 AS tarifPPN,
             0 AS tarifPPnBM,
             0 AS ppnBM
      FROM tfp_dtl_bayangan
      INNER JOIN tbarang ON fpd_brg_kode = brg_kode
      LEFT JOIN tsatuanpajak ON nama = fpd_brg_satuan
      WHERE fpd_fp_nomor = ?`;
  } else {
    sql = `
      SELECT 0 AS baris, 'A' AS barangJasa, '000000' AS kodeBarang,
             brg_nama AS namaBarang, kode AS namaSatuan,
             fpd_harga AS hargaSatuan,
             (fpd_qty - (SELECT IFNULL(SUM(retjd_qty), 0) 
                         FROM tretj_dtl 
                         INNER JOIN tretj_hdr ON retj_nomor = retjd_retj_nomor 
                         WHERE retj_fp_nomor = fpd_fp_nomor 
                           AND retjd_brg_kode = fpd_brg_kode)) AS jumlah,
             ROUND(fpd_discpr * fpd_harga * fpd_qty / 100, 2) AS totalDiskon,
             12 AS tarifPPN,
             0 AS tarifPPnBM,
             0 AS ppnBM
      FROM tfp_dtl
      INNER JOIN tbarang ON fpd_brg_kode = brg_kode
      LEFT JOIN tsatuanpajak ON nama = fpd_brg_satuan
      WHERE fpd_fp_nomor = ?
      HAVING jumlah > 0`;
  }

  const [rows] = await db.query(sql, [nomorFP]);

  return rows.map((r) => ({ ...r, ...hitungPajak(r) }));
};

// ── Export Excel ─────────────────────────────────────────────────────
// referensiList (opsional): whitelist nomor FP dari baris yang tersisa di
// frontend — paritas Delphi cxButton4Click (export dari CDS yang sudah
// difilter/dihapus user, bukan query ulang mentah).
const exportExcel = async (startDate, endDate, isManual, referensiList = null) => {
  const fnpwp = await getFNPWP();
  const dataFakturAll = await refresh(startDate, endDate, isManual);
  const dataFaktur = referensiList?.length
    ? dataFakturAll.filter((d) => referensiList.includes(d.referensi))
    : dataFakturAll;

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Faktur
  const wsFaktur = wb.addWorksheet("Faktur");

  // Header info
  wsFaktur.getCell("B1").value = "Npwp Penjual     :";
  wsFaktur.getCell("C1").value = fnpwp;

  // Headers
  const headers = [
    "Baris", "Tanggal", "JenisFaktur", "KodeTransaksi", "KeteranganTambahan",
    "DokumenPendukung", "PeriodeDokPendukung", "Referensi", "CapFasilitas",
    "idtkupenjual", "npwppembeli", "jenisidpembeli", "NegaraPembeli",
    "nomordokumenpembeli", "namapembeli", "alamatpembeli", "emailpembeli", "idtkupembeli",
  ];

  const headerRow = wsFaktur.getRow(3);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.commit();

  // Utk paritas Delphi: kolom non-numerik dipaksa format TEKS (numFmt "@")
  // supaya leading-zero & digit panjang tidak berubah (E-notation). Tanpa
  // karakter ' di value — tampilan langsung polos seperti Delphi.
  const setText = (cell, v) => {
    cell.value = v ?? "";
    cell.numFmt = "@";
  };

  // Data rows — mulai row 4 (Delphi: header row 3, data row 4, TANPA baris kosong)
  let rowNum = 4;
  for (const d of dataFaktur) {
    const row = wsFaktur.getRow(rowNum);
    row.getCell(1).value = rowNum - 3;
    setText(row.getCell(2), d.tanggal);
    setText(row.getCell(3), d.jenisFaktur);
    setText(row.getCell(4), d.kodeTransaksi);
    setText(row.getCell(5), d.keteranganTambahan);
    setText(row.getCell(6), d.dokumenPendukung);
    setText(row.getCell(7), d.periodeDokPendukung);
    setText(row.getCell(8), d.referensi);
    setText(row.getCell(9), d.capFasilitas);
    setText(row.getCell(10), d.idTkuPenjual);
    setText(row.getCell(11), d.npwpPembeli);
    setText(row.getCell(12), d.jenisIdPembeli);
    setText(row.getCell(13), d.negaraPembeli);
    setText(row.getCell(14), d.nomorDokumenPembeli);
    setText(row.getCell(15), d.namaPembeli);
    setText(row.getCell(16), d.alamatPembeli);
    setText(row.getCell(17), d.emailPembeli);
    setText(row.getCell(18), d.idTkuPembeli);
    row.commit();
    rowNum++;
  }

  // END marker
  wsFaktur.getCell(rowNum, 1).value = "END";

  // Border paritas Delphi: range A3:kolomTerakhir:barisDataTerakhir
  const lastCol = 18;
  const lastDataRow = rowNum - 1;
  const borderAll = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  for (let r = 3; r <= lastDataRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      wsFaktur.getCell(r, c).border = borderAll;
    }
  }

  // Sheet 2: DetailFaktur
  const wsDetail = wb.addWorksheet("DetailFaktur");

  const detailHeaders = [
    "Baris", "Barang/Jasa", "Kode Barang Jasa", "Nama Barang/Jasa", "Nama Satuan Ukur",
    "Harga Satuan", "Jumlah Barang Jasa", "Total Diskon", "DPP", "DPP Nilai Lain",
    "Tarif PPN", "PPN", "Tarif PPnBM", "PPnBM",
  ];

  const detailHeaderRow = wsDetail.getRow(1);
  detailHeaders.forEach((h, i) => {
    detailHeaderRow.getCell(i + 1).value = h;
  });
  detailHeaderRow.commit();

  let detailRowNum = 2;
  let fakturBaris = 1;

  for (const d of dataFaktur) {
    const details = await getDetailFaktur(d.referensi, isManual);

    for (const det of details) {
      const row = wsDetail.getRow(detailRowNum);
      row.getCell(1).value = fakturBaris;
      setText(row.getCell(2), det.barangJasa);
      setText(row.getCell(3), det.kodeBarang);
      setText(row.getCell(4), det.namaBarang);
      setText(row.getCell(5), det.namaSatuan);
      row.getCell(6).value = Number(det.hargaSatuan || 0);
      row.getCell(7).value = Number(det.jumlah || 0);
      row.getCell(8).value = Number(det.totalDiskon || 0);
      row.getCell(9).value = Number(det.dpp || 0);
      row.getCell(10).value = Number(det.dppNilaiLain || 0);
      setText(row.getCell(11), det.tarifPPN);
      row.getCell(12).value = Number(det.ppn || 0);
      setText(row.getCell(13), det.tarifPPnBM);
      setText(row.getCell(14), det.ppnBM);
      row.commit();
      detailRowNum++;
    }

    fakturBaris++;
  }

  wsDetail.getCell(detailRowNum, 1).value = "END";

  // Auto fit columns
  wsFaktur.columns.forEach((col) => {
    col.width = 20;
  });
  wsDetail.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

module.exports = { refresh, exportExcel };

if (require.main === module) {
  const assert = require("assert");
  // Tanpa retur: DPP = harga*jumlah - diskon (perilaku lama, tidak berubah).
  assert.strictEqual(hitungPajak({ hargaSatuan: 1000, jumlah: 10, totalDiskon: 0 }).dpp, 10000);
  // Retur sebagian 3 dari 10 → harga*7 = 7000, bukan 10000.
  const retur = hitungPajak({ hargaSatuan: 1000, jumlah: 7, totalDiskon: 0 });
  assert.strictEqual(retur.dpp, 7000);
  assert.strictEqual(retur.dppNilaiLain, 6416.67);
  assert.strictEqual(retur.ppn, 770);
  // Diskon tetap dari qty bruto: 1000*10*10/100 = 1000 → 7000 - 1000.
  assert.strictEqual(hitungPajak({ hargaSatuan: 1000, jumlah: 7, totalDiskon: 1000 }).dpp, 6000);
  console.log("fakturPajakV3Service: 4 assert PASS");
  process.exit(0); // pool DB dari config tetap terbuka → akhiri proses check ini
}