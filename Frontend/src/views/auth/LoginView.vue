<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionStore } from "@/stores/permissionStore";
import { useToast } from "vue-toastification";
import { authApi } from "@/api/authApi";
import {
  IconDots,
  IconEye,
  IconEyeOff,
  IconLogin,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-vue";

const logoUrl = `${import.meta.env.BASE_URL}logo-amp.png`;
const bgUrl = `${import.meta.env.BASE_URL}logo-amp.png`;

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const toast = useToast();

const username = ref("");
const password = ref("");
const showPass = ref(false);
const isLoading = ref(false);
const usernameRef = ref<any>(null);

const showUserDialog = ref(false);
const userList = ref<{ kode: string; nama: string }[]>([]);
const userSearch = ref("");
const userListLoading = ref(false);

const filteredUsers = computed(() => {
  const q = userSearch.value.toUpperCase();
  if (!q) return userList.value;
  return userList.value.filter(
    (u) =>
      u.kode.toUpperCase().includes(q) || u.nama.toUpperCase().includes(q),
  );
});

const openUserDialog = async () => {
  showUserDialog.value = true;
  userSearch.value = "";
  userListLoading.value = true;
  try {
    userList.value = await authApi.getUsers();
  } catch {
    toast.error("Gagal memuat daftar user.");
  } finally {
    userListLoading.value = false;
  }
};

const selectUser = (kode: string) => {
  username.value = kode;
  showUserDialog.value = false;
  password.value = "";
  setTimeout(() => {
    const pwEl = document.getElementById("login-password");
    pwEl?.focus();
  }, 100);
};

const appVersion = __APP_VERSION__;

onMounted(() => {
  setTimeout(() => usernameRef.value?.focus(), 100);
});

const handleLogin = async () => {
  if (!username.value.trim()) {
    toast.warning("Username harus diisi.");
    usernameRef.value?.focus();
    return;
  }
  if (!password.value) {
    toast.warning("Password harus diisi.");
    return;
  }
  isLoading.value = true;
  try {
    await authStore.login(
      username.value.trim().toUpperCase(),
      password.value,
      "krm",
      "AM PERSADA",
    );
    await permissionStore.fetchAll();
    toast.success(`Selamat datang, ${authStore.userName}!`);
    router.push("/");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? "Login gagal.";
    toast.error(msg);
    usernameRef.value?.focus();
  } finally {
    isLoading.value = false;
  }
};

const onUsernameEnter = () => {
  const pwEl = document.getElementById("login-password");
  pwEl?.focus();
};
</script>

<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-img-overlay" :style="{ backgroundImage: `url(${bgUrl})` }" />
      <div class="bg-dark-overlay" />
    </div>
    <div class="login-container">
      <!-- Left panel — brand -->
      <div class="login-left">
        <div class="brand-area">
          <div class="brand-logo-wrap">
            <img :src="logoUrl" alt="Logo AMP" class="brand-logo-img" />
          </div>
          <h1 class="brand-name">PT. AM PERSADA</h1>
          <!-- <p class="brand-tagline">Sistem Distribusi Alat Kesehatan</p> -->
        </div>
        <div class="brand-footer">
          <div class="brand-version">v{{ appVersion }}</div>
        </div>
      </div>

      <!-- Right panel — form login -->
      <div class="login-right">
        <div class="login-card">
          <div class="login-card-header">
            <h2 class="login-title">Masuk</h2>
            <p class="login-sub">Silakan masuk ke akun Anda</p>
          </div>

          <div class="login-form">


            <!-- Username -->
            <div class="field-group">
              <label class="field-label">Username</label>
              <div class="field-user-wrap">
                <input
                  ref="usernameRef"
                  v-model="username"
                  type="text"
                  class="field-input field-input-user"
                  placeholder="Masukkan username..."
                  autocomplete="username"
                  @keydown.enter="onUsernameEnter"
                  :disabled="isLoading"
                />
                <button
                  class="btn-bantuan"
                  @click="openUserDialog"
                  type="button"
                  tabindex="-1"
                  title="Cari User"
                  :disabled="isLoading"
                >
                  <IconDots :size="14" :stroke-width="2" />
                </button>
              </div>
            </div>

            <!-- Password -->
            <div class="field-group">
              <label class="field-label">Password</label>
              <div class="field-pass-wrap">
                <input
                  id="login-password"
                  v-model="password"
                  :type="showPass ? 'text' : 'password'"
                  class="field-input field-input-pass"
                  placeholder="Masukkan password..."
                  autocomplete="current-password"
                  @keydown.enter="handleLogin"
                  :disabled="isLoading"
                />
                <button
                  class="pass-toggle"
                  @click="showPass = !showPass"
                  type="button"
                  tabindex="-1"
                >
                  <IconEyeOff v-if="showPass" :size="15" :stroke-width="1.8" />
                  <IconEye v-else :size="15" :stroke-width="1.8" />
                </button>
              </div>
            </div>

            <!-- Button login -->
            <button
              class="btn-login"
              @click="handleLogin"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="btn-spinner" />
              <IconLogin v-else :size="16" :stroke-width="2" />
              <span>{{ isLoading ? "Memproses..." : "Masuk" }}</span>
            </button>
          </div>

          <div class="login-footer">
            <span>&copy; {{ new Date().getFullYear() }} AM PERSADA</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- User Lookup Dialog -->
  <v-dialog v-model="showUserDialog" max-width="420" persistent>
    <v-card rounded="false" class="user-dialog-card">
      <v-card-title class="d-flex align-center pa-3 pb-2" style="border-top: 3px solid var(--ds-primary, #0284c7);">
        <IconUser :size="16" :stroke-width="2" class="mr-2" style="color: var(--ds-primary, #0284c7);" />
        <span class="text-subtitle-1 font-weight-bold">Pilih User</span>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="showUserDialog = false">
          <IconX :size="14" />
        </v-btn>
      </v-card-title>

      <v-card-text class="pt-2">
        <div class="user-search-wrap">
          <IconSearch :size="13" class="user-search-icon" />
          <input
            v-model="userSearch"
            type="text"
            class="user-search-input"
            placeholder="Cari kode atau nama..."
            autofocus
          />
        </div>

        <div class="user-list">
          <div v-if="userListLoading" class="user-list-loading">
            <v-progress-circular indeterminate color="primary" size="18" />
            <span>Memuat...</span>
          </div>
          <div v-else-if="filteredUsers.length === 0" class="user-list-empty">
            Tidak ada user ditemukan.
          </div>
          <button
            v-for="u in filteredUsers"
            :key="u.kode"
            class="user-item"
            @click="selectUser(u.kode)"
          >
            <span class="user-item-kode">{{ u.kode }}</span>
            <span class="user-item-nama">{{ u.nama }}</span>
          </button>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* ── Page ── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a2a4a 0%, #0369a1 50%, #0284c7 100%);
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
  position: relative;
  overflow: hidden;
  animation: pageIn 0.5s ease-out;
}

