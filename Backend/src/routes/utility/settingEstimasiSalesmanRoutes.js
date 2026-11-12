// routes/utility/settingEstimasiSalesmanRoutes.js
// Menu Delphi: Utility -> Setting Estimasi Salesman (form transaksi grid).
// Hak akses: lookup/load = view, save = checkPermission("save") yang
// otomatis jadi insert (baru) / edit (sudah ada) via req.body.isEdit —
// paritas cekinsert/cekedit Delphi di cxButton1Click.
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/settingEstimasiSalesmanController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/salesman", verifyToken, checkPermission("view"), ctrl.getSalesman);
router.get("/customers", verifyToken, checkPermission("view"), ctrl.getCustomers);
router.get("/load", verifyToken, checkPermission("view"), ctrl.load);
router.post("/save", verifyToken, checkPermission("save"), ctrl.save);

module.exports = router;
