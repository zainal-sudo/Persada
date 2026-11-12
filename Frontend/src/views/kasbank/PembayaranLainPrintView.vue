<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { pembayaranLainApi, type PembayaranLainPrintData } from "@/api/kasbank/pembayaranLainApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<PembayaranLainPrintData | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  else router.push("/kasbank/pembayaran-lain");
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await pembayaranLainApi.getPrintData(nomor);
    // Auto print setelah data siap (paritas Delphi ShowReport)
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
    <!-- Toolbar (tidak ikut tercetak) -->
    <div class="print-toolbar no-print">
      <button class="tb" :disabled="isLoading || isPrinting" @click="doPrint">Cetak</button>
      <button class="tb tb-secondary" @click="goBack">Tutup</button>
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <!-- Dokumen A5 landscape — layout pembayaranlain.fr3 -->
    <div v-if="data" class="pby-doc">
      <!-- Header perusahaan + judul -->
      <div class="doc-header">
        <div class="comp">
          <div class="comp-nama">{{ data.perusahaan.nama }}</div>
          <div>{{ data.perusahaan.alamat }}</div>
          <div>Telp : {{ data.perusahaan.notelp }}</div>
        </div>
        <div class="doc-title">BUKTI PENGELUARAN KAS / BANK</div>
      </div>

      <!-- Info: kiri Dibayar dari/Memo, kanan Nomor/Tanggal -->
      <div class="info-block">
        <div class="info-left">
          <span>Dibayar dari</span><span>:</span><span>{{ data.rekkredit }}</span>
          <span>Memo</span><span>:</span><span>{{ data.keterangan }}</span>
        </div>
        <div class="info-right">
          <span>Nomor</span><span>:</span><span>{{ data.nomor }}</span>
          <span>Tanggal</span><span>:</span><span>{{ data.tanggal }}</span>
        </div>
      </div>

      <!-- Detail nilai -->
      <table class="detail-table">
        <thead>
          <tr>
            <th style="width: 20%">Account</th>
            <th style="width: 42%">Nama Account</th>
            <th style="width: 20%">Cost Center</th>
            <th class="tr" style="width: 18%">Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in data.detail" :key="i">
            <td>{{ d.account }}</td>
            <td>{{ d.accountName }}</td>
            <td>{{ d.costCenter || "-" }}</td>
            <td class="tr">{{ fmt(d.debet) }}</td>
          </tr>
          <tr v-if="!data.detail.length">
            <td colspan="4" class="tc empty">-</td>
          </tr>
        </tbody>
      </table>

      <!-- Total kredit -->
      <div class="total-row">
        <span class="total-lbl">Total</span>
        <span class="total-val">{{ fmt(data.kredit) }}</span>
      </div>

      <!-- Terbilang -->
      <div class="terbilang-row">Terbilang : {{ data.terbilang }} RUPIAH</div>
    </div>
  </div>
</template>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #525659;
  padding: 16px;
}

.print-toolbar {
  max-width: 200mm;
  margin: 0 auto 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.tb {
  height: 28px;
  padding: 0 14px;
  background: #D97706;
  color: #fff;
  border: 1px solid #B45309;
  border-radius: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.tb:hover { background: #B45309; }
.tb:disabled { opacity: 0.6; cursor: default; }
.tb-secondary { background: #F0F3F8; color: #78350F; border-color: #A0AAB8; }
.tb-secondary:hover { background: #E8ECF1; }
.tb-loading { font-size: 12px; color: #E8ECF1; }

/* ── Dokumen (A5 landscape 210 × 139.5mm) ── */
.pby-doc {
  width: 200mm;
  min-height: 133mm;
  margin: 0 auto;
  background: #fff;
  padding: 6mm 6mm;
  font-family: "Plus Jakarta Sans", Arial, sans-serif;
  font-size: 9pt;
  color: #000;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1.5px solid #000;
  padding-bottom: 1.5mm;
  margin-bottom: 2mm;
}
.comp-nama { font-size: 12pt; font-weight: 700; }
.doc-title { font-size: 13pt; font-weight: 700; text-align: right; }

.info-block {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2mm;
  font-variant-numeric: tabular-nums;
}
.info-left,
.info-right {
  display: grid;
  grid-template-columns: auto auto auto;
  column-gap: 4px;
  row-gap: 1px;
}
.info-right span:nth-child(3n) { text-align: right; }

.detail-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; margin-bottom: 2mm; }
.detail-table th,
.detail-table td { border: 0.5px solid #000; padding: 1.2mm 1.5mm; }
.detail-table thead tr { background: #ececec; }
.tc { text-align: center; }
.tr { text-align: right; }
.empty { padding: 3mm; }

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 4mm;
  font-weight: 700;
  border-top: 0.5px solid #000;
  border-bottom: 1px solid #000;
  padding: 1.2mm 1.5mm;
  font-variant-numeric: tabular-nums;
}
.total-val { min-width: 24mm; text-align: right; }

.terbilang-row { font-style: italic; padding: 1.5mm 0; }

/* ── Cetak: hanya dokumen ── */
@media print {
  /* Ukuran kertas sengaja tidak dipatok di sini: kalau `size` diisi, dropdown
     kertas di dialog cetak Chrome ikut terkunci ke ukuran itu, sehingga
     pilihan A4 user diabaikan dan isi meluber ke halaman kedua. */
  @page { margin: 4mm; }
  body { background: #fff; }
  .print-page { background: #fff; padding: 0; min-height: 0; }
  .no-print { display: none !important; }
  .pby-doc {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 0;
  }
}
</style>
