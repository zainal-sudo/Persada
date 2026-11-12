const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/jenisCustomerFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/jenis-customer
router.use(resolveMenuId);

router.get("/get-max-kode", verifyToken, checkPermission("view"), ctrl.getMaxKode);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;