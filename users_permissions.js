/* ============================================================
   users_permissions.js
   ── إدارة المستخدمين والصلاحيات ──
   • يضيف تبويب "المستخدمون والصلاحيات" داخل نافذة الإعدادات
   • يقرأ المستخدمين من شيت المستخدمين (USERS_SHEET_ID المُعرَّف في
     روابط الشيتات داخل الإعدادات)
   • يكتب / يحدِّث / يحذف المستخدم عبر APPS_SCRIPT_URL (config.js)
   • يقيِّد رؤية أزرار شريط المهام لكل مستخدم وفق صلاحياته

   متطلَّبات Apps Script (يجب أن يدعمها سكريبت writeUserToSheet):
     POST { action:"registerUser", email, name, password, role, permissions }
     POST { action:"updateUser",   email, name?, password?, role?,
            permissions?, photo? }
     POST { action:"deleteUser",   email }

   الترتيب في index.html (آخر سكريبت):
       <script src="addtarget.js"></script>
       <script src="users_permissions.js"></script>
   ============================================================ */

/* ====================================================
   1. كاتالوج الصلاحيات — يطابق أزرار شريط المهام
   ==================================================== */

const UP_PERMISSIONS = [
    // التقارير
    { key: 'reports.bills',         label: '📊 داشبورد البنود',          group: 'التقارير',
      selectors: ['[onclick*="openBillsModal"]'] },
    { key: 'reports.cashflow',      label: '💰 التدفقات النقدية',         group: 'التقارير',
      selectors: ['[onclick*="openCashflowModal"]'] },
    { key: 'reports.equipment',     label: '🚜 المعدات (تقرير)',          group: 'التقارير',
      selectors: ['[onclick*="openEquipmentModal"]'] },

    // الإضافة
    { key: 'add.equipment',         label: '🚜 تسجيل كمية المعدات',       group: 'الإضافة',
      selectors: ['[onclick*="openEquipmentFormModal"]'] },
    { key: 'add.cfCompany',         label: '🏢 تدفق نقدي - الشركة',       group: 'الإضافة',
      selectors: ['[onclick*="openCompanyCashflowForm"]'] },
    { key: 'add.cfContractors',     label: '👷 تدفق نقدي - المقاولون',    group: 'الإضافة',
      selectors: ['[onclick*="openContractorCashflowForm"]'] },
    { key: 'add.target',            label: '🎯 المستهدف الشهري',          group: 'الإضافة',
      selectors: ['[onclick*="openTargetFormTab"]'] },
    { key: 'add.boq',               label: '📋 جدول الكميات',             group: 'الإضافة',
      selectors: ['[onclick*="openBOQFormModal"]'] },
    { key: 'add.schedule',          label: '📅 البرنامج الزمني',          group: 'الإضافة',
      selectors: ['[onclick*="openScheduleFormModal"]'] },

    // الأدوات
    { key: 'tools.groups',          label: '🔗 مجموعات البنود',           group: 'الأدوات',
      selectors: ['#navTabGroups', '#mmGroupsRow'] },
    { key: 'tools.contractors',     label: '👷 لوحة المقاولين',            group: 'الأدوات',
      selectors: ['#contractorBtn', '[onclick*="openPanelFromMobile(\'contractorPanel\')"]'] },
    { key: 'tools.notifications',   label: '🔔 الإشعارات',                group: 'الأدوات',
      selectors: ['#notifBtn', '[onclick*="openPanelFromMobile(\'notifPanel\')"]'] },
    { key: 'tools.theme',           label: '🎨 الثيمات',                  group: 'الأدوات',
      selectors: ['#themeBtn', '[onclick*="openPanelFromMobile(\'themePanel\')"]'] },
];

/* ====================================================
   2. تطبيق الصلاحيات على واجهة المستخدم
   ==================================================== */

function applyUserPermissions() {
    if (!currentUser) return;

    // إعادة إظهار كل العناصر (حالة إعادة التطبيق بعد تحديث)
    UP_PERMISSIONS.forEach(p => {
        p.selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.display = '';
                const wrap = el.closest('[title]');
                if (wrap && wrap !== el) wrap.style.display = '';
            });
        });
    });

    // المسؤول يرى كل شيء
    if (currentUser.isAdmin) return;

    const perms = new Set(currentUser.permissions || []);

    UP_PERMISSIONS.forEach(p => {
        if (perms.has(p.key)) return;
        p.selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.display = 'none';
                // إخفاء حاوية الأيقونة (التي تحتوي على title)
                const wrap = el.closest('[title]');
                if (wrap && wrap !== el && wrap.children.length === 1) {
                    wrap.style.display = 'none';
                }
            });
        });
    });

    // إخفاء التبويبات الأم (التقارير/الإضافة) إذا كانت كل عناصرها مخفية
    ['navTabReports', 'navTabAdd'].forEach(id => {
        const tab = document.getElementById(id);
        if (!tab) return;
        const items = tab.querySelectorAll('.tab-sub-item');
        const visible = Array.from(items).some(i => i.style.display !== 'none');
        tab.style.display = visible ? '' : 'none';
    });
}

