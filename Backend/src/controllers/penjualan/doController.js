// controllers/penjualan/doController.js
const svc = require("../../services/penjualan/doService");

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

const deleteData = async (req, res) => {
  try {
    await svc.deleteData(req.params.nomor);
    res.json({ success: true, message: "DO berhasil dihapus." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getPrintData = async (req, res) => {
  try {
    const data = await svc.getPrintData(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getBarisSlip = async (req, res) => {
  try {
    const nama = req.params.nama || 'DO';
    const baris = await svc.getBarisSlip(nama);
    res.json({ success: true, data: { baris } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const toggleKembali = async (req, res) => {
  try {
    const data = await svc.toggleKembali(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data, message: "Update Status Berhasil" });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip, toggleKembali };