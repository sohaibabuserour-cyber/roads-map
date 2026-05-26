/* ====================================================
   EQUIPMENT DATA + PANEL
   ==================================================== */

let equipmentRawRows = [];
let equipmentRawHeaders = [];

// Load main equipment sheet
async function loadEquipmentData() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${EQUIPMENT_SHEET_ID}/export?format=csv&gid=0`;
        const r   = await fetch(url);
        if (!r.ok) throw new Error("fetch failed");

        const csv = await r.text();

        const lines = csv.split('\n').filter(l => l.trim());
        if (!lines.length) return;

        equipmentRawHeaders = lines[0].split(',')
            .map(h => h.trim().toUpperCase());

        equipmentRawRows = [];

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const row  = {};

            equipmentRawHeaders.forEach((h, idx) => {
                row[h] = vals[idx] || "";
            });

            equipmentRawRows.push(row);
        }

        buildEquipmentPanel();
        updateStats();

    } catch (e) {
        console.error("equipment load error:", e);
    }
}


/* ====================================================
   BUILD PANEL
   ==================================================== */

function buildEquipmentPanel() {
    const wrap = document.getElementById("equipmentPanelList");
    if (!wrap) return;

    if (!equipmentRawRows.length) {
        wrap.innerHTML = '<div class="equipment-empty">لا يوجد بيانات</div>';
        return;
    }

    const counts = {};

    equipmentRawRows.forEach(r => {
        const type = (r["TYPE"] || "غير محدد").trim();

        if (!counts[type]) counts[type] = 0;

        const qty = toNum(r["QTY"] || 1);
        counts[type] += qty;
    });

    const sorted = Object.entries(counts)
        .sort((a,b) => b[1] - a[1]);

    let total = 0;

    let html = sorted.map(([type, val]) => {
        total += val;

        return `
        <div class="equipment-row">
            <div class="equipment-row-name">${type}</div>
            <div class="equipment-row-count">${val}</div>
        </div>`;
    }).join('');

    wrap.innerHTML = html;

    // total
    const totalBox = document.getElementById("equipmentTotal");
    if (totalBox) {
        totalBox.textContent = fmtNum(total);
    }
}


/* ====================================================
   FILTER HELPERS
   ==================================================== */

function getEquipmentForId(id) {
    return equipmentRawRows
        .filter(r => (r["ID"] || "").trim() === id)
        .map(r => {
            const type = r["TYPE"] || "";
            const qty  = toNum(r["QTY"] || 1);
            return `${type} (${qty})`;
        })
        .join(", ");
}


/* ====================================================
   USED IN MAP POPUP
   ==================================================== */

function buildEquipmentMapIndex() {
    equipmentData = {};

    equipmentRawRows.forEach(r => {
        const id = (r["ID"] || "").trim();
        if (!id) return;

        if (!equipmentData[id]) {
            equipmentData[id] = [];
        }

        const type = r["TYPE"] || "";
        const qty  = toNum(r["QTY"] || 1);

        equipmentData[id].push(`${type} (${qty})`);
    });

    Object.keys(equipmentData).forEach(k => {
        equipmentData[k] = equipmentData[k].join(", ");
    });
}