<script setup lang="ts">
import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import {
  IconMessageCircle, IconX, IconSend, IconCopy, IconTrash,
  IconThumbUp, IconThumbDown, IconPlayerStop, IconInfoCircle,
} from "@tabler/icons-vue";
import {
  chatWithAi, chatWithAiStream, sendAiFeedback, type AiChatMessage,
} from "@/api/aiApi";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  error?: boolean;
  chatLogId?: number;
  thumb?: 1 | -1;
  usage?: number;
}

const toast = useToast();
const open = ref(false);
const input = ref("");
const loading = ref(false);
const messages = ref<UiMessage[]>([]);
const listEl = ref<HTMLElement | null>(null);
const abortCtrl = ref<AbortController | null>(null);
const debugTok = ref(localStorage.getItem("ai_debug_tok") === "1");

const toggleDebugTok = () => {
  debugTok.value = !debugTok.value;
  localStorage.setItem("ai_debug_tok", debugTok.value ? "1" : "0");
};

const stop = () => {
  abortCtrl.value?.abort();
};

const fmtTok = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const SOURCE_LABELS: Record<string, string> = {
  realisasi_penjualan: "Realisasi Penjualan",
  faktur_outstanding: "Faktur Outstanding",
  saldo_piutang: "Saldo Piutang",
  kartu_stok: "Kartu Stok",
  dashboard_summary: "Dashboard/Briefing",
};

const QUICK_CHIPS = [
  "Briefing hari ini",
  "Penjualan bulan ini",
  "Faktur >120 hari",
  "Top penunggak piutang",
  "Stok kritis",
];

const canSend = computed(() => input.value.trim().length > 0 && !loading.value);

