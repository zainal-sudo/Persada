// controllers/pembelian/returBeliFormController.js
const svc = require("../../services/pembelian/returBeliFormService");

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax } = req.query;
    if (!tanggal) return res.status(400).json({ success: false, message: "Tanggal wajib." });
    const cabang = req.user?.cabang || "01";
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 1, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchInvoice = async (req, res) => {
  try {
    const data = await svc.searchInvoice(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const data = await svc.getInvoice(req.params.nomor, req.query.rfid || 0);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const searchBarang = async (req, res) => {
  try {
    const { nomorInvoice, gdgKode, search } = req.query;
    if (!nomorInvoice)
      return res.status(400).json({ success: false, message: "nomorInvoice wajib." });
    if (!gdgKode)
      return res.status(400).json({ success: false, message: "Gudang belum di pilih." });
    const data = await svc.searchBarang(nomorInvoice, gdgKode, search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getGudang = async (req, res) => {
  try {
    const data = await svc.getGudang();
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
    res.json({ success: true, data, message: "Retur Beli berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getNomor, searchInvoice, getInvoice, searchBarang, getGudang, getDetailForm, saveData };
