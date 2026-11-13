const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/tools/masterUserFormController");
const {
  verifyToken,
  checkPermission,
} = require("../../middleware/authMiddleware");

router.get("/cabang", verifyToken, checkPermission("view"), ctrl.getCabangList);
router.get("/menus", verifyToken, checkPermission("view"), ctrl.getAllMenus);
router.get("/detail/:kode", verifyToken, checkPermission("view"), ctrl.getDetail);
router.post("/save", verifyToken, checkPermission("save"), ctrl.save);

module.exports = router;
