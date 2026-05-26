/* ====================================================
   CONTRACTOR PANEL
   ==================================================== */

let contractorMap          = {};
let activeContractorFilter = new Set(); // "sheetId|contractorName"
let contractorsLoaded      = false;

// fetch contractors for one subitem
async function fetchSheetContractors(sub) {

    const cat = categories.find(c =>
        c.subitems.some(s => s.id === sub.id)
    );

    const addEntry = (cname) => {
        if (!contractorMap[cname]) contractorMap[cname] = [];

        if (!contractorMap[cname].find(e => e.subId === sub.id)) {
            contractorMap[cname].push({
                catId       : cat ? cat.id    : "",
                catName     : cat ? cat.name  : "",
                catEmoji    : cat ? cat.emoji : "📍",
                catOrder    : categories.indexOf(cat),
                subId       : sub.id,
                subName     : sub.name,
                sheetId     : sub.sheetId,
                geoJsonFile : sub.geoJsonFile
            });
        }
    };

    // use cached data
    if (allData[sub.sheetId]) {
        Object.values(allData[sub.sheetId]).forEach(row => {
            const cname = (row["CONTRACTOR"] || "").trim();
            if (cname) addEntry(cname);
        });
        return;
    }

    // fetch from sheet
    try {
        const url  = `https://docs.google.com/spreadsheets/d/${sub.sheetId}/export?format=csv&gid=0`;
        const r    = await fetch(url);
        if (!r.ok) return;

        const csv  = await r.text();

        if (csv.trim().startsWith('<')) return;

        const lines   = csv.split('\n').filter(l => l.trim());
        if (!lines.length) return;

        const headers = lines[0].split(',')
            .map(h => h.trim().toUpperCase());

        const cIdx    = headers.findIndex(h => h === 'CONTRACTOR');
        if (cIdx === -1) return;

        for (let i = 1; i < lines.length; i++) {
            const vals  = lines[i].split(',').map(v => v.trim());
            const cname = (vals[cIdx] || "").trim();

            if (cname) addEntry(cname);
        }

    } catch(e) {
        console.warn("contractor fetch failed:", sub.name, e);
    }
}


/* ====================================================
   BUILD PANEL
   ==================================================== */

async function buildContractorPanel({ forceRefresh = false } = {}) {

    const list = document.getElementById("contractorList");
    if (!list) return;

    if (contractorsLoaded && !forceRefresh) {
        renderContractorList();
        return;
    }

    list.innerHTML = '<div class="contractor-empty">⏳ جاري التحميل...</div>';

    contractorMap = {};

    const allSubs = [];
    categories.forEach(cat =>
        cat.subitems.forEach(sub => allSubs.push(sub))
    );

    if (!allSubs.length) {
        list.innerHTML = '<div class="contractor-empty">لا توجد بنود</div>';
        return;
    }

    await Promise.all(allSubs.map(sub =>
        fetchSheetContractors(sub)
    ));

    contractorsLoaded = true;

    renderContractorList();
}


/* ====================================================
   RENDER PANEL
   ==================================================== */

function renderContractorList() {

    const list = document.getElementById("contractorList");
    if (!list) return;

    const names = Object.keys(contractorMap)
        .sort((a,b) => a.localeCompare(b, 'ar'));

    if (!names.length) {
        list.innerHTML = '<div class="contractor-empty">لا يوجد مقاولين</div>';
        return;
    }

    list.innerHTML = names.map(name => {

        const subs = contractorMap[name];

        return `
        <div class="contractor-item">
            <div class="contractor-name">
                <span>${name}</span>
                <span class="contractor-count">${subs.length}</span>
            </div>
        </div>`;
    }).join('');
}


/* ====================================================
   FILTER
   ==================================================== */

function applyContractorFilter() {

    if (!activeContractorFilter.size) {
        refreshLayerColors();
        return;
    }

    Object.entries(allLayers).forEach(([sheetId, layer]) => {

        if (!layer || !allData[sheetId]) return;

        const activeForSheet = [...activeContractorFilter]
            .filter(k => k.startsWith(sheetId + '|'))
            .map(k => k.split('|')[1].trim().toLowerCase());

        layer.eachLayer(f => {

            const row = allData[sheetId][f.feature.properties.ID];
            if (!row) return;

            const featureCon =
                (row["CONTRACTOR"] || "").trim().toLowerCase();

            const match = activeForSheet.length === 0 ||
                          activeForSheet.includes(featureCon);

            if (match) {
                f.setStyle(featureStyle(row));
            } else {
                f.setStyle({
                    color: '#aaa',
                    fillColor: '#ccc',
                    fillOpacity: 0.2
                });
            }
        });
    });
}