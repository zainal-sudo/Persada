const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/barangController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/barang
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:kode", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.put("/aktif/:kode", verifyToken, checkPermission("edit"), ctrl.toggleAktif);

module.exports = router;