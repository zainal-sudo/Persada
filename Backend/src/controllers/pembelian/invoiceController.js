// controllers/pembelian/invoiceController.js
const svc = require("../../services/pembelian/invoiceService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
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
    res.json({ success: true, message: "Invoice berhasil dihapus." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const togglePajak = async (req, res) => {
  try {
    const result = await svc.togglePajak(req.params.nomor);
    res.json({
      success: true,
      data: result,
      message: result.pajak ? "Invoice di-set PPN." : "Invoice di-set Non PPN.",
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const setNoPajak = async (req, res) => {
  try {
    const { nomor } = req.params;
    const { nopajak } = req.body;
    if (nopajak === undefined)
      return res.status(400).json({ success: false, message: "nopajak wajib." });
    const result = await svc.setNoPajak(nomor, nopajak);
    res.json({ success: true, data: result, message: "No Pajak berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getHistoryPembayaran = async (req, res) => {
  try {
    const data = await svc.getHistoryPembayaran(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
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
    const baris = await svc.getBarisSlip("INV");
    res.json({ success: true, data: { baris } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
  getBrowse,
  getBrowseDetail,
  deleteData,
  togglePajak,
  setNoPajak,
  getHistoryPembayaran,
  getPrintData,
  getBarisSlip,
};
