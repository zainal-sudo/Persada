// controllers/penjualan/returPenjualanFormController.js
const svc = require("../../services/penjualan/returPenjualanFormService");

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

const searchFP = async (req, res) => {
  try {
    const data = await svc.searchFP(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getFP = async (req, res) => {
  try {
    const excludeNomor = req.query.excludeNomor || "";
    const data = await svc.getFP(req.params.nomor, excludeNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const searchBarang = async (req, res) => {
  try {
    const { nomorFaktur, search } = req.query;
    if (!nomorFaktur) return res.status(400).json({ success: false, message: "nomorFaktur wajib." });
    const data = await svc.searchBarang(nomorFaktur, search || "");
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

const getSisaPiutang = async (req, res) => {
  try {
    const data = await svc.getSisaPiutang(req.params.nomorFaktur);
    res.json({ success: true, data: { sisaPiutang: data } });
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
    res.json({ success: true, data, message: "Retur penjualan berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getCNFaktur = async (req, res) => {
  try {
    const { cusKode, tanggal } = req.query;
    if (!cusKode || !tanggal)
      return res.status(400).json({ success: false, message: "cusKode dan tanggal wajib." });
    const data = await svc.getCNFaktur(cusKode, tanggal);
    res.json({ success: true, data: { cnPotongInvoice: data } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getNomor, searchFP, getFP, searchBarang, getGudang, getSisaPiutang, getDetailForm, saveData, getCNFaktur };