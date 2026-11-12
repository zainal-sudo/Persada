// routes/penjualan/serahTerimaFakturSalesmanFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/serahTerimaFakturSalesmanFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
router.get("/salesman", verifyToken, checkPermission("view"), ctrl.getSalesman);
router.get("/invoice", verifyToken, checkPermission("view"), ctrl.getInvoice);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;