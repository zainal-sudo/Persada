const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/groupProdukFokusController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/group-produk-fokus
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);

module.exports = router;