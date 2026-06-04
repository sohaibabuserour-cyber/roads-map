/* ============================================================
   ui_panels.js  — نسخة مُصلَحة + bottom-sheet للموبايل والتابلت
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
        if (open) _closeMobilePanelSheet();
    };

    window.closeMobileMenu = function () {
        const m = document.getElementById('mobileMenu');
        const o = document.getElementById('mobileMenuOverlay');
        const b = document.getElementById('mobileMenuBtn');
        if (m) m.style.display = 'none';
        if (o) o.style.display = 'none';
        if (b) { b.innerHTML = '☰'; b.style.background = 'rgba(255,255,255,0.07)'; }
        _closeMobilePanelSheet();
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
       4. TOGGLE PANEL
       ══════════════════════════════════════════════════════ */

    /* ── CSS ── */
    (function injectPanelCSS() {
        if (document.getElementById('uiPanelsCSS')) return;
        const s = document.createElement('style');
        s.id = 'uiPanelsCSS';
        s.textContent = `
            /*
             * إصلاح 1: #userGroup مخفي على الناف بار الديسكتوب فقط
             * لكن يظهر طبيعياً داخل الـ bottom-sheet (userPanel)
             */
            @media (max-width: 1024px) {
                .nav-right #userGroup { display: none !important; }
            }

            /* ══════════════════════════════════════════════
               BOTTOM-SHEET OVERLAY
               ══════════════════════════════════════════════ */
            #uiPanelOverlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 29990;
                background: rgba(0,0,0,0.60);
                backdrop-filter: blur(3px);
                -webkit-backdrop-filter: blur(3px);
            }

            /* ══════════════════════════════════════════════
               BOTTOM-SHEET — موبايل وتابلت (≤ 1024px)
               ══════════════════════════════════════════════ */
            @media (max-width: 1024px) {
                .ui-panel-sheet {
                    position: fixed !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    top: auto !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    max-height: 82dvh !important;
                    min-height: 160px !important;
                    border-radius: 22px 22px 0 0 !important;
                    z-index: 29997 !important;
                    box-shadow: 0 -6px 48px rgba(0,0,0,0.45) !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    -webkit-overflow-scrolling: touch !important;
                    animation: uiSlideUp 0.30s cubic-bezier(0.34,1.1,0.64,1) forwards !important;
                    display: flex !important;
                    flex-direction: column !important;
                    padding-bottom: env(safe-area-inset-bottom, 16px) !important;
                    pointer-events: auto !important;
                    /* أبقِ الخلفية الأصلية للعنصر */
                    background-color: var(--panel-bg, var(--white, #fff)) !important;
                    color: var(--text, #222) !important;
                }

                /* شريط السحب في أعلى كل bottom-sheet */
                .ui-panel-sheet::before {
                    content: '';
                    display: block;
                    width: 44px;
                    height: 4px;
                    background: rgba(0,0,0,0.18);
                    border-radius: 4px;
                    margin: 10px auto 4px;
                    flex-shrink: 0;
                    order: -1;
                }

                /* تحديد ألوان خلفية كل panel */
                #contractorPanel.ui-panel-sheet  { background: white !important; }
                #notifPanel.ui-panel-sheet        { background: white !important; }
                #themePanel.ui-panel-sheet        { background: white !important; }
                #userDropdown.ui-panel-sheet      { background: white !important; }

                /* رؤوس الـ panels في وضع bottom-sheet */
                #contractorPanel.ui-panel-sheet .contractor-panel-header,
                #notifPanel.ui-panel-sheet .notif-panel-header,
                #themePanel.ui-panel-sheet .theme-panel-header {
                    border-radius: 0 !important;
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    flex-shrink: 0;
                }

                /* رأس dropdown المستخدم */
                #userDropdown.ui-panel-sheet .user-dropdown-header {
                    border-radius: 0 !important;
                    position: sticky;
                    top: 0;
                    z-index: 2;
                }

                /* اجعل قائمة المقاولين تتمدد */
                #contractorPanel.ui-panel-sheet .contractor-list {
                    max-height: none !important;
                    flex: 1;
                }

                /* عرض مناسب لقائمة الثيمات */
                #themePanel.ui-panel-sheet {
                    width: 100% !important;
                    max-width: 100% !important;
                }

                /* padding داخلي مريح */
                #notifPanel.ui-panel-sheet .notif-item,
                #themePanel.ui-panel-sheet .theme-option {
                    padding: 14px 18px !important;
                }

                /* حقول المستخدم */
                #userDropdown.ui-panel-sheet .ud-field { padding: 10px 18px !important; }
                #userDropdown.ui-panel-sheet .ud-save-btn,
                #userDropdown.ui-panel-sheet .ud-logout {
                    width: calc(100% - 36px) !important;
                    margin: 6px 18px !important;
                    padding: 13px !important;
                    font-size: 13px !important;
                    min-height: 48px;
                }
                #userDropdown.ui-panel-sheet .ud-avatar-wrap {
                    width: 90px !important;
                    height: 90px !important;
                    font-size: 38px !important;
                }
            }

            @keyframes uiSlideUp {
                from { transform: translateY(80px); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }
        `;
        document.head.appendChild(s);
    })();

    /* ── overlay element ── */
    const _overlay = document.createElement('div');
    _overlay.id = 'uiPanelOverlay';
    _overlay.addEventListener('click', function(e) {
        e.stopPropagation();
        _closeMobilePanelSheet();
    });
    document.body.appendChild(_overlay);

    /* ── إغلاق bottom-sheet: إزالة الكلاسات والـ inline styles فقط ── */
    function _closeMobilePanelSheet() {
        document.querySelectorAll('.ui-panel-sheet').forEach(p => {
            p.classList.remove('active', 'ui-panel-sheet');
            const propsToRemove = [
                'position','top','left','right','bottom','z-index',
                'width','max-width','max-height','min-height',
                'border-radius','box-shadow','overflow-y','overflow-x',
                'animation','display','flex-direction','padding-bottom','pointer-events'
            ];
            propsToRemove.forEach(prop => p.style.removeProperty(prop));
        });
        _overlay.style.display = 'none';
    }

    /* ── الـ panels التي تتحول لـ bottom-sheet على الموبايل/تابلت ── */
    const BOTTOM_SHEET_PANELS = new Set([
        'contractorPanel',
        'notifPanel',
        'themePanel',
        'userDropdown'
    ]);

    /* ── الدالة الرئيسية ── */
    window.togglePanel = function (id) {
        const panel = document.getElementById(id);
        if (!panel) return;

        const mobile = isMobile();

        /* هل الـ panel مفتوح حالياً؟ */
        const isOpen = mobile
            ? panel.classList.contains('ui-panel-sheet')
            : panel.classList.contains('active');

        /* أغلق كل الـ panels */
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
        ).forEach(p => {
            p.classList.remove('active');
            if (mobile) p.classList.remove('ui-panel-sheet');
        });
        _overlay.style.display = 'none';

        if (isOpen) return;

        /* افتح الـ panel */
        panel.classList.add('active');

        if (mobile && BOTTOM_SHEET_PANELS.has(id)) {
            /* ── وضع bottom-sheet ── */
            panel.classList.add('ui-panel-sheet');
            _overlay.style.display = 'block';
        }
        /* على الديسكتوب: الـ CSS الأصلي يتكفل بالعرض */

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

    /* ── إغلاق panels عند الضغط خارج nav-right (ديسكتوب فقط) ── */
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
       5. MODALS
       ══════════════════════════════════════════════════════ */
    window.openCashflowModal = function () {
        document.getElementById('cashflowModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        const tab = window.cfActiveTab || 'contractors';
        if (!window.cashflowData?.[tab]) {
            const sheetId = tab === 'contractors'
                ? window.CASHFLOW_CONTRACTORS_SHEET
                : window.CASHFLOW_COMPANY_SHEET;
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
        window.loadBillsData?.();
    };
    window.closeBillsModal = function () {
        document.getElementById('billsModal').classList.remove('active');
        document.body.style.overflow = '';
    };

    window.openEquipmentFormModal = function () {
        document.getElementById('equipmentFormModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        window.eqInitForm?.();
    };
    window.closeEquipmentFormModal = function () {
        document.getElementById('equipmentFormModal').classList.remove('active');
        document.body.style.overflow = '';
    };

    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => {
            if (e.target === m) m.classList.remove('active');
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        window.closeCashflowModal?.();
        window.closeBillsModal?.();
        window.closeEquipmentModal?.();
        window.closeEquipmentFormModal?.();
        window.closeCompanyCashflowForm?.();
        window.closeContractorCashflowForm?.();
        window.closeReportsDropdown?.();
        window.closeAddDropdown?.();
        _closeMobilePanelSheet();
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
        ).forEach(p => p.classList.remove('active'));
    });


    /* ══════════════════════════════════════════════════════
       6. SEARCH DROPDOWN
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
       7. WINDOW RESIZE
       ══════════════════════════════════════════════════════ */
    window.addEventListener('resize', function () {
        if (window.map && typeof window.map.invalidateSize === 'function') {
            window.map.invalidateSize();
        }
        window.positionDropdown?.();
        /* إذا تحول من موبايل لديسكتوب: أغلق bottom-sheets */
        if (!isMobile()) _closeMobilePanelSheet();
    });

})();
