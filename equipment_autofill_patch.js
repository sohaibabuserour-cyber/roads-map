/* ====================================================
   AUTOFILL PATCH — equipment_autofill_patch.js  v2
   التعديلات عن v1:
   ✅ عرض صورة حقيقية من Drive URL (بدل بادج نصي فقط)
   ✅ عرض خانة لكل معدة مع عددها بشكل كامل (بدل تلميح فقط)
   ✅ يستدعي eqRetryPhotoUploadIfNeeded بعد تحديد العنصر
   ==================================================== */

var _afRows = [];

/* ══════════════════════════════════════════════════
   جلب Sheet2 من شيت البند الفرعي
   ══════════════════════════════════════════════════ */
async function afLoadSheet2(sheetId) {
    _afRows = [];
    try {
        var url = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=987650458';
        var r   = await fetch(url);
        var csv = await r.text();
        if (csv.trim().startsWith('<')) { console.warn('[autofill] not public'); return; }

        var lines = csv.split('\n').filter(function(l){ return l.trim(); });
        if (lines.length < 2) return;

        for (var i = 1; i < lines.length; i++) {
            var cols = _afSplitCSVLine(lines[i]);
            _afRows.push(cols);
        }
        console.log('[autofill] loaded', _afRows.length, 'rows from Sheet2 of', sheetId);
    } catch(e) {
        console.warn('[autofill] error:', e.message);
    }
}

/* CSV parser بسيط يحترم علامات الاقتباس */
function _afSplitCSVLine(line) {
    var result = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            result.push(cur.trim()); cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur.trim());
    return result;
}

/* ══════════════════════════════════════════════════
   بحث عن صف مطابق وملء الفورم
   ══════════════════════════════════════════════════ */
function afFill(elementId, date) {
    if (!_afRows.length || !elementId || !date) return;

    /* توحيد التاريخ إلى YYYY-MM-DD */
    function norm(d) {
        if (!d) return '';
        var m  = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m)  return m[3]  + '-' + m[2]  + '-' + m[1];
        var m2 = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m2) return m2[3] + '-' + m2[2].padStart(2,'0') + '-' + m2[1].padStart(2,'0');
        return d.slice(0, 10);
    }

    var target = norm(date);
    var found  = null;

    /* ابحث من الأسفل للأعلى = آخر إدخال */
    for (var i = _afRows.length - 1; i >= 0; i--) {
        var row = _afRows[i];
        /* col 0 = element_id ، col 4 = date */
        if ((row[0]||'').trim() === elementId && norm((row[4]||'').trim()) === target) {
            found = row;
            break;
        }
    }

    if (!found) {
        console.log('[autofill] no match for', elementId, target);
        return;
    }
    console.log('[autofill] found row:', found.slice(0,8).join(' | '));

    /* ── col 3 = contractor ── */
    var contractor = (found[3]||'').trim();
    if (contractor) {
        var sel = document.getElementById('eqf_contractor');
        if (sel) {
            var exists = false;
            for (var k = 0; k < sel.options.length; k++)
                if (sel.options[k].value === contractor) { exists = true; break; }
            if (!exists) {
                var opt = document.createElement('option');
                opt.value = opt.textContent = contractor;
                sel.appendChild(opt);
            }
            sel.value = contractor;
        }
    }

    /* ── col 5 = done_qty ── */
    var doneInp = document.getElementById('eqf_done_qty');
    if (doneInp && found[5]) doneInp.value = found[5].trim();

    /* ── col 6 = PHOTO (URL أو نص "صورة") ── */
    var photoVal = (found[6]||'').trim();
    _afHandlePhoto(photoVal);

    /* ── col 7+ = type1,count1,type2,count2,... ── */
    var pairs = [];
    for (var j = 7; j + 1 < found.length; j += 2) {
        var type  = (found[j]  ||'').trim();
        var count = (found[j+1]||'').trim();
        if (type) pairs.push({ type: type, count: count || '0' });
    }
    _afFillEquipments(pairs);

    /* ── بادج "تم تحميل سجل موجود" ── */
    _afShowLoadedBadge();
}

/* ══════════════════════════════════════════════════
   معالجة عمود PHOTO
   - لو URL → عرض الصورة الحقيقية + رابط
   - لو نص "صورة" → بادج نصي فقط
   - لو فارغ → لا شيء
   ══════════════════════════════════════════════════ */
function _afHandlePhoto(photoVal) {
    /* ازل الـ badge القديم */
    var oldBadge = document.getElementById('af_photo_badge');
    if (oldBadge) oldBadge.remove();

    /* ازل الـ preview القديم */
    var oldPrev = document.getElementById('af_photo_existing');
    if (oldPrev) oldPrev.remove();

    if (!photoVal) return;

    var wrap = document.getElementById('eqf_photo_preview_wrap');
    if (!wrap) return;

    var isUrl = photoVal.startsWith('http');

    if (isUrl) {
        /* ── اعرض الصورة الحقيقية من Drive ── */
        var driveId    = _afExtractDriveId(photoVal);
        /* رابط مصغرة thumbnail من Drive — يعمل كـ <img src> */
        var thumbUrl   = driveId
            ? 'https://drive.google.com/thumbnail?id=' + driveId + '&sz=w600'
            : photoVal;

        var previewDiv = document.createElement('div');
        previewDiv.id = 'af_photo_existing';
        previewDiv.style.cssText = 'width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0;';
        previewDiv.innerHTML =
            '<div style="font-size:10px;font-weight:700;color:rgba(245,200,66,0.8);' +
            'font-family:Cairo,sans-serif;text-align:center;background:rgba(245,200,66,0.08);' +
            'border:1px solid rgba(245,200,66,0.2);border-radius:6px;padding:4px 12px;">' +
            '📋 صورة مسجلة سابقاً — التقط جديدة لاستبدالها' +
            '</div>' +
            '<img src="' + thumbUrl + '" ' +
            'style="max-width:100%;max-height:160px;border-radius:8px;' +
            'border:2px solid rgba(245,200,66,0.4);object-fit:cover;' +
            'box-shadow:0 4px 14px rgba(0,0,0,0.4);" ' +
            'onerror="this.style.display=\'none\';document.getElementById(\'af_photo_existing_fallback\').style.display=\'block\'" ' +
            'alt="صورة سابقة">' +
            '<div id="af_photo_existing_fallback" style="display:none;font-size:10px;color:#ffb74d;' +
            'font-family:Cairo,sans-serif;">' +
            'تعذر تحميل الصورة — ' +
            '<a href="' + photoVal + '" target="_blank" ' +
            'style="color:#5baddf;text-decoration:none;font-weight:700;">افتح على Drive ↗</a>' +
            '</div>' +
            '<a href="' + photoVal + '" target="_blank" ' +
            'style="font-size:10px;color:#5baddf;font-weight:700;font-family:Cairo,sans-serif;' +
            'text-decoration:none;padding:3px 10px;background:rgba(33,150,243,0.1);' +
            'border:1px solid rgba(33,150,243,0.3);border-radius:5px;">' +
            '🔗 عرض الصورة الكاملة على Drive' +
            '</a>';

        /* أضف قبل أي محتوى آخر داخل wrap */
        wrap.insertBefore(previewDiv, wrap.firstChild);

    } else if (photoVal === 'صورة' || photoVal) {
        /* ── بادج نصي للسجلات القديمة ── */
        var pb = document.createElement('div');
        pb.id = 'af_photo_badge';
        pb.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 12px;' +
            'background:rgba(245,200,66,0.12);border:1px solid rgba(245,200,66,0.35);' +
            'border-radius:8px;font-size:11px;font-weight:700;color:#f5c842;' +
            'font-family:Cairo,sans-serif;margin-top:6px;';
        pb.textContent = '📷 يوجد صورة مسجلة — التقط جديدة لاستبدالها';
        wrap.appendChild(pb);
    }
}

/* استخراج fileId من رابط Drive */
function _afExtractDriveId(url) {
    var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    var m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    return null;
}

/* ══════════════════════════════════════════════════
   ملء خانات المعدات — كل معدة في صف كامل مع العدد
   ══════════════════════════════════════════════════ */
