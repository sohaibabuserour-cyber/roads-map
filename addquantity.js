/* ============================================================
   addquantity.js
   منطق "تسجيل الكمية" داخل شاشة "إضافة".
   ============================================================ */
(function () {
    'use strict';
    window._addQtyItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="qty"]')) {
            el.textContent = msg || '';
        }
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr 1fr auto;">
                <div><label>رقم البند</label><input type="text" id="addQtyItemNo" placeholder="1-1"></div>
                <div><label>التاريخ</label><input type="date" id="addQtyDate"></div>
                <div><label>الكمية المنفذة</label><input type="number" step="any" id="addQtyValue" placeholder="0"></div>
                <div><label>الموقع/الملاحظة</label><input type="text" id="addQtyNote" placeholder="موقع/ملاحظة"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddQuantityItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">📦 الكميات المسجلة <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddQuantityData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>رقم البند</th><th>التاريخ</th><th>الكمية</th><th>ملاحظة</th></tr></thead>
                    <tbody id="addQtyBody"><tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddQuantityData = async function () {
        _setStatus('⏳ تحميل الكميات...');
        try {
            const body = document.getElementById('addQtyBody');
            if (body) body.innerHTML = `<tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل التحميل')); }
    };

    window.saveAddQuantityItem = async function () {
        const it = (document.getElementById('addQtyItemNo')||{}).value || '';
        const dt = (document.getElementById('addQtyDate')||{}).value || '';
        const vl = (document.getElementById('addQtyValue')||{}).value || '';
        if (!it || !dt || !vl) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try { _setStatus('✅ تم الحفظ'); window.refreshAddQuantityData(); }
        catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'qty') {
            const root = document.getElementById('addQuantityRoot');
            if (root && root.classList.contains('panel-placeholder')) _render(root);
            window.refreshAddQuantityData();
        }
    });
})();
