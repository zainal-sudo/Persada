const svc = require("../../services/persediaan/subBarangService");

// GET /persediaan/sub-barang?tingkat=1
const getBrowse = async (req, res) => {
  try {
    const tingkat = Number(req.query.tingkat) || 1;
    const data = await svc.getBrowse(tingkat);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const deleteData = async (req, res) => {
  try {
    await svc.deleteData(req.params.kode);
    res.json({ success: true, message: "Sub barang berhasil dihapus." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, deleteData };