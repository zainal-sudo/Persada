const svc = require("../../services/daftar/customerFormService");

const getJenisCustomer = async (req, res) => {
  try {
    const data = await svc.getJenisCustomer();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getGolonganCustomer = async (req, res) => {
  try {
    const data = await svc.getGolonganCustomer();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getMarketing = async (req, res) => {
  try {
    const data = await svc.getMarketing(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(decodeURIComponent(req.params.kode));
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Customer berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getJenisCustomer,
  getGolonganCustomer,
  getMarketing,
  getDetailForm,
  saveData,
};