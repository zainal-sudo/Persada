// controllers/laporan/listHistoryStokController.js
const svc = require("../../services/laporan/listHistoryStokService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }

    const data = await svc.getBrowse({ startDate, endDate });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };