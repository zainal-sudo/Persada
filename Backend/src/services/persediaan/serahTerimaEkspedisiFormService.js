// services/persediaan/serahTerimaEkspedisiFormService.js
// Form Serah Terima Ekspedisi. Migrasi dari Delphi
// ufrmSerahTerimaEkspedisi.pas (getmaxkode, btnRefreshClick, loaddataall,
// simpandata, cekdata).
const db = require("../../config/database");
const { cekTutupPeriode } = require("../tutupBukuService");

// ── Kolom ste_tipe ───────────────────────────────────────────────────
// Delphi 6.0.38 menulis ke ste_tipe, tapi DB cabang yang ada belum punya
// kolom itu (dicek langsung: krm2 & krm3 hanya 13 kolom hdr,
// tanpa ste_tipe). Daripada hard-fail di setiap query, kolom di-probe sekali
// per database lalu di-cache. Kalau tidak ada, semua dokumen dianggap FP
// (nilai default ComboBox Delphi) dan kolom tidak ikut ditulis.
// Jalankan sql/ste_tipe_column.sql untuk mengaktifkan tipenya.
const tipeCache = new Map();

const tipeTersedia = async () => {
  const dbase = db.getCurrentDatabase();
  if (tipeCache.has(dbase)) return tipeCache.get(dbase);
  const [[r]] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'tserahterimaekspedisi_hdr'
        AND column_name = 'ste_tipe'`
  );
  const ok = Number(r.n) > 0;
  tipeCache.set(dbase, ok);
  return ok;
};

// Ekspresi SELECT untuk ste_tipe sesuai ketersediaan kolom.
const selTipe = (ada, alias) =>
  ada ? `IFNULL(ste_tipe, 'FP') AS ${alias}` : `'FP' AS ${alias}`;

// ── Nomor: <cabang>-STE.<yymm>.NNNN ───────────────────────────────────
// Delphi getmaxkode memakai RIGHT(ste_nomor,3) (hanya 3 digit terakhir) lalu
// RightStr(...,4) — tidak konsisten dan rusak di angka >= 1000. Web memakai
// RIGHT(...,4) seperti modul ST/TE.
const getMaxNomor = async (tanggal, cabang) => {
  const d = new Date(tanggal);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `${cabang || "01"}-STE.${yy}${mm}.`;

  const [[row]] = await db.query(
    `SELECT IFNULL(MAX(CAST(RIGHT(ste_nomor, 4) AS UNSIGNED)), 0) AS max_val
       FROM tserahterimaekspedisi_hdr WHERE ste_nomor LIKE ?`,
    [`${prefix}%`]
  );
  return `${prefix}${String(10000 + Number(row.max_val) + 1).slice(-4).padStart(4, "0")}`;
};

// ── Ambang otorisasi (Delphi cekdata) ────────────────────────────────
// Baris tercentang dengan Nilai > 0 dan (Nilai2/Nilai)*100 < 10 wajib
// minta otorisasi. Nilai <= 0 dilewati (itu yang membuat mode MUTASI/DO
// lolos tanpa dialog, karena keduanya mengeset Nilai = 0).
const PERSEN_OTORISASI = 10;

const butuhOtorisasi = (nilai, nilai2) => {
  const n = Number(nilai || 0);
  if (n <= 0) return false;
  return (Number(nilai2 || 0) / n) * 100 < PERSEN_OTORISASI;
};

// ── Load (Delphi btnRefreshClick, tiga cabang sesuai cbTipe) ───────────
// Nomor DO / MUTASI disimpan di kolom yang sama dengan nomor FP
// (sted_fp_nomor) — dibuktikan oleh join cetakan STE2.fr3
// (sted_fp_nomor = mutcd_mutc_nomor).
//
// {{EXCLQ}} menyisipkan "WHERE sted_ste_nomor <> ?" di dalam subquery
// NOT IN. Tanpa itu, baris milik dokumen yang SEDANG diedit ikut tersaring
// dan centangnya hilang — rollback dokumen jadi mustahil. Delphi tidak
// experienced ini justru karena subquery-nya salah kolom (lihat GAP-STE-2).
const SQL_LOAD = {
  MUTASI: `SELECT a.mutc_nomor AS nomor,
                  a.mutc_tanggal AS tanggal,
                  'AM PERSADA' AS nama,
                  0 AS nilai,
                  0 AS nilai2
             FROM tmutcab_hdr a
            WHERE DATE(a.mutc_tanggal) BETWEEN ? AND ?
              AND a.mutc_cbg_Asal = ?
              AND a.mutc_nomor NOT IN (SELECT sted_fp_nomor FROM tserahterimaekspedisi_dtl{{EXCLQ}})
            ORDER BY a.mutc_nomor ASC`,

  // sla_nama = 'WAHID' dipakai apa adanya sesuai keputusan user.
  DO: `SELECT a.do_nomor AS nomor,
               a.do_tanggal AS tanggal,
               c.cus_nama AS nama,
               0 AS nilai,
               0 AS nilai2
          FROM tdo_hdr a
          INNER JOIN tso_hdr b ON b.so_nomor = a.do_so_nomor
          INNER JOIN tsalesmanaktif sla ON sla.sla_kode = b.so_sla_kode
          INNER JOIN tcustomer c ON c.cus_kode = a.do_cus_Kode
         WHERE a.do_tanggal BETWEEN ? AND ?
           AND sla.sla_nama = ?
           AND a.do_nomor NOT IN (SELECT sted_fp_nomor FROM tserahterimaekspedisi_dtl{{EXCLQ}})
         ORDER BY a.do_nomor ASC`,

  // HPO = SUM(mst_stok_out * mst_hargabeli) untuk mst_noreferensi = fp_do_nomor.
  // Delphi menulisnya sebagai subquery korelasi per baris. Di MySQL itu
  // 292 detik untuk 229 baris: mst_noreferensi adalah kolom ke-4 dari PK
  // komposit tmasterstok, jadi tidak bisa dipakai sebagai prefix index dan
  // tiap baris memicu full table scan. Pre-aggregate sekali lalu LEFT JOIN
  // menghasilkan angka yang sama dalam 344 ms.
  FP: `WITH hpo AS (
         SELECT mst_noreferensi, SUM(mst_stok_out * mst_hargabeli) AS hpo
           FROM tmasterstok
          WHERE mst_noreferensi IS NOT NULL
          GROUP BY mst_noreferensi
       ),
       base_calc AS (
         SELECT a.fp_nomor,
                a.fp_tanggal,
                b.cus_nama,
                (a.fp_amount - a.fp_taxamount
                  - ((a.fp_biayapr * (a.fp_amount - a.fp_taxamount) / 100) + a.fp_biayarp)
                  - ((a.fp_biayapr2 * (a.fp_amount - a.fp_taxamount) / 100) + a.fp_biayarp2)
                  - a.fp_cn) AS net_amount,
                a.fp_do_nomor
           FROM tfp_hdr a
           INNER JOIN tcustomer b ON b.cus_kode = a.fp_cus_kode
          WHERE a.fp_tanggal BETWEEN ? AND ?
            AND a.fp_nomor NOT IN (SELECT sted_fp_nomor FROM tserahterimaekspedisi_dtl{{EXCLQ}})
       )
       SELECT bc.fp_nomor AS nomor,
              bc.fp_tanggal AS tanggal,
              bc.cus_nama AS nama,
              bc.net_amount AS nilai,
              (bc.net_amount - IFNULL(h.hpo, 0)) AS nilai2
         FROM base_calc bc
         LEFT JOIN hpo h ON h.mst_noreferensi = bc.fp_do_nomor
        ORDER BY bc.fp_nomor ASC`,
};

const TIPE_VALID = ["FP", "DO", "MUTASI"];

// excludeSte = nomor STE yang sedang diedit; barisnya harus tetap terlihat
// supaya centang, berat, kubikasi, dan biaya tidak hilang.
const load = async (startDate, endDate, tipe = "FP", cabangKode = "", excludeSte = "") => {
  const sql = SQL_LOAD[tipe] || SQL_LOAD.FP;
  const exclQ = excludeSte ? " WHERE sted_ste_nomor <> ?" : "";

  const params =
    tipe === "MUTASI"
      ? [startDate, endDate, cabangKode]
      : tipe === "DO"
        ? [startDate, endDate, "WAHID"]
        : [startDate, endDate];
  if (excludeSte) params.push(excludeSte);

  const [rows] = await db.query(sql.replace("{{EXCLQ}}", exclQ), params);
  return rows.map((r) => ({
    check: 0,
    nomor: r.nomor,
    nama: r.nama || "",
    tanggal:
      r.tanggal instanceof Date
        ? r.tanggal.toISOString().slice(0, 10)
        : String(r.tanggal || "").slice(0, 10),
    nilai: Number(r.nilai || 0),
    nilai2: Number(r.nilai2 || 0),
    berat: 0,
    kubikasi: 0,
    biaya: 0,
    otorisasi: 0,
  }));
};

// ── Load form edit (Delphi loaddataall) ────────────────────────────────
// Delphi memanggil btnRefreshClick lalu menandai check/berat/kubikasi.
// Sted_biaya TIDAK dipulihkan di Delphi sehingga edit+save menghapus
// semua ongkos — web memulihkannya.
const getDetailForm = async (nomor, user) => {
  const adaTipe = await tipeTersedia();
  const [[h]] = await db.query(
    `SELECT ste_nomor AS nomor,
            DATE_FORMAT(ste_tanggal, '%Y-%m-%d') AS tanggal,
            DATE_FORMAT(ste_tanggal1, '%Y-%m-%d') AS tanggal1,
            DATE_FORMAT(ste_tanggal2, '%Y-%m-%d') AS tanggal2,
            IFNULL(ste_namaekspedisi, '') AS namaEkspedisi,
            IFNULL(ste_keterangan, '') AS keterangan,
            ${selTipe(adaTipe, "tipe")},
            ste_realisasi AS realisasi
       FROM tserahterimaekspedisi_hdr WHERE ste_nomor = ? LIMIT 1`,
    [nomor]
  );
  if (!h) throw new Error("Data tidak ditemukan.");

  const detail = await load(
    h.tanggal1,
    h.tanggal2,
    h.tipe,
    user?.cabang || "",
    nomor
  );
  const [saved] = await db.query(
    `SELECT sted_fp_nomor, sted_berat, sted_kubikasi, sted_biaya
       FROM tserahterimaekspedisi_dtl WHERE sted_ste_nomor = ?`,
    [nomor]
  );
  for (const s of saved) {
    const row = detail.find((d) => d.nomor === s.sted_fp_nomor);
    if (!row) continue;
    row.check = 1;
    row.berat = Number(s.sted_berat || 0);
    row.kubikasi = Number(s.sted_kubikasi || 0);
    row.biaya = Number(s.sted_biaya || 0);
  }

  return { ...h, detail };
};

// ── Simpan (transaksional) ────────────────────────────────────────────
const saveData = async (payload, user) => {
  const {
    isEdit, nomor, tanggal, tanggal1, tanggal2,
    namaEkspedisi, keterangan, tipe, detail,
  } = payload;
  const rows = Array.isArray(detail) ? detail : [];

  if (!namaEkspedisi || !String(namaEkspedisi).trim())
    throw new Error("Nama ekspedisi wajib diisi.");
  if (await cekTutupPeriode(tanggal))
    throw new Error("Periode ini sudah di tutup.");

  const tipeFix = TIPE_VALID.includes(tipe) ? tipe : "FP";
  const kodeUser = user?.kode || "";
  const adaTipe = await tipeTersedia();

  const conn = await db.getConnection();
  await conn.beginTransaction();
  let nomorBaru = null;
  try {
    let actualNomor = nomor;
    // ste_serah = user login, ste_terima selalu 'EKSPEDISI' (paritas Delphi).
    const tipeParams = adaTipe ? [tipeFix] : [];
    const tipeCol = adaTipe ? ", ste_tipe" : "";
    const tipeVal = adaTipe ? ", ?" : "";

    if (isEdit) {
      await conn.query(
        `UPDATE tserahterimaekspedisi_hdr
            SET ste_tanggal = ?, ste_tanggal1 = ?, ste_tanggal2 = ?,
                ste_serah = ?, ste_terima = 'EKSPEDISI',
                ste_namaekspedisi = ?, ste_keterangan = ?${adaTipe ? ", ste_tipe = ?" : ""},
                date_modify = NOW(), user_modify = ?
          WHERE ste_nomor = ?`,
        [tanggal, tanggal1, tanggal2, kodeUser, namaEkspedisi, keterangan, ...tipeParams, kodeUser, nomor]
      );
    } else {
      actualNomor = await getMaxNomor(tanggal, user?.cabang);
      nomorBaru = actualNomor;
      await conn.query(
        `INSERT INTO tserahterimaekspedisi_hdr
           (ste_nomor, ste_tanggal, ste_tanggal1, ste_tanggal2, ste_serah,
            ste_terima, ste_namaekspedisi, ste_keterangan${tipeCol},
            date_create, user_create)
         VALUES (?, ?, ?, ?, ?, 'EKSPEDISI', ?, ?${tipeVal}, NOW(), ?)`,
        [actualNomor, tanggal, tanggal1, tanggal2, kodeUser, namaEkspedisi, keterangan, ...tipeParams, kodeUser]
      );
    }

    await conn.query(
      `DELETE FROM tserahterimaekspedisi_dtl WHERE sted_ste_nomor = ?`,
      [actualNomor]
    );

    const kodes = [];
    for (const d of rows) {
      if (Number(d.check) !== 1 || !d.nomor) continue;
      if (d.otorisasiKode) kodes.push(d.otorisasiKode);
      await conn.query(
        `INSERT INTO tserahterimaekspedisi_dtl
           (sted_ste_nomor, sted_fp_nomor, sted_nilai, sted_biaya,
            sted_cus_nama, sted_tanggal, sted_berat, sted_kubikasi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualNomor, d.nomor, d.nilai || 0, d.biaya || 0,
          d.nama || "", d.tanggal || null, d.berat || 0, d.kubikasi || 0,
        ]
      );
    }

    await conn.commit();

    // Link audit: tandai baris totorisasi yang terpakai → dokumen STE final.
    // Tabel totorisasi GLOBAL di database pusat (DB_NAME).
    if (kodes.length) {
      try {
        await db.systemPool.query(
          `UPDATE totorisasi SET ref_nomor = ? WHERE kode IN (?)`,
          [actualNomor, kodes]
        );
      } catch {
        // link audit gagal tidak boleh membatalkan simpan dokumen
      }
    }

    return { nomor: actualNomor };
  } catch (e) {
    await conn.rollback();
    // ponytail: hdr MyISAM (dtl InnoDB) — rollback tidak menyentuh header, jadi
    // dokumen baru bisa tertinggal tanpa detail. Bersihkan eksplisit.
    // Bersihkan juga dtl InnoDB yang mungkin sudah ter-insert sebagian.
    if (!isEdit && nomorBaru) {
      try {
        await conn.query(
          `DELETE FROM tserahterimaekspedisi_dtl WHERE sted_ste_nomor = ?`,
          [nomorBaru]
        );
        await conn.query(
          `DELETE FROM tserahterimaekspedisi_hdr WHERE ste_nomor = ?`,
          [nomorBaru]
        );
      } catch {
        // tidak ada yang bisa dilakukan lagi; error asli yang dilaporkan
      }
    }
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMaxNomor,
  load,
  getDetailForm,
  saveData,
  butuhOtorisasi,
  tipeTersedia,
  selTipe,
  PERSEN_OTORISASI,
  TIPE_VALID,
};

// Self-check offline untuk ambang otorisasi — dijalankan langsung:
//   node src/services/persediaan/serahTerimaEkspedisiFormService.js
if (require.main === module) {
  const assert = require("assert");
  assert.strictEqual(butuhOtorisasi(0, 0), false, "nilai 0 dilewati (MUTASI/DO)");
  assert.strictEqual(butuhOtorisasi(100, 0), true, "nilai2 0 dari nilai 100 = 0%");
  assert.strictEqual(butuhOtorisasi(100, 9.9), true, "9.9% < 10% wajib");
  assert.strictEqual(butuhOtorisasi(100, 10), false, "tepat 10% tidak wajib");
  assert.strictEqual(butuhOtorisasi(100, 10.1), false, "di atas 10% tidak wajib");
  assert.strictEqual(butuhOtorisasi(1000, 50), true, "5% dari 1000 wajib");
  assert.strictEqual(butuhOtorisasi(1000, 200), false, "20% dari 1000 tidak wajib");
  console.log("serahTerimaEkspedisiFormService: 7 assert PASS");
  process.exit(0);
}
