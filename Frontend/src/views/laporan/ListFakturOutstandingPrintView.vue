<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import {
  listFakturOutstandingApi,
  type ListFakturOutstandingRow,
} from "@/api/laporan/listFakturOutstandingApi";

// Cetak FOS — replikasi report/FOS.fr3 persis (browser print, bukan QZ Tray).
// Judul + Tanggal Faktur + Filter + header kolom DIULANG tiap grup Customer
// (fr3: GroupHeader Condition="Customer", ReprintOnNewPage). Subtotal per
// customer, tanpa grand total. Blok tanda tangan sekali di akhir.
const route = useRoute();
const router = useRouter();
const toast = useToast();

const items = ref<ListFakturOutstandingRow[]>([]);
const isLoading = ref(true);
const isPrinting = ref(false);

const startDate = String(route.query.startDate || "");
const endDate = String(route.query.endDate || "");

// fr3 memakai mmm (locale Indonesia).
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const parseDate = (val: string | null): Date | null => {
  if (!val) return null;
  const dt = new Date(val);
  return isNaN(dt.getTime()) ? null : dt;
};

// Kolom Tanggal & Jt Tempo: "dd mmm yyyy".
const fmtTgl = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;

const tanggalCell = (val: string) => {
  const d = parseDate(val);
  return d ? fmtTgl(d) : "-";
};

// fr3: Jt Tempo = Tanggal Faktur + 30 hari (Memo11 = <Tanggal> + 30).
const jthTempoCell = (val: string) => {
  const d = parseDate(val);
  if (!d) return "-";
  const jt = new Date(d);
  jt.setDate(jt.getDate() + 30);
  return fmtTgl(jt);
};

// Header "Tanggal Faktur :" = FormatDateTime('dd/mm/yyyy', enddate).
const tanggalFaktur = computed(() => {
  const d = parseDate(endDate);
  if (!d) return endDate || "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
});

// fr3 mask %2.n → ribuan + 2 desimal.
const fmt = (v: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// fr3: group by Customer, order by customer, tanggal (SQL cxButton3Click).
const groups = computed(() => {
  const sorted = [...items.value].sort(
    (a, b) =>
      String(a.Customer).localeCompare(String(b.Customer)) ||
      String(a.Tanggal).localeCompare(String(b.Tanggal)),
  );
  const map = new Map<string, { customer: string; rows: ListFakturOutstandingRow[] }>();
  for (const r of sorted) {
    const key = String(r.Customer || "-");
    if (!map.has(key)) map.set(key, { customer: key, rows: [] });
    map.get(key)!.rows.push(r);
  }
  return [...map.values()];
});

const sum = (rows: ListFakturOutstandingRow[], key: "Total" | "Bayar" | "Retur" | "Sisa_piutang") =>
  rows.reduce((s, r) => s + Number(r[key] || 0), 0);

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
  else router.push("/laporan/list-faktur-outstanding");
};

// Snapshot baris terfilter dari grid (fosPrintPayload). Dipakai supaya cetak
// mengikuti filter kolom + search. Kalau tak ada / periode beda (mis. buka URL
// langsung atau refresh), fallback fetch by periode.
const readPayload = (): ListFakturOutstandingRow[] | null => {
  try {
    const raw = sessionStorage.getItem("fosPrintPayload");
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.startDate !== startDate || p?.endDate !== endDate) return null;
    return Array.isArray(p.rows) ? (p.rows as ListFakturOutstandingRow[]) : null;
  } catch {
    return null;
  }
};

