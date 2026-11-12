import { ref } from "vue";
import { useTabsStore } from "@/stores/tabsStore";

interface UseAfterSaveOptions {
  /** Fungsi untuk reset form ke kondisi awal (isi baru) */
  onReset: () => void;
}

export function useAfterSave(options: UseAfterSaveOptions) {
  const tabsStore = useTabsStore();
  const savedNomor = ref("");

  /** Handle post-save action: "new" = stay & reset, "close" = close tab */
  const handlePostSave = (action: "new" | "close", nomor: string) => {
    savedNomor.value = nomor;
    if (action === "new") {
      options.onReset();
    } else {
      tabsStore.closeTab(tabsStore.activeTabId);
    }
  };

  return {
    savedNomor,
    handlePostSave,
  };
}
