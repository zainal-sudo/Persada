import { ref } from "vue";

// Declare global qz from CDN
declare global {
  interface Window {
    qz: any;
  }
}

const PRINTER_STORAGE_KEY = "printer_name";
const isConnecting = ref(false);
const isConnected = ref(false);
const printers = ref<string[]>([]);

/**
 * Composable untuk integrasi QZ Tray (cetak langsung ke printer)
 * Menggunakan Raw ESC/POS untuk printer dot matrix
 */
export function useQzPrint() {
  /**
   * Load script qz-tray.js dari CDN jika belum ada
   */
  const loadQzScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Sudah ada script qz-tray
      if (window.qz) {
        resolve();
        return;
      }

      // Sudah ada script tag tapi belum loaded
      const existing = document.querySelector('script[src*="qz-tray"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Gagal load qz-tray.js")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal load qz-tray.js dari CDN"));
      document.head.appendChild(script);
    });
  };

  /**
   * Hubungkan ke QZ Tray via WebSocket
   */
  const connect = async (): Promise<boolean> => {
    if (isConnected.value) return true;

    try {
      isConnecting.value = true;
      await loadQzScript();

      // QZ Tray default port: 8181
      await window.qz.websocket.connect();



      isConnected.value = true;
      return true;
    } catch (e: any) {
      console.error("QZ Tray connection error:", e);
      isConnected.value = false;
      return false;
    } finally {
      isConnecting.value = false;
    }
  };

  /**
   * Putuskan koneksi ke QZ Tray
   */
  const disconnect = async (): Promise<void> => {
    try {
      if (isConnected.value && window.qz) {
        await window.qz.websocket.disconnect();
      }
    } catch (e) {
      console.error("QZ Tray disconnect error:", e);
    } finally {
      isConnected.value = false;
    }
  };

  /**
   * Ambil list semua printer yang terinstall di komputer
   */
  const getPrinters = async (): Promise<string[]> => {
    if (!isConnected.value) {
      const ok = await connect();
      if (!ok) return [];
    }

    try {
      const list = await window.qz.printers.find();
      printers.value = Array.isArray(list) ? list : [];
      return printers.value;
    } catch (e: any) {
      console.error("Gagal mengambil list printer:", e);
      printers.value = [];
      return [];
    }
  };

  /**
   * Cetak data Raw ESC/POS ke printer
   * @param printerName - nama printer dari OS (harus persis)
   * @param rawData - array of raw ESC/POS commands
   */
  const printRaw = async (printerName: string, rawData: string[]): Promise<boolean> => {
    if (!isConnected.value) {
      const ok = await connect();
      if (!ok) return false;
    }

    try {
      const config = window.qz.configs.create(printerName);
      await window.qz.print(config, rawData);
      return true;
    } catch (e: any) {
      console.error("QZ Tray print error:", e);
      throw e;
    }
  };

  /**
   * Simpan nama printer ke localStorage
   */
  const savePrinter = (name: string): void => {
    localStorage.setItem(PRINTER_STORAGE_KEY, name);
  };

  /**
   * Ambil nama printer dari localStorage
   */
  const getSavedPrinter = (): string | null => {
    return localStorage.getItem(PRINTER_STORAGE_KEY);
  };

  /**
   * Hapus setting printer dari localStorage
   */
  const clearPrinter = (): void => {
    localStorage.removeItem(PRINTER_STORAGE_KEY);
  };

  // ── Shared helpers ────────────────────────────────────────────────────
  const padRight = (str: string, len: number): string =>
    str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
  const padLeft = (str: string, len: number): string =>
    str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
  const padRightGap = (str: string, len: number): string =>
    padRight(str, Math.max(len - 1, 0)) + " ";

  /**
   * FormatFloat('##,###', v) — integer dengan koma ribuan, tanpa desimal
   */
  const fmtInt = (v: number): string => {
    const n = Math.round(v || 0);
    // Delphi FormatFloat('##,###', 0) = string KOSONG (semua karakter format
    // adalah '#'). Preview (useFpPrint.fmtQty) juga kosong, jadi keduanya
    // harus sama — kalau tidak, angka nol tampil di kertas tapi tidak di layar.
    if (n === 0) return "";
    const s = Math.abs(n).toString();
    const withCommas = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + withCommas;
  };

  /**
   * FormatFloat('##,###.##' atau '#,###,###.##', v) — maks 2 desimal,
   * tanpa trailing zero, dengan koma ribuan.
   */
  const fmtDec = (v: number): string => {
    const n = v || 0;
    // Sama seperti fmtInt: nol -> kosong, sesuai Delphi dan preview.
    if (n === 0) return "";
    const abs = Math.abs(n);
    const [intPart, decPart] = abs.toFixed(2).split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const sign = n < 0 ? "-" : "";
    const trimmedDec = decPart.replace(/0+$/, "");
    if (trimmedDec === "") return sign + withCommas;
    return sign + withCommas + "." + trimmedDec;
  };

  /**
   * Generate perintah ESC/POS untuk cetak FP (Faktur Penjualan).
   *
   * Mengembalikan array flat (string[]) — satu job print, dipanggil
   * printRaw() oleh caller. Printer handle page break via ESC C33.
   */
  const generateEscPosFP = (fpData: {
    perusahaan: {
      nama: string;
      alamat: string;
      kota: string;
      notelp: string;
      npwp: string;
      pak: string;
      pj: string;
      pj_no: string;
    };
    nomor: string;
    tanggal: string;
    jthtempo: string;
    memo: string;
    salesman: string;
    cus_nama: string;
    cus_alamat: string;
    rekening: string;
    terbilang: string;
    anilai: number;
    taxamount: number;
    freight: number;
    atotal: number;
    detail: {
      nourut: number;
      kode: string;
      nama: string;
      satuan: string;
      qty: number;
      harga: number;
      discpr: number;
      expired: string;
      idBatch: string;
    }[];
  }): string[] => {
    const NL = "\r\n";
    const ESC = "\x1B";

    const totalW = 132;
    const hNo = 5, hKode = 11, hNama = 51, hBatch = 10, hSat = 9, hQty = 8, hHrg = 12, hDisc = 9, hSub = 17;
    const DATA_PER_PAGE = 10;
    const FOOTER_LINE_COUNT = 13;

    const alamatLengkap = [fpData.perusahaan.alamat, fpData.perusahaan.kota]
      .filter((v) => v && v !== "-").join(", ");

    const colLabel = 15;
    const colVal = 20;
    const rightStart = totalW - colLabel - colVal - 2;

    // ── HEADER (9 baris) ──
    const formatHeaderLines = (): string[] => {
    return [
      padRight(fpData.perusahaan.nama, 90) + " " + padRight("F A K T U R   P E N J U A L A N", 40),
      padRight(alamatLengkap, 132),
      padRight("Telp : " + padRight(fpData.perusahaan.notelp, 35) +
               padRight("Nomor      : " + fpData.nomor, 36) + " " +
               padRight("Customer : " + fpData.cus_nama, 45), totalW),
      padRight("NPWP : " + padRight(fpData.perusahaan.npwp, 35) +
               padRight("Tanggal    : " + fpData.tanggal, 36) + " " +
               padRight(fpData.cus_alamat.substring(0, 50), 45), totalW),
      padRight("PAK  : " + padRight(fpData.perusahaan.pak, 35) +
               padRight("Jth Tempo  : " + fpData.jthtempo, 36) + " " +
               padRight(fpData.cus_alamat.substring(45, 100), 45), totalW),
      padRight("", 42) +
      padRight("Memo : " + fpData.memo, 36) + " " +
      padRight("Salesman : " + fpData.salesman, 45),
      "-".repeat(totalW),
      padRight("No", hNo) + padRight("Kode", hKode) + padRight("Nama Barang", hNama) +
      padRight("Id Batch", hBatch) +
      padRight("Satuan", hSat) + padLeft("Jumlah", hQty) + padLeft("Disc(%)", hDisc) +
      padLeft("Harga", hHrg) + padLeft("Total", hSub),
      "-".repeat(totalW),
    ];
  };

    // ── FOOTER (13 baris, Delphi style) ──
    const formatFooterLines = (): string[] => {
      const terbText = fpData.terbilang || "";
      const fl: string[] = [];
      fl.push(
        padRight("Terbilang : " + terbText.substring(0, 90) + "RUPIAH", rightStart) + " " +
        padRight("Total         :", colLabel) + " " +
        padLeft(fmtDec(fpData.anilai), colVal)
      );
      fl.push(
        padRight(" " + terbText.substring(90, 170), rightStart) + " " +
        padRight("Ppn           :", colLabel) + " " +
        padLeft(fmtDec(fpData.taxamount), colVal)
      );
      if (fpData.taxamount > 0) {
        fl.push(
          padRight("Mohon Pembayaran ditransfer ke BANK SYARIAH INDONESIA", rightStart) + " " +
          padRight("Freight       :", colLabel) + " " +
          padLeft(fmtDec(fpData.freight), colVal)
        );
        fl.push(
          padRight("Norek : " + (fpData.rekening || "-"), rightStart) + " " +
          padRight("Grand Total   :", colLabel) + " " +
          padLeft(fmtDec(fpData.atotal), colVal)
        );
        fl.push(padRight("A/n   : PT AM PERSADA", rightStart));
      } else {
        fl.push(
          padRight("", rightStart) + " " +
          padRight("Freight       :", colLabel) + " " +
          padLeft(fmtDec(fpData.freight), colVal)
        );
        fl.push(
          padRight("", rightStart) + " " +
          padRight("Grand Total   :", colLabel) + " " +
          padLeft(fmtDec(fpData.atotal), colVal)
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
        padRight("(PJ:" + fpData.perusahaan.pj + ")", 35) + " " +
        padRight("(              )", 22) +
        padRight("(              )", 22)
      );
      fl.push(
        padRight("", 20) +
        padRight("  No:" + fpData.perusahaan.pj_no, 35)
      );
      while (fl.length < FOOTER_LINE_COUNT) fl.push("");
      return fl;
    };

    // ── Detail line ──
    const formatDetailLine = (itemNo: number, d: typeof fpData.detail[0]): string => {
      let namaDisplay = d.nama;
      // BE mengirim expired sebagai "MM.YYYY" (paritas doslip2/doslip4).
      // Regex menerima "MM.YYYY" maupun "MM/YYYY" supaya data lama tidak
      // sekadar hilang dari nama barang.
      if (d.expired && /^\d{2}[./]\d{4}$/.test(d.expired)) {
        namaDisplay = d.nama + " / " + d.expired;
      }
      const sub = ((100 - d.discpr) / 100) * d.harga * d.qty;
      return (
        padRight(String(itemNo), hNo) +
        padRightGap(String(d.kode ?? "").trim(), hKode) +
        padRight(String(namaDisplay ?? "").trim(), hNama) +
        padRight(String(d.idBatch ?? "").trim(), hBatch) +
        padRight(String(d.satuan ?? "").trim(), hSat) +
        padLeft(fmtInt(d.qty), hQty) +
        // Disc: FormatFloat('##,###.##', fpd_discpr) — TANPA "%".
        // Tanda "%" hanya ada di header kolom ("Disc(%)"), persis Delphi.
        padLeft(d.discpr ? fmtDec(d.discpr) : "", hDisc) +
        padLeft(fmtDec(d.harga), hHrg) +
        padLeft(fmtDec(sub), hSub)
      );
    };

    // ── Streaming approach — SAMA PERSIS dengan preview ──
    // Generate flat lines first, then split into pages for printPages()
    const allLines: string[] = [];

    allLines.push(...formatHeaderLines());

    let i = 0;
    for (const d of fpData.detail) {
      i++;
      allLines.push(formatDetailLine(i, d));

      if (i % DATA_PER_PAGE === 0 && i < fpData.detail.length) {
        allLines.push("-".repeat(totalW));
        for (let a = 0; a < 13; a++) allLines.push("");
        allLines.push(...formatHeaderLines());
      }
    }

    if (i % DATA_PER_PAGE !== 0) {
      for (let a = 0; a < DATA_PER_PAGE - (i % DATA_PER_PAGE); a++) allLines.push("");
    }
    allLines.push("-".repeat(totalW));
    allLines.push(...formatFooterLines());

    // ── Single job output ──
    // Stream flat lines; printer handles page break via ESC C33
    const LINES_PER_PAGE = 33;
    const commands: string[] = [];
    commands.push(ESC + "@");
    commands.push("\x0F");
    commands.push(ESC + "2");
    commands.push(ESC + "C" + String.fromCharCode(LINES_PER_PAGE));
    commands.push(ESC + "d" + "\x00");
    for (const line of allLines) {
      commands.push(line + NL);
    }
    // commands.push(NL);

    return commands;
  };

  /**
   * Kirim beberapa halaman ke printer sebagai JOB TERPISAH satu per satu.
   * Tiap halaman diinisialisasi printer sendiri-sendiri.
   */
  const printPages = async (
    printerName: string,
    pagesCommands: string[][],
    pageNumbers?: number[]
  ): Promise<void> => {
    const targets = pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : pagesCommands.map((_, i) => i + 1);

    for (const pageNo of targets) {
      const cmds = pagesCommands[pageNo - 1];
      if (!cmds) continue;
      await printRaw(printerName, cmds);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  };

  /**
   * Split flat ESC/POS commands (single-job) into per-page arrays.
   * @param commands - flat string[] from generateEscPos*
   * @param linesPerPage - ESC C value (e.g. 33 for 5.5" form)
   * @param initCount - number of init codes at start (before content)
   */
  const splitFlatToPages = (
    commands: string[],
    linesPerPage: number,
    initCount: number = 5,
  ): string[][] => {
    const init = commands.slice(0, initCount);
    const content = commands.slice(initCount);
    // Filter out trailing empty NL-only lines used as form feed
    const contentLines = content.filter((l) => l.trim() !== "");
    const pages: string[][] = [];
    for (let i = 0; i < contentLines.length; i += linesPerPage) {
      pages.push([...init, ...contentLines.slice(i, i + linesPerPage), "\r\n\r\n\r\n"]);
    }
    return pages.length > 0 ? pages : [commands];
  };

  return {
    // State
    isConnecting,
    isConnected,
    printers,

    // Methods
    loadQzScript,
    connect,
    disconnect,
    getPrinters,
    printRaw,
    printPages,
    splitFlatToPages,
    savePrinter,
    getSavedPrinter,
    clearPrinter,
    generateEscPosFP,
  };
}
