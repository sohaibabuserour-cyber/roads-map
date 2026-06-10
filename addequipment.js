/* ============================================================
   addequipment.js
   منطق "تسجيل المعدات" داخل شاشة "إضافة".
   ============================================================ */
(function () {
    'use strict';
    window._addEqItems = [];

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        if (el && document.querySelector('#additionScreen .add-side-tab.active[data-tab="equipment"]')) {
            el.textContent = msg || '';
        }
    }

    function _render(root) {
        root.classList.remove('panel-placeholder');
        root.innerHTML = `
            <div class="boq-form" style="grid-template-columns:1fr 1fr 1fr 1fr auto;">
                <div><label>نوع المعدة</label><input type="text" id="addEqType" placeholder="حفار / لودر..."></div>
                <div><label>الرقم/الكود</label><input type="text" id="addEqCode" placeholder="EQ-001"></div>
                <div><label>التاريخ</label><input type="date" id="addEqDate"></div>
                <div><label>الساعات</label><input type="number" step="any" id="addEqHours" placeholder="0"></div>
                <div class="form-actions"><button class="btn-save" onclick="saveAddEquipmentItem()">💾 حفظ</button></div>
            </div>
            <div class="boq-section-title">🚜 المعدات المسجلة <span class="spacer"></span>
                <button class="btn-import" style="background:linear-gradient(135deg,#1565c0,#0d47a1);" onclick="refreshAddEquipmentData()">🔄 تحديث</button>
            </div>
            <div class="boq-table-wrap">
                <table class="boq-data">
                    <thead><tr><th>النوع</th><th>الكود</th><th>التاريخ</th><th>الساعات</th></tr></thead>
                    <tbody id="addEqBody"><tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr></tbody>
                </table>
            </div>
        `;
    }

    window.refreshAddEquipmentData = async function () {
        _setStatus('⏳ تحميل المعدات...');
        try {
            const body = document.getElementById('addEqBody');
            if (body) body.innerHTML = `<tr><td colspan="4" class="boq-empty">— لا توجد بيانات بعد —</td></tr>`;
            _setStatus('✅ جاهز');
        } catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل التحميل')); }
    };

    window.saveAddEquipmentItem = async function () {
        const t = (document.getElementById('addEqType')||{}).value || '';
        const c = (document.getElementById('addEqCode')||{}).value || '';
        const d = (document.getElementById('addEqDate')||{}).value || '';
        if (!t || !c || !d) { _setStatus('⚠️ أكمل الحقول'); return; }
        _setStatus('⏳ جاري الحفظ...');
        try { _setStatus('✅ تم الحفظ'); window.refreshAddEquipmentData(); }
        catch (e) { _setStatus('⚠️ ' + (e.message || 'فشل الحفظ')); }
    };

    window.addEventListener('additionTab:changed', (ev) => {
        if (ev.detail && ev.detail.tab === 'equipment') {
            const root = document.getElementById('addEquipmentRoot');
            if (root && root.classList.contains('panel-placeholder')) _render(root);
            window.refreshAddEquipmentData();
        }
    });
})();
