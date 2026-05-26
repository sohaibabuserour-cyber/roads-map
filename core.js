/* ====================================================
   CONSTANTS & STATE
   ==================================================== */

const USERS_SHEET_ID     = "1maViL4HSsI5XsjnAOGM-2D98g0Ow_pawZ-A_R_Y9I_0";
const EQUIPMENT_SHEET_ID = "1v40HIukVDqs6KBmQnl6HqlbS6IS4WmNKS87rFxbl63c";
const CONFIG_FILE        = "categories.json";

// Inactivity timeout: 2 hours in ms
const INACTIVITY_MS = 2 * 60 * 60 * 1000;
let inactivityTimer = null;

const STATUSES = [
    { value: "جاري",        color: "#3aaa5c", cls: "ongoing"     },
    { value: "متاح",        color: "#2196f3", cls: "available"   },
    { value: "غير متاح",    color: "#ff9800", cls: "unavailable" },
    { value: "تم الانتهاء", color: "#9c27b0", cls: "completed"   },
    { value: "متوقف",       color: "#f44336", cls: "stopped"     }
];

const LABELS = {
    "ID"           : "معرف",
    "ROAD NAME"    : "اسم الطريق",
    "BLOCK NAME"   : "اسم القطعة",
    "TOTAL-QTY"    : "الإجمالي",
    "DONE-QTY"     : "المنفذ",
    "REMANING-QTY" : "المتبقي",
    "STATUS"       : "الحالة",
    "CONTRACTOR"   : "المقاول",
    "EQUIPMENT"    : "المعدات"
};

let map;

let currentUser    = null;
let categories     = [];

let selectedItems  = {};   // subitemId → true
let selectedStatuses = ["جاري","متاح","غير متاح","تم الانتهاء","متوقف"];

let allLayers      = {};   // sheetId → Leaflet GeoJSON layer
let allData        = {};   // sheetId → { id: rowObj }
let allFeatures    = {};   // `${sheetId}-${name}` → Leaflet layer

let equipmentData  = {};

let similarGroups  = [];        // مجموعات البنود المتشابهة
let _editingGroupId = null;     // تحرير جروب

let defaultCoords  = { lat: 21.292, lng: 39.71, zoom: 14 };

let defaultSubNumber = ""; // رقم البند الافتراضي