// routes/penjualan/doFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/doFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /penjualan/do
router.use(resolveMenuId);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);

// Search SO
router.get("/search-so", verifyToken, checkPermission("view"), ctrl.searchSO);
router.get("/load-so/:nomor", verifyToken, checkPermission("view"), ctrl.loadSO);

// Lookup
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/driver", verifyToken, checkPermission("view"), ctrl.getDriver);

// Stok
router.get("/search-stok", verifyToken, checkPermission("view"), ctrl.searchStok);
router.get("/detail-stok", verifyToken, checkPermission("view"), ctrl.getDetailStok);
router.get("/stok", verifyToken, checkPermission("view"), ctrl.getStok);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;