function _afFillEquipments(pairs) {
    if (!pairs.length) return;

    var container = document.getElementById('eqf_equipments_container');
    if (!container) return;

    /* مسح الصفوف الحالية */
    container.innerHTML = '';
    window.eqFormEquipmentCount = 0;

    pairs.forEach(function(pair) {
        /* أضف صف جديد عبر الدالة الأصلية */
        if (window.eqAddEquipmentRow) window.eqAddEquipmentRow();

        var rowId   = 'eqrow_' + window.eqFormEquipmentCount;
        var typeSel = document.getElementById(rowId + '_type');
        var cntInp  = document.getElementById(rowId + '_count');

        /* ملء نوع المعدة */
        if (typeSel) {
            /* إضافة الخيار لو مش موجود */
            var exists = false;
            for (var x = 0; x < typeSel.options.length; x++) {
                if (typeSel.options[x].value === pair.type) { exists = true; break; }
            }
            if (!exists) {
                var o = document.createElement('option');
                o.value = o.textContent = pair.type;
                typeSel.appendChild(o);
            }
            typeSel.value = pair.type;
        }

        /* ملء العدد */
        if (cntInp) cntInp.value = pair.count;
    });

    console.log('[autofill] filled', pairs.length, 'equipment rows');
}

/* ══════════════════════════════════════════════════
   بادج "تم تحميل سجل موجود"
   ══════════════════════════════════════════════════ */
function _afShowLoadedBadge() {
    var oldBadge = document.getElementById('af_loaded_badge');
    if (oldBadge) oldBadge.remove();

    var fb = document.getElementById('eqf_feedback');
    if (!fb) return;

    var badge = document.createElement('div');
    badge.id = 'af_loaded_badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;' +
        'background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.4);' +
        'border-radius:10px;margin-bottom:10px;font-size:12px;font-weight:700;' +
        'color:#f5c842;font-family:Cairo,sans-serif;';
    badge.innerHTML =
        '<span>📋</span>' +
        '<span style="flex:1;">تم تحميل سجل موجود — يمكنك تعديله وإعادة الحفظ</span>' +
        '<button onclick="afClearBadge()" style="background:none;border:1px solid rgba(245,200,66,0.4);' +
        'color:rgba(245,200,66,0.7);padding:3px 9px;border-radius:6px;font-size:10px;' +
        'font-weight:700;font-family:Cairo,sans-serif;cursor:pointer;">✕</button>';

    fb.parentElement.insertBefore(badge, fb);
}

/* ══════════════════════════════════════════════════
   مسح الـ badges
   ══════════════════════════════════════════════════ */
function afClearBadge() {
    ['af_loaded_badge', 'af_photo_badge', 'af_photo_existing'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    });
}

/* ══════════════════════════════════════════════════
   الدالة الرئيسية
   ══════════════════════════════════════════════════ */
async function afCheck() {
    var elementId = (document.getElementById('eqf_element_id')?.value  || '').trim();
    var date      = (document.getElementById('eqf_date')?.value        || '').trim();
    var sheetId   = (document.getElementById('eqf_band_sheet')?.value  || '').trim();

    afClearBadge();
    if (!elementId || !date || !sheetId) return;

    await afLoadSheet2(sheetId);
    afFill(elementId, date);

    /* لو في صورة ملتقطة قبل تحديد البند → أعد رفعها الآن */
    if (window.eqRetryPhotoUploadIfNeeded) {
        setTimeout(window.eqRetryPhotoUploadIfNeeded, 300);
    }
}

/* ══════════════════════════════════════════════════
   ربط الأحداث
   ══════════════════════════════════════════════════ */
var _origSelect_af = window.eqSelectElement;
window.eqSelectElement = function(id, name) {
    if (_origSelect_af) _origSelect_af(id, name);
    setTimeout(afCheck, 150);
};

document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'eqf_date') setTimeout(afCheck, 80);
});

var _origReset_af = window.eqResetForm;
window.eqResetForm = function() {
    afClearBadge();
    _afRows = [];
    if (_origReset_af) _origReset_af.apply(this, arguments);
};

window.afCheck      = afCheck;
window.afClearBadge = afClearBadge;
