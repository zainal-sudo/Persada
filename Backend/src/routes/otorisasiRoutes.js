// routes/otorisasiRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/otorisasiController");
const { verifyToken } = require("../middleware/authMiddleware");

// Kasir membuka dialog → backend catat konteks + kasih kode
router.post("/request", verifyToken, ctrl.request);

// Detail utk app mobile — publik (cabang ditemukan otomatis dari kode)
router.get("/:kode", ctrl.getDetail);

// Kasir ketik password di dialog web → verifikasi + tandai DONE
router.post("/:kode/verify", verifyToken, ctrl.verify);

module.exports = router;