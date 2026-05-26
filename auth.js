// ====================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ====================================================

async function fetchUsers() {
    const url = `https://docs.google.com/spreadsheets/d/${USERS_SHEET_ID}/export?format=csv&gid=0`;
    const r   = await fetch(url);
    const csv = await r.text();
    const lines   = csv.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());
    const users   = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const obj  = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
        users.push(obj);
    }
    return users;
}

async function doLogin() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pass  = document.getElementById("loginPassword").value.trim();

    if (!email || !pass) { showLoginError("يرجى إدخال البريد وكلمة المرور"); return; }

    document.getElementById("loginLoading").style.display = "block";
    document.getElementById("loginError").style.display   = "none";
    document.getElementById("loginBtn").disabled = true;

    try {
        const users = await fetchUsers();
        const found = users.find(u =>
            u["EMAIL"] && u["EMAIL"].toLowerCase() === email &&
            u["PASSWORD"] && u["PASSWORD"]          === pass
        );

        if (!found) { showLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة"); return; }

        currentUser = {
            email  : found["EMAIL"],
            name   : found["NAME"]  || found["EMAIL"],
            role   : found["ROLE"]  || "2",
            isAdmin: (found["ROLE"] || "").toString().trim() === "1",
            avatar : found["PHOTO"] || found["AVATAR"] || ""
        };

        saveSession(currentUser);
        enterApp();

    } catch(e) {
        console.error(e);
        showLoginError("خطأ في الاتصال - تأكد من إعدادات الشيت");
    } finally {
        document.getElementById("loginLoading").style.display = "none";
        document.getElementById("loginBtn").disabled = false;
    }
}

function showLoginError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
}

function saveSession(user) {
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("sessionTime", Date.now().toString());
}

function clearSession() {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("sessionTime");
    sessionStorage.removeItem("selectedStatuses");
    sessionStorage.removeItem("selectedItems");
}

async function tryRestoreSession() {
    const saved     = sessionStorage.getItem("currentUser");
    const savedTime = sessionStorage.getItem("sessionTime");
    if (!saved || !savedTime) return false;
    if (Date.now() - parseInt(savedTime) > INACTIVITY_MS) {
        clearSession();
        return false;
    }
    currentUser = JSON.parse(saved);
    return true;
}

function doLogout() {
    clearSession();
    clearTimeout(inactivityTimer);
    currentUser = null;
    Object.values(allLayers).forEach(l => { if (map) map.removeLayer(l); });
    allLayers = {}; allData = {}; allFeatures = {};
    selectedItems = {};
    if (window.contractorMap) window.contractorMap = {};
    if (window.activeContractorFilter) window.activeContractorFilter.clear();
    document.getElementById("mainApp").classList.remove("visible");
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginEmail").value    = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginError").style.display = "none";
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown').forEach(p => p.classList.remove('active'));
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (currentUser) {
            showAlert("⏰ انتهت جلستك بسبب عدم النشاط", "error");
            setTimeout(doLogout, 2000);
        }
    }, INACTIVITY_MS);
}

function initInactivityWatcher() {
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev => {
        document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
}