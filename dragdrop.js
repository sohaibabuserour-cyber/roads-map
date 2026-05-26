/* ====================================================
   DRAG & DROP
   ==================================================== */

let dragSrcEl = null;

/* ====================================================
   GENERIC DRAG
   ==================================================== */

function makeDraggable(el, onDrop) {
    el.draggable = true;

    el.addEventListener("dragstart", e => {
        dragSrcEl = el;
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
    });

    el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        dragSrcEl = null;
    });

    el.addEventListener("dragover", e => {
        e.preventDefault();
        el.classList.add("drag-over");
    });

    el.addEventListener("dragleave", () => {
        el.classList.remove("drag-over");
    });

    el.addEventListener("drop", e => {
        e.preventDefault();
        el.classList.remove("drag-over");

        if (dragSrcEl && dragSrcEl !== el) {
            onDrop(dragSrcEl, el);
        }
    });
}


/* ====================================================
   SIDEBAR (CATEGORIES + SUBITEMS)
   ==================================================== */

function initSidebarDrag() {

    const sections = document.querySelectorAll(".sidebar-section");

    sections.forEach(sec => {
        makeDraggable(sec, (from, to) => {

            const list = [...sections];
            const fromIndex = list.indexOf(from);
            const toIndex   = list.indexOf(to);

            if (fromIndex === -1 || toIndex === -1) return;

            const moved = categories.splice(fromIndex, 1)[0];
            categories.splice(toIndex, 0, moved);

            renderItems();
        });
    });

    // subitems drag (داخل كل category)
    document.querySelectorAll(".dropdown-items").forEach(container => {

        const items = [...container.querySelectorAll(".dropdown-item")];

        items.forEach(item => {
            makeDraggable(item, (from, to) => {

                const parentCat = categories.find(c =>
                    c.subitems.some(s => s.id === from.dataset.sub)
                );

                if (!parentCat) return;

                const fromIdx = parentCat.subitems.findIndex(s => s.id === from.dataset.sub);
                const toIdx   = parentCat.subitems.findIndex(s => s.id === to.dataset.sub);

                const moved = parentCat.subitems.splice(fromIdx, 1)[0];
                parentCat.subitems.splice(toIdx, 0, moved);

                renderItems();
            });
        });
    });
}


/* ====================================================
   NAV RIGHT (TOOLS ORDER)
   ==================================================== */

function initNavRightDrag() {

    const container = document.querySelector(".nav-right");
    if (!container) return;

    const items = [...container.children];

    items.forEach(item => {
        makeDraggable(item, (from, to) => {

            if (from === to) return;

            if (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING) {
                container.insertBefore(from, to);
            } else {
                container.insertBefore(from, to.nextSibling);
            }
        });
    });
}