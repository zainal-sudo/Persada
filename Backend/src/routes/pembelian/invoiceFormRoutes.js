// routes/pembelian/invoiceFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/invoiceFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/invoice
router.use(resolveMenuId);

// Lookup
router.get("/supplier", verifyToken, checkPermission("view"), ctrl.getSupplier);
router.get("/open-bpb", verifyToken, checkPermission("view"), ctrl.getOpenBPB);
router.get("/detail-bpb/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailByBPB);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/top", verifyToken, checkPermission("view"), ctrl.getTop);
router.get("/check-no-bukti", verifyToken, checkPermission("view"), ctrl.checkNoBukti);
router.get("/toleransi-hbl", verifyToken, checkPermission("view"), ctrl.getToleransiHbl);
router.get("/cek-lastcost", verifyToken, checkPermission("view"), ctrl.cekLastCost);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
