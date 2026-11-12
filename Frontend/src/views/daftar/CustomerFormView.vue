<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { isAuthExpiredError } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import BaseForm from "@/components/BaseForm.vue";
import SearchModal from "@/components/SearchModal.vue";
import { IconUsers, IconSearch } from "@tabler/icons-vue";
import {
  customerFormApi,
  type CustomerForm,
} from "@/api/daftar/customerFormApi";
import { useAfterSave } from "@/composables/useAfterSave";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = computed(() => !!route.params.kode);
const isLoading = ref(false);
const isSaving = ref(false);

// ── Form State ───────────────────────────────────────────────────────
const form = ref<CustomerForm>({
  isEdit: false,
  kode: "",
  nama: "",
  alamat: "",
  kota: "",
  telp: "",
  fax: "",
  email: "",
  top: 0,
  jcKode: "",
  jcNama: "",
  cp: "",
  shipAddress: "",
  gcKode: "",
  gcNama: "",
  npwp: "",
  namaNpwp: "",
  alamatNpwp: "",
  kotaNpwp: "",
  marketing: "",
  namaMarketing: "",
  cabang: authStore.userCabang || "P01",
});

// ── Lookup Options ───────────────────────────────────────────────────
const jenisCustomerOptions = ref<{ kode: string; nama: string }[]>([]);
const golonganCustomerOptions = ref<{ kode: string; nama: string }[]>([]);
const marketingOptions = ref<any[]>([]);
const marketingLoading = ref(false);

// ── Modal State ──────────────────────────────────────────────────────
const showMarketingModal = ref(false);

// ── Checkbox "Sama dengan data Customer" ─────────────────────────────
const sameAsCustomer = ref(false);

// ── edtTOP enable hanya untuk FINANCE/PIUTANG ────────────────────────
const canEditTop = computed(() => {
  const userKode = authStore.userKode?.toUpperCase() || "";
  return userKode === "FINANCE" || userKode === "PIUTANG";
});

// ── Load Lookup Options ──────────────────────────────────────────────
const loadOptions = async () => {
  try {
    const [jenis, golongan] = await Promise.all([
      customerFormApi.getJenisCustomer(),
      customerFormApi.getGolonganCustomer(),
    ]);
    jenisCustomerOptions.value = jenis;
    golonganCustomerOptions.value = golongan;
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal memuat data lookup.");
  }
};

// ── Load Data ────────────────────────────────────────────────────────
const loadData = async () => {
  const kode = route.params.kode as string;
  if (!kode) {
    form.value.isEdit = false;
    form.value.kode = "";
    return;
  }

  isLoading.value = true;
  try {
    const data = await customerFormApi.getDetailForm(decodeURIComponent(kode));
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: data.kode || kode,
    };
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal memuat data customer.");
    router.push({ name: "customerBrowse" });
  } finally {
    isLoading.value = false;
  }
};

// ── Kode OnExit ──────────────────────────────────────────────────────
const onKodeBlur = async () => {
  if (!form.value.kode.trim() || form.value.isEdit) return;
  
  try {
    const data = await customerFormApi.getDetailForm(form.value.kode.trim());
    form.value = {
      ...form.value,
      ...data,
      isEdit: true,
      kode: data.kode,
    };
    toast.info(`Data customer "${data.nama}" ditemukan. Mode edit.`);
  } catch (e: any) {
    // Kode tidak ditemukan → mode insert baru
    form.value.isEdit = false;
  }
};

// ── Checkbox "Sama dengan data Customer" ─────────────────────────────
const onSameAsCustomer = () => {
  if (sameAsCustomer.value) {
    form.value.namaNpwp = form.value.nama;
    form.value.alamatNpwp = form.value.alamat;
    form.value.kotaNpwp = form.value.kota;
  }
};

// ── Search Marketing ─────────────────────────────────────────────────
const searchMarketing = async (query: string) => {
  marketingLoading.value = true;
  try {
    marketingOptions.value = await customerFormApi.getMarketing(query || "");
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error("Gagal mencari salesman.");
  } finally {
    marketingLoading.value = false;
  }
};

const selectMarketing = (item: any) => {
  form.value.marketing = item.kode;
  form.value.namaMarketing = item.nama;
  showMarketingModal.value = false;
};

