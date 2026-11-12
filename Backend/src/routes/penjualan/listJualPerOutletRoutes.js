// routes/penjualan/listJualPerOutletRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/listJualPerOutletController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);

module.exports = router;
