// controllers/penjualan/serahTerimaFakturFormController.js
const svc = require("../../services/penjualan/serahTerimaFakturFormService");

const getNomor = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal)
      return res
        .status(400)
        .json({ success: false, message: "Tanggal wajib." });
    const nomor = await svc.getMaxNomor(tanggal, req.user?.cabang || "01");
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Penyerah dan Penerima berasal dari tuser yang user_faktur = 1.
const getUsers = async (req, res) => {
  try {
    const data = await svc.getUserFaktur();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { penyerah } = req.query;
    if (!penyerah)
      return res
        .status(400)
        .json({ success: false, message: "penyerah wajib." });
    const data = await svc.getInvoice(penyerah);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailForm = async (req, res) => {
  try {
    const data = await svc.getDetailForm(
      decodeURIComponent(req.params.nomor),
      req.user
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const saveData = async (req, res) => {
  try {
    const data = await svc.saveData(req.body, req.user);
    res.json({
      success: true,
      data,
      message: "Serah terima faktur berhasil disimpan.",
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getNomor, getUsers, getInvoice, getDetailForm, saveData };
