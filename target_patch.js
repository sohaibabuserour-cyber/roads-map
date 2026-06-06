/* ====================================================
   target_patch.js
   تعديلات على main.js وequipment_combined.js لدعم تبويب المستهدف

   يُحمَّل بعد: equipment_combined.js وaddtarget.js
   ==================================================== */

/* ══════════════════════════════════════
   1. توسيع eqSwitchFormTab لدعم تبويب المستهدف
══════════════════════════════════════ */
(function patchEqSwitchFormTab() {
    const _origSwitch = window.eqSwitchFormTab;

    window.eqSwitchFormTab = function(tab) {
        // التعامل مع تبويب المستهدف
        const bodyTarget = document.getElementById('eqfBodyTarget');
        const btnTarget  = document.getElementById('eqfTabTarget');

        if (tab === 'target') {
            // أخفِ التبويبات الأخرى
            const bodyDaily = document.getElementById('eqfBodyDaily');
            const bodyCumul = document.getElementById('eqfBodyCumul');
            if (bodyDaily) bodyDaily.style.display = 'none';
            if (bodyCumul) bodyCumul.style.display = 'none';
            if (bodyTarget) bodyTarget.style.display = 'block';

            // أزل الـ active من أزرار التبويبات الأخرى
            ['eqfTabDaily','eqfTabCumul'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.style.background = 'transparent';
                    btn.style.color      = 'rgba(255,255,255,0.65)';
                }
            });
            if (btnTarget) {
                btnTarget.style.background = 'rgba(255,255,255,0.9)';
                btnTarget.style.color      = '#1a0a2e';
            }

            // تحديث زر الحفظ
            const submitBtn = document.getElementById('eqf_submit_btn');
            if (submitBtn) submitBtn.onclick = window.tgtSubmitForm;

            // تهيئة التبويب
            if (window.tgtInitTab) tgtInitTab();
            return;
        }

        // للتبويبات الأخرى — أخفِ تبويب المستهدف
        if (bodyTarget) bodyTarget.style.display = 'none';
        if (btnTarget) {
            btnTarget.style.background = 'transparent';
            btnTarget.style.color      = 'rgba(255,255,255,0.65)';
        }

        // استدعِ الدالة الأصلية
        if (_origSwitch) _origSwitch(tab);
    };
})();

