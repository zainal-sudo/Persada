const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/persediaan/tagihanEkspedisiFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

// Auto-resolve menuId dari path /persediaan/tagihan-ekspedisi
router.use(resolveMenuId);

router.get("/get-max-nomor", verifyToken, checkPermission("view"), ctrl.getMaxNomor);
router.get("/load-fp", verifyToken, checkPermission("view"), ctrl.loadFP);
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;