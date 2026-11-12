const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/permintaanBarangFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/permintaan-barang
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/search-sku", verifyToken, checkPermission("view"), ctrl.searchSKU);
router.get("/detail-sku", verifyToken, checkPermission("view"), ctrl.getDetailSKU);
router.get("/search-pb", verifyToken, checkPermission("view"), ctrl.searchPB);
router.get("/load-pb", verifyToken, checkPermission("view"), ctrl.loadPB);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;