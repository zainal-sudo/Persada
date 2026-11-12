import { ref } from "vue";
import { useToast } from "vue-toastification";
import { exportPivotToExcel } from "@/utils/styledExport";

/**
 * Export hasil pivot (TinyPivotOnly) ke Excel, mengikuti tampilan pivot yang aktif.
 * Dipakai bersama oleh view-view laporan yang punya tab Pivot.
 *
 * Contoh:
 *   const { pivotRef, isPivotExporting, doExportPivot } = usePivotExport({
 *     title: "List Jual Per Item",
 *     subtitle: () => `Periode ${startDate.value} s/d ${endDate.value}`,
 *     fileName: "ListJualPerItem_Pivot",
 *   });
 */
export function usePivotExport(options: {
  /** Judul laporan di baris paling atas sheet */
  title: string;
  /** Subtitle (mis. periode); dipanggil saat export agar selalu nilainya terbaru */
  subtitle?: () => string;
  /** Nama file tanpa tanggal & ekstensi (exporter menambahkan `_${tanggal}.xlsx`) */
  fileName: string;
}) {
  const toast = useToast();
  const pivotRef = ref<any>(null);
  const isPivotExporting = ref(false);

  const doExportPivot = async () => {
    const pivot = pivotRef.value;
    if (!pivot) return;
    const result = pivot.pivotResult;
    if (!result || !result.rowHeaders.length) {
      toast.info("Tidak ada data pivot untuk diexport.");
      return;
    }
    isPivotExporting.value = true;
    try {
      await exportPivotToExcel({
        title: options.title,
        subtitle: options.subtitle?.(),
        rowFields: pivot.rowFields ?? [],
        valueFields: (pivot.valueFields ?? []).map((vf: any) => ({
          field: vf.field,
          label: vf.label,
          aggregation: vf.aggregation,
        })),
        columnHeaders: result.headers,
        rowHeaders: result.rowHeaders,
        data: result.data,
        rowTotals: result.rowTotals,
        columnTotals: result.columnTotals,
        grandTotal: result.grandTotal,
        fileName: options.fileName,
      });
      toast.success("Berhasil export pivot ke Excel.");
    } catch {
      toast.error("Gagal melakukan export Excel.");
    } finally {
      isPivotExporting.value = false;
    }
  };

  return { pivotRef, isPivotExporting, doExportPivot };
}
