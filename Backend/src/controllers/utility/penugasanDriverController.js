// controllers/utility/penugasanDriverController.js
const svc = require("../../services/utility/penugasanDriverService");

// Lookup driver (Delphi: edtKodeClickBtn / edtKode2ClickBtn -> frmbantuan)
const getDriver = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getDriver() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Lookup customer (Delphi: edtkodecustomerClickBtn -> frmbantuan)
const getCustomers = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getCustomers() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Daftar DO belum diproses (Delphi: Button1Click)
const getDoList = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getDoList(req.query) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Simpan penugasan (Delphi: cxButton1Click; cek hak via middleware)
const assign = async (req, res) => {
  try {
    const hasil = await svc.assignDriver(req.body, req.user);
    res.json({ success: true, message: "Simpan berhasil", data: hasil });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getDriver, getCustomers, getDoList, assign };
