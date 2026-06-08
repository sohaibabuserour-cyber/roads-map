/* ====================================================
   CONSTANTS & STATE
   (الثوابت والـ URLs مُعرَّفة في config.js)
   ==================================================== */

// مؤقت الخمول — يُدار هنا، قيمته من INACTIVITY_MS في config.js
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

// → map.js: map, allLayers, allData, allFeatures, loadTokens,
//           initMap, loadLayer, removeLayer, featureStyle,
//           refreshLayerColors, flashLayer
currentUser    = null;
categories     = [];
selectedItems  = {};   // subitemId → true (only one per category enforced)
selectedStatuses = ["جاري","متاح","غير متاح","تم الانتهاء","متوقف"];
equipmentData      = {};
equipmentRawRows    = [];   // تُعبأ من viewequipment.js / equipment_combined.js
equipmentRawHeaders = [];   // تُعبأ من viewequipment.js / equipment_combined.js
similarGroups  = [];        // [{id, name, subIds:[]}] — مجموعات البنود المتشابهة
_editingGroupId = null;     // for editing existing group
defaultCoords  = { lat: 21.292, lng: 39.71, zoom: 14 };
defaultSubNumber = ""; // رقم البند الافتراضي الذي يُحمَّل عند بدء النظام
activeGroupFilter = null;   // group.id أو 'solo_'+subId أو null — فلتر مجموعات البنود

/* ====================================================
   HELPERS
   ==================================================== */

function statusColor(s) {
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.color : "#9e9e9e";
}
function statusCls(s) {
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.cls : "";
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

function sheetIdFromUrl(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : url.trim();
}

function showAlert(msg, type="error") {
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function openModal(id)  { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }


/* ====================================================
   THEMES
   ==================================================== */

function applyTheme(name) {
    // Remove all theme classes
    document.body.classList.remove('theme-ocean','theme-dark','theme-emerald','theme-sunset');
    if (name) document.body.classList.add('theme-' + name);
    localStorage.setItem('mapTheme', name);
    // Update active marker
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === name);
    });
    // Update map tiles on dark theme
    if (map) {
        map.eachLayer(l => { if (l._url) map.removeLayer(l); });
        const tileUrl = name === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    }
}

/* ====================================================
   INACTIVITY SESSION
   ==================================================== */

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (currentUser) {
            showAlert("⏰ انتهت جلستك بسبب عدم النشاط", "error");
            setTimeout(doLogout, 2000);
        }
    }, INACTIVITY_MS);
}

function initInactivityWatcher() {
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev => {
        document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
}

/* ====================================================
   SESSION PERSISTENCE (auto-login after page reload)
   ==================================================== */

function saveSession(user) {
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("sessionTime", Date.now().toString());
}

function clearSession() {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("sessionTime");
    sessionStorage.removeItem("selectedStatuses");
    sessionStorage.removeItem("selectedItems");
}

async function tryRestoreSession() {
    const saved     = sessionStorage.getItem("currentUser");
    const savedTime = sessionStorage.getItem("sessionTime");
    if (!saved || !savedTime) return false;
    // If more than 2 hours have passed since last save, clear session
    if (Date.now() - parseInt(savedTime) > INACTIVITY_MS) {
        clearSession();
        return false;
    }
    currentUser = JSON.parse(saved);
    return true;
}

/* ====================================================
   LOGIN
   ==================================================== */

async function fetchUsers() {
    const id  = (window.sheetIdsConfig && window.sheetIdsConfig['USERS_SHEET_ID']) || USERS_SHEET_ID;
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;
    const r   = await fetch(url);
    const csv = await r.text();
    const lines   = csv.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());
    const users   = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const obj  = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
        users.push(obj);
    }
    return users;
}

function togglePasswordVisibility() {
    const input = document.getElementById("loginPassword");
    const btn = document.getElementById("togglePassword");
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
        btn.style.opacity = "1";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
        btn.style.opacity = "0.6";
    }
}

async function doLogin() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pass  = document.getElementById("loginPassword").value.trim();

    if (!email || !pass) { showLoginError("يرجى إدخال البريد وكلمة المرور"); return; }

    document.getElementById("loginLoading").style.display = "block";
    document.getElementById("loginError").style.display   = "none";
    document.getElementById("loginBtn").disabled = true;

    try {
        const users = await fetchUsers();
        const found = users.find(u =>
            u["EMAIL"] && u["EMAIL"].toLowerCase() === email &&
            u["PASSWORD"] && u["PASSWORD"]          === pass
        );

        if (!found) { showLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة"); return; }

        currentUser = {
            email  : found["EMAIL"],
            name   : found["NAME"]  || found["EMAIL"],
            role   : found["ROLE"]  || "2",
            isAdmin: (found["ROLE"] || "").toString().trim() === "1",
            avatar : found["PHOTO"] || found["AVATAR"] || ""
        };

        saveSession(currentUser);
        enterApp();

    } catch(e) {
        console.error(e);
        showLoginError("خطأ في الاتصال - تأكد من إعدادات الشيت");
    } finally {
        document.getElementById("loginLoading").style.display = "none";
        document.getElementById("loginBtn").disabled = false;
    }
}

function showLoginError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
    ["loginEmail","loginPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", e => {
            if (e.key === "Enter") doLogin();
        });
    });

    // Apply saved theme
    const savedTheme = localStorage.getItem('mapTheme') || '';
    if (savedTheme) applyTheme(savedTheme);

    // Load default coords
    const dc = localStorage.getItem('defaultCoords');
    if (dc) {
        try { defaultCoords = JSON.parse(dc); } catch(e) {}
    }

    // Try restore session
    const restored = await tryRestoreSession();
    if (restored) {
        enterApp();
    }
});

/* ====================================================
   ENTER / LEAVE APP
   ==================================================== */

async function enterApp() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").classList.add("visible");



    if (currentUser.isAdmin) {
        document.body.classList.add("is-admin");
    } else {
        document.body.classList.remove("is-admin");
    }

    // Update UI
    updateUserUI();

    // Set yesterday as default date for mapDateFilter
    (function() {
        const el = document.getElementById('mapDateFilter');
        if (!el) return;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, '0');
        const dd   = String(d.getDate()).padStart(2, '0');
        el.value = `${yyyy}-${mm}-${dd}`;
    })();

    // Init map
    initMap();
    await loadCategoriesConfig();
    await loadDefaultCoords();
    loadSimilarGroups();

    const savedSel = sessionStorage.getItem("selectedStatuses");
    if (savedSel) selectedStatuses = JSON.parse(savedSel);

    const savedItems = sessionStorage.getItem("selectedItems");
    if (savedItems) selectedItems = JSON.parse(savedItems);

    renderItems();
    renderNavTabs();

    // Auto-select البند الافتراضي إذا لم يكن هناك اختيار سابق
    const hasAnySelection = Object.keys(selectedItems).length > 0;
    if (!hasAnySelection && defaultSubNumber) {
        const defaultSub = categories.flatMap(c => c.subitems)
            .find(s => (s.number || "").trim() === defaultSubNumber.trim());
        if (defaultSub) {
            selectedItems[defaultSub.id] = true;
        }
    }

    // Re-load previously selected layers
    categories.forEach(cat => {
        cat.subitems.forEach(sub => {
            if (selectedItems[sub.id]) loadLayer(sub.sheetId, sub.name, sub.geoJsonFile, cat.id);
        });
    });

    document.querySelectorAll(".status-checkbox").forEach(cb => {
        cb.checked = selectedStatuses.includes(cb.dataset.status);
    });

    updateStats();
    initInactivityWatcher();

    // Load notifications (sheet last-updated info)
    loadNotifications();

    // → contractors.js: buildContractorPanel()
}

function updateUserUI() {
    const initial = (currentUser.name || "؟").charAt(0);

    // Nav avatar
    const navAv = document.getElementById("navAvatar");
    navAv.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة">`
        : initial;

    document.getElementById("navUserName").textContent = currentUser.name;

    // Dropdown
    const udWrap = document.getElementById("udAvatarWrap");
    udWrap.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة"><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`
        : `<span>${initial}</span><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`;

    document.getElementById("udName").textContent    = currentUser.name;
    document.getElementById("udRole").textContent    = currentUser.isAdmin ? "مدير النظام" : "مستخدم";
    document.getElementById("udNameInput").value     = currentUser.name;
    document.getElementById("udPassInput").value     = "";

    // تحديث حقول الإعدادات
    if (defaultCoords) {
        const sl = document.getElementById("settingsLat"); if(sl) sl.value = defaultCoords.lat;
        const sg = document.getElementById("settingsLng"); if(sg) sg.value = defaultCoords.lng;
        const sz = document.getElementById("settingsZoom"); if(sz) sz.value = defaultCoords.zoom;
    }
}

function doLogout() {
    clearSession();
    clearTimeout(inactivityTimer);
    currentUser = null;
    Object.values(allLayers).forEach(l => { if (map) map.removeLayer(l); });
    allLayers = {}; allData = {}; allFeatures = {};
    selectedItems = {};
    document.getElementById("mainApp").classList.remove("visible");
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginEmail").value    = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginError").style.display = "none";
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown').forEach(p => p.classList.remove('active'));
}

// Apps Script Web App URL for writing back to the Users sheet.
// APPS_SCRIPT_URL مُعرَّف في config.js

async function writeUserToSheet(payload) {
    if (!APPS_SCRIPT_URL) return false;
    try {
        const r = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" }, // Apps Script reads e.postData.contents as JSON
            body: JSON.stringify(payload),
            redirect: "follow"
        });
        const text = await r.text();
        return text.trim() === "OK" || r.ok;
    } catch(e) {
        console.warn("Apps Script write failed:", e);
        return false;
    }
}

/* ====================================================
   USER PROFILE EDIT
   ==================================================== */

function triggerAvatarUpload() {
    document.getElementById("avatarFileInput").click();
}

function compressImage(dataUrl, maxWidth = 120) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width  = img.width  * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    });
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        // Compress to small size before saving/sending
        const compressed = await compressImage(ev.target.result, 120);
        currentUser.avatar = compressed;
        updateUserUI();
        saveSession(currentUser);

        showAlert("⏳ جاري حفظ الصورة...", "success");

        const ok = await writeUserToSheet({
            action: "updateUser",
            role: currentUser.role,
            photo: compressed
        });

        if (ok) {
            showAlert("✅ تم حفظ الصورة في الشيت — ستظهر من أي جهاز", "success");
        } else {
            showAlert("✅ الصورة محفوظة في الجلسة الحالية", "success");
        }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
}

async function saveUserProfile() {
    const newName = document.getElementById("udNameInput").value.trim();
    const newPass = document.getElementById("udPassInput").value.trim();

    if (!newName) { showAlert("❌ يرجى إدخال الاسم"); return; }

    currentUser.name = newName;
    saveSession(currentUser);
    updateUserUI();

    showAlert("⏳ جاري الحفظ...", "success");

    const payload = { role: currentUser.role };
    if (newName) payload.name = newName;
    if (newPass) payload.password = newPass;

    const ok = await writeUserToSheet(payload);

    if (ok) {
        showAlert("✅ تم حفظ التغييرات في الشيت", "success");
    } else {
        showAlert("✅ تم حفظ الاسم محلياً — تأكد من إعدادات الـ Apps Script", "success");
    }

    document.getElementById("userDropdown").classList.remove("active");
}

/* ====================================================
   DEFAULT COORDINATES (admin)
   ==================================================== */

async function loadDefaultCoords() {
    const dc = localStorage.getItem('defaultCoords');
    if (dc) {
        try {
            defaultCoords = JSON.parse(dc);
            if (map) map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
        } catch(e) {}
    }
    // تحميل رقم البند الافتراضي من localStorage كـ fallback
    const dsn = localStorage.getItem('defaultSubNumber');
    if (dsn !== null && !defaultSubNumber) defaultSubNumber = dsn;
}

/* ====================================================
   SETTINGS MODAL
   ==================================================== */

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Fill sheet IDs
    _fillSheetIdsInputs();
    // Render current tab
    switchSettingsTab('coords');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// استخراج Sheet ID من رابط Google Sheets كامل أو ID مباشر
function _extractSheetId(val) {
    if (!val) return '';
    val = val.trim();
    const m = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : val;
}

function _fillSheetIdsInputs() {
    const keyMap = {
        'sheetId_users'         : 'USERS_SHEET_ID',
        'sheetId_equipment'     : 'EQUIPMENT_SHEET_ID',
        'sheetId_eqreg'         : 'EQ_REG_SHEET_ID',
        'sheetId_cfCompany'     : 'CASHFLOW_COMPANY_SHEET',
        'sheetId_cfContractors' : 'CASHFLOW_CONTRACTORS_SHEET',
        'sheetId_bills'         : 'BILLS_SHEET_ID',
        'sheetId_target'        : 'TARGET_SHEET_ID',
        'sheetId_boq'           : 'BOQ_SHEET_ID',
        'sheetId_schedule'      : 'SCHEDULE_SHEET_ID',
    };
    const cfg    = window.sheetIdsConfig || {};
    const legacy = JSON.parse(localStorage.getItem('sheetIdsOverride') || '{}');

    Object.entries(keyMap).forEach(([inputId, constName]) => {
        const inp  = document.getElementById(inputId);
        const link = document.getElementById(inputId.replace('sheetId_', 'sheetLink_'));
        const raw  = cfg[constName] || legacy[constName] || window[constName] || '';
        const id   = _extractSheetId(raw);
        if (inp)  inp.value = id ? 'https://docs.google.com/spreadsheets/d/' + id : '';
        if (link && id) link.href = 'https://docs.google.com/spreadsheets/d/' + id;
    });

    // رابط الأسكريبت — يُحفظ كما هو (ليس Sheet ID)
    const scriptInp = document.getElementById('sheetId_targetScript');
    if (scriptInp) {
        scriptInp.value = cfg['TARGET_SCRIPT_URL'] || legacy['TARGET_SCRIPT_URL']
                       || window.TARGET_SCRIPT_URL || '';
    }
    const boqScriptInp = document.getElementById('sheetId_boqScript');
    if (boqScriptInp) {
        boqScriptInp.value = cfg['BOQ_SCRIPT_URL'] || legacy['BOQ_SCRIPT_URL']
                          || window.BOQ_SCRIPT_URL || '';
    }
    const scheduleScriptInp = document.getElementById('sheetId_scheduleScript');
    if (scheduleScriptInp) {
        scheduleScriptInp.value = cfg['SCHEDULE_SCRIPT_URL'] || legacy['SCHEDULE_SCRIPT_URL']
                               || window.SCHEDULE_SCRIPT_URL || '';
    }
}

