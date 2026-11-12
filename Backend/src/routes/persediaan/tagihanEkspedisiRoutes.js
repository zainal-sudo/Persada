const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/tagihanEkspedisiController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/tagihan-ekspedisi
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);

module.exports = router;