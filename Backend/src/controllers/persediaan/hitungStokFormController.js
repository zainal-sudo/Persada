const svc = require("../../services/persediaan/hitungStokFormService");

const getMaxNomor = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) {
      return res.status(400).json({ success: false, message: "tanggal wajib." });
    }
    const nomor = await svc.getMaxNomor(tanggal);
    res.json({ success: true, data: { nomor } });
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

const getBarang = async (req, res) => {
  try {
    const data = await svc.getBarang(req.query.search || "");
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
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Hitung stok berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  getGudang,
  getBarang,
  getDetailForm,
  saveData,
};