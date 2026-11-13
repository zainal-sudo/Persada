<template>
  <div class="err-page">
    <div class="err-code">404</div>
    <div class="err-title">Halaman Tidak Ditemukan</div>
    <div class="err-sub">Halaman yang Anda cari tidak ada.</div>
    <button class="err-btn" @click="$router.push('/')">
      Kembali ke Dashboard
    </button>
  </div>
</template>
<style scoped>
.err-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--ds-bg, #E8ECF1);
  gap: 10px;
  font-family: var(--ds-font, "Plus Jakarta Sans", system-ui, sans-serif);
}
.err-code {
  font-size: 72px;
  font-weight: 800;
  color: var(--ds-primary, #0284c7);
  line-height: 1;
}
.err-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--ds-text, #0c4a6e);
}
.err-sub {
  font-size: 13px;
  color: var(--ds-text-muted, #8494A7);
}
.err-btn {
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--ds-primary, #0284c7);
  color: white;
  border: none;
  border-radius: 0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.err-btn:hover {
  background: var(--ds-primary-dark, #0369a1);
}
</style>
