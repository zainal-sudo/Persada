// controllers/systemController.js
const packageJson = require("../../package.json");
const changelog = require("../config/changelog");

// Info versi aplikasi untuk FE (dipakai panel "Apa yang Baru").
// `version` & `changelog` dipertahankan untuk klien lama; `history` memberi
// seluruh riwayat supaya FE bisa menyusun sendiri catatan yang belum dibaca.
const getSystemInfo = (req, res) => {
  res.json({
    success: true,
    data: {
      name: packageJson.name,
      version: changelog.version,
      date: changelog.date,
      changelog: changelog.changelog,
      history: changelog.history,
    },
  });
};

module.exports = { getSystemInfo };
