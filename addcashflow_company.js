/* ============================================================
   addcashflow_company.js
   منطق "التدفق النقدى للشركة" داخل شاشة "إضافة" — Sidebar Panel.
   نسخة موازية لنمط addboq.js مع بادئة addCashCo.

   يعتمد على:
     parseCSVLine                              — utils.js
     LV.showOverlay/hideOverlay/updateOverlay  — main.js
     showAlert, _normItemNo, _parseAnyDate,
       _dateToInputVal                          — main.js / utils.js
     sheetIdsConfig / CASHFLOW_COMPANY_SHEET /
       CASHFLOW_COMPANY_SCRIPT_URL                        — config.js
     currentUser                               — auth.js
   ============================================================ */
(function () {
    'use strict';

    window._addCashCoEditRow = null;
    window._addCashCoItems   = [];
    let   _rendered = false;

    /* ---------- Sources ---------- */
    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig['CASHFLOW_COMPANY_SCRIPT_URL'])
            || window['CASHFLOW_COMPANY_SCRIPT_URL']
            || localStorage.getItem('CASHFLOW_COMPANY_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig['CASHFLOW_COMPANY_SHEET'])
              || window['CASHFLOW_COMPANY_SHEET'] || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }

    /* ---------- Helpers ---------- */
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'cashco') el.textContent = msg || '';
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
        if (!url) throw new Error('⚠️ أضف رابط سكريبت التدفق النقدى للشركة فى الإعدادات (CASHFLOW_COMPANY_SCRIPT_URL)');
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
            <div id="addCashCoFormWrap">
                <div class="edit-badge">✏️ تعديل صف موجود — اضغط حفظ للتحديث</div>
                <div class="boq-form" style="grid-template-columns:130px 150px 150px 150px 1fr auto;">
                    <div><label>رقم المستخلص</label><input type="text" id="addCashCoNo" placeholder="1"></div>
                <div><label>التاريخ</label><input type="date" id="addCashCoDate" placeholder=""></div>
                <div><label>قيمة المستخلص</label><input type="number" step="any" id="addCashCoValue" placeholder="0.00"></div>
                <div><label>الخصومات</label><input type="number" step="any" id="addCashCoDeduct" placeholder="0.00"></div>
                <div><label>ملاحظة</label><input type="text" id="addCashCoNote" placeholder="ملاحظة"></div>
                    <div class="form-actions">
                        <button class="btn-save" onclick="saveaddCashCoItem()">💾 حفظ</button>
                        <button class="btn-cancel-edit" onclick="canceladdCashCoEdit()">إلغاء</button>
                    </div>
                </div>
            </div>
            <div class="boq-section-title">
                💵 التدفق النقدى للشركة <span id="addCashCoCount" style="color:#5cc890;"></span>
                <span class="spacer"></span>
                <input type="file" id="addCashCoImportFile" accept=".csv,.txt" style="display:none;" onchange="importaddCashCoFromFile(this)">
                <button class="btn-import" onclick="document.getElementById('addCashCoImportFile').click()">⬆️ رفع من ملف</button>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshaddCashCoData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>رقم المستخلص</th><th>التاريخ</th><th>القيمة</th><th>الخصومات</th><th>الصافى</th><th>ملاحظة</th><th class="col-actions"></th></tr></thead>
                    <tbody id="addCashCoBody"><tr><td colspan="7" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
        _rendered = true;
    }

    /* ---------- Refresh / read ---------- */
    window.refreshaddCashCoData = async function(){
        _setStatus('⏳ جارى تحميل البيانات...');
        try {
            // First try Apps Script "get" action; fallback to CSV export
            let rows = null;
            try {
                const snap = await _post({ action: 'getCashCompany' });
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
            no: (r["\u0631\u0642\u0645"], r["No"], r["no"], r["\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u0644\u0635"] || (v[0]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[1]||'').trim()),
            value: (r["\u0627\u0644\u0642\u064a\u0645\u0629"], r["Value"], r["value"] || (v[2]||'')).toString().trim(),
            deduct: (r["\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a"], r["Deductions"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"] || (v[4]||'')).toString().trim(),
                    });
                });
            } else {
                // CSV fallback
                const id = _sheetId();
                if (id){
                    const tabs = ["مستخلصات الشركة", "CashCompany", "Cashflow", "Sheet1"];
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
            no: (r["\u0631\u0642\u0645"], r["No"], r["no"], r["\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u0644\u0635"] || (v[0]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[1]||'').trim()),
            value: (r["\u0627\u0644\u0642\u064a\u0645\u0629"], r["Value"], r["value"] || (v[2]||'')).toString().trim(),
            deduct: (r["\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a"], r["Deductions"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"] || (v[4]||'')).toString().trim(),
                            });
                        }
                    }
                }
            }
            window._addCashCoItems = items;
            _renderTable();
            _setStatus('✅ جاهز');
        } catch(e){
            console.warn(e);
            window._addCashCoItems = [];
            _renderTable();
            _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    /* ---------- Render table ---------- */
    function _renderTable(){
        const tb  = document.getElementById('addCashCoBody');
        const cnt = document.getElementById('addCashCoCount');
        if (!tb) return;
        const all = window._addCashCoItems || [];
        if (cnt) cnt.textContent = '(' + all.length + ')';
        if (!all.length){
            tb.innerHTML = '<tr><td colspan="7" class="boq-empty">— لا توجد بيانات بعد — أضف صفاً أو ارفع ملف CSV</td></tr>';
            return;
        }
        tb.innerHTML = all.map(it => `
            <tr data-row="${it.row}" onclick="loadaddCashCoForEdit(${it.row})" class="${window._addCashCoEditRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.no)}</td><td>${_esc(it.date)}</td><td>${_fmt(it.value)}</td><td>${_fmt(it.deduct)}</td><td style="color:#5cc890;font-weight:700;">${_fmt((Number(String(it.value||'').replace(/,/g,''))||0) - (Number(String(it.deduct||'').replace(/,/g,''))||0))}</td><td>${_esc(it.note)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
                    onclick="event.stopPropagation();deleteaddCashCoRow(${it.row})">🗑</button></td>
            </tr>
        `).join('');
    }

    /* ---------- Load row into form ---------- */
    window.loadaddCashCoForEdit = function(row){
        const it = (window._addCashCoItems || []).find(x => x.row === row); if (!it) return;
        window._addCashCoEditRow = row;
        const wrap = document.getElementById('addCashCoFormWrap'); if (wrap) wrap.classList.add('edit-mode');
        if (document.getElementById('addCashCoNo')) document.getElementById('addCashCoNo').value = it.no || '';
        if (document.getElementById('addCashCoDate')) document.getElementById('addCashCoDate').value = it.date || '';
        if (document.getElementById('addCashCoValue')) document.getElementById('addCashCoValue').value = it.value || '';
        if (document.getElementById('addCashCoDeduct')) document.getElementById('addCashCoDeduct').value = it.deduct || '';
        if (document.getElementById('addCashCoNote')) document.getElementById('addCashCoNote').value = it.note || '';
        _renderTable();
    };

    window.canceladdCashCoEdit = function(){
        window._addCashCoEditRow = null;
        const wrap = document.getElementById('addCashCoFormWrap'); if (wrap) wrap.classList.remove('edit-mode');
        if (document.getElementById('addCashCoNo')) document.getElementById('addCashCoNo').value = '';
        if (document.getElementById('addCashCoDate')) document.getElementById('addCashCoDate').value = '';
        if (document.getElementById('addCashCoValue')) document.getElementById('addCashCoValue').value = '';
        if (document.getElementById('addCashCoDeduct')) document.getElementById('addCashCoDeduct').value = '';
        if (document.getElementById('addCashCoNote')) document.getElementById('addCashCoNote').value = '';
        _renderTable();
    };

    /* ---------- Save / Update ---------- */
    window.saveaddCashCoItem = async function(){
        const no = (document.getElementById('addCashCoNo')?.value || '').trim();
        const date = (document.getElementById('addCashCoDate')?.value || '').trim();
        const value = (document.getElementById('addCashCoValue')?.value || '').trim();
        const deduct = (document.getElementById('addCashCoDeduct')?.value || '').trim();
        const note = (document.getElementById('addCashCoNote')?.value || '').trim();
        if (!no || !date || !value || !deduct) { (window.showAlert||alert)('⚠️ أكمل الحقول المطلوبة'); return; }
        const dup = (window._addCashCoItems || []).find(it =>
            String(it.no||'').trim() === String(no).trim() && String(it.date||'').trim() === String(date).trim() && it.row !== window._addCashCoEditRow
        );
        if (dup) { (window.showAlert||alert)('⚠️ هذا الصف موجود بالفعل (بنفس البيانات الأساسية)'); return; }
        _setStatus('⏳ جارى الحفظ...');
        if (window.LV) { LV.showOverlay(window._addCashCoEditRow ? 'جارى تحديث الصف...' : 'جارى حفظ الصف...', 'يتم إرسال البيانات إلى الشيت'); LV.updateOverlay(0,1); }
        try {
            const payload = {
                action: window._addCashCoEditRow ? 'updateCashCompany' : 'addCashCompany',
                row: window._addCashCoEditRow || undefined,
                no,
            date,
            value,
            deduct,
            note,
                timestamp: new Date().toISOString(),
                user: _currentUser()
            };
            await _post(payload);
            if (window.LV) LV.updateOverlay(1,1,'تم — جارى تحديث الجدول...');
            _setStatus('✅ تم الحفظ');
            window.canceladdCashCoEdit();
            await window.refreshaddCashCoData();
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('✅ تم الحفظ');
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ---------- Delete ---------- */
    window.deleteaddCashCoRow = async function(row){
        if (!row) return;
        if (!confirm('هل تريد حذف هذا الصف؟')) return;
        _setStatus('⏳ جارى الحذف...');
        if (window.LV) { LV.showOverlay('جارى حذف الصف...', ''); LV.updateOverlay(0,1); }
        try {
            await _post({ action:'deleteCashCompany', row, timestamp: new Date().toISOString(), user: _currentUser() });
            if (window.LV) LV.updateOverlay(1,1,'تم الحذف');
            _setStatus('✅ تم الحذف');
            window.canceladdCashCoEdit();
            await window.refreshaddCashCoData();
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
    window.importaddCashCoFromFile = async function(inputEl){
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
                    action: 'addCashCompany',
                no: (r[0]||'').toString().trim(),
                date: _normDate((r[1]||'').trim()),
                value: (r[2]||'').toString().trim(),
                deduct: (r[3]||'').toString().trim(),
                note: (r[4]||'').toString().trim(),
                    timestamp: new Date().toISOString(),
                    user: _currentUser()
                };
                // require at least one non-note field
                if (![p.no,p.date,p.value,p.deduct].some(v => v)) continue;
                payloads.push(p);
            }
            const total = payloads.length;
            if (!total) { (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة'); return; }
            _setStatus(`⏳ جارى رفع ${total} صف...`);
            if (window.LV) { LV.showOverlay('جارى رفع البيانات...', `إجمالى الصفوف: ${total}`); LV.updateOverlay(0, total); }
            let ok = 0, fail = 0;
            try {
                const rr = await _post({ action: 'bulkCashCompany', rows: payloads, user: _currentUser(), timestamp: new Date().toISOString() });
                ok = (rr && rr.added) || total;
                if (window.LV) LV.updateOverlay(ok, total, `تم رفع ${ok}`);
            } catch(_){
                for (let i = 0; i < payloads.length; i++){
                    try { await _post(payloads[i]); ok++; } catch(e){ fail++; }
                    if (window.LV) LV.updateOverlay(ok+fail, total, `نجح ${ok} — فشل ${fail}`);
                }
            }
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshaddCashCoData();
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
        if (ev.detail && ev.detail.tab === 'cashco'){
            const root = document.getElementById('addCashCoRoot');
            if (root && !_rendered) _render(root);
            window.refreshaddCashCoData();
        }
    });
})();
