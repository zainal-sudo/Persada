// controllers/pembelian/bpbFormController.js
const svc = require("../../services/pembelian/bpbFormService");

const getSupplier = async (req, res) => {
  try {
    const data = await svc.getSupplier(req.query.search || "");
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

const getOpenPO = async (req, res) => {
  try {
    const data = await svc.getOpenPO(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailByPO = async (req, res) => {
  try {
    const data = await svc.getDetailByPO(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
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
    res.json({ success: true, data, message: "BPB berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getSupplier,
  getGudang,
  getOpenPO,
  getDetailByPO,
  getNomor,
  getDetailForm,
  saveData,
};
