/* ====================================================
   CATEGORIES CONFIG
   ==================================================== */

async function loadCategoriesConfig() {
    try {
        const r = await fetch(CONFIG_FILE + "?t=" + Date.now());
        if (!r.ok) throw new Error("not found");

        const data = await r.json();

        categories = Array.isArray(data)
            ? data
            : (data.categories || []);

        // default coordinates
        if (!Array.isArray(data) && data.defaultCoords) {
            defaultCoords = data.defaultCoords;
            localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
        }

        // similar groups
        if (!Array.isArray(data) && data.similarGroups) {
            similarGroups = data.similarGroups;
            localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
        }

        // default subitem
        if (!Array.isArray(data) && data.defaultSubNumber !== undefined) {
            defaultSubNumber = data.defaultSubNumber || "";
            localStorage.setItem('defaultSubNumber', defaultSubNumber);
        }

    } catch(e) {
        console.warn("categories.json not found — starting empty");
        categories = [];
    }

    categories.forEach(c => {
        if (!c.subitems) c.subitems = [];
        if (!c.id) c.id = uid();
    });
}

/* ====================================================
   EXPORT / IMPORT CONFIG
   ==================================================== */

function exportConfig() {
    const payload = JSON.stringify({
        categories,
        defaultCoords,
        similarGroups,
        defaultSubNumber
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "categories.json";
    link.click();

    showAlert("✅ تم تحميل categories.json", "success");
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);

            categories = Array.isArray(data)
                ? data
                : (data.categories || []);

            categories.forEach(c => {
                if (!c.subitems) c.subitems = [];
                if (!c.id) c.id = uid();
            });

            if (!Array.isArray(data)) {

                if (data.defaultCoords) {
                    defaultCoords = data.defaultCoords;
                    localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));

                    if (map) {
                        map.setView(
                            [defaultCoords.lat, defaultCoords.lng],
                            defaultCoords.zoom
                        );
                    }
                }

                if (data.similarGroups) {
                    similarGroups = data.similarGroups;
                    localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
                }

                if (data.defaultSubNumber !== undefined) {
                    defaultSubNumber = data.defaultSubNumber || "";
                    localStorage.setItem('defaultSubNumber', defaultSubNumber);
                }
            }

            renderItems();
            renderNavTabs();
            updateStats();

            showAlert("✅ تم استيراد الإعدادات", "success");

        } catch {
            showAlert("❌ الملف غير صالح", "error");
        }
    };

    reader.readAsText(file);
    e.target.value = "";
}
``