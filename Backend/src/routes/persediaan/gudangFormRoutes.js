const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/gudangFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/gudang
router.use(resolveMenuId);

router.get("/get-max-kode", verifyToken, checkPermission("view"), ctrl.getMaxKode);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;