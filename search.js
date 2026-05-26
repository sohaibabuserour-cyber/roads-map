/* ====================================================
   SEARCH
   ==================================================== */

function updateSearchDropdown(query) {

    const dd = document.getElementById("searchDropdown");
    const input = document.getElementById("searchInput");

    if (!dd || !input) return;

    const q = (query || input.value || "").trim().toLowerCase();

    // empty → hide
    if (!q) {
        dd.classList.remove("active");
        dd.innerHTML = "";
        return;
    }

    const results = [];

    Object.entries(allData).forEach(([sheetId, data]) => {

        Object.values(data).forEach(row => {

            const name =
                row["ROAD NAME"] ||
                row["BLOCK NAME"] ||
                row["NAME"] ||
                "";

            const nameLower = name.toLowerCase();

            if (!nameLower.includes(q)) return;

            const id = row["ID"];
            const key = `${sheetId}-${name}`;

            const leaf = allFeatures[key];

            results.push({
                id,
                name,
                sheetId,
                row,
                leaflet: leaf
            });
        });
    });

    if (!results.length) {
        dd.innerHTML = `<div class="search-item">لا يوجد نتائج</div>`;
        dd.classList.add("active");
        positionDropdown();
        return;
    }

    // limit results
    const sliced = results.slice(0, 20);

    dd.innerHTML = sliced.map(r => {

        const status = r.row["STATUS"] || "";
        const cls    = statusCls(status);

        return `
        <div class="search-item"
             onclick="selectSearchResult('${r.sheetId}','${r.id}','${r.name}')">

            <div class="search-item-name">${r.name}</div>

            <div class="search-badge ${cls}">
                ${status}
            </div>
        </div>`;
    }).join('');

    dd.classList.add("active");
    positionDropdown();
}


/* ====================================================
   SELECT RESULT
   ==================================================== */

function selectSearchResult(sheetId, id, name) {

    const dd = document.getElementById("searchDropdown");
    dd.classList.remove("active");

    const key = `${sheetId}-${name}`;
    const layer = allFeatures[key];

    if (!layer) return;

    const bounds = layer.getBounds();

    map.fitBounds(bounds, {
        maxZoom: 17,
        animate: true
    });

    flashLayer(layer);

    setTimeout(() => {
        layer.openPopup();
    }, 300);
}


/* ====================================================
   POSITION DROPDOWN
   ==================================================== */

function positionDropdown() {
    const input = document.getElementById("searchInput");
    const dd    = document.getElementById("searchDropdown");

    if (!input || !dd) return;

    const rect = input.getBoundingClientRect();

    dd.style.top  = (rect.bottom + window.scrollY) + "px";
    dd.style.left = (rect.left + window.scrollX) + "px";
    dd.style.width = rect.width + "px";
}