onMounted(async () => {
  try {
    const snap = readPayload();
    items.value = snap ?? (await listFakturOutstandingApi.getBrowse({ startDate, endDate }));
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
      <span v-if="isLoading" class="tb-loading">Memuat...</span>
    </div>

    <div class="fos-doc">
      <p v-if="!groups.length && !isLoading" class="empty no-print">Tidak ada data untuk periode ini.</p>

      <section v-for="(g, gi) in groups" :key="gi" class="cust-block">
        <div class="doc-title">FAKTUR PENJUALAN OUTSTANDING</div>

        <div class="meta-row">
          <span class="meta-lbl">Tanggal Faktur</span>
          <span class="meta-sep">:</span>
          <span>{{ tanggalFaktur }}</span>
        </div>

        <table class="grid">
          <colgroup>
            <col style="width: 25px" />
            <col style="width: 94px" />
            <col style="width: 75px" />
            <col style="width: 77px" />
            <col style="width: 168px" />
            <col style="width: 83px" />
            <col style="width: 76px" />
            <col style="width: 60px" />
            <col style="width: 76px" />
          </colgroup>
          <thead>
            <tr>
              <th class="tc">No</th>
              <th>Nomor</th>
              <th>Tanggal</th>
              <th>Jt Tempo</th>
              <th>Customer</th>
              <th class="tr">Total</th>
              <th class="tr">Bayar</th>
              <th class="tr">Retur</th>
              <th class="tr">Sisa Piutang</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in g.rows" :key="i">
              <td class="tc">{{ i + 1 }}</td>
              <td>{{ r.Nomor }}</td>
              <td>{{ tanggalCell(r.Tanggal) }}</td>
              <td>{{ jthTempoCell(r.Tanggal) }}</td>
              <td>{{ r.Customer }}</td>
              <td class="tr">{{ fmt(r.Total) }}</td>
              <td class="tr">{{ fmt(r.Bayar) }}</td>
              <td class="tr">{{ fmt(r.Retur) }}</td>
              <td class="tr">{{ fmt(r.Sisa_piutang) }}</td>
            </tr>
            <tr class="subtotal">
              <td colspan="5" class="subtotal-lbl">Total</td>
              <td class="tr">{{ fmt(sum(g.rows, "Total")) }}</td>
              <td class="tr">{{ fmt(sum(g.rows, "Bayar")) }}</td>
              <td class="tr">{{ fmt(sum(g.rows, "Retur")) }}</td>
              <td class="tr">{{ fmt(sum(g.rows, "Sisa_piutang")) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Blok tanda tangan — posisi persis FOS.fr3 GroupFooter1. -->
      <div v-if="groups.length" class="ttd">
        <div class="ttd-role" style="left: 1.46%">Yang Menyerahkan,</div>
        <div class="ttd-line" style="left: 0.49%; width: 18.45%"></div>

        <div class="ttd-role" style="left: 28.66%">Yang Menerima,</div>
        <div class="ttd-line" style="left: 26.23%; width: 17.97%"></div>

        <div class="ttd-role" style="left: 53.91%">Yang menyetorkan,</div>
        <div class="ttd-line" style="left: 51.97%; width: 18.45%"></div>

        <div class="ttd-role" style="left: 80.14%">Yang Menerima,</div>
        <div class="ttd-line" style="left: 78.19%; width: 17.97%"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Wadah halaman = kontainer scroll layar (body app di-overflow:hidden). */
.print-page {
  height: 100vh;
  overflow-y: auto;
  background: #fff;
}

.fos-doc {
  font-family: "Trebuchet MS", Tahoma, Arial, Helvetica, sans-serif;
  font-size: 11px;
  line-height: 1.35;
  color: #000;
  background: white;
  padding: 8mm 5mm;
  min-height: 100vh;
}

/* Toolbar layar (tidak tercetak) */
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
  background: #D97706;
  color: white;
  border: 1px solid #B45309;
  border-radius: 0;
  cursor: pointer;
  font-size: 13px;
}
.tb-secondary {
  background: white;
  color: #78350F;
}
.tb-loading {
  font-size: 12px;
  color: #5a6a7e;
}
.empty {
  font-size: 12px;
  color: #5a6a7e;
}

/* fr3: tiap grup customer = blok tersendiri (judul diulang). */
.cust-block {
  margin-bottom: 18px;
}

.doc-title {
  font-family: Tahoma, sans-serif;
  font-size: 16px;
  text-decoration: underline;
  margin-bottom: 10px;
}

.meta-row {
  display: flex;
  gap: 6px;
}
.meta-lbl {
  width: 95px;
}
.meta-sep {
  margin-right: 6px;
}

.grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 10px;
}
.grid th,
.grid td {
  padding: 1px 4px;
  border: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  height: 17px;
}
.grid .tr {
  text-align: right;
}
.grid .tc {
  text-align: center;
}

/* Border fr3: tepi luar saja + garis atas/bawah di header & subtotal. */
.grid thead th {
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
  font-weight: 700;
}
.grid thead th:first-child,
.grid tbody td:first-child {
  border-left: 1px solid #000;
}
.grid thead th:last-child,
.grid tbody td:last-child {
  border-right: 1px solid #000;
}
.grid .subtotal td {
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
  font-weight: 700;
}
.subtotal-lbl {
  text-align: right;
}

/* Blok tanda tangan — posisi absolut persis fr3 (left/width %). */
.ttd {
  position: relative;
  height: 84px;
  margin-top: 40px;
  font-size: 11px;
}
.ttd-role {
  position: absolute;
  top: 0;
  white-space: nowrap;
}
.ttd-line {
  position: absolute;
  top: 68px;
  height: 0;
  border-bottom: 1px solid #000;
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-page {
    height: auto;
    overflow: visible;
  }
  .fos-doc {
    padding: 0;
    min-height: 0;
  }
  .cust-block {
    page-break-inside: auto;
  }
  .grid {
    page-break-inside: auto;
  }
  .grid tr {
    page-break-inside: avoid;
  }
}
</style>

<style>
@page {
  margin: 5mm;
}
</style>
