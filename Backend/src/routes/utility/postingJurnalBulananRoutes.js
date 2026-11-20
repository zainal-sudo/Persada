const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/postingJurnalBulananController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(verifyToken);
router.use(resolveMenuId);

router.get("/pratinjau", checkPermission("view"), ctrl.pratinjau);
router.post("/proses", checkPermission("insert"), ctrl.proses);

module.exports = router;
