const db = require("./src/config/database");

async function run() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tdivisi (
        div_kode CHAR(3) NOT NULL,
        div_nama VARCHAR(100) NOT NULL,
        div_prefix CHAR(3) DEFAULT '',
        PRIMARY KEY (div_kode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Table tdivisi created successfully.");

    // Insert menu into tmenu if not exists
    const [parents] = await db.query(`SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Daftar' LIMIT 1`);
    let mp_id = parents[0]?.mp_id;
    if (!mp_id) {
      const [res] = await db.query(`INSERT INTO tmenuparent (mp_nama, mp_icon, mp_order, mp_menubar, mp_aktif) VALUES ('Daftar', 'pi pi-list', 10, 0, 1)`);
      mp_id = res.insertId;
    }

    const [existing] = await db.query(`SELECT MEN_ID FROM tmenu WHERE men_route = '/daftar/divisi' LIMIT 1`);
    if (existing.length === 0) {
      const [maxOrd] = await db.query(`SELECT IFNULL(MAX(men_order), 0) + 10 AS ord FROM tmenu WHERE men_parent_id = ?`, [mp_id]);
      const order = maxOrd[0].ord;

      const [m1] = await db.query(`
        INSERT INTO tmenu (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon, men_parent_id, men_order, men_view, men_modul)
        VALUES ('ufrmMasterDivisi', 'Master Divisi', 'dxMasterDivisi', '/daftar/divisi', 'pi pi-sitemap', ?, ?, 'daftar/DivisiView', 1)
      `, [mp_id, order]);

      const [m2] = await db.query(`
        INSERT INTO tmenu (MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon, men_parent_id, men_order, men_view, men_modul)
        VALUES ('ufrmMasterDivisiForm', 'Master Divisi (form)', 'dxMasterDivisi', '/daftar/divisi/form', 'pi pi-sitemap', NULL, ?, 'daftar/DivisiView', 1)
      `, [order]);

      const id1 = m1.insertId;
      const id2 = m2.insertId;

      // Grant to users in thakuser
      if (id1) {
        await db.query(`
          INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
          SELECT DISTINCT h.HAK_USER_KODE, ?, 'Y', 'Y', 'Y'
          FROM thakuser h
          WHERE NOT EXISTS (SELECT 1 FROM thakuser x WHERE x.HAK_USER_KODE = h.HAK_USER_KODE AND x.HAK_MEN_ID = ?)
        `, [id1, id1]);
      }

      if (id2) {
        await db.query(`
          INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
          SELECT DISTINCT h.HAK_USER_KODE, ?, 'Y', 'Y', 'Y'
          FROM thakuser h
          WHERE NOT EXISTS (SELECT 1 FROM thakuser x WHERE x.HAK_USER_KODE = h.HAK_USER_KODE AND x.HAK_MEN_ID = ?)
        `, [id2, id2]);
      }

      console.log("✅ Menu and permissions inserted successfully.");
    } else {
      console.log("ℹ️ Menu /daftar/divisi already exists.");
    }

  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
