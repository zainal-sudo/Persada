// services/ai/aiService.js
// Orkestrasi chat: intent → tool (laporan existing) → snapshot ringkas →
// kirim ke 9Router (OpenAI-compatible) → jawaban.
const aiCfg = require("../../config/ai");
const { buildSystemPrompt } = require("./knowledgeBase");
const intent = require("./intent");
const tools = require("./tools");
const summary = require("./summarizer");
const agent = require("./agent");

// Kirim chat ke 9Router.
async function callRouter(messages) {
  const url = `${aiCfg.routerUrl}/v1/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (aiCfg.routerKey) headers.Authorization = `Bearer ${aiCfg.routerKey}`;
  // RTK 9Router memampatkan output tool; untuk data bisnis presisi lebih
  // penting daripada hemat token → bypass khusus chat krm.
  if (aiCfg.bypassTokenSaver) headers["X-9Router-Token-Saver"] = "off";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), aiCfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: aiCfg.model,
        messages,
        stream: false,
        max_tokens: aiCfg.maxTokens,
        temperature: aiCfg.temperature ?? 0,
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) throw new Error("NINEROUTER_KEY tidak valid (401).");
  if (res.status === 402)
    throw new Error("Kredit provider AI habis (402). Cek/top-up combo di dashboard 9Router, lalu coba lagi.");
  if (res.status === 503)
    throw new Error("Semua akun provider 9Router sedang tidak tersedia (503). Cek combo bsmchat di dashboard.");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`9Router error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// Ambil snapshot tiap tool yang cocok.
async function buildSnapshots(user, params) {
  const out = [];
  for (const [id, p] of Object.entries(params)) {
    try {
      const result = await tools.exec(id, p, user);
      const snap = tools.summarize(result);
      out.push({ tool: result.tool, params: p, snapshot: snap });
    } catch (e) {
      out.push({ tool: id, error: e.message });
    }
  }
  return out;
}

// Validasi + normalisasi pesan (dipakai chat & chatStream).
function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0)
    throw new Error("messages wajib diisi.");
  const norm = messages.slice(-8).map((m) => {
    if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000)
      throw new Error("Pesan harus berisi role user/assistant dan teks maksimal 12000 karakter.");
    return { role: m.role, content: m.content, sources: Array.isArray(m.sources) ? m.sources.filter((id) => intent.toolIds().includes(id)) : [] };
  });
  if (norm[norm.length - 1].role !== "user") throw new Error("Pesan terakhir harus dari user.");
  return norm;
}

async function chat({ messages = [], user }) {
  if (!user) throw new Error("User tidak terdeteksi.");
  const norm = normalizeMessages(messages);

  // Mode agen (function calling) dulu; gagal apapun → pipeline lama utuh.
  if (aiCfg.agentEnabled) {
    try {
      return await agent.chat({ messages: norm, user });
    } catch (e) {
      console.warn("[AI] agent gagal, fallback pipeline lama:", e.message);
    }
  }
  return legacyChat({ messages: norm, user });
}

// Versi streaming: delta/clear mengalir via onEvent; done dikirim pemanggil
// (controller) setelah audit. Gagal agen di tengah → fallback legacy utuh.
async function chatStream({ messages, user, onEvent = () => {}, isAborted }) {
  if (!user) throw new Error("User tidak terdeteksi.");
  const norm = normalizeMessages(messages);

  if (aiCfg.agentEnabled) {
    try {
      return await agent.chat({
        messages: norm,
        user,
        hooks: {
          stream: true,
          onDelta: (t) => onEvent({ type: "delta", t }),
          onClear: () => onEvent({ type: "clear" }),
          isAborted,
        },
      });
    } catch (e) {
      console.warn("[AI] stream agent gagal, fallback pipeline lama:", e.message);
      onEvent({ type: "clear" });
      return await legacyChat({ messages: norm, user });
    }
  }
  return legacyChat({ messages: norm, user });
}

