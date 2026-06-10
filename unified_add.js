/* ============================================================
   unified_add.js
   شاشة موحّدة لكل نماذج "الإضافة" مع شريط جانبي قابل للطي
   (أيقونات فقط) — يتوسّع عند المرور أو التثبيت.

   الاستخدام: استبدل onclick في index.html من:
        openEquipmentFormModal()  →  openUnifiedAdd('equipment')
        openCompanyCashflowForm() →  openUnifiedAdd('cfCompany')
        openContractorCashflowForm()→ openUnifiedAdd('cfContractor')
        openTargetFormTab()       →  openUnifiedAdd('target')
        openBOQFormModal()        →  openUnifiedAdd('boq')
        openScheduleFormModal()   →  openUnifiedAdd('schedule')

   لا يلمس أي ملف آخر — يعتمد على دوال الفتح الأصلية كما هي.
   ============================================================ */
(function () {
    'use strict';

    /* ───────── إعدادات التبويبات ───────── */
    const TABS = [
        { id: 'equipment',    icon: '🚜', label: 'تسجيل المعدات',       modalId: 'equipmentFormModal',     openFn: 'openEquipmentFormModal',    closeFn: 'closeEquipmentFormModal' },
        { id: 'cfCompany',    icon: '🏢', label: 'تدفق نقدي - الشركة',   modalId: 'companyCashflowModal',   openFn: 'openCompanyCashflowForm',   closeFn: 'closeCompanyCashflowForm' },
        { id: 'cfContractor', icon: '👷', label: 'تدفق نقدي - المقاولون', modalId: 'contractorCashflowModal', openFn: 'openContractorCashflowForm', closeFn: 'closeContractorCashflowForm' },
        { id: 'target',       icon: '🎯', label: 'المستهدف الشهري',     modalId: 'targetFormModal',        openFn: 'openTargetFormTab',         closeFn: 'closeTargetFormTab' },
        { id: 'boq',          icon: '📋', label: 'جدول الكميات',        modalId: 'boqFormModal',           openFn: 'openBOQFormModal',          closeFn: 'closeBOQFormModal' },
        { id: 'schedule',     icon: '📅', label: 'البرنامج الزمني',     modalId: 'scheduleFormModal',      openFn: 'openScheduleFormModal',     closeFn: 'closeScheduleFormModal' },
    ];

    const LS_PIN = 'unifiedAdd_pinned';
    let pinned = localStorage.getItem(LS_PIN) === '1';
    let activeTabId = null;
    /* يحفظ مرجع shell الأصلي ووالده الأصلي لكل تبويب بعد أول mount */
    const mountState = {}; // { tabId: { shell, originalParent, originalNextSibling, originalModal } }

    /* ───────── حقن CSS ───────── */
    function injectStyle() {
        if (document.getElementById('uaddStyle')) return;
        const s = document.createElement('style');
        s.id = 'uaddStyle';
        s.textContent = `
        #uaddModal{position:fixed;inset:0;z-index:65500;display:none;background:rgba(5,8,16,0.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:'Cairo','Tajawal',sans-serif;direction:rtl;}
        #uaddModal.open{display:flex;align-items:center;justify-content:center;padding:20px;}
        #uaddShell{position:relative;width:min(1180px,98vw);height:min(880px,94vh);background:linear-gradient(180deg,#10101a 0%,#1a1626 100%);border:1px solid rgba(255,255,255,0.08);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,0.7);display:flex;flex-direction:row;overflow:hidden;}
        /* Sidebar */
        #uaddSide{flex-shrink:0;width:64px;background:linear-gradient(180deg,#0a0a14 0%,#15101f 100%);border-inline-start:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;transition:width .22s ease;}
        #uaddShell.expanded #uaddSide{width:240px;}
        #uaddSideHdr{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(255,255,255,0.05);gap:8px;}
        #uaddPinBtn{flex-shrink:0;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.7);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:all .18s;}
        #uaddPinBtn:hover{background:rgba(245,200,66,0.15);color:#f5c842;border-color:rgba(245,200,66,0.35);}
        #uaddPinBtn.pinned{background:rgba(245,200,66,0.22);color:#f5c842;border-color:rgba(245,200,66,0.55);}
        #uaddSideTitle{font-size:13px;font-weight:900;color:#fff;white-space:nowrap;opacity:0;transition:opacity .15s .05s;pointer-events:none;}
        #uaddShell.expanded #uaddSideTitle{opacity:1;}
        #uaddSideList{flex:1;overflow-y:auto;padding:10px 8px;display:flex;flex-direction:column;gap:4px;}
        .uaddTab{display:flex;align-items:center;gap:12px;padding:10px 11px;border-radius:10px;cursor:pointer;color:rgba(255,255,255,0.72);font-size:13px;font-weight:700;border:1px solid transparent;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;overflow:hidden;}
        .uaddTab:hover{background:rgba(255,255,255,0.05);color:#fff;}
        .uaddTab.active{background:linear-gradient(135deg,rgba(106,45,145,0.35),rgba(139,68,184,0.25));color:#fff;border-color:rgba(180,127,212,0.45);box-shadow:0 4px 14px rgba(106,45,145,0.25);}
        .uaddTab .ic{flex-shrink:0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:18px;}
        .uaddTab .lbl{opacity:0;transform:translateX(-4px);transition:opacity .15s .04s,transform .18s;pointer-events:none;flex:1;text-align:start;}
        #uaddShell.expanded .uaddTab .lbl{opacity:1;transform:translateX(0);pointer-events:auto;}
        /* Content */
        #uaddMain{flex:1;display:flex;flex-direction:column;min-width:0;background:#0f0e1a;}
        #uaddMainHdr{height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(255,255,255,0.06);background:linear-gradient(135deg,#1a0a2e 0%,#3d1060 100%);}
        #uaddCrumb{display:flex;align-items:center;gap:10px;color:#fff;font-weight:800;font-size:14px;}
        #uaddCrumb .ic{font-size:18px;}
        #uaddClose{width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;font-size:16px;font-weight:900;}
        #uaddClose:hover{background:rgba(244,67,54,0.25);border-color:rgba(244,67,54,0.5);}
        #uaddBody{flex:1;min-height:0;overflow:hidden;position:relative;background:#0f0e1a;}
        .uaddPanel{position:absolute;inset:0;display:none;overflow:auto;}
        .uaddPanel.active{display:block;}
        /* داخل panel: نخفي أي overlay داخلي تابع للمودال الأصلي + نلغي position:fixed لو موجود */
        .uaddPanel .bd-modal-overlay{display:none !important;}
        .uaddPanel > .dark-modal-shell,
        .uaddPanel > div[style*="position:relative"]{position:relative !important;inset:auto !important;width:100% !important;height:100% !important;max-width:none !important;max-height:none !important;border-radius:0 !important;box-shadow:none !important;border:none !important;display:flex !important;flex-direction:column !important;}
        /* إخفاء المودالات الأصلية تماماً أثناء فتح الموحّد */
        body.uadd-open #equipmentFormModal,
        body.uadd-open #companyCashflowModal,
        body.uadd-open #contractorCashflowModal,
        body.uadd-open #targetFormModal,
        body.uadd-open #boqFormModal,
        body.uadd-open #scheduleFormModal{display:none !important;}
        /* Mobile */
        @media (max-width:768px){
            #uaddModal.open{padding:0;}
            #uaddShell{width:100vw;height:100vh;border-radius:0;border:none;}
            #uaddSide{width:56px;}
            #uaddShell.expanded #uaddSide{width:220px;position:absolute;inset:0 0 0 auto;z-index:5;box-shadow:-8px 0 24px rgba(0,0,0,0.5);}
        }
        `;
        document.head.appendChild(s);
    }

    /* ───────── بناء shell ───────── */
    function buildShell() {
        if (document.getElementById('uaddModal')) return;
        const modal = document.createElement('div');
        modal.id = 'uaddModal';
        modal.innerHTML = `
            <div id="uaddShell" class="${pinned ? 'expanded pinned' : ''}">
                <aside id="uaddSide">
                    <div id="uaddSideHdr">
                        <button id="uaddPinBtn" class="${pinned ? 'pinned' : ''}" title="تثبيت/إلغاء التثبيت">📌</button>
                        <span id="uaddSideTitle">إضافة</span>
                    </div>
                    <div id="uaddSideList"></div>
                </aside>
                <section id="uaddMain">
                    <div id="uaddMainHdr">
                        <div id="uaddCrumb"><span class="ic">＋</span><span id="uaddCrumbText">اختر بنداً</span></div>
                        <button id="uaddClose" title="إغلاق">✕</button>
                    </div>
                    <div id="uaddBody"></div>
                </section>
            </div>
        `;
        document.body.appendChild(modal);

        // إنشاء أزرار التبويبات و panels
        const sideList = modal.querySelector('#uaddSideList');
        const body     = modal.querySelector('#uaddBody');
        TABS.forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'uaddTab';
            btn.dataset.tab = t.id;
            btn.innerHTML = `<span class="ic">${t.icon}</span><span class="lbl">${t.label}</span>`;
            btn.onclick = () => activateTab(t.id);
            sideList.appendChild(btn);

            const panel = document.createElement('div');
            panel.className = 'uaddPanel';
            panel.id = 'uaddPanel_' + t.id;
            body.appendChild(panel);
        });

        // أحداث shell
        const shell = modal.querySelector('#uaddShell');
        const side  = modal.querySelector('#uaddSide');
        side.addEventListener('mouseenter', () => { if (!pinned) shell.classList.add('expanded'); });
        side.addEventListener('mouseleave', () => { if (!pinned) shell.classList.remove('expanded'); });

        modal.querySelector('#uaddPinBtn').onclick = togglePin;
        modal.querySelector('#uaddClose').onclick  = closeUnified;
        // إغلاق بالضغط خارج shell
        modal.addEventListener('click', (e) => { if (e.target === modal) closeUnified(); });
        // ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('open')) closeUnified();
        });
    }

    function togglePin() {
        pinned = !pinned;
        localStorage.setItem(LS_PIN, pinned ? '1' : '0');
        const shell = document.getElementById('uaddShell');
        const btn   = document.getElementById('uaddPinBtn');
        if (pinned) { shell.classList.add('expanded', 'pinned'); btn.classList.add('pinned'); }
        else        { shell.classList.remove('expanded', 'pinned'); btn.classList.remove('pinned'); }
    }

    /* ───────── العثور على shell الأصلي داخل modal أصلي ───────── */
    function findOriginalShell(originalModal) {
        if (!originalModal) return null;
        // نختار أول child ليس overlay وليس نص فارغ
        const children = Array.from(originalModal.children);
        // overlay عادةً .bd-modal-overlay أو div بـ onclick + position:fixed
        let shell = children.find(c =>
            c.nodeType === 1 &&
            !c.classList.contains('bd-modal-overlay') &&
            !(c.tagName === 'DIV' && c.getAttribute('style') && /background:rgba\(0,0,0/.test(c.getAttribute('style')) && c.children.length === 0)
        );
        // fallback: آخر child
        if (!shell) shell = children[children.length - 1];
        return shell || null;
    }

    /* ───────── تفعيل تبويب ───────── */
    async function activateTab(tabId) {
        const cfg = TABS.find(t => t.id === tabId);
        if (!cfg) return;

        // تحديث UI الجانبي والـ crumb
        document.querySelectorAll('#uaddSideList .uaddTab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tabId);
        });
        document.querySelectorAll('#uaddBody .uaddPanel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('uaddPanel_' + tabId);
        if (panel) panel.classList.add('active');
        const crumb = document.getElementById('uaddCrumbText');
        if (crumb) crumb.innerHTML = `<span style="opacity:.6">إضافة › </span>${cfg.icon} ${cfg.label}`;
        activeTabId = tabId;

        // إن كان مُركَّباً مسبقاً، نُعيد shell إلى مكانه الأصلي قبل إعادة استدعاء openFn
        // (حتى يجد الـ DOM المتوقَّع) ثم نُعيد نقله إلى panel.
        const st = mountState[tabId];
        if (st && st.shell && st.shell.parentNode === panel) {
            // إعادة الـ shell للأصل مؤقتاً
            if (st.originalNextSibling && st.originalNextSibling.parentNode === st.originalParent) {
                st.originalParent.insertBefore(st.shell, st.originalNextSibling);
            } else {
                st.originalParent.appendChild(st.shell);
            }
        }

        // استدعاء دالة الفتح الأصلية
        const opener = window[cfg.openFn];
        if (typeof opener === 'function') {
            try { const r = opener(); if (r && typeof r.then === 'function') await r; }
            catch (err) { console.error('[unified_add] openFn error:', cfg.openFn, err); }
        } else {
            console.warn('[unified_add] missing opener:', cfg.openFn);
        }

        // الآن نقل shell من المودال الأصلي إلى panel
        const originalModal = document.getElementById(cfg.modalId);
        if (originalModal) {
            const shell = findOriginalShell(originalModal);
            if (shell) {
                if (!mountState[tabId]) {
                    mountState[tabId] = {
                        shell,
                        originalParent: originalModal,
                        originalNextSibling: shell.nextSibling,
                        originalModal,
                    };
                }
                panel.appendChild(shell);
            }
        }
    }

    /* ───────── فتح/إغلاق الشاشة الموحّدة ───────── */
    window.openUnifiedAdd = function (tabId) {
        injectStyle();
        buildShell();
        const modal = document.getElementById('uaddModal');
        modal.classList.add('open');
        document.body.classList.add('uadd-open');
        document.body.style.overflow = 'hidden';
        activateTab(tabId || (activeTabId || TABS[0].id));
    };

    function closeUnified() {
        const modal = document.getElementById('uaddModal');
        if (!modal) return;

        // إعادة كل shell مُركَّب إلى مكانه الأصلي (حتى يعمل أي close أصلي)
        Object.entries(mountState).forEach(([tabId, st]) => {
            if (st && st.shell && st.originalParent) {
                if (st.originalNextSibling && st.originalNextSibling.parentNode === st.originalParent) {
                    st.originalParent.insertBefore(st.shell, st.originalNextSibling);
                } else {
                    st.originalParent.appendChild(st.shell);
                }
            }
            // استدعاء close الأصلي (اختياري — تنظيف داخلي)
            const cfg = TABS.find(t => t.id === tabId);
            const closer = cfg && window[cfg.closeFn];
            if (typeof closer === 'function') {
                try { closer(); } catch (e) { /* ignore */ }
            }
        });

        modal.classList.remove('open');
        document.body.classList.remove('uadd-open');
        document.body.style.overflow = '';
    }
    window.closeUnifiedAdd = closeUnified;

    /* ───────── تهيئة عند تحميل DOM ───────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { injectStyle(); buildShell(); });
    } else {
        injectStyle(); buildShell();
    }
})();
