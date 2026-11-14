import { ref, computed } from "vue";
import { useToast } from "vue-toastification";
import { fpApi, type FPprintData } from "@/api/penjualan/fpApi";
import { useQzPrint } from "@/composables/useQzPrint";
import PrinterDialog from "@/components/PrinterDialog.vue";
import PrintPreviewDialog from "@/components/PrintPreviewDialog.vue";

const { connect, getSavedPrinter, printRaw, generateEscPosFP } = useQzPrint();

const LINES_PER_PAGE = 33;

const padRight = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
const padLeft = (str: string, len: number): string =>
  str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
const padRightGap = (str: string, len: number): string =>
  padRight(str, Math.max(len - 1, 0)) + " ";
// ── Format angka — paritas Delphi FormatFloat ────────────────────────
// Doslip2 (Cetak) memakai:
//   FormatFloat('##,###,###.##', nilai) → bulatkan 2 desimal, SEMBUNYIKAN
//                                            kalau desimalnya nol
//   FormatFloat('##,###',        qty)    → bulatkan ke integer
// Web sebelumnya memakai Math.floor (memotong) dan selalu menempel ".00",
// sehingga 10.000 tampil "10,000.00" dan 250.000 tampil "249,999.99".
//
// "0" (bukan "#") di Delphi berarti digit wajib; "#" berarti "hanya kalau
// tidak nol". Jadi FormatFloat(..., 0) hasilnya string KOSONG — itu sebabnya
// Freight 0 tidak tercetak di Delphi. Di sini string kosong hanya dipakai
// kalau nilai inputnya benar-benar 0, supaya 0.001 tetap tampil "0".
//
// Pakai toFixed(2) langsung, bukan Math.round(x*100)/100: mengalikan dulu
// lalu membulatkan salah pada angka seperti 14583.335 (14583.335*100 =
// 1458333.5, sehingga terbulat ke .34 padahal nilai aslinya .3349999…).
// toFixed membulatkan nilai double yang sebenarnya, sama seperti Delphi.
const ribuan = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const fmt = (v: number) => {
  const num = v || 0;
  const sign = num < 0 ? "-" : "";
  const s = Math.abs(num).toFixed(2);
  const intPart = ribuan(s.slice(0, -3));
  if (s.endsWith(".00")) return num === 0 ? "" : sign + intPart;
  return sign + intPart + s.slice(-3);
};
const fmtQty = (v: number) => {
  const num = v || 0;
  const sign = num < 0 ? "-" : "";
  const r = Math.round(Math.abs(num));
  if (r === 0) return num === 0 ? "" : `${sign}0`;
  return `${sign}${ribuan(String(r))}`;
};

const totalW = 132;
const hNo = 5, hKode = 11, hNama = 51, hBatch = 10, hSat = 9, hQty = 8, hHrg = 12, hDisc = 9, hSub = 17;
const DATA_PER_PAGE = 10;

const alamatLengkap = (d: FPprintData) =>
  [d.perusahaan.alamat, d.perusahaan.kota].filter((v) => v && v !== "-").join(", ");

const formatHeaderLines = (d: FPprintData): string[] => {
  return [
    padRight(d.perusahaan.nama, 90) + " " + padRight("F A K T U R   P E N J U A L A N", 40),
    padRight(alamatLengkap(d), 132),
    padRight("Telp : " + padRight(d.perusahaan.notelp, 35) +
             padRight("Nomor      : " + d.nomor, 36) + " " +
             padRight("Customer : " + d.cus_nama, 45), totalW),
    padRight("NPWP : " + padRight(d.perusahaan.npwp, 35) +
             padRight("Tanggal    : " + d.tanggal, 36) + " " +
             padRight(d.cus_alamat.substring(0, 50), 45), totalW),
    padRight("PAK  : " + padRight(d.perusahaan.pak, 35) +
             padRight("Jth Tempo  : " + d.jthtempo, 36) + " " +
             padRight(d.cus_alamat.substring(45, 100), 45), totalW),
    padRight("", 42) +
    padRight("Memo : " + d.memo, 36) + " " +
    padRight("Salesman : " + d.salesman, 45),
    "-".repeat(totalW),
    padRight("No", hNo) + padRight("Kode", hKode) + padRight("Nama Barang", hNama) +
    padRight("Id Batch", hBatch) +
    padRight("Satuan", hSat) + padLeft("Jumlah", hQty) + padLeft("Disc(%)", hDisc) +
    padLeft("Harga", hHrg) + padLeft("Total", hSub),
    "-".repeat(totalW),
  ];
};

