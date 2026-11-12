import api from "./axios";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export interface AiChatResponse {
  answer: string;
  sources: string[];
  model: string;
  toolCount: number;
  periodAssumed: boolean;
  chatLogId?: number;
  numberCheck?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// Chat agen = beberapa panggilan LLM berantai (30–100+ dtk) — beri ruang.
const CHAT_TIMEOUT = 300_000;

export const chatWithAi = (messages: AiChatMessage[]) =>
  api
    .post<{ success: boolean; data: AiChatResponse }>("/ai/chat", { messages }, { timeout: CHAT_TIMEOUT })
    .then((res) => res.data.data);

export const sendAiFeedback = (chatLogId: number, thumb: 1 | -1) =>
  api
    .post<{ success: boolean }>("/ai/feedback", { chatLogId, thumb }, { timeout: CHAT_TIMEOUT })
    .then((res) => res.data.success);

// Streaming SSE: teks mengalir via onDelta; done membawa jawaban final
// (kanonik, sudah melewati penjaga angka) + sources + chatLogId.
export const chatWithAiStream = async (
  messages: AiChatMessage[],
  handlers: { onDelta: (t: string) => void; onClear: () => void },
  signal?: AbortSignal
): Promise<AiChatResponse> => {
  const token = localStorage.getItem("finance_token");
  const res = await fetch("/api/ai/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = "";
    try {
      msg = (await res.json())?.message || "";
    } catch {
      /* body bukan JSON */
    }
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
      throw new Error("AUTH_EXPIRED");
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: AiChatResponse | null = null;
  let errored = "";

  const handle = (json: string) => {
    if (!json) return;
    let p: any;
    try {
      p = JSON.parse(json);
    } catch {
      return;
    }
    if (p.type === "delta" && typeof p.t === "string") handlers.onDelta(p.t);
    else if (p.type === "clear") handlers.onClear();
    else if (p.type === "done") result = p as AiChatResponse;
    else if (p.type === "error") errored = p.message || "Kesalahan AI.";
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        const t = line.trim();
        if (t.startsWith("data:")) handle(t.slice(5).trim());
      }
    }
  }

  if (errored) throw new Error(errored);
  if (!result) throw new Error("Streaming terputus sebelum selesai.");
  return result;
};
