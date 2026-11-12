// routes/utility/cetakKunjunganRoutes.js
// Menu Delphi: Utility -> Cetak Kunjungan (ufrmCetakKunjungan).
// Modul laporan read-only — seluruh endpoint cukup hak "view".
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/cetakKunjunganController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/salesman", verifyToken, checkPermission("view"), ctrl.getSalesman);
router.get("/", verifyToken, checkPermission("view"), ctrl.getKunjungan);
router.get("/perusahaan", verifyToken, checkPermission("view"), ctrl.getPerusahaan);

module.exports = router;
