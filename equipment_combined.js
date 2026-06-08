/* ====================================================
   MERGED EQUIPMENT BUNDLE
   This file is an automatic merge of:
     - equipment.js
     - equipment_autofill_patch.js
     - equipment_camera_patch.js

   Created to provide a single-file distribution without
   changing runtime behavior of the originals.
   ==================================================== */

/* =================== equipment.js =================== */

/* ====================================================
   EQUIPMENT FORM — تسجيل المعدات في Google Sheet
   Apps Script endpoint: receives element_id, element_name,
   item_name, contractor, date, equipments[]
   ==================================================== */


// Known equipment types for autocomplete
/* ── equipmentTypes مُعرَّف في settings.js — يُحمَّل من categories.json ── */
/* alias للتوافق مع الكود القديم */
const EQ_KNOWN_TYPES = new Proxy([], {
    get(_, key) { return equipmentTypes[key]; }
});

let eqFormEquipmentCount = 0;

/* ── Open / Close ── */
function openEquipmentFormModal() {
    document.getElementById('equipmentFormModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    eqPopulateSubitems();
    eqPopulateContractors();
    eqBuildElementsList();
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eqf_date').value = today;
    const eqfcDate = document.getElementById('eqfc_date');
    if (eqfcDate) eqfcDate.value = today;
    // Reset to daily tab on open
    eqSwitchFormTab('daily');
    // Add first row if empty
    if (eqFormEquipmentCount === 0) eqAddEquipmentRow();
}

function closeEquipmentFormModal() {
    document.getElementById('equipmentFormModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* ── Populate subitems — now handled by band picker modal, kept for compatibility ── */
function eqPopulateSubitems() {
    // البنود تُعرض الآن في eqBandPickerModal — لا حاجة لملء select
}

/* ──  contractors select from LIST ── */
function eqPopulateContractors() {
    const sel      = document.getElementById('eqf_contractor');
    const selCumul = document.getElementById('eqfc_contractor');

    const buildOptions = (s, curVal) => {
        if (!s) return;
        s.innerHTML = '<option value="">-- اختر المقاول --</option>';
        // من القائمة المحفوظة في الإعدادات أولاً
        const source = (window.contractorsList && contractorsList.length)
            ? contractorsList
            : [];
        // fallback: من allData أو contractorMap لو القائمة فارغة
        const fallback = new Set();
        if (!source.length) {
            Object.values(allData || {}).forEach(sd => {
                Object.values(sd).forEach(row => {
                    const c = (row['CONTRACTOR'] || '').trim();
                    if (c) fallback.add(c);
                });
            });
            Object.keys((window.contractorMap) || {}).forEach(n => { if (n.trim()) fallback.add(n.trim()); });
        }
        const names = source.length
            ? [...source]
            : [...fallback].sort((a, b) => a.localeCompare(b, 'ar'));

        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            s.appendChild(opt);
        });
        if (curVal) s.value = curVal;
    };

    buildOptions(sel,      sel      ? sel.value      : '');
    buildOptions(selCumul, selCumul ? selCumul.value : '');
}
/* ── Element search dropdown ── */
let _eqAllElements = []; // { id, name, sheetId, subName }

function eqBuildElementsList() {
    _eqAllElements = [];
    categories.forEach(cat => {
        cat.subitems.forEach(sub => {
            if (!allData[sub.sheetId]) return;
            Object.values(allData[sub.sheetId]).forEach(row => {
                const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
                const name = (row[nameKey] || '').trim();
                const id   = (row['ID'] || '').trim();
                if (name && id) {
                    _eqAllElements.push({ id, name, sheetId: sub.sheetId, subName: sub.name });
                }
            });
        });
    });
}

function eqShowElementDropdown() {
    eqBuildElementsList();
    eqFilterElementDropdown();
}

function eqFilterElementDropdown() {
    const inp = document.getElementById('eqf_element_search');
    const dd  = document.getElementById('eqf_element_dropdown');
    const q   = (inp.value || '').trim().toLowerCase();

    const filtered = q
        ? _eqAllElements.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
        : _eqAllElements;

    if (!filtered.length) {
        dd.innerHTML = '<div style="padding:12px 14px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;font-family:\'Cairo\',sans-serif;">لا توجد عناصر مطابقة</div>';
    } else {
        dd.innerHTML = filtered.slice(0, 60).map(e =>
            '<div onclick="eqSelectElement(\'' + e.id.replace(/'/g,"\\'") + '\',\'' + e.name.replace(/'/g,"\\'") + '\')" ' +
            'style="padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;display:flex;flex-direction:column;gap:2px;" ' +
            'onmouseover="this.style.background=\'rgba(39,174,106,0.12)\'" onmouseout="this.style.background=\'' + '\'">'+
            '<span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);font-family:\'Cairo\',sans-serif;">' + e.name + '</span>' +
            '<span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:\'Cairo\',sans-serif;">ID: ' + e.id + ' • ' + e.subName + '</span>' +
            '</div>'
        ).join('');
    }
    dd.style.display = 'block';

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', eqCloseElementDropdownOutside, { once: true, capture: true });
    }, 0);
}

function eqCloseElementDropdownOutside(e) {
    const dd  = document.getElementById('eqf_element_dropdown');
    const inp = document.getElementById('eqf_element_search');
    if (!dd || !inp) return;
    if (!dd.contains(e.target) && e.target !== inp) {
        dd.style.display = 'none';
    } else {
        // Re-attach if click was inside dropdown or input
        document.addEventListener('click', eqCloseElementDropdownOutside, { once: true, capture: true });
    }
}

function eqSelectElement(id, name) {
    document.getElementById('eqf_element_id').value   = id;
    document.getElementById('eqf_element_name').value = name;
    document.getElementById('eqf_element_search').value = name;
    document.getElementById('eqf_element_dropdown').style.display = 'none';
    // Show info bar
    const info = document.getElementById('eqf_element_info');
    document.getElementById('eqf_element_info_name').textContent = name;
    document.getElementById('eqf_element_info_id').textContent   = 'ID: ' + id;
    info.style.display = 'flex';

    // ── ملء البند الفرعي تلقائياً من العنصر المختار ──
    const el = _eqAllElements.find(e => e.id === id && e.name === name)
            || _eqAllElements.find(e => e.id === id);
    if (el) {
        // ابحث عن البند الفرعي الكامل في categories
        let matchedSub = null, matchedCat = null;
        (categories || []).forEach(cat => {
            cat.subitems.forEach(sub => {
                if (sub.sheetId === el.sheetId) {
                    matchedSub = sub;
                    matchedCat = cat;
                }
            });
        });

        if (matchedSub && matchedCat) {
            // ملء بيانات البند
            document.getElementById('eqf_item_name').value  = matchedSub.name;
            document.getElementById('eqf_band_sheet').value = matchedSub.sheetId || '';
            document.getElementById('eqf_cat_name').value   = matchedCat.name || '';
            document.getElementById('eqf_cat_id').value     = matchedCat.id   || '';

            // تحديث الـ label في الزر
            const lbl = document.getElementById('eqf_band_display');
            if (lbl) {
                lbl.value = matchedSub.name;
                lbl.style.color = 'rgba(255,255,255,0.9)';
            }
            

            // المجموعة
            const group = getGroupForSub(matchedSub.id);
            document.getElementById('eqf_group_name').value = group ? (group.name || '—') : '—';
            document.getElementById('eqf_group_id').value   = group ? (group.id   || '')  : '';
        }
    }
}

function eqClearElement() {
    document.getElementById('eqf_element_id').value   = '';
    document.getElementById('eqf_element_name').value = '';
    document.getElementById('eqf_element_search').value = '';
    document.getElementById('eqf_element_info').style.display = 'none';

    // ── إعادة تفعيل زر البند ──
    
    // مسح بيانات البند
    document.getElementById('eqf_item_name').value   = '';
    document.getElementById('eqf_band_sheet').value  = '';
    document.getElementById('eqf_cat_name').value    = '';
    document.getElementById('eqf_cat_id').value      = '';
    document.getElementById('eqf_group_name').value  = '';
    document.getElementById('eqf_group_id').value    = '';
    const lbl = document.getElementById('eqf_band_display');
    if (lbl) { lbl.value = '-- اختر البند --'; lbl.style.opacity = ''; }
}

/* ── Pick from map ── */
let _eqPickingFromMap = false;
let _eqMapClickHandler = null;

