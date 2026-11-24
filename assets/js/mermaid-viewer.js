// Mermaid initialization + click-to-enlarge pan/zoom viewer.
// Loaded only when the page contains at least one pre.mermaid element.

const MERMAID_ESM = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.esm.min.mjs';

function currentTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'default';
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Clone a Mermaid SVG with fresh unique IDs so marker/style references never
// collide with the inline SVG still mounted in the page.
function cloneSvgSafely(svg, prefix) {
    const clone = svg.cloneNode(true);
    const idMap = new Map();

    if (clone.id) {
        idMap.set(clone.id, prefix + clone.id);
        clone.id = idMap.get(clone.id);
    }

    clone.querySelectorAll('[id]').forEach((el) => {
        const oldId = el.id;
        if (oldId && !idMap.has(oldId)) {
            const newId = prefix + oldId;
            idMap.set(oldId, newId);
            el.id = newId;
        }
    });

    if (idMap.size > 0) {
        const rewriteAttr = (val) => {
            if (!val) return val;
            let out = val.replace(/url\((['"]?)#([^)'"]+)\1\)/g, (m, q, id) => {
                const next = idMap.get(id);
                return next ? `url(${q}#${next}${q})` : m;
            });
            if (out.startsWith('#')) {
                const next = idMap.get(out.slice(1));
                if (next) out = '#' + next;
            }
            return out;
        };

        const refAttrs = ['href', 'xlink:href', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'filter', 'fill', 'stroke'];
        clone.querySelectorAll('*').forEach((el) => {
            for (const attr of refAttrs) {
                if (el.hasAttribute(attr)) {
                    el.setAttribute(attr, rewriteAttr(el.getAttribute(attr)));
                }
            }
            if (el.hasAttribute('style')) {
                el.setAttribute('style', rewriteAttr(el.getAttribute('style')));
            }
        });

        clone.querySelectorAll('style').forEach((styleEl) => {
            let css = styleEl.textContent || '';
            for (const [oldId, newId] of idMap.entries()) {
                css = css.replace(new RegExp('#' + escapeRegex(oldId) + '(?![\\w-])', 'g'), '#' + newId);
            }
            styleEl.textContent = css;
        });
    }

    return clone;
}

function measureSvg(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
        return { width: vb.width, height: vb.height };
    }
    const attrVb = svg.getAttribute('viewBox');
    if (attrVb) {
        const parts = attrVb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }
    }
    const rect = svg.getBoundingClientRect();
    return {
        width: rect.width || 800,
        height: rect.height || 400
    };
}

