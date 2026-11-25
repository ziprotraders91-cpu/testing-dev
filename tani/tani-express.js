/* ============================================================================
   SIMPLICITY ERP - TANI ORDER EXPRESS ENGINE (2-STEP TALLYPRIME WHITE & GOLD)
   Folder: tani / File: tani-express.js • Developed for: Farhan Jawed
   Features:
   - Step 1: Order Details (Left) + Kariger/Sancha Maker/Rangi/Bana Picker (Right)
   - Step 2: 8-Colors Table + Matching Style (Left) + Learned Colors Picker (Right)
   - Light-Yellow Ghost Auto-Fill from Kariger's Previous Tani (Enter = Accept, Type/↓ = Change)
   - [F4] Copy All Same from Previous Tani
   - Tally Accept Bar: Save & Print [Y/Enter] | Only Save [S] | Edit [N/Esc]
   - 100% Preserved: Sancha Portal Sync, Tani Order List, Urdu A6 Print & WhatsApp
   Hardening: Double-Load Guard • Save Lock • Rollback • Exact-Match/New-Text Safe
============================================================================ */

(() => {
    'use strict';

    if (window._taniExpressLoaded) {
        console.warn('[TaniExpress] Already loaded — skip duplicate');
        return;
    }
    window._taniExpressLoaded = true;

    let lastSavedTaniExpressOrder = null;
    let isSubmittingTani = false;

    // Step & Contextual Picker State
    let currentStep = 1; // 1 = Order Details, 2 = 8-Colors Matching
    let activePickerKind = 'kariger'; // 'kariger' | 'sancha' | 'rangi' | 'bana' | 'color' | 'summary'
    let activeTargetInputId = 'texp-kariger';
    let pickerFilteredItems = [];
    let pickerSelectedIdx = 0;
    let pickerNavigated = false;
    let modalOpenedAt = 0;

    /* ========================================================================
       1. SAFE SANITIZATION & STORAGE BRIDGES
       ======================================================================== */
    const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof window.safeArray === 'function') return window.safeArray(v);
        return [];
    };

    const cloneSnap = (v) => JSON.parse(JSON.stringify(toArray(v)));

    const getFromStore = (key) => {
        if (typeof window.getStore === 'function') return window.getStore(key);
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (_) {
            return [];
        }
    };

    const setToStore = (key, val) => {
        if (typeof window.setStore === 'function') {
            window.setStore(key, val);
        } else {
            localStorage.setItem(key, JSON.stringify(val));
        }
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const normPerson = (p) => {
        if (typeof window.normalizePerson === 'function') return window.normalizePerson(p);
        const s = String(p ?? '').trim();
        if (!s || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return '';
        return s;
    };

    const setTaniStatus = (msg, isError = false) => {
        const el = document.getElementById('texp-status-msg');
        if (!el) return;
        el.style.color = isError ? '#dc2626' : '#92400e';
        el.textContent = msg;
    };

    const getToday = () => {
        let rawDate = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];

        if (typeof rawDate === 'string' && rawDate.includes('-')) {
            const parts = rawDate.split('-');
            if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        return rawDate || new Date().toISOString().split('T')[0];
    };

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function')
            ? window.formatDateDisplay(d)
            : (d || '-');
    };

    /* ========================================================================
       2. REPOSITORY, AUTO SERIAL (#1), LEARNED MEMORY & PREVIOUS TANI GHOST
       ======================================================================== */
    const getTaniOrders = () => toArray(getFromStore('tani_orders_list'));

    const getNextParchiNumber = () => {
        const list = getTaniOrders();
        if (!list.length) return '1';
        let maxNum = 0;
        list.forEach((item) => {
            const n = safeInt(item.orderNo);
            if (n > maxNum) maxNum = n;
        });
        return String(maxNum + 1);
    };

    const findLastOrderForKariger = (karigerName) => {
        const kName = String(karigerName || '').trim().toUpperCase();
        if (!kName) return null;
        const orders = getTaniOrders().filter(o => o && String(o.kariger || '').trim().toUpperCase() === kName);
        if (!orders.length) return null;
        orders.sort((a, b) => {
            const ta = safeNum(a.createdAt, 0);
            const tb = safeNum(b.createdAt, 0);
            if (tb !== ta) return tb - ta;
            return safeInt(b.orderNo) - safeInt(a.orderNo);
        });
        return orders[0];
    };

    const setFieldGhost = (fieldId, ghostVal) => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        const valStr = (ghostVal !== undefined && ghostVal !== null) ? String(ghostVal).trim() : '';
        if (valStr && el.value.trim() === '') {
            el.dataset.ghost = valStr;
            el.placeholder = valStr;
            el.classList.add('texp-has-ghost');
        } else {
            delete el.dataset.ghost;
            if (!el.dataset.origPlaceholder) el.placeholder = '';
            el.classList.remove('texp-has-ghost');
        }
    };

    const clearFieldGhost = (el, clearPlaceholder = true) => {
        if (!el) return;
        delete el.dataset.ghost;
        el.classList.remove('texp-has-ghost');
        if (clearPlaceholder) {
            el.placeholder = el.dataset.origPlaceholder || '';
        }
    };

    const clearAllGhosts = () => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal) return;
        modal.querySelectorAll('input[data-next]').forEach((el) => clearFieldGhost(el, true));
        const banner = document.getElementById('texp-prev-banner');
        if (banner) {
            banner.style.display = 'none';
            banner.innerHTML = '';
        }
    };

    const applyPreviousTaniGhost = (karigerName) => {
        clearAllGhosts();
        const prev = findLastOrderForKariger(karigerName);
        if (!prev) return;

        setFieldGhost('texp-sancha', prev.sancha || '');
        setFieldGhost('texp-rangi', prev.rangi || '');
        setFieldGhost('texp-meter', safeNum(prev.meter) > 0 ? String(prev.meter) : '');
        setFieldGhost('texp-pcs', safeInt(prev.pcs) > 0 ? String(prev.pcs) : '');
        setFieldGhost('texp-paai', prev.paai || '');
        setFieldGhost('texp-border', prev.border || '');
        setFieldGhost('texp-bana', prev.bana || '');

        if (Array.isArray(prev.matchingTable)) {
            prev.matchingTable.forEach((row) => {
                if (row && row.row >= 1 && row.row <= 8) {
                    setFieldGhost(`texp-col-saree-${row.row}`, row.saree || '');
                    setFieldGhost(`texp-col-border-${row.row}`, row.border || '');
                    setFieldGhost(`texp-col-bana-${row.row}`, row.bana || '');
                }
            });
        }

        const selContrasts = Array.isArray(prev.selectedContrasts)
            ? prev.selectedContrasts
            : (prev.contrastVal ? prev.contrastVal.split(',').map(s => s.trim()) : []);
        if (selContrasts.length) {
            document.querySelectorAll('input[name="texp_contrast"]').forEach((cb) => {
                cb.checked = selContrasts.includes(cb.value);
            });
        }

        const banner = document.getElementById('texp-prev-banner');
        if (banner) {
            banner.style.display = 'flex';
            banner.innerHTML = `
                <span>Pichli Tani <strong>#${esc(prev.orderNo || '-')}</strong> (${esc(formatDisplay(prev.date))}) halka-yellow me load hai · <strong>[Enter]</strong> = Same · Type / <strong>↓</strong> = Badlein</span>
                <button type="button" class="texp-btn-plain" style="padding:2px 8px; font-size:11px;" onclick="window.__texpCopyAllGhosts()">Copy All Same [F4]</button>
            `;
        }
    };

    const copyAllGhostFields = () => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal) return;
        let count = 0;
        modal.querySelectorAll('input[data-ghost]').forEach((el) => {
            if (el.value.trim() === '' && el.dataset.ghost) {
                el.value = el.dataset.ghost;
                clearFieldGhost(el, true);
                count++;
            }
        });
        if (count > 0) {
            setTaniStatus(`✅ Pichli Tani ki ${count} fields copy ho gayi! Ab zaroori badlav karke Accept karein.`);
        }
    };

    const getLearnedColors = () => {
        const stored = toArray(getFromStore('tani_learned_colors'));
        const orders = getTaniOrders();
        const colorsSet = new Set(stored.map(c => String(c).trim()).filter(Boolean));

        orders.forEach(o => {
            if (o.border) colorsSet.add(String(o.border).trim());
            if (Array.isArray(o.matchingTable)) {
                o.matchingTable.forEach(row => {
                    if (row.saree) colorsSet.add(String(row.saree).trim());
                    if (row.border) colorsSet.add(String(row.border).trim());
                    if (row.bana) colorsSet.add(String(row.bana).trim());
                });
            }
        });

        return Array.from(colorsSet).sort((a, b) => a.localeCompare(b));
    };

    const saveNewLearnedColors = (newColors = []) => {
        if (!newColors.length) return;
        const current = getLearnedColors();
        const updatedSet = new Set([...current, ...newColors.map(c => String(c).trim()).filter(Boolean)]);
        setToStore('tani_learned_colors', Array.from(updatedSet));
    };

    const getPickerDataset = (kind) => {
        if (kind === 'kariger') {
            return toArray(getFromStore('kariger_list'))
                .filter(k => k && k.name && String(k.name).trim())
                .map(k => ({
                    value: String(k.name).trim(),
                    label: String(k.name).trim(),
                    sub: [k.saree, k.mohalla || k.address].filter(Boolean).join(' · ') || 'Kariger',
                    mohalla: String(k.mohalla || k.address || k.pata || '').trim()
                }));
        }

        if (kind === 'sancha') {
            const map = new Map();
            if (typeof window.getSanchaMakersSummary === 'function') {
                window.getSanchaMakersSummary('tani', '', 'all').forEach((m) => {
                    const nm = normPerson(m.name);
                    if (!nm) return;
                    map.set(nm.toLowerCase(), {
                        value: nm,
                        label: nm,
                        sub: `${safeNum(m.bacha).toFixed(1)} Kg`
                    });
                });
            } else {
                const sanchaItems = toArray(getFromStore('sancha_items'))
                    .filter(s => s && (s.category || 'tani').toLowerCase() === 'tani');
                sanchaItems.forEach((s) => {
                    const nm = normPerson(s.person);
                    if (!nm || map.has(nm.toLowerCase())) return;
                    map.set(nm.toLowerCase(), { value: nm, label: nm, sub: 'Sancha Maker' });
                });
            }

            getTaniOrders().forEach((o) => {
                const nm = normPerson(o?.sancha);
                if (nm && !map.has(nm.toLowerCase())) {
                    map.set(nm.toLowerCase(), { value: nm, label: nm, sub: 'Past Order' });
                }
            });
            return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
        }

        if (kind === 'rangi') {
            const learned = toArray(getFromStore('tani_learned_rangi'));
            const set = new Set([
                ...learned.map(r => String(r || '').trim()).filter(Boolean),
                ...getTaniOrders().map(o => String(o?.rangi || '').trim()).filter(Boolean)
            ]);
            return Array.from(set)
                .sort((a, b) => a.localeCompare(b))
                .map(r => ({ value: r, label: r, sub: 'Dyer / Rangi' }));
        }

        if (kind === 'bana') {
            const banaStock = toArray(getFromStore('bana_stock'));
            const map = new Map();
            banaStock.forEach(b => {
                const nm = String(b?.name || '').trim();
                if (!nm || map.has(nm.toLowerCase())) return;
                const bacha = (typeof window.getBanaItemStats === 'function')
                    ? safeNum(window.getBanaItemStats(nm, 'all').bacha)
                    : safeNum(b.bacha);
                map.set(nm.toLowerCase(), {
                    value: nm,
                    label: nm,
                    sub: `Bacha: ${bacha.toFixed(2)} Kg`
                });
            });
            getTaniOrders().forEach(o => {
                const nm = String(o?.bana || '').trim();
                if (nm && !map.has(nm.toLowerCase())) {
                    map.set(nm.toLowerCase(), { value: nm, label: nm, sub: 'Past Order' });
                }
            });
            return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
        }

        if (kind === 'color') {
            return getLearnedColors().map(c => ({
                value: c,
                label: c,
                sub: 'Color'
            }));
        }

        return [];
    };

    const sortAndFilterPickerItems = (items, query) => {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return items;
        const exact = [];
        const prefix = [];
        const substr = [];
        items.forEach(it => {
            const lblLower = it.label.toLowerCase();
            const hay = `${lblLower} ${String(it.sub || '').toLowerCase()}`;
            if (lblLower === q) exact.push(it);
            else if (lblLower.startsWith(q)) prefix.push(it);
            else if (hay.includes(q)) substr.push(it);
        });
        return [...exact, ...prefix, ...substr];
    };

    const renderContextualPicker = (kind, inputId, queryText = '') => {
        activePickerKind = kind;
        activeTargetInputId = inputId;

        const suffix = (currentStep === 2) ? '2' : '1';
        const titleEl = document.getElementById(`texp-picker-title-${suffix}`);
        const hintEl = document.getElementById(`texp-picker-hint-${suffix}`);
        const listEl = document.getElementById(`texp-picker-list-${suffix}`);
        if (!titleEl || !listEl) return;

        const titleMap = {
            kariger: 'List of Karigers',
            sancha: 'List of Sanchas (Makers)',
            rangi: 'List of Rangi / Dyers',
            bana: 'List of Bana Stock',
            color: 'Learned Colors',
            summary: 'Parchi Snapshot'
        };
        titleEl.textContent = titleMap[kind] || 'Picker';

        const inpEl = document.getElementById(inputId);
        const ghostVal = inpEl?.dataset?.ghost || '';

        if (kind === 'summary') {
            if (hintEl) hintEl.textContent = ghostVal ? '[Enter] Same' : '[Enter] Next';
            const kName = document.getElementById('texp-kariger')?.value || '-';
            const moh = document.getElementById('texp-mohalla')?.value || '-';
            const sName = document.getElementById('texp-sancha')?.value || document.getElementById('texp-sancha')?.dataset?.ghost || '-';
            const rName = document.getElementById('texp-rangi')?.value || document.getElementById('texp-rangi')?.dataset?.ghost || '-';
            const mtr = document.getElementById('texp-meter')?.value || document.getElementById('texp-meter')?.dataset?.ghost || '0';
            const pcs = document.getElementById('texp-pcs')?.value || document.getElementById('texp-pcs')?.dataset?.ghost || '0';
            const paai = document.getElementById('texp-paai')?.value || document.getElementById('texp-paai')?.dataset?.ghost || '-';
            const brd = document.getElementById('texp-border')?.value || document.getElementById('texp-border')?.dataset?.ghost || '-';
            const bana = document.getElementById('texp-bana')?.value || document.getElementById('texp-bana')?.dataset?.ghost || '-';

            listEl.innerHTML = `
                <div style="padding:12px 14px; font-size:12.5px; line-height:1.8; color:#374151;">
                    <div><strong>Kariger :</strong> <span style="color:#92400e; font-weight:800;">${esc(kName)}</span></div>
                    <div><strong>Mohalla :</strong> ${esc(moh)}</div>
                    <div><strong>Sancha :</strong> ${esc(sName)}</div>
                    <div><strong>Rangi Wala :</strong> ${esc(rName)}</div>
                    <div><strong>Meter / Pcs :</strong> ${esc(mtr)} Mtr · <strong style="color:#b47d00;">${esc(pcs)} Pcs</strong></div>
                    <div><strong>Paai :</strong> ${esc(paai)}</div>
                    <div><strong>Border :</strong> ${esc(brd)}</div>
                    <div><strong>Bana :</strong> ${esc(bana)}</div>
                    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #e5d5a7; font-size:11.5px; color:#6b7280;">
                        Halka-yellow field par <strong>[Enter]</strong> = same select · <strong>[F4]</strong> = Copy All · <strong>[Del]</strong> = Clear ghost.
                    </div>
                </div>
            `;
            pickerFilteredItems = [];
            return;
        }

        if (hintEl) hintEl.textContent = ghostVal ? '[Enter] Same · ↓ List' : '↑ ↓ + Enter';

        const rawItems = getPickerDataset(kind);
        pickerFilteredItems = sortAndFilterPickerItems(rawItems, queryText);
        if (pickerSelectedIdx >= pickerFilteredItems.length) pickerSelectedIdx = 0;
        if (pickerSelectedIdx < 0) pickerSelectedIdx = 0;

        if (!pickerFilteredItems.length) {
            listEl.innerHTML = `
                <div style="padding:18px 14px; text-align:center; font-size:12.5px; color:#6b7280; line-height:1.6;">
                    ${queryText ? `<strong>"${esc(queryText)}"</strong> naya naam hai — [Enter] dabakar aage badhein.` : 'Abhi koi saved record nahi mila — type karke [Enter] dabayein.'}
                </div>
            `;
            return;
        }

        listEl.innerHTML = pickerFilteredItems.map((it, idx) => `
            <div class="texp-pick-row${idx === pickerSelectedIdx ? ' active' : ''}" data-pidx="${idx}">
                <span class="texp-pick-lbl">${esc(it.label)}</span>
                <small class="texp-pick-sub">${esc(it.sub || '')}</small>
            </div>
        `).join('');

        listEl.querySelectorAll('.texp-pick-row').forEach((row) => {
            row.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                const idx = parseInt(row.dataset.pidx, 10);
                if (!isNaN(idx)) applyPickerSelection(idx, true);
            });
        });

        const activeRow = listEl.querySelector('.texp-pick-row.active');
        activeRow?.scrollIntoView({ block: 'nearest' });
    };

    const advanceToNextTarget = (nextId) => {
        if (!nextId) return;
        if (nextId === 'texp-step-2') {
            setTaniStep(2, 'texp-col-saree-1');
            return;
        }
        if (nextId === 'texp-accept-bar') {
            showTaniAcceptBar(true);
            return;
        }
        const nxt = document.getElementById(nextId);
        if (nxt) {
            nxt.focus();
            if (typeof nxt.select === 'function') nxt.select();
        }
    };

    const applyPickerSelection = (idx, advanceFocus = true) => {
        const chosen = pickerFilteredItems[idx];
        const inp = document.getElementById(activeTargetInputId);
        if (!chosen || !inp) return false;

        inp.value = chosen.value;
        clearFieldGhost(inp, true);

        if (activeTargetInputId === 'texp-kariger') {
            const mohEl = document.getElementById('texp-mohalla');
            if (mohEl) mohEl.value = chosen.mohalla || '';
            applyPreviousTaniGhost(chosen.value);
        }

        pickerNavigated = false;

        if (advanceFocus) {
            advanceToNextTarget(inp.getAttribute('data-next'));
        }
        return true;
    };

    const setTaniStep = (stepNum, focusFieldId = null) => {
        currentStep = (stepNum === 2) ? 2 : 1;
        const s1 = document.getElementById('texp-step-1');
        const s2 = document.getElementById('texp-step-2');
        const t1 = document.getElementById('texp-step-tab-1');
        const t2 = document.getElementById('texp-step-tab-2');
        const backBtn = document.getElementById('texp-header-back-btn');

        if (s1) s1.style.display = (currentStep === 1) ? 'grid' : 'none';
        if (s2) s2.style.display = (currentStep === 2) ? 'grid' : 'none';
        if (t1) t1.classList.toggle('active', currentStep === 1);
        if (t2) t2.classList.toggle('active', currentStep === 2);
        if (backBtn) backBtn.textContent = (currentStep === 2) ? '← [Esc] Step 1' : '← [Esc] Back';

        showTaniAcceptBar(false);

        const targetId = focusFieldId || (currentStep === 1 ? 'texp-kariger' : 'texp-col-saree-1');
        setTimeout(() => {
            const el = document.getElementById(targetId);
            if (el) {
                el.focus();
                el.select?.();
            }
        }, 30);
    };

    const showTaniAcceptBar = (show) => {
        const bar = document.getElementById('texp-accept-bar');
        if (!bar) return;
        bar.style.display = show ? 'flex' : 'none';
        if (show) {
            document.getElementById('texp-accept-print-btn')?.focus();
        }
    };

    const hideTaniAcceptBarToEdit = () => {
        showTaniAcceptBar(false);
        const target = document.getElementById(currentStep === 2 ? 'texp-col-saree-1' : 'texp-kariger');
        if (target) { target.focus(); target.select?.(); }
    };

    /* ========================================================================
       3. OPEN TANI EXPRESS MODAL (OPTION A: 2-STEP PURE 2-COLUMN + YELLOW GHOST)
       ======================================================================== */
    window.openTaniExpressModal = () => {
        const existing = document.getElementById('master-tani-express-modal');
        if (existing) existing.remove();

        isSubmittingTani = false;
        modalOpenedAt = performance.now();
        const today = getToday();
        const nextOrderNo = getNextParchiNumber();
        currentStep = 1;

        let colorRowsHtml = '';
        for (let i = 1; i <= 8; i++) {
            const nextSaree = `texp-col-border-${i}`;
            const nextBorder = `texp-col-bana-${i}`;
            const nextBana = (i === 8) ? 'texp-accept-bar' : `texp-col-saree-${i + 1}`;
            colorRowsHtml += `
                <tr>
                    <td class="texp-td-num">${i}</td>
                    <td><input type="text" id="texp-col-saree-${i}" class="texp-c-inp" data-step="2" data-picker="color" data-next="${nextSaree}" autocomplete="off"></td>
                    <td><input type="text" id="texp-col-border-${i}" class="texp-c-inp" data-step="2" data-picker="color" data-next="${nextBorder}" autocomplete="off"></td>
                    <td><input type="text" id="texp-col-bana-${i}" class="texp-c-inp" data-step="2" data-picker="color" data-next="${nextBana}" autocomplete="off"></td>
                </tr>`;
        }

        const modalHtml = `
        <div id="master-tani-express-modal" class="texp-overlay">
            <style>
                .texp-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(31, 41, 55, 0.42);
                    backdrop-filter: blur(2px);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px;
                    box-sizing: border-box;
                    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                }
                .texp-dialog {
                    background: #ffffff;
                    width: 100%;
                    max-width: 900px;
                    border: 1.5px solid #d9b86c;
                    border-radius: 8px;
                    box-shadow: 0 22px 48px rgba(0, 0, 0, 0.22);
                    overflow: hidden;
                    max-height: 94vh;
                    max-height: 94dvh;
                    display: flex;
                    flex-direction: column;
                    color: #1f2937;
                }
                .texp-dialog * { box-sizing: border-box !important; }
                .texp-header {
                    background: #fdf6e2;
                    border-bottom: 1.5px solid #e5d5a7;
                    padding: 9px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    flex-shrink: 0;
                }
                .texp-header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .texp-header-left h3 {
                    margin: 0;
                    font-size: 15.5px;
                    font-weight: 800;
                    color: #1f2937;
                }
                .texp-parchi-pill {
                    background: #f2b71d;
                    color: #1f2937;
                    border: 1px solid #d9a425;
                    border-radius: 4px;
                    padding: 2px 9px;
                    font-size: 12px;
                    font-weight: 800;
                }
                .texp-step-tabs {
                    display: flex;
                    gap: 5px;
                    margin-left: 4px;
                }
                .texp-step-tab {
                    background: #ffffff;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    padding: 4px 10px;
                    font-size: 11.5px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .texp-step-tab.active {
                    background: #f2b71d;
                    color: #1f2937;
                    border-color: #d9a425;
                    font-weight: 800;
                }
                .texp-btn-plain {
                    background: #ffffff;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    border-radius: 5px;
                    padding: 5px 11px;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .texp-btn-plain:hover {
                    border-color: #d9a425;
                    background: #fef9ea;
                    color: #1f2937;
                }
                .texp-btn-gold {
                    background: #f2b71d;
                    color: #1f2937;
                    border: 1px solid #d9a425;
                    border-radius: 5px;
                    padding: 6px 14px;
                    font-size: 12.5px;
                    font-weight: 800;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .texp-btn-gold:hover,
                .texp-btn-gold:focus {
                    background: #e5aa12;
                    outline: 2px solid #92400e;
                }
                .texp-body {
                    padding: 12px 16px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    flex: 1;
                    background: #ffffff;
                }
                .texp-prev-banner {
                    display: none;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    background: #fefce8;
                    border: 1px solid #fde047;
                    color: #854d0e;
                    border-radius: 5px;
                    padding: 6px 10px;
                    margin-bottom: 9px;
                    font-size: 11.5px;
                    font-weight: 600;
                }
                .texp-split {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
                    gap: 14px;
                    align-items: stretch;
                    width: 100%;
                }
                .texp-left-pane {
                    background: #ffffff;
                    border: 1px solid #e5d5a7;
                    border-radius: 6px;
                    padding: 11px 13px;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .texp-sec-lbl {
                    font-size: 10.5px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    color: #92400e;
                    margin: 0 0 8px 0;
                    padding-bottom: 4px;
                    border-bottom: 1px solid #fdf6e2;
                }
                .texp-row {
                    display: grid;
                    grid-template-columns: 122px minmax(0, 1fr);
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 7px;
                    min-width: 0;
                }
                .texp-row-pair {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 8px;
                    min-width: 0;
                }
                .texp-left-pane label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #374151;
                    white-space: nowrap;
                }
                .texp-inp {
                    width: 100%;
                    min-width: 0;
                    height: 31px;
                    padding: 4px 9px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: #111827;
                    background: #ffffff;
                    outline: none;
                }
                .texp-inp:focus {
                    border-color: #d9a425;
                    background: #fffdf5;
                    box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
                }

                /* --- HALKA YELLOW GHOST AUTO-FILL STYLE --- */
                .texp-has-ghost {
                    background: #fefce8 !important;
                    border-color: #eab308 !important;
                }
                .texp-has-ghost::placeholder {
                    color: #a16207 !important;
                    opacity: 0.85 !important;
                    font-weight: 700 !important;
                }
                .texp-has-ghost:focus {
                    background: #fef9c3 !important;
                    border-color: #ca8a04 !important;
                    box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.25) !important;
                }

                .texp-contrast-box {
                    margin-top: 8px;
                    display: flex;
                    gap: 14px;
                    flex-wrap: wrap;
                    align-items: center;
                    font-size: 12px;
                    font-weight: 700;
                    color: #374151;
                    background: #fdfcf7;
                    border: 1px solid #e5d5a7;
                    border-radius: 5px;
                    padding: 6px 10px;
                }
                .texp-contrast-box label {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                }
                .texp-right-picker {
                    background: #fdfcf7;
                    border: 1.5px solid #d9b86c;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    min-width: 0;
                    height: 372px;
                }
                .texp-picker-head {
                    background: #fdf6e2;
                    border-bottom: 1.5px solid #e5d5a7;
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .texp-picker-head strong {
                    font-size: 12.5px;
                    font-weight: 800;
                    color: #1f2937;
                }
                .texp-picker-head small {
                    font-size: 11px;
                    font-weight: 700;
                    color: #92400e;
                }
                .texp-picker-list {
                    overflow-y: auto;
                    flex: 1;
                }
                .texp-pick-row {
                    padding: 7px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    font-size: 12.5px;
                    border-bottom: 1px solid #f3f4f6;
                    cursor: pointer;
                }
                .texp-pick-row:hover { background: #fef9ea; }
                .texp-pick-row.active {
                    background: #f2b71d;
                    color: #1f2937;
                }
                .texp-pick-lbl { font-weight: 700; }
                .texp-pick-sub { font-size: 11px; color: #6b7280; font-weight: 600; }
                .texp-pick-row.active .texp-pick-sub { color: #1f2937; }

                /* --- STEP 2: SINGLE CLEAN 8-ROW TABLE --- */
                #master-tani-express-modal table.texp-table {
                    width: 100% !important;
                    min-width: 0 !important;
                    border-collapse: collapse !important;
                    table-layout: fixed !important;
                    border: 1px solid #e5d5a7 !important;
                    background: #ffffff !important;
                    margin: 0 !important;
                }
                #master-tani-express-modal table.texp-table th {
                    background: #fdf6e2 !important;
                    color: #92400e !important;
                    font-size: 11.5px !important;
                    font-weight: 800 !important;
                    padding: 6px 6px !important;
                    border-bottom: 1.5px solid #e5d5a7 !important;
                    text-align: center !important;
                }
                #master-tani-express-modal table.texp-table td {
                    padding: 3px !important;
                    border-bottom: 1px solid #f3f4f6 !important;
                }
                .texp-td-num {
                    width: 28px;
                    text-align: center;
                    font-size: 11.5px;
                    font-weight: 800;
                    color: #92400e;
                    background: #fdf6e2;
                }
                .texp-c-inp {
                    width: 100%;
                    min-width: 0;
                    height: 29px;
                    padding: 3px 7px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: #111827;
                    background: #ffffff;
                    outline: none;
                }
                .texp-c-inp:focus {
                    border-color: #d9a425;
                    background: #fffdf5;
                    box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
                }

                /* --- ACCEPT BAR & FOOTER --- */
                .texp-accept-bar {
                    margin-top: 10px;
                    background: #fdf6e2;
                    border: 1.5px solid #d9a425;
                    border-radius: 6px;
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .texp-footer {
                    background: #fdf6e2;
                    border-top: 1.5px solid #e5d5a7;
                    padding: 8px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .texp-footer-actions {
                    display: flex;
                    gap: 7px;
                    flex-wrap: wrap;
                    align-items: center;
                }

                @media (max-width: 780px) {
                    .texp-split { grid-template-columns: 1fr; }
                    .texp-right-picker { height: 220px; }
                    .texp-row { grid-template-columns: 100px minmax(0, 1fr); }
                }
            </style>

            <div class="texp-dialog">
                <div class="texp-header">
                    <div class="texp-header-left">
                        <h3>Tani Order Voucher</h3>
                        <span class="texp-parchi-pill" id="texp-parchi-badge">Parchi #${nextOrderNo}</span>
                        <div class="texp-step-tabs">
                            <button type="button" id="texp-step-tab-1" class="texp-step-tab active" onclick="window.__texpGoStep(1)">[1] Order Details</button>
                            <button type="button" id="texp-step-tab-2" class="texp-step-tab" onclick="window.__texpGoStep(2)">[2] 8-Colors Matching</button>
                        </div>
                    </div>
                    <button type="button" id="texp-header-back-btn" class="texp-btn-plain" onclick="window.__texpHeaderBack()">← [Esc] Back</button>
                </div>

                <div class="texp-body">
                    <div id="texp-prev-banner" class="texp-prev-banner"></div>

                    <!-- STEP 1: ORDER DETAILS (LEFT) + CONTEXTUAL PICKER (RIGHT) -->
                    <div id="texp-step-1" class="texp-split">
                        <div class="texp-left-pane">
                            <div>
                                <div class="texp-sec-lbl">Step 1: Order &amp; Loom Specifications</div>

                                <div class="texp-row">
                                    <label>Parchi / Date :</label>
                                    <div class="texp-row-pair">
                                        <input type="text" id="texp-order-no" class="texp-inp" value="${nextOrderNo}" readonly style="background:#fdf6e2; border-color:#d9b86c; color:#92400e; text-align:center; cursor:not-allowed;">
                                        <input type="date" id="texp-order-date" class="texp-inp" value="${today}" data-step="1" data-picker="summary" data-next="texp-kariger">
                                    </div>
                                </div>

                                <div class="texp-row">
                                    <label for="texp-kariger">Kariger :</label>
                                    <input type="text" id="texp-kariger" class="texp-inp" data-step="1" data-picker="kariger" data-next="texp-sancha" autocomplete="off">
                                </div>

                                <div class="texp-row">
                                    <label for="texp-mohalla">Mohalla (Auto) :</label>
                                    <input type="text" id="texp-mohalla" class="texp-inp" data-step="1" data-picker="summary" data-next="texp-sancha" autocomplete="off">
                                </div>

                                <div class="texp-row">
                                    <label for="texp-sancha">Sancha :</label>
                                    <input type="text" id="texp-sancha" class="texp-inp" data-step="1" data-picker="sancha" data-next="texp-rangi" autocomplete="off">
                                </div>

                                <div class="texp-row">
                                    <label for="texp-rangi">Rangi Wala :</label>
                                    <input type="text" id="texp-rangi" class="texp-inp" data-step="1" data-picker="rangi" data-next="texp-meter" autocomplete="off">
                                </div>

                                <div class="texp-row">
                                    <label>Meter / Pcs :</label>
                                    <div class="texp-row-pair">
                                        <input type="text" inputmode="decimal" id="texp-meter" class="texp-inp" data-step="1" data-picker="summary" data-next="texp-pcs" data-orig-placeholder="Meter" placeholder="Meter" autocomplete="off" oninput="this.value=this.value.replace(/[^0-9.]/g,'').replace(/(\\..*)\\./g,'$1')" style="text-align:right;">
                                        <input type="text" inputmode="numeric" id="texp-pcs" class="texp-inp" data-step="1" data-picker="summary" data-next="texp-paai" data-orig-placeholder="Saree Pcs" placeholder="Saree Pcs" autocomplete="off" oninput="this.value=this.value.replace(/[^0-9]/g,'')" style="text-align:right; color:#b47d00;">
                                    </div>
                                </div>

                                <div class="texp-row">
                                    <label>Paai / Border :</label>
                                    <div class="texp-row-pair">
                                        <input type="text" id="texp-paai" class="texp-inp" data-step="1" data-picker="summary" data-next="texp-border" data-orig-placeholder="Paai" placeholder="Paai" autocomplete="off">
                                        <input type="text" id="texp-border" class="texp-inp" data-step="1" data-picker="summary" data-next="texp-bana" data-orig-placeholder="Border" placeholder="Border" autocomplete="off">
                                    </div>
                                </div>

                                <div class="texp-row" style="margin-bottom:0;">
                                    <label for="texp-bana">Bana (Stock) :</label>
                                    <input type="text" id="texp-bana" class="texp-inp" data-step="1" data-picker="bana" data-next="texp-step-2" autocomplete="off">
                                </div>
                            </div>

                            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                                <button type="button" class="texp-btn-gold" onclick="window.__texpGoStep(2)">Next: 8-Colors Matching [PgDn] →</button>
                            </div>
                        </div>

                        <div class="texp-right-picker">
                            <div class="texp-picker-head">
                                <strong id="texp-picker-title-1">List of Karigers</strong>
                                <small id="texp-picker-hint-1">↑ ↓ + Enter</small>
                            </div>
                            <div class="texp-picker-list" id="texp-picker-list-1"></div>
                        </div>
                    </div>

                    <!-- STEP 2: SINGLE 8-COLORS TABLE + MATCHING STYLE (LEFT) + LEARNED COLORS PICKER (RIGHT) -->
                    <div id="texp-step-2" class="texp-split" style="display:none;">
                        <div class="texp-left-pane">
                            <div>
                                <div class="texp-sec-lbl">Step 2: 8-Colors Matching &amp; Style (Yellow = Pichli Tani [Enter] · Type = Badlein)</div>
                                <table class="texp-table">
                                    <thead>
                                        <tr>
                                            <th style="width:28px;">#</th>
                                            <th>Saree</th>
                                            <th>Border</th>
                                            <th>Bana</th>
                                        </tr>
                                    </thead>
                                    <tbody>${colorRowsHtml}</tbody>
                                </table>

                                <div class="texp-contrast-box">
                                    <span style="color:#92400e; font-size:11.5px; font-weight:800;">Matching Style:</span>
                                    <label><input type="checkbox" name="texp_contrast" value="aanchal_blouse" checked> Aanchal Blouse</label>
                                    <label><input type="checkbox" name="texp_contrast" value="border_only"> Sirf Border</label>
                                    <label><input type="checkbox" name="texp_contrast" value="self"> Self</label>
                                </div>
                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px;">
                                <button type="button" class="texp-btn-plain" onclick="window.__texpGoStep(1)">← Order Details [PgUp]</button>
                                <button type="button" class="texp-btn-gold" onclick="window.__texpOpenAccept()">Accept / Save [Ctrl+Enter]</button>
                            </div>
                        </div>

                        <div class="texp-right-picker">
                            <div class="texp-picker-head">
                                <strong id="texp-picker-title-2">Learned Colors</strong>
                                <small id="texp-picker-hint-2">↑ ↓ + Enter</small>
                            </div>
                            <div class="texp-picker-list" id="texp-picker-list-2"></div>
                        </div>
                    </div>

                    <!-- TALLY ACCEPT BAR (SAVE & PRINT | ONLY SAVE | EDIT) -->
                    <div id="texp-accept-bar" class="texp-accept-bar" style="display:none;">
                        <span style="font-size:13px; font-weight:800; color:#1f2937;">Accept? Parchi Save Karein?</span>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" id="texp-accept-print-btn" class="texp-btn-gold" onclick="submitTaniExpress(true)">Save &amp; Print [Y / Enter]</button>
                            <button type="button" id="texp-accept-save-btn" class="texp-btn-plain" onclick="submitTaniExpress(false)">Only Save [S]</button>
                            <button type="button" id="texp-accept-edit-btn" class="texp-btn-plain" onclick="window.__texpHideAccept()">Edit [N / Esc]</button>
                        </div>
                    </div>
                </div>

                <div class="texp-footer">
                    <div id="texp-status-msg" style="font-size:12px; font-weight:700; color:#92400e;">[Enter] Same / Picker Select · [F4] Copy All Same · [Ctrl+Enter] Save Bar · [Alt+P] A6 Print</div>
                    <div class="texp-footer-actions">
                        <button type="button" class="texp-btn-plain" onclick="closeTaniExpressModal()">Close</button>
                        <button type="button" class="texp-btn-plain" onclick="sendTaniExpressWhatsApp()">WhatsApp [Alt+W]</button>
                        <button type="button" class="texp-btn-plain" onclick="printLastSavedTaniExpressSlip()">A6 Print [Alt+P]</button>
                        <button type="button" id="texp-submit-btn" class="texp-btn-gold" onclick="window.__texpOpenAccept()">Accept [Ctrl+Enter]</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.querySelectorAll('#master-tani-express-modal input[placeholder]').forEach((el) => {
            el.dataset.origPlaceholder = el.getAttribute('placeholder') || '';
        });

        window.__texpGoStep = (n) => setTaniStep(n);
        window.__texpHeaderBack = () => {
            if (currentStep === 2) setTaniStep(1);
            else closeTaniExpressModal();
        };
        window.__texpOpenAccept = () => showTaniAcceptBar(true);
        window.__texpHideAccept = hideTaniAcceptBarToEdit;
        window.__texpCopyAllGhosts = copyAllGhostFields;

        bindTaniExpressEvents();
    };

    /* ========================================================================
       4. KEYBOARD NAVIGATION, CONTEXTUAL PICKER & GHOST ENTER LOGIC
       ======================================================================== */
    const bindTaniExpressEvents = () => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal) return;

        const karigerInp = document.getElementById('texp-kariger');
        const mohallaInp = document.getElementById('texp-mohalla');

        const fields = Array.from(modal.querySelectorAll('input[data-next]'));
        fields.forEach((inp, idx) => {
            inp.addEventListener('focus', () => {
                pickerSelectedIdx = 0;
                pickerNavigated = false;
                const kind = inp.getAttribute('data-picker') || 'summary';
                renderContextualPicker(kind, inp.id, inp.value);
            });

            inp.addEventListener('input', () => {
                if (inp.value !== '') {
                    clearFieldGhost(inp, false);
                } else if (inp.dataset.ghost) {
                    inp.classList.add('texp-has-ghost');
                }

                const kind = inp.getAttribute('data-picker') || 'summary';
                pickerSelectedIdx = 0;
                pickerNavigated = false;
                renderContextualPicker(kind, inp.id, inp.value);

                if (inp.id === 'texp-kariger') {
                    const kName = String(inp.value || '').trim().toUpperCase();
                    const allKarigers = toArray(getFromStore('kariger_list'));
                    const found = allKarigers.find(k => k && String(k.name || '').trim().toUpperCase() === kName);
                    if (found) {
                        if (mohallaInp) mohallaInp.value = found.mohalla || found.address || found.pata || '';
                        applyPreviousTaniGhost(found.name);
                    } else {
                        clearAllGhosts();
                    }
                }
            });

            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (performance.now() - modalOpenedAt) < 160) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const kind = inp.getAttribute('data-picker') || 'summary';
                const isPickerActive = (kind !== 'summary' && pickerFilteredItems.length > 0);

                if (e.key === 'F4') {
                    e.preventDefault();
                    e.stopPropagation();
                    copyAllGhostFields();
                    return;
                }

                if (e.key === 'Delete' && inp.value.trim() === '' && inp.dataset.ghost) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearFieldGhost(inp, true);
                    renderContextualPicker(kind, inp.id, inp.value);
                    return;
                }

                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    showTaniAcceptBar(true);
                    return;
                }

                if (e.key === 'PageDown' && currentStep === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    setTaniStep(2, 'texp-col-saree-1');
                    return;
                }

                if (e.key === 'PageUp' && currentStep === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    setTaniStep(1, 'texp-bana');
                    return;
                }

                if (isPickerActive && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    e.stopPropagation();
                    pickerNavigated = true;
                    const len = pickerFilteredItems.length;
                    pickerSelectedIdx = (e.key === 'ArrowDown')
                        ? (pickerSelectedIdx + 1) % len
                        : (pickerSelectedIdx - 1 + len) % len;
                    const suffix = (currentStep === 2) ? '2' : '1';
                    const rows = document.querySelectorAll(`#texp-picker-list-${suffix} .texp-pick-row`);
                    rows.forEach((r, rIdx) => r.classList.toggle('active', rIdx === pickerSelectedIdx));
                    rows[pickerSelectedIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();

                    if (e.shiftKey) {
                        if (idx > 0) {
                            const prev = fields[idx - 1];
                            const prevStep = parseInt(prev.getAttribute('data-step') || '1', 10);
                            if (prevStep !== currentStep) setTaniStep(prevStep, prev.id);
                            else { prev.focus(); prev.select?.(); }
                        }
                        return;
                    }

                    const typedNonEmpty = inp.value.trim() !== '';

                    // If user pressed ArrowUp/Down to highlight a list item, always pick it
                    if (isPickerActive && pickerNavigated) {
                        applyPickerSelection(pickerSelectedIdx, true);
                        return;
                    }

                    // If empty and ghost exists, Enter accepts ghost
                    if (!typedNonEmpty && inp.dataset.ghost) {
                        inp.value = inp.dataset.ghost;
                        clearFieldGhost(inp, true);
                        advanceToNextTarget(inp.getAttribute('data-next'));
                        return;
                    }

                    // Kariger MUST match kariger_list: pick top match unless already exact match
                    if (kind === 'kariger' && isPickerActive) {
                        const exactAlready = typedNonEmpty && pickerFilteredItems[0] &&
                            pickerFilteredItems[0].label.toLowerCase() === inp.value.trim().toLowerCase();
                        if (!exactAlready) {
                            applyPickerSelection(pickerSelectedIdx, true);
                            return;
                        }
                    }

                    // For sancha / rangi / bana / color: if user typed text manually without arrows, keep typed text (allows new names)
                    if (!typedNonEmpty && isPickerActive && (kind === 'sancha' || kind === 'rangi' || kind === 'bana')) {
                        applyPickerSelection(pickerSelectedIdx, true);
                        return;
                    }

                    advanceToNextTarget(inp.getAttribute('data-next'));
                }
            });
        });

        const acceptBar = document.getElementById('texp-accept-bar');
        if (acceptBar) {
            acceptBar.addEventListener('keydown', (e) => {
                const k = e.key.toLowerCase();
                if (k === 'y' || (e.key === 'Enter' && document.activeElement?.id === 'texp-accept-print-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    submitTaniExpress(true);
                } else if (k === 's' || (e.key === 'Enter' && document.activeElement?.id === 'texp-accept-save-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    submitTaniExpress(false);
                } else if (k === 'n' || (e.key === 'Enter' && document.activeElement?.id === 'texp-accept-edit-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    hideTaniAcceptBarToEdit();
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const btns = Array.from(acceptBar.querySelectorAll('button'));
                    const cur = btns.indexOf(document.activeElement);
                    if (cur >= 0) {
                        const nxt = (e.key === 'ArrowRight') ? (cur + 1) % btns.length : (cur - 1 + btns.length) % btns.length;
                        btns[nxt]?.focus();
                    }
                }
            });
        }

        setTimeout(() => {
            if (karigerInp) {
                karigerInp.focus();
                renderContextualPicker('kariger', 'texp-kariger', '');
            }
        }, 60);

        window.removeEventListener('keydown', handleTaniExpressGlobalKeydown, true);
        window.addEventListener('keydown', handleTaniExpressGlobalKeydown, true);
    };

    const handleTaniExpressGlobalKeydown = (e) => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal || modal.style.display === 'none') return;

        if (e.key === 'F4') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            copyAllGhostFields();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const acceptBar = document.getElementById('texp-accept-bar');
            if (acceptBar && acceptBar.style.display !== 'none') {
                hideTaniAcceptBarToEdit();
                return;
            }
            if (currentStep === 2) {
                setTaniStep(1, 'texp-bana');
                return;
            }
            closeTaniExpressModal();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            printLastSavedTaniExpressSlip();
            return;
        }

        if (e.altKey && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            sendTaniExpressWhatsApp();
            return;
        }
    };

    window.closeTaniExpressModal = () => {
        window.removeEventListener('keydown', handleTaniExpressGlobalKeydown, true);
        const modal = document.getElementById('master-tani-express-modal');
        if (modal) modal.remove();
        isSubmittingTani = false;
    };

    /* ========================================================================
       5. ATOMIC SUBMIT (LOCK + ROLLBACK + SAVES TO TANI_ORDERS_LIST & PORTAL)
       ======================================================================== */
    window.submitTaniExpress = (shouldPrint = false) => {
        if (isSubmittingTani) return;

        const orderNo = String(document.getElementById('texp-order-no')?.value || '').trim() || getNextParchiNumber();
        const date = document.getElementById('texp-order-date')?.value || getToday();
        const kariger = String(document.getElementById('texp-kariger')?.value || '').trim().toUpperCase();
        const mohalla = String(document.getElementById('texp-mohalla')?.value || '').trim();
        const sancha = String(document.getElementById('texp-sancha')?.value || '').trim().toUpperCase();
        const rangi = String(document.getElementById('texp-rangi')?.value || '').trim().toUpperCase();

        const meter = safeNum(document.getElementById('texp-meter')?.value);
        const pcs = safeInt(document.getElementById('texp-pcs')?.value);
        const paai = String(document.getElementById('texp-paai')?.value || '').trim();
        const border = String(document.getElementById('texp-border')?.value || '').trim();
        const bana = String(document.getElementById('texp-bana')?.value || '').trim();

        if (!kariger) {
            showTaniAcceptBar(false);
            setTaniStep(1, 'texp-kariger');
            setTaniStatus('⚠️ कृपया कारीगर का नाम चुनिए!', true);
            return;
        }

        const allKarigers = toArray(getFromStore('kariger_list'));
        const karigerExists = allKarigers.some(k => k && String(k.name || '').trim().toUpperCase() === kariger);
        if (!karigerExists) {
            showTaniAcceptBar(false);
            setTaniStep(1, 'texp-kariger');
            setTaniStatus('⚠️ चुना गया कारीगर Master Sheet में नहीं है! कृपया सही कारीगर चुनें।', true);
            return;
        }

        isSubmittingTani = true;
        const snapOrders = cloneSnap(getFromStore('tani_orders_list'));
        const snapColors = cloneSnap(getFromStore('tani_learned_colors'));
        const snapRangi = cloneSnap(getFromStore('tani_learned_rangi'));
        let saveSucceeded = false;

        try {
            const matchingTable = [];
            const usedColors = [];

            if (border) usedColors.push(border);

            for (let i = 1; i <= 8; i++) {
                const sCol = String(document.getElementById(`texp-col-saree-${i}`)?.value || '').trim();
                const bCol = String(document.getElementById(`texp-col-border-${i}`)?.value || '').trim();
                const bnCol = String(document.getElementById(`texp-col-bana-${i}`)?.value || '').trim();
                if (sCol || bCol || bnCol) {
                    matchingTable.push({ row: i, saree: sCol, border: bCol, bana: bnCol });
                    if (sCol) usedColors.push(sCol);
                    if (bCol) usedColors.push(bCol);
                    if (bnCol) usedColors.push(bnCol);
                }
            }

            saveNewLearnedColors(usedColors);

            if (rangi) {
                const rList = toArray(getFromStore('tani_learned_rangi'));
                if (!rList.includes(rangi)) {
                    rList.push(rangi);
                    setToStore('tani_learned_rangi', rList);
                }
            }

            const selectedContrasts = [];
            const contrastLabels = [];
            document.querySelectorAll('input[name="texp_contrast"]:checked').forEach(c => {
                selectedContrasts.push(c.value);
                if (c.value === 'aanchal_blouse') contrastLabels.push('آنچل بلاؤز');
                else if (c.value === 'border_only') contrastLabels.push('صرف بارڈر');
                else if (c.value === 'self') contrastLabels.push('سیلف');
            });

            const contrastVal = selectedContrasts.length ? selectedContrasts.join(', ') : 'aanchal_blouse';
            const contrastLabel = contrastLabels.length ? contrastLabels.join(' + ') : 'آنچل بلاؤز کنٹراس';

            const list = getTaniOrders();
            const targetId = `tani_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

            const newOrderObj = {
                id: targetId,
                orderNo: orderNo,
                date: date,
                sancha: sancha,
                kariger: kariger,
                mohalla: mohalla,
                paai: paai,
                border: border,
                bana: bana,
                meter: meter,
                pcs: pcs,
                rangi: rangi,
                matchingTable: matchingTable,
                contrastVal: contrastVal,
                contrastLabel: contrastLabel,
                selectedContrasts: selectedContrasts,
                status: 'sancha',
                sanchaPortalStatus: 'pending',
                statusHistory: [
                    { status: 'sancha', date: date, note: 'Tani Express Entry' }
                ],
                createdAt: Date.now()
            };

            list.unshift(newOrderObj);
            setToStore('tani_orders_list', list);

            lastSavedTaniExpressOrder = newOrderObj;

            if (sancha && window.SanchaPortalSync && typeof window.SanchaPortalSync.pushTaniOrderToSanchaPortal === 'function') {
                window.SanchaPortalSync.pushTaniOrderToSanchaPortal(newOrderObj).then((ok) => {
                    if (ok) {
                        const latest = getTaniOrders();
                        const found = latest.find(x => String(x.id) === String(newOrderObj.id));
                        if (found && !found.sanchaPortalPushed) {
                            found.sanchaPortalPushed = true;
                            setToStore('tani_orders_list', latest);
                        }
                    }
                }).catch((syncErr) => console.warn('[TaniExpress] SanchaPortalSync error:', syncErr));
            }

            if (typeof window.updateTaniOrderBadges === 'function') window.updateTaniOrderBadges();
            if (typeof window.renderTaniMonthTabs === 'function') window.renderTaniMonthTabs();
            if (typeof window.renderTaniOrdersTable === 'function') window.renderTaniOrdersTable();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();

            showTaniAcceptBar(false);
            setTaniStatus(`✅ Parchi #${orderNo} (${kariger}) save & sync ho gayi!`);

            const nextNum = getNextParchiNumber();
            const noEl = document.getElementById('texp-order-no');
            const badgeEl = document.getElementById('texp-parchi-badge');
            if (noEl) noEl.value = nextNum;
            if (badgeEl) badgeEl.textContent = `Parchi #${nextNum}`;

            document.getElementById('texp-kariger').value = '';
            document.getElementById('texp-mohalla').value = '';
            document.getElementById('texp-sancha').value = '';
            document.getElementById('texp-rangi').value = '';
            document.getElementById('texp-meter').value = '';
            document.getElementById('texp-pcs').value = '';
            document.getElementById('texp-paai').value = '';
            document.getElementById('texp-border').value = '';
            document.getElementById('texp-bana').value = '';

            for (let i = 1; i <= 8; i++) {
                const sEl = document.getElementById(`texp-col-saree-${i}`);
                const bEl = document.getElementById(`texp-col-border-${i}`);
                const bnEl = document.getElementById(`texp-col-bana-${i}`);
                if (sEl) sEl.value = '';
                if (bEl) bEl.value = '';
                if (bnEl) bnEl.value = '';
            }

            // Reset matching style checkboxes to default
            document.querySelectorAll('input[name="texp_contrast"]').forEach((cb) => {
                cb.checked = (cb.value === 'aanchal_blouse');
            });

            clearAllGhosts();
            setTaniStep(1, 'texp-kariger');
            saveSucceeded = true;
        } catch (err) {
            console.error('[TaniExpress Save Failed]', err);
            try {
                setToStore('tani_orders_list', snapOrders);
                setToStore('tani_learned_colors', snapColors);
                setToStore('tani_learned_rangi', snapRangi);
            } catch (rbErr) {
                console.error('[TaniExpress Rollback Error]', rbErr);
            }
            setTaniStatus('❌ Error: Parchi save fail hui, data rollback ho gaya!', true);
        } finally {
            isSubmittingTani = false;
        }

        if (saveSucceeded && shouldPrint === true) {
            try {
                printLastSavedTaniExpressSlip();
            } catch (pErr) {
                console.warn('[TaniExpress Print Warning]', pErr);
            }
        }
    };

    /* ========================================================================
       6. A6 PHYSICAL SLIP PRINT (EXACT NASTALIQ URDU REPLICA - PWA SAFE)
       ======================================================================== */
    window.printLastSavedTaniExpressSlip = () => {
        if (!lastSavedTaniExpressOrder) {
            console.warn('[TaniExpress Print] Koi recent tani parchi nahi mili.');
            setTaniStatus('⚠️ प्रिंट करने के लिए कोई रीसेंट तानी पर्ची नहीं मिली!', true);
            return;
        }

        const item = lastSavedTaniExpressOrder;
        const matching = Array.isArray(item.matchingTable) ? item.matchingTable : [];
        let rowsHtml = '';

        for (let i = 1; i <= 8; i++) {
            const rowData = matching.find((m) => m.row === i) || { saree: '', border: '', bana: '' };
            rowsHtml += `
                <tr>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.saree || '-')}</td>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.border || '-')}</td>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.bana || '-')}</td>
                </tr>`;
        }

        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : ['aanchal_blouse'];
        const isAanchal = selContrasts.includes('aanchal_blouse') ? '☑' : '☐';
        const isBorder = selContrasts.includes('border_only') ? '☑' : '☐';
        const isSelf = selContrasts.includes('self') ? '☑' : '☐';

        const printWin = window.open('', '', 'width=450,height=700');
        if (!printWin) {
            console.warn('[TaniExpress Print] Popup block hai! Browser me popup allow karein.');
            setTaniStatus('⚠️ Print Popup block hai! Browser me popup allow karein.');
            return;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="ur" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>Tani Parchi #${item.orderNo}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: 'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #8b0000; direction: rtl; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; border: 2px solid #8b0000; padding: 6px; box-sizing: border-box; }
                    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #8b0000; padding-bottom: 4px; margin-bottom: 6px; }
                    .top-no { font-size: 18px; font-weight: 900; }
                    .header-line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
                    .main-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 4px; margin-top: 6px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border: 1.5px solid #8b0000; padding: 3px; background: #fff5f5; font-size: 11px; text-align: center; }
                    .spec-col { display: flex; flex-direction: column; justify-content: space-between; border-right: 1.5px solid #8b0000; padding-right: 6px; }
                    .spec-item { border-bottom: 1px solid #8b0000; padding: 4px 2px; font-size: 11px; display: flex; justify-content: space-between; }
                    .bottom-strip { border-top: 1.5px solid #8b0000; margin-top: 8px; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="top-bar">
                        <div class="top-no">${item.orderNo}</div>
                        <div style="font-size:12px; font-weight:bold;">سانچہ: <strong>${esc(item.sancha || '-')}</strong></div>
                        <div style="font-size:11px;">تاریخ: <strong>${formatDisplay(item.date)}</strong></div>
                    </div>

                    <div class="header-line">
                        <div>کاریگر کا نام: <strong>${esc(item.kariger || '-')}</strong></div>
                        <div>محلہ: <strong>${esc(item.mohalla || '-')}</strong></div>
                    </div>

                    <div class="main-grid">
                        <div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ساڑی</th>
                                        <th>بارڈر</th>
                                        <th>بانا</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>

                        <div class="spec-col">
                            <div class="spec-item"><span>پائی:</span> <strong>${esc(item.paai || '-')}</strong></div>
                            <div class="spec-item"><span>بارڈر:</span> <strong>${esc(item.border || '-')}</strong></div>
                            <div class="spec-item"><span>بانا:</span> <strong>${esc(item.bana || '-')}</strong></div>
                            <div class="spec-item"><span>میٹر:</span> <strong>${safeNum(item.meter)} Mtr</strong></div>
                            <div class="spec-item"><span>عدد:</span> <strong style="font-size:13px;">${safeInt(item.pcs)} Saree</strong></div>
                            <div class="spec-item" style="border-bottom:none;"><span>رنگی:</span> <strong style="font-size:12px;">${esc(item.rangi || '-')}</strong></div>
                        </div>
                    </div>

                    <div class="bottom-strip">
                        <div>${isAanchal} آنچل بلاؤز کنٹراس</div>
                        <div>${isBorder} صرف بارڈر کنٹراس</div>
                        <div>${isSelf} سیلف</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 700);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWin.document.close();
    };

    /* ========================================================================
       7. WHATSAPP PARCHI SHARING (PWA SAFE)
       ======================================================================== */
    window.sendTaniExpressWhatsApp = () => {
        if (!lastSavedTaniExpressOrder) {
            console.warn('[TaniExpress WA] Koi recent parchi nahi mili.');
            setTaniStatus('⚠️ व्हाट्सएप पर भेजने के लिए कोई रीसेंट पर्ची नहीं मिली!', true);
            return;
        }

        const item = lastSavedTaniExpressOrder;
        let msg = `📜 *TANI ORDER & RANGAI PARCHI #${item.orderNo}*\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `📅 *Tarikh:* ${formatDisplay(item.date)}\n` +
            `⚙️ *Sancha:* ${item.sancha || '-'}\n` +
            `👤 *Kariger:* ${item.kariger || '-'}${item.mohalla ? ` (${item.mohalla})` : ''}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📏 *Meter:* ${safeNum(item.meter)} Mtr\n` +
            `🥻 *Adad (Saree):* ${safeInt(item.pcs)} Pcs\n` +
            `🧵 *Paai:* ${item.paai || '-'}\n` +
            `✨ *Border:* ${item.border || '-'}\n` +
            `🧶 *Bana:* ${item.bana || '-'}\n` +
            `🎨 *Rangi Wala:* ${item.rangi || '-'}\n` +
            `🎯 *Matching:* ${item.contrastLabel || 'Self'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n`;

        if (Array.isArray(item.matchingTable) && item.matchingTable.length > 0) {
            msg += `🎨 *8 COLORS MATCHING:*\n`;
            item.matchingTable.forEach((m) => {
                msg += `• Row ${m.row}: Saree: ${m.saree || '-'} | Border: ${m.border || '-'} | Bana: ${m.bana || '-'}\n`;
            });
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        }

        msg += `_Simplicity ERP • by Farhan Jawed_`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       8. GLOBAL EXPORTS
       ======================================================================== */
    window.TaniExpressEngine = {
        openTaniExpressModal,
        closeTaniExpressModal,
        submitTaniExpress,
        printLastSavedTaniExpressSlip,
        sendTaniExpressWhatsApp
    };

})();
