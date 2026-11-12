const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/subBarangController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/sub-barang
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.delete("/:kode", verifyToken, checkPermission("delete"), ctrl.deleteData);

module.exports = router;