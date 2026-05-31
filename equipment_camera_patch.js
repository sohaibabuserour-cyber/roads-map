/* ====================================================
   CAMERA PATCH — equipment_camera_patch.js  v2
   التعديلات عن v1:
   ✅ الصورة تُرفع على Google Drive عبر Apps Script
   ✅ يُرسَل photo_url في الـ payload بدل base64
   ✅ مؤشر رفع واضح (جاري الرفع / تم / فشل)
   ✅ رابط Drive يظهر للمستخدم بعد الرفع
   ✅ لو اختار العنصر بعد الصورة → يُعيد الرفع تلقائياً
   ==================================================== */

/* ── متغيرات الصورة ── */
let _eqPhotoBase64    = null;  // base64 مؤقت للعرض
let _eqPhotoUrl       = null;  // URL نهائي من Drive
let _eqPhotoUploading = false;

/* ══════════════════════════════════════════════════
   1. Override خفيف على fetch
      يُضيف photo_url للـ payload (بدل base64)
   ══════════════════════════════════════════════════ */
(function patchFetchForPhoto() {
    const _origFetch = window.fetch;
    window.fetch = function(url, options) {
        if (options && options.method === 'POST' &&
            options.body && typeof options.body === 'string') {
            try {
                const payload = JSON.parse(options.body);
                if (payload.form_type === 'daily') {
                    if (_eqPhotoUrl) {
                        payload.photo_url = _eqPhotoUrl;
                        payload.has_photo = true;
                    } else {
                        payload.has_photo = false;
                    }
                    options = Object.assign({}, options, {
                        body: JSON.stringify(payload)
                    });
                }
            } catch(e) { /* ليس payload المعدات */ }
        }
        return _origFetch.call(this, url, options);
    };
})();

/* ══════════════════════════════════════════════════
   2. حقن قسم الكاميرا في الفورم
   ══════════════════════════════════════════════════ */
function eqInjectCameraSection() {
    if (document.getElementById('eqf_camera_section')) return;

    const equipContainer = document.getElementById('eqf_equipments_container');
    if (!equipContainer) return;
    const equipWrapper = equipContainer.parentElement;
    if (!equipWrapper) return;

    /* حقن CSS للـ spinner مرة واحدة */
    if (!document.getElementById('eq_camera_css')) {
        const st = document.createElement('style');
        st.id = 'eq_camera_css';
        st.textContent = '@keyframes eqSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
    }

    const section = document.createElement('div');
    section.id = 'eqf_camera_section';
    section.style.cssText = 'border:1px solid rgba(33,150,243,0.25);border-radius:12px;overflow:hidden;margin-bottom:16px;';

    section.innerHTML = `
        <!-- Header -->
        <div style="background:linear-gradient(135deg,rgba(33,150,243,0.15),rgba(21,101,192,0.1));
            padding:10px 16px;display:flex;align-items:center;
            justify-content:space-between;border-bottom:1px solid rgba(33,150,243,0.15);">
            <span style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.9);font-family:'Cairo',sans-serif;">
                📷 صورة الموقع
                <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.4);margin-right:6px;">(اختياري)</span>
            </span>
            <div style="display:flex;gap:8px;align-items:center;">
                <button type="button" onclick="eqOpenCamera()" id="eqf_camera_btn"
                    style="padding:7px 14px;background:linear-gradient(135deg,#1a4a8a,#2196f3);
                    border:none;border-radius:8px;color:white;font-size:12px;font-weight:700;
                    font-family:'Cairo',sans-serif;cursor:pointer;display:flex;align-items:center;
                    gap:6px;transition:all 0.2s;box-shadow:0 2px 10px rgba(33,150,243,0.3);"
                    onmouseover="this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.transform='translateY(0)'">
                    📷 التقاط صورة
                </button>
                <button type="button" onclick="eqClearPhoto()" id="eqf_photo_clear_btn"
                    style="display:none;padding:6px 10px;background:rgba(244,67,54,0.12);
                    border:1px solid rgba(244,67,54,0.3);border-radius:7px;color:#ff8a80;
                    font-size:11px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;">
                    ✕ حذف
                </button>
            </div>
        </div>

        <!-- مؤشر حالة الرفع -->
        <div id="eqf_photo_upload_status" style="display:none;padding:7px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;font-family:'Cairo',sans-serif;">
                <span id="eqf_upload_icon" style="display:inline-block;">⏳</span>
                <span id="eqf_upload_status_text">جاري رفع الصورة...</span>
            </div>
        </div>

        <!-- معاينة الصورة -->
        <div id="eqf_photo_preview_wrap" style="padding:12px 16px;min-height:50px;
            display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">

            <div id="eqf_photo_placeholder" style="color:rgba(255,255,255,0.2);font-size:11px;
                font-family:'Cairo',sans-serif;text-align:center;padding:8px 0;">
                لم يتم التقاط صورة بعد
            </div>

            <img id="eqf_photo_preview_img"
                style="display:none;max-width:100%;max-height:180px;border-radius:8px;
                border:2px solid rgba(33,150,243,0.4);object-fit:cover;
                box-shadow:0 4px 16px rgba(0,0,0,0.4);" alt="صورة الموقع">

            <!-- رابط Drive يظهر بعد الرفع -->
            <a id="eqf_photo_drive_link" href="#" target="_blank" style="display:none;
                font-size:10px;color:#5baddf;font-weight:700;font-family:'Cairo',sans-serif;
                text-decoration:none;padding:3px 10px;background:rgba(33,150,243,0.1);
                border:1px solid rgba(33,150,243,0.3);border-radius:5px;">
                🔗 عرض الصورة على Drive
            </a>
        </div>

        <input type="file" id="eqf_photo_input" accept="image/*" capture="environment"
            style="display:none" onchange="eqHandlePhotoSelected(event)">
    `;

    equipWrapper.parentElement.insertBefore(section, equipWrapper);
}

