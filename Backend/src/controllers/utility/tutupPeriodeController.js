// controllers/utility/tutupPeriodeController.js
const svc = require("../../services/utility/tutupPeriodeService");

const getLast = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getLast() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const proses = async (req, res) => {
  try {
    await svc.proses(req.body, req.user);
    res.json({ success: true, message: "Tutup Periode Berhasil." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const buka = async (req, res) => {
  try {
    await svc.buka(req.body);
    res.json({ success: true, message: "Buka Periode Berhasil." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getLast, proses, buka };