const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/formasiController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.delete("/:id", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;
