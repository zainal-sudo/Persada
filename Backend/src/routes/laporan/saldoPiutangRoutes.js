// routes/laporan/saldoPiutangRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/laporan/saldoPiutangController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);

module.exports = router;