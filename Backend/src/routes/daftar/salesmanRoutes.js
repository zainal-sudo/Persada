const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/salesmanController");
const { verifyToken } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");
const { checkPermission } = require("../../middleware/authMiddleware");

// Auto-resolve menuId dari path /daftar/salesman
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);

module.exports = router;