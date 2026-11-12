const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/menuController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/tree", verifyToken, ctrl.getMenuTree);
router.get("/items", verifyToken, ctrl.getAllMenus);
router.get("/hak-user/:kode", verifyToken, ctrl.getHakUser);
router.get("/user/:kode", verifyToken, ctrl.getMenuByUser);

module.exports = router;