function saveSheetIds() {
    const keyMap = {
        'USERS_SHEET_ID'             : 'sheetId_users',
        'EQUIPMENT_SHEET_ID'         : 'sheetId_equipment',
        'EQ_REG_SHEET_ID'            : 'sheetId_eqreg',
        'CASHFLOW_COMPANY_SHEET'     : 'sheetId_cfCompany',
        'CASHFLOW_CONTRACTORS_SHEET' : 'sheetId_cfContractors',
        'BILLS_SHEET_ID'             : 'sheetId_bills',
        'TARGET_SHEET_ID'            : 'sheetId_target',
        'BOQ_SHEET_ID'               : 'sheetId_boq',
        'SCHEDULE_SHEET_ID'          : 'sheetId_schedule',
    };
    if (!window.sheetIdsConfig) window.sheetIdsConfig = {};

    Object.entries(keyMap).forEach(([constName, inputId]) => {
        const raw = document.getElementById(inputId)?.value.trim() || '';
        const id  = _extractSheetId(raw);
        if (id) {
            window.sheetIdsConfig[constName] = id;
            window[constName] = id;
        } else {
            delete window.sheetIdsConfig[constName];
        }
    });

    // رابط الأسكريبت — يُحفظ كرابط كامل
    const scriptRaw = document.getElementById('sheetId_targetScript')?.value.trim() || '';
    if (scriptRaw) {
        window.sheetIdsConfig['TARGET_SCRIPT_URL'] = scriptRaw;
        window.TARGET_SCRIPT_URL = scriptRaw;
    } else {
        delete window.sheetIdsConfig['TARGET_SCRIPT_URL'];
        window.TARGET_SCRIPT_URL = '';
    }

    // رابط سكريبت جدول الكميات
    const boqScriptRaw = document.getElementById('sheetId_boqScript')?.value.trim() || '';
    if (boqScriptRaw) {
        window.sheetIdsConfig['BOQ_SCRIPT_URL'] = boqScriptRaw;
        window.BOQ_SCRIPT_URL = boqScriptRaw;
    } else {
        delete window.sheetIdsConfig['BOQ_SCRIPT_URL'];
        window.BOQ_SCRIPT_URL = '';
    }

    // رابط سكريبت البرنامج الزمني
    const scheduleScriptRaw = document.getElementById('sheetId_scheduleScript')?.value.trim() || '';
    if (scheduleScriptRaw) {
        window.sheetIdsConfig['SCHEDULE_SCRIPT_URL'] = scheduleScriptRaw;
        window.SCHEDULE_SCRIPT_URL = scheduleScriptRaw;
    } else {
        delete window.sheetIdsConfig['SCHEDULE_SCRIPT_URL'];
        window.SCHEDULE_SCRIPT_URL = '';
    }

    localStorage.setItem('sheetIdsConfig', JSON.stringify(window.sheetIdsConfig));

    if (window.sheetIdsConfig['BILLS_SHEET_ID']) {
        window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'];
    }
    if (window.sheetIdsConfig['TARGET_SHEET_ID']) {
        window.TARGET_SHEET_ID = window.sheetIdsConfig['TARGET_SHEET_ID'];
    }

    _fillSheetIdsInputs();

    const fb = document.getElementById('sheetIds_feedback');
    if (fb) {
        fb.style.display = 'block';
        fb.style.background = 'rgba(39,174,106,0.12)';
        fb.style.border = '1px solid rgba(39,174,106,0.4)';
        fb.style.color = '#5cc890';
        fb.textContent = '✅ تم الحفظ — ستُضمَّن في categories.json عند الضغط على ⬇';
        setTimeout(() => { fb.style.display = 'none'; }, 4000);
    }
    showAlert('✅ تم حفظ روابط الشيتات', 'success');
}


// تحميل sheetIdsConfig عند بدء التشغيل — يدعم النظام القديم كـ fallback
(function _applySheetIdsOnLoad() {
    try {
        if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
        // النظام الجديد
        const fresh  = JSON.parse(localStorage.getItem('sheetIdsConfig')   || '{}');
        // النظام القديم كـ fallback
        const legacy = JSON.parse(localStorage.getItem('sheetIdsOverride') || '{}');
        const merged = Object.assign({}, legacy, fresh);
        Object.assign(window.sheetIdsConfig, merged);
        Object.entries(merged).forEach(([key, val]) => {
            if (val) window[key] = _extractSheetId ? _extractSheetId(val) : val;
        });
        // تأكد BILLS_SHEET_ID يُحدَّث لو موجود في الـ config
        if (window.sheetIdsConfig && window.sheetIdsConfig['BILLS_SHEET_ID']) {
            window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'];
        }
    } catch(e) {}
})();

/* ====================================================
   SETTINGS PANEL
   ==================================================== */

function switchSettingsTab(tab) {
    // Update sidebar tab buttons
    const tabIds = ['coords', 'default', 'similar', 'eqtypes', 'contractors', 'sheets'];
    tabIds.forEach(t => {
        const btn = document.getElementById('stab_' + t);
        if (!btn) return;
        const isActive = t === tab;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.style.background = 'rgba(106,45,145,0.35)';
            btn.style.borderColor = 'rgba(106,45,145,0.5)';
            btn.style.color = 'rgba(255,255,255,0.9)';
        } else {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'transparent';
            btn.style.color = 'rgba(255,255,255,0.55)';
        }
    });
    // Show/hide content sections
    document.getElementById('settingsTabCoords')      && (document.getElementById('settingsTabCoords').style.display      = tab === 'coords'      ? 'block' : 'none');
    document.getElementById('settingsTabDefault')     && (document.getElementById('settingsTabDefault').style.display     = tab === 'default'     ? 'block' : 'none');
    document.getElementById('settingsTabSimilar')     && (document.getElementById('settingsTabSimilar').style.display     = tab === 'similar'     ? 'block' : 'none');
    document.getElementById('settingsTabEqtypes')     && (document.getElementById('settingsTabEqtypes').style.display     = tab === 'eqtypes'     ? 'block' : 'none');
    document.getElementById('settingsTabContractors') && (document.getElementById('settingsTabContractors').style.display = tab === 'contractors' ? 'block' : 'none');
    document.getElementById('settingsTabSheets')      && (document.getElementById('settingsTabSheets').style.display      = tab === 'sheets'      ? 'block' : 'none');
    // Tab-specific logic
    if (tab === 'similar')      renderSimilarGroupsList();
    if (tab === 'default')      renderDefaultSubPreview();
    if (tab === 'eqtypes')      { renderEquipmentTypesList(); updateEqTypesCount(); }
    if (tab === 'contractors')  { renderContractorsListSettings(); updateContractorsCount(); }
    if (tab === 'sheets')       _fillSheetIdsInputs();
}

function saveSettingsCoords() {
    const lat  = parseFloat(document.getElementById("settingsLat").value);
    const lng  = parseFloat(document.getElementById("settingsLng").value);
    const zoom = parseInt(document.getElementById("settingsZoom").value);
    if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) { showAlert("❌ أدخل إحداثيات صحيحة"); return; }
    defaultCoords = { lat, lng, zoom };
    localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
    if (map) map.setView([lat, lng], zoom);
    showAlert("✅ تم حفظ الإحداثيات الافتراضية", "success");
}

function saveSettingsDefaultSub() {
    const num = document.getElementById("settingsDefaultSub").value.trim();
    // تحقق إن الرقم موجود فعلاً في البنود
    const found = categories.flatMap(c => c.subitems).find(s => (s.number || "").trim() === num);
    if (num && !found) {
        showAlert("❌ رقم البند غير موجود — تأكد من الرقم");
        return;
    }
    defaultSubNumber = num;
    localStorage.setItem('defaultSubNumber', num);
    renderDefaultSubPreview();
    showAlert(num ? "✅ تم حفظ البند الافتراضي: " + (found ? found.name : num) : "✅ تم مسح البند الافتراضي", "success");
}

function renderDefaultSubPreview() {
    const inp     = document.getElementById("settingsDefaultSub");
    const preview = document.getElementById("settingsDefaultSubPreview");
    if (!inp || !preview) return;
    inp.value = defaultSubNumber || "";
    if (!defaultSubNumber) { preview.style.display = "none"; return; }
    const found = categories.flatMap(c => c.subitems).find(s => (s.number || "").trim() === defaultSubNumber);
    if (found) {
        const cat = categories.find(c => c.subitems.some(s => s.id === found.id));
        preview.textContent = "✔ " + (cat ? cat.name + " ← " : "") + found.name;
        preview.style.display = "block";
        preview.style.color = "var(--green)";
    } else {
        preview.textContent = "⚠ رقم البند غير موجود في البنود الحالية";
        preview.style.display = "block";
        preview.style.color = "var(--orange)";
    }
}

/* ====================================================
   SIMILAR GROUPS MANAGEMENT
   ==================================================== */

function loadSimilarGroups() {
    try {
        const saved = localStorage.getItem('similarGroups');
        if (saved) similarGroups = JSON.parse(saved);
    } catch(e) { similarGroups = []; }
}

function saveSimilarGroupsToStorage() {
    localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
}

/* ── Get group that a subitem belongs to ── */
function getGroupForSub(subId) {
    return similarGroups.find(g => g.subIds.includes(subId)) || null;
}

/* ── Render the groups list in settings panel ── */
function renderSimilarGroupsList() {
    const list = document.getElementById('similarGroupsList');
    if (!list) return;

    if (!similarGroups.length) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-soft);font-size:11px;padding:12px 0;">لا توجد مجموعات بعد</div>';
        return;
    }

    list.innerHTML = similarGroups.map(group => {
        const subNames = group.subIds.map(sid => {
            name = sid;
            categories.forEach(c => {
                const sub = c.subitems.find(s => s.id === sid);
                if (sub) name = sub.name;
            });
            return name;
        });

        return `
        <div class="similar-group-card">
            <div class="similar-group-card-header">
                <button class="similar-group-del" onclick="deleteSimilarGroup('${group.id}')" title="حذف المجموعة">✕</button>
                <span class="similar-group-name">${group.name || 'مجموعة بدون اسم'}</span>
                <button onclick="openSimilarGroupModal('${group.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--purple);font-weight:700;font-family:'Cairo',sans-serif;padding:0 4px;" title="تعديل">✎ تعديل</button>
            </div>
            <div class="similar-group-items">
                ${subNames.map(n => `<span class="similar-group-pill">${n}</span>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function deleteSimilarGroup(groupId) {
    similarGroups = similarGroups.filter(g => g.id !== groupId);
    saveSimilarGroupsToStorage();
    renderSimilarGroupsList();
    showAlert("✅ تم حذف المجموعة", "success");
}

/* ── Open modal to add/edit a similar group ── */
function openSimilarGroupModal(editId = null) {
    _editingGroupId = editId;
    const modal = document.getElementById('similarGroupModal');
    modal.style.display = 'flex';

    // Set name
    const existing = editId ? similarGroups.find(g => g.id === editId) : null;
    document.getElementById('similarGroupNameInput').value = existing ? (existing.name || '') : '';

    // Build subitems grid
    const grid = document.getElementById('similarSubitemsGrid');
    grid.innerHTML = '';

    categories.forEach(cat => {
        if (!cat.subitems.length) return;
        const section = document.createElement('div');
        section.className = 'similar-cat-section';
        section.innerHTML = `<div class="similar-cat-label">${cat.emoji} ${cat.name}</div>`;

        cat.subitems.forEach(sub => {
            const row = document.createElement('div');
            row.className = 'similar-subitem-row';

            const isChecked = existing && existing.subIds.includes(sub.id);

            // Check if this sub belongs to another group (not the one being edited)
            const otherGroup = similarGroups.find(g => g.id !== editId && g.subIds.includes(sub.id));
            const isInOtherGroup = !!otherGroup;

            row.innerHTML = `
                <input type="checkbox" id="sg_${sub.id}"
                    data-sub-id="${sub.id}"
                    ${isChecked ? 'checked' : ''}
                    ${isInOtherGroup ? 'disabled title="هذا البند موجود في مجموعة أخرى: ' + (otherGroup.name || 'بدون اسم') + '"' : ''}>
                <label for="sg_${sub.id}" style="${isInOtherGroup ? 'opacity:0.45;' : ''}">${sub.name}${sub.number ? ' (' + sub.number + ')' : ''}</label>
                ${isInOtherGroup ? `<span class="similar-subitem-cat-badge" title="المجموعة: ${otherGroup.name || 'بدون اسم'}">مُجمَّع</span>` : ''}`;

            if (isChecked) row.classList.add('selected');

            row.addEventListener('click', e => {
                if (isInOtherGroup) return;
                const cb = row.querySelector('input[type="checkbox"]');
                if (e.target !== cb) cb.checked = !cb.checked;
                row.classList.toggle('selected', cb.checked);
            });

            section.appendChild(row);
        });
        grid.appendChild(section);
    });
}

function closeSimilarGroupModal() {
    document.getElementById('similarGroupModal').style.display = 'none';
    _editingGroupId = null;
}

function saveSimilarGroup() {
    const name = document.getElementById('similarGroupNameInput').value.trim();
    const checked = [...document.querySelectorAll('#similarSubitemsGrid input[type="checkbox"]:checked')]
        .map(cb => cb.dataset.subId);

    if (checked.length < 2) {
        showAlert("❌ اختر بندين فرعيين على الأقل");
        return;
    }

    if (_editingGroupId) {
        const g = similarGroups.find(g => g.id === _editingGroupId);
        if (g) { g.name = name || 'مجموعة'; g.subIds = checked; }
    } else {
        similarGroups.push({ id: uid(), name: name || 'مجموعة', subIds: checked });
    }

    saveSimilarGroupsToStorage();
    renderSimilarGroupsList();
    closeSimilarGroupModal();
    showAlert("✅ تم حفظ المجموعة", "success");
}

/* ====================================================
   EQUIPMENT DATA
   ==================================================== */



/* ====================================================
   CASH FLOW DASHBOARD MODAL
   ==================================================== */

// CASHFLOW_CONTRACTORS_SHEET, CASHFLOW_COMPANY_SHEET مُعرَّفان في config.js
// BILLS_SHEET_ID مُعرَّف في config.js ويُحدَّث ديناميكياً من sheetIdsConfig

// helper — يجيب الـ ID من sheetIdsConfig أولاً ثم الـ constant كـ fallback
function _cfSheetId(constName, fallback) {
    return (window.sheetIdsConfig && window.sheetIdsConfig[constName]) || fallback || '';
}

let cashflowData = { contractors: null, company: null };
let cfActiveTab  = 'contractors';

function switchCfTab(tab) {
    cfActiveTab = tab;
    document.querySelectorAll('.cf-tab-pill').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.cf-content').forEach(c => {
        c.classList.toggle('active', c.id === 'cf-' + tab);
    });
    if (!cashflowData[tab]) {
        const sheetId = tab === 'contractors'
            ? _cfSheetId('CASHFLOW_CONTRACTORS_SHEET', CASHFLOW_CONTRACTORS_SHEET)
            : _cfSheetId('CASHFLOW_COMPANY_SHEET',     CASHFLOW_COMPANY_SHEET);
        loadCfData(tab, sheetId);
    } else {
        renderCfKpis(tab);
    }
}

