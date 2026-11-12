// controllers/laporan/lapBulanan5Controller.js
const svc = require("../../services/laporan/lapBulanan5Service");

const getBrowse = async (req, res) => {
  try {
    const { bulan, tahun, onlySalesman } = req.query;

    const bln = Number(bulan);
    const thn = Number(tahun);

    if (!bln || bln < 1 || bln > 12 || !thn) {
      return res.status(400).json({ success: false, message: "bulan (1-12) dan tahun wajib." });
    }

    const data = await svc.getBrowse({
      bulan: bln,
      tahun: thn,
      onlySalesman: onlySalesman === "0" ? 0 : 1,
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };