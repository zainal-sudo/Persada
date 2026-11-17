// Setup menu Titip Barang Konsinyasi (grup Persediaan) + hak akses user
const db = require("./src/config/database");

async function setup() {
  try {
    const [parents] = await db.query(
      `SELECT mp_id FROM tmenuparent WHERE mp_nama = 'Persediaan' LIMIT 1`
    );
    const mp_id = parents[0]?.mp_id;
    if (!mp_id) throw new Error("tmenuparent 'Persediaan' tidak ditemukan.");

    const [maxOrd] = await db.query(
      `SELECT IFNULL(MAX(men_order), 0) + 1 AS ord FROM tmenu WHERE men_parent_id = ?`,
      [mp_id]
    );
    const order = Number(maxOrd[0].ord) || 13;

    // MEN_ID tidak auto-increment — ambil MAX+1 manual
    const [maxId] = await db.query(`SELECT IFNULL(MAX(MEN_ID), 0) + 1 AS id FROM tmenu`);
    let nextIdVal = Number(maxId[0].id);
    const nextId = () => nextIdVal++;

    // Browse
    const [existingBrowse] = await db.query(
      `SELECT MEN_ID FROM tmenu WHERE men_route = '/persediaan/titip' LIMIT 1`
    );
    let idBrowse = existingBrowse[0]?.MEN_ID;
    if (!idBrowse) {
      idBrowse = nextId();
      const [m1] = await db.query(
        `INSERT INTO tmenu (MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon, men_parent_id, men_order, men_view, men_modul)
         VALUES (?, 'frmTitipKonsinyasi', 'Titip Barang Konsinyasi', 'Titip Barang Konsinyasi', '/persediaan/titip', 'pi pi-box', ?, ?, 'persediaan/TitipBrowseView', 1)`,
        [idBrowse, mp_id, order]
      );
      console.log(`✓ Menu browse dibuat (MEN_ID=${idBrowse}, order=${order})`);
    } else {
      console.log(`• Menu browse sudah ada (MEN_ID=${idBrowse})`);
    }

    // Form
    const [existingForm] = await db.query(
      `SELECT MEN_ID FROM tmenu WHERE men_route = '/persediaan/titip/form' LIMIT 1`
    );
    let idForm = existingForm[0]?.MEN_ID;
    if (!idForm) {
      idForm = nextId();
      const [m2] = await db.query(
        `INSERT INTO tmenu (MEN_ID, MEN_NAMA, MEN_KETERANGAN, MEN_NAMA2, men_route, men_icon, men_parent_id, men_order, men_view, men_modul)
         VALUES (?, 'frmTitipKonsinyasiForm', 'Titip Barang Konsinyasi (form)', 'Titip Barang Konsinyasi Form', '/persediaan/titip/form', 'pi pi-box', NULL, ?, 'persediaan/TitipFormView', 1)`,
        [idForm, order]
      );
      console.log(`✓ Menu form dibuat (MEN_ID=${idForm})`);
    } else {
      console.log(`• Menu form sudah ada (MEN_ID=${idForm})`);
    }

    // Grant hak akses ke semua user yang sudah punya baris hakuser
    for (const menId of [idBrowse, idForm]) {
      if (!menId) continue;
      const [res] = await db.query(
        `INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
         SELECT DISTINCT h.HAK_USER_KODE, ?, 'Y', 'Y', 'Y'
         FROM thakuser h
         WHERE NOT EXISTS (
           SELECT 1 FROM thakuser x
           WHERE x.HAK_USER_KODE = h.HAK_USER_KODE AND x.HAK_MEN_ID = ?
         )`,
        [menId, menId]
      );
      console.log(`✓ Hak akses user untuk MEN_ID=${menId} (${res.affectedRows} baris)`);
    }

    // Pastikan admin punya akses
    for (const menId of [idBrowse, idForm]) {
      if (!menId) continue;
      await db.query(
        `INSERT INTO thakuser (HAK_USER_KODE, HAK_MEN_ID, hak_men_insert, hak_men_edit, hak_men_delete)
         SELECT DISTINCT 'admin', ?, 'Y', 'Y', 'Y' FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM thakuser WHERE HAK_USER_KODE = 'admin' AND HAK_MEN_ID = ?)`,
        [menId, menId]
      );
    }

    console.log("✔ Setup menu Titip Barang selesai.");
  } catch (e) {
    console.error("✘ Gagal:", e);
  } finally {
    process.exit(0);
  }
}
setup();
