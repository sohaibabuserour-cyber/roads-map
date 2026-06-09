/* ====================================================
   CONSTANTS & STATE
   (الثوابت والـ URLs مُعرَّفة في config.js)
   ==================================================== */

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

// وحدات مُستخرجة: map.js | auth.js | settings.js | categories.js | stats.js
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

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem('mapTheme') || '';
    if (savedTheme) applyTheme(savedTheme);

    const dc = localStorage.getItem('defaultCoords');
    if (dc) {
        try { defaultCoords = JSON.parse(dc); } catch(e) {}
    }
});

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
    window.positionDropdown?.();
}



/* ====================================================
   DRAG & DROP — ADMIN ONLY
   Supports: Nav Tabs (categories), Sidebar Items (subitems within cat), Status Legend,
             Nav-Right Icons (contractors, equipment, notifications, themes, coords, user)
   ==================================================== */

/* Drag & drop styles: styles.css (DRAG & DROP section) */

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

// Hook enterApp to init drag systems after login
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

window.toggleGroupsMobilePanel = function() {
    if (typeof window.toggleGroupsDropdown === 'function') {
        window.toggleGroupsDropdown({
            stopPropagation: function() {},
            currentTarget: document.getElementById('mmGroupsRow')
        });
    }
};

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
   BOQ FORM (جدول الكميات) — frame مطابق للبرنامج الزمني
   ==================================================== */
window._boqEditRow = null;       // row being edited (from sheet)
window._boqItems   = [];         // existing BOQ items loaded from sheet
window._boqRevisedCount = 0;

