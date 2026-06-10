/* ============================================================
   addquantity.js
   منطق "تسجيل الكمية" داخل شاشة "إضافة" — Sidebar Panel.
   نسخة موازية لنمط addboq.js مع بادئة addQty.

   يعتمد على:
     parseCSVLine                              — utils.js
     LV.showOverlay/hideOverlay/updateOverlay  — main.js
     showAlert, _normItemNo, _parseAnyDate,
       _dateToInputVal                          — main.js / utils.js
     sheetIdsConfig / QTY_SHEET_ID /
       QTY_SCRIPT_URL                        — config.js
     currentUser                               — auth.js
   ============================================================ */
(function () {
    'use strict';

    window._addQtyEditRow = null;
    window._addQtyItems   = [];
    let   _rendered = false;

    /* ---------- Sources ---------- */
    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig['QTY_SCRIPT_URL'])
            || window['QTY_SCRIPT_URL']
            || localStorage.getItem('QTY_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig['QTY_SHEET_ID'])
              || window['QTY_SHEET_ID'] || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }

    /* ---------- Helpers ---------- */
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'qty') el.textContent = msg || '';
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
        if (!url) throw new Error('⚠️ أضف رابط سكريبت تسجيل الكمية فى الإعدادات (QTY_SCRIPT_URL)');
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
    
    /* ---------- BOQ items loader (for dropdown) ---------- */
    window._addQty_BoqList = [];
    function _boqSheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig.BOQ_SHEET_ID)
              || window.BOQ_SHEET_ID || window.BILLS_SHEET_ID || '';
        if (id && /\/d\//.test(id)) { const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/); if (m) id = m[1]; }
        return id;
    }
    async function _loadBoq(){
        const id = _boqSheetId(); if (!id) { window._addQty_BoqList = []; return; }
        const tabs = ['جدول الكميات','BOQ','boq','Sheet1'];
        let csv = '';
        for (const tab of tabs) {
            try {
                const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
                const r = await fetch(u);
                if (r.ok) { const t = await r.text(); if (t && !t.trim().startsWith('<') && t.includes(',')) { csv = t; break; } }
            } catch(_){}
        }
        if (!csv) { try { const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`); if (r.ok) csv = await r.text(); } catch(_){} }
        if (!csv || csv.trim().startsWith('<')) { window._addQty_BoqList = []; return; }
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        const items = []; const seen = new Set();
        for (let i = 1; i < lines.length; i++) {
            const v = (typeof parseCSVLine === 'function') ? parseCSVLine(lines[i]) : lines[i].split(',');
            const no = _normItemNo((v[0]||'').trim());
            const desc = (v[1]||'').trim();
            if (!no && !desc) continue;
            const k = no + '||' + desc; if (seen.has(k)) continue; seen.add(k);
            items.push({ no, desc });
        }
        window._addQty_BoqList = items;
    }
    function _refreshBoqSelects(){
        const selNo = document.getElementById('addQtyItemNo');
        const selDesc = document.getElementById('addQtyItem');
        if (!selNo || !selDesc) return;
        const prevNo = selNo.value, prevDesc = selDesc.value;
        selNo.innerHTML = '<option value="">— اختر رقم —</option>';
        selDesc.innerHTML = '<option value="">— اختر بنداً —</option>';
        (window._addQty_BoqList || []).forEach(({ no, desc }) => {
            const o1 = document.createElement('option');
            o1.value = no; o1.textContent = no || '—'; o1.dataset.desc = desc;
            selNo.appendChild(o1);
            const o2 = document.createElement('option');
            o2.value = desc; o2.textContent = desc || '—'; o2.dataset.no = no; o2.title = desc || '';
            selDesc.appendChild(o2);
        });
        // Re-apply current editing values if any
        if (window._addQtyEditRow){
            const it = (window._addQtyItems || []).find(x => x.row === window._addQtyEditRow);
            if (it){
                if (it.itemNo && !selNo.querySelector(`option[value="${CSS.escape(it.itemNo)}"]`)){
                    const o = document.createElement('option'); o.value=it.itemNo; o.textContent=it.itemNo+' (مخصّص)'; o.dataset.desc=it.item||''; selNo.appendChild(o);
                }
                if (it.item && !selDesc.querySelector(`option[value="${CSS.escape(it.item)}"]`)){
                    const o = document.createElement('option'); o.value=it.item; o.textContent=it.item+' (مخصّص)'; o.dataset.no=it.itemNo||''; selDesc.appendChild(o);
                }
                selNo.value = it.itemNo || ''; selDesc.value = it.item || ''; return;
            }
        }
        if (prevNo && selNo.querySelector(`option[value="${CSS.escape(prevNo)}"]`)) selNo.value = prevNo;
        if (prevDesc && selDesc.querySelector(`option[value="${CSS.escape(prevDesc)}"]`)) selDesc.value = prevDesc;
    }
    // sync no <-> desc
    document.addEventListener('change', e => {
        if (e.target && e.target.id === 'addQtyItemNo'){
            const selDesc = document.getElementById('addQtyItem');
            const opt = e.target.selectedOptions[0]; const desc = opt ? (opt.dataset.desc||'') : '';
            if (selDesc && desc && selDesc.querySelector(`option[value="${CSS.escape(desc)}"]`)) selDesc.value = desc;
        }
        if (e.target && e.target.id === 'addQtyItem'){
            const selNo = document.getElementById('addQtyItemNo');
            const opt = e.target.selectedOptions[0]; const no = opt ? (opt.dataset.no||'') : '';
            if (selNo && no && selNo.querySelector(`option[value="${CSS.escape(no)}"]`)) selNo.value = no;
        }
    });


    /* ---------- Render UI ---------- */
    function _render(root){
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div id="addQtyFormWrap">
                <div class="edit-badge">✏️ تعديل صف موجود — اضغط حفظ للتحديث</div>
                <div class="boq-form" style="grid-template-columns:140px 1fr 150px 130px 1fr auto;">
                    
                <div>
                    <label>رقم البند</label>
                    <select id="addQtyItemNo" style="width:100%;box-sizing:border-box;padding:9px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-family:'Cairo',sans-serif;font-size:13px;">
                        <option value="">— اختر رقم —</option>
                    </select>
                </div>
                
                <div>
                    <label>البند</label>
                    <select id="addQtyItem" style="width:100%;box-sizing:border-box;padding:9px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-family:'Cairo',sans-serif;font-size:13px;">
                        <option value="">— اختر بنداً —</option>
                    </select>
                </div>
                <div><label>التاريخ</label><input type="date" id="addQtyDate" placeholder=""></div>
                <div><label>الكمية المنفذة</label><input type="number" step="any" id="addQtyQty" placeholder="0"></div>
                <div><label>الموقع / الملاحظة</label><input type="text" id="addQtyNote" placeholder="موقع / ملاحظة"></div>
                    <div class="form-actions">
                        <button class="btn-save" onclick="saveaddQtyItem()">💾 حفظ</button>
                        <button class="btn-cancel-edit" onclick="canceladdQtyEdit()">إلغاء</button>
                    </div>
                </div>
            </div>
            <div class="boq-section-title">
                📦 تسجيل الكمية <span id="addQtyCount" style="color:#5cc890;"></span>
                <span class="spacer"></span>
                <input type="file" id="addQtyImportFile" accept=".csv,.txt" style="display:none;" onchange="importaddQtyFromFile(this)">
                <button class="btn-import" onclick="document.getElementById('addQtyImportFile').click()">⬆️ رفع من ملف</button>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshaddQtyData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>رقم البند</th><th>البند</th><th>التاريخ</th><th>الكمية</th><th>الموقع/الملاحظة</th><th class="col-actions"></th></tr></thead>
                    <tbody id="addQtyBody"><tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
        _rendered = true;
    }

    /* ---------- Refresh / read ---------- */
    window.refreshaddQtyData = async function(){
        _setStatus('⏳ جارى تحميل البيانات...');
        try {
        await _loadBoq();
            // First try Apps Script "get" action; fallback to CSV export
            let rows = null;
            try {
                const snap = await _post({ action: 'getQuantity' });
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
            itemNo: (r["\u0631\u0642\u0645 \u0627\u0644\u0628\u0646\u062f"], r["itemNo"] || (v[0]||'')).toString().trim(),
            item: (r["\u0627\u0644\u0628\u0646\u062f"], r["item"] || (v[1]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[2]||'').trim()),
            qty: (r["\u0627\u0644\u0643\u0645\u064a\u0629"], r["Qty"], r["qty"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"], r["\u0627\u0644\u0645\u0648\u0642\u0639"] || (v[4]||'')).toString().trim(),
                    });
                });
            } else {
                // CSV fallback
                const id = _sheetId();
                if (id){
                    const tabs = ["الكميات", "Quantities", "quantity", "Sheet1"];
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
            itemNo: (r["\u0631\u0642\u0645 \u0627\u0644\u0628\u0646\u062f"], r["itemNo"] || (v[0]||'')).toString().trim(),
            item: (r["\u0627\u0644\u0628\u0646\u062f"], r["item"] || (v[1]||'')).toString().trim(),
            date: _normDate(r["\u0627\u0644\u062a\u0627\u0631\u064a\u062e"], r["Date"], r["date"] || (v[2]||'').trim()),
            qty: (r["\u0627\u0644\u0643\u0645\u064a\u0629"], r["Qty"], r["qty"] || (v[3]||'')).toString().trim(),
            note: (r["\u0645\u0644\u0627\u062d\u0638\u0629"], r["Note"], r["note"], r["\u0627\u0644\u0645\u0648\u0642\u0639"] || (v[4]||'')).toString().trim(),
                            });
                        }
                    }
                }
            }
            window._addQtyItems = items;
        _refreshBoqSelects();
            _renderTable();
            _setStatus('✅ جاهز');
        } catch(e){
            console.warn(e);
            window._addQtyItems = [];
        _refreshBoqSelects();
            _renderTable();
            _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    /* ---------- Render table ---------- */
    function _renderTable(){
        const tb  = document.getElementById('addQtyBody');
        const cnt = document.getElementById('addQtyCount');
        if (!tb) return;
        const all = window._addQtyItems || [];
        if (cnt) cnt.textContent = '(' + all.length + ')';
        if (!all.length){
            tb.innerHTML = '<tr><td colspan="6" class="boq-empty">— لا توجد بيانات بعد — أضف صفاً أو ارفع ملف CSV</td></tr>';
            return;
        }
        tb.innerHTML = all.map(it => `
            <tr data-row="${it.row}" onclick="loadaddQtyForEdit(${it.row})" class="${window._addQtyEditRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.itemNo)}</td><td>${_esc(it.item)}</td><td>${_esc(it.date)}</td><td>${_fmt(it.qty)}</td><td>${_esc(it.note)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف الصف"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
                    onclick="event.stopPropagation();deleteaddQtyRow(${it.row})">🗑</button></td>
            </tr>
        `).join('');
    }

    /* ---------- Load row into form ---------- */
    window.loadaddQtyForEdit = function(row){
        const it = (window._addQtyItems || []).find(x => x.row === row); if (!it) return;
        window._addQtyEditRow = row;
        const wrap = document.getElementById('addQtyFormWrap'); if (wrap) wrap.classList.add('edit-mode');
        _refreshBoqSelects();
        if (document.getElementById('addQtyItemNo')) document.getElementById('addQtyItemNo').value = it.itemNo || '';
        if (document.getElementById('addQtyItem')) document.getElementById('addQtyItem').value = it.item || '';
        if (document.getElementById('addQtyDate')) document.getElementById('addQtyDate').value = it.date || '';
        if (document.getElementById('addQtyQty')) document.getElementById('addQtyQty').value = it.qty || '';
        if (document.getElementById('addQtyNote')) document.getElementById('addQtyNote').value = it.note || '';
        _renderTable();
    };

    window.canceladdQtyEdit = function(){
        window._addQtyEditRow = null;
        const wrap = document.getElementById('addQtyFormWrap'); if (wrap) wrap.classList.remove('edit-mode');
        if (document.getElementById('addQtyItemNo')) document.getElementById('addQtyItemNo').value = '';
        if (document.getElementById('addQtyItem')) document.getElementById('addQtyItem').value = '';
        if (document.getElementById('addQtyDate')) document.getElementById('addQtyDate').value = '';
        if (document.getElementById('addQtyQty')) document.getElementById('addQtyQty').value = '';
        if (document.getElementById('addQtyNote')) document.getElementById('addQtyNote').value = '';
        _renderTable();
    };

    /* ---------- Save / Update ---------- */
    window.saveaddQtyItem = async function(){
        const itemNo = (document.getElementById('addQtyItemNo')?.value || '').trim();
        const item = (document.getElementById('addQtyItem')?.value || '').trim();
        const date = (document.getElementById('addQtyDate')?.value || '').trim();
        const qty = (document.getElementById('addQtyQty')?.value || '').trim();
        const note = (document.getElementById('addQtyNote')?.value || '').trim();
        if (!itemNo || !item || !date || !qty) { (window.showAlert||alert)('⚠️ أكمل الحقول المطلوبة'); return; }
        const dup = (window._addQtyItems || []).find(it =>
            String(it.itemNo||'').trim() === String(itemNo).trim() && String(it.date||'').trim() === String(date).trim() && String(it.qty||'').trim() === String(qty).trim() && String(it.note||'').trim() === String(note).trim() && it.row !== window._addQtyEditRow
        );
        if (dup) { (window.showAlert||alert)('⚠️ هذا الصف موجود بالفعل (بنفس البيانات الأساسية)'); return; }
        _setStatus('⏳ جارى الحفظ...');
        if (window.LV) { LV.showOverlay(window._addQtyEditRow ? 'جارى تحديث الصف...' : 'جارى حفظ الصف...', 'يتم إرسال البيانات إلى الشيت'); LV.updateOverlay(0,1); }
        try {
            const payload = {
                action: window._addQtyEditRow ? 'updateQuantity' : 'addQuantity',
                row: window._addQtyEditRow || undefined,
                itemNo,
            item,
            date,
            qty,
            note,
                timestamp: new Date().toISOString(),
                user: _currentUser()
            };
            await _post(payload);
            if (window.LV) LV.updateOverlay(1,1,'تم — جارى تحديث الجدول...');
            _setStatus('✅ تم الحفظ');
            window.canceladdQtyEdit();
            await window.refreshaddQtyData();
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('✅ تم الحفظ');
        } catch(e){
            console.error(e); _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert||alert)('❌ ' + e.message);
        }
    };

    /* ---------- Delete ---------- */
    window.deleteaddQtyRow = async function(row){
        if (!row) return;
        if (!confirm('هل تريد حذف هذا الصف؟')) return;
        _setStatus('⏳ جارى الحذف...');
        if (window.LV) { LV.showOverlay('جارى حذف الصف...', ''); LV.updateOverlay(0,1); }
        try {
            await _post({ action:'deleteQuantity', row, timestamp: new Date().toISOString(), user: _currentUser() });
            if (window.LV) LV.updateOverlay(1,1,'تم الحذف');
            _setStatus('✅ تم الحذف');
            window.canceladdQtyEdit();
            await window.refreshaddQtyData();
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
    window.importaddQtyFromFile = async function(inputEl){
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
                    action: 'addQuantity',
                itemNo: (r[0]||'').toString().trim(),
                item: (r[1]||'').toString().trim(),
                date: _normDate((r[2]||'').trim()),
                qty: (r[3]||'').toString().trim(),
                note: (r[4]||'').toString().trim(),
                    timestamp: new Date().toISOString(),
                    user: _currentUser()
                };
                // require at least one non-note field
                if (![p.itemNo,p.item,p.date,p.qty].some(v => v)) continue;
                payloads.push(p);
            }
            const total = payloads.length;
            if (!total) { (window.showAlert||alert)('⚠️ لا توجد صفوف صالحة'); return; }
            _setStatus(`⏳ جارى رفع ${total} صف...`);
            if (window.LV) { LV.showOverlay('جارى رفع البيانات...', `إجمالى الصفوف: ${total}`); LV.updateOverlay(0, total); }
            let ok = 0, fail = 0;
            try {
                const rr = await _post({ action: 'bulkQuantity', rows: payloads, user: _currentUser(), timestamp: new Date().toISOString() });
                ok = (rr && rr.added) || total;
                if (window.LV) LV.updateOverlay(ok, total, `تم رفع ${ok}`);
            } catch(_){
                for (let i = 0; i < payloads.length; i++){
                    try { await _post(payloads[i]); ok++; } catch(e){ fail++; }
                    if (window.LV) LV.updateOverlay(ok+fail, total, `نجح ${ok} — فشل ${fail}`);
                }
            }
            if (window.LV) LV.setOverlayMsg && LV.setOverlayMsg('جارى تحديث الجدول...');
            await window.refreshaddQtyData();
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
        if (ev.detail && ev.detail.tab === 'qty'){
            const root = document.getElementById('addQuantityRoot');
            if (root && !_rendered) _render(root);
            window.refreshaddQtyData();
        }
    });
})();
