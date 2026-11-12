import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { usePermissionStore } from "@/stores/permissionStore";
import type { AxiosError } from "axios";

interface UseFormOptions<T> {
  menuId?: string;
  initialData: T;
  fetchApi?: () => Promise<T>;
  submitApi: (data: T) => Promise<unknown>;
  onSuccessRoute?: string;
  onSuccess?: (response: unknown) => void;
  immediate?: boolean;
}

export function useForm<
  T,
  P extends Record<string, any> = Record<string, string>,
>(options: UseFormOptions<T>) {
  const route = useRoute();
  const params = route.params as P;
  const router = useRouter();
  const toast = useToast();
  const permissionStore = usePermissionStore();

  const isEditMode = computed(
    () =>
      !!(
        route.params.kode ||
        route.params.nomor ||
        route.query.nomor ||
        route.query.kode
      ),
  );

  const isLoading = ref(false);
  const isSaving = ref(false);
  const showSaveDialog = ref(false);

  const formData = ref<T>({ ...options.initialData }) as ReturnType<
    typeof ref<T>
  >;
  const originalData = ref<T>(JSON.parse(JSON.stringify(options.initialData)));

  const resolvedMenuId = computed(() => {
    if (options.menuId) return options.menuId;
    return permissionStore.getMenuIdByRoute(route.path) || "";
  });

  const canSave = computed(() => {
    const perm = isEditMode.value ? "edit" : "insert";
    return permissionStore.can(resolvedMenuId.value, perm);
  });

  const goBack = () => {
    if (options.onSuccessRoute) return router.push(options.onSuccessRoute);
    if (route.meta.browseRoute)
      return router.push({ name: route.meta.browseRoute as string });
    window.history.length > 1 ? router.back() : router.push("/");
  };

  const fetchData = async () => {
    if (!options.fetchApi) return;
    isLoading.value = true;
    try {
      const data = await options.fetchApi();
      (formData as any).value = data;
      originalData.value = JSON.parse(JSON.stringify(data));
    } catch (e) {
      toast.error("Gagal memuat data form.");
      goBack();
    } finally {
      isLoading.value = false;
    }
  };

  const executeSave = async () => {
    isSaving.value = true;
    try {
      const response = await options.submitApi(formData.value as T);
      showSaveDialog.value = false;
      toast.success("Data berhasil disimpan.");
      if (options.onSuccess) options.onSuccess(response);
      goBack();
    } catch (e: unknown) {
      const err = e as AxiosError<any>;
      toast.error(err.response?.data?.message || "Gagal menyimpan data.");
    } finally {
      isSaving.value = false;
    }
  };

  onMounted(() => {
    if (options.immediate !== false && isEditMode.value && options.fetchApi) {
      fetchData();
    }
  });

  return {
    isEditMode,
    isLoading,
    isSaving,
    showSaveDialog,
    formData,
    originalData,
    canSave,
    params,
    goBack,
    fetchData,
    executeSave,

  };
}
