const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/permintaanBarangController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/permintaan-barang
router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);
router.put("/closed/:nomor", verifyToken, checkPermission("edit"), ctrl.toggleClosed);

module.exports = router;