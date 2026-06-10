/* ============================================================
   addscreen.js — شاشة "الإضافة" الموحدة
   • مودال كامل الشاشة
   • سايدبار يسار: 6 تبويبات (طي بأيقونات، توسع عند الـ hover، زر تثبيت)
   • محتوى يمين: ينقل مودال الإضافة الأصلى داخل التبويب المختار
   • لا يلمس منطق الحفظ / الـ validation
   آخر ملف يُحمَّل بعد كل سكريبتات الإضافة:
       <script src="addtarget.js"></script>
       <script src="addscreen.js"></script>
   ============================================================ */
(function () {
    'use strict';

    const TABS = [
        { key: 'equipment',   icon: '🚜', label: 'تسجيل المعدات',         modalId: 'equipmentFormModal',     opener: 'openEquipmentFormModal',     closer: 'closeEquipmentFormModal' },
        { key: 'cfCompany',   icon: '🏢', label: 'تدفق نقدى - شركة',      modalId: 'companyCashflowModal',   opener: 'openCompanyCashflowForm',    closer: 'closeCompanyCashflowForm' },
        { key: 'cfContractor',icon: '👷', label: 'تدفق نقدى - مقاولون',   modalId: 'contractorCashflowModal',opener: 'openContractorCashflowForm', closer: 'closeContractorCashflowForm' },
        { key: 'target',      icon: '🎯', label: 'المستهدف الشهرى',       modalId: 'targetFormModal',        opener: 'openTargetFormTab',          closer: 'closeTargetFormModal' },
        { key: 'boq',         icon: '📋', label: 'جدول الكميات',          modalId: 'boqFormModal',           opener: 'openBOQFormModal',           closer: 'closeBOQFormModal' },
        { key: 'schedule',    icon: '📅', label: 'البرنامج الزمنى',       modalId: 'scheduleFormModal',      opener: 'openScheduleFormModal',      closer: 'closeScheduleFormModal' },
    ];

    const PIN_KEY = 'addScreenSidebarPinned';

    /* ── 1. CSS ── */
    function injectCSS() {
        if (document.getElementById('addScreenStyle')) return;
        const s = document.createElement('style');
        s.id = 'addScreenStyle';
        s.textContent = `
#addScreen{position:fixed;inset:0;z-index:80000;background:#0a0716;display:none;flex-direction:row;font-family:'Cairo',sans-serif;direction:rtl;}
#addScreen.show{display:flex;}

/* ===== content area (right visually in RTL via order) ===== */
#addScreen .as-content{flex:1;order:1;overflow:auto;background:linear-gradient(180deg,#0e0a1f 0%,#080513 100%);position:relative;}
#addScreen .as-content-header{position:sticky;top:0;z-index:5;background:linear-gradient(135deg,#1a0a2e,#3d1060);padding:14px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(245,200,66,0.18);box-shadow:0 4px 18px rgba(0,0,0,0.4);}
#addScreen .as-content-title{color:#fff;font-weight:900;font-size:17px;display:flex;align-items:center;gap:10px;}
#addScreen .as-close-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;width:38px;height:38px;border-radius:10px;font-size:16px;cursor:pointer;font-weight:800;transition:all .15s;}
#addScreen .as-close-btn:hover{background:rgba(244,67,54,0.25);border-color:rgba(244,67,54,0.5);}
#addScreen .as-tab-panel{display:none;padding:0;}
#addScreen .as-tab-panel.active{display:block;}

/* ===== sidebar (left visually) ===== */
#addScreen .as-sidebar{order:2;width:64px;background:linear-gradient(180deg,#15102a 0%,#0d0820 100%);border-left:1px solid rgba(245,200,66,0.15);transition:width .22s ease;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;position:relative;}
#addScreen .as-sidebar.expanded,#addScreen .as-sidebar.pinned{width:240px;}
#addScreen .as-sidebar-head{padding:14px 12px;border-bottom:1px solid rgba(245,200,66,0.12);display:flex;align-items:center;gap:10px;color:#f5c842;font-weight:900;font-size:13px;min-height:54px;}
#addScreen .as-sidebar-head .as-pin-btn{margin-inline-start:auto;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.25);color:#f5c842;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
#addScreen .as-sidebar-head .as-pin-btn:hover{background:rgba(245,200,66,0.22);}
#addScreen .as-sidebar-head .as-pin-btn.pinned{background:#f5c842;color:#1a0a2e;}
#addScreen .as-sidebar-head .as-head-text{white-space:nowrap;opacity:0;transition:opacity .15s;}
#addScreen .as-sidebar.expanded .as-head-text,#addScreen .as-sidebar.pinned .as-head-text{opacity:1;}
#addScreen .as-tabs{flex:1;overflow-y:auto;padding:10px 8px;display:flex;flex-direction:column;gap:4px;}
#addScreen .as-tab{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;color:rgba(255,255,255,0.75);cursor:pointer;font-size:13px;font-weight:700;border:1px solid transparent;transition:all .15s;white-space:nowrap;overflow:hidden;}
#addScreen .as-tab:hover{background:rgba(245,200,66,0.08);color:#fff;}
#addScreen .as-tab.active{background:rgba(245,200,66,0.18);border-color:rgba(245,200,66,0.4);color:#f5c842;}
#addScreen .as-tab .as-tab-icon{font-size:18px;flex-shrink:0;width:24px;text-align:center;}
#addScreen .as-tab .as-tab-label{opacity:0;transition:opacity .15s;}
#addScreen .as-sidebar.expanded .as-tab-label,#addScreen .as-sidebar.pinned .as-tab-label{opacity:1;}

/* ===== embed original modal inside tab panel ===== */
#addScreen .as-tab-panel .modal,
#addScreen .as-tab-panel > [id$="FormModal"]{
    position:static !important;inset:auto !important;display:block !important;
    background:transparent !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
    padding:0 !important;align-items:initial !important;justify-content:initial !important;
    z-index:auto !important;width:100% !important;height:auto !important;opacity:1 !important;visibility:visible !important;
}
#addScreen .as-tab-panel .modal.active,
#addScreen .as-tab-panel .modal.open{display:block !important;}
/* hide backdrop / overlay children that were used to close on click */
#addScreen .as-tab-panel > div > div[onclick*="close"][style*="position:fixed"],
#addScreen .as-tab-panel .bd-modal-overlay{display:none !important;}
/* relax inner modal box sizing so it fits the content area */
#addScreen .as-tab-panel .dark-modal-shell,
#addScreen .as-tab-panel [class*="modal-box"],
#addScreen .as-tab-panel > div > div:not([style*="position:fixed"]){max-width:none !important;width:auto !important;margin:0 !important;}

@media (max-width:768px){
    #addScreen .as-sidebar{width:54px;}
    #addScreen .as-sidebar.expanded,#addScreen .as-sidebar.pinned{width:220px;}
}
        `;
        document.head.appendChild(s);
    }

    /* ── 2. SHELL ── */
    function buildShell() {
        if (document.getElementById('addScreen')) return;
        const root = document.createElement('div');
        root.id = 'addScreen';
        root.innerHTML = `
<div class="as-content">
    <div class="as-content-header">
        <div class="as-content-title" id="asCurrentTitle">✏️ شاشة الإضافة</div>
        <button class="as-close-btn" type="button" onclick="closeAddScreen()" aria-label="إغلاق">✕</button>
    </div>
    ${TABS.map(t => `<div class="as-tab-panel" data-tab="${t.key}" id="asPanel_${t.key}"></div>`).join('')}
</div>
<aside class="as-sidebar" id="asSidebar">
    <div class="as-sidebar-head">
        <span style="font-size:18px;">✏️</span>
        <span class="as-head-text">الإضافة</span>
        <button class="as-pin-btn" type="button" id="asPinBtn" onclick="toggleAddSidebarPin()" title="تثبيت" aria-label="تثبيت">📌</button>
    </div>
    <div class="as-tabs">
        ${TABS.map(t => `
            <div class="as-tab" data-tab="${t.key}" onclick="switchAddTab('${t.key}')" title="${t.label}">
                <span class="as-tab-icon">${t.icon}</span>
                <span class="as-tab-label">${t.label}</span>
            </div>`).join('')}
    </div>
</aside>`;
        document.body.appendChild(root);

        const sidebar = root.querySelector('#asSidebar');
        sidebar.addEventListener('mouseenter', () => sidebar.classList.add('expanded'));
        sidebar.addEventListener('mouseleave', () => sidebar.classList.remove('expanded'));

        if (localStorage.getItem(PIN_KEY) === '1') {
            sidebar.classList.add('pinned');
            const btn = root.querySelector('#asPinBtn'); if (btn) btn.classList.add('pinned');
        }
    }

    /* ── 3. MOVE ORIGINAL MODAL INTO TAB ── */
    function ensureTabContent(tab) {
        const panel = document.getElementById('asPanel_' + tab.key);
        if (!panel) return false;
        if (panel.dataset.loaded === '1') return true;

        const modal = document.getElementById(tab.modalId);
        if (!modal) return false;

        // mark and move
        modal.dataset.embeddedInAddScreen = '1';
        panel.appendChild(modal);

        // patch the closer to close the unified screen instead
        if (tab.closer && typeof window[tab.closer] === 'function') {
            const orig = window[tab.closer];
            window[tab.closer] = function () {
                try { orig.apply(this, arguments); } catch (e) { console.warn(e); }
                closeAddScreen();
            };
        }
        panel.dataset.loaded = '1';
        return true;
    }

    /* ── 4. PUBLIC API ── */
    window.openAddScreen = function (key) {
        injectCSS(); buildShell();
        document.getElementById('addScreen').classList.add('show');
        document.body.style.overflow = 'hidden';
        if (key) switchAddTab(key);
    };

    window.closeAddScreen = function () {
        const el = document.getElementById('addScreen');
        if (el) el.classList.remove('show');
        document.body.style.overflow = '';
    };

    window.switchAddTab = function (key) {
        const tab = TABS.find(t => t.key === key);
        if (!tab) return;
        injectCSS(); buildShell();
        document.getElementById('addScreen').classList.add('show');
        document.body.style.overflow = 'hidden';

        ensureTabContent(tab);

        document.querySelectorAll('#addScreen .as-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === key);
        });
        document.querySelectorAll('#addScreen .as-tab-panel').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === key);
        });

        const titleEl = document.getElementById('asCurrentTitle');
        if (titleEl) titleEl.innerHTML = `${tab.icon} ${tab.label}`;

        // call original opener for side-effects (populate selects, dates, fetch data)
        // but suppress the original "show modal" since the modal is now embedded
        if (tab._origOpener) {
            try { tab._origOpener(); } catch (e) { console.error('[addScreen] opener failed:', e); }
        }
    };

    window.toggleAddSidebarPin = function () {
        const sb  = document.getElementById('asSidebar');
        const btn = document.getElementById('asPinBtn');
        if (!sb) return;
        const pinned = sb.classList.toggle('pinned');
        if (btn) btn.classList.toggle('pinned', pinned);
        localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
    };

    /* ── 5. PATCH ORIGINAL OPENERS ── */
    function patchOpeners() {
        TABS.forEach(tab => {
            const orig = window[tab.opener];
            if (typeof orig === 'function') tab._origOpener = orig;
            window[tab.opener] = function () { window.switchAddTab(tab.key); };
        });
    }

    /* ── 6. BOOT ── */
    function boot() {
        injectCSS();
        buildShell();
        patchOpeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
