const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/barangFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/barang
router.use(resolveMenuId);

router.get("/get-max-kode", verifyToken, checkPermission("view"), ctrl.getMaxKode);
router.get("/tipe-barang", verifyToken, checkPermission("view"), ctrl.getTipeBarang);
router.get("/kategori", verifyToken, checkPermission("view"), ctrl.getKategori);
router.get("/gudang", verifyToken, checkPermission("view"), ctrl.getGudang);
router.get("/supplier", verifyToken, checkPermission("view"), ctrl.getSupplier);
router.get("/divisi", verifyToken, checkPermission("view"), ctrl.getDivisi);
router.get("/harga-jual-jenis", verifyToken, checkPermission("view"), ctrl.getHargaJualJenis);
router.get("/:kode", verifyToken, checkPermission("view"), ctrl.getDetailForm);
// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;