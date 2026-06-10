/* ============================================================
   addequipment.js
   منطق "تسجيل المعدات" داخل شاشة "إضافة" — Sidebar Panel.
   نسخة موازية لنمط addboq.js مع بادئة addEq.

   يعتمد على:
     parseCSVLine                              — utils.js
     LV.showOverlay/hideOverlay/updateOverlay  — main.js
     showAlert, _normItemNo, _parseAnyDate,
       _dateToInputVal                          — main.js / utils.js
     sheetIdsConfig / EQUIPMENT_SHEET_ID /
       EQUIPMENT_SCRIPT_URL                        — config.js
     currentUser                               — auth.js
   ============================================================ */
(function () {
    'use strict';

    window._addEqEditRow = null;
    window._addEqItems   = [];
    let   _rendered = false;

    /* ---------- Sources ---------- */
    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig['EQUIPMENT_SCRIPT_URL'])
            || window['EQUIPMENT_SCRIPT_URL']
            || localStorage.getItem('EQUIPMENT_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig['EQUIPMENT_SHEET_ID'])
              || window['EQUIPMENT_SHEET_ID'] || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }

    /* ---------- Helpers ---------- */
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'equipment') el.textContent = msg || '';
    }
    function _esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function _fmt(n){ const v = Number(String(n||'').replace(/,/g,'')) || 0; return v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    function _normItemNo(s){
        if (typeof window._normItemNo === 'function') { try { return window._normItemNo(s); } catch(_){} }
        return (s==null?'':String(s)).trim();
    }
    function _normDate(v){
        if (!v) return '';
        if (v instanceof Date) { const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),dd=String(v.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
        if (typeof window._parseAnyDate === 'function' && typeof window._dateToInputVal === 'function'){
            const d = window._parseAnyDate(v); return d ? window._dateToInputVal(d) : String(v);
        }
        const s = String(v).trim();
        let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        const d = new Date(s); if (isNaN(d)) return s;
        const y=d.getFullYear(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
        return `${y}-${mm}-${dd}`;
    }
    function _currentUser(){
        return (window.currentUser && (window.currentUser.name || window.currentUser.email)) || '';
    }
    async function _post(payload){
        const url = _scriptUrl();
        if (!url) throw new Error('⚠️ أضف رابط سكريبت تسجيل المعدات فى الإعدادات (EQUIPMENT_SCRIPT_URL)');
        const sheetId = _sheetId();
        const res = await fetch(url, {
            method:'POST', redirect:'follow',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({ ...payload, sheetId })
        });
        const text = await res.text();
        let result; try { result = JSON.parse(text); }
        catch(_) { throw new Error('استجابة غير صالحة: ' + text.slice(0,200)); }
        if (!result || result.success !== true) throw new Error((result && (result.message || result.error)) || 'فشل');
        return result;
    }
    

    /* ---------- Render UI ---------- */
    function _render(root){
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div id="addEqFormWrap">
                <div class="edit-badge">✏️ تعديل صف موجود — اضغط حفظ للتحديث</div>
                <div class="boq-form" style="grid-template-columns:160px 140px 150px 120px 1fr auto;">
                    <div><label>نوع المعدة</label><input type="text" id="addEqType" placeholder="حفار / لودر..."></div>
                <div><label>الرقم / الكود</label><input type="text" id="addEqCode" placeholder="EQ-001"></div>
                <div><label>التاريخ</label><input type="date" id="addEqDate" placeholder=""></div>
                <div><label>عدد الساعات</label><input type="number" step="any" id="addEqHours" placeholder="0"></div>
                <div><label>ملاحظة</label><input type="text" id="addEqNote" placeholder="ملاحظة (اختيارى)"></div>
                    <div class="form-actions">
                        <button class="btn-save" onclick="saveaddEqItem()">💾 حفظ</button>
                        <button class="btn-cancel-edit" onclick="canceladdEqEdit()">إلغاء</button>
                    </div>
                </div>
            </div>
            <div class="boq-section-title">
                🚜 تسجيل المعدات <span id="addEqCount" style="color:#5cc890;"></span>
                <span class="spacer"></span>
                <input type="file" id="addEqImportFile" accept=".csv,.txt" style="display:none;" onchange="importaddEqFromFile(this)">
                <button class="btn-import" onclick="document.getElementById('addEqImportFile').click()">⬆️ رفع من ملف</button>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshaddEqData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>النوع</th><th>الكود</th><th>التاريخ</th><th>الساعات</th><th>ملاحظة</th><th class="col-actions"></th></tr></thead>
                    <tbody id="addEqBody"><tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
        _rendered = true;
    }

    /* ---------- Refresh / read ---------- */
    window.refreshaddEqData = async function(){
        _setStatus('⏳ جارى تحميل البيانات...');
        try {
            // First try Apps Script "get" action; fallback to CSV export
            let rows = null;
            try {
                const snap = await _post({ action: 'getEquipment' });
                rows = snap.items || snap.rows || [];
            } catch(_){
                rows = null;
            }
            const items = [];
            if (Array.isArray(rows) && rows.length){
                rows.forEach(r => {
                    const v = [];
                    items.push({
                        row: r._row || r.row,
            type: (r["\u0627\u0644\u0646\u0648\u0639"], r["Type"], r["type"], r["\u0646\u0648\u0639 \u0627\u0644\u0645\u0639\u062f\u0629"] || (v[0]||'')).toString().trim(),
            code: (r["\u0627\u0644\u0643\u0648\u062f"], r["Code"], r["code"], r["\u0627\u0644\u0631\u0642\u0645"] || (v[1]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[2]||'').trim()),
            hours: (r["\u0627\u0644\u0633\u0627\u0639\u0627\u062a"], r["Hours"], r["hours"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"] || (v[4]||'')).toString().trim(),
                    });
                });
            } else {
                // CSV fallback
                const id = _sheetId();
                if (id){
                    const tabs = ["المعدات", "Equipment", "equipment", "Sheet1"];
                    let csv = '';
                    for (const tab of tabs){
                        try {
                            const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
                            const r = await fetch(u);
                            if (r.ok){ const t = await r.text(); if (t && !t.trim().startsWith('<') && t.includes(',')){ csv = t; break; } }
                        } catch(_){}
                    }
                    if (!csv){ try { const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`); if (r.ok) csv = await r.text(); } catch(_){} }
                    if (csv && !csv.trim().startsWith('<')){
                        const lines = csv.split(/\r?\n/).filter(l => l.trim());
                        const headers = lines.length ? ((typeof parseCSVLine === 'function') ? parseCSVLine(lines[0]) : lines[0].split(',')) : [];
                        for (let i = 1; i < lines.length; i++){
                            const v = (typeof parseCSVLine === 'function') ? parseCSVLine(lines[i]) : lines[i].split(',');
                            const r = {}; headers.forEach((h, idx) => { r[h] = v[idx] || ''; });
                            items.push({
                                row: i + 1,
            type: (r["\u0627\u0644\u0646\u0648\u0639"], r["Type"], r["type"], r["\u0646\u0648\u0639 \u0627\u0644\u0645\u0639\u062f\u0629"] || (v[0]||'')).toString().trim(),
            code: (r["\u0627\u0644\u0643\u0648\u062f"], r["Code"], r["code"], r["\u0627\u0644\u0631\u0642\u0645"] || (v[1]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[2]||'').trim()),
            hours: (r["\u0627\u0644\u0633\u0627\u0639\u0627\u062a"], r["Hours"], r["hours"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"] || (v[4]||'')).toString().trim(),
                            });
                        }
                    }
                }
            }
            window._addEqItems = items;
            _renderTable();
            _setStatus('✅ جاهز');
        } catch(e){
            console.warn(e);
            window._addEqItems = [];
            _renderTable();
            _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    /* ---------- Render table ---------- */
    function _renderTable(){
        const tb  = document.getElementById('addEqBody');
        const cnt = document.getElementById('addEqCount');
        if (!tb) return;
        const all = window._addEqItems || [];
        if (cnt) cnt.textContent = '(' + all.length + ')';
        if (!all.length){
            tb.innerHTML = '<tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد — أضف صفاً أو ارفع ملف CSV</td></tr>';
            return;
        }
        tb.innerHTML = all.map(it => `
            <tr data-row="${it.row}" onclick="loadaddEqForEdit(${it.row})" class="${window._addEqEditRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.type)}</td><td>${_esc(it.code)}</td><td>${_esc(it.date)}</td><td>${_fmt(it.hours)}</td><td>${_esc(it.note)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
                    onclick="event.stopPropagation();deleteaddEqRow(${it.row})">🗑</button></td>
            </tr>
        `).join('');
    }

    /* ---------- Load row into form ---------- */
    window.loadaddEqForEdit = function(row){
        const it = (window._addEqItems || []).find(x => x.row === row); if (!it) return;
        window._addEqEditRow = row;
        const wrap = document.getElementById('addEqFormWrap'); if (wrap) wrap.classList.add('edit-mode');
        if (document.getElementById('addEqType')) document.getElementById('addEqType').value = it.type || '';
        if (document.getElementById('addEqCode')) document.getElementById('addEqCode').value = it.code || '';
        if (document.getElementById('addEqDate')) document.getElementById('addEqDate').value = it.date || '';
        if (document.getElementById('addEqHours')) document.getElementById('addEqHours').value = it.hours || '';
        if (document.getElementById('addEqNote')) document.getElementById('addEqNote').value = it.note || '';
        _renderTable();
    };

    window.canceladdEqEdit = function(){
        window._addEqEditRow = null;
        const wrap = document.getElementById('addEqFormWrap'); if (wrap) wrap.classList.remove('edit-mode');
        if (document.getElementById('addEqType')) document.getElementById('addEqType').value = '';
        if (document.getElementById('addEqCode')) document.getElementById('addEqCode').value = '';
        if (document.getElementById('addEqDate')) document.getElementById('addEqDate').value = '';
        if (document.getElementById('addEqHours')) document.getElementById('addEqHours').value = '';
        if (document.getElementById('addEqNote')) document.getElementById('addEqNote').value = '';
        _renderTable();
    };

    /* ---------- Save / Update ---------- */
    window.saveaddEqItem = async function(){
        const type = (document.getElementById('addEqType')?.value || '').trim();
        const code = (document.getElementById('addEqCode')?.value || '').trim();
        const date = (document.getElementById('addEqDate')?.value || '').trim();
        const hours = (document.getElementById('addEqHours')?.value || '').trim();
        const note = (document.getElementById('addEqNote')?.value || '').trim();
        if (!type || !code || !date || !hours) { (window.showAlert||alert)('⚠️ أكمل الحقول المطلوبة'); return; }
        const dup = (window._addEqItems || []).find(it =>
            String(it.type||'').trim() === String(type).trim() && String(it.code||'').trim() === String(code).trim() && String(it.date||'').trim() === String(date).trim() && it.row !== window._addEqEditRow
        );
        if (dup) { (window.showAlert||alert)('⚠️ هذا الصف موجود بالفعل (بنفس البيانات الأساسية)'); return; }
        _setStatus('⏳ جارى الحفظ...');
        if (window.LV) { LV.showOverlay(window._addEqEditRow ? 'جارى تحديث الصف...' : 'جارى حفظ الصف...', 'يتم إرسال البيانات إلى الشيت'); LV.updateOverlay(0,1); }
        try {
            const payload = {
                action: window._addEqEditRow ? 'updateEquipment' : 'addEquipment',
                row: window._addEqEditRow || undefined,
                type,
            code,
            date,
            hours,
            note,
                timestamp: new Date().toISOString(),
                user: _currentUser()
            };
            await _post(payload);
            if (window.LV) LV.updateOverlay(1,1,'تم — جارى تحديث الجدول...');
            _setStatus('✅ تم الحفظ');
            window.canceladdEqEdit();
            await window.refreshaddEqData();
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('✅ تم الحفظ');
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ---------- Delete ---------- */
    window.deleteaddEqRow = async function(row){
        if (!row) return;
        if (!confirm('هل تريد حذف هذا الصف؟')) return;
        _setStatus('⏳ جارى الحذف...');
        if (window.LV) { LV.showOverlay('جارى حذف الصف...', ''); LV.updateOverlay(0,1); }
        try {
            await _post({ action:'deleteEquipment', row, timestamp: new Date().toISOString(), user: _currentUser() });
            if (window.LV) LV.updateOverlay(1,1,'تم الحذف');
            _setStatus('✅ تم الحذف');
            window.canceladdEqEdit();
            await window.refreshaddEqData();
            if (window.LV) LV.hideOverlay();
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ---------- CSV / TXT Import ---------- */
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
    window.importaddEqFromFile = async function(inputEl){
        const f = inputEl && inputEl.files && inputEl.files[0]; if (!f) return;
        try {
            const text = await f.text();
            const rows = _parseDelimited(text);
            if (!rows.length) throw new Error('الملف فارغ');
            // skip header if it looks like one
            let start = 0;
            const first = rows[0].map(c => String(c||'').toLowerCase());
            if (first.some(c => /[؀-ۿ]|date|item|value|qty|hour|note/.test(c))) start = 1;
            const payloads = [];
            for (let i = start; i < rows.length; i++){
                const r = rows[i];
                const p = {
                    action: 'addEquipment',
                type: (r[0]||'').toString().trim(),
                code: (r[1]||'').toString().trim(),
                date: _normDate((r[2]||'').trim()),
                hours: (r[3]||'').toString().trim(),
                note: (r[4]||'').toString().trim(),
                    timestamp: new Date().toISOString(),
                    user: _currentUser()
                };
                // require at least one non-note field
                if (![p.type,p.code,p.date,p.hours].some(v => v)) continue;
                payloads.push(p);
            }
            const total = payloads.length;
            if (!total) { (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة'); return; }
            _setStatus(`⏳ جارى رفع ${total} صف...`);
            if (window.LV) { LV.showOverlay('جارى رفع البيانات...', `إجمالى الصفوف: ${total}`); LV.updateOverlay(0, total); }
            let ok = 0, fail = 0;
            try {
                const rr = await _post({ action: 'bulkEquipment', rows: payloads, user: _currentUser(), timestamp: new Date().toISOString() });
                ok = (rr && rr.added) || total;
                if (window.LV) LV.updateOverlay(ok, total, `تم رفع ${ok}`);
            } catch(_){
                for (let i = 0; i < payloads.length; i++){
                    try { await _post(payloads[i]); ok++; } catch(e){ fail++; }
                    if (window.LV) LV.updateOverlay(ok+fail, total, `نجح ${ok} — فشل ${fail}`);
                }
            }
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshaddEqData();
            if (window.LV) LV.hideOverlay();
            _setStatus(`✅ تم رفع ${ok} صف${fail?` — فشل ${fail}`:''}`);
            (window.showAlert||alert)(`✅ تم رفع ${ok} صف${fail?` — فشل ${fail}`:''}`);
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        } finally { if (inputEl) inputEl.value = ''; }
    };

    /* ---------- Activation ---------- */
    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'equipment'){
            const root = document.getElementById('addEquipmentRoot');
            if (root && !_rendered) _render(root);
            window.refreshaddEqData();
        }
    });
})();
