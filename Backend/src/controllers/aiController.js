// controllers/aiController.js
const aiService = require("../services/ai/aiService");
const auditLog = require("../services/ai/auditLog");

// Rate limit sederhana per user (in-memory).
// ponytail: in-memory, hanya valid per instance BE — ganti ke store bersama
// (Redis/DB) bila BE berjalan multi-instance.
const hits = new Map();
const LIMIT = 10; // request / user / menit
const WINDOW_MS = 60_000;

function checkRateLimit(code) {
  const now = Date.now();
  const arr = (hits.get(code) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    hits.set(code, arr);
    return false;
  }
  arr.push(now);
  hits.set(code, arr);
  // mencegah map membengkak — bersihkan entri lama dari waktu ke waktu
  if (hits.size > 1000) {
    for (const [k, v] of hits.entries()) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

const chat = async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "messages wajib berupa array." });
    }

    const code = req.user?.kode || "anon";
    if (!checkRateLimit(code)) {
      return res.status(429).json({
        success: false,
        message: "Terlalu banyak request. Tunggu beberapa saat lalu coba lagi.",
      });
    }

    const data = await aiService.chat({ messages, user: req.user });

    // Jejak percakapan (fail-safe) + id utk tombol 👍/👎.
    const q = [...(messages || [])].reverse().find((m) => m?.role === "user");
    try {
      data.chatLogId = await auditLog.logExchange(req.user, q?.content, data.answer, {
        sources: data.sources,
        tools: data.agent ? undefined : data.sources,
        numberCheck: data.numberCheck,
      });
    } catch {
      /* log tidak pernah mematahkan chat */
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// 👍/👎 pada jawaban asisten.
const feedback = async (req, res) => {
  try {
    const { chatLogId, thumb } = req.body || {};
    if (!chatLogId || ![1, -1].includes(Number(thumb))) {
      return res
        .status(400)
        .json({ success: false, message: "chatLogId dan thumb (1/-1) wajib." });
    }
    const ok = await auditLog.setThumb(chatLogId, thumb, req.user);
    if (!ok)
      return res
        .status(404)
        .json({ success: false, message: "Percakapan tidak ditemukan." });
    res.json({ success: true, message: "Terima kasih atas umpan baliknya." });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Chat streaming (SSE): event delta/clear/error, lalu done berisi jawaban
// final + meta (setelah audit). Gate & rate limit sama dengan /chat.
const chatStream = async (req, res) => {
  // Guard disconnect: klien/proxy bisa putus duluan (provider macet, timeout).
  // Tanpa handler ini, res.write() setelah putus melempar EPIPE → proses crash.
  let closed = false;
  req.on("close", () => { closed = true; });
  res.on("error", () => { closed = true; });
  const send = (event, payload) => {
    if (closed) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload ?? null)}\n\n`);
    } catch {
      closed = true;
    }
  };
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "messages wajib berupa array." });
    }

    const code = req.user?.kode || "anon";
    if (!checkRateLimit(code)) {
      return res.status(429).json({
        success: false,
        message: "Terlalu banyak request. Tunggu beberapa saat lalu coba lagi.",
      });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const data = await aiService.chatStream({
      messages,
      user: req.user,
      onEvent: (e) => send(e.type, e),
      isAborted: () => closed,
    });

    const q = [...(messages || [])].reverse().find((m) => m?.role === "user");
    if (data && !data.aborted) {
      try {
        data.chatLogId = await auditLog.logExchange(req.user, q?.content, data.answer, {
          sources: data.sources,
          numberCheck: data.numberCheck,
        });
      } catch {
        /* log tidak pernah mematahkan chat */
      }
    }

    send("done", data);
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: e.message });
    }
    send("error", { message: e.message });
    res.end();
  }
};

module.exports = { chat, chatStream, feedback };
