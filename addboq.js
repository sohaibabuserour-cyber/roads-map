/* ============================================================
   addboq.js
   منطق "جدول الكميات" داخل شاشة "إضافة" الجديدة.
   نسخة موازية لمنطق BOQ الموجود في main.js مع بادئة addBoq
   لتجنّب التعارض بالـ IDs والدوال.

   الترتيب في index.html (بعد main.js):
       <script src="main.js"></script>
       ...
       <script src="addboq.js"></script>

   يعتمد على:
       parseCSVLine  — utils.js
       LV.showOverlay / hideOverlay / updateOverlay — main.js
       showAlert — main.js
       sheetIdsConfig / BOQ_SHEET_ID / BOQ_SCRIPT_URL — config.js / settings
       currentUser — auth.js
   ============================================================ */

(function () {
    'use strict';

    window._addBoqEditRow      = null;
    window._addBoqItems        = [];
    window._addBoqRevisedCount = 0;

    /* ---------- مصادر البيانات ---------- */
    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig['BOQ_SCRIPT_URL'])
            || window.BOQ_SCRIPT_URL
            || localStorage.getItem('BOQ_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig.BOQ_SHEET_ID)
              || window.BOQ_SHEET_ID || window.BILLS_SHEET_ID || '';
        if (id && /\/d\//.test(id)) {
            const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (m) id = m[1];
        }
        return id;
    }
    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el) el.textContent = msg || '';
    }
    function _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }
    function _fmt(n) {
        const v = Number(String(n || '').replace(/,/g, '')) || 0;
        return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    function _normItemNo(s) {
        if (typeof window._normItemNo === 'function') {
            try { return window._normItemNo(s); } catch (_) {}
        }
        let str = (s == null ? '' : String(s)).trim();
        if (!str) return '';
        const m = str.match(/^([0-9.\-_/\s]+)(.*)$/);
        if (!m) return str;
        let core = m[1].trim();
        const suffix = m[2] || '';
        if (/^\d+\.\d+$/.test(core))       core = String(parseFloat(core));
        else if (/^\d+\.0*$/.test(core))   core = core.replace(/\.0*$/, '');
        else if (/^0+\d+$/.test(core))     core = String(parseInt(core, 10));
        return core + suffix;
    }
    function _cmpItemNo(a, b) {
        const pa = String(a || '').split(/[.\-_/\s]+/).map(s => { const n = parseFloat(s); return (s !== '' && !isNaN(n)) ? n : s; });
        const pb = String(b || '').split(/[.\-_/\s]+/).map(s => { const n = parseFloat(s); return (s !== '' && !isNaN(n)) ? n : s; });
        const n = Math.max(pa.length, pb.length);
        for (let i = 0; i < n; i++) {
            const x = pa[i], y = pb[i];
            if (x === undefined) return -1;
            if (y === undefined) return 1;
            if (typeof x === 'number' && typeof y === 'number') { if (x !== y) return x - y; }
            else { const r = String(x).localeCompare(String(y), 'ar', { numeric: true }); if (r) return r; }
        }
        return 0;
    }

    /* ---------- Preview / Form helpers ---------- */
    window.updateAddBOQPreview = function () {
        _renderTable();
    };

    window.addAddBOQRevisedColumn = function (preset) {
        const list = document.getElementById('addBoqRevisedList');
        if (!list) return;
        window._addBoqRevisedCount = (window._addBoqRevisedCount || 0) + 1;
        const idx = window._addBoqRevisedCount;
        const row = document.createElement('div');
        row.className = 'boq-rev-row';
        row.dataset.revIdx = String(idx);
        row.innerHTML = `
            <div class="lbl">كمية جدول معدل ${idx}</div>
            <input type="number" step="any" class="boq-rev-qty" placeholder="الكمية" value="${preset != null ? _esc(preset) : ''}">
            <button type="button" onclick="this.parentNode.remove()" title="حذف"
                style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:32px;height:32px;border-radius:7px;cursor:pointer;font-size:14px;">✕</button>
        `;
        list.appendChild(row);
    };

    function _resetForm() {
        ['addBoqItemNo', 'addBoqDesc', 'addBoqUnit', 'addBoqPrice', 'addBoqContractQty'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const list = document.getElementById('addBoqRevisedList');
        if (list) list.innerHTML = '';
        window._addBoqRevisedCount = 0;
        window.updateAddBOQPreview();
    }

    window.cancelAddBOQEdit = function () {
        window._addBoqEditRow = null;
        const wrap = document.getElementById('addBoqFormWrap');
        if (wrap) wrap.classList.remove('edit-mode');
        _resetForm();
        _renderTable();
    };

    /* ---------- Refresh data ---------- */
    window.refreshAddBOQData = async function () {
        const id = _sheetId();
        if (!id) {
            window._addBoqItems = [];
            _renderTable();
            _setStatus('⚠️ أضف شيت جدول الكميات في الإعدادات');
            return;
        }
        const tabs = ['جدول الكميات', 'BOQ', 'boq', 'Sheet1'];
        let csv = '';
        for (const tab of tabs) {
            try {
                const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
                const r = await fetch(u);
                if (r.ok) {
                    const t = await r.text();
                    if (t && !t.trim().startsWith('<') && t.includes(',')) { csv = t; break; }
                }
            } catch (_) {}
        }
        if (!csv) {
            try {
                const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`;
                const r = await fetch(url);
                if (r.ok) csv = await r.text();
            } catch (_) {}
        }
        const items = [];
        if (csv && !csv.trim().startsWith('<')) {
            const lines = csv.split(/\r?\n/).filter(l => l.trim());
            for (let i = 1; i < lines.length; i++) {
                const v = (typeof parseCSVLine === 'function') ? parseCSVLine(lines[i]) : lines[i].split(',');
                const no = _normItemNo((v[0] || '').trim());
                const desc = (v[1] || '').trim();
                if (!no && !desc) continue;
                items.push({
                    row: i + 1,
                    itemNo: no,
                    description: desc,
                    unit: (v[2] || '').trim(),
                    price: (v[3] || '').trim(),
                    contractQty: (v[4] || '').trim(),
                    revised: v.slice(5).map(x => (x || '').trim()).filter(x => x !== '')
                });
            }
        }
        window._addBoqItems = items;
        _renderTable();
    };

    /* ---------- Render table ---------- */
    function _renderTable() {
        const tb    = document.getElementById('addBoqItemsBody');
        const cnt   = document.getElementById('addBoqItemsCount');
        const thead = document.getElementById('addBoqItemsHead');
        if (!tb) return;
        const all = window._addBoqItems || [];

        const fNo    = (document.getElementById('addBoqItemNo')?.value || '').trim().toLowerCase();
        const fDesc  = (document.getElementById('addBoqDesc')?.value || '').trim().toLowerCase();
        const fUnit  = (document.getElementById('addBoqUnit')?.value || '').trim().toLowerCase();
        const fPrice = (document.getElementById('addBoqPrice')?.value || '').trim();
        const fQty   = (document.getElementById('addBoqContractQty')?.value || '').trim();
        const match = (val, q) => !q || String(val || '').toLowerCase().includes(q);
        const matchNum = (val, q) => !q || String(val || '').replace(/,/g, '').includes(q.replace(/,/g, ''));

        const items = all.filter(it =>
            match(it.itemNo, fNo) &&
            match(it.description, fDesc) &&
            match(it.unit, fUnit) &&
            matchNum(it.price, fPrice) &&
            matchNum(it.contractQty, fQty)
        ).slice().sort((a, b) => _cmpItemNo(a.itemNo, b.itemNo));

        let maxRev = 0;
        items.forEach(it => {
            const arr = Array.isArray(it.revised) ? it.revised : [];
            let last = 0;
            for (let i = arr.length - 1; i >= 0; i--) {
                if (String(arr[i] == null ? '' : arr[i]).trim() !== '') { last = i + 1; break; }
            }
            if (last > maxRev) maxRev = last;
        });

        if (thead) {
            const revHeads = Array.from({ length: maxRev }, (_, i) => `<th>كمية معدلة ${i + 1}</th>`).join('');
            thead.innerHTML = `<tr>
                <th class="col-itemno">رقم البند</th>
                <th class="col-itemdesc">البند</th>
                <th>الوحدة</th>
                <th>السعر</th>
                <th>الكمية التعاقدية</th>
                ${revHeads}
                <th>الإجمالي</th>
                <th class="col-actions"></th>
            </tr>`;
        }

        if (cnt) cnt.textContent = '(' + items.length + (all.length !== items.length ? ' / ' + all.length : '') + ')';

        if (!items.length) {
            const colspan = 6 + maxRev + 1;
            tb.innerHTML = '<tr><td colspan="' + colspan + '" class="boq-empty">' +
                (all.length ? 'لا توجد بنود مطابقة للفلتر' : 'لا توجد بنود محفوظة — أضف بنداً أو ارفع ملف CSV') + '</td></tr>';
            return;
        }

        tb.innerHTML = items.map(it => {
            const price = parseFloat(String(it.price || '').replace(/,/g, '')) || 0;
            const qty   = parseFloat(String(it.contractQty || '').replace(/,/g, '')) || 0;
            const total = price * qty;
            const arr = Array.isArray(it.revised) ? it.revised : [];
            const revCells = [];
            for (let i = 0; i < maxRev; i++) {
                const v = (arr[i] == null ? '' : arr[i]);
                revCells.push(`<td style="color:#7fd1ff;font-weight:700;">${_fmt(v)}</td>`);
            }
            return `
            <tr data-row="${it.row}" onclick="loadAddBOQItemForEdit(${it.row})" class="${window._addBoqEditRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.itemNo)}</td>
                <td class="col-itemdesc" title="${_esc(it.description)}">${_esc(it.description)}</td>
                <td>${_esc(it.unit)}</td>
                <td>${_fmt(it.price)}</td>
                <td>${_fmt(it.contractQty)}</td>
                ${revCells.join('')}
                <td style="color:#f5c842;font-weight:700;">${_fmt(total)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف البند"
                    onclick="event.stopPropagation();deleteAddBOQItem(${it.row}, ${JSON.stringify(it.itemNo || '').replace(/"/g, '&quot;')})">🗑</button></td>
            </tr>`;
        }).join('');
    }

    /* ---------- Filter wiring ---------- */
    (function wireFilters() {
        document.addEventListener('DOMContentLoaded', () => {
            const fn = () => _renderTable();
            ['addBoqItemNo', 'addBoqDesc', 'addBoqUnit', 'addBoqPrice', 'addBoqContractQty'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.addEventListener('input', fn); el.addEventListener('change', fn); }
            });
        });
    })();

    /* ---------- Load row into form ---------- */
    window.loadAddBOQItemForEdit = function (row) {
        const it = (window._addBoqItems || []).find(x => x.row === row);
        if (!it) return;
        window._addBoqEditRow = row;
        const wrap = document.getElementById('addBoqFormWrap');
        if (wrap) wrap.classList.add('edit-mode');
        document.getElementById('addBoqItemNo').value      = it.itemNo || '';
        document.getElementById('addBoqDesc').value        = it.description || '';
        document.getElementById('addBoqUnit').value        = it.unit || '';
        document.getElementById('addBoqPrice').value       = String(it.price || '').replace(/,/g, '');
        document.getElementById('addBoqContractQty').value = String(it.contractQty || '').replace(/,/g, '');
        const list = document.getElementById('addBoqRevisedList');
        if (list) list.innerHTML = '';
        window._addBoqRevisedCount = 0;
        (it.revised || []).forEach(v => window.addAddBOQRevisedColumn(v));
        window.updateAddBOQPreview();
        _renderTable();
    };

    /* ---------- Save / Update ---------- */
    window.saveAddBOQItem = async function () {
        const itemNo      = _normItemNo((document.getElementById('addBoqItemNo')?.value || '').trim());
        const desc        = (document.getElementById('addBoqDesc')?.value || '').trim();
        const unit        = (document.getElementById('addBoqUnit')?.value || '').trim();
        const price       = (document.getElementById('addBoqPrice')?.value || '').trim();
        const contractQty = (document.getElementById('addBoqContractQty')?.value || '').trim();

        if (!itemNo || !desc) {
            (window.showAlert || alert)('⚠️ أدخل رقم البند والوصف');
            return;
        }
        const dup = (window._addBoqItems || []).find(it =>
            String(it.itemNo || '').trim()      === itemNo &&
            String(it.description || '').trim() === desc &&
            it.row !== window._addBoqEditRow
        );
        if (dup) {
            (window.showAlert || alert)('⚠️ هذا البند موجود بالفعل (رقم البند والبند متطابقان)');
            return;
        }
        const revised = {};
        document.querySelectorAll('#addBoqRevisedList .boq-rev-row').forEach(row => {
            const idx = row.dataset.revIdx;
            const v = row.querySelector('.boq-rev-qty')?.value.trim() || '';
            if (v !== '') revised['revisedQty' + idx] = v;
        });

        const url = _scriptUrl();
        if (!url) {
            (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات');
            return;
        }
        const payload = {
            action: window._addBoqEditRow ? 'updateBOQ' : 'addBOQ',
            row: window._addBoqEditRow || undefined,
            itemNo, description: desc, unit, price, contractQty,
            ...revised,
            timestamp: new Date().toISOString(),
            user: (window.currentUser && (window.currentUser.name || window.currentUser.email)) || ''
        };

        _setStatus('⏳ جاري الحفظ...');
        if (window.LV) { LV.showOverlay(window._addBoqEditRow ? 'جاري تحديث البند...' : 'جاري حفظ البند...', 'يتم إرسال البيانات إلى الشيت'); LV.updateOverlay(0, 1); }
        try {
            const res = await fetch(url, {
                method: 'POST', redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const text = await res.text();
            let result; try { result = JSON.parse(text); } catch (_) { throw new Error('استجابة غير صالحة: ' + text.slice(0, 200)); }
            if (!result || !result.success) throw new Error((result && result.message) || 'فشل الحفظ');
            if (window.LV) LV.updateOverlay(1, 1, 'تم — جاري تحديث الجدول...');
            _setStatus('✅ تم الحفظ');
            window.cancelAddBOQEdit();
            await window.refreshAddBOQData();
            if (window.LV) LV.hideOverlay();
            (window.showAlert || alert)('✅ ' + (result.message || 'تم الحفظ'));
        } catch (e) {
            console.error(e);
            _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert || alert)('❌ ' + e.message);
        }
    };

    /* ---------- Delete ---------- */
    window.deleteAddBOQItem = async function (row, itemNo) {
        if (!row) return;
        if (!confirm(`هل تريد حذف البند ${itemNo || '#' + row}؟`)) return;
        const url = _scriptUrl();
        if (!url) { (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات'); return; }
        _setStatus('⏳ جاري الحذف...');
        if (window.LV) { LV.showOverlay('جاري حذف البند...', ''); LV.updateOverlay(0, 1); }
        try {
            const res = await fetch(url, {
                method: 'POST', redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'deleteBOQ', row,
                    timestamp: new Date().toISOString(),
                    user: (window.currentUser && (window.currentUser.name || window.currentUser.email)) || ''
                })
            });
            const text = await res.text();
            let rr; try { rr = JSON.parse(text); } catch (_) { throw new Error('استجابة غير صالحة'); }
            if (!rr || !rr.success) throw new Error((rr && rr.message) || 'فشل الحذف');
            if (window.LV) LV.updateOverlay(1, 1, 'تم الحذف');
            _setStatus('✅ تم الحذف');
            window.cancelAddBOQEdit();
            await window.refreshAddBOQData();
            if (window.LV) LV.hideOverlay();
        } catch (e) {
            console.error(e);
            _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert || alert)('❌ ' + e.message);
        }
    };

    /* ---------- CSV / TXT Import ---------- */
    function _parseDelimited(text) {
        const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
        let delim = ',';
        if (sample.indexOf('\t') > -1) delim = '\t';
        else if (sample.indexOf(';') > -1 && sample.split(';').length > sample.split(',').length) delim = ';';
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        return lines.map(l => delim === ',' && typeof parseCSVLine === 'function'
            ? parseCSVLine(l)
            : l.split(delim).map(s => s.trim().replace(/^"|"$/g, '')));
    }

    window.importAddBOQFromFile = async function (inputEl) {
        const f = inputEl && inputEl.files && inputEl.files[0];
        if (!f) return;
        try {
            const text = await f.text();
            const rows = _parseDelimited(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            const first = rows[0].map(c => String(c || '').toLowerCase());
            if (first.some(c => /رقم|البند|item|description|unit|price|سعر|كمية/.test(c))) start = 1;
            const url = _scriptUrl();
            if (!url) { (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات'); return; }

            const payloads = [];
            for (let i = start; i < rows.length; i++) {
                const r = rows[i];
                const itemNo = _normItemNo((r[0] || '').trim());
                if (!itemNo) continue;
                const p = {
                    action: 'addBOQ',
                    itemNo,
                    description: (r[1] || '').trim(),
                    unit: (r[2] || '').trim(),
                    price: (r[3] || '').trim(),
                    contractQty: (r[4] || '').trim(),
                    timestamp: new Date().toISOString(),
                    user: (window.currentUser && (window.currentUser.name || window.currentUser.email)) || ''
                };
                for (let j = 5; j < r.length; j++) {
                    const v = (r[j] || '').trim();
                    if (v !== '') p['revisedQty' + (j - 4)] = v;
                }
                payloads.push(p);
            }
            const total = payloads.length;
            if (!total) { (window.showAlert || alert)('⚠️ لا توجد صفوف صالحة'); return; }

            _setStatus(`⏳ جاري رفع ${total} صف...`);
            if (window.LV) { LV.showOverlay('جاري رفع بنود جدول الكميات...', `إجمالي الصفوف: ${total}`); LV.updateOverlay(0, total); }

            const res = await fetch(url, {
                method: 'POST', redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'bulkBOQ', forceAdd: false, rows: payloads,
                    user: (window.currentUser && (window.currentUser.name || window.currentUser.email)) || '',
                    timestamp: new Date().toISOString()
                })
            });
            const t = await res.text();
            let rr; try { rr = JSON.parse(t); } catch (_) { throw new Error('استجابة غير صالحة من الخادم'); }
            if (!rr || rr.success !== true) throw new Error((rr && (rr.message || rr.error)) || 'فشل الإرسال');
            const added = rr.added || 0;
            if (window.LV) { LV.updateOverlay(total, total, `تم رفع ${added}`); }
            _setStatus(`✅ تم رفع ${added} بند`);
            await window.refreshAddBOQData();
            if (window.LV) LV.hideOverlay();
            (window.showAlert || alert)(`✅ تم رفع ${added} بند`);
        } catch (e) {
            console.error(e);
            _setStatus('❌ ' + e.message);
            if (window.LV) LV.hideOverlay();
            (window.showAlert || alert)('❌ ' + e.message);
        } finally {
            if (inputEl) inputEl.value = '';
        }
    };

    /* ============================================================
       ADDITION SCREEN (الشاشة الكاملة + Sidebar يمين)
       ============================================================ */
    window.openAdditionScreen = async function () {
        const scr = document.getElementById('additionScreen');
        if (!scr) return;
        scr.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // افتراضي: تبويب جدول الكميات
        window.switchAdditionTab('boq');
        _setStatus('⏳ جاري تحميل البيانات...');
        try {
            await window.refreshAddBOQData();
            _setStatus('✅ جاهز');
        } catch (e) {
            console.warn(e);
            _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    window.closeAdditionScreen = function () {
        const scr = document.getElementById('additionScreen');
        if (scr) scr.style.display = 'none';
        document.body.style.overflow = '';
    };

    window.switchAdditionTab = function (tabId) {
    document.querySelectorAll('#additionScreen .add-side-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    document.querySelectorAll('#additionScreen .add-tab-panel').forEach(el => {
        el.style.display = (el.dataset.tab === tabId) ? 'flex' : 'none';
    });
    // أضف الـ event
    setTimeout(function() {
        try {
            window.dispatchEvent(new CustomEvent('additionTab:changed', { detail: { tab: tabId } }));
        } catch(_) {}
    }, 50);
};
})();
