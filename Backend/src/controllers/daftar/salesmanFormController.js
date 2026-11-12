const svc = require("../../services/daftar/salesmanFormService");

const getMaxKode = async (req, res) => {
  try {
    const kode = await svc.getMaxKode();
    res.json({ success: true, data: { kode } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTargetBulanan = async (req, res) => {
  try {
    const { kode, tahun } = req.query;
    if (!kode || !tahun) {
      return res.status(400).json({
        success: false,
        message: "kode dan tahun wajib.",
      });
    }
    const data = await svc.getTargetBulanan(kode, Number(tahun));
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
    res.json({ success: true, data, message: "Salesman berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxKode,
  getTargetBulanan,
  getDetailForm,
  saveData,
};