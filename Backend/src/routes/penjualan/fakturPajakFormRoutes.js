// routes/penjualan/fakturPajakFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/fakturPajakFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/refresh", verifyToken, checkPermission("view"), ctrl.refresh);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;