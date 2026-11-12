const svc = require("../../services/persediaan/mutasiGudangService");

// GET /persediaan/mutasi-gudang?startDate&endDate
const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }
    const data = await svc.getBrowse(startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/mutasi-gudang/detail/:nomor
const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PUT /persediaan/mutasi-gudang/realisasi/:nomor
const toggleRealisasi = async (req, res) => {
  try {
    const data = await svc.toggleRealisasi(req.params.nomor);
    res.json({ success: true, data, message: data.realisasi ? "Mutasi direalisasi." : "Realisasi mutasi dibatalkan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, toggleRealisasi };