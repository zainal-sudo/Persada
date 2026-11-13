<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  serahTerimaFakturApi,
  type SerahTerimaFakturPrintData,
} from "@/api/penjualan/serahTerimaFakturApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

// mode "st"   : meniru formulir report\ST.fr3 (A4, tabel bergaris)
// mode "slip" : meniru doslip2, slip teks 120 kolom untuk printer dot-matrix
const mode = computed<"st" | "slip">(() =>
  String(route.query.mode || "st") === "slip" ? "slip" : "st"
);

const data = ref<SerahTerimaFakturPrintData | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const NAMA_BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const pecahTanggal = (val: string | null) => {
  if (!val) return null;
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return null;
  return {
    d: String(dt.getDate()).padStart(2, "0"),
    m: dt.getMonth() + 1,
    y: dt.getFullYear(),
  };
};

// Formulir ST: "dd mmm yyyy" (mengikuti DisplayFormat ST.fr3)
const fmtTanggalSt = (val: string | null) => {
  const t = pecahTanggal(val);
  if (!t) return "-";
  return `${t.d} ${NAMA_BULAN_SINGKAT[t.m - 1]} ${t.y}`;
};

// Slip: "dd-mm-yyyy" (mengikuti doslip2)
const fmtTanggalSlip = (val: string | null) => {
  const t = pecahTanggal(val);
  if (!t) return "-";
  return `${t.d}-${t.m}-${t.y}`;
};

// Nilai formulir ST: DisplayFormat "%2.n" (2 desimal, pemisah ribuan)
const fmtNilaiSt = (v: number) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Nilai slip: format "###,###,###" (tanpa desimal)
const fmtNilaiSlip = (v: number) => Number(v || 0).toLocaleString("en-US");

// StrPadRight / StrPadLeft milik Delphi: padatkan tanpa memotong.
const padR = (s: unknown, n: number, ch = " ") =>
  String(s ?? "").padEnd(n, ch);
const padL = (s: unknown, n: number) => String(s ?? "").padStart(n, " ");

// Slip teks 120 kolom, padding persis mengikuti doslip2.
const slipLines = computed(() => {
  const d = data.value;
  if (!d) return [] as string[];

  const baris: string[] = [
    padR(`Nomor  : ${d.header.nomor}`, 79) +
      " " +
      padR(" S E R A H   T E R I M A   F A K T U R", 40),
    padR(`Tanggal: ${fmtTanggalSlip(d.header.tanggal)}`, 60),
    padR("", 120, "-"),
    padR("No", 3) +
      " " +
      padR("Nomor", 18) +
      " " +
      padR("Customer", 35) +
      " " +
      padR("Tanggal", 10) +
      " " +
      padL("Nilai", 15) +
      "  " +
      padR("Salesman", 30),
    padR("", 120, "-"),
  ];

  d.detail.forEach((row, i) => {
    baris.push(
      padR(i + 1, 3) +
        " " +
        padR(row.faktur, 18) +
        " " +
        padR(row.customer, 35) +
        " " +
        padR(fmtTanggalSlip(row.tanggal), 10) +
        " " +
        padL(fmtNilaiSlip(row.nilai), 15) +
        "  " +
        padR(row.salesman, 30)
    );
  });

  baris.push(padR("", 120, "-"));
  baris.push("");
  baris.push("Diserahkan                      Diterima");
  baris.push("");
  baris.push("");
  baris.push(padR(d.header.serah, 30) + "  " + padR(d.header.terima, 30));
  return baris;
});

const doPrint = () => {
  isPrinting.value = true;
  try {
    window.print();
  } finally {
    isPrinting.value = false;
  }
};

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push({ name: "serahTerimaFakturBrowse" });
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await serahTerimaFakturApi.getPrintData(nomor);
    // Paritas Delphi: dokumen langsung ditampilkan/dicetak setelah data siap.
    setTimeout(() => window.print(), 300);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data cetak.");
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <span class="mode-label">
        Mode: {{ mode === "st" ? "Formulir ST" : "Slip dot-matrix" }}
      </span>
      <button class="tb" :disabled="isLoading || isPrinting || !data" @click="doPrint">
        Cetak
      </button>
      <button class="tb tb-secondary" @click="goBack">Tutup</button>
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <!-- ═══ MODE 1: formulir ST (report\ST.fr3) ═══ -->
    <div v-if="data && mode === 'st'" class="st-doc">
      <div class="st-title">Serah Terima Faktur</div>

      <table class="st-info">
        <tr>
          <td class="lbl">Nomor</td>
          <td class="sep">:</td>
          <td>{{ data.header.nomor }}</td>
        </tr>
        <tr>
          <td class="lbl">Tanggal</td>
          <td class="sep">:</td>
          <td>{{ fmtTanggalSt(data.header.tanggal) }}</td>
        </tr>
        <tr>
          <td class="lbl">Keterangan</td>
          <td class="sep">:</td>
          <td>{{ data.header.memo }}</td>
        </tr>
      </table>

      <table class="st-table">
        <thead>
          <tr>
            <th style="width: 4%">No</th>
            <th style="width: 19%">Nomor</th>
            <th style="width: 30%">Customer</th>
            <th style="width: 13%" class="tc">Tanggal</th>
            <th style="width: 14%" class="tr">Nilai</th>
            <th>Salesman</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in data.detail" :key="row.faktur">
            <td class="tc">{{ i + 1 }}</td>
            <td>{{ row.faktur }}</td>
            <td>{{ row.customer }}</td>
            <td class="tc">{{ fmtTanggalSt(row.tanggal) }}</td>
            <td class="tr">{{ fmtNilaiSt(row.nilai) }}</td>
            <td>{{ row.salesman }}</td>
          </tr>
          <tr v-if="!data.detail.length">
            <td colspan="6" class="tc empty">Tidak ada faktur pada dokumen ini.</td>
          </tr>
        </tbody>
      </table>

      <div class="st-sign">
        <div class="st-sign-col">
          <div class="st-sign-role">Diserahkan Oleh</div>
          <div class="st-sign-space"></div>
          <div class="st-sign-name">{{ data.header.serah }}</div>
        </div>
        <div class="st-sign-col">
          <div class="st-sign-role">Diterima,</div>
          <div class="st-sign-space"></div>
          <div class="st-sign-name">{{ data.header.terima }}</div>
        </div>
      </div>
    </div>

    <!-- ═══ MODE 2: slip teks dot-matrix (doslip2) ═══ -->
    <div v-else-if="data" class="slip-doc">
      <pre class="slip-pre">{{ slipLines.join("\n") }}</pre>
    </div>
  </div>
