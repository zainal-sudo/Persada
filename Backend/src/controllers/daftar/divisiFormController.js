const svc = require("../../services/daftar/divisiFormService");

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body);
    res.json({ success: true, data, message: "Data divisi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getDetailForm,
  saveData,
};
