/* ====================================================
   addtarget.js — شاشة المستهدف الشهري (مودال مستقل)
   ==================================================== */

const TARGET_MONTHS_AR = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
];

/* ══════════════════════════════════════
   إنشاء المودال في الـ DOM تلقائياً
══════════════════════════════════════ */
(function _injectTargetModal() {
    if (document.getElementById('targetFormModal')) return;

    const html = `
<div id="targetFormModal" style="display:none;position:fixed;inset:0;z-index:65500;padding:20px;align-items:center;justify-content:center;background:rgba(10,5,20,0.75);backdrop-filter:blur(6px);">
    <div id="tgtFormBox" style="position:relative;z-index:2;display:flex;flex-direction:column;width:min(780px,96vw);max-height:calc(100vh - 40px);background:#0d0d1a;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 32px 80px rgba(0,0,0,0.7);animation:tgtSlideIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1a0a2e 0%,#4a1470 50%,#1a0a2e 100%);padding:18px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;gap:12px;">
            <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:44px;height:44px;background:linear-gradient(135deg,#f5c842,#e8a800);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 4px 16px rgba(245,200,66,0.35);">🎯</div>
                <div>
                    <div style="font-size:17px;font-weight:900;color:white;font-family:'Cairo',sans-serif;">تسجيل المستهدف الشهري</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;font-family:'Cairo',sans-serif;">إضافة مستهدف إنتاج لعنصر وشهر محدد</div>
                </div>
            </div>
            <button onclick="closeTargetFormModal()" style="width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.18s;" onmouseover="this.style.background='rgba(244,67,54,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">✕</button>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px;" id="tgtFormBody">

            <!-- عنصر البحث -->
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
                                style="display:none;position:absolute;top:calc(100% + 4px);right:0;left:0;background:#1a1a2e;border:1px solid rgba(106,45,145,0.4);border-radius:10px;z-index:9999;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
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
                            <div id="eqft_element_info_id" style="font-size:10px;color:rgba(255,255,255,0.45);font-family:'Cairo',sans-serif;margin-top:2px;"></div>
                        </div>
                        <button onclick="tgtClearElement()" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:16px;padding:2px 6px;">✕</button>
                    </div>
                    <input type="hidden" id="eqft_element_id">
                    <input type="hidden" id="eqft_element_name">
                </div>
            </div>

            <!-- المجموعة + البند الرئيسي -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
                <div class="eq-form-field">
                    <label class="eq-form-label">🗂 المجموعة</label>
                    <input type="text" id="eqft_group_name" class="eq-form-input" readonly placeholder="—" style="opacity:0.65;cursor:default;background:rgba(255,255,255,0.03);">
                    <input type="hidden" id="eqft_group_id">
                </div>
                <div class="eq-form-field">
                    <label class="eq-form-label">📁 البند الرئيسي</label>
                    <input type="text" id="eqft_cat_name" class="eq-form-input" readonly placeholder="—" style="opacity:0.65;cursor:default;background:rgba(255,255,255,0.03);">
                    <input type="hidden" id="eqft_cat_id">
                </div>
            </div>

            <!-- البند + المقاول -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
                <div class="eq-form-field">
                    <label class="eq-form-label">📋 البند الفرعي</label>
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
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
                        <!-- الكمية المستهدفة -->
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
                        <!-- الكمية المتبقية -->
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
                    <!-- القيم المحسوبة -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
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

            <!-- ملاحظات -->
            <div style="margin-bottom:20px;">
                <div class="eq-form-field">
                    <label class="eq-form-label">📝 ملاحظات (اختياري)</label>
                    <textarea id="eqft_notes" placeholder="أي ملاحظات إضافية..." rows="2"
                        style="width:100%;padding:10px 13px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:9px;color:white;font-size:13px;font-family:'Cairo',sans-serif;outline:none;resize:vertical;text-align:right;direction:rtl;transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='rgba(245,200,66,0.5)'"
                        onblur="this.style.borderColor='rgba(255,255,255,0.1)'"></textarea>
                </div>
            </div>

            <!-- Feedback -->
            <div id="eqft_feedback" style="display:none;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Cairo',sans-serif;text-align:center;margin-bottom:8px;"></div>

        </div><!-- end body -->

        <!-- Footer -->
        <div style="background:rgba(0,0,0,0.25);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;gap:12px;">
            <button onclick="tgtResetForm()" class="eq-reset-btn">🔄 إعادة تعيين</button>
            <button onclick="tgtSubmitForm()" id="eqft_submit_btn" style="background:linear-gradient(135deg,#f5c842,#e8a800);border:none;color:#1a0a2e;padding:11px 28px;border-radius:10px;font-size:14px;font-weight:900;font-family:'Cairo',sans-serif;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 16px rgba(245,200,66,0.3);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">💾 حفظ المستهدف</button>
        </div>
    </div>
</div>`;

    // حقن المودال في body
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);

    // حقن CSS الأنيميشن
    if (!document.getElementById('tgtModalCSS')) {
        const style = document.createElement('style');
        style.id = 'tgtModalCSS';
        style.textContent = `
            @keyframes tgtSlideIn {
                from { opacity:0; transform:translateY(24px) scale(0.97); }
                to   { opacity:1; transform:translateY(0) scale(1); }
            }
            #targetFormModal { display: none; }
            #targetFormModal.active { display: flex !important; }

            /* موبايل: bottom-sheet */
            @media (max-width: 640px) {
                #targetFormModal {
                    padding: 0 !important;
                    align-items: flex-end !important;
                }
                #tgtFormBox {
                    width: 100% !important;
                    max-width: 100% !important;
                    max-height: 94vh !important;
                    border-radius: 20px 20px 0 0 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
})();

/* ══════════════════════════════════════
   فتح / إغلاق المودال
══════════════════════════════════════ */
function openTargetFormModal() {
    const modal = document.getElementById('targetFormModal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    tgtInitTab();
}

// يُستدعى من زر القائمة "المستهدف الشهري" — يفتح المودال المستقل دائماً
function openTargetFormTab() {
    openTargetFormModal();
}

function closeTargetFormModal() {
    const modal = document.getElementById('targetFormModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    tgtCancelPickFromMap();
}

// إغلاق عند الضغط خارج الـ box
document.addEventListener('click', function(e) {
    const modal = document.getElementById('targetFormModal');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.target === modal) closeTargetFormModal();
});

// Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('targetFormModal');
        if (modal && modal.classList.contains('active')) closeTargetFormModal();
    }
});


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
   Element selection
══════════════════════════════════════ */
let _tgtAllElements = [];

function tgtBuildElementsList() {
    _tgtAllElements = [];
    // أولاً: ابنِ من categories + allData
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
    // ثانياً: fallback — لو allData محملة بدون ربط بـ categories
    if (!_tgtAllElements.length && window.allData) {
        Object.entries(window.allData).forEach(([sheetId, data]) => {
            let subName = sheetId;
            (window.categories || []).forEach(cat => {
                cat.subitems.forEach(sub => { if (sub.sheetId === sheetId) subName = sub.name; });
            });
            Object.values(data).forEach(row => {
                const nameKey = row['ROAD NAME'] ? 'ROAD NAME' : row['BLOCK NAME'] ? 'BLOCK NAME' : 'NAME';
                const name = (row[nameKey] || '').trim();
                const id   = (row['ID'] || '').trim();
                if (name && id) {
                    _tgtAllElements.push({ id, name, sheetId, subName });
                }
            });
        });
    }
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

    // Auto-fill بيانات البند من العنصر
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

    // أخفِ المودال النشط — إما equipmentFormModal أو targetFormModal
    const eqModal  = document.getElementById('equipmentFormModal');
    const tgtModal = tgt('targetFormModal');
    if (eqModal  && eqModal.classList.contains('active'))  { eqModal.style.display  = 'none'; }
    if (tgtModal && tgtModal.classList.contains('active')) { tgtModal.style.display = 'none'; }

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
                    if (d < nearestDist) {
                        nearestDist = d;
                        const row = allData[sheetId][f.feature.properties.ID];
                        if (row) nearest = row;
                    }
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

    // أعد إظهار المودال الصحيح
    const eqModal  = document.getElementById('equipmentFormModal');
    const tgtModal = tgt('targetFormModal');
    if (eqModal  && eqModal.classList.contains('active'))  { eqModal.style.display  = 'flex'; }
    if (tgtModal && tgtModal.classList.contains('active')) { tgtModal.style.display = 'flex'; }

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
     'eqft_price','eqft_target_value','eqft_remaining_value','eqft_notes'].forEach(id => {
        const el = tgt(id); if (el) el.value = '';
    });
    tgtPopulateMonths();
    tgtHideFeedback();
}

/* ══════════════════════════════════════
   Submit
══════════════════════════════════════ */
async function tgtSubmitForm() {
    tgtHideFeedback();

    const element_id    = (tgt('eqft_element_id')   || {}).value?.trim() || '';
    const element_name  = (tgt('eqft_element_name') || {}).value?.trim() || '';
    const item_name     = (tgt('eqft_item_name')    || {}).value?.trim() || '';
    const cat_name      = (tgt('eqft_cat_name')     || {}).value?.trim() || '';
    const group_name    = (tgt('eqft_group_name')   || {}).value?.trim() || '';
    const contractor    = (tgt('eqft_contractor')   || {}).value?.trim() || '';
    const month         = (tgt('eqft_month')         || {}).value?.trim() || '';
    const target_qty    = parseFloat((tgt('eqft_target_qty')   || {}).value) || 0;
    const remaining_qty = parseFloat((tgt('eqft_remaining_qty') || {}).value) || 0;
    const price         = parseFloat((tgt('eqft_price')         || {}).value) || 0;
    const band_sheet    = (tgt('eqft_band_sheet')   || {}).value?.trim() || '';
    const notes         = (tgt('eqft_notes')        || {}).value?.trim() || '';

    // Validation
    if (!element_name) { tgtShowFeedback('❌ يرجى اختيار اسم العنصر', 'error'); return; }
    if (!item_name)    { tgtShowFeedback('❌ يرجى اختيار البند', 'error'); return; }
    if (!contractor)   { tgtShowFeedback('❌ يرجى اختيار المقاول', 'error'); return; }
    if (!month)        { tgtShowFeedback('❌ يرجى اختيار الشهر', 'error'); return; }
    if (!target_qty || target_qty <= 0) { tgtShowFeedback('❌ يرجى إدخال الكمية المستهدفة', 'error'); return; }

    // جلب رابط السكريبت
    const targetScriptUrl = (window.sheetIdsConfig && window.sheetIdsConfig['TARGET_SCRIPT_URL'])
                          || window.TARGET_SCRIPT_URL || '';

    if (!targetScriptUrl) {
        tgtShowFeedback('❌ لم يتم إعداد رابط سكريبت المستهدف — الإعدادات ← روابط الشيتات', 'error');
        return;
    }

    const btn = tgt('eqft_submit_btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }
    tgtShowFeedback('⏳ جاري إرسال البيانات...', 'loading');

    const added_by = (window.currentUser && currentUser.email) ? currentUser.email
                   : (window.currentUser && currentUser.name ? currentUser.name : '');
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
        band_sheet, added_by, notes,
        timestamp: new Date().toISOString()
    };

    try {
        const r = await fetch(targetScriptUrl, {
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
        if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ المستهدف'; }
    }
}

/* ══════════════════════════════════════
   Init
══════════════════════════════════════ */
function tgtInitTab() {
    tgtBuildElementsList();
    tgtPopulateContractors();
    tgtPopulateMonths();
}

/* ══════════════════════════════════════
   Expose to window
══════════════════════════════════════ */
window.openTargetFormModal      = openTargetFormModal;
window.openTargetFormTab        = openTargetFormTab;
window.closeTargetFormModal     = closeTargetFormModal;
window.tgtSelectElement         = tgtSelectElement;
window.tgtClearElement          = tgtClearElement;
window.tgtShowElementDropdown   = tgtShowElementDropdown;
window.tgtFilterElementDropdown = tgtFilterElementDropdown;
window.tgtPickFromMap           = tgtPickFromMap;
window.tgtCancelPickFromMap     = tgtCancelPickFromMap;
window.tgtCalcTargetValue       = tgtCalcTargetValue;
window.tgtResetForm             = tgtResetForm;
window.tgtSubmitForm            = tgtSubmitForm;
window.tgtInitTab               = tgtInitTab;
window.tgtPopulateMonths        = tgtPopulateMonths;