@keyframes pageIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.login-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.bg-img-overlay {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(12px);
  transform: scale(1.08);
  opacity: 0.3;
}

.bg-dark-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, rgba(26, 42, 74, 0.85) 0%, rgba(59, 89, 152, 0.7) 100%);
}

.login-container {
  position: relative;
  z-index: 1;
}

/* ── Container ── */
.login-container {
  display: flex;
  width: 780px;
  min-height: 440px;
  border: none;
  overflow: hidden;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.15),
    0 20px 50px -12px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: cardIn 0.6s ease-out 0.15s both;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Left panel ── */
.login-left {
  width: 280px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0369a1 0%, #0284c7 40%, #4a6fa8 100%);
  padding: 36px 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
  position: relative;
  overflow: hidden;
}

.login-left::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 50%;
}

.login-left::after {
  content: '';
  position: absolute;
  bottom: -60px;
  left: -30px;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 50%;
}

.brand-area {
  margin-bottom: 0;
  position: relative;
  z-index: 1;
}

.brand-logo-wrap {
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease;
}

.brand-logo-wrap:hover {
  transform: scale(1.05);
}

.brand-logo-img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.brand-name {
  font-size: 19px;
  font-weight: 800;
  margin: 0 0 6px;
  letter-spacing: 0.04em;
  line-height: 1.3;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.brand-tagline {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  line-height: 1.5;
}

.brand-version {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 28px;
  position: relative;
  z-index: 1;
}

/* ── Right panel ── */
.login-right {
  flex: 1;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
}

.login-card {
  width: 100%;
  max-width: 320px;
}

.login-card-header {
  margin-bottom: 28px;
}

.login-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ds-text, #0c4a6e);
  margin: 0 0 6px;
}

