// routes/persediaan/serahTerimaEkspedisiFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/serahTerimaEkspedisiFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/serah-terima-ekspedisi/form
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/load", verifyToken, checkPermission("view"), ctrl.load);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
