<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  tagihanEkspedisiFormApi,
  type TagihanEkspedisiForm,
} from "@/api/persediaan/tagihanEkspedisiFormApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<TagihanEkspedisiForm | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUOC = (v: number) =>
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
  else router.push("/persediaan/tagihan-ekspedisi");
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await tagihanEkspedisiFormApi.getDetailForm(nomor);
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

    <!-- Dokumen slip TE -->
    <div v-if="data" class="te-doc">
      <div class="doc-title">TAGIHAN EKSPEDISI</div>

      <table class="info-table">
        <tr>
          <td style="width: 120px">Nomor</td>
          <td>: {{ data.nomor }}</td>
          <td style="width: 100px">Tanggal</td>
          <td>: {{ data.tanggal }}</td>
        </tr>
        <tr>
          <td>Nama Ekspedisi</td>
          <td colspan="3">: {{ data.namaEkspedisi }}</td>
        </tr>
        <tr>
          <td>Periode FP</td>
          <td colspan="3">: {{ data.tg1 }} s/d {{ data.tg2 }}</td>
        </tr>
        <tr>
          <td>Keterangan</td>
          <td colspan="3">: {{ data.keterangan }}</td>
        </tr>
      </table>

      <table class="detail-table">
        <thead>
          <tr>
            <th style="width: 140px">Nomor FP</th>
            <th>Customer</th>
            <th style="width: 100px">Tanggal</th>
            <th style="width: 130px" class="tr">Nilai</th>
            <th style="width: 110px" class="tr">Biaya</th>
            <th style="width: 90px" class="tr">UOC (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in data.detail" :key="i">
            <td>{{ d.nomor || '-' }}</td>
            <td>{{ d.nama }}</td>
            <td class="tc">{{ d.tanggal || '-' }}</td>
            <td class="tr">{{ fmt(d.nilai) }}</td>
            <td class="tr">{{ fmt(d.biaya) }}</td>
            <td class="tr">{{ fmtUOC(d.uoc) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
* {
  font-family: Arial, Helvetica, sans-serif;
}
.print-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 16px;
  background: #f0f3f8;
  border-bottom: 1px solid #c4cad3;
}
.tb {
  padding: 6px 18px;
  background: #0284c7;
  color: white;
  border: 1px solid #0369a1;
  cursor: pointer;
  font-size: 13px;
}
.tb-secondary {
  background: white;
  color: #0c4a6e;
}
.tb-loading {
  font-size: 12px;
  color: #5A6A7E;
}
.te-doc {
  padding: 24px 32px;
  background: white;
  min-height: 100vh;
}
.doc-title {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.1em;
  margin-bottom: 18px;
}
.info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 16px;
}
.info-table td {
  padding: 2px 4px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.detail-table th,
.detail-table td {
  border: 1px solid #888;
  padding: 4px 6px;
}
.detail-table th {
  background: #e8ecf1;
  font-weight: 700;
}
.tc { text-align: center; }
.tr { text-align: right; }
@media print {
  .no-print {
    display: none !important;
  }
  .te-doc {
    padding: 0;
    min-height: 0;
  }
}
</style>