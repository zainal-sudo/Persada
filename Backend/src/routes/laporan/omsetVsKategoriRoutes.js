// routes/laporan/omsetVsKategoriRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/laporan/omsetVsKategoriController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/kategori", verifyToken, ctrl.getKategori);
router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);

module.exports = router;
