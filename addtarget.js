/* ====================================================
   addtarget.js — تبويب المستهدف
   يُدار من خلال مودال equipmentFormModal (تبويب ثالث)
   ==================================================== */

const TARGET_MONTHS_AR = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

/* ══════════════════════════════════════
   DOM Helpers
══════════════════════════════════════ */
function tgt(id) { return document.getElementById(id); }

function tgtShowFeedback(msg, type) {
    const fb = tgt('eqft_feedback');
    if (!fb) return;
    const map = {
        success: ['rgba(39,174,106,0.15)', 'rgba(39,174,106,0.4)', '#5cc890'],
        loading: ['rgba(245,200,66,0.1)',  'rgba(245,200,66,0.3)', '#f5c842'],
        error:   ['rgba(244,67,54,0.15)', 'rgba(244,67,54,0.4)',  '#ff8a80'],
    };
    const [bg, border, color] = map[type] || map.error;
    fb.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:12px 16px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Cairo',sans-serif;text-align:center;margin-bottom:8px;`;
    fb.textContent = msg;
    if (type === 'success') setTimeout(() => { fb.style.display = 'none'; }, 4000);
}

function tgtHideFeedback() {
    const fb = tgt('eqft_feedback');
    if (fb) fb.style.display = 'none';
}

/* ══════════════════════════════════════
   Populate dropdowns
══════════════════════════════════════ */
function tgtPopulateContractors() {
    const sel = tgt('eqft_contractor');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- اختر المقاول --</option>';
    const source = (window.contractorsList && contractorsList.length) ? contractorsList : [];
    const fallback = new Set();
    if (!source.length) {
        Object.values(window.allData || {}).forEach(sd => {
            Object.values(sd).forEach(row => {
                const c = (row['CONTRACTOR'] || '').trim();
                if (c) fallback.add(c);
            });
        });
        Object.keys(window.contractorMap || {}).forEach(n => { if (n.trim()) fallback.add(n.trim()); });
    }
    const names = source.length ? [...source] : [...fallback].sort((a, b) => a.localeCompare(b, 'ar'));
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = name;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

function tgtPopulateMonths() {
    const sel = tgt('eqft_month');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر الشهر --</option>';
    const now = new Date();
    // عرض 12 شهراً (الحالي + السابقين + المقبلين)
    for (let i = -3; i <= 8; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthIdx = d.getMonth();
        const year = d.getFullYear();
        const opt = document.createElement('option');
        opt.value = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        opt.textContent = `${TARGET_MONTHS_AR[monthIdx]} ${year}`;
        if (i === 0) opt.selected = true;
        sel.appendChild(opt);
    }
}

/* ══════════════════════════════════════
   Element selection (shared with main form)
══════════════════════════════════════ */
let _tgtAllElements = [];

function tgtBuildElementsList() {
    _tgtAllElements = [];
    (window.categories || []).forEach(cat => {
        cat.subitems.forEach(sub => {
            if (!window.allData || !allData[sub.sheetId]) return;
            Object.values(allData[sub.sheetId]).forEach(row => {
                const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
                const name = (row[nameKey] || '').trim();
                const id   = (row['ID'] || '').trim();
                if (name && id) {
                    _tgtAllElements.push({ id, name, sheetId: sub.sheetId, subName: sub.name });
                }
            });
        });
    });
}

function tgtShowElementDropdown() {
    tgtBuildElementsList();
    tgtFilterElementDropdown();
}

function tgtFilterElementDropdown() {
    const inp = tgt('eqft_element_search');
    const dd  = tgt('eqft_element_dropdown');
    if (!inp || !dd) return;
    const q = (inp.value || '').trim().toLowerCase();
    const filtered = q
        ? _tgtAllElements.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
        : _tgtAllElements;

    if (!filtered.length) {
        dd.innerHTML = '<div style="padding:12px 14px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;font-family:\'Cairo\',sans-serif;">لا توجد عناصر مطابقة</div>';
    } else {
        dd.innerHTML = filtered.slice(0, 60).map(e =>
            `<div onclick="tgtSelectElement('${e.id.replace(/'/g,"\\'")}','${e.name.replace(/'/g,"\\'")}','${e.sheetId}')"
                style="padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;display:flex;flex-direction:column;gap:2px;"
                onmouseover="this.style.background='rgba(106,45,145,0.15)'" onmouseout="this.style.background=''">
                <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);font-family:'Cairo',sans-serif;">${e.name}</span>
                <span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:'Cairo',sans-serif;">ID: ${e.id} • ${e.subName}</span>
            </div>`
        ).join('');
    }
    dd.style.display = 'block';
    setTimeout(() => {
        document.addEventListener('click', function _close(ev) {
            if (!dd.contains(ev.target) && ev.target !== inp) {
                dd.style.display = 'none';
            } else {
                document.addEventListener('click', _close, { once: true, capture: true });
            }
        }, { once: true, capture: true });
    }, 0);
}

function tgtSelectElement(id, name, sheetId) {
    const inp  = tgt('eqft_element_search');
    const info = tgt('eqft_element_info');
    const infoName = tgt('eqft_element_info_name');
    const infoId   = tgt('eqft_element_info_id');
    const dd   = tgt('eqft_element_dropdown');

    if (inp)  inp.value  = name;
    if (tgt('eqft_element_id'))   tgt('eqft_element_id').value   = id;
    if (tgt('eqft_element_name')) tgt('eqft_element_name').value = name;
    if (dd)   dd.style.display = 'none';
    if (infoName) infoName.textContent = name;
    if (infoId)   infoId.textContent   = 'ID: ' + id;
    if (info) info.style.display = 'flex';

    // Auto-fill band from element
    const el = _tgtAllElements.find(e => e.id === id && e.name === name)
            || _tgtAllElements.find(e => e.id === id);
    if (el) {
        let matchedSub = null, matchedCat = null;
        (window.categories || []).forEach(cat => {
            cat.subitems.forEach(sub => {
                if (sub.sheetId === el.sheetId) { matchedSub = sub; matchedCat = cat; }
            });
        });
        if (matchedSub && matchedCat) {
            if (tgt('eqft_item_name'))  tgt('eqft_item_name').value  = matchedSub.name;
            if (tgt('eqft_band_sheet')) tgt('eqft_band_sheet').value = matchedSub.sheetId || '';
            if (tgt('eqft_cat_name'))   tgt('eqft_cat_name').value   = matchedCat.name || '';
            if (tgt('eqft_cat_id'))     tgt('eqft_cat_id').value     = matchedCat.id   || '';
            const lbl = tgt('eqft_band_display');
            if (lbl) { lbl.value = matchedSub.name; lbl.style.color = 'rgba(255,255,255,0.9)'; }
            const group = window.getGroupForSub ? getGroupForSub(matchedSub.id) : null;
            if (tgt('eqft_group_name')) tgt('eqft_group_name').value = group ? (group.name || '—') : '—';
            if (tgt('eqft_group_id'))   tgt('eqft_group_id').value   = group ? (group.id   || '')  : '';
        }
    }
    tgtCalcTargetValue();
}

function tgtClearElement() {
    ['eqft_element_id','eqft_element_name','eqft_element_search',
     'eqft_item_name','eqft_band_sheet','eqft_cat_name','eqft_cat_id',
     'eqft_group_name','eqft_group_id'].forEach(id => {
        const el = tgt(id); if (el) el.value = '';
    });
    const info = tgt('eqft_element_info');
    if (info) info.style.display = 'none';
    const lbl = tgt('eqft_band_display');
    if (lbl) { lbl.value = 'يُملأ تلقائياً عند اختيار العنصر'; lbl.style.color = ''; }
}

/* ══════════════════════════════════════
   Pick from map
══════════════════════════════════════ */
let _tgtPickingFromMap = false;
let _tgtMapClickHandler = null;
let _tgtMapBgClickHandler = null;

function tgtPickFromMap() {
    if (!window.map) { window.showAlert && showAlert('❌ الخريطة غير جاهزة'); return; }
    const hasLayers = Object.keys(window.allLayers || {}).length > 0;
    if (!hasLayers) { window.showAlert && showAlert('❌ حمّل بنداً على الخريطة أولاً'); return; }

    _tgtPickingFromMap = true;
    tgt('equipmentFormModal').style.display = 'none';

    let hint = tgt('eqtPickMapHint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'eqtPickMapHint';
        hint.style.cssText = [
            'position:fixed','top:70px','left:50%','transform:translateX(-50%)',
            'z-index:99999','background:linear-gradient(135deg,#3d1060,#6a2d91)',
            'color:white','padding:12px 24px','border-radius:12px',
            'font-size:13px','font-weight:700','font-family:\'Cairo\',sans-serif',
            'box-shadow:0 8px 28px rgba(106,45,145,0.5)',
            'display:flex','align-items:center','gap:14px','white-space:nowrap',
            'pointer-events:auto'
        ].join(';');
        hint.innerHTML = '<span>🗺 انقر على أي عنصر في الخريطة لاختياره</span>' +
            '<button onclick="tgtCancelPickFromMap()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:4px 12px;border-radius:7px;font-size:12px;font-weight:700;font-family:\'Cairo\',sans-serif;cursor:pointer;">إلغاء</button>';
        document.body.appendChild(hint);
    }
    hint.style.display = 'flex';
    map.getContainer().style.cursor = 'crosshair';

    _tgtMapClickHandler = function(e) {
        if (!_tgtPickingFromMap) return;
        if (e.originalEvent) { e.originalEvent.stopPropagation(); e.originalEvent.preventDefault(); }
        if (map.closePopup) map.closePopup();
        const row = _tgtGetRowFromFeatureEvent(e);
        tgtCancelPickFromMap();
        if (row) {
            const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (row[nameKey] || '').trim() || row['ID'];
            tgtSelectElement(row['ID'] || '', name, '');
            window.showAlert && showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };

    _tgtMapBgClickHandler = function(e) {
        if (!_tgtPickingFromMap) return;
        let nearest = null, nearestDist = Infinity;
        Object.entries(window.allLayers || {}).forEach(([sheetId, layer]) => {
            if (!layer || !(window.allData || {})[sheetId]) return;
            layer.eachLayer(f => {
                try {
                    const center = f.getBounds ? f.getBounds().getCenter() : f.getLatLng ? f.getLatLng() : null;
                    if (!center) return;
                    const d = map.distance(e.latlng, center);
                    if (d < nearestDist) { nearestDist = d; const row = allData[sheetId][f.feature.properties.ID]; if (row) nearest = row; }
                } catch(err) {}
            });
        });
        if (nearest && nearestDist < 500) {
            _tgtPickingFromMap = false;
            map.closePopup();
            const nameKey = nearest['ROAD NAME'] ? 'ROAD NAME' : nearest['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (nearest[nameKey] || '').trim() || nearest['ID'];
            tgtCancelPickFromMap();
            tgtSelectElement(nearest['ID'] || '', name, '');
            window.showAlert && showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };

    Object.values(window.allLayers || {}).forEach(layer => {
        if (!layer) return;
        layer.eachLayer(f => { f.on('click', _tgtMapClickHandler); });
    });
    map.on('click', _tgtMapBgClickHandler);
}

function _tgtGetRowFromFeatureEvent(e) {
    const f = e.target || e.layer;
    if (!f || !f.feature) return null;
    const fid = f.feature.properties.ID;
    for (const [sheetId, data] of Object.entries(window.allData || {})) {
        if (data[fid]) return data[fid];
    }
    return null;
}

function tgtCancelPickFromMap() {
    _tgtPickingFromMap = false;
    const modal = tgt('equipmentFormModal');
    if (modal) modal.style.display = '';
    const hint = tgt('eqtPickMapHint');
    if (hint) hint.style.display = 'none';
    if (window.map) map.getContainer().style.cursor = '';
    if (_tgtMapClickHandler) {
        Object.values(window.allLayers || {}).forEach(layer => {
            if (!layer) return;
            layer.eachLayer(f => { f.off('click', _tgtMapClickHandler); });
        });
        _tgtMapClickHandler = null;
    }
    if (window.map && _tgtMapBgClickHandler) {
        map.off('click', _tgtMapBgClickHandler);
        _tgtMapBgClickHandler = null;
    }
    if (window.map) map.closePopup();
}

/* ══════════════════════════════════════
   Calculations
══════════════════════════════════════ */
function tgtCalcTargetValue() {
    const qty   = parseFloat((tgt('eqft_target_qty')   || {}).value) || 0;
    const price = parseFloat((tgt('eqft_price')        || {}).value) || 0;
    const val   = qty * price;
    const valEl = tgt('eqft_target_value');
    if (valEl) {
        valEl.value = val > 0 ? val.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
        valEl.style.color = val > 0 ? '#f5c842' : '';
    }

    const remEl  = tgt('eqft_remaining_qty');
    const remVal = tgt('eqft_remaining_value');
    const remQty = parseFloat((remEl || {}).value) || 0;
    if (remVal) {
        const rv = remQty * price;
        remVal.value = rv > 0 ? rv.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
        remVal.style.color = rv > 0 ? '#5baddf' : '';
    }
}

/* ══════════════════════════════════════
   Reset
══════════════════════════════════════ */
function tgtResetForm() {
    tgtClearElement();
    ['eqft_month','eqft_contractor',
     'eqft_target_qty','eqft_remaining_qty',
     'eqft_price','eqft_target_value','eqft_remaining_value'].forEach(id => {
        const el = tgt(id); if (el) el.value = '';
    });
    // إعادة الشهر الحالي
    tgtPopulateMonths();
    tgtHideFeedback();
}

/* ══════════════════════════════════════
   Submit
══════════════════════════════════════ */
async function tgtSubmitForm() {
    tgtHideFeedback();

    const element_id   = (tgt('eqft_element_id')   || {}).value?.trim() || '';
    const element_name = (tgt('eqft_element_name') || {}).value?.trim() || '';
    const item_name    = (tgt('eqft_item_name')    || {}).value?.trim() || '';
    const cat_name     = (tgt('eqft_cat_name')     || {}).value?.trim() || '';
    const group_name   = (tgt('eqft_group_name')   || {}).value?.trim() || '';
    const contractor   = (tgt('eqft_contractor')   || {}).value?.trim() || '';
    const month        = (tgt('eqft_month')         || {}).value?.trim() || '';
    const target_qty   = parseFloat((tgt('eqft_target_qty')   || {}).value) || 0;
    const remaining_qty = parseFloat((tgt('eqft_remaining_qty') || {}).value) || 0;
    const price        = parseFloat((tgt('eqft_price')         || {}).value) || 0;
    const band_sheet   = (tgt('eqft_band_sheet')   || {}).value?.trim() || '';

    // Validation
    if (!element_name) { tgtShowFeedback('❌ يرجى اختيار اسم العنصر', 'error'); return; }
    if (!item_name)    { tgtShowFeedback('❌ يرجى اختيار البند', 'error'); return; }
    if (!contractor)   { tgtShowFeedback('❌ يرجى اختيار المقاول', 'error'); return; }
    if (!month)        { tgtShowFeedback('❌ يرجى اختيار الشهر', 'error'); return; }
    if (!target_qty || target_qty <= 0) { tgtShowFeedback('❌ يرجى إدخال الكمية المستهدفة', 'error'); return; }

    // Get script URL
    const allSubs = (window.categories || []).flatMap(c => c.subitems || []);
    const matchedSub = allSubs.find(s => s.sheetId === band_sheet);

    // Check for TARGET_SHEET_ID
    const targetSheetId = (window.sheetIdsConfig && window.sheetIdsConfig['TARGET_SHEET_ID']) || window.TARGET_SHEET_ID || '';

    let scriptUrl = '';
    if (matchedSub && matchedSub.scriptUrl) {
        scriptUrl = matchedSub.scriptUrl.trim();
    }

    // fallback: use a general target script if defined
    const targetScriptUrl = (window.sheetIdsConfig && window.sheetIdsConfig['TARGET_SCRIPT_URL']) || window.TARGET_SCRIPT_URL || scriptUrl;

    if (!targetScriptUrl && !targetSheetId) {
        tgtShowFeedback('❌ لم يتم إعداد شيت المستهدف — راجع الإعدادات ← روابط الشيتات', 'error');
        return;
    }

    const btn = tgt('eqft_submit_btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }
    tgtShowFeedback('⏳ جاري إرسال البيانات...', 'loading');

    const added_by = (window.currentUser && currentUser.email) ? currentUser.email : (window.currentUser && currentUser.name ? currentUser.name : '');
    const target_value    = target_qty * price;
    const remaining_value = remaining_qty * price;

    const payload = {
        action: 'insert',
        form_type: 'target',
        group_name, cat_name,
        element_id, element_name,
        item_name, contractor,
        month, target_qty, remaining_qty,
        price, target_value, remaining_value,
        band_sheet, added_by,
        timestamp: new Date().toISOString()
    };

    try {
        const endpointUrl = targetScriptUrl || scriptUrl;
        const r = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        const text = await r.text();
        let resp = {};
        try { resp = JSON.parse(text); } catch(e) {}

        if (resp.status === 'success' || r.ok) {
            tgtShowFeedback('✅ تم حفظ المستهدف بنجاح!', 'success');
            window.showAlert && showAlert('✅ تم تسجيل المستهدف بنجاح', 'success');
            setTimeout(() => tgtResetForm(), 2500);
        } else {
            throw new Error(resp.message || 'فشل الحفظ');
        }
    } catch(e) {
        console.error('Target submit error:', e);
        tgtShowFeedback('❌ تعذر الحفظ: ' + (e.message || 'خطأ في الاتصال'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ في السجل'; }
    }
}

/* ══════════════════════════════════════
   Init when tab is switched to
══════════════════════════════════════ */
function tgtInitTab() {
    tgtBuildElementsList();
    tgtPopulateContractors();
    tgtPopulateMonths();
}

/* ══════════════════════════════════════
   Expose to window
══════════════════════════════════════ */
window.tgtSelectElement        = tgtSelectElement;
window.tgtClearElement         = tgtClearElement;
window.tgtShowElementDropdown  = tgtShowElementDropdown;
window.tgtFilterElementDropdown = tgtFilterElementDropdown;
window.tgtPickFromMap          = tgtPickFromMap;
window.tgtCancelPickFromMap    = tgtCancelPickFromMap;
window.tgtCalcTargetValue      = tgtCalcTargetValue;
window.tgtResetForm            = tgtResetForm;
window.tgtSubmitForm           = tgtSubmitForm;
window.tgtInitTab              = tgtInitTab;
window.tgtPopulateMonths       = tgtPopulateMonths;
