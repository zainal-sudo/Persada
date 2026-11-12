const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/settingBiayaPromosiFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/setting-biaya-promosi
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/customer", verifyToken, checkPermission("view"), ctrl.getCustomer);
router.get("/barang", verifyToken, checkPermission("view"), ctrl.getBarang);
router.get("/all-item", verifyToken, checkPermission("view"), ctrl.getAllItem);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;