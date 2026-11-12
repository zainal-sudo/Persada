// controllers/laporan/lapNeracaController.js
const svc = require("../../services/laporan/lapNeracaService");

const getBrowse = async (req, res) => {
  try {
    const bulan = Number(req.query.bulan);
    const tahun = Number(req.query.tahun);

    if (!bulan || bulan < 1 || bulan > 12 || !tahun) {
      return res.status(400).json({ success: false, message: "bulan (1-12) dan tahun wajib." });
    }

    const data = await svc.getBrowse({ bulan, tahun });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };
