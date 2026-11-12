// routes/laporan/historyHargaJualRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/laporan/historyHargaJualController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail", verifyToken, checkPermission("view"), ctrl.getDetail);

module.exports = router;