const svc = require("../../services/persediaan/serahTerimaEkspedisiService");

// GET /persediaan/serah-terima-ekspedisi?startDate&endDate
const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate dan endDate wajib." });
    }
    const data = await svc.getBrowse(startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/serah-terima-ekspedisi/detail/:nomor
const getBrowseDetail = async (req, res) => {
  try {
    const data = await svc.getBrowseDetail(decodeURIComponent(req.params.nomor));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /persediaan/serah-terima-ekspedisi/print/:nomor
// Delphi menandai ste_realisasi = 1 di dalam teslip/steslip3, yaitu saat
// slip dicetak. Ditiru apa adanya supaya tombol Realisasi terpisah tidak
// diperlukan di browse.
const getPrintData = async (req, res) => {
  try {
    const nomor = decodeURIComponent(req.params.nomor);
    const data = await svc.getPrintData(nomor);
    await svc.setRealisasi(nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// DELETE /persediaan/serah-terima-ekspedisi/:nomor
const deleteDoc = async (req, res) => {
  try {
    const data = await svc.deleteDoc(decodeURIComponent(req.params.nomor), req.user);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getBrowse, getBrowseDetail, getPrintData, deleteDoc };
