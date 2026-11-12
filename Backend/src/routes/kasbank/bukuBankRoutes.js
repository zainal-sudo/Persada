const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/kasbank/bukuBankController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /kasbank/buku-bank
router.use(resolveMenuId);

router.get("/rekening", verifyToken, checkPermission("view"), ctrl.getRekening);
router.get("/", verifyToken, checkPermission("view"), ctrl.getBukuBank);

module.exports = router;