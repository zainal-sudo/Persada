// routes/penjualan/returPenjualanFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/returPenjualanFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/search-fp", verifyToken, checkPermission("view"), ctrl.searchFP);
router.get("/get-fp/:nomor", verifyToken, checkPermission("view"), ctrl.getFP);
router.get("/search-barang", verifyToken, checkPermission("view"), ctrl.searchBarang);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/cn-faktur", verifyToken, checkPermission("view"), ctrl.getCNFaktur);
router.get("/sisa-piutang/:nomorFaktur", verifyToken, checkPermission("view"), ctrl.getSisaPiutang);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;