<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { bayarBiayaPromosiApi, type BYBPrintData } from "@/api/penjualan/bayarBiayaPromosiApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<BYBPrintData | null>(null);
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
  else router.push("/penjualan/bayar-biaya-promosi");
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await bayarBiayaPromosiApi.getPrintData(nomor);
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

    <!-- Dokumen A5 landscape — layout BYB.fr3 -->
    <div v-if="data" class="byb-doc">
      <!-- 1-2. Header perusahaan + judul -->
      <div class="doc-header">
        <div class="comp">
          <div class="comp-nama">{{ data.perusahaan.nama }}</div>
          <div>{{ data.perusahaan.alamat }}</div>
          <div>Telp : {{ data.perusahaan.notelp }}</div>
        </div>
        <div class="doc-title">BUKTI PENERIMAAN<br />KAS / BANK</div>
      </div>

      <!-- 3. Field data -->
      <div class="info-row">
        <div class="info-customer">
          Customer : <strong>{{ data.cusNama }}</strong>
          <span v-if="data.rekNama" class="info-rek"> ({{ data.rekNama }})</span>
        </div>
        <table class="info-right">
          <tr><td>No</td><td>: {{ data.nomor }}</td></tr>
          <tr><td>Tanggal</td><td>: {{ data.tanggal }}</td></tr>
        </table>
      </div>

      <!-- 4. Tabel rincian -->
      <table class="detail-table">
        <thead>
          <tr>
            <th class="tc" style="width: 8%">No</th>
            <th style="width: 30%">Nomor Faktur</th>
            <th class="tc" style="width: 20%">Tanggal Invoice</th>
            <th class="tc" style="width: 20%">Jatuh Tempo</th>
            <th class="tr" style="width: 22%">Bayar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in data.detail" :key="d.fpNomor">
            <td class="tc">{{ d.no }}</td>
            <td>{{ d.fpNomor }}</td>
            <td class="tc">{{ d.fpTanggal }}</td>
            <td class="tc">{{ d.fpJthTempo }}</td>
            <td class="tr">{{ fmt(d.bayar) }}</td>
          </tr>
          <tr v-if="!data.detail.length">
            <td colspan="5" class="tc empty">-</td>
          </tr>
        </tbody>
      </table>

      <!-- 5. Group footer: garis + Total -->
      <div class="total-row">
        <span class="total-lbl">Total</span>
        <span class="total-val">{{ fmt(data.totalBayar) }}</span>
      </div>

      <!-- 6. Terbilang -->
      <div class="terbilang-row">Terbilang : {{ data.terbilang }} Rupiah</div>

      <!-- 7. Page footer tanda tangan -->
      <div class="sign-row">
        <div class="sign-col" v-for="s in ['Dibuat oleh', 'Disetujui,', 'Dibayar Oleh,', 'Diterima Oleh,']" :key="s">
          <div class="sign-role">{{ s }}</div>
          <div class="sign-space"></div>
          <div class="sign-paren">(.................................)</div>
        </div>
      </div>
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
.byb-doc {
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
}
.comp-nama { font-size: 12pt; font-weight: 700; }
.doc-title { font-size: 13pt; font-weight: 700; text-align: right; line-height: 1.3; }

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2mm 0;
}
.info-rek { font-size: 8pt; color: #444; }
.info-right { font-variant-numeric: tabular-nums; }
.info-right td:first-child { padding-right: 2mm; white-space: nowrap; }

.detail-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.detail-table th,
.detail-table td { border: 0.5px solid #000; padding: 1.2mm 1.5mm; }
.detail-table thead tr { background: #ececec; }
.tc { text-align: center; }
.tr { text-align: right; }
.empty { padding: 4mm; }

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 4mm;
  font-weight: 700;
  border-top: 0.5px solid #000;
  border-bottom: 1px solid #000;
  padding: 1.2mm 1.5mm;
  margin-top: 1mm;
  font-variant-numeric: tabular-nums;
}
.total-val { min-width: 24mm; text-align: right; }

.terbilang-row { font-style: italic; padding: 1.5mm 0; }

.sign-row { display: flex; justify-content: space-between; margin-top: 4mm; }
.sign-col { text-align: center; width: 22%; }
.sign-role { font-weight: 700; }
.sign-space { height: 9mm; }
.sign-paren { font-size: 8pt; }

/* ── Cetak: hanya dokumen ── */
@media print {
  /* Ukuran kertas sengaja tidak dipatok di sini: kalau `size` diisi, dropdown
     kertas di dialog cetak Chrome ikut terkunci ke ukuran itu, sehingga
     pilihan A4 user diabaikan dan isi meluber ke halaman kedua. */
  @page { margin: 4mm; }
  body { background: #fff; }
  .print-page { background: #fff; padding: 0; min-height: 0; }
  .no-print { display: none !important; }
  .byb-doc {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 0;
  }
}
</style>
