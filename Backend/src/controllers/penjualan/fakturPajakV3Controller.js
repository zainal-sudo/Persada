// controllers/penjualan/fakturPajakV3Controller.js
const svc = require("../../services/penjualan/fakturPajakV3Service");

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

const exportExcel = async (req, res) => {
  try {
    const { startDate, endDate, isManual, referensi } = req.body;
    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    // referensi = array nomor FP dari baris yang tersisa di frontend
    const referensiList = Array.isArray(referensi)
      ? referensi.map((s) => String(s).trim()).filter(Boolean)
      : null;
    const buffer = await svc.exportExcel(startDate, endDate, Number(isManual) || 0, referensiList);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=FakturPajak_${startDate}_sd_${endDate}.xlsx`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { refresh, exportExcel };