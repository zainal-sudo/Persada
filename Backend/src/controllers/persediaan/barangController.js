const svc = require("../../services/persediaan/barangService");

// GET /persediaan/barang?search=
const getBrowse = async (req, res) => {
  try {
    const search = req.query.search || "";
    const data = await svc.getBrowse(search);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/barang/detail/:kode
const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(req.params.kode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PUT /persediaan/barang/aktif/:kode
const toggleAktif = async (req, res) => {
  try {
    const data = await svc.toggleAktif(req.params.kode);
    res.json({ success: true, data, message: data.aktif ? "Barang diaktifkan." : "Barang dinonaktifkan." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, toggleAktif };