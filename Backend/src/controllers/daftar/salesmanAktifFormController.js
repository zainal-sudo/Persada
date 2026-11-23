// controllers/daftar/salesmanAktifFormController.js
const svc = require("../../services/daftar/salesmanAktifFormService");

const getFormasiOptions = async (req, res) => {
  try {
    const data = await svc.getFormasiOptions(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(req.params.kode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const result = await svc.saveData(req.body, req.user);
    res.json({ success: true, data: result, message: "Salesman berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getFormasiOptions, getDetailForm, saveData };
