/* ============================================================
   map.js
   منطق الخريطة — مُستخرَج من main.js

   الترتيب في index.html (بعد utils.js وقبل main.js):
       <script src="utils.js"></script>
       <script src="map.js"></script>
       <script src="main.js"></script>

   المتغيرات والدوال التي يعتمد عليها من ملفات أخرى:
       defaultCoords          — main.js
       selectedStatuses, statusColor, statusCls, LABELS — main.js
       categories, selectedItems, equipmentData — main.js
       showAlert, parseCSVLine, fmtNum — utils.js / main.js
       activeContractorFilter, applyContractorFilter,
       contractorsLoaded, renderContractorList, buildContractorPanel — contractors.js
       updateStats — main.js
   ============================================================ */

let map = null;
var allLayers   = {};   // sheetId → LeafGeoJSON layer
var allData     = {};   // sheetId → { id: rowObj }
var allFeatures = {};   // `${sheetId}-${name}` → Leaflayer
var loadTokens  = {};   // per-sheetId load token — prevents stale async responses

/* ====================================================
   MAP INIT
   ==================================================== */

function initMap() {
    if (map) { map.remove(); map = null; }
    const tileUrl = document.body.classList.contains('theme-dark')
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    map = L.map('map', { zoomControl: true }).setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
    L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
}

/* ====================================================
   LAYER STYLE
   ==================================================== */

function featureStyle(row) {
    const st  = (row["STATUS"]||"").trim().toLowerCase();
    const ok  = selectedStatuses.some(s => s.toLowerCase() === st);
    const col = ok ? statusColor(row["STATUS"]) : "#cccccc";
    return { color: col, fillColor: col, fillOpacity: ok ? 0.6 : 0.15, weight: ok ? 2 : 1 };
}

function refreshLayerColors() {
    if (activeContractorFilter && activeContractorFilter.size > 0) {
        applyContractorFilter();
    } else {
        Object.entries(allLayers).forEach(([sheetId, layer]) => {
            if (!layer || !allData[sheetId]) return;
            layer.eachLayer(f => {
                const row = allData[sheetId][f.feature.properties.ID];
                if (row) f.setStyle(featureStyle(row));
            });
        });
    }
}

/* ====================================================
   FLASH EFFECT (for search highlight)
   ==================================================== */

function flashLayer(leafletLayer) {
    if (!leafletLayer || typeof leafletLayer.setStyle !== 'function') return;
    const origStyle = {
        color: leafletLayer.options.color,
        fillColor: leafletLayer.options.fillColor,
        weight: leafletLayer.options.weight
    };
    const flashColor = '#ffffff';
    let count = 0;
    const interval = setInterval(() => {
        if (count % 2 === 0) {
            leafletLayer.setStyle({ color: flashColor, fillColor: flashColor, weight: 4 });
        } else {
            leafletLayer.setStyle(origStyle);
        }
        count++;
        if (count >= 6) {
            clearInterval(interval);
            leafletLayer.setStyle(origStyle);
        }
    }, 250);
}

/* ====================================================
   LOAD / REMOVE LAYER
   ==================================================== */

function loadLayer(sheetId, subitemName, geoJsonFile, catId) {
    const token = Date.now() + '_' + Math.random();
    loadTokens[sheetId] = token;

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

    fetch(csvUrl)
        .then(r => r.text())
        .then(csv => {
            if (loadTokens[sheetId] !== token) return;
            const isWanted = () =>
                categories.flatMap(c => c.subitems).some(s => s.sheetId === sheetId && selectedItems[s.id])
                || [...activeContractorFilter].some(k => k.startsWith(sheetId + '|'));
            if (!isWanted()) return;

            const data  = {};
            const lines = csv.split('\n').filter(l => l.trim());
            if (!lines.length) return;
            const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());
            const idIdx   = headers.findIndex(h => h === 'ID');
            if (idIdx === -1) { showAlert("❌ لا يوجد عمود ID في الشيت"); return; }

            for (let i = 1; i < lines.length; i++) {
                const vals = parseCSVLine(lines[i]);
                if (!vals[idIdx]) continue;
                const id = vals[idIdx];
                data[id] = {};
                headers.forEach((h, idx) => { data[id][h] = vals[idx] || ""; });
            }

            allData[sheetId] = data;

            return fetch(geoJsonFile + "?t=" + Date.now()).then(r => r.json()).then(geo => {
                if (loadTokens[sheetId] !== token) return;
                if (!isWanted()) { delete allData[sheetId]; return; }

                if (allLayers[sheetId]) {
                    map.removeLayer(allLayers[sheetId]);
                    delete allLayers[sheetId];
                }

                const layer = L.geoJSON(geo, {
                    onEachFeature: (f, l) => {
                        const id      = f.properties.ID;
                        const row     = data[id];
                        if (!row) return;

                        const nameKey = row["ROAD NAME"] ? "ROAD NAME" : row["BLOCK NAME"] ? "BLOCK NAME" : "NAME";
                        const name    = row[nameKey] || "بدون اسم";
                        allFeatures[`${sheetId}-${name}`] = l;

                        l.setStyle(featureStyle(row));

                        let html = `<div class="popup-card"><div class="popup-header">
                            <div class="popup-title">مشروع ولي العهد</div>
                            <div class="popup-subtitle">${subitemName}</div>
                        </div><div class="popup-body">`;

                        Object.keys(row).forEach(k => {
                            if (k === "ID") return;
                            const isSt = k === "STATUS";
                            const cls  = isSt ? `status ${statusCls(row[k])}` : "";
                            const val  = isSt ? row[k] : fmtNum(row[k]);
                            html += `<div class="popup-row">
                                <div class="popup-label">${LABELS[k]||k}</div>
                                <div class="popup-value ${cls}">${val}</div>
                            </div>`;
                        });

                        html += `<div class="popup-row">
                            <div class="popup-label">المعدات</div>
                            <div class="popup-value">${equipmentData[id]||"غير محدد"}</div>
                        </div></div></div>`;

                        l.bindPopup(html);
                        l.on('click', () => l.openPopup());
                    }
                });

                allLayers[sheetId] = layer;
                layer.addTo(map);

                if (defaultCoords) {
                    map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
                }

                updateStats();
                if (activeContractorFilter && activeContractorFilter.size > 0) {
                    applyContractorFilter();
                }
                if (contractorsLoaded) renderContractorList();
                else buildContractorPanel();
            });
        })
        .catch(e => { console.error(e); showAlert("❌ خطأ في تحميل البيانات"); });
}

function removeLayer(sheetId) {
    loadTokens[sheetId] = null;
    if (allLayers[sheetId]) { map.removeLayer(allLayers[sheetId]); delete allLayers[sheetId]; }
    delete allData[sheetId];
    if (activeContractorFilter) {
        [...activeContractorFilter].forEach(k => { if (k.startsWith(sheetId + '|')) activeContractorFilter.delete(k); });
    }
    updateStats();
    renderContractorList();
}
