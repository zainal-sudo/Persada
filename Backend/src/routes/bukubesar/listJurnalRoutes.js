const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/bukubesar/listJurnalController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /bukubesar/list-jurnal
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getListJurnal);

module.exports = router;