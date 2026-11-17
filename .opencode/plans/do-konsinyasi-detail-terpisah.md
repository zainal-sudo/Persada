# DO — Pemisahan Detail Internal vs Konsinyasi (Opsi B)

## Tujuan
Modal pilih stok DO hanya melihat stok gudang header, sehingga barang konsinyasi
(stoknya ada di gudang konsinyasi hasil Titip Barang) tidak pernah menampilkan
expired/idbatch. Solusi (pilihan user): **dua tombol Tambah Detail terpisah**
(internal vs konsinyasi) + picker 🔍 per baris bercabang, dan kolom Stok baris
konsinyasi menampilkan stok gudang konsinyasinya.

## Backend — `Backend/src/services/penjualan/doFormService.js`

1. **`searchStok` (internal)** — exclude item konsinyasi:
   - Bagian 1 (gudang header): tambah `AND IFNULL(b.brg_iskonsinyasi, 0) = 0` di WHERE.
   - Bagian 2 (UNION, barang tanpa stok): tambah filter sama di WHERE luar.
2. **Fungsi baru `searchStokKons(nomorSO, nomorDO, search)`** + export:
   - Bagian 1: item SO `brg_iskonsinyasi = 1` yang punya stok di gudang konsinyasi:
     ```sql
     INNER JOIN tmasterstok m ON m.mst_brg_kode = b.brg_kode
       AND m.mst_gdg_kode IN (SELECT gdg_kode FROM tgudang WHERE IFNULL(gdg_iskonsinyasi,0)=1)
     INNER JOIN tso_dtl d ON d.sod_brg_kode = b.brg_kode AND d.sod_so_nomor = ?
     WHERE IFNULL(b.brg_iskonsinyasi,0) = 1 AND m.mst_noreferensi <> ?
       AND (b.brg_nama LIKE ? OR b.brg_kode LIKE ?)
     GROUP BY b.brg_kode, b.brg_nama, b.brg_satuan, m.mst_expired_date, m.mst_idbatch, m.mst_gdg_kode
     HAVING SUM(m.mst_stok_in - m.mst_stok_out) <> 0
     ```
     kolom: sku, expired, namaBarang, idBatch, stok, satuan, isExpired,
     isKonsinyasi(=1), **gdgKons = m.mst_gdg_kode**, kurang (subquery sisa SO).
   - Bagian 2 (UNION): item konsinyasi di SO yang BELUM punya stok di gudang
     konsinyasi mana pun → stok 0, expired NULL, idBatch '', gdgKons ''.
   - Param: [nomorSO, nomorDO, q, q, nomorSO, nomorSO, nomorDO, q, q].
3. **`getDetailStok`** — dukung baris tanpa stok (bagian 2 konsinyasi, gdgKode ''):
   - `if (!gdgKode)` → query info barang + sisa SO saja tanpa join tmasterstok
     (stok 0, expired NULL, idBatch ''). Tetap terapkan logika isEdit
     (sudah = 0, kurang = sod_qty).
4. **`getDetailForm`** — stok baris konsinyasi dari gudang konsinya:
   ```sql
   st.mst_gdg_kode = IF(IFNULL(b.brg_iskonsinyasi,0)=1, IFNULL(d.dod_gdg_kons,''), d.dod_gdg_kode)
   ```
5. **`doFormController.js`** — handler baru `searchStokKons`
   (wajib `nomorSO`; `nomorDO`/`search` opsional). Longgarkan validasi
   `getDetailStok`: `gdgKode` boleh kosong (baris bagian 2 konsinyasi).
6. **`doFormRoutes.js`** — `router.get("/search-stok-kons", verifyToken, checkPermission("view"), ctrl.searchStokKons);`
   (sebelum route `/:nomor`).

## Frontend — `Frontend/src/api/penjualan/doFormApi.ts`

7. Tambah:
   ```ts
   searchStokKons: async (nomorSO: string, nomorDO: string, search = "") =>
     api.get("/penjualan/do/form/search-stok-kons", { params: { nomorSO, nomorDO, search } })
   ```

## Frontend — `Frontend/src/views/penjualan/DOFormView.vue`

8. **Toolbar detail**: dua tombol — "Tambah Detail" (internal, perilaku lama) +
   tombol baru **"Tambah Detail Konsinyasi"** (kedua lokasi toolbar, line ±885
   dan ±1023).
9. **Mode modal checklist**: `tambahMode = ref<"internal" | "kons">("internal")`;
   `openTambahDetail(mode)` — mode kons tidak wajibkan gdgKode header (tetap
   wajib nomorSO); load & search server-side (`onTambahDetailSearch`) memanggil
   `searchStokKons` saat mode kons. Judul modal menyesuaikan.
10. **Modal checklist**: kolom baru "Gud. Kons" (tampil saat mode kons,
    `brg.gdgKons || '-'`); empty-row `:colspan` 8/7 dinamis. `brgKey` ditambah
    `gdgKons` agar SKU sama di dua gudang konsinyasi bisa dipilih keduanya;
    `:key` baris modal juga.
11. **`addStokRow`** bercabang on `Number(item.isKonsinyasi) === 1`:
    - gudang lookup stok = `item.gdgKons || ""` (bukan header gudang);
    - `newRow.gdgKons = item.gdgKons || ""`, `gudang = header gudang`,
      `stok` = stok konsinyasi;
    - dup-guard: sku+expired+idBatch+**gdgKons** (bukan gudang header).
12. **`openStokModal(idx)`** bercabang on baris `isKonsinyasi === 1`:
    panggil `searchStokKons` (tanpa wajib gdgKode header); baris internal tetap
    `searchStok` lama.
13. **`selectStok(item)`** bercabang: kons → `getDetailStok` dengan
    `gdgKode = item.gdgKons || ""`, set `newRow.gdgKons` dari item, dup-guard
    per gdgKons; internal → perilaku lama.
14. **Modal Pilih Stok**: kolom "Gud. Kons" (computed `stokModalHasKons`), `:key`
    + `gdgKons`.
15. **Watcher perubahan `gdgKons`** (dropdown grid, baris bagian 2): handler
    `@change="onGdgKonsChange(d)"` → refresh `d.stok` via `doFormApi.getStok`
    (sku, expired, d.gdgKons, nomorDO, idBatch). Kosongkan gdgKons → tidak refresh.
16. Teks empty-state grid: sebutkan kedua tombol.

## Tidak Berubah
- `validateQty`: konsinyasi tetap skip security stok; cek kurang (sisa SO) tetap
  untuk semua baris.
- Trigger DO (stok out gudang header + gudang konsinyasi), saveData, nomor DO.

## Verifikasi
- `node --check` service/controller/routes.
- `npm run build` Frontend (vue-tsc + vite).
- Uji endpoint `search-stok-kons` dengan SO berisi item konsinyasi yang sudah
  dititip (TB...) → expired/idbatch/gdgKons muncul.
