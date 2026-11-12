// controllers/laporan/historyHargaJualController.js
const svc = require("../../services/laporan/historyHargaJualService");

const getBrowse = async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const bln = Number(bulan);
    const thn = Number(tahun);

    if (!bln || bln < 1 || bln > 12 || !thn) {
      return res.status(400).json({ success: false, message: "bulan (1-12) dan tahun wajib." });
    }

    const data = await svc.getBrowse({ bulan: bln, tahun: thn });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetail = async (req, res) => {
  try {
    const { bulan, tahun, kode } = req.query;
    const bln = Number(bulan);
    const thn = Number(tahun);

    if (!bln || bln < 1 || bln > 12 || !thn || !kode) {
      return res.status(400).json({ success: false, message: "bulan, tahun, dan kode wajib." });
    }

    const data = await svc.getDetail({ bulan: bln, tahun: thn, kode });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getDetail };