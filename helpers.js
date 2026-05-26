/* ====================================================
   HELPERS
   ==================================================== */

function fmtNum(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return v || "";
    return n.toLocaleString('en-US');
}

function toNum(v) {
    return (!isNaN(v) && v !== "") ? Number(v) : 0;
}

function statusColor(s) {
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.color : "#9e9e9e";
}

function statusCls(s) {
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.cls : "";
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2,5);
}

function sheetIdFromUrl(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : url.trim();
}

function showAlert(msg, type="error") {
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}