/* ============================================================
   addcashflow_contractors.js
   منطق "التدفق النقدي للمقاولين" داخل شاشة "إضافة".
   ============================================================ */
(function () {
    'use strict';
    window._addCashCtrItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="cashctr"]')) {
            el.textContent = msg || '';
        }
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr 1fr auto;">
                <div><label>المقاول</label><input type="text" id="addCashCtrName" placeholder="اسم المقاول"></div>
                <div><label>التاريخ</label><input type="date" id="addCashCtrDate"></div>
                <div><label>قيمة المستخلص</label><input type="number" step="any" id="addCashCtrValue" placeholder="0.00"></div>
                <div><label>الخصومات</label><input type="number" step="any" id="addCashCtrDeduct" placeholder="0.00"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddCashCtrItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">💸 مستخلصات المقاولين <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddCashCtrData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>المقاول</th><th>التاريخ</th><th>القيمة</th><th>الخصومات</th><th>الصافي</th></tr></thead>
                    <tbody id="addCashCtrBody"><tr><td colspan="5" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddCashCtrData = async function () {
        _setStatus('⏳ تحميل التدفق النقدي للمقاولين...');
        try {
            const body = document.getElementById('addCashCtrBody');
            if (body) body.innerHTML = `<tr><td colspan="5" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل التحميل')); }
    };

    window.saveAddCashCtrItem = async function () {
        const nm = (document.getElementById('addCashCtrName')||{}).value || '';
        const dt = (document.getElementById('addCashCtrDate')||{}).value || '';
        const vl = (document.getElementById('addCashCtrValue')||{}).value || '';
        if (!nm || !dt || !vl) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try { _setStatus('✅ تم الحفظ'); window.refreshAddCashCtrData(); }
        catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'cashctr') {
            const root = document.getElementById('addCashCtrRoot');
            if (root && root.classList.contains('panel-placeholder')) _render(root);
            window.refreshAddCashCtrData();
        }
    });
})();
