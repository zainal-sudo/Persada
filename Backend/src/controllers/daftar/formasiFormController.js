// controllers/daftar/formasiFormController.js
const svc = require("../../services/daftar/formasiFormService");

const getOptions = async (req, res) => {
  try {
    const data = await svc.getOptions(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getSalesmanOptions = async (req, res) => {
  try {
    const data = await svc.getSalesmanOptions(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTypeOptions = async (req, res) => {
  try {
    const data = await svc.getTypeOptions(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDivisiOptions = async (req, res) => {
  try {
    const data = await svc.getDivisiOptions(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getTargetBulanan = async (req, res) => {
  try {
    const data = await svc.getTargetBulanan(
      req.query.id,
      Number(req.query.tahun) || new Date().getFullYear()
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const result = await svc.saveData(req.body, req.user);
    res.json({ success: true, data: result, message: "Formasi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getOptions,
  getSalesmanOptions,
  getTypeOptions,
  getDivisiOptions,
  getDetailForm,
  getTargetBulanan,
  saveData,
};