async function loadCfData(type, sheetId) {
    const container = document.getElementById('cf-' + type);
    container.innerHTML = '<div class="cf-loading">⏳ جاري تحميل البيانات...</div>';
    // Reset KPIs
    ['cfKpiTotal','cfKpiPaid','cfKpiRemaining','cfKpiPct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
    });
    const bar = document.getElementById('cfKpiBar');
    if (bar) bar.style.width = '0%';

    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
        const r   = await fetch(url);
        if (!r.ok) throw new Error('Failed to fetch');
        const csv = await r.text();
        if (csv.trim().startsWith('<')) {
            container.innerHTML = '<div class="cf-error">⚠️ الشيت يحتاج إعداد المشاركة العامة</div>';
            return;
        }
        const _cfLines = csv.split('\n').filter(l => l.trim());
        const _cfHdrs  = _cfLines.length ? parseCSVLine(_cfLines[0]) : [];
        const _cfRows  = [];
        for (let _ci = 1; _ci < _cfLines.length; _ci++) {
            const _cfVals = parseCSVLine(_cfLines[_ci]);
            const _cfRow  = {};
            _cfHdrs.forEach((h, idx) => { _cfRow[h] = _cfVals[idx] || ''; });
            _cfRows.push(_cfRow);
        }
        const data = { headers: _cfHdrs, rows: _cfRows };
        cashflowData[type] = data;
        renderCfKpis(type);
        renderCfTable(type, data);
        document.getElementById('cfLastUpdate').textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-SA');
    } catch(e) {
        console.error('Cashflow load error:', e);
        container.innerHTML = '<div class="cf-error">❌ تعذر تحميل البيانات — تأكد من إعدادات الشيت</div>';
    }
}


/* ── Smart KPI detection: scan all columns for money-like totals ── */
function renderCfKpis(type) {
    const data = cashflowData[type];
    if (!data || !data.rows.length) return;

    // Try to detect numeric columns that look like money
    const numericCols = data.headers.filter(h => {
        let hasNum = false;
        data.rows.slice(0, 10).forEach(row => {
            const v = (row[h] || '').replace(/,/g, '');
            if (!isNaN(parseFloat(v)) && parseFloat(v) > 0) hasNum = true;
        });
        return hasNum;
    });

    if (numericCols.length === 0) {
        // Can't compute KPIs — hide KPI row
        document.getElementById('cfKpiRow').style.display = 'none';
        return;
    }

    document.getElementById('cfKpiRow').style.display = 'grid';

    // Sum each numeric column
    const colSums = {};
    numericCols.forEach(col => {
        let s = 0;
        data.rows.forEach(row => {
            const v = parseFloat((row[col] || '').replace(/,/g, ''));
            if (!isNaN(v)) s += v;
        });
        colSums[col] = s;
    });

    const sums = Object.values(colSums).sort((a, b) => b - a);

    // Heuristic: biggest sum = total, second biggest = paid, difference = remaining
    const total     = sums[0] || 0;
    const paid      = sums[1] || 0;
    const remaining = Math.max(0, total - paid);
    const pct       = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

    const fmt = n => n >= 1_000_000
        ? (n / 1_000_000).toFixed(1) + ' م'
        : n.toLocaleString('en-US');

    document.getElementById('cfKpiTotal').textContent     = fmt(total);
    document.getElementById('cfKpiPaid').textContent      = fmt(paid);
    document.getElementById('cfKpiRemaining').textContent = fmt(remaining);
    document.getElementById('cfKpiPct').textContent       = pct + '%';

    const bar = document.getElementById('cfKpiBar');
    if (bar) {
        bar.style.width = '0%';
        setTimeout(() => { bar.style.width = pct + '%'; }, 80);
        bar.style.background = pct < 30
            ? 'linear-gradient(90deg,#e74c3c,#c0392b)'
            : pct < 70
            ? 'linear-gradient(90deg,#f39c12,#e67e22)'
            : 'linear-gradient(90deg,#27ae60,#1e8449)';
    }
}