/* ══════════════════════════════════════
   2. فتح المودال مباشرة على تبويب المستهدف
══════════════════════════════════════ */
window.openTargetFormTab = function() {
    if (window.openEquipmentFormModal) {
        openEquipmentFormModal();
    } else {
        const modal = document.getElementById('equipmentFormModal');
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    // انتظر قليلاً ثم انتقل للتبويب
    setTimeout(function() {
        if (window.eqSwitchFormTab) eqSwitchFormTab('target');
    }, 80);
};

/* ══════════════════════════════════════
   3. توسيع saveSheetIds لحفظ TARGET_SHEET_ID و TARGET_SCRIPT_URL
══════════════════════════════════════ */
(function patchSaveSheetIds() {
    const _origSave = window.saveSheetIds;

    window.saveSheetIds = function() {
        // حفظ الحقول الإضافية قبل استدعاء الدالة الأصلية
        const targetSheetInput  = document.getElementById('sheetId_target');
        const targetScriptInput = document.getElementById('sheetId_targetScript');

        if (!window.sheetIdsConfig) window.sheetIdsConfig = {};

        if (targetSheetInput && targetSheetInput.value.trim()) {
            const raw = targetSheetInput.value.trim();
            const m   = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
            const id  = m ? m[1] : raw;
            if (id) {
                window.sheetIdsConfig['TARGET_SHEET_ID'] = id;
                window.TARGET_SHEET_ID = id;
                // تحديث رابط الفتح
                const link = document.getElementById('sheetLink_target');
                if (link && id) link.href = 'https://docs.google.com/spreadsheets/d/' + id;
            }
        }

        if (targetScriptInput && targetScriptInput.value.trim()) {
            const url = targetScriptInput.value.trim();
            window.sheetIdsConfig['TARGET_SCRIPT_URL'] = url;
            window.TARGET_SCRIPT_URL = url;
        }

        // استدعِ الدالة الأصلية
        if (_origSave) _origSave();
    };
})();

/* ══════════════════════════════════════
   4. توسيع _fillSheetIdsInputs لعرض TARGET_SHEET_ID و TARGET_SCRIPT_URL
══════════════════════════════════════ */
(function patchFillSheetIds() {
    const _origFill = window._fillSheetIdsInputs;

    window._fillSheetIdsInputs = function() {
        // استدعِ الأصلية أولاً
        if (_origFill) _origFill();

        const cfg = window.sheetIdsConfig || {};

        // TARGET_SHEET_ID
        const targetSheetInput = document.getElementById('sheetId_target');
        const targetSheetLink  = document.getElementById('sheetLink_target');
        const targetSheetId    = cfg['TARGET_SHEET_ID'] || window.TARGET_SHEET_ID || '';
        if (targetSheetInput) {
            targetSheetInput.value = targetSheetId
                ? 'https://docs.google.com/spreadsheets/d/' + targetSheetId
                : '';
        }
        if (targetSheetLink && targetSheetId) {
            targetSheetLink.href = 'https://docs.google.com/spreadsheets/d/' + targetSheetId;
        }

        // TARGET_SCRIPT_URL
        const targetScriptInput = document.getElementById('sheetId_targetScript');
        const targetScriptUrl   = cfg['TARGET_SCRIPT_URL'] || window.TARGET_SCRIPT_URL || '';
        if (targetScriptInput) {
            targetScriptInput.value = targetScriptUrl;
        }
    };
})();

/* ══════════════════════════════════════
   5. تطبيق sheetIdsConfig عند التحميل (TARGET_SHEET_ID)
══════════════════════════════════════ */
(function _applyTargetSheetIdOnLoad() {
    try {
        const cfg = window.sheetIdsConfig || {};
        if (cfg['TARGET_SHEET_ID'])  window.TARGET_SHEET_ID  = cfg['TARGET_SHEET_ID'];
        if (cfg['TARGET_SCRIPT_URL']) window.TARGET_SCRIPT_URL = cfg['TARGET_SCRIPT_URL'];
    } catch(e) {}
})();

/* ══════════════════════════════════════
   6. إضافة زر المستهدف في قائمة الموبايل (mobileMenu)
      يُنفَّذ بعد تحميل الـ DOM
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    // أضف بند المستهدف في قائمة الموبايل
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        // ابحث عن قسم "إضافة"
        const goldRows = mobileMenu.querySelectorAll('.mmRow-gold');
        if (goldRows.length) {
            const lastGoldRow = goldRows[goldRows.length - 1];
            const targetRow = document.createElement('div');
            targetRow.className = 'mmRow';
            targetRow.style.cssText = 'background:rgba(245,200,66,0.06);border-color:rgba(245,200,66,0.15);color:rgba(255,255,255,0.85);';
            targetRow.innerHTML = '<span style="font-size:17px;">🎯</span><span>المستهدف الشهري</span>';
            targetRow.onclick = function() {
                if (window.closeMobileMenu) closeMobileMenu();
                setTimeout(function() {
                    if (window.openTargetFormTab) openTargetFormTab();
                }, 50);
            };
            lastGoldRow.insertAdjacentElement('afterend', targetRow);
        }
    }

    // أضف زر تبويب المستهدف في header المودال إن لم يكن موجوداً
    _ensureTargetTabButton();
});

function _ensureTargetTabButton() {
    if (document.getElementById('eqfTabTarget')) return; // موجود مسبقاً

    const tabCumul = document.getElementById('eqfTabCumul');
    if (!tabCumul || !tabCumul.parentElement) return;

    const btn = document.createElement('button');
    btn.id = 'eqfTabTarget';
    btn.onclick = function() { if (window.eqSwitchFormTab) eqSwitchFormTab('target'); };
    btn.style.cssText = 'padding:7px 16px;border:none;border-radius:8px;font-size:12px;font-weight:900;font-family:\'Cairo\',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.65);white-space:nowrap;';
    btn.textContent = '🎯 المستهدف';
    tabCumul.insertAdjacentElement('afterend', btn);
}

/* ══════════════════════════════════════
   7. إضافة قسم eqfBodyTarget إن لم يكن موجوداً
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    _ensureTargetFormBody();
});

function _ensureTargetFormBody() {
    if (document.getElementById('eqfBodyTarget')) return;

    const bodyCumul = document.getElementById('eqfBodyCumul');
    if (!bodyCumul) return;

    const TARGET_MONTHS_AR = [
        'يناير','فبراير','مارس','أبريل','مايو','يونيو',
        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
    ];

    const div = document.createElement('div');
    div.id = 'eqfBodyTarget';
    div.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:20px 24px;';
    div.innerHTML = `

        <!-- عنصر البحث + اختيار من الخريطة -->
        <div style="margin-bottom:16px;">
            <div class="eq-form-field">
                <label class="eq-form-label">📍 اسم العنصر</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <div style="position:relative;flex:1;">
                        <input type="text" id="eqft_element_search" class="eq-form-input"
                            placeholder="ابحث باسم العنصر أو اختر من القائمة..."
                            oninput="tgtFilterElementDropdown()"
                            onfocus="tgtShowElementDropdown()"
                            autocomplete="off"
                            style="padding-left:32px;">
                        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;opacity:0.4;pointer-events:none;">🔍</span>
                        <div id="eqft_element_dropdown"
                            style="display:none;position:absolute;top:calc(100% + 4px);right:0;left:0;
                                   background:#1a1a2e;border:1px solid rgba(106,45,145,0.4);border-radius:10px;
                                   z-index:9999;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
                        </div>
                    </div>
                    <button onclick="tgtPickFromMap()"
                        title="اختر عنصراً من الخريطة"
                        style="flex-shrink:0;padding:10px 14px;background:linear-gradient(135deg,#3d1060,#6a2d91);border:none;border-radius:9px;color:white;font-size:13px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap;transition:all 0.2s;box-shadow:0 2px 10px rgba(106,45,145,0.35);">
                        🗺 من الخريطة
                    </button>
                </div>
                <div id="eqft_element_info" style="display:none;margin-top:8px;padding:8px 12px;background:rgba(106,45,145,0.1);border:1px solid rgba(106,45,145,0.3);border-radius:8px;align-items:center;gap:10px;">
                    <span style="font-size:16px;">✅</span>
                    <div style="flex:1;">
                        <div id="eqft_element_info_name" style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);font-family:'Cairo',sans-serif;"></div>
                        <div id="eqft_element_info_id"   style="font-size:10px;color:rgba(255,255,255,0.45);font-family:'Cairo',sans-serif;margin-top:2px;"></div>
                    </div>
                    <button onclick="tgtClearElement()" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:16px;padding:2px 6px;">✕</button>
                </div>
                <input type="hidden" id="eqft_element_id">
                <input type="hidden" id="eqft_element_name">
            </div>
        </div>

        <!-- المجموعة + البند الرئيسي -->
        <div class="eq-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div class="eq-form-field">
                <label class="eq-form-label">🗂 المجموعة</label>
                <input type="text" id="eqft_group_name" class="eq-form-input" readonly placeholder="—"
                    style="opacity:0.65;cursor:default;background:rgba(255,255,255,0.03);">
                <input type="hidden" id="eqft_group_id">
            </div>
            <div class="eq-form-field">
                <label class="eq-form-label">📁 البند الرئيسي</label>
                <input type="text" id="eqft_cat_name" class="eq-form-input" readonly placeholder="—"
                    style="opacity:0.65;cursor:default;background:rgba(255,255,255,0.03);">
                <input type="hidden" id="eqft_cat_id">
            </div>
        </div>

        <!-- البند + المقاول -->
        <div class="eq-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
            <div class="eq-form-field">
                <label class="eq-form-label">📋 البند</label>
                <input type="hidden" id="eqft_item_name">
                <input type="hidden" id="eqft_band_sheet">
                <input type="text" id="eqft_band_display" class="eq-form-input" readonly
                    placeholder="يُملأ تلقائياً عند اختيار العنصر"
                    style="opacity:0.7;cursor:default;background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.08);">
            </div>
            <div class="eq-form-field">
                <label class="eq-form-label">👷 المقاول</label>
                <select id="eqft_contractor" class="eq-form-input" style="cursor:pointer;appearance:auto;-webkit-appearance:auto;">
                    <option value="">-- اختر المقاول --</option>
                </select>
            </div>
        </div>

        <!-- الشهر -->
        <div style="margin-bottom:16px;">
            <div class="eq-form-field">
                <label class="eq-form-label">📅 الشهر المستهدف</label>
                <select id="eqft_month" class="eq-form-input" style="cursor:pointer;appearance:auto;-webkit-appearance:auto;max-width:300px;">
                    <option value="">-- اختر الشهر --</option>
                </select>
            </div>
        </div>

        <!-- بيانات الكمية والسعر -->
        <div style="border:1px solid rgba(245,200,66,0.25);border-radius:12px;overflow:hidden;margin-bottom:20px;">
            <div style="background:linear-gradient(135deg,rgba(245,200,66,0.15),rgba(184,134,11,0.1));padding:12px 16px;border-bottom:1px solid rgba(245,200,66,0.15);">
                <span style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.9);font-family:'Cairo',sans-serif;">🎯 بيانات المستهدف</span>
            </div>
            <div style="padding:16px;">
                <!-- السعر -->
                <div class="eq-form-field" style="margin-bottom:14px;">
                    <label class="eq-form-label" style="color:rgba(255,200,66,0.9);">
                        💵 السعر
                        <span style="font-size:9px;opacity:0.6;margin-right:4px;">(ريال / وحدة)</span>
                    </label>
                    <input type="number" id="eqft_price" placeholder="0.00" min="0" step="0.01"
                        class="eq-form-input"
                        style="border-color:rgba(255,200,66,0.35);max-width:260px;"
                        oninput="tgtCalcTargetValue()"
                        onfocus="this.style.borderColor='rgba(255,200,66,0.75)'"
                        onblur="this.style.borderColor='rgba(255,200,66,0.35)'">
                </div>

                <div class="eq-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
                    <div class="eq-form-field">
                        <label class="eq-form-label" style="color:rgba(92,200,144,0.9);">
                            🎯 الكمية المستهدفة
                            <span style="font-size:9px;opacity:0.6;margin-right:4px;">(TARGET-QTY)</span>
                        </label>
                        <input type="number" id="eqft_target_qty" placeholder="0.00" min="0" step="0.01"
                            class="eq-form-input"
                            style="border-color:rgba(92,200,144,0.35);"
                            oninput="tgtCalcTargetValue()"
                            onfocus="this.style.borderColor='rgba(92,200,144,0.75)'"
                            onblur="this.style.borderColor='rgba(92,200,144,0.35)'">
                    </div>
                    <div class="eq-form-field">
                        <label class="eq-form-label" style="color:rgba(91,173,223,0.9);">
                            📦 الكمية المتبقية
                            <span style="font-size:9px;opacity:0.6;margin-right:4px;">(REMAINING-QTY)</span>
                        </label>
                        <input type="number" id="eqft_remaining_qty" placeholder="0.00" min="0" step="0.01"
                            class="eq-form-input"
                            style="border-color:rgba(91,173,223,0.35);"
                            oninput="tgtCalcTargetValue()"
                            onfocus="this.style.borderColor='rgba(91,173,223,0.75)'"
                            onblur="this.style.borderColor='rgba(91,173,223,0.35)'">
                    </div>
                </div>

                <div class="eq-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div class="eq-form-field">
                        <label class="eq-form-label" style="color:rgba(245,200,66,0.7);">
                            💰 القيمة المستهدفة
                            <span style="font-size:9px;opacity:0.5;margin-right:4px;">(محسوبة تلقائياً)</span>
                        </label>
                        <input type="text" id="eqft_target_value" class="eq-form-input" readonly
                            placeholder="السعر × الكمية المستهدفة"
                            style="opacity:0.85;cursor:default;background:rgba(245,200,66,0.05);border-color:rgba(245,200,66,0.2);font-weight:700;">
                    </div>
                    <div class="eq-form-field">
                        <label class="eq-form-label" style="color:rgba(91,173,223,0.7);">
                            💸 القيمة المتبقية
                            <span style="font-size:9px;opacity:0.5;margin-right:4px;">(محسوبة تلقائياً)</span>
                        </label>
                        <input type="text" id="eqft_remaining_value" class="eq-form-input" readonly
                            placeholder="السعر × الكمية المتبقية"
                            style="opacity:0.85;cursor:default;background:rgba(91,173,223,0.05);border-color:rgba(91,173,223,0.2);font-weight:700;">
                    </div>
                </div>
            </div>
        </div>

        <div id="eqft_feedback" style="display:none;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Cairo',sans-serif;text-align:center;margin-bottom:8px;"></div>
    `;

    bodyCumul.insertAdjacentElement('afterend', div);
}

/* ══════════════════════════════════════
   8. إضافة صف المستهدف في settingsTabSheets
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    _ensureTargetSheetFields();
});

function _ensureTargetSheetFields() {
    if (document.getElementById('sheetId_target')) return;

    const sheetsTab = document.getElementById('settingsTabSheets');
    if (!sheetsTab) return;

    // أضف حقلَي المستهدف قبل زر الحفظ
    const saveBtn = sheetsTab.querySelector('button[onclick="saveSheetIds()"]');
    if (!saveBtn) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <!-- شيت المستهدف -->
        <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:6px;font-family:'Cairo',sans-serif;">
                🎯 شيت المستهدف
                <span style="font-size:9px;opacity:0.5;margin-right:4px;">(TARGET_SHEET_ID)</span>
            </label>
            <div style="display:flex;gap:7px;align-items:center;">
                <input type="text" id="sheetId_target" class="settings-input"
                    style="flex:1;font-size:11px;font-family:monospace;"
                    placeholder="https://docs.google.com/spreadsheets/d/...">
                <a id="sheetLink_target" href="#" target="_blank"
                    style="flex-shrink:0;padding:8px 10px;background:rgba(106,45,145,0.1);border:1px solid rgba(106,45,145,0.3);border-radius:7px;color:#c39bd3;font-size:11px;text-decoration:none;white-space:nowrap;"
                    title="فتح الشيت">🔗</a>
            </div>
            <div style="margin-top:4px;font-size:10px;color:rgba(255,255,255,0.3);font-family:'Cairo',sans-serif;text-align:right;line-height:1.6;">
                شيت يُخزَّن فيه المستهدف الشهري لكل عنصر
            </div>
        </div>
        <!-- رابط سكريبت المستهدف -->
        <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:6px;font-family:'Cairo',sans-serif;">
                🔧 رابط سكريبت المستهدف (Apps Script)
                <span style="font-size:9px;opacity:0.5;margin-right:4px;">(TARGET_SCRIPT_URL)</span>
            </label>
            <div style="display:flex;gap:7px;align-items:center;">
                <input type="text" id="sheetId_targetScript" class="settings-input"
                    style="flex:1;font-size:11px;font-family:monospace;"
                    placeholder="https://script.google.com/macros/s/...">
            </div>
            <div style="margin-top:4px;font-size:10px;color:rgba(255,255,255,0.3);font-family:'Cairo',sans-serif;text-align:right;line-height:1.6;">
                Web App يتلقى بيانات المستهدف ويكتبها في الشيت
            </div>
        </div>
    `;
    saveBtn.insertAdjacentElement('beforebegin', wrapper);
}

/* ══════════════════════════════════════
   9. إضافة بند المستهدف في addDropdown
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    _ensureTargetDropdownItem();
});

function _ensureTargetDropdownItem() {
    const addDropdown = document.getElementById('addDropdown');
    if (!addDropdown || addDropdown.querySelector('[data-target-row]')) return;

    const item = document.createElement('div');
    item.className = 'tab-sub-item';
    item.dataset.targetRow = '1';
    item.innerHTML = `<span style="font-size:14px;">🎯</span><label>المستهدف الشهري</label>`;
    item.onclick = function() {
        if (window.openTargetFormTab) openTargetFormTab();
        if (window.closeAddDropdown) closeAddDropdown();
    };
    addDropdown.appendChild(item);
}

console.log('[target_patch] تم تحميل ملحق المستهدف بنجاح ✅');
