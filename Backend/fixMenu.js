const db = require("./src/config/database");

async function fix() {
  try {
    // 1. Pastikan kolom MEN_NAMA2 terisi dengan label menu
    await db.query(`
      UPDATE tmenu 
      SET MEN_NAMA2 = 'Master Divisi', men_icon = 'pi pi-sitemap' 
      WHERE men_route = '/daftar/divisi'
    `);

    // 2. Pastikan baris form punya men_parent_id = NULL
    await db.query(`
      UPDATE tmenu 
      SET men_parent_id = NULL, MEN_NAMA2 = 'Master Divisi Form' 
      WHERE men_route = '/daftar/divisi/form'
    `);

    // 3. Pastikan user ADMIN atau semua user punya hak akses thakuser
    const [menus] = await db.query(`SELECT MEN_ID FROM tmenu WHERE men_route IN ('/daftar/divisi', '/daftar/divisi/form')`);
    for (const m of menus) {
      await db.query(`
        INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
        SELECT DISTINCT 'ADMIN', ?, 'Y', 'Y', 'Y'
        FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM thakuser WHERE HAK_USER_KODE = 'ADMIN' AND HAK_MEN_ID = ?)
      `, [m.MEN_ID, m.MEN_ID]);
    }

    console.log("✅ Fix menu and permissions complete.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fix();
