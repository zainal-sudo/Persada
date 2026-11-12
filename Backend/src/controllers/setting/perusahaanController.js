// controllers/setting/perusahaanController.js
const svc = require("../../services/setting/perusahaanService");

const FIELDS = [
  "perush_nama", "perush_alamat", "perush_kota", "perush_notelp", "perush_nofax",
  "perush_npwp", "perush_nama_npwp", "perush_alnpwp", "perush_ktnpwp", "perush_rekening",
];

const get = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.get() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const update = async (req, res) => {
  try {
    const data = {};
    for (const f of FIELDS) data[f] = req.body[f];
    await svc.update(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { get, update };
