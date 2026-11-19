/* ============================================================================
   SIMPLICITY ERP - BANA STOCK & PASSBOOK ENGINE (TALLYPRIME WHITE & GOLD)
   File: bana/bana-ui.js • Developed by Farhan Jawed
   (100% Supabase-Safe | Zero Row Clutter | Inline Drill-Down Passbook + Keys)
============================================================================ */

(() => {
    'use strict';

    window.currentBanaKarkhanaFilter = 'all';
    window.currentPassbookBanaItem = '';

    // Pagination & Keyboard Cursor State - Passbook
    let passbookCurrentPage = 1;
    const PASSBOOK_PAGE_SIZE = 20;
    let filteredPassbookCache = [];
    let passbookActiveIdx = 0;
    let isPassbookViewOpen = false;

    // Pagination & Keyboard Cursor State - Main Bana List
    let banaStockCurrentPage = 1;
    const BANA_STOCK_PAGE_SIZE = 15;
    let currentBanaFilteredRowsCache = [];
    let banaListActiveIdx = 0;
    let banaOpenedAt = 0;

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
        const el = document.getElementById(id);
        if (el) el.style.display = val;
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

    /* ========================================================================
       1. SCOPED TALLYPRIME WHITE & GOLD STYLES FOR #bana-section
       ======================================================================== */
    const ensureBanaTallyStyles = () => {
        if (document.getElementById('bana-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'bana-tally-styles';
        style.textContent = `
            #bana-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #bana-section .module-header {
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
            #bana-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 17px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #bana-section .back-btn {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                padding: 6px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #bana-section .back-btn:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
            }
            #bana-section .add-btn {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 6px !important;
                padding: 6px 14px !important;
                font-size: 12.5px !important;
                font-weight: 800 !important;
                cursor: pointer;
            }
            #bana-section .add-btn:hover { background: #e5aa12 !important; }
            #bana-section #bana-karkhana-tabs-bar {
                padding: 12px 20px 0 20px;
                margin-bottom: 10px !important;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #bana-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #bana-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #bana-section #bana-opening-box {
                margin: 0 20px 10px 20px !important;
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
            #bana-section #bana-opening-val {
                color: #b47d00 !important;
                font-size: 14px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #bana-section .filter-panel {
                padding: 0 20px 10px 20px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #bana-section .search-box {
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
            #bana-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #bana-section #add-bana-form {
                margin: 0 20px 14px 20px !important;
                padding: 14px 16px !important;
                background: #fdfcf7 !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 6px !important;
            }
            #bana-section .table-responsive {
                padding: 0 20px;
                box-sizing: border-box;
            }
            #bana-section table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #bana-section table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #bana-section table th {
                padding: 9px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left;
            }
            #bana-section table td {
                padding: 9px 12px !important;
                font-size: 13px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
            }
            #bana-section .bana-stock-row,
            #bana-section .bana-pass-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #bana-section .bana-stock-row:hover,
            #bana-section .bana-pass-row:hover {
                background: #fef9ea !important;
            }
            #bana-section .bana-stock-row.active,
            #bana-section .bana-pass-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #bana-section .bana-stock-row.active td,
            #bana-section .bana-pass-row.active td {
                font-weight: 700 !important;
                color: #1f2937 !important;
            }
            #bana-section .bana-tally-btn {
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
            #bana-section .bana-tally-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
            }
            #bana-section .bana-tally-btn-gold {
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
            #bana-section .bana-tally-btn-gold:hover { background: #e5aa12; }
            #bana-section .bana-status-strip {
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
            .bana-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 15px; box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .bana-modal-card {
                background: #ffffff;
                width: 100%; max-width: 460px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                color: #1f2937;
            }
            .bana-modal-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 11px 16px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .bana-modal-head h3 {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
            }
            .bana-modal-inp {
                width: 100%; box-sizing: border-box;
                padding: 7px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
            }
            .bana-modal-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       2. VIEW TOGGLE: MAIN BANA LIST vs INLINE PASSBOOK DRILL-DOWN
       ======================================================================== */
    const setBanaSubViewMode = (showPassbook) => {
        isPassbookViewOpen = Boolean(showPassbook);
        const sec = document.getElementById('bana-section');
        if (!sec) return;

        const tabsBar = document.getElementById('bana-karkhana-tabs-bar');
        const openBox = document.getElementById('bana-opening-box');
        const filterPanel = sec.querySelector(':scope > .filter-panel');
        const addForm = document.getElementById('add-bana-form');
        const mainTbl = document.getElementById('bana-table-body')?.closest('.table-responsive');
        const mainPager = document.getElementById('bana-stock-pagination-controls');
        const mainStatus = document.getElementById('bana-main-status-strip');
        const passView = document.getElementById('bana-inline-passbook-view');
        const headerTitle = sec.querySelector('.module-header h2');

        const listDisp = showPassbook ? 'none' : '';
        if (tabsBar) tabsBar.style.display = showPassbook ? 'none' : 'flex';
        if (openBox) openBox.style.display = showPassbook ? 'none' : 'flex';
        if (filterPanel) filterPanel.style.display = showPassbook ? 'none' : 'flex';
        if (addForm && showPassbook) addForm.style.display = 'none';
        if (mainTbl) mainTbl.style.display = listDisp;
        if (mainPager) mainPager.style.display = showPassbook ? 'none' : 'flex';
        if (mainStatus) mainStatus.style.display = showPassbook ? 'none' : 'flex';
        if (passView) passView.style.display = showPassbook ? 'block' : 'none';

        if (headerTitle) {
            headerTitle.textContent = showPassbook
                ? `Bana Passbook: ${window.currentPassbookBanaItem || ''}`
                : 'Bana Stock';
        }
    };

    const closeBanaPassbookToList = () => {
        setBanaSubViewMode(false);
        renderBanaTable();
    };

    const handleBanaExitAction = () => {
        if (isPassbookViewOpen) {
            closeBanaPassbookToList();
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
       3. NAVIGATION & TABS
       ======================================================================== */
    const openBanaModule = () => {
        banaOpenedAt = performance.now();
        ensureBanaTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('bana-section', 'block');

        setBanaSubViewMode(false);
        banaListActiveIdx = 0;

        renderBanaKarkhanaTabs();
        populateBanaExistingDropdown();
        renderBanaTable();
        bindBanaSearchInput();
        bindBanaKeyboardEngine();
    };

    const renderBanaKarkhanaTabs = () => {
        const bar = document.getElementById('bana-karkhana-tabs-bar');
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

        const isAllActive = (window.currentBanaKarkhanaFilter === 'all') ? ' active' : '';
        let html = `<button type="button" class="sheet-tab${isAllActive}" onclick="switchBanaKarkhanaTab('all')">Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isActive = (String(window.currentBanaKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchBanaKarkhanaTab('${esc(k.id)}')">${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchBanaKarkhanaTab = (kId) => {
        window.currentBanaKarkhanaFilter = kId || 'all';
        banaStockCurrentPage = 1;
        banaListActiveIdx = 0;
        renderBanaKarkhanaTabs();
        populateBanaExistingDropdown();
        renderBanaTable();
    };

    const cycleBanaKarkhanaTab = () => {
        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];

        const ids = ['all', ...karkhanas.map(k => String(k.id))];
        const curIdx = ids.indexOf(String(window.currentBanaKarkhanaFilter));
        const nextId = ids[(curIdx + 1) % ids.length];
        switchBanaKarkhanaTab(nextId);
    };

    /* ========================================================================
       4. INWARD PURCHASE ENGINE (100% SUPABASE SAFE)
       ======================================================================== */
    const toggleBanaForm = () => {
        if (isPassbookViewOpen) setBanaSubViewMode(false);
        const f = document.getElementById('add-bana-form');
        if (!f) return;
        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('bana-date');
            if (dInp) dInp.value = getToday();
            populateBanaExistingDropdown();
            toggleBanaItemType();
            setTimeout(() => {
                const isNew = document.getElementById('bana-type-new')?.checked;
                const target = document.getElementById(isNew ? 'bana-new-name' : 'bana-select-existing');
                if (target) target.focus();
            }, 40);
        }
    };

    const toggleBanaItemType = () => {
        const typeNewRadio = document.getElementById('bana-type-new');
        const isNew = typeNewRadio ? typeNewRadio.checked : false;
        setDisplay('bana-existing-group', isNew ? 'none' : 'block');
        setDisplay('bana-new-group', isNew ? 'block' : 'none');
    };

    const populateBanaExistingDropdown = () => {
        const sel = document.getElementById('bana-select-existing');
        if (!sel) return;
        sel.innerHTML = '';
        const list = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const unique = [];

        list.forEach((b) => {
            const n = b?.name ? b.name.trim() : '';
            if (n && unique.indexOf(n.toLowerCase()) === -1) {
                unique.push(n.toLowerCase());
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                sel.appendChild(opt);
            }
        });
    };

    const saveNewBana = () => {
        const typeNewRadio = document.getElementById('bana-type-new');
        const isNew = typeNewRadio ? typeNewRadio.checked : false;

        const nameInp = isNew ? document.getElementById('bana-new-name') : document.getElementById('bana-select-existing');
        const name = String(nameInp?.value || '').trim();

        const date = document.getElementById('bana-date')?.value || getToday();
        const qtyInp = document.getElementById('bana-aaya');
        const qty = safeNum(qtyInp?.value);

        if (!name) return alert('Bana Item ka naam zaroori hai!');
        if (qty <= 0) return alert('Wazan (Qty) daalein!');

        const targetKid = (window.currentBanaKarkhanaFilter !== 'all') ? window.currentBanaKarkhanaFilter : 'k_main';
        const list = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];

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
                id: `bana_${Date.now()}`,
                date, name, aaya: qty, gaya: 0, bacha: qty,
                karkhanaId: targetKid, timestamp: Date.now()
            });
        }
        if (typeof window.setStore === 'function') window.setStore('bana_stock', list);

        const hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        hist.push({
            id: `bhist_${Date.now()}`,
            date, name,
            kariger: 'Godown Purchase',
            type: 'Khareed (Inward)',
            aaya: qty, gaya: 0,
            karkhanaId: targetKid,
            timestamp: Date.now()
        });
        if (typeof window.setStore === 'function') window.setStore('bana_history', hist);

        const newNameEl = document.getElementById('bana-new-name');
        if (newNameEl) newNameEl.value = '';
        if (qtyInp) qtyInp.value = '';

        toggleBanaForm();
        populateBanaExistingDropdown();
        renderBanaTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert(`✅ ${qty.toFixed(2)} Kg Bana Stock me jama ho gaya!`);
    };

    const bindBanaSearchInput = () => {
        const searchInp = document.getElementById('search-bana-input');
        if (searchInp && !searchInp.dataset.bound) {
            searchInp.dataset.bound = 'true';
            searchInp.addEventListener('input', () => {
                banaStockCurrentPage = 1;
                banaListActiveIdx = 0;
                renderBanaTable();
            });
            searchInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    searchInp.blur();
                    if (e.key === 'Enter' && currentBanaFilteredRowsCache.length > 0) {
                        const pageRows = getBanaCurrentPageRows();
                        const chosen = pageRows[banaListActiveIdx] || pageRows[0];
                        if (chosen) openBanaPassbook(encodeURIComponent(chosen.name));
                    }
                }
            });
        }
    };

    const filterBana = () => {
        banaStockCurrentPage = 1;
        banaListActiveIdx = 0;
        renderBanaTable();
    };

    const getBanaCurrentPageRows = () => {
        const startIndex = (banaStockCurrentPage - 1) * BANA_STOCK_PAGE_SIZE;
        return currentBanaFilteredRowsCache.slice(startIndex, startIndex + BANA_STOCK_PAGE_SIZE);
    };

    const highlightBanaListRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#bana-table-body .bana-stock-row'));
        if (!rows.length) return;
        banaListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === banaListActiveIdx));
        rows[banaListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    /* ========================================================================
       5. MAIN BANA TABLE RENDERER (CLEAN WHITE & GOLD + KEYBOARD CURSOR)
       ======================================================================== */
    const renderBanaTable = () => {
        ensureBanaTallyStyles();
        bindBanaSearchInput();

        const tbody = document.getElementById('bana-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const rawStock = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const uniqueNames = [];

        rawStock.forEach((b) => {
            if (!b || !b.name) return;
            const n = b.name.trim();
            if (uniqueNames.map(x => x.toLowerCase()).indexOf(n.toLowerCase()) === -1) {
                uniqueNames.push(n);
            }
        });

        const rows = [];
        uniqueNames.forEach((name) => {
            if (typeof window.getBanaItemStats === 'function') {
                const stats = window.getBanaItemStats(name, window.currentBanaKarkhanaFilter);
                if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                    rows.push(stats);
                }
            }
        });

        const searchInp = document.getElementById('search-bana-input');
        const txt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        const filteredRows = txt
            ? rows.filter(r => `${r.name || ''} ${r.date || ''} ${r.aaya || ''} ${r.gaya || ''} ${r.bacha || ''}`.toLowerCase().includes(txt))
            : rows;

        currentBanaFilteredRowsCache = filteredRows;

        // Clean White & Gold Toolbar Buttons (Transfer + A6 Print) next to Search
        if (searchInp && searchInp.parentElement) {
            if (!document.getElementById('bana-stock-transfer-btn')) {
                const trBtn = document.createElement('button');
                trBtn.id = 'bana-stock-transfer-btn';
                trBtn.type = 'button';
                trBtn.className = 'bana-tally-btn';
                trBtn.innerHTML = 'Bhejo / Transfer [T]';
                trBtn.onclick = () => triggerSelectedBanaTransfer();
                searchInp.parentElement.appendChild(trBtn);
            }
            if (!document.getElementById('bana-stock-print-btn')) {
                const printBtn = document.createElement('button');
                printBtn.id = 'bana-stock-print-btn';
                printBtn.type = 'button';
                printBtn.className = 'bana-tally-btn';
                printBtn.innerHTML = 'A6 Print [Alt+P]';
                printBtn.onclick = () => printBanaStockReport();
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
        const sec = document.getElementById('bana-section');
        let pager = document.getElementById('bana-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'bana-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;';
                tbl.insertAdjacentElement('afterend', pager);
            }
        }

        if (sec && !document.getElementById('bana-main-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'bana-main-status-strip';
            strip.className = 'bana-status-strip';
            strip.innerHTML = `
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Item Chunein · [Enter / Click] Passbook · [T / F4] Transfer · [F7] + Naya Bana · [F2] Godam · [/] Search · [Esc] Back</span>
                <span id="bana-main-count-lbl">0 Items</span>
            `;
            sec.appendChild(strip);
        }

        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:22px; color:#6b7280;'>Koi Bana Stock nahi mila.</td></tr>";
            if (pager) pager.innerHTML = '';
        } else {
            const totalPages = Math.ceil(totalEntries / BANA_STOCK_PAGE_SIZE) || 1;
            if (banaStockCurrentPage > totalPages) banaStockCurrentPage = totalPages;
            if (banaStockCurrentPage < 1) banaStockCurrentPage = 1;

            const startIndex = (banaStockCurrentPage - 1) * BANA_STOCK_PAGE_SIZE;
            const pageRows = filteredRows.slice(startIndex, startIndex + BANA_STOCK_PAGE_SIZE);
            if (banaListActiveIdx >= pageRows.length) banaListActiveIdx = 0;
            if (banaListActiveIdx < 0) banaListActiveIdx = 0;

            let html = '';
            pageRows.forEach((b, idx) => {
                const bacha = safeNum(b.bacha);
                const safeName = encodeURIComponent(b.name);
                const activeCls = (idx === banaListActiveIdx) ? ' active' : '';

                html += `<tr class="bana-stock-row${activeCls}" data-bidx="${idx}" onclick="window.__banaSelectAndOpen(${idx}, '${safeName}')">
                    <td>${esc(b.date || '-')}</td>
                    <td><strong>${esc(b.name)}</strong></td>
                    <td style="font-weight:700;">+${safeNum(b.aaya).toFixed(2)} Kg</td>
                    <td style="font-weight:700; color:#6b7280;">-${safeNum(b.gaya).toFixed(2)} Kg</td>
                    <td style="font-weight:800; color:#b47d00;">${bacha.toFixed(2)} Kg</td>
                    <td style="text-align:right; font-weight:700; font-size:12px;">Passbook →</td>
                </tr>`;
            });
            tbody.innerHTML = html;

            if (pager) {
                pager.innerHTML = `
                    <div style="font-size:12px; color:#6b7280; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + BANA_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="bana-tally-btn" ${banaStockCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeBanaStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${banaStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="bana-tally-btn" ${banaStockCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeBanaStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const opBox = document.getElementById('bana-opening-box');
        const opVal = document.getElementById('bana-opening-val');
        if (opVal) opVal.textContent = `Kul Bacha: ${totalBacha.toFixed(2)} Kg`;
        if (opBox) {
            let extra = document.getElementById('bana-summary-meta');
            if (!extra) {
                extra = document.createElement('div');
                extra.id = 'bana-summary-meta';
                extra.style.cssText = 'font-size:12px; color:#6b7280; font-weight:700;';
                opBox.appendChild(extra);
            }
            extra.textContent = `Total Aaya: +${totalAaya.toFixed(2)} Kg · Total Gaya: -${totalGaya.toFixed(2)} Kg`;
        }

        const cntLbl = document.getElementById('bana-main-count-lbl');
        if (cntLbl) cntLbl.textContent = `${totalEntries} Items`;
    };

    window.__banaSelectAndOpen = (idx, safeName) => {
        highlightBanaListRow(idx);
        openBanaPassbook(safeName);
    };

    const triggerSelectedBanaTransfer = () => {
        if (isPassbookViewOpen && window.currentPassbookBanaItem) {
            const stats = (typeof window.getBanaItemStats === 'function')
                ? window.getBanaItemStats(window.currentPassbookBanaItem, window.currentBanaKarkhanaFilter)
                : { bacha: 0 };
            if (safeNum(stats.bacha) <= 0) return alert('Is item me transfer ke liye koi stock nahi bacha hai.');
            openBanaTransferModal(encodeURIComponent(window.currentPassbookBanaItem), safeNum(stats.bacha));
            return;
        }

        const pageRows = getBanaCurrentPageRows();
        const chosen = pageRows[banaListActiveIdx];
        if (!chosen) return alert('Pehle koi Bana item chunein!');
        if (safeNum(chosen.bacha) <= 0) return alert(`[${chosen.name}] me transfer ke liye koi stock nahi bacha hai.`);
        openBanaTransferModal(encodeURIComponent(chosen.name), safeNum(chosen.bacha));
    };

    const changeBanaStockPage = (delta) => {
        banaStockCurrentPage += delta;
        banaListActiveIdx = 0;
        renderBanaTable();
    };

    /* ========================================================================
       6. INTER-GODOWN TRANSFER POPUP (TALLY WHITE & GOLD + ENTER CHAINING)
       ======================================================================== */
    const openBanaTransferModal = (safeName, availableBacha) => {
        const itemName = decodeURIComponent(safeName);
        const existingModal = document.getElementById('bana-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);

        const currentKid = (window.currentBanaKarkhanaFilter !== 'all') ? window.currentBanaKarkhanaFilter : 'k_main';
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

        const modalHtml = `
            <div id="bana-transfer-popup-modal" class="bana-modal-overlay">
                <div class="bana-modal-card">
                    <div class="bana-modal-head">
                        <h3>Bana Stock Transfer</h3>
                        <button type="button" class="bana-tally-btn" onclick="closeBanaTransferModal()">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:6px; padding:10px 12px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Bana Item:</strong> ${esc(itemName)}</div>
                            <div><strong>Bhejne Wala Godam:</strong> ${esc(currentGodamName)}</div>
                            <div style="color:#b47d00; font-weight:800; font-size:13.5px; margin-top:4px;">Available Stock: ${availableBacha.toFixed(2)} Kg</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Destination Godam :</label>
                            <select id="bana-dest-godam" class="bana-modal-inp">${godownOptions}</select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="bana-transfer-qty" max="${availableBacha}" min="0.01" value="${availableBacha}" class="bana-modal-inp">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh :</label>
                                <input type="date" id="bana-transfer-date" value="${today}" class="bana-modal-inp">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Note / Parchi No. (Optional) :</label>
                            <input type="text" id="bana-transfer-note" placeholder="e.g. Mau unit ke liye bheja" class="bana-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="bana-tally-btn" onclick="closeBanaTransferModal()">Cancel [Esc]</button>
                            <button type="button" class="bana-tally-btn-gold" onclick="submitBanaTransferForm('${safeName}', '${currentKid}', ${availableBacha})">Transfer Confirm [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const order = ['bana-dest-godam', 'bana-transfer-qty', 'bana-transfer-date', 'bana-transfer-note'];
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
                        submitBanaTransferForm(safeName, currentKid, availableBacha);
                    }
                }
            });
        });

        setTimeout(() => {
            const qtyEl = document.getElementById('bana-transfer-qty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
        }, 50);
    };

    const closeBanaTransferModal = () => {
        const modal = document.getElementById('bana-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const submitBanaTransferForm = (safeName, fromKid, maxAvailable) => {
        const itemName = decodeURIComponent(safeName);
        const toKid = document.getElementById('bana-dest-godam')?.value;
        const qty = safeNum(document.getElementById('bana-transfer-qty')?.value);
        const d = document.getElementById('bana-transfer-date')?.value || getToday();
        const note = String(document.getElementById('bana-transfer-note')?.value || '').trim();

        if (!toKid) return alert('Kripya Paane wala Godam chunein!');
        if (qty <= 0) return alert('Kripya sahi wazan (Kg) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable.toFixed(2)} Kg bachi hai!`);

        let success = false;
        if (typeof window.transferBanaStock === 'function') {
            success = window.transferBanaStock(d, itemName, fromKid, toKid, qty, note);
        }

        if (success) {
            closeBanaTransferModal();
            if (isPassbookViewOpen) {
                applyPassbookFilters();
            } else {
                renderBanaTable();
            }
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            alert(`✅ ${qty.toFixed(2)} Kg Bana safalta-poorvak transfer ho gaya!`);
        }
    };

    /* ========================================================================
       7. INLINE TALLY BANA PASSBOOK ENGINE (WITH RUNNING CLOSING BALANCE)
       ======================================================================== */
    const ensureInlinePassbookContainer = () => {
        const sec = document.getElementById('bana-section');
        if (!sec) return null;

        let container = document.getElementById('bana-inline-passbook-view');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'bana-inline-passbook-view';
        container.style.display = 'none';
        container.innerHTML = `
            <div style="margin:12px 20px 10px 20px; padding:10px 14px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="bana-tally-btn" onclick="window.__closeBanaPassbookView()">&larr; [Esc] Bana List</button>
                    <strong id="bana-pass-summary-title" style="font-size:14px; color:#1f2937;">Item: -</strong>
                    <span id="bana-pass-summary-totals" style="font-size:12px; color:#b47d00; font-weight:800;"></span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="bana-tally-btn" onclick="window.__banaPassAction('edit')">Edit [Enter]</button>
                    <button type="button" class="bana-tally-btn" onclick="window.__banaPassAction('delete')">Delete [Del]</button>
                    <button type="button" class="bana-tally-btn" onclick="window.__banaPassAction('print_single')">Slip [P]</button>
                    <button type="button" class="bana-tally-btn" onclick="window.__banaTransferFromPass()">Bhejo [T]</button>
                    <button type="button" class="bana-tally-btn-gold" onclick="printBanaPassbookFiltered()">A6 Print [Alt+P]</button>
                </div>
            </div>

            <div style="padding:0 20px 10px 20px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">From Date [F]:</label>
                    <input type="date" id="pass-from-date" onchange="applyPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">To Date:</label>
                    <input type="date" id="pass-to-date" onchange="applyPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">Search [/]:</label>
                    <input type="text" id="pass-search-input" class="search-box" placeholder="Search Date, Kariger, Type..." oninput="applyPassbookFilters()">
                </div>
                <button type="button" class="bana-tally-btn" onclick="resetPassbookFilters()">Reset [R]</button>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Tarikh</th>
                            <th>Particulars (Kariger / Source)</th>
                            <th>Detail (Vch Type)</th>
                            <th style="text-align:right;">Aaya (In)</th>
                            <th style="text-align:right;">Gaya (Out)</th>
                            <th style="text-align:right;">Closing Bal</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="passbook-table-body"></tbody>
                </table>
            </div>

            <div id="passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;"></div>

            <div class="bana-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Entry Chunein · [Enter/E] Edit · [Del] Delete · [P] Single Slip · [Alt+P] Statement · [Esc] Bana List</span>
                <span id="passbook-entry-status">-</span>
            </div>
        `;

        const mainStrip = document.getElementById('bana-main-status-strip');
        if (mainStrip) {
            sec.insertBefore(container, mainStrip);
        } else {
            sec.appendChild(container);
        }

        // Bind Filter Keyboard Flow inside Passbook
        const fInp = document.getElementById('pass-from-date');
        const tInp = document.getElementById('pass-to-date');
        const sInp = document.getElementById('pass-search-input');
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

    window.__closeBanaPassbookView = closeBanaPassbookToList;
    window.__banaTransferFromPass = triggerSelectedBanaTransfer;

    window.__banaPassAction = (action) => {
        const startIndex = (passbookCurrentPage - 1) * PASSBOOK_PAGE_SIZE;
        const pageRows = filteredPassbookCache.slice(startIndex, startIndex + PASSBOOK_PAGE_SIZE);
        const entry = pageRows[passbookActiveIdx];
        if (!entry) return alert('Pehle koi entry chunein!');

        if (action === 'print_single') {
            printSingleBanaPassbookEntry(entry.id);
            return;
        }

        const isOpeningEntry = entry.isOpening || (entry.type && entry.type.toLowerCase().includes('opening'));
        const isKarigerEntry = (entry.type && entry.type.toLowerCase().includes('kariger')) ||
                               (entry.kariger && entry.kariger.toLowerCase().includes('kariger sheet'));

        if (isOpeningEntry || isKarigerEntry) {
            return alert('Ye entry locked hai (Kariger Sheet / Opening Balance). Isko wahan se edit karein.');
        }

        if (action === 'edit') openBanaEditModal(entry.id);
        else if (action === 'delete') deleteBanaHistoryEntry(entry.id);
    };

    const openBanaPassbook = (safeName) => {
        ensureBanaTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('bana-section', 'block');

        window.currentPassbookBanaItem = decodeURIComponent(safeName);
        passbookCurrentPage = 1;
        passbookActiveIdx = 0;

        ensureInlinePassbookContainer();
        setBanaSubViewMode(true);
        bindBanaKeyboardEngine();
        applyPassbookFilters();
    };

    const resetPassbookFilters = () => {
        const fDate = document.getElementById('pass-from-date');
        const tDate = document.getElementById('pass-to-date');
        const sInp = document.getElementById('pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        passbookCurrentPage = 1;
        passbookActiveIdx = 0;
        applyPassbookFilters();
    };

    const applyPassbookFilters = () => {
        const targetItemLower = window.currentPassbookBanaItem.toLowerCase();
        const allHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];

        let itemHist = allHist.filter((x) => {
            if (!x?.name) return false;
            if (x.name.toLowerCase() !== targetItemLower) return false;

            if (window.currentBanaKarkhanaFilter !== 'all') {
                const rowKid = x.karkhanaId || 'k_main';
                return String(rowKid) === String(window.currentBanaKarkhanaFilter);
            }
            return true;
        });

        // Compute Running Closing Balance chronologically (without mutating original store objects)
        const chrono = itemHist.slice().sort((a, b) => {
            const ta = a.timestamp || 0;
            const tb = b.timestamp || 0;
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        let runningBal = 0;
        const withRunning = chrono.map((r) => {
            const aayaQty = safeNum(r.aaya || r.qty);
            const gayaQty = safeNum(r.gaya);
            runningBal = safeNum((runningBal + aayaQty - gayaQty).toFixed(2));
            return { ...r, _runningBal: runningBal };
        });

        const fDate = document.getElementById('pass-from-date')?.value || '';
        const tDate = document.getElementById('pass-to-date')?.value || '';
        const sTxt = (document.getElementById('pass-search-input')?.value || '').toLowerCase().trim();

        let filtered = withRunning;
        if (fDate) filtered = filtered.filter(x => (x.date || '') >= fDate);
        if (tDate) filtered = filtered.filter(x => (x.date || '') <= tDate);

        if (sTxt) {
            filtered = filtered.filter((x) => {
                const rowString = `${x.date || ''} ${x.type || ''} ${x.kariger || ''} ${x.aaya || x.qty || ''} ${x.gaya || ''}`.toLowerCase();
                return rowString.includes(sTxt);
            });
        }

        // Display newest first
        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredPassbookCache = filtered;

        // Update Passbook Header Summary
        const stats = (typeof window.getBanaItemStats === 'function')
            ? window.getBanaItemStats(window.currentPassbookBanaItem, window.currentBanaKarkhanaFilter)
            : { aaya: 0, gaya: 0, bacha: runningBal };
        const godamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(window.currentBanaKarkhanaFilter)
            : 'Sabhi Karkhane';

        const titleEl = document.getElementById('bana-pass-summary-title');
        const totEl = document.getElementById('bana-pass-summary-totals');
        if (titleEl) titleEl.textContent = `${window.currentPassbookBanaItem} (${godamName})`;
        if (totEl) {
            totEl.textContent = `Aaya: +${safeNum(stats.aaya).toFixed(2)} Kg · Gaya: -${safeNum(stats.gaya).toFixed(2)} Kg · Closing: ${safeNum(stats.bacha).toFixed(2)} Kg`;
        }

        renderPaginatedPassbook();
    };

    const highlightPassbookRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#passbook-table-body .bana-pass-row'));
        if (!rows.length) return;
        passbookActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === passbookActiveIdx));
        rows[passbookActiveIdx]?.scrollIntoView({ block: 'nearest' });

        const startIndex = (passbookCurrentPage - 1) * PASSBOOK_PAGE_SIZE;
        const pageRows = filteredPassbookCache.slice(startIndex, startIndex + PASSBOOK_PAGE_SIZE);
        const entry = pageRows[passbookActiveIdx];
        const statusEl = document.getElementById('passbook-entry-status');
        if (statusEl && entry) {
            const isLocked = entry.isOpening ||
                (entry.type && (entry.type.toLowerCase().includes('opening') || entry.type.toLowerCase().includes('kariger'))) ||
                (entry.kariger && entry.kariger.toLowerCase().includes('kariger sheet'));
            statusEl.textContent = isLocked ? 'Locked Entry (Kariger Sheet / Opening)' : 'Editable Entry [Enter / Del]';
        }
    };

    const renderPaginatedPassbook = () => {
        const tbody = document.getElementById('passbook-table-body');
        const pager = document.getElementById('passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:18px; color:#6b7280;'>Koi passbook entry nahi mili.</td></tr>";
            if (pager) pager.innerHTML = '';
            const statusEl = document.getElementById('passbook-entry-status');
            if (statusEl) statusEl.textContent = '0 Entries';
            return;
        }

        const totalPages = Math.ceil(totalEntries / PASSBOOK_PAGE_SIZE);
        if (passbookCurrentPage > totalPages) passbookCurrentPage = totalPages;
        if (passbookCurrentPage < 1) passbookCurrentPage = 1;

        const startIndex = (passbookCurrentPage - 1) * PASSBOOK_PAGE_SIZE;
        const pageRows = filteredPassbookCache.slice(startIndex, startIndex + PASSBOOK_PAGE_SIZE);
        if (passbookActiveIdx >= pageRows.length) passbookActiveIdx = 0;
        if (passbookActiveIdx < 0) passbookActiveIdx = 0;

        let html = '';
        pageRows.forEach((r, idx) => {
            const aayaQty = safeNum(r.aaya || r.qty);
            const gayaQty = safeNum(r.gaya);
            const runBal = safeNum(r._runningBal);

            const isOpeningEntry = r.isOpening || (r.type && r.type.toLowerCase().includes('opening'));
            const isKarigerEntry = (r.type && r.type.toLowerCase().includes('kariger')) ||
                                  (r.kariger && r.kariger.toLowerCase().includes('kariger sheet'));

            const karigerDisplay = isOpeningEntry
                ? '31st March Closing (Opening)'
                : ((r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? esc(r.kariger) : 'Factory Inward');

            const statusBadge = isOpeningEntry
                ? '<span style="font-size:11px; color:#6b7280; font-weight:700;">Opening Lock</span>'
                : (isKarigerEntry
                    ? '<span style="font-size:11px; color:#6b7280; font-weight:700;">Kariger Sheet</span>'
                    : '<span style="font-size:11px; color:#b47d00; font-weight:700;">Editable</span>');

            const activeCls = (idx === passbookActiveIdx) ? ' active' : '';

            html += `<tr class="bana-pass-row${activeCls}" data-pidx="${idx}" onclick="window.__banaSelectPassRow(${idx})">
                <td>${esc(r.date || '-')}</td>
                <td><strong>${karigerDisplay}</strong></td>
                <td>${esc(r.type || 'Godam Inward')}</td>
                <td style="text-align:right; font-weight:700;">${aayaQty > 0 ? `+${aayaQty.toFixed(2)}` : '-'}</td>
                <td style="text-align:right; font-weight:700; color:#6b7280;">${gayaQty > 0 ? `-${gayaQty.toFixed(2)}` : '-'}</td>
                <td style="text-align:right; font-weight:800; color:#b47d00;">${runBal.toFixed(2)} Kg</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        highlightPassbookRow(passbookActiveIdx);

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#6b7280; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + PASSBOOK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="bana-tally-btn" ${passbookCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changePassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${passbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="bana-tally-btn" ${passbookCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changePassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    window.__banaSelectPassRow = (idx) => {
        highlightPassbookRow(idx);
    };

    const changePassbookPage = (delta) => {
        passbookCurrentPage += delta;
        passbookActiveIdx = 0;
        renderPaginatedPassbook();
    };

    /* ========================================================================
       8. KEYBOARD NAVIGATION ENGINE FOR #bana-section (ZERO CONFLICTS)
       ======================================================================== */
    const handleBanaKeydown = (e) => {
        const sec = document.getElementById('bana-section');
        if (!sec || sec.style.display === 'none') return;
        if (isAnyExpressOverlayOpen()) return;

        // 1. Edit Modal open
        const editModal = document.getElementById('bana-edit-popup-modal');
        if (editModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeBanaEditModal();
            }
            return;
        }

        // 2. Transfer Modal open
        const trModal = document.getElementById('bana-transfer-popup-modal');
        if (trModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeBanaTransferModal();
            }
            return;
        }

        // 3. Add Bana Form open
        const addForm = document.getElementById('add-bana-form');
        if (addForm && addForm.style.display === 'block') {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleBanaForm();
                return;
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const rNew = document.getElementById('bana-type-new');
                const rExt = document.getElementById('bana-type-existing');
                if (rNew && rExt) {
                    if (rNew.checked) rExt.checked = true;
                    else rNew.checked = true;
                    toggleBanaItemType();
                    const focusId = rNew.checked ? 'bana-new-name' : 'bana-select-existing';
                    document.getElementById(focusId)?.focus();
                }
                return;
            }
            if (e.key === 'Enter') {
                const activeId = document.activeElement?.id || '';
                const isNew = document.getElementById('bana-type-new')?.checked;
                const itemFieldId = isNew ? 'bana-new-name' : 'bana-select-existing';
                if (activeId === 'bana-date') {
                    e.preventDefault();
                    document.getElementById(itemFieldId)?.focus();
                } else if (activeId === itemFieldId) {
                    e.preventDefault();
                    document.getElementById('bana-aaya')?.focus();
                } else if (activeId === 'bana-aaya') {
                    e.preventDefault();
                    saveNewBana();
                }
            }
            return;
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        // Global Function Keys inside Bana
        if (e.key === 'Escape') {
            e.preventDefault();
            handleBanaExitAction();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            if (isPassbookViewOpen) printBanaPassbookFiltered();
            else printBanaStockReport();
            return;
        }

        if (e.key === 'F4') {
            e.preventDefault();
            triggerSelectedBanaTransfer();
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            toggleBanaForm();
            return;
        }

        if (e.key === 'F2' && !isPassbookViewOpen) {
            e.preventDefault();
            cycleBanaKarkhanaTab();
            return;
        }

        if (e.key === 'F3') {
            e.preventDefault();
            const sEl = document.getElementById(isPassbookViewOpen ? 'pass-search-input' : 'search-bana-input');
            if (sEl) { sEl.focus(); sEl.select(); }
            return;
        }

        if (isTyping) return;

        // 4. Inside Passbook View
        if (isPassbookViewOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightPassbookRow(passbookActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightPassbookRow(passbookActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                changePassbookPage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                changePassbookPage(-1);
            } else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                window.__banaPassAction('edit');
            } else if (e.key === 'Delete' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                window.__banaPassAction('delete');
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                window.__banaPassAction('print_single');
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                triggerSelectedBanaTransfer();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                document.getElementById('pass-from-date')?.focus();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                resetPassbookFilters();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('pass-search-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
            return;
        }

        // Guard: Prevent Enter bleed-through from Stock Summary / Gateway right after opening
        if (e.key === 'Enter' && (performance.now() - banaOpenedAt) < 200) {
            return;
        }

        // 5. Inside Main Bana Stock List
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightBanaListRow(banaListActiveIdx + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightBanaListRow(banaListActiveIdx - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            changeBanaStockPage(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeBanaStockPage(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pageRows = getBanaCurrentPageRows();
            const chosen = pageRows[banaListActiveIdx];
            if (chosen) openBanaPassbook(encodeURIComponent(chosen.name));
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            triggerSelectedBanaTransfer();
        } else if (e.key === '+') {
            e.preventDefault();
            toggleBanaForm();
        } else if (e.key === '/') {
            e.preventDefault();
            const sEl = document.getElementById('search-bana-input');
            if (sEl) { sEl.focus(); sEl.select(); }
        }
    };

    const bindBanaKeyboardEngine = () => {
        if (window.__banaKeysBound) return;
        window.__banaKeysBound = true;
        document.addEventListener('keydown', handleBanaKeydown);
    };

    /* ========================================================================
       9. A6 PAPER & THERMAL PRINTER PRINT ENGINES (UNCHANGED)
       ======================================================================== */
    const getKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printBanaStockReport = () => {
        const rows = currentBanaFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi data nahi hai!');
        }

        const kName = getKarkhanaPrintName(window.currentBanaKarkhanaFilter);
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
                <title>Bana Stock Report - A6</title>
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
                        <p><strong>BANA STOCK STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Items:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>BANA ITEM</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th><th style="text-align:right;">BACHA</th>
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

    const printBanaPassbookFiltered = () => {
        const rows = filteredPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const itemName = window.currentPassbookBanaItem || 'Bana Item';
        const kName = getKarkhanaPrintName(window.currentBanaKarkhanaFilter);
        const fDate = document.getElementById('pass-from-date')?.value || '';
        const tDate = document.getElementById('pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAaya = 0;
        let totalGaya = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const aaya = safeNum(r.aaya || r.qty);
            const gaya = safeNum(r.gaya);

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
                <title>Bana Passbook - A6</title>
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
                        <p><strong>BANA PASSBOOK STATEMENT</strong></p>
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

    const printSingleBanaPassbookEntry = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const itemName = entry.name || window.currentPassbookBanaItem || 'Bana Item';
        const kName = getKarkhanaPrintName(entry.karkhanaId || window.currentBanaKarkhanaFilter);
        const aaya = safeNum(entry.aaya || entry.qty);
        const gaya = safeNum(entry.gaya);
        const isAaya = aaya > 0;
        const wazanDisplay = isAaya ? `+${aaya.toFixed(2)} Kg` : `-${gaya.toFixed(2)} Kg`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Bana Voucher - A6</title>
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
                        <p>BANA LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${esc(entry.date || '-')}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>Item:</strong></span><span>${esc(itemName)}</span></div>
                    <div class="row"><span><strong>Type:</strong></span><span>${esc(entry.type || 'Entry')}</span></div>
                    <div class="row"><span><strong>Kariger / Party:</strong></span><span>${esc(entry.kariger || '-')}</span></div>
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
    const deleteBanaHistoryEntry = (histId) => {
        if (!confirm('Kya aap sach me ye entry DELETE karna chahte hain?\nStock balance wapas sahi settle ho jayega.')) return;

        let hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(histId));
        if (!entry) return alert('Entry nahi mili!');

        const isTransfer = (entry.refId && String(entry.refId).includes('tr_bana')) ||
                           (entry.type && entry.type.toLowerCase().includes('transfer'));
        const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

        if (isTransfer && entry.refId) {
            hist = hist.filter(x => x.refId !== entry.refId);
            const transfers = (window.safeArray ? window.safeArray(window.getStore('material_transfers')) : []).filter(t => t.id !== entry.refId);
            if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);
        } else {
            hist = hist.filter(x => String(x.id) !== String(histId));
        }

        if (typeof window.setStore === 'function') window.setStore('bana_history', hist);

        if (isPurchase) {
            const qty = safeNum(entry.aaya || entry.qty);
            const list = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
            const targetKid = entry.karkhanaId || 'k_main';

            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = Math.max(0, safeNum((safeNum(item.aaya) - qty).toFixed(2)));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                if (typeof window.setStore === 'function') window.setStore('bana_stock', list);
            }
        }

        applyPassbookFilters();
        renderBanaTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert('🗑️ Entry safalta-poorvak delete ho gayi!');
    };

    const openBanaEditModal = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const existingModal = document.getElementById('bana-edit-popup-modal');
        if (existingModal) existingModal.remove();

        const currentQty = safeNum(entry.aaya || entry.gaya || entry.qty);
        const isAaya = safeNum(entry.aaya) > 0;
        const typeLabel = isAaya ? 'Aaya (Inward)' : 'Gaya (Outward)';

        const modalHtml = `
            <div id="bana-edit-popup-modal" class="bana-modal-overlay">
                <div class="bana-modal-card" style="max-width:420px;">
                    <div class="bana-modal-head">
                        <h3>Edit Bana Entry</h3>
                        <button type="button" class="bana-tally-btn" onclick="closeBanaEditModal()">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Item:</strong> ${esc(entry.name)}</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh (Date) :</label>
                            <input type="date" id="bana-edit-date" value="${entry.date || ''}" class="bana-modal-inp">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Party / Source / Note :</label>
                            <input type="text" id="bana-edit-kariger" value="${esc(entry.kariger || '')}" class="bana-modal-inp">
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (${typeLabel} Kg) :</label>
                            <input type="number" step="0.01" id="bana-edit-qty" value="${currentQty.toFixed(2)}" class="bana-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="bana-tally-btn" onclick="closeBanaEditModal()">Cancel [Esc]</button>
                            <button type="button" class="bana-tally-btn-gold" onclick="saveBanaHistoryEdit('${esc(id)}')">Update [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const order = ['bana-edit-date', 'bana-edit-kariger', 'bana-edit-qty'];
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
                        saveBanaHistoryEdit(id);
                    }
                }
            });
        });

        setTimeout(() => {
            const kEl = document.getElementById('bana-edit-kariger');
            if (kEl) { kEl.focus(); kEl.select(); }
        }, 50);
    };

    const closeBanaEditModal = () => {
        const modal = document.getElementById('bana-edit-popup-modal');
        if (modal) modal.remove();
    };

    const saveBanaHistoryEdit = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const newDate = document.getElementById('bana-edit-date')?.value;
        const newKariger = String(document.getElementById('bana-edit-kariger')?.value || '').trim();
        const newQty = safeNum(document.getElementById('bana-edit-qty')?.value);

        if (newQty <= 0) return alert('Kripya sahi wazan (Kg) darj karein!');

        const oldAaya = safeNum(entry.aaya);
        const isTransfer = (entry.refId && String(entry.refId).includes('tr_bana')) ||
                           (entry.type && entry.type.toLowerCase().includes('transfer'));
        const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

        entry.date = newDate;
        entry.kariger = newKariger || 'Godown Purchase';

        if (oldAaya > 0) {
            const aayaDiff = newQty - oldAaya;
            entry.aaya = newQty;

            if (isPurchase) {
                const list = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
                const targetKid = entry.karkhanaId || 'k_main';

                const item = list.find((x) => {
                    const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && matchKid;
                });

                if (item) {
                    item.aaya = safeNum((safeNum(item.aaya) + aayaDiff).toFixed(2));
                    item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('bana_stock', list);
                }
            }
        } else {
            entry.gaya = newQty;
            entry.qty = newQty;
        }

        if (isTransfer && entry.refId) {
            const pair = hist.find(x => x && x.refId === entry.refId && String(x.id) !== String(id));
            if (pair) {
                pair.date = newDate;
                if (pair.aaya > 0) pair.aaya = newQty;
                if (pair.gaya > 0) pair.gaya = newQty;
            }

            const transfers = window.safeArray ? window.safeArray(window.getStore('material_transfers')) : [];
            const tr = transfers.find(t => t && t.id === entry.refId);
            if (tr) {
                tr.date = newDate;
                tr.qty = newQty;
                tr.quantity = newQty;
                if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);
            }
        }

        if (typeof window.setStore === 'function') window.setStore('bana_history', hist);

        closeBanaEditModal();
        applyPassbookFilters();
        renderBanaTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert('✅ Bana entry safalta-poorvak update ho gayi!');
    };

    /* ========================================================================
       11. GLOBAL EXPORTS
       ======================================================================== */
    const banaUIAPI = {
        openBanaModule,
        renderBanaKarkhanaTabs,
        switchBanaKarkhanaTab,
        toggleBanaForm,
        toggleBanaItemType,
        populateBanaExistingDropdown,
        saveNewBana,
        bindBanaSearchInput,
        filterBana,
        renderBanaTable,
        changeBanaStockPage,
        printBanaStockReport,
        openBanaTransferModal,
        closeBanaTransferModal,
        submitBanaTransferForm,
        openBanaPassbook,
        resetPassbookFilters,
        applyPassbookFilters,
        renderPaginatedPassbook,
        changePassbookPage,
        printBanaPassbookFiltered,
        printSingleBanaPassbookEntry,
        deleteBanaHistoryEntry,
        openBanaEditModal,
        closeBanaEditModal,
        saveBanaHistoryEdit
    };

    Object.keys(banaUIAPI).forEach((fn) => { window[fn] = banaUIAPI[fn]; });
    window.BanaUIEngine = banaUIAPI;
})();
