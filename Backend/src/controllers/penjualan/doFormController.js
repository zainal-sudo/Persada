// controllers/penjualan/doFormController.js
const svc = require("../../services/penjualan/doFormService");

const getNomor = async (req, res) => {
  try {
    const { tanggal, isTax, divKode } = req.query;
    if (!tanggal) {
      return res.status(400).json({ success: false, message: "Tanggal wajib." });
    }
    if (!divKode) {
      return res.status(400).json({ success: false, message: "Divisi wajib dipilih." });
    }
    const nomor = await svc.getMaxNomor(tanggal, Number(isTax) || 1, divKode);
    res.json({ success: true, data: { nomor } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
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

const getGudang = async (req, res) => {
  try {
    const data = await svc.getGudang(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDriver = async (req, res) => {
  try {
    const data = await svc.getDriver();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchStok = async (req, res) => {
  try {
    const { nomorSO, gdgKode, nomorDO, search } = req.query;
    if (!nomorSO || !gdgKode) {
      return res.status(400).json({ success: false, message: "nomorSO dan gdgKode wajib." });
    }
    const data = await svc.searchStok(nomorSO, gdgKode, nomorDO || "", search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchStokKons = async (req, res) => {
  try {
    const { nomorSO, nomorDO, search } = req.query;
    if (!nomorSO) {
      return res.status(400).json({ success: false, message: "nomorSO wajib." });
    }
    const data = await svc.searchStokKons(nomorSO, nomorDO || "", search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetailStok = async (req, res) => {
  try {
    const { sku, expired, nomorSO, gdgKode, isEdit, idBatch } = req.query;
    if (!sku || !nomorSO) {
      return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
    }
    // Barang tanpa stok (UNION bagian 2) tidak punya expired → kirim null.
    // gdgKode boleh kosong utk baris bagian 2 konsinyasi (belum ada gudang).
    const data = await svc.getDetailStok(
      Number(sku),
      expired || null,
      nomorSO,
      gdgKode || "",
      isEdit === "1",
      idBatch !== undefined ? String(idBatch) : null
    );

    // FIX: kalau tidak ketemu, kasih 404
    if (!data) {
      return res.status(404).json({ success: false, message: "Stok tidak ditemukan." });
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /form/stok?sku=&expired=&gdgKode=&nomorDO= → stok gudang (validasi qty)
const getStok = async (req, res) => {
  try {
    const { sku, expired, gdgKode, nomorDO, idBatch } = req.query;
    if (!sku || !gdgKode) {
      return res.status(400).json({ success: false, message: "sku dan gdgKode wajib." });
    }
    const stok = await svc.getStok(
      Number(sku),
      expired || null,
      gdgKode,
      nomorDO || "",
      idBatch !== undefined ? String(idBatch) : null
    );
    res.json({ success: true, data: { stok } });
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
    res.json({ success: true, data, message: "DO berhasil disimpan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getNomor,
  searchSO,
  loadSO,
  getGudang,
  getDriver,
  searchStok,
  searchStokKons,
  getDetailStok,
  getStok,
  getDetailForm,
  saveData,
};