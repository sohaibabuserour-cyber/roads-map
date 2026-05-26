// ====================================================
// ADMIN FUNCTIONS (categories, subitems, config)
// ====================================================

function exportConfig() {
    const payload = JSON.stringify({
        categories: categories,
        defaultCoords: defaultCoords,
        similarGroups: similarGroups,
        defaultSubNumber: defaultSubNumber,
        equipmentTypes: window.equipmentTypes,
        selectedItems: selectedItems,
        selectedStatuses: selectedStatuses,
        activeContractorFilter: [...activeContractorFilter],
        currentTheme: localStorage.getItem('mapTheme') || '',
        navRightOrder: (function() {
            const order = [];
            document.querySelectorAll('.nav-right > div').forEach(div => {
                const btn = div.querySelector('.nav-icon-btn, .user-chip');
                if (btn && btn.id) order.push(btn.id);
            });
            return order;
        })()
    }, null, 2);
    const blob    = new Blob([payload], { type: "application/json" });
    const link    = document.createElement("a");
    link.href     = URL.createObjectURL(blob);
    link.download = "categories.json";
    link.click();
    showAlert("✅ تم تحميل categories.json — ارفعه على GitHub يدوياً", "success");
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            categories = Array.isArray(data) ? data : (data.categories || []);
            categories.forEach(c => { if (!c.subitems) c.subitems = []; if (!c.id) c.id = uid(); });
            if (!Array.isArray(data) && data.defaultCoords) {
                defaultCoords = data.defaultCoords;
                localStorage.setItem('defaultCoords', JSON.stringify(defaultCoords));
                if (map) map.setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom);
                syncCoordsInputs();
            }
            if (!Array.isArray(data)) {
                if (data.similarGroups) {
                    similarGroups = data.similarGroups;
                    localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
                }
                if (data.defaultSubNumber !== undefined) {
                    defaultSubNumber = data.defaultSubNumber || "";
                    localStorage.setItem('defaultSubNumber', defaultSubNumber);
                }
                if (data.equipmentTypes && Array.isArray(data.equipmentTypes)) {
                    if (window.equipmentTypes) window.equipmentTypes = data.equipmentTypes;
                    if (window.refreshEquipmentDatalist) window.refreshEquipmentDatalist();
                    if (window.renderEquipmentTypesList) window.renderEquipmentTypesList();
                }
                if (data.selectedItems) selectedItems = data.selectedItems;
                if (data.selectedStatuses) selectedStatuses = data.selectedStatuses;
                if (data.activeContractorFilter) {
                    activeContractorFilter.clear();
                    data.activeContractorFilter.forEach(k => activeContractorFilter.add(k));
                }
                if (data.currentTheme) {
                    applyTheme(data.currentTheme);
                }
                if (data.navRightOrder && Array.isArray(data.navRightOrder)) {
                    const navRight = document.querySelector('.nav-right');
                    if (navRight) {
                        data.navRightOrder.forEach(id => {
                            const el = document.getElementById(id)?.parentElement;
                            if (el) navRight.appendChild(el);
                        });
                    }
                }
            }
            renderItems();
            renderNavTabs();
            if (window.updateStats) window.updateStats();
            showAlert("✅ تم استيراد الإعدادات والحالات", "success");
        } catch { showAlert("❌ الملف غير صالح", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
}

function openAddCategoryModal() {
    document.getElementById("inCatNumber").value = "";
    document.getElementById("inCatName").value  = "";
    document.getElementById("inCatEmoji").value = "📍";
    openModal("modalAddCategory");
}

function addCategory() {
    const number = document.getElementById("inCatNumber").value.trim();
    const name   = document.getElementById("inCatName").value.trim();
    const emoji  = document.getElementById("inCatEmoji").value.trim() || "📍";
    if (!name) { showAlert("❌ يرجى إدخال اسم البند"); return; }
    categories.push({ id: uid(), number, name, emoji, subitems: [] });
    renderItems();
    renderNavTabs();
    closeModal("modalAddCategory");
    showAlert("✅ تمت إضافة البند الرئيسي", "success");
}

let _addSubForCat = null;

function openAddSubitemModal() {
    _addSubForCat = null;
    document.getElementById("inSubNumber").value = "";
    document.getElementById("inSubName").value  = "";
    document.getElementById("inSubSheet").value = "";
    document.getElementById("inSubGeo").value   = "";
    document.getElementById("inSubCat").value   = "";
    openModal("modalAddSubitem");
}

function openAddSubitemModalFor(catId) {
    _addSubForCat = catId;
    document.getElementById("inSubNumber").value = "";
    document.getElementById("inSubName").value  = "";
    document.getElementById("inSubSheet").value = "";
    document.getElementById("inSubGeo").value   = "";
    document.getElementById("inSubCat").value   = catId;
    openModal("modalAddSubitem");
}

function addSubitem() {
    const catId    = document.getElementById("inSubCat").value || _addSubForCat;
    const number   = document.getElementById("inSubNumber").value.trim();
    const name     = document.getElementById("inSubName").value.trim();
    const sheetRaw = document.getElementById("inSubSheet").value.trim();
    const geo      = document.getElementById("inSubGeo").value.trim();
    if (!catId || !name) { showAlert("❌ يرجى اختيار البند الرئيسي وإدخال الاسم"); return; }

    const cat = categories.find(c => c.id === catId);
    if (!cat) { showAlert("❌ البند غير موجود"); return; }

    const sheetId = sheetRaw ? (sheetIdFromUrl(sheetRaw) || sheetRaw) : "";

    cat.subitems.push({ id: uid(), number, name, sheetId, geoJsonFile: geo });
    renderItems();
    renderNavTabs();
    closeModal("modalAddSubitem");
    showAlert("✅ تمت إضافة البند الفرعي" + (!sheetId || !geo ? " — أضف الشيت والـ GeoJSON لاحقاً بدبل كليك" : ""), "success");
}

function deleteCategory(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    if (!confirm(`حذف "${cat.name}" وجميع بنوده الفرعية؟`)) return;
    cat.subitems.forEach(sub => { delete selectedItems[sub.id]; removeLayer(sub.sheetId); });
    categories = categories.filter(c => c.id !== catId);
    renderItems();
    renderNavTabs();
    if (window.updateStats) window.updateStats();
    showAlert("✅ تم الحذف", "success");
}

function deleteSubitem(catId, subId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;
    if (!confirm(`حذف "${sub.name}"؟`)) return;
    delete selectedItems[subId];
    removeLayer(sub.sheetId);
    cat.subitems = cat.subitems.filter(s => s.id !== subId);
    renderItems();
    renderNavTabs();
    if (window.updateStats) window.updateStats();
    showAlert("✅ تم الحذف", "success");
}

function openEditSubitemModal(catId, subId) {
    if (!currentUser || !currentUser.isAdmin) return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;

    document.getElementById("editSubCatId").value  = catId;
    document.getElementById("editSubId").value     = subId;
    document.getElementById("editSubNumber").value = sub.number || "";
    document.getElementById("editSubName").value   = sub.name   || "";
    document.getElementById("editSubGeo").value    = sub.geoJsonFile || "";

    const sheetVal = sub.sheetId || "";
    const sheetUrl = sheetVal.startsWith('http')
        ? sheetVal
        : `https://docs.google.com/spreadsheets/d/${sheetVal}`;
    document.getElementById("editSubSheet").value = sheetUrl;

    const linkEl = document.getElementById("editSubSheetLink");
    if (sheetVal) {
        linkEl.href = sheetUrl;
        linkEl.style.display = "inline-flex";
        linkEl.style.alignItems = "center";
        linkEl.style.gap = "4px";
    } else {
        linkEl.style.display = "none";
    }

    document.getElementById("editSubSheet").oninput = function() {
        const v = this.value.trim();
        const id = sheetIdFromUrl(v) || v;
        if (id) {
            linkEl.href = v.startsWith('http') ? v : `https://docs.google.com/spreadsheets/d/${id}`;
            linkEl.style.display = "inline-flex";
        } else {
            linkEl.style.display = "none";
        }
    };

    openModal("modalEditSubitem");
}

function saveSubitemEdit() {
    const catId    = document.getElementById("editSubCatId").value;
    const subId    = document.getElementById("editSubId").value;
    const number   = document.getElementById("editSubNumber").value.trim();
    const name     = document.getElementById("editSubName").value.trim();
    const sheetRaw = document.getElementById("editSubSheet").value.trim();
    const geo      = document.getElementById("editSubGeo").value.trim();

    if (!name || !sheetRaw || !geo) { showAlert("❌ يرجى ملء الاسم والشيت والـ GeoJSON"); return; }

    const sheetId = sheetIdFromUrl(sheetRaw) || sheetRaw;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const sub = cat.subitems.find(s => s.id === subId);
    if (!sub) return;

    const oldSheetId = sub.sheetId;
    const sheetChanged = oldSheetId !== sheetId;
    const geoChanged = sub.geoJsonFile !== geo;

    sub.number      = number;
    sub.name        = name;
    sub.sheetId     = sheetId;
    sub.geoJsonFile = geo;

    if ((sheetChanged || geoChanged) && selectedItems[subId]) {
        loadTokens[oldSheetId] = null;
        if (allLayers[oldSheetId]) { map.removeLayer(allLayers[oldSheetId]); delete allLayers[oldSheetId]; }
        delete allData[oldSheetId];
        loadLayer(sheetId, name, geo, catId);
    }

    renderItems();
    renderNavTabs();
    closeModal("modalEditSubitem");
    showAlert("✅ تم حفظ التعديلات", "success");
}

function loadSimilarGroups() {
    try {
        const saved = localStorage.getItem('similarGroups');
        if (saved) similarGroups = JSON.parse(saved);
    } catch(e) { similarGroups = []; }
}

function saveSimilarGroupsToStorage() {
    localStorage.setItem('similarGroups', JSON.stringify(similarGroups));
}

function renderSimilarGroupsList() {
    const list = document.getElementById('similarGroupsList');
    if (!list) return;

    if (!similarGroups.length) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-soft);font-size:11px;padding:12px 0;">لا توجد مجموعات بعد</div>';
        return;
    }

    list.innerHTML = similarGroups.map(group => {
        const subNames = group.subIds.map(sid => {
            let name = sid;
            categories.forEach(c => {
                const sub = c.subitems.find(s => s.id === sid);
                if (sub) name = sub.name;
            });
            return name;
        });

        return `
        <div class="similar-group-card">
            <div class="similar-group-card-header">
                <button class="similar-group-del" onclick="deleteSimilarGroup('${group.id}')" title="حذف المجموعة">✕</button>
                <span class="similar-group-name">${group.name || 'مجموعة بدون اسم'}</span>
                <button onclick="openSimilarGroupModal('${group.id}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--purple);font-weight:700;padding:0 4px;" title="تعديل">✎ تعديل</button>
            </div>
            <div class="similar-group-items">
                ${subNames.map(n => `<span class="similar-group-pill">${n}</span>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function deleteSimilarGroup(groupId) {
    similarGroups = similarGroups.filter(g => g.id !== groupId);
    saveSimilarGroupsToStorage();
    renderSimilarGroupsList();
    showAlert("✅ تم حذف المجموعة", "success");
}

function openSimilarGroupModal(editId = null) {
    window._editingGroupId = editId;
    const modal = document.getElementById('similarGroupModal');
    modal.style.display = 'flex';

    const existing = editId ? similarGroups.find(g => g.id === editId) : null;
    document.getElementById('similarGroupNameInput').value = existing ? (existing.name || '') : '';

    const grid = document.getElementById('similarSubitemsGrid');
    grid.innerHTML = '';

    categories.forEach(cat => {
        if (!cat.subitems.length) return;
        const section = document.createElement('div');
        section.className = 'similar-cat-section';
        section.innerHTML = `<div class="similar-cat-label">${cat.emoji} ${cat.name}</div>`;

        cat.subitems.forEach(sub => {
            const row = document.createElement('div');
            row.className = 'similar-subitem-row';

            const isChecked = existing && existing.subIds.includes(sub.id);
            const otherGroup = similarGroups.find(g => g.id !== editId && g.subIds.includes(sub.id));
            const isInOtherGroup = !!otherGroup;

            row.innerHTML = `
                <input type="checkbox" id="sg_${sub.id}"
                    data-sub-id="${sub.id}"
                    ${isChecked ? 'checked' : ''}
                    ${isInOtherGroup ? 'disabled title="هذا البند موجود في مجموعة أخرى: ' + (otherGroup.name || 'بدون اسم') + '"' : ''}>
                <label for="sg_${sub.id}" style="${isInOtherGroup ? 'opacity:0.45;' : ''}">${sub.name}${sub.number ? ' (' + sub.number + ')' : ''}</label>
                ${isInOtherGroup ? `<span class="similar-subitem-cat-badge" title="المجموعة: ${otherGroup.name || 'بدون اسم'}">مُجمَّع</span>` : ''}`;

            if (isChecked) row.classList.add('selected');

            row.addEventListener('click', e => {
                if (isInOtherGroup) return;
                const cb = row.querySelector('input[type="checkbox"]');
                if (e.target !== cb) cb.checked = !cb.checked;
                row.classList.toggle('selected', cb.checked);
            });

            section.appendChild(row);
        });
        grid.appendChild(section);
    });
}

function closeSimilarGroupModal() {
    document.getElementById('similarGroupModal').style.display = 'none';
    window._editingGroupId = null;
}

function saveSimilarGroup() {
    const name = document.getElementById('similarGroupNameInput').value.trim();
    const checked = [...document.querySelectorAll('#similarSubitemsGrid input[type="checkbox"]:checked')]
        .map(cb => cb.dataset.subId);

    if (checked.length < 2) {
        showAlert("❌ اختر بندين فرعيين على الأقل");
        return;
    }

    if (window._editingGroupId) {
        const g = similarGroups.find(g => g.id === window._editingGroupId);
        if (g) { g.name = name || 'مجموعة'; g.subIds = checked; }
    } else {
        similarGroups.push({ id: uid(), name: name || 'مجموعة', subIds: checked });
    }

    saveSimilarGroupsToStorage();
    renderSimilarGroupsList();
    closeSimilarGroupModal();
    showAlert("✅ تم حفظ المجموعة", "success");
}