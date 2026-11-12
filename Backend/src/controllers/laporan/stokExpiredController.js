// controllers/laporan/stokExpiredController.js
const svc = require("../../services/laporan/stokExpiredService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, gudang } = req.query;

    if (!startDate) {
      return res.status(400).json({ success: false, message: "startDate wajib." });
    }

    const data = await svc.getBrowse({ startDate, gudang: gudang || "" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };