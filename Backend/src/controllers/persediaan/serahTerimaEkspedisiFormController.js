const svc = require("../../services/persediaan/serahTerimaEkspedisiFormService");

// GET /persediaan/serah-terima-ekspedisi/form/get-max-nomor
const getMaxNomor = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) {
      return res.status(400).json({ success: false, message: "tanggal wajib." });
    }
    const nomor = await svc.getMaxNomor(tanggal, req.user?.cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/serah-terima-ekspedisi/form/load?startDate&endDate&tipe&excludeSte=
// excludeSte = nomor STE yang sedang diedit, supaya barisnya tidak ikut
// tersaring oleh subquery NOT IN.
const load = async (req, res) => {
  try {
    const { startDate, endDate, tipe, excludeSte } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }
    const data = await svc.load(
      startDate, endDate, tipe || "FP", req.user?.cabang || "", excludeSte || ""
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/serah-terima-ekspedisi/form/:nomor
const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(decodeURIComponent(req.params.nomor), req.user);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

// POST /persediaan/serah-terima-ekspedisi/form/save
const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Serah terima ekspedisi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getMaxNomor, load, getDetailForm, saveData };
