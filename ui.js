/* ====================================================
   UI + MODALS + PANELS + THEMES
   ==================================================== */

// Modals
function openModal(id)  {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

// Panels (right menu)
function togglePanel(id) {
    const panel = document.getElementById(id);
    const isOpen = panel.classList.contains("active");

    // Close all panels first
    document.querySelectorAll(
        '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel'
    ).forEach(p => p.classList.remove('active'));

    if (!isOpen) {
        panel.classList.add("active");

        // Settings preload
        if (id === 'settingsPanel') {
            const sl = document.getElementById("settingsLat");
            const sg = document.getElementById("settingsLng");
            const sz = document.getElementById("settingsZoom");
            const sd = document.getElementById("settingsDefaultSub");

            if (sl) sl.value = defaultCoords.lat;
            if (sg) sg.value = defaultCoords.lng;
            if (sz) sz.value = defaultCoords.zoom;
            if (sd) sd.value = defaultSubNumber || "";

            renderDefaultSubPreview();

            if (document.getElementById('eqTypesList')) {
                renderEquipmentTypesList();
                updateEqTypesCount();
            }
        }

        // Contractor group tab refresh
        if (id === 'contractorPanel' && _activeContractorTab === 'group') {
            renderContractorGroupList();
        }
    }
}

// Close panels when clicking outside
document.addEventListener("click", e => {
    if (
        !e.target.closest('.nav-right') &&
        !e.target.closest('#similarGroupModal')
    ) {
        document.querySelectorAll(
            '.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.equipment-panel,.settings-panel'
        ).forEach(p => p.classList.remove('active'));
    }

    if (!e.target.closest('.search-wrap')) {
        const dd = document.getElementById("searchDropdown");
        if (dd) dd.classList.remove("active");
    }
});

/* ====================================================
   THEMES
   ==================================================== */

function applyTheme(name) {
    // Remove all theme classes
    document.body.classList.remove(
        'theme-ocean','theme-dark','theme-emerald','theme-sunset'
    );

    if (name) {
        document.body.classList.add('theme-' + name);
    }

    localStorage.setItem('mapTheme', name);

    // Active marker
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === name);
    });

    // Update map tiles
    if (map) {
        map.eachLayer(l => {
            if (l._url) map.removeLayer(l);
        });

        const tileUrl = name === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        L.tileLayer(tileUrl, {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }
}

/* ====================================================
   USER UI
   ==================================================== */

function updateUserUI() {
    const initial = (currentUser.name || "؟").charAt(0);

    // Navbar avatar
    const navAv = document.getElementById("navAvatar");
    navAv.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة">`
        : initial;

    document.getElementById("navUserName").textContent = currentUser.name;

    // Dropdown avatar
    const udWrap = document.getElementById("udAvatarWrap");
    udWrap.innerHTML = currentUser.avatar
        ? `<img src="${currentUser.avatar}" alt="صورة"><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`
        : `<span>${initial}</span><div class="ud-avatar-overlay" onclick="triggerAvatarUpload()">📷</div>`;

    document.getElementById("udName").textContent = currentUser.name;
    document.getElementById("udRole").textContent =
        currentUser.isAdmin ? "مدير النظام" : "مستخدم";

    document.getElementById("udNameInput").value = currentUser.name;
    document.getElementById("udPassInput").value = "";
}
