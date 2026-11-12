// useColumnFilter — pencocokan filter kolom untuk tabel.
// Diekstrak dari BaseBrowse supaya browse dan form (Serah Terima Faktur)
// memakai implementasi yang sama persis.
import type {
  ColumnFilterValue,
  DateFilter,
  NumberFilter,
  SelectFilter,
  TextFilter,
} from "@/components/ColumnFilter.vue";

const matchTextFilter = (val: string, f: TextFilter): boolean => {
  const s = String(val ?? "").toLowerCase();
  const fv = f.value.toLowerCase();
  switch (f.operator) {
    case "contains":
    case "search": return s.includes(fv);
    case "equals": return s === fv;
    case "not_contains": return !s.includes(fv);
    case "starts_with": return s.startsWith(fv);
    case "ends_with": return s.endsWith(fv);
    case "empty": return s === "";
    case "not_empty": return s !== "";
    default: return true;
  }
};

const matchNumberFilter = (val: any, f: NumberFilter): boolean => {
  const n = Number(val);
  if (isNaN(n) && f.operator !== "between") return false;
  switch (f.operator) {
    case "=": return n === f.value;
    case "!=": return n !== f.value;
    case "<": return n < (f.value ?? 0);
    case ">": return n > (f.value ?? 0);
    case "<=": return n <= (f.value ?? 0);
    case ">=": return n >= (f.value ?? 0);
    case "between": {
      const from = f.value ?? -Infinity;
      const to = f.valueTo ?? Infinity;
      return n >= from && n <= to;
    }
    default: return true;
  }
};

const matchDateFilter = (val: any, f: DateFilter): boolean => {
  const s = String(val ?? "").substring(0, 10); // ambil bagian yyyy-mm-dd
  if (f.operator === "between") {
    const from = f.value || "0000-00-00";
    const to = f.valueTo || "9999-99-99";
    return s >= from && s <= to;
  }
  if (f.operator === "equals") return s === f.value;
  if (f.operator === "before") return s < f.value;
  if (f.operator === "after") return s > f.value;
  return true;
};

const matchSelectFilter = (val: any, f: SelectFilter): boolean =>
  f.allowed.has(String(val ?? ""));

/** True bila `val` lolos filter `filter`. Tanpa filter = selalu lolos. */
export function matchColumnFilter(
  val: any,
  filter: ColumnFilterValue | null | undefined,
): boolean {
  if (!filter) return true;
  if ("allowed" in filter) return matchSelectFilter(val, filter as SelectFilter);
  if ("operator" in filter && "value" in filter) {
    const f = filter as TextFilter | NumberFilter | DateFilter;
    const op = String(f.operator);
    const v = (f as any).value;
    if (
      typeof v === "string" &&
      "valueTo" in f &&
      ["between", "equals", "before", "after"].includes(op)
    ) {
      return matchDateFilter(val, f as DateFilter);
    }
    if (
      ["=", "!=", "<", ">", "<=", ">="].includes(op) ||
      (op === "between" &&
        (typeof v === "number" || v === null || v === undefined))
    ) {
      return matchNumberFilter(val, f as NumberFilter);
    }
    return matchTextFilter(val, f as TextFilter);
  }
  return true;
}

/** Terapkan sekumpulan filter ke satu baris. */
export function rowPassesFilters(
  row: Record<string, any>,
  filters: Record<string, ColumnFilterValue>,
  accessor?: (row: any, key: string) => any,
): boolean {
  for (const key of Object.keys(filters)) {
    const f = filters[key];
    if (!f) continue;
    const val = accessor ? accessor(row, key) : row[key];
    if (!matchColumnFilter(val, f)) return false;
  }
  return true;
}
