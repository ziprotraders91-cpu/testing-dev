/* ============================================================================
   SIMPLICITY ERP - STOCK EXPRESS VOUCHER (TALLYPRIME WHITE & GOLD EDITION)
   Folder: stock-express / File: stock-express.js
   Developed for: Farhan Jawed
   Features:
   - TallyPrime White & Gold 2-Column Guided Drill-Down Voucher
   - Step-by-Step Right-Pane Pickers:
     Category -> [Sancha Type] -> Mode -> Item Name -> [Sancha Maker] -> Qty
   - Maker-Wise Sancha Stock Isolation & Live Balance Preview
   - Tally-Style "Accept? (Yes / No)" Confirmation Bar at End
   - Zero-Mouse Enter Chaining, Shift+Enter Back & Instant A6 Print
============================================================================ */

(() => {
    'use strict';

    let activeCategory = 'bana'; // 'bana' | 'zari' | 'sancha'
    let stockMode = 'purana';     // 'purana' | 'naya'
    let sanchaCat = 'tani';       // 'tani' | 'chukka'
    let lastSavedStockEntry = null;

    // Right-Pane Tally Picker State
    let stkPickerMode = 'category'; // 'category' | 'sancha_type' | 'mode' | 'item_purana' | 'item_naya' | 'sancha_person' | 'preview'
    let stkPickerItems = [];
    let stkPickerActiveIdx = 0;
    let stkPersonArrowUsed = false;

    const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof window.safeArray === 'function') return window.safeArray(v);
        return [];
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
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

    const getActiveTargetGodown = () => {
        return (typeof window.getActiveKarkhanaId === 'function')
            ? window.getActiveKarkhanaId()
            : (window.currentDashboardKarkhanaFilter || 'k_main');
    };

    const getStockExpressDatalists = () => {
        const rawBana = toArray(window.getStore ? window.getStore('bana_stock') : []);
        const uB = [];
        let banaOpts = '';
        rawBana.forEach((b) => {
            const n = b?.name ? b.name.trim() : '';
            if (n && uB.indexOf(n.toLowerCase()) === -1) {
                uB.push(n.toLowerCase());
                banaOpts += `<option value="${esc(n)}">`;
            }
        });

        const rawZari = toArray(window.getStore ? window.getStore('zari_stock') : []);
        const uZ = [];
        let zariOpts = '';
        rawZari.forEach((z) => {
            const n = z?.name ? z.name.trim() : '';
            if (n && uZ.indexOf(n.toLowerCase()) === -1) {
                uZ.push(n.toLowerCase());
                zariOpts += `<option value="${esc(n)}">`;
            }
        });

        const rawSancha = toArray(window.getStore ? window.getStore('sancha_items') : []);
        const uS = [];
        let sanchaOpts = '';
        rawSancha.forEach((s) => {
            const n = s?.name ? s.name.trim() : '';
            if (n && uS.indexOf(n.toLowerCase()) === -1) {
                uS.push(n.toLowerCase());
                sanchaOpts += `<option value="${esc(n)}">`;
            }
        });

        return { banaOpts, zariOpts, sanchaOpts };
    };

    const getCategoryStockItems = (cat, subSanchaCat, targetKid, queryText = '') => {
        const q = String(queryText || '').trim().toLowerCase();
        const seen = new Set();
        const items = [];

        if (cat === 'bana') {
            const raw = toArray(window.getStore ? window.getStore('bana_stock') : []);
            raw.forEach((x) => {
                const nm = x?.name ? x.name.trim() : '';
                if (!nm) return;
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                if (!matchKid) return;
                const key = nm.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (q && !key.includes(q)) return;

                const bacha = (typeof window.getBanaItemStats === 'function')
                    ? safeNum(window.getBanaItemStats(nm, targetKid).bacha)
                    : safeNum(x.bacha);
                items.push({ name: nm, bacha });
            });
        } else if (cat === 'zari') {
            const raw = toArray(window.getStore ? window.getStore('zari_stock') : []);
            raw.forEach((x) => {
                const nm = x?.name ? x.name.trim() : '';
                if (!nm) return;
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                if (!matchKid) return;
                const key = nm.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (q && !key.includes(q)) return;

                const bacha = (typeof window.getZariItemStats === 'function')
                    ? safeNum(window.getZariItemStats(nm, targetKid).bacha)
                    : safeNum(x.bacha);
                items.push({ name: nm, bacha });
            });
        } else if (cat === 'sancha') {
            const subCatLower = String(subSanchaCat || 'tani').toLowerCase();
            if (typeof window.getSanchaUniqueStockRows === 'function') {
                const rows = window.getSanchaUniqueStockRows(subCatLower, targetKid);
                rows.forEach((r) => {
                    const nm = String(r.name || '').trim();
                    const per = normPerson(r.person);
                    if (!nm) return;
                    const hay = `${nm} ${per}`.toLowerCase();
                    if (q && !hay.includes(q)) return;
                    items.push({ name: nm, person: per, bacha: safeNum(r.bacha) });
                });
            } else {
                const raw = toArray(window.getStore ? window.getStore('sancha_items') : []);
                raw.forEach((x) => {
                    const nm = x?.name ? x.name.trim() : '';
                    if (!nm) return;
                    const itemCat = String(x.category || 'tani').toLowerCase();
                    if (itemCat !== subCatLower) return;
                    const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    if (!matchKid) return;
                    const per = normPerson(x.person);
                    const key = `${nm.toLowerCase()}___${per.toLowerCase()}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    if (q && !`${nm} ${per}`.toLowerCase().includes(q)) return;

                    const bacha = (typeof window.getSanchaItemStats === 'function')
                        ? safeNum(window.getSanchaItemStats(null, nm, subCatLower, targetKid, per).bacha)
                        : safeNum(x.bacha);
                    items.push({ name: nm, person: per, bacha });
                });
            }
        }

        return items;
    };

    const getSanchaMakerPickerItems = (subSanchaCat, targetKid, itemNameFilter = '', queryText = '') => {
        const subCatLower = String(subSanchaCat || 'tani').toLowerCase();
        const q = String(queryText || '').trim().toLowerCase();
        const itemLower = String(itemNameFilter || '').trim().toLowerCase();

        const makerMap = new Map();
        const addMaker = (rawName, bachaAdd = 0, hasSelectedItem = false) => {
            const per = normPerson(rawName);
            if (!per) return;
            const key = per.toLowerCase();
            if (!makerMap.has(key)) {
                makerMap.set(key, { name: per, bacha: 0, matchesItem: false });
            }
            const m = makerMap.get(key);
            m.bacha = safeNum((m.bacha + bachaAdd).toFixed(2));
            if (hasSelectedItem) m.matchesItem = true;
        };

        if (typeof window.getSanchaUniqueStockRows === 'function') {
            const rows = window.getSanchaUniqueStockRows(subCatLower, targetKid);
            rows.forEach((r) => {
                const per = normPerson(r.person);
                if (!per) return;
                const matchIt = itemLower && String(r.name || '').trim().toLowerCase() === itemLower;
                if (!itemLower || matchIt) {
                    addMaker(per, safeNum(r.bacha), matchIt);
                } else {
                    addMaker(per, 0, false);
                }
            });
        } else {
            const raw = toArray(window.getStore ? window.getStore('sancha_items') : []);
            raw.forEach((x) => {
                if (!x) return;
                const per = normPerson(x.person);
                if (!per) return;
                const matchIt = itemLower && String(x.name || '').trim().toLowerCase() === itemLower;
                addMaker(per, matchIt ? safeNum(x.bacha) : 0, matchIt);
            });
        }

        // Also include known Sancha names from Tani Orders
        if (subCatLower === 'tani') {
            const orders = toArray(window.getStore ? window.getStore('tani_orders_list') : []);
            orders.forEach((o) => {
                if (o && o.sancha) addMaker(o.sancha, 0, false);
            });
        }

        let list = Array.from(makerMap.values());
        if (q) {
            list = list.filter((m) => m.name.toLowerCase().includes(q));
        }

        list.sort((a, b) => {
            if (a.matchesItem !== b.matchesItem) return a.matchesItem ? -1 : 1;
            if (b.bacha !== a.bacha) return b.bacha - a.bacha;
            return a.name.localeCompare(b.name);
        });

        return list.map((m) => ({
            label: m.name,
            sub: m.bacha > 0 ? `${m.bacha.toFixed(2)} Kg` : 'Maker',
            data: m.name
        }));
    };

    /* ========================================================================
       1. SCOPED TALLYPRIME WHITE & GOLD STYLES
       ------------------------------------------------------------------------
    ======================================================================== */
    const ensureTallyStockStyles = () => {
        if (document.getElementById('stk-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'stk-tally-styles';
        style.textContent = `
            .stk-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 14px; box-sizing: border-box;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            .stk-card {
                background: #ffffff;
                width: 100%; max-width: 940px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.14);
                overflow: hidden;
                max-height: 95vh;
                display: flex; flex-direction: column;
                color: #1f2937;
            }
            .stk-header {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 18px;
                display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
            }
            .stk-title {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
            }
            .stk-pill-btn {
                background: #ffffff; color: #374151;
                border: 1px solid #d1d5db; border-radius: 5px;
                padding: 5px 11px; font-size: 12px; font-weight: 700;
                cursor: pointer; transition: all 0.12s ease;
            }
            .stk-pill-btn:hover { border-color: #d9a425; background: #fef9ea; color: #1f2937; }
            .stk-pill-btn.active {
                background: #f2b71d; color: #1f2937;
                border-color: #d9a425; font-weight: 800;
            }
            .stk-body {
                display: grid; grid-template-columns: 1.45fr 1fr;
                gap: 16px; padding: 14px 18px;
                overflow-y: auto; flex: 1; background: #ffffff;
            }
            @media (max-width: 820px) {
                .stk-body { grid-template-columns: 1fr; }
            }
            .stk-sec-title {
                font-size: 11px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.6px;
                border-bottom: 1px solid #eadab0;
                padding-bottom: 4px; margin: 12px 0 8px 0;
            }
            .stk-row {
                display: grid; grid-template-columns: 155px 1fr;
                align-items: center; gap: 10px; margin-bottom: 8px;
            }
            .stk-lbl {
                font-size: 12.5px; font-weight: 600; color: #374151;
            }
            .stk-inp {
                width: 100%; box-sizing: border-box;
                padding: 6px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
                transition: border-color 0.12s, background 0.12s;
            }
            .stk-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            .stk-inp-num { text-align: right; font-variant-numeric: tabular-nums; }
            .stk-right-panel {
                border: 1px solid #e5d5a7; border-radius: 6px;
                background: #ffffff; display: flex; flex-direction: column;
                overflow: hidden; min-height: 360px;
            }
            .stk-right-head {
                background: #fdf6e2; border-bottom: 1px solid #e5d5a7;
                padding: 8px 12px; font-size: 12.5px; font-weight: 800; color: #1f2937;
                display: flex; justify-content: space-between; align-items: center;
            }
            .stk-picker-list {
                flex: 1; overflow-y: auto; max-height: 380px;
            }
            .stk-picker-item {
                padding: 8px 12px; font-size: 12.5px; font-weight: 600; color: #1f2937;
                border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center; gap: 8px;
            }
            .stk-picker-item:hover { background: #fef9ea; }
            .stk-picker-item.active {
                background: #f2b71d; color: #1f2937; font-weight: 800;
            }
            .stk-picker-sub {
                font-size: 11px; color: #6b7280; font-weight: 600;
            }
            .stk-picker-item.active .stk-picker-sub { color: #374151; }
            .stk-footer {
                background: #fdf6e2; border-top: 1px solid #e5d5a7;
                padding: 8px 18px;
                display: flex; justify-content: space-between; align-items: center;
                flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: #6b7280;
            }
            .stk-btn-save {
                background: #f2b71d; color: #1f2937;
                border: 1px solid #d9a425; border-radius: 5px;
                padding: 7px 20px; font-size: 13px; font-weight: 800;
                cursor: pointer;
            }
            .stk-btn-save:hover { background: #e5aa12; }
            .stk-btn-sec {
                background: #ffffff; color: #1f2937;
                border: 1px solid #d1d5db; border-radius: 5px;
                padding: 7px 14px; font-size: 12.5px; font-weight: 700;
                cursor: pointer;
            }
            .stk-btn-sec:hover { border-color: #d9a425; background: #fef9ea; }
            .stk-accept-bar {
                background: #fdf6e2; border: 1.5px solid #d9a425; border-radius: 5px;
                padding: 8px 12px; margin-top: 10px;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       2. OPEN STOCK EXPRESS MODAL (TALLY WHITE & GOLD GUIDED FLOW)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.openStockExpressModal = () => {
        ensureTallyStockStyles();
        const existing = document.getElementById('master-stock-express-modal');
        if (existing) existing.remove();

        activeCategory = 'bana';
        stockMode = 'purana';
        sanchaCat = 'tani';
        lastSavedStockEntry = null;
        stkPickerMode = 'category';
        stkPickerItems = [];
        stkPickerActiveIdx = 0;
        stkPersonArrowUsed = false;

        const today = getToday();
        const { banaOpts } = getStockExpressDatalists();
        const activeKid = getActiveTargetGodown();
        const godamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(activeKid)
            : 'Main Godown';

        const modalHtml = `
        <div id="master-stock-express-modal" class="stk-overlay">
            <div class="stk-card">

                <!-- Top Cream Header -->
                <div class="stk-header">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <h3 class="stk-title">Stock Inward Voucher</h3>
                        <span style="font-size:11.5px; background:#ffffff; border:1px solid #d9b86c; padding:3px 9px; border-radius:4px; font-weight:700; color:#92400e;">Godown: ${esc(godamName)}</span>
                        <div style="display:flex; gap:5px; margin-left:4px;">
                            <button type="button" id="stk-cat-bana" class="stk-pill-btn active" onclick="switchStockCategory('bana', true)">Bana [F1]</button>
                            <button type="button" id="stk-cat-zari" class="stk-pill-btn" onclick="switchStockCategory('zari', true)">Zari [F2]</button>
                            <button type="button" id="stk-cat-sancha" class="stk-pill-btn" onclick="switchStockCategory('sancha', true)">Sancha [F3]</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button type="button" id="stk-mode-purana" class="stk-pill-btn active" onclick="setStockExpressMode('purana', true)">Purana [F4]</button>
                        <button type="button" id="stk-mode-naya" class="stk-pill-btn" onclick="setStockExpressMode('naya', true)">+ Naya</button>
                        <button type="button" class="stk-pill-btn" onclick="closeStockExpressModal()">&larr; [Esc] Back</button>
                    </div>
                </div>

                <!-- 2-Column Split Body -->
                <div class="stk-body">

                    <!-- LEFT PANE: CLEAN TALLY VOUCHER ROWS (VISUAL ORDER === ENTER ORDER) -->
                    <div>
                        <div class="stk-sec-title" id="stk-col1-title" style="margin-top:0;">1. Stock Selection &amp; Mode</div>

                        <div class="stk-row">
                            <label class="stk-lbl">Date [Alt+D] :</label>
                            <input type="date" id="stk-date" value="${today}" class="stk-inp">
                        </div>

                        <div class="stk-row">
                            <label class="stk-lbl">Stock Category :</label>
                            <input type="text" id="stk-cat-input" value="Bana" readonly class="stk-inp" style="border-color:#d9a425; cursor:pointer;">
                        </div>

                        <!-- Sancha Type (Shown only when Sancha selected) -->
                        <div id="stk-box-sancha-type" class="stk-row" style="display:none;">
                            <label class="stk-lbl">Sancha Type :</label>
                            <input type="text" id="stk-sancha-type-input" value="Tani (Taana)" readonly class="stk-inp" style="cursor:pointer;">
                            <div style="display:none;">
                                <input type="radio" name="stk_sancha_type" value="tani" checked onchange="setSanchaCategory('tani')">
                                <input type="radio" name="stk_sancha_type" value="chukka" onchange="setSanchaCategory('chukka')">
                            </div>
                        </div>

                        <div class="stk-row">
                            <label class="stk-lbl">Entry Mode [F4] :</label>
                            <input type="text" id="stk-mode-input" value="Purana Item" readonly class="stk-inp" style="cursor:pointer;">
                        </div>

                        <div class="stk-sec-title">2. Item, Maker &amp; Inward Weight</div>

                        <!-- Purana Item Input -->
                        <div id="stk-box-purana" class="stk-row">
                            <label id="stk-lbl-purana" class="stk-lbl">Bana Item Name :</label>
                            <div>
                                <input type="text" id="stk-item-name" placeholder="Type to filter or &uarr;&darr;..." autocomplete="off" class="stk-inp" style="border-color:#d9a425;">
                                <datalist id="stk-items-dl">${banaOpts}</datalist>
                            </div>
                        </div>

                        <!-- Naya Item Input -->
                        <div id="stk-box-naya" class="stk-row" style="display:none;">
                            <label id="stk-lbl-naya" class="stk-lbl">New Bana Name :</label>
                            <input type="text" id="stk-new-name" placeholder="Naye item ka poora naam likhein..." autocomplete="off" class="stk-inp" style="border-color:#d9a425;">
                        </div>

                        <!-- Sancha Maker Input (Right below Item Name!) -->
                        <div id="stk-box-sancha-maker" class="stk-row" style="display:none;">
                            <label class="stk-lbl">Sancha Maker :</label>
                            <input type="text" id="stk-sancha-person" placeholder="Type Maker or &uarr;&darr; Select..." autocomplete="off" class="stk-inp">
                        </div>

                        <div class="stk-row">
                            <label class="stk-lbl">Inward Qty (Kg) :</label>
                            <input type="number" step="0.01" id="stk-qty" placeholder="0.00" oninput="window.__stkUpdateLivePreview()" class="stk-inp stk-inp-num" style="border-color:#d9a425; font-size:15px;">
                        </div>

                        <div class="stk-row">
                            <label class="stk-lbl">Supplier / Bill / Note :</label>
                            <input type="text" id="stk-note" placeholder="Jaise: Bill No 120 / Mandi Se" oninput="window.__stkUpdateLivePreview()" class="stk-inp">
                        </div>

                        <!-- Live Stock Strip -->
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#fdfcf7; border:1px solid #eadab0; border-radius:4px; padding:7px 10px; margin-top:8px; font-size:12px;">
                            <span>Current Stock: <strong id="stk-live-bacha-display" style="color:#1f2937;">0.00 Kg</strong></span>
                            <span id="stk-live-hint" style="color:#6b7280; font-size:11px;">Godown balance</span>
                        </div>

                        <!-- Tally Accept? (Yes / No) Confirmation Bar -->
                        <div id="stk-accept-strip" class="stk-accept-bar" style="display:none;">
                            <span style="font-size:13px; font-weight:800; color:#1f2937;">Accept? Stock Jama Karein?</span>
                            <div style="display:flex; gap:8px;">
                                <button type="button" id="stk-accept-yes" class="stk-btn-save" style="padding:5px 14px;" onclick="submitMasterStockExpress()">Yes [Y / Enter]</button>
                                <button type="button" id="stk-accept-no" class="stk-btn-sec" style="padding:5px 14px;" onclick="window.__stkCancelAccept()">No [N / Esc]</button>
                            </div>
                        </div>

                        <!-- Bottom Voucher Action Strip -->
                        <div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:12px; padding-top:10px; border-top:1px solid #eadab0;">
                            <button type="button" id="stk-print-btn" class="stk-btn-sec" onclick="printLastSavedStockSlip()">A6 Parchi [Alt+P]</button>
                            <button type="button" id="stk-submit-btn" class="stk-btn-save" onclick="submitMasterStockExpress()">Save Stock [Ctrl+Enter]</button>
                        </div>
                    </div>

                    <!-- RIGHT PANE: DYNAMIC TALLY PICKER / LIVE PREVIEW -->
                    <div class="stk-right-panel">
                        <div class="stk-right-head">
                            <span id="stk-right-title">List of Categories</span>
                            <span id="stk-right-hint" style="font-size:11px; color:#6b7280; font-weight:600;">&uarr;&darr; + Enter</span>
                        </div>

                        <div id="stk-right-picker" class="stk-picker-list"></div>

                        <div id="stk-right-preview" style="display:none; padding:12px; font-size:12.5px; line-height:1.5; flex:1; overflow-y:auto;"></div>
                    </div>

                </div>

                <!-- Bottom Status Bar -->
                <div class="stk-footer">
                    <div id="stk-status-msg" style="font-weight:700; color:#b47d00;">
                        [&uarr;&darr; + Enter] Right List Select &bull; [Shift+Enter] Prev &bull; [F1/F2/F3] Cat &bull; [F4] Mode &bull; [Esc] Back
                    </div>
                    <div style="font-weight:600;">TallyPrime White &amp; Gold Mode</div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        bindStockExpressEvents();
        showStkRightPicker('category', '');
    };

    /* ========================================================================
       3. RIGHT-PANE GUIDED TALLY PICKER CONTROLLER
       ------------------------------------------------------------------------
    ======================================================================== */
    const getStepFieldOrder = () => {
        const order = ['stk-date', 'stk-cat-input'];
        if (activeCategory === 'sancha') {
            order.push('stk-sancha-type-input');
        }
        order.push('stk-mode-input');
        order.push(stockMode === 'purana' ? 'stk-item-name' : 'stk-new-name');
        if (activeCategory === 'sancha') {
            order.push('stk-sancha-person');
        }
        order.push('stk-qty', 'stk-note');
        return order;
    };

    const moveStkField = (currentId, dir) => {
        const order = getStepFieldOrder();
        const idx = order.indexOf(currentId);
        if (idx === -1) return;
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < order.length) {
            const el = document.getElementById(order[nextIdx]);
            if (el) {
                el.focus();
                if (typeof el.select === 'function' && !el.readOnly) el.select();
            }
        }
    };

    const showStkRightPicker = (mode, queryText) => {
        stkPickerMode = mode;
        const pickerEl = document.getElementById('stk-right-picker');
        const previewEl = document.getElementById('stk-right-preview');
        const titleEl = document.getElementById('stk-right-title');
        const hintEl = document.getElementById('stk-right-hint');
        if (!pickerEl || !previewEl) return;

        if (mode === 'preview') {
            pickerEl.style.display = 'none';
            previewEl.style.display = 'block';
            if (titleEl) titleEl.textContent = 'Live Inward Preview';
            if (hintEl) hintEl.textContent = 'Stock Summary';
            window.__stkUpdateLivePreview();
            return;
        }

        pickerEl.style.display = 'block';
        previewEl.style.display = 'none';
        stkPickerItems = [];

        if (mode === 'category') {
            if (titleEl) titleEl.textContent = 'List of Categories';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            stkPickerItems = [
                { label: 'Bana', sub: 'F1', data: 'bana' },
                { label: 'Zari', sub: 'F2', data: 'zari' },
                { label: 'Sancha', sub: 'F3 (Tani / Chukka)', data: 'sancha' }
            ];
            const curIdx = stkPickerItems.findIndex(i => i.data === activeCategory);
            stkPickerActiveIdx = curIdx >= 0 ? curIdx : 0;
        } else if (mode === 'sancha_type') {
            if (titleEl) titleEl.textContent = 'List of Sancha Types';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            stkPickerItems = [
                { label: 'Tani (Taana)', sub: 'Warp', data: 'tani' },
                { label: 'Chukka', sub: 'Chukka', data: 'chukka' }
            ];
            const curIdx = stkPickerItems.findIndex(i => i.data === sanchaCat);
            stkPickerActiveIdx = curIdx >= 0 ? curIdx : 0;
        } else if (mode === 'mode') {
            if (titleEl) titleEl.textContent = 'Select Entry Mode';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            stkPickerItems = [
                { label: 'Purana Item (Existing Stock)', sub: 'Select from List', data: 'purana' },
                { label: '+ Naya Item (Create New)', sub: 'New Item Entry', data: 'naya' }
            ];
            const curIdx = stkPickerItems.findIndex(i => i.data === stockMode);
            stkPickerActiveIdx = curIdx >= 0 ? curIdx : 0;
        } else if (mode === 'item_purana') {
            const catLabel = activeCategory === 'bana'
                ? 'Bana Stock'
                : (activeCategory === 'zari'
                    ? 'Zari Stock'
                    : (sanchaCat === 'chukka' ? 'Sancha (Chukka) Stock' : 'Sancha (Tani) Stock'));
            if (titleEl) titleEl.textContent = `List of ${catLabel}`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';

            const targetKid = getActiveTargetGodown();
            const list = getCategoryStockItems(activeCategory, sanchaCat, targetKid, queryText);
            stkPickerItems = list.map(it => ({
                label: it.name,
                sub: it.person ? `${it.person} · ${it.bacha.toFixed(2)} Kg` : `${it.bacha.toFixed(2)} Kg`,
                data: it.name,
                person: it.person || ''
            }));
            if (stkPickerActiveIdx >= stkPickerItems.length) stkPickerActiveIdx = 0;
            if (stkPickerActiveIdx < 0) stkPickerActiveIdx = 0;
        } else if (mode === 'item_naya') {
            if (titleEl) titleEl.textContent = 'Existing Items (Duplicate Check)';
            if (hintEl) hintEl.textContent = 'Type New Item + Enter';

            const targetKid = getActiveTargetGodown();
            const list = getCategoryStockItems(activeCategory, sanchaCat, targetKid, queryText);
            stkPickerItems = list.map(it => ({
                label: it.name,
                sub: it.person ? `${it.person} · ${it.bacha.toFixed(2)} Kg` : `${it.bacha.toFixed(2)} Kg`,
                data: it.name,
                readOnly: true
            }));
        } else if (mode === 'sancha_person') {
            if (titleEl) titleEl.textContent = `List of Sancha Makers (${sanchaCat === 'chukka' ? 'Chukka' : 'Tani'})`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter or Type New';

            const targetKid = getActiveTargetGodown();
            const itemInp = stockMode === 'naya' ? document.getElementById('stk-new-name') : document.getElementById('stk-item-name');
            const curItemName = String(itemInp?.value || '').trim();
            stkPickerItems = getSanchaMakerPickerItems(sanchaCat, targetKid, curItemName, queryText);
            if (stkPickerActiveIdx >= stkPickerItems.length) stkPickerActiveIdx = 0;
            if (stkPickerActiveIdx < 0) stkPickerActiveIdx = 0;
        }

        renderStkRightPickerList();
    };

    const renderStkRightPickerList = () => {
        const pickerEl = document.getElementById('stk-right-picker');
        if (!pickerEl) return;

        if (!stkPickerItems.length) {
            const msg = stkPickerMode === 'item_naya'
                ? 'Koi matching purana item nahi mila (Naya naam safe hai). Type karke [Enter] dabayein.'
                : (stkPickerMode === 'sancha_person'
                    ? 'Naya Sancha Maker naam seedha type karke [Enter] dabayein.'
                    : 'Is Godown me koi stock item nahi mila. [F4] se Naya Item banayein.');
            pickerEl.innerHTML = `<div style="padding:18px 12px; text-align:center; color:#6b7280; font-size:12px;">${msg}</div>`;
            return;
        }

        let html = '';
        stkPickerItems.forEach((item, idx) => {
            const isActive = !item.readOnly && idx === stkPickerActiveIdx;
            const cls = isActive ? 'stk-picker-item active' : 'stk-picker-item';
            const attr = item.readOnly
                ? ''
                : `onmousedown="event.preventDefault(); window.__stkPickItem(${idx})"`;
            html += `<div class="${cls}" ${attr}>
                <span>${esc(item.label)}</span>
                <span class="stk-picker-sub">${esc(item.sub)}</span>
            </div>`;
        });
        pickerEl.innerHTML = html;

        const activeEl = pickerEl.querySelector('.stk-picker-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    };

    window.__stkPickItem = (idx) => {
        const item = stkPickerItems[idx];
        if (!item || item.readOnly) return;

        if (stkPickerMode === 'category') {
            window.switchStockCategory(item.data, true);
        } else if (stkPickerMode === 'sancha_type') {
            window.setSanchaCategory(item.data, true);
        } else if (stkPickerMode === 'mode') {
            window.setStockExpressMode(item.data, true);
        } else if (stkPickerMode === 'item_purana') {
            const inp = document.getElementById('stk-item-name');
            if (inp) inp.value = item.data;
            if (activeCategory === 'sancha' && item.person) {
                const pInp = document.getElementById('stk-sancha-person');
                if (pInp) pInp.value = item.person;
            }
            updateStockExpressLiveStats();
            moveStkField('stk-item-name', 1);
        } else if (stkPickerMode === 'sancha_person') {
            const pInp = document.getElementById('stk-sancha-person');
            if (pInp) pInp.value = item.data;
            updateStockExpressLiveStats();
            moveStkField('stk-sancha-person', 1);
        }
    };

    window.__stkUpdateLivePreview = () => {
        const previewEl = document.getElementById('stk-right-preview');
        if (!previewEl) return;

        const targetKid = getActiveTargetGodown();
        const godamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(targetKid)
            : 'Main Godown';

        const isNew = (stockMode === 'naya');
        const nameVal = String((isNew ? document.getElementById('stk-new-name') : document.getElementById('stk-item-name'))?.value || '').trim() || '-';
        const qtyVal = safeNum(document.getElementById('stk-qty')?.value, 0);
        const noteVal = String(document.getElementById('stk-note')?.value || '').trim() || '-';
        const personRaw = String(document.getElementById('stk-sancha-person')?.value || '').trim();
        const personVal = personRaw || '-';
        const dateVal = document.getElementById('stk-date')?.value || getToday();

        let curBacha = 0;
        if (nameVal !== '-') {
            if (activeCategory === 'bana' && !isNew && typeof window.getBanaItemStats === 'function') {
                curBacha = safeNum(window.getBanaItemStats(nameVal, targetKid).bacha);
            } else if (activeCategory === 'zari' && !isNew && typeof window.getZariItemStats === 'function') {
                curBacha = safeNum(window.getZariItemStats(nameVal, targetKid).bacha);
            } else if (activeCategory === 'sancha' && typeof window.getSanchaItemStats === 'function') {
                const pNorm = normPerson(personRaw);
                curBacha = safeNum(window.getSanchaItemStats(null, nameVal, sanchaCat, targetKid, pNorm || null).bacha);
            }
        }
        const afterTotal = curBacha + qtyVal;

        const catLabel = activeCategory === 'bana'
            ? 'Bana'
            : (activeCategory === 'zari'
                ? 'Zari'
                : `Sancha (${sanchaCat === 'chukka' ? 'Chukka' : 'Tani'})`);

        previewEl.innerHTML = `
            <div style="border-bottom:1px solid #eadab0; padding-bottom:8px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:800; color:#1f2937;">${esc(nameVal)}</div>
                <div style="font-size:11.5px; color:#6b7280;">${esc(catLabel)} &bull; ${isNew ? '+ Naya Item' : 'Purana Item'}</div>
            </div>
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Godown:</span><strong>${esc(godamName)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Date:</span><strong>${esc(dateVal)}</strong>
            </div>
            ${activeCategory === 'sancha' ? `
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Sancha Maker:</span><strong>${esc(personVal)}</strong>
            </div>` : ''}
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Note / Supplier:</span><strong>${esc(noteVal)}</strong>
            </div>
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px; padding:9px 10px; margin-top:10px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span style="color:#6b7280;">Current Stock:</span><strong>${curBacha.toFixed(2)} Kg</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span style="color:#6b7280;">+ Inward Qty:</span><strong style="color:#b47d00;">+${qtyVal.toFixed(2)} Kg</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13.5px; border-top:1px dashed #d9b86c; padding-top:5px; margin-top:4px;">
                    <span style="font-weight:700;">Closing Stock:</span><strong style="color:#b47d00;">${afterTotal.toFixed(2)} Kg</strong>
                </div>
            </div>
        `;
    };

    const showStkAcceptPrompt = (show) => {
        const bar = document.getElementById('stk-accept-strip');
        if (!bar) return;
        bar.style.display = show ? 'flex' : 'none';
        if (show) {
            const yesBtn = document.getElementById('stk-accept-yes');
            if (yesBtn) yesBtn.focus();
        }
    };

    /* ========================================================================
       4. KEYBOARD LISTENERS & STEP NAVIGATION
       ------------------------------------------------------------------------
    ======================================================================== */
    const bindStockExpressEvents = () => {
        const modal = document.getElementById('master-stock-express-modal');
        if (!modal) return;

        window.__stkCancelAccept = () => {
            showStkAcceptPrompt(false);
            document.getElementById('stk-note')?.focus();
        };

        const yesBtn = document.getElementById('stk-accept-yes');
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    submitMasterStockExpress();
                } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__stkCancelAccept();
                }
            });
        }

        const catInp = document.getElementById('stk-cat-input');
        const sanchaTypeInp = document.getElementById('stk-sancha-type-input');
        const modeInp = document.getElementById('stk-mode-input');
        const itemInp = document.getElementById('stk-item-name');
        const newNameInp = document.getElementById('stk-new-name');
        const personInp = document.getElementById('stk-sancha-person');
        const qtyInp = document.getElementById('stk-qty');
        const noteInp = document.getElementById('stk-note');
        const dateInp = document.getElementById('stk-date');

        setTimeout(() => { if (catInp) catInp.focus(); }, 100);

        const attachPickerInput = (el, modeName, isFilterable) => {
            if (!el) return;
            el.addEventListener('focus', () => {
                showStkRightPicker(modeName, isFilterable ? el.value : '');
            });
            if (isFilterable) {
                el.addEventListener('input', () => {
                    stkPickerActiveIdx = 0;
                    showStkRightPicker(modeName, el.value);
                    if (modeName === 'item_purana') updateStockExpressLiveStats();
                });
            }
            el.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (stkPickerItems.length && modeName !== 'item_naya') {
                        e.preventDefault();
                        if (e.key === 'ArrowDown') {
                            stkPickerActiveIdx = (stkPickerActiveIdx + 1) % stkPickerItems.length;
                        } else {
                            stkPickerActiveIdx = (stkPickerActiveIdx - 1 + stkPickerItems.length) % stkPickerItems.length;
                        }
                        renderStkRightPickerList();
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveStkField(el.id, -1);
                        return;
                    }
                    if (modeName === 'item_naya') {
                        moveStkField(el.id, 1);
                        return;
                    }
                    if (stkPickerItems.length && stkPickerItems[stkPickerActiveIdx]) {
                        window.__stkPickItem(stkPickerActiveIdx);
                    } else if (modeName === 'item_purana') {
                        moveStkField(el.id, 1);
                    }
                }
            });
        };

        attachPickerInput(catInp, 'category', false);
        attachPickerInput(sanchaTypeInp, 'sancha_type', false);
        attachPickerInput(modeInp, 'mode', false);
        attachPickerInput(itemInp, 'item_purana', true);
        attachPickerInput(newNameInp, 'item_naya', true);

        // Sancha Maker Picker (Arrow navigation picks from list; typing new name keeps typed text)
        if (personInp) {
            personInp.addEventListener('focus', () => {
                stkPersonArrowUsed = false;
                stkPickerActiveIdx = 0;
                showStkRightPicker('sancha_person', personInp.value);
            });
            personInp.addEventListener('input', () => {
                stkPersonArrowUsed = false;
                stkPickerActiveIdx = 0;
                showStkRightPicker('sancha_person', personInp.value);
                updateStockExpressLiveStats();
            });
            personInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (stkPickerItems.length) {
                        e.preventDefault();
                        stkPersonArrowUsed = true;
                        if (e.key === 'ArrowDown') {
                            stkPickerActiveIdx = (stkPickerActiveIdx + 1) % stkPickerItems.length;
                        } else {
                            stkPickerActiveIdx = (stkPickerActiveIdx - 1 + stkPickerItems.length) % stkPickerItems.length;
                        }
                        renderStkRightPickerList();
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveStkField('stk-sancha-person', -1);
                        return;
                    }
                    if (stkPersonArrowUsed && stkPickerItems.length && stkPickerItems[stkPickerActiveIdx]) {
                        window.__stkPickItem(stkPickerActiveIdx);
                        return;
                    }
                    updateStockExpressLiveStats();
                    moveStkField('stk-sancha-person', 1);
                }
            });
        }

        [dateInp, qtyInp, noteInp].forEach((el) => {
            if (!el) return;
            el.addEventListener('focus', () => {
                if (el.id !== 'stk-date') {
                    showStkRightPicker('preview', '');
                }
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveStkField(el.id, -1);
                        return;
                    }
                    if (el.id === 'stk-note') {
                        showStkAcceptPrompt(true);
                        return;
                    }
                    moveStkField(el.id, 1);
                }
            });
        });

        window.removeEventListener('keydown', handleStockExpressGlobalKeydown, true);
        window.addEventListener('keydown', handleStockExpressGlobalKeydown, true);
    };

    const handleStockExpressGlobalKeydown = (e) => {
        const modal = document.getElementById('master-stock-express-modal');
        if (!modal || modal.style.display === 'none') return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const acceptBar = document.getElementById('stk-accept-strip');
            if (acceptBar && acceptBar.style.display !== 'none') {
                window.__stkCancelAccept();
            } else {
                closeStockExpressModal();
            }
            return;
        }

        if (e.key === 'F1' || (e.altKey && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('bana', true);
            return;
        }

        if (e.key === 'F2' || (e.altKey && (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('zari', true);
            return;
        }

        if (e.key === 'F3' || (e.altKey && (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('sancha', true);
            return;
        }

        if (e.key === 'F4') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            setStockExpressMode(stockMode === 'purana' ? 'naya' : 'purana', true);
            return;
        }

        if (e.altKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            document.getElementById('stk-date')?.focus();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            printLastSavedStockSlip();
            return;
        }

        if (e.ctrlKey && (e.key === 'Enter' || e.key === 'a' || e.key === 'A')) {
            if (e.key === 'Enter' || (document.activeElement?.id !== 'stk-item-name' && document.activeElement?.id !== 'stk-new-name')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                submitMasterStockExpress();
                return;
            }
        }
    };

    window.closeStockExpressModal = () => {
        window.removeEventListener('keydown', handleStockExpressGlobalKeydown, true);
        const modal = document.getElementById('master-stock-express-modal');
        if (modal) modal.remove();
    };

    /* ========================================================================
       5. CATEGORY, SANCHA TYPE & MODE SWITCHERS
       ------------------------------------------------------------------------
    ======================================================================== */
    window.switchStockCategory = (cat, advanceFocus = false) => {
        activeCategory = cat;
        const btnB = document.getElementById('stk-cat-bana');
        const btnZ = document.getElementById('stk-cat-zari');
        const btnS = document.getElementById('stk-cat-sancha');
        const catInp = document.getElementById('stk-cat-input');
        const boxSanchaType = document.getElementById('stk-box-sancha-type');
        const boxSanchaMaker = document.getElementById('stk-box-sancha-maker');
        const col1Title = document.getElementById('stk-col1-title');
        const dl = document.getElementById('stk-items-dl');
        const nameInp = document.getElementById('stk-item-name');
        const newNameInp = document.getElementById('stk-new-name');

        const { banaOpts, zariOpts, sanchaOpts } = getStockExpressDatalists();

        [btnB, btnZ, btnS].forEach(b => { if (b) b.classList.remove('active'); });

        if (cat === 'bana') {
            if (btnB) btnB.classList.add('active');
            if (catInp) catInp.value = 'Bana';
            if (boxSanchaType) boxSanchaType.style.display = 'none';
            if (boxSanchaMaker) boxSanchaMaker.style.display = 'none';
            if (col1Title) col1Title.textContent = '1. Bana Stock Selection & Mode';
            if (dl) dl.innerHTML = banaOpts;
            const lblP = document.getElementById('stk-lbl-purana');
            const lblN = document.getElementById('stk-lbl-naya');
            if (lblP) lblP.textContent = 'Bana Item Name :';
            if (lblN) lblN.textContent = 'New Bana Name :';
        } else if (cat === 'zari') {
            if (btnZ) btnZ.classList.add('active');
            if (catInp) catInp.value = 'Zari';
            if (boxSanchaType) boxSanchaType.style.display = 'none';
            if (boxSanchaMaker) boxSanchaMaker.style.display = 'none';
            if (col1Title) col1Title.textContent = '1. Zari Stock Selection & Mode';
            if (dl) dl.innerHTML = zariOpts;
            const lblP = document.getElementById('stk-lbl-purana');
            const lblN = document.getElementById('stk-lbl-naya');
            if (lblP) lblP.textContent = 'Zari Item Name :';
            if (lblN) lblN.textContent = 'New Zari Name :';
        } else if (cat === 'sancha') {
            if (btnS) btnS.classList.add('active');
            if (catInp) catInp.value = 'Sancha';
            if (boxSanchaType) boxSanchaType.style.display = 'grid';
            if (boxSanchaMaker) boxSanchaMaker.style.display = 'grid';
            if (col1Title) col1Title.textContent = '1. Sancha Stock Selection & Mode';
            if (dl) dl.innerHTML = sanchaOpts;
            const lblP = document.getElementById('stk-lbl-purana');
            const lblN = document.getElementById('stk-lbl-naya');
            if (lblP) lblP.textContent = 'Sancha Item Name :';
            if (lblN) lblN.textContent = 'New Sancha Item :';
        }

        if (nameInp) nameInp.value = '';
        if (newNameInp) newNameInp.value = '';
        updateStockExpressLiveStats();

        if (advanceFocus) {
            if (cat === 'sancha') {
                setTimeout(() => document.getElementById('stk-sancha-type-input')?.focus(), 15);
            } else {
                setTimeout(() => document.getElementById('stk-mode-input')?.focus(), 15);
            }
        }
    };

    window.setSanchaCategory = (cat, advanceFocus = false) => {
        sanchaCat = cat;
        const typeInp = document.getElementById('stk-sancha-type-input');
        if (typeInp) typeInp.value = cat === 'chukka' ? 'Chukka' : 'Tani (Taana)';

        const radios = document.querySelectorAll('input[name="stk_sancha_type"]');
        radios.forEach((r) => { r.checked = (r.value === cat); });

        updateStockExpressLiveStats();

        if (advanceFocus) {
            setTimeout(() => document.getElementById('stk-mode-input')?.focus(), 15);
        }
    };

    window.setStockExpressMode = (mode, advanceFocus = false) => {
        stockMode = mode;
        const btnP = document.getElementById('stk-mode-purana');
        const btnN = document.getElementById('stk-mode-naya');
        const modeInp = document.getElementById('stk-mode-input');
        const boxP = document.getElementById('stk-box-purana');
        const boxN = document.getElementById('stk-box-naya');

        if (mode === 'purana') {
            if (btnP) btnP.classList.add('active');
            if (btnN) btnN.classList.remove('active');
            if (modeInp) modeInp.value = 'Purana Item';
            if (boxP) boxP.style.display = 'grid';
            if (boxN) boxN.style.display = 'none';
            if (advanceFocus) {
                setTimeout(() => {
                    const el = document.getElementById('stk-item-name');
                    if (el) { el.focus(); el.select?.(); }
                }, 15);
            }
        } else {
            if (btnP) btnP.classList.remove('active');
            if (btnN) btnN.classList.add('active');
            if (modeInp) modeInp.value = '+ Naya Item';
            if (boxP) boxP.style.display = 'none';
            if (boxN) boxN.style.display = 'grid';
            if (advanceFocus) {
                setTimeout(() => {
                    const el = document.getElementById('stk-new-name');
                    if (el) { el.focus(); el.select?.(); }
                }, 15);
            }
        }
        updateStockExpressLiveStats();
    };

    /* ========================================================================
       6. LIVE STOCK CHECKER (MAKER-AWARE FOR SANCHA)
       ------------------------------------------------------------------------
    ======================================================================== */
    const updateStockExpressLiveStats = () => {
        const isNew = (stockMode === 'naya');
        const val = (isNew ? document.getElementById('stk-new-name') : document.getElementById('stk-item-name'))?.value.trim();
        const disp = document.getElementById('stk-live-bacha-display');
        const hint = document.getElementById('stk-live-hint');
        const targetKid = getActiveTargetGodown();

        if (!val) {
            if (disp) disp.textContent = '0.00 Kg';
            if (hint) hint.textContent = isNew ? 'Naya stock item banega' : 'Item chunte hi live stock dikhega';
            return;
        }

        let bacha = 0;
        if (activeCategory === 'bana' && !isNew && typeof window.getBanaItemStats === 'function') {
            bacha = safeNum(window.getBanaItemStats(val, targetKid).bacha);
        } else if (activeCategory === 'zari' && !isNew && typeof window.getZariItemStats === 'function') {
            bacha = safeNum(window.getZariItemStats(val, targetKid).bacha);
        } else if (activeCategory === 'sancha' && typeof window.getSanchaItemStats === 'function') {
            const pNorm = normPerson(document.getElementById('stk-sancha-person')?.value);
            bacha = safeNum(window.getSanchaItemStats(null, val, sanchaCat, targetKid, pNorm || null).bacha);
        }

        if (disp) disp.textContent = `${bacha.toFixed(2)} Kg`;
        if (hint) {
            if (activeCategory === 'sancha') {
                const pNorm = normPerson(document.getElementById('stk-sancha-person')?.value);
                hint.textContent = pNorm ? `Maker (${pNorm}) ke paas stock` : 'Godown me total stock';
            } else {
                hint.textContent = isNew ? 'Naya stock item banega' : 'Godown me maujooda stock';
            }
        }
    };

    /* ========================================================================
       7. ATOMIC SUBMIT (MAKER-WISE SANCHA ISOLATION)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.submitMasterStockExpress = () => {
        showStkAcceptPrompt(false);

        const date = document.getElementById('stk-date')?.value || getToday();
        const isNew = (stockMode === 'naya');

        const nameInp = isNew ? document.getElementById('stk-new-name') : document.getElementById('stk-item-name');
        const name = String(nameInp?.value || '').trim();
        const qty = safeNum(document.getElementById('stk-qty')?.value);
        const note = String(document.getElementById('stk-note')?.value || '').trim();
        const targetKid = getActiveTargetGodown();

        if (!name) {
            alert('Kripya item ka sahi naam likhein!');
            nameInp?.focus();
            return;
        }

        if (qty <= 0) {
            alert('Kripya sahi wazan (Kg me) bharein!');
            document.getElementById('stk-qty')?.focus();
            return;
        }

        const now = Date.now();
        let savedPerson = '';

        if (activeCategory === 'bana') {
            const list = toArray(window.getStore ? window.getStore('bana_stock') : []);
            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                item.date = date;
            } else {
                list.push({
                    id: `bana_${now}`,
                    date, name, aaya: qty, gaya: 0, bacha: qty,
                    karkhanaId: targetKid, timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('bana_stock', list);

            const hist = toArray(window.getStore ? window.getStore('bana_history') : []);
            hist.push({
                id: `bhist_${now}`,
                date, name,
                kariger: note || 'Godown Purchase',
                type: 'Khareed (Inward)',
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('bana_history', hist);

            if (typeof window.renderBanaTable === 'function') window.renderBanaTable();

        } else if (activeCategory === 'zari') {
            const list = toArray(window.getStore ? window.getStore('zari_stock') : []);
            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                item.date = date;
            } else {
                list.push({
                    id: `zari_${now}`,
                    date, name, aaya: qty, gaya: 0, bacha: qty,
                    karkhanaId: targetKid, timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('zari_stock', list);

            const hist = toArray(window.getStore ? window.getStore('zari_history') : []);
            hist.push({
                id: `zhist_${now}`,
                date, name,
                kariger: note || 'Godown Purchase',
                type: 'Khareed (Inward)',
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

            if (typeof window.renderZariTable === 'function') window.renderZariTable();

        } else if (activeCategory === 'sancha') {
            const person = normPerson(document.getElementById('stk-sancha-person')?.value);
            savedPerson = person;
            const category = sanchaCat;
            const list = toArray(window.getStore ? window.getStore('sancha_items') : []);

            const item = list.find((x) => {
                if (!x || !x.name) return false;
                const cat = x.category || 'tani';
                const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                const xPer = normPerson(x.person).toLowerCase();
                return x.name.toLowerCase() === name.toLowerCase() &&
                       cat.toLowerCase() === category.toLowerCase() &&
                       matchK &&
                       xPer === person.toLowerCase();
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                item.person = person || '-';
                item.date = date;
            } else {
                list.push({
                    id: `sancha_${now}`,
                    date, name, category,
                    aaya: qty, gaya: 0, bacha: qty,
                    person: person || '-',
                    karkhanaId: targetKid,
                    timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_items', list);

            const hist = toArray(window.getStore ? window.getStore('sancha_history') : []);
            hist.push({
                id: `shist_${now}`,
                date, name, category,
                person: person || '-',
                kariger: person || note || 'Factory Inward',
                type: `Khareed / Inward (${category === 'tani' ? 'Tani' : 'Chukka'})`,
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                isOpening: false,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('sancha_history', hist);

            if (typeof window.invalidateSanchaCalcCache === 'function') window.invalidateSanchaCalcCache();
            if (typeof window.renderSanchaTable === 'function') window.renderSanchaTable();
        }

        lastSavedStockEntry = {
            category: activeCategory.toUpperCase(),
            name: name,
            person: savedPerson,
            qty: qty,
            date: date,
            kGodown: targetKid,
            note: note || '-'
        };

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        document.getElementById('stk-qty').value = '';
        document.getElementById('stk-note').value = '';
        const pInp = document.getElementById('stk-sancha-person');
        if (pInp) pInp.value = '';
        if (nameInp) nameInp.value = '';
        stkPersonArrowUsed = false;

        const dl = document.getElementById('stk-items-dl');
        if (dl) {
            const { banaOpts, zariOpts, sanchaOpts } = getStockExpressDatalists();
            dl.innerHTML = activeCategory === 'bana' ? banaOpts : (activeCategory === 'zari' ? zariOpts : sanchaOpts);
        }

        const catTitle = activeCategory === 'bana'
            ? 'Bana'
            : (activeCategory === 'zari' ? 'Zari' : (sanchaCat === 'chukka' ? 'Sancha (Chukka)' : 'Sancha (Tani)'));
        const statusMsg = document.getElementById('stk-status-msg');
        if (statusMsg) {
            statusMsg.innerHTML = `✅ <strong>${esc(name)}</strong>${savedPerson ? ` (${esc(savedPerson)})` : ''} (+${qty.toFixed(2)} Kg ${catTitle}) stock me jama ho gaya!`;
        }

        updateStockExpressLiveStats();

        if (nameInp) {
            nameInp.focus();
        }
    };

    /* ========================================================================
       8. A6 THERMAL PRINT SLIP
       ------------------------------------------------------------------------
    ======================================================================== */
    window.printLastSavedStockSlip = () => {
        if (!lastSavedStockEntry) return alert('Print karne ke liye koi recent entry nahi mili!');

        const t = lastSavedStockEntry;
        const kName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.kGodown) : 'Main Godown';

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup blocked hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Stock Voucher - ${esc(t.name)}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
                    .highlight { background: #eee; border: 1px solid #000; padding: 6px; font-size: 14px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>⚡ कच्चा माल आवक पर्ची (STOCK VOUCHER)</p>
                    </div>
                    <div class="row"><span><strong>तारीख:</strong></span><span>${esc(t.date)}</span></div>
                    <div class="row"><span><strong>गोदाम:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>कैटेगरी:</strong></span><span>${esc(t.category)}</span></div>
                    <div class="row"><span><strong>आइटम का नाम:</strong></span><span><strong>${esc(t.name)}</strong></span></div>
                    ${t.person ? `<div class="row"><span><strong>सांचा मेकर:</strong></span><span>${esc(t.person)}</span></div>` : ''}
                    <div class="row"><span><strong>नोट / सप्लायर:</strong></span><span>${esc(t.note)}</span></div>
                    <div class="highlight">
                        जमा वज़न: +${t.qty.toFixed(2)} Kg
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>___________</div>
                        <div>हस्ताक्षर लाने वाला<br><br>___________</div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 600);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

})();
