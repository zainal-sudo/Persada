const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/salesmanFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/salesman
router.use(resolveMenuId);

router.get("/get-max-kode", verifyToken, checkPermission("view"), ctrl.getMaxKode);
router.get("/target-bulanan", verifyToken, checkPermission("view"), ctrl.getTargetBulanan);
router.get("/detail/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;