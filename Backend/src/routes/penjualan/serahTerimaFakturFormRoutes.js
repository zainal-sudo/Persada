// routes/penjualan/serahTerimaFakturFormRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/penjualan/serahTerimaFakturFormController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/get-nomor", verifyToken, checkPermission("view"), ctrl.getNomor);
// Lookup penyerah/penerima (tuser dengan user_faktur = 1)
router.get("/users", verifyToken, checkPermission("view"), ctrl.getUsers);
// Antrean faktur milik satu pihak (fp_status_faktur = penyerah)
router.get("/invoice", verifyToken, checkPermission("view"), ctrl.getInvoice);

// Load form edit
router.get("/:nomor", verifyToken, checkPermission("view"), ctrl.getDetailForm);

// Save (paritas Delphi: insert untuk baru, edit untuk ubah)
router.post("/save", verifyToken, checkPermission("save"), ctrl.saveData);

module.exports = router;
