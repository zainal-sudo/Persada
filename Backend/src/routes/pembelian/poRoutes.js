// routes/pembelian/poRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/pembelian/poController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /pembelian/po
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.get("/print/:nomor", verifyToken, checkPermission("print"), ctrl.getPrintData);
router.get("/baris-slip/:nama", verifyToken, ctrl.getBarisSlip);
router.put("/close/:nomor", verifyToken, checkPermission("edit"), ctrl.toggleClose);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;
