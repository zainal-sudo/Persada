// controllers/penjualan/soFormController.js
const svc = require("../../services/penjualan/soFormService");

const getCustomer = async (req, res) => {
  try {
    const data = await svc.getCustomer(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getSalesmanAktif = async (req, res) => {
  try {
    const data = await svc.getSalesmanAktif();
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

const getBarang = async (req, res) => {
  try {
    const { search = "", jenisCustomer = "" } = req.query;
    const data = await svc.getBarang(search, jenisCustomer);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getSalesman = async (req, res) => {
  try {
    const data = await svc.getSalesman();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax } = req.query;
    if (!tanggal) {
      return res.status(400).json({ success: false, message: "Tanggal wajib." });
    }
    console.log("req.user:", req.user);
    const cabang = req.user?.cabang || "01";
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 0, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const checkCustomerLocked = async (req, res) => {
  try {
    const { cusKode } = req.query;
    if (!cusKode) {
      return res.status(400).json({ success: false, message: "cusKode wajib." });
    }
    const locked = await svc.checkCustomerLocked(cusKode);
    res.json({ success: true, data: { locked } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDiscSales = async (req, res) => {
  try {
    const { brgKode } = req.query;
    if (!brgKode) {
      return res.status(400).json({ success: false, message: "brgKode wajib." });
    }
    const discSales = await svc.getDiscSales(Number(brgKode));
    res.json({ success: true, data: { discSales } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getLastCost = async (req, res) => {
  try {
    const { brgKode } = req.query;
    if (!brgKode) {
      return res.status(400).json({ success: false, message: "brgKode wajib." });
    }
    const lastCost = await svc.getLastCost(Number(brgKode));
    res.json({ success: true, data: { lastCost } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getAmbilSO = async (req, res) => {
  try {
    const cabang = req.query.cabang || req.user?.cabang || "Solo";
    const databaseUtama = req.user?.database || process.env.DB_NAME;
    const data = await svc.getAmbilSO(cabang, databaseUtama);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailAmbilSO = async (req, res) => {
  try {
    const databaseUtama = req.user?.database || process.env.DB_NAME;
    const data = await svc.getDetailAmbilSO(req.params.nomor, databaseUtama);
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
    res.json({ success: true, data, message: "SO berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getRiwayatHarga = async (req, res) => {
  try {
    const { brgKode, cusKode, excludeNomor = "" } = req.query;
    if (!brgKode || !cusKode) {
      return res.status(400).json({ success: false, message: "brgKode dan cusKode wajib." });
    }
    const data = await svc.getRiwayatHarga(Number(brgKode), cusKode, excludeNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
  getCustomer,
  getSalesmanAktif,
  getRekening,
  getBarang,
  getNomor,
  checkCustomerLocked,
  getDiscSales,
  getLastCost,
  getAmbilSO,
  getDetailAmbilSO,
  getDetailForm,
  saveData,
  getSalesman,
  getRiwayatHarga
};