async function legacyChat({ messages, user }) {
  const lastUserMsg = messages[messages.length - 1];
  if (!lastUserMsg) throw new Error("Tidak ada pesan user.");

  const q = String(lastUserMsg.content || "").trim();
  if (!q) throw new Error("Pertanyaan kosong.");

  // ── Resolusi konteks follow-up ────────────────────────────────────────
  // Pesan terakhir user bisa jadi follow-up biasa ("lha kalau bulan agustus?")
  // ATAU balasan atas tawaran asisten ("Mau saya tarik detail...?" → "boleh").
  // Cari 1) pertanyaan user sebelumnya, 2) tawaran asisten terakhir + sumber
  // laporannya — yang relevan dipakai sebagai konteks induk.
  const userMsgs = messages.filter((m) => m.role === "user");
  const parentMsg = userMsgs.length > 1 ? userMsgs[userMsgs.length - 2] : null;

  let parentSources = [];
  let lastAssistant = null;
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistant = messages[i];
      if (Array.isArray(messages[i].sources)) parentSources = messages[i].sources;
      break;
    }
    if (messages[i].role === "user") break;
  }

  let periodContext = null;
  for (const message of userMsgs.slice(0, -1)) {
    periodContext = intent.requestedPeriod(message.content, periodContext) || periodContext;
  }
  if (!parentSources.length && parentMsg) {
    parentSources = intent.analyze(parentMsg.content, intent.explicitPeriod("")).tools;
  }
  const analyzed = intent.resolveConversation(
    q,
    parentMsg?.content || "",
    parentSources,
    lastAssistant?.content || "",
    periodContext,
  );
  if (analyzed.ask) return {
    answer: analyzed.ask, sources: [], model: aiCfg.model, toolCount: 0, periodAssumed: false,
  };
  const usedContext = analyzed.inherited?.length > 0;

  // Balasan setuju atas tawaran asisten → eksekusi detail yang ditawarkan.
  if (analyzed.replyMode === "accept" && analyzed.detailFocus) {
    for (const id of Object.keys(analyzed.params || {})) {
      analyzed.params[id].detailFocus = analyzed.detailFocus;
    }
  }

  const snapshots = await buildSnapshots(user, analyzed.params);
  const sources = snapshots
      .filter((s) => !s.error)
      .map((s) => (s.tool.includes(".") ? s.tool.split(".")[0] : s.tool));

    const isFinance = aiCfg.isFinanceUser(user);
    const systemPrompt = buildSystemPrompt({
      userName: user.nama || user.kode,
      userKode: user.kode,
      cabang: user.cabangNama || user.cabang,
      isFinance,
    });

    // Konteks data + pertanyaan.
    const ctxContent = snapshots
      .filter((s) => !s.error)
      .map(
        (s) =>
          `LAPORAN: ${s.tool}\nPARAMETER: ${summary.compact(s.params || {})}\nDATA: ${summary.compact(s.snapshot)}`,
      )
      .join("\n\n");
    const errContent = snapshots
      .filter((s) => s.error)
      .map((s) => `LAPORAN ${s.tool}: GAGAL DIEKSEKUSI (${s.error})`)
      .join("\n");

    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    const ctxNote = usedContext
      ? `\nCatatan: pertanyaan ini adalah lanjutan dari diskusi sebelumnya — jawab secara kontekstual terhadap data laporan di atas.`
      : "";
    const acceptNote =
      analyzed.replyMode === "accept"
        ? "Catatan: user menyetujui tawaran yang kamu berikan sebelumnya. Jawab langsung dengan hasil sesuai permintaan itu."
        : "";
    const detailNote =
      analyzed.detailFocus
        ? `Catatan: data berikut sudah disaring untuk fokus "${analyzed.detailFocus}". Tekankan angka & temuan pada subset ini.`
        : "";
    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content:
          `PERTANYAAN USER:\n${q}\n\n` +
          (usedContext
            ? `(dianggap lanjutan dari laporan ${analyzed.tools.join(", ")})${ctxNote}\n`
            : "") +
          (acceptNote ? `${acceptNote}\n` : "") +
          (detailNote ? `${detailNote}\n` : "") +
          (ctxContent ? `=== DATA LAPORAN (snapshot) ===\n${ctxContent}\n` : "") +
          (errContent ? `=== LAPORAN GAGAL ===\n${errContent}\n` : "") +
          (snapshots.length === 0 ? "\nTidak ada laporan baru yang diambil. Jawab percakapan dari konteks; jangan mengklaim telah mengecek data ERP." : ""),
      },
    ];

  const answer = await callRouter(llmMessages);

  return {
    answer,
    sources,
    model: aiCfg.model,
    toolCount: snapshots.length,
    periodAssumed: analyzed.replyMode === "accept" ? Boolean(analyzed.detailFocus) : analyzed.tools.length > 0,
    replyMode: analyzed.replyMode,
  };
}

// Health check 9Router saat boot (di panggil app.js).
async function healthCheck() {
  const url = `${aiCfg.routerUrl}/api/health`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = res.ok ? await res.json() : {};
    return { ok: res.ok, ...body };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chat, chatStream, healthCheck };