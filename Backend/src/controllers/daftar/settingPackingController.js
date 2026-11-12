const svc = require("../../services/daftar/settingPackingService");

// GET /daftar/setting-packing
const getBrowse = async (req, res) => {
  try {
    const data = await svc.getBrowse();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /daftar/setting-packing/detail/:nomor
const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(req.params.nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail };