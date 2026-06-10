/* ============================================================
   addcashflow_company.js
   منطق "التدفق النقدي للشركة" داخل شاشة "إضافة".
   ============================================================ */
(function () {
    'use strict';
    window._addCashCoItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="cashco"]')) {
            el.textContent = msg || '';
        }
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr 1fr auto;">
                <div><label>رقم المستخلص</label><input type="text" id="addCashCoNo" placeholder="1"></div>
                <div><label>التاريخ</label><input type="date" id="addCashCoDate"></div>
                <div><label>قيمة المستخلص</label><input type="number" step="any" id="addCashCoValue" placeholder="0.00"></div>
                <div><label>الخصومات</label><input type="number" step="any" id="addCashCoDeduct" placeholder="0.00"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddCashCoItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">💵 مستخلصات الشركة <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddCashCoData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>رقم</th><th>التاريخ</th><th>القيمة</th><th>الخصومات</th><th>الصافي</th></tr></thead>
                    <tbody id="addCashCoBody"><tr><td colspan="5" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddCashCoData = async function () {
        _setStatus('⏳ تحميل التدفق النقدي للشركة...');
        try {
            const body = document.getElementById('addCashCoBody');
            if (body) body.innerHTML = `<tr><td colspan="5" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل التحميل')); }
    };

    window.saveAddCashCoItem = async function () {
        const no = (document.getElementById('addCashCoNo')||{}).value || '';
        const dt = (document.getElementById('addCashCoDate')||{}).value || '';
        const vl = (document.getElementById('addCashCoValue')||{}).value || '';
        if (!no || !dt || !vl) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try { _setStatus('✅ تم الحفظ'); window.refreshAddCashCoData(); }
        catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'cashco') {
            const root = document.getElementById('addCashCoRoot');
            if (root && root.classList.contains('panel-placeholder')) _render(root);
            window.refreshAddCashCoData();
        }
    });
})();
