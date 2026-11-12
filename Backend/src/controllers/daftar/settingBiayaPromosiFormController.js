const svc = require("../../services/daftar/settingBiayaPromosiFormService");

const getMaxNomor = async (req, res) => {
  try {
    const nomor = await svc.getMaxNomor();
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getCustomer = async (req, res) => {
  try {
    const data = await svc.getCustomer(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getBarang = async (req, res) => {
  try {
    const data = await svc.getBarang(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getAllItem = async (req, res) => {
  try {
    const { cusKode } = req.query;
    if (!cusKode) {
      return res.status(400).json({ success: false, message: "cusKode wajib." });
    }
    const data = await svc.getAllItem(cusKode);
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
    const data = await svc.saveData(req.body);
    res.json({ success: true, data, message: "Setting biaya promosi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  getCustomer,
  getBarang,
  getAllItem,
  getDetailForm,
  saveData,
};