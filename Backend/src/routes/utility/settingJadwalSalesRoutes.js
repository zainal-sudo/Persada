// routes/utility/settingJadwalSalesRoutes.js
// Menu Delphi: Utility -> Setting Jadwal Sales (ufrmBrowseSetingJadwalSales +
// ufrmSetingJadwalSales). Hak akses: browse/lookup/load = view,
// save = checkPermission("save") -> insert/edit dinamis via req.body.isEdit,
// hapus = checkPermission("delete") — paritas cekdelete Delphi (yang di
// Delphi justru BUG menunjuk tCostCenter).
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/settingJadwalSalesController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.get("/salesman", verifyToken, checkPermission("view"), ctrl.getSalesman);
router.get("/customers", verifyToken, checkPermission("view"), ctrl.getCustomers);
router.get("/load", verifyToken, checkPermission("view"), ctrl.load);
router.post("/save", verifyToken, checkPermission("save"), ctrl.save);
router.post("/hapus", verifyToken, checkPermission("delete"), ctrl.hapus);

module.exports = router;
