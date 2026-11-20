const db = require("../../config/database");

const valPeriod = (bulan, tahun) => {
  const m = Number(bulan);
  const t = Number(tahun);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Bulan tidak valid.");
  if (!Number.isInteger(t) || t < 2000 || t > 2100) throw new Error("Tahun tidak valid.");
  return { m, t };
};

const amanError = (e) => {
  if (e.code === "ER_SP_DOES_NOT_EXIST" || /does not exist/i.test(e.message || "")) {
    throw new Error("Prosedur jurnal bulanan belum terpasang. Jalankan Backend/sql/jurnal_bulanan.sql.");
  }
  throw e;
};

const firstResultSet = (rows) =>
  Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;

const normRows = (rows) =>
  (rows || []).map((r) => ({
    jenis: r.jenis,
    nomor: r.nomor,
    tanggal: r.tanggal
      ? typeof r.tanggal === "string"
        ? r.tanggal.slice(0, 10)
        : `${r.tanggal.getFullYear()}-${String(r.tanggal.getMonth() + 1).padStart(2, "0")}-${String(r.tanggal.getDate()).padStart(2, "0")}`
      : null,
    keterangan: r.keterangan,
    totalDebet: Number(r.total_debet) || 0,
    totalKredit: Number(r.total_kredit) || 0,
    bisaDiposting: Number(r.bisa_diposting) === 1,
    alasan: r.alasan || "",
  }));

const pratinjau = async (query) => {
  const { m, t } = valPeriod(query.bulan, query.tahun);

  let rows;
  try {
    const [result] = await db.query("CALL preview_jurnal_bulanan(?, ?)", [m, t]);
    rows = firstResultSet(result);
  } catch (e) {
    amanError(e);
  }

  const data = normRows(rows);
  const bisaDiposting = data.length > 0 && data.every((r) => r.bisaDiposting);

  return {
    bulan: m,
    tahun: t,
    rows: data,
    bisaDiposting,
    alasan: data[0]?.alasan || "",
    totalDebet: data.reduce((a, r) => a + r.totalDebet, 0),
    totalKredit: data.reduce((a, r) => a + r.totalKredit, 0),
  };
};

const proses = async (payload, user) => {
  const { m, t } = valPeriod(payload.bulan, payload.tahun);
  const preview = await pratinjau({ bulan: m, tahun: t });

  if (!preview.bisaDiposting) {
    throw new Error(preview.alasan || "Periode tidak memenuhi syarat posting.");
  }

  try {
    await db.query("CALL jurnal_bulanan(?, ?)", [m, t]);
  } catch (e) {
    amanError(e);
  }

  return {
    bulan: m,
    tahun: t,
    jumlahJurnal: preview.rows.length,
    totalDebet: preview.totalDebet,
    totalKredit: preview.totalKredit,
    user: user?.kode || "",
  };
};

module.exports = { pratinjau, proses };
