// ====================================================
// CATEGORIES CONFIG & SIDEBAR RENDERING
// ====================================================

async function loadCategoriesConfig() {
    try {
        const r = await fetch(CONFIG_FILE + "?t=" + Date.now());
        if (!r.ok) throw new Error("not found");
        const data = await r.json();
        categories = Array.isArray(data) ? data : (data.categories || []);
        if (!Array.isArray(data) && data.defaultCoords) {
            defaultCoords = data.defaultCoords;
            localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
        }
        if (!Array.isArray(data) && data.similarGroups) {
            similarGroups = data.similarGroups;
            localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
        }
        if (!Array.isArray(data) && data.defaultSubNumber !== undefined) {
            defaultSubNumber = data.defaultSubNumber || "";
            localStorage.setItem('defaultSubNumber', defaultSubNumber);
        }
        if (!Array.isArray(data) && data.equipmentTypes && Array.isArray(data.equipmentTypes)) {
            if (window.equipmentTypes) window.equipmentTypes = data.equipmentTypes;
        }
    } catch(e) {
        console.warn("categories.json not found — starting empty");
        categories = [];
    }
    categories.forEach(c => { if (!c.subitems) c.subitems = []; if (!c.id) c.id = uid(); });
}

function renderItems() {
    const section = document.getElementById("itemsSection");
    section.innerHTML = "";
    const isAdmin = currentUser && currentUser.isAdmin;

    categories.forEach(cat => {
        const div = document.createElement("div");
        div.className = "sidebar-section";
        div.dataset.catId = cat.id;

        const catLabel = (cat.number ? `<span style="font-size:9px;opacity:0.7;margin-left:3px;background:rgba(255,255,255,0.15);padding:1px 5px;border-radius:4px;">${cat.number}</span>` : '') + cat.emoji + ' ' + cat.name;

        div.innerHTML = `
            <div class="section-title">
                <button class="expand-btn" data-cat="${cat.id}">+</button>
                <span class="section-title-text">${catLabel}</span>
                ${isAdmin ? `<button class="del-cat-btn admin-only" onclick="deleteCategory('${cat.id}')">✕</button>` : ""}
            </div>
            <div class="dropdown-items" data-cat="${cat.id}">
                ${cat.subitems.map(sub => {
                    const numBadge = sub.number
                        ? `<span style="font-size:9px;font-weight:700;color:var(--purple);background:rgba(106,45,145,0.1);padding:1px 5px;border-radius:4px;flex-shrink:0;border:1px solid rgba(106,45,145,0.2);">${sub.number}</span>`
                        : '';
                    const missingData = !sub.sheetId || !sub.geoJsonFile;
                    const warningIcon = (isAdmin && missingData)
                        ? `<span title="بيانات مفقودة — دبل كليك للتعديل" style="color:#ff9800;font-size:11px;flex-shrink:0;">⚠️</span>`
                        : '';
                    return `
                    <div class="dropdown-item ${selectedItems[sub.id]?'selected':''}" data-sub="${sub.id}"
                         ${isAdmin ? `title="دبل كليك لتعديل البند"` : ''}>
                        <input type="checkbox" class="subitem-cb"
                            data-sub-id="${sub.id}"
                            data-cat-id="${cat.id}"
                            data-sheet="${sub.sheetId}"
                            data-geo="${sub.geoJsonFile}"
                            ${selectedItems[sub.id]?'checked':''}>
                        ${numBadge}
                        <label style="flex:1">${sub.name}</label>
                        ${warningIcon}
                        ${isAdmin ? `<button class="del-sub-btn admin-only" onclick="deleteSubitem('${cat.id}','${sub.id}')">✕</button>` : ""}
                    </div>`;
                }).join('')}
                ${isAdmin ? `<div class="add-sub-row admin-only" onclick="openAddSubitemModalFor('${cat.id}')">+ إضافة فرعي</div>` : ""}
            </div>`;

        section.appendChild(div);

        div.querySelector(".expand-btn").addEventListener("click", function() {
            this.classList.toggle("active");
            div.querySelector(".dropdown-items").classList.toggle("active");
        });

        div.querySelectorAll(".subitem-cb").forEach(cb => {
            cb.addEventListener("change", function() {
                handleSubitemToggle(this.dataset.catId, this.dataset.subId, this.dataset.sheet, this.dataset.geo, this.checked);
            });
        });

        if (isAdmin) {
            div.querySelectorAll(".dropdown-item[data-sub]").forEach(item => {
                item.addEventListener("dblclick", function(e) {
                    if (e.target.closest('.del-sub-btn') || e.target.closest('.subitem-cb')) return;
                    const subId = this.dataset.sub;
                    if (window.openEditSubitemModal) window.openEditSubitemModal(cat.id, subId);
                });
            });
        }
    });

    const sel = document.getElementById("inSubCat");
    if (sel) {
        sel.innerHTML = '<option value="">-- اختر --</option>';
        categories.forEach(c => {
            const o = document.createElement("option");
            o.value = c.id;
            o.textContent = (c.number ? `[${c.number}] ` : '') + c.name;
            sel.appendChild(o);
        });
    }
}

