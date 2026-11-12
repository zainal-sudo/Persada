// controllers/penjualan/fpFormController.js
const svc = require("../../services/penjualan/fpFormService");

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax } = req.query;
    if (!tanggal) {
      return res.status(400).json({ success: false, message: "Tanggal wajib." });
    }
    const cabang = req.user?.cabang || "01";
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 1, cabang);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchSO = async (req, res) => {
  try {
    const data = await svc.searchSO(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const loadSO = async (req, res) => {
  try {
    const data = await svc.loadSO(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getDiscCN = async (req, res) => {
  try {
    const { brgKode, cusKode, tanggal } = req.query;
    if (!brgKode || !cusKode || !tanggal) {
      return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
    }
    const data = await svc.getDiscCN(Number(brgKode), cusKode, tanggal);
    res.json({ success: true, data: { cn: data } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getTop = async (req, res) => {
  try {
    const { cusKode } = req.query;
    if (!cusKode) {
      return res.status(400).json({ success: false, message: "cusKode wajib." });
    }
    const top = await svc.getTop(cusKode);
    res.json({ success: true, data: { top } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getNilaiRetur = async (req, res) => {
  try {
    const { nomor } = req.query;
    if (!nomor) {
      return res.status(400).json({ success: false, message: "nomor wajib." });
    }
    const retur = await svc.getNilaiRetur(nomor);
    res.json({ success: true, data: { retur } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDP = async (req, res) => {
  try {
    const { nomorSO, excludeNomor = "" } = req.query;
    if (!nomorSO) {
      return res.status(400).json({ success: false, message: "nomorSO wajib." });
    }
    const dp = await svc.getDP(nomorSO, excludeNomor);
    res.json({ success: true, data: { dp } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getCNFaktur = async (req, res) => {
  try {
    const { cusKode, tanggal } = req.query;
    if (!cusKode || !tanggal) {
      return res.status(400).json({ success: false, message: "cusKode dan tanggal wajib." });
    }
    const cn = await svc.getCNFaktur(cusKode, tanggal);
    res.json({ success: true, data: { cn } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getMarginData = async (req, res) => {
  try {
    const { brgKode, expired, nomorSO, cusKode } = req.query;
    if (!brgKode || !nomorSO) {
      return res.status(400).json({ success: false, message: "brgKode dan nomorSO wajib." });
    }
    const data = await svc.getMarginData(
      Number(brgKode),
      expired || "",
      nomorSO,
      cusKode || ""
    );
    res.json({ success: true, data });
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
    const [[row]] = await require("../../config/database").query(
      `SELECT brg_disc_sales FROM tbarang WHERE brg_kode = ? LIMIT 1`,
      [Number(brgKode)]
    );
    res.json({ success: true, data: { discSales: Number(row?.brg_disc_sales || 0) } });
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
    res.json({ success: true, data, message: "FP berhasil disimpan." });
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
  getNomor,
  searchSO,
  loadSO,
  getDiscCN,
  getTop,
  getNilaiRetur,
  getDP,
  getCNFaktur,
  getMarginData,
  getDiscSales,
  getDetailForm,
  saveData,
  getRiwayatHarga,
};