/* ============================================================
   addquantity.js — تسجيل الكمية التراكمية داخل شاشة الإضافة
   ============================================================ */
(function () {
    'use strict';

    function _setStatus(msg) {
        const el = document.getElementById('addBoqStatusMsg');
        const t  = document.querySelector('#additionScreen .add-side-tab.active');
        if (el && t && t.dataset.tab === 'qty') el.textContent = msg || '';
    }

    function _initCumulTab() {
        if (typeof window.eqInitCumulTab === 'function') {
            window.eqInitCumulTab();
            _setStatus('✅ جاهز');
        } else {
            _setStatus('⏳ جاري التحميل...');
        }
    }

    window.openCumulQtyTab = function () {
        const scr = document.getElementById('additionScreen');
        if (!scr) return;
        scr.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (typeof window.switchAdditionTab === 'function') {
            window.switchAdditionTab('qty');
        } else {
            _initCumulTab();
        }
    };

    window.addEventListener('additionTab:changed', function (ev) {
        if (ev.detail && ev.detail.tab === 'qty') {
            _initCumulTab();
        }
    });
})();