/* ── Render table with smart number detection & color coding ── */
function renderCfTable(type, data) {
    const container = document.getElementById('cf-' + type);
    if (!data.rows.length) {
        container.innerHTML = '<div class="cf-empty">لا توجد بيانات</div>';
        return;
    }

    // Detect which columns are numeric
    const numericHeaders = new Set(data.headers.filter(h => {
        let cnt = 0;
        data.rows.slice(0, Math.min(15, data.rows.length)).forEach(row => {
            const v = (row[h] || '').replace(/,/g, '');
            if (!isNaN(parseFloat(v)) && v.trim() !== '') cnt++;
        });
        return cnt > data.rows.length * 0.3;
    }));

    const numericCols = [...numericHeaders];
    const colSums = {};
    numericCols.forEach(col => {
        let s = 0;
        data.rows.forEach(row => {
            const v = parseFloat((row[col] || '').replace(/,/g, ''));
            if (!isNaN(v)) s += v;
        });
        colSums[col] = s;
    });

    // Assign color classes: highest-sum col = gold, 2nd = green, 3rd = blue
    const sortedCols = numericCols.sort((a, b) => colSums[b] - colSums[a]);
    const colClass = {};
    if (sortedCols[0]) colClass[sortedCols[0]] = '';          // gold (default cf-num)
    if (sortedCols[1]) colClass[sortedCols[1]] = 'cf-num-green';
    if (sortedCols[2]) colClass[sortedCols[2]] = 'cf-num-blue';

    let html = `<div class="cf-table-wrap"><table class="cf-table"><thead><tr>`;
    data.headers.forEach(h => { html += `<th>${h}</th>`; });
    html += `<tr></thead><tbody>`;

    data.rows.forEach((row, i) => {
        html += `<tr>`;
        data.headers.forEach(h => {
            const raw = row[h] || '';
            const isNum = numericHeaders.has(h);
            let display = raw;
            if (isNum) {
                const n = parseFloat(raw.replace(/,/g, ''));
                display = !isNaN(n) ? n.toLocaleString('en-US') : raw;
            }
            const cls = isNum ? ('cf-num ' + (colClass[h] || '')) : '';
            html += `<td class="${cls}">${display}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/* ====================================================
   NOTIFICATIONS — from dedicated sheet (column A, each row = one notification)
   ==================================================== */

// NOTIFICATIONS_SHEET_ID مُعرَّف في config.js

async function loadNotifications() {
    const badge = document.getElementById("notifBadge");
    const list  = document.getElementById("notifList");

    list.innerHTML = '<div class="notif-empty">جاري التحميل...</div>';

    try {
        const url = `https://docs.google.com/spreadsheets/d/${NOTIFICATIONS_SHEET_ID}/export?format=csv&gid=0`;
        const r   = await fetch(url, { redirect: "follow" });

        const csv = await r.text();

        // If the sheet is not public, Google returns an HTML login page
        if (csv.trim().startsWith('<') || csv.includes('accounts.google.com')) {
            list.innerHTML = '<div class="notif-empty">⚠️ الشيت يحتاج إعداد المشاركة العامة</div>';
            badge.style.display = 'none';
            return;
        }

        const lines = csv.split('\n').map(l => l.trim()).filter(l => l);

        // Read ALL rows from column A (no header skip — treat every row as a notification)
        const items = lines.map(line => parseCSVLine(line)[0] || '').filter(v => v);

        if (!items.length) {
            list.innerHTML = '<div class="notif-empty">لا توجد إشعارات</div>';
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'flex';
        badge.textContent = items.length;
        list.innerHTML = items.map(text => `
            <div class="notif-item">
                <div class="notif-item-title">${text}</div>
            </div>`).join('');

    } catch(e) {
        console.warn("Notifications load failed:", e);
        list.innerHTML = '<div class="notif-empty">تعذر تحميل الإشعارات</div>';
        badge.style.display = 'none';
    }
}

/* ====================================================
   CATEGORIES CONFIG
   ==================================================== */

async function loadCategoriesConfig() {
    try {
        const r = await fetch(CONFIG_FILE + "?t=" + Date.now());
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        categories = Array.isArray(data) ? data : (data.categories || []);
        // Load defaultCoords from config if present (shared across all users)
        if (!Array.isArray(data) && data.defaultCoords) {
            defaultCoords = data.defaultCoords;
            // Also store locally
            localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
        }
        // Load similarGroups from config if present (shared across all users)
        if (!Array.isArray(data) && data.similarGroups) {
            similarGroups = data.similarGroups;
            localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
        }
        // Load defaultSubNumber from config if present
        if (!Array.isArray(data) && data.defaultSubNumber !== undefined) {
            defaultSubNumber = data.defaultSubNumber || "";
            localStorage.setItem('defaultSubNumber', defaultSubNumber);
        }
        // Load equipmentTypes from config if present (admin-managed list)
        if (!Array.isArray(data) && data.equipmentTypes && Array.isArray(data.equipmentTypes)) {
            equipmentTypes = data.equipmentTypes;
        }
       if (!Array.isArray(data) && data.contractorsList && Array.isArray(data.contractorsList)) {
            contractorsList = data.contractorsList;
        }
        // تحميل روابط الشيتات من categories.json — تُشارَك على كل الأجهزة
        if (!Array.isArray(data) && data.sheetIdsConfig && typeof data.sheetIdsConfig === 'object') {
            if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
            // categories.json يطغى على localStorage (الملف هو المصدر الرئيسي)
            Object.assign(window.sheetIdsConfig, data.sheetIdsConfig);
            localStorage.setItem('sheetIdsConfig', JSON.stringify(window.sheetIdsConfig));
            // BILLS_SHEET_ID كـ var عشان viewcashflow يستخدمه
            window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'] || '';
        }
    } catch(e) {
        console.warn("categories.json not found — starting empty");
        categories = [];
    }
    categories.forEach(c => { if (!c.subitems) c.subitems = []; if (!c.id) c.id = uid(); });
}
/* ====================================================
   CONTRACTORS LIST — admin managed
   ==================================================== */
let contractorsList = [];

function renderContractorsListSettings() {
    const container = document.getElementById('contractorsList');
    if (!container) return;
    if (!contractorsList.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-soft);font-size:11px;padding:12px 0;">لا يوجد مقاولون — أضف من الأعلى</div>';
        updateContractorsCount();
        return;
    }
    container.innerHTML = contractorsList.map((name, idx) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(245,200,66,0.05);border:1px solid rgba(245,200,66,0.15);border-radius:7px;margin-bottom:5px;">
            <span style="flex:1;font-size:12px;font-weight:700;color:var(--text);text-align:right;font-family:'Cairo',sans-serif;">👷 ${name}</span>
            <button onclick="removeContractorFromList(${idx})"
                style="background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.25);color:#e53935;width:24px;height:24px;border-radius:6px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(244,67,54,0.2)'"
                onmouseout="this.style.background='rgba(244,67,54,0.08)'">✕</button>
        </div>`).join('');
    updateContractorsCount();
}

function updateContractorsCount() {
    const el = document.getElementById('contractorsCount');
    if (el) el.textContent = contractorsList.length ? `${contractorsList.length} مقاول مسجل` : '';
}

function addContractorToList() {
    const inp = document.getElementById('contractorNewInput');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) { showAlert('❌ أدخل اسم المقاول'); return; }
    if (contractorsList.includes(name)) { showAlert('⚠️ المقاول موجود مسبقاً'); inp.value = ''; return; }
    contractorsList.push(name);
    inp.value = '';
    renderContractorsListSettings();
    showAlert('✅ تمت الإضافة', 'success');
}

function removeContractorFromList(idx) {
    contractorsList.splice(idx, 1);
    renderContractorsListSettings();
}

function importContractorsFromCSV() {
    const area = document.getElementById('contractorsImportArea');
    if (!area) return;
    const lines = area.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    let added = 0;
    lines.forEach(name => {
        if (!contractorsList.includes(name)) { contractorsList.push(name); added++; }
    });
    area.value = '';
    renderContractorsListSettings();
    showAlert(`✅ تمت إضافة ${added} مقاول`, 'success');
}

function resetContractorsList() {
    if (!confirm('مسح جميع المقاولين؟')) return;
    contractorsList = [];
    renderContractorsListSettings();
    showAlert('✅ تم المسح', 'success');
}
/* ====================================================
   EXPORT / IMPORT CONFIG
   ==================================================== */

function exportConfig() {
    const payload = JSON.stringify({
        categories: categories,
        defaultCoords: defaultCoords,
        similarGroups: similarGroups,
        defaultSubNumber: defaultSubNumber,
        equipmentTypes: equipmentTypes,
        contractorsList: contractorsList,
        // روابط الشيتات — تُحفَظ دائماً عشان تنتشر على كل الأجهزة
        sheetIdsConfig: window.sheetIdsConfig || {},
        // Include current UI state for persistence
        selectedItems: selectedItems,
        selectedStatuses: selectedStatuses,
        activeContractorFilter: [...activeContractorFilter],
        currentTheme: localStorage.getItem('mapTheme') || '',
        navRightOrder: (function() {
            const order = [];
            document.querySelectorAll('.nav-right > div').forEach(div => {
                const btn = div.querySelector('.nav-icon-btn, .user-chip');
                if (btn && btn.id) order.push(btn.id);
            });
            return order;
        })()
    }, null, 2);
    const blob    = new Blob([payload], { type: "application/json" });
    const link    = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = "categories.json";
    link.click();
    showAlert("✅ تم تحميل categories.json — ارفعه على GitHub يدوياً", "success");
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            categories = Array.isArray(data) ? data : (data.categories || []);
            categories.forEach(c => { if (!c.subitems) c.subitems = []; if (!c.id) c.id = uid(); });
            // Import defaultCoords if present
            if (!Array.isArray(data) && data.defaultCoords) {
                defaultCoords = data.defaultCoords;
                localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
                if (map) map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
                        }
            // Restore state if present
            if (!Array.isArray(data)) {
                if (data.similarGroups) {
                    similarGroups = data.similarGroups;
                    localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
                }
                if (data.defaultSubNumber !== undefined) {
                    defaultSubNumber = data.defaultSubNumber || "";
                    localStorage.setItem('defaultSubNumber', defaultSubNumber);
                }
                if (data.equipmentTypes && Array.isArray(data.equipmentTypes)) {
                    equipmentTypes = data.equipmentTypes;
                    refreshEquipmentDatalist();
                    if (document.getElementById('eqTypesList')) renderEquipmentTypesList();
                }
               if (data.contractorsList && Array.isArray(data.contractorsList)) {
                    contractorsList = data.contractorsList;
                }
                // استيراد روابط الشيتات — الأهم لأنها تشغّل كل الداشبورد
                if (data.sheetIdsConfig && typeof data.sheetIdsConfig === 'object') {
                    if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
                    Object.assign(window.sheetIdsConfig, data.sheetIdsConfig);
                    localStorage.setItem('sheetIdsConfig', JSON.stringify(window.sheetIdsConfig));
                    // تحديث BILLS_SHEET_ID فوراً
                    window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'] || '';
                }
                if (data.selectedItems) selectedItems = data.selectedItems;
                if (data.selectedStatuses) selectedStatuses = data.selectedStatuses;
                if (data.activeContractorFilter) {
                    activeContractorFilter.clear();
                    data.activeContractorFilter.forEach(k => activeContractorFilter.add(k));
                }
                if (data.currentTheme) {
                    applyTheme(data.currentTheme);
                }
                if (data.navRightOrder && Array.isArray(data.navRightOrder)) {
                    const navRight = document.querySelector('.nav-right');
                    if (navRight) {
                        data.navRightOrder.forEach(id => {
                            const el = document.getElementById(id)?.parentElement;
                            if (el) navRight.appendChild(el);
                        });
                    }
                }
            }
            renderItems();
            renderNavTabs();
            updateStats();
            showAlert("✅ تم استيراد الإعدادات والحالات", "success");
        } catch { showAlert("❌ الملف غير صالح", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
}

/* ====================================================
   STATS BAR
   ==================================================== */

/* ── helper: calc totals for a subitem, respecting contractor filter & status filter ── */
function calcSubTotals(sub) {
    let total = 0, done = 0;
    if (!allData[sub.sheetId]) return { total, done };

    // Build set of active contractors for this sheet (if filter is on)
    const filterOn = activeContractorFilter && activeContractorFilter.size > 0;
    const activeContractorsForSheet = filterOn
        ? [...activeContractorFilter]
            .filter(k => k.startsWith(sub.sheetId + '|'))
            .map(k => k.split('|')[1].trim().toLowerCase())
        : null;

    Object.values(allData[sub.sheetId]).forEach(row => {
        // Status filter
        const st = (row["STATUS"] || "").trim().toLowerCase();
        if (!selectedStatuses.some(s => s.toLowerCase() === st)) return;

        // Contractor filter — only count visible features
        if (activeContractorsForSheet && activeContractorsForSheet.length > 0) {
            const featureCon = (row["CONTRACTOR"] || "").trim().toLowerCase();
            if (!activeContractorsForSheet.includes(featureCon)) return;
        }

        total += parseNum(row["TOTAL-QTY"]);
        done  += parseNum(row["DONE-QTY"]);
    });

    return { total, done };
}

/* ── build one stat card element ── */
function makeStatCard(title, subtitle, total, done, isTotal = false) {
    const card = document.createElement("div");
    card.className = "stats-group" + (isTotal ? " stats-group-total" : "");
    card.innerHTML = `
        <div class="stats-group-title">${title}</div>
        <div class="stats-group-type">${subtitle}</div>
        <div class="stat-row">
            <div class="stat-item"><div class="stat-label">الإجمالي</div><div class="stat-value">${fmtNum(total)}</div></div>
            <div class="stat-item"><div class="stat-label">المنفذ</div><div class="stat-value">${fmtNum(done)}</div></div>
            <div class="stat-item"><div class="stat-label">المتبقي</div><div class="stat-value">${fmtNum(total - done)}</div></div>
        </div>`;
    return card;
}

/* ── build contractors card for the active subitems ── */
function makeContractorsCard(sheetIds, subLabel = "البند المحدد") {
    // اجمع المقاولين مع عدد الصفوف لكل مقاول
    const contractorCounts = {};
    sheetIds.forEach(sid => {
        if (!allData[sid]) return;
        Object.values(allData[sid]).forEach(row => {
            const c = (row["CONTRACTOR"] || "").trim();
            if (!c) return;
            contractorCounts[c] = (contractorCounts[c] || 0) + 1;
        });
    });

    if (!Object.keys(contractorCounts).length) return null;

    const sorted = Object.entries(contractorCounts)
        .sort((a, b) => b[1] - a[1]); // ترتيب تنازلي بالعدد

    const total = sorted.length;

    const card = document.createElement("div");
    card.className = "stats-group stats-group-contractors";
    card.innerHTML = `
        <div class="stats-group-title">👷 المقاولون</div>
        <div class="stats-group-type">${total} مقاول في بند ${subLabel}</div>
        <div class="contractor-chips">
            ${sorted.map(([name, count]) =>
                `<span class="contractor-chip">
                    <span class="contractor-chip-name">${name}</span>
                    <span class="contractor-chip-badge">${count}</span>
                </span>`
            ).join('')}
        </div>`;
    return card;
}

/* ── build equipment card filtered by عمود البند ── */
function makeEquipmentCard(sheetIds, subLabel = "البند المحدد") {
    if (!equipmentRawRows.length || !equipmentRawHeaders.length) return null;

    // الأعمدة المستثناة
    const SKIP = new Set(['ID', 'BAYAN', 'البيان', 'DESCRIPTION', 'بيان', 'البند', 'BAND', 'ALBND', 'ITEM']);

    // اسم البند الفرعي النشط — unique names only, no duplicates
    const activeSubs = categories.flatMap(c => c.subitems).filter(s => selectedItems[s.id]);
    const activeSubNames = [...new Set(activeSubs.map(s => s.name.trim()))];

    // عمود البند
    const bandColOrig = equipmentRawHeaders.find(h => {
        const u = h.trim().toUpperCase();
        return u === 'البند' || u === 'BAND' || u === 'ALBND' || u === 'ITEM';
    });

    // فلترة الصفوف
    let rows = equipmentRawRows;
    if (bandColOrig && activeSubNames.length) {
        const bKey = bandColOrig.trim().toUpperCase();
        rows = equipmentRawRows.filter(row => {
            const val = (row[bKey] || "").trim();
            if (!val) return false; // صف بدون بند → لا يُدرج في الكارت
            return activeSubNames.includes(val);
        });
    }

    if (!rows.length) return null;

    // أعمدة المعدات
    const idIdx = equipmentRawHeaders.findIndex(h => h.toUpperCase() === 'ID');
    const totals = {};
    equipmentRawHeaders.forEach((h, i) => {
        const hUp = h.trim().toUpperCase();
        if (i === idIdx || !h.trim() || SKIP.has(hUp) || SKIP.has(h.trim())) return;
        let sum = 0;
        rows.forEach(row => {
            const val = parseFloat(row[hUp] || 0);
            if (!isNaN(val)) sum += val;
        });
        if (sum > 0) totals[h.trim()] = sum;
    });

    const entries = Object.entries(totals).sort((a,b) => b[1] - a[1]);
    if (!entries.length) return null;

    // Build label: unique subitem names joined with " و " — no repetition
    const uniqueSubNames = activeSubNames.length
        ? activeSubNames.join(' و ')
        : subLabel;

    const card = document.createElement("div");
    card.className = "stats-group stats-group-equipment";
    card.innerHTML = `
        <div class="stats-group-title">🚜 المعدات</div>
        <div class="stats-group-type">إجمالي المعدات في بند ${uniqueSubNames}</div>
        <div class="equipment-chips">
            ${entries.map(([name, count]) =>
                `<span class="equipment-chip">${name}<span class="equipment-chip-count">${fmtNum(count)}</span></span>`
            ).join('')}
        </div>`;
    return card;
}

/* ── update the progress ring in the search bar ── */
function updateProgressRing(total, done) {
    const wrap   = document.getElementById("progressRingWrap");
    const circle = document.getElementById("progressRingCircle");
    const pctEl  = document.getElementById("progressRingPct");

    if (!wrap) return;

    if (!total || total === 0) {
        wrap.classList.remove("visible");
        return;
    }

    const pct          = Math.min(100, Math.round((done / total) * 100));
    const circumference = 94.25; // 2 * π * 15
    const offset        = circumference - (pct / 100) * circumference;

    wrap.classList.add("visible");
    circle.style.strokeDashoffset = offset;
    pctEl.textContent = pct + "%";

    // Color: red < 30%, orange 30-70%, gold >= 70%
    circle.style.stroke = pct < 30 ? "#f44336" : pct < 70 ? "#ff9800" : "var(--gold)";
}

function updateStats() {
    const wrapper = document.getElementById("statsWrapper");
    wrapper.innerHTML = "";
    const contractorMode = activeContractorFilter && activeContractorFilter.size > 0;

    let grandTotal = 0, grandDone = 0, cardCount = 0;

    if (contractorMode) {
        /* ── وضع فلتر المقاول: كارت لكل مقاول/شيت ── */
        const bySheet = {};
        [...activeContractorFilter].forEach(key => {
            const pipeIdx = key.indexOf('|');
            const sid   = key.slice(0, pipeIdx);
            const cname = key.slice(pipeIdx + 1);
            if (!bySheet[sid]) bySheet[sid] = [];
            bySheet[sid].push(cname);
        });

        Object.entries(bySheet).forEach(([sid, contractors]) => {
            if (!allData[sid]) return;
            let subLabel = sid, catLabel = "";
            categories.forEach(cat => {
                cat.subitems.forEach(sub => {
                    if (sub.sheetId === sid) { subLabel = sub.name; catLabel = cat.emoji + " " + cat.name; }
                });
            });
            let total = 0, done = 0;
            const cLow = contractors.map(c => c.toLowerCase());
            Object.values(allData[sid]).forEach(row => {
                const st = (row["STATUS"] || "").trim().toLowerCase();
                if (!selectedStatuses.some(s => s.toLowerCase() === st)) return;
                if (!cLow.includes((row["CONTRACTOR"] || "").trim().toLowerCase())) return;
                total += parseNum(row["TOTAL-QTY"]);
                done  += parseNum(row["DONE-QTY"]);
            });
            const title = contractors.length === 1
                ? ("👷 " + contractors[0])
                : ("👷 " + contractors.length + " مقاولين");
            wrapper.appendChild(makeStatCard(title, catLabel + " ← " + subLabel, total, done));
            grandTotal += total; grandDone += done; cardCount++;
        });

        if (cardCount > 1) {
            wrapper.appendChild(makeStatCard("📊 الإجمالي الكلي", "مجموع المقاولين المحددين", grandTotal, grandDone, true));
        }

    } else {
        /* ── الوضع العادي: الترتيب: مقاولون → معدات → إجماليات البنود → الإجمالي الكلي ── */

        // 1. اجمع كل البيانات اللازمة أولاً
        const activeSheetIds = [];
        const catCards = []; // {el, total, done}

        categories.forEach(cat => {
            const activeSubs = cat.subitems.filter(s => selectedItems[s.id] && allData[s.sheetId]);
            if (!activeSubs.length) return;
            let catTotal = 0, catDone = 0;

            activeSubs.forEach(sub => {
                const { total, done } = calcSubTotals(sub);
                catTotal += total; catDone += done;
                activeSheetIds.push(sub.sheetId);
            });
            catCards.push({
                el: makeStatCard(
                    cat.emoji + " " + cat.name,
                    activeSubs.map(s => s.name).join(" + "),
                    catTotal, catDone
                ),
                total: catTotal,
                done: catDone
            });
            grandTotal += catTotal; grandDone += catDone; cardCount++;
        });

        // 2. أنشئ اسم البند
        const activeNames = categories.flatMap(c => c.subitems)
            .filter(s => selectedItems[s.id])
            .map(s => s.name.trim());
        const subLabel = [...new Set(activeNames)].join(' و ') || "البند المحدد";

        // 3. أضف كارت المقاولين أولاً
        if (activeSheetIds.length) {
            const cCard = makeContractorsCard(activeSheetIds, subLabel);
            if (cCard) wrapper.appendChild(cCard);
        }

        // 4. أضف كارت المعدات ثانياً
        if (activeSheetIds.length) {
            const eCard = makeEquipmentCard(activeSheetIds, subLabel);
            if (eCard) wrapper.appendChild(eCard);
        }

        // 5. أضف كروت إجماليات البنود
        catCards.forEach(c => wrapper.appendChild(c.el));

        // 6. أضف الإجمالي الكلي أخيراً إن وُجد أكثر من بند
        if (cardCount > 1) {
            wrapper.appendChild(makeStatCard("📊 الإجمالي الكلي", "مجموع جميع البنود", grandTotal, grandDone, true));
        }
    }

    // Progress ring
    updateProgressRing(grandTotal, grandDone);

    sessionStorage.setItem("selectedStatuses", JSON.stringify(selectedStatuses));
    sessionStorage.setItem("selectedItems",    JSON.stringify(selectedItems));
    sessionStorage.setItem("sessionTime",      Date.now().toString());
}

/* ====================================================
   NAV TABS (top navigation tabs per category)
   ==================================================== */

/* ── بناء قوائم البنود — يُستدعى مرة واحدة أو عند تغيير هيكل الكاتيغوريز ── */
function buildNavTabs() {
    const tabsEl = document.getElementById("navTabs");
    document.querySelectorAll('.bunood-sub-flyout').forEach(el => el.remove());
    const oldMainDd = document.getElementById('bunoodMainDd');
    if (oldMainDd) oldMainDd.remove();
    tabsEl.innerHTML = "";

    if (!categories.length) return;

    const tab = document.createElement("div");
    tab.className = "nav-tab nav-tab-bunood";
    tab.id = "navTabBunood";
    tab.innerHTML = `<span>📋 البنود</span>`;
    tabsEl.appendChild(tab);

    const mainDd = document.createElement("div");
    mainDd.className = "tab-sub-dropdown bunood-main-dd";
    mainDd.id = "bunoodMainDd";
    document.body.appendChild(mainDd);

    categories.forEach(cat => {
        const catRow = document.createElement("div");
        catRow.className = "bunood-cat-row";
        catRow.dataset.catId = cat.id;
        catRow.innerHTML = `
            <span class="bunood-cat-label">${cat.emoji} ${cat.number ? '<span style="font-size:9px;opacity:0.65;margin-left:3px;">['+cat.number+']</span>' : ''} ${cat.name}</span>
            <span class="bunood-cat-arrow">&#x25B6;</span>`;

        const subDd = document.createElement("div");
        subDd.className = "bunood-sub-flyout";
        subDd.id = "bunoodSub_" + cat.id;
        document.body.appendChild(subDd);

        if (cat.subitems.length) {
            cat.subitems.forEach(sub => {
                const subRow = document.createElement("div");
                subRow.className = "tab-sub-item bunood-sub-item";
                subRow.innerHTML = `
                    <input type="checkbox" id="tabcb_${sub.id}"
                        data-sub-id="${sub.id}"
                        data-cat-id="${cat.id}"
                        data-sheet="${sub.sheetId}"
                        data-geo="${sub.geoJsonFile}">
                    <label for="tabcb_${sub.id}">
                        ${sub.number ? `<span style="font-size:9px;opacity:0.6;margin-left:4px;">${sub.number}</span>` : ''}
                        ${sub.name}
                    </label>`;
                subRow.querySelector('input').addEventListener('change', function(e) {
                    e.stopPropagation();
                    handleSubitemToggle(this.dataset.catId, this.dataset.subId, this.dataset.sheet, this.dataset.geo, this.checked);
                });
                subDd.appendChild(subRow);
            });
        } else {
            subDd.innerHTML = '<div style="padding:10px 14px;color:#aaa;font-size:11px;text-align:right">لا توجد بنود فرعية</div>';
        }

        catRow.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = catRow.classList.contains('bunood-cat-open');
            document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
            mainDd.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
            if (!isOpen) {
                catRow.classList.add('bunood-cat-open');
                const catRect  = catRow.getBoundingClientRect();
                const mainRect = mainDd.getBoundingClientRect();
                subDd.style.display = 'flex';
                subDd.style.top = catRect.top + 'px';
                const subW = 230;
                const spaceRight = window.innerWidth - mainRect.right;
                if (spaceRight >= subW) {
                    subDd.style.left  = mainRect.right + 'px';
                    subDd.style.right = 'auto';
                } else {
                    subDd.style.right = (window.innerWidth - mainRect.left) + 'px';
                    subDd.style.left  = 'auto';
                }
            }
        });

        subDd.addEventListener('click', e => e.stopPropagation());
        mainDd.appendChild(catRow);
    });

    tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mainDd.style.display === 'flex';
        document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
        mainDd.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
        if (isOpen) {
            mainDd.style.display = 'none';
        } else {
            const rect = tab.getBoundingClientRect();
            mainDd.style.left  = rect.left + 'px';
            mainDd.style.right = 'auto';
            mainDd.style.display = 'flex';
            setTimeout(() => {
                const ddRect = mainDd.getBoundingClientRect();
                if (ddRect.right > window.innerWidth - 8) {
                    mainDd.style.left = 'auto';
                    mainDd.style.right = (window.innerWidth - rect.right) + 'px';
                }
            }, 0);
        }
    });

    mainDd.addEventListener('click', e => e.stopPropagation());

    // مستمع إغلاق عند الكليك خارج — مرة واحدة فقط
    if (!window._bunoodClickListenerAdded) {
        window._bunoodClickListenerAdded = true;
        document.addEventListener('click', () => {
            const md = document.getElementById('bunoodMainDd');
            if (md) md.style.display = 'none';
            document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
            document.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
        });
    }

    // تحديث الحالة بعد البناء
    updateNavTabsState();
}

