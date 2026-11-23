/**
 * Migrasi Formasi dari database lama (cetar) ke ampersada.
 *
 * - Buat tabel tformasi & tformasitarget
 * - Tambah kolom tsalesman.sls_formasi_id dan tsalesmanaktif.sla_formasi_id
 * - Copy pg_formasi -> tformasi (id dipertahankan)
 * - Copy pg_target_sales -> tformasitarget (id dipertahankan)
 * - Backfill formasi area (by nama area) & salesman (by nama pof)
 * - Daftarkan menu Formasi
 *
 * Jalankan dari folder Backend:
 *   node sql/migrasi_formasi_cetar.js
 *
 * Idempoten: aman dijalankan ulang.
 */
const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const DB = process.env.DB_NAME;

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectTimeout: 20000,
    charset: "utf8mb4",
  });
  const q = async (sql, p) => {
    const [r] = await c.query(sql, p);
    return r;
  };

  const addColumnIfMissing = async (table, column, definition) => {
    const rows = await q(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [DB, table, column],
    );
    if (rows.length === 0) {
      await q(`ALTER TABLE \`${DB}\`.\`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`+ kolom ${table}.${column}`);
    }
  };

  try {
    // ── 1) Tabel formasi ────────────────────────────────────────────────
    await q(
      `CREATE TABLE IF NOT EXISTS \`${DB}\`.\`tformasi\` (
         tf_id          BIGINT NOT NULL AUTO_INCREMENT,
         tf_nama        VARCHAR(255) NOT NULL,
         tf_divisi      VARCHAR(50) NOT NULL DEFAULT '',
         tf_type        VARCHAR(20) NOT NULL DEFAULT '',
         tf_sla_kode    CHAR(10) NULL,
         tf_atasan_kode CHAR(10) NULL,
         date_create    DATETIME NULL,
         user_create    VARCHAR(20) NULL,
         date_modified  DATETIME NULL,
         user_modified  VARCHAR(20) NULL,
         PRIMARY KEY (tf_id),
         KEY idx_tf_sla_kode (tf_sla_kode),
         KEY idx_tf_atasan_kode (tf_atasan_kode)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    console.log("tformasi: OK");

    // ── 2) Tabel target formasi ────────────────────────────────────────
    await q(
      `CREATE TABLE IF NOT EXISTS \`${DB}\`.\`tformasitarget\` (
         tft_id                       BIGINT NOT NULL AUTO_INCREMENT,
         tft_tf_id                    BIGINT NOT NULL,
         tft_bulan                    DATE NOT NULL,
         tft_target                   DECIMAL(20,4) NOT NULL DEFAULT 0,
         tft_target_jenis             LONGTEXT NULL,
         tft_additional_target_produk LONGTEXT NULL,
         tft_last_edited_at           DATETIME NULL,
         date_create                  DATETIME NULL,
         user_create                  VARCHAR(20) NULL,
         date_modified                DATETIME NULL,
         user_modified                VARCHAR(20) NULL,
         PRIMARY KEY (tft_id),
         UNIQUE KEY uq_tft_formasi_bulan (tft_tf_id, tft_bulan),
         KEY idx_tft_bulan (tft_bulan)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    console.log("tformasitarget: OK");

    // ── 3) Kolom formasi di area & salesman ────────────────────────────
    await addColumnIfMissing("tsalesman", "sls_formasi_id", "BIGINT NULL DEFAULT NULL");
    await addColumnIfMissing("tsalesmanaktif", "sla_formasi_id", "BIGINT NULL DEFAULT NULL");
    console.log("kolom formasi area/salesman: OK");

    // ── 4) Copy formasi ────────────────────────────────────────────────
    const fRes = await q(
      `INSERT INTO \`${DB}\`.\`tformasi\`
         (tf_id, tf_nama, tf_divisi, tf_type, tf_sla_kode, tf_atasan_kode,
          date_create, user_create)
       SELECT f.id, f.nama_formasi, f.divisi, f.type,
              (SELECT a.sla_kode
                 FROM cetar.pg_pof p
                 JOIN \`${DB}\`.tsalesmanaktif a
                   ON UPPER(TRIM(a.sla_nama)) = UPPER(TRIM(p.nama_pof))
                WHERE p.id = f.id_pof LIMIT 1),
              (SELECT a.sla_kode
                 FROM cetar.pg_pof p
                 JOIN \`${DB}\`.tsalesmanaktif a
                   ON UPPER(TRIM(a.sla_nama)) = UPPER(TRIM(p.nama_pof))
                WHERE p.id = f.id_atasan LIMIT 1),
              NOW(), 'MIG'
         FROM cetar.pg_formasi f
       ON DUPLICATE KEY UPDATE
         tf_nama = VALUES(tf_nama),
         tf_divisi = VALUES(tf_divisi),
         tf_type = VALUES(tf_type),
         tf_sla_kode = VALUES(tf_sla_kode),
         tf_atasan_kode = VALUES(tf_atasan_kode),
         date_modified = NOW(),
         user_modified = 'MIG'`,
    );
    console.log("tformasi migrasi:", fRes.affectedRows, "baris");

    // ── 5) Copy target formasi ────────────────────────────────────────
    const tRes = await q(
      `INSERT INTO \`${DB}\`.\`tformasitarget\`
         (tft_id, tft_tf_id, tft_bulan, tft_target, tft_target_jenis,
          tft_additional_target_produk, tft_last_edited_at, date_create, user_create)
       SELECT t.id, t.id_formasi, DATE(t.bulan), t.target, t.target_jenis,
              t.additional_target_produk, t.last_edited_at, NOW(), 'MIG'
         FROM cetar.pg_target_sales t
       ON DUPLICATE KEY UPDATE
         tft_tf_id = VALUES(tft_tf_id),
         tft_bulan = VALUES(tft_bulan),
         tft_target = VALUES(tft_target),
         tft_target_jenis = VALUES(tft_target_jenis),
         tft_additional_target_produk = VALUES(tft_additional_target_produk),
         tft_last_edited_at = VALUES(tft_last_edited_at),
         date_modified = NOW(),
         user_modified = 'MIG'`,
    );
    console.log("tformasitarget migrasi:", tRes.affectedRows, "baris");

    // ── 6) Backfill formasi area (by nama area) ───────────────────────
    const aRes = await q(
      `UPDATE \`${DB}\`.tsalesman s
         JOIN cetar.pg_area a
           ON UPPER(TRIM(s.sls_nama)) = UPPER(TRIM(a.nama_area))
          SET s.sls_formasi_id = a.id_formasi
        WHERE s.sls_formasi_id IS NULL`,
    );
    console.log("area terisi formasi:", aRes.affectedRows, "baris");

    // ── 7) Backfill formasi salesman (by nama pof) ────────────────────
    const sRes = await q(
      `UPDATE \`${DB}\`.tsalesmanaktif s
         JOIN (
           SELECT p.nama_pof, MIN(f.id) AS id_formasi
             FROM cetar.pg_formasi f
             JOIN cetar.pg_pof p ON p.id = f.id_pof
            GROUP BY p.nama_pof
         ) x ON UPPER(TRIM(s.sla_nama)) = UPPER(TRIM(x.nama_pof))
          SET s.sla_formasi_id = x.id_formasi
        WHERE s.sla_formasi_id IS NULL`,
    );
    console.log("salesman terisi formasi:", sRes.affectedRows, "baris");

    // ── 8) Menu Formasi ───────────────────────────────────────────────
    const menuRows = await q(
      `SELECT MEN_ID FROM \`${DB}\`.tmenu WHERE men_route = '/daftar/formasi' LIMIT 1`,
    );
    let formasiMenuId;
    if (menuRows.length === 0) {
      const mxRows = await q(`SELECT IFNULL(MAX(MEN_ID), 0) + 1 AS id FROM \`${DB}\`.tmenu`);
      formasiMenuId = mxRows[0].id;
      await q(
        `INSERT INTO \`${DB}\`.tmenu
           (MEN_ID, MEN_NAMA, MEN_KETERANGAN, men_modul, men_menu_name,
            men_menu_name2, MEN_NAMA2, men_icon, men_route, men_parent_id,
            men_order, men_view)
         VALUES (?, 'frmFormasi', 'Master Formasi', 1, 'dxFormasi',
                 'Formasi1', 'Formasi', 'pi pi-sitemap', '/daftar/formasi',
                 5, 9, 'daftar/FormasiView')`,
        [formasiMenuId],
      );
      console.log("menu Formasi ditambahkan MEN_ID:", formasiMenuId);
    } else {
      formasiMenuId = menuRows[0].MEN_ID;
      console.log("menu Formasi sudah ada MEN_ID:", formasiMenuId);
    }

    // ── 9) Hak akses menu Formasi ─────────────────────────────────────
    // Beri akses ke user yang sudah punya akses Master Area/Rayon (3)
    // atau Master Salesman (114), agar menu langsung tampil di sidebar.
    const hakRes = await q(
      `INSERT INTO \`${DB}\`.thakuser
         (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
       SELECT h.HAK_USER_KODE, ?,
              MAX(IFNULL(h.hak_men_insert, 'N')),
              MAX(IFNULL(h.hak_men_edit, 'N')),
              MAX(IFNULL(h.hak_men_delete, 'N'))
         FROM \`${DB}\`.thakuser h
        WHERE h.HAK_MEN_ID IN (3, 114)
          AND NOT EXISTS (
            SELECT 1 FROM \`${DB}\`.thakuser x
             WHERE x.HAK_USER_KODE = h.HAK_USER_KODE
               AND x.HAK_MEN_ID = ?
          )
        GROUP BY h.HAK_USER_KODE`,
      [formasiMenuId, formasiMenuId],
    );
    console.log("hak akses Formasi ditambahkan:", hakRes.affectedRows, "user");

    console.log("✅ Migrasi formasi selesai.");
  } catch (e) {
    console.error("❌ Migrasi gagal:", e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
