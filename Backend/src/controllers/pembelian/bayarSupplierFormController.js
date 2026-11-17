// controllers/pembelian/bayarSupplierFormController.js
const svc = require("../../services/pembelian/bayarSupplierFormService");

const getSupplier = async (req, res) => {
  try {
    const data = await svc.getSupplier(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getRekening = async (req, res) => {
  try {
    const data = await svc.getRekening(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getInvoiceBySupplier = async (req, res) => {
  try {
    const { supKode, isTax, isEdit = false, nomorBys = "" } = req.query;
    if (!supKode)
      return res.status(400).json({ success: false, message: "supKode wajib." });
    const data = await svc.getInvoiceBySupplier(
      supKode,
      Number(isTax) || 0,
      isEdit === true || isEdit === "true",
      nomorBys
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getReturBySupplier = async (req, res) => {
  try {
    const { supKode, nomorBys = "" } = req.query;
    if (!supKode)
      return res.status(400).json({ success: false, message: "supKode wajib." });
    const data = await svc.getReturBySupplier(supKode, nomorBys);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getNomor = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) return res.status(400).json({ success: false, message: "Tanggal wajib." });
    const cabang = req.user?.cabang || "99";
    const nomor = await svc.getMaxNomor(tanggal, cabang);
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
    res.json({ success: true, data, message: "Pembayaran Supplier berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getSupplier,
  getRekening,
  getInvoiceBySupplier,
  getReturBySupplier,
  getNomor,
  getDetailForm,
  saveData,
};
