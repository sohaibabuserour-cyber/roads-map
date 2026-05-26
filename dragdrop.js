// ====================================================
// DRAG & DROP (Admin only)
// ====================================================

let dragGhost = null;

function createGhost(text) {
    removeGhost();
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    dragGhost.textContent = text;
    document.body.appendChild(dragGhost);
}

function moveGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = (x + 16) + 'px';
    dragGhost.style.top  = (y + 10) + 'px';
}

function removeGhost() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
}

function makeDraggable(items, getKey, onReorder, getLabel, options = {}) {
    if (!currentUser || !currentUser.isAdmin) return;

    const isHorizontal = options.horizontal || false;
    let draggingEl   = null;
    let draggingKey  = null;
    let overEl       = null;
    let overPosition = null;

    function clearOver() {
        if (overEl) {
            overEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-left', 'drag-over-right');
            overEl = null;
        }
    }

    items.forEach(el => {
        el.draggable = true;

        el.addEventListener('dragstart', e => {
            draggingEl  = el;
            draggingKey = getKey(el);
            el.classList.add('drag-dragging');
            const label = getLabel ? getLabel(el) : (el.textContent.trim().slice(0, 30));
            createGhost(label);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(new Image(), 0, 0);
        });

        el.addEventListener('drag', e => {
            if (e.clientX || e.clientY) moveGhost(e.clientX, e.clientY);
        });

        el.addEventListener('dragend', () => {
            draggingEl  = null;
            draggingKey = null;
            el.classList.remove('drag-dragging');
            clearOver();
            removeGhost();
        });

        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (el === draggingEl) return;
            const rect   = el.getBoundingClientRect();
            let newPos;
            if (isHorizontal) {
                const midX = rect.left + rect.width / 2;
                newPos = e.clientX < midX ? 'left' : 'right';
            } else {
                const midY = rect.top + rect.height / 2;
                newPos = e.clientY < midY ? 'top' : 'bottom';
            }
            if (overEl !== el || overPosition !== newPos) {
                clearOver();
                overEl       = el;
                overPosition = newPos;
                el.classList.add('drag-over-' + newPos);
            }
            e.dataTransfer.dropEffect = 'move';
        });

        el.addEventListener('dragleave', e => {
            if (!el.contains(e.relatedTarget)) clearOver();
        });

        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggingKey || el === draggingEl) { clearOver(); return; }
            const targetKey = getKey(el);
            clearOver();

            const keys    = items.map(i => getKey(i));
            const fromIdx = keys.indexOf(draggingKey);
            const toIdx   = keys.indexOf(targetKey);
            if (fromIdx === -1 || toIdx === -1) return;

            const newKeys = [...keys];
            newKeys.splice(fromIdx, 1);

            let adjustedInsert;
            if (isHorizontal) {
                adjustedInsert = overPosition === 'left'
                    ? (fromIdx < toIdx ? toIdx - 1 : toIdx)
                    : (fromIdx < toIdx ? toIdx : toIdx + 1);
            } else {
                adjustedInsert = overPosition === 'top'
                    ? (fromIdx < toIdx ? toIdx - 1 : toIdx)
                    : (fromIdx < toIdx ? toIdx : toIdx + 1);
            }
            newKeys.splice(adjustedInsert, 0, draggingKey);

            onReorder(newKeys);
        });
    });
}

function initSidebarSectionsDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const section = document.getElementById('itemsSection');
    if (!section) return;

    const items = [...section.querySelectorAll('.sidebar-section')];
    makeDraggable(
        items,
        el => el.dataset.catId,
        newCatIds => {
            categories = newCatIds
                .map(id => categories.find(c => c.id === id))
                .filter(Boolean);
            renderItems();
            renderNavTabs();
            initSidebarSectionsDrag();
            if (window.initSubitemsDrag) window.initSubitemsDrag();
        },
        el => el.querySelector('.section-title-text')?.textContent.trim().slice(0, 40) || '',
        { silent: true }
    );
}

function initSubitemsDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const section = document.getElementById('itemsSection');
    if (!section) return;

    section.querySelectorAll('.dropdown-items[data-cat]').forEach(container => {
        const catId  = container.dataset.cat;
        const cat    = categories.find(c => c.id === catId);
        if (!cat) return;

        const items = [...container.querySelectorAll('.dropdown-item[data-sub]')];
        if (items.length < 2) return;

        makeDraggable(
            items,
            el => el.dataset.sub,
            newSubIds => {
                cat.subitems = newSubIds
                    .map(id => cat.subitems.find(s => s.id === id))
                    .filter(Boolean);
                renderItems();
                renderNavTabs();
                initSidebarSectionsDrag();
                initSubitemsDrag();
            },
            el => el.querySelector('label')?.textContent.trim().slice(0, 40) || '',
            { silent: true }
        );
    });
}

function initNavRightDrag() {
    if (!currentUser || !currentUser.isAdmin) return;
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const groups = [...navRight.querySelectorAll('.nav-right-group')];
    if (groups.length < 2) return;

    makeDraggable(
        groups,
        el => el.id || el.querySelector('.nav-icon-btn')?.id || 'group',
        newOrder => {
            newOrder.forEach(id => {
                const el = groups.find(g => (g.id || '') === id);
                if (el) {
                    const prev = el.previousElementSibling;
                    if (prev && prev.classList.contains('nav-right-divider')) {
                        navRight.appendChild(prev);
                    }
                    navRight.appendChild(el);
                }
            });
        },
        el => {
            const firstBtn = el.querySelector('.nav-icon-btn');
            return firstBtn ? (firstBtn.title || firstBtn.id || 'مجموعة').slice(0, 40) : 'مجموعة';
        },
        { silent: true, horizontal: true }
    );

    groups.forEach(group => {
        const items = [...group.querySelectorAll(':scope > div[position]')];
        if (items.length < 2) return;

        makeDraggable(
            items,
            el => {
                const btn = el.querySelector('.nav-icon-btn, .user-chip');
                return btn ? (btn.id || 'item') : 'item';
            },
            newOrder => {
                newOrder.forEach(key => {
                    const el = items.find(i => {
                        const btn = i.querySelector('.nav-icon-btn, .user-chip');
                        return btn && btn.id === key;
                    });
                    if (el) group.appendChild(el);
                });
            },
            el => {
                const btn = el.querySelector('.nav-icon-btn, .user-chip');
                return btn ? (btn.title || btn.id || 'عنصر').slice(0, 40) : 'عنصر';
            },
            { silent: true, horizontal: true }
        );
    });
}