// ====================================================
// STATS BAR
// ====================================================

const LABELS = {
    "ID"           : "معرف",
    "ROAD NAME"    : "اسم الطريق",
    "BLOCK NAME"   : "اسم القطعة",
    "TOTAL-QTY"    : "الإجمالي",
    "DONE-QTY"     : "المنفذ",
    "REMANING-QTY" : "المتبقي",
    "STATUS"       : "الحالة",
    "CONTRACTOR"   : "المقاول",
    "EQUIPMENT"    : "المعدات"
};

function calcSubTotals(sub) {
    let total = 0, done = 0;
    if (!allData[sub.sheetId]) return { total, done };

    const filterOn = activeContractorFilter && activeContractorFilter.size > 0;
    const activeContractorsForSheet = filterOn
        ? [...activeContractorFilter]
            .filter(k => k.startsWith(sub.sheetId + '|'))
            .map(k => k.split('|')[1].trim().toLowerCase())
        : null;

    Object.values(allData[sub.sheetId]).forEach(row => {
        const st = (row["STATUS"] || "").trim().toLowerCase();
        if (!selectedStatuses.some(s => s.toLowerCase() === st)) return;

        if (activeContractorsForSheet && activeContractorsForSheet.length > 0) {
            const featureCon = (row["CONTRACTOR"] || "").trim().toLowerCase();
            if (!activeContractorsForSheet.includes(featureCon)) return;
        }

        total += toNum(row["TOTAL-QTY"]);
        done  += toNum(row["DONE-QTY"]);
    });

    return { total, done };
}

function makeStatCard(title, subtitle, total, done, isTotal = false) {
    const card = document.createElement("div");
    card.className = "stats-group" + (isTotal ? " stats-group-total" : "");
    card.innerHTML = `
        <div class="stats-group-title">${title}</div>
        <div class="stats-group-type">${subtitle}</div>
        <div class="stat-row">
            <div class="stat-item"><div class="stat-label">الإجمالي</div><div class="stat-value">${fmtNum(total)}</div></div>
            <div class="stat-item"><div class="stat-label">المنفذ</div><div class="stat-value">${fmtNum(done)}</div></div>
            <div class="stat-item"><div class="stat-label">المتبقي</div><div class="stat-value">${fmtNum(total - done)}</div></div>
        </div>`;
    return card;
}

function makeContractorsCard(sheetIds, subLabel = "البند المحدد") {
    const contractorCounts = {};
    sheetIds.forEach(sid => {
        if (!allData[sid]) return;
        Object.values(allData[sid]).forEach(row => {
            const c = (row["CONTRACTOR"] || "").trim();
            if (!c) return;
            contractorCounts[c] = (contractorCounts[c] || 0) + 1;
        });
    });

    if (!Object.keys(contractorCounts).length) return null;

    const sorted = Object.entries(contractorCounts).sort((a, b) => b[1] - a[1]);
    const total = sorted.length;

    const card = document.createElement("div");
    card.className = "stats-group stats-group-contractors";
    card.innerHTML = `
        <div class="stats-group-title">👷 المقاولون</div>
        <div class="stats-group-type">${total} مقاول في بند ${subLabel}</div>
        <div class="contractor-chips">
            ${sorted.map(([name, count]) =>
                `<span class="contractor-chip">
                    <span class="contractor-chip-name">${name}</span>
                    <span class="contractor-chip-badge">${count}</span>
                </span>`
            ).join('')}
        </div>`;
    return card;
}

function makeEquipmentCard(sheetIds, subLabel = "البند المحدد") {
    if (!window.equipmentRawRows || !window.equipmentRawRows.length || !window.equipmentRawHeaders) return null;

    const SKIP = new Set(['ID', 'BAYAN', 'البيان', 'DESCRIPTION', 'بيان', 'البند', 'BAND', 'ALBND', 'ITEM']);

    const activeSubs = categories.flatMap(c => c.subitems).filter(s => selectedItems[s.id]);
    const activeSubNames = [...new Set(activeSubs.map(s => s.name.trim()))];

    const bandColOrig = window.equipmentRawHeaders.find(h => {
        const u = h.trim().toUpperCase();
        return u === 'البند' || u === 'BAND' || u === 'ALBND' || u === 'ITEM';
    });

    let rows = window.equipmentRawRows;
    if (bandColOrig && activeSubNames.length) {
        const bKey = bandColOrig.trim().toUpperCase();
        rows = window.equipmentRawRows.filter(row => {
            const val = (row[bKey] || "").trim();
            if (!val) return false;
            return activeSubNames.includes(val);
        });
    }

    if (!rows.length) return null;

    const idIdx = window.equipmentRawHeaders.findIndex(h => h.toUpperCase() === 'ID');
    const totals = {};
    window.equipmentRawHeaders.forEach((h, i) => {
        const hUp = h.trim().toUpperCase();
        if (i === idIdx || !h.trim() || SKIP.has(hUp) || SKIP.has(h.trim())) return;
        let sum = 0;
        rows.forEach(row => {
            const val = parseFloat(row[hUp] || 0);
            if (!isNaN(val)) sum += val;
        });
        if (sum > 0) totals[h.trim()] = sum;
    });

    const entries = Object.entries(totals).sort((a,b) => b[1] - a[1]);
    if (!entries.length) return null;

    const uniqueSubNames = activeSubNames.length ? activeSubNames.join(' و ') : subLabel;

    const card = document.createElement("div");
    card.className = "stats-group stats-group-equipment";
    card.innerHTML = `
        <div class="stats-group-title">🚜 المعدات</div>
        <div class="stats-group-type">إجمالي المعدات في بند ${uniqueSubNames}</div>
        <div class="equipment-chips">
            ${entries.map(([name, count]) =>
                `<span class="equipment-chip">${name}<span class="equipment-chip-count">${fmtNum(count)}</span></span>`
            ).join('')}
        </div>`;
    return card;
}