</template>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #525659;
  padding: 16px;
  overflow-x: auto;
}

.print-toolbar {
  max-width: 210mm;
  margin: 0 auto 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.mode-label {
  font-size: 12px;
  font-weight: 600;
  color: #E8ECF1;
  margin-right: 4px;
}
.tb {
  height: 28px;
  padding: 0 14px;
  background: #0284c7;
  color: #fff;
  border: 1px solid #0369a1;
  border-radius: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.tb:hover {
  background: #0369a1;
}
.tb:disabled {
  background: #8494A7;
  border-color: #8494A7;
  cursor: not-allowed;
}
.tb-secondary {
  background: #F0F3F8;
  color: #0c4a6e;
  border-color: #A0AAB8;
}
.tb-secondary:hover {
  background: #E8ECF1;
}
.tb-loading {
  font-size: 12px;
  color: #E8ECF1;
}

/* Tipografi dokumen memakai font sistem dokumen (bukan font aplikasi)
   supaya hasil cetak mendekati layout FastReport aslinya. */
.st-doc,
.slip-doc {
  background: #fff;
  margin: 0 auto;
  padding: 10mm;
  color: #000;
}

.st-doc {
  width: 210mm;
  min-height: 297mm;
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  font-size: 10pt;
}

.st-title {
  text-align: center;
  font-size: 16pt;
  font-weight: 600;
  margin-bottom: 6mm;
}

.st-info {
  margin-bottom: 4mm;
  font-size: 10pt;
}
.st-info td {
  padding: 0.6mm 1mm;
  vertical-align: top;
}
.st-info .lbl {
  width: 24mm;
}
.st-info .sep {
  width: 3mm;
}

.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
}
.st-table th,
.st-table td {
  border: 0.5px solid #000;
  padding: 1.2mm 1.5mm;
}
.st-table thead th {
  font-weight: 600;
  background: #f2f2f2;
}
.st-table .empty {
  padding: 4mm;
  font-style: italic;
}

.st-sign {
  display: flex;
  justify-content: space-between;
  margin-top: 10mm;
  padding-top: 2mm;
  border-top: 0.5px solid #000;
}
.st-sign-col {
  width: 40%;
  text-align: center;
  font-size: 10pt;
}
.st-sign-role {
  margin-bottom: 16mm;
}
.st-sign-space {
  height: 0;
}
.st-sign-name {
  border-top: 0.5px dotted #000;
  padding-top: 1mm;
}

/* Slip tetap monospace karena sasarannya printer dot-matrix
   berkepala tetap (fixed pitch), bukan dokumen berbentuk bebas. */
.slip-doc {
  width: 210mm;
  font-family: "Courier New", Courier, monospace;
  font-size: 7.5pt;
  line-height: 1.2;
}
.slip-pre {
  margin: 0;
  white-space: pre;
  overflow-x: auto;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

@media print {
  /* ST.fr3 memang dirancang untuk A4 portrait; slip dot-matrix memakai lebar
     120 kolom yang masih muat di area cetak A4 dengan margin 8mm. Ukuran
     kertas tidak dipatok (`size` dikosongkan) supaya dropdown kertas di
     dialog cetak tetap bisa dipilih user. */
  @page { margin: 8mm; }
  body { background: #fff; }
  .print-page {
    background: #fff;
    padding: 0;
    min-height: 0;
  }
  .no-print {
    display: none !important;
  }
  .st-doc {
    width: auto;
    min-height: auto;
    padding: 0;
  }
  .slip-doc {
    width: auto;
    padding: 0;
  }
  .slip-pre {
    overflow: visible;
  }
}
</style>
