// controllers/penjualan/fakturManualFormController.js
const svc = require("../../services/penjualan/fakturManualFormService");

const searchSO = async (req, res) => {
  try {
    const data = await svc.searchSO(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const loadSO = async (req, res) => {
  try {
    const data = await svc.loadSO(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const searchBarang = async (req, res) => {
  try {
    const data = await svc.searchBarang(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTop = async (req, res) => {
  try {
    const { cusKode } = req.query;
    if (!cusKode) return res.status(400).json({ success: false, message: "cusKode wajib." });
    const top = await svc.getTop(cusKode);
    res.json({ success: true, data: { top } });
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
    res.json({ success: true, data, message: "Faktur manual berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getHargaHistori = async (req, res) => {
  try {
    const { brgKode, cusKode, nomorFP } = req.query;
    if (!brgKode || !cusKode)
      return res.status(400).json({ success: false, message: "brgKode dan cusKode wajib." });
    const data = await svc.getHargaHistori(brgKode, cusKode, nomorFP || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { searchSO, loadSO, searchBarang, getTop, getDetailForm, saveData, getHargaHistori };