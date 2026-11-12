// routes/persediaan/serahTerimaEkspedisiRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/serahTerimaEkspedisiController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
// Cetak: mode slip ditentukan dari ste_tipe di dalam service, dan endpoint
// ini sekaligus menandai ste_realisasi = 1 (paritas teslip/steslip3).
router.get("/print/:nomor", verifyToken, checkPermission("view"), ctrl.getPrintData);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteDoc);

module.exports = router;