function _boqScriptUrl() {
    return (window.sheetIdsConfig && window.sheetIdsConfig['BOQ_SCRIPT_URL'])
        || window.BOQ_SCRIPT_URL
        || localStorage.getItem('BOQ_SCRIPT_URL') || '';
}
function _boqSheetId() {
    let id = (window.sheetIdsConfig && window.sheetIdsConfig.BOQ_SHEET_ID)
          || window.BOQ_SHEET_ID || window.BILLS_SHEET_ID || '';
    if (id && /\/d\//.test(id)) {
        const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (m) id = m[1];
    }
    return id;
}
function _boqSetStatus(msg) {
    const el = document.getElementById('boqStatusMsg');
    if (el) el.textContent = msg || '';
}
function _boqEsc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function _boqFmt(n){
    const v = Number(String(n||'').replace(/,/g,'')) || 0;
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

window.openBOQFormModal = async function () {
    const m = document.getElementById('boqFormModal');
    if (!m) { (window.showAlert || alert)('شاشة جدول الكميات غير موجودة'); return; }
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    cancelBOQEdit();
    updateBOQPreview();
    _boqSetStatus('⏳ جاري تحميل البيانات...');
    try {
        await refreshBOQData();
        _boqSetStatus('✅ جاهز');
    } catch (e) {
        console.warn(e);
        _boqSetStatus('⚠️ ' + (e.message || 'فشل التحميل'));
    }
};

window.closeBOQFormModal = function () {
    const m = document.getElementById('boqFormModal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
};

/* ──────── Live preview ──────── */
window.updateBOQPreview = function () {
    // إطار المعاينة محذوف — الخانات الآن تعمل كفلتر للجدول
    if (typeof _renderBOQTable === 'function') _renderBOQTable();
};


/* ──────── Revised columns ──────── */
window.addBOQRevisedColumn = function (preset) {
    const list = document.getElementById('boqRevisedList');
    if (!list) return;
    window._boqRevisedCount = (window._boqRevisedCount || 0) + 1;
    const idx = window._boqRevisedCount;
    const row = document.createElement('div');
    row.className = 'boq-rev-row';
    row.dataset.revIdx = String(idx);
    row.innerHTML = `
        <div class="lbl">كمية جدول معدل ${idx}</div>
        <input type="number" step="any" class="boq-rev-qty" placeholder="الكمية" value="${preset != null ? _boqEsc(preset) : ''}">
        <button type="button" onclick="this.parentNode.remove()" title="حذف"
            style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:32px;height:32px;border-radius:7px;cursor:pointer;font-size:14px;">✕</button>
    `;
    list.appendChild(row);
};

function _boqResetForm() {
    ['boqItemNo','boqDesc','boqUnit','boqPrice','boqContractQty'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const list = document.getElementById('boqRevisedList');
    if (list) list.innerHTML = '';
    window._boqRevisedCount = 0;
    updateBOQPreview();
}

window.cancelBOQEdit = function () {
    window._boqEditRow = null;
    const wrap = document.getElementById('boqFormWrap');
    if (wrap) wrap.classList.remove('edit-mode');
    _boqResetForm();
    _renderBOQTable();
};

/* ──────── Load existing BOQ items via CSV gviz ──────── */
window.refreshBOQData = async function () {
    const id = _boqSheetId();
    if (!id) {
        window._boqItems = [];
        _renderBOQTable();
        _boqSetStatus('⚠️ أضف شيت جدول الكميات في الإعدادات');
        return;
    }
    const tabs = ['جدول الكميات','BOQ','boq','Sheet1'];
    let csv = '';
    for (const tab of tabs) {
        try {
            const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
            const r = await fetch(u);
            if (r.ok) {
                const t = await r.text();
                if (t && !t.trim().startsWith('<') && t.includes(',')) { csv = t; break; }
            }
        } catch(_){}
    }
    if (!csv) {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`;
            const r = await fetch(url);
            if (r.ok) csv = await r.text();
        } catch(_){}
    }
    const items = [];
    if (csv && !csv.trim().startsWith('<')) {
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        for (let i = 1; i < lines.length; i++) {
            const v = parseCSVLine(lines[i]);
            const no = (v[0]||'').trim(), desc = (v[1]||'').trim();
            if (!no && !desc) continue;
            items.push({
                row: i + 1,
                itemNo: no,
                description: desc,
                unit: (v[2]||'').trim(),
                price: (v[3]||'').trim(),
                contractQty: (v[4]||'').trim(),
                revised: v.slice(5).map(x => (x||'').trim()).filter(x => x !== '')
            });
        }
    }
    window._boqItems = items;
    _renderBOQTable();
};

function _renderBOQTable(){
    const tb = document.getElementById('boqItemsBody');
    const cnt = document.getElementById('boqItemsCount');
    if (!tb) return;
    const all = window._boqItems || [];

    // فلتر من خانات الإدخال (substring case-insensitive للنصوص)
    const fNo    = (document.getElementById('boqItemNo')?.value || '').trim().toLowerCase();
    const fDesc  = (document.getElementById('boqDesc')?.value || '').trim().toLowerCase();
    const fUnit  = (document.getElementById('boqUnit')?.value || '').trim().toLowerCase();
    const fPrice = (document.getElementById('boqPrice')?.value || '').trim();
    const fQty   = (document.getElementById('boqContractQty')?.value || '').trim();
    const match = (val, q) => !q || String(val||'').toLowerCase().includes(q);
    const matchNum = (val, q) => !q || String(val||'').replace(/,/g,'').includes(q.replace(/,/g,''));

    const items = all.filter(it =>
        match(it.itemNo, fNo) &&
        match(it.description, fDesc) &&
        match(it.unit, fUnit) &&
        matchNum(it.price, fPrice) &&
        matchNum(it.contractQty, fQty)
    );

    const totalLbl = items.length === all.length
        ? (all.length ? `(${all.length})` : '')
        : `(${items.length} / ${all.length})`;
    if (cnt) cnt.textContent = totalLbl;

    if (!items.length) {
        tb.innerHTML = '<tr><td colspan="6" class="boq-empty">' + (all.length ? 'لا توجد بنود مطابقة للفلتر' : 'لا توجد بنود محفوظة — أضف بنداً أو ارفع ملف CSV') + '</td></tr>';
        return;
    }
    tb.innerHTML = items.map(it => {
        const price = Number(String(it.price||'').replace(/,/g,'')) || 0;
        const qty   = Number(String(it.contractQty||'').replace(/,/g,'')) || 0;
        const total = price * qty;
        return `
        <tr data-row="${it.row}" onclick="loadBOQItemForEdit(${it.row})" class="${window._boqEditRow === it.row ? 'active-edit' : ''}">
            <td>${_boqEsc(it.itemNo)}</td>
            <td class="col-itemdesc" title="${_boqEsc(it.description)}">${_boqEsc(it.description)}</td>
            <td>${_boqEsc(it.unit)}</td>
            <td>${_boqFmt(it.price)}</td>
            <td>${_boqFmt(it.contractQty)}</td>
            <td style="color:#f5c842;font-weight:700;">${_boqFmt(total)}</td>
        </tr>`;
    }).join('');
}

// وايرنق خانات BOQ كفلتر — يُستدعى مرة على DOMReady
(function _wireBOQFilter(){
    function wireOne(id){
        const el = document.getElementById(id);
        if (!el || el._wiredBoqFilter) return;
        const fn = () => { if (typeof _renderBOQTable === 'function') _renderBOQTable(); };
        el.addEventListener('input', fn);
        el.addEventListener('change', fn);
        el._wiredBoqFilter = true;
    }
    function wireAll(){
        ['boqItemNo','boqDesc','boqUnit','boqPrice','boqContractQty'].forEach(wireOne);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(wireAll, 100));
    else setTimeout(wireAll, 100);
    setTimeout(wireAll, 1500);
})();


window.loadBOQItemForEdit = function (row) {
    const it = window._boqItems.find(x => x.row === row);
    if (!it) return;
    window._boqEditRow = row;
    document.getElementById('boqFormWrap').classList.add('edit-mode');
    document.getElementById('boqItemNo').value      = it.itemNo || '';
    document.getElementById('boqDesc').value        = it.description || '';
    document.getElementById('boqUnit').value        = it.unit || '';
    document.getElementById('boqPrice').value       = String(it.price||'').replace(/,/g,'');
    document.getElementById('boqContractQty').value = String(it.contractQty||'').replace(/,/g,'');
    // load revised
    const list = document.getElementById('boqRevisedList');
    if (list) list.innerHTML = '';
    window._boqRevisedCount = 0;
    (it.revised || []).forEach(v => addBOQRevisedColumn(v));
    updateBOQPreview();
    _renderBOQTable();
};

/* ──────── Save (add / update) ──────── */
window.saveBOQItem = async function () {
    const itemNo      = (document.getElementById('boqItemNo')?.value || '').trim();
    const desc        = (document.getElementById('boqDesc')?.value || '').trim();
    const unit        = (document.getElementById('boqUnit')?.value || '').trim();
    const price       = (document.getElementById('boqPrice')?.value || '').trim();
    const contractQty = (document.getElementById('boqContractQty')?.value || '').trim();

    if (!itemNo || !desc) {
        (window.showAlert || alert)('⚠️ أدخل رقم البند والوصف');
        return;
    }
    // Duplicate check (skip when editing same row)
    const key = itemNo + '||' + desc;
    const dup = (window._boqItems || []).find(it =>
        (String(it.itemNo||'').trim() + '||' + String(it.description||'').trim()) === key
        && it.row !== window._boqEditRow
    );
    if (dup) {
        (window.showAlert || alert)('⚠️ هذا البند موجود بالفعل');
        return;
    }
    const revised = {};
    document.querySelectorAll('#boqRevisedList .boq-rev-row').forEach(row => {
        const idx = row.dataset.revIdx;
        const v   = row.querySelector('.boq-rev-qty')?.value.trim() || '';
        if (v !== '') revised['revisedQty' + idx] = v;
    });

    const url = _boqScriptUrl();
    if (!url) {
        (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات');
        return;
    }
    const payload = {
        action      : window._boqEditRow ? 'updateBOQ' : 'addBOQ',
        row         : window._boqEditRow || undefined,
        itemNo, description: desc, unit, price, contractQty,
        ...revised,
        timestamp   : new Date().toISOString(),
        user        : (window.currentUser && (currentUser.name||currentUser.email)) || ''
    };

    _boqSetStatus('⏳ جاري الحفظ...');
    try {
        const res = await fetch(url, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        let result; try { result = JSON.parse(text); } catch(_){ throw new Error('استجابة غير صالحة: ' + text.slice(0,200)); }
        if (!result || !result.success) throw new Error((result && result.message) || 'فشل الحفظ');
        _boqSetStatus('✅ تم الحفظ');
        (window.showAlert || alert)('✅ ' + (result.message || 'تم الحفظ'));
        cancelBOQEdit();
        await refreshBOQData();
    } catch (e) {
        console.error(e);
        _boqSetStatus('❌ ' + e.message);
        (window.showAlert || alert)('❌ ' + e.message);
    }
};

/* ──────── CSV / TXT Import ──────── */
function _boqParseDelimited(text){
    const sample = text.split(/\r?\n/).slice(0,5).join('\n');
    let delim = ',';
    if (sample.indexOf('\t') > -1) delim = '\t';
    else if (sample.indexOf(';') > -1 && sample.split(';').length > sample.split(',').length) delim = ';';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    return lines.map(l => delim === ',' ? parseCSVLine(l) : l.split(delim).map(s => s.trim().replace(/^"|"$/g,'')));
}

window.importBOQFromFile = async function (inputEl) {
    const f = inputEl && inputEl.files && inputEl.files[0];
    if (!f) return;
    try {
        // Reuse the schedule's smart reader if available; otherwise basic FileReader
        let text;
        if (typeof _schedReadTextSmart === 'function') text = await _schedReadTextSmart(f);
        else text = await f.text();
        const rows = _boqParseDelimited(text);
        if (!rows.length) throw new Error('الملف فارغ');
        // Skip header if it looks like header
        let start = 0;
        const first = rows[0].map(c => String(c||'').toLowerCase());
        if (first.some(c => /رقم|البند|item|description|unit|price|سعر|كمية/.test(c))) start = 1;
        const url = _boqScriptUrl();
        if (!url) { (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات'); return; }
        const existing = new Set((window._boqItems||[]).map(it => (it.itemNo||'').trim() + '||' + (it.description||'').trim()));
        const seen = new Set();
        let added = 0, skipped = 0;
        _boqSetStatus(`⏳ جاري رفع ${rows.length - start} صف...`);
        for (let i = start; i < rows.length; i++) {
            const r = rows[i];
            const itemNo = (r[0]||'').trim();
            const desc   = (r[1]||'').trim();
            if (!itemNo || !desc) { skipped++; continue; }
            const k = itemNo + '||' + desc;
            if (existing.has(k) || seen.has(k)) { skipped++; continue; }
            seen.add(k);
            const payload = {
                action: 'addBOQ',
                itemNo, description: desc,
                unit: (r[2]||'').trim(),
                price: (r[3]||'').trim(),
                contractQty: (r[4]||'').trim(),
                timestamp: new Date().toISOString(),
                user: (window.currentUser && (currentUser.name||currentUser.email)) || ''
            };
            // pass any extra cols as revised
            for (let j = 5; j < r.length; j++) {
                const v = (r[j]||'').trim();
                if (v !== '') payload['revisedQty' + (j-4)] = v;
            }
            try {
                const res = await fetch(url, {
                    method:'POST', redirect:'follow',
                    headers:{'Content-Type':'text/plain;charset=utf-8'},
                    body: JSON.stringify(payload)
                });
                const t = await res.text();
                let rr; try{ rr=JSON.parse(t); }catch(_){ rr=null; }
                if (rr && rr.success) added++; else skipped++;
            } catch(_){ skipped++; }
            if (i % 5 === 0) _boqSetStatus(`⏳ تم رفع ${added}/${rows.length - start}...`);
        }
        inputEl.value = '';
        _boqSetStatus(`✅ تم رفع ${added} بند — تخطّى ${skipped}`);
        (window.showAlert || alert)(`✅ تم رفع ${added} بند — تخطّى ${skipped}`);
        await refreshBOQData();
    } catch (e) {
        console.error(e);
        _boqSetStatus('❌ ' + e.message);
        (window.showAlert || alert)('❌ ' + e.message);
    }
};


/* ====================================================
   SCHEDULE UI HANDLERS — لائحة منسدلة من BOQ + عرض/تحديث الصفوف
   ==================================================== */

// State for editing
window._schedEditItemRow = null;   // sheet row number being edited (Items)
window._schedEditPlanRow = null;   // sheet row number being edited (Plan)
window._schedItems = [];           // existing items {row, item, startDate, endDate, days}
window._schedPlan  = [];           // existing plan rows
window._boqItemsList = [];         // BOQ items strings

function _schedScriptUrl() {
    return (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SCRIPT_URL)
        || window.SCHEDULE_SCRIPT_URL
        || localStorage.getItem('SCHEDULE_SCRIPT_URL')
        || '';
}

function _schedSheetId() {
    let id = (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SHEET_ID)
          || window.SCHEDULE_SHEET_ID || '';
    if (id && /\/d\//.test(id)) {
        const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (m) id = m[1];
    }
    return id;
}

function _schedCurrentUser() {
    return (window.currentUser && (window.currentUser.name || window.currentUser.email))
        || (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.email))
        || 'unknown';
}

function _schedSetStatus(msg) {
    const el = document.getElementById('schedStatusMsg');
    if (el) el.textContent = msg || '';
}

async function _schedPost(payload) {
    const url = _schedScriptUrl();
    if (!url) throw new Error('⚠️ أضف رابط سكريبت البرنامج الزمني في الإعدادات');
    const sheetId = _schedSheetId();
    if (!sheetId) throw new Error('⚠️ أضف SCHEDULE_SHEET_ID في الإعدادات');
    const res = await fetch(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, sheetId })
    });
    const text = await res.text();
    let result;
    try { result = JSON.parse(text); }
    catch (_e) { throw new Error('استجابة غير صالحة من السكريبت: ' + text.substring(0, 200)); }
    if (!result || !result.success) throw new Error((result && (result.message || result.error)) || 'فشل غير معروف');
    return result;
}

/* ──────── BOQ items loader ──────── */
async function _loadBoqItems() {
    const boqId = (window.sheetIdsConfig && window.sheetIdsConfig.BOQ_SHEET_ID)
               || window.BOQ_SHEET_ID
               || window.BILLS_SHEET_ID || '';
    if (!boqId) { window._boqItemsList = []; return; }
    try {
        // جرّب gviz بأسماء تبويب شائعة، وإلا fallback إلى gid=0
        const tabs = ['BOQ', 'boq', 'جدول الكميات', 'Sheet1'];
        let csv = '';
        for (const tab of tabs) {
            const u = `https://docs.google.com/spreadsheets/d/${boqId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
            try {
                const rr = await fetch(u);
                if (rr.ok) {
                    const t = await rr.text();
                    if (t && !t.trim().startsWith('<') && t.includes(',')) { csv = t; break; }
                }
            } catch (_) {}
        }
        if (!csv) {
            const url = `https://docs.google.com/spreadsheets/d/${boqId}/export?format=csv&gid=0&_t=${Date.now()}`;
            const r = await fetch(url);
            if (!r.ok) throw new Error('boq fetch fail');
            csv = await r.text();
        }
        if (csv.trim().startsWith('<')) { window._boqItemsList = []; return; }
        const lines = csv.split('\n').filter(l => l.trim());
        if (!lines.length) { window._boqItemsList = []; return; }
        // العمود الأول = رقم البند، العمود الثاني = البند
        const items = [];
        const seen = new Set();
        for (let i = 1; i < lines.length; i++) {
            const v = parseCSVLine(lines[i]);
            const no = (v[0] || '').trim();
            const desc = (v[1] || '').trim();
            if (!no && !desc) continue;
            const key = no + '||' + desc;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({ no, desc });
        }
        window._boqItemsList = items;
    } catch (e) {
        console.warn('فشل تحميل بنود BOQ:', e);
        window._boqItemsList = [];
    }
}


function _schedSyncItemDescLabel() {
    const selDesc = document.getElementById('schedItemSelect');
    const label = document.getElementById('schedItemSelectLabel');
    const btn = document.getElementById('schedItemSelectBtn');
    if (!selDesc || !label) return;
    const opt = selDesc.selectedOptions && selDesc.selectedOptions[0];
    const text = (opt && opt.value) ? (opt.textContent || opt.value) : '— اختر بنداً —';
    label.textContent = text;
    if (btn) btn.title = text;
}

function _schedBuildItemDescMenu() {
    const selDesc = document.getElementById('schedItemSelect');
    const menu = document.getElementById('schedItemSelectMenu');
    if (!selDesc || !menu) return;
    const options = Array.from(selDesc.options || []);
    menu.innerHTML = options.map(opt => `
        <div class="sched-combo-option ${opt.value === selDesc.value ? 'selected' : ''}" data-value="${_esc(opt.value)}" title="${_esc(opt.textContent || opt.value)}">
            ${_esc(opt.textContent || opt.value)}
        </div>
    `).join('');
    menu.querySelectorAll('.sched-combo-option').forEach(el => {
        el.addEventListener('click', () => {
            _schedSetItemDescValue(el.dataset.value || '');
            closeSchedItemMenu();
        });
    });
}

function _schedSetItemDescValue(value) {
    const selDesc = document.getElementById('schedItemSelect');
    if (!selDesc) return;
    selDesc.value = value;
    window.onSchedItemDescChange();
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
}

window.toggleSchedItemMenu = function (event) {
    if (event) event.stopPropagation();
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
    const menu = document.getElementById('schedItemSelectMenu');
    if (menu) menu.classList.toggle('active');
};

window.closeSchedItemMenu = function () {
    const menu = document.getElementById('schedItemSelectMenu');
    if (menu) menu.classList.remove('active');
};

document.addEventListener('click', e => {
    const combo = document.getElementById('schedItemCombo');
    if (combo && !combo.contains(e.target)) window.closeSchedItemMenu();
});

function _refreshBoqDropdown() {
    const selNo = document.getElementById('schedItemNoSelect');
    const selDesc = document.getElementById('schedItemSelect');
    if (!selNo || !selDesc) return;
    // عرض كل بنود BOQ بدون استبعاد المستخدَم منها (التكرار يُكشف عند الحفظ)
    const prevNo = selNo.value, prevDesc = selDesc.value;
    selNo.innerHTML = '<option value="">— اختر رقم —</option>';
    selDesc.innerHTML = '<option value="">— اختر بنداً —</option>';
    const editingRow = window._schedEditItemRow;
    (window._boqItemsList || []).forEach(({ no, desc }) => {
        const o1 = document.createElement('option');
        o1.value = no; o1.textContent = no || '—';
        o1.dataset.desc = desc;
        selNo.appendChild(o1);
        const o2 = document.createElement('option');
        o2.value = desc; o2.textContent = desc || '—';
        o2.dataset.no = no;
        o2.title = desc || '';
        selDesc.appendChild(o2);
    });
    if (editingRow) {
        const editing = (window._schedItems || []).find(i => i.row === editingRow);
        if (editing) {
            if (editing.itemNo && !selNo.querySelector(`option[value="${CSS.escape(editing.itemNo)}"]`)) {
                const o = document.createElement('option');
                o.value = editing.itemNo; o.textContent = editing.itemNo + ' (مخصّص)';
                o.dataset.desc = editing.item || '';
                selNo.appendChild(o);
            }
            if (editing.item && !selDesc.querySelector(`option[value="${CSS.escape(editing.item)}"]`)) {
                const o = document.createElement('option');
                o.value = editing.item; o.textContent = editing.item + ' (مخصّص)';
                o.dataset.no = editing.itemNo || '';
                selDesc.appendChild(o);
            }
            selNo.value = editing.itemNo || '';
            selDesc.value = editing.item || '';
            _schedBuildItemDescMenu();
            _schedSyncItemDescLabel();
            return;
        }
    }
    if (prevNo && selNo.querySelector(`option[value="${CSS.escape(prevNo)}"]`)) selNo.value = prevNo;
    if (prevDesc && selDesc.querySelector(`option[value="${CSS.escape(prevDesc)}"]`)) selDesc.value = prevDesc;
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
}

window.onSchedItemNoChange = function () {
    const selNo = document.getElementById('schedItemNoSelect');
    const selDesc = document.getElementById('schedItemSelect');
    if (!selNo || !selDesc) return;
    const opt = selNo.selectedOptions[0];
    const desc = opt ? (opt.dataset.desc || '') : '';
    if (desc && selDesc.querySelector(`option[value="${CSS.escape(desc)}"]`)) {
        selDesc.value = desc;
    }
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
};

window.onSchedItemDescChange = function () {
    const selNo = document.getElementById('schedItemNoSelect');
    const selDesc = document.getElementById('schedItemSelect');
    if (!selNo || !selDesc) return;
    const opt = selDesc.selectedOptions[0];
    const no = opt ? (opt.dataset.no || '') : '';
    if (no && selNo.querySelector(`option[value="${CSS.escape(no)}"]`)) {
        selNo.value = no;
    }
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
};


/* ──────── Open / close modal ──────── */
window.openScheduleFormModal = async function () {
    const m = document.getElementById('scheduleFormModal');
    if (!m) {
        (window.showAlert || alert)('شاشة البرنامج الزمني غير موجودة في index.html');
        return;
    }
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    cancelScheduleItemEdit();
    cancelSchedulePlanEdit();
    switchScheduleTab('items');
    _schedSetStatus('⏳ جاري تحميل البيانات...');

    try {
        await _loadBoqItems();
        await refreshScheduleData();
        _schedSetStatus('✅ جاهز');
    } catch (e) {
        console.error(e);
        _schedSetStatus('⚠️ ' + e.message);
    }
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

/* ──────── Data fetch + render ──────── */
async function refreshScheduleData() {
    const snap = await _schedPost({ action: 'getSchedule' });
    // server returns rows with header keys; normalize
    const items = (snap.items || []).map(r => ({
        row      : r._row || r.row,
        itemNo   : String(r['رقم البند'] || r.itemNo || ''),
        item     : r['البند'] || r.item || '',
        startDate: _normDateInput(r['تاريخ البداية'] || r.startDate),
        endDate  : _normDateInput(r['تاريخ النهاية'] || r.endDate),
        days     : r['المدة (يوم)'] || r.days || ''
    })).filter(x => x.row);
    const plan = (snap.plan || []).map(r => ({
        row        : r._row || r.row,
        date       : _normDateInput(r['التاريخ'] || r.date),
        plannedValue : Number(r['القيمة المخططة'] ?? r.plannedValue) || 0,
        cumValue   : Number(r['تراكمي القيمة المخططة'] ?? r.cumValue) || 0,
        dailyPct   : Number(r['نسبة المخطط اليومي %'] ?? r.dailyPct) || 0,
        cumPct     : Number(r['تراكمي نسبة المخطط اليومي %'] ?? r.cumPct) || 0
    })).filter(x => x.row);
    window._schedItems = items;
    window._schedPlan  = plan;
    _renderItemsTable();
    _renderPlanTable();
    _refreshBoqDropdown();
    _autofillPlanDate();
}

function _normDateInput(v) {
    if (!v) return '';
    if (v instanceof Date) return _dateToInputVal(v);
    const d = _parseAnyDate(v);
    return d ? _dateToInputVal(d) : String(v);
}

function _renderItemsTable() {
    const tb = document.getElementById('schedItemsBody');
    const cnt = document.getElementById('schedItemsCount');
    if (!tb) return;
    const all = window._schedItems || [];

    // فلتر من خانات الفورم
    const fNo    = (document.getElementById('schedItemNoSelect')?.value || '').trim().toLowerCase();
    const fItem  = (document.getElementById('schedItemSelect')?.value || '').trim().toLowerCase();
    const fStart = (document.getElementById('schedItemStart')?.value || '').trim();
    const fEnd   = (document.getElementById('schedItemEnd')?.value || '').trim();
    const match  = (val, q) => !q || String(val||'').toLowerCase().includes(q);

    const items = all.filter(it =>
        match(it.itemNo, fNo) &&
        match(it.item, fItem) &&
        (!fStart || String(it.startDate||'') === fStart) &&
        (!fEnd   || String(it.endDate||'')   === fEnd)
    );

    const lbl = items.length === all.length
        ? (all.length ? `(${all.length})` : '')
        : `(${items.length} / ${all.length})`;
    if (cnt) cnt.textContent = lbl;

    if (!items.length) {
        tb.innerHTML = '<tr><td colspan="5" class="sched-empty">' + (all.length ? 'لا توجد بنود مطابقة للفلتر' : 'لا توجد بنود محفوظة') + '</td></tr>';
        return;
    }
    tb.innerHTML = items.map(it => `
        <tr data-row="${it.row}" onclick="loadScheduleItemForEdit(${it.row})" class="${window._schedEditItemRow === it.row ? 'active-edit' : ''}">
            <td>${_esc(it.itemNo)}</td>
            <td class="col-itemdesc" title="${_esc(it.item)}">${_esc(it.item)}</td>
            <td>${_esc(it.startDate)}</td>
            <td>${_esc(it.endDate)}</td>
            <td>${_esc(it.days)}</td>
        </tr>
    `).join('');
}

function _renderPlanTable() {
    const tb = document.getElementById('schedPlanBody');
    const cnt = document.getElementById('schedPlanCount');
    if (!tb) return;
    const all = window._schedPlan || [];

    // فلتر من خانات الفورم
    const fDate = (document.getElementById('schedPlanDate')?.value || '').trim();
    const fVal  = (document.getElementById('schedPlanValue')?.value || '').trim();
    const plan = all.filter(p =>
        (!fDate || String(p.date||'') === fDate) &&
        (!fVal  || String(p.plannedValue||'').replace(/,/g,'').includes(fVal.replace(/,/g,'')))
    );

    const lbl = plan.length === all.length
        ? (all.length ? `(${all.length})` : '')
        : `(${plan.length} / ${all.length})`;
    if (cnt) cnt.textContent = lbl;

    if (!plan.length) {
        tb.innerHTML = '<tr><td colspan="5" class="sched-empty">' + (all.length ? 'لا توجد صفوف مطابقة للفلتر' : 'لا توجد صفوف خطة محفوظة') + '</td></tr>';
        return;
    }
    const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    tb.innerHTML = plan.map(p => `
        <tr data-row="${p.row}" onclick="loadSchedulePlanForEdit(${p.row})" class="${window._schedEditPlanRow === p.row ? 'active-edit' : ''}">
            <td>${_esc(p.date)}</td>
            <td>${fmt(p.plannedValue)}</td>
            <td>${fmt(p.cumValue)}</td>
            <td>${Number(p.dailyPct || 0).toFixed(2)}%</td>
            <td>${Number(p.cumPct || 0).toFixed(2)}%</td>
        </tr>
    `).join('');
}


function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _autofillPlanDate() {
    const dateInp = document.getElementById('schedPlanDate');
    if (!dateInp) return;
    if (window._schedEditPlanRow) return; // don't override during edit
    if (!window._schedPlan.length) { dateInp.value = ''; return; }
    // find max date
    const sorted = [...window._schedPlan].map(p => p.date).filter(Boolean).sort();
    const last = sorted[sorted.length - 1];
    if (!last) { dateInp.value = ''; return; }
    const d = _parseAnyDate(last);
    if (!d) return;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    dateInp.value = _dateToInputVal(next);
}

/* ──────── Items form ──────── */
window.loadScheduleItemForEdit = function (row) {
    const it = window._schedItems.find(x => x.row === row);
    if (!it) return;
    window._schedEditItemRow = row;
    document.getElementById('schedItemsFormWrap').classList.add('edit-mode');
    _refreshBoqDropdown();
    const selNo = document.getElementById('schedItemNoSelect');
    const sel = document.getElementById('schedItemSelect');
    if (selNo) selNo.value = it.itemNo || '';
    if (sel) sel.value = it.item || '';
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
    document.getElementById('schedItemStart').value = it.startDate || '';
    document.getElementById('schedItemEnd').value = it.endDate || '';
    _renderItemsTable();
};

window.cancelScheduleItemEdit = function () {
    window._schedEditItemRow = null;
    const wrap = document.getElementById('schedItemsFormWrap');
    if (wrap) wrap.classList.remove('edit-mode');
    _resetItemForm();
    _refreshBoqDropdown();
    _renderItemsTable();
};

function _resetItemForm() {
    const selNo = document.getElementById('schedItemNoSelect');
    if (selNo) selNo.value = '';
    const sel = document.getElementById('schedItemSelect');
    if (sel) sel.value = '';
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
    const s = document.getElementById('schedItemStart');
    const e = document.getElementById('schedItemEnd');
    if (s) s.value = ''; if (e) e.value = '';
}

window.saveScheduleItem = async function () {
    const itemNo = document.getElementById('schedItemNoSelect')?.value || '';
    const item = document.getElementById('schedItemSelect')?.value || '';
    const startDate = document.getElementById('schedItemStart')?.value || '';
    const endDate = document.getElementById('schedItemEnd')?.value || '';
    if (!item || !startDate || !endDate) {
        (window.showAlert || alert)('⚠️ اختر البند وأدخل التاريخين');
        return;
    }
    // Duplicate-detection: do not allow same itemNo+item if not editing current row
    const key = String(itemNo).trim() + '||' + String(item).trim();
    const dup = (window._schedItems || []).find(it =>
        (String(it.itemNo || '').trim() + '||' + String(it.item || '').trim()) === key
        && it.row !== window._schedEditItemRow
    );
    if (dup) {
        (window.showAlert || alert)('⚠️ هذا البند موجود بالفعل (مكرر) — لن يتم الحفظ');
        return;
    }
    _schedSetStatus('⏳ جاري الحفظ...');
    try {
        const user = _schedCurrentUser();
        if (window._schedEditItemRow) {
            await _schedPost({ action: 'updateScheduleItem', row: window._schedEditItemRow, itemNo, item, startDate, endDate, user });
        } else {
            await _schedPost({ action: 'addScheduleItem', itemNo, item, startDate, endDate, user });
        }
        window._schedEditItemRow = null;
        document.getElementById('schedItemsFormWrap').classList.remove('edit-mode');
        _resetItemForm();
        await refreshScheduleData();
        _schedSetStatus('✅ تم الحفظ');
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        (window.showAlert || alert)('❌ ' + e.message);
    }
};

/* ──────── Plan form ──────── */
window.loadSchedulePlanForEdit = function (row) {
    const p = window._schedPlan.find(x => x.row === row);
    if (!p) return;
    window._schedEditPlanRow = row;
    document.getElementById('schedPlanFormWrap').classList.add('edit-mode');
    document.getElementById('schedPlanDate').value = p.date || '';
    document.getElementById('schedPlanValue').value = p.plannedValue || '';
    _renderPlanTable();
};

window.cancelSchedulePlanEdit = function () {
    window._schedEditPlanRow = null;
    const wrap = document.getElementById('schedPlanFormWrap');
    if (wrap) wrap.classList.remove('edit-mode');
    const v = document.getElementById('schedPlanValue');
    if (v) v.value = '';
    _autofillPlanDate();
    _renderPlanTable();
};

window.saveSchedulePlan = async function () {
    const date = document.getElementById('schedPlanDate')?.value || '';
    const valStr = document.getElementById('schedPlanValue')?.value || '';
    if (!date) { (window.showAlert || alert)('⚠️ أدخل التاريخ'); return; }
    const plannedValue = Number(valStr) || 0;
    // Duplicate-detection: do not allow same date if not editing current row
    const dup = (window._schedPlan || []).find(p =>
        String(p.date || '').trim() === String(date).trim()
        && p.row !== window._schedEditPlanRow
    );
    if (dup) {
        (window.showAlert || alert)('⚠️ يوجد صف بنفس التاريخ بالفعل — اختر تاريخاً آخر أو حدّث الصف الموجود');
        return;
    }
    _schedSetStatus('⏳ جاري الحفظ وإعادة الحساب...');
    try {
        const user = _schedCurrentUser();
        if (window._schedEditPlanRow) {
            await _schedPost({ action: 'updateSchedulePlan', row: window._schedEditPlanRow, date, plannedValue, user });
        } else {
            await _schedPost({ action: 'addSchedulePlan', date, plannedValue, user });
        }
        // recalc cumulative on server
        await _schedPost({ action: 'recalcSchedulePlan', user });
        window._schedEditPlanRow = null;
        document.getElementById('schedPlanFormWrap').classList.remove('edit-mode');
        const v = document.getElementById('schedPlanValue'); if (v) v.value = '';
        await refreshScheduleData();
        _schedSetStatus('✅ تم الحفظ');
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        (window.showAlert || alert)('❌ ' + e.message);
    }
};

/* ──────── CSV / TXT Import ──────── */
function _schedWindows1256Decode(bytes) {
    try { return new TextDecoder('windows-1256').decode(bytes); } catch (_) {}
    const map = {
        0x80:'€',0x81:'پ',0x82:'‚',0x83:'ƒ',0x84:'„',0x85:'…',0x86:'†',0x87:'‡',0x88:'ˆ',0x89:'‰',0x8A:'ٹ',0x8B:'‹',0x8C:'Œ',0x8D:'چ',0x8E:'ژ',0x8F:'ڈ',
        0x90:'گ',0x91:'‘',0x92:'’',0x93:'“',0x94:'”',0x95:'•',0x96:'–',0x97:'—',0x98:'ک',0x99:'™',0x9A:'ڑ',0x9B:'›',0x9C:'œ',0x9D:'‌',0x9E:'‍',0x9F:'ں',
        0xA0:' ',0xA1:'،',0xA2:'¢',0xA3:'£',0xA4:'¤',0xA5:'¥',0xA6:'¦',0xA7:'§',0xA8:'¨',0xA9:'©',0xAA:'ھ',0xAB:'«',0xAC:'¬',0xAD:'­',0xAE:'®',0xAF:'¯',
        0xB0:'°',0xB1:'±',0xB2:'²',0xB3:'³',0xB4:'´',0xB5:'µ',0xB6:'¶',0xB7:'·',0xB8:'¸',0xB9:'¹',0xBA:'؛',0xBB:'»',0xBC:'¼',0xBD:'½',0xBE:'¾',0xBF:'؟',
        0xC0:'ہ',0xC1:'ء',0xC2:'آ',0xC3:'أ',0xC4:'ؤ',0xC5:'إ',0xC6:'ئ',0xC7:'ا',0xC8:'ب',0xC9:'ة',0xCA:'ت',0xCB:'ث',0xCC:'ج',0xCD:'ح',0xCE:'خ',0xCF:'د',
        0xD0:'ذ',0xD1:'ر',0xD2:'ز',0xD3:'س',0xD4:'ش',0xD5:'ص',0xD6:'ض',0xD7:'×',0xD8:'ط',0xD9:'ظ',0xDA:'ع',0xDB:'غ',0xDC:'ـ',0xDD:'ف',0xDE:'ق',0xDF:'ك',
        0xE0:'à',0xE1:'ل',0xE2:'â',0xE3:'م',0xE4:'ن',0xE5:'ه',0xE6:'و',0xE7:'ç',0xE8:'è',0xE9:'é',0xEA:'ê',0xEB:'ë',0xEC:'ى',0xED:'ي',0xEE:'î',0xEF:'ï',
        0xF0:'ً',0xF1:'ٌ',0xF2:'ٍ',0xF3:'َ',0xF4:'ُ',0xF5:'ِ',0xF6:'ّ',0xF7:'÷',0xF8:'ْ',0xF9:'ù',0xFA:'ْ',0xFB:'û',0xFC:'ü',0xFD:'‎',0xFE:'‏',0xFF:'ے'
    };
    return Array.from(bytes, b => b < 128 ? String.fromCharCode(b) : (map[b] || '')).join('');
}

function _schedArabicScore(text) {
    const s = String(text || '');
    const arabic = (s.match(/[؀-ۿ]/g) || []).length;
    const replacement = (s.match(/�/g) || []).length;
    const mojibake = (s.match(/(?:Ø|Ù|Ã|Â|ط§|ظ„|ظ…|ظ†|ظٹ|ط¨|ط©|ط±|ط¹|طھ|ط³|ط¯|ط¥|ط£|Ç|á|È)/g) || []).length;
    const questionRuns = (s.match(/\?{3,}/g) || []).join('').length;
    return arabic * 6 - replacement * 25 - mojibake * 10 - questionRuns * 8;
}

function _schedDecodeByteString(text, encoding) {
    const bytes = new Uint8Array(Array.from(String(text || ''), ch => ch.charCodeAt(0) & 255));
    if (encoding === 'windows-1256') return _schedWindows1256Decode(bytes);
    try { return new TextDecoder(encoding, { fatal: false }).decode(bytes); } catch (_) { return ''; }
}

function _schedRepairArabicText(text) {
    const raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!raw) return '';
    const candidates = [raw];
    if (/[^\x00-\x7F]/.test(raw)) {
        candidates.push(_schedDecodeByteString(raw, 'windows-1256'));
        candidates.push(_schedDecodeByteString(raw, 'utf-8'));
    }
    let best = raw, bestScore = _schedArabicScore(raw);
    for (const c of candidates) {
        const score = _schedArabicScore(c);
        if (score > bestScore) { best = c; bestScore = score; }
    }
    return best.trim();
}

async function _schedReadTextSmart(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const candidates = [];
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        candidates.push(new TextDecoder('utf-8').decode(bytes.subarray(3)));
    }
    try { candidates.push(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (_) {}
    candidates.push(new TextDecoder('utf-8').decode(bytes));
    candidates.push(_schedWindows1256Decode(bytes));
    let best = candidates[0] || '', bestScore = _schedArabicScore(best);
    for (const c of candidates) {
        const fixed = _schedRepairArabicText(c);
        const score = _schedArabicScore(fixed);
        if (score > bestScore) { best = fixed; bestScore = score; }
    }
    return best;
}

function _schedCleanCell(value) {
    return _schedRepairArabicText(value).replace(/[‎‏‪-‮]/g, '').trim();
}

function _schedYield() {
    return new Promise(r => setTimeout(r, 0));
}

function _schedToast(msg, type) {
    if (typeof window.showAlert === 'function') {
        try { window.showAlert(msg, type || 'info'); return; } catch (_) {}
    }
    console.log('[schedule]', msg);
}

function _schedParseDelimitedFile(text) {
    // detect delimiter: tab > ; > ,
    const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
    let delim = ',';
    if (sample.indexOf('\t') > -1) delim = '\t';
    else if (sample.indexOf(';') > -1 && sample.indexOf(';') > sample.indexOf(',')) delim = ';';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    return lines.map(line => {
        if (delim === ',') return parseCSVLine(line);
        return line.split(delim).map(s => s.trim().replace(/^"|"$/g, ''));
    });
}

function _schedDetectHeader(row, keywords) {
    // returns true if the row looks like header (contains any keyword)
    return row.some(c => keywords.some(k => String(c || '').toLowerCase().includes(k)));
}

window.importScheduleItemsFromFile = async function (inputEl) {
    const f = inputEl && inputEl.files && inputEl.files[0];
    if (!f) return;
    try {
        const text = await _schedReadTextSmart(f);
        const rows = _schedParseDelimitedFile(text);
        if (!rows.length) throw new Error('الملف فارغ');
        // skip header
        let startIdx = 0;
        if (_schedDetectHeader(rows[0], ['رقم', 'البند', 'بداية', 'نهاية', 'item', 'date', 'start', 'end'])) startIdx = 1;
        // existing dedup set
        const existing = new Set(
            (window._schedItems || []).map(it =>
                String(it.itemNo || '').trim() + '||' + String(it.item || '').trim()
            )
        );
        // in-file dedup
        const seenInFile = new Set();
        const toAdd = [];
        const skipped = [];
        for (let i = startIdx; i < rows.length; i++) {
            const r = rows[i];
            const itemNo = _schedCleanCell(r[0]);
            const item = _schedCleanCell(r[1]);
            const startDate = _normDateInput(_schedCleanCell(r[2]));
            const endDate = _normDateInput(_schedCleanCell(r[3]));
            if (!item || !startDate || !endDate) { skipped.push({ row: i + 1, reason: 'بيانات ناقصة' }); continue; }
            const key = itemNo + '||' + item;
            if (existing.has(key)) { skipped.push({ row: i + 1, reason: 'مكرر مع الشيت' }); continue; }
            if (seenInFile.has(key)) { skipped.push({ row: i + 1, reason: 'مكرر داخل الملف' }); continue; }
            seenInFile.add(key);
            toAdd.push({ itemNo, item, startDate, endDate });
        }
        if (!toAdd.length) {
            _schedSetStatus('⚠️ لا توجد صفوف صالحة للإضافة (تم تخطي ' + skipped.length + ')');
            _schedToast('⚠️ لا توجد صفوف صالحة للإضافة. تم تخطي ' + skipped.length + ' صف.', 'warning');
            inputEl.value = '';
            return;
        }
        _schedSetStatus(`⏳ جاري رفع ${toAdd.length} بند${skipped.length ? ' (متخطى ' + skipped.length + ')' : ''}...`);
        const user = _schedCurrentUser();
        let ok = 0, fail = 0;
        try {
            await _schedPost({ action: 'bulkScheduleItems', rows: toAdd, user });
            ok = toAdd.length;
            _schedSetStatus(`⏳ تم رفع ${ok}/${toAdd.length}...`);
            await _schedYield();
        } catch (bulkErr) {
            for (let i = 0; i < toAdd.length; i++) {
                try {
                    await _schedPost(Object.assign({ action: 'addScheduleItem', user }, toAdd[i]));
                    ok++;
                    _schedSetStatus(`⏳ تم رفع ${ok}/${toAdd.length}...`);
                } catch (e) { console.warn('row failed', toAdd[i], e); fail++; }
                await _schedYield();
            }
        }
        await refreshScheduleData();
        _schedSetStatus(`✅ تم رفع ${ok} بند${fail ? ' — فشل ' + fail : ''}${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        _schedToast(`✅ تم رفع ${ok} بند${fail ? ' — فشل ' + fail : ''}${skipped.length ? ' — متخطى ' + skipped.length : ''}`, fail ? 'warning' : 'success');
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        _schedToast('❌ فشل قراءة الملف: ' + e.message, 'error');
    } finally {
        inputEl.value = '';
    }
};

window.importSchedulePlanFromFile = async function (inputEl) {
    const f = inputEl && inputEl.files && inputEl.files[0];
    if (!f) return;
    try {
        const text = await _schedReadTextSmart(f);
        const rows = _schedParseDelimitedFile(text);
        if (!rows.length) throw new Error('الملف فارغ');
        let startIdx = 0;
        if (_schedDetectHeader(rows[0], ['تاريخ', 'قيمة', 'date', 'value', 'planned'])) startIdx = 1;
        const existing = new Set(
            (window._schedPlan || []).map(p => String(p.date || '').trim())
        );
        const seenInFile = new Set();
        const toAdd = [];
        const skipped = [];
        for (let i = startIdx; i < rows.length; i++) {
            const r = rows[i];
            const date = _normDateInput(_schedCleanCell(r[0]));
            const plannedValue = Number(_schedCleanCell(r[1]).replace(/[,\s]/g, '')) || 0;
            if (!date) { skipped.push({ row: i + 1, reason: 'تاريخ ناقص' }); continue; }
            if (existing.has(date)) { skipped.push({ row: i + 1, reason: 'مكرر مع الشيت' }); continue; }
            if (seenInFile.has(date)) { skipped.push({ row: i + 1, reason: 'مكرر داخل الملف' }); continue; }
            seenInFile.add(date);
            toAdd.push({ date, plannedValue });
        }
        if (!toAdd.length) {
            _schedSetStatus('⚠️ لا توجد صفوف صالحة (تم تخطي ' + skipped.length + ')');
            _schedToast('⚠️ لا توجد صفوف صالحة. تم تخطي ' + skipped.length + ' صف.', 'warning');
            inputEl.value = '';
            return;
        }
        _schedSetStatus(`⏳ جاري رفع ${toAdd.length} صف${skipped.length ? ' (متخطى ' + skipped.length + ')' : ''}...`);
        const user = _schedCurrentUser();
        // bulk action available on server
        try {
            await _schedPost({ action: 'bulkSchedulePlan', rows: toAdd, user });
        } catch (e) {
            // fallback to per-row
            let ok = 0;
            for (const r of toAdd) {
                try { await _schedPost(Object.assign({ action: 'addSchedulePlan', user }, r)); ok++; } catch(_){}
                await _schedYield();
            }
        }
        await _schedPost({ action: 'recalcSchedulePlan', user });
        await refreshScheduleData();
        _schedSetStatus(`✅ تم رفع ${toAdd.length} صف${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        _schedToast(`✅ تم رفع ${toAdd.length} صف${skipped.length ? ' — متخطى ' + skipped.length : ''}`, 'success');
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        _schedToast('❌ فشل قراءة الملف: ' + e.message, 'error');
    } finally {
        inputEl.value = '';
    }
};


/* ====================================================
   SCHEDULE — LIVE PREVIEW (يتحدّث وأنت بتكتب في الخانات)
   ==================================================== */
(function(){
    function fmtN(n){
        const v = Number(String(n||'').replace(/,/g,'')) || 0;
        return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    function diffDays(s, e){
        if (!s || !e) return 0;
        const ds = new Date(s), de = new Date(e);
        if (isNaN(ds) || isNaN(de) || de < ds) return 0;
        return Math.round((de - ds) / 86400000) + 1;
    }
    // إطار المعاينة محذوف — الخانات تعمل كفلتر مباشر على جدول العرض
    window.updateScheduleItemPreview = function(){
        if (typeof _renderItemsTable === 'function') _renderItemsTable();
    };
    window.updateSchedulePlanPreview = function(){
        if (typeof _renderPlanTable === 'function') _renderPlanTable();
    };


    function wire(id, fn){
        const el = document.getElementById(id);
        if (!el || el._wiredPreview) return;
        el.addEventListener('input',  fn);
        el.addEventListener('change', fn);
        el._wiredPreview = true;
    }
    function wireAll(){
        ['schedItemNoSelect','schedItemSelect','schedItemStart','schedItemEnd']
            .forEach(id => wire(id, window.updateScheduleItemPreview));
        ['schedPlanDate','schedPlanValue']
            .forEach(id => wire(id, window.updateSchedulePlanPreview));
        window.updateScheduleItemPreview();
        window.updateSchedulePlanPreview();
    }
    // wire on modal open and after each render
    const origOpen = window.openScheduleFormModal;
    if (typeof origOpen === 'function') {
        window.openScheduleFormModal = async function(){
            const r = await origOpen.apply(this, arguments);
            setTimeout(wireAll, 50);
            return r;
        };
    }
    document.addEventListener('DOMContentLoaded', () => setTimeout(wireAll, 200));
    setTimeout(wireAll, 1000);
})();
