/**
 * Shim: @tabler/icons-vue → Material Symbols Outlined
 *
 * Semua view mengimpor ikon dari "@tabler/icons-vue". Vite + tsconfig
 * meng-alias paket itu ke file ini, sehingga nama ikon Tabler yang sama
 * sekarang merender Material Symbols (persis stitch_bsm_erp_desktop_sidebar)
 * tanpa menyentuh 100+ file view.
 *
 * Props Tabler yang diabaikan: strokeWidth (Material tidak pakai stroke).
 */
import { defineComponent, h, type PropType } from "vue";
import MsIcon from "./MsIcon.vue";

const MAP: Record<string, string> = {
  IconAdjustments: "tune",
  IconAdjustmentsHorizontal: "tune",
  IconAlertTriangle: "warning",
  IconArchive: "archive",
  IconArrowBackUp: "undo",
  IconArrowsExchange: "swap_horiz",
  IconBook: "menu_book",
  IconBook2: "menu_book",
  IconBox: "inventory_2",
  IconBuildingBank: "account_balance",
  IconBuildingFactory2: "factory",
  IconBuildingWarehouse: "warehouse",
  IconCalculator: "calculate",
  IconCalendarPlus: "event",
  IconCar: "directions_car",
  IconCash: "payments",
  IconCashBanknote: "payments",
  IconCashOff: "money_off",
  IconCategory: "category",
  IconChartBar: "bar_chart",
  IconCheck: "check",
  IconChevronDown: "expand_more",
  IconChevronLeft: "chevron_left",
  IconChevronRight: "chevron_right",
  IconChevronsLeft: "keyboard_double_arrow_left",
  IconChevronsRight: "keyboard_double_arrow_right",
  IconChevronUp: "expand_less",
  IconClipboardText: "content_paste",
  IconCopy: "content_copy",
  IconDatabaseOff: "database_off",
  IconDeviceFloppy: "save",
  IconDots: "more_horiz",
  IconDownload: "download",
  IconEye: "visibility",
  IconEyeOff: "visibility_off",
  IconFileCheck: "fact_check",
  IconFileExcel: "table_chart",
  IconFileExport: "upload_file",
  IconFileInvoice: "receipt_long",
  IconFileSpreadsheet: "table_view",
  IconFileText: "description",
  IconFileUpload: "upload_file",
  IconFilter: "filter_alt",
  IconFilterOff: "filter_alt_off",
  IconGridDots: "apps",
  IconHistory: "history",
  IconInfoCircle: "info",
  IconList: "format_list_bulleted",
  IconLock: "lock",
  IconLockOpen: "lock_open",
  IconLogin: "login",
  IconMapPin: "location_on",
  IconMessageCircle: "chat",
  IconPackage: "inventory_2",
  IconPencil: "edit",
  IconPercentage: "percent",
  IconPlayerPlay: "play_arrow",
  IconPlayerStop: "stop",
  IconPlus: "add",
  IconPower: "power_settings_new",
  IconPrinter: "print",
  IconReceipt: "receipt",
  IconReceiptRefund: "assignment_return",
  IconRefresh: "refresh",
  IconReportMoney: "monitoring",
  IconSearch: "search",
  IconSearchOff: "search_off",
  IconSend: "send",
  IconShoppingBag: "shopping_bag",
  IconShoppingCart: "shopping_cart",
  IconStack2: "layers",
  IconTable: "table",
  IconTableFilled: "table",
  IconThumbDown: "thumb_down",
  IconThumbUp: "thumb_up",
  IconTrash: "delete",
  IconTrashX: "delete_forever",
  IconTruck: "local_shipping",
  IconTruckDelivery: "local_shipping",
  IconUser: "person",
  IconUsers: "group",
  IconX: "close",
};

function make(name: string) {
  return defineComponent({
    name,
    props: {
      size: {
        type: [Number, String] as PropType<number | string>,
        default: 16,
      },
      strokeWidth: {
        type: [Number, String] as PropType<number | string>,
        default: undefined,
      },
      color: { type: String, default: undefined },
      fill: {
        type: [Boolean, Number] as PropType<boolean | number>,
        default: 0,
      },
    },
    setup(props) {
      return () =>
        h(MsIcon, {
          name: MAP[name] || "help",
          size: props.size,
          fill: props.fill,
          style: props.color ? { color: props.color } : undefined,
        });
    },
  });
}

