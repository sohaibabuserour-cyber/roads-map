// CCF_URL و CONCF_URL مُعرَّفان في config.js

let _ccfEditing  = null;
let _concfEditing = null;

async function _cfGet(scriptUrl) {
    if (!scriptUrl || !scriptUrl.trim()) throw new Error('رابط السكريبت غير مُعرَّف — راجع الإعدادات');
    const url = scriptUrl.trim().split('?')[0] + '?action=getAll&t=' + Date.now();
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) throw new Error('السكريبت يعيد HTML — تأكد من النشر كـ Web App');
    let json;
    try { const cleaned = text.replace(/^\)\]\}'\n/, '').trim(); json = JSON.parse(cleaned); }
    catch(_) { throw new Error('رد غير صالح من السكريبت'); }
    if (json.status !== 'success') throw new Error(json.message || 'خطأ في السكريبت');
    return json.data;
}

async function _cfPost(scriptUrl, body) {
    if (!scriptUrl || !scriptUrl.trim()) throw new Error('رابط السكريبت غير مُعرَّف — راجع الإعدادات');
    const res = await fetch(scriptUrl.trim(), {
        method:   'POST',
        headers:  { 'Content-Type': 'text/plain' },
        body:     JSON.stringify(body),
        redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) throw new Error('السكريبت يعيد HTML — تأكد من النشر كـ Web App');
    let json;
    try { const cleaned = text.replace(/^[^{[]*/, '').trim(); json = JSON.parse(cleaned || text); }
    catch(_) { throw new Error('رد غير صالح من السكريبت'); }
    if (json.status !== 'success') throw new Error(json.message || 'فشل الحفظ');
    return json;
}

function _nextNo(rows, colName) {
    let max = 0;
    rows.forEach(row => {
        const v = String(row[colName] || '').trim();
        const n = parseInt(v.replace(/\D/g, ''), 10) || 0;
        if (n > max) max = n;
    });
    return String(max + 1).padStart(3, '0');
}

async function openCompanyCashflowForm() {
    openModal('companyCashflowModal');
    _ccfEditing = null;
    _ccfSetMode('new');
    _ccfClearFields(true);
    await _ccfLoad();
}

function closeCompanyCashflowForm() {
    closeModal('companyCashflowModal');
}

async function _ccfLoad() {
    const inp = document.getElementById('ccf_statement_no');
    if (inp) { inp.value = ''; inp.placeholder = '⏳ جاري الجلب...'; }
    try {
        const { rows } = await _cfGet(CCF_URL);
        const next = _nextNo(rows, 'رقم المستخلص');
        if (inp) {
            inp.value             = next;
            inp.placeholder       = '';
            inp.style.borderColor = 'rgba(245,200,66,0.6)';
        }
        _ccfBuildHistory(rows);
    } catch (e) {
        console.error('[ccf] load error:', e.message);
        if (inp) { inp.placeholder = 'تعذر الجلب'; inp.value = ''; }
        _ccfShowFeedback('❌ تعذر جلب البيانات: ' + e.message, 'error');
    }
}

function _ccfSetMode(mode) {
    const btn    = document.getElementById('ccf_submit_btn');
    const badges = document.querySelectorAll('#companyCashflowModal .cf-form-mode-badge');
    if (mode === 'edit') {
        badges.forEach(b => b.style.display = 'flex');
        if (btn) { btn.textContent = '💾 حفظ التعديلات'; btn.style.background = 'linear-gradient(135deg,#f5c842,#e8a800)'; btn.style.color = '#1a0a2e'; }
    } else {
        badges.forEach(b => b.style.display = 'none');
        if (btn) { btn.textContent = '💾 حفظ في السجل'; btn.style.background = 'linear-gradient(135deg,#2196f3,#1565c0)'; btn.style.color = '#fff'; }
    }
}

function _ccfClearFields(keepDate = false) {
    document.getElementById('ccf_amount').value = '';
    document.getElementById('ccf_status').value = 'مدفوع';
    document.getElementById('ccf_notes').value  = '';
    if (!keepDate) document.getElementById('ccf_date').value = new Date().toISOString().split('T')[0];
    const prev = document.getElementById('ccf_preview');
    if (prev) prev.style.display = 'none';
    _ccfHideFeedback();
}

function ccfReset(keepDate = false) {
    _ccfEditing = null;
    _ccfSetMode('new');
    _ccfClearFields(keepDate);
    _ccfLoad();
}

function ccfUpdatePreview() {
    const amt  = parseFloat(document.getElementById('ccf_amount').value) || 0;
    const prev = document.getElementById('ccf_preview');
    const span = document.getElementById('ccf_preview_amount');
    if (amt > 0 && prev && span) {
        prev.style.display  = 'block';
        span.textContent    = amt.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } else if (prev) {
        prev.style.display = 'none';
    }
}

function ccfLoadRowForEdit(rowJson) {
    const row = typeof rowJson === 'string' ? JSON.parse(rowJson) : rowJson;
    _ccfEditing = row;
    _ccfSetMode('edit');

    document.getElementById('ccf_statement_no').value = row['رقم المستخلص'] || '';
    document.getElementById('ccf_date').value         = _dateToInputVal(row['التاريخ'] || '');
    document.getElementById('ccf_amount').value       = String(row['القيمة'] || '').replace(/,/g, '');
    document.getElementById('ccf_notes').value        = row['الملاحظات']     || '';

    const sel = document.getElementById('ccf_status');
    if (sel) {
        const v   = row['الحالة'] || 'مدفوع';
        const opt = [...sel.options].find(o => o.value === v || o.textContent.trim() === v);
        sel.value = opt ? opt.value : 'مدفوع';
    }

    ccfUpdatePreview();
    const hist = document.getElementById('ccf_history_panel');
    if (hist) hist.style.display = 'none';
    showAlert('✏️ تم تحميل المستخلص للتعديل', 'success');
}

function _ccfBuildHistory(rows) {
    const panel = document.getElementById('ccf_history_panel');
    const list  = document.getElementById('ccf_history_list');
    if (!panel || !list) return;

    if (!rows.length) {
        list.innerHTML      = '<div style="padding:14px;text-align:center;color:rgba(255,255,255,0.35);font-family:Cairo,sans-serif;font-size:12px;">لا توجد مستخلصات سابقة</div>';
        panel.style.display = 'block';
        return;
    }

    const skipKeys = new Set(['__rowIndex']);
    const allKeys  = [];
    rows.forEach(row => {
        Object.keys(row).forEach(k => {
            if (!skipKeys.has(k) && !allKeys.includes(k)) allKeys.push(k);
        });
    });

    const colColor = (key) => {
        if (key === 'رقم المستخلص') return '#5baddf';
        if (key === 'التاريخ')       return 'rgba(255,255,255,0.65)';
        if (key === 'القيمة')         return '#f5c842';
        if (key === 'الحالة')         return '#5cc890';
        return 'rgba(255,255,255,0.75)';
    };

    const thCells = allKeys.map(k =>
        `<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:800;color:${colColor(k)};white-space:nowrap;letter-spacing:.3px;border-bottom:1px solid rgba(255,255,255,0.1);font-family:Cairo,sans-serif;">${k}</th>`
    ).join('') + `<th style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.1);"></th>`;

    const trRows = [...rows].reverse().map((row, i) => {
        const bg  = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent';
        const cleanRow = { ...row };
        if (cleanRow['التاريخ']) cleanRow['التاريخ'] = _fmtDate(cleanRow['التاريخ']);
        const enc = JSON.stringify(cleanRow).replace(/"/g, '&quot;');
        const tds = allKeys.map(k => {
            let val = row[k] !== undefined ? row[k] : '';
            if (k === 'التاريخ') {
                val = _fmtDate(val);
            } else if (k === 'القيمة') {
                const n = parseFloat(String(val).replace(/,/g, ''));
                val = !isNaN(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (val || '—');
            }
            return `<td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;color:${colColor(k)};white-space:nowrap;font-family:Cairo,sans-serif;border-bottom:1px solid rgba(255,255,255,0.04);">${val || '—'}</td>`;
        }).join('');
        return `<tr onclick="ccfLoadRowForEdit('${enc}')" style="background:${bg};cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(33,150,243,0.13)'" onmouseout="this.style.background='${bg}'">${tds}<td style="padding:9px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;color:rgba(33,150,243,0.85);font-weight:700;font-family:Cairo,sans-serif;white-space:nowrap;">✎ تعديل</span></td></tr>`;
    }).join('');

    list.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:400px;"><thead><tr style="background:linear-gradient(135deg,#1e0848,#12012a);position:sticky;top:0;z-index:2;">${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    panel.style.display = 'block';
}




function _ccfShowFeedback(msg, type) {
    const fb = document.getElementById('ccf_feedback');
    if (!fb) return;
    const map = {
        success: ['rgba(39,174,106,0.15)', 'rgba(39,174,106,0.4)',  '#5cc890'],
        loading: ['rgba(245,200,66,0.1)',  'rgba(245,200,66,0.3)',  '#f5c842'],
        error:   ['rgba(244,67,54,0.15)',  'rgba(244,67,54,0.4)',   '#ff8a80'],
    };
    const [bg, border, color] = map[type] || map.error;
    fb.style.cssText    = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:10px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-top:8px;`;
    fb.textContent      = msg;
    if (type === 'success') setTimeout(() => _ccfHideFeedback(), 4000);
}

function _ccfHideFeedback() {
    const fb = document.getElementById('ccf_feedback');
    if (fb) fb.style.display = 'none';
}

async function ccfSubmit() {
    _ccfHideFeedback();

    const statement_no = document.getElementById('ccf_statement_no').value.trim();
    const date         = document.getElementById('ccf_date').value.trim();
    const amount       = parseFloat(document.getElementById('ccf_amount').value) || 0;
    const status       = document.getElementById('ccf_status').value.trim();
    const notes        = document.getElementById('ccf_notes').value.trim();
    const isEdit       = !!_ccfEditing;

    if (!statement_no)         { _ccfShowFeedback('❌ رقم المستخلص غير موجود', 'error');     return; }
    if (!date)                 { _ccfShowFeedback('❌ يرجى اختيار التاريخ', 'error');         return; }
    if (!amount || amount <= 0){ _ccfShowFeedback('❌ يرجى إدخال قيمة المستخلص', 'error');   return; }

    const btn = document.getElementById('ccf_submit_btn');
    btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...';
    _ccfShowFeedback('⏳ جاري إرسال البيانات...', 'loading');

    try {
        await _cfPost(CCF_URL, {
            action:       isEdit ? 'update' : 'insert',
            rowIndex:     isEdit ? (_ccfEditing['__rowIndex'] || null) : null,
            statement_no, date: _dateToStorage(date), amount, status, notes,
        });

        const msg = isEdit ? '✅ تم تحديث المستخلص!' : '✅ تم حفظ المستخلص!';
        _ccfShowFeedback(msg, 'success');
        showAlert(msg, 'success');

        setTimeout(async () => {
            _ccfEditing = null;
            _ccfSetMode('new');
            _ccfClearFields(false);
            await _ccfLoad();
        }, 4000);

    } catch (e) {
        console.error('[ccf] submit error:', e);
        _ccfShowFeedback('❌ ' + e.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = isEdit ? '💾 حفظ التعديلات' : '💾 حفظ في السجل';
    }
}

async function openContractorCashflowForm() {
    openModal('contractorCashflowModal');
    _concfEditing = null;
    _concfSetMode('new');
    _concfClearFields(true);
    _concfPopulateContractors();
    const noWrap = document.getElementById('concf_statement_no_wrap');
    if (noWrap) noWrap.style.display = 'none';
}

function closeContractorCashflowForm() {
    closeModal('contractorCashflowModal');
}

function _concfPopulateContractors() {
    const sel = document.getElementById('concf_contractor_select');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- اختر من القائمة --</option>';
    const set = new Set();
    if (window.contractorsList && contractorsList.length) {
        contractorsList.forEach(n => { if (n && n.trim()) set.add(n.trim()); });
    } else {
        Object.values(allData || {}).forEach(sd => Object.values(sd).forEach(row => { const c = (row['CONTRACTOR'] || '').trim(); if (c) set.add(c); }));
        Object.keys(contractorMap || {}).forEach(n => { if (n.trim()) set.add(n.trim()); });
    }
    [...set].sort((a, b) => a.localeCompare(b, 'ar')).forEach(name => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = name;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

async function concfSyncContractor(val) {
    document.getElementById('concf_contractor').value = val;
    const noWrap = document.getElementById('concf_statement_no_wrap');
    const inp    = document.getElementById('concf_statement_no');
    const hist   = document.getElementById('concf_history_panel');

    if (!val) {
        if (noWrap) noWrap.style.display = 'none';
        if (inp)   inp.value = '';
        if (hist)  hist.style.display = 'none';
        return;
    }

    if (noWrap) noWrap.style.display = 'block';
    if (inp)   { inp.value = ''; inp.placeholder = '⏳ جاري الجلب...'; }

    try {
        const { rows } = await _cfGet(CONCF_URL);

        const contractorRows = rows.filter(r => (r['المقاول'] || '').trim() === val.trim());
        const next           = _nextNo(contractorRows, 'رقم المستخلص');

        if (inp) {
            inp.value             = next;
            inp.placeholder       = '';
            inp.style.borderColor = 'rgba(245,200,66,0.6)';
            inp.title             = 'آخر مستخلص للمقاول ' + val + ' + 1';
        }
        _concfBuildHistory(rows, val);

    } catch (e) {
        console.error('[concf] sync error:', e.message);
        if (inp) { inp.placeholder = 'تعذر الجلب'; inp.value = ''; }
    }
}


function _concfSetMode(mode) {
    const btn   = document.getElementById('concf_submit_btn');
    const badge = document.getElementById('concf_edit_badge');
    if (mode === 'edit') {
        if (btn)   { btn.textContent = '💾 حفظ التعديلات'; btn.style.background = 'linear-gradient(135deg,#2196f3,#1565c0)'; btn.style.color = '#fff'; }
        if (badge) badge.style.display = 'flex';
    } else {
        if (btn)   { btn.textContent = '💾 حفظ في السجل'; btn.style.background = 'linear-gradient(135deg,#f5c842,#e8a800)'; btn.style.color = '#1a0a2e'; }
        if (badge) badge.style.display = 'none';
    }
}

function _concfClearFields(keepDate = false) {
    const sel = document.getElementById('concf_contractor_select');
    if (sel) sel.value = '';
    document.getElementById('concf_contractor').value = '';
    const ct = document.getElementById('concf_contractor_text');
    if (ct) ct.value = '';
    document.getElementById('concf_statement_no').value = '';
    const noWrap = document.getElementById('concf_statement_no_wrap');
    if (noWrap) noWrap.style.display = 'none';
    document.getElementById('concf_total').value = '';
    document.getElementById('concf_spent').value = '';
    document.getElementById('concf_notes').value = '';
    if (!keepDate) document.getElementById('concf_date').value = new Date().toISOString().split('T')[0];
    const prev = document.getElementById('concf_preview');
    if (prev) prev.style.display = 'none';
    const hist = document.getElementById('concf_history_panel');
    if (hist) hist.style.display = 'none';
    _concfHideFeedback();
}

function concfReset(keepDate = false) {
    _concfEditing = null;
    _concfSetMode('new');
    _concfClearFields(keepDate);
}

function concfUpdatePreview() {
    const total     = parseFloat(document.getElementById('concf_total').value) || 0;
    const spent     = parseFloat(document.getElementById('concf_spent').value) || 0;
    const remaining = Math.max(0, total - spent);
    const prev      = document.getElementById('concf_preview');
    if (total > 0 || spent > 0) {
        if (prev) prev.style.display = 'grid';
        document.getElementById('concf_prev_total').textContent     = total.toLocaleString('en-US', { maximumFractionDigits: 2 });
        document.getElementById('concf_prev_spent').textContent     = spent.toLocaleString('en-US', { maximumFractionDigits: 2 });
        document.getElementById('concf_prev_remaining').textContent = remaining.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } else {
        if (prev) prev.style.display = 'none';
    }
}

function concfLoadRowForEdit(rowJson) {
    const row = typeof rowJson === 'string' ? JSON.parse(rowJson) : rowJson;
    _concfEditing = row;
    _concfSetMode('edit');

    const cVal = row['المقاول'] || '';
    const sel  = document.getElementById('concf_contractor_select');
    if (sel) {
        if (![...sel.options].find(o => o.value === cVal.trim()) && cVal) {
            const opt = document.createElement('option');
            opt.value = opt.textContent = cVal;
            sel.appendChild(opt);
        }
        sel.value = cVal.trim();
    }
    document.getElementById('concf_contractor').value = cVal;

    const noWrap = document.getElementById('concf_statement_no_wrap');
    if (noWrap) noWrap.style.display = 'block';
    const noInp = document.getElementById('concf_statement_no');
    if (noInp) { noInp.value = row['رقم المستخلص'] || ''; noInp.style.borderColor = 'rgba(245,200,66,0.6)'; }

    document.getElementById('concf_date').value  = _dateToInputVal(row['التاريخ'] || '');
    document.getElementById('concf_total').value = String(row['الإجمالي'] || '').replace(/,/g, '');
    document.getElementById('concf_spent').value = String(row['المنصرف']  || '').replace(/,/g, '');
    document.getElementById('concf_notes').value = row['الملاحظات']  || '';

    concfUpdatePreview();
    const hist = document.getElementById('concf_history_panel');
    if (hist) hist.style.display = 'none';
    showAlert('✏️ تم تحميل مستخلص المقاول للتعديل', 'success');
}

function _concfBuildHistory(rows, filterContractor) {
    const panel = document.getElementById('concf_history_panel');
    const list  = document.getElementById('concf_history_list');
    if (!panel || !list) return;

    const display = filterContractor
        ? rows.filter(r => (r['المقاول'] || '').trim() === filterContractor.trim())
        : rows;

    if (!display.length) { panel.style.display = 'none'; return; }

    const skipKeys = new Set(['__rowIndex']);
    const allKeys  = [];
    display.forEach(row => {
        Object.keys(row).forEach(k => {
            if (!skipKeys.has(k) && !allKeys.includes(k)) allKeys.push(k);
        });
    });

    const colColor = (key) => {
        if (key === 'المقاول')        return 'rgba(255,255,255,0.9)';
        if (key === 'رقم المستخلص') return '#f5c842';
        if (key === 'التاريخ')       return 'rgba(255,255,255,0.65)';
        if (key === 'الإجمالي')      return '#5cc890';
        if (key === 'المنصرف')       return '#5baddf';
        return 'rgba(255,255,255,0.75)';
    };

    const numKeys = new Set(['الإجمالي', 'المنصرف']);

    const thCells = allKeys.map(k =>
        `<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:800;color:${colColor(k)};white-space:nowrap;letter-spacing:.3px;border-bottom:1px solid rgba(255,255,255,0.1);font-family:Cairo,sans-serif;">${k}</th>`
    ).join('') + `<th style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.1);"></th>`;

    const trRows = [...display].reverse().map((row, i) => {
        const bg  = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent';
        const cleanRow = { ...row };
        if (cleanRow['التاريخ']) cleanRow['التاريخ'] = _fmtDate(cleanRow['التاريخ']);
        const enc = JSON.stringify(cleanRow).replace(/"/g, '&quot;');
        const tds = allKeys.map(k => {
            let val = row[k] !== undefined ? row[k] : '';
            if (k === 'التاريخ') {
                val = _fmtDate(val);
            } else if (numKeys.has(k)) {
                const n = parseFloat(String(val).replace(/,/g, ''));
                val = !isNaN(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (val || '—');
            }
            return `<td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;color:${colColor(k)};white-space:nowrap;font-family:Cairo,sans-serif;border-bottom:1px solid rgba(255,255,255,0.04);">${val || '—'}</td>`;
        }).join('');
        return `<tr onclick="concfLoadRowForEdit('${enc}')" style="background:${bg};cursor:pointer;transition:background .15s;" onmouseover="this.style.background='rgba(245,200,66,0.1)'" onmouseout="this.style.background='${bg}'">${tds}<td style="padding:9px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;color:rgba(245,200,66,0.85);font-weight:700;font-family:Cairo,sans-serif;white-space:nowrap;">✎ تعديل</span></td></tr>`;
    }).join('');

    list.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:480px;"><thead><tr style="background:linear-gradient(135deg,#1a0a2e,#3d1060);position:sticky;top:0;z-index:2;">${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    panel.style.display = 'block';
}

function _concfShowFeedback(msg, type) {
    const fb = document.getElementById('concf_feedback');
    if (!fb) return;
    const map = {
        success: ['rgba(39,174,106,0.15)', 'rgba(39,174,106,0.4)',  '#5cc890'],
        loading: ['rgba(245,200,66,0.1)',  'rgba(245,200,66,0.3)',  '#f5c842'],
        error:   ['rgba(244,67,54,0.15)',  'rgba(244,67,54,0.4)',   '#ff8a80'],
    };
    const [bg, border, color] = map[type] || map.error;
    fb.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:10px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-top:8px;`;
    fb.textContent   = msg;
    if (type === 'success') setTimeout(() => _concfHideFeedback(), 4000);
}

function _concfHideFeedback() {
    const fb = document.getElementById('concf_feedback');
    if (fb) fb.style.display = 'none';
}

async function concfSubmit() {
    _concfHideFeedback();

    const contractor   = document.getElementById('concf_contractor').value.trim();
    const statement_no = document.getElementById('concf_statement_no').value.trim();
    const date         = document.getElementById('concf_date').value.trim();
    const total        = parseFloat(document.getElementById('concf_total').value) || 0;
    const spent        = parseFloat(document.getElementById('concf_spent').value) || 0;
    const notes        = document.getElementById('concf_notes').value.trim();
    const isEdit       = !!_concfEditing;

    if (!contractor)          { _concfShowFeedback('❌ يرجى اختيار المقاول', 'error');      return; }
    if (!statement_no)        { _concfShowFeedback('❌ رقم المستخلص غير موجود', 'error');   return; }
    if (!date)                { _concfShowFeedback('❌ يرجى اختيار التاريخ', 'error');       return; }
    if (!total || total <= 0) { _concfShowFeedback('❌ يرجى إدخال المستحق صرفه', 'error'); return; }

    const btn = document.getElementById('concf_submit_btn');
    btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...';
    _concfShowFeedback('⏳ جاري إرسال البيانات...', 'loading');

    try {
        await _cfPost(CONCF_URL, {
            action:       isEdit ? 'update' : 'insert',
            rowIndex:     isEdit ? (_concfEditing['__rowIndex'] || null) : null,
            contractor, statement_no, date: _dateToStorage(date),
            total: Number(total),
            spent: Number(spent),
            notes,
        });

        const msg = isEdit ? '✅ تم تحديث مستخلص المقاول!' : '✅ تم حفظ المستخلص!';
        _concfShowFeedback(msg, 'success');
        showAlert(msg, 'success');

        setTimeout(() => {
            _concfEditing = null;
            _concfSetMode('new');
            _concfClearFields(false);
        }, 4000);

    } catch (e) {
        console.error('[concf] submit error:', e);
        _concfShowFeedback('❌ ' + e.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = isEdit ? '💾 حفظ التعديلات' : '💾 حفظ في السجل';
    }
}

/* ============================================================
   شاشة الإضافة — منطق فورمات cashco / cashctr / equipment
   (نسخ مستقلة تعمل داخل add-tab-panel بدون تعارض مع المودالات)
   ============================================================ */

/* ═══════════════════════════════════════════════════
   1. تدفق نقدي الشركة (add_ccf_*)
   ═══════════════════════════════════════════════════ */
let _add_ccfEditing = null;

function add_ccfShowFeedback(msg, type) {
    const fb = document.getElementById('add_ccf_feedback');
    if (!fb) return;
    const map = {
        success: ['rgba(39,174,106,0.15)', 'rgba(39,174,106,0.4)', '#5cc890'],
        loading:  ['rgba(245,200,66,0.1)',  'rgba(245,200,66,0.3)',  '#f5c842'],
        error:    ['rgba(244,67,54,0.15)',  'rgba(244,67,54,0.4)',   '#ff8a80'],
    };
    const [bg, border, color] = map[type] || map.error;
    fb.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:10px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-top:8px;`;
    fb.textContent = msg;
    if (type === 'success') setTimeout(() => { if(fb) fb.style.display='none'; }, 4000);
}

async function add_ccfLoad() {
    const inp = document.getElementById('add_ccf_statement_no');
    if (inp) { inp.value = ''; inp.placeholder = '⏳ جاري الجلب...'; }
    try {
        const { rows } = await _cfGet(CCF_URL);
        const next = _nextNo(rows, 'رقم المستخلص');
        if (inp) { inp.value = next; inp.placeholder = ''; inp.style.borderColor = 'rgba(245,200,66,0.6)'; }
        add_ccfBuildHistory(rows);
    } catch (e) {
        if (inp) { inp.placeholder = 'تعذر الجلب'; inp.value = ''; }
        add_ccfShowFeedback('❌ تعذر جلب البيانات: ' + e.message, 'error');
    }
}

function add_ccfBuildHistory(rows) {
    const panel = document.getElementById('add_ccf_history_panel');
    const list  = document.getElementById('add_ccf_history_list');
    if (!panel || !list || !rows.length) { if(panel) panel.style.display = 'none'; return; }

    const skipKeys = new Set(['__rowIndex']);
    const allKeys = [];
    rows.forEach(row => Object.keys(row).forEach(k => { if (!skipKeys.has(k) && !allKeys.includes(k)) allKeys.push(k); }));

    const colColor = (k) => k==='رقم المستخلص'?'#5baddf':k==='التاريخ'?'rgba(255,255,255,0.65)':k==='القيمة'?'#f5c842':k==='الحالة'?'#5cc890':'rgba(255,255,255,0.75)';
    const thCells = allKeys.map(k => `<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:800;color:${colColor(k)};white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.1);font-family:Cairo,sans-serif;">${k}</th>`).join('') + `<th style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.1);"></th>`;
    const trRows = [...rows].reverse().map((row, i) => {
        const bg = i%2===0?'rgba(255,255,255,0.025)':'transparent';
        const cleanRow = {...row};
        if (cleanRow['التاريخ']) cleanRow['التاريخ'] = _fmtDate(cleanRow['التاريخ']);
        const enc = JSON.stringify(cleanRow).replace(/"/g,'&quot;');
        const tds = allKeys.map(k => {
            let val = row[k]!==undefined?row[k]:'';
            if (k==='التاريخ') val=_fmtDate(val);
            else if (k==='القيمة') { const n=parseFloat(String(val).replace(/,/g,'')); val=!isNaN(n)?n.toLocaleString('en-US',{maximumFractionDigits:2}):(val||'—'); }
            return `<td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;color:${colColor(k)};white-space:nowrap;font-family:Cairo,sans-serif;border-bottom:1px solid rgba(255,255,255,0.04);">${val||'—'}</td>`;
        }).join('');
        return `<tr onclick="add_ccfLoadRowForEdit('${enc}')" style="background:${bg};cursor:pointer;" onmouseover="this.style.background='rgba(33,150,243,0.13)'" onmouseout="this.style.background='${bg}'">${tds}<td style="padding:9px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-size:10px;color:rgba(33,150,243,0.85);font-weight:700;font-family:Cairo,sans-serif;">✎ تعديل</span></td></tr>`;
    }).join('');
    list.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:400px;"><thead><tr style="background:linear-gradient(135deg,#1e0848,#12012a);">${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    panel.style.display = 'block';
}

function add_ccfLoadRowForEdit(rowJson) {
    const row = typeof rowJson === 'string' ? JSON.parse(rowJson) : rowJson;
    _add_ccfEditing = row;
    document.getElementById('add_ccf_statement_no').value = row['رقم المستخلص'] || '';
    document.getElementById('add_ccf_date').value = _dateToInputVal(row['التاريخ'] || '');
    document.getElementById('add_ccf_amount').value = String(row['القيمة'] || '').replace(/,/g, '');
    document.getElementById('add_ccf_notes').value = row['الملاحظات'] || '';
    const sel = document.getElementById('add_ccf_status');
    if (sel) { const v=row['الحالة']||'مدفوع'; const opt=[...sel.options].find(o=>o.value===v); sel.value=opt?opt.value:'مدفوع'; }
    add_ccfUpdatePreview();
    const badge = document.getElementById('add_ccf_edit_badge');
    if (badge) badge.style.display = 'flex';
    const hist = document.getElementById('add_ccf_history_panel');
    if (hist) hist.style.display = 'none';
    showAlert('✏️ تم تحميل المستخلص للتعديل', 'success');
}

window.add_ccfLoadRowForEdit = add_ccfLoadRowForEdit;

function add_ccfUpdatePreview() {
    const amt = parseFloat(document.getElementById('add_ccf_amount')?.value) || 0;
    const prev = document.getElementById('add_ccf_preview');
    const span = document.getElementById('add_ccf_preview_amount');
    if (amt > 0 && prev && span) { prev.style.display='block'; span.textContent=amt.toLocaleString('en-US',{maximumFractionDigits:2}); }
    else if (prev) prev.style.display='none';
}
window.add_ccfUpdatePreview = add_ccfUpdatePreview;

function add_ccfReset() {
    _add_ccfEditing = null;
    document.getElementById('add_ccf_amount').value = '';
    document.getElementById('add_ccf_status').value = 'مدفوع';
    document.getElementById('add_ccf_notes').value = '';
    document.getElementById('add_ccf_date').value = new Date().toISOString().split('T')[0];
    const prev = document.getElementById('add_ccf_preview');
    if (prev) prev.style.display = 'none';
    const badge = document.getElementById('add_ccf_edit_badge');
    if (badge) badge.style.display = 'none';
    const fb = document.getElementById('add_ccf_feedback');
    if (fb) fb.style.display = 'none';
    add_ccfLoad();
}
window.add_ccfReset = add_ccfReset;

async function add_ccfSubmit() {
    const fb = document.getElementById('add_ccf_feedback');
    if (fb) fb.style.display = 'none';
    const statement_no = document.getElementById('add_ccf_statement_no').value.trim();
    const date         = document.getElementById('add_ccf_date').value.trim();
    const amount       = parseFloat(document.getElementById('add_ccf_amount').value) || 0;
    const status       = document.getElementById('add_ccf_status').value.trim();
    const notes        = document.getElementById('add_ccf_notes').value.trim();
    const isEdit       = !!_add_ccfEditing;
    if (!statement_no) { add_ccfShowFeedback('❌ رقم المستخلص غير موجود', 'error'); return; }
    if (!date)         { add_ccfShowFeedback('❌ يرجى اختيار التاريخ', 'error'); return; }
    if (!amount || amount<=0) { add_ccfShowFeedback('❌ يرجى إدخال قيمة المستخلص', 'error'); return; }
    const btn = document.getElementById('add_ccf_submit_btn');
    btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...';
    add_ccfShowFeedback('⏳ جاري إرسال البيانات...', 'loading');
    try {
        await _cfPost(CCF_URL, { action: isEdit?'update':'insert', rowIndex: isEdit?(_add_ccfEditing['__rowIndex']||null):null, statement_no, date: _dateToStorage(date), amount, status, notes });
        const msg = isEdit ? '✅ تم تحديث المستخلص!' : '✅ تم حفظ المستخلص!';
        add_ccfShowFeedback(msg, 'success');
        showAlert(msg, 'success');
        setTimeout(() => add_ccfReset(), 4000);
    } catch (e) {
        add_ccfShowFeedback('❌ ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = isEdit?'💾 حفظ التعديلات':'💾 حفظ في السجل';
    }
}
window.add_ccfSubmit = add_ccfSubmit;

/* ═══════════════════════════════════════════════════
   2. تدفق نقدي المقاولين (add_concf_*)
   ═══════════════════════════════════════════════════ */
let _add_concfEditing = null;

function add_concfShowFeedback(msg, type) {
    const fb = document.getElementById('add_concf_feedback');
    if (!fb) return;
    const map = { success:['rgba(39,174,106,0.15)','rgba(39,174,106,0.4)','#5cc890'], loading:['rgba(245,200,66,0.1)','rgba(245,200,66,0.3)','#f5c842'], error:['rgba(244,67,54,0.15)','rgba(244,67,54,0.4)','#ff8a80'] };
    const [bg, border, color] = map[type]||map.error;
    fb.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:10px 14px;border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;margin-top:8px;`;
    fb.textContent = msg;
    if (type==='success') setTimeout(()=>{ if(fb) fb.style.display='none'; }, 4000);
}

function add_concfPopulateContractors() {
    const sel = document.getElementById('add_concf_contractor_select');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- اختر من القائمة --</option>';
    const set = new Set();
    if (window.contractorsList && contractorsList.length) {
        contractorsList.forEach(n => { if (n && n.trim()) set.add(n.trim()); });
    } else {
        Object.values(allData||{}).forEach(sd=>Object.values(sd).forEach(row=>{const c=(row['CONTRACTOR']||'').trim();if(c)set.add(c);}));
        Object.keys(contractorMap||{}).forEach(n=>{if(n.trim())set.add(n.trim());});
    }
    [...set].sort((a,b)=>a.localeCompare(b,'ar')).forEach(name=>{const opt=document.createElement('option');opt.value=opt.textContent=name;sel.appendChild(opt);});
    if (cur) sel.value = cur;
}

async function add_concfSyncContractor(val) {
    document.getElementById('add_concf_contractor').value = val;
    const noWrap = document.getElementById('add_concf_statement_no_wrap');
    const inp    = document.getElementById('add_concf_statement_no');
    const hist   = document.getElementById('add_concf_history_panel');
    if (!val) { if(noWrap)noWrap.style.display='none'; if(inp)inp.value=''; if(hist)hist.style.display='none'; return; }
    if (noWrap) noWrap.style.display = 'block';
    if (inp) { inp.value=''; inp.placeholder='⏳ جاري الجلب...'; }
    try {
        const { rows } = await _cfGet(CONCF_URL);
        const contractorRows = rows.filter(r=>(r['المقاول']||'').trim()===val.trim());
        const next = _nextNo(contractorRows, 'رقم المستخلص');
        if (inp) { inp.value=next; inp.placeholder=''; inp.style.borderColor='rgba(245,200,66,0.6)'; }
        add_concfBuildHistory(rows, val);
    } catch (e) {
        if (inp) { inp.placeholder='تعذر الجلب'; inp.value=''; }
    }
}
window.add_concfSyncContractor = add_concfSyncContractor;

function add_concfBuildHistory(rows, filterContractor) {
    const panel = document.getElementById('add_concf_history_panel');
    const list  = document.getElementById('add_concf_history_list');
    if (!panel || !list) return;
    const display = filterContractor ? rows.filter(r=>(r['المقاول']||'').trim()===filterContractor.trim()) : rows;
    if (!display.length) { panel.style.display='none'; return; }
    const skipKeys = new Set(['__rowIndex']);
    const allKeys = [];
    display.forEach(row=>Object.keys(row).forEach(k=>{if(!skipKeys.has(k)&&!allKeys.includes(k))allKeys.push(k);}));
    const colColor = k=>k==='المقاول'?'rgba(255,255,255,0.9)':k==='رقم المستخلص'?'#f5c842':k==='التاريخ'?'rgba(255,255,255,0.65)':k==='الإجمالي'?'#5cc890':k==='المنصرف'?'#5baddf':'rgba(255,255,255,0.75)';
    const numKeys = new Set(['الإجمالي','المنصرف']);
    const thCells = allKeys.map(k=>`<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:800;color:${colColor(k)};white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.1);font-family:Cairo,sans-serif;">${k}</th>`).join('')+`<th style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.1);"></th>`;
    const trRows = [...display].reverse().map((row,i)=>{
        const bg=i%2===0?'rgba(255,255,255,0.025)':'transparent';
        const cleanRow={...row}; if(cleanRow['التاريخ'])cleanRow['التاريخ']=_fmtDate(cleanRow['التاريخ']);
        const enc=JSON.stringify(cleanRow).replace(/"/g,'&quot;');
        const tds=allKeys.map(k=>{let val=row[k]!==undefined?row[k]:'';if(k==='التاريخ')val=_fmtDate(val);else if(numKeys.has(k)){const n=parseFloat(String(val).replace(/,/g,''));val=!isNaN(n)?n.toLocaleString('en-US',{maximumFractionDigits:2}):(val||'—');}return`<td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;color:${colColor(k)};white-space:nowrap;font-family:Cairo,sans-serif;border-bottom:1px solid rgba(255,255,255,0.04);">${val||'—'}</td>`;}).join('');
        return`<tr onclick="add_concfLoadRowForEdit('${enc}')" style="background:${bg};cursor:pointer;" onmouseover="this.style.background='rgba(245,200,66,0.1)'" onmouseout="this.style.background='${bg}'">${tds}<td style="padding:9px 10px;text-align:center;"><span style="font-size:10px;color:rgba(245,200,66,0.85);font-weight:700;font-family:Cairo,sans-serif;">✎ تعديل</span></td></tr>`;
    }).join('');
    list.innerHTML=`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:480px;"><thead><tr style="background:linear-gradient(135deg,#1a0a2e,#3d1060);">${thCells}</tr></thead><tbody>${trRows}</tbody></table></div>`;
    panel.style.display='block';
}

function add_concfLoadRowForEdit(rowJson) {
    const row = typeof rowJson==='string'?JSON.parse(rowJson):rowJson;
    _add_concfEditing = row;
    const cVal = row['المقاول']||'';
    const sel = document.getElementById('add_concf_contractor_select');
    if (sel) { if(![...sel.options].find(o=>o.value===cVal.trim())&&cVal){const opt=document.createElement('option');opt.value=opt.textContent=cVal;sel.appendChild(opt);} sel.value=cVal.trim(); }
    document.getElementById('add_concf_contractor').value = cVal;
    const noWrap=document.getElementById('add_concf_statement_no_wrap');
    if(noWrap)noWrap.style.display='block';
    const noInp=document.getElementById('add_concf_statement_no');
    if(noInp){noInp.value=row['رقم المستخلص']||'';noInp.style.borderColor='rgba(245,200,66,0.6)';}
    document.getElementById('add_concf_date').value=_dateToInputVal(row['التاريخ']||'');
    document.getElementById('add_concf_total').value=String(row['الإجمالي']||'').replace(/,/g,'');
    document.getElementById('add_concf_spent').value=String(row['المنصرف']||'').replace(/,/g,'');
    document.getElementById('add_concf_notes').value=row['الملاحظات']||'';
    add_concfUpdatePreview();
    const badge=document.getElementById('add_concf_edit_badge');
    if(badge)badge.style.display='flex';
    const hist=document.getElementById('add_concf_history_panel');
    if(hist)hist.style.display='none';
    showAlert('✏️ تم تحميل مستخلص المقاول للتعديل','success');
}
window.add_concfLoadRowForEdit = add_concfLoadRowForEdit;

function add_concfUpdatePreview() {
    const total=parseFloat(document.getElementById('add_concf_total')?.value)||0;
    const spent=parseFloat(document.getElementById('add_concf_spent')?.value)||0;
    const remaining=Math.max(0,total-spent);
    const prev=document.getElementById('add_concf_preview');
    if(total>0||spent>0){
        if(prev)prev.style.display='grid';
        document.getElementById('add_concf_prev_total').textContent=total.toLocaleString('en-US',{maximumFractionDigits:2});
        document.getElementById('add_concf_prev_spent').textContent=spent.toLocaleString('en-US',{maximumFractionDigits:2});
        document.getElementById('add_concf_prev_remaining').textContent=remaining.toLocaleString('en-US',{maximumFractionDigits:2});
    } else { if(prev)prev.style.display='none'; }
}
window.add_concfUpdatePreview = add_concfUpdatePreview;

function add_concfReset() {
    _add_concfEditing = null;
    const sel=document.getElementById('add_concf_contractor_select'); if(sel)sel.value='';
    document.getElementById('add_concf_contractor').value='';
    document.getElementById('add_concf_statement_no').value='';
    const noWrap=document.getElementById('add_concf_statement_no_wrap'); if(noWrap)noWrap.style.display='none';
    document.getElementById('add_concf_total').value='';
    document.getElementById('add_concf_spent').value='';
    document.getElementById('add_concf_notes').value='';
    document.getElementById('add_concf_date').value=new Date().toISOString().split('T')[0];
    const prev=document.getElementById('add_concf_preview'); if(prev)prev.style.display='none';
    const hist=document.getElementById('add_concf_history_panel'); if(hist)hist.style.display='none';
    const badge=document.getElementById('add_concf_edit_badge'); if(badge)badge.style.display='none';
    const fb=document.getElementById('add_concf_feedback'); if(fb)fb.style.display='none';
}
window.add_concfReset = add_concfReset;

async function add_concfSubmit() {
    const fb=document.getElementById('add_concf_feedback'); if(fb)fb.style.display='none';
    const contractor=document.getElementById('add_concf_contractor').value.trim();
    const statement_no=document.getElementById('add_concf_statement_no').value.trim();
    const date=document.getElementById('add_concf_date').value.trim();
    const total=parseFloat(document.getElementById('add_concf_total').value)||0;
    const spent=parseFloat(document.getElementById('add_concf_spent').value)||0;
    const notes=document.getElementById('add_concf_notes').value.trim();
    const isEdit=!!_add_concfEditing;
    if(!contractor){add_concfShowFeedback('❌ يرجى اختيار المقاول','error');return;}
    if(!statement_no){add_concfShowFeedback('❌ رقم المستخلص غير موجود','error');return;}
    if(!date){add_concfShowFeedback('❌ يرجى اختيار التاريخ','error');return;}
    if(!total||total<=0){add_concfShowFeedback('❌ يرجى إدخال المستحق صرفه','error');return;}
    const btn=document.getElementById('add_concf_submit_btn');
    btn.disabled=true; btn.textContent='⏳ جاري الحفظ...';
    add_concfShowFeedback('⏳ جاري إرسال البيانات...','loading');
    try {
        await _cfPost(CONCF_URL,{action:isEdit?'update':'insert',rowIndex:isEdit?(_add_concfEditing['__rowIndex']||null):null,contractor,statement_no,date:_dateToStorage(date),total:Number(total),spent:Number(spent),notes});
        const msg=isEdit?'✅ تم تحديث مستخلص المقاول!':'✅ تم حفظ المستخلص!';
        add_concfShowFeedback(msg,'success'); showAlert(msg,'success');
        setTimeout(()=>add_concfReset(),4000);
    } catch(e) {
        add_concfShowFeedback('❌ '+e.message,'error');
    } finally {
        btn.disabled=false; btn.textContent=isEdit?'💾 حفظ التعديلات':'💾 حفظ في السجل';
    }
}
window.add_concfSubmit = add_concfSubmit;


window.openCompanyCashflowForm     = openCompanyCashflowForm;
window.closeCompanyCashflowForm    = closeCompanyCashflowForm;
window.ccfSubmit                   = ccfSubmit;
window.ccfUpdatePreview            = ccfUpdatePreview;
window.ccfLoadRowForEdit           = ccfLoadRowForEdit;
window.ccfReset                    = ccfReset;

window.openContractorCashflowForm  = openContractorCashflowForm;
window.closeContractorCashflowForm = closeContractorCashflowForm;
window.concfSubmit                 = concfSubmit;
window.concfUpdatePreview          = concfUpdatePreview;
window.concfLoadRowForEdit         = concfLoadRowForEdit;
window.concfReset                  = concfReset;
window.concfSyncContractor         = concfSyncContractor;

// ── تصدير إضافي لضمان عمل جميع الأزرار ──
window._ccfLoad                    = _ccfLoad;
window.add_ccfLoad                 = add_ccfLoad;
window.add_ccfBuildHistory         = add_ccfBuildHistory;
window.add_ccfLoadRowForEdit       = add_ccfLoadRowForEdit;
window.add_ccfUpdatePreview        = add_ccfUpdatePreview;
window.add_ccfReset                = add_ccfReset;
window.add_ccfSubmit               = add_ccfSubmit;
window.add_ccfShowFeedback         = add_ccfShowFeedback;

window.add_concfPopulateContractors = add_concfPopulateContractors;
window.add_concfSyncContractor     = add_concfSyncContractor;
window.add_concfBuildHistory       = add_concfBuildHistory;
window.add_concfLoadRowForEdit     = add_concfLoadRowForEdit;
window.add_concfUpdatePreview      = add_concfUpdatePreview;
window.add_concfReset              = add_concfReset;
window.add_concfSubmit             = add_concfSubmit;
window.add_concfShowFeedback       = add_concfShowFeedback;
