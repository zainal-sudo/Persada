// controllers/penjualan/fpController.js
const svc = require("../../services/penjualan/fpService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    const data = await svc.getBrowse(startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const deleteData = async (req, res) => {
  try {
    await svc.deleteData(req.params.nomor);
    res.json({ success: true, message: "FP berhasil dihapus." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getPrintData = async (req, res) => {
  try {
    const data = await svc.getPrintData(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const setPrinted = async (req, res) => {
  try {
    const data = await svc.setPrinted(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getBarisSlip = async (req, res) => {
  try {
    const nama = req.params.nama || 'FP';
    const baris = await svc.getBarisSlip(nama);
    res.json({ success: true, data: { baris } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const toggleKembali = async (req, res) => {
  try {
    const data = await svc.toggleKembali(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data, message: "Update Status Berhasil" });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const toggleBayar = async (req, res) => {
  try {
    const data = await svc.toggleBayar(decodeURIComponent(req.params.nomor), req.user?.kode);
    res.json({ success: true, data, message: "Update Status Berhasil" });
  } catch (e) {
    res.status(403).json({ success: false, message: e.message });
  }
};

const getHistoryBayar = async (req, res) => {
  try {
    const data = await svc.getHistoryBayar(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getPrintDataRetur = async (req, res) => {
  try {
    const data = await svc.getPrintDataRetur(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getEditJt = async (req, res) => {
  try {
    const data = await svc.getEditJt(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveEditJt = async (req, res) => {
  try {
    const { nomor, detail } = req.body;
    if (!nomor) {
      return res.status(400).json({ success: false, message: "nomor wajib." });
    }
    const data = await svc.saveEditJt(nomor, detail);
    res.json({ success: true, data, message: "Jatuh tempo berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getSetDiscOff = async (req, res) => {
  try {
    const data = await svc.getSetDiscOff(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveSetDiscOff = async (req, res) => {
  try {
    const { nomor, biayaPr } = req.body;
    if (!nomor) {
      return res.status(400).json({ success: false, message: "nomor wajib." });
    }
    const data = await svc.saveSetDiscOff(nomor, biayaPr);
    res.json({ success: true, data, message: "Set Disc Off berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, deleteData, getPrintData, getBarisSlip, toggleKembali, toggleBayar, getHistoryBayar, getPrintDataRetur, getEditJt, saveEditJt, getSetDiscOff, saveSetDiscOff, setPrinted };