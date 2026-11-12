<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  cetakKunjunganApi,
  type KunjunganRow,
  type KunjunganPerusahaan,
} from "@/api/utility/cetakKunjunganApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const startDate = ref(String(route.query.startDate || ""));
const endDate = ref(String(route.query.endDate || ""));
const salesman = ref(String(route.query.salesman || ""));

const rows = ref<KunjunganRow[]>([]);
const perusahaan = ref<KunjunganPerusahaan | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const fmtTanggal = (val: string | null) => {
  if (!val) return "-";
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
};

const periodeLabel = computed(() => {
  if (!startDate.value || !endDate.value) return "-";
  return `${fmtTanggal(startDate.value)} s/d ${fmtTanggal(endDate.value)}`;
});

const fmtJarak = (v: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v || 0);

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
  else router.push("/utility/cetak-kunjungan");
};

// Snapshot baris terfilter dari grid (cetakKunjunganPrintPayload). Dipakai
// supaya cetak mengikuti filter kolom + search. Kalau tak ada / filter beda
// (mis. buka URL langsung atau refresh), fallback fetch by periode + salesman.
const readPayload = (): KunjunganRow[] | null => {
  try {
    const raw = sessionStorage.getItem("cetakKunjunganPrintPayload");
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p?.startDate !== startDate.value ||
      p?.endDate !== endDate.value ||
      p?.salesman !== salesman.value
    )
      return null;
    return Array.isArray(p.rows) ? (p.rows as KunjunganRow[]) : null;
  } catch {
    return null;
  }
};

onMounted(async () => {
  try {
    const snap = readPayload();
    const perPromise = cetakKunjunganApi.getPerusahaan();
    rows.value =
      snap ?? (await cetakKunjunganApi.getKunjungan(startDate.value, endDate.value, salesman.value));
    perusahaan.value = await perPromise;
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
      <span class="mode-label">Laporan Kunjungan Salesman</span>
      <button class="tb" :disabled="isLoading || isPrinting || !rows.length" @click="doPrint">
        Cetak
      </button>
      <button class="tb tb-secondary" @click="goBack">Tutup</button>
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <div v-if="rows.length" class="kj-doc">
      <!-- Header perusahaan (Delphi: tperusahaan + judul slip) -->
      <div class="kj-header">
        <div class="kj-perush">
          <div class="kj-nama">{{ perusahaan?.perush_nama || "" }}</div>
          <div class="kj-alamat">{{ perusahaan?.perush_alamat || "" }}</div>
        </div>
        <div class="kj-judul">K U N J U N G A N&nbsp;&nbsp;S A L E S M A N</div>
      </div>

      <div class="kj-info">
        <div><span class="lbl">Salesman</span>: {{ salesman || "(Semua)" }}</div>
        <div><span class="lbl">Periode</span>: {{ periodeLabel }}</div>
        <div v-if="rows[0]?.kar_cabang"><span class="lbl">Cabang</span>: {{ rows[0].kar_cabang }}</div>
      </div>

      <table class="kj-table">
        <thead>
          <tr>
            <th style="width: 4%">No</th>
            <th style="width: 38%">Nama</th>
            <th style="width: 12%" class="tc">Tanggal</th>
            <th style="width: 9%" class="tc">Jam</th>
            <th style="width: 9%">Hari</th>
            <th style="width: 12%" class="tc">Koordinat</th>
            <th style="width: 16%" class="tr">Jarak (km)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="`${row.cus_kode}-${row.tanggal}`">
            <td class="tc">{{ i + 1 }}</td>
            <td>{{ row.cus_nama }}</td>
            <td class="tc">{{ fmtTanggal(row.tanggal) }}</td>
            <td class="tc">{{ row.jam }}</td>
            <td>{{ row.hari }}</td>
            <td class="tc">{{ row.koordinat }}</td>
            <td class="tr">{{ fmtJarak(row.jarak) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Blok tanda tangan (Delphi: doslip - DiBuat oleh / Mengetahui / Atasan) -->
      <div class="kj-ttd">
        <div class="ttd-row">
          <div class="ttd-col">
            <span class="ttd-label">DiBuat oleh,</span>
            <span class="ttd-line"></span>
          </div>
          <div class="ttd-col">
            <span class="ttd-label">Mengetahui,</span>
            <span class="ttd-line"></span>
          </div>
          <div class="ttd-col">
            <span class="ttd-label">Atasan,</span>
            <span class="ttd-line"></span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!isLoading" class="empty-state">
      Tidak ada data kunjungan untuk filter yang dipilih.
    </div>
  </div>
</template>

<style scoped>
.print-page {
  height: 100vh;
  overflow-y: auto;
  background: #e8ecf1;
  padding: 16px;
}
.print-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.mode-label {
  font-size: 12px;
  font-weight: 700;
  color: #78350F;
  margin-right: 8px;
}
.tb {
  height: 28px;
  padding: 0 12px;
  background: #D97706;
  color: white;
  border: 1px solid #D97706;
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.tb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tb-secondary {
  background: #f0f3f8;
  color: #78350F;
  border-color: #a0aab8;
}
.tb-loading {
  font-size: 11px;
  color: #8494a7;
}
.kj-doc {
  background: #fff;
  margin: 0 auto;
  padding: 24px;
  max-width: 210mm;
}
.kj-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #78350F;
  padding-bottom: 8px;
}
.kj-nama {
  font-size: 14px;
  font-weight: 700;
  color: #78350F;
}
.kj-alamat {
  font-size: 11px;
  color: #374151;
}
.kj-judul {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #78350F;
  text-align: right;
}
.kj-info {
  margin: 10px 0;
  font-size: 11px;
  color: #78350F;
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.kj-info .lbl {
  display: inline-block;
  min-width: 64px;
  font-weight: 700;
}
.kj-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
}
.kj-table th {
  background: #e8ecf1;
  border: 1px solid #a0aab8;
  padding: 4px 6px;
  text-align: left;
  font-size: 10.5px;
  color: #78350F;
}
.kj-table td {
  border: 1px solid #c4cad3;
  padding: 3px 6px;
  color: #78350F;
}
.tc {
  text-align: center;
}
.tr {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.kj-ttd {
  margin-top: 28px;
  page-break-inside: avoid;
}
.ttd-row {
  display: flex;
  font-size: 11px;
  color: #78350F;
}
.ttd-col {
  width: 33%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ttd-label {
  text-align: center;
}
.ttd-line {
  width: 150px;
  max-width: 80%;
  margin-top: 52px;
  border-bottom: 1px solid #78350F;
}
.empty-state {
  max-width: 210mm;
  margin: 40px auto;
  padding: 24px;
  background: #fff;
  border: 1px solid #a0aab8;
  text-align: center;
  font-size: 12px;
  color: #8494a7;
}

@media print {
  /* Ukuran kertas tidak dipatok supaya dropdown kertas di dialog cetak tetap
     bisa dipilih user (dokumen ini memang dirancang untuk A4 portrait). */
  @page {
    margin: 8mm;
  }
  body {
    background: #fff;
  }
  .print-page {
    height: auto;
    overflow: visible;
    background: #fff;
    padding: 0;
    min-height: 0;
  }
  .no-print {
    display: none !important;
  }
  .kj-doc {
    max-width: none;
    padding: 0;
  }
}
</style>
