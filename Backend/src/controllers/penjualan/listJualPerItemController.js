// controllers/penjualan/listJualPerItemController.js
const svc = require("../../services/penjualan/listJualPerItemService");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate, customerCode, customerName, barangName, isProductFocus, isKontrak, byInkaso, linkMarketing } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }

    const params = {
      startDate,
      endDate,
      customerCode: customerCode || undefined,
      customerName: customerName || undefined,
      barangName: barangName || undefined,
      isProductFocus: isProductFocus === 'true',
      isKontrak: isKontrak === 'true',
      byInkaso: byInkaso === 'true',
      linkMarketing: linkMarketing === 'true',
    };

    const data = await svc.getBrowse(params, req.user);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse };
