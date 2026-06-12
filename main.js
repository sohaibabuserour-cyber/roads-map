/* ====================================================
   GLOBAL LOADING OVERLAY (يمنع التفاعل أثناء الحفظ/الرفع)
   ==================================================== */
(function(){
    function injectStyle(){
        if (document.getElementById('lvOverlayStyle')) return;
        const s = document.createElement('style');
        s.id = 'lvOverlayStyle';
        s.textContent = `
            #lvOverlay{position:fixed;inset:0;background:rgba(5,8,16,0.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);z-index:2147483600;display:none;align-items:center;justify-content:center;font-family:'Cairo','Tajawal',sans-serif;direction:rtl;}
            #lvOverlay.show{display:flex;}
            #lvOverlay .lv-ov-box{background:linear-gradient(145deg,#1c2235,#0e1422);border:1px solid rgba(245,200,66,0.35);border-radius:16px;padding:30px 38px;min-width:340px;max-width:92vw;box-shadow:0 25px 70px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04) inset;text-align:center;color:#fff;}
            #lvOverlay .lv-ov-spinner{width:54px;height:54px;border:4px solid rgba(245,200,66,0.20);border-top-color:#f5c842;border-radius:50%;margin:0 auto 16px;animation:lvOvSpin 0.9s linear infinite;}
            #lvOverlay .lv-ov-title{font-size:18px;font-weight:900;margin-bottom:6px;color:#fff;}
            #lvOverlay .lv-ov-msg{font-size:13px;color:rgba(255,255,255,0.78);margin-bottom:14px;min-height:18px;}
            #lvOverlay .lv-ov-bar{height:9px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden;margin-bottom:10px;border:1px solid rgba(255,255,255,0.05);}
            #lvOverlay .lv-ov-bar > div{height:100%;background:linear-gradient(90deg,#f5c842,#ffd968);width:0%;transition:width .25s ease;border-radius:5px;}
            #lvOverlay .lv-ov-count{font-size:13px;font-weight:700;color:#f5c842;direction:ltr;letter-spacing:0.3px;}
            #lvOverlay .lv-ov-note{font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;}
            @keyframes lvOvSpin{to{transform:rotate(360deg);}}
        `;
        document.head.appendChild(s);
    }
    function ensure(){
        injectStyle();
        let el = document.getElementById('lvOverlay');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'lvOverlay';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-busy', 'true');
        el.innerHTML = `
            <div class="lv-ov-box" role="dialog" aria-modal="true">
                <div class="lv-ov-spinner"></div>
                <div id="lvOvTitle" class="lv-ov-title">جاري المعالجة...</div>
                <div id="lvOvMsg" class="lv-ov-msg"></div>
                <div class="lv-ov-bar"><div id="lvOvBarFill"></div></div>
                <div id="lvOvCount" class="lv-ov-count"></div>
                <div class="lv-ov-note">⚠️ من فضلك انتظر حتى انتهاء العملية</div>
            </div>`;
        // block clicks/keys while open
        el.addEventListener('click', e => e.stopPropagation(), true);
        document.body.appendChild(el);
        return el;
    }
    let _keyBlocker = null;
    window.LV = window.LV || {};
    window.LV.showOverlay = function(title, msg){
        const el = ensure();
        document.getElementById('lvOvTitle').textContent = title || 'جاري الحفظ...';
        document.getElementById('lvOvMsg').textContent = msg || '';
        document.getElementById('lvOvCount').textContent = '';
        document.getElementById('lvOvBarFill').style.width = '0%';
        el.classList.add('show');
        document.documentElement.style.overflow = 'hidden';
        if (!_keyBlocker){
            _keyBlocker = function(e){
                if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); }
            };
            document.addEventListener('keydown', _keyBlocker, true);
        }
    };
    window.LV.updateOverlay = function(done, total, msg){
        const t = Math.max(1, Number(total) || 0);
        const d = Math.min(t, Math.max(0, Number(done) || 0));
        const pct = Math.round((d / t) * 100);
        const bar = document.getElementById('lvOvBarFill'); if (bar) bar.style.width = pct + '%';
        const cnt = document.getElementById('lvOvCount');
        if (cnt) cnt.textContent = `تم ${d} من أصل ${t}  (${pct}%)`;
        if (msg !== undefined){
            const m = document.getElementById('lvOvMsg'); if (m) m.textContent = msg;
        }
    };
    window.LV.setOverlayMsg = function(msg){
        const m = document.getElementById('lvOvMsg'); if (m) m.textContent = msg || '';
    };
    window.LV.setOverlayTitle = function(title){
        const t = document.getElementById('lvOvTitle'); if (t) t.textContent = title || '';
    };
    window.LV.hideOverlay = function(){
        const el = document.getElementById('lvOverlay');
        if (el) el.classList.remove('show');
        document.documentElement.style.overflow = '';
        if (_keyBlocker){ document.removeEventListener('keydown', _keyBlocker, true); _keyBlocker = null; }
    };

    /* ----- Skipped-rows modal — with selection + retry support ----- */
    function injectSkippedStyle(){
        if (document.getElementById('lvSkippedStyle')) return;
        const s = document.createElement('style');
        s.id = 'lvSkippedStyle';
        s.textContent = `
            #lvSkipped{position:fixed;inset:0;background:rgba(5,8,16,0.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);z-index:2147483601;display:none;align-items:center;justify-content:center;font-family:'Cairo','Tajawal',sans-serif;direction:rtl;padding:12px;box-sizing:border-box;}
            #lvSkipped.show{display:flex;}
            #lvSkipped .lv-sk-box{background:linear-gradient(145deg,#241a1a,#140e0e);border:1px solid rgba(255,170,80,0.45);border-radius:16px;padding:18px 20px;width:min(820px,100%);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 70px rgba(0,0,0,0.75);color:#fff;}
            #lvSkipped .lv-sk-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;}
            #lvSkipped .lv-sk-title{font-size:16px;font-weight:900;color:#ffb86b;display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
            #lvSkipped .lv-sk-x{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer;flex-shrink:0;font-family:inherit;}
            #lvSkipped .lv-sk-x:hover{background:rgba(255,255,255,0.16);}
            #lvSkipped .lv-sk-sub{font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:10px;}
            #lvSkipped .lv-sk-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;font-size:12px;color:#fff;}
            #lvSkipped .lv-sk-toolbar button{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;}
            #lvSkipped .lv-sk-toolbar button:hover{background:rgba(255,255,255,0.16);}
            #lvSkipped .lv-sk-count{margin-right:auto;color:rgba(255,255,255,0.7);}
            #lvSkipped .lv-sk-wrap{overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(0,0,0,0.25);flex:1;min-height:0;}
            #lvSkipped table{width:100%;border-collapse:collapse;font-size:12.5px;}
            #lvSkipped th{background:rgba(255,170,80,0.12);color:#ffd0a3;font-weight:800;padding:8px 10px;text-align:right;position:sticky;top:0;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;}
            #lvSkipped td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.05);color:#fff;vertical-align:top;}
            #lvSkipped tr:hover td{background:rgba(255,255,255,0.03);}
            #lvSkipped tr.lv-sk-checked td{background:rgba(76,175,80,0.10);}
            #lvSkipped .lv-sk-reason{color:#ffb86b;font-weight:700;}
            #lvSkipped .lv-sk-chk{width:16px;height:16px;cursor:pointer;accent-color:#4caf50;}
            #lvSkipped .lv-sk-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:12px;}
            #lvSkipped .lv-sk-btn{background:linear-gradient(135deg,#f5c842,#ffb84d);color:#1a1a1a;border:none;border-radius:8px;padding:9px 18px;font-weight:900;cursor:pointer;font-family:inherit;font-size:13px;}
            #lvSkipped .lv-sk-btn.add{background:linear-gradient(135deg,#66bb6a,#43a047);color:#fff;}
            #lvSkipped .lv-sk-btn.skip{background:linear-gradient(135deg,#ef5350,#c62828);color:#fff;}
            #lvSkipped .lv-sk-btn:disabled{opacity:.5;cursor:not-allowed;filter:grayscale(.3);}
            #lvSkipped .lv-sk-btn:not(:disabled):hover{filter:brightness(1.08);}
            @media (max-width:640px){
                #lvSkipped .lv-sk-box{padding:14px 12px;}
                #lvSkipped th,#lvSkipped td{padding:6px 6px;font-size:11.5px;}
                #lvSkipped .lv-sk-title{font-size:14px;}
            }
        `;
        document.head.appendChild(s);
    }

    /**
     * LV.showSkipped(title, rows, opts?)
     *  rows: [{row, itemNo, item|description|desc, date?, reason, __payload?}, ...]
     *  opts: { onAddSelected?: async (selectedRows)=>void }
     */
    window.LV.showSkipped = function(title, rows, opts){
        if (!Array.isArray(rows) || !rows.length) return;
        opts = opts || {};
        injectSkippedStyle();
        let el = document.getElementById('lvSkipped');
        if (!el){
            el = document.createElement('div');
            el.id = 'lvSkipped';
            document.body.appendChild(el);
        }
        // Detect columns (exclude internal __payload)
        const cols = Array.from(rows.reduce((s,r)=>{
            Object.keys(r||{}).forEach(k => { if (!k.startsWith('__')) s.add(k); });
            return s;
        }, new Set()));
        const order = ['row','itemNo','item','description','desc','date','reason'];
        cols.sort((a,b)=>{
            const ia = order.indexOf(a), ib = order.indexOf(b);
            if (ia===-1 && ib===-1) return a.localeCompare(b);
            if (ia===-1) return 1;
            if (ib===-1) return -1;
            return ia - ib;
        });
        const labels = {row:'الصف',itemNo:'رقم البند',item:'البند',description:'البند',desc:'البند',date:'التاريخ',reason:'السبب'};
        const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const hasRetry = typeof opts.onAddSelected === 'function';

        el.innerHTML = `
            <div class="lv-sk-box" role="dialog" aria-modal="true">
                <div class="lv-sk-header">
                    <div class="lv-sk-title">⚠️ ${esc(title || 'صفوف تم تخطيها')}</div>
                    <button type="button" class="lv-sk-x" id="lvSkX" title="إغلاق">✕</button>
                </div>
                <div class="lv-sk-sub">عدد الصفوف المتخطاة: <b>${rows.length}</b>${hasRetry ? ' — اختر الصفوف التي تريد إضافتها ثم اضغط <b>إضافة المحدد</b>، أو اضغط <b>تخطّى الكل</b> للإغلاق.' : ' — راجع البيانات ثم اضغط إغلاق.'}</div>
                ${hasRetry ? `
                <div class="lv-sk-toolbar">
                    <button type="button" id="lvSkAll">✔ تحديد الكل</button>
                    <button type="button" id="lvSkNone">✖ إلغاء التحديد</button>
                    <span class="lv-sk-count" id="lvSkCount">المحدد: 0</span>
                </div>` : ''}
                <div class="lv-sk-wrap">
                    <table>
                        <thead><tr>
                            ${hasRetry ? `<th style="width:34px;text-align:center;"><input type="checkbox" id="lvSkHeadChk" class="lv-sk-chk" title="تحديد الكل"></th>` : ''}
                            ${cols.map(c=>`<th>${esc(labels[c]||c)}</th>`).join('')}
                        </tr></thead>
                        <tbody>${rows.map((r,idx)=>`<tr data-idx="${idx}">
                            ${hasRetry ? `<td style="text-align:center;"><input type="checkbox" class="lv-sk-chk lv-sk-row" data-idx="${idx}"></td>` : ''}
                            ${cols.map(c=>{
                                const v = r[c];
                                const cls = c==='reason' ? ' class="lv-sk-reason"' : '';
                                return `<td${cls}>${esc(v==null?'':v)}</td>`;
                            }).join('')}
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
                <div class="lv-sk-actions">
                    ${hasRetry ? `
                        <button type="button" class="lv-sk-btn add" id="lvSkAdd" disabled>➕ إضافة المحدد</button>
                        <button type="button" class="lv-sk-btn skip" id="lvSkSkip">⏭️ تخطّى الكل وإغلاق</button>
                    ` : `<button type="button" class="lv-sk-btn" id="lvSkClose">إغلاق</button>`}
                </div>
            </div>`;
        el.classList.add('show');

        // Local key handler (Esc closes)
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
        const close = () => {
            el.classList.remove('show');
            document.removeEventListener('keydown', onKey, true);
            el.removeEventListener('click', onBackdrop);
        };
        const onBackdrop = (e) => { if (e.target === el) close(); };
        document.addEventListener('keydown', onKey, true);
        el.addEventListener('click', onBackdrop);

        const qs = (id) => el.querySelector('#' + id);
        qs('lvSkX')?.addEventListener('click', close);
        qs('lvSkClose')?.addEventListener('click', close);

        if (hasRetry){
            const headChk = qs('lvSkHeadChk');
            const allChk = el.querySelectorAll('.lv-sk-row');
            const addBtn = qs('lvSkAdd');
            const countEl = qs('lvSkCount');
            const refreshCount = () => {
                const sel = el.querySelectorAll('.lv-sk-row:checked');
                countEl.textContent = 'المحدد: ' + sel.length;
                addBtn.disabled = sel.length === 0;
                // highlight rows
                allChk.forEach(c => {
                    const tr = c.closest('tr');
                    if (tr) tr.classList.toggle('lv-sk-checked', c.checked);
                });
                if (headChk) headChk.checked = sel.length === allChk.length && allChk.length > 0;
            };
            allChk.forEach(c => c.addEventListener('change', refreshCount));
            headChk?.addEventListener('change', () => { allChk.forEach(c => c.checked = headChk.checked); refreshCount(); });
            qs('lvSkAll')?.addEventListener('click', () => { allChk.forEach(c => c.checked = true); refreshCount(); });
            qs('lvSkNone')?.addEventListener('click', () => { allChk.forEach(c => c.checked = false); refreshCount(); });
            qs('lvSkSkip')?.addEventListener('click', close);
            addBtn.addEventListener('click', async () => {
                const selected = Array.from(el.querySelectorAll('.lv-sk-row:checked'))
                    .map(c => rows[+c.dataset.idx]);
                if (!selected.length) return;
                addBtn.disabled = true;
                addBtn.textContent = '⏳ جاري الإضافة...';
                try { await opts.onAddSelected(selected); }
                catch (err) { console.error(err); (window.showAlert||alert)('❌ ' + (err && err.message || 'فشل الإضافة')); }
                close();
            });
        }
    };
})();

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
    ['reportsDropdown'].forEach(function(id) {
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