// FOOTER (13 baris — 33 - 10 header - 10 item - 1 separator, pad to 13)
const formatFooterLines = (d: FPprintData): string[] => {
  const colLabel = 15;
  const colVal = 20;
  const rightStart = totalW - colLabel - colVal - 2;
  const fullTerb = "Terbilang : " + (d.terbilang || "") + "RUPIAH";

  const fl: string[] = [];
  fl.push(
    padRight(fullTerb.substring(0, 90), rightStart) + " " +
    padRight("Total         :", colLabel) + " " +
    padLeft(fmt(d.anilai), colVal)
  );
  fl.push(
    padRight(fullTerb.substring(90, 170), rightStart) + " " +
    padRight("Ppn           :", colLabel) + " " +
    padLeft(fmt(d.taxamount), colVal)
  );
  if (d.taxamount > 0) {
    fl.push(
      padRight("Mohon Pembayaran ditransfer ke BANK SYARIAH INDONESIA", rightStart) + " " +
      padRight("Freight       :", colLabel) + " " +
      padLeft(fmt(d.freight), colVal)
    );
    fl.push(
      padRight("Norek : " + (d.rekening || "-"), rightStart) + " " +
      padRight("Grand Total   :", colLabel) + " " +
      padLeft(fmt(d.atotal), colVal)
    );
    fl.push(padRight("A/n   : PT AM PERSADA", rightStart));
  } else {
    fl.push(
      padRight("", rightStart) + " " +
      padRight("Freight       :", colLabel) + " " +
      padLeft(fmt(d.freight), colVal)
    );
    fl.push(
      padRight("", rightStart) + " " +
      padRight("Grand Total   :", colLabel) + " " +
      padLeft(fmt(d.atotal), colVal)
    );
    fl.push("");
  }
  fl.push("");
  fl.push(
    padRight("  Di cek Oleh", 20) +
    padRight("      Disetujui", 35) +
    padRight("   Diantar", 25) +
    padRight("   Diterima", 25) +
    padRight("* Retur Max 7 Hari ", 27)
  );
  fl.push("");
  fl.push("");
  fl.push(
    padRight("(               )", 20) +
    padRight("(PJ:" + d.perusahaan.pj + ")", 35) + " " +
    padRight("(              )", 22) +
    padRight("(              )", 22)
  );
  fl.push(
    padRight("", 20) +
    padRight("  No:" + d.perusahaan.pj_no, 35)
  );
  fl.push("");
  fl.push("");
  return fl;
};

// ── Preview — 33 baris/halaman, Delphi header/footer ──
const generatePreviewFP = (d: FPprintData): string[] => {
  const lines: string[] = [];

  lines.push(...formatHeaderLines(d));

  let i = 0;
  for (const item of d.detail) {
    i++;
    let namaDisplay = item.nama;
    // BE mengirim expired sebagai "MM.YYYY" (paritas doslip2/doslip4).
  // Regex menerima "MM.YYYY" maupun "MM/YYYY" supaya data lama tidak
  // sekadar hilang dari nama barang.
  if (item.expired && /^\d{2}[./]\d{4}$/.test(item.expired)) {
      namaDisplay = item.nama + " / " + item.expired;
    }
    const sub = ((100 - item.discpr) / 100) * item.harga * item.qty;
    lines.push(
      padRight(String(i), hNo) +
      padRightGap(String(item.kode ?? "").trim(), hKode) +
      padRight(String(namaDisplay ?? "").trim(), hNama) +
      padRight(String(item.idBatch ?? "").trim(), hBatch) +
      padRight(String(item.satuan ?? "").trim(), hSat) +
    padLeft(fmtQty(item.qty), hQty) +
    // Disc: FormatFloat('##,###.##', fpd_discpr) — TANPA "%".
    // Tanda "%" hanya ada di header kolom ("Disc(%)"), persis Delphi.
    padLeft(fmt(item.discpr), hDisc) +
      padLeft(fmt(item.harga), hHrg) +
      padLeft(fmt(sub), hSub)
    );

    if (i % DATA_PER_PAGE === 0 && i < d.detail.length) {
      lines.push("-".repeat(totalW));
      // 13 blank, bukan 12: 9 header + 10 item + 1 separator + 13 = 33 baris
      // pas satu halaman. Harus sama dengan generateEscPosFP di useQzPrint,
      // kalau tidak panjang preview ≠ panjang yang dikirim ke printer.
      for (let a = 0; a < 13; a++) lines.push("");
      lines.push(...formatHeaderLines(d));
    }
  }

  if (i % DATA_PER_PAGE !== 0) {
    for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) lines.push("");
  }
  lines.push("-".repeat(totalW));
  lines.push(...formatFooterLines(d));

  return lines;
};

