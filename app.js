/* =============================================
   GLOBALS
============================================= */
let map = null;
let currentUser = null;

/* =============================================
   INIT
============================================= */
document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("loginBtn");

    if (btn) {
        btn.addEventListener("click", doLogin);
    }

});


/* =============================================
   LOGIN
============================================= */
function showLoginError(msg) {
    const el = document.getElementById("loginError");
    if (el) {
        el.textContent = msg;
        el.style.display = "block";
    }
}

function doLogin() {

    const email = document.getElementById("loginEmail")?.value.trim();
    const pass  = document.getElementById("loginPassword")?.value.trim();

    if (!email || !pass) {
        showLoginError("أدخل البريد وكلمة المرور");
        return;
    }

    const load = document.getElementById("loginLoading");
    if (load) load.style.display = "block";

    // ✅ نسخة بسيطة بدون Google Sheet
    currentUser = {
        email: email,
        name: "User",
        isAdmin: true
    };

    setTimeout(() => {
        enterApp();
    }, 500);
}


/* =============================================
   ENTER APP
============================================= */
function enterApp() {

    const login = document.getElementById("loginScreen");
    const main  = document.getElementById("mainApp");

    if (login) login.style.display = "none";
    if (main)  main.style.display  = "block";

    initMap();
}


/* =============================================
   MAP
============================================= */
function initMap() {

    if (map) return;

    const mapDiv = document.getElementById("map");
    if (!mapDiv) {
        console.error("map div not found");
        return;
    }

    map = L.map('map').setView([21.5, 39.2], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

}


/* =============================================
   HELPERS
============================================= */
function showAlert(msg) {
    alert(msg);
}
