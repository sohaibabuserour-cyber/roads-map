// ====================================================
// CONTRACTOR PANEL
// ====================================================

let contractorMap         = {};
let activeContractorFilter = new Set();
let contractorsLoaded     = false;
let _activeContractorTab = 'contractor';

async function buildContractorPanel({ forceRefresh = false } = {}) {
    const list = document.getElementById("contractorList");
    if (!list) return;

    if (contractorsLoaded && !forceRefresh) {
        renderContractorList();
        return;
    }

    list.innerHTML = '<div class="contractor-empty">⏳ جاري التحميل...</div>';

    contractorMap = {};
    const allSubs = [];
    categories.forEach(cat => cat.subitems.forEach(sub => allSubs.push(sub)));

    if (!allSubs.length) {
        list.innerHTML = '<div class="contractor-empty">لا توجد بنود مضافة بعد</div>';
        return;
    }

    await Promise.all(allSubs.map(sub => fetchSheetContractors(sub)));
    contractorsLoaded = true;
    renderContractorList();
}

async function fetchSheetContractors(sub) {
    const cat = categories.find(c => c.subitems.some(s => s.id === sub.id));

    const addEntry = (cname) => {
        if (!contractorMap[cname]) contractorMap[cname] = [];
        if (!contractorMap[cname].find(e => e.subId === sub.id)) {
            contractorMap[cname].push({
                catId       : cat ? cat.id    : "",
                catName     : cat ? cat.name  : "",
                catEmoji    : cat ? cat.emoji : "📍",
                catOrder    : categories.indexOf(cat),
                subId       : sub.id,
                subName     : sub.name,
                sheetId     : sub.sheetId,
                geoJsonFile : sub.geoJsonFile
            });
        }
    };

    if (allData[sub.sheetId]) {
        Object.values(allData[sub.sheetId]).forEach(row => {
            const cname = (row["CONTRACTOR"] || "").trim();
            if (cname) addEntry(cname);
        });
        return;
    }

    try {
        const url  = `https://docs.google.com/spreadsheets/d/${sub.sheetId}/export?format=csv&gid=0`;
        const r    = await fetch(url);
        if (!r.ok) return;
        const csv  = await r.text();
        if (csv.trim().startsWith('<')) return;
        const lines   = csv.split('\n').filter(l => l.trim());
        if (!lines.length) return;
        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        const cIdx    = headers.findIndex(h => h === 'CONTRACTOR');
        if (cIdx === -1) return;
        for (let i = 1; i < lines.length; i++) {
            const vals  = lines[i].split(',').map(v => v.trim());
            const cname = (vals[cIdx] || "").trim();
            if (cname) addEntry(cname);
        }
    } catch(e) { console.warn("contractor fetch failed:", sub.name, e); }
}

