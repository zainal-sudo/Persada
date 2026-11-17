const db = require("./src/config/database");

async function check() {
  try {
    const [menu] = await db.query("SELECT * FROM tmenu WHERE men_route LIKE '%divisi%'");
    console.log("MENU DIVISI:", menu);

    const [parent] = await db.query("SELECT * FROM tmenuparent WHERE mp_nama = 'Daftar'");
    console.log("PARENT DAFTAR:", parent);

    if (menu.length > 0 && parent.length > 0) {
      await db.query("UPDATE tmenu SET men_parent_id = ? WHERE men_route LIKE '%divisi%'", [parent[0].mp_id]);
      console.log("✅ Updated men_parent_id to parent Daftar ID:", parent[0].mp_id);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
