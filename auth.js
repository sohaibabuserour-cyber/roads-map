/* ====================================================
   LOGIN + SESSION
   ==================================================== */

// CSV parser (handles quotes)
function parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (ch === '"') {
            if (inQ && line[i+1] === '"') {
                cur += '"';
                i++;
            } else {
                inQ = !inQ;
            }
        } else if (ch === ',' && !inQ) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }

    result.push(cur.trim());
    return result;
}

// fetch users from Google Sheet
async function fetchUsers() {
    const url = `https://docs.google.com/spreadsheets/d/${USERS_SHEET_ID}/export?format=csv&gid=0`;

    const r   = await fetch(url);
    const csv = await r.text();

    const lines   = csv.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase());

    const users = [];

    for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const obj  = {};

        headers.forEach((h, idx) => {
            obj[h] = vals[idx] || "";
        });

        users.push(obj);
    }

    return users;
}

// toggle password visibility
function togglePasswordVisibility() {
    const input = document.getElementById("loginPassword");
    const btn   = document.getElementById("togglePassword");

    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
        btn.style.opacity = "1";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
        btn.style.opacity = "0.6";
    }
}

// login
async function doLogin() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pass  = document.getElementById("loginPassword").value.trim();

    if (!email || !pass) {
        showLoginError("يرجى إدخال البريد وكلمة المرور");
        return;
    }

    document.getElementById("loginLoading").style.display = "block";
    document.getElementById("loginError").style.display   = "none";
    document.getElementById("loginBtn").disabled = true;

    try {
        const users = await fetchUsers();

        const found = users.find(u =>
            u["EMAIL"] && u["EMAIL"].toLowerCase() === email &&
            u["PASSWORD"] && u["PASSWORD"] === pass
        );

        if (!found) {
            showLoginError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
            return;
        }

        currentUser = {
            email  : found["EMAIL"],
            name   : found["NAME"] || found["EMAIL"],
            role   : found["ROLE"] || "2",
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

// show login error
function showLoginError(msg) {
    const el = document.getElementById("loginError");
    el.textContent = msg;
    el.style.display = "block";
}

// session save
function saveSession(user) {
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("sessionTime", Date.now().toString());
}

// clear session
function clearSession() {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("sessionTime");
    sessionStorage.removeItem("selectedStatuses");
    sessionStorage.removeItem("selectedItems");
}

// restore session
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