const express = require("express");
const router = express.Router();
const controller = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/cabang", controller.getCabang);
router.post("/login", controller.login);
router.get("/users", controller.getUsers);
router.get("/client-dn", controller.clientDn); // DEBUG sementara
router.get("/me", verifyToken, controller.me);
router.post("/change-password", verifyToken, controller.changePassword);

module.exports = router;