// ── Validasi ────────────────────────────────────────────────────────
// Kode wajib = paritas Delphi (ufrmCustomer.pas: "Kode Customer Belum diisi").
// Golongan & Telp lebih ketat dari legacy (Delphi tidak memvalidasi keduanya).
// Telp hanya untuk customer BARU: 73-98% record lama masih kosong
// (Solo 2.235, Jogja 884, Madiun 396) sehingga record itu tidak bisa dikunci.
const validateSave = (): boolean => {
  if (!form.value.kode.trim()) {
    toast.warning("Kode Customer belum diisi.");
    return false;
  }
  if (!form.value.nama.trim()) {
    toast.warning("Nama Customer belum diisi.");
    return false;
  }
  if (!form.value.gcKode) {
    toast.warning("Golongan Customer belum dipilih.");
    return false;
  }
  if (!form.value.isEdit) {
    const t = form.value.telp.trim();
    if (!t) {
      toast.warning("Nomor telp wajib diisi.");
      return false;
    }
    if (t.length < 6) {
      toast.warning("Nomor telp minimal 6 karakter.");
      return false;
    }
  }
  return true;
};

// ── Save ─────────────────────────────────────────────────────────────
const confirmSave = async (action: "new" | "close") => {
  if (!validateSave()) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await customerFormApi.save(form.value);
    handlePostSave(action, form.value.kode);
  } catch (e: any) {
    if (isAuthExpiredError(e)) return;
    toast.error(e.response?.data?.message || "Gagal menyimpan data customer.");
  } finally {
    isSaving.value = false;
  }
};

// ── Navigation ───────────────────────────────────────────────────────

const resetForm = () => {
  form.value = {
    isEdit: false,
    kode: "",
    nama: "",
    alamat: "",
    kota: "",
    telp: "",
    fax: "",
    email: "",
    top: 0,
    jcKode: "",
    jcNama: "",
    cp: "",
    shipAddress: "",
    gcKode: "",
    gcNama: "",
    npwp: "",
    namaNpwp: "",
    alamatNpwp: "",
    kotaNpwp: "",
    marketing: "",
    namaMarketing: "",
    cabang: authStore.userCabang || "P01",
  };
};

const { handlePostSave } = useAfterSave({ onReset: resetForm });

// ── Init ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadOptions();
  await loadData();
});
</script>

<template>
  <BaseForm
    :title="isEdit ? 'Ubah Customer' : 'Tambah Customer Baru'"
    :icon="IconUsers"
    :is-loading="isLoading"
    :is-saving="isSaving"
    :is-edit-mode="isEdit"
    @save-action="confirmSave"
  >
    <div class="cust-form">
      <!-- ═══ DATA CUSTOMER ═══ -->
      <fieldset class="cust-groupbox">
        <legend class="cust-legend">Data Customer</legend>
        <div class="cust-groupbody">
          <div class="f-row">
            <label class="f-lbl">Kode <span class="req">*</span></label>
            <input
              v-model="form.kode"
              class="f-inp"
              :class="{ 'readonly-bg': form.isEdit }"
              :readonly="form.isEdit"
              maxlength="10"
              placeholder="C001..."
              @blur="onKodeBlur"
              @keydown.enter="onKodeBlur"
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Nama <span class="req">*</span></label>
            <input
              v-model="form.nama"
              class="f-inp"
              maxlength="50"
              placeholder="Nama customer..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Alamat</label>
            <input
              v-model="form.alamat"
              class="f-inp"
              maxlength="200"
              placeholder="Alamat..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Kota</label>
            <input
              v-model="form.kota"
              class="f-inp"
              maxlength="20"
              placeholder="Kota..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Telp <span v-if="!form.isEdit" class="req">*</span></label>
            <input
              v-model="form.telp"
              class="f-inp"
              inputmode="tel"
              maxlength="20"
              placeholder="No. telp..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Fax</label>
            <input
              v-model="form.fax"
              class="f-inp"
              maxlength="20"
              placeholder="No. fax..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Email</label>
            <input
              v-model="form.email"
              class="f-inp"
              maxlength="50"
              placeholder="Email..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Contact</label>
            <input
              v-model="form.cp"
              class="f-inp"
              maxlength="50"
              placeholder="Contact person..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Ship Address</label>
            <input
              v-model="form.shipAddress"
              class="f-inp"
              maxlength="100"
              placeholder="Alamat kirim..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Top</label>
            <input
              v-model.number="form.top"
              type="number"
              class="f-inp tr"
              :disabled="!canEditTop"
              min="0"
            />
            <span class="f-hint">hari</span>
          </div>
          <div class="f-row">
            <label class="f-lbl">Jenis Cust</label>
            <select v-model="form.jcKode" class="f-inp">
              <option value="" disabled>-- Pilih Jenis --</option>
              <option v-for="jc in jenisCustomerOptions" :key="jc.kode" :value="jc.kode">
                {{ jc.nama }}
              </option>
            </select>
          </div>
          <div class="f-row">
            <label class="f-lbl">Golongan <span class="req">*</span></label>
            <select v-model="form.gcKode" class="f-inp">
              <option value="" disabled>-- Pilih Golongan --</option>
              <option v-for="gc in golonganCustomerOptions" :key="gc.kode" :value="gc.kode">
                {{ gc.nama }}
              </option>
            </select>
          </div>
          <div class="f-row">
            <label class="f-lbl">Marketing</label>
            <div class="search-group">
              <input
                :value="form.marketing"
                class="f-inp readonly-bg"
                readonly
                placeholder="Kode"
              />
              <input
                :value="form.namaMarketing"
                class="f-inp readonly-bg"
                readonly
                placeholder="Nama marketing..."
              />
              <button
                class="btn-search"
                type="button"
                @click="showMarketingModal = true; searchMarketing('')"
              >
                <IconSearch :size="14" />
              </button>
            </div>
          </div>
        </div>
      </fieldset>

      <!-- ═══ DATA PAJAK ═══ -->
      <fieldset class="cust-groupbox">
        <legend class="cust-legend">Data Pajak</legend>
        <div class="cust-groupbody">
          <div class="f-row">
            <label class="check-lbl">
              <input
                v-model="sameAsCustomer"
                type="checkbox"
                @change="onSameAsCustomer"
              />
              Sama dengan data Customer
            </label>
          </div>
          <div class="f-row">
            <label class="f-lbl">NPWP</label>
            <input
              v-model="form.npwp"
              class="f-inp"
              maxlength="100"
              placeholder="NPWP..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Nama NPWP</label>
            <input
              v-model="form.namaNpwp"
              class="f-inp"
              maxlength="150"
              placeholder="Nama NPWP..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Alamat NPWP</label>
            <input
              v-model="form.alamatNpwp"
              class="f-inp"
              maxlength="250"
              placeholder="Alamat NPWP..."
            />
          </div>
          <div class="f-row">
            <label class="f-lbl">Kota NPWP</label>
            <input
              v-model="form.kotaNpwp"
              class="f-inp"
              maxlength="100"
              placeholder="Kota NPWP..."
            />
          </div>
        </div>
      </fieldset>
    </div>
  </BaseForm>

  <!-- ═══ MODAL SEARCH MARKETING ═══ -->
  <SearchModal
    v-model="showMarketingModal"
    title="Pilih Marketing (Salesman)"
    :columns="[
      { key: 'kode', title: 'Kode', width: '100px' },
      { key: 'nama', title: 'Nama Salesman' },
      { key: 'alamat', title: 'Alamat' },
    ]"
    :items="marketingOptions"
    :loading="marketingLoading"
    :server-search="true"
    search-placeholder="Cari salesman..."
    @select="selectMarketing"
    @search="searchMarketing"
  />
