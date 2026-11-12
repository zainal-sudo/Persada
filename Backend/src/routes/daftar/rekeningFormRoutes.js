const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/daftar/rekeningFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /daftar/rekening
router.use(resolveMenuId);

router.get("/kelompok", verifyToken, checkPermission("view"), ctrl.getKelompok);
router.get("/cek-kode", verifyToken, checkPermission("view"), ctrl.cekKode);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;