// ====================================================
// SEARCH
// ====================================================

function positionDropdown() {
    const dd  = document.getElementById("searchDropdown");
    const box = document.querySelector(".search-wrap");
    if (!box || !dd.classList.contains("active")) return;
    const r = box.getBoundingClientRect();
    dd.style.top   = r.bottom + "px";
    dd.style.left  = r.left   + "px";
    dd.style.width = r.width  + "px";
    dd.style.right = "auto";
}

function updateSearchDropdown() {
    const dd    = document.getElementById("searchDropdown");
    const input = document.getElementById("searchInput");
    const q     = input.value.trim().toLowerCase();
    dd.innerHTML = "";

    if (!q) { dd.classList.remove("active"); return; }

    const results = [];
    Object.entries(allData).forEach(([sheetId, data]) => {
        Object.values(data).forEach(row => {
            const name = (row["ROAD NAME"]||row["BLOCK NAME"]||row["NAME"]||"").trim().toLowerCase();
            if (name.includes(q)) {
                const dispName = row["ROAD NAME"]||row["BLOCK NAME"]||row["NAME"]||"بدون اسم";
                results.push({ name: dispName, status: row["STATUS"]||"", key: `${sheetId}-${dispName}` });
            }
        });
    });

    if (!results.length) {
        dd.innerHTML = "<div style='padding:10px;text-align:right;color:#999;font-size:12px'>لا توجد نتائج</div>";
    } else {
        results.forEach(item => {
            const el = document.createElement("div");
            el.className = "search-item";
            el.innerHTML = `
                <span class="search-badge" style="background:${statusColor(item.status)}">${item.status||"-"}</span>
                <div class="search-item-name">${item.name}</div>`;
            el.addEventListener("click", () => {
                const layer = allFeatures[item.key];
                if (layer) {
                    if (map && defaultCoords) {
                        map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
                    }
                    setTimeout(() => {
                        flashLayer(layer);
                        setTimeout(() => layer.openPopup(), 700);
                    }, 100);
                }
                input.value = "";
                dd.classList.remove("active");
            });
            dd.appendChild(el);
        });
    }

    dd.classList.add("active");
    positionDropdown();
}

document.getElementById("searchInput").addEventListener("input", updateSearchDropdown);
window.addEventListener("resize", () => { if (map) map.invalidateSize(); positionDropdown(); });