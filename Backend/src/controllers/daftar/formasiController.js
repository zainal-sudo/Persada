// controllers/daftar/formasiController.js
const svc = require("../../services/daftar/formasiService");

const getBrowse = async (req, res) => {
  try {
    const data = await svc.getBrowse(req.query.search || "");
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const deleteData = async (req, res) => {
  try {
    await svc.deleteData(req.params.id);
    res.json({ success: true, message: "Formasi berhasil dihapus." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, deleteData };