window.applyUserPermissions = applyUserPermissions;

/* ====================================================
   3. حالة التبويب
   ==================================================== */

let upUsers          = [];      // كل المستخدمين المحمَّلون من الشيت
let upEditingEmail   = null;    // البريد الذي يجري تعديله، أو null للإضافة

/* ====================================================
   4. تحميل المستخدمين
   ==================================================== */

async function upLoadUsers() {
    const list = document.getElementById('upUsersList');
    if (list) list.innerHTML = '<div style="text-align:center;color:var(--modal-text-muted);font-size:11px;padding:18px 0;">جاري التحميل...</div>';

    try {
        upUsers = await fetchUsers();
    } catch (e) {
        console.error(e);
        upUsers = [];
        if (list) list.innerHTML = '<div style="text-align:center;color:#ef9a9a;font-size:11px;padding:18px 0;">❌ تعذَّر تحميل المستخدمين — تأكَّد من إعداد شيت المستخدمين</div>';
        return;
    }
    upRenderUsersList();
}

/* ====================================================
   5. عرض قائمة المستخدمين
   ==================================================== */

function upRenderUsersList() {
    const list = document.getElementById('upUsersList');
    if (!list) return;

    if (!upUsers.length) {
        list.innerHTML = '<div style="text-align:center;color:var(--modal-text-muted);font-size:11px;padding:18px 0;">لا يوجد مستخدمون</div>';
        return;
    }

    list.innerHTML = upUsers.map(u => {
        const email   = u["EMAIL"] || '';
        const name    = u["NAME"]  || '(بدون اسم)';
        const role    = (u["ROLE"] || '').toString().trim();
        const isAdmin = role === '1';
        const permsRaw = u["PERMISSIONS"] || u["PERMS"] || '';
        const permsCount = isAdmin ? UP_PERMISSIONS.length
                                   : (permsRaw ? String(permsRaw).split(/[,;|]/).filter(Boolean).length : 0);
        const safeEmail = email.replace(/'/g, "\\'");

        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:9px;margin-bottom:6px;">
            <div style="flex:1;min-width:0;text-align:right;">
                <div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.95);font-family:'Cairo',sans-serif;">
                    ${name}
                    ${isAdmin ? '<span style="margin-right:6px;background:rgba(245,200,66,0.18);border:1px solid rgba(245,200,66,0.4);color:#f5c842;font-size:9px;padding:1px 6px;border-radius:8px;">مدير</span>'
                              : `<span style="margin-right:6px;background:rgba(33,150,243,0.15);border:1px solid rgba(33,150,243,0.35);color:#90caf9;font-size:9px;padding:1px 6px;border-radius:8px;">${permsCount} صلاحية</span>`}
                </div>
                <div style="font-size:10px;color:rgba(255,255,255,0.5);font-family:monospace;direction:ltr;text-align:right;margin-top:2px;">${email}</div>
            </div>
            <button onclick="upEditUser('${safeEmail}')" title="تعديل"
                style="background:rgba(33,150,243,0.12);border:1px solid rgba(33,150,243,0.35);color:#90caf9;width:28px;height:28px;border-radius:7px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✏️</button>
            <button onclick="upDeleteUser('${safeEmail}')" title="حذف"
                style="background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);color:#ef9a9a;width:28px;height:28px;border-radius:7px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">🗑</button>
        </div>`;
    }).join('');
}

/* ====================================================
   6. نموذج الإضافة / التعديل
   ==================================================== */

function upRenderPermsCheckboxes(selected) {
    const container = document.getElementById('upPermsList');
    if (!container) return;

    const sel = new Set(selected || []);
    const groups = {};
    UP_PERMISSIONS.forEach(p => {
        if (!groups[p.group]) groups[p.group] = [];
        groups[p.group].push(p);
    });

    container.innerHTML = Object.entries(groups).map(([gname, items]) => `
        <div style="grid-column:1 / -1;font-size:10px;font-weight:900;color:rgba(255,255,255,0.45);letter-spacing:.5px;padding:6px 2px 2px;margin-top:4px;font-family:'Cairo',sans-serif;border-bottom:1px solid rgba(255,255,255,0.05);">
            ── ${gname} ──
        </div>
        ${items.map(p => `
            <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:6px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:11px;color:rgba(255,255,255,0.85);">
                <input type="checkbox" class="up-perm-cb" data-perm-key="${p.key}" ${sel.has(p.key) ? 'checked' : ''} style="cursor:pointer;accent-color:#2196f3;">
                <span style="flex:1;text-align:right;">${p.label}</span>
            </label>
        `).join('')}
    `).join('');
}

function upGetSelectedPerms() {
    return Array.from(document.querySelectorAll('.up-perm-cb'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.permKey);
}

function upTogglePerms(checked) {
    document.querySelectorAll('.up-perm-cb').forEach(cb => { cb.checked = checked; });
}

function upResetForm() {
    upEditingEmail = null;
    document.getElementById('upFormTitle').textContent  = '➕ إضافة مستخدم جديد';
    document.getElementById('upCancelEditBtn').style.display = 'none';
    document.getElementById('upSaveBtn').textContent     = '💾 حفظ المستخدم';
    document.getElementById('upName').value     = '';
    document.getElementById('upEmail').value    = '';
    document.getElementById('upEmail').disabled = false;
    document.getElementById('upPassword').value = '';
    document.getElementById('upPassword').placeholder = '••••••';
    document.getElementById('upRole').value     = '2';
    upRenderPermsCheckboxes([]);
    const fb = document.getElementById('upFormFeedback');
    if (fb) fb.style.display = 'none';
}

function upCancelEdit() {
    upResetForm();
}

function upEditUser(email) {
    const user = upUsers.find(u => (u["EMAIL"] || '').toLowerCase() === email.toLowerCase());
    if (!user) return;

    upEditingEmail = user["EMAIL"];
    document.getElementById('upFormTitle').textContent  = '✏️ تعديل: ' + user["EMAIL"];
    document.getElementById('upCancelEditBtn').style.display = 'inline-block';
    document.getElementById('upSaveBtn').textContent     = '💾 تحديث المستخدم';

    document.getElementById('upName').value     = user["NAME"]  || '';
    document.getElementById('upEmail').value    = user["EMAIL"] || '';
    document.getElementById('upEmail').disabled = true;
    document.getElementById('upPassword').value = '';
    document.getElementById('upPassword').placeholder = 'اتركها فارغة لعدم التغيير';
    document.getElementById('upRole').value     = (user["ROLE"] || '').toString().trim() === '1' ? '1' : '2';

    const perms = parsePermissionsField(user["PERMISSIONS"] || user["PERMS"] || '');
    upRenderPermsCheckboxes(perms);

    // التمرير لأعلى النموذج
    document.getElementById('upName').focus();
}

/* ====================================================
   7. حفظ / حذف
   ==================================================== */

function _upFeedback(msg, ok) {
    const fb = document.getElementById('upFormFeedback');
    if (!fb) return;
    fb.style.display = 'block';
    fb.textContent   = msg;
    fb.style.background = ok ? 'rgba(58,170,92,0.12)' : 'rgba(244,67,54,0.12)';
    fb.style.border     = ok ? '1px solid rgba(58,170,92,0.4)' : '1px solid rgba(244,67,54,0.4)';
    fb.style.color      = ok ? '#5cc890' : '#ef9a9a';
    setTimeout(() => { fb.style.display = 'none'; }, 4500);
}

async function upSaveUser() {
    const name     = document.getElementById('upName').value.trim();
    const email    = document.getElementById('upEmail').value.trim().toLowerCase();
    const password = document.getElementById('upPassword').value;
    const role     = document.getElementById('upRole').value || '2';
    const perms    = upGetSelectedPerms();

    if (!name)  { _upFeedback('❌ أدخل اسم المستخدم', false); return; }
    if (!email) { _upFeedback('❌ أدخل البريد الإلكتروني', false); return; }
    if (!upEditingEmail && !password) { _upFeedback('❌ أدخل كلمة المرور', false); return; }

    const isEdit = !!upEditingEmail;
    const action = isEdit ? 'updateUser' : 'registerUser';

    const payload = {
        action: action,
        email: isEdit ? upEditingEmail : email,
        name : name,
        role : role,
        permissions: perms.join(',')
    };
    if (password) payload.password = password;

    _upFeedback('⏳ جاري الحفظ...', true);

    const ok = await writeUserToSheet(payload);

    if (ok) {
        _upFeedback(isEdit ? '✅ تم تحديث المستخدم في الشيت' : '✅ تم إضافة المستخدم في الشيت', true);
        // تحديث المخزون المحلي ثم إعادة العرض
        await upLoadUsers();
        upResetForm();
    } else {
        _upFeedback('⚠️ تعذَّر الحفظ في الشيت — تأكَّد من دعم Apps Script للعملية: ' + action, false);
    }
}

async function upDeleteUser(email) {
    if (!email) return;
    if (!confirm('حذف المستخدم: ' + email + ' ؟')) return;

    const ok = await writeUserToSheet({ action: 'deleteUser', email: email });

    if (ok) {
        showAlert('✅ تم حذف المستخدم', 'success');
        await upLoadUsers();
        if (upEditingEmail && upEditingEmail.toLowerCase() === email.toLowerCase()) upResetForm();
    } else {
        showAlert('⚠️ تعذَّر الحذف — تأكَّد من دعم Apps Script لعملية deleteUser');
    }
}

/* ====================================================
   8. تهيئة التبويب — يُستدعى من switchSettingsTab('users')
   ==================================================== */

function upInit() {
    upResetForm();
    upLoadUsers();
}

// إتاحة الدوال على نطاق window لاستخدام onclick في HTML
window.upLoadUsers   = upLoadUsers;
window.upEditUser    = upEditUser;
window.upDeleteUser  = upDeleteUser;
window.upSaveUser    = upSaveUser;
window.upCancelEdit  = upCancelEdit;
window.upTogglePerms = upTogglePerms;
window.upInit        = upInit;
