// controllers/komisi/komisiSalesmanController.js
const svc = require("../../services/komisi/komisiSalesmanService");

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