export const IconAdjustments = make("IconAdjustments");
export const IconAdjustmentsHorizontal = make("IconAdjustmentsHorizontal");
export const IconAlertTriangle = make("IconAlertTriangle");
export const IconArchive = make("IconArchive");
export const IconArrowBackUp = make("IconArrowBackUp");
export const IconArrowsExchange = make("IconArrowsExchange");
export const IconBook = make("IconBook");
export const IconBook2 = make("IconBook2");
export const IconBox = make("IconBox");
export const IconBuildingBank = make("IconBuildingBank");
export const IconBuildingFactory2 = make("IconBuildingFactory2");
export const IconBuildingWarehouse = make("IconBuildingWarehouse");
export const IconCalculator = make("IconCalculator");
export const IconCalendarPlus = make("IconCalendarPlus");
export const IconCar = make("IconCar");
export const IconCash = make("IconCash");
export const IconCashBanknote = make("IconCashBanknote");
export const IconCashOff = make("IconCashOff");
export const IconCategory = make("IconCategory");
export const IconChartBar = make("IconChartBar");
export const IconCheck = make("IconCheck");
export const IconChevronDown = make("IconChevronDown");
export const IconChevronLeft = make("IconChevronLeft");
export const IconChevronRight = make("IconChevronRight");
export const IconChevronsLeft = make("IconChevronsLeft");
export const IconChevronsRight = make("IconChevronsRight");
export const IconChevronUp = make("IconChevronUp");
export const IconClipboardText = make("IconClipboardText");
export const IconCopy = make("IconCopy");
export const IconDatabaseOff = make("IconDatabaseOff");
export const IconDeviceFloppy = make("IconDeviceFloppy");
export const IconDots = make("IconDots");
export const IconDownload = make("IconDownload");
export const IconEye = make("IconEye");
export const IconEyeOff = make("IconEyeOff");
export const IconFileCheck = make("IconFileCheck");
export const IconFileExcel = make("IconFileExcel");
export const IconFileExport = make("IconFileExport");
export const IconFileInvoice = make("IconFileInvoice");
export const IconFileSpreadsheet = make("IconFileSpreadsheet");
export const IconFileText = make("IconFileText");
export const IconFileUpload = make("IconFileUpload");
export const IconFilter = make("IconFilter");
export const IconFilterOff = make("IconFilterOff");
export const IconGridDots = make("IconGridDots");
export const IconHistory = make("IconHistory");
export const IconInfoCircle = make("IconInfoCircle");
export const IconList = make("IconList");
export const IconLock = make("IconLock");
export const IconLockOpen = make("IconLockOpen");
export const IconLogin = make("IconLogin");
export const IconMapPin = make("IconMapPin");
export const IconMessageCircle = make("IconMessageCircle");
export const IconPackage = make("IconPackage");
export const IconPencil = make("IconPencil");
export const IconPercentage = make("IconPercentage");
export const IconPlayerPlay = make("IconPlayerPlay");
export const IconPlayerStop = make("IconPlayerStop");
export const IconPlus = make("IconPlus");
export const IconPower = make("IconPower");
export const IconPrinter = make("IconPrinter");
export const IconReceipt = make("IconReceipt");
export const IconReceiptRefund = make("IconReceiptRefund");
export const IconRefresh = make("IconRefresh");
export const IconReportMoney = make("IconReportMoney");
export const IconSearch = make("IconSearch");
export const IconSearchOff = make("IconSearchOff");
export const IconSend = make("IconSend");
export const IconShoppingBag = make("IconShoppingBag");
export const IconShoppingCart = make("IconShoppingCart");
export const IconStack2 = make("IconStack2");
export const IconTable = make("IconTable");
export const IconTableFilled = make("IconTableFilled");
export const IconThumbDown = make("IconThumbDown");
export const IconThumbUp = make("IconThumbUp");
export const IconTrash = make("IconTrash");
export const IconTrashX = make("IconTrashX");
export const IconTruck = make("IconTruck");
export const IconTruckDelivery = make("IconTruckDelivery");
export const IconUser = make("IconUser");
export const IconUsers = make("IconUsers");
export const IconX = make("IconX");
