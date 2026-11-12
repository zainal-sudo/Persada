const svc = require("../../services/kasbank/bukuBankService");

// GET /kasbank/buku-bank/rekening
const getRekening = async (req, res) => {
  try {
    const data = await svc.getRekening();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /kasbank/buku-bank?rekkode&startDate&endDate
const getBukuBank = async (req, res) => {
  try {
    const { rekkode, startDate, endDate } = req.query;
    if (!rekkode || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "rekkode, startDate, dan endDate wajib." });
    }
    const data = await svc.getBukuBank(rekkode, startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getRekening, getBukuBank };