function createViewer(blocks) {
    const overlay = document.createElement('div');
    overlay.className = 'mermaid-viewer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Mermaid diagram viewer');
    overlay.innerHTML = `
        <div class="mermaid-viewer-dialog">
            <div class="mermaid-viewer-bar top">
                <div class="mermaid-viewer-title">
                    <span>┌─ MERMAID VIEWER</span>
                    <span class="mermaid-viewer-counter"></span>
                </div>
                <div class="mermaid-viewer-controls">
                    <button type="button" class="mermaid-viewer-btn" data-action="prev" title="Previous diagram (←)">←</button>
                    <button type="button" class="mermaid-viewer-btn" data-action="next" title="Next diagram (→)">→</button>
                    <button type="button" class="mermaid-viewer-btn" data-action="zoom-out" title="Zoom out (-)">-</button>
                    <span class="mermaid-viewer-zoom">100%</span>
                    <button type="button" class="mermaid-viewer-btn" data-action="zoom-in" title="Zoom in (+)">+</button>
                    <button type="button" class="mermaid-viewer-btn" data-action="fit" title="Fit to window (0)">FIT</button>
                    <button type="button" class="mermaid-viewer-btn" data-action="reset" title="Actual size (1)">1:1</button>
                    <button type="button" class="mermaid-viewer-btn close" data-action="close" title="Close (Esc)">× ESC</button>
                </div>
            </div>
            <div class="mermaid-viewer-stage">
                <div class="mermaid-viewer-canvas"></div>
            </div>
            <div class="mermaid-viewer-bar bottom">
                <span class="mermaid-viewer-help">└─ scroll to zoom · drag to pan · double-click to toggle zoom · esc to close</span>
                <span>─┘</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const dialog = overlay.querySelector('.mermaid-viewer-dialog');
    const stage = overlay.querySelector('.mermaid-viewer-stage');
    const canvas = overlay.querySelector('.mermaid-viewer-canvas');
    const zoomLabel = overlay.querySelector('.mermaid-viewer-zoom');
    const counter = overlay.querySelector('.mermaid-viewer-counter');
    const prevBtn = overlay.querySelector('[data-action="prev"]');
    const nextBtn = overlay.querySelector('[data-action="next"]');

    let isOpen = false;
    let currentIndex = 0;
    let triggerEl = null;
    let natural = { width: 800, height: 400 };
    let scale = 1;
    let fitScale = 1;
    let tx = 0;
    let ty = 0;
    let openSeq = 0;

    const MIN_SCALE = 0.25;
    const MAX_SCALE = 6;

    function applyTransform() {
        canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    }

    function fitToStage() {
        const rect = stage.getBoundingClientRect();
        const pad = 40;
        const availW = Math.max(100, rect.width - pad * 2);
        const availH = Math.max(100, rect.height - pad * 2);
        // Scale to fit comfortably, allowing enlargement of compact diagrams up to 2.5x.
        fitScale = Math.min(availW / natural.width, availH / natural.height, 2.5);
        fitScale = Math.max(MIN_SCALE, fitScale);
        scale = fitScale;
        tx = (rect.width - natural.width * scale) / 2;
        ty = (rect.height - natural.height * scale) / 2;
        applyTransform();
    }

    function setActualSize() {
        const rect = stage.getBoundingClientRect();
        scale = 1;
        tx = (rect.width - natural.width) / 2;
        ty = (rect.height - natural.height) / 2;
        applyTransform();
    }

    function zoomAround(nextScale, clientX, clientY) {
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
        const rect = stage.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const ratio = clamped / scale;
        tx = px - (px - tx) * ratio;
        ty = py - (py - ty) * ratio;
        scale = clamped;
        applyTransform();
    }

    function zoomCenter(factor) {
        const rect = stage.getBoundingClientRect();
        zoomAround(scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function showDiagram(index) {
        const total = blocks.length;
        currentIndex = ((index % total) + total) % total;
        const block = blocks[currentIndex];
        const svg = block.querySelector('svg');
        if (!svg) return;

        openSeq += 1;
        natural = measureSvg(svg);
        const clone = cloneSvgSafely(svg, `mv${openSeq}_`);
        clone.removeAttribute('style');
        clone.setAttribute('width', String(natural.width));
        clone.setAttribute('height', String(natural.height));

        canvas.innerHTML = '';
        canvas.appendChild(clone);

        if (total > 1) {
            counter.textContent = `[${currentIndex + 1}/${total}]`;
            prevBtn.style.display = '';
            nextBtn.style.display = '';
        } else {
            counter.textContent = '';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }

        fitToStage();
    }

    function open(index, el) {
        triggerEl = el || null;
        isOpen = true;
        overlay.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        showDiagram(index);
        const closeBtn = overlay.querySelector('[data-action="close"]');
        if (closeBtn) closeBtn.focus();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        overlay.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        canvas.innerHTML = '';
        if (triggerEl && typeof triggerEl.focus === 'function') {
            triggerEl.focus();
        }
    }

    // Backdrop click closes modal
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    dialog.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        switch (btn.dataset.action) {
            case 'close': close(); break;
            case 'zoom-in': zoomCenter(1.25); break;
            case 'zoom-out': zoomCenter(0.8); break;
            case 'fit': fitToStage(); break;
            case 'reset': setActualSize(); break;
            case 'prev': showDiagram(currentIndex - 1); break;
            case 'next': showDiagram(currentIndex + 1); break;
        }
    });

    // Wheel zoom around cursor
    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        zoomAround(scale * factor, e.clientX, e.clientY);
    }, { passive: false });

    // Double-click toggles fit <-> 2x fit
    stage.addEventListener('dblclick', (e) => {
        const target = Math.abs(scale - fitScale) < 0.05 ? Math.min(MAX_SCALE, fitScale * 2) : fitScale;
        if (target === fitScale) {
            fitToStage();
        } else {
            zoomAround(target, e.clientX, e.clientY);
        }
    });

    // Pointer drag to pan + 2-finger pinch to zoom
    const pointers = new Map();
    let dragStart = null;
    let pinchStart = null;

    stage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 1) {
            dragStart = { x: e.clientX, y: e.clientY, tx, ty };
            pinchStart = null;
            stage.classList.add('is-dragging');
        } else if (pointers.size === 2) {
            const [p1, p2] = [...pointers.values()];
            pinchStart = {
                dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
                scale
            };
            dragStart = null;
        }
    });

    stage.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 1 && dragStart) {
            tx = dragStart.tx + (e.clientX - dragStart.x);
            ty = dragStart.ty + (e.clientY - dragStart.y);
            applyTransform();
        } else if (pointers.size === 2 && pinchStart && pinchStart.dist > 0) {
            const [p1, p2] = [...pointers.values()];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            zoomAround(pinchStart.scale * (dist / pinchStart.dist), midX, midY);
        }
    });

    function endPointer(e) {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) {
            dragStart = null;
            pinchStart = null;
            stage.classList.remove('is-dragging');
        } else if (pointers.size === 1) {
            const [p] = [...pointers.values()];
            dragStart = { x: p.x, y: p.y, tx, ty };
            pinchStart = null;
        }
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Keyboard navigation while open
    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomCenter(1.25);
        } else if (e.key === '-') {
            e.preventDefault();
            zoomCenter(0.8);
        } else if (e.key === '0') {
            e.preventDefault();
            fitToStage();
        } else if (e.key === '1') {
            e.preventDefault();
            setActualSize();
        } else if (e.key === 'ArrowLeft' && blocks.length > 1) {
            e.preventDefault();
            showDiagram(currentIndex - 1);
        } else if (e.key === 'ArrowRight' && blocks.length > 1) {
            e.preventDefault();
            showDiagram(currentIndex + 1);
        }
    });

    window.addEventListener('resize', () => {
        if (isOpen) fitToStage();
    });

    return { open, close };
}

async function initMermaid() {
    const preNodes = [...document.querySelectorAll('pre.mermaid')];
    if (preNodes.length === 0) return;

    // Ensure every pre.mermaid is wrapped in a .mermaid-block container and save source.
    const blocks = preNodes.map((pre) => {
        pre.dataset.mermaidSource = pre.textContent;
        let block = pre.closest('.mermaid-block');
        if (!block) {
            block = document.createElement('figure');
            block.className = 'mermaid-block';
            block.tabIndex = 0;
            block.setAttribute('role', 'button');
            block.setAttribute('aria-label', 'Click to expand Mermaid diagram');
            const hint = document.createElement('span');
            hint.className = 'mermaid-hint';
            hint.setAttribute('aria-hidden', 'true');
            hint.textContent = '[ + EXPAND ]';
            pre.parentNode.insertBefore(block, pre);
            block.appendChild(hint);
            block.appendChild(pre);
        }
        return block;
    });

    const { default: mermaid } = await import(MERMAID_ESM);

    async function renderAll() {
        mermaid.initialize({
            startOnLoad: false,
            theme: currentTheme()
        });
        for (const pre of preNodes) {
            pre.removeAttribute('data-processed');
            pre.textContent = pre.dataset.mermaidSource;
        }
        await mermaid.run({ nodes: preNodes });
    }

    await renderAll();

    const viewer = createViewer(blocks);

    blocks.forEach((block, index) => {
        block.addEventListener('click', () => viewer.open(index, block));
        block.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                viewer.open(index, block);
            }
        });
    });

    // Re-render diagrams cleanly if OS color scheme flips while viewing the page.
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onSchemeChange = () => {
            viewer.close();
            renderAll();
        };
        if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMermaid);
} else {
    initMermaid();
}
