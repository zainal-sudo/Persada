const svc = require("../../services/persediaan/pemusnahanFormService");

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

const getGudang = async (req, res) => {
  try {
    const data = await svc.getGudang();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchSKU = async (req, res) => {
  try {
    const { gudang, search } = req.query;
    if (!gudang) {
      return res.status(400).json({ success: false, message: "gudang wajib." });
    }
    const data = await svc.searchSKU(gudang, search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailSKU = async (req, res) => {
  try {
    const { gudang, sku, expired } = req.query;
    if (!gudang || !sku) {
      return res.status(400).json({ success: false, message: "gudang dan sku wajib." });
    }
    const data = await svc.getDetailSKU(gudang, sku, expired || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
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
    res.json({ success: true, data, message: "Pemusnahan berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  getGudang,
  searchSKU,
  getDetailSKU,
  getDetailForm,
  saveData,
};