const svc = require("../../services/persediaan/barangFormService");

const getMaxKode = async (req, res) => {
  try {
    const kode = await svc.getMaxKode();
    res.json({ success: true, data: { kode } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTipeBarang = async (req, res) => {
  try {
    const data = await svc.getTipeBarang();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getKategori = async (req, res) => {
  try {
    const data = await svc.getKategori();
    res.json({ success: true, data });
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

const getSupplier = async (req, res) => {
  try {
    const data = await svc.getSupplier();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getHargaJualJenis = async (req, res) => {
  try {
    const brgKode = req.query.brgKode || "";
    const data = await svc.getHargaJualJenis(brgKode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(req.params.kode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({ success: true, data, message: "Barang berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMaxKode,
  getTipeBarang,
  getKategori,
  getGudang,
  getSupplier,
  getHargaJualJenis,
  getDetailForm,
  saveData,
};