/* ── تحديث الشيك بوكسات والألوان فقط بدون إعادة بناء ── */
function updateNavTabsState() {
    const tab = document.getElementById('navTabBunood');
    if (!tab) return;

    const hasAnyActive = categories.some(cat => cat.subitems.some(s => selectedItems[s.id]));
    tab.classList.toggle('active', hasAnyActive);

    categories.forEach(cat => {
        const catHasActive = cat.subitems.some(s => selectedItems[s.id]);
        const catRow = document.querySelector(`.bunood-cat-row[data-cat-id="${cat.id}"]`);
        if (catRow) catRow.classList.toggle('bunood-cat-active', catHasActive);

        cat.subitems.forEach(sub => {
            const cb = document.getElementById('tabcb_' + sub.id);
            if (cb) cb.checked = !!selectedItems[sub.id];
        });
    });
}

/* ── renderNavTabs: إعادة بناء كاملة فقط عند تغيير هيكل الكاتيغوريز ── */
function renderNavTabs() {
    buildNavTabs();
}

/* ONE SUBITEM GLOBALLY — but allow subitems in the SAME similar-group to coexist.
   Subitems from different groups (or ungrouped) cannot be selected together. */
function handleSubitemToggle(catId, subId, sheetId, geoFile, checked) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    if (checked) {
        // ── Determine the group of the subitem being selected ──
        const myGroup = getGroupForSub(subId);

        // ── Check conflict with currently selected items ──
        const alreadySelected = Object.keys(selectedItems);
        let conflict = false;

        for (const selId of alreadySelected) {
            if (selId === subId) continue;
            const selGroup = getGroupForSub(selId);

            // Conflict: one is grouped + other is in different group, or one is ungrouped
            if (!myGroup || !selGroup || myGroup.id !== selGroup.id) {
                conflict = true;
                break;
            }
        }

        if (conflict) {
            // Deselect everything and start fresh with this subitem
            // But first ask implicitly by clearing others and selecting this one
            const allSubItems = categories.flatMap(c => c.subitems);
            Object.keys(selectedItems).forEach(selSubId => {
                if (selSubId === subId) return;
                const selSub = allSubItems.find(s => s.id === selSubId);
                if (!selSub) { delete selectedItems[selSubId]; return; }
                loadTokens[selSub.sheetId] = null;
                if (allLayers[selSub.sheetId]) { map.removeLayer(allLayers[selSub.sheetId]); delete allLayers[selSub.sheetId]; }
                delete allData[selSub.sheetId];
                delete selectedItems[selSubId];
            });
        }

        // 1. وقف أي فلتر مقاول نشط
        if (activeContractorFilter.size > 0) {
            const contractorSheets = new Set([...activeContractorFilter].map(k => k.split('|')[0]));
            activeContractorFilter.clear();
            contractorSheets.forEach(sid => {
                const usedBySidebar = categories.flatMap(c => c.subitems)
                    .some(s => s.sheetId === sid && selectedItems[s.id]);
                if (!usedBySidebar) {
                    loadTokens[sid] = null;
                    if (allLayers[sid]) { map.removeLayer(allLayers[sid]); delete allLayers[sid]; }
                    delete allData[sid];
                }
            });
        }

        // 2. اختر هذا البند وحمل طبقته
        selectedItems[subId] = true;
        const sub = cat.subitems.find(s => s.id === subId);
        if (sub) loadLayer(sheetId, sub.name, geoFile, catId);

    } else {
        delete selectedItems[subId];
        removeLayer(sheetId);
        refreshLayerColors();
    }

    renderItems();
    updateNavTabsState();
    updateStats();
    syncContractorCheckboxes();
}

/* ====================================================
   RENDER SIDEBAR ITEMS
   ==================================================== */

function renderItems() {
    const section = document.getElementById("itemsSection");
    section.innerHTML = "";
    const isAdmin = currentUser && currentUser.isAdmin;

    categories.forEach(cat => {
        const div = document.createElement("div");
        div.className = "sidebar-section";
        div.dataset.catId = cat.id;

        // عنوان البند الرئيسي: رقم البند + الاسم
        const catLabel = (cat.number ? `<span style="font-size:9px;opacity:0.7;margin-left:3px;background:rgba(255,255,255,0.15);padding:1px 5px;border-radius:4px;">${cat.number}</span>` : '') + cat.emoji + ' ' + cat.name;

        div.innerHTML = `
            <div class="section-title">
                <button class="expand-btn" data-cat="${cat.id}">+</button>
                <span class="section-title-text">${catLabel}</span>
                ${isAdmin ? `<button class="del-cat-btn admin-only" onclick="deleteCategory('${cat.id}')">✕</button>` : ""}
            </div>
            <div class="dropdown-items" data-cat="${cat.id}">
                ${cat.subitems.map(sub => {
                    // رقم البند الفرعي
                    const numBadge = sub.number
                        ? `<span style="font-size:9px;font-weight:700;color:var(--purple);background:rgba(106,45,145,0.1);padding:1px 5px;border-radius:4px;flex-shrink:0;border:1px solid rgba(106,45,145,0.2);">${sub.number}</span>`
                        : '';
                    // مؤشر بيانات مفقودة (شيت أو geo فارغ)
                    const missingData = !sub.sheetId || !sub.geoJsonFile;
                    const warningIcon = (isAdmin && missingData)
                        ? `<span title="بيانات مفقودة — دبل كليك للتعديل" style="color:#ff9800;font-size:11px;flex-shrink:0;">⚠️</span>`
                        : '';
                    return `
                    <div class="dropdown-item ${selectedItems[sub.id]?'selected':''}" data-sub="${sub.id}"
                         ${isAdmin ? `title="دبل كليك لتعديل البند"` : ''}>
                        <input type="checkbox" class="subitem-cb"
                            data-sub-id="${sub.id}"
                            data-cat-id="${cat.id}"
                            data-sheet="${sub.sheetId}"
                            data-geo="${sub.geoJsonFile}"
                            ${selectedItems[sub.id]?'checked':''}>
                        ${numBadge}
                        <label style="flex:1">${sub.name}</label>
                        ${warningIcon}
                        ${isAdmin ? `<button class="del-sub-btn admin-only" onclick="deleteSubitem('${cat.id}','${sub.id}')">✕</button>` : ""}
                    </div>`;
                }).join('')}
                ${isAdmin ? `<div class="add-sub-row admin-only" onclick="openAddSubitemModalFor('${cat.id}')">+ إضافة فرعي</div>` : ""}
            </div>`;

        section.appendChild(div);

        div.querySelector(".expand-btn").addEventListener("click", function() {
            this.classList.toggle("active");
            div.querySelector(".dropdown-items").classList.toggle("active");
        });

        div.querySelectorAll(".subitem-cb").forEach(cb => {
            cb.addEventListener("change", function() {
                handleSubitemToggle(this.dataset.catId, this.dataset.subId, this.dataset.sheet, this.dataset.geo, this.checked);
            });
        });

        // دبل كليك على البند الفرعي — للأدمن فقط
        if (isAdmin) {
            div.querySelectorAll(".dropdown-item[data-sub]").forEach(item => {
                item.addEventListener("dblclick", function(e) {
                    // تجاهل الدبل كليك على الأزرار
                    if (e.target.closest('.del-sub-btn') || e.target.closest('.subitem-cb')) return;
                    const subId = this.dataset.sub;
                    openEditSubitemModal(cat.id, subId);
                });
            });
        }
    });

    // Update modal select
    const sel = document.getElementById("inSubCat");
    if (sel) {
        sel.innerHTML = '<option value="">-- اختر --</option>';
        categories.forEach(c => {
            const o = document.createElement("option");
            o.value = c.id;
            o.textContent = (c.number ? `[${c.number}] ` : '') + c.name;
            sel.appendChild(o);
        });
    }
}

/* ====================================================
   ADD / DELETE — ADMIN ONLY
   ==================================================== */

function openAddCategoryModal() {
    document.getElementById("inCatNumber").value = "";
    document.getElementById("inCatName").value  = "";
    document.getElementById("inCatEmoji").value = "📍";
    openModal("modalAddCategory");
}

function addCategory() {
    const number = document.getElementById("inCatNumber").value.trim();
    const name   = document.getElementById("inCatName").value.trim();
    const emoji  = document.getElementById("inCatEmoji").value.trim() || "📍";
    if (!name) { showAlert("❌ يرجى إدخال اسم البند"); return; }
    categories.push({ id: uid(), number, name, emoji, subitems: [] });
    renderItems();
    renderNavTabs();
    closeModal("modalAddCategory");
    showAlert("✅ تمت إضافة البند الرئيسي", "success");
}

let _addSubForCat = null;

function openAddSubitemModal() {
    _addSubForCat = null;
    document.getElementById("inSubNumber").value = "";
    document.getElementById("inSubName").value  = "";
    document.getElementById("inSubSheet").value = "";
    document.getElementById("inSubGeo").value   = "";
    document.getElementById("inSubCat").value   = "";
    openModal("modalAddSubitem");
}

function openAddSubitemModalFor(catId) {
    _addSubForCat = catId;
    document.getElementById("inSubNumber").value = "";
    document.getElementById("inSubName").value  = "";
    document.getElementById("inSubSheet").value = "";
    document.getElementById("inSubGeo").value   = "";
    document.getElementById("inSubCat").value   = catId;
    openModal("modalAddSubitem");
}

function addSubitem() {
    const catId    = document.getElementById("inSubCat").value || _addSubForCat;
    const number   = document.getElementById("inSubNumber").value.trim();
    const name     = document.getElementById("inSubName").value.trim();
    const sheetRaw = document.getElementById("inSubSheet").value.trim();
    const geo      = document.getElementById("inSubGeo").value.trim();
    if (!catId || !name) { showAlert("❌ يرجى اختيار البند الرئيسي وإدخال الاسم"); return; }

    const cat = categories.find(c => c.id === catId);
    if (!cat) { showAlert("❌ البند غير موجود"); return; }

    // الشيت والـ GeoJSON اختياريان — يمكن إضافتهما لاحقاً عبر دبل كليك
    const sheetId = sheetRaw ? (sheetIdFromUrl(sheetRaw) || sheetRaw) : "";

    cat.subitems.push({ id: uid(), number, name, sheetId, geoJsonFile: geo });
    renderItems();
    renderNavTabs();
    closeModal("modalAddSubitem");
    showAlert("✅ تمت إضافة البند الفرعي" + (!sheetId || !geo ? " — أضف الشيت والـ GeoJSON لاحقاً بدبل كليك" : ""), "success");
}

