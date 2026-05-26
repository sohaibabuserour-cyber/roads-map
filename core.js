// ====================================================
// CONSTANTS & STATE
// ====================================================

const USERS_SHEET_ID     = "1maViL4HSsI5XsjnAOGM-2D98g0Ow_pawZ-A_R_Y9I_0";
const EQUIPMENT_SHEET_ID = "1v40HIUKvdqs6KBmQnl6HqlbS6IS4WmNKS87rFxbl63c";
const CONFIG_FILE        = "categories.json";
const INACTIVITY_MS = 2 * 60 * 60 * 1000;

let map;
let currentUser    = null;
let categories     = [];
let selectedItems  = {};
let selectedStatuses = ["جاري","متاح","غير متاح","تم الانتهاء","متوقف"];
let allLayers      = {};
let allData        = {};
let allFeatures    = {};
let equipmentData  = {};
let similarGroups  = [];
let defaultCoords  = { lat: 21.292, lng: 39.71, zoom: 14 };
let defaultSubNumber = "";
let loadTokens = {};

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXQqn8MfdZOozZgPlNSNFS4Ji4jY0jy24FNB1aIyzIdaYQz3eTMQ6_ORBU2hGowMld/exec";

let inactivityTimer = null;