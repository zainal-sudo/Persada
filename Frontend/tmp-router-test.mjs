// Reproduksi: 2 route path sama (statis didftar dulu, dinamis belakangan),
// apakah match pakai yang pertama atau terakhir?
import { createRouter, createMemoryHistory } from "vue-router";

const staticComp = { render: () => "STATIC" };
const dynamicComp = { render: () => "DYNAMIC" };
const dashComp = { render: () => "DASH" };

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: dashComp },
    {
      path: "/daftar/salesman-aktif",
      name: "salesmanAktifBrowse",
      component: staticComp,
    },
  ],
});

router.addRoute({
  path: "/daftar/salesman-aktif",
  name: "menu-114",
  component: dynamicComp,
});

await router.push("/daftar/salesman-aktif");
console.log("matched name:", router.currentRoute.value.name);
const comp = router.currentRoute.value.matched[0]?.components?.default;
console.log("component:", comp === staticComp ? "STATIC" : comp === dynamicComp ? "DYNAMIC" : "?");