.login-sub {
  font-size: 12px;
  color: var(--ds-text-muted, #8494A7);
  margin: 0;
}

/* ── Form ── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ds-text-secondary, #5A6A7E);
  letter-spacing: 0.02em;
}

.field-input {
  height: 36px;
  border: 1.5px solid var(--ds-border, #A0AAB8);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
  color: var(--ds-text, #0c4a6e);
  background: white;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.field-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 3px rgba(59, 89, 152, 0.12);
}

.field-input:disabled {
  background: var(--ds-surface-inset, #E0E4EA);
  color: var(--ds-text-muted, #8494A7);
  cursor: not-allowed;
  border-color: transparent;
}

.field-input::placeholder {
  color: #b0b8c4;
}

/* User field with bantuan button */
.field-user-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input-user {
  padding-right: 36px;
}

.btn-bantuan {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ds-text-muted, #8494A7);
  transition: all 0.2s ease;
}

.btn-bantuan:hover:not(:disabled) {
  background: var(--ds-primary-50, #E8EDF5);
  color: var(--ds-primary, #0284c7);
}

.btn-bantuan:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Select field */
.field-select-wrap {
  position: relative;
}

.field-select {
  appearance: none;
  -webkit-appearance: none;
  padding-left: 32px;
  padding-right: 32px;
  cursor: pointer;
  border-radius: 6px;
}

.field-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-select-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ds-text-muted, #8494A7);
  pointer-events: none;
}

.field-select-arrow {
  position: absolute;
  right: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ds-text-muted, #8494A7);
  pointer-events: none;
}

/* Password field */
.field-pass-wrap {
  position: relative;
}

.field-input-pass {
  padding-right: 40px;
}

.pass-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ds-text-muted, #8494A7);
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.pass-toggle:hover {
  color: var(--ds-primary, #0284c7);
  background: var(--ds-primary-50, #E8EDF5);
}

/* Login button */
.btn-login {
  height: 38px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 6px;
  box-shadow: 0 2px 8px rgba(59, 89, 152, 0.35);
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
}

.btn-login:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1 0%, #1f3357 100%);
  box-shadow: 0 4px 14px rgba(59, 89, 152, 0.45);
  transform: translateY(-1px);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(59, 89, 152, 0.3);
}

.btn-login:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

/* Spinner */
.btn-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.login-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 10px;
  color: var(--ds-text-muted, #8494A7);
}

/* ── User Dialog ── */
.user-dialog-card {
  overflow: hidden;
}

.user-search-wrap {
  position: relative;
  margin-bottom: 8px;
}

.user-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ds-text-muted, #8494A7);
  pointer-events: none;
}

.user-search-input {
  width: 100%;
  height: 32px;
  border: 1.5px solid var(--ds-border, #A0AAB8);
  border-radius: 6px;
  padding: 0 10px 0 32px;
  font-size: 12px;
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.user-search-input:focus {
  border-color: var(--ds-primary, #0284c7);
  box-shadow: 0 0 0 3px rgba(59, 89, 152, 0.1);
}

.user-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--ds-border, #A0AAB8);
  border-radius: 6px;
}

.user-list-loading,
.user-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  font-size: 11px;
  color: var(--ds-text-muted, #8494A7);
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: none;
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid var(--ds-border-light, #C4CAD3);
  transition: background-color 0.15s ease;
}

.user-item:last-child {
  border-bottom: none;
}

.user-item:hover {
  background: var(--ds-primary-50, #E8EDF5);
}

.user-item:active {
  background: #dce4f0;
}

.user-item-kode {
  font-family: var(--ds-font-mono, "Consolas", monospace);
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-primary-dark, #0369a1);
  min-width: 70px;
}

.user-item-nama {
  font-size: 12px;
  color: var(--ds-text-secondary, #5A6A7E);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .login-left {
    display: none;
  }
  .login-container {
    width: 92%;
    min-height: unset;
    border-radius: 8px;
  }
  .login-right {
    padding: 28px 20px;
  }
  .login-card {
    max-width: 100%;
  }
}
</style>
