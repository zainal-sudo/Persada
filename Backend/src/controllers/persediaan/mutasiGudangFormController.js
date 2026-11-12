const svc = require("../../services/persediaan/mutasiGudangFormService");

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
    if (!gudang || !sku || !expired) {
      return res.status(400).json({ success: false, message: "gudang, sku, dan expired wajib." });
    }
    const data = await svc.getDetailSKU(gudang, sku, expired);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getStok = async (req, res) => {
  try {
    const { gudang, sku, expired } = req.query;
    if (!gudang || !sku || !expired) {
      return res.status(400).json({ success: false, message: "gudang, sku, dan expired wajib." });
    }
    const stok = await svc.getStok(gudang, sku, expired);
    res.json({ success: true, data: { stok } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const loadDataAll = async (req, res) => {
  try {
    const { gudang } = req.query;
    if (!gudang) {
      return res.status(400).json({ success: false, message: "gudang wajib." });
    }
    const data = await svc.loadDataAll(gudang);
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
    res.json({ success: true, data, message: "Mutasi gudang berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxNomor,
  getGudang,
  searchSKU,
  getDetailSKU,
  getStok,
  loadDataAll,
  getDetailForm,
  saveData,
};