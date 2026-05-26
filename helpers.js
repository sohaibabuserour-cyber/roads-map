// ====================================================
// HELPERS
// ====================================================

function fmtNum(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return v || "";
    return n.toLocaleString('en-US');
}

function toNum(v) { return (!isNaN(v) && v !== "") ? Number(v) : 0; }

function statusColor(s) {
    const STATUSES = [
        { value: "جاري",        color: "#3aaa5c" },
        { value: "متاح",        color: "#2196f3" },
        { value: "غير متاح",    color: "#ff9800" },
        { value: "تم الانتهاء", color: "#9c27b0" },
        { value: "متوقف",       color: "#f44336" }
    ];
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.color : "#9e9e9e";
}

function statusCls(s) {
    const STATUSES = [
        { value: "جاري",        cls: "ongoing"     },
        { value: "متاح",        cls: "available"   },
        { value: "غير متاح",    cls: "unavailable" },
        { value: "تم الانتهاء", cls: "completed"   },
        { value: "متوقف",       cls: "stopped"     }
    ];
    const f = STATUSES.find(x => x.value.toLowerCase() === (s||"").trim().toLowerCase());
    return f ? f.cls : "";
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

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

function openModal(id)  { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }

function togglePanel(id) {
    const panel = document.getElementById(id);
    const isOpen = panel.classList.contains("active");
    document.querySelectorAll('.notif-panel,.theme-panel,.user-dropdown,.coords-panel,.contractor-panel,.settings-panel').forEach(p => p.classList.remove('active'));
    if (!isOpen) {
        panel.classList.add("active");
        if (id === 'settingsPanel') {
            const sl = document.getElementById("settingsLat"); if(sl) sl.value = window.defaultCoords?.lat || "";
            const sg = document.getElementById("settingsLng"); if(sg) sg.value = window.defaultCoords?.lng || "";
            const sz = document.getElementById("settingsZoom"); if(sz) sz.value = window.defaultCoords?.zoom || "";
            const sd = document.getElementById("settingsDefaultSub"); if(sd) sd.value = window.defaultSubNumber || "";
            if (window.renderDefaultSubPreview) window.renderDefaultSubPreview();
            if (window.renderEquipmentTypesList) window.renderEquipmentTypesList();
            if (window.updateEqTypesCount) window.updateEqTypesCount();
        }
        if (id === 'contractorPanel' && window._activeContractorTab === 'group') {
            if (window.renderContractorGroupList) window.renderContractorGroupList();
        }
    }
}

function parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            result.push(cur.trim()); cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur.trim());
    return result;
}

function togglePasswordVisibility() {
    const input = document.getElementById("loginPassword");
    const btn = document.getElementById("togglePassword");
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