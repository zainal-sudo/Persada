const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/supplierFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/supplier
router.use(resolveMenuId);

router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
