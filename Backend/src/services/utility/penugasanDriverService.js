// services/utility/penugasanDriverService.js
// Migrasi dari Delphi ufrmPenugasanDriver.pas
// (menu Utility -> "Penugasan Driver", MAIN.pas PenugasanDriver1Click).
//
// Modul BULK UPDATE: tampilkan DO yang belum diproses (tanpa POD dan tanpa
// retur) pada periode terpilih -> centang -> tetapkan driver baru ->
// UPDATE tdo_hdr.do_driver (+ date_modified/user_modified).
//
// Catatan migrasi:
// - Query DO (Delphi Button1Click) verbatim; filter opsional:
//   do_driver (Delphi edtKode) dan do_cus_kode (edtkodecustomer).
//   TANPA filter driver = SEMUA DO apa pun drivernya — perilaku Delphi.
// - Lookup driver (edtKodeClickBtn / edtKode2ClickBtn) verbatim: karyawan
//   jabat 21/30 aktif via hrd.tunit/hrd.tkaryawan + UNION 'SALES'/'EKSPEDISI'
//   (pola sama dengan getDriver di doFormService).
// - Delphi cekdata() KOSONG (semua validasi dikomentari) — simpan dengan
//   driver kosong akan menulis do_driver=''. Web mewajibkan driver dan
//   minimal 1 baris tercentang (keputusan gap doc §5.1).
// - Delphi UPDATE per-baris tanpa transaksi; web membungkus transaksi.
// - Delphi TANPA cek hak di form ini; web menagih hak edit (arsitektur
//   otorisasi menu web) — keputusan gap doc §5.2.
const db = require("../../config/database");

// ── Lookup driver (Delphi: edtKodeClickBtn & edtKode2ClickBtn, verbatim) ──
const getDriver = async () => {
  const [rows] = await db.query(
    `SELECT kar_namasingkat AS kode, UPPER(kar_nama) AS nama
       FROM hrd.tunit
       INNER JOIN hrd.tkaryawan ON kar_kd_unit = kd_unit
      WHERE LOWER(kode_cabang) = LOWER(?)
        AND (kar_kd_jabat = 21 OR kar_kd_jabat = 30)
        AND kar_status_aktif = 1
      UNION ALL SELECT 'SALES', 'SALES'
      UNION ALL SELECT 'EKSPEDISI', 'EKSPEDISI'`,
    [db.getCurrentDatabase()]
  );
  return rows;
};

// ── Lookup customer (Delphi: edtkodecustomerClickBtn -> frmbantuan) ──
// Kolom Alamat/jenis hanya display bantuan Delphi; picker web kode+nama.
const getCustomers = async () => {
  const [rows] = await db.query(
    `SELECT cus_kode AS kode, cus_nama AS nama
       FROM tcustomer
      ORDER BY cus_kode`
  );
  return rows;
};

// ── Daftar DO belum diproses (Delphi: Button1Click, SQL verbatim) ────
// DO dianggap "belum diproses" bila: belum ada POD (tpod_hdr) DAN tidak
// pernah diretur (tfp_hdr+tretj_hdr). Faktur diambil via LEFT JOIN
// (DO tanpa faktur tetap tampil, kolom faktur kosong).
const getDoList = async ({ startDate, endDate, driver, customer }) => {
  if (!startDate || !endDate) throw new Error("Periode harus di isi.");

  let sfilter = "";
  const params = [];
  if (driver) {
    sfilter += " AND a.do_driver = ? ";
    params.push(String(driver));
  }
  if (customer) {
    sfilter += " AND a.do_cus_kode = ? ";
    params.push(String(customer));
  }

  const [rows] = await db.query(
    `SELECT a.do_nomor AS nomor,
            fp.fp_nomor AS faktur,
            a.do_tanggal AS tanggal,
            c.cus_nama AS customer,
            c.cus_alamat AS alamat,
            c.cus_kode AS cusKode,
            a.do_driver AS driver
       FROM tdo_hdr a
       INNER JOIN tcustomer c ON a.do_cus_kode = c.cus_kode
       LEFT JOIN tfp_hdr fp ON a.do_nomor = fp.fp_do_nomor
      WHERE NOT EXISTS (
              SELECT 1 FROM tpod_hdr b WHERE b.pod_do_nomor = a.do_nomor
            )
        AND NOT EXISTS (
              SELECT 1
                FROM tfp_hdr f
                INNER JOIN tretj_hdr t ON t.retj_fp_nomor = f.fp_nomor
               WHERE f.fp_do_nomor = a.do_nomor
            )
        AND a.do_tanggal BETWEEN ? AND ?
        ${sfilter}
      ORDER BY a.do_tanggal, a.do_nomor`,
    [...params, startDate, endDate]
  );
  return rows;
};

// ── Simpan penugasan (Delphi: cxButton1Click — UPDATE per baris tercentang)
// Payload: { driver, user?, rows: [{ nomor }] }
// Verbatim Delphi: UPDATE tdo_hdr SET do_driver=.., date_modified=..,
// user_modified=.. WHERE do_nomor=..
const assignDriver = async (payload, user) => {
  const driver = String(payload.driver || "").trim();
  if (!driver) throw new Error("Driver baru harus di pilih.");

  const rowsInput = Array.isArray(payload.rows) ? payload.rows : [];
  const nomorList = [
    ...new Set(
      rowsInput
        .map((r) => String(r?.nomor || "").trim())
        .filter((n) => n !== "")
    ),
  ];
  if (!nomorList.length) throw new Error("Pilih minimal satu DO (centang baris).");

  const kodeUser = String(payload.user || user?.kode || "").trim();

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    let jmlUpdate = 0;
    for (const nomor of nomorList) {
      const [hasil] = await conn.query(
        `UPDATE tdo_hdr
            SET do_driver = ?, date_modified = NOW(), user_modified = ?
          WHERE do_nomor = ?`,
        [driver, kodeUser, nomor]
      );
      jmlUpdate += hasil.affectedRows || 0;
    }
    await conn.commit();
    return { jmlUpdate, driver, user: kodeUser };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getDriver, getCustomers, getDoList, assignDriver };
