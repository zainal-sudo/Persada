// routes/persediaan/titipRoutes.js
// Titip Barang Konsinyasi — browse + form + delete.
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/titipController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/titip
router.use(resolveMenuId);

// ── Browse ───────────────────────────────────────────────────────────
router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/detail/:nomor", verifyToken, checkPermission("view"), ctrl.getBrowseDetail);
router.delete("/:nomor", verifyToken, checkPermission("delete"), ctrl.deleteData);

// ── Form ─────────────────────────────────────────────────────────────
router.get("/form/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/form/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/form/barang", verifyToken, checkPermission("view"), ctrl.searchBarang);
router.get("/form/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/form/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