/* ══════════════════════════════════════════════════
   3. فتح الكاميرا
   ══════════════════════════════════════════════════ */
function eqOpenCamera() {
    const inp = document.getElementById('eqf_photo_input');
    if (!inp) return;
    inp.value = '';
    inp.click();
}

/* ══════════════════════════════════════════════════
   4. اختيار الصورة — ضغط + عرض + رفع
   ══════════════════════════════════════════════════ */
function eqHandlePhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        _eqCompressPhoto(e.target.result, 1024, 0.80, function(compressed) {
            _eqPhotoBase64 = compressed;
            _eqPhotoUrl    = null;
            _eqShowPhotoPreview(compressed);
            _eqUploadPhotoToDrive(compressed);
        });
    };
    reader.readAsDataURL(file);
}

function _eqCompressPhoto(dataUrl, maxWidth, quality, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
}

/* ══════════════════════════════════════════════════
   5. رفع الصورة على Google Drive عبر Apps Script
   ══════════════════════════════════════════════════ */
async function _eqUploadPhotoToDrive(base64DataUrl) {
    /* جلب scriptUrl من البند الفرعي المحدد */
    const bandSheet = (document.getElementById('eqf_band_sheet')?.value || '').trim();
    let scriptUrl = '';

    if (bandSheet) {
        try {
            const allSubs = (window.categories || []).flatMap(c => c.subitems || []);
            const matched = allSubs.find(s => s.sheetId === bandSheet);
            if (matched && matched.scriptUrl) scriptUrl = matched.scriptUrl.trim();
        } catch(e) {}
    }

    if (!scriptUrl) {
        /* لا يوجد سكريبت — الصورة محلية فقط، بدون رفع */
        _eqSetUploadStatus('warn', '⚠️ الصورة محلية فقط — اختر البند أولاً لرفعها');
        return;
    }

    /* اسم الملف */
    const elementId = (document.getElementById('eqf_element_id')?.value || 'unknown').trim();
    const date      = (document.getElementById('eqf_date')?.value || new Date().toISOString().split('T')[0]).trim();
    const fileName  = `photo_${elementId}_${date}_${Date.now()}.jpg`;

    _eqPhotoUploading = true;
    _eqSetUploadStatus('loading', 'جاري رفع الصورة على Drive...');

    const base64Pure = base64DataUrl.split(',')[1];

    try {
        const r = await fetch(scriptUrl, {
            method : 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body   : JSON.stringify({
                action    : 'uploadPhoto',
                fileName  : fileName,
                mimeType  : 'image/jpeg',
                base64Data: base64Pure
            }),
            redirect: 'follow'
        });

        const text = await r.text();
        let resp = {};
        try { resp = JSON.parse(text); } catch(e) {}

        if (resp.status === 'success' && resp.url) {
            _eqPhotoUrl = resp.url;
            _eqSetUploadStatus('success', '✅ تم رفع الصورة على Drive بنجاح');

            /* تحديث رابط Drive */
            const linkEl = document.getElementById('eqf_photo_drive_link');
            if (linkEl) { linkEl.href = resp.url; linkEl.style.display = 'inline-flex'; }

            setTimeout(() => _eqHideUploadStatus(), 4000);
        } else {
            throw new Error(resp.message || 'فشل الرفع');
        }
    } catch(e) {
        console.warn('[camera] upload error:', e.message);
        _eqSetUploadStatus('error', '❌ فشل رفع الصورة — سيُرسَل بدون صورة');
        _eqPhotoUrl = null;
    } finally {
        _eqPhotoUploading = false;
    }
}

