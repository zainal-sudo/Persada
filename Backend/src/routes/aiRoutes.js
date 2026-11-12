// routes/aiRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/aiController");
const { verifyToken } = require("../middleware/authMiddleware");
const aiCfg = require("../config/ai");

// AI hanya untuk user terpilih (FINANCE/OWNER/MGR) — FE menyembunyikan widget,
// ini lapisan kedua di server.
function gateAi(req, res, next) {
  if (!aiCfg.isAiUser(req.user))
    return res
      .status(403)
      .json({ success: false, message: "Akses AI tidak tersedia untuk user ini." });
  next();
}

// POST /api/ai/chat
router.post("/chat", verifyToken, gateAi, ctrl.chat);
// POST /api/ai/chat/stream — SSE: delta/clear/error lalu done
router.post("/chat/stream", verifyToken, gateAi, ctrl.chatStream);
// POST /api/ai/feedback — 👍/👎 pada jawaban (id dari chat)
router.post("/feedback", verifyToken, gateAi, ctrl.feedback);

module.exports = router;
