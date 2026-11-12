// routes/utility/penugasanDriverRoutes.js
// Menu Delphi: Utility -> Penugasan Driver (ufrmPenugasanDriver).
// Hak akses: lookup/do-list = view, assign = checkPermission("edit")
// (Delphi tidak mengecek hak di form ini; web menagih — keputusan gap doc §5.2).
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/penugasanDriverController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/driver", verifyToken, checkPermission("view"), ctrl.getDriver);
router.get("/customers", verifyToken, checkPermission("view"), ctrl.getCustomers);
router.get("/do-list", verifyToken, checkPermission("view"), ctrl.getDoList);
router.post("/assign", verifyToken, checkPermission("edit"), ctrl.assign);

module.exports = router;
