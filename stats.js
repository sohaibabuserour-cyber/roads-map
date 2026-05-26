/* ====================================================
   STATS BAR
   ==================================================== */

function calcSubTotals(rows) {
    let total = 0;
    let done  = 0;

    rows.forEach(r => {
        const t = toNum(r["TOTAL-QTY"]);
        const d = toNum(r["DONE-QTY"]);

        total += t;
        done  += d;
    });

    const remaining = total - done;
    const pct = total ? (done / total) * 100 : 0;

    return { total, done, remaining, pct };
}

function makeStatCard(title, totals) {
    return `
    <div class="stats-group">
        <div class="stats-group-title">${title}</div>
        <div class="stat-row">
            <div class="stat-item">
                <div class="stat-label">الإجمالي</div>
                <div class="stat-value">${fmtNum(totals.total)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">المنفذ</div>
                <div class="stat-value">${fmtNum(totals.done)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">المتبقي</div>
                <div class="stat-value">${fmtNum(totals.remaining)}</div>
            </div>
        </div>
    </div>`;
}

function makeTotalsRow(allRows) {
    const totals = calcSubTotals(allRows);

    return `
    <div class="stats-group stats-group-total">
        <div class="stats-group-title">إجمالي البنود</div>
        <div class="stat-row">
            <div class="stat-item">
                <div class="stat-label">الإجمالي</div>
                <div class="stat-value">${fmtNum(totals.total)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">المنفذ</div>
                <div class="stat-value">${fmtNum(totals.done)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">المتبقي</div>
                <div class="stat-value">${fmtNum(totals.remaining)}</div>
            </div>
        </div>
    </div>`;
}


/* ====================================================
   MAIN UPDATE
   ==================================================== */

function updateStats() {

    const container = document.getElementById("statsWrapper");
    if (!container) return;

    const allRows = [];

    Object.entries(allData).forEach(([sheetId, data]) => {
        Object.values(data).forEach(row => {

            const st = (row["STATUS"] || "").trim();

            // STATUS filter
            if (!selectedStatuses.includes(st)) return;

            // CONTRACTOR filter
            if (activeContractorFilter && activeContractorFilter.size > 0) {
                const c = (row["CONTRACTOR"] || "").trim().toLowerCase();

                const match = [...activeContractorFilter].some(k =>
                    k.split('|')[1].toLowerCase() === c
                );

                if (!match) return;
            }

            allRows.push(row);
        });
    });

    // no data
    if (!allRows.length) {
        container.innerHTML = "";
        updateProgressRing(0);
        return;
    }

    // group by subitem (sheetId)
    const bySheet = {};

    Object.entries(allData).forEach(([sheetId, data]) => {

        const rows = Object.values(data).filter(row => {
            const st = (row["STATUS"] || "").trim();

            if (!selectedStatuses.includes(st)) return false;

            if (activeContractorFilter && activeContractorFilter.size > 0) {
                const c = (row["CONTRACTOR"] || "").trim().toLowerCase();

                const match = [...activeContractorFilter].some(k =>
                    k.split('|')[1].toLowerCase() === c
                );

                if (!match) return false;
            }

            return true;
        });

        if (rows.length) {
            bySheet[sheetId] = rows;
        }
    });

    // build UI
    let html = "";

    Object.entries(bySheet).forEach(([sheetId, rows]) => {

        const sub = categories
            .flatMap(c => c.subitems)
            .find(s => s.sheetId === sheetId);

        const name = sub ? sub.name : "بند";

        const totals = calcSubTotals(rows);
        html += makeStatCard(name, totals);
    });

    html += makeTotalsRow(allRows);

    container.innerHTML = html;

    // progress ring
    const totals = calcSubTotals(allRows);
    updateProgressRing(totals.pct);
}


/* ====================================================
   PROGRESS RING
   ==================================================== */

function updateProgressRing(pct) {
    const wrap = document.getElementById("progressRingWrap");
    const circle = document.getElementById("progressCircle");
    const text = document.getElementById("progressText");

    if (!wrap || !circle || !text) return;

    if (!pct || pct <= 0) {
        wrap.classList.remove("visible");
        return;
    }

    wrap.classList.add("visible");

    const radius = 18;
    const circumference = 2 * Math.PI * radius;

    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset =
        circumference - (pct / 100) * circumference;

    text.textContent = Math.round(pct) + "%";
}