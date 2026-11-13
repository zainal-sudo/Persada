<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { bayarCustomerApi, type BYCPrintData } from "@/api/penjualan/bayarCustomerApi";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<BYCPrintData | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Hanya tampilkan rekening yang benar-benar dipakai. Urutan mengikuti
// urutan baris di form: Cash, Transfer, Potongan, Giro, PPN, PPH.
const rekeningDipakai = computed(() => {
  if (!data.value) return [];
  return (
    [
      { label: "Account Cash", nama: data.value.rekCash },
      { label: "Account Transfer", nama: data.value.rekTransfer },
      { label: "Account Potongan", nama: data.value.rekPotongan },
      { label: "Account Giro", nama: data.value.rekGiro },
      { label: "Account PPN", nama: data.value.rekPPN },
      { label: "Account PPH", nama: data.value.rekPPH },
    ] as const
  ).filter((r) => !!r.nama);
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
  else router.push("/penjualan/bayar-customer");
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await bayarCustomerApi.getPrintData(nomor);
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

    <!-- Dokumen A5 landscape — layout BYC.fr3 -->
    <div v-if="data" class="byc-doc">
      <!-- 1. Header perusahaan + judul -->
      <div class="doc-header">
        <div class="comp">
          <div class="comp-nama">{{ data.perusahaan.nama }}</div>
          <div>{{ data.perusahaan.alamat }}</div>
          <div>Telp : {{ data.perusahaan.notelp }} / Fax : {{ data.perusahaan.nofax }}</div>
        </div>
        <div class="doc-title">PENERIMAAN CUSTOMER</div>
      </div>

      <!-- 2. Rekening yang dipakai — hanya yang ada nilainya -->
      <div v-if="rekeningDipakai.length" class="transfer-row">
        <div v-for="r in rekeningDipakai" :key="r.label" class="rek-line">
          <span class="rek-label">{{ r.label }} :</span>
          <span>{{ r.nama }}</span>
        </div>
      </div>

      <!-- 3. Kotak data customer + info dokumen -->
      <div class="info-box">
        <div class="info-left">
          <div class="info-label">Customer</div>
          <div class="cus-nama">{{ data.cusNama }}</div>
          <div class="cus-alamat">{{ data.cusAlamat }}</div>
        </div>
        <table class="info-right">
          <tr><td>Tanggal</td><td>: {{ data.tanggal }}</td></tr>
          <tr><td>Nomor</td><td>: {{ data.nomor }}</td></tr>
          <tr><td>Nilai</td><td>: {{ fmt(data.nilaiTotal) }}</td></tr>
          <tr><td>No. Cek</td><td>: {{ data.noGiro }}</td></tr>
          <tr><td>Tgl. Cair</td><td>: {{ data.tglCair }}</td></tr>
        </table>
      </div>

      <!-- 4. Tabel rincian faktur -->
      <table class="detail-table">
        <thead>
          <tr>
            <th class="tc" style="width: 6%">No</th>
            <th style="width: 20%">No. Faktur</th>
            <th class="tc" style="width: 13%">Tanggal</th>
            <th class="tc" style="width: 13%">Jth Tempo</th>
            <th class="tr" style="width: 16%">Jumlah</th>
            <th class="tr" style="width: 16%">Terutang</th>
            <th class="tr" style="width: 16%">Bayar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in data.detail" :key="d.fpNomor">
            <td class="tc">{{ d.no }}</td>
            <td>{{ d.fpNomor }}</td>
            <td class="tc">{{ d.fpTanggal }}</td>
            <td class="tc">{{ d.fpJthTempo }}</td>
            <td class="tr">{{ fmt(d.jumlah) }}</td>
            <td class="tr">{{ fmt(d.terutang) }}</td>
            <td class="tr">{{ fmt(d.bayar) }}</td>
          </tr>
          <tr v-if="!data.detail.length">
            <td colspan="7" class="tc empty">-</td>
          </tr>
        </tbody>
      </table>

      <!-- 5. Garis pemisah -->
      <div class="sep-line"></div>

      <!-- 6. Page footer -->
      <div class="terbilang-row">
        Terbilang : {{ data.terbilang }} Rupiah
      </div>
      <div class="total-row">
        <span></span>
        <span class="total-lbl">Total</span>
        <span class="total-val">{{ fmt(data.totalBayar) }}</span>
      </div>

      <div class="memo-box">
        <div class="memo-title">Keterangan</div>
        <div class="memo-body">{{ data.memo }}</div>
      </div>

      <div class="sign-row">
        <div class="sign-col" v-for="s in ['Disiapkan', 'Dianalisa', 'Dibayar', 'Diterima']" :key="s">
          <div class="sign-role">{{ s }}</div>
          <div class="sign-space"></div>
          <div class="sign-line"></div>
          <div class="sign-tgl">Tgl.</div>
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
  max-width: 205mm;
  margin: 0 auto 10px;
  display: flex;
  gap: 8px;
  align-items: center;
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
.tb:hover { background: #0369a1; }
.tb:disabled { opacity: 0.6; cursor: default; }
.tb-secondary { background: #F0F3F8; color: #0c4a6e; border-color: #A0AAB8; }
.tb-secondary:hover { background: #E8ECF1; }
.tb-loading { font-size: 12px; color: #E8ECF1; }

/* ── Dokumen (A5 landscape 216 × 139.5mm) ── */
.byc-doc {
  width: 205mm;
  min-height: 133mm;
  margin: 0 auto;
  background: #fff;
  padding: 6mm 6mm;
  font-family: "Plus Jakarta Sans", Arial, sans-serif;
  font-size: 8.5pt;
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
.doc-title { font-size: 12pt; font-weight: 700; text-align: right; }

.transfer-row { padding: 1.5mm 0; font-weight: 600; }
.rek-line { display: flex; gap: 2mm; }
.rek-label { min-width: 32mm; }

.info-box {
  display: flex;
  justify-content: space-between;
  border: 1px solid #000;
  padding: 2mm 3mm;
  margin-bottom: 2mm;
}
.info-left { max-width: 55%; }
.info-label { font-weight: 700; text-decoration: underline; }
.cus-nama { font-weight: 700; }
.cus-alamat { white-space: pre-line; }
.info-right { font-variant-numeric: tabular-nums; }
.info-right td:first-child { padding-right: 3mm; white-space: nowrap; }

.detail-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.detail-table th,
.detail-table td { border: 0.5px solid #000; padding: 1mm 1.5mm; }
.detail-table thead tr { background: #ececec; }
.tc { text-align: center; }
.tr { text-align: right; }
.empty { padding: 4mm; }

.sep-line { border-top: 1px solid #000; margin: 2mm 0 1mm; }

.terbilang-row { font-style: italic; margin-bottom: 1mm; }

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 4mm;
  font-weight: 700;
  border-top: 0.5px solid #000;
  border-bottom: 1px solid #000;
  padding: 1mm 1.5mm;
  margin-bottom: 2mm;
  font-variant-numeric: tabular-nums;
}
.total-val { min-width: 24mm; text-align: right; }

.memo-box { border: 1px solid #000; min-height: 9mm; padding: 1mm 2mm; margin-bottom: 3mm; }
.memo-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; }
.memo-body { white-space: pre-line; }

.sign-row { display: flex; justify-content: space-between; margin-top: 2mm; }
.sign-col { text-align: center; width: 22%; }
.sign-role { font-weight: 700; }
.sign-space { height: 10mm; }
.sign-line { border-top: 1px solid #000; }
.sign-tgl { font-size: 7.5pt; }

/* ── Cetak: hanya dokumen ── */
@media print {
  /* Ukuran kertas sengaja tidak dipatok di sini: kalau `size` diisi, dropdown
     kertas di dialog cetak Chrome ikut terkunci ke ukuran itu, sehingga
     pilihan A4 user diabaikan dan isi meluber ke halaman kedua. */
  @page { margin: 4mm; }
  body { background: #fff; }
  .print-page { background: #fff; padding: 0; min-height: 0; }
  .no-print { display: none !important; }
  .byc-doc {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 0;
  }
}
</style>
