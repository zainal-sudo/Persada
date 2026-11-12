const svc = require("../../services/persediaan/subBarangFormService");

const getMaxKode = async (req, res) => {
  try {
    const { tingkat, parentKode } = req.query;
    if (!tingkat) {
      return res.status(400).json({ success: false, message: "tingkat wajib." });
    }
    const kode = await svc.getMaxKode(Number(tingkat), parentKode || "");
    res.json({ success: true, data: { kode } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getParent = async (req, res) => {
  try {
    const tingkat = Number(req.query.tingkat) || 1;
    const data = await svc.getParent(tingkat);
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
    const data = await svc.saveData(req.body);
    res.json({ success: true, data, message: "Sub barang berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxKode,
  getParent,
  getDetailForm,
  saveData,
};