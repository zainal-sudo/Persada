// routes/pembelian/returBeliFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/returBeliFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/retur-beli
router.use(resolveMenuId);

// Lookup
router.get("/search-invoice", verifyToken, checkPermission("view"), ctrl.searchInvoice);
router.get("/get-invoice/:nomor", verifyToken, checkPermission("view"), ctrl.getInvoice);
router.get("/search-barang", verifyToken, checkPermission("view"), ctrl.searchBarang);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;
