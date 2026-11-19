/* ============================================================================
   SIMPLICITY ERP - SANCHA (TANI & CHUKKA) STOCK & PASSBOOK (TALLY WHITE & GOLD)
   File: sancha/sancha-ui.js • Developed by Farhan Jawed
   (100% Supabase-Safe | 2-Option Hub (Tani/Chukka) -> Items List -> Inline Passbook)
============================================================================ */

(() => {
    'use strict';

    window.currentSanchaCategory = 'tani'; // 'tani' | 'chukka'
    window.currentSanchaKarkhanaFilter = 'all';
    window.currentPassbookSanchaItem = '';

    // View State: 'hub' (Tani vs Chukka) | 'list' (Items) | 'passbook' (Inline Ledger)
    let sanchaViewMode = 'hub';
    let sanchaHubActiveIdx = 0; // 0 = tani, 1 = chukka
    let sanchaOpenedAt = 0;

    // Passbook Pagination & Cursor State
    let sanchaPassbookCurrentPage = 1;
    const SANCHA_PAGE_SIZE = 20;
    let filteredSanchaPassbookCache = [];
    let sanchaPassbookActiveIdx = 0;

    // Main Sancha Stock Table Pagination & Cursor State
    let sanchaStockCurrentPage = 1;
    const SANCHA_STOCK_PAGE_SIZE = 15;
    let currentSanchaFilteredRowsCache = [];
    let sanchaListActiveIdx = 0;

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

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
    };

    const isAnyExpressOverlayOpen = () => {
        return Boolean(
            document.getElementById('kariger-express-modal') ||
            document.getElementById('master-stock-express-modal') ||
            document.getElementById('master-jobwork-express-modal')
        );
    };

    const triggerSanchaCacheInvalidation = () => {
        if (typeof window.invalidateSanchaCalcCache === 'function') {
            window.invalidateSanchaCalcCache();
        } else if (window.SanchaCalcEngine && typeof window.SanchaCalcEngine.invalidateSanchaCalcCache === 'function') {
            window.SanchaCalcEngine.invalidateSanchaCalcCache();
        }
    };

    /* ========================================================================
       1. SCOPED TALLYPRIME WHITE & GOLD STYLES FOR #sancha-section
       ======================================================================== */
    const ensureSanchaTallyStyles = () => {
        if (document.getElementById('sancha-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'sancha-tally-styles';
        style.textContent = `
            #sancha-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #sancha-section .module-header {
                background: #fdf6e2 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                padding: 12px 20px !important;
                margin-bottom: 0 !important;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            #sancha-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 17px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #sancha-section .back-btn {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                padding: 6px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #sancha-section .back-btn:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
            }
            #sancha-section .add-btn {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 6px !important;
                padding: 6px 14px !important;
                font-size: 12.5px !important;
                font-weight: 800 !important;
                cursor: pointer;
            }
            #sancha-section .add-btn:hover { background: #e5aa12 !important; }
            #sancha-section .sheet-tabs-bar {
                padding: 10px 20px 0 20px;
                margin-bottom: 6px !important;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #sancha-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #sancha-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #sancha-section #sancha-opening-box {
                margin: 6px 20px 10px 20px !important;
                padding: 9px 14px !important;
                background: #fdfcf7 !important;
                border: 1px solid #e5d5a7 !important;
                border-radius: 6px !important;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            #sancha-section #sancha-opening-val {
                color: #b47d00 !important;
                font-size: 14px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #sancha-section .filter-panel {
                padding: 0 20px 10px 20px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #sancha-section .search-box {
                flex: 1;
                min-width: 200px;
                padding: 7px 12px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                background: #ffffff !important;
                color: #111827 !important;
                outline: none;
            }
            #sancha-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #sancha-section #add-sancha-item-form {
                margin: 8px 20px 14px 20px !important;
                padding: 14px 16px !important;
                background: #fdfcf7 !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 6px !important;
            }
            #sancha-section .table-responsive {
                padding: 0 20px;
                box-sizing: border-box;
            }
            #sancha-section table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #sancha-section table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #sancha-section table th {
                padding: 9px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left;
            }
            #sancha-section table td {
                padding: 9px 12px !important;
                font-size: 13px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
            }
            #sancha-section .sancha-hub-row,
            #sancha-section .sancha-stock-row,
            #sancha-section .sancha-pass-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #sancha-section .sancha-hub-row:hover,
            #sancha-section .sancha-stock-row:hover,
            #sancha-section .sancha-pass-row:hover {
                background: #fef9ea !important;
            }
            #sancha-section .sancha-hub-row.active,
            #sancha-section .sancha-stock-row.active,
            #sancha-section .sancha-pass-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #sancha-section .sancha-hub-row.active td,
            #sancha-section .sancha-stock-row.active td,
            #sancha-section .sancha-pass-row.active td {
                font-weight: 700 !important;
                color: #1f2937 !important;
            }
            #sancha-section .sancha-key-badge {
                display: inline-block;
                min-width: 24px;
                text-align: center;
                padding: 2px 7px;
                border-radius: 4px;
                font-size: 11.5px;
                font-weight: 800;
                background: #fdf6e2;
                border: 1px solid #d9b86c;
                color: #92400e;
            }
            #sancha-section .sancha-hub-row.active .sancha-key-badge {
                background: #ffffff;
                color: #1f2937;
                border-color: #b47d00;
            }
            #sancha-section .sancha-tally-btn {
                background: #ffffff;
                color: #1f2937;
                border: 1px solid #d1d5db;
                border-radius: 5px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            #sancha-section .sancha-tally-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
            }
            #sancha-section .sancha-tally-btn-gold {
                background: #f2b71d;
                color: #1f2937;
                border: 1px solid #d9a425;
                border-radius: 5px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
                white-space: nowrap;
            }
            #sancha-section .sancha-tally-btn-gold:hover { background: #e5aa12; }
            #sancha-section .sancha-status-strip {
                background: #fdf6e2;
                border-top: 1px solid #e5d5a7;
                padding: 9px 20px;
                margin-top: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                font-size: 11.5px;
                color: #6b7280;
                font-weight: 600;
            }
            .sancha-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 15px; box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .sancha-modal-card {
                background: #ffffff;
                width: 100%; max-width: 460px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                color: #1f2937;
            }
            .sancha-modal-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 11px 16px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .sancha-modal-head h3 {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
            }
            .sancha-modal-inp {
                width: 100%; box-sizing: border-box;
                padding: 7px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
            }
            .sancha-modal-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       2. 3-LEVEL VIEW CONTROLLER: 'hub' (Tani/Chukka) -> 'list' -> 'passbook'
       ======================================================================== */
    const computeSanchaCategorySummary = (cat) => {
        const rawStock = (window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [])
            .filter((s) => String(s?.category || 'tani').toLowerCase() === cat);
        const uniqueNames = [...new Set(rawStock.map((s) => (s?.name ? s.name.trim() : '')).filter(Boolean))];

        let totalAaya = 0;
        let totalGaya = 0;
        let totalBacha = 0;
        let itemCount = 0;

        uniqueNames.forEach((name) => {
            if (typeof window.getSanchaItemStats === 'function') {
                const stats = window.getSanchaItemStats(null, name, cat, window.currentSanchaKarkhanaFilter);
                if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                    totalAaya += safeNum(stats.aaya);
                    totalGaya += safeNum(stats.gaya);
                    totalBacha += safeNum(stats.bacha);
                    itemCount++;
                }
            }
        });

        return { totalAaya, totalGaya, totalBacha, itemCount };
    };

    const ensureSanchaHubView = () => {
        const sec = document.getElementById('sancha-section');
        if (!sec) return null;

        let hub = document.getElementById('sancha-category-hub-view');
        if (hub) return hub;

        hub = document.createElement('div');
        hub.id = 'sancha-category-hub-view';
        hub.style.display = 'none';
        hub.innerHTML = `
            <div style="padding:16px 20px;">
                <table>
                    <thead>
                        <tr>
                            <th style="width:55px;">#</th>
                            <th>Sancha Category (Particulars)</th>
                            <th style="width:90px; text-align:center;">Key</th>
                            <th style="text-align:right;">Items</th>
                            <th style="text-align:right;">Available Stock (Bacha)</th>
                            <th style="width:110px; text-align:right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="sancha-hub-row active" data-hidx="0" onclick="window.__sanchaOpenCategoryFromHub('tani')">
                            <td>1</td>
                            <td>
                                <strong>Tani Stock</strong>
                                <small style="display:block; font-size:11.5px; color:#6b7280; margin-top:2px;">Taana Warp Stock &amp; Kariger Issue Register</small>
                            </td>
                            <td style="text-align:center;"><span class="sancha-key-badge">T</span></td>
                            <td style="text-align:right;" id="sancha-hub-tani-count">0 Items</td>
                            <td style="text-align:right; font-weight:800; color:#b47d00;" id="sancha-hub-tani-bacha">0.00 Kg</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                        <tr class="sancha-hub-row" data-hidx="1" onclick="window.__sanchaOpenCategoryFromHub('chukka')">
                            <td>2</td>
                            <td>
                                <strong>Chukka Stock</strong>
                                <small style="display:block; font-size:11.5px; color:#6b7280; margin-top:2px;">Chukka Warp Stock &amp; Kariger Issue Register</small>
                            </td>
                            <td style="text-align:center;"><span class="sancha-key-badge">C</span></td>
                            <td style="text-align:right;" id="sancha-hub-chukka-count">0 Items</td>
                            <td style="text-align:right; font-weight:800; color:#b47d00;" id="sancha-hub-chukka-bacha">0.00 Kg</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="sancha-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Tani / Chukka Chunein · [Enter] ya [T / C] se Andar Jayein · [F7] + Naya Sancha · [Esc] Back</span>
                <span>2 Categories</span>
            </div>
        `;

        const headerEl = sec.querySelector('.module-header');
        if (headerEl) {
            headerEl.insertAdjacentElement('afterend', hub);
        } else {
            sec.prepend(hub);
        }
        return hub;
    };

    const renderSanchaHubTotals = () => {
        ensureSanchaHubView();
        const tSum = computeSanchaCategorySummary('tani');
        const cSum = computeSanchaCategorySummary('chukka');

        const tc = document.getElementById('sancha-hub-tani-count');
        const tb = document.getElementById('sancha-hub-tani-bacha');
        const cc = document.getElementById('sancha-hub-chukka-count');
        const cb = document.getElementById('sancha-hub-chukka-bacha');

        if (tc) tc.textContent = `${tSum.itemCount} Items`;
        if (tb) tb.textContent = `${tSum.totalBacha.toFixed(2)} Kg`;
        if (cc) cc.textContent = `${cSum.itemCount} Items`;
        if (cb) cb.textContent = `${cSum.totalBacha.toFixed(2)} Kg`;

        highlightSanchaHubRow(sanchaHubActiveIdx);
    };

    const highlightSanchaHubRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#sancha-category-hub-view .sancha-hub-row'));
        if (!rows.length) return;
        sanchaHubActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sanchaHubActiveIdx));
    };

    window.__sanchaOpenCategoryFromHub = (cat) => {
        sanchaHubActiveIdx = (cat === 'chukka') ? 1 : 0;
        switchSanchaCategory(cat);
    };

    const setSanchaViewMode = (mode) => {
        sanchaViewMode = mode; // 'hub' | 'list' | 'passbook'
        const sec = document.getElementById('sancha-section');
        if (!sec) return;

        ensureSanchaHubView();

        const hubView = document.getElementById('sancha-category-hub-view');
        const catTabsBar = document.getElementById('tab-sancha-tani')?.closest('.sheet-tabs-bar');
        const kTabsBar = document.getElementById('sancha-karkhana-tabs-bar');
        const openBox = document.getElementById('sancha-opening-box');
        const filterPanel = sec.querySelector(':scope > .filter-panel');
        const addForm = document.getElementById('add-sancha-item-form');
        const mainTbl = document.getElementById('sancha-table-body')?.closest('.table-responsive');
        const mainPager = document.getElementById('sancha-stock-pagination-controls');
        const mainStrip = document.getElementById('sancha-main-status-strip');
        const passView = document.getElementById('sancha-inline-passbook-view');
        const headerTitle = sec.querySelector('.module-header h2');
        const headerBackBtn = sec.querySelector('.module-header .back-btn');

        const isHub = (mode === 'hub');
        const isList = (mode === 'list');
        const isPass = (mode === 'passbook');

        if (hubView) hubView.style.display = isHub ? 'block' : 'none';
        if (catTabsBar) catTabsBar.style.display = isList ? 'flex' : 'none';
        if (kTabsBar) kTabsBar.style.display = isList ? 'flex' : 'none';
        if (openBox) openBox.style.display = isList ? 'flex' : 'none';
        if (filterPanel) filterPanel.style.display = isList ? 'flex' : 'none';
        if (addForm && !isList) addForm.style.display = 'none';
        if (mainTbl) mainTbl.style.display = isList ? 'block' : 'none';
        if (mainPager) mainPager.style.display = isList ? 'flex' : 'none';
        if (mainStrip) mainStrip.style.display = isList ? 'flex' : 'none';
        if (passView) passView.style.display = isPass ? 'block' : 'none';

        const catTitle = (window.currentSanchaCategory === 'chukka') ? 'Chukka' : 'Tani';
        if (headerTitle) {
            if (isHub) headerTitle.textContent = 'Sancha Stock (Tani & Chukka)';
            else if (isList) headerTitle.textContent = `Sancha Stock: ${catTitle}`;
            else headerTitle.textContent = `Sancha Passbook: ${window.currentPassbookSanchaItem || ''} (${catTitle})`;
        }
        if (headerBackBtn) {
            if (isHub) headerBackBtn.textContent = window.__slReturnToStockSummary ? '← [Esc] Stock Summary' : '← Dashboard';
            else if (isList) headerBackBtn.textContent = '← [Esc] Tani / Chukka';
            else headerBackBtn.textContent = `← [Esc] ${catTitle} List`;
        }
    };

    const handleSanchaBackStep = () => {
        if (sanchaViewMode === 'passbook') {
            setSanchaViewMode('list');
            renderSanchaTable();
            return;
        }
        if (sanchaViewMode === 'list') {
            sanchaOpenedAt = performance.now();
            setSanchaViewMode('hub');
            renderSanchaHubTotals();
            return;
        }
        if (window.__slReturnToStockSummary && typeof window.openStockSummaryModule === 'function') {
            window.openStockSummaryModule();
            return;
        }
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    };

    /* ========================================================================
       3. NAVIGATION & CATEGORY / BRANCH CONTROLLERS
       ======================================================================== */
    const openSanchaModule = () => {
        sanchaOpenedAt = performance.now();
        ensureSanchaTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('sancha-section', 'block');

        setSanchaViewMode('hub');
        renderSanchaHubTotals();
        bindSanchaSearchInput();
        bindSanchaKeyboardEngine();
    };

    const switchSanchaCategory = (cat) => {
        sanchaOpenedAt = performance.now();
        ensureSanchaTallyStyles();
        window.currentSanchaCategory = String(cat || 'tani').toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        sanchaHubActiveIdx = (window.currentSanchaCategory === 'chukka') ? 1 : 0;
        sanchaStockCurrentPage = 1;
        sanchaListActiveIdx = 0;

        const tabT = document.getElementById('tab-sancha-tani');
        const tabC = document.getElementById('tab-sancha-chukka');
        if (tabT) tabT.className = (window.currentSanchaCategory === 'tani') ? 'sheet-tab active' : 'sheet-tab';
        if (tabC) tabC.className = (window.currentSanchaCategory === 'chukka') ? 'sheet-tab active' : 'sheet-tab';

        const rTani = document.querySelector('input[name="sancha-cat"][value="tani"]');
        const rChuk = document.querySelector('input[name="sancha-cat"][value="chukka"]');
        if (rTani && window.currentSanchaCategory === 'tani') rTani.checked = true;
        if (rChuk && window.currentSanchaCategory === 'chukka') rChuk.checked = true;

        setSanchaViewMode('list');
        renderSanchaKarkhanaTabs();
        populateSanchaExistingDropdown();
        renderSanchaTable();
        bindSanchaKeyboardEngine();
    };

    const renderSanchaKarkhanaTabs = () => {
        const bar = document.getElementById('sancha-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }

        const isAllActive = window.currentSanchaKarkhanaFilter === 'all';
        let html = `<button type="button" class="sheet-tab ${isAllActive ? 'active' : ''}" onclick="switchSanchaKarkhanaTab('all')">Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isActive = String(window.currentSanchaKarkhanaFilter) === String(k.id) ? 'active' : '';
            html += `<button type="button" class="sheet-tab ${isActive}" onclick="switchSanchaKarkhanaTab('${esc(k.id)}')">${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchSanchaKarkhanaTab = (kId) => {
        window.currentSanchaKarkhanaFilter = kId || 'all';
        sanchaStockCurrentPage = 1;
        sanchaListActiveIdx = 0;
        renderSanchaKarkhanaTabs();
        populateSanchaExistingDropdown();
        renderSanchaTable();
    };

    const cycleSanchaKarkhanaTab = () => {
        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];

        const ids = ['all', ...karkhanas.map(k => String(k.id))];
        const curIdx = ids.indexOf(String(window.currentSanchaKarkhanaFilter));
        const nextId = ids[(curIdx + 1) % ids.length];
        switchSanchaKarkhanaTab(nextId);
    };

    const bindSanchaSearchInput = () => {
        const searchInp = document.getElementById('search-sancha-input');
        if (searchInp && !searchInp.dataset.bound) {
            searchInp.dataset.bound = 'true';
            searchInp.addEventListener('input', () => {
                sanchaStockCurrentPage = 1;
                sanchaListActiveIdx = 0;
                renderSanchaTable();
            });
            searchInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    searchInp.blur();
                    if (e.key === 'Enter' && currentSanchaFilteredRowsCache.length > 0) {
                        const pageRows = getSanchaCurrentPageRows();
                        const chosen = pageRows[sanchaListActiveIdx] || pageRows[0];
                        if (chosen) openSanchaPassbook(encodeURIComponent(chosen.name));
                    }
                }
            });
        }
    };

    const filterSancha = () => {
        sanchaStockCurrentPage = 1;
        sanchaListActiveIdx = 0;
        renderSanchaTable();
    };

    const getSanchaCurrentPageRows = () => {
        const startIndex = (sanchaStockCurrentPage - 1) * SANCHA_STOCK_PAGE_SIZE;
        return currentSanchaFilteredRowsCache.slice(startIndex, startIndex + SANCHA_STOCK_PAGE_SIZE);
    };

    const highlightSanchaListRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#sancha-table-body .sancha-stock-row'));
        if (!rows.length) return;
        sanchaListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sanchaListActiveIdx));
        rows[sanchaListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    /* ========================================================================
       4. INWARD INVENTORY PURCHASE ENGINE (100% SUPABASE SAFE)
       ======================================================================== */
    const toggleAddSanchaForm = () => {
        if (sanchaViewMode !== 'list') {
            switchSanchaCategory(window.currentSanchaCategory || 'tani');
        }
        const f = document.getElementById('add-sancha-item-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('sancha-date');
            if (dInp) dInp.value = getToday();

            const rTani = document.querySelector('input[name="sancha-cat"][value="tani"]');
            const rChuk = document.querySelector('input[name="sancha-cat"][value="chukka"]');
            if (window.currentSanchaCategory === 'chukka' && rChuk) rChuk.checked = true;
            else if (rTani) rTani.checked = true;

            toggleSanchaFormOptions();

            setTimeout(() => {
                const isNew = document.getElementById('sancha-type-new')?.checked;
                document.getElementById(isNew ? 'sancha-new-name' : 'sancha-select-existing')?.focus();
            }, 40);
        }
    };

    const toggleSanchaFormOptions = () => {
        const isNew = document.getElementById('sancha-type-new')
            ? document.getElementById('sancha-type-new').checked
            : true;

        setDisplay('sancha-existing-group', isNew ? 'none' : 'block');
        setDisplay('sancha-new-group', isNew ? 'block' : 'none');

        const selectedRadio = document.querySelector('input[name="sancha-cat"]:checked');
        if (selectedRadio) {
            window.currentSanchaCategory = String(selectedRadio.value).toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        }

        populateSanchaExistingDropdown();
    };

    const populateSanchaExistingDropdown = () => {
        const sel = document.getElementById('sancha-select-existing');
        if (!sel) return;

        sel.innerHTML = '';
        const currentCat = window.currentSanchaCategory || 'tani';
        const list = (window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [])
            .filter((s) => {
                const cat = s.category || 'tani';
                return cat.toLowerCase() === currentCat.toLowerCase();
            });

        const unique = new Set();
        list.forEach((s) => {
            const name = s?.name ? s.name.trim() : '';
            if (name && !unique.has(name.toLowerCase())) {
                unique.add(name.toLowerCase());
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            }
        });
    };

    const saveNewSanchaStock = () => {
        const isNew = document.getElementById('sancha-type-new')
            ? document.getElementById('sancha-type-new').checked
            : true;

        const nameInp = isNew ? document.getElementById('sancha-new-name') : document.getElementById('sancha-select-existing');
        const name = String(nameInp?.value || '').trim();

        const date = document.getElementById('sancha-date')?.value || getToday();
        const qtyInp = document.getElementById('sancha-qty');
        const qty = safeNum(qtyInp?.value);
        const person = String(document.getElementById('sancha-person')?.value || '').trim();

        let category = window.currentSanchaCategory || 'tani';
        const checkedCatRadio = document.querySelector('input[name="sancha-cat"]:checked');
        if (checkedCatRadio && checkedCatRadio.value) {
            category = String(checkedCatRadio.value).toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        }

        if (!name) return alert('Sancha Item ka naam zaroori hai!');
        if (qty <= 0) return alert('Wazan (Qty Kg me) daalein!');

        const targetKid = (window.currentSanchaKarkhanaFilter !== 'all') ? window.currentSanchaKarkhanaFilter : 'k_main';
        const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];

        const item = list.find((x) => {
            const cat = x.category || 'tani';
            const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
            return x?.name && x.name.toLowerCase() === name.toLowerCase() && cat.toLowerCase() === category.toLowerCase() && matchK;
        });

        if (item) {
            item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
            item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
            if (person) item.person = person;
            item.date = date;
        } else {
            list.push({
                id: `sancha_${Date.now()}`,
                date,
                name,
                category,
                aaya: qty,
                gaya: 0,
                bacha: qty,
                person: person || '-',
                karkhanaId: targetKid,
                timestamp: Date.now()
            });
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_items', list);
        }

        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        hist.push({
            id: `shist_${Date.now()}`,
            date,
            name,
            category,
            kariger: person || 'Factory Inward',
            type: `Khareed / Inward (${category === 'tani' ? 'Tani' : 'Chukka'})`,
            aaya: qty,
            gaya: 0,
            karkhanaId: targetKid,
            isOpening: false,
            timestamp: Date.now()
        });

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        const newNameEl = document.getElementById('sancha-new-name');
        if (newNameEl) newNameEl.value = '';
        if (qtyInp) qtyInp.value = '';
        const personEl = document.getElementById('sancha-person');
        if (personEl) personEl.value = '';

        triggerSanchaCacheInvalidation();
        toggleAddSanchaForm();
        switchSanchaCategory(category);
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert(`✅ Sancha (${category === 'tani' ? 'Tani' : 'Chukka'}) Stock me jama ho gaya!`);
    };

    /* ========================================================================
       5. MAIN SANCHA ITEMS TABLE RENDERER (CLEAN WHITE & GOLD + KEYBOARD)
       ======================================================================== */
    const renderSanchaTable = () => {
        ensureSanchaTallyStyles();
        bindSanchaSearchInput();

        const tbody = document.getElementById('sancha-table-body');
        if (!tbody) return;

        const currentCat = window.currentSanchaCategory || 'tani';

        const rawStock = (window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [])
            .filter((s) => {
                const cat = s.category || 'tani';
                return cat.toLowerCase() === currentCat.toLowerCase();
            });

        const uniqueNames = [...new Set(rawStock.map((s) => (s?.name ? s.name.trim() : '')).filter(Boolean))];

        const rows = [];
        uniqueNames.forEach((name) => {
            if (typeof window.getSanchaItemStats === 'function') {
                const stats = window.getSanchaItemStats(null, name, currentCat, window.currentSanchaKarkhanaFilter);
                if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                    const foundOriginal = rawStock.find((x) => x?.name && x.name.toLowerCase() === name.toLowerCase());
                    stats.person = foundOriginal ? (foundOriginal.person || '-') : '-';
                    rows.push(stats);
                }
            }
        });

        const searchInp = document.getElementById('search-sancha-input');
        const txt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        const filteredRows = txt
            ? rows.filter((s) => `${s.name || ''} ${s.person || ''} ${s.date || ''} ${s.category || ''} ${s.bacha || ''}`.toLowerCase().includes(txt))
            : rows;

        currentSanchaFilteredRowsCache = filteredRows;

        if (searchInp && searchInp.parentElement) {
            if (!document.getElementById('sancha-stock-transfer-btn')) {
                const trBtn = document.createElement('button');
                trBtn.id = 'sancha-stock-transfer-btn';
                trBtn.type = 'button';
                trBtn.className = 'sancha-tally-btn';
                trBtn.innerHTML = 'Bhejo / Transfer [T]';
                trBtn.onclick = () => triggerSelectedSanchaTransfer();
                searchInp.parentElement.appendChild(trBtn);
            }
            if (!document.getElementById('sancha-stock-print-btn')) {
                const printBtn = document.createElement('button');
                printBtn.id = 'sancha-stock-print-btn';
                printBtn.type = 'button';
                printBtn.className = 'sancha-tally-btn';
                printBtn.innerHTML = 'A6 Print [Alt+P]';
                printBtn.onclick = () => printSanchaStockReport();
                searchInp.parentElement.appendChild(printBtn);
            }
        }

        let totalAaya = 0;
        let totalGaya = 0;
        let totalBacha = 0;
        rows.forEach((r) => {
            totalAaya += safeNum(r.aaya);
            totalGaya += safeNum(r.gaya);
            totalBacha += safeNum(r.bacha);
        });

        const totalEntries = filteredRows.length;
        const sec = document.getElementById('sancha-section');
        let pager = document.getElementById('sancha-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'sancha-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;';
                tbl.insertAdjacentElement('afterend', pager);
            }
        }

        if (sec && !document.getElementById('sancha-main-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'sancha-main-status-strip';
            strip.className = 'sancha-status-strip';
            strip.innerHTML = `
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Item Chunein · [Enter / Click] Passbook · [T / F4] Transfer · [F7] + Naya Sancha · [F2] Godam · [/] Search · [Esc] Back</span>
                <span id="sancha-main-count-lbl">0 Items</span>
            `;
            sec.appendChild(strip);
        }

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:22px; color:#6b7280;">Koi ${currentCat === 'tani' ? 'Tani' : 'Chukka'} Stock nahi mila.</td></tr>`;
            if (pager) pager.innerHTML = '';
        } else {
            const totalPages = Math.ceil(totalEntries / SANCHA_STOCK_PAGE_SIZE) || 1;
            if (sanchaStockCurrentPage > totalPages) sanchaStockCurrentPage = totalPages;
            if (sanchaStockCurrentPage < 1) sanchaStockCurrentPage = 1;

            const startIndex = (sanchaStockCurrentPage - 1) * SANCHA_STOCK_PAGE_SIZE;
            const pageRows = filteredRows.slice(startIndex, startIndex + SANCHA_STOCK_PAGE_SIZE);
            if (sanchaListActiveIdx >= pageRows.length) sanchaListActiveIdx = 0;
            if (sanchaListActiveIdx < 0) sanchaListActiveIdx = 0;

            let html = '';
            pageRows.forEach((s, idx) => {
                const bacha = safeNum(s.bacha);
                const safeName = encodeURIComponent(s.name);
                const activeCls = (idx === sanchaListActiveIdx) ? ' active' : '';

                html += `<tr class="sancha-stock-row${activeCls}" data-sidx="${idx}" onclick="window.__sanchaSelectAndOpen(${idx}, '${safeName}')">
                    <td>${esc(s.date || '-')}</td>
                    <td><span style="font-size:11.5px; font-weight:700; color:#92400e;">${s.category === 'chukka' ? 'Chukka' : 'Tani'}</span></td>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td style="font-weight:700;">+${safeNum(s.aaya).toFixed(2)} Kg</td>
                    <td style="font-weight:700; color:#6b7280;">-${safeNum(s.gaya).toFixed(2)} Kg</td>
                    <td style="font-weight:800; color:#b47d00;">${bacha.toFixed(2)} Kg</td>
                    <td>${esc(s.person || '-')}</td>
                    <td style="text-align:right; font-weight:700; font-size:12px;">Passbook →</td>
                </tr>`;
            });

            tbody.innerHTML = html;

            if (pager) {
                pager.innerHTML = `
                    <div style="font-size:12px; color:#6b7280; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SANCHA_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="sancha-tally-btn" ${sanchaStockCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSanchaStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${sanchaStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="sancha-tally-btn" ${sanchaStockCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSanchaStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const opBox = document.getElementById('sancha-opening-box');
        const opVal = document.getElementById('sancha-opening-val');
        if (opVal) {
            opVal.textContent = `Kul ${currentCat === 'tani' ? 'Tani' : 'Chukka'} Bacha: ${totalBacha.toFixed(2)} Kg`;
        }
        if (opBox) {
            let extra = document.getElementById('sancha-summary-meta');
            if (!extra) {
                extra = document.createElement('div');
                extra.id = 'sancha-summary-meta';
                extra.style.cssText = 'font-size:12px; color:#6b7280; font-weight:700;';
                opBox.appendChild(extra);
            }
            extra.textContent = `Total Aaya: +${totalAaya.toFixed(2)} Kg · Total Gaya: -${totalGaya.toFixed(2)} Kg`;
        }

        const cntLbl = document.getElementById('sancha-main-count-lbl');
        if (cntLbl) cntLbl.textContent = `${totalEntries} Items`;
    };

    window.__sanchaSelectAndOpen = (idx, safeName) => {
        highlightSanchaListRow(idx);
        openSanchaPassbook(safeName);
    };

    const triggerSelectedSanchaTransfer = () => {
        const cat = window.currentSanchaCategory || 'tani';
        if (sanchaViewMode === 'passbook' && window.currentPassbookSanchaItem) {
            const stats = (typeof window.getSanchaItemStats === 'function')
                ? window.getSanchaItemStats(null, window.currentPassbookSanchaItem, cat, window.currentSanchaKarkhanaFilter)
                : { bacha: 0 };
            if (safeNum(stats.bacha) <= 0) return alert('Is item me transfer ke liye koi stock nahi bacha hai.');
            openSanchaTransferModal(encodeURIComponent(window.currentPassbookSanchaItem), encodeURIComponent(cat), safeNum(stats.bacha));
            return;
        }

        const pageRows = getSanchaCurrentPageRows();
        const chosen = pageRows[sanchaListActiveIdx];
        if (!chosen) return alert('Pehle koi Sancha item chunein!');
        if (safeNum(chosen.bacha) <= 0) return alert(`[${chosen.name}] me transfer ke liye koi stock nahi bacha hai.`);
        openSanchaTransferModal(encodeURIComponent(chosen.name), encodeURIComponent(chosen.category || cat), safeNum(chosen.bacha));
    };

    const changeSanchaStockPage = (delta) => {
        sanchaStockCurrentPage += delta;
        sanchaListActiveIdx = 0;
        renderSanchaTable();
    };

    /* ========================================================================
       6. INTER-GODOWN TRANSFER MODAL (TALLY WHITE & GOLD + ENTER CHAINING)
       ======================================================================== */
    const openSanchaTransferModal = (safeName, safeCat, availableBacha) => {
        const itemName = decodeURIComponent(safeName);
        const category = decodeURIComponent(safeCat);

        const existingModal = document.getElementById('sancha-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }

        const currentKid = (window.currentSanchaKarkhanaFilter !== 'all') ? window.currentSanchaKarkhanaFilter : 'k_main';
        const currentGodamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(currentKid)
            : currentKid;

        let godownOptions = '';
        karkhanas.forEach((k) => {
            if (String(k.id) !== String(currentKid)) {
                godownOptions += `<option value="${esc(k.id)}">${esc(k.name)}</option>`;
            }
        });

        const today = getToday();
        const catLabel = category === 'chukka' ? 'Chukka' : 'Tani';

        const modalHtml = `
            <div id="sancha-transfer-popup-modal" class="sancha-modal-overlay">
                <div class="sancha-modal-card">
                    <div class="sancha-modal-head">
                        <h3>Sancha (${catLabel}) Transfer</h3>
                        <button type="button" class="sancha-tally-btn" onclick="closeSanchaTransferModal()">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:6px; padding:10px 12px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Item:</strong> ${esc(itemName)} (${catLabel})</div>
                            <div><strong>Bhejne Wala Godam:</strong> ${esc(currentGodamName)}</div>
                            <div style="color:#b47d00; font-weight:800; font-size:13.5px; margin-top:4px;">Available Stock: ${availableBacha.toFixed(2)} Kg</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Destination Godam :</label>
                            <select id="sancha-dest-godam" class="sancha-modal-inp">${godownOptions}</select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="sancha-transfer-qty" max="${availableBacha}" min="0.01" value="${availableBacha}" class="sancha-modal-inp">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh :</label>
                                <input type="date" id="sancha-transfer-date" value="${today}" class="sancha-modal-inp">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Note / Parchi No. (Optional) :</label>
                            <input type="text" id="sancha-transfer-note" placeholder="e.g. Khairabad loom ke liye bheji" class="sancha-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="sancha-tally-btn" onclick="closeSanchaTransferModal()">Cancel [Esc]</button>
                            <button type="button" class="sancha-tally-btn-gold" onclick="submitSanchaTransferForm('${safeName}', '${safeCat}', '${currentKid}', ${availableBacha})">Transfer Confirm [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const order = ['sancha-dest-godam', 'sancha-transfer-qty', 'sancha-transfer-date', 'sancha-transfer-note'];
        order.forEach((fid, i) => {
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) {
                        const nxt = document.getElementById(order[i + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else {
                        submitSanchaTransferForm(safeName, safeCat, currentKid, availableBacha);
                    }
                }
            });
        });

        setTimeout(() => {
            const qtyEl = document.getElementById('sancha-transfer-qty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
        }, 50);
    };

    const closeSanchaTransferModal = () => {
        const modal = document.getElementById('sancha-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const submitSanchaTransferForm = (safeName, safeCat, fromKid, maxAvailable) => {
        const itemName = decodeURIComponent(safeName);
        const category = decodeURIComponent(safeCat);
        const toKid = document.getElementById('sancha-dest-godam')?.value;
        const qty = safeNum(document.getElementById('sancha-transfer-qty')?.value);
        const d = document.getElementById('sancha-transfer-date')?.value || getToday();
        const note = String(document.getElementById('sancha-transfer-note')?.value || '').trim();

        if (!toKid) return alert('Kripya Paane wala Godam chunein!');
        if (qty <= 0) return alert('Kripya sahi wazan (Kg) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable.toFixed(2)} Kg bachi hai!`);

        let success = false;
        if (typeof window.transferSanchaStock === 'function') {
            success = window.transferSanchaStock(d, itemName, category, fromKid, toKid, qty, note);
        }

        if (success) {
            triggerSanchaCacheInvalidation();
            closeSanchaTransferModal();
            if (sanchaViewMode === 'passbook') {
                applySanchaPassbookFilters();
            } else {
                renderSanchaTable();
            }
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            alert(`✅ ${qty.toFixed(2)} Kg Sancha (${category === 'chukka' ? 'Chukka' : 'Tani'}) safalta-poorvak transfer ho gayi!`);
        }
    };

    /* ========================================================================
       7. INLINE TALLY SANCHA PASSBOOK ENGINE (WITH RUNNING CLOSING BALANCE)
       ======================================================================== */
    const ensureInlineSanchaPassbookContainer = () => {
        const sec = document.getElementById('sancha-section');
        if (!sec) return null;

        let container = document.getElementById('sancha-inline-passbook-view');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'sancha-inline-passbook-view';
        container.style.display = 'none';
        container.innerHTML = `
            <div style="margin:12px 20px 10px 20px; padding:10px 14px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="sancha-tally-btn" onclick="window.__closeSanchaPassbookView()">&larr; [Esc] Items List</button>
                    <strong id="sancha-pass-summary-title" style="font-size:14px; color:#1f2937;">Item: -</strong>
                    <span id="sancha-pass-summary-totals" style="font-size:12px; color:#b47d00; font-weight:800;"></span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="sancha-tally-btn" onclick="window.__sanchaPassAction('edit')">Edit [Enter]</button>
                    <button type="button" class="sancha-tally-btn" onclick="window.__sanchaPassAction('delete')">Delete [Del]</button>
                    <button type="button" class="sancha-tally-btn" onclick="window.__sanchaPassAction('print_single')">Slip [P]</button>
                    <button type="button" class="sancha-tally-btn" onclick="window.__sanchaTransferFromPass()">Bhejo [T]</button>
                    <button type="button" class="sancha-tally-btn-gold" onclick="printSanchaPassbookFiltered()">A6 Print [Alt+P]</button>
                </div>
            </div>

            <div style="padding:0 20px 10px 20px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">From Date [F]:</label>
                    <input type="date" id="sancha-pass-from-date" onchange="applySanchaPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">To Date:</label>
                    <input type="date" id="sancha-pass-to-date" onchange="applySanchaPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">Search [/]:</label>
                    <input type="text" id="sancha-pass-search-input" class="search-box" placeholder="Search Date, Kariger, Qty..." oninput="applySanchaPassbookFilters()">
                </div>
                <button type="button" class="sancha-tally-btn" onclick="resetSanchaPassbookFilters()">Reset [R]</button>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Tarikh</th>
                            <th>Particulars (Kariger / Person)</th>
                            <th>Detail (Vch Type)</th>
                            <th style="text-align:right;">Aaya (In)</th>
                            <th style="text-align:right;">Gaya (Out)</th>
                            <th style="text-align:right;">Closing Bal</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="sancha-passbook-table-body"></tbody>
                </table>
            </div>

            <div id="sancha-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;"></div>

            <div class="sancha-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Entry Chunein · [Enter/E] Edit · [Del] Delete · [P] Single Slip · [Alt+P] Statement · [Esc] Items List</span>
                <span id="sancha-passbook-entry-status">-</span>
            </div>
        `;

        const mainStrip = document.getElementById('sancha-main-status-strip');
        if (mainStrip) {
            sec.insertBefore(container, mainStrip);
        } else {
            sec.appendChild(container);
        }

        const fInp = document.getElementById('sancha-pass-from-date');
        const tInp = document.getElementById('sancha-pass-to-date');
        const sInp = document.getElementById('sancha-pass-search-input');
        if (fInp) {
            fInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); tInp?.focus(); }
            });
        }
        if (tInp) {
            tInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); sInp?.focus(); }
            });
        }
        if (sInp) {
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    sInp.blur();
                }
            });
        }

        return container;
    };

    window.__closeSanchaPassbookView = () => {
        setSanchaViewMode('list');
        renderSanchaTable();
    };

    window.__sanchaTransferFromPass = triggerSelectedSanchaTransfer;

    window.__sanchaPassAction = (action) => {
        const startIndex = (sanchaPassbookCurrentPage - 1) * SANCHA_PAGE_SIZE;
        const pageRows = filteredSanchaPassbookCache.slice(startIndex, startIndex + SANCHA_PAGE_SIZE);
        const entry = pageRows[sanchaPassbookActiveIdx];
        if (!entry) return alert('Pehle koi entry chunein!');

        if (action === 'print_single') {
            printSingleSanchaPassbookEntry(entry.id);
            return;
        }

        const isOpening = (entry.isOpening === true) || String(entry.type || '').includes('Opening') || String(entry.kariger || '').includes('Opening');
        const isKariger = String(entry.type || '').includes('Kariger Issue') || String(entry.kariger || '').includes('Kariger');

        if (isOpening || isKariger) {
            return alert('Ye entry locked hai (Kariger Sheet / Opening Balance). Isko wahan se edit karein.');
        }

        if (action === 'edit') openSanchaEditModal(entry.id);
        else if (action === 'delete') deleteSanchaHistoryEntry(entry.id);
    };

    const openSanchaPassbook = (itemName) => {
        ensureSanchaTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('sancha-section', 'block');

        window.currentPassbookSanchaItem = decodeURIComponent(itemName);
        sanchaPassbookCurrentPage = 1;
        sanchaPassbookActiveIdx = 0;

        ensureInlineSanchaPassbookContainer();
        setSanchaViewMode('passbook');
        bindSanchaKeyboardEngine();
        applySanchaPassbookFilters();
    };

    const resetSanchaPassbookFilters = () => {
        const fDate = document.getElementById('sancha-pass-from-date');
        const tDate = document.getElementById('sancha-pass-to-date');
        const sInp = document.getElementById('sancha-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        sanchaPassbookCurrentPage = 1;
        sanchaPassbookActiveIdx = 0;
        applySanchaPassbookFilters();
    };

    const applySanchaPassbookFilters = () => {
        const targetItemLower = window.currentPassbookSanchaItem.toLowerCase();
        const targetCatLower = (window.currentSanchaCategory || 'tani').toLowerCase();
        const allHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];

        let itemHist = allHist.filter((x) => {
            if (!x?.name) return false;
            const nameMatch = x.name.toLowerCase() === targetItemLower;
            const catMatch = (x.category || 'tani').toLowerCase() === targetCatLower;
            if (!nameMatch || !catMatch) return false;

            if (window.currentSanchaKarkhanaFilter !== 'all') {
                const rowKid = x.karkhanaId || 'k_main';
                return String(rowKid) === String(window.currentSanchaKarkhanaFilter);
            }
            return true;
        });

        // Compute Running Closing Balance chronologically
        const chrono = itemHist.slice().sort((a, b) => {
            const ta = a.timestamp || 0;
            const tb = b.timestamp || 0;
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        let runningBal = 0;
        const withRunning = chrono.map((r) => {
            const aayaQty = safeNum(r.aaya);
            const gayaQty = safeNum(r.gaya !== undefined ? r.gaya : r.qty);
            runningBal = safeNum((runningBal + aayaQty - gayaQty).toFixed(2));
            return { ...r, _runningBal: runningBal };
        });

        const fDate = document.getElementById('sancha-pass-from-date')?.value || '';
        const tDate = document.getElementById('sancha-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('sancha-pass-search-input')?.value || '').toLowerCase().trim();

        let filtered = withRunning;
        if (fDate) filtered = filtered.filter((x) => (x.date || '') >= fDate);
        if (tDate) filtered = filtered.filter((x) => (x.date || '') <= tDate);

        if (sTxt) {
            filtered = filtered.filter((x) => {
                const rowString = `${x.date || ''} ${x.type || ''} ${x.kariger || ''} ${x.aaya || x.qty || ''} ${x.gaya || ''}`.toLowerCase();
                return rowString.includes(sTxt);
            });
        }

        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredSanchaPassbookCache = filtered;

        const stats = (typeof window.getSanchaItemStats === 'function')
            ? window.getSanchaItemStats(null, window.currentPassbookSanchaItem, targetCatLower, window.currentSanchaKarkhanaFilter)
            : { aaya: 0, gaya: 0, bacha: runningBal };
        const godamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(window.currentSanchaKarkhanaFilter)
            : 'Sabhi Karkhane';
        const catLabel = targetCatLower === 'chukka' ? 'Chukka' : 'Tani';

        const titleEl = document.getElementById('sancha-pass-summary-title');
        const totEl = document.getElementById('sancha-pass-summary-totals');
        if (titleEl) titleEl.textContent = `${window.currentPassbookSanchaItem} [${catLabel}] (${godamName})`;
        if (totEl) {
            totEl.textContent = `Aaya: +${safeNum(stats.aaya).toFixed(2)} Kg · Gaya: -${safeNum(stats.gaya).toFixed(2)} Kg · Closing: ${safeNum(stats.bacha).toFixed(2)} Kg`;
        }

        renderPaginatedSanchaPassbook();
    };

    const highlightSanchaPassbookRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#sancha-passbook-table-body .sancha-pass-row'));
        if (!rows.length) return;
        sanchaPassbookActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sanchaPassbookActiveIdx));
        rows[sanchaPassbookActiveIdx]?.scrollIntoView({ block: 'nearest' });

        const startIndex = (sanchaPassbookCurrentPage - 1) * SANCHA_PAGE_SIZE;
        const pageRows = filteredSanchaPassbookCache.slice(startIndex, startIndex + SANCHA_PAGE_SIZE);
        const entry = pageRows[sanchaPassbookActiveIdx];
        const statusEl = document.getElementById('sancha-passbook-entry-status');
        if (statusEl && entry) {
            const isOpening = (entry.isOpening === true) || String(entry.type || '').includes('Opening') || String(entry.kariger || '').includes('Opening');
            const isKariger = String(entry.type || '').includes('Kariger Issue') || String(entry.kariger || '').includes('Kariger');
            statusEl.textContent = (isOpening || isKariger) ? 'Locked Entry (Kariger Sheet / Opening)' : 'Editable Entry [Enter / Del]';
        }
    };

    const renderPaginatedSanchaPassbook = () => {
        const tbody = document.getElementById('sancha-passbook-table-body');
        const pager = document.getElementById('sancha-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredSanchaPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:18px; color:#6b7280;">Koi passbook entry nahi mili.</td></tr>';
            if (pager) pager.innerHTML = '';
            const statusEl = document.getElementById('sancha-passbook-entry-status');
            if (statusEl) statusEl.textContent = '0 Entries';
            return;
        }

        const totalPages = Math.ceil(totalEntries / SANCHA_PAGE_SIZE);
        if (sanchaPassbookCurrentPage > totalPages) sanchaPassbookCurrentPage = totalPages;
        if (sanchaPassbookCurrentPage < 1) sanchaPassbookCurrentPage = 1;

        const startIndex = (sanchaPassbookCurrentPage - 1) * SANCHA_PAGE_SIZE;
        const pageRows = filteredSanchaPassbookCache.slice(startIndex, startIndex + SANCHA_PAGE_SIZE);
        if (sanchaPassbookActiveIdx >= pageRows.length) sanchaPassbookActiveIdx = 0;
        if (sanchaPassbookActiveIdx < 0) sanchaPassbookActiveIdx = 0;

        let html = '';
        pageRows.forEach((r, idx) => {
            const aayaQty = safeNum(r.aaya);
            const gayaQty = safeNum(r.gaya !== undefined ? r.gaya : r.qty);
            const runBal = safeNum(r._runningBal);

            const isOpening = (r.isOpening === true) || String(r.type || '').includes('Opening') || String(r.kariger || '').includes('Opening');
            const isKariger = String(r.type || '').includes('Kariger Issue') || String(r.kariger || '').includes('Kariger');

            const karigerDisplay = isOpening
                ? 'Pichla Bacha Stock (Opening)'
                : ((r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? esc(r.kariger) : 'Factory Inward');

            const typeDisplay = isOpening
                ? 'Opening Stock'
                : esc(r.type || 'Inward / Issue');

            const statusBadge = isOpening
                ? '<span style="font-size:11px; color:#6b7280; font-weight:700;">Opening Lock</span>'
                : (isKariger
                    ? '<span style="font-size:11px; color:#6b7280; font-weight:700;">Kariger Sheet</span>'
                    : '<span style="font-size:11px; color:#b47d00; font-weight:700;">Editable</span>');

            const activeCls = (idx === sanchaPassbookActiveIdx) ? ' active' : '';

            html += `<tr class="sancha-pass-row${activeCls}" data-spidx="${idx}" onclick="window.__sanchaSelectPassRow(${idx})">
                <td>${esc(r.date || '-')}</td>
                <td><strong>${karigerDisplay}</strong></td>
                <td>${typeDisplay}</td>
                <td style="text-align:right; font-weight:700;">${aayaQty ? `+${aayaQty.toFixed(2)} Kg` : '-'}</td>
                <td style="text-align:right; font-weight:700; color:#6b7280;">${gayaQty ? `-${gayaQty.toFixed(2)} Kg` : '-'}</td>
                <td style="text-align:right; font-weight:800; color:#b47d00;">${runBal.toFixed(2)} Kg</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        highlightSanchaPassbookRow(sanchaPassbookActiveIdx);

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#6b7280; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SANCHA_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="sancha-tally-btn" ${sanchaPassbookCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSanchaPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${sanchaPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sancha-tally-btn" ${sanchaPassbookCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSanchaPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    window.__sanchaSelectPassRow = (idx) => {
        highlightSanchaPassbookRow(idx);
    };

    const changeSanchaPassbookPage = (delta) => {
        sanchaPassbookCurrentPage += delta;
        sanchaPassbookActiveIdx = 0;
        renderPaginatedSanchaPassbook();
    };

    /* ========================================================================
       8. KEYBOARD NAVIGATION ENGINE FOR #sancha-section (ZERO CONFLICTS)
       ======================================================================== */
    const handleSanchaKeydown = (e) => {
        const sec = document.getElementById('sancha-section');
        if (!sec || sec.style.display === 'none') return;
        if (isAnyExpressOverlayOpen()) return;

        // 1. Edit Modal open
        const editModal = document.getElementById('sancha-edit-popup-modal');
        if (editModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSanchaEditModal();
            }
            return;
        }

        // 2. Transfer Modal open
        const trModal = document.getElementById('sancha-transfer-popup-modal');
        if (trModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSanchaTransferModal();
            }
            return;
        }

        // 3. Add Sancha Form open
        const addForm = document.getElementById('add-sancha-item-form');
        if (addForm && addForm.style.display === 'block') {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleAddSanchaForm();
                return;
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const rNew = document.getElementById('sancha-type-new');
                const rExt = document.getElementById('sancha-type-existing');
                if (rNew && rExt) {
                    if (rNew.checked) rExt.checked = true;
                    else rNew.checked = true;
                    toggleSanchaFormOptions();
                    document.getElementById(rNew.checked ? 'sancha-new-name' : 'sancha-select-existing')?.focus();
                }
                return;
            }
            if (e.key === 'Enter') {
                const activeId = document.activeElement?.id || '';
                const isNew = document.getElementById('sancha-type-new')?.checked;
                const itemFieldId = isNew ? 'sancha-new-name' : 'sancha-select-existing';
                if (activeId === 'sancha-date') {
                    e.preventDefault();
                    document.getElementById(itemFieldId)?.focus();
                } else if (activeId === itemFieldId) {
                    e.preventDefault();
                    document.getElementById('sancha-qty')?.focus();
                } else if (activeId === 'sancha-qty') {
                    e.preventDefault();
                    document.getElementById('sancha-person')?.focus();
                } else if (activeId === 'sancha-person') {
                    e.preventDefault();
                    saveNewSanchaStock();
                }
            }
            return;
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            handleSanchaBackStep();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            if (sanchaViewMode === 'passbook') printSanchaPassbookFiltered();
            else if (sanchaViewMode === 'list') printSanchaStockReport();
            return;
        }

        if (e.key === 'F4' && sanchaViewMode !== 'hub') {
            e.preventDefault();
            triggerSelectedSanchaTransfer();
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            toggleAddSanchaForm();
            return;
        }

        if (e.key === 'F2' && sanchaViewMode === 'list') {
            e.preventDefault();
            cycleSanchaKarkhanaTab();
            return;
        }

        if (e.key === 'F3' && sanchaViewMode !== 'hub') {
            e.preventDefault();
            const sEl = document.getElementById(sanchaViewMode === 'passbook' ? 'sancha-pass-search-input' : 'search-sancha-input');
            if (sEl) { sEl.focus(); sEl.select(); }
            return;
        }

        if (isTyping) return;

        // Guard: Prevent Enter bleed-through right after opening Hub or switching to List
        if (e.key === 'Enter' && (performance.now() - sanchaOpenedAt) < 200) {
            return;
        }

        // 4. Level 1: Hub View (Tani vs Chukka)
        if (sanchaViewMode === 'hub') {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                highlightSanchaHubRow(sanchaHubActiveIdx + (e.key === 'ArrowDown' ? 1 : -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                switchSanchaCategory(sanchaHubActiveIdx === 1 ? 'chukka' : 'tani');
            } else if (e.key === 't' || e.key === 'T' || e.key === '1') {
                e.preventDefault();
                e.stopImmediatePropagation();
                switchSanchaCategory('tani');
            } else if (e.key === 'c' || e.key === 'C' || e.key === '2') {
                e.preventDefault();
                e.stopImmediatePropagation();
                switchSanchaCategory('chukka');
            } else if (e.key === '+') {
                e.preventDefault();
                toggleAddSanchaForm();
            }
            return;
        }

        // 5. Level 3: Inline Passbook View
        if (sanchaViewMode === 'passbook') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightSanchaPassbookRow(sanchaPassbookActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightSanchaPassbookRow(sanchaPassbookActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                changeSanchaPassbookPage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                changeSanchaPassbookPage(-1);
            } else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                window.__sanchaPassAction('edit');
            } else if (e.key === 'Delete' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                window.__sanchaPassAction('delete');
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                window.__sanchaPassAction('print_single');
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                triggerSelectedSanchaTransfer();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                document.getElementById('sancha-pass-from-date')?.focus();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                resetSanchaPassbookFilters();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('sancha-pass-search-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
            return;
        }

        // 6. Level 2: Main Sancha Stock Items List
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightSanchaListRow(sanchaListActiveIdx + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightSanchaListRow(sanchaListActiveIdx - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            changeSanchaStockPage(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeSanchaStockPage(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pageRows = getSanchaCurrentPageRows();
            const chosen = pageRows[sanchaListActiveIdx];
            if (chosen) openSanchaPassbook(encodeURIComponent(chosen.name));
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            triggerSelectedSanchaTransfer();
        } else if (e.key === '+') {
            e.preventDefault();
            toggleAddSanchaForm();
        } else if (e.key === '/') {
            e.preventDefault();
            const sEl = document.getElementById('search-sancha-input');
            if (sEl) { sEl.focus(); sEl.select(); }
        }
    };

    const bindSanchaKeyboardEngine = () => {
        if (window.__sanchaKeysBound) return;
        window.__sanchaKeysBound = true;
        document.addEventListener('keydown', handleSanchaKeydown);
    };

    /* ========================================================================
       9. A6 PRINT ENGINES (UNCHANGED)
       ======================================================================== */
    const getSanchaKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printSanchaStockReport = () => {
        const rows = currentSanchaFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi Sancha stock nahi mila!');
        }

        const kName = getSanchaKarkhanaPrintName(window.currentSanchaKarkhanaFilter);
        const catLabel = ((window.currentSanchaCategory || 'tani') === 'chukka' ? 'CHUKKA' : 'TANI') + ' STOCK';
        const today = new Date().toLocaleDateString('hi-IN');

        let totalAaya = 0;
        let totalGaya = 0;
        let totalBacha = 0;

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            const aaya = safeNum(r.aaya);
            const gaya = safeNum(r.gaya);
            const bacha = safeNum(r.bacha);

            totalAaya += aaya;
            totalGaya += gaya;
            totalBacha += bacha;

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:4px 2px;">${idx + 1}</td>
                    <td style="padding:4px 2px; font-weight:bold;">${esc(r.name)}</td>
                    <td style="padding:4px 2px;">${esc(r.person || '-')}</td>
                    <td style="padding:4px 2px; text-align:right;">+${aaya.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right;">-${gaya.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right; font-weight:bold;">${bacha.toFixed(2)}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Sancha Stock Report - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p><strong>SANCHA ${catLabel} STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Items:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>ITEM</th><th>PERSON</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th><th style="text-align:right;">BACHA</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aaya:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gaya:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHA STOCK:</span> <span>${totalBacha.toFixed(2)} Kg</span>
                        </div>
                    </div>
                    <div class="footer">
                        <p>हस्ताक्षर / मुंशी: ____________________</p>
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

    const printSanchaPassbookFiltered = () => {
        const rows = filteredSanchaPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const itemName = window.currentPassbookSanchaItem || 'Sancha Item';
        const catLabel = ((window.currentSanchaCategory || 'tani') === 'chukka' ? 'Chukka' : 'Tani');
        const kName = getSanchaKarkhanaPrintName(window.currentSanchaKarkhanaFilter);
        const fDate = document.getElementById('sancha-pass-from-date')?.value || '';
        const tDate = document.getElementById('sancha-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAaya = 0;
        let totalGaya = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const aaya = safeNum(r.aaya);
            const gaya = safeNum(r.gaya !== undefined ? r.gaya : r.qty);

            totalAaya += aaya;
            totalGaya += gaya;

            const party = (r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? r.kariger : (r.type || 'Inward');

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${esc(r.date || '-')}</td>
                    <td style="padding:3px 2px; font-weight:600;">${esc(party)}</td>
                    <td style="padding:3px 2px; text-align:right;">${aaya > 0 ? `+${aaya.toFixed(2)}` : '-'}</td>
                    <td style="padding:3px 2px; text-align:right;">${gaya > 0 ? `-${gaya.toFixed(2)}` : '-'}</td>
                </tr>`;
        });

        const netBalance = totalAaya - totalGaya;

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Sancha Passbook - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p><strong>SANCHA PASSBOOK (${catLabel.toUpperCase()})</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Item Naam:</strong> ${esc(itemName)}</div>
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Filter Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Kul Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>SOURCE / PARTY</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aaya:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gaya:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BALANCE:</span> <span>${netBalance.toFixed(2)} Kg</span>
                        </div>
                    </div>
                    <div class="footer">
                        <p>हस्ताक्षर / मुंशी: ____________________</p>
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

    const printSingleSanchaPassbookEntry = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const itemName = entry.name || window.currentPassbookSanchaItem || 'Sancha Item';
        const catLabel = (entry.category || window.currentSanchaCategory || 'tani').toUpperCase();
        const kName = getSanchaKarkhanaPrintName(entry.karkhanaId || window.currentSanchaKarkhanaFilter);
        const aaya = safeNum(entry.aaya);
        const gaya = safeNum(entry.gaya !== undefined ? entry.gaya : entry.qty);
        const isAaya = aaya > 0;
        const wazanDisplay = isAaya ? `+${aaya.toFixed(2)} Kg` : `-${gaya.toFixed(2)} Kg`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Sancha Voucher - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                    .total-highlight { background: #eee; padding: 6px 4px; border: 1px solid #000; font-size: 13px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>SANCHA (${catLabel}) LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${esc(entry.date || '-')}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>Item:</strong></span><span>${esc(itemName)}</span></div>
                    <div class="row"><span><strong>Type:</strong></span><span>${esc(entry.type || 'Movement')}</span></div>
                    <div class="row"><span><strong>Kariger / Person:</strong></span><span>${esc(entry.kariger || '-')}</span></div>
                    <div class="total-highlight">
                        WAZAN: ${wazanDisplay}
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>________</div>
                        <div>हस्ताक्षर पाने वाला<br><br>________</div>
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

    /* ========================================================================
       10. DELETE & EDIT ENGINES (100% SUPABASE-SAFE & TALLY WHITE & GOLD)
       ======================================================================== */
    const deleteSanchaHistoryEntry = (id) => {
        if (!confirm('Kya aap sach me ye Passbook entry DELETE karna chahte hain?\nIsse stock balance wapas sahi settle ho jayega.')) return;

        let hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const isPurchase = (String(entry.type || '').includes('Khareed') || String(entry.type || '').includes('Inward'));
        const isTransfer = (entry.refId || String(entry.type || '').includes('Transfer'));

        if (isTransfer && entry.refId) {
            hist = hist.filter((x) => x.refId !== entry.refId);
        } else {
            hist = hist.filter((x) => String(x.id) !== String(id));
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        if (isPurchase) {
            const qtyToDeduct = safeNum(entry.aaya);
            const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            const targetKid = entry.karkhanaId || 'k_main';
            const cat = (entry.category || window.currentSanchaCategory || 'tani').toLowerCase();

            const item = list.find((x) => {
                const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && (x.category || 'tani').toLowerCase() === cat && matchK;
            });

            if (item) {
                item.aaya = Math.max(0, safeNum((safeNum(item.aaya) - qtyToDeduct).toFixed(2)));
                item.bacha = Math.max(0, safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2)));
                if (typeof window.setStore === 'function') window.setStore('sancha_items', list);
            }
        }

        triggerSanchaCacheInvalidation();
        applySanchaPassbookFilters();
        renderSanchaTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert('✅ Entry safalta-poorvak delete ho gayi!');
    };

    const openSanchaEditModal = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const existingModal = document.getElementById('sancha-edit-popup-modal');
        if (existingModal) existingModal.remove();

        const currentQty = safeNum(entry.aaya || entry.gaya || entry.qty);
        const isAaya = safeNum(entry.aaya) > 0;
        const typeLabel = isAaya ? 'Aaya (Inward)' : 'Gaya (Outward)';

        const modalHtml = `
            <div id="sancha-edit-popup-modal" class="sancha-modal-overlay">
                <div class="sancha-modal-card" style="max-width:420px;">
                    <div class="sancha-modal-head">
                        <h3>Edit Sancha Entry</h3>
                        <button type="button" class="sancha-tally-btn" onclick="closeSanchaEditModal()">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Item:</strong> ${esc(entry.name)} (${entry.category === 'chukka' ? 'Chukka' : 'Tani'})</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh (Date) :</label>
                            <input type="date" id="sancha-edit-date" value="${entry.date || ''}" class="sancha-modal-inp">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Kariger / Person Name :</label>
                            <input type="text" id="sancha-edit-person" value="${esc(entry.kariger || '')}" class="sancha-modal-inp">
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (${typeLabel} Kg) :</label>
                            <input type="number" step="0.01" id="sancha-edit-qty" value="${currentQty.toFixed(2)}" class="sancha-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="sancha-tally-btn" onclick="closeSanchaEditModal()">Cancel [Esc]</button>
                            <button type="button" class="sancha-tally-btn-gold" onclick="saveSanchaHistoryEdit('${esc(id)}')">Update [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const order = ['sancha-edit-date', 'sancha-edit-person', 'sancha-edit-qty'];
        order.forEach((fid, i) => {
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) {
                        const nxt = document.getElementById(order[i + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else {
                        saveSanchaHistoryEdit(id);
                    }
                }
            });
        });

        setTimeout(() => {
            const pEl = document.getElementById('sancha-edit-person');
            if (pEl) { pEl.focus(); pEl.select(); }
        }, 50);
    };

    const closeSanchaEditModal = () => {
        const modal = document.getElementById('sancha-edit-popup-modal');
        if (modal) modal.remove();
    };

    const saveSanchaHistoryEdit = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const newDate = document.getElementById('sancha-edit-date')?.value;
        const newPerson = String(document.getElementById('sancha-edit-person')?.value || '').trim();
        const newQty = safeNum(document.getElementById('sancha-edit-qty')?.value);

        if (newQty <= 0) return alert('Kripya sahi wazan (Kg) darj karein!');

        const oldAaya = safeNum(entry.aaya);
        const isPurchase = (String(entry.type || '').includes('Khareed') || String(entry.type || '').includes('Inward'));
        const isTransfer = (entry.refId || String(entry.type || '').includes('Transfer'));

        entry.date = newDate;
        entry.kariger = newPerson || '-';

        if (oldAaya > 0) {
            const aayaDiff = newQty - oldAaya;
            entry.aaya = newQty;

            if (isPurchase) {
                const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
                const targetKid = entry.karkhanaId || 'k_main';
                const cat = (entry.category || window.currentSanchaCategory || 'tani').toLowerCase();

                const item = list.find((x) => {
                    const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && (x.category || 'tani').toLowerCase() === cat && matchK;
                });

                if (item) {
                    item.aaya = safeNum((safeNum(item.aaya) + aayaDiff).toFixed(2));
                    item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('sancha_items', list);
                }
            }
        } else {
            entry.gaya = newQty;
            entry.qty = newQty;
        }

        if (isTransfer && entry.refId) {
            const pair = hist.find((x) => x && x.refId === entry.refId && String(x.id) !== String(id));
            if (pair) {
                pair.date = newDate;
                if (pair.aaya > 0) pair.aaya = newQty;
                if (pair.gaya > 0) pair.gaya = newQty;
            }
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        triggerSanchaCacheInvalidation();
        closeSanchaEditModal();
        applySanchaPassbookFilters();
        renderSanchaTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        alert('✅ Sancha entry safalta-poorvak update ho gayi!');
    };

    /* ========================================================================
       10. GLOBAL EXPORT
       ======================================================================== */
    const sanchaUIAPI = {
        openSanchaModule,
        switchSanchaCategory,
        renderSanchaKarkhanaTabs,
        switchSanchaKarkhanaTab,
        toggleAddSanchaForm,
        toggleSanchaFormOptions,
        populateSanchaExistingDropdown,
        saveNewSanchaStock,
        bindSanchaSearchInput,
        filterSancha,
        renderSanchaTable,
        changeSanchaStockPage,
        printSanchaStockReport,
        openSanchaTransferModal,
        closeSanchaTransferModal,
        submitSanchaTransferForm,
        openSanchaPassbook,
        resetSanchaPassbookFilters,
        applySanchaPassbookFilters,
        changeSanchaPassbookPage,
        printSanchaPassbookFiltered,
        printSingleSanchaPassbookEntry,
        deleteSanchaHistoryEntry,
        openSanchaEditModal,
        closeSanchaEditModal,
        saveSanchaHistoryEdit
    };

    Object.keys(sanchaUIAPI).forEach((fnName) => {
        window[fnName] = sanchaUIAPI[fnName];
    });

    window.SanchaUIEngine = sanchaUIAPI;
})();
