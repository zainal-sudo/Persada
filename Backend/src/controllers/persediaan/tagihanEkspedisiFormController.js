const svc = require("../../services/persediaan/tagihanEkspedisiFormService");

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

const loadFP = async (req, res) => {
  try {
    const { startDate, endDate, mode } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }
    const data = await svc.loadFP(startDate, endDate, mode || "fp");
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
    res.json({ success: true, data, message: "Tagihan ekspedisi berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  loadFP,
  getDetailForm,
  saveData,
};