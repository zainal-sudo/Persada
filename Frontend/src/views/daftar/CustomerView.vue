<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseBrowse from "@/components/BaseBrowse.vue";
import OtorisasiDialog from "@/components/OtorisasiDialog.vue";
import { customerApi, type CustomerRow } from "@/api/daftar/customerApi";
import { type OtorisasiKonteks } from "@/api/otorisasiApi";
import { useBrowse } from "@/composables/useBrowse";
import { IconUsers, IconFileSpreadsheet } from "@tabler/icons-vue";

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const {
  items,
  isLoading,
  selected,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  handleExport,
  fetchData,
} = useBrowse<CustomerRow>({
  fetchApi: () => customerApi.getBrowse(authStore.userCabang || "P01"),
  immediate: true,
});

const headers = [
  { key: "Kode", title: "Kode", width: "100px" },
  { key: "Nama", title: "Nama", width: "200px" },
  { key: "Alamat", title: "Alamat", minWidth: "250px" },
  { key: "Golongan", title: "Golongan", width: "100px" },
  { key: "Kota", title: "Kota", width: "100px" },
  { key: "Telp", title: "Telp", width: "100px" },
  { key: "Fax", title: "Fax", width: "100px" },
  { key: "Contact", title: "Contact", width: "100px" },
  { key: "Piutang", title: "Piutang", width: "140px", align: "right" as const },
  { key: "Jenis_Customer", title: "Jenis Customer", width: "120px" },
  { key: "NPWP", title: "NPWP", width: "140px" },
  { key: "NAMANPWP", title: "Nama NPWP", width: "180px" },
  { key: "ALAMATNPWP", title: "Alamat NPWP", minWidth: "200px" },
  { key: "last_paid", title: "Last Paid", width: "100px", align: "center" as const },
  { key: "Top", title: "TOP", width: "60px", align: "center" as const },
  { key: "Locked", title: "Locked", width: "80px", align: "center" as const },
  { key: "Marketing", title: "Marketing", width: "150px" },
];

const onAdd = () => {
  router.push({ name: "customerCreate" });
};

const onEdit = (item: CustomerRow) => {
  router.push({
    name: "customerEdit",
    params: { kode: encodeURIComponent(item.Kode) },
  });
};

// ── Klik-kanan: Lock / Open (paritas PopupMenu Delphi) ────────────────
const doLock = async (item: CustomerRow) => {
  try {
    await customerApi.updateLocked(item.Kode, 1);
    toast.success(`Customer ${item.Kode} dikunci.`);
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal mengunci customer.");
  }
};

const showOtorisasiDialog = ref(false);
const pendingOpenKode = ref("");
const otorisasiKonteks = ref<OtorisasiKonteks | null>(null);

const doOpen = (item: CustomerRow) => {
  pendingOpenKode.value = item.Kode;
  // Konteks => dialog pakai mode backend: kode dari waktu server + verifikasi
  // via /verify (tercatat DONE di totorisasi DB pusat). Detail mobile (Flutter)
  // di-enrich server via GET /otorisasi/:kode (piutang/bayar/omzet).
  otorisasiKonteks.value = {
    jenis: "CUSTOMER",
    variant: 1,
    form: { cusKode: item.Kode },
    detail: [],
  };
  showOtorisasiDialog.value = true;
};

const onOtorisasiSuccess = async () => {
  showOtorisasiDialog.value = false;
  try {
    await customerApi.updateLocked(pendingOpenKode.value, 0);
    toast.success(`Customer ${pendingOpenKode.value} dibuka.`);
    await fetchData();
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal membuka customer.");
  } finally {
    pendingOpenKode.value = "";
  }
};

const contextMenuItems = computed(() => {
  return [
    selected.value.length === 1 && selected.value[0].Locked === "Open"
      ? { label: "Update Status Locked", icon: "lock", action: (it: any) => doLock(it) }
      : null,
    selected.value.length === 1 && selected.value[0].Locked === "Locked"
      ? { label: "Open", icon: "lock_open", action: (it: any) => doOpen(it) }
      : null,
  ].filter(Boolean) as { label: string; icon?: string; action: (item: any) => void }[];
});

const fmt = (v: number) => new Intl.NumberFormat("id-ID").format(v || 0);

const fmtDate = (val: string | null) => {
  if (!val) return "-";
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return ;
  } catch { return val; }
};
</script>

<template>
  <BaseBrowse
    title="Daftar Customer"
    :icon="IconUsers"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :selected="selected"
    @update:selected="selected = $event"
    item-value="Kode"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :show-refresh="false"
    :fixed-layout="false"
    :context-menu-items="contextMenuItems"
    search-placeholder="Cari customer..."
    summary-key="Piutang"
    summary-label="Total Piutang"
    @refresh="fetchData"
    @add="onAdd"
    @edit="onEdit"
  >
    <template #extra-actions>
      <v-btn size="small" class="tb-btn tb-btn-success" data-fkey="export" @click="handleExport()">
        <template #prepend><IconFileSpreadsheet :size="13" :stroke-width="1.8" /></template>
        <span class="tb-fkey">[F8]</span> Export
      </v-btn>
    </template>
    <template #item.Piutang="{ value }">
      <span :style="{ color: value < 0 ? '#c62828' : 'inherit' }">
        {{ fmt(value) }}
      </span>
    </template>

    <template #item.Top="{ value }">
      <span>{{ value }} hari</span>
    </template>

    <template #item.Locked="{ value }">
      <span
        :style="{
          background: value === 'Open' ? 'rgba(59,89,152,0.1)' : '#FEE2E2',
          color: value === 'Open' ? 'var(--ds-primary, #D97706)' : '#c62828',
          padding: '1px 8px',
          borderRadius: '0',
          fontSize: '11px',
          fontWeight: 600,
        }"
      >
        {{ value }}
      </span>
    </template>

    <template #item.last_paid="{ value }">
      <span>{{ fmtDate(value) }}</span>
    </template>
  </BaseBrowse>

  <OtorisasiDialog
    v-model="showOtorisasiDialog"
    title="Otorisasi Buka Customer"
    :variant="1"
    :konteks="otorisasiKonteks"
    @success="onOtorisasiSuccess"
  />
</template>