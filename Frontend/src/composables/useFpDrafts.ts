// composables/useFpDrafts.ts
// Draft lokal form FP (localStorage). Simpan form apa adanya termasuk
// flag otorisasi per baris, supaya baris yang sudah diotorisasi tidak
// minta ulang saat draft dibuka kembali.
import type { FPForm } from "@/api/penjualan/fpFormApi";

export interface FpDraft {
  id: string;
  nama: string;
  savedAt: string; // ISO
  data: FPForm;
}

const STORAGE_KEY = "bsm_fp_drafts";
const MAX_DRAFTS = 10;
const MAX_AGE_MS = 7 * 86400000;

const uid = (): string =>
  (crypto as any)?.randomUUID?.() ??
  `d${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

export const isFormDirty = (f: FPForm): boolean =>
  !!(f.cusKode || f.nomorSO || f.memo || (f.detail || []).length);

export const draftRingkas = (d: FpDraft): string => {
  const total = (d.data.detail || []).length;
  const ok = (d.data.detail || []).filter((x) => x.otorisasi === 1).length;
  const who = d.data.cusNama || d.data.nomorSO || "tanpa nama";
  return `${who} | ${total} baris${ok ? `, ${ok} terotorisasi` : ""}`;
};

export const useFpDrafts = () => {
  const persist = (list: FpDraft[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  // Buang draft kedaluwarsa (>7 hari) dan paling lama jika melebihi batas.
  const loadDrafts = (): FpDraft[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list: FpDraft[] = Array.isArray(parsed) ? parsed : [];
      const cutoff = Date.now() - MAX_AGE_MS;
      const fresh = list.filter((d) => new Date(d.savedAt).getTime() >= cutoff);
      const trimmed = fresh.slice(-MAX_DRAFTS);
      if (trimmed.length !== list.length) persist(trimmed);
      return trimmed;
    } catch {
      return [];
    }
  };

  // Group by nomor SO: simpan draft dengan SO yang sama menggantikan draft
  // lama (satu draft per SO, tidak dobel). Draft tanpa SO tidak di-dedupe.
  const saveDraft = (data: FPForm, nama?: string): FpDraft => {
    let list = loadDrafts();
    if (data.nomorSO) {
      list = list.filter((d) => d.data.nomorSO !== data.nomorSO);
    }
    const draft: FpDraft = {
      id: uid(),
      nama: nama?.trim() || buatNamaDraft(data),
      savedAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(data)),
    };
    list.push(draft);
    persist(list.slice(-MAX_DRAFTS));
    return draft;
  };

  const removeDraft = (id: string) => {
    persist(loadDrafts().filter((d) => d.id !== id));
  };

  return { loadDrafts, saveDraft, removeDraft };
};

export const buatNamaDraft = (data: FPForm): string => {
  const t = new Date();
  const jam = t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const tgl = t.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
  const who = data.cusNama || data.nomorSO || "Tanpa nama";
  return `FP ${who} — ${tgl} ${jam}`;
};