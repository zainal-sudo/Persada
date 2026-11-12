// controllers/utility/settingJadwalSalesController.js
const svc = require("../../services/utility/settingJadwalSalesService");

// Browse (Delphi: btnRefreshClick)
const getBrowse = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getBrowse() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Load jadwal 1 salesman utk form (web-only; Delphi tidak memuat data lama)
const load = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.loadBySalesman(req.query.salesman) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Lookup salesman (Delphi: edtKodeClickBtn -> frmbantuan)
const getSalesman = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getSalesman() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Lookup customer (Delphi: clCustomerPropertiesButtonClick -> frmbantuan)
const getCustomers = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getCustomers() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Simpan (Delphi: simpandata; cek hak via checkPermission("save") ->
// insert/edit dinamis dari req.body.isEdit)
const save = async (req, res) => {
  try {
    const hasil = await svc.save(req.body, req.user);
    res.json({ success: true, message: "Jadwal salesman tersimpan.", data: hasil });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Hapus jadwal 1 salesman (Delphi: tombol Hapus browse — di Delphi BUG,
// menunjuk tCostCenter; lihat gap doc §4)
const hapus = async (req, res) => {
  try {
    const hasil = await svc.hapusSalesman(req.body.salesman, req.user);
    res.json({ success: true, message: "Jadwal salesman dihapus.", data: hasil });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, load, getSalesman, getCustomers, save, hapus };