</template>

<style scoped>
/* Groupbox & legend: pola yang sama dipakai 25 form lain (desain sistem
   punya .ds-fieldset global, tapi 0 form memakainya karena tampilannya
   berbeda: legend lokal putih #FDFDFE, legend global sewarna fieldset). */
/* .f-row / .f-lbl / .f-inp / .readonly-bg / .check-lbl / .tr / .f-hint
   semuanya dari assets/design-system.css — tidak perlu didefinisikan
   di sini, dan terkunci !important sehingga tidak bisa di-style lokal. */
.cust-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  height: 100%;
  overflow-y: auto;
  background: #FDFDFE;
}

.cust-groupbox {
  border: 1px solid var(--ds-border, #A0AAB8);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.cust-legend {
  font-size: 12px;
  font-weight: 700;
  color: var(--ds-primary, #D97706);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  margin-left: 6px;
  background: #FDFDFE;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-bottom: none;
  align-self: flex-start;
  line-height: 1.4;
}

.cust-groupbody {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Penanda field wajib. 20 form memakai .req, 19 mendefinisikannya lokal —
   design-system.css tidak punya kelas ini, jadi harus ada di sini. */
.req {
  color: red;
  font-weight: 700;
}

/* .tr juga lokal di 30 dari 31 form yang memakainya. */
.tr {
  text-align: right;
}

.f-hint {
  font-size: 10.5px;
  color: var(--ds-text-muted, #8494A7);
  flex-shrink: 0;
}

/* Input yang tidak boleh diedit (TOP untuk non-FINANCE/PIUTANG). */
.f-inp:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
}

.search-group {
  display: flex;
  gap: 4px;
  flex: 1;
  max-width: 400px;
}

.btn-search {
  height: 22px;
  width: 28px;
  background: var(--ds-primary, #D97706);
  color: white;
  border: 1px solid var(--ds-primary-dark, #B45309);
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-search:hover {
  background: var(--ds-primary-dark, #B45309);
}
</style>
