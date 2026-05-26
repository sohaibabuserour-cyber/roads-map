// ====================================================
// UI / THEMES / NOTIFICATIONS / DEFAULTS
// ====================================================

function applyTheme(name) {
    document.body.classList.remove('theme-ocean','theme-dark','theme-emerald','theme-sunset');
    if (name) document.body.classList.add('theme-' + name);
    localStorage.setItem('mapTheme', name);
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === name);
    });
    if (map) {
        map.eachLayer(l => { if (l._url) map.removeLayer(l); });
        const tileUrl = name === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    }
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

async function writeUserToSheet(payload) {
    if (!APPS_SCRIPT_URL) return false;
    try {
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

async function loadDefaultCoords() {
    const dc = localStorage.getItem('defaultCoords');
    if (dc) {
        try {
            defaultCoords = JSON.parse(dc);
            if (map) map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
        } catch(e) {}
    }
    const dsn = localStorage.getItem('defaultSubNumber');
    if (dsn !== null && !defaultSubNumber) defaultSubNumber = dsn;
}

function syncCoordsInputs() {
    const sl = document.getElementById("settingsLat"); if(sl) sl.value = defaultCoords.lat;
    const sg = document.getElementById("settingsLng"); if(sg) sg.value = defaultCoords.lng;
    const sz = document.getElementById("settingsZoom"); if(sz) sz.value = defaultCoords.zoom;
}

function renderDefaultSubPreview() {
    const inp     = document.getElementById("settingsDefaultSub");
    const preview = document.getElementById("settingsDefaultSubPreview");
    if (!inp || !preview) return;
    inp.value = defaultSubNumber || "";
    if (!defaultSubNumber) { preview.style.display = "none"; return; }
    const found = categories.flatMap(c => c.subitems).find(s => (s.number || "").trim() === defaultSubNumber);
    if (found) {
        const cat = categories.find(c => c.subitems.some(s => s.id === found.id));
        preview.textContent = "✔ " + (cat ? cat.name + " ← " : "") + found.name;
        preview.style.display = "block";
        preview.style.color = "var(--green)";
    } else {
        preview.textContent = "⚠ رقم البند غير موجود في البنود الحالية";
        preview.style.display = "block";
        preview.style.color = "var(--orange)";
    }
}

function saveSettingsCoords() {
    const lat  = parseFloat(document.getElementById("settingsLat").value);
    const lng  = parseFloat(document.getElementById("settingsLng").value);
    const zoom = parseInt(document.getElementById("settingsZoom").value);
    if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) { showAlert("❌ أدخل إحداثيات صحيحة"); return; }
    defaultCoords = { lat, lng, zoom };
    localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
    if (map) map.setView([lat, lng], zoom);
    syncCoordsInputs();
    showAlert("✅ تم حفظ الإحداثيات الافتراضية", "success");
}

function saveSettingsDefaultSub() {
    const num = document.getElementById("settingsDefaultSub").value.trim();
    const found = categories.flatMap(c => c.subitems).find(s => (s.number || "").trim() === num);
    if (num && !found) {
        showAlert("❌ رقم البند غير موجود — تأكد من الرقم");
        return;
    }
    defaultSubNumber = num;
    localStorage.setItem('defaultSubNumber', num);
    renderDefaultSubPreview();
    showAlert(num ? "✅ تم حفظ البند الافتراضي: " + (found ? found.name : num) : "✅ تم مسح البند الافتراضي", "success");
}

async function loadNotifications() {
    const NOTIFICATIONS_SHEET_ID = "1AV4umnW_s_bUOIrLBQouCsoAmPJI4yV3aOfPhKfM9C8";
    const badge = document.getElementById("notifBadge");
    const list  = document.getElementById("notifList");

    list.innerHTML = '<div class="notif-empty">جاري التحميل...</div>';

    try {
        const url = `https://docs.google.com/spreadsheets/d/${NOTIFICATIONS_SHEET_ID}/export?format=csv&gid=0`;
        const r   = await fetch(url, { redirect: "follow" });
        const csv = await r.text();

        if (csv.trim().startsWith('<') || csv.includes('accounts.google.com')) {
            list.innerHTML = '<div class="notif-empty">⚠️ الشيت يحتاج إعداد المشاركة العامة</div>';
            badge.style.display = 'none';
            return;
        }

        const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
        const items = lines.map(line => {
            if (line.startsWith('"')) {
                const end = line.indexOf('"', 1);
                return line.slice(1, end === -1 ? undefined : end).trim();
            }
            return line.split(',')[0].trim();
        }).filter(v => v);

        if (!items.length) {
            list.innerHTML = '<div class="notif-empty">لا توجد إشعارات</div>';
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'flex';
        badge.textContent = items.length;
        list.innerHTML = items.map(text => `
            <div class="notif-item">
                <div class="notif-item-title">${text}</div>
            </div>`).join('');

    } catch(e) {
        console.warn("Notifications load failed:", e);
        list.innerHTML = '<div class="notif-empty">تعذر تحميل الإشعارات</div>';
        badge.style.display = 'none';
    }
}

function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach((t, i) => {
        const tabs = ['coords', 'default', 'similar', 'eqtypes'];
        t.classList.toggle('active', tabs[i] === tab);
    });
    document.getElementById('settingsTabCoords').classList.toggle('active', tab === 'coords');
    document.getElementById('settingsTabDefault').classList.toggle('active', tab === 'default');
    document.getElementById('settingsTabSimilar').classList.toggle('active', tab === 'similar');
    document.getElementById('settingsTabEqtypes').classList.toggle('active', tab === 'eqtypes');
    if (tab === 'similar' && window.renderSimilarGroupsList) window.renderSimilarGroupsList();
    if (tab === 'default') renderDefaultSubPreview();
    if (tab === 'eqtypes') {
        if (window.renderEquipmentTypesList) window.renderEquipmentTypesList();
        if (window.updateEqTypesCount) window.updateEqTypesCount();
    }
}

function toggleReportsDropdown(e) {
    e.stopPropagation();
    const dd  = document.getElementById('reportsDropdown');
    const tab = document.getElementById('navTabReports');
    const isOpen = dd.style.display === 'flex';
    document.querySelectorAll('.tab-sub-dropdown').forEach(d => d.style.display = 'none');
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown,.contractor-panel,.settings-panel').forEach(p => p.classList.remove('active'));
    if (!isOpen) {
        const rect = tab.getBoundingClientRect();
        dd.style.left  = rect.left + 'px';
        dd.style.right = 'auto';
        dd.style.display = 'flex';
        tab.classList.add('active');
    } else {
        tab.classList.remove('active');
    }
}

function closeReportsDropdown() {
    const dd  = document.getElementById('reportsDropdown');
    const tab = document.getElementById('navTabReports');
    if (dd) dd.style.display = 'none';
    if (tab) tab.classList.remove('active');
}

function toggleAddDropdown(e) {
    e.stopPropagation();
    const dd  = document.getElementById('addDropdown');
    const tab = document.getElementById('navTabAdd');
    const isOpen = dd.style.display === 'flex';
    document.querySelectorAll('.tab-sub-dropdown').forEach(d => d.style.display = 'none');
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown,.contractor-panel,.settings-panel').forEach(p => p.classList.remove('active'));
    if (!isOpen) {
        const rect = tab.getBoundingClientRect();
        dd.style.left  = rect.left + 'px';
        dd.style.right = 'auto';
        dd.style.display = 'flex';
        tab.classList.add('active');
    } else {
        tab.classList.remove('active');
    }
}

function closeAddDropdown() {
    const dd  = document.getElementById('addDropdown');
    const tab = document.getElementById('navTabAdd');
    if (dd) dd.style.display = 'none';
    if (tab) tab.classList.remove('active');
}