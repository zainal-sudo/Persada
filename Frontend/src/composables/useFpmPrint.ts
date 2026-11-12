import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import { fakturManualApi } from "@/api/penjualan/fakturManualApi";
import { useQzPrint } from "@/composables/useQzPrint";
import PrinterDialog from "@/components/PrinterDialog.vue";
import PrintPreviewDialog from "@/components/PrintPreviewDialog.vue";

const { connect, getSavedPrinter, printRaw } = useQzPrint();

const LINES_PER_PAGE = 33;
const DATA_PER_PAGE = 13;

// ── Column widths — total 132 (same as SO/FP/DO) ─────────────────────
const totalW = 132;
const hNo = 5, hKode = 11, hNama = 51, hIdBatch = 10, hSat = 9, hQty = 8, hHrg = 14, hDisc = 7, hSub = 17;

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
  const truncated = Math.floor(abs * 100) / 100;
  const [intPart, decPart] = truncated.toFixed(2).split(".");
  return (neg ? "-" : "") + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + decPart;
};

const fmtQtyPrint = (v: number) => {
  const num = v || 0;
  const neg = num < 0;
  const abs = Math.abs(num);
  const truncated = Math.floor(abs * 100) / 100;
  const [intPart, decPart] = truncated.toFixed(2).split(".");
  const sign = neg ? "-" : "";
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart === "00") return sign + withThousands;
  return sign + withThousands + "." + decPart;
};

// ── Header lines ──────────────────────────────────────────────────────
const formatHeaderLines = (data: any): string[] => {
  return [
    padRight(data.perusahaan.nama || "", 90) + " " + padRight("F A K T U R   P E N J U A L A N", 40),
    // Paritas Delphi doslip2: alamat + notelp (bukan kota)
    padRight((data.perusahaan.alamat || "") + " " + (data.perusahaan.notelp || ""), totalW),
    padRight("NPWP : " + (data.perusahaan.npwp || ""), totalW),
    padRight("Nomor      : " + data.nomor, 60) + " " + padRight("Customer : " + data.cusNama, 60),
    padRight("Tanggal    : " + data.tanggal, 60) + " " + padRight(data.cusAlamat || "", 60),
    // Paritas Delphi doslip2: Jth Tempo + Salesman + Memo satu baris
    padRight("Jth Tempo  : " + data.jthTempo, 60) + " " +
    padRight("Salesman : " + data.salesman, 30) + " " +
    padRight("Memo : " + (data.memo || ""), 28),
    "-".repeat(totalW),
    padRight("No", hNo) + padRightGap("Kode", hKode) + padRight("Nama Barang", hNama) +
    padRight("ID Batch", hIdBatch) + padRight("Satuan", hSat) + padLeft("Jumlah", hQty) +
    padLeft("Disc(%)", hDisc) + padLeft("Harga", hHrg) + padLeft("Total", hSub),
    "-".repeat(totalW),
  ];
};

// ── Detail line ───────────────────────────────────────────────────────
const formatDetailLine = (i: number, d: any): string => {
  const sub = d.total || ((100 - (d.discpr || 0)) / 100 * (d.harga || 0) * (d.qty || 0));
  return (
    padRight(String(i), hNo) +
    padRightGap(String(d.kode ?? "").trim(), hKode) +
    padRight(String(d.nama ?? "").trim(), hNama) +
    padRight(String(d.idBatch ?? "").trim(), hIdBatch) +
    padRight(String(d.satuan ?? "").trim(), hSat) +
    padLeft(fmtQtyPrint(d.qty || 0), hQty) +
    padLeft(d.discpr ? String(d.discpr) : "", hDisc) +
    padLeft(fmtPrint(d.harga || 0), hHrg) +
    padLeft(fmtPrint(sub), hSub)
  );
};

// ── Footer lines (paritas Delphi doslip2, semua baris @132) ───────────
const footerLines = (data: any): string[] => {
  const rightStart = 94;   // 94 + 1 + 15 + 1 + 21 = 132
  const colLabel = 15;
  const colVal = 21;       // sejajar SO/FP
  const fullTerb = "Terbilang : " + (data.terbilang || "") + " RUPIAH";

  const fl: string[] = [];
  fl.push(
    padRight(fullTerb.substring(0, 90), rightStart) + " " +
    padRight("Disc faktur   :", colLabel) + " " +
    padLeft(fmtPrint(data.adiscfaktur || 0), colVal)
  );
  fl.push(
    padRight(fullTerb.substring(90, 170), rightStart) + " " +
    padRight("Total         :", colLabel) + " " +
    padLeft(fmtPrint(data.anilai || 0), colVal)
  );
  fl.push(
    padRight(fullTerb.substring(170, 250), rightStart) + " " +
    padRight("Ppn           :", colLabel) + " " +
    padLeft(fmtPrint(data.appn || 0), colVal)
  );
  // Paritas Delphi: tanda tangan digabung baris Freight
  fl.push(
    padRight("   Disiapkan,", 32) + padRight(" Disetujui,", 32) + padRight("Penerima,", 31) +
    padRight("Freight       :", colLabel) + " " +
    padLeft(fmtPrint(data.afreight || 0), colVal)
  );
  // Grand Total di baris sendiri (paritas Delphi — tidak menumpuk tanda tangan)
  fl.push(
    padRight("", rightStart) + " " +
    padRight("Grand Total   :", colLabel) + " " +
    padLeft(fmtPrint(data.atotal || 0), colVal)
  );
  fl.push("");
  fl.push(
    padRight("", 1) + " " +
    padRight("(               )", 30) + " " +
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
      // 9 header + 13 item + 1 separator + 10 = 33 baris pas satu halaman.
      for (let a = 0; a < 10; a++) lines.push("");
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
      for (let a = 0; a < 10; a++) commands.push(NL);
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

export function useFpmPrint() {
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
      const data = await fakturManualApi.getPrintData(nomor);
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
