const svc = require("../services/dashboardService");
const aiCfg = require("../config/ai");
const branches = require("../services/ai/branches");

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Query string adalah trust boundary: cek format, cek tanggal benar-benar ada
// (2026-02-31 lolos regex tapi tidak round-trip), dan jangan boleh di masa depan
// karena seluruh angka "s/d tanggal" jadi tidak bermakna.
const parseTanggal = (raw) => {
  if (!raw) return { ok: true, value: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return { ok: false, message: "Format tanggal harus YYYY-MM-DD." };
  const [y, m, d] = raw.split("-").map(Number);
  if (fmt(new Date(y, m - 1, d)) !== raw)
    return { ok: false, message: "Tanggal tidak ada di kalender." };
  if (raw > fmt(new Date()))
    return { ok: false, message: "Tanggal tidak boleh melewati hari ini." };
  return { ok: true, value: raw };
};

const getSummary = async (req, res) => {
  try {
    const user = req.user || {};
    // Pemilihan cabang hanya untuk login Pusat (00) + FINANCE/OWNER.
    // Selain itu dashboard terkunci pada cabang login (dbKey kosong).
    const canPick =
      String(user.cabang || "") === "00" && aiCfg.isBranchUser(user);
    const dbKey = canPick ? String(req.query.db || "") : "";

    const tanggal = parseTanggal(String(req.query.tanggal || "").trim());
    if (!tanggal.ok)
      return res.status(400).json({ success: false, message: tanggal.message });

    const data = await svc.getSummary(user, dbKey, tanggal.value);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Daftar cabang untuk dropdown â€” hanya Pusat + FINANCE/OWNER.
const listCabang = async (req, res) => {
  try {
    const user = req.user || {};
    const canPick =
      String(user.cabang || "") === "00" && aiCfg.isBranchUser(user);
    if (!canPick)
      return res
        .status(403)
        .json({ success: false, message: "Tidak berhak memilih cabang." });
    const list = await branches.listBranches();
    res.json({
      success: true,
      data: list.map((b) => ({
        kode: b.kode,
        nama: b.nama,
        dbase: b.dbase,
        reachable: b.reachable,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getSummary, listCabang, parseTanggal };
