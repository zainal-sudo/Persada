const svc = require("../../services/daftar/rekeningFormService");

const getKelompok = async (req, res) => {
  try {
    const data = await svc.getKelompok();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const cekKode = async (req, res) => {
  try {
    const { kode } = req.query;
    if (!kode) {
      return res.status(400).json({ success: false, message: "kode wajib." });
    }
    const exists = await svc.cekKode(kode);
    res.json({ success: true, data: { exists } });
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
    const data = await svc.saveData(req.body);
    res.json({ success: true, data, message: "Rekening berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getKelompok,
  cekKode,
  getDetailForm,
  saveData,
};