const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/hitungStokFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/hitung-stok
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/barang", verifyToken, checkPermission("view"), ctrl.getBarang);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;