// Sederhana: format baris baru, heading/tebal, dan bullet. Bukan full markdown.
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderMd = (text: string) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/```[\s\S]*?```/g, (m) => `<code>${m.slice(3, -3)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n/g, "<br>");
};

const scrollBottom = () => {
  requestAnimationFrame(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
  });
};

const errMsg = (e: any) => {
  if (e?.message === "AUTH_EXPIRED") return "Sesi berakhir, silakan login ulang.";
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message && e.message !== "Failed to fetch") return e.message;
  return "Gagal terhubung ke AI. Coba lagi.";
};

const send = async (preset?: string) => {
  const text = (preset ?? input.value).trim();
  if (!text || loading.value) return;
  input.value = "";

  messages.value.push({ role: "user", content: text });
  loading.value = true;
  scrollBottom();

  const history: AiChatMessage[] = messages.value.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
    sources: m.sources,
  }));

  const bi = messages.value.push({ role: "assistant", content: "" }) - 1;
  let streamed = false;
  const ctrl = new AbortController();
  abortCtrl.value = ctrl;
  try {
    const res = await chatWithAiStream(
      history,
      {
        onDelta: (t) => {
          streamed = true;
          messages.value[bi].content += t;
          scrollBottom();
        },
        onClear: () => {
          messages.value[bi].content = "";
          scrollBottom();
        },
      },
      ctrl.signal
    );
    messages.value[bi].content = res.answer;
    messages.value[bi].sources = res.sources || [];
    messages.value[bi].chatLogId = res.chatLogId;
    if (res.usage?.total_tokens) messages.value[bi].usage = res.usage.total_tokens;
  } catch (e: any) {
    // User menekan Stop → teks parsial tetap, tanpa error & tanpa fallback.
    if (e?.name === "AbortError") {
      if (!messages.value[bi].content) messages.value[bi].content = "_(perintah dihentikan)_";
      return;
    }
    // Streaming putus di tengah (tanpa jawaban final) → tarik jawaban final
    // lewat jalur JSON; partial text tetap tampil sampai final datang.
    if (!streamed || /terputus/i.test(String(e?.message || ""))) {
      try {
        const res = await chatWithAi(history);
        messages.value[bi].content = res.answer;
        messages.value[bi].sources = res.sources || [];
        messages.value[bi].chatLogId = res.chatLogId;
      } catch (e2: any) {
        messages.value[bi].content = errMsg(e2);
        messages.value[bi].error = true;
        toast.error(errMsg(e2));
      }
    } else {
      messages.value[bi].content = errMsg(e);
      messages.value[bi].error = true;
      toast.error(errMsg(e));
    }
  } finally {
    loading.value = false;
    abortCtrl.value = null;
    scrollBottom();
  }
};

const copyMsg = (m: UiMessage) => {
  navigator.clipboard?.writeText(m.content);
  toast.success("Disalin.");
};

const clearChat = () => {
  messages.value = [];
  toast.success("Percakapan dibersihkan.");
};

const rate = async (m: UiMessage, thumb: 1 | -1) => {
  if (!m.chatLogId || m.thumb) return;
  try {
    const ok = await sendAiFeedback(m.chatLogId, thumb);
    if (ok) {
      m.thumb = thumb;
      toast.success("Terima kasih atas umpan baliknya.");
    }
  } catch {
    toast.error("Gagal mengirim umpan balik.");
  }
};

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};
</script>

<template>
  <button class="ai-fab" :aria-label="open ? 'Tutup chat' : 'Buka chat'" @click="open = !open">
    <IconX v-if="open" :size="22" />
    <IconMessageCircle v-else :size="22" />
    <span class="ai-fab-badge">AI</span>
  </button>

  <transition name="ai-pop">
    <div v-if="open" class="ai-panel">
      <div class="ai-head">
        <div>
          <div class="ai-title">AMP AI Assistant</div>
          <div class="ai-sub">Analisis bisnis cabang anda</div>
        </div>
        <div class="ai-actions">
          <button class="ai-icon-btn" title="Info penggunaan token" @click="toggleDebugTok">
            <IconInfoCircle :size="15" />
          </button>
          <button class="ai-icon-btn" title="Bersihkan percakapan" @click="clearChat">
            <IconTrash :size="15" />
          </button>
          <button class="ai-icon-btn" title="Tutup" @click="open = false">
            <IconX :size="15" />
          </button>
        </div>
      </div>

      <div ref="listEl" class="ai-list">
        <div v-if="messages.length === 0" class="ai-empty">
          <p>Selamat datang ! Tanya tentang bisnis AM PERSADA, misalnya:</p>
          <ul>
            <li>"Bagaimana realisasi penjualan bulan ini?"</li>
            <li>"Faktur mana yang sudah lewat jatuh tempo?"</li>
            <li>"Siapa customer dengan saldo piutang terbesar?"</li>
            <li>"Stok barang apa yang paling banyak keluar?"</li>
          </ul>
        </div>

        <div
          v-for="(m, i) in messages"
          :key="i"
          class="ai-row"
          :class="m.role === 'user' ? 'is-user' : 'is-ai'"
        >
          <div
            v-if="m.role === 'user' || m.content || m.error"
            class="ai-bubble"
            :class="m.role === 'user' ? 'b-user' : m.error ? 'b-error' : 'b-ai'"
          >
            <span v-html="renderMd(m.content)"></span>
          </div>
          <div class="ai-meta">
            <template v-if="m.role === 'assistant' && m.sources?.length">
              <span class="ai-src">Sumber: {{ m.sources.map((s) => SOURCE_LABELS[s] || s).join(", ") }}</span>
            </template>
            <span v-if="m.role === 'assistant' && debugTok && m.usage" class="ai-tok">≈{{ fmtTok(m.usage) }} token</span>
            <button class="ai-copy" @click="copyMsg(m)">Salin</button>
            <template v-if="m.role === 'assistant' && !m.error && m.chatLogId">
              <button
                class="ai-rate"
                :class="{ active: m.thumb === 1 }"
                :disabled="!!m.thumb"
                title="Jawaban membantu"
                @click="rate(m, 1)"
              >
                <IconThumbUp :size="13" />
              </button>
              <button
                class="ai-rate"
                :class="{ active: m.thumb === -1 }"
                :disabled="!!m.thumb"
                title="Jawaban kurang tepat"
                @click="rate(m, -1)"
              >
                <IconThumbDown :size="13" />
              </button>
            </template>
          </div>
        </div>

        <div v-if="loading" class="ai-row is-ai">
          <div class="ai-bubble b-ai ai-typing"><span></span><span></span><span></span></div>
        </div>
      </div>

      <div class="ai-inputbar">
        <textarea
          v-model="input"
          rows="2"
          class="ai-input"
          placeholder="Tanyakan soal penjualan, piutang, stok..."
          :disabled="loading"
          @keydown="onKey"
        ></textarea>
        <button
          class="ai-send"
          :class="{ 'is-stop': loading }"
          :disabled="!loading && !canSend"
          :title="loading ? 'Hentikan jawaban' : 'Kirim'"
          @click="loading ? stop() : send()"
        >
          <IconPlayerStop v-if="loading" :size="17" />
          <IconSend v-else :size="17" />
        </button>
      </div>

      <div class="ai-chips">
        <button
          v-for="chip in QUICK_CHIPS"
          :key="chip"
          class="ai-chip"
          :disabled="loading"
          @click="send(chip)"
        >
          {{ chip }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ai-fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #0369a1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(27, 45, 74, 0.35);
  z-index: 2400;
}
.ai-fab:hover {
  background: #0284c7;
}
.ai-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #c62828;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
}

.ai-panel {
  position: fixed;
  right: 18px;
  bottom: 80px;
  width: 400px;
  max-width: calc(100vw - 20px);
  height: 560px;
  max-height: calc(100vh - 110px);
  background: #fff;
  border: 1px solid #a0aab8;
  box-shadow: 0 8px 30px rgba(27, 45, 74, 0.22);
  display: flex;
  flex-direction: column;
  z-index: 2401;
  font-size: 13px;
}

.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0369a1;
  color: #fff;
  padding: 10px 12px;
  border-bottom: 3px solid #c62828;
}
.ai-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ai-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
}
.ai-actions {
  display: flex;
  gap: 2px;
}
.ai-icon-btn {
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  opacity: 0.9;
}
.ai-icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.ai-list {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 10px 12px;
  background: #eef1f5;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-empty {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  margin: auto;
}
.ai-empty ul {
  text-align: left;
  padding-left: 16px;
  margin-top: 6px;
}

.ai-row {
  display: flex;
  flex-direction: column;
  max-width: 88%;
}
.ai-row.is-user {
  align-self: flex-end;
  align-items: flex-end;
}
.ai-row.is-ai {
  align-self: flex-start;
  align-items: flex-start;
}
.ai-bubble {
  padding: 8px 10px;
  line-height: 1.45;
  border-radius: 0;
  word-break: break-word;
  white-space: pre-line;
}
.b-user {
  background: #0369a1;
  color: #fff;
}
.b-ai {
  background: #fff;
  border: 1px solid #c4cad3;
  color: #1f2937;
}
.b-error {
  background: #ffebee;
  border: 1px solid #ef9a9a;
  color: #b71c1c;
}
.ai-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 10.5px;
  color: #8494a7;
}
.ai-src {
  font-style: italic;
}
.ai-tok {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
.ai-copy {
  border: none;
  background: transparent;
  color: #0284c7;
  cursor: pointer;
  font-size: 10.5px;
  padding: 0;
}
.ai-copy:hover {
  text-decoration: underline;
}
.ai-rate {
  border: none;
  background: transparent;
  color: #8494a7;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}
.ai-rate:hover:not(:disabled) {
  color: #0284c7;
}
.ai-rate.active {
  color: #059669;
}
.ai-rate:disabled {
  cursor: default;
  opacity: 0.7;
}

.ai-typing span {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 3px;
  background: #8494a7;
  border-radius: 50%;
  animation: aiBlink 1.2s infinite;
}
.ai-typing span:nth-child(2) { animation-delay: 0.2s; }
.ai-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes aiBlink {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}

.ai-inputbar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border-top: 1px solid #c4cad3;
  padding: 8px;
  background: #fff;
}
.ai-input {
  flex: 1 1 0;
  resize: none;
  border: 1px solid #a0aab8;
  border-radius: 0;
  padding: 7px 9px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  min-height: 36px;
  max-height: 120px;
}
.ai-input:focus {
  border-color: #0284c7;
}
.ai-send {
  width: 38px;
  height: 38px;
  border: none;
  background: #0369a1;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ai-send:disabled {
  background: #c4cad3;
  cursor: not-allowed;
}
.ai-send.is-stop {
  background: #c62828;
}

.ai-chips {
  display: flex;
  gap: 5px;
  padding: 6px 8px;
  background: #fff;
  border-top: 1px solid #e3e8ef;
  overflow-x: auto;
}
.ai-chip {
  border: 1px solid #a0aab8;
  background: #f0f3f8;
  color: #0369a1;
  font-size: 10.5px;
  font-family: inherit;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.ai-chip:hover:not(:disabled) {
  background: #0284c7;
  color: #fff;
  border-color: #0369a1;
}
.ai-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-pop-enter-active,
.ai-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.ai-pop-enter-from,
.ai-pop-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>