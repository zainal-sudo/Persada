const svc = require("../../services/daftar/salesmanService");

// GET /daftar/salesman?cabang=P01
const getBrowse = async (req, res) => {
  try {
    const cabang = req.query.cabang || req.user?.cabang || "P01";
    const data = await svc.getBrowse(cabang);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };