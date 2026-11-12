// controllers/penjualan/fakturPajakFormController.js
const svc = require("../../services/penjualan/fakturPajakFormService");

const refresh = async (req, res) => {
  try {
    const { startDate, endDate, isManual } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    const data = await svc.refresh(startDate, endDate, Number(isManual) || 0);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Faktur pajak berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { refresh, saveData };