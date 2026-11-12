import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import { soApi, type SOprintData } from "@/api/penjualan/soApi";
import { useQzPrint } from "@/composables/useQzPrint";
import PrinterDialog from "@/components/PrinterDialog.vue";
import PrintPreviewDialog from "@/components/PrintPreviewDialog.vue";

const { connect, getSavedPrinter, printRaw } = useQzPrint();

// ponytail: rows/halaman di-hardcode 13/33; Delphi hormati tabel `barisslip`.
// Upgrade path: panggil soApi.getBarisSlip(variant) sekali di loadAndPreview,
// pakai nilai itu utk DATA_PER_PAGE. Belum terlihat beda di printer saat ini.
const LINES_PER_PAGE = 33;
const DATA_PER_PAGE = 13;

export type SOVariant = "SO" | "SP" | "PF";

const VARIANTS: Record<SOVariant, { title: string; showPrice: boolean; replaceNomorSOtoPF: boolean }> = {
  SO: { title: "S A L E S   O R D E R",       showPrice: true,  replaceNomorSOtoPF: false },
  SP: { title: "S U R A T  P E S A N A N",    showPrice: false, replaceNomorSOtoPF: false },
  PF: { title: "P R O F O R M A  I N V O I C E", showPrice: true,  replaceNomorSOtoPF: true },
};
const DIALOG_TITLE: Record<SOVariant, string> = {
  SO: "Preview Sales Order",
  SP: "Preview Surat Pesanan",
  PF: "Preview Proforma Invoice",
};

const totalW = 132;
const hNo = 5, hKode = 11, hNama = 61, hSat = 9, hQty = 8, hHrg = 14, hDisc = 7, hSub = 17;
// Lebar gabungan utk SP (buang 3 kolom harga) → nama barang melebar.
const hNamaSP = hNama + hHrg + hDisc + hSub;

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

const displayNomor = (nomor: string, v: SOVariant) =>
  VARIANTS[v].replaceNomorSOtoPF ? nomor.replace("SO", "PF") : nomor;

const formatHeaderLines = (data: SOprintData, v: SOVariant): string[] => {
  const wNama = VARIANTS[v].showPrice ? hNama : hNamaSP;
  const colLine =
    padRight("No", hNo) +
    padRightGap("Kode", hKode) +
    padRight("Nama Barang", wNama) +
    padRight("Satuan", hSat) +
    padLeft("Jumlah", hQty) +
    (VARIANTS[v].showPrice
      ? padLeft("Harga", hHrg) + padLeft("Disc", hDisc) + padLeft("Total", hSub)
      : "");
  return [
    padRight(data.perusahaan.nama, 90) + " " + padRight(VARIANTS[v].title, 40),
    padRight(data.perusahaan.alamat + ", " + data.perusahaan.kota, totalW),
    padRight(data.perusahaan.notelp, totalW),
    "",
    padRight("Nomor      : " + displayNomor(data.nomor, v), 60) + " " + padRight("Customer : " + data.cus_nama, 60),
    padRight("Tanggal    : " + data.tanggal, 60) + " " + padRight(data.cus_alamat, 60),
    padRight("ShipAddress: " + data.shipaddress, 60) + " " + padRight(data.cus_telp + "/" + data.cus_fax, 60),
    "-".repeat(totalW),
    colLine,
    "-".repeat(totalW),
  ];
};

const formatDetailLine = (i: number, d: SOprintData["detail"][0], v: SOVariant): string => {
  const wNama = VARIANTS[v].showPrice ? hNama : hNamaSP;
  const base =
    padRight(String(i), hNo) +
    padRightGap(String(d.kode ?? "").trim(), hKode) +
    padRight(String(d.nama ?? "").trim(), wNama) +
    padRight(String(d.satuan ?? "").trim(), hSat) +
    padLeft(fmtQtyPrint(d.qty), hQty);
  if (!VARIANTS[v].showPrice) return base;
  const sub = (100 - d.discpr) / 100 * d.harga * d.qty;
  return (
    base +
    padLeft(fmtPrint(d.harga), hHrg) +
    padLeft(d.discpr ? d.discpr + "%" : "", hDisc) +
    padLeft(fmtPrint(sub), hSub)
  );
};

const footerLines = (data: SOprintData, v: SOVariant): string[] => {
  const terb = "Terbilang : " + (data.terbilang || "") + "RUPIAH";
  if (!VARIANTS[v].showPrice) {
    // SP (Surat Pesanan): hanya terbilang + blok tanda tangan — tanpa harga/total/PPN/UM.
    return [
      padRight(terb, totalW),
      "",
      "",
      padRight("", 24) + " " + padRight("Dibuat oleh,", 30) + " " + padRight("Mengetahui,", 38),
      "",
      padRight("", 21) + " " + padRight("(               )", 30) + " " + padRight("(               )", 30),
      "",
      "",
    ];
  }
  const fullTerb = terb;
  return [
    padRight(fullTerb.substring(0, 90), 94) + " " + padRight("Disc faktur   :", 15) + " " + padLeft(fmtPrint(data.discFaktur), 21),
    padRight(fullTerb.substring(90, 170), 94) + " " + padRight("Total         :", 15) + " " + padLeft(fmtPrint(data.nilai), 21),
    padRight("", 94) + " " + padRight("Ppn           :", 15) + " " + padLeft(fmtPrint(data.taxamount), 21),
    padRight("", 24) + " " + padRight("Dibuat oleh,", 30) + " " + padRight("Mengetahui,", 38) + " " + padRight("Grand Total   :", 15) + " " + padLeft(fmtPrint(data.total), 21),
    padRight("", 94) + " " + padRight("Uang Muka     :", 15) + " " + padLeft(fmtPrint(data.dp), 21),
    "",
    padRight("", 21) + " " + padRight("(               )", 30) + " " + padRight("(               )", 30),
    "",
    "",
  ];
};

const generatePreview = (data: SOprintData, v: SOVariant): string[] => {
  const lines = [...formatHeaderLines(data, v)];
  let i = 0;
  for (const d of data.detail) {
    i++;
    lines.push(formatDetailLine(i, d, v));
    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      lines.push("-".repeat(totalW));
      // 10 header + 13 item + 1 separator + 9 = 33 baris pas satu halaman.
      for (let a = 0; a < 9; a++) lines.push("");
      lines.push(...formatHeaderLines(data, v));
    }
  }
  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) lines.push("");
  }
  lines.push("-".repeat(totalW));
  lines.push(...footerLines(data, v));
  return lines;
};

const generateEscPos = (data: SOprintData, v: SOVariant): string[] => {
  const NL = "\r\n", ESC = "\x1B", SI = "\x0F";
  const commands: string[] = [];
  commands.push(ESC + "@", SI, ESC + "2", ESC + "C" + String.fromCharCode(LINES_PER_PAGE), ESC + "d" + "\x00");
  for (const line of formatHeaderLines(data, v)) commands.push(line + NL);
  let i = 0;
  for (const d of data.detail) {
    i++;
    commands.push(formatDetailLine(i, d, v) + NL);
    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      commands.push("-".repeat(totalW) + NL);
      for (let a = 0; a < 9; a++) commands.push(NL);
      for (const line of formatHeaderLines(data, v)) commands.push(line + NL);
    }
  }
  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) commands.push(NL);
  }
  commands.push("-".repeat(totalW) + NL);
  for (const line of footerLines(data, v)) commands.push(line + NL);
  return commands;
};

/**
 * Logika cetak SO (dot matrix 4-ply) — varian Sales Order (SO),
 * Surat Pesanan (SP, qty-only), Proforma Invoice (PF, nomor → PF).
 * Dipakai bersama oleh SOBrowseView (menu Cetak) dan SOFormView (Simpan & Cetak).
 */
export function useSoPrint() {
  const toast = useToast();
  const isPrinting = ref(false);
  const showPrinterDialog = ref(false);
  const showPreviewDialog = ref(false);
  const previewLines = ref<string[]>([]);
  const previewTitle = ref<string>(DIALOG_TITLE.SO);
  const pageCount = computed(() => Math.max(1, Math.ceil(previewLines.value.length / LINES_PER_PAGE)));
  const cachedPrintData = ref<SOprintData | null>(null);
  const cachedVariant = ref<SOVariant>("SO");

  const loadAndPreview = async (nomor: string, variant: SOVariant = "SO") => {
    const savedPrinter = getSavedPrinter();
    cachedVariant.value = variant;
    previewTitle.value = DIALOG_TITLE[variant];
    if (!savedPrinter) {
      showPrinterDialog.value = true;
      return;
    }
    isPrinting.value = true;
    try {
      const data = await soApi.getPrintData(nomor);
      cachedPrintData.value = data;
      previewLines.value = generatePreview(data, variant);
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
      previewLines.value = generatePreview(cachedPrintData.value, cachedVariant.value);
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
      const flatCmds = generateEscPos(cachedPrintData.value, cachedVariant.value);
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
    previewTitle,
    pageCount,
    cachedPrintData,
    cachedVariant,
    loadAndPreview,
    onPrinterSaved,
    onPrintFromPreview,
    PrinterDialog,
    PrintPreviewDialog,
  };
}
