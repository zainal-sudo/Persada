const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/koreksiStokFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/koreksi-stok
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/search-sku", verifyToken, checkPermission("view"), ctrl.searchSKU);
router.get("/detail-sku", verifyToken, checkPermission("view"), ctrl.getDetailSKU);
router.get("/load-all", verifyToken, checkPermission("view"), ctrl.loadDataAll);
router.get("/from-hitung-stok", verifyToken, checkPermission("view"), ctrl.fromHitungStok);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;