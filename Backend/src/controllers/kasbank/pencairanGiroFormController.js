const svc = require("../../services/kasbank/pencairanGiroFormService");

const getMaxNomor = async (req, res) => {
  try {
    const { tanggal, cabang } = req.query;
    if (!tanggal || !cabang) {
      return res.status(400).json({ success: false, message: "tanggal dan cabang wajib." });
    }
    const nomor = await svc.getMaxNomor(tanggal, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchGiro = async (req, res) => {
  try {
    const data = await svc.searchGiro(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getRekening = async (req, res) => {
  try {
    const data = await svc.getRekening();
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
    res.json({ success: true, data, message: "Pencairan giro berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  searchGiro,
  getRekening,
  getDetailForm,
  saveData,
};