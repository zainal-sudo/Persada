// routes/pembelian/bayarSupplierFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/bayarSupplierFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/bayar-supplier
router.use(resolveMenuId);

// Lookup
router.get("/supplier", verifyToken, checkPermission("view"), ctrl.getSupplier);
router.get("/rekening", verifyToken, checkPermission("view"), ctrl.getRekening);
router.get("/invoice-by-supplier", verifyToken, checkPermission("view"), ctrl.getInvoiceBySupplier);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
