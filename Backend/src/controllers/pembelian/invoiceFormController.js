// controllers/pembelian/invoiceFormController.js
const svc = require("../../services/pembelian/invoiceFormService");

const getSupplier = async (req, res) => {
  try {
    const data = await svc.getSupplier(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getOpenBPB = async (req, res) => {
  try {
    const data = await svc.getOpenBPB(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailByBPB = async (req, res) => {
  try {
    const data = await svc.getDetailByBPB(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTop = async (req, res) => {
  try {
    const { supKode } = req.query;
    if (!supKode) return res.status(400).json({ success: false, message: "supKode wajib." });
    const top = await svc.getTop(supKode);
    res.json({ success: true, data: { top } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const checkNoBukti = async (req, res) => {
  try {
    const { nobukti, excludeNomor = "" } = req.query;
    const result = await svc.checkNoBukti(nobukti, excludeNomor);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax } = req.query;
    if (!tanggal) return res.status(400).json({ success: false, message: "Tanggal wajib." });
    const cabang = req.user?.cabang || "99";
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 0, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const cekLastCost = async (req, res) => {
  try {
    const { brgKode, nilai } = req.query;
    if (!brgKode || nilai === undefined)
      return res.status(400).json({ success: false, message: "brgKode dan nilai wajib." });
    const data = await svc.cekLastCost(Number(brgKode), Number(nilai));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getToleransiHbl = async (req, res) => {
  try {
    const toleransi = await svc.getToleransiHbl();
    res.json({ success: true, data: { toleransi } });
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
    res.json({ success: true, data, message: "Invoice berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getSupplier,
  getOpenBPB,
  getDetailByBPB,
  getTop,
  checkNoBukti,
  getNomor,
  cekLastCost,
  getToleransiHbl,
  getDetailForm,
  saveData,
};
