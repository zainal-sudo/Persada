const svc = require("../../services/persediaan/permintaanBarangFormService");

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

const searchSKU = async (req, res) => {
  try {
    const { search, pbNomor } = req.query;
    const data = await svc.searchSKU(search || "", pbNomor || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailSKU = async (req, res) => {
  try {
    const { sku, pbNomor } = req.query;
    if (!sku) {
      return res.status(400).json({ success: false, message: "sku wajib." });
    }
    const data = await svc.getDetailSKU(sku, pbNomor || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const searchPB = async (req, res) => {
  try {
    const { tanggal } = req.query;
    const data = await svc.searchPB(tanggal || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const loadPB = async (req, res) => {
  try {
    const { pbNomor } = req.query;
    if (!pbNomor) {
      return res.status(400).json({ success: false, message: "pbNomor wajib." });
    }
    const data = await svc.loadPB(pbNomor);
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
    res.json({ success: true, data, message: "Permintaan barang berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  searchSKU,
  getDetailSKU,
  searchPB,
  loadPB,
  getDetailForm,
  saveData,
};