// routes/utility/prosesBiayaPromosiRoutes.js
// Menu Delphi: Utility -> Proses Biaya Promosi.
// Pola hak akses mengikuti tutupPeriodeRoutes: pratinjau = view,
// proses = insert (operasi tulis, satu-satunya di modul ini).
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/utility/prosesBiayaPromosiController");
const { verifyToken, checkPermission } = require("../../middleware/authMiddleware");
const { resolveMenuId } = require("../../middleware/resolveMenuId");

router.use(resolveMenuId);

router.get("/pratinjau", verifyToken, checkPermission("view"), ctrl.pratinjau);
router.post("/proses", verifyToken, checkPermission("insert"), ctrl.proses);

module.exports = router;
