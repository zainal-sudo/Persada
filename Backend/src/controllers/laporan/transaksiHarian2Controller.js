// controllers/laporan/transaksiHarian2Controller.js
const svc = require("../../services/laporan/transaksiHarian2Service");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate, customer } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }

    const data = await svc.getBrowse({ startDate, endDate, customer });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };