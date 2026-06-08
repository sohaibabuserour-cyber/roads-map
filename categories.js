/* ============================================================
   categories.js
   البنود والكاتيغوريز — مُستخرَج من main.js

   الترتيب في index.html (بعد settings.js):
       <script src="settings.js"></script>
       <script src="categories.js"></script>

   المتغيرات والدوال التي يعتمد عليها من ملفات أخرى:
       CONFIG_FILE — config.js
       uid, sheetIdFromUrl, showAlert, openModal, closeModal — main.js
       defaultCoords, defaultSubNumber, similarGroups, selectedItems,
       selectedStatuses, applyTheme, renderItems, renderNavTabs,
       updateStats — main.js
       equipmentTypes, contractorsList, refreshEquipmentDatalist,
       renderEquipmentTypesList — settings.js
       map, allLayers, allData, loadTokens, loadLayer, removeLayer — map.js
       currentUser — auth.js
       activeContractorFilter — contractors.js (عند التشغيل)
   ============================================================ */

var categories = [];

/* ====================================================
   LOAD CONFIG
   ==================================================== */

async function loadCategoriesConfig() {
    try {
        const r = await fetch(CONFIG_FILE + "?t=" + Date.now());
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        categories = Array.isArray(data) ? data : (data.categories || []);
        if (!Array.isArray(data) && data.defaultCoords) {
            defaultCoords = data.defaultCoords;
            localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
        }
        if (!Array.isArray(data) && data.similarGroups) {
            similarGroups = data.similarGroups;
            localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
        }
        if (!Array.isArray(data) && data.defaultSubNumber !== undefined) {
            defaultSubNumber = data.defaultSubNumber || "";
            localStorage.setItem('defaultSubNumber', defaultSubNumber);
        }
        if (!Array.isArray(data) && data.equipmentTypes && Array.isArray(data.equipmentTypes)) {
            equipmentTypes = data.equipmentTypes;
        }
        if (!Array.isArray(data) && data.contractorsList && Array.isArray(data.contractorsList)) {
            contractorsList = data.contractorsList;
        }
        if (!Array.isArray(data) && data.sheetIdsConfig && typeof data.sheetIdsConfig === 'object') {
            if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
            Object.assign(window.sheetIdsConfig, data.sheetIdsConfig);
            localStorage.setItem('sheetIdsConfig', JSON.stringify(window.sheetIdsConfig));
            window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'] || '';
        }
    } catch(e) {
        console.warn("categories.json not found — starting empty");
        categories = [];
    }
    categories.forEach(c => { if (!c.subitems) c.subitems = []; if (!c.id) c.id = uid(); });
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
        sheetIdsConfig: window.sheetIdsConfig || {},
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
            if (!Array.isArray(data) && data.defaultCoords) {
                defaultCoords = data.defaultCoords;
                localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
                if (map) map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
            }
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
                if (data.sheetIdsConfig && typeof data.sheetIdsConfig === 'object') {
                    if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
                    Object.assign(window.sheetIdsConfig, data.sheetIdsConfig);
                    localStorage.setItem('sheetIdsConfig', JSON.stringify(window.sheetIdsConfig));
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

    const sheetVal = sub.sheetId || "";
    const sheetUrl = sheetVal.startsWith('http')
        ? sheetVal
        : `https://docs.google.com/spreadsheets/d/${sheetVal}`;
    document.getElementById("editSubSheet").value = sheetUrl;

    const linkEl = document.getElementById("editSubSheetLink");
    if (sheetVal) {
        linkEl.href = sheetUrl;
        linkEl.style.display = "inline-flex";
        linkEl.style.alignItems = "center";
        linkEl.style.gap = "4px";
    } else {
        linkEl.style.display = "none";
    }

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
