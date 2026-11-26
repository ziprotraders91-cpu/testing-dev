/* ============================================================================
   SIMPLICITY ERP - ZARI STOCK & PASSBOOK ENGINE (TALLYPRIME WHITE & GOLD)
   File: zari/zari-ui.js • Developed by Farhan Jawed
   (100% Supabase-Safe | PWA Confirm Modal | Transactional Locks & Rollback)
============================================================================ */

(() => {
    'use strict';

    if (window.__zariUILoaded) {
        console.warn('[ZariUI] Already loaded — skip duplicate');
        return;
    }
    window.__zariUILoaded = true;

    window.currentZariKarkhanaFilter = 'all';
    window.currentPassbookZariItem = '';

    // Transactional Save / Action Locks
    let isSavingZari = false;
    let isSavingZariEdit = false;
    let isTransferringZariUI = false;
    let isDeletingZari = false;

    // Pagination & Keyboard Cursor State - Passbook
    let zariPassbookCurrentPage = 1;
    const ZARI_PAGE_SIZE = 20;
    let filteredZariPassbookCache = [];
    let zariPassbookActiveIdx = 0;
    let isZariPassbookViewOpen = false;

    // Pagination & Keyboard Cursor State - Main Zari List
    let zariStockCurrentPage = 1;
    const ZARI_STOCK_PAGE_SIZE = 15;
    let currentZariFilteredRowsCache = [];
    let zariListActiveIdx = 0;
    let zariOpenedAt = 0;
    let searchDebounceTimer = null;

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

    const safeArr = (val) => (typeof window.safeArray === 'function' ? window.safeArray(val) : (Array.isArray(val) ? val : []));

    const getEntryAaya = (r) => {
        if (!r) return 0;
        if (r.aaya !== undefined && r.aaya !== null && r.aaya !== '') return safeNum(r.aaya);
        if (safeNum(r.gaya) > 0) return 0;
        return safeNum(r.qty);
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
       1. SCOPED TALLYPRIME WHITE & GOLD STYLES FOR #zari-section
       ======================================================================== */
    const ensureZariTallyStyles = () => {
        if (document.getElementById('zari-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'zari-tally-styles';
        style.textContent = `
            #zari-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #zari-section .module-header {
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
            #zari-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 17px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #zari-section .back-btn {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                padding: 6px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #zari-section .back-btn:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
            }
            #zari-section .add-btn {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 6px !important;
                padding: 6px 14px !important;
                font-size: 12.5px !important;
                font-weight: 800 !important;
                cursor: pointer;
            }
            #zari-section .add-btn:hover { background: #e5aa12 !important; }
            #zari-section #zari-karkhana-tabs-bar {
                padding: 12px 20px 0 20px;
                margin-bottom: 10px !important;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #zari-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #zari-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #zari-section #zari-opening-box {
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
            #zari-section #zari-opening-val {
                color: #b47d00 !important;
                font-size: 14px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #zari-section .filter-panel {
                padding: 0 20px 10px 20px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #zari-section .search-box {
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
            #zari-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #zari-section #add-zari-form {
                margin: 0 20px 14px 20px !important;
                padding: 14px 16px !important;
                background: #fdfcf7 !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 6px !important;
            }
            #zari-section .table-responsive {
                padding: 0 20px;
                box-sizing: border-box;
            }
            #zari-section table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #zari-section table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #zari-section table th {
                padding: 9px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left;
            }
            #zari-section table td {
                padding: 9px 12px !important;
                font-size: 13px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
            }
            #zari-section .zari-stock-row,
            #zari-section .zari-pass-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #zari-section .zari-stock-row:hover,
            #zari-section .zari-pass-row:hover {
                background: #fef9ea !important;
            }
            #zari-section .zari-stock-row.active,
            #zari-section .zari-pass-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #zari-section .zari-stock-row.active td,
            #zari-section .zari-pass-row.active td {
                font-weight: 700 !important;
                color: #1f2937 !important;
            }
            #zari-section .zari-tally-btn {
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
            #zari-section .zari-tally-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
            }
            #zari-section .zari-tally-btn-gold {
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
            #zari-section .zari-tally-btn-gold:hover { background: #e5aa12; }
            #zari-section .zari-status-strip {
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
            .zari-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 15px; box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .zari-modal-card {
                background: #ffffff;
                width: 100%; max-width: 460px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                color: #1f2937;
            }
            .zari-modal-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 11px 16px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .zari-modal-head h3 {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
            }
            .zari-modal-inp {
                width: 100%; box-sizing: border-box;
                padding: 7px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
            }
            .zari-modal-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            .zari-modal-btn {
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
            .zari-modal-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
            }
            .zari-modal-btn-gold {
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
            .zari-modal-btn-gold:hover { background: #e5aa12; }
            .zari-modal-btn-danger {
                background: #dc2626;
                color: #ffffff;
                border: 1px solid #b91c1c;
                border-radius: 5px;
                padding: 6px 14px;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
                white-space: nowrap;
            }
            .zari-modal-btn-danger:hover { background: #b91c1c; }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       2. VIEW TOGGLE: MAIN ZARI LIST vs INLINE PASSBOOK DRILL-DOWN
       ======================================================================== */
    const setZariSubViewMode = (showPassbook) => {
        isZariPassbookViewOpen = Boolean(showPassbook);
        const sec = document.getElementById('zari-section');
        if (!sec) return;

        const tabsBar = document.getElementById('zari-karkhana-tabs-bar');
        const openBox = document.getElementById('zari-opening-box');
        const filterPanel = sec.querySelector(':scope > .filter-panel');
        const addForm = document.getElementById('add-zari-form');
        const mainTbl = document.getElementById('zari-table-body')?.closest('.table-responsive');
        const mainPager = document.getElementById('zari-stock-pagination-controls');
        const mainStatus = document.getElementById('zari-main-status-strip');
        const passView = document.getElementById('zari-inline-passbook-view');
        const headerTitle = sec.querySelector('.module-header h2');

        const listDisp = showPassbook ? 'none' : '';
        if (tabsBar) tabsBar.style.display = showPassbook ? 'none' : 'flex';
        if (openBox) openBox.style.display = showPassbook ? 'none' : 'flex';
        if (filterPanel) filterPanel.style.display = showPassbook ? 'none' : 'flex';
        if (addForm && showPassbook) addForm.style.display = 'none';
        if (mainTbl) mainTbl.style.display = listDisp;
        if (mainPager) mainPager.style.display = showPassbook ? 'none' : (currentZariFilteredRowsCache.length ? 'flex' : 'none');
        if (mainStatus) mainStatus.style.display = showPassbook ? 'none' : 'flex';
        if (passView) passView.style.display = showPassbook ? 'block' : 'none';

        if (headerTitle) {
            headerTitle.textContent = showPassbook
                ? `Zari Passbook: ${window.currentPassbookZariItem || ''}`
                : 'Zari Stock';
        }
    };

    const closeZariPassbookToList = () => {
        setZariSubViewMode(false);
        renderZariTable();
    };

    const handleZariExitAction = () => {
        if (isZariPassbookViewOpen) {
            closeZariPassbookToList();
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
    const openZariModule = () => {
        zariOpenedAt = performance.now();
        ensureZariTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('zari-section', 'block');

        setZariSubViewMode(false);
        zariListActiveIdx = 0;

        renderZariKarkhanaTabs();
        populateZariExistingDropdown();
        renderZariTable();
        bindZariSearchInput();
        bindZariKeyboardEngine();
    };

    const renderZariKarkhanaTabs = () => {
        const bar = document.getElementById('zari-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = safeArr(window.getStore?.('karkhana_list'));
        }
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }

        const isAllActive = (window.currentZariKarkhanaFilter === 'all') ? ' active' : '';
        let html = `<button type="button" class="sheet-tab${isAllActive}" onclick="switchZariKarkhanaTab('all')">Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isActive = (String(window.currentZariKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchZariKarkhanaTab('${esc(k.id)}')">${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchZariKarkhanaTab = (kId) => {
        window.currentZariKarkhanaFilter = kId || 'all';
        zariStockCurrentPage = 1;
        zariListActiveIdx = 0;
        renderZariKarkhanaTabs();
        populateZariExistingDropdown();
        renderZariTable();
    };

    const cycleZariKarkhanaTab = () => {
        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = safeArr(window.getStore?.('karkhana_list'));
        }
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];

        const ids = ['all', ...karkhanas.map(k => String(k.id))];
        const curIdx = ids.indexOf(String(window.currentZariKarkhanaFilter));
        const nextId = ids[(curIdx + 1) % ids.length];
        switchZariKarkhanaTab(nextId);
    };

    /* ========================================================================
       4. INWARD PURCHASE ENGINE (100% SUPABASE SAFE + LOCK & ROLLBACK)
       ======================================================================== */
    const toggleZariForm = () => {
        if (isZariPassbookViewOpen) setZariSubViewMode(false);
        const f = document.getElementById('add-zari-form');
        if (!f) return;
        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('zari-date');
            if (dInp) dInp.value = getToday();
            populateZariExistingDropdown();

            const sel = document.getElementById('zari-select-existing');
            const rNew = document.getElementById('zari-type-new');
            if (sel && sel.options.length === 0 && rNew) {
                rNew.checked = true;
            }

            toggleZariItemType();
            setTimeout(() => {
                const isNew = document.getElementById('zari-type-new')?.checked;
                const target = document.getElementById(isNew ? 'zari-new-name' : 'zari-select-existing');
                if (target) target.focus();
            }, 40);
        }
    };

    const toggleZariItemType = () => {
        const isNew = document.getElementById('zari-type-new')
            ? document.getElementById('zari-type-new').checked
            : true;
        setDisplay('zari-existing-group', isNew ? 'none' : 'block');
        setDisplay('zari-new-group', isNew ? 'block' : 'none');
    };

    const populateZariExistingDropdown = () => {
        const sel = document.getElementById('zari-select-existing');
        if (!sel) return;
        sel.innerHTML = '';
        const list = safeArr(window.getStore?.('zari_stock'));
        const unique = [];

        list.forEach((z) => {
            const n = z?.name ? z.name.trim() : '';
            if (n && unique.indexOf(n.toLowerCase()) === -1) {
                unique.push(n.toLowerCase());
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                sel.appendChild(opt);
            }
        });
    };

    const saveNewZari = () => {
        if (isSavingZari) return;
        isSavingZari = true;

        try {
            const isNew = document.getElementById('zari-type-new')
                ? document.getElementById('zari-type-new').checked
                : true;

            const nameInp = isNew ? document.getElementById('zari-new-name') : document.getElementById('zari-select-existing');
            const name = String(nameInp?.value || '').trim();

            const date = document.getElementById('zari-date')?.value || getToday();
            const qtyInp = document.getElementById('zari-aaya');
            const qty = safeNum(qtyInp?.value);

            if (!name) return alert('Zari Item ka naam zaroori hai!');
            if (qty <= 0) return alert('Wazan (Qty) daalein!');

            const roundedQty = Number(qty.toFixed(2));
            const targetKid = (window.currentZariKarkhanaFilter !== 'all') ? window.currentZariKarkhanaFilter : 'k_main';

            const snapStock = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_stock'))));
            const snapHist = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_history'))));

            try {
                const list = safeArr(window.getStore?.('zari_stock'));
                const nowTs = Date.now();
                const uidSuffix = Math.random().toString(36).slice(2, 6);

                const item = list.find((x) => {
                    const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    return x?.name && x.name.trim().toLowerCase() === name.toLowerCase() && matchKid;
                });

                if (item) {
                    item.aaya = safeNum((safeNum(item.aaya) + roundedQty).toFixed(2));
                    item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                    item.date = date;
                } else {
                    list.push({
                        id: `zari_${nowTs}_${uidSuffix}`,
                        date,
                        name,
                        aaya: roundedQty,
                        gaya: 0,
                        bacha: roundedQty,
                        karkhanaId: targetKid,
                        timestamp: nowTs
                    });
                }
                if (typeof window.setStore === 'function') window.setStore('zari_stock', list);

                const hist = safeArr(window.getStore?.('zari_history'));
                hist.push({
                    id: `zhist_${nowTs}_${uidSuffix}`,
                    date,
                    name,
                    kariger: 'Godown Purchase',
                    type: 'Khareed (Inward)',
                    aaya: roundedQty,
                    gaya: 0,
                    karkhanaId: targetKid,
                    timestamp: nowTs
                });
                if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

                const newNameEl = document.getElementById('zari-new-name');
                if (newNameEl) newNameEl.value = '';
                if (qtyInp) qtyInp.value = '';

                toggleZariForm();
                populateZariExistingDropdown();
                renderZariTable();

                if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
                alert(`✅ ${roundedQty.toFixed(2)} Kg Zari Stock me jama ho gayi!`);
            } catch (err) {
                console.error('[ZariSave]', err);
                try {
                    if (typeof window.setStore === 'function') {
                        window.setStore('zari_stock', snapStock);
                        window.setStore('zari_history', snapHist);
                    }
                } catch (rbErr) {
                    console.error('[ZariSave Rollback]', rbErr);
                }
                alert('❌ Save fail ho gaya — purana stock surakshit hai!');
            }
        } finally {
            isSavingZari = false;
        }
    };

    const bindZariSearchInput = () => {
        const searchInp = document.getElementById('search-zari-input');
        if (searchInp && !searchInp.dataset.bound) {
            searchInp.dataset.bound = 'true';
            searchInp.addEventListener('input', () => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    zariStockCurrentPage = 1;
                    zariListActiveIdx = 0;
                    renderZariTable();
                }, 100);
            });
            searchInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchDebounceTimer);
                    renderZariTable();
                    searchInp.blur();
                    if (e.key === 'Enter' && currentZariFilteredRowsCache.length > 0) {
                        const pageRows = getZariCurrentPageRows();
                        const chosen = pageRows[zariListActiveIdx] || pageRows[0];
                        if (chosen) openZariPassbook(encodeURIComponent(chosen.name));
                    }
                }
            });
        }
    };

    const filterZari = () => {
        zariStockCurrentPage = 1;
        zariListActiveIdx = 0;
        renderZariTable();
    };

    const getZariCurrentPageRows = () => {
        const startIndex = (zariStockCurrentPage - 1) * ZARI_STOCK_PAGE_SIZE;
        return currentZariFilteredRowsCache.slice(startIndex, startIndex + ZARI_STOCK_PAGE_SIZE);
    };

    const highlightZariListRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#zari-table-body .zari-stock-row'));
        if (!rows.length) return;
        zariListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === zariListActiveIdx));
        rows[zariListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    /* ========================================================================
       5. MAIN ZARI TABLE RENDERER (CLEAN WHITE & GOLD + KEYBOARD CURSOR)
       ======================================================================== */
    const renderZariTable = () => {
        ensureZariTallyStyles();
        bindZariSearchInput();

        const tbody = document.getElementById('zari-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        let rows = [];
        if (typeof window.getAllZariStats === 'function') {
            rows = window.getAllZariStats(window.currentZariKarkhanaFilter);
        } else {
            const rawStock = safeArr(window.getStore?.('zari_stock'));
            const uniqueNames = [];

            rawStock.forEach((z) => {
                if (!z || !z.name) return;
                const n = z.name.trim();
                if (uniqueNames.map(x => x.toLowerCase()).indexOf(n.toLowerCase()) === -1) {
                    uniqueNames.push(n);
                }
            });

            uniqueNames.forEach((name) => {
                if (typeof window.getZariItemStats === 'function') {
                    const stats = window.getZariItemStats(name, window.currentZariKarkhanaFilter);
                    if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                        rows.push(stats);
                    }
                }
            });
        }

        const searchInp = document.getElementById('search-zari-input');
        const txt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        const filteredRows = txt
            ? rows.filter(r => `${r.name || ''} ${r.date || ''} ${r.aaya || ''} ${r.gaya || ''} ${r.bacha || ''}`.toLowerCase().includes(txt))
            : rows;

        currentZariFilteredRowsCache = filteredRows;

        // Clean White & Gold Toolbar Buttons (Transfer + A6 Print) next to Search
        if (searchInp && searchInp.parentElement) {
            if (!document.getElementById('zari-stock-transfer-btn')) {
                const trBtn = document.createElement('button');
                trBtn.id = 'zari-stock-transfer-btn';
                trBtn.type = 'button';
                trBtn.className = 'zari-tally-btn';
                trBtn.innerHTML = 'Bhejo / Transfer [T]';
                trBtn.onclick = () => triggerSelectedZariTransfer();
                searchInp.parentElement.appendChild(trBtn);
            }
            if (!document.getElementById('zari-stock-print-btn')) {
                const printBtn = document.createElement('button');
                printBtn.id = 'zari-stock-print-btn';
                printBtn.type = 'button';
                printBtn.className = 'zari-tally-btn';
                printBtn.innerHTML = 'A6 Print [Alt+P]';
                printBtn.onclick = () => printZariStockReport();
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
        const sec = document.getElementById('zari-section');
        let pager = document.getElementById('zari-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'zari-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;';
                tbl.insertAdjacentElement('afterend', pager);
            }
        }

        if (sec && !document.getElementById('zari-main-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'zari-main-status-strip';
            strip.className = 'zari-status-strip';
            strip.innerHTML = `
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Item Chunein · [Enter / Click] Passbook · [T / F4] Transfer · [F7] + Nayi Zari · [F2] Godam · [/] Search · [Esc] Back</span>
                <span id="zari-main-count-lbl">0 Items</span>
            `;
            sec.appendChild(strip);
        }

        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:22px; color:#6b7280;'>Koi Zari Stock nahi mila.</td></tr>";
            if (pager) {
                pager.innerHTML = '';
                pager.style.display = 'none';
            }
        } else {
            const totalPages = Math.ceil(totalEntries / ZARI_STOCK_PAGE_SIZE) || 1;
            if (zariStockCurrentPage > totalPages) zariStockCurrentPage = totalPages;
            if (zariStockCurrentPage < 1) zariStockCurrentPage = 1;

            const startIndex = (zariStockCurrentPage - 1) * ZARI_STOCK_PAGE_SIZE;
            const pageRows = filteredRows.slice(startIndex, startIndex + ZARI_STOCK_PAGE_SIZE);
            if (zariListActiveIdx >= pageRows.length) zariListActiveIdx = 0;
            if (zariListActiveIdx < 0) zariListActiveIdx = 0;

            let html = '';
            pageRows.forEach((z, idx) => {
                const bacha = safeNum(z.bacha);
                const safeName = encodeURIComponent(z.name);
                const activeCls = (idx === zariListActiveIdx) ? ' active' : '';

                html += `<tr class="zari-stock-row${activeCls}" data-zidx="${idx}" onclick="window.__zariSelectAndOpen(${idx}, '${safeName}')">
                    <td>${esc(z.date || '-')}</td>
                    <td><strong>${esc(z.name)}</strong></td>
                    <td style="font-weight:700;">+${safeNum(z.aaya).toFixed(2)} Kg</td>
                    <td style="font-weight:700; color:#6b7280;">-${safeNum(z.gaya).toFixed(2)} Kg</td>
                    <td style="font-weight:800; color:#b47d00;">${bacha.toFixed(2)} Kg</td>
                    <td style="text-align:right; font-weight:700; font-size:12px;">Passbook →</td>
                </tr>`;
            });
            tbody.innerHTML = html;

            if (pager) {
                pager.style.display = isZariPassbookViewOpen ? 'none' : 'flex';
                pager.innerHTML = `
                    <div style="font-size:12px; color:#6b7280; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + ZARI_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="zari-tally-btn" ${zariStockCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeZariStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${zariStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="zari-tally-btn" ${zariStockCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeZariStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const opBox = document.getElementById('zari-opening-box');
        const opVal = document.getElementById('zari-opening-val');
        if (opVal) opVal.textContent = `Kul Bachi: ${totalBacha.toFixed(2)} Kg`;
        if (opBox) {
            let extra = document.getElementById('zari-summary-meta');
            if (!extra) {
                extra = document.createElement('div');
                extra.id = 'zari-summary-meta';
                extra.style.cssText = 'font-size:12px; color:#6b7280; font-weight:700;';
                opBox.appendChild(extra);
            }
            extra.textContent = `Total Aayi: +${totalAaya.toFixed(2)} Kg · Total Gayi: -${totalGaya.toFixed(2)} Kg`;
        }

        const cntLbl = document.getElementById('zari-main-count-lbl');
        if (cntLbl) cntLbl.textContent = `${totalEntries} Items`;
    };

    window.__zariSelectAndOpen = (idx, safeName) => {
        highlightZariListRow(idx);
        openZariPassbook(safeName);
    };

    const triggerSelectedZariTransfer = () => {
        if (isZariPassbookViewOpen && window.currentPassbookZariItem) {
            const stats = (typeof window.getZariItemStats === 'function')
                ? window.getZariItemStats(window.currentPassbookZariItem, window.currentZariKarkhanaFilter)
                : { bacha: 0 };
            if (safeNum(stats.bacha) <= 0) return alert('Is item me transfer ke liye koi Zari nahi bachi hai.');
            openZariTransferModal(encodeURIComponent(window.currentPassbookZariItem), safeNum(stats.bacha));
            return;
        }

        const pageRows = getZariCurrentPageRows();
        const chosen = pageRows[zariListActiveIdx];
        if (!chosen) return alert('Pehle koi Zari item chunein!');
        if (safeNum(chosen.bacha) <= 0) return alert(`[${chosen.name}] me transfer ke liye koi Zari nahi bachi hai.`);
        openZariTransferModal(encodeURIComponent(chosen.name), safeNum(chosen.bacha));
    };

    const changeZariStockPage = (delta) => {
        zariStockCurrentPage += delta;
        zariListActiveIdx = 0;
        renderZariTable();
    };

    /* ========================================================================
       6. INTER-GODOWN TRANSFER POPUP (TALLY WHITE & GOLD + ENTER CHAINING)
       ======================================================================== */
    const openZariTransferModal = (safeName, availableBacha) => {
        const itemName = decodeURIComponent(safeName);

        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : safeArr(window.getStore?.('karkhana_list'));

        const currentKid = (window.currentZariKarkhanaFilter !== 'all') ? window.currentZariKarkhanaFilter : 'k_main';
        const currentGodamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(currentKid)
            : currentKid;

        let godownOptions = '';
        karkhanas.forEach((k) => {
            if (String(k.id) !== String(currentKid)) {
                godownOptions += `<option value="${esc(k.id)}">${esc(k.name)}</option>`;
            }
        });

        if (!godownOptions) {
            return alert('Transfer ke liye kam se kam 2 Godam (Karkhana) hone chahiye!');
        }

        const existingModal = document.getElementById('zari-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        const today = getToday();

        const modalHtml = `
            <div id="zari-transfer-popup-modal" class="zari-modal-overlay">
                <div class="zari-modal-card">
                    <div class="zari-modal-head">
                        <h3>Zari Stock Transfer</h3>
                        <button type="button" id="zari-tr-close-btn" class="zari-modal-btn">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:6px; padding:10px 12px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Zari Item:</strong> ${esc(itemName)}</div>
                            <div><strong>Bhejne Wala Godam:</strong> ${esc(currentGodamName)}</div>
                            <div style="color:#b47d00; font-weight:800; font-size:13.5px; margin-top:4px;">Available Stock: ${availableBacha.toFixed(2)} Kg</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Destination Godam :</label>
                            <select id="zari-dest-godam" class="zari-modal-inp">${godownOptions}</select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="zari-transfer-qty" max="${availableBacha}" min="0.01" value="${availableBacha}" class="zari-modal-inp">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh :</label>
                                <input type="date" id="zari-transfer-date" value="${today}" class="zari-modal-inp">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Note / Parchi No. (Optional) :</label>
                            <input type="text" id="zari-transfer-note" placeholder="e.g. Mubarakpur unit ke liye bheja" class="zari-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" id="zari-tr-cancel-btn" class="zari-modal-btn">Cancel [Esc]</button>
                            <button type="button" id="zari-tr-submit-btn" class="zari-modal-btn-gold">Transfer Confirm [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('zari-tr-close-btn')?.addEventListener('click', closeZariTransferModal);
        document.getElementById('zari-tr-cancel-btn')?.addEventListener('click', closeZariTransferModal);
        document.getElementById('zari-tr-submit-btn')?.addEventListener('click', () => {
            submitZariTransferForm(safeName, currentKid, availableBacha);
        });

        const order = ['zari-dest-godam', 'zari-transfer-qty', 'zari-transfer-date', 'zari-transfer-note'];
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
                        submitZariTransferForm(safeName, currentKid, availableBacha);
                    }
                }
            });
        });

        setTimeout(() => {
            const qtyEl = document.getElementById('zari-transfer-qty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
        }, 50);
    };

    const closeZariTransferModal = () => {
        const modal = document.getElementById('zari-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const submitZariTransferForm = (safeName, fromKid, maxAvailable) => {
        if (isTransferringZariUI) return alert('⏳ Transfer pehle se chal raha hai!');

        const itemName = decodeURIComponent(safeName);
        const toKid = document.getElementById('zari-dest-godam')?.value;
        const qty = safeNum(document.getElementById('zari-transfer-qty')?.value);
        const d = document.getElementById('zari-transfer-date')?.value || getToday();
        const note = String(document.getElementById('zari-transfer-note')?.value || '').trim();

        if (!toKid) return alert('Kripya Paane wala Godam chunein!');
        if (qty <= 0) return alert('Kripya sahi wazan (Kg) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable.toFixed(2)} Kg bachi hai!`);

        isTransferringZariUI = true;
        try {
            let result = false;
            if (typeof window.transferZariStock === 'function') {
                result = window.transferZariStock(d, itemName, fromKid, toKid, qty, note);
            }

            const isSuccess = (typeof result === 'object' && result !== null) ? Boolean(result.success) : Boolean(result);
            const customMsg = (typeof result === 'object' && result !== null && result.message) ? result.message : '';

            if (isSuccess) {
                closeZariTransferModal();
                if (isZariPassbookViewOpen) {
                    applyZariPassbookFilters();
                } else {
                    renderZariTable();
                }
                if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
                alert(customMsg || `✅ ${qty.toFixed(2)} Kg Zari safalta-poorvak transfer ho gayi!`);
            } else if (customMsg) {
                alert(customMsg);
            }
        } catch (err) {
            console.error('[ZariTransfer UI]', err);
            alert('❌ Transfer fail ho gaya: ' + (err?.message || err));
        } finally {
            isTransferringZariUI = false;
        }
    };

    /* ========================================================================
       7. INLINE TALLY ZARI PASSBOOK ENGINE (WITH RUNNING CLOSING BALANCE)
       ======================================================================== */
    const ensureInlineZariPassbookContainer = () => {
        const sec = document.getElementById('zari-section');
        if (!sec) return null;

        let container = document.getElementById('zari-inline-passbook-view');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'zari-inline-passbook-view';
        container.style.display = 'none';
        container.innerHTML = `
            <div style="margin:12px 20px 10px 20px; padding:10px 14px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="zari-tally-btn" onclick="window.__closeZariPassbookView()">&larr; [Esc] Zari List</button>
                    <strong id="zari-pass-summary-title" style="font-size:14px; color:#1f2937;">Item: -</strong>
                    <span id="zari-pass-summary-totals" style="font-size:12px; color:#b47d00; font-weight:800;"></span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="zari-tally-btn" onclick="window.__zariPassAction('edit')">Edit [Enter]</button>
                    <button type="button" class="zari-tally-btn" onclick="window.__zariPassAction('delete')">Delete [Del]</button>
                    <button type="button" class="zari-tally-btn" onclick="window.__zariPassAction('print_single')">Slip [P]</button>
                    <button type="button" class="zari-tally-btn" onclick="window.__zariTransferFromPass()">Bhejo [T]</button>
                    <button type="button" class="zari-tally-btn-gold" onclick="printZariPassbookFiltered()">A6 Print [Alt+P]</button>
                </div>
            </div>

            <div style="padding:0 20px 10px 20px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">From Date [F]:</label>
                    <input type="date" id="zari-pass-from-date" onchange="applyZariPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">To Date:</label>
                    <input type="date" id="zari-pass-to-date" onchange="applyZariPassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">Search [/]:</label>
                    <input type="text" id="zari-pass-search-input" class="search-box" placeholder="Search Date, Kariger, Type..." oninput="applyZariPassbookFilters()">
                </div>
                <button type="button" class="zari-tally-btn" onclick="resetZariPassbookFilters()">Reset [R]</button>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Tarikh</th>
                            <th>Particulars (Kariger / Source)</th>
                            <th>Detail (Vch Type)</th>
                            <th style="text-align:right;">Aayi (In)</th>
                            <th style="text-align:right;">Gayi (Out)</th>
                            <th style="text-align:right;">Closing Bal</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="zari-passbook-table-body"></tbody>
                </table>
            </div>

            <div id="zari-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;"></div>

            <div class="zari-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Entry Chunein · [Enter/E] Edit · [Del] Delete · [P] Single Slip · [Alt+P] Statement · [Esc] Zari List</span>
                <span id="zari-passbook-entry-status">-</span>
            </div>
        `;

        const mainStrip = document.getElementById('zari-main-status-strip');
        if (mainStrip) {
            sec.insertBefore(container, mainStrip);
        } else {
            sec.appendChild(container);
        }

        const fInp = document.getElementById('zari-pass-from-date');
        const tInp = document.getElementById('zari-pass-to-date');
        const sInp = document.getElementById('zari-pass-search-input');
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

    window.__closeZariPassbookView = closeZariPassbookToList;
    window.__zariTransferFromPass = triggerSelectedZariTransfer;

    window.__zariPassAction = (action) => {
        const startIndex = (zariPassbookCurrentPage - 1) * ZARI_PAGE_SIZE;
        const pageRows = filteredZariPassbookCache.slice(startIndex, startIndex + ZARI_PAGE_SIZE);
        const entry = pageRows[zariPassbookActiveIdx];
        if (!entry) return alert('Pehle koi entry chunein!');

        if (action === 'print_single') {
            printSingleZariPassbookEntry(entry.id);
            return;
        }

        const isOpeningEntry = entry.isOpening || (entry.type && entry.type.toLowerCase().includes('opening'));
        const isKarigerEntry = (entry.type && entry.type.toLowerCase().includes('kariger')) ||
                               (entry.kariger && entry.kariger.toLowerCase().includes('kariger sheet'));

        if (isOpeningEntry || isKarigerEntry) {
            return alert('Ye entry locked hai (Kariger Sheet / Opening Balance). Isko wahan se edit karein.');
        }

        if (action === 'edit') openZariEditModal(entry.id);
        else if (action === 'delete') deleteZariHistoryEntry(entry.id);
    };

    const openZariPassbook = (safeName) => {
        ensureZariTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('zari-section', 'block');

        window.currentPassbookZariItem = decodeURIComponent(safeName);
        zariPassbookCurrentPage = 1;
        zariPassbookActiveIdx = 0;

        ensureInlineZariPassbookContainer();
        setZariSubViewMode(true);
        bindZariKeyboardEngine();
        applyZariPassbookFilters();
    };

    const resetZariPassbookFilters = () => {
        const fDate = document.getElementById('zari-pass-from-date');
        const tDate = document.getElementById('zari-pass-to-date');
        const sInp = document.getElementById('zari-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        zariPassbookCurrentPage = 1;
        zariPassbookActiveIdx = 0;
        applyZariPassbookFilters();
    };

    const applyZariPassbookFilters = () => {
        const targetItemLower = window.currentPassbookZariItem.trim().toLowerCase();
        const allHist = safeArr(window.getStore?.('zari_history'));

        const itemHist = allHist.filter((x) => {
            if (!x?.name) return false;
            if (x.name.trim().toLowerCase() !== targetItemLower) return false;

            if (window.currentZariKarkhanaFilter !== 'all') {
                const rowKid = x.karkhanaId || 'k_main';
                return String(rowKid) === String(window.currentZariKarkhanaFilter);
            }
            return true;
        });

        // Compute Running Closing Balance chronologically (Date first, Timestamp tie-breaker)
        const chrono = itemHist.slice().sort((a, b) => {
            const dCmp = String(a.date || '').localeCompare(String(b.date || ''));
            if (dCmp !== 0) return dCmp;
            return (a.timestamp || 0) - (b.timestamp || 0);
        });

        let runningBal = 0;
        const withRunning = chrono.map((r) => {
            const aayaQty = getEntryAaya(r);
            const gayaQty = safeNum(r.gaya);
            runningBal = safeNum((runningBal + aayaQty - gayaQty).toFixed(2));
            return { ...r, _runningBal: runningBal };
        });

        const fDate = document.getElementById('zari-pass-from-date')?.value || '';
        const tDate = document.getElementById('zari-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('zari-pass-search-input')?.value || '').toLowerCase().trim();

        let filtered = withRunning;
        if (fDate) filtered = filtered.filter(x => (x.date || '') >= fDate);
        if (tDate) filtered = filtered.filter(x => (x.date || '') <= tDate);

        if (sTxt) {
            filtered = filtered.filter((x) => {
                const aayaStr = getEntryAaya(x);
                const rowString = `${x.date || ''} ${x.type || ''} ${x.kariger || ''} ${aayaStr || ''} ${x.gaya || ''}`.toLowerCase();
                return rowString.includes(sTxt);
            });
        }

        // Exact reverse chronological order (newest first)
        filtered.reverse();

        filteredZariPassbookCache = filtered;

        const stats = (typeof window.getZariItemStats === 'function')
            ? window.getZariItemStats(window.currentPassbookZariItem, window.currentZariKarkhanaFilter)
            : { aaya: 0, gaya: 0, bacha: runningBal };
        const godamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(window.currentZariKarkhanaFilter)
            : 'Sabhi Karkhane';

        const titleEl = document.getElementById('zari-pass-summary-title');
        const totEl = document.getElementById('zari-pass-summary-totals');
        if (titleEl) titleEl.textContent = `${window.currentPassbookZariItem} (${godamName})`;
        if (totEl) {
            totEl.textContent = `Aayi: +${safeNum(stats.aaya).toFixed(2)} Kg · Gayi: -${safeNum(stats.gaya).toFixed(2)} Kg · Closing: ${safeNum(stats.bacha).toFixed(2)} Kg`;
        }

        renderPaginatedZariPassbook();
    };

    const highlightZariPassbookRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#zari-passbook-table-body .zari-pass-row'));
        if (!rows.length) return;
        zariPassbookActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === zariPassbookActiveIdx));
        rows[zariPassbookActiveIdx]?.scrollIntoView({ block: 'nearest' });

        const startIndex = (zariPassbookCurrentPage - 1) * ZARI_PAGE_SIZE;
        const pageRows = filteredZariPassbookCache.slice(startIndex, startIndex + ZARI_PAGE_SIZE);
        const entry = pageRows[zariPassbookActiveIdx];
        const statusEl = document.getElementById('zari-passbook-entry-status');
        if (statusEl && entry) {
            const isLocked = entry.isOpening ||
                (entry.type && (entry.type.toLowerCase().includes('opening') || entry.type.toLowerCase().includes('kariger'))) ||
                (entry.kariger && entry.kariger.toLowerCase().includes('kariger sheet'));
            statusEl.textContent = isLocked ? 'Locked Entry (Kariger Sheet / Opening)' : 'Editable Entry [Enter / Del]';
        }
    };

    const renderPaginatedZariPassbook = () => {
        const tbody = document.getElementById('zari-passbook-table-body');
        const pager = document.getElementById('zari-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredZariPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:18px; color:#6b7280;'>Koi passbook entry nahi mili.</td></tr>";
            if (pager) {
                pager.innerHTML = '';
                pager.style.display = 'none';
            }
            const statusEl = document.getElementById('zari-passbook-entry-status');
            if (statusEl) statusEl.textContent = '0 Entries';
            return;
        }

        const totalPages = Math.ceil(totalEntries / ZARI_PAGE_SIZE);
        if (zariPassbookCurrentPage > totalPages) zariPassbookCurrentPage = totalPages;
        if (zariPassbookCurrentPage < 1) zariPassbookCurrentPage = 1;

        const startIndex = (zariPassbookCurrentPage - 1) * ZARI_PAGE_SIZE;
        const pageRows = filteredZariPassbookCache.slice(startIndex, startIndex + ZARI_PAGE_SIZE);
        if (zariPassbookActiveIdx >= pageRows.length) zariPassbookActiveIdx = 0;
        if (zariPassbookActiveIdx < 0) zariPassbookActiveIdx = 0;

        let html = '';
        pageRows.forEach((r, idx) => {
            const aayaQty = getEntryAaya(r);
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

            const activeCls = (idx === zariPassbookActiveIdx) ? ' active' : '';

            html += `<tr class="zari-pass-row${activeCls}" data-pidx="${idx}" onclick="window.__zariSelectPassRow(${idx})">
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
        highlightZariPassbookRow(zariPassbookActiveIdx);

        if (pager) {
            pager.style.display = 'flex';
            pager.innerHTML = `
                <div style="font-size:12px; color:#6b7280; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + ZARI_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="zari-tally-btn" ${zariPassbookCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeZariPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${zariPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="zari-tally-btn" ${zariPassbookCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeZariPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    window.__zariSelectPassRow = (idx) => {
        highlightZariPassbookRow(idx);
    };

    const changeZariPassbookPage = (delta) => {
        zariPassbookCurrentPage += delta;
        zariPassbookActiveIdx = 0;
        renderPaginatedZariPassbook();
    };

    /* ========================================================================
       8. KEYBOARD NAVIGATION ENGINE FOR #zari-section (ZERO CONFLICTS)
       ======================================================================== */
    const handleZariKeydown = (e) => {
        const sec = document.getElementById('zari-section');
        if (!sec || sec.style.display === 'none') return;
        if (isAnyExpressOverlayOpen()) return;

        // 0. Delete Confirm Modal open
        const delModal = document.getElementById('zari-delete-confirm-modal');
        if (delModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeZariDeleteConfirmModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('zari-del-confirm-btn')?.click();
            }
            return;
        }

        // 1. Edit Modal open
        const editModal = document.getElementById('zari-edit-popup-modal');
        if (editModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeZariEditModal();
            }
            return;
        }

        // 2. Transfer Modal open
        const trModal = document.getElementById('zari-transfer-popup-modal');
        if (trModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeZariTransferModal();
            }
            return;
        }

        // 3. Add Zari Form open
        const addForm = document.getElementById('add-zari-form');
        if (addForm && addForm.style.display === 'block') {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleZariForm();
                return;
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const rNew = document.getElementById('zari-type-new');
                const rExt = document.getElementById('zari-type-existing');
                if (rNew && rExt) {
                    if (rNew.checked) rExt.checked = true;
                    else rNew.checked = true;
                    toggleZariItemType();
                    const focusId = rNew.checked ? 'zari-new-name' : 'zari-select-existing';
                    document.getElementById(focusId)?.focus();
                }
                return;
            }
            if (e.key === 'Enter') {
                const activeId = document.activeElement?.id || '';
                const isNew = document.getElementById('zari-type-new')?.checked;
                const itemFieldId = isNew ? 'zari-new-name' : 'zari-select-existing';
                if (activeId === 'zari-date') {
                    e.preventDefault();
                    document.getElementById(itemFieldId)?.focus();
                } else if (activeId === itemFieldId) {
                    e.preventDefault();
                    document.getElementById('zari-aaya')?.focus();
                } else if (activeId === 'zari-aaya') {
                    e.preventDefault();
                    saveNewZari();
                }
            }
            return;
        }

        // Never block native browser shortcuts like Ctrl+R, Ctrl+T, Ctrl+F, Cmd+R
        if (e.ctrlKey || e.metaKey) return;

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            handleZariExitAction();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            if (isZariPassbookViewOpen) printZariPassbookFiltered();
            else printZariStockReport();
            return;
        }

        if (e.altKey) return;

        if (e.key === 'F4') {
            e.preventDefault();
            triggerSelectedZariTransfer();
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            toggleZariForm();
            return;
        }

        if (e.key === 'F2' && !isZariPassbookViewOpen) {
            e.preventDefault();
            cycleZariKarkhanaTab();
            return;
        }

        if (e.key === 'F3') {
            e.preventDefault();
            const sEl = document.getElementById(isZariPassbookViewOpen ? 'zari-pass-search-input' : 'search-zari-input');
            if (sEl) { sEl.focus(); sEl.select(); }
            return;
        }

        if (isTyping) return;

        // 4. Inside Passbook View
        if (isZariPassbookViewOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightZariPassbookRow(zariPassbookActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightZariPassbookRow(zariPassbookActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                changeZariPassbookPage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                changeZariPassbookPage(-1);
            } else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                window.__zariPassAction('edit');
            } else if (e.key === 'Delete' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                window.__zariPassAction('delete');
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                window.__zariPassAction('print_single');
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                triggerSelectedZariTransfer();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                document.getElementById('zari-pass-from-date')?.focus();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                resetZariPassbookFilters();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('zari-pass-search-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
            return;
        }

        // Guard: Prevent Enter bleed-through from Stock Summary / Gateway right after opening
        if (e.key === 'Enter' && (performance.now() - zariOpenedAt) < 200) {
            return;
        }

        // 5. Inside Main Zari Stock List
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightZariListRow(zariListActiveIdx + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightZariListRow(zariListActiveIdx - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            changeZariStockPage(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeZariStockPage(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pageRows = getZariCurrentPageRows();
            const chosen = pageRows[zariListActiveIdx];
            if (chosen) openZariPassbook(encodeURIComponent(chosen.name));
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            triggerSelectedZariTransfer();
        } else if (e.key === '+') {
            e.preventDefault();
            toggleZariForm();
        } else if (e.key === '/') {
            e.preventDefault();
            const sEl = document.getElementById('search-zari-input');
            if (sEl) { sEl.focus(); sEl.select(); }
        }
    };

    const bindZariKeyboardEngine = () => {
        if (window.__zariKeysBound) return;
        window.__zariKeysBound = true;
        document.addEventListener('keydown', handleZariKeydown);
    };

    /* ========================================================================
       9. A6 PAPER & THERMAL PRINTER PRINT ENGINES
       ======================================================================== */
    const getZariKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printZariStockReport = () => {
        const rows = currentZariFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi data nahi hai!');
        }

        const kName = getZariKarkhanaPrintName(window.currentZariKarkhanaFilter);
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
                <title>Zari Stock Report - A6</title>
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
                        <p><strong>ZARI STOCK STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Items:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>ZARI ITEM</th><th style="text-align:right;">AAYI</th><th style="text-align:right;">GAYI</th><th style="text-align:right;">BACHI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aayi:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gayi:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI STOCK:</span> <span>${totalBacha.toFixed(2)} Kg</span>
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

    const printZariPassbookFiltered = () => {
        const rows = filteredZariPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const itemName = window.currentPassbookZariItem || 'Zari Item';
        const kName = getZariKarkhanaPrintName(window.currentZariKarkhanaFilter);
        const fDate = document.getElementById('zari-pass-from-date')?.value || '';
        const tDate = document.getElementById('zari-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAaya = 0;
        let totalGaya = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const aaya = getEntryAaya(r);
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
                <title>Zari Passbook - A6</title>
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
                        <p><strong>ZARI PASSBOOK STATEMENT</strong></p>
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
                                <th>TARIKH</th><th>SOURCE / PARTY</th><th style="text-align:right;">AAYI</th><th style="text-align:right;">GAYI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aayi:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gayi:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
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

    const printSingleZariPassbookEntry = (id) => {
        const hist = safeArr(window.getStore?.('zari_history'));
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const itemName = entry.name || window.currentPassbookZariItem || 'Zari Item';
        const kName = getZariKarkhanaPrintName(entry.karkhanaId || window.currentZariKarkhanaFilter);
        const aaya = getEntryAaya(entry);
        const gaya = safeNum(entry.gaya);
        const isAaya = aaya > 0;
        const wazanDisplay = isAaya ? `+${aaya.toFixed(2)} Kg` : `-${gaya.toFixed(2)} Kg`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Zari Voucher - A6</title>
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
                        <p>ZARI LEN-DEN PARCHI</p>
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
       10. DELETE (PWA IN-APP MODAL) & EDIT ENGINES (LOCKED & ROLLBACK SAFE)
       ======================================================================== */
    const closeZariDeleteConfirmModal = () => {
        const modal = document.getElementById('zari-delete-confirm-modal');
        if (modal) modal.remove();
    };

    const executeDeleteZariHistoryEntry = (histId) => {
        if (isDeletingZari) return;
        isDeletingZari = true;

        const snapHist = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_history'))));
        const snapStock = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_stock'))));
        const snapTransfers = JSON.parse(JSON.stringify(safeArr(window.getStore?.('material_transfers'))));
        const snapKarkhanaTransfers = JSON.parse(JSON.stringify(safeArr(window.getStore?.('karkhana_transfers'))));

        try {
            let hist = safeArr(window.getStore?.('zari_history'));
            const entry = hist.find(x => x && String(x.id) === String(histId));
            if (!entry) {
                closeZariDeleteConfirmModal();
                return alert('Entry nahi mili!');
            }

            const isTransfer = (entry.refId && String(entry.refId).includes('tr_zari')) ||
                               (entry.type && entry.type.toLowerCase().includes('transfer'));
            const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

            if (isTransfer && entry.refId) {
                hist = hist.filter(x => x && x.refId !== entry.refId);
                const transfers = safeArr(window.getStore?.('material_transfers')).filter(t => t && t.id !== entry.refId);
                if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);

                const kTransfers = safeArr(window.getStore?.('karkhana_transfers')).filter(t => t && t.id !== entry.refId);
                if (typeof window.setStore === 'function') window.setStore('karkhana_transfers', kTransfers);
            } else {
                hist = hist.filter(x => x && String(x.id) !== String(histId));
            }

            if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

            if (isPurchase) {
                let remainingToSub = getEntryAaya(entry);
                const list = safeArr(window.getStore?.('zari_stock'));
                const targetKid = entry.karkhanaId || 'k_main';
                const entryNameLower = String(entry.name || '').trim().toLowerCase();

                let changed = false;
                for (let i = 0; i < list.length && remainingToSub > 0; i++) {
                    const x = list[i];
                    if (!x || !x.name) continue;
                    const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    if (x.name.trim().toLowerCase() === entryNameLower && matchKid) {
                        const curAaya = safeNum(x.aaya);
                        if (curAaya > 0) {
                            const deduct = Math.min(curAaya, remainingToSub);
                            x.aaya = safeNum((curAaya - deduct).toFixed(2));
                            x.bacha = safeNum((safeNum(x.aaya) - safeNum(x.gaya)).toFixed(2));
                            remainingToSub = safeNum((remainingToSub - deduct).toFixed(2));
                            changed = true;
                        }
                    }
                }
                if (changed && typeof window.setStore === 'function') {
                    window.setStore('zari_stock', list);
                }
            }

            closeZariDeleteConfirmModal();
            applyZariPassbookFilters();
            renderZariTable();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            alert('🗑️ Entry safalta-poorvak delete ho gayi!');
        } catch (err) {
            console.error('[ZariDelete]', err);
            try {
                if (typeof window.setStore === 'function') {
                    window.setStore('zari_history', snapHist);
                    window.setStore('zari_stock', snapStock);
                    window.setStore('material_transfers', snapTransfers);
                    window.setStore('karkhana_transfers', snapKarkhanaTransfers);
                }
            } catch (rbErr) {
                console.error('[ZariDelete Rollback]', rbErr);
            }
            closeZariDeleteConfirmModal();
            alert('❌ Delete fail ho gaya — Data wapas restore ho gaya!');
        } finally {
            isDeletingZari = false;
        }
    };

    const deleteZariHistoryEntry = (histId) => {
        if (isDeletingZari) return;
        const hist = safeArr(window.getStore?.('zari_history'));
        const entry = hist.find(x => x && String(x.id) === String(histId));
        if (!entry) return alert('Entry nahi mili!');

        closeZariDeleteConfirmModal();

        const aaya = getEntryAaya(entry);
        const gaya = safeNum(entry.gaya);
        const wazanTxt = aaya > 0 ? `+${aaya.toFixed(2)} Kg (Aayi)` : `-${gaya.toFixed(2)} Kg (Gayi)`;
        const isTransfer = (entry.refId && String(entry.refId).includes('tr_zari')) ||
                           (entry.type && entry.type.toLowerCase().includes('transfer'));

        const modalHtml = `
            <div id="zari-delete-confirm-modal" class="zari-modal-overlay">
                <div class="zari-modal-card" style="max-width:400px;">
                    <div class="zari-modal-head">
                        <h3>Zari Entry Delete Karein?</h3>
                        <button type="button" id="zari-del-close-btn" class="zari-modal-btn">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:10px 12px; margin-bottom:12px; font-size:12.5px; color:#7f1d1d;">
                            <div><strong>Item:</strong> ${esc(entry.name || '-')}</div>
                            <div><strong>Tarikh:</strong> ${esc(entry.date || '-')}</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                            <div style="font-weight:800; margin-top:4px;">Wazan: ${esc(wazanTxt)}</div>
                        </div>
                        <p style="margin:0 0 14px 0; font-size:12.5px; color:#4b5563; line-height:1.45;">
                            ${isTransfer
                                ? 'Ye Godown Transfer entry hai — dono godam aur transfer register se delete hogi. Stock balance settle ho jayega.'
                                : 'Kya aap sach me ye entry delete karna chahte hain? Stock balance wapas settle ho jayega.'}
                        </p>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" id="zari-del-cancel-btn" class="zari-modal-btn">Cancel [Esc]</button>
                            <button type="button" id="zari-del-confirm-btn" class="zari-modal-btn-danger">Haan, Delete Karein [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('zari-del-close-btn')?.addEventListener('click', closeZariDeleteConfirmModal);
        document.getElementById('zari-del-cancel-btn')?.addEventListener('click', closeZariDeleteConfirmModal);
        document.getElementById('zari-del-confirm-btn')?.addEventListener('click', () => {
            executeDeleteZariHistoryEntry(histId);
        });

        setTimeout(() => {
            document.getElementById('zari-del-confirm-btn')?.focus();
        }, 40);
    };

    const openZariEditModal = (id) => {
        const hist = safeArr(window.getStore?.('zari_history'));
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const existingModal = document.getElementById('zari-edit-popup-modal');
        if (existingModal) existingModal.remove();

        const aayaVal = getEntryAaya(entry);
        const gayaVal = safeNum(entry.gaya);
        const isAaya = aayaVal > 0;
        const currentQty = isAaya ? aayaVal : gayaVal;
        const typeLabel = isAaya ? 'Aayi (Inward)' : 'Gayi (Outward)';

        const modalHtml = `
            <div id="zari-edit-popup-modal" class="zari-modal-overlay">
                <div class="zari-modal-card" style="max-width:420px;">
                    <div class="zari-modal-head">
                        <h3>Edit Zari Entry</h3>
                        <button type="button" id="zari-edit-close-btn" class="zari-modal-btn">&larr; [Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Item:</strong> ${esc(entry.name)}</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh (Date) :</label>
                            <input type="date" id="zari-edit-date" value="${esc(entry.date || '')}" class="zari-modal-inp">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Party / Source / Note :</label>
                            <input type="text" id="zari-edit-kariger" value="${esc(entry.kariger || '')}" class="zari-modal-inp">
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Wazan (${typeLabel} Kg) :</label>
                            <input type="number" step="0.01" id="zari-edit-qty" value="${currentQty.toFixed(2)}" class="zari-modal-inp">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" id="zari-edit-cancel-btn" class="zari-modal-btn">Cancel [Esc]</button>
                            <button type="button" id="zari-edit-save-btn" class="zari-modal-btn-gold">Update [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('zari-edit-close-btn')?.addEventListener('click', closeZariEditModal);
        document.getElementById('zari-edit-cancel-btn')?.addEventListener('click', closeZariEditModal);
        document.getElementById('zari-edit-save-btn')?.addEventListener('click', () => {
            saveZariHistoryEdit(id);
        });

        const order = ['zari-edit-date', 'zari-edit-kariger', 'zari-edit-qty'];
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
                        saveZariHistoryEdit(id);
                    }
                }
            });
        });

        setTimeout(() => {
            const kEl = document.getElementById('zari-edit-kariger');
            if (kEl) { kEl.focus(); kEl.select(); }
        }, 50);
    };

    const closeZariEditModal = () => {
        const modal = document.getElementById('zari-edit-popup-modal');
        if (modal) modal.remove();
    };

    const saveZariHistoryEdit = (id) => {
        if (isSavingZariEdit) return;
        isSavingZariEdit = true;

        const snapHist = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_history'))));
        const snapStock = JSON.parse(JSON.stringify(safeArr(window.getStore?.('zari_stock'))));
        const snapTransfers = JSON.parse(JSON.stringify(safeArr(window.getStore?.('material_transfers'))));
        const snapKarkhanaTransfers = JSON.parse(JSON.stringify(safeArr(window.getStore?.('karkhana_transfers'))));

        try {
            const hist = safeArr(window.getStore?.('zari_history'));
            const entry = hist.find(x => x && String(x.id) === String(id));
            if (!entry) return alert('Entry nahi mili!');

            const newDate = document.getElementById('zari-edit-date')?.value;
            const newKariger = String(document.getElementById('zari-edit-kariger')?.value || '').trim();
            const rawNewQty = safeNum(document.getElementById('zari-edit-qty')?.value);

            if (!newDate) return alert('Kripya Tarikh (Date) chunein!');
            if (rawNewQty <= 0) return alert('Kripya sahi wazan (Kg) darj karein!');
            const newQty = Number(rawNewQty.toFixed(2));

            const oldAaya = getEntryAaya(entry);
            const oldGaya = safeNum(entry.gaya);
            const oldQty = oldAaya > 0 ? oldAaya : oldGaya;

            const isTransfer = (entry.refId && String(entry.refId).includes('tr_zari')) ||
                               (entry.type && entry.type.toLowerCase().includes('transfer'));
            const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

            // Transfer qty badhane par source godown stock limit check karein
            if (isTransfer && entry.refId && newQty > oldQty) {
                const transfers = safeArr(window.getStore?.('material_transfers'));
                const tr = transfers.find(t => t && t.id === entry.refId);
                if (tr && typeof window.getZariAvailableBalance === 'function') {
                    const sourceKid = tr.fromKarkhanaId || 'k_main';
                    const avail = window.getZariAvailableBalance(tr.itemName || entry.name, sourceKid);
                    const maxAllowed = Number((avail + oldQty).toFixed(2));
                    if (newQty > maxAllowed) {
                        return alert(`Bhejne wale godam me kul ${maxAllowed.toFixed(2)} Kg tak hi transfer badhaya ja sakta hai!`);
                    }
                }
            }

            entry.date = newDate;
            entry.kariger = newKariger || (isTransfer ? 'Godown Transfer' : 'Godown Purchase');

            if (oldAaya > 0) {
                const aayaDiff = Number((newQty - oldAaya).toFixed(2));
                entry.aaya = newQty;

                if (isPurchase) {
                    const list = safeArr(window.getStore?.('zari_stock'));
                    const targetKid = entry.karkhanaId || 'k_main';
                    const entryNameLower = String(entry.name || '').trim().toLowerCase();

                    const item = list.find((x) => {
                        const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                        return x?.name && x.name.trim().toLowerCase() === entryNameLower && matchKid;
                    });

                    if (item) {
                        item.aaya = Math.max(0, safeNum((safeNum(item.aaya) + aayaDiff).toFixed(2)));
                        item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                        if (typeof window.setStore === 'function') window.setStore('zari_stock', list);
                    }
                }
            } else {
                entry.gaya = newQty;
                if (Object.prototype.hasOwnProperty.call(entry, 'qty')) {
                    delete entry.qty;
                }
            }

            if (isTransfer && entry.refId) {
                const pair = hist.find(x => x && x.refId === entry.refId && String(x.id) !== String(id));
                if (pair) {
                    pair.date = newDate;
                    pair.kariger = entry.kariger;
                    if (safeNum(pair.aaya) > 0) pair.aaya = newQty;
                    if (safeNum(pair.gaya) > 0) pair.gaya = newQty;
                }

                const transfers = safeArr(window.getStore?.('material_transfers'));
                const tr = transfers.find(t => t && t.id === entry.refId);
                if (tr) {
                    tr.date = newDate;
                    tr.qty = newQty;
                    tr.quantity = newQty;
                    if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);
                }

                const kTransfers = safeArr(window.getStore?.('karkhana_transfers'));
                const kTr = kTransfers.find(t => t && t.id === entry.refId);
                if (kTr) {
                    kTr.date = newDate;
                    kTr.quantity = newQty;
                    if (typeof window.setStore === 'function') window.setStore('karkhana_transfers', kTransfers);
                }
            }

            if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

            closeZariEditModal();
            applyZariPassbookFilters();
            renderZariTable();

            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            alert('✅ Zari entry safalta-poorvak update ho gayi!');
        } catch (err) {
            console.error('[ZariEdit]', err);
            try {
                if (typeof window.setStore === 'function') {
                    window.setStore('zari_history', snapHist);
                    window.setStore('zari_stock', snapStock);
                    window.setStore('material_transfers', snapTransfers);
                    window.setStore('karkhana_transfers', snapKarkhanaTransfers);
                }
            } catch (rbErr) {
                console.error('[ZariEdit Rollback]', rbErr);
            }
            alert('❌ Update fail ho gaya — Purana data restore ho gaya!');
        } finally {
            isSavingZariEdit = false;
        }
    };

    /* ========================================================================
       11. GLOBAL EXPORTS
       ======================================================================== */
    const zariUIAPI = {
        openZariModule,
        renderZariKarkhanaTabs,
        switchZariKarkhanaTab,
        toggleZariForm,
        toggleZariItemType,
        populateZariExistingDropdown,
        saveNewZari,
        bindZariSearchInput,
        filterZari,
        renderZariTable,
        changeZariStockPage,
        printZariStockReport,
        openZariTransferModal,
        closeZariTransferModal,
        submitZariTransferForm,
        openZariPassbook,
        resetZariPassbookFilters,
        applyZariPassbookFilters,
        renderPaginatedZariPassbook,
        changeZariPassbookPage,
        printZariPassbookFiltered,
        printSingleZariPassbookEntry,
        deleteZariHistoryEntry,
        openZariEditModal,
        closeZariEditModal,
        saveZariHistoryEdit
    };

    Object.keys(zariUIAPI).forEach((fn) => { window[fn] = zariUIAPI[fn]; });
    window.ZariUIEngine = zariUIAPI;
})();
