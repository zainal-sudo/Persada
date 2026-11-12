const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const systemCtrl = require("./controllers/systemController");
const apiRoutes = require("./routes");
const aiService = require("./services/ai/aiService");
const aiCfg = require("./config/ai");
const db = require("./config/database");
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();

// ── CORS ──
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      callback(null, origin);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use("/images", express.static(path.join(process.cwd(), "public/images")));

// Endpoint cek versi backend
app.get("/api/system/info", systemCtrl.getSystemInfo);

// ── Semua API route ──
app.use("/api", apiRoutes);

// ── Health check ──
app.get("/api/health", verifyToken, async (req, res) => {
  let database = null;
  try {
    const [rows] = await db.query("SELECT DATABASE() AS nama");
    database = rows[0]?.nama ?? null;
  } catch { /* server tetap online walau query gagal */ }
  res.json({
    success: true,
    message: "Finance Backend is running",
    timestamp: new Date(),
    database,
  });
});

const PORT = process.env.PORT || 3089;
app.listen(PORT, () => {
  console.log(`🚀 Server Finance running on port ${PORT}`);
  // Cek ketersediaan 9Router (tidak memblokir startup)
  aiService.healthCheck().then((h) => {
    if (h.ok) console.log("🤖 9Router OK:", aiCfg?.routerUrl || "http://localhost:20128");
    else console.log("⚠️  9Router tidak terhubung:", h.error || h.message || "unknown");
  });
});

module.exports = app;