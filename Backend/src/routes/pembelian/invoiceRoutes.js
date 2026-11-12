// routes/pembelian/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/invoiceController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/invoice
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.get("/print/:nomor", verifyToken, checkPermission("print"), ctrl.getPrintData);
router.get("/baris-slip/:nama", verifyToken, ctrl.getBarisSlip);
router.get("/history-pembayaran/:nomor", verifyToken, checkPermission("view"), ctrl.getHistoryPembayaran);
router.put("/toggle-pajak/:nomor", verifyToken, checkPermission("edit"), ctrl.togglePajak);
router.put("/set-no-pajak/:nomor", verifyToken, checkPermission("edit"), ctrl.setNoPajak);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;
