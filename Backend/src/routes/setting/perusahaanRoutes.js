// routes/setting/perusahaanRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/setting/perusahaanController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.get);
router.put("/", verifyToken, checkPermission("edit"), ctrl.update);

module.exports = router;
