import { ref, onMounted, onUnmounted, computed } from "vue";
import api from "@/api/axios";

// Ping /api/health untuk mengukur latensi DB/server (real, bukan label statis).
// Dipakai di AppSidebar footer & status bar bawah.
export function useLatency(intervalMs = 30000) {
  const latency = ref<number | null>(null);
  const online = ref(false);
  const database = ref<string | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  const ping = async () => {
    const t0 = performance.now();
    try {
      const res = await api.get("/health");
      latency.value = Math.round(performance.now() - t0);
      online.value = true;
      database.value = res.data?.database ?? null;
    } catch {
      latency.value = null;
      online.value = false;
      database.value = null;
    }
  };

  onMounted(() => {
    ping();
    timer = setInterval(ping, intervalMs);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  const host = computed(
    () => window.location.hostname || "localhost",
  );

  return { latency, online, host, database, ping };
}