import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import { ttFakturApi } from "@/api/penjualan/ttFakturApi";
import { useQzPrint } from "@/composables/useQzPrint";
import PrinterDialog from "@/components/PrinterDialog.vue";
import PrintPreviewDialog from "@/components/PrintPreviewDialog.vue";

const { connect, getSavedPrinter, printRaw } = useQzPrint();

const LINES_PER_PAGE = 33;
const DATA_PER_PAGE = 13;

// ── Column widths — total 132 (same as SO/FP/DO) ─────────────────────
const totalW = 132;
const hNo = 5, hNomor = 22, hTgl = 22, hJt = 22, hNilai = 20;

const padRight = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
const padLeft = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
const padRightGap = (str: string, len: number): string =>
  padRight(str, Math.max(len - 1, 0)) + " ";

const fmtPrint = (v: number) => {
  const num = v || 0;
  const neg = num < 0;
  const abs = Math.abs(num);
  const truncated = Math.floor(abs);
  return (neg ? "-" : "") + truncated.toLocaleString("id-ID", { maximumFractionDigits: 2 });
};

// ── Header lines ──────────────────────────────────────────────────────
const formatHeaderLines = (data: any): string[] => {
  return [
    padRight(data.perusahaan.nama || "", 90) + " " + padRight("T A N D A   T E R I M A   F A K T U R", 40),
    padRight((data.perusahaan.alamat || "") + (data.perusahaan.kota ? ", " + data.perusahaan.kota : ""), totalW),
    padRight(data.perusahaan.notelp || "", totalW),
    "",
    padRight("Nomor     : " + data.nomor, 60) + " " + padRight("Customer : " + data.cusNama, 60),
    padRight("Tanggal   : " + data.tanggal, 60) + " " + padRight(data.cusAlamat || "", 60),
    padRight("Salesman  : " + data.salesman, 60),
    "-".repeat(totalW),
    padRight("No", hNo) + padRight("Nomor Faktur", hNomor) + padRight("Tanggal", hTgl) +
    padRight("Jt. Tempo", hJt) + padLeft("Nilai", hNilai),
    "-".repeat(totalW),
  ];
};

// ── Detail line ───────────────────────────────────────────────────────
const formatDetailLine = (i: number, d: any): string => {
  return (
    padRight(String(i), hNo) +
    padRight(d.fpNomor || "", hNomor) +
    padRight(d.tanggal || "", hTgl) +
    padRight(d.jt || "", hJt) +
    padLeft(fmtPrint(d.nilai || 0), hNilai)
  );
};

// ── Footer lines ──────────────────────────────────────────────────────
const footerLines = (data: any): string[] => {
  const colLabel = 15;
  const colVal = 20;
  const rightStart = totalW - colLabel - colVal - 2;

  const fl: string[] = [];
  fl.push(
    padRight("Disiapkan oleh,", 24) + " " +
    padRight("Yang Menyerahkan,", 30) + " " +
    padRight("Penerima,", 30) + " " +
    padRight("Total          :", colLabel) + " " +
    padLeft(fmtPrint(data.total || 0), colVal)
  );
  fl.push("");
  fl.push("");
  fl.push(
    padRight("(               )", 24) + " " +
    padRight("(               )", 30) + " " +
    padRight("(               )", 30)
  );
  fl.push("");
  fl.push("");
  return fl;
};

// ── Preview text lines ────────────────────────────────────────────────
const generateLines = (data: any): string[] => {
  const lines: string[] = [...formatHeaderLines(data)];

  let i = 0;
  for (const d of data.detail || []) {
    i++;
    lines.push(formatDetailLine(i, d));

    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      lines.push("-".repeat(totalW));
      // 10 header + 13 item + 1 separator + 9 = 33 baris pas satu halaman.
      for (let a = 0; a < 9; a++) lines.push("");
      lines.push(...formatHeaderLines(data));
    }
  }

  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) lines.push("");
  }
  lines.push("-".repeat(totalW));
  lines.push(...footerLines(data));

  return lines;
};

// ── ESC/POS commands ──────────────────────────────────────────────────
const generateEscPos = (data: any): string[] => {
  const NL = "\r\n", ESC = "\x1B", SI = "\x0F";
  const commands: string[] = [];
  commands.push(ESC + "@", SI, ESC + "2", ESC + "C" + String.fromCharCode(LINES_PER_PAGE), ESC + "d" + "\x00");
  for (const line of formatHeaderLines(data)) commands.push(line + NL);

  let i = 0;
  for (const d of data.detail || []) {
    i++;
    commands.push(formatDetailLine(i, d) + NL);
    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      commands.push("-".repeat(totalW) + NL);
      for (let a = 0; a < 9; a++) commands.push(NL);
      for (const line of formatHeaderLines(data)) commands.push(line + NL);
    }
  }

  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) commands.push(NL);
  }
  commands.push("-".repeat(totalW) + NL);
  for (const line of footerLines(data)) commands.push(line + NL);

  return commands;
};

export function useTtPrint() {
  const toast = useToast();
  const isPrinting = ref(false);
  const showPrinterDialog = ref(false);
  const showPreviewDialog = ref(false);
  const previewLines = ref<string[]>([]);
  const pageCount = computed(() => Math.max(1, Math.ceil(previewLines.value.length / LINES_PER_PAGE)));
  const cachedPrintData = ref<any>(null);

  const loadAndPreview = async (nomor: string) => {
    const savedPrinter = getSavedPrinter();
    if (!savedPrinter) {
      showPrinterDialog.value = true;
      return;
    }
    isPrinting.value = true;
    try {
      const data = await ttFakturApi.getPrintData(nomor);
      cachedPrintData.value = data;
      previewLines.value = generateLines(data);
      showPreviewDialog.value = true;
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat data cetak.");
    } finally {
      isPrinting.value = false;
    }
  };

  const onPrinterSaved = (printerName: string) => {
    showPrinterDialog.value = false;
    if (cachedPrintData.value) {
      previewLines.value = generateLines(cachedPrintData.value);
      showPreviewDialog.value = true;
    }
  };

  // Selalu printRaw (satu job): printer yang memecah halaman lewat ESC C 33,
  // dan tiap halaman disusun pas 33 baris. Jangan kembali ke
  // splitFlatToPages — fungsi itu membuang semua baris kosong, padahal
  // baris kosong itulah celah antar halaman.
  const onPrintFromPreview = async () => {
    showPreviewDialog.value = false;
    const savedPrinter = getSavedPrinter();
    if (!savedPrinter || !cachedPrintData.value) {
      toast.warning("Printer belum diset.");
      return;
    }
    isPrinting.value = true;
    try {
      const flatCmds = generateEscPos(cachedPrintData.value);
      await connect();
      await printRaw(savedPrinter, flatCmds);
    } catch (e: any) {
      toast.error(e.message || "Gagal mencetak ke printer.");
    } finally {
      isPrinting.value = false;
      cachedPrintData.value = null;
    }
  };

  return {
    isPrinting,
    showPrinterDialog,
    showPreviewDialog,
    previewLines,
    pageCount,
    cachedPrintData,
    loadAndPreview,
    onPrinterSaved,
    onPrintFromPreview,
    PrinterDialog,
    PrintPreviewDialog,
  };
}