function deleteCategory(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    if (!confirm(`حذف "${cat.name}" وجميع بنوده الفرعية؟`)) return;
    cat.subitems.forEach(sub => { delete selectedItems[sub.id]; removeLayer(sub.sheetId); });
    categories = categories.filter(c => c.id !== catId);
    renderItems();
    renderNavTabs();
    updateStats();
    showAlert("✅ تم الحذف", "success");
}

function deleteSubitem(catId, subId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;
    if (!confirm(`حذف "${sub.name}"؟`)) return;
    delete selectedItems[subId];
    removeLayer(sub.sheetId);
    cat.subitems = cat.subitems.filter(s => s.id !== subId);
    renderItems();
    renderNavTabs();
    updateStats();
    showAlert("✅ تم الحذف", "success");
}

/* ====================================================
   EDIT SUBITEM (double-click — admin only)
   ==================================================== */

function openEditSubitemModal(catId, subId) {
    if (!currentUser || !currentUser.isAdmin) return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;

    document.getElementById("editSubCatId").value  = catId;
    document.getElementById("editSubId").value     = subId;
    document.getElementById("editSubNumber").value = sub.number || "";
    document.getElementById("editSubName").value   = sub.name   || "";
    document.getElementById("editSubGeo").value    = sub.geoJsonFile || "";
    const scriptInp = document.getElementById("editSubScriptUrl");
    if (scriptInp) scriptInp.value = sub.scriptUrl || "";

    // Sheet: show full URL if sheetId looks like an ID, else show as-is
    const sheetVal = sub.sheetId || "";
    const sheetUrl = sheetVal.startsWith('http')
        ? sheetVal
        : `https://docs.google.com/spreadsheets/d/${sheetVal}`;
    document.getElementById("editSubSheet").value = sheetUrl;

    // Show "فتح الشيت" link
    const linkEl = document.getElementById("editSubSheetLink");
    if (sheetVal) {
        linkEl.href = sheetUrl;
        linkEl.style.display = "inline-flex";
        linkEl.style.alignItems = "center";
        linkEl.style.gap = "4px";
    } else {
        linkEl.style.display = "none";
    }

    // Update link when URL changes
    document.getElementById("editSubSheet").oninput = function() {
        const v = this.value.trim();
        const id = sheetIdFromUrl(v) || v;
        if (id) {
            linkEl.href = v.startsWith('http') ? v : `https://docs.google.com/spreadsheets/d/${id}`;
            linkEl.style.display = "inline-flex";
            linkEl.style.alignItems = "center";
            linkEl.style.gap = "4px";
        } else {
            linkEl.style.display = "none";
        }
    };

    openModal("modalEditSubitem");
}

function saveSubitemEdit() {
    const catId    = document.getElementById("editSubCatId").value;
    const subId    = document.getElementById("editSubId").value;
    const number   = document.getElementById("editSubNumber").value.trim();
    const name     = document.getElementById("editSubName").value.trim();
    const sheetRaw = document.getElementById("editSubSheet").value.trim();
    const geo      = document.getElementById("editSubGeo").value.trim();
    const scriptInp = document.getElementById("editSubScriptUrl");
    const scriptUrl = scriptInp ? scriptInp.value.trim() : "";

    if (!name || !sheetRaw || !geo) { showAlert("❌ يرجى ملء الاسم والشيت والـ GeoJSON"); return; }

    const sheetId = sheetIdFromUrl(sheetRaw) || sheetRaw;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;

    const oldSheetId = sub.sheetId;
    const sheetChanged = oldSheetId !== sheetId;
    const geoChanged = sub.geoJsonFile !== geo;

    sub.number      = number;
    sub.name        = name;
    sub.sheetId     = sheetId;
    sub.geoJsonFile = geo;
    sub.scriptUrl   = scriptUrl;

    // إذا تغير الشيت أو الـ GeoJSON وكانت الطبقة محملة، أعد تحميلها
    if ((sheetChanged || geoChanged) && selectedItems[subId]) {
        loadTokens[oldSheetId] = null;
        if (allLayers[oldSheetId]) { map.removeLayer(allLayers[oldSheetId]); delete allLayers[oldSheetId]; }
        delete allData[oldSheetId];
        loadLayer(sheetId, name, geo, catId);
    }

    renderItems();
    renderNavTabs();
    closeModal("modalEditSubitem");
    showAlert("✅ تم حفظ التعديلات", "success");
}

/* ====================================================
   STATUS LEGEND CHECKBOXES
   ==================================================== */

document.querySelectorAll(".status-checkbox").forEach(cb => {
    cb.addEventListener("change", function() {
        const st = this.dataset.status;
        if (this.checked) { if (!selectedStatuses.includes(st)) selectedStatuses.push(st); }
        else              { selectedStatuses = selectedStatuses.filter(s => s !== st); }
        refreshLayerColors();
        updateStats();
    });
});

/* ====================================================
   SEARCH — no zoom, use defaultCoords, flash + popup
   ==================================================== */

function positionDropdown() {
    const dd  = document.getElementById("searchDropdown");
    const box = document.querySelector(".search-wrap");
    if (!box || !dd.classList.contains("active")) return;
    const r = box.getBoundingClientRect();
    dd.style.top   = r.bottom + "px";
    dd.style.left  = r.left   + "px";
    dd.style.width = r.width  + "px";
    dd.style.right = "auto";
}

function updateSearchDropdown() {
    const dd    = document.getElementById("searchDropdown");
    const input = document.getElementById("searchInput");
    const q     = input.value.trim().toLowerCase();
    dd.innerHTML = "";

    if (!q) { dd.classList.remove("active"); return; }

    const results = [];
    Object.entries(allData).forEach(([sheetId, data]) => {
        Object.values(data).forEach(row => {
            const name = (row["ROAD NAME"]||row["BLOCK NAME"]||row["NAME"]||"").trim().toLowerCase();
            if (name.includes(q)) {
                const dispName = row["ROAD NAME"]||row["BLOCK NAME"]||row["NAME"]||"بدون اسم";
                results.push({ name: dispName, status: row["STATUS"]||"", key: `${sheetId}-${dispName}` });
            }
        });
    });

    if (!results.length) {
        dd.innerHTML = "<div style='padding:10px;text-align:right;color:#999;font-size:12px'>لا توجد نتائج</div>";
    } else {
        results.forEach(item => {
            const el = document.createElement("div");
            el.className = "search-item";
            el.innerHTML = `
                <span class="search-badge" style="background:${statusColor(item.status)}">${item.status||"-"}</span>
                <div class="search-item-name">${item.name}</div>`;
            el.addEventListener("click", () => {
                const layer = allFeatures[item.key];
                if (layer) {
                    // Use default coords zoom (no fitBounds)
                    if (map && defaultCoords) {
                        map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
                    }
                    // Flash the layer then open popup
                    setTimeout(() => {
                        flashLayer(layer);
                        setTimeout(() => layer.openPopup(), 700);
                    }, 100);
                }
                input.value = "";
                dd.classList.remove("active");
            });
            dd.appendChild(el);
        });
    }

    dd.classList.add("active");
    positionDropdown();
}



/* ====================================================
   CLOSE MODALS ON BACKDROP CLICK
   ==================================================== */

/* ====================================================
   DRAG & DROP — ADMIN ONLY
   Supports: Nav Tabs (categories), Sidebar Items (subitems within cat), Status Legend,
             Nav-Right Icons (contractors, equipment, notifications, themes, coords, user)
   ==================================================== */

