// routes/pembelian/bpbFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/bpbFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/bpb
router.use(resolveMenuId);

// Lookup
router.get("/supplier", verifyToken, checkPermission("view"), ctrl.getSupplier);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/open-po", verifyToken, checkPermission("view"), ctrl.getOpenPO);
router.get("/detail-po/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailByPO);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
