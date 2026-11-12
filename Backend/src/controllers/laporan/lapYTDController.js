// controllers/laporan/lapYTDController.js
const svc = require("../../services/laporan/lapYTDService");

const getBrowse = async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const bln = Number(bulan);
    const thn = Number(tahun);

    if (!bln || bln < 1 || bln > 12 || !thn) {
      return res.status(400).json({ success: false, message: "bulan (1-12) dan tahun wajib." });
    }

    const data = await svc.getBrowse({ bulan: bln, tahun: thn });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };