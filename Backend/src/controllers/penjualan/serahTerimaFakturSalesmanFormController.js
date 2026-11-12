// controllers/penjualan/serahTerimaFakturSalesmanFormController.js
const svc = require("../../services/penjualan/serahTerimaFakturSalesmanFormService");

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

const getSalesman = async (req, res) => {
  try {
    const data = await svc.getSalesman();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { slsKode } = req.query;
    if (!slsKode) return res.status(400).json({ success: false, message: "slsKode wajib." });
    const data = await svc.getInvoice(slsKode);
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
    res.json({ success: true, data, message: "Serah terima faktur berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getNomor, getSalesman, getInvoice, getDetailForm, saveData };