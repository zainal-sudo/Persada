const svc = require("../../services/daftar/jenisCustomerService");

// GET /daftar/jenis-customer
const getBrowse = async (req, res) => {
  try {
    const data = await svc.getBrowse();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };