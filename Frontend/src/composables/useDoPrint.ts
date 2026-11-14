import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import { doApi, type DOprintData } from "@/api/penjualan/doApi";
import { useQzPrint } from "@/composables/useQzPrint";
import PrinterDialog from "@/components/PrinterDialog.vue";
import PrintPreviewDialog from "@/components/PrintPreviewDialog.vue";

const { connect, getSavedPrinter, printRaw } = useQzPrint();

// ponytail: rows/halaman di-hardcode; Delphi hormati tabel `barisslip` (getbarisslip('DO')).
// Upgrade path: panggil doApi.getBarisSlip('DO') di loadAndPreview → pakai sbg DATA_PER_PAGE.
const LINES_PER_PAGE = 33;
const DATA_PER_PAGE = 16;

const totalW = 132;
const hNo = 5, hKode = 11, hNama = 61, hED = 9, hBatch = 11, hSat = 9, hQty = 8, hGdg = 17;

const padRight = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
const padLeft = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
const padRightGap = (str: string, len: number): string =>
  padRight(str, Math.max(len - 1, 0)) + " ";
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

const getDisplayName = (d: { nama: string }): string => String(d.nama ?? "").trim();

const getED = (tgl_expired: string | null): string => {
  if (!tgl_expired) return "";
  const yr = new Date(tgl_expired).getFullYear();
  if (yr <= 2000) return "";
  const exp = new Date(tgl_expired);
  const dd = String(exp.getDate()).padStart(2, "0");
  const mm = String(exp.getMonth() + 1).padStart(2, "0");
  const yy = String(exp.getFullYear()).slice(-2);
  return dd + "/" + mm + "/" + yy;
};

const formatHeaderLines = (data: DOprintData): string[] => {
  return [
    padRight(data.perusahaan.nama, 90) + " " + padRight("S U R A T   J A L A N", 40),
    padRight(data.perusahaan.alamat + ", " + data.perusahaan.kota, totalW),
    padRight(data.perusahaan.notelp, totalW),
    "",
    padRight("Nomor      : " + data.nomor, 60) + " " + padRight("Customer : " + data.cus_nama, 60),
    padRight("Tanggal    : " + data.tanggal, 60) + " " + padRight(data.cus_alamat, 60),
    padRight("Kirim ke   : " + data.shipaddress, 60) + " " + padRight("Salesman : " + data.salesman, 60),
    "-".repeat(totalW),
    padRight("No", hNo) + padRightGap("Kode", hKode) + padRight("Nama Barang", hNama) + padRight("ED", hED) + padRight("Id Batch", hBatch) + padRight("Satuan", hSat) + padLeft("Jumlah", hQty) + " " + padRight("Gudang", hGdg),
    "-".repeat(totalW),
  ];
};

const formatDetailLine = (i: number, d: DOprintData["detail"][0]): string => {
  return (
    padRight(String(i), hNo) +
    padRightGap(String(d.kode ?? "").trim(), hKode) +
    padRight(getDisplayName(d), hNama) +
    padRight(getED(d.tgl_expired), hED) +
    padRight(String(d.idBatch ?? "").trim(), hBatch) +
    padRight(String(d.satuan ?? "").trim(), hSat) +
    padLeft(fmtQtyPrint(d.qty), hQty) + " " +
    padRight(String(d.gudang ?? "").trim(), hGdg)
  );
};

const footerLines = (): string[] => [
  padRight("", 22) + " " +
  padRight("DiSiapkan oleh,", 34) + " " +
  padRight("Pengirim ,", 32) + " " +
  padRight("Penerima ,", 30),
  "",
  "",
  padRight("", 21) + " " +
  padRight("(               )", 32) + " " +
  padRight("(               )", 32) + " " +
  padRight("(               )", 30),
  "",
  "",
];

// ── Generate preview text lines (tanpa ESC/POS codes) ─────────────
const generatePreviewDO = (data: DOprintData): string[] => {
  const lines: string[] = [];

  lines.push(...formatHeaderLines(data));

  let i = 0;
  for (const d of data.detail) {
    i++;
    lines.push(formatDetailLine(i, d));

    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      lines.push("-".repeat(totalW));
      // 10 header + 16 item + 1 separator + 6 = 33 baris pas satu halaman.
      for (let a = 0; a < 6; a++) lines.push("");
      lines.push(...formatHeaderLines(data));
    }
  }

  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) lines.push("");
  }
  lines.push("-".repeat(totalW));
  lines.push(...footerLines());

  return lines;
};

const generateEscPosDO = (data: DOprintData): string[] => {
  const NL = "\r\n";
  const ESC = "\x1B";
  const SI = "\x0F";
  const commands: string[] = [];

  commands.push(ESC + "@", SI, ESC + "2");
  commands.push(ESC + "C" + String.fromCharCode(LINES_PER_PAGE));
  commands.push(ESC + "d" + "\x00");

  for (const line of formatHeaderLines(data)) {
    commands.push(line + NL);
  }

  let i = 0;
  for (const d of data.detail) {
    i++;
    commands.push(formatDetailLine(i, d) + NL);

    if (i % DATA_PER_PAGE === 0 && i < data.detail.length) {
      commands.push("-".repeat(totalW) + NL);
      for (let a = 0; a < 6; a++) commands.push(NL);
      for (const line of formatHeaderLines(data)) commands.push(line + NL);
    }
  }

  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) commands.push(NL);
  }
  commands.push("-".repeat(totalW) + NL);
  for (const line of footerLines()) commands.push(line + NL);

  return commands;
};

/**
 * Logika cetak DO (Surat Jalan dot matrix) — dipakai bersama oleh
 * DOBrowseView dan DOFormView saat "Simpan & Cetak" (paritas cxButton3 Delphi).
 */
export function useDoPrint() {
  const toast = useToast();
  const isPrinting = ref(false);
  const showPrinterDialog = ref(false);
  const showPreviewDialog = ref(false);
  const previewLines = ref<string[]>([]);
  const pageCount = computed(() => Math.max(1, Math.ceil(previewLines.value.length / LINES_PER_PAGE)));
  const cachedPrintData = ref<DOprintData | null>(null);

  // Muat data cetak + tampilkan preview (jika printer belum diset → dialog printer dulu)
  const loadAndPreview = async (nomor: string) => {
    const savedPrinter = getSavedPrinter();
    if (!savedPrinter) {
      showPrinterDialog.value = true;
      return;
    }
    isPrinting.value = true;
    try {
      const data = await doApi.getPrintData(nomor);
      cachedPrintData.value = data;
      previewLines.value = generatePreviewDO(data);
      showPreviewDialog.value = true;
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat data cetak.");
    } finally {
      isPrinting.value = false;
    }
  };

  const onPrinterSaved = () => {
    showPrinterDialog.value = false;
    if (cachedPrintData.value) {
      previewLines.value = generatePreviewDO(cachedPrintData.value);
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
      const flatCmds = generateEscPosDO(cachedPrintData.value);
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
