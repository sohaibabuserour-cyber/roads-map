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
       parseCSVLine, _esc, fmtNum, normItemNo, cmpItemNo,
       parseDelimitedText, getConfigScriptUrl, getConfigSheetId — utils.js
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

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el) el.textContent = msg || '';
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
        const id = getConfigSheetId('BOQ_SHEET_ID', window.BOQ_SHEET_ID, window.BILLS_SHEET_ID);
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
                const no = normItemNo((v[0] || '').trim());
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
        ).slice().sort((a, b) => cmpItemNo(a.itemNo, b.itemNo));

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
                revCells.push(`<td style="color:#7fd1ff;font-weight:700;">${fmtNum(v)}</td>`);
            }
            return `
            <tr data-row="${it.row}" onclick="loadAddBOQItemForEdit(${it.row})" class="${window._addBoqEditRow === it.row ? 'active-edit' : ''}">
                <td>${_esc(it.itemNo)}</td>
                <td class="col-itemdesc" title="${_esc(it.description)}">${_esc(it.description)}</td>
                <td>${_esc(it.unit)}</td>
                <td>${fmtNum(it.price)}</td>
                <td>${fmtNum(it.contractQty)}</td>
                ${revCells.join('')}
                <td style="color:#f5c842;font-weight:700;">${fmtNum(total)}</td>
                <td class="col-actions"><button type="button" class="row-del-btn" title="حذف البند"
                    style="background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);color:#ff8a80;width:28px;height:28px;border-radius:7px;cursor:pointer;"
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
        const itemNo      = normItemNo((document.getElementById('addBoqItemNo')?.value || '').trim());
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

        const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
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
        const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
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
    window.importAddBOQFromFile = async function (inputEl) {
        const f = inputEl && inputEl.files && inputEl.files[0];
        if (!f) return;
        try {
            const text = await f.text();
            const rows = parseDelimitedText(text);
            if (!rows.length) throw new Error('الملف فارغ');
            let start = 0;
            const first = rows[0].map(c => String(c || '').toLowerCase());
            if (first.some(c => /رقم|البند|item|description|unit|price|سعر|كمية/.test(c))) start = 1;
            const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
            if (!url) { (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات'); return; }

            const payloads = [];
            for (let i = start; i < rows.length; i++) {
                const r = rows[i];
                const itemNo = normItemNo((r[0] || '').trim());
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
    try {
        window.dispatchEvent(new CustomEvent('additionTab:changed', { detail: { tab: tabId } }));
    } catch(_) {}
};
})();


/* ============================================================
   منطق جدول الكميات المنقول من main.js
   (BOQ Form + Render + Save/Edit + Import + Delete)
   ============================================================ */
/* ====================================================
   BOQ FORM (جدول الكميات) — frame مطابق للبرنامج الزمني
   ==================================================== */
window._boqEditRow = null;       // row being edited (from sheet)
window._boqItems   = [];         // existing BOQ items loaded from sheet
window._boqRevisedCount = 0;

function _boqSetStatus(msg) {
    const el = document.getElementById('boqStatusMsg');
    if (el) el.textContent = msg || '';
}
window.openBOQFormModal = async function () {
    const m = document.getElementById('boqFormModal');
    if (!m) { (window.showAlert || alert)('شاشة جدول الكميات غير موجودة'); return; }
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    cancelBOQEdit();
    updateBOQPreview();
    _boqSetStatus('⏳ جاري تحميل البيانات...');
    try {
        await refreshBOQData();
        _boqSetStatus('✅ جاهز');
    } catch (e) {
        console.warn(e);
        _boqSetStatus('⚠️ ' + (e.message || 'فشل التحميل'));
    }
};

window.closeBOQFormModal = function () {
    const m = document.getElementById('boqFormModal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
};

/* ──────── Live preview ──────── */
window.updateBOQPreview = function () {
    // إطار المعاينة محذوف — الخانات الآن تعمل كفلتر للجدول
    if (typeof _renderBOQTable === 'function') _renderBOQTable();
};


/* ──────── Revised columns ──────── */
window.addBOQRevisedColumn = function (preset) {
    const list = document.getElementById('boqRevisedList');
    if (!list) return;
    window._boqRevisedCount = (window._boqRevisedCount || 0) + 1;
    const idx = window._boqRevisedCount;
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

function _boqResetForm() {
    ['boqItemNo','boqDesc','boqUnit','boqPrice','boqContractQty'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const list = document.getElementById('boqRevisedList');
    if (list) list.innerHTML = '';
    window._boqRevisedCount = 0;
    updateBOQPreview();
}

window.cancelBOQEdit = function () {
    window._boqEditRow = null;
    const wrap = document.getElementById('boqFormWrap');
    if (wrap) wrap.classList.remove('edit-mode');
    _boqResetForm();
    _renderBOQTable();
};

/* ──────── Load existing BOQ items via CSV gviz ──────── */
window.refreshBOQData = async function () {
    const id = getConfigSheetId('BOQ_SHEET_ID', window.BOQ_SHEET_ID, window.BILLS_SHEET_ID);
    if (!id) {
        window._boqItems = [];
        _renderBOQTable();
        _boqSetStatus('⚠️ أضف شيت جدول الكميات في الإعدادات');
        return;
    }
    const tabs = ['جدول الكميات','BOQ','boq','Sheet1'];
    let csv = '';
    for (const tab of tabs) {
        try {
            const u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_t=${Date.now()}`;
            const r = await fetch(u);
            if (r.ok) {
                const t = await r.text();
                if (t && !t.trim().startsWith('<') && t.includes(',')) { csv = t; break; }
            }
        } catch(_){}
    }
    if (!csv) {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0&_t=${Date.now()}`;
            const r = await fetch(url);
            if (r.ok) csv = await r.text();
        } catch(_){}
    }
    const items = [];
    if (csv && !csv.trim().startsWith('<')) {
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        for (let i = 1; i < lines.length; i++) {
            const v = parseCSVLine(lines[i]);
            const no = normItemNo((v[0]||'').trim()), desc = (v[1]||'').trim();
            if (!no && !desc) continue;
            items.push({
                row: i + 1,
                itemNo: no,
                description: desc,
                unit: (v[2]||'').trim(),
                price: (v[3]||'').trim(),
                contractQty: (v[4]||'').trim(),
                revised: v.slice(5).map(x => (x||'').trim()).filter(x => x !== '')
            });
        }
    }
    window._boqItems = items;
    _renderBOQTable();
};

function _lastRevisedQty(it){
    const arr = Array.isArray(it && it.revised) ? it.revised : [];
    for (let i = arr.length - 1; i >= 0; i--){
        const v = String(arr[i] == null ? '' : arr[i]).trim();
        if (v !== '') return v;
    }
    return '';
}

function _renderBOQTable(){
    const tb = document.getElementById('boqItemsBody');
    const cnt = document.getElementById('boqItemsCount');
    const thead = document.getElementById('boqItemsHead');
    if (!tb) return;
    const all = window._boqItems || [];

    // فلتر من خانات الإدخال
    const fNo    = (document.getElementById('boqItemNo')?.value || '').trim().toLowerCase();
    const fDesc  = (document.getElementById('boqDesc')?.value || '').trim().toLowerCase();
    const fUnit  = (document.getElementById('boqUnit')?.value || '').trim().toLowerCase();
    const fPrice = (document.getElementById('boqPrice')?.value || '').trim();
    const fQty   = (document.getElementById('boqContractQty')?.value || '').trim();
    const match = (val, q) => !q || String(val||'').toLowerCase().includes(q);
    const matchNum = (val, q) => !q || String(val||'').replace(/,/g,'').includes(q.replace(/,/g,''));

    const items = all.filter(it =>
        match(it.itemNo, fNo) &&
        match(it.description, fDesc) &&
        match(it.unit, fUnit) &&
        matchNum(it.price, fPrice) &&
        matchNum(it.contractQty, fQty)
    ).slice().sort((a, b) => cmpItemNo(a.itemNo, b.itemNo));

    // أقصى عدد لأعمدة "كمية معدلة" بناءً على البيانات
    let maxRev = 0;
    items.forEach(it => {
        const arr = Array.isArray(it.revised) ? it.revised : [];
        // اعتبر آخر قيمة غير فارغة
        let last = 0;
        for (let i = arr.length - 1; i >= 0; i--){
            if (String(arr[i]==null?'':arr[i]).trim() !== ''){ last = i + 1; break; }
        }
        if (last > maxRev) maxRev = last;
    });

    // أعد بناء رؤوس الأعمدة ديناميكياً
    if (thead){
        const revHeads = Array.from({length: maxRev}, (_, i) =>
            `<th>كمية معدلة ${i + 1}</th>`
        ).join('');
        thead.innerHTML = `<tr>
            <th class="col-itemno">رقم البند</th>
            <th class="col-itemdesc">البند</th>
            <th>الوحدة</th>
            <th>السعر</th>
            <th>الكمية التعاقدية</th>
            ${revHeads}
            <th>الإجمالي</th>
            <th class="col-actions">حذف</th>
        </tr>`;
    }

    const totalLbl = items.length === all.length
        ? (all.length ? `(${all.length})` : '')
        : `(${items.length} / ${all.length})`;
    if (cnt) cnt.textContent = totalLbl;

    const colspan = 7 + maxRev; // 5 ثابتة + إجمالي + حذف + maxRev
    if (!items.length) {
        tb.innerHTML = '<tr><td colspan="' + colspan + '" class="boq-empty">' + (all.length ? 'لا توجد بنود مطابقة للفلتر' : 'لا توجد بنود محفوظة — أضف بنداً أو ارفع ملف CSV') + '</td></tr>';
        return;
    }
    tb.innerHTML = items.map(it => {
        const price = Number(String(it.price||'').replace(/,/g,'')) || 0;
        const contractQty = Number(String(it.contractQty||'').replace(/,/g,'')) || 0;
        const arr = Array.isArray(it.revised) ? it.revised : [];
        // ابن خلايا الكميات المعدلة
        let lastRevNum = null;
        const revCells = [];
        for (let i = 0; i < maxRev; i++){
            const v = String(arr[i] == null ? '' : arr[i]).trim();
            if (v !== ''){
                lastRevNum = Number(v.replace(/,/g,'')) || 0;
                revCells.push(`<td style="color:#7fd1ff;font-weight:700;">${fmtNum(v)}</td>`);
            } else {
                revCells.push(`<td style="color:rgba(255,255,255,0.3);">—</td>`);
            }
        }
        const qtyForTotal = lastRevNum != null ? lastRevNum : contractQty;
        const total = price * qtyForTotal;
        return `
        <tr data-row="${it.row}" onclick="loadBOQItemForEdit(${it.row})" class="${window._boqEditRow === it.row ? 'active-edit' : ''}">
            <td>${_esc(it.itemNo)}</td>
            <td class="col-itemdesc" title="${_esc(it.description)}">${_esc(it.description)}</td>
            <td>${_esc(it.unit)}</td>
            <td>${fmtNum(it.price)}</td>
            <td>${fmtNum(it.contractQty)}</td>
            ${revCells.join('')}
            <td style="color:#f5c842;font-weight:700;">${fmtNum(total)}</td>
            <td class="col-actions"><button type="button" class="row-del-btn" title="حذف البند" onclick="event.stopPropagation();deleteBOQItem(${it.row}, ${JSON.stringify(it.itemNo||'').replace(/"/g,'&quot;')})">🗑</button></td>
        </tr>`;
    }).join('');
}

// وايرنق خانات BOQ كفلتر — يُستدعى مرة على DOMReady
(function _wireBOQFilter(){
    function wireOne(id){
        const el = document.getElementById(id);
        if (!el || el._wiredBoqFilter) return;
        const fn = () => { if (typeof _renderBOQTable === 'function') _renderBOQTable(); };
        el.addEventListener('input', fn);
        el.addEventListener('change', fn);
        el._wiredBoqFilter = true;
    }
    function wireAll(){
        ['boqItemNo','boqDesc','boqUnit','boqPrice','boqContractQty'].forEach(wireOne);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(wireAll, 100));
    else setTimeout(wireAll, 100);
    setTimeout(wireAll, 1500);
})();


window.loadBOQItemForEdit = function (row) {
    const it = window._boqItems.find(x => x.row === row);
    if (!it) return;
    window._boqEditRow = row;
    document.getElementById('boqFormWrap').classList.add('edit-mode');
    document.getElementById('boqItemNo').value      = it.itemNo || '';
    document.getElementById('boqDesc').value        = it.description || '';
    document.getElementById('boqUnit').value        = it.unit || '';
    document.getElementById('boqPrice').value       = String(it.price||'').replace(/,/g,'');
    document.getElementById('boqContractQty').value = String(it.contractQty||'').replace(/,/g,'');
    // load revised
    const list = document.getElementById('boqRevisedList');
    if (list) list.innerHTML = '';
    window._boqRevisedCount = 0;
    (it.revised || []).forEach(v => addBOQRevisedColumn(v));
    updateBOQPreview();
    _renderBOQTable();
};

/* ──────── Save (add / update) ──────── */
window.saveBOQItem = async function () {
    const itemNo      = normItemNo((document.getElementById('boqItemNo')?.value || '').trim());
    const desc        = (document.getElementById('boqDesc')?.value || '').trim();
    const unit        = (document.getElementById('boqUnit')?.value || '').trim();
    const price       = (document.getElementById('boqPrice')?.value || '').trim();
    const contractQty = (document.getElementById('boqContractQty')?.value || '').trim();

    if (!itemNo || !desc) {
        (window.showAlert || alert)('⚠️ أدخل رقم البند والوصف');
        return;
    }
    // Duplicate check: BOTH itemNo AND description must match exactly (as strings) to be a duplicate.
    // "19.1" and "19.10" are different strings → treated as distinct.
    const dup = (window._boqItems || []).find(it =>
        String(it.itemNo || '').trim()       === itemNo &&
        String(it.description || '').trim()  === desc   &&
        it.row !== window._boqEditRow
    );
    if (dup) {
        (window.showAlert || alert)('⚠️ هذا البند موجود بالفعل (رقم البند والبند متطابقان)');
        return;
    }
    const revised = {};
    document.querySelectorAll('#boqRevisedList .boq-rev-row').forEach(row => {
        const idx = row.dataset.revIdx;
        const v   = row.querySelector('.boq-rev-qty')?.value.trim() || '';
        if (v !== '') revised['revisedQty' + idx] = v;
    });

    const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
    if (!url) {
        (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات');
        return;
    }
    const payload = {
        action      : window._boqEditRow ? 'updateBOQ' : 'addBOQ',
        row         : window._boqEditRow || undefined,
        itemNo, description: desc, unit, price, contractQty,
        ...revised,
        timestamp   : new Date().toISOString(),
        user        : (window.currentUser && (currentUser.name||currentUser.email)) || ''
    };

    _boqSetStatus('⏳ جاري الحفظ...');
    LV.showOverlay(window._boqEditRow ? 'جاري تحديث البند...' : 'جاري حفظ البند...', 'يتم إرسال البيانات إلى الشيت');
    LV.updateOverlay(0, 1);
    try {
        const res = await fetch(url, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        let result; try { result = JSON.parse(text); } catch(_){ throw new Error('استجابة غير صالحة: ' + text.slice(0,200)); }
        if (!result || !result.success) throw new Error((result && result.message) || 'فشل الحفظ');
        LV.updateOverlay(1, 1, 'تم — جاري تحديث الجدول...');
        _boqSetStatus('✅ تم الحفظ');
        cancelBOQEdit();
        await refreshBOQData();
        LV.hideOverlay();
        (window.showAlert || alert)('✅ ' + (result.message || 'تم الحفظ'));
    } catch (e) {
        console.error(e);
        _boqSetStatus('❌ ' + e.message);
        LV.hideOverlay();
        (window.showAlert || alert)('❌ ' + e.message);
    }
};

/* ──────── CSV / TXT Import ──────── */
// Build BOQ payload from raw row array (after parsing)
function _boqBuildPayloadFromRow(r){
    const payload = {
        action: 'addBOQ',
        itemNo: normItemNo((r[0]||'').trim()),
        description: (r[1]||'').trim(),
        unit: (r[2]||'').trim(),
        price: (r[3]||'').trim(),
        contractQty: (r[4]||'').trim(),
        timestamp: new Date().toISOString(),
        user: (window.currentUser && (currentUser.name||currentUser.email)) || ''
    };
    for (let j = 5; j < r.length; j++) {
        const v = (r[j]||'').trim();
        if (v !== '') payload['revisedQty' + (j-4)] = v;
    }
    return payload;
}

// POST a single BOQ payload. Returns {ok:true} or {ok:false, reason}
async function _boqPostOne(url, payload){
    try {
        const res = await fetch(url, {
            method:'POST', redirect:'follow',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify(payload)
        });
        const t = await res.text();
        let rr; try{ rr=JSON.parse(t); }catch(_){ rr=null; }
        if (rr && rr.success) return { ok:true };
        return { ok:false, reason:'فشل الإضافة: ' + ((rr && rr.error) || 'خطأ من الخادم') };
    } catch(err){
        return { ok:false, reason:'خطأ شبكة: ' + (err && err.message || 'غير معروف') };
    }
}

// Upload many BOQ payloads in parallel (concurrency-limited) with progress updates
async function _boqBulkUpload(url, items, onProgress){
    const CONCURRENCY = 8;
    let added = 0;
    const failures = []; // {item, reason}
    let nextIndex = 0;
    const total = items.length;
    async function worker(){
        while (true){
            const i = nextIndex++;
            if (i >= total) return;
            const it = items[i];
            const res = await _boqPostOne(url, it.payload);
            if (res.ok) added++;
            else failures.push({ item: it, reason: res.reason });
            if (onProgress) onProgress(added + failures.length, total, added, failures.length);
        }
    }
    const workers = [];
    for (let k = 0; k < Math.min(CONCURRENCY, total); k++) workers.push(worker());
    await Promise.all(workers);
    return { added, failures };
}

// POST a bulk BOQ payload in ONE request. Returns server result or throws.
async function _boqBulkPost(url, rows, forceAdd){
    const res = await fetch(url, {
        method:'POST', redirect:'follow',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({
            action: 'bulkBOQ',
            forceAdd: !!forceAdd,
            rows: rows,
            user: (window.currentUser && (currentUser.name||currentUser.email)) || '',
            timestamp: new Date().toISOString()
        })
    });
    const t = await res.text();
    let rr; try { rr = JSON.parse(t); } catch(_){ throw new Error('استجابة غير صالحة من الخادم'); }
    if (!rr || rr.success !== true) throw new Error((rr && (rr.message||rr.error)) || 'فشل الإرسال');
    return rr; // {success, added, total, skipped:[{index,row,itemNo,description,reason}]}
}

window.importBOQFromFile = async function (inputEl) {
    const f = inputEl && inputEl.files && inputEl.files[0];
    if (!f) return;
    try {
        let text;
        text = await f.text();
/* fallback already handled */
        const rows = parseDelimitedText(text);
        if (!rows.length) throw new Error('الملف فارغ');
        let start = 0;
        const first = rows[0].map(c => String(c||'').toLowerCase());
        if (first.some(c => /رقم|البند|item|description|unit|price|سعر|كمية/.test(c))) start = 1;
        const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
        if (!url) { (window.showAlert || alert)('⚠️ أضف رابط سكريبت جدول الكميات في الإعدادات'); return; }

        // Build payloads — validation ONLY by itemNo (per user request).
        // Any duplicates/skipped will be handled by the server and shown in the skipped dialog.
        const allPayloads = [];   // payloads sent to server
        const rowInfoByIndex = []; // mirrors allPayloads for skipped-dialog enrichment
        const missingItemNo = [];  // rows without itemNo — never sent
        for (let i = start; i < rows.length; i++) {
            const r = rows[i];
            const itemNo = normItemNo((r[0]||'').trim());
            const desc   = (r[1]||'').trim();
            if (!itemNo) {
                missingItemNo.push({ row: i + 1, itemNo, description: desc, reason: 'رقم البند مفقود' });
                continue;
            }
            const payload = _boqBuildPayloadFromRow(r);
            payload.__row = i + 1;
            allPayloads.push(payload);
            rowInfoByIndex.push({ row: i + 1, itemNo, description: desc, payload });
        }

        const total = allPayloads.length;
        _boqSetStatus(`⏳ جاري رفع ${total} صف دفعة واحدة...`);
        LV.showOverlay('جاري رفع بنود جدول الكميات...', `إجمالي الصفوف: ${total}`);
        LV.updateOverlay(0, Math.max(1, total));

        let added = 0;
        const skippedFromServer = [];
        if (total > 0){
            const rr = await _boqBulkPost(url, allPayloads, false);
            added = rr.added || 0;
            LV.updateOverlay(total, total, `تم رفع ${added}`);
            (rr.skipped || []).forEach(s => {
                const info = (typeof s.index === 'number') ? rowInfoByIndex[s.index] : null;
                skippedFromServer.push({
                    row: (info && info.row) || s.row || '',
                    itemNo: s.itemNo || (info && info.itemNo) || '',
                    description: s.description || (info && info.description) || '',
                    reason: s.reason || 'تم التخطي',
                    __payload: info ? info.payload : null
                });
            });
        }

        inputEl.value = '';
        LV.setOverlayMsg('جاري تحديث الجدول...');
        const allSkipped = missingItemNo.concat(skippedFromServer);
        _boqSetStatus(`✅ تم رفع ${added} بند — تخطّى ${allSkipped.length}`);
        await refreshBOQData();
        LV.hideOverlay();

        if (allSkipped.length){
            LV.showSkipped(
                `صفوف تم تخطيها أثناء رفع جدول الكميات (تم رفع ${added})`,
                allSkipped,
                {
                    onAddSelected: async (selectedRows) => {
                        // When re-adding skipped rows, if their itemNo collides with an
                        // already-uploaded item, append "*" markers to keep them distinct.
                        const existingNos = new Set(
                            (window._boqItems || []).map(it => String(it.itemNo || '').trim())
                        );
                        const retryItems = selectedRows
                            .filter(r => r.__payload)
                            .map(r => {
                                const p = Object.assign({}, r.__payload);
                                let no = normItemNo(p.itemNo || '');
                                while (existingNos.has(no)) no = no + '*';
                                existingNos.add(no);
                                p.itemNo = no;
                                p.__row = r.row;
                                return p;
                            });
                        const dropped = selectedRows.length - retryItems.length;
                        if (!retryItems.length){
                            (window.showAlert || alert)('⚠️ الصفوف المحددة بياناتها ناقصة ولا يمكن إضافتها');
                            return;
                        }
                        _boqSetStatus(`⏳ إعادة محاولة رفع ${retryItems.length} صف...`);
                        LV.showOverlay('إعادة رفع البنود المحددة...', `إجمالي: ${retryItems.length}`);
                        LV.updateOverlay(0, retryItems.length);
                        let rr2;
                        try { rr2 = await _boqBulkPost(url, retryItems, true); }
                        catch(err){
                            LV.hideOverlay();
                            (window.showAlert || alert)('❌ ' + err.message);
                            return;
                        }
                        LV.updateOverlay(retryItems.length, retryItems.length);
                        LV.setOverlayMsg('جاري تحديث الجدول...');
                        await refreshBOQData();
                        LV.hideOverlay();
                        const added2 = rr2.added || 0;
                        const failed2 = (rr2.skipped || []).length;
                        const msg = `✅ تم رفع ${added2} بند${failed2 ? ' — فشل ' + failed2 : ''}${dropped ? ' — استُبعد ' + dropped + ' (بدون بيانات)' : ''}`;
                        _boqSetStatus(msg);
                        (window.showAlert || alert)(msg);
                        if (failed2){
                            const failRows = (rr2.skipped || []).map(s => ({
                                row: s.row || '', itemNo: s.itemNo || '', description: s.description || '',
                                reason: s.reason || 'فشل', __payload: null
                            }));
                            LV.showSkipped('فشل رفع بعض الصفوف بعد المحاولة', failRows);
                        }
                    }
                }
            );
        } else {
            (window.showAlert || alert)(`✅ تم رفع ${added} بند`);
        }
    } catch (e) {
        console.error(e);
        _boqSetStatus('❌ ' + e.message);
        LV.hideOverlay();
        (window.showAlert || alert)('❌ ' + e.message);
    }
};




/* ============================================================
   NEW: حذف صفوف من جدول الكميات / البرنامج الزمني
   + مودال إعادة تعيين رقم البند للصفوف غير الموجودة فى BOQ
   ============================================================ */

window.deleteBOQItem = async function(row, itemNo){
    if (!row) return;
    const ok = confirm(`هل أنت متأكد من حذف البند رقم "${itemNo||''}" من جدول الكميات؟\nهذا الإجراء لا يمكن التراجع عنه.`);
    if (!ok) return;
    const url = getConfigScriptUrl('BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL', 'BOQ_SCRIPT_URL');
    if (!url) { (window.showAlert||alert)('⚠️ أضف رابط سكريبت جدول الكميات فى الإعدادات'); return; }
    LV.showOverlay('جارى حذف البند...', 'يتم إرسال الطلب إلى الشيت');
    LV.updateOverlay(0, 1);
    try {
        const res = await fetch(url, {
            method:'POST', redirect:'follow',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body: JSON.stringify({
                action: 'deleteBOQ', row: row,
                user: (window.currentUser && (currentUser.name||currentUser.email)) || ''
            })
        });
        const t = await res.text();
        let rr; try{ rr=JSON.parse(t); }catch(_){ throw new Error('استجابة غير صالحة: ' + t.slice(0,200)); }
        if (!rr || !rr.success) throw new Error((rr && rr.message) || 'فشل الحذف');
        LV.updateOverlay(1, 1, 'تم — جارى تحديث الجدول...');
        await refreshBOQData();
        LV.hideOverlay();
        (window.showAlert||alert)('✅ تم حذف البند');
    } catch(e){
        LV.hideOverlay();
        (window.showAlert||alert)('❌ ' + e.message);
    }
};
