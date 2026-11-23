const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/salesmanAktifFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/salesman-aktif
router.use(resolveMenuId);

router.get("/formasi-options", verifyToken, checkPermission("view"), ctrl.getFormasiOptions);
router.get("/detail/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
