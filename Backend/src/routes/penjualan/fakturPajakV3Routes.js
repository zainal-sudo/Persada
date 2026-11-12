// routes/penjualan/fakturPajakV3Routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/fakturPajakV3Controller");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/refresh", verifyToken, checkPermission("view"), ctrl.refresh);
router.post("/export", verifyToken, checkPermission("view"), ctrl.exportExcel);

module.exports = router;