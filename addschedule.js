/* ============================================================
   addschedule.js
   منطق "الجدول الزمني" داخل شاشة "إضافة" — Sidebar Panel.
   نسخة موازية لمنطق Schedule فى main.js مع بادئة addSched
   لتجنّب التعارض بالـ IDs.

   تبويبان فرعيان:
     - بنود البرنامج الزمني  (مرتبط ببنود جدول الكميات)
     - خطة القيمة المخططة    (تاريخ + قيمة + تراكمى)

   يعتمد على:
     parseCSVLine                              — utils.js
     LV.showOverlay/hideOverlay/updateOverlay  — main.js
     showAlert, _normItemNo, _parseAnyDate,
       _dateToInputVal, _cmpItemNo             — main.js / utils.js
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

    /* ===================== Helpers ===================== */
    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SCRIPT_URL)
            || window.SCHEDULE_SCRIPT_URL
            || localStorage.getItem('SCHEDULE_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SHEET_ID)
              || window.SCHEDULE_SHEET_ID || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }
    function _boqSheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig.BOQ_SHEET_ID)
              || window.BOQ_SHEET_ID || window.BILLS_SHEET_ID || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'schedule') el.textContent = msg || '';
    }
    function _esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function _fmt(n){ const v = Number(String(n||'').replace(/,/g,'')) || 0; return v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    function _normItemNo(s){
        if (typeof window._normItemNo === 'function') { try { return window._normItemNo(s); } catch(_){} }
        let str = (s==null?'':String(s)).trim(); if (!str) return '';
        const m = str.match(/^([0-9.\-_/\s]+)(.*)$/); if (!m) return str;
        let core = m[1].trim(); const suf = m[2] || '';
        if (/^\d+\.\d+$/.test(core)) core = String(parseFloat(core));
        else if (/^\d+\.0*$/.test(core)) core = core.replace(/\.0*$/, '');
        else if (/^0+\d+$/.test(core)) core = String(parseInt(core,10));
        return core + suf;
    }
    function _cmpItemNo(a,b){
        if (typeof window._cmpItemNo === 'function') { try { return window._cmpItemNo(a,b); } catch(_){} }
        return String(a||'').localeCompare(String(b||''), 'ar', { numeric:true });
    }
    function _currentUser(){
        return (window.currentUser && (window.currentUser.name || window.currentUser.email)) || 'unknown';
    }
    function _toInput(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
    function _normDate(v){
        if (!v) return '';
        if (v instanceof Date) return _toInput(v);
        if (typeof window._parseAnyDate === 'function' && typeof window._dateToInputVal === 'function'){
            const d = window._parseAnyDate(v); return d ? window._dateToInputVal(d) : String(v);
        }
        const s = String(v).trim();
        let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        const d = new Date(s);
        return isNaN(d) ? s : _toInput(d);
    }
    async function _post(payload){
        const url = _scriptUrl();
        if (!url) throw new Error('⚠️ أضف رابط سكريبت البرنامج الزمنى فى الإعدادات');
        const sheetId = _sheetId();
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
        root.classList.remove('panel-placeholder');
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
                        <select id="addSchedItemNoSelect" onchange="onAddSchedItemNoChange()"
                            style="width:100%;box-sizing:border-box;padding:9px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-family:'Cairo',sans-serif;font-size:13px;">
                            <option value="">— اختر رقم —</option>
                        </select>
                    </div>
                    <div>
                        <label>البند</label>
                        <select id="addSchedItemSelect" onchange="onAddSchedItemDescChange()"
                            style="width:100%;box-sizing:border-box;padding:9px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-family:'Cairo',sans-serif;font-size:13px;">
                            <option value="">— اختر بنداً —</option>
                        </select>
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
        ['addSchedItemStart','addSchedItemEnd','addSchedPlanDate','addSchedPlanValue']
            .forEach(id => { const el = document.getElementById(id); if (el){ el.addEventListener('input', fn); el.addEventListener('change', fn); } });
    }

    /* ===================== BOQ items loader (for dropdowns) ===================== */
    async function _loadBoqList(){
        const id = _boqSheetId();
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
                const no = _normItemNo((v[0]||'').trim());
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
    }

    window.onAddSchedItemNoChange = function(){
        const selNo = document.getElementById('addSchedItemNoSelect');
        const selDesc = document.getElementById('addSchedItemSelect');
        if (!selNo || !selDesc) return;
        const opt = selNo.selectedOptions[0];
        const desc = opt ? (opt.dataset.desc || '') : '';
        if (desc && selDesc.querySelector(`option[value="${CSS.escape(desc)}"]`)) selDesc.value = desc;
    };
    window.onAddSchedItemDescChange = function(){
        const selNo = document.getElementById('addSchedItemNoSelect');
        const selDesc = document.getElementById('addSchedItemSelect');
        if (!selNo || !selDesc) return;
        const opt = selDesc.selectedOptions[0];
        const no = opt ? (opt.dataset.no || '') : '';
        if (no && selNo.querySelector(`option[value="${CSS.escape(no)}"]`)) selNo.value = no;
    };

    /* ===================== Refresh data ===================== */
    window.refreshAddScheduleData = async function(){
        _setStatus('⏳ جارى تحميل البيانات...');
        try {
            await _loadBoqList();
            const snap = await _post({ action: 'getSchedule' });
            const items = (snap.items || []).map(r => ({
                row      : r._row || r.row,
                itemNo   : _normItemNo(String(r['رقم البند'] || r.itemNo || '')),
                item     : r['البند'] || r.item || '',
                startDate: _normDate(r['تاريخ البداية'] || r.startDate),
                endDate  : _normDate(r['تاريخ النهاية'] || r.endDate),
                days     : r['المدة (يوم)'] || r.days || ''
            })).filter(x => x.row);
            const plan = (snap.plan || []).map(r => ({
                row         : r._row || r.row,
                date        : _normDate(r['التاريخ'] || r.date),
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
        const fStart = (document.getElementById('addSchedItemStart')?.value || '').trim();
        const fEnd   = (document.getElementById('addSchedItemEnd')?.value || '').trim();
        const items = all.filter(it =>
            (!fStart || String(it.startDate||'') === fStart) &&
            (!fEnd   || String(it.endDate||'')   === fEnd)
        ).slice().sort((a,b) => _cmpItemNo(a.itemNo, b.itemNo));
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
                <td>${_fmt(p.plannedValue)}</td>
                <td>${_fmt(p.cumValue)}</td>
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
        dateInp.value = _toInput(next);
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
    }
    window.saveAddScheduleItem = async function(){
        const itemNo = _normItemNo(document.getElementById('addSchedItemNoSelect')?.value || '');
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
            const user = _currentUser();
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
            await _post({ action:'deleteScheduleItem', row, user: _currentUser() });
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
            const user = _currentUser();
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
            await _post({ action:'deleteSchedulePlan', row, user: _currentUser() });
            try { await _post({ action:'recalcSchedulePlan', user: _currentUser() }); } catch(_){}
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
    function _parseDelimited(text){
        const sample = text.split(/\r?\n/).slice(0,5).join('\n');
        let delim = ',';
        if (sample.indexOf('\t') > -1) delim = '\t';
        else if (sample.indexOf(';') > -1 && sample.split(';').length > sample.split(',').length) delim = ';';
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        return lines.map(l => delim === ',' && typeof parseCSVLine === 'function'
            ? parseCSVLine(l)
            : l.split(delim).map(s => s.trim().replace(/^"|"$/g,'')));
    }
    function _detectHeader(row, kws){ return row.some(c => kws.some(k => String(c||'').toLowerCase().includes(k))); }

    window.importAddScheduleItemsFromFile = async function(inputEl){
        const f = inputEl && inputEl.files && inputEl.files[0]; if (!f) return;
        try {
            const text = await f.text();
            const rows = _parseDelimited(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            if (_detectHeader(rows[0], ['رقم','البند','بداية','نهاية','item','date','start','end'])) start = 1;
            const existing = new Set((window._addSchedItems || []).map(it =>
                String(it.itemNo||'').trim() + '||' + String(it.item||'').trim()));
            const seen = new Set();
            const toAdd = [];
            for (let i = start; i < rows.length; i++){
                const r = rows[i];
                const itemNo = _normItemNo((r[0]||'').trim());
                const item = (r[1]||'').trim();
                const startDate = _normDate((r[2]||'').trim());
                const endDate   = _normDate((r[3]||'').trim());
                if (!item || !startDate || !endDate) continue;
                const key = itemNo + '||' + item;
                if (existing.has(key) || seen.has(key)) continue;
                seen.add(key);
                toAdd.push({ itemNo, item, startDate, endDate });
            }
            if (!toAdd.length){ (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة للإضافة'); return; }
            const user = _currentUser();
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
            const rows = _parseDelimited(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            if (_detectHeader(rows[0], ['تاريخ','قيمة','date','value','planned'])) start = 1;
            const existing = new Set((window._addSchedPlan || []).map(p => String(p.date||'').trim()));
            const seen = new Set();
            const toAdd = [];
            for (let i = start; i < rows.length; i++){
                const r = rows[i];
                const date = _normDate((r[0]||'').trim());
                const plannedValue = Number(String(r[1]||'').replace(/[,\s]/g,'')) || 0;
                if (!date) continue;
                if (existing.has(date) || seen.has(date)) continue;
                seen.add(date);
                toAdd.push({ date, plannedValue });
            }
            if (!toAdd.length){ (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة'); return; }
            const user = _currentUser();
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
