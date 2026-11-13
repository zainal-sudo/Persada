const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/tools/masterUserController");
const {
  verifyToken,
  checkPermission,
} = require("../../middleware/authMiddleware");

router.get("/", verifyToken, checkPermission("view"), ctrl.getBrowse);
router.delete(
  "/:kode",
  verifyToken,
  checkPermission("delete"),
  ctrl.deleteUser,
);

module.exports = router;
