const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/kasbank/pembayaranLainFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /kasbank/pembayaran-lain
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/search-account", verifyToken, checkPermission("view"), ctrl.searchAccount);
router.get("/cost-center", verifyToken, checkPermission("view"), ctrl.searchCostCenter);
router.get("/customer", verifyToken, checkPermission("view"), ctrl.searchCustomer);
router.get("/kendaraan", verifyToken, checkPermission("view"), ctrl.searchKendaraan);
router.get("/ekspedisi", verifyToken, checkPermission("view"), ctrl.searchEkspedisi);
router.get("/cek-biaya", verifyToken, checkPermission("view"), ctrl.cekBiaya);
router.get("/cek-periode", verifyToken, checkPermission("view"), ctrl.cekPeriode);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;