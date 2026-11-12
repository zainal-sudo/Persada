const svc = require("../../services/daftar/customerService");

// GET /daftar/customer?cabang=P01
const getBrowse = async (req, res) => {
  try {
    const cabang = req.query.cabang || req.user?.cabang || "P01";
    const data = await svc.getBrowse(cabang);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PUT /daftar/customer/lock/:kode  { locked: 0|1 }
const updateLocked = async (req, res) => {
  try {
    const data = await svc.updateLocked(req.params.kode, req.body?.locked);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, updateLocked };