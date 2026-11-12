// routes/penjualan/serahTerimaFakturRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/serahTerimaFakturController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
// Data cetak (dipakai mode "st" dan mode "slip")
router.get("/print/:nomor", verifyToken, checkPermission("view"), ctrl.getPrintData);
// Realisasi: Delphi hanya memagari dengan hak buka browse + aturan peran di service
// (bukan cekedit), jadi di sini cukup "view" dan perannya diperiksa service.
router.put("/:nomor/realisasi", verifyToken, checkPermission("view"), ctrl.realisasi);

module.exports = router;
