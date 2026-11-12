// routes/penjualan/fpRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/fpController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.get("/print/:nomor", verifyToken, checkPermission("print"), ctrl.getPrintData);
router.put("/cetak/:nomor", verifyToken, checkPermission("print"), ctrl.setPrinted);
router.get("/baris-slip/:nama", verifyToken, ctrl.getBarisSlip);
router.put("/kembali/:nomor", verifyToken, checkPermission("edit"), ctrl.toggleKembali);
router.put("/bayar/:nomor", verifyToken, checkPermission("edit"), ctrl.toggleBayar);
router.get("/history-bayar/:nomor", verifyToken, checkPermission("view"), ctrl.getHistoryBayar);
router.get("/print-retur/:nomor", verifyToken, checkPermission("print"), ctrl.getPrintDataRetur);
router.get("/edit-jt/:nomor", verifyToken, checkPermission("view"), ctrl.getEditJt);
router.post("/edit-jt/save", verifyToken, checkPermission("edit"), ctrl.saveEditJt);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;