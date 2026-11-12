const svc = require("../services/menuService");

const getMenuTree = async (req, res) => {
  try {
    const kode = req.user?.kode || "";
    res.json({ success: true, data: await svc.getMenuTree(kode) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getAllMenus = async (req, res) => {
  try {
    res.json({ success: true, data: await svc.getAllMenus() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getHakUser = async (req, res) => {
  try {
    const kode = req.params.kode || req.user?.kode || "";
    res.json({ success: true, data: await svc.getHakUser(kode) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getMenuByUser = async (req, res) => {
  try {
    const kode = req.params.kode || req.user?.kode || "";
    const menus = await svc.getAllMenus();
    const hak = await svc.getHakUser(kode);
    const isAdmin = String(kode).toUpperCase() === "ADMIN";

    const menuHakMap = new Map(hak.map((h) => [h.menu_id, h]));

    const routes = menus
      .filter((m) => {
        if (!m.men_route) return false;
        if (!m.men_view) return false;
        if (isAdmin) return true;
        // Skema thakuser tidak punya kolom view — ada baris = boleh akses.
        return !!menuHakMap.get(m.MEN_ID);
      })
      .map((m) => ({
        path: m.men_route,
        view: m.men_view,
        menuId: m.MEN_ID.toString(),
        title: m.nama,
        icon: m.men_icon,
      }));

    res.json({ success: true, data: routes });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getMenuTree, getAllMenus, getHakUser, getMenuByUser };
