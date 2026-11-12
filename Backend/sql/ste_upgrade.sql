-- =============================================================
-- Peningkatan skema Serah Terima Ekspedisi (opsional)
--
-- Jalankan PER DATABASE CABANG. Idempoten: aman diulang.
-- Kedua bagian di bawah ini OPSIONAL — aplikasi web berjalan tanpa
-- keduanya. Yang hilang kalau dilewati disebut per bagian.
--
-- Status per cabang (dicek 2026-09-28):
--   krm2 (Jogja)  hdr MyISAM + ste_tipe varchar(50), aktif dipakai
--   krm3 (Madiun) hdr MyISAM, tanpa ste_tipe
--   cabang lain         tabelnya belum ada sama sekali
-- =============================================================

-- -------------------------------------------------------------
-- 1) ENGINE InnoDB pada tserahterimaekspedisi_hdr  (disarankan)
--
-- Kenapa: hdr masih MyISAM sedangkan dtl sudah InnoDB. MyISAM tidak
-- ikut transaksi, jadi beginTransaction/rollback di saveData TIDAK
-- menyentuh header sama sekali — persis cacat yang punya Delphi.
-- Kalau insert detail gagal di tengah, dokumen yatim tanpa detail
-- tetap tertinggal permanen.
--
-- saveData sudah melakukan kompensasi (menghapus header eksplisit saat
-- gagal), jadi modul tetap aman-ish tanpa file ini. Tapi InnoDB
-- menghapus seluruh kelas masalah ini, dan satu-satunya cara lain
-- adalah tidak memakai transaksi sama sekali.
--
-- Tabel kecil (1 baris per cabang saat ini) → konversi ini cepat.
-- -------------------------------------------------------------
SELECT table_name, engine FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_name LIKE 'tserahterimaekspedisi%';
-- Jalankan baris berikut hanya jika hdr masih MyISAM:
-- ALTER TABLE `tserahterimaekspedisi_hdr` ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 2) Kolom ste_tipe  (hanya bila Anda ingin tipe DO / MUTASI)
--
-- Delphi 6.0.38 (ufrmSerahTerimaEkspedisi.pas) membaca ste_tipe untuk
-- membedakan sumber dokumen:
--   FP     → slip STE.fr3  (formulir per faktur)
--   DO     → slip STE.fr3
--   MUTASI → slip STE2.fr3 (rincian barang per mutasi)
--
-- Status per cabang (dicek 2026-09-28):
--   krm2 (Jogja)  SUDAH ada, varchar(50), dipakai sejak 2026-09-23
--   krm3 (Madiun) belum ada
--   cabang lain         tabelnya belum ada sama sekali
--
-- Tanpa bagian ini, service mendeteksi kolom tidak ada dan
-- memperlakukan semua dokumen sebagai tipe FP — modul tetap jalan
-- penuh untuk alur FP, hanya slip rincian MUTASI yang tak tersedia.
--
-- Samakan VARCHAR(50) dengan yang sudah ada di krm2, supaya
-- semua cabang konsisten.
-- -------------------------------------------------------------
SELECT column_name, column_type FROM information_schema.columns
 WHERE table_schema = DATABASE()
   AND table_name = 'tserahterimaekspedisi_hdr'
   AND column_name = 'ste_tipe';
-- Jalankan hanya jika hasil di atas kosong:
-- ALTER TABLE `tserahterimaekspedisi_hdr`
--   ADD COLUMN `ste_tipe` VARCHAR(50) NOT NULL DEFAULT 'FP'
--   COMMENT 'FP | DO | MUTASI — MUTASI memakai slip STE2'
--   AFTER `ste_keterangan`;

-- -------------------------------------------------------------
-- 3) Verifikasi akhir
-- -------------------------------------------------------------
SELECT table_name, engine FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_name LIKE 'tserahterimaekspedisi%';

SELECT column_name, column_type, column_default FROM information_schema.columns
 WHERE table_schema = DATABASE()
   AND table_name = 'tserahterimaekspedisi_hdr'
   AND column_name = 'ste_tipe';
