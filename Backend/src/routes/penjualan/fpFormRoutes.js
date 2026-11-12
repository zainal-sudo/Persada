// routes/penjualan/fpFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/fpFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/search-so", verifyToken, checkPermission("view"), ctrl.searchSO);
router.get("/load-so/:nomor", verifyToken, checkPermission("view"), ctrl.loadSO);
router.get("/get-cn", verifyToken, checkPermission("view"), ctrl.getDiscCN);
router.get("/get-top", verifyToken, checkPermission("view"), ctrl.getTop);
router.get("/get-retur", verifyToken, checkPermission("view"), ctrl.getNilaiRetur);
router.get("/get-dp", verifyToken, checkPermission("view"), ctrl.getDP);
router.get("/get-cn-faktur", verifyToken, checkPermission("view"), ctrl.getCNFaktur);
router.get("/margin-data", verifyToken, checkPermission("view"), ctrl.getMarginData);
router.get("/disc-sales", verifyToken, checkPermission("view"), ctrl.getDiscSales);
router.get("/riwayat-harga", verifyToken, checkPermission("view"), ctrl.getRiwayatHarga);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;