function getGroupForSub(subId) {
    return similarGroups.find(g => g.subIds.includes(subId)) || null;
}

function handleSubitemToggle(catId, subId, sheetId, geoFile, checked) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    if (checked) {
        const myGroup = getGroupForSub(subId);
        const alreadySelected = Object.keys(selectedItems);
        let conflict = false;

        for (const selId of alreadySelected) {
            if (selId === subId) continue;
            const selGroup = getGroupForSub(selId);
            if (!myGroup || !selGroup || myGroup.id !== selGroup.id) {
                conflict = true;
                break;
            }
        }

        if (conflict) {
            const allSubItems = categories.flatMap(c => c.subitems);
            Object.keys(selectedItems).forEach(selSubId => {
                if (selSubId === subId) return;
                const selSub = allSubItems.find(s => s.id === selSubId);
                if (!selSub) { delete selectedItems[selSubId]; return; }
                loadTokens[selSub.sheetId] = null;
                if (allLayers[selSub.sheetId]) { map.removeLayer(allLayers[selSub.sheetId]); delete allLayers[selSub.sheetId]; }
                delete allData[selSub.sheetId];
                delete selectedItems[selSubId];
            });
        }

        if (window.activeContractorFilter && window.activeContractorFilter.size > 0) {
            const contractorSheets = new Set([...window.activeContractorFilter].map(k => k.split('|')[0]));
            window.activeContractorFilter.clear();
            contractorSheets.forEach(sid => {
                const usedBySidebar = categories.flatMap(c => c.subitems)
                    .some(s => s.sheetId === sid && selectedItems[s.id]);
                if (!usedBySidebar) {
                    loadTokens[sid] = null;
                    if (allLayers[sid]) { map.removeLayer(allLayers[sid]); delete allLayers[sid]; }
                    delete allData[sid];
                }
            });
        }

        selectedItems[subId] = true;
        const sub = cat.subitems.find(s => s.id === subId);
        if (sub) loadLayer(sheetId, sub.name, geoFile, catId);

    } else {
        delete selectedItems[subId];
        removeLayer(sheetId);
        refreshLayerColors();
    }

    renderItems();
    if (window.updateNavTabsState) window.updateNavTabsState();
    if (window.updateStats) window.updateStats();
    if (window.syncContractorCheckboxes) window.syncContractorCheckboxes();
}

