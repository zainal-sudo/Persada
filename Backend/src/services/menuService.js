const db = require("../config/database");

/**
 * Daftar menu yang tidak ditampilkan di sidebar (label lowercase).
 * Baris tmenu tetap ada agar hak akses/route tidak rusak, hanya disembunyikan.
 */
const HIDDEN_MENU_LABELS = new Set([
  "laporan pencapaian marketing",
  "faktur pajak v3",
  "setting biaya promosi",
  "pembayaran biaya promosi",
]);

/**
 * Menu yang disembunyikan berdasarkan route (lebih stabil daripada label).
 */
const HIDDEN_MENU_ROUTES = new Set([
  "/laporan/list-inkaso",
  "/laporan/list-jual-per-faktur-margin",
  "/laporan/lap-ytd",
  "/laporan/transaksi-harian",
  "/laporan/transaksi-harian2",
]);

const isHiddenMenu = (m) => {
  const label = String(m.MEN_NAMA2 || m.MEN_KETERANGAN || m.MEN_NAMA || "")
    .trim()
    .toLowerCase();
  if (HIDDEN_MENU_LABELS.has(label)) return true;
  const route = String(m.men_route || "").trim().toLowerCase();
  return HIDDEN_MENU_ROUTES.has(route);
};

/**
 * Daftar semua menu modul finance (men_modul = 1).
 * Dipakai frontend untuk resolver MEN_ID dari men_route.
 */
const getAllMenus = async () => {
  const [rows] = await db.query(
    `SELECT MEN_ID,
            MEN_NAMA,
            MEN_KETERANGAN,
            MEN_NAMA2,
            men_route,
            men_icon,
            men_parent_id,
            men_order,
            men_view
       FROM tmenu
      WHERE men_modul = 1
      ORDER BY men_order, MEN_ID`,
  );
  return rows.map((r) => ({
    MEN_ID: r.MEN_ID,
    menu_name: r.MEN_NAMA,
    nama: r.MEN_NAMA2 || r.MEN_KETERANGAN || r.MEN_NAMA,
    men_route: r.men_route || "",
    men_icon: r.men_icon || "",
    men_parent_id: r.men_parent_id || 0,
    men_order: r.men_order || 0,
    men_view: r.men_view || "",
  }));
};

/**
 * Hak akses user terhadap menu (thakuser).
 * Skema asli tidak punya kolom view — akses view ditentukan oleh
 * keberadaan baris hak akses di tabel tersebut.
 */
const getHakUser = async (kode) => {
  const [rows] = await db.query(
    `SELECT HAK_MEN_ID AS menu_id,
            IFNULL(hak_men_insert, 'N') AS insert_,
            IFNULL(hak_men_edit,   'N') AS edit_,
            IFNULL(hak_men_delete, 'N') AS delete_
       FROM thakuser
      WHERE HAK_USER_KODE = ?
      ORDER BY HAK_MEN_ID`,
    [kode],
  );
  return rows.map((r) => ({
    menu_id: Number(r.menu_id),
    insert_: r.insert_,
    edit_: r.edit_,
    delete_: r.delete_,
  }));
};

/**
 * Tree menu untuk sidebar, difilter hak akses user.
 * - ADMIN: semua item yang punya route.
 * - Non-admin: hanya item yang punya baris hak di thakuser.
 * Item tanpa men_route di-skip (tidak bisa dinavigasi).
 */
const getMenuTree = async (kode) => {
  const isAdmin = String(kode).toUpperCase() === "ADMIN";

  const [parentRows] = await db.query(
    `SELECT mp_id, mp_nama, mp_icon, mp_order, mp_menubar
       FROM tmenuparent
      WHERE mp_aktif = 1
      ORDER BY mp_order`,
  );

  const [itemRows] = await db.query(
    `SELECT m.MEN_ID,
            m.MEN_NAMA,
            m.MEN_KETERANGAN,
            m.MEN_NAMA2,
            m.men_route,
            m.men_icon,
            m.men_parent_id,
            m.men_parent_id2,
            m.men_order,
            h.HAK_USER_KODE AS has_hak
       FROM tmenu m
       LEFT JOIN thakuser h
         ON m.MEN_ID = h.HAK_MEN_ID
        AND UPPER(h.HAK_USER_KODE) = UPPER(?)
      WHERE m.men_modul = 1
      ORDER BY m.men_order, m.MEN_ID`,
    [kode],
  );

  const parents = parentRows.map((p) => ({
    label: p.mp_nama,
    icon: p.mp_icon || "",
    menubar: Number(p.mp_menubar) === 1,
    items: [],
  }));
  const indexByPid = new Map(parentRows.map((p, i) => [Number(p.mp_id), i]));

  const addItemToParent = (pid, m) => {
    if (pid === null || pid === undefined) return;
    const idx = indexByPid.get(Number(pid));
    if (idx === undefined) return;
    // Hindari duplikat bila men_parent_id === men_parent_id2
    if (parents[idx].items.some((it) => it.menu_id === Number(m.MEN_ID))) return;
    parents[idx].items.push({
      label: m.MEN_NAMA2 || m.MEN_KETERANGAN || m.MEN_NAMA,
      to: m.men_route,
      icon: m.men_icon || "",
      menu_id: Number(m.MEN_ID),
    });
  };

  for (const m of itemRows) {
    if (!m.men_route) continue;
    if (isHiddenMenu(m)) continue;
    if (!isAdmin && !m.has_hak) continue;

    // Grup utama
    addItemToParent(m.men_parent_id, m);
    // Grup tambahan (opsional) — biar 1 menu bisa tampil di sidebar & menubar
    addItemToParent(m.men_parent_id2, m);
  }

  return parents.filter((p) => p.items.length > 0);
};

module.exports = { getAllMenus, getHakUser, getMenuTree };
