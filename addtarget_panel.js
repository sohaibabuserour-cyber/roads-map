/* ============================================================
   addtarget_panel.js
   منطق "المستهدف" داخل شاشة "إضافة".
   ============================================================ */
(function () {
    'use strict';
    window._addTargetItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="target"]')) {
            el.textContent = msg || '';
        }
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr auto;">
                <div><label>الشهر</label><input type="month" id="addTgtMonth"></div>
                <div><label>قيمة المستهدف</label><input type="number" step="any" id="addTgtValue" placeholder="0.00"></div>
                <div><label>ملاحظة</label><input type="text" id="addTgtNote" placeholder="ملاحظة"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddTargetItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">🎯 الأهداف المسجلة <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddTargetData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>الشهر</th><th>القيمة</th><th>ملاحظة</th></tr></thead>
                    <tbody id="addTgtItemsBody"><tr><td colspan="3" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddTargetData = async function () {
        _setStatus('⏳ تحميل المستهدف...');
        try {
            const body = document.getElementById('addTgtItemsBody');
            if (body) body.innerHTML = `<tr><td colspan="3" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل التحميل')); }
    };

    window.saveAddTargetItem = async function () {
        const m = (document.getElementById('addTgtMonth') || {}).value || '';
        const v = (document.getElementById('addTgtValue') || {}).value || '';
        if (!m || !v) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try { _setStatus('✅ تم الحفظ'); window.refreshAddTargetData(); }
        catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'target') {
            const root = document.getElementById('addTargetRoot');
            if (root && root.classList.contains('panel-placeholder')) _render(root);
            window.refreshAddTargetData();
        }
    });
})();
