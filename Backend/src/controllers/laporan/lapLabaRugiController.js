// controllers/laporan/lapLabaRugiController.js
const svc = require("../../services/laporan/lapLabaRugiService");

const getBrowse = async (req, res) => {
  try {
    const tahun = Number(req.query.tahun);
    const bulan1 = Number(req.query.bulan1);
    const bulan2 = Number(req.query.bulan2);

    const valid = (b) => b >= 1 && b <= 12;
    if (!tahun || !valid(bulan1) || !valid(bulan2)) {
      return res.status(400).json({ success: false, message: "tahun dan bulan1/bulan2 (1-12) wajib." });
    }

    const data = await svc.getBrowse({ tahun, bulan1, bulan2 });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };
