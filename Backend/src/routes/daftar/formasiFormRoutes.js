const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/formasiFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/options", verifyToken, checkPermission("view"), ctrl.getOptions);
router.get("/salesman-options", verifyToken, checkPermission("view"), ctrl.getSalesmanOptions);
router.get("/type-options", verifyToken, checkPermission("view"), ctrl.getTypeOptions);
router.get("/divisi-options", verifyToken, checkPermission("view"), ctrl.getDivisiOptions);
router.get("/target-bulanan", verifyToken, checkPermission("view"), ctrl.getTargetBulanan);
router.get("/detail/:id", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
