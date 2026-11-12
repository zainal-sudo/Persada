const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/kendaraanFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/kendaraan
router.use(resolveMenuId);

router.get("/:nopol", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;