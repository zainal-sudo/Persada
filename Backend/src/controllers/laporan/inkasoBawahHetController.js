// controllers/laporan/inkasoBawahHetController.js
const svc = require("../../services/laporan/inkasoBawahHetService");

const getBrowse = async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    if (!bulan || !tahun) {
      return res.status(400).json({ success: false, message: "bulan dan tahun wajib." });
    }
    res.json({ success: true, data: await svc.getBrowse({ bulan, tahun }) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetail = async (req, res) => {
  try {
    const { noreferensi } = req.query;
    if (!noreferensi) {
      return res.status(400).json({ success: false, message: "noreferensi wajib." });
    }
    res.json({ success: true, data: await svc.getDetail(noreferensi) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getDetail };