/* ── CSS for drag states (injected once) ── */
(function injectDragCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Drag handle indicator for admin */
        body.is-admin .nav-tab          { cursor: grab; }
        body.is-admin .sidebar-section  { cursor: grab; }
        body.is-admin .dropdown-item    { cursor: grab; }
        body.is-admin .legend-item      { cursor: grab; }
        body.is-admin .nav-right > div  { cursor: grab; }

        .drag-dragging {
            opacity: 0.38;
            transform: scale(0.97);
            transition: opacity 0.15s, transform 0.15s;
        }
        .drag-over-top {
            border-top: 2.5px solid var(--gold) !important;
        }
        .drag-over-bottom {
            border-bottom: 2.5px solid var(--gold) !important;
        }
        .drag-over-left {
            border-left: 2.5px solid var(--gold) !important;
        }
        .drag-over-right {
            border-right: 2.5px solid var(--gold) !important;
        }
        .drag-ghost {
            position: fixed;
            z-index: 999999;
            pointer-events: none;
            background: var(--white, white);
            border: 2px solid var(--gold, #f5c842);
            border-radius: 8px;
            padding: 6px 14px;
            font-family: 'Cairo', sans-serif;
            font-size: 12px;
            font-weight: 700;
            color: var(--text, #2a1a40);
            box-shadow: 0 8px 28px rgba(0,0,0,0.25);
            white-space: nowrap;
            max-width: 240px;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.92;
        }
        /* Drag handle icon shown on hover for admin */
        body.is-admin .nav-tab::before,
        body.is-admin .sidebar-section > .section-title::before,
        body.is-admin .dropdown-item::before,
        body.is-admin .legend-item::before,
        body.is-admin .nav-right > div > .nav-icon-btn::before,
        body.is-admin .nav-right > div > .user-chip::before {
            content: '⠿';
            font-size: 13px;
            opacity: 0;
            transition: opacity 0.2s;
            margin-left: 4px;
            color: var(--gold, #f5c842);
            flex-shrink: 0;
        }
        body.is-admin .nav-tab:hover::before,
        body.is-admin .sidebar-section:hover > .section-title::before,
        body.is-admin .dropdown-item:hover::before,
        body.is-admin .legend-item:hover::before,
        body.is-admin .nav-right > div:hover > .nav-icon-btn::before,
        body.is-admin .nav-right > div:hover > .user-chip::before {
            opacity: 0.7;
        }
    `;
    document.head.appendChild(style);
})();

/* ── Ghost element ── */
let dragGhost = null;

function createGhost(text) {
    removeGhost();
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    dragGhost.textContent = text;
    document.body.appendChild(dragGhost);
}

function moveGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = (x + 16) + 'px';
    dragGhost.style.top  = (y + 10) + 'px';
}

function removeGhost() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
}

/* ── Generic drag-and-drop for an ordered list ──
   items: array of DOM elements
   getKey(el): returns unique key for the element
   onReorder(newOrder): called with new ordered keys array
   options: { silent: true/false, horizontal: true/false }
*/
function makeDraggable(items, getKey, onReorder, getLabel, options = {}) {
    if (!currentUser || !currentUser.isAdmin) return;

    const isHorizontal = options.horizontal || false;
    const silent = options.silent !== false; // default true

    let draggingEl   = null;
    let draggingKey  = null;
    let overEl       = null;
    let overPosition = null; // 'top' | 'bottom' | 'left' | 'right'

    function clearOver() {
        if (overEl) {
            overEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-left', 'drag-over-right');
            overEl = null;
        }
    }

    items.forEach(el => {
        el.draggable = true;

        el.addEventListener('dragstart', e => {
            draggingEl  = el;
            draggingKey = getKey(el);
            el.classList.add('drag-dragging');
            const label = getLabel ? getLabel(el) : (el.textContent.trim().slice(0, 30));
            createGhost(label);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(new Image(), 0, 0); // hide default ghost
        });

        el.addEventListener('drag', e => {
            if (e.clientX || e.clientY) moveGhost(e.clientX, e.clientY);
        });

        el.addEventListener('dragend', () => {
            draggingEl  = null;
            draggingKey = null;
            el.classList.remove('drag-dragging');
            clearOver();
            removeGhost();
        });

        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (el === draggingEl) return;
            const rect   = el.getBoundingClientRect();
            let newPos;
            if (isHorizontal) {
                const midX = rect.left + rect.width / 2;
                newPos = e.clientX < midX ? 'left' : 'right';
            } else {
                const midY = rect.top + rect.height / 2;
                newPos = e.clientY < midY ? 'top' : 'bottom';
            }
            if (overEl !== el || overPosition !== newPos) {
                clearOver();
                overEl       = el;
                overPosition = newPos;
                el.classList.add('drag-over-' + newPos);
            }
            e.dataTransfer.dropEffect = 'move';
        });

        el.addEventListener('dragleave', e => {
            if (!el.contains(e.relatedTarget)) clearOver();
        });

        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggingKey || el === draggingEl) { clearOver(); return; }
            const targetKey = getKey(el);
            clearOver();

            // Build new order
            const keys    = items.map(i => getKey(i));
            const fromIdx = keys.indexOf(draggingKey);
            const toIdx   = keys.indexOf(targetKey);
            if (fromIdx === -1 || toIdx === -1) return;

            const newKeys = [...keys];
            newKeys.splice(fromIdx, 1);

            let adjustedInsert;
            if (isHorizontal) {
                adjustedInsert = overPosition === 'left'
                    ? (fromIdx < toIdx ? toIdx - 1 : toIdx)
                    : (fromIdx < toIdx ? toIdx : toIdx + 1);
            } else {
                adjustedInsert = overPosition === 'top'
                    ? (fromIdx < toIdx ? toIdx - 1 : toIdx)
                    : (fromIdx < toIdx ? toIdx : toIdx + 1);
            }
            newKeys.splice(adjustedInsert, 0, draggingKey);

            onReorder(newKeys);
        });
    });
}

/* ── 2. SIDEBAR SECTIONS (category order, same as tabs) ── */
function initSidebarSectionsDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const section = document.getElementById('itemsSection');
    if (!section) return;

    const items = [...section.querySelectorAll('.sidebar-section')];
    makeDraggable(
        items,
        el => el.dataset.catId,
        newCatIds => {
            categories = newCatIds
                .map(id => categories.find(c => c.id === id))
                .filter(Boolean);
            renderItems();
            renderNavTabs();
            initSidebarSectionsDrag();
            initSubitemsDrag();
        },
        el => el.querySelector('.section-title-text')?.textContent.trim().slice(0, 40) || '',
        { silent: true }
    );
}

/* ── 3. SUBITEMS within each sidebar section ── */
function initSubitemsDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const section = document.getElementById('itemsSection');
    if (!section) return;

    section.querySelectorAll('.dropdown-items[data-cat]').forEach(container => {
        const catId  = container.dataset.cat;
        const cat    = categories.find(c => c.id === catId);
        if (!cat) return;

        const items = [...container.querySelectorAll('.dropdown-item[data-sub]')];
        if (items.length < 2) return;

        makeDraggable(
            items,
            el => el.dataset.sub,
            newSubIds => {
                cat.subitems = newSubIds
                    .map(id => cat.subitems.find(s => s.id === id))
                    .filter(Boolean);
                renderItems();
                renderNavTabs();
                initSidebarSectionsDrag();
                initSubitemsDrag();
            },
            el => el.querySelector('label')?.textContent.trim().slice(0, 40) || '',
            { silent: true }
        );
    });
}

/* ── 5. NAV-RIGHT GROUPS (Tools, Settings, User) ── */
function initNavRightDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    // Get all group containers (nav-right-group) and dividers
    const groups = [...navRight.querySelectorAll('.nav-right-group')];
    if (groups.length < 2) return;

    makeDraggable(
        groups,
        el => el.id || el.querySelector('.nav-icon-btn')?.id || 'group',
        newOrder => {
            // Reorder groups in DOM
            newOrder.forEach(id => {
                const el = groups.find(g => (g.id || '') === id);
                if (el) {
                    // Move divider before this group if exists
                    const prev = el.previousElementSibling;
                    if (prev && prev.classList.contains('nav-right-divider')) {
                        navRight.appendChild(prev);
                    }
                    navRight.appendChild(el);
                }
            });
        },
        el => {
            const firstBtn = el.querySelector('.nav-icon-btn');
            return firstBtn ? (firstBtn.title || firstBtn.id || 'مجموعة').slice(0, 40) : 'مجموعة';
        },
        { silent: true, horizontal: true }
    );

    // Also make individual buttons draggable WITHIN each group
    groups.forEach(group => {
        const items = [...group.querySelectorAll(':scope > div[position]')];
        if (items.length < 2) return;

        makeDraggable(
            items,
            el => {
                const btn = el.querySelector('.nav-icon-btn, .user-chip');
                return btn ? (btn.id || 'item') : 'item';
            },
            newOrder => {
                newOrder.forEach(key => {
                    const el = items.find(i => {
                        const btn = i.querySelector('.nav-icon-btn, .user-chip');
                        return btn && btn.id === key;
                    });
                    if (el) group.appendChild(el);
                });
            },
            el => {
                const btn = el.querySelector('.nav-icon-btn, .user-chip');
                return btn ? (btn.title || btn.id || 'عنصر').slice(0, 40) : 'عنصر';
            },
            { silent: true, horizontal: true }
        );
    });
}

/* ── Hook: patch renderItems and renderNavTabs to re-init drag after render ── */
const _origRenderItems = renderItems;
window.renderItems = function() {
    _origRenderItems();
    setTimeout(() => {
        initSidebarSectionsDrag();
        initSubitemsDrag();
    }, 50);
};

const _origRenderNavTabs = renderNavTabs;
window.renderNavTabs = function() {
    _origRenderNavTabs();
};

/* ── Legend drag removed per user request ── */

// Also hook enterApp to init all drag systems after login
const _afterEnterApp = () => {
    setTimeout(() => {
        initSidebarSectionsDrag();
        initSubitemsDrag();
        initNavRightDrag();
    }, 600);
};

// Patch enterApp by wrapping it
(function() {
    const orig = window.enterApp;
    window.enterApp = async function() {
        await orig.apply(this, arguments);
        _afterEnterApp();
    };
})();

/* ====================================================
   GROUPS DROPDOWN — تبويب مجموعات البنود
   ==================================================== */

function _getGroupSubIds(groupId) {
    if (!groupId) return [];
    if (groupId.startsWith('solo_')) {
        return [groupId.replace('solo_', '')];
    }
    const g = (similarGroups || []).find(function(x) { return x.id === groupId; });
    return g ? (g.subIds || []) : [];
}

function _getGroupName(groupId) {
    if (!groupId) return '';
    if (groupId.startsWith('solo_')) {
        const sid = groupId.replace('solo_', '');
        let name = '';
        (categories || []).forEach(function(cat) {
            const s = (cat.subitems || []).find(function(x) { return x.id === sid; });
            if (s) name = s.name;
        });
        return name;
    }
    const g = (similarGroups || []).find(function(x) { return x.id === groupId; });
    return g ? (g.name || 'مجموعة') : '';
}

window.toggleGroupsDropdown = function(e) {
    if (e) e.stopPropagation();
    // أغلق باقي الـ dropdowns
    ['reportsDropdown','addDropdown'].forEach(function(id) {
        const d = document.getElementById(id);
        if (d) d.style.display = 'none';
    });
    const bunoodDd = document.getElementById('bunoodMainDd');
    if (bunoodDd) bunoodDd.style.display = 'none';
    document.querySelectorAll('.bunood-sub-flyout').forEach(function(d) { d.style.display = 'none'; });

    const dd = document.getElementById('groupsDropdown');
    if (!dd) return;
    const isOpen = dd.style.display === 'flex';
    if (isOpen) { dd.style.display = 'none'; return; }

    _buildGroupsDropdownContent();

    // أظهر مؤقتاً لحساب الأبعاد
    dd.style.visibility = 'hidden';
    dd.style.display = 'flex';
    dd.style.flexDirection = 'column';
    dd.style.position = 'fixed';
    dd.style.zIndex = '99999';

    const triggerEl = e && e.currentTarget;
    if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        const ddW  = 280; // العرض المحدد
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;

        // الارتفاع المتاح
        const spaceBelow = vh - rect.bottom - 8;
        dd.style.maxHeight = Math.min(320, Math.max(160, spaceBelow)) + 'px';
        dd.style.overflowY = 'auto';
        dd.style.top = rect.bottom + 4 + 'px';

        if (vw <= 1024) {
            // موبايل: ممتد بين الجانبين
            dd.style.left  = '8px';
            dd.style.right = '8px';
            dd.style.width = 'auto';
        } else {
            dd.style.width = ddW + 'px';
            // هل يخرج من اليمين؟
            if (rect.left + ddW > vw - 8) {
                // اضبطه من اليمين
                dd.style.left  = 'auto';
                dd.style.right = (vw - rect.right) + 'px';
            } else {
                dd.style.left  = rect.left + 'px';
                dd.style.right = 'auto';
            }
        }
    }

    dd.style.visibility = 'visible';
};

window.closeGroupsDropdown = function() {
    const dd = document.getElementById('groupsDropdown');
    if (dd) dd.style.display = 'none';
};

function _buildGroupsDropdownContent() {
    const list = document.getElementById('groupsDropdownInner');
    if (!list) return;

    const groups = similarGroups || [];

    // البنود المنفردة (غير المُجمَّعة في أي مجموعة)
    const groupedSubIds = new Set(groups.flatMap(function(g) { return g.subIds || []; }));
    const soloSubs = [];
    (categories || []).forEach(function(cat) {
        (cat.subitems || []).forEach(function(sub) {
            if (!groupedSubIds.has(sub.id)) soloSubs.push({ sub: sub, cat: cat });
        });
    });

    if (!groups.length && !soloSubs.length) {
        list.innerHTML = '<div style="padding:20px 14px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;font-family:\'Cairo\',sans-serif;line-height:1.8;">لا توجد مجموعات بعد<br><span style="font-size:10px;">أضفها من ⚙️ الإعدادات ← البنود المتشابهة</span></div>';
        return;
    }

    let html = '';

    // زر إلغاء الفلتر النشط
    if (activeGroupFilter) {
        html += '<div onclick="clearGroupFilter()" style="padding:9px 14px;background:rgba(244,67,54,0.12);border-bottom:1px solid rgba(244,67,54,0.2);display:flex;align-items:center;gap:8px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(244,67,54,0.22)\'" onmouseout="this.style.background=\'rgba(244,67,54,0.12)\'">' +
            '<span style="font-size:13px;">✕</span>' +
            '<span style="font-size:12px;font-weight:700;color:#ff8a80;font-family:\'Cairo\',sans-serif;">إلغاء الفلتر الحالي</span>' +
            '</div>';
    }

    // ── المجموعات المُعرَّفة ──
    if (groups.length) {
        html += '<div style="padding:6px 14px 5px;font-size:9px;font-weight:900;color:rgba(255,255,255,0.35);letter-spacing:.8px;font-family:\'Cairo\',sans-serif;border-bottom:1px solid rgba(255,255,255,0.07);">📦 المجموعات</div>';
        groups.forEach(function(group) {
            const isActive = activeGroupFilter === group.id;
            const subCount = (group.subIds || []).length;

            html += '<div onclick="applyGroupFilter(\'' + group.id + '\')" style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:all 0.15s;background:' + (isActive ? 'rgba(245,200,66,0.12)' : 'transparent') + ';border-right:3px solid ' + (isActive ? '#f5c842' : 'transparent') + ';" onmouseover="this.style.background=\'rgba(245,200,66,0.08)\'" onmouseout="this.style.background=\'' + (isActive ? 'rgba(245,200,66,0.12)' : 'transparent') + '\'">' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:15px;flex-shrink:0;">' + (isActive ? '✅' : '🔗') + '</span>' +
                '<span style="flex:1;font-size:12px;font-weight:700;color:' + (isActive ? '#f5c842' : 'rgba(255,255,255,0.9)') + ';font-family:\'Cairo\',sans-serif;text-align:right;white-space:normal;word-break:break-word;line-height:1.5;">' + (group.name || 'مجموعة') + '</span>' +
                '<span style="flex-shrink:0;background:' + (isActive ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.08)') + ';border:1px solid ' + (isActive ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.15)') + ';color:' + (isActive ? '#f5c842' : 'rgba(255,255,255,0.55)') + ';font-size:9px;font-weight:900;padding:2px 7px;border-radius:10px;white-space:nowrap;font-family:\'Cairo\',sans-serif;">' + subCount + ' بند</span>' +
                '</div></div>';
        });
    }

    // ── البنود المنفردة ──
    if (soloSubs.length) {
        html += '<div style="padding:6px 14px 5px;font-size:9px;font-weight:900;color:rgba(255,255,255,0.35);letter-spacing:.8px;font-family:\'Cairo\',sans-serif;border-bottom:1px solid rgba(255,255,255,0.07);border-top:1px solid rgba(255,255,255,0.07);">📌 بنود منفردة</div>';
        soloSubs.forEach(function(item) {
            const soloId = 'solo_' + item.sub.id;
            const isActive = activeGroupFilter === soloId;
            html += '<div onclick="applyGroupFilter(\'' + soloId + '\')" style="padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:all 0.15s;background:' + (isActive ? 'rgba(106,45,145,0.18)' : 'transparent') + ';border-right:3px solid ' + (isActive ? 'var(--purple,#6a2d91)' : 'transparent') + ';" onmouseover="this.style.background=\'rgba(106,45,145,0.1)\'" onmouseout="this.style.background=\'' + (isActive ? 'rgba(106,45,145,0.18)' : 'transparent') + '\'">' +
                '<div style="display:flex;align-items:flex-start;gap:8px;">' +
                '<span style="font-size:14px;flex-shrink:0;margin-top:1px;">' + (isActive ? '✅' : item.cat.emoji) + '</span>' +
                '<span style="flex:1;font-size:12px;font-weight:700;color:' + (isActive ? '#c39bd3' : 'rgba(255,255,255,0.9)') + ';font-family:\'Cairo\',sans-serif;text-align:right;white-space:normal;word-break:break-word;line-height:1.55;">' + item.sub.name + '</span>' +
                (isActive ? '<span style="flex-shrink:0;font-size:9px;color:#c39bd3;font-weight:900;font-family:\'Cairo\',sans-serif;margin-top:2px;">●</span>' : '') +
                '</div></div>';
        });
    }

    list.innerHTML = html;
}

window.applyGroupFilter = function(groupId) {
    // نفس الفلتر = ألغِ
    if (activeGroupFilter === groupId) {
        clearGroupFilter();
        return;
    }

    activeGroupFilter = groupId;
    const subIds = _getGroupSubIds(groupId);
    if (!subIds.length) return;

    // ── أزل فلتر المقاولين النشط ──
    if (window.activeContractorFilter && window.activeContractorFilter.size > 0) {
        const cSheets = new Set([...window.activeContractorFilter].map(function(k) { return k.split('|')[0]; }));
        window.activeContractorFilter.clear();
        cSheets.forEach(function(sid) {
            loadTokens[sid] = null;
            if (allLayers[sid]) { map.removeLayer(allLayers[sid]); delete allLayers[sid]; }
            delete allData[sid];
        });
    }

    // ── أزل كل الاختيارات الحالية التي ليست ضمن المجموعة ──
    const allSubItems = (categories || []).flatMap(function(c) { return c.subitems || []; });
    Object.keys(selectedItems).forEach(function(selId) {
        if (!subIds.includes(selId)) {
            const selSub = allSubItems.find(function(s) { return s.id === selId; });
            if (selSub) {
                loadTokens[selSub.sheetId] = null;
                if (allLayers[selSub.sheetId]) { map.removeLayer(allLayers[selSub.sheetId]); delete allLayers[selSub.sheetId]; }
                delete allData[selSub.sheetId];
            }
            delete selectedItems[selId];
        }
    });

    // ── حمّل بنود المجموعة ──
    subIds.forEach(function(sid) {
        let foundSub = null, foundCat = null;
        (categories || []).forEach(function(cat) {
            (cat.subitems || []).forEach(function(sub) {
                if (sub.id === sid) { foundSub = sub; foundCat = cat; }
            });
        });
        if (!foundSub || !foundSub.sheetId || !foundSub.geoJsonFile) return;
        selectedItems[foundSub.id] = true;
        if (!allLayers[foundSub.sheetId]) {
            loadLayer(foundSub.sheetId, foundSub.name, foundSub.geoJsonFile, foundCat.id);
        }
    });

    // ── تحديث الواجهة ──
    renderItems();
    updateNavTabsState();
    updateStats();
    if (window.contractorsLoaded) renderContractorList && renderContractorList();

    closeGroupsDropdown();
    _updateGroupsTabState();

    showAlert('✅ تم تفعيل مجموعة: ' + _getGroupName(groupId), 'success');
};

window.clearGroupFilter = function() {
    activeGroupFilter = null;
    _updateGroupsTabState();
    _buildGroupsDropdownContent();
    closeGroupsDropdown();
    showAlert('✅ تم إلغاء فلتر المجموعة', 'success');
};

function _updateGroupsTabState() {
    const tab = document.getElementById('navTabGroups');
    if (!tab) return;

    // أزل/أضف البادج النشط
    const oldDot = tab.querySelector('.gf-active-dot');
    if (oldDot) oldDot.remove();

    if (activeGroupFilter) {
        tab.classList.add('active');
        const dot = document.createElement('span');
        dot.className = 'gf-active-dot';
        dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;background:#f5c842;margin-right:5px;flex-shrink:0;box-shadow:0 0 6px rgba(245,200,66,0.8);animation:gfPulse 1.5s ease-in-out infinite;vertical-align:middle;';
        tab.insertBefore(dot, tab.firstChild);
    } else {
        tab.classList.remove('active');
    }

    // تحديث بادج الموبايل
    const mmBadge = document.getElementById('mmGroupsBadge');
    if (mmBadge) {
        mmBadge.style.display = activeGroupFilter ? 'inline-block' : 'none';
        if (activeGroupFilter) mmBadge.textContent = '● نشط';
    }
}

// أنيميشن النقطة النابضة
(function _injectGroupFilterCSS() {
    if (document.getElementById('groupFilterCSS')) return;
    const s = document.createElement('style');
    s.id = 'groupFilterCSS';
    s.textContent = '@keyframes gfPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.55;transform:scale(1.4);}}';
    document.head.appendChild(s);
})();


/* ====================================================
   BOQ FORM (جدول الكميات)
   ==================================================== */
window._boqRevisedCount = 0;

window.openBOQFormModal = function () {
    const m = document.getElementById('boqFormModal');
    if (!m) return;
    // reset fields
    ['boqItemNo','boqUnit','boqDesc','boqPrice','boqContractQty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const list = document.getElementById('boqRevisedList');
    if (list) list.innerHTML = '';
    window._boqRevisedCount = 0;
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeBOQFormModal = function () {
    const m = document.getElementById('boqFormModal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
};

window.addBOQRevisedColumn = function () {
    const list = document.getElementById('boqRevisedList');
    if (!list) return;
    window._boqRevisedCount = (window._boqRevisedCount || 0) + 1;
    const idx = window._boqRevisedCount;
    const row = document.createElement('div');
    row.className = 'boq-rev-row';
    row.dataset.revIdx = String(idx);
    row.style.cssText = 'display:flex;gap:8px;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;';
    row.innerHTML = `
        <div style="font-size:12px;font-weight:800;color:#5cc890;font-family:'Cairo',sans-serif;white-space:nowrap;min-width:120px;">
            كمية جدول معدل ${idx}
        </div>
        <input type="number" step="any" class="settings-input boq-rev-qty"
               placeholder="الكمية" style="flex:1;">
        <button type="button" onclick="this.parentNode.remove()" title="حذف"
            style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:32px;height:32px;border-radius:7px;cursor:pointer;font-size:14px;">✕</button>
    `;
    list.appendChild(row);
};

window.submitBOQForm = async function () {
    const itemNo      = document.getElementById('boqItemNo')?.value.trim() || '';
    const desc        = document.getElementById('boqDesc')?.value.trim() || '';
    const unit        = document.getElementById('boqUnit')?.value.trim() || '';
    const price       = document.getElementById('boqPrice')?.value.trim() || '';
    const contractQty = document.getElementById('boqContractQty')?.value.trim() || '';

    if (!itemNo || !desc) {
        if (typeof showAlert === 'function') showAlert('⚠️ أدخل رقم البند والوصف', 'warning');
        else alert('أدخل رقم البند والوصف');
        return;
    }

    const revised = {};
    document.querySelectorAll('#boqRevisedList .boq-rev-row').forEach(row => {
        const idx = row.dataset.revIdx;
        const val = row.querySelector('.boq-rev-qty')?.value.trim() || '';
        if (val !== '') revised['revisedQty' + idx] = val;
    });

    const payload = {
        action      : 'addBOQ',
        itemNo      : itemNo,
        description : desc,
        unit        : unit,
        price       : price,
        contractQty : contractQty,
        ...revised,
        timestamp   : new Date().toISOString(),
        user        : (currentUser && currentUser.email) || ''
    };

    const url = (window.sheetIdsConfig && window.sheetIdsConfig['BOQ_SCRIPT_URL']) || window.BOQ_SCRIPT_URL || '';
    if (!url) {
        if (typeof showAlert === 'function') showAlert('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات أولاً', 'warning');
        else alert('أضف رابط سكريبت جدول الكميات في الإعدادات أولاً');
        return;
    }

    // مؤشر تحميل على زر الحفظ
    const saveBtn = document.querySelector('#boqFormModal [onclick*="submitBOQForm"]');
    const oldText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ جاري الحفظ...'; }

    try {
        const res = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            // text/plain يمنع preflight ويوصّل الـ body لـ Apps Script
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (_e) {
            throw new Error(
                'السكريبت رجّع استجابة غير صالحة. تأكد أن الـ Deploy:\n' +
                '• Execute as: Me\n' +
                '• Who has access: Anyone\n' +
                'وأنك عملت "New version" بعد آخر تعديل.\n\n' +
                'الاستجابة: ' + text.substring(0, 200)
            );
        }

        if (result && result.success) {
            if (typeof showAlert === 'function') showAlert('✅ ' + (result.message || 'تم الحفظ'), 'success');
            else alert(result.message || 'تم الحفظ');
            closeBOQFormModal();
        } else {
            const msg = '❌ فشل الحفظ: ' + (result?.message || 'خطأ غير معروف') + (result?.error ? '\n' + result.error : '');
            if (typeof showAlert === 'function') showAlert(msg, 'error');
            else alert(msg);
        }
    } catch (e) {
        const msg = '❌ خطأ في الاتصال بالسكريبت:\n' + e.message;
        if (typeof showAlert === 'function') showAlert(msg, 'error');
        else alert(msg);
        console.error('BOQ submit error:', e);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = oldText; }
    }
};

/* ====================================================
   SCHEDULE UI HANDLERS — ADDITION ONLY
   ==================================================== */
window.openScheduleFormModal = function () {
    const m = document.getElementById('scheduleFormModal');
    if (!m) {
        console.error('scheduleFormModal not found in DOM');
        (window.showAlert || alert)('شاشة البرنامج الزمني غير موجودة في index.html');
        return;
    }

    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const ib = document.getElementById('schedItemsBody');
    const pb = document.getElementById('schedPlanBody');

    if (ib && !ib.children.length) addScheduleItemRow();
    if (pb && !pb.children.length) addSchedulePlanRow();

    switchScheduleTab('items');
};

window.closeScheduleFormModal = function () {
    const m = document.getElementById('scheduleFormModal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
};

window.switchScheduleTab = function (tab) {
    const isItems = tab === 'items';

    const pItems = document.getElementById('schedPanelItems');
    const pPlan  = document.getElementById('schedPanelPlan');
    const bItems = document.getElementById('schedTabItemsBtn');
    const bPlan  = document.getElementById('schedTabPlanBtn');

    if (pItems) pItems.style.display = isItems ? '' : 'none';
    if (pPlan)  pPlan.style.display  = isItems ? 'none' : '';

    if (bItems) {
        bItems.style.background = isItems ? 'rgba(33,150,243,0.18)' : 'transparent';
        bItems.style.color = isItems ? '#90caf9' : 'rgba(255,255,255,0.6)';
    }
    if (bPlan) {
        bPlan.style.background = !isItems ? 'rgba(33,150,243,0.18)' : 'transparent';
        bPlan.style.color = !isItems ? '#90caf9' : 'rgba(255,255,255,0.6)';
    }
};

window.addScheduleItemRow = function () {
    const tb = document.getElementById('schedItemsBody');
    if (!tb) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input class="sch-item" type="text" placeholder="اسم البند" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff"></td>
        <td><input class="sch-start" type="date" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff"></td>
        <td><input class="sch-end" type="date" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff"></td>
        <td><button type="button" onclick="this.closest('tr').remove()" style="padding:6px 10px;border-radius:6px;border:0;background:#c0392b;color:#fff;cursor:pointer">✕</button></td>
    `;
    tb.appendChild(tr);
};

window.addSchedulePlanRow = function () {
    const tb = document.getElementById('schedPlanBody');
    if (!tb) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input class="sp-date" type="date" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff"></td>
        <td><input class="sp-val" type="number" step="0.01" placeholder="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff"></td>
        <td class="sp-cum">—</td>
        <td class="sp-pct">—</td>
        <td class="sp-cumpct">—</td>
        <td><button type="button" onclick="this.closest('tr').remove();recalcSchedulePlan();" style="padding:6px 10px;border-radius:6px;border:0;background:#c0392b;color:#fff;cursor:pointer">✕</button></td>
    `;
    tb.appendChild(tr);
    tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalcSchedulePlan));
};

window.recalcSchedulePlan = function () {
    if (!window.Schedule || typeof window.Schedule.processPlanTab !== 'function') {
        console.warn('SCHEDULE.js not loaded');
        return;
    }

    const rows = [...document.querySelectorAll('#schedPlanBody tr')];
    const raw = rows.map(r => ({
        date: r.querySelector('.sp-date')?.value || '',
        plannedValue: r.querySelector('.sp-val')?.value || 0
    }));

    const out = window.Schedule.processPlanTab(raw);
    const list = Array.isArray(out) ? out : (out.rows || []);
    const byDate = {};
    list.forEach(o => { byDate[o.date] = o; });

    rows.forEach(r => {
        const d = r.querySelector('.sp-date')?.value || '';
        const o = byDate[d];
        if (!o) return;

        const cumValue = o.cumValue ?? o.cumPlannedValue ?? 0;
        const cumPct   = o.cumPct ?? o.cumDailyPct ?? 0;

        const cumEl = r.querySelector('.sp-cum');
        const pctEl = r.querySelector('.sp-pct');
        const cpEl  = r.querySelector('.sp-cumpct');

        if (cumEl) cumEl.textContent = Number(cumValue).toLocaleString('en-US');
        if (pctEl) pctEl.textContent = Number(o.dailyPct || 0).toFixed(2) + '%';
        if (cpEl)  cpEl.textContent  = Number(cumPct || 0).toFixed(2) + '%';
    });
};

window.submitScheduleForm = async function () {
    const url = (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SCRIPT_URL)
             || window.SCHEDULE_SCRIPT_URL
             || localStorage.getItem('SCHEDULE_SCRIPT_URL')
             || '';

    if (!url) {
        (window.showAlert || alert)('⚠️ أضف رابط سكريبت البرنامج الزمني في الإعدادات أولاً');
        return;
    }

    const sheetId = (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SHEET_ID)
                 || window.SCHEDULE_SHEET_ID || '';

    const user = (window.currentUser && (window.currentUser.name || window.currentUser.email))
              || (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.email))
              || 'unknown';

    // 1) جمع البنود — أسماء الحقول مطابقة للـ Apps Script
    const items = [...document.querySelectorAll('#schedItemsBody tr')].map(r => ({
        item     : r.querySelector('.sch-item')?.value.trim() || '',
        startDate: r.querySelector('.sch-start')?.value || '',
        endDate  : r.querySelector('.sch-end')?.value || ''
    })).filter(x => x.item && x.startDate && x.endDate);

    // إعادة حساب الخطة قبل الإرسال
    recalcSchedulePlan();

    // 2) جمع صفوف الخطة — أسماء الحقول مطابقة للـ Apps Script
    const planRows = [...document.querySelectorAll('#schedPlanBody tr')].map(r => ({
        date            : r.querySelector('.sp-date')?.value || '',
        plannedValue    : Number(r.querySelector('.sp-val')?.value || 0),
        cumPlannedValue : Number((r.querySelector('.sp-cum')?.textContent || '0').replace(/,/g, '')) || 0,
        dailyPct        : parseFloat(r.querySelector('.sp-pct')?.textContent || '0') || 0,
        cumDailyPct     : parseFloat(r.querySelector('.sp-cumpct')?.textContent || '0') || 0
    })).filter(x => x.date);

    if (!items.length && !planRows.length) {
        (window.showAlert || alert)('⚠️ أضف بنداً واحداً على الأقل أو صف خطة');
        return;
    }

    // مؤشر تحميل على زر الحفظ
    const saveBtn = document.querySelector('#scheduleFormModal [onclick*="submitScheduleForm"]');
    const oldText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ جاري الحفظ...'; }

    // POST بدون mode:no-cors — text/plain يتفادى الـ preflight ويسمح بقراءة الرد
    const post = async (payload) => {
        const res = await fetch(url, {
            method  : 'POST',
            redirect: 'follow',
            headers : { 'Content-Type': 'text/plain;charset=utf-8' },
            body    : JSON.stringify({ ...payload, sheetId })
        });
        const text = await res.text();
        let result;
        try { result = JSON.parse(text); }
        catch (_e) {
            throw new Error(
                'السكريبت رجّع استجابة غير صالحة. تأكد أن الـ Deploy:\n' +
                '• Execute as: Me\n' +
                '• Who has access: Anyone\n' +
                'وأنك عملت "Manage deployments → New version" بعد آخر تعديل.\n\n' +
                'الاستجابة: ' + text.substring(0, 200)
            );
        }
        if (!result || !result.success) {
            throw new Error((result && (result.message || result.error)) || 'فشل غير معروف من السكريبت');
        }
        return result;
    };

    try {
        let savedItems = 0, savedRows = 0;
        for (const it of items) {
            await post({ action: 'addScheduleItem', ...it, user });
            savedItems++;
        }
        if (planRows.length) {
            const r = await post({ action: 'bulkSchedulePlan', rows: planRows, user });
            savedRows = planRows.length;
            console.log('Schedule plan saved:', r);
        }

        (window.showAlert || alert)(`✅ تم الحفظ: ${savedItems} بند و ${savedRows} يوم خطة`);
        closeScheduleFormModal();
    } catch (e) {
        console.error('Schedule submit error:', e);
        (window.showAlert || alert)('❌ فشل الحفظ: ' + e.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = oldText; }
    }
};

