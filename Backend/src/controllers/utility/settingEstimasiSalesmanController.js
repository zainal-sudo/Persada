// controllers/utility/settingEstimasiSalesmanController.js
const svc = require("../../services/utility/settingEstimasiSalesmanService");

// Lookup customer (Delphi: clCustomerPropertiesButtonClick -> frmbantuan)
const getCustomers = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getCustomers() });
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

// Load grid form (Delphi: loaddata)
const load = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.load(req.query) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Simpan (Delphi: simpandata; cek hak dilakukan middleware checkPermission("save"))
const save = async (req, res) => {
  try {
    const hasil = await svc.save(req.body, req.user);
    res.json({ success: true, message: "Estimasi salesman tersimpan.", data: hasil });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getSalesman, getCustomers, load, save };
