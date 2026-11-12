// services/utility/settingJadwalSalesService.js
// Migrasi dari Delphi ufrmBrowseSetingJadwalSales.pas + ufrmSetingJadwalSales.pas
// (menu Utility -> "Setting Jadwal Sales", MAIN.pas SettinhJadwalSales1Click).
//
// Tabel: tjadwalsales (jd_sls_kode, jd_cus_kode, jd_namajadwal) — tanpa kolom
// id/tanggal di seluruh SQL Delphi; kombinasi (jd_sls_kode, jd_cus_kode)
// dipakai sebagai identitas baris.
//
// Delphi simpandata HANYA insert — edit memperbanyak baris (duplikat kalau
// dijalankan ulang) dan tidak pernah menghapus baris yang dicopot dari grid.
// Web: baris baru -> INSERT; baris lama -> UPDATE jd_namajadwal; baris lama
// yang hilang dari grid -> DELETE (keputusan §5.2-§5.4 di gap doc).
const db = require("../../config/database");

// ── Browse (Delphi: btnRefreshClick, SQL verbatim) ───────────────────
const getBrowse = async () => {
  const [rows] = await db.query(
    `SELECT jd_sls_kode, sls_nama salesman, jd_cus_kode, cus_nama customer, jd_namajadwal Nama
       FROM tjadwalsales
      INNER JOIN tsalesman ON sls_kode = jd_sls_kode
      INNER JOIN tcustomer ON cus_kode = jd_cus_kode`
  );
  return rows;
};

// ── Load form utk 1 salesman (web-only; Delphi tidak memuat data lama) ──
// Tidak join tsalesman/tcustomer agar salesman/customer yang sudah terhapus
// dari master tetap tampil dan bisa dikelola.
const loadBySalesman = async (salesman) => {
  const kode = String(salesman || "").trim();
  if (!kode) throw new Error("Salesman belum di pilih.");
  const [rows] = await db.query(
    `SELECT jd_sls_kode AS slsKode, jd_cus_kode AS kode, jd_namajadwal AS nama
       FROM tjadwalsales
      WHERE jd_sls_kode = ?
      ORDER BY jd_cus_kode`,
    [kode]
  );
  return rows;
};

// ── Lookup salesman (Delphi: edtKodeClickBtn -> frmbantuan) ──────────
const getSalesman = async () => {
  const [rows] = await db.query(
    `SELECT sls_kode AS kode, sls_nama AS nama
       FROM tsalesman
      ORDER BY sls_kode`
  );
  return rows;
};

// ── Lookup customer (Delphi: clCustomerPropertiesButtonClick -> frmbantuan) ──
// Kolom Golongan/Piutang hanya untuk tampilan bantuan Delphi; picker web
// cukup kode+nama (keputusan gap doc).
const getCustomers = async () => {
  const [rows] = await db.query(
    `SELECT DISTINCT c.cus_kode AS kode, c.cus_nama AS nama
       FROM tcustomer c
       LEFT JOIN tjadwalsales j ON j.jd_cus_kode = c.cus_kode
      ORDER BY c.cus_kode`
  );
  return rows;
};

// ── simpandata (Delphi: simpandata) + delete-yang-hilang (web-only) ──
// Payload: { salesman, namaJadwal, isEdit, rows: [{ kode }] }
// Validasi: salesman & namaJadwal wajib (Delphi tidak memvalidasi — gap doc §5.1);
// duplikat customer dalam grid ditolak (paritas pesan Delphi).
const save = async (payload, user) => {
  const salesman = String(payload.salesman || "").trim();
  const namaJadwal = String(payload.namaJadwal || "").trim();
  if (!salesman) throw new Error("Salesman belum di pilih");
  if (!namaJadwal) throw new Error("Nama Jadwal belum di isi");

  const rowsInput = Array.isArray(payload.rows) ? payload.rows : [];
  const seen = new Set();
  const rows = [];
  for (const r of rowsInput) {
    const kode = String(r?.kode || "").trim();
    if (!kode) continue;
    const key = kode.toUpperCase();
    if (seen.has(key)) throw new Error("Customer ada yang sama dengan baris lain");
    seen.add(key);
    rows.push(kode);
  }

  const existingRows = await loadBySalesman(salesman);
  const existingByKode = new Map(
    existingRows.map((r) => [r.kode.toUpperCase(), r])
  );

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let jmlInsert = 0;
    let jmlUpdate = 0;
    const inserted = [];

    for (const kode of rows) {
      const lama = existingByKode.get(kode.toUpperCase());
      if (lama) {
        if (lama.nama !== namaJadwal) {
          await conn.query(
            `UPDATE tjadwalsales SET jd_namajadwal = ? WHERE jd_sls_kode = ? AND jd_cus_kode = ?`,
            [namaJadwal, salesman, lama.kode]
        );
          jmlUpdate++;
        }
      } else {
        await conn.query(
          `INSERT INTO tjadwalsales (jd_sls_kode, jd_cus_kode, jd_namajadwal) VALUES (?, ?, ?)`,
          [salesman, kode, namaJadwal]
        );
        jmlInsert++;
        inserted.push(kode);
      }
    }

    // Web-only: baris lama yang tidak ada di grid dihapus (Delphi tidak
    // menghapus — baris yatim menumpuk). Kode customer dibanding
    // case-sensitive terhadap data, konsisten dengan pembandingan lain.
    let jmlDelete = 0;
    const gridKeys = new Set(rows.map((k) => k.toUpperCase()));
    for (const lama of existingRows) {
      if (!gridKeys.has(lama.kode.toUpperCase())) {
        await conn.query(
          `DELETE FROM tjadwalsales WHERE jd_sls_kode = ? AND jd_cus_kode = ?`,
          [salesman, lama.kode]
        );
        jmlDelete++;
      }
    }

    await conn.commit();
    return {
      salesman,
      namaJadwal,
      jmlBaris: rows.length,
      jmlInsert,
      jmlUpdate,
      jmlDelete,
      user: user?.kode || "",
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ── Hapus semua jadwal 1 salesman (Delphi: tombol Hapus browse BUG —
// target tabel salah ke tCostCenter; web menyediakan hapus yang benar) ──
const hapusSalesman = async (salesman, user) => {
  const kode = String(salesman || "").trim();
  if (!kode) throw new Error("Salesman belum di pilih.");
  const [hasil] = await db.query(
    `DELETE FROM tjadwalsales WHERE jd_sls_kode = ?`,
    [kode]
  );
  return { salesman: kode, jmlHapus: hasil.affectedRows || 0, user: user?.kode || "" };
};

module.exports = {
  getBrowse,
  loadBySalesman,
  getSalesman,
  getCustomers,
  save,
  hapusSalesman,
};
