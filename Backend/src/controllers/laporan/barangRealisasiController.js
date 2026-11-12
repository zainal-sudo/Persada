// controllers/laporan/barangRealisasiController.js
const svc = require("../../services/laporan/barangRealisasiService");

const getBrowse = async (_req, res) => {
  try {
    const data = await svc.getBrowse();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetail = async (req, res) => {
  try {
    const { kode } = req.query;

    if (!kode) {
      return res.status(400).json({ success: false, message: "kode wajib." });
    }

    const data = await svc.getDetail({ kode });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getDetail };