/* ============================================================
   auth.js
   المصادقة والجلسة — مُستخرَج من main.js

   الترتيب في index.html (بعد map.js وقبل main.js):
       <script src="map.js"></script>
       <script src="auth.js"></script>
       <script src="main.js"></script>

   المتغيرات والدوال التي يعتمد عليها من ملفات أخرى:
       INACTIVITY_MS, USERS_SHEET_ID, APPS_SCRIPT_URL — config.js
       parseCSVLine — utils.js
       showAlert — main.js
       allLayers, allData, allFeatures, map, initMap, loadLayer — map.js
       defaultCoords, defaultSubNumber, categories, selectedItems,
       selectedStatuses, initMap, loadCategoriesConfig, loadDefaultCoords,
       loadSimilarGroups, renderItems, renderNavTabs, loadNotifications — main.js
       updateStats — stats.js
   ============================================================ */

var currentUser = null;
let inactivityTimer = null;

/* ====================================================
   INACTIVITY SESSION
   ==================================================== */

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (currentUser) {
            showAlert("⏰ انتهت جلستك بسبب عدم النشاط", "error");
            setTimeout(doLogout, 2000);
        }
    }, INACTIVITY_MS);
}

function initInactivityWatcher() {
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev => {
        document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
}

/* ====================================================
   SESSION PERSISTENCE
   ==================================================== */

function saveSession(user) {
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("sessionTime", Date.now().toString());
}

function clearSession() {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("sessionTime");
    sessionStorage.removeItem("selectedStatuses");
    sessionStorage.removeItem("selectedItems");
}

async function tryRestoreSession() {
    const saved     = sessionStorage.getItem("currentUser");
    const savedTime = sessionStorage.getItem("sessionTime");
    if (!saved || !savedTime) return false;
    if (Date.now() - parseInt(savedTime) > INACTIVITY_MS) {
        clearSession();
        return false;
    }
    currentUser = JSON.parse(saved);
    return true;
}

/* ====================================================
   LOGIN
   ==================================================== */

async function fetchUsers() {
    const id  = (window.sheetIdsConfig && window.sheetIdsConfig['USERS_SHEET_ID']) || USERS_SHEET_ID;
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;
    const r   = await fetch(url);
    const csv = await r.text();
    const lines   = csv.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());
    const users   = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const obj  = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
        users.push(obj);
    }
    return users;
}

function showLoginError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
}

async function doLogin() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pass  = document.getElementById("loginPassword").value.trim();

    if (!email || !pass) { showLoginError("يرجى إدخال البريد وكلمة المرور"); return; }

    document.getElementById("loginLoading").style.display = "block";
    document.getElementById("loginError").style.display   = "none";
    document.getElementById("loginBtn").disabled = true;

    try {
        const users = await fetchUsers();
        const found = users.find(u =>
            u["EMAIL"] && u["EMAIL"].toLowerCase() === email &&
            u["PASSWORD"] && u["PASSWORD"]          === pass
        );

        if (!found) { showLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة"); return; }

        currentUser = {
            email  : found["EMAIL"],
            name   : found["NAME"]  || found["EMAIL"],
            role   : found["ROLE"]  || "2",
            isAdmin: (found["ROLE"] || "").toString().trim() === "1",
            avatar : found["PHOTO"] || found["AVATAR"] || "",
            permissions: parsePermissionsField(found["PERMISSIONS"] || found["PERMS"] || "")
        };

        saveSession(currentUser);
        enterApp();

    } catch(e) {
        console.error(e);
        showLoginError("خطأ في الاتصال - تأكد من إعدادات الشيت");
    } finally {
        document.getElementById("loginLoading").style.display = "none";
        document.getElementById("loginBtn").disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    ["loginEmail","loginPassword"].forEach(id => {
        document.getElementById(id).addEventListener("keydown", e => {
            if (e.key === "Enter") doLogin();
        });
    });

    const savedTheme = localStorage.getItem('mapTheme') || '';
    if (savedTheme) applyTheme(savedTheme);

    const dc = localStorage.getItem('defaultCoords');
    if (dc) {
        try { defaultCoords = JSON.parse(dc); } catch(e) {}
    }

    const restored = await tryRestoreSession();
    if (restored) enterApp();
});

/* ====================================================
   ENTER / LEAVE APP
   ==================================================== */

