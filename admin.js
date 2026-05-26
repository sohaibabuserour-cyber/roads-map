/* ====================================================
   ADMIN: CASHFLOW + NOTIFICATIONS + BILLS
   ==================================================== */

/* ====================================================
   CASHFLOW
   ==================================================== */

function openCashflowModal() {
    const modal = document.getElementById("cashflowModal");
    if (!modal) return;

    modal.classList.add("active");
    loadCashflowData();
}

function closeCashflowModal() {
    const modal = document.getElementById("cashflowModal");
    if (!modal) return;

    modal.classList.remove("active");
}

async function loadCashflowData() {
    const body = document.getElementById("cashflowTableBody");
    if (!body) return;

    body.innerHTML = `<tr><td colspan="5">⏳ جاري التحميل...</td></tr>`;

    try {
        const url = `https://docs.google.com/spreadsheets/d/YOUR_CASHFLOW_SHEET_ID/export?format=csv`;
        const r   = await fetch(url);
        const csv = await r.text();

        const lines = csv.split('\n').filter(l => l.trim());
        if (!lines.length) return;

        const headers = lines[0].split(',')
            .map(h => h.trim().toUpperCase());

        body.innerHTML = "";

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',');
            const date  = vals[headers.indexOf("DATE")] || "";
            const name  = vals[headers.indexOf("NAME")] || "";
            const value = fmtNum(vals[headers.indexOf("VALUE")] || 0);

            body.innerHTML += `
            <tr>
                <td>${date}</td>
                <td>${name}</td>
                <td>${value}</td>
            </tr>`;
        }

    } catch (e) {
        console.error(e);
        body.innerHTML = `<tr><td colspan="5">❌ خطأ في التحميل</td></tr>`;
    }
}

/* ====================================================
   NOTIFICATIONS
   ==================================================== */

async function loadNotifications() {

    const wrap = document.getElementById("notifList");
    if (!wrap) return;

    wrap.innerHTML = '<div class="notif-empty">⏳ جاري التحميل...</div>';

    try {
        const url = `https://docs.google.com/spreadsheets/d/YOUR_NOTIF_SHEET_ID/export?format=csv`;
        const r   = await fetch(url);
        const csv = await r.text();

        const lines = csv.split('\n').filter(l => l.trim());
        if (!lines.length) throw new Error();

        wrap.innerHTML = "";

        lines.slice(1).forEach(line => {
            const parts = line.split(',');

            const title = parts[0] || "تنبيه";
            const text  = parts[1] || "";

            wrap.innerHTML += `
            <div class="notif-item">
                <div class="notif-item-title">${title}</div>
                <div class="notif-item-text">${text}</div>
            </div>`;
        });

    } catch {
        wrap.innerHTML = '<div class="notif-empty">❌ لا يمكن تحميل الإشعارات</div>';
    }
}

/* ====================================================
   BILLS DASHBOARD
   ==================================================== */

function openBillsModal() {
    const modal = document.getElementById("billsModal");
    if (!modal) return;

    modal.classList.add("active");
    loadBillsData();
}

function closeBillsModal() {
    const modal = document.getElementById("billsModal");
    if (!modal) return;

    modal.classList.remove("active");
}

async function loadBillsData() {

    const table = document.getElementById("billsTableBody");
    if (!table) return;

    table.innerHTML = `<tr><td colspan="6">⏳ جاري التحميل...</td></tr>`;

    try {
        const url = `https://docs.google.com/spreadsheets/d/YOUR_BILLS_SHEET_ID/export?format=csv`;
        const r   = await fetch(url);
        const csv = await r.text();

        const lines = csv.split('\n').filter(l => l.trim());
        if (!lines.length) return;

        table.innerHTML = "";

        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',');

            const no     = vals[headers.indexOf("NO")] || "";
            const name   = vals[headers.indexOf("NAME")] || "";
            const total  = fmtNum(vals[headers.indexOf("TOTAL")] || 0);
            const paid   = fmtNum(vals[headers.indexOf("PAID")] || 0);
            const remain = fmtNum(vals[headers.indexOf("REMAIN")] || 0);

            table.innerHTML += `
            <tr>
                <td>${no}</td>
                <td>${name}</td>
                <td>${total}</td>
                <td>${paid}</td>
                <td>${remain}</td>
            </tr>`;
        }

    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td colspan="6">❌ خطأ في تحميل البيانات</td></tr>`;
    }
}
