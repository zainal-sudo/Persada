// routes/pembelian/poFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/poFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/po
router.use(resolveMenuId);

// Lookup
router.get("/supplier", verifyToken, checkPermission("view"), ctrl.getSupplier);
router.get("/barang", verifyToken, checkPermission("view"), ctrl.getBarang);
router.get("/hitung-stok", verifyToken, checkPermission("view"), ctrl.getHitungStok);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/riwayat-harga", verifyToken, checkPermission("view"), ctrl.getRiwayatHarga);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
