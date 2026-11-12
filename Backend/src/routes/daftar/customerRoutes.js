const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/customerController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/customer
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.put("/lock/:kode", verifyToken, checkPermission("edit"), ctrl.updateLocked);

module.exports = router;