function eqPickFromMap() {
    if (!map) { showAlert('❌ الخريطة غير جاهزة'); return; }

    // تحقق إن فيه طبقات محملة
    const hasLayers = Object.keys(allLayers).length > 0;
    if (!hasLayers) {
        showAlert('❌ حمّل بنداً على الخريطة أولاً');
        return;
    }

    _eqPickingFromMap = true;

    // ── إخفاء المودال بالكامل ──
    document.getElementById('equipmentFormModal').style.display = 'none';

    // ── شريط تلميح فوق الخريطة ──
    let hint = document.getElementById('eqPickMapHint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'eqPickMapHint';
        hint.style.cssText = [
            'position:fixed','top:70px','left:50%','transform:translateX(-50%)',
            'z-index:99999','background:linear-gradient(135deg,#1a4a8a,#2196f3)',
            'color:white','padding:12px 24px','border-radius:12px',
            'font-size:13px','font-weight:700','font-family:\'Cairo\',sans-serif',
            'box-shadow:0 8px 28px rgba(33,150,243,0.5)',
            'display:flex','align-items:center','gap:14px','white-space:nowrap',
            'pointer-events:auto'
        ].join(';');
        hint.innerHTML =
            '<span>🗺 انقر على أي عنصر في الخريطة لاختياره</span>' +
            '<button onclick="eqCancelPickFromMap()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:4px 12px;border-radius:7px;font-size:12px;font-weight:700;font-family:\'Cairo\',sans-serif;cursor:pointer;">إلغاء</button>';
        document.body.appendChild(hint);
    }
    hint.style.display = 'flex';

    // ── إضافة cursor crosshair على الخريطة ──
    map.getContainer().style.cursor = 'crosshair';

    // ── ربط click مباشرة على كل feature في كل طبقة ──
    _eqMapClickHandler = function(e) {
        if (!_eqPickingFromMap) return;

        // منع الـ popup من الفتح
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
        }
        if (map.closePopup) map.closePopup();

        const row = _eqGetRowFromFeatureEvent(e);
        eqCancelPickFromMap();

        if (row) {
            const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (row[nameKey] || '').trim() || row['ID'];
            const id   = row['ID'] || '';
            eqSelectElement(id, name);
            showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };

    // ── handler للنقر على المساحة الفارغة من الخريطة ──
    _eqMapBgClickHandler = function(e) {
        if (!_eqPickingFromMap) return;
        // ابحث عن أقرب feature للنقطة المنقورة
        let nearest = null, nearestDist = Infinity;
        Object.entries(allLayers).forEach(([sheetId, layer]) => {
            if (!layer || !allData[sheetId]) return;
            layer.eachLayer(f => {
                try {
                    const center = f.getBounds ? f.getBounds().getCenter()
                                 : f.getLatLng ? f.getLatLng() : null;
                    if (!center) return;
                    const d = map.distance(e.latlng, center);
                    if (d < nearestDist) {
                        nearestDist = d;
                        const row = allData[sheetId][f.feature.properties.ID];
                        if (row) nearest = row;
                    }
                } catch(err) {}
            });
        });

        if (nearest && nearestDist < 500) {
            // اختار الأقرب إن كان ضمن 500 متر
            _eqPickingFromMap = false; // منع التكرار
            map.closePopup();
            const nameKey = nearest['ROAD NAME'] ? 'ROAD NAME' : nearest['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (nearest[nameKey] || '').trim() || nearest['ID'];
            eqCancelPickFromMap();
            eqSelectElement(nearest['ID'] || '', name);
            showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };

    // أضف الـ handler على كل feature
    Object.values(allLayers).forEach(layer => {
        if (!layer) return;
        layer.eachLayer(f => {
            f.on('click', _eqMapClickHandler);
        });
    });

    // وعلى الـ map كـ fallback
    map.on('click', _eqMapBgClickHandler);
}

function _eqGetRowFromFeatureEvent(e) {
    const f = e.target || e.layer;
    if (!f || !f.feature) return null;
    const fid = f.feature.properties.ID;
    for (const [sheetId, data] of Object.entries(allData)) {
        if (data[fid]) return data[fid];
    }
    return null;
}

let _eqMapBgClickHandler = null;

function eqCancelPickFromMap() {
    _eqPickingFromMap = false;

    // ── إعادة إظهار المودال ──
    document.getElementById('equipmentFormModal').style.display = '';

    // ── إخفاء الشريط ──
    const hint = document.getElementById('eqPickMapHint');
    if (hint) hint.style.display = 'none';

    // ── إزالة cursor crosshair ──
    if (map) map.getContainer().style.cursor = '';

    // ── إزالة handlers من كل feature ──
    if (_eqMapClickHandler) {
        Object.values(allLayers).forEach(layer => {
            if (!layer) return;
            layer.eachLayer(f => {
                f.off('click', _eqMapClickHandler);
            });
        });
        _eqMapClickHandler = null;
    }

    // ── إزالة map background handler ──
    if (map && _eqMapBgClickHandler) {
        map.off('click', _eqMapBgClickHandler);
        _eqMapBgClickHandler = null;
    }

    // ── إغلاق أي popup مفتوح ──
    if (map) map.closePopup();
}

/* ── Band Picker Sub-Modal ── */
function eqOpenBandPicker() {
    const modal = document.getElementById('eqBandPickerModal');
    modal.style.display = 'flex';
    document.getElementById('eqBandPickerSearch').value = '';
    eqRenderBandPicker('');
    setTimeout(() => document.getElementById('eqBandPickerSearch').focus(), 100);
}

function eqCloseBandPicker() {
    document.getElementById('eqBandPickerModal').style.display = 'none';
}

function eqFilterBandPicker() {
    const q = document.getElementById('eqBandPickerSearch').value.trim().toLowerCase();
    eqRenderBandPicker(q);
}

function eqRenderBandPicker(q) {
    const list = document.getElementById('eqBandPickerList');
    let html = '';

    (categories || []).forEach(cat => {
        const subs = (cat.subitems || []).filter(sub => {
            if (!q) return true;
            return sub.name.toLowerCase().includes(q) ||
                   (sub.number || '').toLowerCase().includes(q);
        });
        if (!subs.length) return;

        html += '<div style="margin-bottom:8px;">' +
            '<div style="font-size:10px;font-weight:900;color:rgba(106,45,145,0.9);padding:6px 8px 4px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(106,45,145,0.2);margin-bottom:4px;font-family:\'Cairo\',sans-serif;">' +
            cat.emoji + ' ' + cat.name +
            '</div>';

        subs.forEach(sub => {
            const numBadge = sub.number
                ? '<span style="font-size:9px;font-weight:700;color:rgba(106,45,145,0.8);background:rgba(106,45,145,0.12);padding:2px 7px;border-radius:4px;border:1px solid rgba(106,45,145,0.2);margin-left:6px;flex-shrink:0;">' + sub.number + '</span>'
                : '';
            const safeCatName = cat.name.replace(/'/g, "\\'");
            const safeCatId   = (cat.id || '').replace(/'/g, "\\'");
            html += '<div onclick="eqSelectBand(\'' + sub.name.replace(/'/g, "\\'") + '\',\'' + (sub.sheetId || '') + '\',\'' + safeCatName + '\',\'' + safeCatId + '\')" ' +
                'style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;cursor:pointer;border:1.5px solid transparent;transition:all 0.15s;margin-bottom:3px;background:rgba(255,255,255,0.03);" ' +
                'onmouseover="this.style.background=\'rgba(106,45,145,0.12)\';this.style.borderColor=\'rgba(106,45,145,0.35)\'" ' +
                'onmouseout="this.style.background=\'rgba(255,255,255,0.03)\';this.style.borderColor=\'transparent\'">' +
                '<span style="font-size:16px;flex-shrink:0;">📌</span>' +
                '<span style="flex:1;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);font-family:\'Cairo\',sans-serif;text-align:right;">' + sub.name + '</span>' +
                numBadge +
                '</div>';
        });

        html += '</div>';
    });

    if (!html) {
        html = '<div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,0.3);font-size:13px;font-family:\'Cairo\',sans-serif;">لا توجد بنود مطابقة</div>';
    }

    list.innerHTML = html;
}

function eqSelectBand(name, sheetId, catName, catId) {
    document.getElementById('eqf_item_name').value  = name;
    document.getElementById('eqf_band_sheet').value = sheetId || '';
    const lbl = document.getElementById('eqf_band_display');
    lbl.value = name;
    lbl.style.color = 'rgba(255,255,255,0.9)';
    

    // ── البند الرئيسي ──
    document.getElementById('eqf_cat_name').value = catName || '';
    document.getElementById('eqf_cat_id').value   = catId   || '';

    // ── المجموعة (من similarGroups) ──
    const sub = (categories || []).flatMap(c => c.subitems)
        .find(s => s.sheetId === sheetId && s.name === name);
    const group = sub ? getGroupForSub(sub.id) : null;
    document.getElementById('eqf_group_name').value = group ? (group.name || '—') : '—';
    document.getElementById('eqf_group_id').value   = group ? (group.id   || '')  : '';

    eqCloseBandPicker();
}

/* ── Get all equipment types currently selected in existing rows ── */
function eqGetUsedTypes() {
    var used = new Set();
    document.querySelectorAll('#eqf_equipments_container .eq-type-inp').forEach(function(sel) {
        if (sel.value) used.add(sel.value);
    });
    return used;
}

/* ── Refresh all existing selects: hide used options (except own value) ── */
function eqRefreshAllSelects() {
    var used = eqGetUsedTypes();
    document.querySelectorAll('#eqf_equipments_container .eq-type-inp').forEach(function(sel) {
        var ownVal = sel.value;
        Array.from(sel.options).forEach(function(opt) {
            if (!opt.value) return; // placeholder — keep always
            opt.hidden = (used.has(opt.value) && opt.value !== ownVal);
        });
    });
}

/* ── Add an equipment row ── */
function eqAddEquipmentRow() {
    var container = document.getElementById('eqf_equipments_container');
    var hint = container.querySelector('.eq-empty-hint');
    if (hint) hint.remove();

    // تحقق إن القائمة فيها أنواع
    if (!equipmentTypes.length) {
        showAlert('❌ لا توجد أنواع معدات في النظام — أضفها من الإعدادات ⚙️ ← أنواع المعدات');
        return;
    }

    // تحقق إن في أنواع متاحة لم تُختر بعد
    var used = eqGetUsedTypes();
    var available = equipmentTypes.filter(function(t) { return !used.has(t); });
    if (!available.length) {
        showAlert('⚠️ تم اختيار جميع أنواع المعدات المتاحة');
        return;
    }

    eqFormEquipmentCount++;
    var rowId = 'eqrow_' + eqFormEquipmentCount;

    // Build select options — تخفي الأنواع المستخدمة مسبقاً
    var optionsHtml = '<option value="" disabled selected>-- اختر نوع المعدة --</option>' +
        equipmentTypes.map(function(t) {
            var isUsed = used.has(t);
            return '<option value="' + t + '"' + (isUsed ? ' hidden' : '') + '>' + t + '</option>';
        }).join('');

    var row = document.createElement('div');
    row.className = 'eq-item-row';
    row.id = rowId;
    row.innerHTML =
        '<select class="eq-type-inp" id="' + rowId + '_type">' +
        optionsHtml + '</select>' +
        '<input type="number" placeholder="العدد" min="0" id="' + rowId + '_count" style="text-align:center;">' +
        '<button class="eq-del-row-btn" onclick="eqRemoveEquipmentRow(\'' + rowId + '\')" title="حذف">✕</button>';

    container.appendChild(row);

    // لما يغير الاختيار: حدّث كل الـ selects
    var sel = row.querySelector('.eq-type-inp');
    if (sel) {
        sel.addEventListener('change', function() {
            eqRefreshAllSelects();
        });
        // focus فقط لو المستخدم ضغط إضافة يدوياً (مش عند فتح الشاشة)
        if (eqAddEquipmentRow._userTriggered) {
            sel.focus();
            eqAddEquipmentRow._userTriggered = false;
        }
    }
}
/* ── Remove an equipment row ── */
function eqRemoveEquipmentRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    eqShowEmptyHint();
    // أعد إظهار المعدة المحذوفة في بقية الصفوف
    eqRefreshAllSelects();
}

/* ── Show hint if no rows ── */
function eqShowEmptyHint() {
    const container = document.getElementById('eqf_equipments_container');
    if (!container.querySelector('.eq-item-row')) {
        if (!container.querySelector('.eq-empty-hint')) {
            container.innerHTML = '<div class="eq-empty-hint">اضغط "إضافة معدة" لإضافة نوع معدة</div>';
        }
        eqFormEquipmentCount = 0;
    }
}

/* ── Reset the form ── */
function eqResetForm() {
    document.getElementById('eqf_element_id').value     = '';
    document.getElementById('eqf_element_name').value   = '';
    document.getElementById('eqf_element_search').value = '';
    document.getElementById('eqf_element_info').style.display = 'none';
    document.getElementById('eqf_element_dropdown').style.display = 'none';
    document.getElementById('eqf_item_name').value   = '';
    document.getElementById('eqf_band_sheet').value  = '';
    document.getElementById('eqf_cat_name').value    = '';
    document.getElementById('eqf_cat_id').value      = '';
    document.getElementById('eqf_group_name').value  = '';
    document.getElementById('eqf_group_id').value    = '';
    const lbl = document.getElementById('eqf_band_display');
    if (lbl) { lbl.value = '-- اختر البند --'; lbl.style.opacity = ''; }
    
    document.getElementById('eqf_contractor').value   = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eqf_date').value = today;
    const doneQty = document.getElementById('eqf_done_qty');
   const rowIdx = document.getElementById('eqf_row_index');
   if (rowIdx) rowIdx.value = '';
   window._afFoundRowIndex = null;
    if (doneQty) doneQty.value = '';
    document.getElementById('eqf_equipments_container').innerHTML = '';
    eqFormEquipmentCount = 0;
    eqShowEmptyHint();
    eqHideFeedback();
    eqCancelPickFromMap();
}

/* ── Show / hide feedback ── */
function eqShowFeedback(msg, type) {
    const fb = document.getElementById('eqf_feedback');
    fb.className = 'eqf-' + type;
    fb.textContent = msg;
    fb.style.display = 'block';
    if (type === 'success') {
        setTimeout(() => eqHideFeedback(), 4000);
    }
}

function eqHideFeedback() {
    const fb = document.getElementById('eqf_feedback');
    fb.style.display = 'none';
    fb.className = '';
}

/* ── Collect equipment rows ── */
function eqCollectEquipments() {
    const rows = document.querySelectorAll('#eqf_equipments_container .eq-item-row');
    const result = [];
    let hasEmptyCount = false;

    rows.forEach(row => {
        const typeInp  = row.querySelector('.eq-type-inp');
        const countInp = row.querySelector('input[type="number"]');
        const t = (typeInp ? typeInp.value.trim() : '');
        const rawVal = countInp ? countInp.value.trim() : '';
        const c = parseInt(rawVal) || 0;

        if (t) {
            if (rawVal === '' || c <= 0) {
                hasEmptyCount = true;
                if (countInp) {
                    countInp.style.borderColor = '#e53935';
                    countInp.style.boxShadow   = '0 0 0 2px rgba(229,57,53,0.3)';
                    setTimeout(() => { if(countInp){ countInp.style.borderColor=''; countInp.style.boxShadow=''; }}, 3000);
                }
            } else {
                if (countInp) { countInp.style.borderColor = ''; countInp.style.boxShadow = ''; }
                result.push({ type: t, count: c });
            }
        }
    });

    if (hasEmptyCount) result._hasError = true;
    return result;
}

/* ── Submit the form ── */
async function eqSubmitForm() {
    eqHideFeedback();

    const element_id   = document.getElementById('eqf_element_id').value.trim();
    const element_name = document.getElementById('eqf_element_name').value.trim();
    const item_name    = document.getElementById('eqf_item_name').value.trim();
    const cat_name     = document.getElementById('eqf_cat_name').value.trim();
    const group_name   = document.getElementById('eqf_group_name').value.trim();
    const contractor   = document.getElementById('eqf_contractor').value.trim();
    const date         = document.getElementById('eqf_date').value.trim();
    const done_qty     = parseFloat(document.getElementById('eqf_done_qty').value) || 0;
    const band_sheet   = document.getElementById('eqf_band_sheet').value.trim();

    // Validation
    if (!element_name) { eqShowFeedback('❌ يرجى اختيار أو إدخال اسم العنصر', 'error'); return; }
    if (!item_name)    { eqShowFeedback('❌ يرجى اختيار البند', 'error'); return; }
    if (!contractor)   { eqShowFeedback('❌ يرجى اختيار المقاول', 'error'); return; }
    if (!date)         { eqShowFeedback('❌ يرجى اختيار التاريخ', 'error'); return; }
    if (!band_sheet)   { eqShowFeedback('❌ البند المختار ليس له شيت مرتبط — راجع الإعدادات', 'error'); return; }

    const equipments = eqCollectEquipments();
    if (equipments._hasError) {
        eqShowFeedback('❌ يرجى إدخال عدد صحيح (أكبر من صفر) لجميع المعدات', 'error');
        return;
    }
    if (!equipments.length) {
        eqShowFeedback('❌ يرجى إضافة معدة واحدة على الأقل', 'error');
        return;
    }

    // Disable submit button
    const btn = document.getElementById('eqf_submit_btn');
    btn.disabled = true;
    btn.textContent = '⏳ جاري الحفظ...';
    eqShowFeedback('⏳ جاري إرسال البيانات...', 'loading');

    // ── جيب scriptUrl من البند الفرعي في categories ──
    let scriptUrl = '';
    try {
        const allSubs = (categories || []).flatMap(c => c.subitems || []);
        const matchedSub = allSubs.find(s => s.sheetId === band_sheet);

        if (matchedSub && matchedSub.scriptUrl) {
            scriptUrl = matchedSub.scriptUrl.trim();
        }

        if (!scriptUrl) {
            throw new Error(
                'لم يتم العثور على رابط السكريبت — تأكد من:\n' +
                '1. فتح الإعدادات ⚙️ ← دبل كليك على البند الفرعي في السايدبار\n' +
                '2. إدخال رابط Apps Script في حقل "رابط سكريبت تسجيل الكمية - المعدات"\n' +
                '3. تصدير categories.json ⬇ وإعادة رفعه'
            );
        }
    } catch (fetchErr) {
        eqShowFeedback('❌ ' + fetchErr.message, 'error');
        btn.disabled    = false;
        btn.textContent = '💾 حفظ في السجل';
        return;
    }
    const row_index = parseInt(document.getElementById('eqf_row_index')?.value) || null;
    const added_by = (currentUser && currentUser.email) ? currentUser.email : (currentUser && currentUser.name ? currentUser.name : '');

    // لو في تحديث لصف موجود ومافيش صورة جديدة، ابعت الـ URL القديمة من autofill
    // السكريبت عنده حماية ثانية برضو لكن ده أسرع
    const _existingPhotoEl = document.getElementById('eqf_existing_photo_url');
    const _newPhotoEl      = document.getElementById('eqf_photo_url');
    const photo_url = (_newPhotoEl && _newPhotoEl.value.trim())
        ? _newPhotoEl.value.trim()
        : (_existingPhotoEl && _existingPhotoEl.value.trim() ? _existingPhotoEl.value.trim() : '');

    const payload = { 
    form_type: 'daily', 
    row_index,
    group_name, cat_name, element_id, element_name, 
    item_name, contractor, date, done_qty, equipments,
    added_by,   // email أو اسم المستخدم الذي أضاف السجل
    photo_url   // الصورة الجديدة أو القديمة المحفوظة
};
    try {
        const r = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const text = await r.text();
        let resp = {};
        try { resp = JSON.parse(text); } catch(e) {}

        if (resp.status === 'success' || r.ok) {
            eqShowFeedback('✅ تم حفظ بيانات المعدات بنجاح في السجل!', 'success');
            showAlert('✅ تم تسجيل الكمية - المعدات بنجاح', 'success');
            setTimeout(() => eqResetForm(), 2500);
        } else {
            throw new Error(resp.message || 'فشل الحفظ');
        }

    } catch(e) {
        console.error('Equipment form submit error:', e);
        eqShowFeedback('❌ تعذر الحفظ: ' + (e.message || 'خطأ في الاتصال') + ' — تأكد من إعدادات Apps Script', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '💾 حفظ في السجل';
    }
}

/* ── Tab switching between daily, cumulative, and target forms ── */
function eqSwitchFormTab(tab) {
    const bodyDaily  = document.getElementById('eqfBodyDaily');
    const bodyCumul  = document.getElementById('eqfBodyCumul');
    const btnDaily   = document.getElementById('eqfTabDaily');
    const btnCumul   = document.getElementById('eqfTabCumul');
    if (!bodyDaily || !bodyCumul) return;

    // أخفِ كل التبويبات وأعد ألوان الأزرار
    [bodyDaily, bodyCumul].forEach(b => { if (b) b.style.display = 'none'; });
    [btnDaily, btnCumul].forEach(b => {
        if (b) { b.style.background = 'transparent'; b.style.color = 'rgba(255,255,255,0.65)'; }
    });

    const submitBtn = document.getElementById('eqf_submit_btn');

    if (tab === 'daily') {
        if (bodyDaily) bodyDaily.style.display = 'block';
        if (btnDaily)  { btnDaily.style.background = 'rgba(255,255,255,0.9)'; btnDaily.style.color = '#1a6040'; }
        if (submitBtn) submitBtn.onclick = eqSubmitForm;

    } else if (tab === 'cumulative') {
        if (bodyCumul) bodyCumul.style.display = 'block';
        if (btnCumul)  { btnCumul.style.background = 'rgba(255,255,255,0.9)'; btnCumul.style.color = '#1a6040'; }
        if (submitBtn) submitBtn.onclick = eqSubmitCumulative;
        eqPopulateContractors();

    } else if (tab === 'target') {
        // المستهدف الآن في مودال مستقل — افتحه مباشرة
        if (typeof openTargetFormModal === 'function') openTargetFormModal();
    }
}

/* ── Cumulative form: element search ── */
function eqFilterCumulElementDropdown() {
    const inp = document.getElementById('eqfc_element_search');
    const dd  = document.getElementById('eqfc_element_dropdown');
    const q   = (inp ? inp.value : '').trim().toLowerCase();

    const filtered = q
        ? _eqAllElements.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
        : _eqAllElements;

    if (!filtered.length) {
        dd.innerHTML = '<div style="padding:12px 14px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;font-family:\'Cairo\',sans-serif;">لا توجد عناصر مطابقة</div>';
    } else {
        dd.innerHTML = filtered.slice(0, 60).map(e =>
            '<div onclick="eqSelectCumulElement(\'' + e.id.replace(/'/g,"\\'") + '\',\'' + e.name.replace(/'/g,"\\'") + '\')" ' +
            'style="padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;display:flex;flex-direction:column;gap:2px;" ' +
            'onmouseover="this.style.background=\'rgba(33,150,243,0.12)\'" onmouseout="this.style.background=\'\'">' +
            '<span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);font-family:\'Cairo\',sans-serif;">' + e.name + '</span>' +
            '<span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:\'Cairo\',sans-serif;">ID: ' + e.id + ' • ' + e.subName + '</span>' +
            '</div>'
        ).join('');
    }
    dd.style.display = 'block';
    setTimeout(() => {
        document.addEventListener('click', function _close(ev) {
            if (!dd.contains(ev.target) && ev.target !== inp) dd.style.display = 'none';
            else document.addEventListener('click', _close, { once: true, capture: true });
        }, { once: true, capture: true });
    }, 0);
}

function eqSelectCumulElement(id, name) {
    document.getElementById('eqfc_element_id').value    = id;
    document.getElementById('eqfc_element_name').value  = name;
    document.getElementById('eqfc_element_search').value = name;
    document.getElementById('eqfc_element_dropdown').style.display = 'none';

    const info = document.getElementById('eqfc_element_info');
    document.getElementById('eqfc_element_info_name').textContent = name;
    document.getElementById('eqfc_element_info_id').textContent   = 'ID: ' + id;
    info.style.display = 'flex';

    const el = _eqAllElements.find(e => e.id === id && e.name === name)
            || _eqAllElements.find(e => e.id === id);
    if (el) {
        let matchedSub = null, matchedCat = null;
        (categories || []).forEach(cat => {
            cat.subitems.forEach(sub => {
                if (sub.sheetId === el.sheetId) { matchedSub = sub; matchedCat = cat; }
            });
        });
        if (matchedSub && matchedCat) {
            document.getElementById('eqfc_item_name').value  = matchedSub.name;
            document.getElementById('eqfc_band_sheet').value = matchedSub.sheetId || '';
            document.getElementById('eqfc_cat_name').value   = matchedCat.name || '';
            document.getElementById('eqfc_cat_id').value     = matchedCat.id   || '';
            const lbl = document.getElementById('eqfc_band_display');
            if (lbl) { lbl.value = matchedSub.name; lbl.style.color = 'rgba(255,255,255,0.9)'; }
            const group = getGroupForSub(matchedSub.id);
            document.getElementById('eqfc_group_name').value = group ? (group.name || '—') : '—';
            document.getElementById('eqfc_group_id').value   = group ? (group.id   || '')  : '';
        }
    }
}

function eqClearCumulElement() {
    ['eqfc_element_id','eqfc_element_name','eqfc_element_search',
     'eqfc_item_name','eqfc_band_sheet','eqfc_cat_name','eqfc_cat_id',
     'eqfc_group_name','eqfc_group_id'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const info = document.getElementById('eqfc_element_info');
    if (info) info.style.display = 'none';
    const lbl = document.getElementById('eqfc_band_display');
    if (lbl) { lbl.value = 'يُملأ تلقائياً عند اختيار العنصر'; lbl.style.color = ''; }
}

/* ── Pick from map for cumulative tab ── */
let _eqCumulPickingFromMap = false;
let _eqCumulMapClickHandler = null;
let _eqCumulMapBgClickHandler = null;

function eqPickFromMapCumul() {
    if (!map) { showAlert('❌ الخريطة غير جاهزة'); return; }
    const hasLayers = Object.keys(allLayers).length > 0;
    if (!hasLayers) { showAlert('❌ حمّل بنداً على الخريطة أولاً'); return; }

    _eqCumulPickingFromMap = true;
    document.getElementById('equipmentFormModal').style.display = 'none';

    let hint = document.getElementById('eqPickMapHintCumul');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'eqPickMapHintCumul';
        hint.style.cssText = [
            'position:fixed','top:70px','left:50%','transform:translateX(-50%)',
            'z-index:99999','background:linear-gradient(135deg,#1a4a8a,#2196f3)',
            'color:white','padding:12px 24px','border-radius:12px',
            'font-size:13px','font-weight:700','font-family:\'Cairo\',sans-serif',
            'box-shadow:0 8px 28px rgba(33,150,243,0.5)',
            'display:flex','align-items:center','gap:14px','white-space:nowrap',
            'pointer-events:auto'
        ].join(';');
        hint.innerHTML = '<span>🗺 انقر على أي عنصر في الخريطة لاختياره</span>' +
            '<button onclick="eqCancelPickFromMapCumul()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:4px 12px;border-radius:7px;font-size:12px;font-weight:700;font-family:\'Cairo\',sans-serif;cursor:pointer;">إلغاء</button>';
        document.body.appendChild(hint);
    }
    hint.style.display = 'flex';
    map.getContainer().style.cursor = 'crosshair';

    _eqCumulMapClickHandler = function(e) {
        if (!_eqCumulPickingFromMap) return;
        if (e.originalEvent) { e.originalEvent.stopPropagation(); e.originalEvent.preventDefault(); }
        if (map.closePopup) map.closePopup();
        const row = _eqGetRowFromFeatureEvent(e);
        eqCancelPickFromMapCumul();
        if (row) {
            const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (row[nameKey] || '').trim() || row['ID'];
            eqSelectCumulElement(row['ID'] || '', name);
            showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };
    Object.values(allLayers).forEach(layer => {
        if (!layer) return;
        layer.eachLayer(f => { f.on('click', _eqCumulMapClickHandler); });
    });
    _eqCumulMapBgClickHandler = function(e) {
        if (!_eqCumulPickingFromMap) return;
        let nearest = null, nearestDist = Infinity;
        Object.entries(allLayers).forEach(([sheetId, layer]) => {
            if (!layer || !allData[sheetId]) return;
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
            _eqCumulPickingFromMap = false;
            map.closePopup();
            const nameKey = nearest['ROAD NAME'] ? 'ROAD NAME' : nearest['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
            const name = (nearest[nameKey] || '').trim() || nearest['ID'];
            eqCancelPickFromMapCumul();
            eqSelectCumulElement(nearest['ID'] || '', name);
            showAlert('✅ تم اختيار: ' + name, 'success');
        }
    };
    map.on('click', _eqCumulMapBgClickHandler);
}

function eqCancelPickFromMapCumul() {
    _eqCumulPickingFromMap = false;
    document.getElementById('equipmentFormModal').style.display = '';
    const hint = document.getElementById('eqPickMapHintCumul');
    if (hint) hint.style.display = 'none';
    if (map) map.getContainer().style.cursor = '';
    if (_eqCumulMapClickHandler) {
        Object.values(allLayers).forEach(layer => {
            if (!layer) return;
            layer.eachLayer(f => { f.off('click', _eqCumulMapClickHandler); });
        });
        _eqCumulMapClickHandler = null;
    }
    if (map && _eqCumulMapBgClickHandler) {
        map.off('click', _eqCumulMapBgClickHandler);
        _eqCumulMapBgClickHandler = null;
    }
    if (map) map.closePopup();
}

/* ── Submit cumulative form ── */
async function eqSubmitCumulative() {
    const feedbackEl = document.getElementById('eqfc_feedback');
    const showFb = (msg, type) => {
        if (!feedbackEl) return;
        feedbackEl.className = 'eqf-' + type;
        feedbackEl.textContent = msg;
        feedbackEl.style.display = 'block';
        if (type === 'success') setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
    };

    const element_id   = document.getElementById('eqfc_element_id').value.trim();
    const element_name = document.getElementById('eqfc_element_name').value.trim();
    const item_name    = document.getElementById('eqfc_item_name').value.trim();
    const cat_name     = document.getElementById('eqfc_cat_name').value.trim();
    const group_name   = document.getElementById('eqfc_group_name').value.trim();
    const contractor   = document.getElementById('eqfc_contractor').value.trim();
    const date         = document.getElementById('eqfc_date').value.trim();
    const total_qty    = parseFloat(document.getElementById('eqfc_total_qty').value) || 0;
    const cumul_qty    = parseFloat(document.getElementById('eqfc_cumul_qty').value) || 0;
    const band_sheet   = document.getElementById('eqfc_band_sheet').value.trim();

    if (!element_name) { showFb('❌ يرجى اختيار اسم العنصر', 'error'); return; }
    if (!item_name)    { showFb('❌ يرجى اختيار البند', 'error'); return; }
    if (!contractor)   { showFb('❌ يرجى اختيار المقاول', 'error'); return; }
    if (!date)         { showFb('❌ يرجى اختيار التاريخ', 'error'); return; }
    if (!band_sheet)   { showFb('❌ البند المختار ليس له شيت مرتبط', 'error'); return; }

    const allSubs = (categories || []).flatMap(c => c.subitems || []);
    const matchedSub = allSubs.find(s => s.sheetId === band_sheet);
    const scriptUrl = (matchedSub && matchedSub.scriptUrl) ? matchedSub.scriptUrl.trim() : '';
    if (!scriptUrl) { showFb('❌ لم يتم العثور على رابط السكريبت — راجع إعدادات البند', 'error'); return; }

    const btn = document.getElementById('eqf_submit_btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }
    showFb('⏳ جاري إرسال البيانات...', 'loading');

    const added_by = (currentUser && currentUser.email) ? currentUser.email : (currentUser && currentUser.name ? currentUser.name : '');
    const payload = { form_type: 'cumulative', group_name, cat_name, element_id, element_name, item_name, contractor, date, total_qty, cumul_qty, added_by };

    try {
        const r    = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload), redirect: 'follow' });
        const text = await r.text();
        let resp = {};
        try { resp = JSON.parse(text); } catch(e) {}
        if (resp.status === 'success' || r.ok) {
            showFb('✅ تم حفظ الكمية التراكمية بنجاح!', 'success');
            showAlert('✅ تم تسجيل الكمية التراكمية بنجاح', 'success');
        } else {
            throw new Error(resp.message || 'فشل الحفظ');
        }
    } catch(e) {
        showFb('❌ تعذر الحفظ: ' + (e.message || 'خطأ في الاتصال'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ في السجل'; }
    }
}

/* openEquipmentModal — يفتح مودال المعدات */
window.openEquipmentModal = function() {
    _eqActiveTab = 'overview';
    openModal('equipmentModal');
    loadEquipmentModal();
};



/* =================== equipment_autofill_patch.js =================== */

/* ====================================================
   AUTOFILL PATCH — equipment_autofill_patch.js  (v4)
   الفرق عن v3: حذف عمود PHOTO (hyperlink) — الصورة تُقرأ من col[6] مباشرة كـ URL خام
   هيكل Sheet2: [0]element_id [1]element_name [2]item_name [3]contractor
                [4]date [5]done_qty [6]PHOTO_URL [7]added_by [8]timestamp
                [9]type1 [10]count1 ...
   ==================================================== */

var _afRows = [];

/* ── جلب Sheet2 ── */
async function afLoadSheet2(sheetId) {
    _afRows = [];
    try {
        var url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=987650458';
        var r   = await fetch(url);
        var csv = await r.text();
        if (csv.trim().startsWith('<')) { console.warn('[autofill] sheet not public'); return; }

        var lines = csv.split('\n').filter(function(l){ return l.trim(); });
        if (lines.length < 2) return;

        for (var i = 1; i < lines.length; i++) {
            _afRows.push(_afParseCSVLine(lines[i]));
        }
        console.log('[autofill] loaded', _afRows.length, 'rows — col6 sample:',
            _afRows[0] ? (_afRows[0][6] || '(empty)') : 'n/a');
    } catch(e) {
        console.warn('[autofill] error:', e.message);
    }
}

/* ── CSV parser يدعم الحقول المقتبسة ── */
function _afParseCSVLine(line) {
    var result = [];
    var cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur.trim());
    return result;
}

/* ── بناء thumbnail URL من Drive view URL ── */
function _afBuildDirectUrl(viewUrl) {
    if (!viewUrl) return null;
    /* /file/d/{ID}/view */
    var m = viewUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w800';
    /* ?id={ID} */
    var m2 = viewUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return 'https://drive.google.com/thumbnail?id=' + m2[1] + '&sz=w800';
    return null;
}

/* ── ملء الفورم من الصف المطابق ── */
function afFill(elementId, date) {
    if (!_afRows.length || !elementId || !date) return;

    function norm(d) {
        if (!d) return '';
        var m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m) return m[3]+'-'+m[2]+'-'+m[1];
        var m2 = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m2) return m2[3]+'-'+m2[2].padStart(2,'0')+'-'+m2[1].padStart(2,'0');
        return d.slice(0,10);
    }

    var target = norm(date);
    var found  = null;

    for (var i = _afRows.length - 1; i >= 0; i--) {
        var row = _afRows[i];
        if ((row[0]||'').trim() === elementId && norm((row[4]||'').trim()) === target) {
            found = row;
            window._afFoundRowIndex = i + 2; // +2: صف الهيدر (1) + index 
            break;
        }
    }

    if (!found) {
        console.log('[autofill] no match for', elementId, target);
        return;
    }

    /* col 3 = contractor */
    var contractor = (found[3]||'').trim();
    if (contractor) {
        var sel = document.getElementById('eqf_contractor');
        if (sel) {
            var exists = false;
            for (var k=0; k<sel.options.length; k++)
                if (sel.options[k].value===contractor){ exists=true; break; }
            if (!exists) {
                var opt = document.createElement('option');
                opt.value = opt.textContent = contractor;
                sel.appendChild(opt);
            }
            sel.value = contractor;
        }
    }

    /* col 5 = done_qty */
    var doneInp = document.getElementById('eqf_done_qty');
    if (doneInp && found[5]) doneInp.value = found[5].trim();

    /* ══════════════════════════════════════════
       col 6 = PHOTO_URL — URL خام مباشرة
    ══════════════════════════════════════════ */
    var photoUrl = (found[6]||'').trim();
   // ── حفظ الـ URL القديم في hidden input عشان يُرسل لو ما تغيّرتش الصورة ──
   var oldPhotoInp = document.getElementById('eqf_existing_photo_url');
   if (!oldPhotoInp) {
       oldPhotoInp = document.createElement('input');
       oldPhotoInp.type = 'hidden';
       oldPhotoInp.id   = 'eqf_existing_photo_url';
       document.getElementById('eqf_feedback').parentElement.appendChild(oldPhotoInp);
   }
   oldPhotoInp.value = photoUrl;
    console.log('[autofill] PHOTO_URL col[6]:', photoUrl);

    if (photoUrl) {
        if (window.eqInjectCameraSection) eqInjectCameraSection();

        var directUrl = _afBuildDirectUrl(photoUrl);
        _afDisplayPhoto(photoUrl, directUrl);
    }

    /* col 9+ = معدات (col7=added_by, col8=timestamp, معدات تبدأ من col9) */
    var pairs = [];
    for (var j = 9; j+1 < found.length; j += 2) {
        var type  = (found[j]  ||'').trim();
        var count = (found[j+1]||'').trim();
        if (type) pairs.push({ type:type, count:count||'0' });
    }

    if (pairs.length) {
        var container = document.getElementById('eqf_equipments_container');
        if (container) {
            container.innerHTML = '';
            window.eqFormEquipmentCount = 0;
            pairs.forEach(function(pair) {
                if (window.eqAddEquipmentRow) window.eqAddEquipmentRow();

                /* ── نجيب آخر صف اتضاف فعلياً من الـ DOM ── */
                var allSelects = container.querySelectorAll('select[id$="_type"]');
                var typeSel    = allSelects.length ? allSelects[allSelects.length - 1] : null;
                var allInputs  = container.querySelectorAll('input[id$="_count"]');
                var cntInp     = allInputs.length  ? allInputs[allInputs.length - 1]  : null;

                /* fallback: لو ما لقى بالـ DOM يجرب العداد */
                if (!typeSel) {
                    var fbId = 'eqrow_' + window.eqFormEquipmentCount;
                    typeSel  = document.getElementById(fbId+'_type');
                    cntInp   = document.getElementById(fbId+'_count');
                }

                if (typeSel) {
                    var ex = false;
                    for (var x=0; x<typeSel.options.length; x++)
                        if (typeSel.options[x].value===pair.type){ ex=true; break; }
                    if (!ex) {
                        var o = document.createElement('option');
                        o.value = o.textContent = pair.type;
                        typeSel.appendChild(o);
                    }
                    typeSel.value = pair.type;
                    console.log('[autofill] eq row set type:', pair.type, '→', typeSel.id);
                }
                if (cntInp) {
                    cntInp.value = pair.count;
                    console.log('[autofill] eq row set count:', pair.count, '→', cntInp.id);
                }
                // حدّث قوائم المعدات بعد كل إضافة عشان تتشال المكررات
                if (typeSel && typeSel.value && window.eqRefreshAllSelects) {
                    window.eqRefreshAllSelects();
                }
            });
        }
    }
   var rowIdxInp = document.getElementById('eqf_row_index');
   if (!rowIdxInp) {
       rowIdxInp = document.createElement('input');
       rowIdxInp.type = 'hidden';
       rowIdxInp.id = 'eqf_row_index';
       document.getElementById('eqf_feedback').parentElement.appendChild(rowIdxInp);
   }
   rowIdxInp.value = window._afFoundRowIndex || '';
    /* بادج "تم تحميل سجل موجود" */
    var oldBadge = document.getElementById('af_loaded_badge');
    if (oldBadge) oldBadge.remove();
    var fb = document.getElementById('eqf_feedback');
    if (fb) {
        var badge = document.createElement('div');
        badge.id = 'af_loaded_badge';
        badge.style.cssText = [
            'display:flex','align-items:center','gap:8px',
            'padding:10px 14px',
            'background:rgba(245,200,66,0.1)',
            'border:1px solid rgba(245,200,66,0.4)',
            'border-radius:10px','margin-bottom:10px',
            'font-size:12px','font-weight:700','color:#f5c842',
            'font-family:Cairo,sans-serif'
        ].join(';');
        badge.innerHTML =
            '<span>📋</span>' +
            '<span style="flex:1;">تم تحميل سجل موجود — يمكنك تعديله وإعادة الحفظ</span>' +
            '<button onclick="afClearBadge()" style="background:none;border:1px solid rgba(245,200,66,0.4);color:rgba(245,200,66,0.7);padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700;font-family:Cairo,sans-serif;cursor:pointer;">✕</button>';
        fb.parentElement.insertBefore(badge, fb);
    }
}

/* ── عرض الصورة من Drive في مربع الكاميرا ── */
function _afDisplayPhoto(viewUrl, directUrl) {
    if (window.eqShowPhotoFromDriveUrl) {
        eqShowPhotoFromDriveUrl(viewUrl, directUrl);
        _afShowPhotoBadge(
            '📷 صورة محفوظة على Drive — التقط جديدة لاستبدالها',
            '#5baddf', 'rgba(33,150,243,0.12)', 'rgba(33,150,243,0.35)'
        );
        return;
    }

    /* fallback يدوي */
    var ph   = document.getElementById('eqf_photo_placeholder');
    var img  = document.getElementById('eqf_photo_preview_img');
    var link = document.getElementById('eqf_photo_drive_link');
    var wrap = document.getElementById('eqf_photo_preview_wrap');

    if (ph) ph.style.display = 'none';

    if (!img && wrap) {
        img = document.createElement('img');
        img.id = 'eqf_photo_preview_img';
        img.style.cssText = 'max-width:100%;max-height:180px;border-radius:8px;border:2px solid rgba(33,150,243,0.4);object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
        img.alt = 'صورة الموقع';
        wrap.appendChild(img);
    }
    if (!link && wrap) {
        link = document.createElement('a');
        link.id = 'eqf_photo_drive_link';
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.cssText = 'font-size:11px;font-weight:700;color:#5baddf;font-family:Cairo,sans-serif;text-decoration:none;padding:4px 12px;background:rgba(33,150,243,0.1);border:1px solid rgba(33,150,243,0.3);border-radius:6px;';
        link.textContent = '🔗 فتح الصورة على Drive';
        wrap.appendChild(link);
    }

    if (img && directUrl) {
        img.src = directUrl;
        img.style.display = 'block';
        img.onerror = function() { img.style.display = 'none'; };
    }
    if (link && viewUrl) {
        link.href = viewUrl;
        link.style.display = 'inline-flex';
        link.style.alignItems = 'center';
    }

    _afShowPhotoBadge(
        '📷 صورة محفوظة على Drive — التقط جديدة لاستبدالها',
        '#5baddf', 'rgba(33,150,243,0.12)', 'rgba(33,150,243,0.35)'
    );
}

/* ── بادج الصورة ── */
function _afShowPhotoBadge(text, color, bg, border) {
    var wrap = document.getElementById('eqf_photo_preview_wrap');
    if (!wrap || document.getElementById('af_photo_badge')) return;
    var pb = document.createElement('div');
    pb.id = 'af_photo_badge';
    pb.style.cssText = [
        'display:flex','align-items:center','gap:6px',
        'padding:6px 12px',
        'background:' + bg,
        'border:1px solid ' + border,
        'border-radius:8px','font-size:11px','font-weight:700',
        'color:' + color,'font-family:Cairo,sans-serif','margin-top:4px'
    ].join(';');
    pb.textContent = text;
    wrap.appendChild(pb);
}

/* ── مسح البوادج ── */
function afClearBadge() {
    ['af_loaded_badge','af_photo_badge'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.remove();
    });
}

/* ── الدالة الرئيسية ── */
async function afCheck() {
    var elementId = (document.getElementById('eqf_element_id')?.value  || '').trim();
    var date      = (document.getElementById('eqf_date')?.value        || '').trim();
    var sheetId   = (document.getElementById('eqf_band_sheet')?.value  || '').trim();

    afClearBadge();
    if (window.eqClearPhoto) eqClearPhoto();

    if (!elementId || !date || !sheetId) return;

    await afLoadSheet2(sheetId);
    afFill(elementId, date);
}

/* ── ربط الأحداث ── */
var _origSelect = window.eqSelectElement;
window.eqSelectElement = function(id, name) {
    if (_origSelect) _origSelect(id, name);
    setTimeout(afCheck, 150);
};

document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'eqf_date') setTimeout(afCheck, 80);
});

var _origReset = window.eqResetForm;
window.eqResetForm = function() {
    afClearBadge();
    _afRows = [];
    if (_origReset) _origReset.apply(this, arguments);
};

// في equipment_autofill_patch.js، في ربط أحداث التغيير
document.addEventListener('change', function(e) {
    if (e.target && (e.target.id === 'eqf_date')) {
        // لو التاريخ تغيّر، امسح الـ row_index لأن autofill سيعيد البحث
        var rowIdx = document.getElementById('eqf_row_index');
        if (rowIdx) rowIdx.value = '';
        window._afFoundRowIndex = null;
        setTimeout(afCheck, 80); // afCheck ستملأ row_index لو لقت سجل جديد
    }
});
window.afCheck      = afCheck;
window.afClearBadge = afClearBadge;

/* =================== equipment_camera_patch.js =================== */

/* ====================================================
   CAMERA PATCH — equipment_camera_patch.js  (v3)
   ==================================================== */

let _eqPhotoBase64 = null;

/* ══════════════════════════════════════════════════
   1. رفع الصورة على Drive
   ══════════════════════════════════════════════════ */
async function _eqUploadPhotoToDrive(base64DataUrl, scriptUrl) {
    if (!base64DataUrl || !scriptUrl) return null;

    try {
        const commaIdx  = base64DataUrl.indexOf(',');
        const rawBase64 = commaIdx !== -1 ? base64DataUrl.slice(commaIdx + 1) : base64DataUrl;

        const now  = new Date();
        const pad  = n => String(n).padStart(2, '0');
        const fileName = `EQ_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;

        const r = await fetch(scriptUrl, {
            method  : 'POST',
            headers : { 'Content-Type': 'text/plain' },
            body    : JSON.stringify({
                action    : 'uploadPhoto',
                fileName  : fileName,
                mimeType  : 'image/jpeg',
                base64Data: rawBase64
            }),
            redirect: 'follow'
        });

        /* ── اقرأ الـ response كـ text أولاً ── */
        const text = await r.text();
        console.log('[camera] raw upload response:', text.slice(0, 200));

        /* ── حاول تحويله لـ JSON ── */
        let resp = null;
        try {
            /* بعض ردود Apps Script بتيجي مع prefix غريب */
            const cleaned = text.replace(/^\)\]\}'\\n/, '').trim();
            resp = JSON.parse(cleaned);
        } catch(e) {
            console.warn('[camera] JSON parse failed, raw:', text.slice(0, 300));
            /* ── استخرج fileId من الـ response لو كان HTML redirect ── */
            const idMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                const fileId  = idMatch[1];
                const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';
                const directUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                console.log('[camera] extracted fileId from response:', fileId);
                return { viewUrl, directUrl, fileId };
            }
            return null;
        }

        if (resp && resp.status === 'success' && resp.url) {
            console.log('[camera] upload success:', resp.url);
            return {
                viewUrl  : resp.url,
                directUrl: resp.directUrl || ('https://drive.google.com/thumbnail?id=' + resp.fileId + '&sz=w800'),
                fileId   : resp.fileId || ''
            };
        }

        /* ── لو الـ status مش success لكن الصورة اتحفظت (fileId موجود) ── */
        if (resp && resp.fileId) {
            const viewUrl   = 'https://drive.google.com/file/d/' + resp.fileId + '/view?usp=sharing';
            const directUrl = 'https://drive.google.com/thumbnail?id=' + resp.fileId + '&sz=w800';
            console.log('[camera] got fileId despite error status:', resp.fileId);
            return { viewUrl, directUrl, fileId: resp.fileId };
        }

        console.warn('[camera] upload failed:', resp ? resp.message : 'unknown');
        return null;

    } catch(e) {
        console.warn('[camera] upload error:', e.message);
        return null;
    }
}

/* ══════════════════════════════════════════════════
   2. Override على fetch — يرفع الصورة ثم يُضيف photo_url
   ══════════════════════════════════════════════════ */
(function patchFetchForPhoto() {
    const _origFetch = window.fetch;

    window.fetch = async function(url, options) {
        if (
            options &&
            options.method === 'POST' &&
            options.body &&
            typeof options.body === 'string'
        ) {
            try {
                const payload = JSON.parse(options.body);

                if (payload.form_type === 'daily' && _eqPhotoBase64) {

                    /* أظهر مؤشر رفع */
                    _eqShowUploadingIndicator(true);

                    const uploadResult = await _eqUploadPhotoToDrive(_eqPhotoBase64, url);

                    _eqShowUploadingIndicator(false);

                    if (uploadResult && uploadResult.viewUrl) {
                        payload.photo_url         = uploadResult.viewUrl;
                        payload.photo_direct_url  = uploadResult.directUrl || '';
                        payload.has_photo         = true;
                        window._lastPhotoViewUrl   = uploadResult.viewUrl;
                        window._lastPhotoDirectUrl = uploadResult.directUrl || '';
                        window._lastPhotoFileId    = uploadResult.fileId    || '';
                        console.log('[camera] photo_url added to payload:', uploadResult.viewUrl);
                    } else {
                        /* الصورة اترفعت على Drive لكن ما قدرنا نجيب الـ URL
                           نحفظ has_photo=true على الأقل */
                        payload.has_photo = true;
                        payload.photo_url = '';
                        console.warn('[camera] upload done but no URL returned — saving has_photo only');
                    }

                    options = Object.assign({}, options, {
                        body: JSON.stringify(payload)
                    });
                }
            } catch(e) { /* ليس JSON للمعدات */ }
        }

        return _origFetch.call(this, url, options);
    };
})();

/* ══════════════════════════════════════════════════
   3. مؤشر "جاري رفع الصورة..."
   ══════════════════════════════════════════════════ */
function _eqShowUploadingIndicator(show) {
    let ind = document.getElementById('eqf_upload_indicator');
    if (show) {
        if (!ind) {
            ind = document.createElement('div');
            ind.id = 'eqf_upload_indicator';
            ind.style.cssText = [
                'position:fixed','top:50%','left:50%',
                'transform:translate(-50%,-50%)',
                'z-index:999999',
                'background:rgba(10,10,30,0.92)',
                'border:1px solid rgba(33,150,243,0.4)',
                'border-radius:14px','padding:18px 28px',
                'font-family:Cairo,sans-serif','font-size:14px',
                'font-weight:700','color:#5baddf',
                'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
                'display:flex','align-items:center','gap:12px'
            ].join(';');
            ind.innerHTML = '<span style="font-size:20px;animation:spin 1s linear infinite;display:inline-block;">⏳</span> جاري رفع الصورة على Drive...';
            document.body.appendChild(ind);
        }
        ind.style.display = 'flex';
    } else {
        if (ind) ind.remove();
    }
}

/* ══════════════════════════════════════════════════
   4. حقن قسم الكاميرا
   ══════════════════════════════════════════════════ */
function eqInjectCameraSection() {
    if (document.getElementById('eqf_camera_section')) return;

    const equipContainer = document.getElementById('eqf_equipments_container');
    if (!equipContainer) return;
    const equipWrapper = equipContainer.parentElement;
    if (!equipWrapper) return;

    const section = document.createElement('div');
    section.id = 'eqf_camera_section';
    section.style.cssText = 'border:1px solid rgba(33,150,243,0.25);border-radius:12px;overflow:hidden;margin-bottom:16px;';

    section.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(33,150,243,0.15),rgba(21,101,192,0.1));padding:10px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(33,150,243,0.15);">
            <span style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.9);font-family:'Cairo',sans-serif;">
                📷 صورة الموقع
                <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.4);margin-right:6px;">(اختياري)</span>
            </span>
            <div style="display:flex;gap:8px;align-items:center;">
                <button type="button" onclick="eqOpenCamera()" id="eqf_camera_btn"
                    style="padding:7px 14px;background:linear-gradient(135deg,#1a4a8a,#2196f3);border:none;border-radius:8px;color:white;font-size:12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;box-shadow:0 2px 10px rgba(33,150,243,0.3);">
                    📷 التقاط صورة
                </button>
                <button type="button" onclick="eqClearPhoto()" id="eqf_photo_clear_btn"
                    style="display:none;padding:6px 10px;background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.3);border-radius:7px;color:#ff8a80;font-size:11px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;">
                    ✕ حذف
                </button>
            </div>
        </div>

        <div id="eqf_photo_preview_wrap" style="padding:12px 16px;min-height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
            <div id="eqf_photo_placeholder" style="color:rgba(255,255,255,0.2);font-size:11px;font-family:'Cairo',sans-serif;text-align:center;padding:8px 0;">لم يتم التقاط صورة بعد</div>
            <img id="eqf_photo_preview_img" style="display:none;max-width:100%;max-height:180px;border-radius:8px;border:2px solid rgba(33,150,243,0.4);object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.4);" alt="صورة الموقع">
            <a id="eqf_photo_drive_link" href="#" target="_blank" rel="noopener"
                style="display:none;font-size:11px;font-weight:700;color:#5baddf;font-family:Cairo,sans-serif;text-decoration:none;padding:4px 12px;background:rgba(33,150,243,0.1);border:1px solid rgba(33,150,243,0.3);border-radius:6px;">
                🔗 فتح الصورة على Drive
            </a>
        </div>

        <input type="file" id="eqf_photo_input" accept="image/*" capture="environment" style="display:none" onchange="eqHandlePhotoSelected(event)">
    `;

    equipWrapper.parentElement.insertBefore(section, equipWrapper);
}

/* ══════════════════════════════════════════════════
   5. فتح الكاميرا
   ══════════════════════════════════════════════════ */
function eqOpenCamera() {
    const inp = document.getElementById('eqf_photo_input');
    if (!inp) return;
    inp.value = '';
    inp.click();
}

/* ══════════════════════════════════════════════════
   6. معالجة الصورة
   ══════════════════════════════════════════════════ */
function eqHandlePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        _eqCompressPhoto(e.target.result, 800, 0.72, function(compressed) {
            _eqPhotoBase64 = compressed;
            _eqShowPhotoPreview(compressed);
            _eqHideDriveLink();
        });
    };
    reader.readAsDataURL(file);
}

function _eqCompressPhoto(dataUrl, maxWidth, quality, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

/* ══════════════════════════════════════════════════
   7. عرض / مسح الصورة
   ══════════════════════════════════════════════════ */
function _eqShowPhotoPreview(src) {
    const ph  = document.getElementById('eqf_photo_placeholder');
    const img = document.getElementById('eqf_photo_preview_img');
    const del = document.getElementById('eqf_photo_clear_btn');
    if (ph)  ph.style.display = 'none';
    if (img) { img.src = src; img.style.display = 'block'; }
    if (del) del.style.display = 'block';
}

function _eqShowDriveLink(viewUrl) {
    const linkEl = document.getElementById('eqf_photo_drive_link');
    if (!linkEl || !viewUrl) return;
    linkEl.href = viewUrl;
    linkEl.style.display = 'inline-flex';
    linkEl.style.alignItems = 'center';
    linkEl.style.gap = '4px';
}

function _eqHideDriveLink() {
    const linkEl = document.getElementById('eqf_photo_drive_link');
    if (linkEl) linkEl.style.display = 'none';
}

/* عرض صورة من Drive URL — يُستدعى من autofill */
function eqShowPhotoFromDriveUrl(viewUrl, directUrl) {
    const ph    = document.getElementById('eqf_photo_placeholder');
    const img   = document.getElementById('eqf_photo_preview_img');
    const del   = document.getElementById('eqf_photo_clear_btn');

    if (ph) ph.style.display = 'none';
    if (del) del.style.display = 'none';

    if (img && directUrl) {
        img.src = directUrl;
        img.style.display = 'block';
        img.onerror = function() {
            /* لو فشل تحميل الصورة مباشرة (CORS) — أخفِها وأبقِ الرابط */
            img.style.display = 'none';
        };
    }

    if (viewUrl) _eqShowDriveLink(viewUrl);
}

function eqClearPhoto() {
    _eqPhotoBase64 = null;
    window._lastPhotoViewUrl   = null;
    window._lastPhotoDirectUrl = null;
    window._lastPhotoFileId    = null;

    const ph  = document.getElementById('eqf_photo_placeholder');
    const img = document.getElementById('eqf_photo_preview_img');
    const del = document.getElementById('eqf_photo_clear_btn');
    const inp = document.getElementById('eqf_photo_input');
    if (ph)  ph.style.display  = 'block';
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (del) del.style.display = 'none';
    if (inp) inp.value = '';
    _eqHideDriveLink();

    const pb = document.getElementById('af_photo_badge');
    if (pb) pb.remove();
}

/* ══════════════════════════════════════════════════
   8. ربط مع دورة حياة الفورم
   ══════════════════════════════════════════════════ */
const _origOpenEqForm = window.openEquipmentFormModal;
window.openEquipmentFormModal = function() {
    if (_origOpenEqForm) _origOpenEqForm.apply(this, arguments);
    setTimeout(function() {
        eqInjectCameraSection();
        eqClearPhoto();
    }, 90);
};

const _origEqReset = window.eqResetForm;
window.eqResetForm = function() {
    eqClearPhoto();
    if (_origEqReset) _origEqReset.apply(this, arguments);
};

/* ══════════════════════════════════════════════════
   9. تصدير للـ window
   ══════════════════════════════════════════════════ */
window.eqOpenCamera             = eqOpenCamera;
window.eqClearPhoto             = eqClearPhoto;
window.eqHandlePhotoSelected    = eqHandlePhotoSelected;
window.eqInjectCameraSection    = eqInjectCameraSection;
window.eqShowPhotoFromDriveUrl  = eqShowPhotoFromDriveUrl;
window._eqUploadPhotoToDrive    = _eqUploadPhotoToDrive;
