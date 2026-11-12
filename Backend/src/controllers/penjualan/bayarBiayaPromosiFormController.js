// controllers/penjualan/bayarBiayaPromosiFormController.js
const svc = require("../../services/penjualan/bayarBiayaPromosiFormService");

const getNomor = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) return res.status(400).json({ success: false, message: "Tanggal wajib." });
    const cabang = req.user?.cabang || "01";
    const nomor = await svc.getMaxNomor(tanggal, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getCustomer = async (req, res) => {
  try {
    const data = await svc.getCustomer(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getRekening = async (req, res) => {
  try {
    const data = await svc.getRekening();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { cusKode } = req.query;
    if (!cusKode) return res.status(400).json({ success: false, message: "cusKode wajib." });
    const data = await svc.getInvoice(cusKode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Pembayaran biaya promosi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getNomor, getCustomer, getRekening, getInvoice, getDetailForm, saveData };