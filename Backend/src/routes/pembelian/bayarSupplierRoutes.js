// routes/pembelian/bayarSupplierRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/bayarSupplierController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/bayar-supplier
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.get("/print/:nomor", verifyToken, checkPermission("print"), ctrl.getPrintData);
router.get("/baris-slip/:nama", verifyToken, ctrl.getBarisSlip);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;
