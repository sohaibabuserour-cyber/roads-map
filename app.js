// ====================================================
// MAIN APPLICATION FLOW
// ====================================================

async function enterApp() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").classList.add("visible");

    if (currentUser.isAdmin) {
        document.body.classList.add("is-admin");
    } else {
        document.body.classList.remove("is-admin");
    }

    updateUserUI();
    initMap();
    loadEquipmentData();

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
    contractorsLoaded = false;
    buildContractorPanel();
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
    if (restored) {
        enterApp();
    }
});

document.querySelectorAll(".status-checkbox").forEach(cb => {
    cb.addEventListener("change", function() {
        const st = this.dataset.status;
        if (this.checked) { if (!selectedStatuses.includes(st)) selectedStatuses.push(st); }
        else              { selectedStatuses = selectedStatuses.filter(s => s !== st); }
        refreshLayerColors();
        updateStats();
    });
});

document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("active"); });
});

document.addEventListener('click', () => { closeReportsDropdown(); closeAddDropdown(); });