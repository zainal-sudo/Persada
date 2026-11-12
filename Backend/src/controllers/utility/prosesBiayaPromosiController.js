// controllers/utility/prosesBiayaPromosiController.js
const svc = require("../../services/utility/prosesBiayaPromosiService");

// Pratinjau hitungan sebelum proses (GET) — web lebih baik dari Delphi
// yang langsung mengeksekusi tanpa ringkasan apa pun.
const pratinjau = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.pratinjau(req.query) });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const proses = async (req, res) => {
  try {
    const hasil = await svc.proses(req.body, req.user);
    res.json({ success: true, message: "Proses Biaya Promosi Selesai.", data: hasil });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { pratinjau, proses };