function buildNavTabs() {
    const tabsEl = document.getElementById("navTabs");
    document.querySelectorAll('.bunood-sub-flyout').forEach(el => el.remove());
    const oldMainDd = document.getElementById('bunoodMainDd');
    if (oldMainDd) oldMainDd.remove();
    tabsEl.innerHTML = "";

    if (!categories.length) return;

    const tab = document.createElement("div");
    tab.className = "nav-tab nav-tab-bunood";
    tab.id = "navTabBunood";
    tab.innerHTML = `<span>📋 البنود</span>`;
    tabsEl.appendChild(tab);

    const mainDd = document.createElement("div");
    mainDd.className = "tab-sub-dropdown bunood-main-dd";
    mainDd.id = "bunoodMainDd";
    document.body.appendChild(mainDd);

    categories.forEach(cat => {
        const catRow = document.createElement("div");
        catRow.className = "bunood-cat-row";
        catRow.dataset.catId = cat.id;
        catRow.innerHTML = `
            <span class="bunood-cat-label">${cat.emoji} ${cat.number ? '<span style="font-size:9px;opacity:0.65;margin-left:3px;">['+cat.number+']</span>' : ''} ${cat.name}</span>
            <span class="bunood-cat-arrow">&#x25B6;</span>`;

        const subDd = document.createElement("div");
        subDd.className = "bunood-sub-flyout";
        subDd.id = "bunoodSub_" + cat.id;
        document.body.appendChild(subDd);

        if (cat.subitems.length) {
            cat.subitems.forEach(sub => {
                const subRow = document.createElement("div");
                subRow.className = "tab-sub-item bunood-sub-item";
                subRow.innerHTML = `
                    <input type="checkbox" id="tabcb_${sub.id}"
                        data-sub-id="${sub.id}"
                        data-cat-id="${cat.id}"
                        data-sheet="${sub.sheetId}"
                        data-geo="${sub.geoJsonFile}">
                    <label for="tabcb_${sub.id}">
                        ${sub.number ? `<span style="font-size:9px;opacity:0.6;margin-left:4px;">${sub.number}</span>` : ''}
                        ${sub.name}
                    </label>`;
                subRow.querySelector('input').addEventListener('change', function(e) {
                    e.stopPropagation();
                    handleSubitemToggle(this.dataset.catId, this.dataset.subId, this.dataset.sheet, this.dataset.geo, this.checked);
                });
                subDd.appendChild(subRow);
            });
        } else {
            subDd.innerHTML = '<div style="padding:10px 14px;color:#aaa;font-size:11px;text-align:right">لا توجد بنود فرعية</div>';
        }

        catRow.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = catRow.classList.contains('bunood-cat-open');
            document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
            mainDd.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
            if (!isOpen) {
                catRow.classList.add('bunood-cat-open');
                const catRect  = catRow.getBoundingClientRect();
                const mainRect = mainDd.getBoundingClientRect();
                subDd.style.display = 'flex';
                subDd.style.top = catRect.top + 'px';
                const subW = 230;
                const spaceRight = window.innerWidth - mainRect.right;
                if (spaceRight >= subW) {
                    subDd.style.left  = mainRect.right + 'px';
                    subDd.style.right = 'auto';
                } else {
                    subDd.style.right = (window.innerWidth - mainRect.left) + 'px';
                    subDd.style.left  = 'auto';
                }
            }
        });

        subDd.addEventListener('click', e => e.stopPropagation());
        mainDd.appendChild(catRow);
    });

    tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mainDd.style.display === 'flex';
        document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
        mainDd.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
        if (isOpen) {
            mainDd.style.display = 'none';
        } else {
            const rect = tab.getBoundingClientRect();
            mainDd.style.left  = rect.left + 'px';
            mainDd.style.right = 'auto';
            mainDd.style.display = 'flex';
            setTimeout(() => {
                const ddRect = mainDd.getBoundingClientRect();
                if (ddRect.right > window.innerWidth - 8) {
                    mainDd.style.left = 'auto';
                    mainDd.style.right = (window.innerWidth - rect.right) + 'px';
                }
            }, 0);
        }
    });

    mainDd.addEventListener('click', e => e.stopPropagation());

    if (!window._bunoodClickListenerAdded) {
        window._bunoodClickListenerAdded = true;
        document.addEventListener('click', () => {
            const md = document.getElementById('bunoodMainDd');
            if (md) md.style.display = 'none';
            document.querySelectorAll('.bunood-sub-flyout').forEach(d => d.style.display = 'none');
            document.querySelectorAll('.bunood-cat-row').forEach(r => r.classList.remove('bunood-cat-open'));
        });
    }

    updateNavTabsState();
}

function updateNavTabsState() {
    const tab = document.getElementById('navTabBunood');
    if (!tab) return;

    const hasAnyActive = categories.some(cat => cat.subitems.some(s => selectedItems[s.id]));
    tab.classList.toggle('active', hasAnyActive);

    categories.forEach(cat => {
        const catHasActive = cat.subitems.some(s => selectedItems[s.id]);
        const catRow = document.querySelector(`.bunood-cat-row[data-cat-id="${cat.id}"]`);
        if (catRow) catRow.classList.toggle('bunood-cat-active', catHasActive);

        cat.subitems.forEach(sub => {
            const cb = document.getElementById('tabcb_' + sub.id);
            if (cb) cb.checked = !!selectedItems[sub.id];
        });
    });
}

function renderNavTabs() {
    buildNavTabs();
}