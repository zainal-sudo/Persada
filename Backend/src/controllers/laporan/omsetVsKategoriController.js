// controllers/laporan/omsetVsKategoriController.js
const svc = require("../../services/laporan/omsetVsKategoriService");

const getKategori = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getKategori() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate, kategori1, kategori2, kategori3 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }

    const data = await svc.getBrowse({ startDate, endDate, kategori1, kategori2, kategori3 });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getKategori, getBrowse };
