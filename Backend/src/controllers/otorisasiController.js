// controllers/otorisasiController.js
const svc = require("../services/otorisasiService");

// POST /api/otorisasi/request — kasir membuka dialog otorisasi
const request = async (req, res) => {
  try {
    const { jenis, variant, form, detail } = req.body;
    const data = await svc.request({
      jenis,
      variant: Number(variant) || 1,
      userKode: req.user?.kode || "",
      cabang: req.user?.cabang || "",
      database: req.user?.database || "",
      konteks: { form, detail },
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// GET /api/otorisasi/:kode — detail mobile (publik, tanpa login).
// Cabang ditemukan otomatis oleh service (scan semua DB cabang).
const getDetail = async (req, res) => {
  try {
    const data = await svc.getDetail(req.params.kode);
    if (!data) {
      return res.status(404).json({ success: false, message: "Kode tidak ditemukan." });
    }
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/otorisasi/:kode/verify — kasir mengetik password di dialog web
const verify = async (req, res) => {
  try {
    const { password } = req.body;
    const { approved, reason } = await svc.verify(req.params.kode, password);
    if (!approved) {
      return res.status(403).json({ success: false, message: reason });
    }
    res.json({ success: true, data: { approved } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { request, getDetail, verify };