function updateProgressRing(total, done) {
    const wrap   = document.getElementById("progressRingWrap");
    const circle = document.getElementById("progressRingCircle");
    const pctEl  = document.getElementById("progressRingPct");

    if (!wrap) return;

    if (!total || total === 0) {
        wrap.classList.remove("visible");
        return;
    }

    const pct          = Math.min(100, Math.round((done / total) * 100));
    const circumference = 94.25;
    const offset        = circumference - (pct / 100) * circumference;

    wrap.classList.add("visible");
    circle.style.strokeDashoffset = offset;
    pctEl.textContent = pct + "%";

    circle.style.stroke = pct < 30 ? "#f44336" : pct < 70 ? "#ff9800" : "var(--gold)";
}

function updateStats() {
    const wrapper = document.getElementById("statsWrapper");
    wrapper.innerHTML = "";
    const contractorMode = activeContractorFilter && activeContractorFilter.size > 0;

    let grandTotal = 0, grandDone = 0, cardCount = 0;

    if (contractorMode) {
        const bySheet = {};
        [...activeContractorFilter].forEach(key => {
            const pipeIdx = key.indexOf('|');
            const sid   = key.slice(0, pipeIdx);
            const cname = key.slice(pipeIdx + 1);
            if (!bySheet[sid]) bySheet[sid] = [];
            bySheet[sid].push(cname);
        });

        Object.entries(bySheet).forEach(([sid, contractors]) => {
            if (!allData[sid]) return;
            let subLabel = sid, catLabel = "";
            categories.forEach(cat => {
                cat.subitems.forEach(sub => {
                    if (sub.sheetId === sid) { subLabel = sub.name; catLabel = cat.emoji + " " + cat.name; }
                });
            });
            let total = 0, done = 0;
            const cLow = contractors.map(c => c.toLowerCase());
            Object.values(allData[sid]).forEach(row => {
                const st = (row["STATUS"] || "").trim().toLowerCase();
                if (!selectedStatuses.some(s => s.toLowerCase() === st)) return;
                if (!cLow.includes((row["CONTRACTOR"] || "").trim().toLowerCase())) return;
                total += toNum(row["TOTAL-QTY"]);
                done  += toNum(row["DONE-QTY"]);
            });
            const title = contractors.length === 1 ? ("👷 " + contractors[0]) : ("👷 " + contractors.length + " مقاولين");
            wrapper.appendChild(makeStatCard(title, catLabel + " ← " + subLabel, total, done));
            grandTotal += total; grandDone += done; cardCount++;
        });

        if (cardCount > 1) {
            wrapper.appendChild(makeStatCard("📊 الإجمالي الكلي", "مجموع المقاولين المحددين", grandTotal, grandDone, true));
        }

    } else {
        const activeSheetIds = [];
        const catCards = [];

        categories.forEach(cat => {
            const activeSubs = cat.subitems.filter(s => selectedItems[s.id] && allData[s.sheetId]);
            if (!activeSubs.length) return;
            let catTotal = 0, catDone = 0;

            activeSubs.forEach(sub => {
                const { total, done } = calcSubTotals(sub);
                catTotal += total; catDone += done;
                activeSheetIds.push(sub.sheetId);
            });
            catCards.push({
                el: makeStatCard(
                    cat.emoji + " " + cat.name,
                    activeSubs.map(s => s.name).join(" + "),
                    catTotal, catDone
                ),
                total: catTotal,
                done: catDone
            });
            grandTotal += catTotal; grandDone += catDone; cardCount++;
        });

        const activeNames = categories.flatMap(c => c.subitems)
            .filter(s => selectedItems[s.id])
            .map(s => s.name.trim());
        const subLabel = [...new Set(activeNames)].join(' و ') || "البند المحدد";

        if (activeSheetIds.length) {
            const cCard = makeContractorsCard(activeSheetIds, subLabel);
            if (cCard) wrapper.appendChild(cCard);
        }

        if (activeSheetIds.length) {
            const eCard = makeEquipmentCard(activeSheetIds, subLabel);
            if (eCard) wrapper.appendChild(eCard);
        }

        catCards.forEach(c => wrapper.appendChild(c.el));

        if (cardCount > 1) {
            wrapper.appendChild(makeStatCard("📊 الإجمالي الكلي", "مجموع جميع البنود", grandTotal, grandDone, true));
        }
    }

    updateProgressRing(grandTotal, grandDone);

    sessionStorage.setItem("selectedStatuses", JSON.stringify(selectedStatuses));
    sessionStorage.setItem("selectedItems",    JSON.stringify(selectedItems));
    sessionStorage.setItem("sessionTime",      Date.now().toString());
}