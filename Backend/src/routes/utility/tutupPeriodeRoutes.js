// routes/utility/tutupPeriodeRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/tutupPeriodeController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/last", verifyToken, checkPermission("view"), ctrl.getLast);
router.post("/", verifyToken, checkPermission("insert"), ctrl.proses);
router.delete("/", verifyToken, checkPermission("delete"), ctrl.buka);

module.exports = router;