/**
 * Logika cetak FP (Faktur Penjualan dot matrix) — dipakai bersama oleh
 * FPBrowseView dan FPFormView saat "Simpan & Cetak" (paritas cxButton3 Delphi).
 * Preview di-generate lokal; perintah ESC/POS memakai generateEscPosFP
 * dari useQzPrint.
 */
export function useFpPrint() {
  const toast = useToast();
  const isPrinting = ref(false);
  const showPrinterDialog = ref(false);
  const showPreviewDialog = ref(false);
  const previewLines = ref<string[]>([]);
  const pageCount = computed(() => Math.max(1, Math.ceil(previewLines.value.length / LINES_PER_PAGE)));
  const cachedPrintData = ref<FPprintData | null>(null);
  const showRecetakDialog = ref(false);
  const recetakNomor = ref("");
  const pendingPrint = ref<{ nomor: string; variant: "normal" | "retur" } | null>(null);

  const doPreview = async (nomor: string, variant: "normal" | "retur") => {
    const data = variant === "retur"
      ? await fpApi.getPrintDataRetur(nomor)
      : await fpApi.getPrintData(nomor);
    cachedPrintData.value = data;
    previewLines.value = generatePreviewFP(data);
    showPreviewDialog.value = true;
  };

  // Muat data cetak + tampilkan preview (jika printer belum diset → dialog printer dulu)
  // variant "retur" = Cetak V RET (doslip4: angka terkoreksi retur)
  const loadAndPreview = async (nomor: string, variant: "normal" | "retur" = "normal") => {
    const savedPrinter = getSavedPrinter();
    if (!savedPrinter) {
      showPrinterDialog.value = true;
      return;
    }
    isPrinting.value = true;
    try {
      // Paritas Delphi doslip*: set fp_iscetak=1 dulu, jika sudah pernah cetak → konfirmasi re-cetak
      const { wasPrinted } = await fpApi.markPrinted(nomor);
      if (wasPrinted) {
        recetakNomor.value = nomor;
        pendingPrint.value = { nomor, variant };
        showRecetakDialog.value = true;
        return;
      }
      await doPreview(nomor, variant);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat data cetak.");
    } finally {
      isPrinting.value = false;
    }
  };

  const confirmRecetak = async () => {
    showRecetakDialog.value = false;
    if (!pendingPrint.value) return;
    const { nomor, variant } = pendingPrint.value;
    pendingPrint.value = null;
    isPrinting.value = true;
    try {
      await doPreview(nomor, variant);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat data cetak.");
    } finally {
      isPrinting.value = false;
    }
  };

  const cancelRecetak = () => {
    showRecetakDialog.value = false;
    pendingPrint.value = null;
    recetakNomor.value = "";
  };

  const onPrinterSaved = () => {
    showPrinterDialog.value = false;
    if (cachedPrintData.value) {
      previewLines.value = generatePreviewFP(cachedPrintData.value);
      showPreviewDialog.value = true;
    }
  };

  // Selalu printRaw (satu job) — generator sudah menyusun tiap halaman pas
  // 33 baris dan printer yang memecah lewat ESC C 33. Jangan kembali ke
  // splitFlatToPages: fungsi itu membuang semua baris kosong, sedangkan
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
      const flatCmds = generateEscPosFP(cachedPrintData.value);
      await connect();
      await printRaw(savedPrinter, flatCmds);
      toast.success("Berhasil dikirim ke printer!");
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
    showRecetakDialog,
    recetakNomor,
    loadAndPreview,
    onPrinterSaved,
    onPrintFromPreview,
    confirmRecetak,
    cancelRecetak,
    PrinterDialog,
    PrintPreviewDialog,
  };
}
