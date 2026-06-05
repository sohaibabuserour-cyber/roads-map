/* ============================================================
   ui_panels.js  — نسخة مُصلَحة
   الأزرار: مقاولون / إشعارات / ثيمات / ملف شخصي
   → على موبايل وتابلت (≤1024px): مودال منبثق كامل مثل الإعدادات
   → على ديسكتوب: dropdown عادي كما كان
   ============================================================ */

(function () {
    'use strict';

    /* ══════════════════════════════════════════════════════
       1. MOBILE DETECTION
       ══════════════════════════════════════════════════════ */
    function isMobile() { return window.innerWidth <= 1024; }


    /* ══════════════════════════════════════════════════════
       2. MOBILE MENU
       ══════════════════════════════════════════════════════ */
    window.toggleMobileMenu = function () {
        const m = document.getElementById('mobileMenu');
        const o = document.getElementById('mobileMenuOverlay');
        const b = document.getElementById('mobileMenuBtn');
        const open = m.style.display === 'flex';
        m.style.display = open ? 'none' : 'flex';
        o.style.display = open ? 'none' : 'block';
        b.innerHTML = open ? '☰' : '✕';
        b.style.background = open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.18)';
        if (open) closeMobilePanelModal();
    };

    window.closeMobileMenu = function () {
        const m = document.getElementById('mobileMenu');
        const o = document.getElementById('mobileMenuOverlay');
        const b = document.getElementById('mobileMenuBtn');
        if (m) m.style.display = 'none';
        if (o) o.style.display = 'none';
        if (b) { b.innerHTML = '☰'; b.style.background = 'rgba(255,255,255,0.07)'; }
        closeMobilePanelModal();
    };

    window.openPanelFromMobile = function (id) {
        window.closeMobileMenu();
        window.setTimeout(() => {
            if (typeof window.togglePanel === 'function') window.togglePanel(id);
        }, 50);
    };


    /* ══════════════════════════════════════════════════════
       3. NAV-BAR DROPDOWNS (تقارير / إضافة)
       ══════════════════════════════════════════════════════ */
    function _getDropdown(id) { return document.getElementById(id); }

    function _openDropdown(ddId, triggerEl) {
        ['reportsDropdown', 'addDropdown'].forEach(id => {
            if (id !== ddId) {
                const d = _getDropdown(id);
                if (d) d.style.display = 'none';
            }
        });
        const dd = _getDropdown(ddId);
        if (!dd) return;
        const isOpen = dd.style.display === 'flex';
        if (isOpen) { dd.style.display = 'none'; return; }

        if (triggerEl) {
            const rect = triggerEl.getBoundingClientRect();
            dd.style.position = 'fixed';
            dd.style.top      = rect.bottom + 'px';
            dd.style.right    = 'auto';
            if (isMobile()) {
                dd.style.left  = '8px';
                dd.style.right = '8px';
                dd.style.width = 'auto';
            } else {
                dd.style.left = rect.left + 'px';
            }
        }
        dd.style.display = 'flex';
    }

    window.toggleReportsDropdown = function (e) {
        if (e) e.stopPropagation();
        _openDropdown('reportsDropdown', e && e.currentTarget);
    };
    window.closeReportsDropdown = function () {
        const d = _getDropdown('reportsDropdown');
        if (d) d.style.display = 'none';
    };

    window.toggleAddDropdown = function (e) {
        if (e) e.stopPropagation();
        _openDropdown('addDropdown', e && e.currentTarget);
    };
    window.closeAddDropdown = function () {
        const d = _getDropdown('addDropdown');
        if (d) d.style.display = 'none';
    };

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#navTabReports') && !e.target.closest('#reportsDropdown')) {
            window.closeReportsDropdown();
        }
        if (!e.target.closest('#navTabAdd') && !e.target.closest('#addDropdown')) {
            window.closeAddDropdown();
        }
    });


    /* ══════════════════════════════════════════════════════
       4. MOBILE PANEL MODAL SYSTEM
       شاشة منبثقة كاملة على الموبايل/تابلت
       ══════════════════════════════════════════════════════ */

    /* إعدادات كل panel: العنوان والأيقونة ولون الهيدر */
    const PANEL_META = {
        contractorPanel: {
            title : 'المقاولون',
            icon  : '👷',
            color : 'linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%)'
        },
        notifPanel: {
            title : 'الإشعارات',
            icon  : '🔔',
            color : 'linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%)'
        },
        themePanel: {
            title : 'الثيمات',
            icon  : '🎨',
            color : 'linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%)'
        },
        userDropdown: {
            title : 'الحساب الشخصي',
            icon  : '👤',
            color : 'linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%)'
        }
    };

    /* الـ panel المفتوح حالياً في المودال */
    let _activeMobilePanelId = null;

    /* إنشاء عناصر المودال مرة واحدة */
    let _mobileModalEl   = null;
    let _mobileOverlayEl = null;
    let _modalContentEl  = null;
    let _modalHeaderEl   = null;
    let _modalTitleEl    = null;
    let _modalIconEl     = null;

    function _buildMobileModalDOM() {
        if (_mobileModalEl) return;

        /* CSS */
        const style = document.createElement('style');
        style.id = 'mobilePanelModalCSS';
        style.textContent = `
            /* ══ Overlay ══ */
            #mobilePanelModalOverlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 69990;
                background: rgba(0,0,0,0.65);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }

            /* ══ Modal wrapper ══ */
            #mobilePanelModal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 69995;
                align-items: center;
                justify-content: center;
                padding: 20px 14px;
                box-sizing: border-box;
            }

            /* ══ Modal box ══ */
            #mobilePanelModalBox {
                position: relative;
                width: min(520px, 100%);
                max-height: calc(100dvh - 40px);
                background: #ffffff;
                border-radius: 20px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
                animation: mobilePanelSlideIn 0.28s cubic-bezier(0.34,1.2,0.64,1) both;
            }

            @keyframes mobilePanelSlideIn {
                from { opacity:0; transform: translateY(28px) scale(0.96); }
                to   { opacity:1; transform: translateY(0)    scale(1);    }
            }

            /* ══ Header ══ */
            #mobilePanelModalHeader {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 18px;
                flex-shrink: 0;
            }

            #mobilePanelModalHeader .mph-left {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #mobilePanelModalIcon {
                width: 38px; height: 38px;
                background: rgba(255,255,255,0.18);
                border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
            }

            #mobilePanelModalTitle {
                font-size: 16px;
                font-weight: 900;
                color: white;
                font-family: 'Cairo', sans-serif;
            }

            #mobilePanelModalCloseBtn {
                width: 32px; height: 32px;
                border-radius: 8px;
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.25);
                color: white;
                font-size: 15px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.18s;
                flex-shrink: 0;
            }
            #mobilePanelModalCloseBtn:hover { background: rgba(255,255,255,0.28); }

            /* ══ Content area ══ */
            #mobilePanelModalContent {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                -webkit-overflow-scrolling: touch;
                padding-bottom: env(safe-area-inset-bottom, 12px);
            }
            #mobilePanelModalContent::-webkit-scrollbar { width: 4px; }
            #mobilePanelModalContent::-webkit-scrollbar-thumb {
                background: rgba(106,45,145,0.35);
                border-radius: 4px;
            }

            /* ══ داخل المحتوى: اجعل الـ panel يتمدد ══ */
            #mobilePanelModalContent .contractor-panel,
            #mobilePanelModalContent .notif-panel,
            #mobilePanelModalContent .theme-panel,
            #mobilePanelModalContent .user-dropdown {
                position: static !important;
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
                max-width: 100% !important;
                max-height: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                border: none !important;
                animation: none !important;
                overflow: visible !important;
            }

            /* أخفِ رؤوس الـ panels الداخلية (الهيدر في المودال يغنيها) — عدا userDropdown */
            #mobilePanelModalContent .contractor-panel-header,
            #mobilePanelModalContent .notif-panel-header,
            #mobilePanelModalContent .theme-panel-header {
                display: none !important;
            }

            /* ══ user-dropdown-header: أظهر الصورة فقط — أخفِ الاسم والدور بالـ JS ══ */
            #mobilePanelModalContent .user-dropdown-header {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 24px 16px 16px !important;
                background: linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%) !important;
            }

            /* ══ user-dropdown داخل المودال: الصورة فوق ثم الحقول تحتها ══ */
            #mobilePanelModalContent .user-dropdown {
                align-items: stretch !important;
            }

            /* الأفاتار: كبيرة في الوسط */
            #mobilePanelModalContent .ud-avatar-wrap {
                width: 96px !important;
                height: 96px !important;
                font-size: 40px !important;
                margin: 0 auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            /* الحقول والأزرار: عمود كامل العرض */
            #mobilePanelModalContent .ud-field {
                padding: 10px 16px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            #mobilePanelModalContent .ud-field input {
                width: 100% !important;
                min-height: 44px !important;
                font-size: 14px !important;
                box-sizing: border-box !important;
            }
            #mobilePanelModalContent .ud-save-btn,
            #mobilePanelModalContent .ud-logout {
                width: calc(100% - 32px) !important;
                margin-left: 16px !important;
                margin-right: 16px !important;
                padding: 13px !important;
                font-size: 13px !important;
                min-height: 48px !important;
                border-radius: 10px !important;
                box-sizing: border-box !important;
            }

            /* قائمة المقاولين: بلا max-height */
            #mobilePanelModalContent .contractor-list {
                max-height: none !important;
            }

            /* قائمة الإشعارات */
            #mobilePanelModalContent #notifList {
                max-height: none !important;
            }

            /* خيارات الثيمات: padding مريح */
            #mobilePanelModalContent .theme-option {
                padding: 14px 18px !important;
            }
        `;
        document.head.appendChild(style);

        /* Overlay */
        _mobileOverlayEl = document.createElement('div');
        _mobileOverlayEl.id = 'mobilePanelModalOverlay';
        _mobileOverlayEl.addEventListener('click', () => closeMobilePanelModal());
        document.body.appendChild(_mobileOverlayEl);

        /* Modal */
        _mobileModalEl = document.createElement('div');
        _mobileModalEl.id = 'mobilePanelModal';

        const box = document.createElement('div');
        box.id = 'mobilePanelModalBox';

        /* Header */
        _modalHeaderEl = document.createElement('div');
        _modalHeaderEl.id = 'mobilePanelModalHeader';
        _modalHeaderEl.innerHTML = `
            <div class="mph-left">
                <div id="mobilePanelModalIcon"></div>
                <div id="mobilePanelModalTitle"></div>
            </div>
            <button id="mobilePanelModalCloseBtn" onclick="closeMobilePanelModal()">✕</button>
        `;

        /* Content */
        _modalContentEl = document.createElement('div');
        _modalContentEl.id = 'mobilePanelModalContent';

        box.appendChild(_modalHeaderEl);
        box.appendChild(_modalContentEl);
        _mobileModalEl.appendChild(box);
        document.body.appendChild(_mobileModalEl);

        /* مراجع بعد الإنشاء */
        _modalTitleEl = document.getElementById('mobilePanelModalTitle');
        _modalIconEl  = document.getElementById('mobilePanelModalIcon');
    }

    /* ── فتح مودال panel معين ── */
    function _openMobilePanelModal(panelId) {
        _buildMobileModalDOM();

        const meta  = PANEL_META[panelId];
        const panel = document.getElementById(panelId);
        if (!panel || !meta) return;

        /* تأكد إن الـ panel نفسه active عشان الـ CSS يشتغل */
        panel.classList.add('active');

        /* هيدر */
        _modalHeaderEl.style.background = meta.color;
        _modalIconEl.textContent  = meta.icon;
        _modalTitleEl.textContent = meta.title;

        /* ══ الملف الشخصي: أخفِ الاسم والدور فقط ══ */
        if (panelId === 'userDropdown') {
            const udName = panel.querySelector('#udName');
            const udRole = panel.querySelector('#udRole');
            if (udName) udName.style.display = 'none';
            if (udRole) udRole.style.display = 'none';
        }

        /* انقل محتوى الـ panel جوا المودال */
        _modalContentEl.innerHTML = '';
        _modalContentEl.appendChild(panel);

        /* أظهر */
        _mobileOverlayEl.style.display = 'block';
        _mobileModalEl.style.display   = 'flex';

        /* أعد تشغيل الأنيميشن */
        const box = document.getElementById('mobilePanelModalBox');
        box.style.animation = 'none';
        requestAnimationFrame(() => {
            box.style.animation = '';
        });

        _activeMobilePanelId = panelId;
        document.body.style.overflow = 'hidden';
    }

    /* ── إغلاق المودال وإعادة الـ panel لمكانه الأصلي ── */
    function closeMobilePanelModal() {
        if (!_mobileModalEl || !_activeMobilePanelId) return;

        const panel = document.getElementById(_activeMobilePanelId);

        /* أعد الـ panel لمكانه الأصلي في الـ DOM */
        if (panel) {
            panel.classList.remove('active');

            /* أعد الاسم والدور لو كانوا مخفيين */
            if (_activeMobilePanelId === 'userDropdown') {
                const udName = panel.querySelector('#udName');
                const udRole = panel.querySelector('#udRole');
                if (udName) udName.style.display = '';
                if (udRole) udRole.style.display = '';
            }

            /* المقاول panel → داخل wrapper خاص به */
            const originalParent = _originalParents[_activeMobilePanelId];
            if (originalParent) {
                originalParent.appendChild(panel);
            }
        }

        _mobileModalEl.style.display   = 'none';
        _mobileOverlayEl.style.display = 'none';
        _modalContentEl.innerHTML      = '';
        _activeMobilePanelId = null;
        document.body.style.overflow   = '';
    }

    /* حفظ الأبوين الأصليين قبل أي نقل */
    const _originalParents = {};

    function _saveOriginalParents() {
        Object.keys(PANEL_META).forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
                _originalParents[id] = el.parentElement;
            }
        });
    }

    /* اجعل الدالة عامة عشان زر الإغلاق يقدر يستدعيها */
    window.closeMobilePanelModal = closeMobilePanelModal;

    /* ══════════════════════════════════════════════════════
       5. TOGGLE PANEL  (الدالة الرئيسية)
       ══════════════════════════════════════════════════════ */

    /* CSS للـ panels على الديسكتوب (نفس الكود الأصلي) */
    (function injectPanelCSS() {
        if (document.getElementById('uiPanelsCSS')) return;
        const s = document.createElement('style');
        s.id = 'uiPanelsCSS';
        s.textContent = `
            @media (max-width: 1024px) {
                .nav-right #userGroup { display: none !important; }
            }

            /* overlay للديسكتوب (غير مستخدم على موبايل الآن) */
            #uiPanelOverlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 29990;
                background: rgba(0,0,0,0.52);
            }
        `;
        document.head.appendChild(s);
    })();

    /* overlay الديسكتوب */
    const _overlay = document.createElement('div');
    _overlay.id = 'uiPanelOverlay';
    _overlay.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
        ).forEach(p => p.classList.remove('active'));
        _overlay.style.display = 'none';
    });
    document.body.appendChild(_overlay);

    /* ── الدالة الرئيسية ── */
    window.togglePanel = function (id) {
        const panel = document.getElementById(id);
        if (!panel) return;

        /* ══ موبايل / تابلت ══ */
        if (isMobile() && PANEL_META[id]) {
            /* لو نفس الـ panel مفتوح → أغلق */
            if (_activeMobilePanelId === id) {
                closeMobilePanelModal();
                return;
            }
            /* أغلق أي مودال مفتوح أولاً */
            if (_activeMobilePanelId) closeMobilePanelModal();

            /* side-effects قبل الفتح */
            if (id === 'contractorPanel' && window._activeContractorTab === 'group') {
                window.renderContractorGroupList?.();
            }
            if (id === 'notifPanel') {
                const list = document.getElementById('notifList');
                if (list && list.children.length <= 1) window.loadNotifications?.();
            }

            _openMobilePanelModal(id);
            return;
        }

        /* ══ ديسكتوب ══ */
        const isOpen = panel.classList.contains('active');

        /* أغلق كل الـ panels */
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
        ).forEach(p => p.classList.remove('active'));
        _overlay.style.display = 'none';

        if (isOpen) return;

        panel.classList.add('active');

        /* side-effects */
        if (id === 'settingsPanel') {
            const sl = document.getElementById('settingsLat');
            const sg = document.getElementById('settingsLng');
            const sz = document.getElementById('settingsZoom');
            const sd = document.getElementById('settingsDefaultSub');
            if (sl) sl.value = window.defaultCoords?.lat ?? '';
            if (sg) sg.value = window.defaultCoords?.lng ?? '';
            if (sz) sz.value = window.defaultCoords?.zoom ?? '';
            if (sd) sd.value = window.defaultSubNumber ?? '';
            window.renderDefaultSubPreview?.();
            if (document.getElementById('eqTypesList')) {
                window.renderEquipmentTypesList?.();
                window.updateEqTypesCount?.();
            }
        }
        if (id === 'contractorPanel' && window._activeContractorTab === 'group') {
            window.renderContractorGroupList?.();
        }
        if (id === 'notifPanel') {
            const list = document.getElementById('notifList');
            if (list && list.children.length <= 1) window.loadNotifications?.();
        }
    };

    /* ── إغلاق panels على الديسكتوب عند الضغط خارج nav-right ── */
    document.addEventListener('click', function (e) {
        if (isMobile()) return;
        if (!e.target.closest('.nav-right') && !e.target.closest('#similarGroupModal')) {
            document.querySelectorAll(
                '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.equipment-panel,.settings-panel'
            ).forEach(p => p.classList.remove('active'));
        }
        if (!e.target.closest('.search-wrap')) {
            document.getElementById('searchDropdown')?.classList.remove('active');
        }
    });

    /* ══════════════════════════════════════════════════════
       6. MODALS
       ══════════════════════════════════════════════════════ */
    window.openCashflowModal = function () {
        document.getElementById('cashflowModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        const tab = window.cfActiveTab || 'contractors';
        if (!window.cashflowData?.[tab]) {
            const sheetId = tab === 'contractors'
                ? window._getSheetId('CASHFLOW_CONTRACTORS_SHEET')
                : window._getSheetId('CASHFLOW_COMPANY_SHEET');
            window.loadCfData?.(tab, sheetId);
        } else {
            window.renderCfKpis?.(tab);
        }
    };
    window.closeCashflowModal = function () {
        document.getElementById('cashflowModal').classList.remove('active');
        document.body.style.overflow = '';
    };

    window.openBillsModal = function () {
        document.getElementById('billsModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        // BILLS_SHEET_ID يُحدَّث دائماً من sheetIdsConfig قبل التحميل
        window.BILLS_SHEET_ID = window._getSheetId('BILLS_SHEET_ID');
        window.loadBillsData?.();
    };
    window.closeBillsModal = function () {
        document.getElementById('billsModal').classList.remove('active');
        document.body.style.overflow = '';
    };

    // openEquipmentFormModal — لا نعمل override هنا لأن equipment_combined.js عنده الكود الكامل
    // فقط نضمن إن الـ modal يفتح ويشتغل الكود الأصلي
    window.closeEquipmentFormModal = function () {
        document.getElementById('equipmentFormModal').classList.remove('active');
        document.body.style.overflow = '';
        if (window.eqCancelPickFromMap)    window.eqCancelPickFromMap();
        if (window.eqCancelPickFromMapCumul) window.eqCancelPickFromMapCumul();
    };

    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => {
            if (e.target === m) m.classList.remove('active');
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        closeMobilePanelModal();
        window.closeCashflowModal?.();
        window.closeBillsModal?.();
        window.closeEquipmentModal?.();
        window.closeEquipmentFormModal?.();
        window.closeCompanyCashflowForm?.();
        window.closeContractorCashflowForm?.();
        window.closeReportsDropdown?.();
        window.closeAddDropdown?.();
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
        ).forEach(p => p.classList.remove('active'));
    });


    /* ══════════════════════════════════════════════════════
       7. SEARCH DROPDOWN
       ══════════════════════════════════════════════════════ */
    window.positionDropdown = function () {
        const dd  = document.getElementById('searchDropdown');
        const box = document.querySelector('.search-wrap');
        if (!box || !dd?.classList.contains('active')) return;
        const r = box.getBoundingClientRect();
        dd.style.top   = r.bottom + 'px';
        dd.style.left  = r.left   + 'px';
        dd.style.width = r.width  + 'px';
        dd.style.right = 'auto';
    };

    document.getElementById('searchInput')
        ?.addEventListener('input', () => window.updateSearchDropdown?.());


    /* ══════════════════════════════════════════════════════
       8. WINDOW RESIZE
       ══════════════════════════════════════════════════════ */
    window.addEventListener('resize', function () {
        if (window.map && typeof window.map.invalidateSize === 'function') {
            window.map.invalidateSize();
        }
        window.positionDropdown?.();
        /* تحول من موبايل لديسكتوب → أغلق المودال وأعد الـ panels لأماكنها */
        if (!isMobile()) closeMobilePanelModal();
    });

    /* ══════════════════════════════════════════════════════
       9. INIT — حفظ الأبوين بعد تحميل الصفحة
       ══════════════════════════════════════════════════════ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _saveOriginalParents);
    } else {
        _saveOriginalParents();
    }

})();
