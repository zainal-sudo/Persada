// controllers/pembelian/poFormController.js
const svc = require("../../services/pembelian/poFormService");

const getSupplier = async (req, res) => {
  try {
    const data = await svc.getSupplier(req.query.search || "");
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

const getHitungStok = async (req, res) => {
  try {
    const { gdgKode } = req.query;
    if (!gdgKode) return res.status(400).json({ success: false, message: "gdgKode wajib." });
    const data = await svc.getHitungStok(gdgKode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax } = req.query;
    if (!tanggal) return res.status(400).json({ success: false, message: "Tanggal wajib." });
    const cabang = req.user?.cabang || "99";
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 0, cabang);
    res.json({ success: true, data: { nomor } });
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
    res.json({ success: true, data, message: "PO berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getRiwayatHarga = async (req, res) => {
  try {
    const { brgKode, supKode, excludeNomor = "" } = req.query;
    if (!brgKode || !supKode)
      return res.status(400).json({ success: false, message: "brgKode dan supKode wajib." });
    const data = await svc.getRiwayatHarga(Number(brgKode), supKode, excludeNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
  getSupplier,
  getBarang,
  getHitungStok,
  getNomor,
  getDetailForm,
  saveData,
  getRiwayatHarga,
};
