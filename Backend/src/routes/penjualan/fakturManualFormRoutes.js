// routes/penjualan/fakturManualFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/fakturManualFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/search-so", verifyToken, checkPermission("view"), ctrl.searchSO);
router.get("/load-so/:nomor", verifyToken, checkPermission("view"), ctrl.loadSO);
router.get("/search-barang", verifyToken, checkPermission("view"), ctrl.searchBarang);
router.get("/get-top", verifyToken, checkPermission("view"), ctrl.getTop);
router.get("/dp", verifyToken, checkPermission("view"), ctrl.getDP);
router.get("/cn", verifyToken, checkPermission("view"), ctrl.getCN);
router.get("/harga", verifyToken, checkPermission("view"), ctrl.getHargaHistori);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;