async function enterApp() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").classList.add("visible");

    if (currentUser.isAdmin) {
        document.body.classList.add("is-admin");
    } else {
        document.body.classList.remove("is-admin");
    }

    updateUserUI();

    (function() {
        const el = document.getElementById('mapDateFilter');
        if (!el) return;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        el.value = _dateToInputVal(d);
    })();

    initMap();
    await loadCategoriesConfig();
    await loadDefaultCoords();
    loadSimilarGroups();

    const savedSel = sessionStorage.getItem("selectedStatuses");
    if (savedSel) selectedStatuses = JSON.parse(savedSel);

    const savedItems = sessionStorage.getItem("selectedItems");
    if (savedItems) selectedItems = JSON.parse(savedItems);

    renderItems();
    renderNavTabs();

    const hasAnySelection = Object.keys(selectedItems).length > 0;
    if (!hasAnySelection && defaultSubNumber) {
        const defaultSub = categories.flatMap(c => c.subitems)
            .find(s => (s.number || "").trim() === defaultSubNumber.trim());
        if (defaultSub) {
            selectedItems[defaultSub.id] = true;
        }
    }

    categories.forEach(cat => {
        cat.subitems.forEach(sub => {
            if (selectedItems[sub.id]) loadLayer(sub.sheetId, sub.name, sub.geoJsonFile, cat.id);
        });
    });

    document.querySelectorAll(".status-checkbox").forEach(cb => {
        cb.checked = selectedStatuses.includes(cb.dataset.status);
    });

    updateStats();
    initInactivityWatcher();
    loadNotifications();
    if (typeof applyUserPermissions === 'function') applyUserPermissions();
}

function parsePermissionsField(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return String(raw).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
}

function updateUserUI() {
    const initial = (currentUser.name || "؟").charAt(0);

    const navAv = document.getElementById("navAvatar");
    navAv.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة">`
        : initial;

    document.getElementById("navUserName").textContent = currentUser.name;

    const udWrap = document.getElementById("udAvatarWrap");
    udWrap.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة"><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`
        : `<span>${initial}</span><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`;

    document.getElementById("udName").textContent    = currentUser.name;
    document.getElementById("udRole").textContent    = currentUser.isAdmin ? "مدير النظام" : "مستخدم";
    document.getElementById("udNameInput").value     = currentUser.name;
    document.getElementById("udPassInput").value     = "";

    if (defaultCoords) {
        const sl = document.getElementById("settingsLat"); if(sl) sl.value = defaultCoords.lat;
        const sg = document.getElementById("settingsLng"); if(sg) sg.value = defaultCoords.lng;
        const sz = document.getElementById("settingsZoom"); if(sz) sz.value = defaultCoords.zoom;
    }
}

function doLogout() {
    clearSession();
    clearTimeout(inactivityTimer);
    currentUser = null;
    Object.values(allLayers).forEach(l => { if (map) map.removeLayer(l); });
    allLayers = {}; allData = {}; allFeatures = {};
    selectedItems = {};
    document.getElementById("mainApp").classList.remove("visible");
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginEmail").value    = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginError").style.display = "none";
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown').forEach(p => p.classList.remove('active'));
}

/* ====================================================
   USER PROFILE
   ==================================================== */

async function writeUserToSheet(payload) {
    if (!APPS_SCRIPT_URL) return false;
    try {
        // أضف الإيميل تلقائياً ليُحدِّد Code.gs الصف الصحيح
        if (!payload.email && currentUser && currentUser.email) {
            payload.email = currentUser.email;
        }
        if (!payload.action) payload.action = "updateUser";

        const r = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload),
            redirect: "follow"
        });
        const text = await r.text();
        return text.trim() === "OK" || r.ok;
    } catch(e) {
        console.warn("Apps Script write failed:", e);
        return false;
    }
}

function triggerAvatarUpload() {
    document.getElementById("avatarFileInput").click();
}

function compressImage(dataUrl, maxWidth = 120) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width  = img.width  * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    });
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        const compressed = await compressImage(ev.target.result, 120);
        currentUser.avatar = compressed;
        updateUserUI();
        saveSession(currentUser);

        showAlert("⏳ جاري حفظ الصورة...", "success");

        const ok = await writeUserToSheet({
            action: "updateUser",
            role: currentUser.role,
            photo: compressed
        });

        if (ok) {
            showAlert("✅ تم حفظ الصورة في الشيت — ستظهر من أي جهاز", "success");
        } else {
            showAlert("✅ الصورة محفوظة في الجلسة الحالية", "success");
        }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
}

async function saveUserProfile() {
    const newName = document.getElementById("udNameInput").value.trim();
    const newPass = document.getElementById("udPassInput").value.trim();

    if (!newName) { showAlert("❌ يرجى إدخال الاسم"); return; }

    currentUser.name = newName;
    saveSession(currentUser);
    updateUserUI();

    showAlert("⏳ جاري الحفظ...", "success");

    const payload = { role: currentUser.role };
    if (newName) payload.name = newName;
    if (newPass) payload.password = newPass;

    const ok = await writeUserToSheet(payload);

    if (ok) {
        showAlert("✅ تم حفظ التغييرات في الشيت", "success");
    } else {
        showAlert("✅ تم حفظ الاسم محلياً — تأكد من إعدادات الـ Apps Script", "success");
    }

    document.getElementById("userDropdown").classList.remove("active");
}