function renderContractorList() {
    const list = document.getElementById("contractorList");
    if (!list) return;

    const names = Object.keys(contractorMap).sort((a,b) => a.localeCompare(b, 'ar'));

    if (!names.length) {
        list.innerHTML = '<div class="contractor-empty">لم يتم العثور على مقاولين</div>';
        return;
    }

    list.innerHTML = names.map(name => {
        const subs = [...contractorMap[name]].sort((a, b) => {
            if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
            const cat = categories.find(c => c.id === a.catId);
            if (!cat) return 0;
            return cat.subitems.findIndex(s => s.id === a.subId) -
                   cat.subitems.findIndex(s => s.id === b.subId);
        });

        const byCategory = {};
        subs.forEach(s => {
            if (!byCategory[s.catId]) byCategory[s.catId] = { label: `${s.catEmoji} ${s.catName}`, items: [] };
            byCategory[s.catId].items.push(s);
        });

        const subsHTML = Object.values(byCategory).map(group => `
            <div class="c-cat-group">
                <div class="c-cat-label">${group.label}</div>
                ${group.items.map(s => {
                    const filterKey = s.sheetId + '|' + name;
                    const checked   = activeContractorFilter.has(filterKey) ? 'checked' : '';
                    return `
                    <div class="contractor-subitem">
                        <input type="checkbox" class="contractor-cb"
                            data-cat-id="${s.catId}"
                            data-sub-id="${s.subId}"
                            data-sheet="${s.sheetId}"
                            data-geo="${s.geoJsonFile}"
                            data-contractor="${name}"
                            data-filter-key="${filterKey}"
                            ${checked}
                            onclick="event.stopPropagation()">
                        <label>${s.subName}</label>
                    </div>`;
                }).join('')}
            </div>`).join('');

        return `
        <div class="contractor-item">
            <div class="contractor-name" onclick="toggleContractor(this)">
                <span>${name}</span>
                <div style="display:flex;align-items:center;gap:5px">
                    <span class="contractor-count">${subs.length}</span>
                    <span class="c-arrow">◀</span>
                </div>
            </div>
            <div class="contractor-subitems">
                ${subsHTML}
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.contractor-cb').forEach(cb => {
        cb.addEventListener('change', function() {
            handleContractorCheckbox(this);
        });
    });
}

function handleContractorCheckbox(cb) {
    const filterKey = cb.dataset.filterKey;
    const sheetId   = cb.dataset.sheet;
    const geoFile   = cb.dataset.geo;
    const catId     = cb.dataset.catId;
    const subId     = cb.dataset.subId;

    if (cb.checked) {
        const newSub      = categories.flatMap(c => c.subitems).find(s => s.id === subId);
        const newSubGroup = newSub ? getGroupForSub(newSub.id) : null;

        const activeSheets = new Set([...activeContractorFilter].map(k => k.split('|')[0]));
        const sheetsToRemove = new Set();

        activeSheets.forEach(sid => {
            if (sid === sheetId) return;
            const existingSub   = categories.flatMap(c => c.subitems).find(s => s.sheetId === sid);
            const existingGroup = existingSub ? getGroupForSub(existingSub.id) : null;
            const conflict = !newSubGroup || !existingGroup || newSubGroup.id !== existingGroup.id;
            if (conflict) sheetsToRemove.add(sid);
        });

        sheetsToRemove.forEach(sid => {
            [...activeContractorFilter].forEach(k => {
                if (k.startsWith(sid + '|')) activeContractorFilter.delete(k);
            });
            loadTokens[sid] = null;
            if (allLayers[sid]) { map.removeLayer(allLayers[sid]); delete allLayers[sid]; }
            delete allData[sid];
        });

        categories.flatMap(c => c.subitems).forEach(s => {
            if (selectedItems[s.id]) {
                loadTokens[s.sheetId] = null;
                if (allLayers[s.sheetId]) { map.removeLayer(allLayers[s.sheetId]); delete allLayers[s.sheetId]; }
                delete allData[s.sheetId];
                delete selectedItems[s.id];
            }
        });

        activeContractorFilter.add(filterKey);

        if (!allLayers[sheetId]) {
            if (newSub) loadLayer(sheetId, newSub.name, geoFile, catId);
        } else {
            applyContractorFilter();
        }

    } else {
        activeContractorFilter.delete(filterKey);
        const stillActive = [...activeContractorFilter].some(k => k.startsWith(sheetId + '|'));
        if (!stillActive) {
            loadTokens[sheetId] = null;
            if (allLayers[sheetId]) { map.removeLayer(allLayers[sheetId]); delete allLayers[sheetId]; }
            delete allData[sheetId];
        } else {
            applyContractorFilter();
        }
    }

    renderItems();
    updateNavTabsState();
    if (window.updateStats) window.updateStats();
    syncContractorCheckboxes();
}

function applyContractorFilter() {
    if (!activeContractorFilter.size) {
        refreshLayerColors();
        return;
    }

    Object.entries(allLayers).forEach(([sheetId, layer]) => {
        if (!layer || !allData[sheetId]) return;

        const activeForSheet = [...activeContractorFilter]
            .filter(k => k.startsWith(sheetId + '|'))
            .map(k => k.split('|')[1].trim().toLowerCase());

        const isWildcard = activeForSheet.includes('*');

        layer.eachLayer(f => {
            const row = allData[sheetId][f.feature.properties.ID];
            if (!row) return;
            const featureCon = (row["CONTRACTOR"] || "").trim().toLowerCase();
            const match = activeForSheet.length === 0 || isWildcard ||
                          activeForSheet.includes(featureCon);

            if (match) {
                f.setStyle(featureStyle(row));
                f.setZIndexOffset && f.setZIndexOffset(100);
            } else {
                f.setStyle({ color: '#aaaaaa', fillColor: '#cccccc', fillOpacity: 0.18, weight: 1 });
            }
        });
    });
}

function syncContractorCheckboxes() {
    document.querySelectorAll('.contractor-cb').forEach(cb => {
        cb.checked = activeContractorFilter.has(cb.dataset.filterKey);
    });
}

function toggleContractor(el) {
    const subitems = el.nextElementSibling;
    const isOpen   = subitems.classList.contains('active');
    document.querySelectorAll('.contractor-name.open').forEach(e => {
        e.classList.remove('open');
        e.nextElementSibling.classList.remove('active');
    });
    if (!isOpen) {
        el.classList.add('open');
        subitems.classList.add('active');
    }
}

function switchContractorTab(tab) {
    _activeContractorTab = tab;
    const isContractor = tab === 'contractor';

    document.getElementById('contractorTabContractor').style.display = isContractor ? 'block' : 'none';
    document.getElementById('contractorTabGroup').style.display      = isContractor ? 'none'  : 'block';

    const btnC = document.getElementById('cTabContractor');
    const btnG = document.getElementById('cTabGroup');
    if (btnC) {
        btnC.style.background = isContractor ? 'rgba(255,255,255,0.9)' : 'transparent';
        btnC.style.color      = isContractor ? '#6a2d91' : 'rgba(255,255,255,0.75)';
    }
    if (btnG) {
        btnG.style.background = !isContractor ? 'rgba(255,255,255,0.9)' : 'transparent';
        btnG.style.color      = !isContractor ? '#6a2d91' : 'rgba(255,255,255,0.75)';
    }

    if (!isContractor) renderContractorGroupList();
}

function renderContractorGroupList() {
    const list = document.getElementById('contractorGroupList');
    if (!list) return;

    const groupedSubIds = new Set(similarGroups.flatMap(g => g.subIds));

    const soloGroups = [];
    categories.forEach(cat => {
        cat.subitems.forEach(sub => {
            if (!groupedSubIds.has(sub.id)) {
                soloGroups.push({ id: 'solo_' + sub.id, name: sub.name, subIds: [sub.id] });
            }
        });
    });

    const allGroups = [...similarGroups, ...soloGroups];

    const countContractors = (group) => {
        const s = new Set();
        group.subIds.forEach(sid => {
            const sub = categories.flatMap(c => c.subitems).find(x => x.id === sid);
            if (!sub) return;
            if (allData[sub.sheetId]) {
                Object.values(allData[sub.sheetId]).forEach(row => {
                    const c = (row['CONTRACTOR'] || '').trim(); if (c) s.add(c);
                });
            }
            if (contractorMap) {
                Object.keys(contractorMap).forEach(name => {
                    if (contractorMap[name].some(e => e.subId === sid)) s.add(name);
                });
            }
        });
        return s.size;
    };

    const groupRows = [];
    allGroups.forEach(group => {
        const contractorCount = countContractors(group);
        if (!contractorCount) return;

        const isActive = group.subIds.some(sid => {
            const sub = categories.flatMap(c => c.subitems).find(s => s.id === sid);
            return sub && [...activeContractorFilter].some(k => k.startsWith(sub.sheetId + '|'));
        });

        groupRows.push(
            '<div class="cgroup-row ' + (isActive ? 'active-group' : '') + '" onclick="toggleGroupFilter(\'' + group.id + '\', this)">' +
            '<input type="checkbox" class="cgroup-cb" data-group-id="' + group.id + '" ' + (isActive ? 'checked' : '') + ' onclick="event.stopPropagation()">' +
            '<div class="cgroup-row-info"><div class="cgroup-row-name">' + (group.name || 'مجموعة') + '</div></div>' +
            '<span class="cgroup-row-badge">' + contractorCount + ' مقاول</span>' +
            '</div>'
        );
    });

    if (!groupRows.length) {
        list.innerHTML = '<div class="cgroup-no-groups">لا توجد بنود بها مقاولين بعد<br><span style="font-size:10px;opacity:0.7;">تأكد من تحميل البيانات أولاً</span></div>';
        return;
    }

    list.innerHTML = groupRows.join('');

    list.querySelectorAll('.cgroup-cb').forEach(cb => {
        cb.addEventListener('change', function(e) {
            e.stopPropagation();
            toggleGroupFilter(this.dataset.groupId, this.closest('.cgroup-row'));
        });
    });
}

async function toggleGroupFilter(groupId, rowEl) {
    let group = similarGroups.find(g => g.id === groupId);
    if (!group && groupId.startsWith('solo_')) {
        const subId = groupId.replace('solo_', '');
        const sub   = categories.flatMap(c => c.subitems).find(s => s.id === subId);
        if (sub) group = { id: groupId, name: sub.name, subIds: [subId] };
    }
    if (!group) return;

    const cb = rowEl ? rowEl.querySelector('.cgroup-cb') : null;

    const anyActive = group.subIds.some(sid => {
        const sub = categories.flatMap(c => c.subitems).find(s => s.id === sid);
        return sub && [...activeContractorFilter].some(k => k.startsWith(sub.sheetId + '|'));
    });

    if (anyActive) {
        group.subIds.forEach(sid => {
            const sub = categories.flatMap(c => c.subitems).find(s => s.id === sid);
            if (!sub) return;
            [...activeContractorFilter].forEach(k => {
                if (k.startsWith(sub.sheetId + '|')) activeContractorFilter.delete(k);
            });
            const stillUsed = [...activeContractorFilter].some(k => k.startsWith(sub.sheetId + '|'));
            if (!stillUsed) {
                loadTokens[sub.sheetId] = null;
                if (allLayers[sub.sheetId]) { map.removeLayer(allLayers[sub.sheetId]); delete allLayers[sub.sheetId]; }
                delete allData[sub.sheetId];
            }
        });
        if (rowEl) { rowEl.classList.remove('active-group'); if(cb) cb.checked = false; }

    } else {
        const otherSheets = new Set(
            [...activeContractorFilter]
                .map(k => k.split('|')[0])
                .filter(sid => !group.subIds.some(gsid => {
                    const s = categories.flatMap(c => c.subitems).find(x => x.id === gsid);
                    return s && s.sheetId === sid;
                }))
        );
        otherSheets.forEach(sid => {
            [...activeContractorFilter].forEach(k => { if(k.startsWith(sid+'|')) activeContractorFilter.delete(k); });
            loadTokens[sid] = null;
            if (allLayers[sid]) { map.removeLayer(allLayers[sid]); delete allLayers[sid]; }
            delete allData[sid];
        });

        categories.flatMap(c => c.subitems).forEach(s => {
            if (selectedItems[s.id]) {
                loadTokens[s.sheetId] = null;
                if (allLayers[s.sheetId]) { map.removeLayer(allLayers[s.sheetId]); delete allLayers[s.sheetId]; }
                delete allData[s.sheetId];
                delete selectedItems[s.id];
            }
        });

        for (const sid of group.subIds) {
            const sub = categories.flatMap(c => c.subitems).find(s => s.id === sid);
            if (!sub || !sub.sheetId || !sub.geoJsonFile) continue;
            const cat = categories.find(c => c.subitems.some(s => s.id === sid));
            if (!cat) continue;

            const contractors = getContractorsForSheet(sub.sheetId);

            if (contractors.length) {
                contractors.forEach(name => {
                    activeContractorFilter.add(sub.sheetId + '|' + name);
                });
            } else {
                activeContractorFilter.add(sub.sheetId + '|*');
            }

            if (!allLayers[sub.sheetId]) {
                loadLayer(sub.sheetId, sub.name, sub.geoJsonFile, cat.id);
            }
        }

        if (rowEl) { rowEl.classList.add('active-group'); if(cb) cb.checked = true; }
    }

    document.querySelectorAll('.cgroup-row').forEach(r => {
        const gid = r.querySelector('.cgroup-cb')?.dataset.groupId;
        if (gid && gid !== groupId && !anyActive) {
            r.classList.remove('active-group');
            const rcb = r.querySelector('.cgroup-cb');
            if (rcb) rcb.checked = false;
        }
    });

    renderItems();
    updateNavTabsState();
    if (window.updateStats) window.updateStats();
    syncContractorCheckboxes();
    setTimeout(() => renderContractorGroupList(), 300);
}

function getContractorsForSheet(sheetId) {
    const names = [];
    Object.keys(contractorMap).forEach(name => {
        if (contractorMap[name].some(e => e.sheetId === sheetId)) names.push(name);
    });
    return names;
}