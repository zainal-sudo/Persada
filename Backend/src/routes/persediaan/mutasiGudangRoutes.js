const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/mutasiGudangController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/mutasi-gudang
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.put("/realisasi/:nomor", verifyToken, checkPermission("edit"), ctrl.toggleRealisasi);

module.exports = router;