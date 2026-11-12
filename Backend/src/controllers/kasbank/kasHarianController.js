const svc = require("../../services/kasbank/kasHarianService");

// GET /kasbank/kas-harian/rekening
const getRekening = async (req, res) => {
  try {
    const data = await svc.getRekening();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /kasbank/kas-harian?rekkode&tanggal
const getKasHarian = async (req, res) => {
  try {
    const { rekkode, tanggal } = req.query;
    if (!rekkode || !tanggal) {
      return res.status(400).json({ success: false, message: "rekkode dan tanggal wajib." });
    }
    const data = await svc.getKasHarian(rekkode, tanggal);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getRekening, getKasHarian };