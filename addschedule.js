/* ============================================================
   addschedule.js
   منطق "الجدول الزمني" داخل شاشة "إضافة".
   هيكل موازي لـ addboq.js — جاهز للتوسعة.
   ============================================================ */
(function () {
    'use strict';

    window._addSchedItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="schedule"]')) {
            el.textContent = msg || '';
        }
    }

    function _scriptUrl() {
        return (window.sheetIdsConfig && window.sheetIdsConfig['SCHEDULE_SCRIPT_URL'])
            || window.SCHEDULE_SCRIPT_URL
            || localStorage.getItem('SCHEDULE_SCRIPT_URL') || '';
    }
    function _sheetId() {
        let id = (window.sheetIdsConfig && window.sheetIdsConfig.SCHEDULE_SHEET_ID)
              || window.SCHEDULE_SHEET_ID || '';
        if (id && /\/d\//.test(id)) {
            const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (m) id = m[1];
        }
        return id;
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr auto;">
                <div><label>المرحلة</label><input type="text" id="addSchedStage" placeholder="مرحلة 1"></div>
                <div><label>تاريخ البداية</label><input type="date" id="addSchedStart"></div>
                <div><label>تاريخ النهاية</label><input type="date" id="addSchedEnd"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddScheduleItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">📅 المراحل المحفوظة <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddScheduleData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>المرحلة</th><th>البداية</th><th>النهاية</th><th>المدة (يوم)</th></tr></thead>
                    <tbody id="addSchedItemsBody"><tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddScheduleData = async function () {
        _setStatus('⏳ جاري تحميل الجدول الزمني...');
        try {
            // TODO: ربط بمصدر البيانات الفعلي (Google Sheets)
            const body = document.getElementById('addSchedItemsBody');
            if (body) body.innerHTML = `<tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) {
            console.warn(e); _setStatus('⚠️ ' + (e.message || 'فشل التحميل'));
        }
    };

    window.saveAddScheduleItem = async function () {
        const stage = (document.getElementById('addSchedStage') || {}).value || '';
        const start = (document.getElementById('addSchedStart') || {}).value || '';
        const end   = (document.getElementById('addSchedEnd')   || {}).value || '';
        if (!stage || !start || !end) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try {
            // TODO: استدعاء _scriptUrl() لحفظ الصف
            _setStatus('✅ تم الحفظ');
            window.refreshAddScheduleData();
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    function _maybeInit() {
        const root = document.getElementById('addScheduleRoot');
        if (root && root.classList.contains('panel-placeholder')) _render(root);
    }
    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'schedule') {
            _maybeInit();
            window.refreshAddScheduleData();
        }
    });
})();
