const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/kasbank/pencairanGiroFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /kasbank/pencairan-giro
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/search-giro", verifyToken, checkPermission("view"), ctrl.searchGiro);
router.get("/rekening", verifyToken, checkPermission("view"), ctrl.getRekening);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("insert"), ctrl.saveData);

module.exports = router;