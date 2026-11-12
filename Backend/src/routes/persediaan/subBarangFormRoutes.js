const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/subBarangFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/sub-barang
router.use(resolveMenuId);

router.get("/get-max-kode", verifyToken, checkPermission("view"), ctrl.getMaxKode);
router.get("/parent", verifyToken, checkPermission("view"), ctrl.getParent);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;