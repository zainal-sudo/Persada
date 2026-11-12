const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/customerFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/customer
router.use(resolveMenuId);

router.get("/jenis-customer", verifyToken, checkPermission("view"), ctrl.getJenisCustomer);
router.get("/golongan-customer", verifyToken, checkPermission("view"), ctrl.getGolonganCustomer);
router.get("/marketing", verifyToken, checkPermission("view"), ctrl.getMarketing);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;