// routes/penjualan/soFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/soFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /penjualan/so
router.use(resolveMenuId);

// Lookup
router.get("/customer", verifyToken, checkPermission("view"), ctrl.getCustomer);
router.get("/salesman-aktif", verifyToken, checkPermission("view"), ctrl.getSalesmanAktif);
router.get("/rekening", verifyToken, checkPermission("view"), ctrl.getRekening);
router.get("/barang", verifyToken, checkPermission("view"), ctrl.getBarang);
router.get("/salesman", verifyToken, checkPermission("view"), ctrl.getSalesman);

// Utility
router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/check-locked", verifyToken, checkPermission("view"), ctrl.checkCustomerLocked);
router.get("/disc-sales", verifyToken, checkPermission("view"), ctrl.getDiscSales);
router.get("/lastcost", verifyToken, checkPermission("view"), ctrl.getLastCost);
router.get("/riwayat-harga", verifyToken, checkPermission("view"), ctrl.getRiwayatHarga);

// Ambil SO dari database kedua
router.get("/ambil-so", verifyToken, checkPermission("view"), ctrl.getAmbilSO);
router.get("/detail-so/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailAmbilSO);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save (paritas Delphi: insert utk baru, edit utk ubah — lihat checkPermission "save")
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;