/* ── مؤشر حالة الرفع ── */
function _eqSetUploadStatus(type, msg) {
    const wrap = document.getElementById('eqf_photo_upload_status');
    const txt  = document.getElementById('eqf_upload_status_text');
    const icon = document.getElementById('eqf_upload_icon');
    if (!wrap || !txt) return;

    const styles = {
        loading: { bg: 'rgba(245,200,66,0.08)', color: '#f5c842',  icon: '⏳', spin: true  },
        success: { bg: 'rgba(39,174,106,0.08)',  color: '#5cc890',  icon: '✅', spin: false },
        warn   : { bg: 'rgba(255,152,0,0.08)',   color: '#ffb74d',  icon: '⚠️', spin: false },
        error  : { bg: 'rgba(244,67,54,0.08)',   color: '#ff8a80',  icon: '❌', spin: false }
    };
    const s = styles[type] || styles.warn;

    wrap.style.display    = 'block';
    wrap.style.background = s.bg;
    txt.style.color       = s.color;
    txt.textContent       = msg;
    if (icon) {
        icon.textContent = s.icon;
        icon.style.animation = s.spin ? 'eqSpin 0.8s linear infinite' : 'none';
        icon.style.color     = s.color;
    }
}

function _eqHideUploadStatus() {
    const wrap = document.getElementById('eqf_photo_upload_status');
    if (wrap) wrap.style.display = 'none';
}

/* ── عرض الصورة في الـ preview ── */
function _eqShowPhotoPreview(base64) {
    const ph  = document.getElementById('eqf_photo_placeholder');
    const img = document.getElementById('eqf_photo_preview_img');
    const del = document.getElementById('eqf_photo_clear_btn');
    if (ph)  ph.style.display  = 'none';
    if (img) { img.src = base64; img.style.display = 'block'; }
    if (del) del.style.display = 'block';
}

/* ── مسح الصورة ── */
function eqClearPhoto() {
    _eqPhotoBase64    = null;
    _eqPhotoUrl       = null;
    _eqPhotoUploading = false;

    const els = {
        'eqf_photo_placeholder'  : e => e.style.display  = 'block',
        'eqf_photo_preview_img'  : e => { e.src = ''; e.style.display = 'none'; },
        'eqf_photo_clear_btn'    : e => e.style.display  = 'none',
        'eqf_photo_drive_link'   : e => e.style.display  = 'none',
        'eqf_photo_input'        : e => e.value = ''
    };
    Object.entries(els).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) fn(el);
    });
    _eqHideUploadStatus();
}

/* ══════════════════════════════════════════════════
   6. إعادة محاولة الرفع لو اختار العنصر/البند
      بعد التقاط الصورة (شائع على الموبايل)
   ══════════════════════════════════════════════════ */
function eqRetryPhotoUploadIfNeeded() {
    if (_eqPhotoBase64 && !_eqPhotoUrl && !_eqPhotoUploading) {
        _eqUploadPhotoToDrive(_eqPhotoBase64);
    }
}

/* ══════════════════════════════════════════════════
   7. ربط مع دورة حياة الفورم
   ══════════════════════════════════════════════════ */
const _origOpenEqForm_cam = window.openEquipmentFormModal;
window.openEquipmentFormModal = function() {
    if (_origOpenEqForm_cam) _origOpenEqForm_cam.apply(this, arguments);
    setTimeout(function() {
        eqInjectCameraSection();
        eqClearPhoto();
    }, 90);
};

const _origEqReset_cam = window.eqResetForm;
window.eqResetForm = function() {
    eqClearPhoto();
    if (_origEqReset_cam) _origEqReset_cam.apply(this, arguments);
};

/* ══════════════════════════════════════════════════
   8. تصدير
   ══════════════════════════════════════════════════ */
window.eqOpenCamera               = eqOpenCamera;
window.eqClearPhoto               = eqClearPhoto;
window.eqHandlePhotoSelected      = eqHandlePhotoSelected;
window.eqInjectCameraSection      = eqInjectCameraSection;
window.eqRetryPhotoUploadIfNeeded = eqRetryPhotoUploadIfNeeded;
