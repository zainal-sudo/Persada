const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/dashboardController");
const { verifyToken } = require("../middleware/authMiddleware");

// Endpoint: GET /api/dashboard/summary (?db= utk Pusat+FINANCE/OWNER)
router.get("/summary", verifyToken, ctrl.getSummary);
// Endpoint: GET /api/dashboard/cabang — daftar cabang utk dropdown
router.get("/cabang", verifyToken, ctrl.listCabang);

module.exports = router;
