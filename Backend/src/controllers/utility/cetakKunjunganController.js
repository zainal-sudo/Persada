// controllers/utility/cetakKunjunganController.js
const svc = require("../../services/utility/cetakKunjunganService");

// Lookup salesman aktif (Delphi: edtKodeClickBtn -> frmbantuan)
const getSalesman = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getSalesman() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Daftar kunjungan (Delphi: loaddata)
const getKunjungan = async (req, res) => {
  try {
    res.json({
      success: true,
      data: await svc.getKunjungan(req.query),
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Header perusahaan untuk cetak (Delphi: doslip/fr3 memakai tperusahaan)
const getPerusahaan = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getPerusahaan() });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getSalesman, getKunjungan, getPerusahaan };
