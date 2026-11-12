// controllers/penjualan/serahTerimaFakturController.js
const svc = require("../../services/penjualan/serahTerimaFakturService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res
        .status(400)
        .json({ success: false, message: "startDate dan endDate wajib." });
    const data = await svc.getBrowse(startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const realisasi = async (req, res) => {
  try {
    const data = await svc.realisasi(req.params.nomor, req.user);
    res.json({
      success: true,
      data,
      message: "Realisasi serah terima faktur berhasil.",
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getPrintData = async (req, res) => {
  try {
    const data = await svc.getPrintData(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, realisasi, getPrintData };
