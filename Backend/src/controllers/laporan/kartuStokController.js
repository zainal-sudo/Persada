// controllers/laporan/kartuStokController.js
const svc = require("../../services/laporan/kartuStokService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate, gudang } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }

    const data = await svc.getBrowse({ startDate, endDate, gudang: gudang || "" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetail = async (req, res) => {
  try {
    const { kode, startDate, endDate, gudang } = req.query;

    if (!kode || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "kode, startDate dan endDate wajib." });
    }

    const data = await svc.getDetail({ kode, startDate, endDate, gudang: gudang || "" });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getDetail };