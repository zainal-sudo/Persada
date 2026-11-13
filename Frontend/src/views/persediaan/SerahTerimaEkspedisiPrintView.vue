<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  serahTerimaEkspedisiApi,
  type SerahTerimaEkspedisiPrintData,
} from "@/api/persediaan/serahTerimaEkspedisiApi";

// Slip dicetak mengikuti koordinat report\STE.fr3 / STE2.fr3 apa adanya:
// satuan px @96dpi, halaman Letter 215.9x279.4mm, margin 5mm = 18.89765px.
//   "ste"  → STE.fr3  (formulir per faktur)      — tipe FP / DO
//   "ste2" → STE2.fr3 (rincian barang mutasi)   — tipe MUTASI
const route = useRoute();
const router = useRouter();
const toast = useToast();

const data = ref<SerahTerimaEkspedisiPrintData | null>(null);
const isLoading = ref(true);
const isPrinting = ref(false);

const isMutasi = computed(() => data.value?.mode === "ste2");

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// STE.fr3 memakai DisplayFormat fkDateTime dengan "dd mmmm yyyy".
const fmtTanggal = (val: string | null) => {
  if (!val) return "";
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  return `${dt.getDate()} ${NAMA_BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
};

// STE2.fr3 memakai DisplayFormat "%g" → angka polos tanpa pemisah ribuan.
const fmtQty = (v: number | null | undefined) => (v == null ? "" : String(Number(v)));

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
  else router.push("/persediaan/serah-terima-ekspedisi");
};

onMounted(async () => {
  const nomor = String(route.params.nomor || "");
  try {
    data.value = await serahTerimaEkspedisiApi.getPrintData(nomor);
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
      <button class="tb" :disabled="isLoading || isPrinting" @click="doPrint">Cetak</button>
      <button class="tb tb-secondary" @click="goBack">Tutup</button>
      <span class="tb-mode">{{ isMutasi ? "Slip STE2 (rincian barang)" : "Slip STE (formulir)" }}</span>
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <div v-if="data" class="ste-doc">
      <!-- GroupHeader2 : 177.07885px, baris tabel 20.11812px di y 156.92146 -->
      <div class="gh2">
        <div class="m title" style="left: 0; top: 3.77953px; width: 778.205px; height: 23.89765px">SERAH TERIMA EKSPEDISI</div>
        <div class="m" style="left: 5px; top: 37.7953px; width: 55.93689px">Nomor   :</div>
        <div class="m" style="left: 59.89765px; top: 37.57483px; width: 275.90569px">{{ data.header.nomor }}</div>
        <div class="m" style="left: 5px; top: 59.47248px; width: 55.93689px">Tanggal :</div>
        <div class="m" style="left: 59.89765px; top: 60.47248px; width: 275.90569px">{{ fmtTanggal(data.header.tanggal) }}</div>
        <div class="m" style="left: 5px; top: 94.48825px; width: 116.40937px">Kepada Yth,</div>
        <div class="m wrap" style="left: 5px; top: 108.60637px; width: 351.49629px; height: 49.13389px">{{ data.header.namaEkspedisi }}</div>
      </div>

      <!-- MasterData2 : 17.33859px per baris -->
      <table v-if="!isMutasi" class="grid g-ste">
        <colgroup>
          <col style="width: 27px" />
          <col style="width: 95.04px" />
          <col style="width: 357.79px" />
          <col style="width: 107px" />
          <col style="width: 94.49px" />
        </colgroup>
        <thead>
          <tr>
            <th>No </th>
            <th>INVOICE</th>
            <th>NAMA CUSTOMER</th>
            <th class="tc">BERAT (KG)</th>
            <th class="tc">KUBIKASI (M3)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in data.detail" :key="i">
            <td class="tc">{{ i + 1 }}</td>
            <td>{{ d.nomor }}</td>
            <td>{{ d.nama }}</td>
            <td class="tr"></td>
            <td class="tr"></td>
          </tr>
        </tbody>
      </table>

      <table v-else class="grid g-ste2">
        <colgroup>
          <col style="width: 33.8px" />
          <col style="width: 72.66px" />
          <col style="width: 103.58px" />
          <col style="width: 272.86px" />
          <col style="width: 75.25px" />
          <col style="width: 60.68px" />
          <col style="width: 73px" />
          <col style="width: 79.37px" />
        </colgroup>
        <thead>
          <tr>
            <th>No </th>
            <th>TUJUAN</th>
            <th>NO. MUTASI</th>
            <th>NAMA BARANG</th>
            <th>SATUAN</th>
            <th>JUMLAH</th>
            <th class="tc">BERAT (KG)</th>
            <th class="tc">KUBIKASI (M3)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in data.detail" :key="i">
            <td class="tc">{{ i + 1 }}</td>
            <td>{{ d.tujuan }}</td>
            <td>{{ d.nomor }}</td>
            <td>{{ d.nama }}</td>
            <td>{{ d.satuan }}</td>
            <td class="tr">{{ fmtQty(d.qty) }}</td>
            <td class="tr"></td>
            <td class="tr"></td>
          </tr>
        </tbody>
      </table>

      <!-- GroupFooter2 : 125.28355px -->
      <div class="gf2">
        <div class="m" style="left: 5px; top: 15.23624px; width: 244.91339px">NO. CONTAINER    :  ................................</div>
        <div class="m" style="left: 5px; top: 36.91342px; width: 244.91339px">NO. SEAL               :  ................................</div>
        <div class="m" style="left: 5px; top: 57.5906px; width: 244.91339px">SCHEDULE KAPAL  :  ................................</div>
        <div class="m" style="left: 5px; top: 78.26778px; width: 244.91339px">REAL BERANGKAT  :  ................................</div>
        <div class="m" style="left: 377.953px; top: 15.11812px; width: 244.91339px">NO. POLISI    :  ................................</div>
        <div class="m" style="left: 377.953px; top: 36.7953px; width: 244.91339px">DRIVER          :  ................................</div>
        <div class="m" style="left: 377.953px; top: 57.47248px; width: 244.91339px">CHECKER       :  ................................</div>
      </div>

      <!-- GroupHeader1 : 3.77953px (kosong) — GroupFooter1 : 98.26778px -->
      <div class="gf1">
        <div class="m" style="left: 76.41744px; top: 3.77953px; width: 37.7953px">Salam</div>
        <div class="m" style="left: 226.19697px; top: 3.77953px; width: 94.48825px">Diserahkan oleh</div>
        <div class="m" style="left: 419.73253px; top: 3.77953px; width: 64.25201px">Diterima</div>
        <div class="m" style="left: 608.70903px; top: 3.77953px; width: 64.25201px">Diterima</div>
        <div class="m sig" style="left: 24.62214px">____________________<br />Branch Manager</div>
        <div class="m sig" style="left: 192.19697px">____________________<br />Gudang</div>
        <div class="m sig" style="left: 374.17347px">____________________<br />Customer</div>
        <div class="m sig" style="left: 563.14997px">____________________<br />Ekspedisi</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  font-family: "Trebuchet MS", Arial, Helvetica, sans-serif;
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
  border-radius: 0;
  cursor: pointer;
  font-size: 13px;
}
.tb-secondary {
  background: white;
  color: #0c4a6e;
}
.tb-mode {
  font-size: 12px;
  color: #5a6a7e;
}
.tb-loading {
  font-size: 12px;
  color: #5a6a7e;
}

@page {
  size: letter;
  margin: 5mm;
}

.ste-doc {
  position: relative;
  width: 778.205px;
  padding: 18.89765px;
  background: white;
  color: #000;
  font: 11px/1.2 "Trebuchet MS", Arial, Helvetica, sans-serif;
}

.gh2 {
  position: relative;
  height: 156.92146px;
}
.gf2 {
  position: relative;
  height: 125.28355px;
}
.gf1 {
  position: relative;
  height: 98.26778px;
  margin-top: 3.77953px;
}

/* Satu memo fr3. white-space: pre setara WordWrap="False" + spasi literal. */
.m {
  position: absolute;
  height: 20.11812px;
  white-space: pre;
}
.m.wrap {
  white-space: normal;
}
.title {
  font: italic 700 16px Tahoma, sans-serif;
  text-align: center;
  border-bottom: 1px solid #000;
}
.sig {
  width: 143.62214px;
  top: 56.69295px;
  height: 30.23624px;
  text-align: center;
  white-space: normal;
}

.grid {
  margin-left: 5px;
  border-collapse: collapse;
  table-layout: fixed;
}
.g-ste {
  width: 681.32px;
}
.g-ste2 {
  width: 771.2px;
}
.grid th,
.grid td {
  padding: 1px 4px;
  border: 0.5px solid #000;
  font-size: 11px;
  font-weight: 400;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.grid thead th {
  height: 20.11812px;
  font-weight: 700;
  vertical-align: middle;
}
.grid tbody td {
  height: 17.33859px;
  vertical-align: top;
}
.grid .tc {
  text-align: center;
}
.grid .tr {
  text-align: right;
}

@media print {
  .no-print {
    display: none !important;
  }
  .ste-doc {
    padding: 0;
  }
  .grid tr {
    page-break-inside: avoid;
  }
}
</style>
