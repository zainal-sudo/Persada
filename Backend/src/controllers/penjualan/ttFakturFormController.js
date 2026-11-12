// controllers/penjualan/ttFakturFormController.js
const svc = require("../../services/penjualan/ttFakturFormService");

const getSalesman = async (req, res) => {
  try {
    const data = await svc.getSalesman();
    res.json({ success: true, data });
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

const getNomor = async (req, res) => {
  try {
    const { slsKode } = req.query;
    if (!slsKode) return res.status(400).json({ success: false, message: "slsKode wajib." });
    const nomor = await svc.getMaxNomor(slsKode);
    res.json({ success: true, data: { nomor } });
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
    res.json({ success: true, data, message: "TT Faktur berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getSalesman, getCustomer, getInvoice, getNomor, getDetailForm, saveData };