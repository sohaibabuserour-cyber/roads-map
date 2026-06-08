/* ============================================================
   settings.js
   منطق الإعدادات — مُستخرَج من main.js

   الترتيب في index.html (بعد main.js وقبل equipment_combined.js):
       <script src="main.js"></script>
       <script src="settings.js"></script>
       <script src="equipment_combined.js"></script>

   المتغيرات والدوال التي يعتمد عليها من ملفات أخرى:
       defaultCoords, defaultSubNumber, categories, similarGroups — main.js
       map — map.js
       showAlert — main.js
       renderSimilarGroupsList, renderDefaultSubPreview — main.js
       eqRefreshAllSelects — equipment_combined.js (عند التشغيل)
   ============================================================ */

var equipmentTypes  = [];
var contractorsList = [];

const DEFAULT_EQUIPMENT_TYPES = [
    "بوكلين", "بلدوزر", "جريدر", "رصاصة", "قلاب",
    "شيول", "تانك مياة", "فنشر أسفلت", "رصاصة كاوتش", "رصاصة أسفلت"
];

/* ====================================================
   SETTINGS MODAL
   ==================================================== */

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _fillSheetIdsInputs();
    switchSettingsTab('coords');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

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

    const scriptRaw = document.getElementById('sheetId_targetScript')?.value.trim() || '';
    if (scriptRaw) {
        window.sheetIdsConfig['TARGET_SCRIPT_URL'] = scriptRaw;
        window.TARGET_SCRIPT_URL = scriptRaw;
    } else {
        delete window.sheetIdsConfig['TARGET_SCRIPT_URL'];
        window.TARGET_SCRIPT_URL = '';
    }

    const boqScriptRaw = document.getElementById('sheetId_boqScript')?.value.trim() || '';
    if (boqScriptRaw) {
        window.sheetIdsConfig['BOQ_SCRIPT_URL'] = boqScriptRaw;
        window.BOQ_SCRIPT_URL = boqScriptRaw;
    } else {
        delete window.sheetIdsConfig['BOQ_SCRIPT_URL'];
        window.BOQ_SCRIPT_URL = '';
    }

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

(function _applySheetIdsOnLoad() {
    try {
        if (!window.sheetIdsConfig) window.sheetIdsConfig = {};
        const fresh  = JSON.parse(localStorage.getItem('sheetIdsConfig')   || '{}');
        const legacy = JSON.parse(localStorage.getItem('sheetIdsOverride') || '{}');
        const merged = Object.assign({}, legacy, fresh);
        Object.assign(window.sheetIdsConfig, merged);
        Object.entries(merged).forEach(([key, val]) => {
            if (val) window[key] = _extractSheetId ? _extractSheetId(val) : val;
        });
        if (window.sheetIdsConfig && window.sheetIdsConfig['BILLS_SHEET_ID']) {
            window.BILLS_SHEET_ID = window.sheetIdsConfig['BILLS_SHEET_ID'];
        }
    } catch(e) {}
})();

/* ====================================================
   SETTINGS PANEL TABS
   ==================================================== */

function switchSettingsTab(tab) {
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
    document.getElementById('settingsTabCoords')      && (document.getElementById('settingsTabCoords').style.display      = tab === 'coords'      ? 'block' : 'none');
    document.getElementById('settingsTabDefault')     && (document.getElementById('settingsTabDefault').style.display     = tab === 'default'     ? 'block' : 'none');
    document.getElementById('settingsTabSimilar')     && (document.getElementById('settingsTabSimilar').style.display     = tab === 'similar'     ? 'block' : 'none');
    document.getElementById('settingsTabEqtypes')     && (document.getElementById('settingsTabEqtypes').style.display     = tab === 'eqtypes'     ? 'block' : 'none');
    document.getElementById('settingsTabContractors') && (document.getElementById('settingsTabContractors').style.display = tab === 'contractors' ? 'block' : 'none');
    document.getElementById('settingsTabSheets')      && (document.getElementById('settingsTabSheets').style.display      = tab === 'sheets'      ? 'block' : 'none');
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

/* ====================================================
   EQUIPMENT TYPES — admin managed
   ==================================================== */

function renderEquipmentTypesList() {
    const container = document.getElementById('eqTypesList');
    if (!container) return;
    if (!equipmentTypes.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-soft);font-size:11px;padding:12px 0;">لا توجد أنواع معدات — أضف من الأعلى</div>';
        updateEqTypesCount();
        return;
    }
    container.innerHTML = equipmentTypes.map((name, idx) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(39,174,106,0.05);border:1px solid rgba(39,174,106,0.15);border-radius:7px;margin-bottom:5px;">
            <span style="flex:1;font-size:12px;font-weight:700;color:var(--text);text-align:right;font-family:'Cairo',sans-serif;">🚜 ${name}</span>
            <button onclick="removeEquipmentType(${idx})"
                style="background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.25);color:#e53935;width:24px;height:24px;border-radius:6px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(244,67,54,0.2)'"
                onmouseout="this.style.background='rgba(244,67,54,0.08)'">✕</button>
        </div>`).join('');
    updateEqTypesCount();
}

function updateEqTypesCount() {
    const el = document.getElementById('eqTypesCount');
    if (el) el.textContent = equipmentTypes.length ? `${equipmentTypes.length} نوع مسجل` : '';
}

function addEquipmentType() {
    const inp = document.getElementById('eqTypeNewInput');
    if (!inp) return;
    const name = inp.value.trim();
    if (!name) { showAlert('❌ أدخل اسم المعدة'); return; }
    if (equipmentTypes.includes(name)) { showAlert('⚠️ النوع موجود مسبقاً'); inp.value = ''; return; }
    equipmentTypes.push(name);
    inp.value = '';
    renderEquipmentTypesList();
    refreshEquipmentDatalist();
    showAlert('✅ تمت الإضافة', 'success');
}

function removeEquipmentType(idx) {
    equipmentTypes.splice(idx, 1);
    renderEquipmentTypesList();
    refreshEquipmentDatalist();
}

function importEquipmentTypesFromCSV() {
    const area = document.getElementById('eqTypesImportArea');
    if (!area) return;
    const lines = area.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    let added = 0;
    lines.forEach(name => {
        if (!equipmentTypes.includes(name)) { equipmentTypes.push(name); added++; }
    });
    area.value = '';
    renderEquipmentTypesList();
    refreshEquipmentDatalist();
    showAlert(`✅ تمت إضافة ${added} نوع`, 'success');
}

function resetEquipmentTypesToDefault() {
    if (!confirm('استعادة قائمة المعدات الافتراضية؟')) return;
    equipmentTypes = [...DEFAULT_EQUIPMENT_TYPES];
    renderEquipmentTypesList();
    refreshEquipmentDatalist();
    showAlert('✅ تمت الاستعادة', 'success');
}

function refreshEquipmentDatalist() {
    if (typeof eqRefreshAllSelects === 'function') eqRefreshAllSelects();
}

/* ====================================================
   CONTRACTORS LIST — admin managed (settings)
   ==================================================== */

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
