// controllers/laporan/estimasiSalesController.js
const svc = require("../../services/laporan/estimasiSalesService");

const getBrowse = async (req, res) => {
  try {
    const { bulan, tahun } = req.query;

    if (!bulan || !tahun) {
      return res.status(400).json({ success: false, message: "bulan dan tahun wajib." });
    }

    const data = await svc.getBrowse({ bulan, tahun });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };
