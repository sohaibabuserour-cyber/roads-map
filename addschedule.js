/* ============================================================
   addschedule.js
   منطق "الجدول الزمني" داخل شاشة "إضافة" — Sidebar Panel.
   نسخة موازية لمنطق Schedule فى main.js مع بادئة addSched
   لتجنّب التعارض بالـ IDs.

   تبويبان فرعيان:
     - بنود البرنامج الزمني  (مرتبط ببنود جدول الكميات)
     - خطة القيمة المخططة    (تاريخ + قيمة + تراكمى)

   يعتمد على:
     parseCSVLine, _esc, fmtNum, normItemNo, cmpItemNo,
     parseDelimitedText, detectHeaderRow, normDateInput,
     getConfigScriptUrl, getConfigSheetId, getCurrentUser — utils.js
     LV.showOverlay/hideOverlay/updateOverlay  — main.js
     showAlert                                 — main.js
     sheetIdsConfig / SCHEDULE_SHEET_ID /
       SCHEDULE_SCRIPT_URL / BOQ_SHEET_ID      — config.js
     currentUser                               — auth.js
   ============================================================ */
(function () {
    'use strict';

    /* ===================== State ===================== */
    window._addSchedEditItemRow = null;
    window._addSchedEditPlanRow = null;
    window._addSchedItems = [];
    window._addSchedPlan  = [];
    window._addSchedBoqList = [];     // [{no, desc}]
    window._addSchedActiveTab = 'items';
    let   _rendered = false;

    /* ===================== Inject scoped CSS (combo + scrollbar) ===================== */
    function _injectStyle(){
        if (document.getElementById('addSchedStyle')) return;
        const s = document.createElement('style');
        s.id = 'addSchedStyle';
        s.textContent = `
        #addScheduleRoot .ascd-combo{position:relative;}
        #addScheduleRoot .ascd-combo-btn{width:100%;min-height:38px;box-sizing:border-box;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-family:'Cairo',sans-serif;font-size:13px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;text-align:right;cursor:pointer;}
        #addScheduleRoot .ascd-combo-btn:hover{border-color:rgba(144,202,249,.45);}
        #addScheduleRoot .ascd-combo-label{flex:1;white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.55;overflow:hidden;}
        #addScheduleRoot .ascd-combo-arrow{flex-shrink:0;line-height:1.5;color:rgba(255,255,255,.65);}
        #addScheduleRoot .ascd-combo-menu{display:none;position:absolute;z-index:50;inset-inline:0;top:calc(100% + 4px);max-height:min(60vh,360px);overflow-y:auto;overflow-x:hidden;border:1px solid rgba(144,202,249,.35);border-radius:8px;background:#10182f;box-shadow:0 14px 34px rgba(0,0,0,.45);padding:4px;overscroll-behavior:contain;}
        #addScheduleRoot .ascd-combo-menu::-webkit-scrollbar{width:8px;}
        #addScheduleRoot .ascd-combo-menu::-webkit-scrollbar-thumb{background:rgba(144,202,249,.35);border-radius:4px;}
        #addScheduleRoot .ascd-combo-menu::-webkit-scrollbar-track{background:transparent;}
        #addScheduleRoot .ascd-combo-menu.active{display:block;}
        #addScheduleRoot .ascd-combo-option{padding:8px 10px;border-radius:6px;color:#eaf2ff;font-family:'Cairo',sans-serif;font-size:12px;line-height:1.6;white-space:normal;overflow-wrap:anywhere;word-break:normal;cursor:pointer;}
        #addScheduleRoot .ascd-combo-option:hover,
        #addScheduleRoot .ascd-combo-option.selected{background:rgba(33,150,243,.18);color:#fff;}
        #addScheduleRoot .ascd-hidden-select{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}

        /* Styled scrollbar on the table wrap only — matches BOQ popup */
        #addScheduleRoot .boq-table-wrap{overflow:auto;scrollbar-width:thin;scrollbar-color:#1a7a4a rgba(255,255,255,.04);}
        #addScheduleRoot .boq-table-wrap::-webkit-scrollbar{width:10px;height:10px;}
        #addScheduleRoot .boq-table-wrap::-webkit-scrollbar-track{background:rgba(255,255,255,.04);border-radius:8px;}
        #addScheduleRoot .boq-table-wrap::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#3aaa5c,#1a7a4a);border-radius:8px;border:2px solid transparent;background-clip:content-box;}
        #addScheduleRoot .boq-table-wrap::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#4cc370,#1f8a55);background-clip:content-box;border:2px solid transparent;}
        #addScheduleRoot .boq-table-wrap::-webkit-scrollbar-corner{background:transparent;}
        #addScheduleRoot .boq-data{min-width:760px;}
        `;
        document.head.appendChild(s);
    }


    /* ===================== Helpers ===================== */
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'schedule') el.textContent = msg || '';
    }
    async function _post(payload){
        const url = getConfigScriptUrl('SCHEDULE_SCRIPT_URL', 'SCHEDULE_SCRIPT_URL', 'SCHEDULE_SCRIPT_URL');
        if (!url) throw new Error('⚠️ أضف رابط سكريبت البرنامج الزمنى فى الإعدادات');
        const sheetId = getConfigSheetId('SCHEDULE_SHEET_ID', window.SCHEDULE_SHEET_ID);
        if (!sheetId) throw new Error('⚠️ أضف SCHEDULE_SHEET_ID فى الإعدادات');
        const res = await fetch(url, {
            method:'POST', redirect:'follow',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({ ...payload, sheetId })
        });
        const text = await res.text();
        let result; try { result = JSON.parse(text); }
        catch(_) { throw new Error('استجابة غير صالحة: ' + text.slice(0,200)); }
        if (!result || !result.success) throw new Error((result && (result.message || result.error)) || 'فشل غير معروف');
        return result;
    }

    /* ===================== Render Panel ===================== */
    function _render(root){
        _injectStyle();
        root.classList.remove('panel-placeholder');
        if (!root.id) root.id = 'addScheduleRoot';
        root.innerHTML = `

        <!-- Sub-tabs (Items / Plan) -->
        <div style="display:flex;gap:6px;margin-bottom:10px;background:rgba(0,0,0,0.18);padding:6px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <button type="button" id="addSchedTabItemsBtn" class="add-sub-tab" data-sub="items"
                style="flex:1;padding:9px 12px;border:1px solid rgba(58,170,92,0.45);border-radius:7px;background:rgba(58,170,92,0.18);color:#a8e6bc;font-weight:800;font-family:'Cairo',sans-serif;font-size:12px;cursor:pointer;">
                📌 بنود البرنامج الزمنى
            </button>
            <button type="button" id="addSchedTabPlanBtn" class="add-sub-tab" data-sub="plan"
                style="flex:1;padding:9px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:7px;background:transparent;color:rgba(255,255,255,0.6);font-weight:800;font-family:'Cairo',sans-serif;font-size:12px;cursor:pointer;">
                📈 خطة القيمة المخططة
            </button>
        </div>

        <!-- Panel: Items -->
        <div id="addSchedPanelItems" style="display:flex;flex-direction:column;flex:1;min-height:0;">
            <div id="addSchedItemsFormWrap">
                <div class="edit-badge">✏️ تعديل بند موجود — اضغط حفظ للتحديث</div>
                <div class="boq-form" style="grid-template-columns:140px 1fr 140px 140px auto;">
                    <div>
                        <label>رقم البند</label>
                        <div class="ascd-combo" id="addSchedItemNoCombo">
                            <button type="button" class="ascd-combo-btn" id="addSchedItemNoSelectBtn" onclick="toggleAddSchedItemNoMenu(event)" title="— اختر رقم —">
                                <span class="ascd-combo-label" id="addSchedItemNoSelectLabel">— اختر رقم —</span>
                                <span class="ascd-combo-arrow">▾</span>
                            </button>
                            <select id="addSchedItemNoSelect" class="ascd-hidden-select" onchange="onAddSchedItemNoChange()" tabindex="-1" aria-hidden="true">
                                <option value="">— اختر رقم —</option>
                            </select>
                            <div class="ascd-combo-menu" id="addSchedItemNoSelectMenu"></div>
                        </div>
                    </div>
                    <div>
                        <label>البند</label>
                        <div class="ascd-combo" id="addSchedItemCombo">
                            <button type="button" class="ascd-combo-btn" id="addSchedItemSelectBtn" onclick="toggleAddSchedItemMenu(event)" title="— اختر بنداً —">
                                <span class="ascd-combo-label" id="addSchedItemSelectLabel">— اختر بنداً —</span>
                                <span class="ascd-combo-arrow">▾</span>
                            </button>
                            <select id="addSchedItemSelect" class="ascd-hidden-select" onchange="onAddSchedItemDescChange()" tabindex="-1" aria-hidden="true">
                                <option value="">— اختر بنداً —</option>
                            </select>
                            <div class="ascd-combo-menu" id="addSchedItemSelectMenu"></div>
                        </div>
                    </div>
                    <div><label>تاريخ البداية</label><input type="date" id="addSchedItemStart"></div>
                    <div><label>تاريخ النهاية</label><input type="date" id="addSchedItemEnd"></div>

                    <div class="form-actions">
                        <button class="btn-save" onclick="saveAddScheduleItem()">💾 حفظ</button>
                        <button class="btn-cancel-edit" onclick="cancelAddScheduleItemEdit()">إلغاء</button>
                    </div>
                </div>
            </div>
            <div class="boq-section-title">
                📋 بنود البرنامج الزمنى المحفوظة <span id="addSchedItemsCount" style="color:#5cc890;"></span>
                <span class="spacer"></span>
                <input type="file" id="addSchedItemsImportFile" accept=".csv,.txt" style="display:none;" onchange="importAddScheduleItemsFromFile(this)">
                <button class="btn-import" onclick="document.getElementById('addSchedItemsImportFile').click()">⬆️ رفع من ملف</button>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddScheduleData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr>
                        <th class="col-itemno">رقم البند</th>
                        <th class="col-itemdesc">البند</th>
                        <th>تاريخ البداية</th>
                        <th>تاريخ النهاية</th>
                        <th>المدة (يوم)</th>
                        <th class="col-actions"></th>
                    </tr></thead>
                    <tbody id="addSchedItemsBody"><tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        </div>

        <!-- Panel: Plan -->
        <div id="addSchedPanelPlan" style="display:none;flex-direction:column;flex:1;min-height:0;">
            <div id="addSchedPlanFormWrap">
                <div class="edit-badge">✏️ تعديل صف خطة — اضغط حفظ للتحديث</div>
                <div class="boq-form" style="grid-template-columns:1fr 1fr auto;">
                    <div><label>التاريخ</label><input type="date" id="addSchedPlanDate"></div>
                    <div><label>القيمة المخططة</label><input type="number" step="any" id="addSchedPlanValue" placeholder="0.00"></div>
                    <div class="form-actions">
                        <button class="btn-save" onclick="saveAddSchedulePlan()">💾 حفظ</button>
                        <button class="btn-cancel-edit" onclick="cancelAddSchedulePlanEdit()">إلغاء</button>
                    </div>
                </div>
            </div>
            <div class="boq-section-title">
                📈 خطة القيمة المخططة <span id="addSchedPlanCount" style="color:#5cc890;"></span>
                <span class="spacer"></span>
                <input type="file" id="addSchedPlanImportFile" accept=".csv,.txt" style="display:none;" onchange="importAddSchedulePlanFromFile(this)">
                <button class="btn-import" onclick="document.getElementById('addSchedPlanImportFile').click()">⬆️ رفع من ملف</button>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddScheduleData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr>
                        <th>التاريخ</th>
                        <th>القيمة المخططة</th>
                        <th>التراكمى</th>
                        <th>نسبة يومية %</th>
                        <th>تراكمى النسبة %</th>
                        <th class="col-actions"></th>
                    </tr></thead>
                    <tbody id="addSchedPlanBody"><tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        </div>
        `;
        _wireSubTabs();
        _wireFilters();
        _rendered = true;
    }

    function _wireSubTabs(){
        document.getElementById('addSchedTabItemsBtn').addEventListener('click', () => _switchSub('items'));
        document.getElementById('addSchedTabPlanBtn').addEventListener('click',  () => _switchSub('plan'));
    }
    function _switchSub(sub){
        window._addSchedActiveTab = sub;
        const pItems = document.getElementById('addSchedPanelItems');
        const pPlan  = document.getElementById('addSchedPanelPlan');
        const bItems = document.getElementById('addSchedTabItemsBtn');
        const bPlan  = document.getElementById('addSchedTabPlanBtn');
        const isItems = sub === 'items';
        if (pItems) pItems.style.display = isItems ? 'flex' : 'none';
        if (pPlan)  pPlan.style.display  = isItems ? 'none' : 'flex';
        if (bItems){
            bItems.style.background  = isItems ? 'rgba(58,170,92,0.18)' : 'transparent';
            bItems.style.color       = isItems ? '#a8e6bc' : 'rgba(255,255,255,0.6)';
            bItems.style.borderColor = isItems ? 'rgba(58,170,92,0.45)' : 'rgba(255,255,255,0.1)';
        }
        if (bPlan){
            bPlan.style.background  = !isItems ? 'rgba(58,170,92,0.18)' : 'transparent';
            bPlan.style.color       = !isItems ? '#a8e6bc' : 'rgba(255,255,255,0.6)';
            bPlan.style.borderColor = !isItems ? 'rgba(58,170,92,0.45)' : 'rgba(255,255,255,0.1)';
        }
    }
    function _wireFilters(){
        const fn = () => { _renderItemsTable(); _renderPlanTable(); };
        ['addSchedItemNoSelect','addSchedItemSelect','addSchedItemStart','addSchedItemEnd','addSchedPlanDate','addSchedPlanValue']
            .forEach(id => { const el = document.getElementById(id); if (el){ el.addEventListener('input', fn); el.addEventListener('change', fn); } });
    }

    /* ===================== Custom combo (description) ===================== */
    function _syncAddSchedItemDescLabel(){
        const sel = document.getElementById('addSchedItemSelect');
        const lbl = document.getElementById('addSchedItemSelectLabel');
        const btn = document.getElementById('addSchedItemSelectBtn');
        if (!sel || !lbl) return;
        const opt = sel.selectedOptions && sel.selectedOptions[0];
        const text = (opt && opt.value) ? (opt.textContent || opt.value) : '— اختر بنداً —';
        lbl.textContent = text;
        if (btn) btn.title = text;
    }
    function _buildAddSchedItemDescMenu(){
        const sel = document.getElementById('addSchedItemSelect');
        const menu = document.getElementById('addSchedItemSelectMenu');
        if (!sel || !menu) return;
        const options = Array.from(sel.options || []);
        menu.innerHTML = options.map(opt => `
            <div class="ascd-combo-option ${opt.value === sel.value ? 'selected' : ''}" data-value="${_esc(opt.value)}" title="${_esc(opt.textContent || opt.value)}">
                ${_esc(opt.textContent || opt.value)}
            </div>
        `).join('');
        menu.querySelectorAll('.ascd-combo-option').forEach(el => {
            el.addEventListener('click', () => {
                _setAddSchedItemDescValue(el.dataset.value || '');
                window.closeAddSchedItemMenu();
            });
        });
    }
    function _setAddSchedItemDescValue(value){
        const sel = document.getElementById('addSchedItemSelect');
        if (!sel) return;
        sel.value = value;
        try { window.onAddSchedItemDescChange && window.onAddSchedItemDescChange(); } catch(_){}
        _buildAddSchedItemDescMenu();
        _syncAddSchedItemDescLabel();
        _syncAddSchedItemNoLabel();
        try { sel.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
    }
    window.toggleAddSchedItemMenu = function(event){
        if (event) event.stopPropagation();
        _buildAddSchedItemDescMenu();
        _syncAddSchedItemDescLabel();
        const menu = document.getElementById('addSchedItemSelectMenu');
        if (menu) menu.classList.toggle('active');
        const other = document.getElementById('addSchedItemNoSelectMenu');
        if (other) other.classList.remove('active');
    };
    window.closeAddSchedItemMenu = function(){
        const menu = document.getElementById('addSchedItemSelectMenu');
        if (menu) menu.classList.remove('active');
    };

    /* ===================== Custom combo (item number) ===================== */
    function _syncAddSchedItemNoLabel(){
        const sel = document.getElementById('addSchedItemNoSelect');
        const lbl = document.getElementById('addSchedItemNoSelectLabel');
        const btn = document.getElementById('addSchedItemNoSelectBtn');
        if (!sel || !lbl) return;
        const opt = sel.selectedOptions && sel.selectedOptions[0];
        const text = (opt && opt.value) ? (opt.textContent || opt.value) : '— اختر رقم —';
        lbl.textContent = text;
        if (btn) btn.title = text;
    }
    function _buildAddSchedItemNoMenu(){
        const sel = document.getElementById('addSchedItemNoSelect');
        const menu = document.getElementById('addSchedItemNoSelectMenu');
        if (!sel || !menu) return;
        const options = Array.from(sel.options || []);
        menu.innerHTML = options.map(opt => `
            <div class="ascd-combo-option ${opt.value === sel.value ? 'selected' : ''}" data-value="${_esc(opt.value)}" title="${_esc(opt.textContent || opt.value)}">
                ${_esc(opt.textContent || opt.value)}
            </div>
        `).join('');
        menu.querySelectorAll('.ascd-combo-option').forEach(el => {
            el.addEventListener('click', () => {
                _setAddSchedItemNoValue(el.dataset.value || '');
                window.closeAddSchedItemNoMenu();
            });
        });
    }
    function _setAddSchedItemNoValue(value){
        const sel = document.getElementById('addSchedItemNoSelect');
        if (!sel) return;
        sel.value = value;
        try { window.onAddSchedItemNoChange && window.onAddSchedItemNoChange(); } catch(_){}
        _buildAddSchedItemNoMenu();
        _syncAddSchedItemNoLabel();
        _syncAddSchedItemDescLabel();
        try { sel.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
    }
    window.toggleAddSchedItemNoMenu = function(event){
        if (event) event.stopPropagation();
        _buildAddSchedItemNoMenu();
        _syncAddSchedItemNoLabel();
        const menu = document.getElementById('addSchedItemNoSelectMenu');
        if (menu) menu.classList.toggle('active');
        const other = document.getElementById('addSchedItemSelectMenu');
        if (other) other.classList.remove('active');
    };
    window.closeAddSchedItemNoMenu = function(){
        const menu = document.getElementById('addSchedItemNoSelectMenu');
        if (menu) menu.classList.remove('active');
    };

    document.addEventListener('click', e => {
        const c1 = document.getElementById('addSchedItemCombo');
        if (c1 && !c1.contains(e.target)) window.closeAddSchedItemMenu();
        const c2 = document.getElementById('addSchedItemNoCombo');
        if (c2 && !c2.contains(e.target)) window.closeAddSchedItemNoMenu();
    });


    /* ===================== BOQ items loader (for dropdowns) ===================== */
    async function _loadBoqList(){
        const id = getConfigSheetId('BOQ_SHEET_ID', window.BOQ_SHEET_ID, window.BILLS_SHEET_ID);
        if (!id) { window._addSchedBoqList = []; return; }
        try {
            const tabs = ['جدول الكميات','BOQ','boq','Sheet1'];
            let csv = '';
            for (const tab of tabs){
                const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
                try { const r = await fetch(u); if (r.ok){ const t = await r.text(); if (t && !t.trim().startsWith('<') && t.includes(',')){ csv = t; break; } } } catch(_){}
            }
            if (!csv){
                const u = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`;
                const r = await fetch(u); if (r.ok) csv = await r.text();
            }
            if (!csv || csv.trim().startsWith('<')) { window._addSchedBoqList = []; return; }
            const lines = csv.split(/\r?\n/).filter(l => l.trim());
            const items = []; const seen = new Set();
            for (let i = 1; i < lines.length; i++){
                const v = (typeof parseCSVLine === 'function') ? parseCSVLine(lines[i]) : lines[i].split(',');
                const no = normItemNo((v[0]||'').trim());
                const desc = (v[1]||'').trim();
                if (!no && !desc) continue;
                const key = no + '||' + desc;
                if (seen.has(key)) continue;
                seen.add(key);
                items.push({ no, desc });
            }
            window._addSchedBoqList = items;
        } catch(_) { window._addSchedBoqList = []; }
    }

    function _refreshBoqDropdown(){
        const selNo = document.getElementById('addSchedItemNoSelect');
        const selDesc = document.getElementById('addSchedItemSelect');
        if (!selNo || !selDesc) return;
        const prevNo = selNo.value, prevDesc = selDesc.value;
        selNo.innerHTML = '<option value="">— اختر رقم —</option>';
        selDesc.innerHTML = '<option value="">— اختر بنداً —</option>';
        const editingRow = window._addSchedEditItemRow;
        (window._addSchedBoqList || []).forEach(({ no, desc }) => {
            const o1 = document.createElement('option');
            o1.value = no; o1.textContent = no || '—'; o1.dataset.desc = desc;
            selNo.appendChild(o1);
            const o2 = document.createElement('option');
            o2.value = desc; o2.textContent = desc || '—'; o2.dataset.no = no; o2.title = desc || '';
            selDesc.appendChild(o2);
        });
        if (editingRow){
            const editing = (window._addSchedItems || []).find(i => i.row === editingRow);
            if (editing){
                if (editing.itemNo && !selNo.querySelector(`option[value="${CSS.escape(editing.itemNo)}"]`)){
                    const o = document.createElement('option');
                    o.value = editing.itemNo; o.textContent = editing.itemNo + ' (مخصّص)';
                    o.dataset.desc = editing.item || ''; selNo.appendChild(o);
                }
                if (editing.item && !selDesc.querySelector(`option[value="${CSS.escape(editing.item)}"]`)){
                    const o = document.createElement('option');
                    o.value = editing.item; o.textContent = editing.item + ' (مخصّص)';
                    o.dataset.no = editing.itemNo || ''; selDesc.appendChild(o);
                }
                selNo.value = editing.itemNo || ''; selDesc.value = editing.item || '';
                return;
            }
        }
        if (prevNo && selNo.querySelector(`option[value="${CSS.escape(prevNo)}"]`)) selNo.value = prevNo;
        if (prevDesc && selDesc.querySelector(`option[value="${CSS.escape(prevDesc)}"]`)) selDesc.value = prevDesc;
        _buildAddSchedItemNoMenu();
        _buildAddSchedItemDescMenu();
        _syncAddSchedItemNoLabel();
        _syncAddSchedItemDescLabel();
    }


    window.onAddSchedItemNoChange = function(){
        const selNo = document.getElementById('addSchedItemNoSelect');
        const selDesc = document.getElementById('addSchedItemSelect');
        if (!selNo || !selDesc) return;
        const opt = selNo.selectedOptions[0];
        const desc = opt ? (opt.dataset.desc || '') : '';
        if (desc && selDesc.querySelector(`option[value="${CSS.escape(desc)}"]`)) selDesc.value = desc;
        _syncAddSchedItemDescLabel();
        _syncAddSchedItemNoLabel();
    };
    window.onAddSchedItemDescChange = function(){
        const selNo = document.getElementById('addSchedItemNoSelect');
        const selDesc = document.getElementById('addSchedItemSelect');
        if (!selNo || !selDesc) return;
        const opt = selDesc.selectedOptions[0];
        const no = opt ? (opt.dataset.no || '') : '';
        if (no && selNo.querySelector(`option[value="${CSS.escape(no)}"]`)) selNo.value = no;
        _syncAddSchedItemNoLabel();
        _syncAddSchedItemDescLabel();
    };


    /* ===================== Refresh data ===================== */
    window.refreshAddScheduleData = async function(){
        _setStatus('⏳ جارى تحميل البيانات...');
        try {
            await _loadBoqList();
            const snap = await _post({ action: 'getSchedule' });
            const items = (snap.items || []).map(r => ({
                row      : r._row || r.row,
                itemNo   : normItemNo(String(r['رقم البند'] || r.itemNo || '')),
                item     : r['البند'] || r.item || '',
                startDate: normDateInput(r['تاريخ البداية'] || r.startDate),
                endDate  : normDateInput(r['تاريخ النهاية'] || r.endDate),
                days     : r['المدة (يوم)'] || r.days || ''
            })).filter(x => x.row);
            const plan = (snap.plan || []).map(r => ({
                row         : r._row || r.row,
                date        : normDateInput(r['التاريخ'] || r.date),
                plannedValue: Number(r['القيمة المخططة'] ?? r.plannedValue) || 0,
                cumValue    : Number(r['تراكمى القيمة المخططة'] ?? r['تراكمي القيمة المخططة'] ?? r.cumValue) || 0,
                dailyPct    : Number(r['نسبة المخطط اليومى %'] ?? r['نسبة المخطط اليومي %'] ?? r.dailyPct) || 0,
                cumPct      : Number(r['تراكمى نسبة المخطط اليومى %'] ?? r['تراكمي نسبة المخطط اليومي %'] ?? r.cumPct) || 0
            })).filter(x => x.row);
            window._addSchedItems = items;
            window._addSchedPlan  = plan;
            _renderItemsTable();
            _renderPlanTable();
            _refreshBoqDropdown();
            _autofillPlanDate();
            _setStatus('✅ جاهز');
        } catch(e){
            console.warn(e);
            window._addSchedItems = []; window._addSchedPlan = [];
            _renderItemsTable(); _renderPlanTable(); _refreshBoqDropdown();
            _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    /* ===================== Render tables ===================== */
    function _renderItemsTable(){
        const tb = document.getElementById('addSchedItemsBody');
        const cnt = document.getElementById('addSchedItemsCount');
        if (!tb) return;
        const all = window._addSchedItems || [];
        const fNo    = (document.getElementById('addSchedItemNoSelect')?.value || '').trim().toLowerCase();
        const fItem  = (document.getElementById('addSchedItemSelect')?.value || '').trim().toLowerCase();
        const fStart = (document.getElementById('addSchedItemStart')?.value || '').trim();
        const fEnd   = (document.getElementById('addSchedItemEnd')?.value || '').trim();
        const match  = (val, q) => !q || String(val||'').toLowerCase().includes(q);
        const items = all.filter(it =>
            match(it.itemNo, fNo) &&
            match(it.item,   fItem) &&
            (!fStart || String(it.startDate||'') === fStart) &&
            (!fEnd   || String(it.endDate||'')   === fEnd)
        ).slice().sort((a,b) => cmpItemNo(a.itemNo, b.itemNo));

        if (cnt) cnt.textContent = '(' + items.length + (items.length !== all.length ? ' / ' + all.length : '') + ')';
        if (!items.length){
            tb.innerHTML = '<tr><td colspan="6" class="boq-empty">' + (all.length ? 'لا توجد صفوف مطابقة' : 'لا توجد بنود محفوظة') + '</td></tr>';
            return;
        }
        tb.innerHTML = items.map(it => `
            <tr data-row="${it.row}" onclick="loadAddScheduleItemForEdit(${it.row})" class="${window._addSchedEditItemRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.itemNo)}</td>
                <td class="col-itemdesc" title="${_esc(it.item)}">${_esc(it.item)}</td>
                <td>${_esc(it.startDate)}</td>
                <td>${_esc(it.endDate)}</td>
                <td>${_esc(it.days)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
                    onclick="event.stopPropagation();deleteAddScheduleItem(${it.row})">🗑</button></td>
            </tr>
        `).join('');
    }
    function _renderPlanTable(){
        const tb = document.getElementById('addSchedPlanBody');
        const cnt = document.getElementById('addSchedPlanCount');
        if (!tb) return;
        const all = window._addSchedPlan || [];
        const fDate = (document.getElementById('addSchedPlanDate')?.value || '').trim();
        const fVal  = (document.getElementById('addSchedPlanValue')?.value || '').trim();
        const plan = all.filter(p =>
            (!fDate || String(p.date||'') === fDate) &&
            (!fVal  || String(p.plannedValue||'').replace(/,/g,'').includes(fVal.replace(/,/g,'')))
        );
        if (cnt) cnt.textContent = '(' + plan.length + (plan.length !== all.length ? ' / ' + all.length : '') + ')';
        if (!plan.length){
            tb.innerHTML = '<tr><td colspan="6" class="boq-empty">' + (all.length ? 'لا توجد صفوف مطابقة' : 'لا توجد صفوف خطة محفوظة') + '</td></tr>';
            return;
        }
        tb.innerHTML = plan.map(p => `
            <tr data-row="${p.row}" onclick="loadAddSchedulePlanForEdit(${p.row})" class="${window._addSchedEditPlanRow === p.row ? 'active-edit' : ''}">
                <td>${_esc(p.date)}</td>
                <td>${fmtNum(p.plannedValue)}</td>
                <td>${fmtNum(p.cumValue)}</td>
                <td>${Number(p.dailyPct||0).toFixed(2)}%</td>
                <td>${Number(p.cumPct||0).toFixed(2)}%</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
                    onclick="event.stopPropagation();deleteAddSchedulePlan(${p.row})">🗑</button></td>
            </tr>
        `).join('');
    }
    function _autofillPlanDate(){
        const dateInp = document.getElementById('addSchedPlanDate'); if (!dateInp) return;
        if (window._addSchedEditPlanRow) return;
        if (!(window._addSchedPlan || []).length) { dateInp.value = ''; return; }
        const sorted = [...window._addSchedPlan].map(p => p.date).filter(Boolean).sort();
        const last = sorted[sorted.length - 1]; if (!last) { dateInp.value = ''; return; }
        const d = (typeof window._parseAnyDate === 'function') ? window._parseAnyDate(last) : new Date(last);
        if (!d || isNaN(d)) return;
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const pad = n => String(n).padStart(2, '0');
        dateInp.value = `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}`;
    }

    /* ===================== Items form actions ===================== */
    window.loadAddScheduleItemForEdit = function(row){
        const it = (window._addSchedItems || []).find(x => x.row === row); if (!it) return;
        window._addSchedEditItemRow = row;
        const wrap = document.getElementById('addSchedItemsFormWrap'); if (wrap) wrap.classList.add('edit-mode');
        _refreshBoqDropdown();
        const selNo = document.getElementById('addSchedItemNoSelect');
        const sel   = document.getElementById('addSchedItemSelect');
        if (selNo) selNo.value = it.itemNo || '';
        if (sel)   sel.value   = it.item || '';
        _syncAddSchedItemNoLabel();
        _syncAddSchedItemDescLabel();
        document.getElementById('addSchedItemStart').value = it.startDate || '';
        document.getElementById('addSchedItemEnd').value   = it.endDate   || '';
        _renderItemsTable();

    };
    window.cancelAddScheduleItemEdit = function(){
        window._addSchedEditItemRow = null;
        const wrap = document.getElementById('addSchedItemsFormWrap'); if (wrap) wrap.classList.remove('edit-mode');
        _resetItemForm(); _refreshBoqDropdown(); _renderItemsTable();
    };
    function _resetItemForm(){
        const selNo = document.getElementById('addSchedItemNoSelect'); if (selNo) selNo.value = '';
        const sel   = document.getElementById('addSchedItemSelect');   if (sel)   sel.value   = '';
        const s = document.getElementById('addSchedItemStart'); const e = document.getElementById('addSchedItemEnd');
        if (s) s.value = ''; if (e) e.value = '';
        _syncAddSchedItemNoLabel();
        _syncAddSchedItemDescLabel();
    }

    window.saveAddScheduleItem = async function(){
        const itemNo = normItemNo(document.getElementById('addSchedItemNoSelect')?.value || '');
        const item   = document.getElementById('addSchedItemSelect')?.value || '';
        const startDate = document.getElementById('addSchedItemStart')?.value || '';
        const endDate   = document.getElementById('addSchedItemEnd')?.value || '';
        if (!item || !startDate || !endDate){ (window.showAlert||alert)('⚠️ اختر البند وأدخل التاريخين'); return; }
        const dup = (window._addSchedItems || []).find(it =>
            String(it.itemNo||'').trim() === String(itemNo).trim() &&
            String(it.item||'').trim()   === String(item).trim() &&
            it.row !== window._addSchedEditItemRow
        );
        if (dup){ (window.showAlert||alert)('⚠️ هذا البند موجود بالفعل (رقم البند والبند متطابقان)'); return; }
        _setStatus('⏳ جارى الحفظ...');
        if (window.LV) { LV.showOverlay(window._addSchedEditItemRow ? 'جارى تحديث البند...' : 'جارى حفظ البند...', 'يتم إرسال البيانات إلى الشيت'); LV.updateOverlay(0,1); }
        try {
            const user = getCurrentUser();
            if (window._addSchedEditItemRow)
                await _post({ action:'updateScheduleItem', row: window._addSchedEditItemRow, itemNo, item, startDate, endDate, user });
            else
                await _post({ action:'addScheduleItem', itemNo, item, startDate, endDate, user });
            if (window.LV) LV.updateOverlay(1,1,'تم — جارى تحديث الجدول...');
            window._addSchedEditItemRow = null;
            document.getElementById('addSchedItemsFormWrap')?.classList.remove('edit-mode');
            _resetItemForm();
            await window.refreshAddScheduleData();
            _setStatus('✅ تم الحفظ');
            if (window.LV) LV.hideOverlay();
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };
    window.deleteAddScheduleItem = async function(row){
        if (!row) return;
        if (!confirm('هل أنت متأكد من حذف هذا البند من البرنامج الزمنى؟')) return;
        if (window.LV) LV.showOverlay('جارى حذف البند...', '');
        try {
            await _post({ action:'deleteScheduleItem', row, user: getCurrentUser() });
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshAddScheduleData();
            if (window.LV) LV.hideOverlay();
            _setStatus('✅ تم الحذف');
        } catch(e){
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ===================== Plan form actions ===================== */
    window.loadAddSchedulePlanForEdit = function(row){
        const p = (window._addSchedPlan || []).find(x => x.row === row); if (!p) return;
        window._addSchedEditPlanRow = row;
        const wrap = document.getElementById('addSchedPlanFormWrap'); if (wrap) wrap.classList.add('edit-mode');
        document.getElementById('addSchedPlanDate').value  = p.date || '';
        document.getElementById('addSchedPlanValue').value = p.plannedValue || '';
        _renderPlanTable();
    };
    window.cancelAddSchedulePlanEdit = function(){
        window._addSchedEditPlanRow = null;
        const wrap = document.getElementById('addSchedPlanFormWrap'); if (wrap) wrap.classList.remove('edit-mode');
        const v = document.getElementById('addSchedPlanValue'); if (v) v.value = '';
        _autofillPlanDate(); _renderPlanTable();
    };
    window.saveAddSchedulePlan = async function(){
        const date   = document.getElementById('addSchedPlanDate')?.value  || '';
        const valStr = document.getElementById('addSchedPlanValue')?.value || '';
        if (!date){ (window.showAlert||alert)('⚠️ أدخل التاريخ'); return; }
        const plannedValue = Number(valStr) || 0;
        const dup = (window._addSchedPlan || []).find(p =>
            String(p.date||'').trim() === String(date).trim() && p.row !== window._addSchedEditPlanRow
        );
        if (dup){ (window.showAlert||alert)('⚠️ يوجد صف بنفس التاريخ — اختر تاريخاً آخر أو حدّث الصف الموجود'); return; }
        _setStatus('⏳ جارى الحفظ وإعادة الحساب...');
        if (window.LV) { LV.showOverlay(window._addSchedEditPlanRow ? 'جارى تحديث الصف...' : 'جارى حفظ الصف...', 'حفظ القيمة وإعادة حساب التراكمى'); LV.updateOverlay(0,2); }
        try {
            const user = getCurrentUser();
            if (window._addSchedEditPlanRow)
                await _post({ action:'updateSchedulePlan', row: window._addSchedEditPlanRow, date, plannedValue, user });
            else
                await _post({ action:'addSchedulePlan', date, plannedValue, user });
            if (window.LV) LV.updateOverlay(1,2,'إعادة حساب التراكمى...');
            await _post({ action:'recalcSchedulePlan', user });
            if (window.LV) LV.updateOverlay(2,2,'تم — جارى تحديث الجدول...');
            window._addSchedEditPlanRow = null;
            document.getElementById('addSchedPlanFormWrap')?.classList.remove('edit-mode');
            const v = document.getElementById('addSchedPlanValue'); if (v) v.value = '';
            await window.refreshAddScheduleData();
            _setStatus('✅ تم الحفظ');
            if (window.LV) LV.hideOverlay();
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };
    window.deleteAddSchedulePlan = async function(row){
        if (!row) return;
        if (!confirm('هل أنت متأكد من حذف صف الخطة هذا؟')) return;
        if (window.LV) LV.showOverlay('جارى حذف الصف...', '');
        try {
            await _post({ action:'deleteSchedulePlan', row, user: getCurrentUser() });
            try { await _post({ action:'recalcSchedulePlan', user: getCurrentUser() }); } catch(_){}
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshAddScheduleData();
            if (window.LV) LV.hideOverlay();
            _setStatus('✅ تم الحذف');
        } catch(e){
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ===================== CSV import ===================== */
    window.importAddScheduleItemsFromFile = async function(inputEl){
        const f = inputEl && inputEl.files && inputEl.files[0]; if (!f) return;
        try {
            const text = await f.text();
            const rows = parseDelimitedText(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            if (detectHeaderRow(rows[0], ['رقم','البند','بداية','نهاية','item','date','start','end'])) start = 1;
            const existing = new Set((window._addSchedItems || []).map(it =>
                String(it.itemNo||'').trim() + '||' + String(it.item||'').trim()));
            const seen = new Set();
            const toAdd = [];
            for (let i = start; i < rows.length; i++){
                const r = rows[i];
                const itemNo = normItemNo((r[0]||'').trim());
                const item = (r[1]||'').trim();
                const startDate = normDateInput((r[2]||'').trim());
                const endDate   = normDateInput((r[3]||'').trim());
                if (!item || !startDate || !endDate) continue;
                const key = itemNo + '||' + item;
                if (existing.has(key) || seen.has(key)) continue;
                seen.add(key);
                toAdd.push({ itemNo, item, startDate, endDate });
            }
            if (!toAdd.length){ (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة للإضافة'); return; }
            const user = getCurrentUser();
            if (window.LV) { LV.showOverlay('جارى رفع بنود البرنامج الزمنى...', `إجمالى: ${toAdd.length}`); LV.updateOverlay(0, toAdd.length); }
            _setStatus(`⏳ جارى رفع ${toAdd.length} بند...`);
            let ok = 0, fail = 0;
            try {
                await _post({ action:'bulkScheduleItems', rows: toAdd, user });
                ok = toAdd.length;
                if (window.LV) LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}`);
            } catch(_){
                for (let i = 0; i < toAdd.length; i++){
                    try { await _post(Object.assign({ action:'addScheduleItem', user }, toAdd[i])); ok++; }
                    catch(e){ fail++; }
                    if (window.LV) LV.updateOverlay(ok+fail, toAdd.length, `نجح ${ok} — فشل ${fail}`);
                }
            }
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshAddScheduleData();
            if (window.LV) LV.hideOverlay();
            _setStatus(`✅ تم رفع ${ok} بند${fail?` — فشل ${fail}`:''}`);
            (window.showAlert||alert)(`✅ تم رفع ${ok} بند${fail?` — فشل ${fail}`:''}`);
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        } finally { if (inputEl) inputEl.value = ''; }
    };

    window.importAddSchedulePlanFromFile = async function(inputEl){
        const f = inputEl && inputEl.files && inputEl.files[0]; if (!f) return;
        try {
            const text = await f.text();
            const rows = parseDelimitedText(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            if (detectHeaderRow(rows[0], ['تاريخ','قيمة','date','value','planned'])) start = 1;
            const existing = new Set((window._addSchedPlan || []).map(p => String(p.date||'').trim()));
            const seen = new Set();
            const toAdd = [];
            for (let i = start; i < rows.length; i++){
                const r = rows[i];
                const date = normDateInput((r[0]||'').trim());
                const plannedValue = Number(String(r[1]||'').replace(/[,\s]/g,'')) || 0;
                if (!date) continue;
                if (existing.has(date) || seen.has(date)) continue;
                seen.add(date);
                toAdd.push({ date, plannedValue });
            }
            if (!toAdd.length){ (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة'); return; }
            const user = getCurrentUser();
            if (window.LV) { LV.showOverlay('جارى رفع صفوف الخطة...', `إجمالى: ${toAdd.length}`); LV.updateOverlay(0, toAdd.length); }
            _setStatus(`⏳ جارى رفع ${toAdd.length} صف...`);
            let ok = 0;
            try {
                await _post({ action:'bulkSchedulePlan', rows: toAdd, user });
                ok = toAdd.length;
                if (window.LV) LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}`);
            } catch(_){
                for (const r of toAdd){
                    try { await _post(Object.assign({ action:'addSchedulePlan', user }, r)); ok++; } catch(e){}
                    if (window.LV) LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}/${toAdd.length}`);
                }
            }
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('إعادة حساب التراكمى...');
            await _post({ action:'recalcSchedulePlan', user });
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshAddScheduleData();
            if (window.LV) LV.hideOverlay();
            _setStatus(`✅ تم رفع ${toAdd.length} صف`);
            (window.showAlert||alert)(`✅ تم رفع ${toAdd.length} صف`);
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        } finally { if (inputEl) inputEl.value = ''; }
    };

    /* ===================== Activation ===================== */
    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'schedule'){
            const root = document.getElementById('addScheduleRoot');
            if (root && !_rendered) _render(root);
            window.refreshAddScheduleData();
        }
    });
})();


/* ============================================================
   منطق الجدول الزمني المنقول من main.js
   (UI Handlers + Live Preview + Delete + Missing BOQ Modal)
   ============================================================ */
/* ====================================================
   SCHEDULE UI HANDLERS — لائحة منسدلة من BOQ + عرض/تحديث الصفوف
   ==================================================== */

// State for editing
window._schedEditItemRow = null;   // sheet row number being edited (Items)
window._schedEditPlanRow = null;   // sheet row number being edited (Plan)
window._schedItems = [];           // existing items {row, item, startDate, endDate, days}
window._schedPlan  = [];           // existing plan rows
window._boqItemsList = [];         // BOQ items strings

async function _schedPost(payload) {
    const url = getConfigScriptUrl('SCHEDULE_SCRIPT_URL', 'SCHEDULE_SCRIPT_URL', 'SCHEDULE_SCRIPT_URL');
    if (!url) throw new Error('⚠️ أضف رابط سكريبت البرنامج الزمني في الإعدادات');
    const sheetId = getConfigSheetId('SCHEDULE_SHEET_ID', window.SCHEDULE_SHEET_ID);
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

function _schedSetStatus(msg) {
    const el = document.getElementById('schedStatusMsg');
    if (el) el.textContent = msg || '';
}

/* ──────── BOQ items loader ──────── */
async function _loadBoqItems() {
    const boqId = getConfigSheetId('BOQ_SHEET_ID', window.BOQ_SHEET_ID, window.BILLS_SHEET_ID);
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
            const noRaw = (v[0] || '').trim();
            const no = (typeof normItemNo === 'function') ? normItemNo(noRaw) : noRaw;
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
    try { selDesc.dispatchEvent(new Event('change', { bubbles: true })); } catch(_){}
    if (typeof window.updateScheduleItemPreview === 'function') window.updateScheduleItemPreview();
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

/* ── Item-Number custom combo (same constrained height as Item-Description) ── */
function _schedSyncItemNoLabel() {
    const selNo = document.getElementById('schedItemNoSelect');
    const label = document.getElementById('schedItemNoSelectLabel');
    const btn = document.getElementById('schedItemNoSelectBtn');
    if (!selNo || !label) return;
    const opt = selNo.selectedOptions && selNo.selectedOptions[0];
    const text = (opt && opt.value) ? (opt.textContent || opt.value) : '— اختر رقم —';
    label.textContent = text;
    if (btn) btn.title = text;
}
function _schedBuildItemNoMenu() {
    const selNo = document.getElementById('schedItemNoSelect');
    const menu = document.getElementById('schedItemNoSelectMenu');
    if (!selNo || !menu) return;
    const options = Array.from(selNo.options || []);
    menu.innerHTML = options.map(opt => `
        <div class="sched-combo-option ${opt.value === selNo.value ? 'selected' : ''}" data-value="${_esc(opt.value)}" title="${_esc(opt.textContent || opt.value)}">
            ${_esc(opt.textContent || opt.value)}
        </div>
    `).join('');
    menu.querySelectorAll('.sched-combo-option').forEach(el => {
        el.addEventListener('click', () => {
            _schedSetItemNoValue(el.dataset.value || '');
            window.closeSchedItemNoMenu();
        });
    });
}
function _schedSetItemNoValue(value) {
    const selNo = document.getElementById('schedItemNoSelect');
    if (!selNo) return;
    selNo.value = value;
    window.onSchedItemNoChange();
    _schedBuildItemNoMenu();
    _schedSyncItemNoLabel();
    try { selNo.dispatchEvent(new Event('change', { bubbles: true })); } catch(_){}
    if (typeof window.updateScheduleItemPreview === 'function') window.updateScheduleItemPreview();
}
window.toggleSchedItemNoMenu = function (event) {
    if (event) event.stopPropagation();
    _schedBuildItemNoMenu();
    _schedSyncItemNoLabel();
    const menu = document.getElementById('schedItemNoSelectMenu');
    if (menu) menu.classList.toggle('active');
};
window.closeSchedItemNoMenu = function () {
    const menu = document.getElementById('schedItemNoSelectMenu');
    if (menu) menu.classList.remove('active');
};

document.addEventListener('click', e => {
    const combo = document.getElementById('schedItemCombo');
    if (combo && !combo.contains(e.target)) window.closeSchedItemMenu();
    const comboNo = document.getElementById('schedItemNoCombo');
    if (comboNo && !comboNo.contains(e.target)) window.closeSchedItemNoMenu();
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
            _schedBuildItemNoMenu();
            _schedSyncItemNoLabel();
            return;
        }
    }
    if (prevNo && selNo.querySelector(`option[value="${CSS.escape(prevNo)}"]`)) selNo.value = prevNo;
    if (prevDesc && selDesc.querySelector(`option[value="${CSS.escape(prevDesc)}"]`)) selDesc.value = prevDesc;
    _schedBuildItemDescMenu();
    _schedSyncItemDescLabel();
    _schedBuildItemNoMenu();
    _schedSyncItemNoLabel();
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
    _schedSyncItemNoLabel();
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
    _schedSyncItemNoLabel();
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
        itemNo   : normItemNo(String(r['رقم البند'] || r.itemNo || '')),
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
    ).slice().sort((a, b) => cmpItemNo(a.itemNo, b.itemNo));

    const lbl = items.length === all.length
        ? (all.length ? `(${all.length})` : '')
        : `(${items.length} / ${all.length})`;
    if (cnt) cnt.textContent = lbl;

    if (!items.length) {
        tb.innerHTML = '<tr><td colspan="6" class="sched-empty">' + (all.length ? 'لا توجد بنود مطابقة للفلتر' : 'لا توجد بنود محفوظة') + '</td></tr>';
        return;
    }
    tb.innerHTML = items.map(it => `
        <tr data-row="${it.row}" onclick="loadScheduleItemForEdit(${it.row})" class="${window._schedEditItemRow === it.row ? 'active-edit' : ''}">
            <td>${_esc(it.itemNo)}</td>
            <td class="col-itemdesc" title="${_esc(it.item)}">${_esc(it.item)}</td>
            <td>${_esc(it.startDate)}</td>
            <td>${_esc(it.endDate)}</td>
            <td>${_esc(it.days)}</td>
            <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف" onclick="event.stopPropagation();deleteScheduleItem(${it.row})">🗑</button></td>
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
        tb.innerHTML = '<tr><td colspan="6" class="sched-empty">' + (all.length ? 'لا توجد صفوف مطابقة للفلتر' : 'لا توجد صفوف خطة محفوظة') + '</td></tr>';
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
            <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف" onclick="event.stopPropagation();deleteSchedulePlan(${p.row})">🗑</button></td>
        </tr>
    `).join('');
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
    _schedBuildItemNoMenu();
    _schedSyncItemNoLabel();
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
    _schedBuildItemNoMenu();
    _schedSyncItemNoLabel();
    const s = document.getElementById('schedItemStart');
    const e = document.getElementById('schedItemEnd');
    if (s) s.value = ''; if (e) e.value = '';
}

window.saveScheduleItem = async function () {
    const itemNo = normItemNo(document.getElementById('schedItemNoSelect')?.value || '');
    const item = document.getElementById('schedItemSelect')?.value || '';
    const startDate = document.getElementById('schedItemStart')?.value || '';
    const endDate = document.getElementById('schedItemEnd')?.value || '';
    if (!item || !startDate || !endDate) {
        (window.showAlert || alert)('⚠️ اختر البند وأدخل التاريخين');
        return;
    }
    // Duplicate-detection: BOTH itemNo AND item must match exactly (as strings).
    // "19.1" and "19.10" remain distinct.
    const itemNoStr = String(itemNo).trim();
    const itemStr   = String(item).trim();
    const dup = (window._schedItems || []).find(it =>
        String(it.itemNo || '').trim() === itemNoStr &&
        String(it.item   || '').trim() === itemStr   &&
        it.row !== window._schedEditItemRow
    );
    if (dup) {
        (window.showAlert || alert)('⚠️ هذا البند موجود بالفعل (رقم البند والبند متطابقان) — لن يتم الحفظ');
        return;
    }
    _schedSetStatus('⏳ جاري الحفظ...');
    LV.showOverlay(window._schedEditItemRow ? 'جاري تحديث البند...' : 'جاري حفظ البند...', 'يتم إرسال البيانات إلى الشيت');
    LV.updateOverlay(0, 1);
    try {
        const user = getCurrentUser();
        if (window._schedEditItemRow) {
            await _schedPost({ action: 'updateScheduleItem', row: window._schedEditItemRow, itemNo, item, startDate, endDate, user });
        } else {
            await _schedPost({ action: 'addScheduleItem', itemNo, item, startDate, endDate, user });
        }
        LV.updateOverlay(1, 1, 'تم — جاري تحديث الجدول...');
        window._schedEditItemRow = null;
        document.getElementById('schedItemsFormWrap').classList.remove('edit-mode');
        _resetItemForm();
        await refreshScheduleData();
        _schedSetStatus('✅ تم الحفظ');
        LV.hideOverlay();
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        LV.hideOverlay();
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
    LV.showOverlay(window._schedEditPlanRow ? 'جاري تحديث الصف...' : 'جاري حفظ الصف...', 'حفظ القيمة وإعادة حساب التراكمي');
    LV.updateOverlay(0, 2);
    try {
        const user = getCurrentUser();
        if (window._schedEditPlanRow) {
            await _schedPost({ action: 'updateSchedulePlan', row: window._schedEditPlanRow, date, plannedValue, user });
        } else {
            await _schedPost({ action: 'addSchedulePlan', date, plannedValue, user });
        }
        LV.updateOverlay(1, 2, 'إعادة حساب التراكمي...');
        // recalc cumulative on server
        await _schedPost({ action: 'recalcSchedulePlan', user });
        LV.updateOverlay(2, 2, 'تم — جاري تحديث الجدول...');
        window._schedEditPlanRow = null;
        document.getElementById('schedPlanFormWrap').classList.remove('edit-mode');
        const v = document.getElementById('schedPlanValue'); if (v) v.value = '';
        await refreshScheduleData();
        _schedSetStatus('✅ تم الحفظ');
        LV.hideOverlay();
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        LV.hideOverlay();
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

window.importScheduleItemsFromFile = async function (inputEl) {
    const f = inputEl && inputEl.files && inputEl.files[0];
    if (!f) return;
    try {
        const text = await _schedReadTextSmart(f);
        const rows = parseDelimitedText(text);
        if (!rows.length) throw new Error('الملف فارغ');
        // skip header
        let startIdx = 0;
        if (detectHeaderRow(rows[0], ['رقم', 'البند', 'بداية', 'نهاية', 'item', 'date', 'start', 'end'])) startIdx = 1;
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
            const itemNo = normItemNo(_schedCleanCell(r[0]));
            const item = _schedCleanCell(r[1]);
            const startDate = _normDateInput(_schedCleanCell(r[2]));
            const endDate = _normDateInput(_schedCleanCell(r[3]));
            if (!item || !startDate || !endDate) { skipped.push({ row: i + 1, itemNo, item, reason: 'بيانات ناقصة (البند/تاريخ البداية/النهاية)' }); continue; }
            const key = itemNo + '||' + item;
            const payload = { itemNo, item, startDate, endDate };
            if (existing.has(key)) { skipped.push({ row: i + 1, itemNo, item, reason: 'مكرر مع الشيت', __payload: payload }); continue; }
            if (seenInFile.has(key)) { skipped.push({ row: i + 1, itemNo, item, reason: 'مكرر داخل الملف', __payload: payload }); continue; }
            seenInFile.add(key);
            toAdd.push(payload);
        }
        // Helper to retry adding selected skipped rows
        const userForRetry = getCurrentUser();
        const retryItems = async (selectedRows) => {
            const toRetry = selectedRows.filter(r => r.__payload).map(r => r.__payload);
            if (!toRetry.length){ (window.showAlert||alert)('⚠️ الصفوف المحددة بياناتها ناقصة'); return; }
            LV.showOverlay('إعادة رفع البنود المحددة...', `إجمالي: ${toRetry.length}`);
            LV.updateOverlay(0, toRetry.length);
            let ok2 = 0, fail2 = 0;
            try {
                await _schedPost({ action: 'bulkScheduleItems', rows: toRetry, user: userForRetry });
                ok2 = toRetry.length;
                LV.updateOverlay(ok2, toRetry.length);
            } catch(_){
                for (const it of toRetry){
                    try { await _schedPost(Object.assign({ action:'addScheduleItem', user:userForRetry }, it)); ok2++; }
                    catch(e){ fail2++; }
                    LV.updateOverlay(ok2+fail2, toRetry.length);
                    await _schedYield();
                }
            }
            LV.setOverlayMsg('جاري تحديث الجدول...');
            await refreshScheduleData();
            LV.hideOverlay();
            _schedToast(`✅ تم رفع ${ok2} بند${fail2 ? ' — فشل ' + fail2 : ''}`, fail2 ? 'warning' : 'success');
        };

        // ──────── BOQ validation: ensure every itemNo exists in جدول الكميات ────────
        // نتأكد إن قائمة BOQ متحملة (قد تكون فاضية لو الشيت متحملش بعد)
        try { if (typeof _loadBoqItems === 'function' && !(window._boqItemsList && window._boqItemsList.length)) await _loadBoqItems(); } catch(_){}
        const boqNoSet = new Set((window._boqItemsList || []).map(b => normItemNo(String(b.no||'').trim())).filter(Boolean));
        if (boqNoSet.size && toAdd.length){
            const okList = [];
            const missingList = [];
            toAdd.forEach(p => {
                if (boqNoSet.has(normItemNo(p.itemNo))) okList.push(p);
                else missingList.push(p);
            });
            if (missingList.length){
                // اعرض مودال يطلب من المستخدم اختيار رقم بند بديل لكل صف، أو تجاوز
                const remapped = await _schedShowMissingBOQ(missingList, window._boqItemsList || []);
                // remapped: { confirmed: [payload...], skipped: [payload...] }
                if (remapped && Array.isArray(remapped.confirmed)){
                    // أضف الصفوف التى أكدها المستخدم
                    remapped.confirmed.forEach(p => okList.push(p));
                }
                if (remapped && Array.isArray(remapped.skipped)){
                    remapped.skipped.forEach(p => skipped.push({ row: '—', itemNo: p.itemNo, item: p.item, reason: 'رقم البند غير موجود فى جدول الكميات — تم تخطيه' }));
                }
            }
            // استبدل toAdd بالقائمة المصفّاة
            toAdd.length = 0;
            okList.forEach(p => toAdd.push(p));
        }

        if (!toAdd.length) {
            _schedSetStatus('⚠️ لا توجد صفوف صالحة للإضافة (تم تخطي ' + skipped.length + ')');
            if (skipped.length) LV.showSkipped('صفوف تم تخطيها أثناء رفع بنود البرنامج الزمني', skipped, { onAddSelected: retryItems });
            else _schedToast('⚠️ لا توجد صفوف صالحة للإضافة', 'warning');
            inputEl.value = '';
            return;
        }
        _schedSetStatus(`⏳ جاري رفع ${toAdd.length} بند${skipped.length ? ' (متخطى ' + skipped.length + ')' : ''}...`);
        LV.showOverlay('جاري رفع بنود البرنامج الزمني...', `إجمالي: ${toAdd.length}${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        LV.updateOverlay(0, toAdd.length);
        const user = getCurrentUser();
        let ok = 0, fail = 0;
        try {
            await _schedPost({ action: 'bulkScheduleItems', rows: toAdd, user });
            ok = toAdd.length;
            LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}/${toAdd.length}`);
            _schedSetStatus(`⏳ تم رفع ${ok}/${toAdd.length}...`);
            await _schedYield();
        } catch (bulkErr) {
            for (let i = 0; i < toAdd.length; i++) {
                try {
                    await _schedPost(Object.assign({ action: 'addScheduleItem', user }, toAdd[i]));
                    ok++;
                    _schedSetStatus(`⏳ تم رفع ${ok}/${toAdd.length}...`);
                } catch (e) { console.warn('row failed', toAdd[i], e); fail++; }
                LV.updateOverlay(ok + fail, toAdd.length, `نجح ${ok} — فشل ${fail}`);
                await _schedYield();
            }
        }
        LV.setOverlayMsg('جاري تحديث الجدول...');
        await refreshScheduleData();
        _schedSetStatus(`✅ تم رفع ${ok} بند${fail ? ' — فشل ' + fail : ''}${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        LV.hideOverlay();
        _schedToast(`✅ تم رفع ${ok} بند${fail ? ' — فشل ' + fail : ''}${skipped.length ? ' — متخطى ' + skipped.length : ''}`, fail ? 'warning' : 'success');
        if (skipped.length) LV.showSkipped(`صفوف تم تخطيها أثناء رفع بنود البرنامج الزمني (تم رفع ${ok})`, skipped, { onAddSelected: retryItems });
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        LV.hideOverlay();
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
        const rows = parseDelimitedText(text);
        if (!rows.length) throw new Error('الملف فارغ');
        let startIdx = 0;
        if (detectHeaderRow(rows[0], ['تاريخ', 'قيمة', 'date', 'value', 'planned'])) startIdx = 1;
        const existing = new Set(
            (window._schedPlan || []).map(p => String(p.date || '').trim())
        );
        const seenInFile = new Set();
        const toAdd = [];
        const skipped = [];
        for (let i = startIdx; i < rows.length; i++) {
            const r = rows[i];
            const rawDate = _schedCleanCell(r[0]);
            const date = _normDateInput(rawDate);
            const plannedValue = Number(_schedCleanCell(r[1]).replace(/[,\s]/g, '')) || 0;
            if (!date) { skipped.push({ row: i + 1, date: rawDate, reason: 'تاريخ ناقص أو غير صالح' }); continue; }
            const payload = { date, plannedValue };
            if (existing.has(date)) { skipped.push({ row: i + 1, date, reason: 'مكرر مع الشيت', __payload: payload }); continue; }
            if (seenInFile.has(date)) { skipped.push({ row: i + 1, date, reason: 'مكرر داخل الملف', __payload: payload }); continue; }
            seenInFile.add(date);
            toAdd.push(payload);
        }
        const userForRetry = getCurrentUser();
        const retryPlan = async (selectedRows) => {
            const toRetry = selectedRows.filter(r => r.__payload).map(r => r.__payload);
            if (!toRetry.length){ (window.showAlert||alert)('⚠️ الصفوف المحددة بياناتها ناقصة'); return; }
            LV.showOverlay('إعادة رفع صفوف الخطة...', `إجمالي: ${toRetry.length}`);
            LV.updateOverlay(0, toRetry.length);
            let ok2 = 0;
            try {
                await _schedPost({ action: 'bulkSchedulePlan', rows: toRetry, user: userForRetry });
                ok2 = toRetry.length;
                LV.updateOverlay(ok2, toRetry.length);
            } catch(_){
                for (const it of toRetry){
                    try { await _schedPost(Object.assign({ action:'addSchedulePlan', user:userForRetry }, it)); ok2++; } catch(e){}
                    LV.updateOverlay(ok2, toRetry.length);
                    await _schedYield();
                }
            }
            LV.setOverlayMsg('إعادة حساب التراكمي...');
            await _schedPost({ action: 'recalcSchedulePlan', user: userForRetry });
            LV.setOverlayMsg('جاري تحديث الجدول...');
            await refreshScheduleData();
            LV.hideOverlay();
            _schedToast(`✅ تم رفع ${ok2} صف`, 'success');
        };
        if (!toAdd.length) {
            _schedSetStatus('⚠️ لا توجد صفوف صالحة (تم تخطي ' + skipped.length + ')');
            if (skipped.length) LV.showSkipped('صفوف تم تخطيها أثناء رفع خطة البرنامج الزمني', skipped, { onAddSelected: retryPlan });
            else _schedToast('⚠️ لا توجد صفوف صالحة', 'warning');
            inputEl.value = '';
            return;
        }
        _schedSetStatus(`⏳ جاري رفع ${toAdd.length} صف${skipped.length ? ' (متخطى ' + skipped.length + ')' : ''}...`);
        LV.showOverlay('جاري رفع صفوف الخطة...', `إجمالي: ${toAdd.length}${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        LV.updateOverlay(0, toAdd.length);
        const user = getCurrentUser();
        let ok = 0;
        // bulk action available on server
        try {
            await _schedPost({ action: 'bulkSchedulePlan', rows: toAdd, user });
            ok = toAdd.length;
            LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}/${toAdd.length}`);
        } catch (e) {
            // fallback to per-row
            for (const r of toAdd) {
                try { await _schedPost(Object.assign({ action: 'addSchedulePlan', user }, r)); ok++; } catch(_){}
                LV.updateOverlay(ok, toAdd.length, `تم رفع ${ok}/${toAdd.length}`);
                await _schedYield();
            }
        }
        LV.setOverlayMsg('إعادة حساب التراكمي...');
        await _schedPost({ action: 'recalcSchedulePlan', user });
        LV.setOverlayMsg('جاري تحديث الجدول...');
        await refreshScheduleData();
        _schedSetStatus(`✅ تم رفع ${toAdd.length} صف${skipped.length ? ' — متخطى ' + skipped.length : ''}`);
        LV.hideOverlay();
        _schedToast(`✅ تم رفع ${toAdd.length} صف${skipped.length ? ' — متخطى ' + skipped.length : ''}`, 'success');
        if (skipped.length) LV.showSkipped(`صفوف تم تخطيها أثناء رفع خطة البرنامج الزمني (تم رفع ${toAdd.length})`, skipped, { onAddSelected: retryPlan });
    } catch (e) {
        console.error(e);
        _schedSetStatus('❌ ' + e.message);
        LV.hideOverlay();
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

window.deleteScheduleItem = async function(row){
    if (!row) return;
    if (!confirm('هل أنت متأكد من حذف هذا البند من البرنامج الزمنى؟')) return;
    LV.showOverlay('جارى حذف البند...', '');
    try {
        await _schedPost({ action:'deleteScheduleItem', row: row, user: getCurrentUser() });
        LV.setOverlayMsg('جارى تحديث الجدول...');
        await refreshScheduleData();
        LV.hideOverlay();
        _schedToast('✅ تم حذف البند', 'success');
    } catch(e){
        LV.hideOverlay();
        (window.showAlert||alert)('❌ ' + (e.message||'فشل الحذف'));
    }
};

window.deleteSchedulePlan = async function(row){
    if (!row) return;
    if (!confirm('هل أنت متأكد من حذف هذا الصف من الخطة اليومية؟\nسيتم إعادة حساب التراكمى تلقائياً.')) return;
    LV.showOverlay('جارى حذف الصف...', '');
    try {
        await _schedPost({ action:'deleteSchedulePlan', row: row, user: getCurrentUser() });
        LV.setOverlayMsg('إعادة حساب التراكمى...');
        try { await _schedPost({ action:'recalcSchedulePlan', user: getCurrentUser() }); } catch(_){}
        LV.setOverlayMsg('جارى تحديث الجدول...');
        await refreshScheduleData();
        LV.hideOverlay();
        _schedToast('✅ تم حذف الصف', 'success');
    } catch(e){
        LV.hideOverlay();
        (window.showAlert||alert)('❌ ' + (e.message||'فشل الحذف'));
    }
};

/* مودال: الصفوف اللى رقم بندها غير موجود فى جدول الكميات
   يسمح بإعادة تعيين رقم البند من قائمة موجودة، أو تخطّى الصف. */
async function _schedShowMissingBOQ(missingPayloads, boqList){
    return new Promise(resolve => {
        const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        // اجمع قائمة فريدة من أرقام البنود فى BOQ
        const boqOptions = (boqList||[])
            .map(b => ({ no: String(b.no||'').trim(), desc: String(b.desc||'').trim() }))
            .filter(b => b.no);

        const id = 'missingBoqModal_' + Date.now();
        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;background:rgba(5,8,16,0.78);backdrop-filter:blur(4px);font-family:Cairo,sans-serif;direction:rtl;';
        wrap.innerHTML = `
          <div style="background:linear-gradient(180deg,#10182f,#162548);border:1px solid rgba(255,200,80,0.35);border-radius:14px;width:min(900px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 70px rgba(0,0,0,0.7);overflow:hidden;">
            <div style="padding:14px 20px;background:linear-gradient(135deg,#b76a00,#ff9800);color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:15px;font-weight:900;">⚠️ بنود غير موجودة فى جدول الكميات</div>
                <div style="font-size:11px;opacity:0.9;margin-top:3px;">عدد الصفوف: <b>${missingPayloads.length}</b> — اختر لكل صف رقم بند بديل من جدول الكميات، أو اضغط "تخطّى" لإهمال الصف</div>
              </div>
              <button id="${id}_x" style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.2);color:#fff;width:30px;height:30px;border-radius:7px;cursor:pointer;">✕</button>
            </div>
            <div style="flex:1;overflow:auto;padding:14px 18px;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;color:#e0e6ef;">
                <thead>
                  <tr style="background:#13234a;color:rgba(255,255,255,0.7);">
                    <th style="padding:8px;text-align:right;">#</th>
                    <th style="padding:8px;text-align:right;">رقم البند (من الملف)</th>
                    <th style="padding:8px;text-align:right;">البند</th>
                    <th style="padding:8px;text-align:right;">رقم بند بديل من جدول الكميات</th>
                  </tr>
                </thead>
                <tbody id="${id}_body">
                  ${missingPayloads.map((p,i)=>`
                    <tr data-idx="${i}" style="border-top:1px solid rgba(255,255,255,0.06);">
                      <td style="padding:8px;color:#90caf9;font-weight:700;">${i+1}</td>
                      <td style="padding:8px;color:#ff8a80;font-weight:700;">${esc(p.itemNo||'—')}</td>
                      <td style="padding:8px;">${esc(p.item||'')}</td>
                      <td style="padding:8px;">
                        <select class="mb-remap" data-idx="${i}" style="width:100%;padding:7px;border-radius:6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.18);font-family:Cairo,sans-serif;font-size:12px;">
                          <option value="__skip__">— تخطّى هذا الصف —</option>
                          ${boqOptions.map(b => `<option value="${esc(b.no)}">${esc(b.no)} — ${esc(b.desc).slice(0,80)}</option>`).join('')}
                        </select>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div style="padding:12px 18px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.25);flex-wrap:wrap;">
              <div style="font-size:11px;color:rgba(255,255,255,0.55);">يمكنك ترك الاختيار "تخطّى" لإهمال الصف.</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="${id}_skipAll" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.18);color:#fff;padding:9px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:700;cursor:pointer;">⏭️ تخطّى الكل</button>
                <button id="${id}_confirm" style="background:linear-gradient(135deg,#2196f3,#1565c0);border:none;color:#fff;padding:9px 18px;border-radius:8px;font-family:Cairo,sans-serif;font-weight:800;cursor:pointer;">✔ تأكيد ومتابعة الرفع</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(wrap);

        const close = (result) => { try { wrap.remove(); } catch(_){} resolve(result); };
        wrap.querySelector('#'+id+'_x').onclick = () => close({ confirmed: [], skipped: missingPayloads });
        wrap.querySelector('#'+id+'_skipAll').onclick = () => close({ confirmed: [], skipped: missingPayloads });
        wrap.querySelector('#'+id+'_confirm').onclick = () => {
            const confirmed = [];
            const skipped = [];
            missingPayloads.forEach((p, i) => {
                const sel = wrap.querySelector(`.mb-remap[data-idx="${i}"]`);
                const v = sel ? sel.value : '__skip__';
                if (!v || v === '__skip__') { skipped.push(p); return; }
                confirmed.push(Object.assign({}, p, { itemNo: normItemNo(v) }));
            });
            close({ confirmed, skipped });
        };
    });
}
