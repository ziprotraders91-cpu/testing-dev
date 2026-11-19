/* ============================================================================
   SIMPLICITY ERP - SAREE STOCK & 5-STAGE PIPELINE UI (TALLY WHITE & GOLD)
   File: saree/saree-ui.js • Developed by Farhan Jawed
   (100% Supabase-Safe | 5-Stage Hub -> Items List -> Inline Passbook + Keys)
   Stages: Fresh | Cutting | Embroidery | Finished | Lott
============================================================================ */

(() => {
    'use strict';

    window.currentSareeTab = 'fresh';
    window.currentSareeKarkhanaFilter = 'all';
    window.currentPassbookSareeKey = '';
    window.currentPassbookSareeTitle = '';

    // View State: 'hub' (5 Stages) | 'list' (Stage Items) | 'passbook' (Inline Ledger)
    let sareeViewMode = 'hub';
    let sareeHubActiveIdx = 0; // 0:fresh, 1:cutting, 2:embroidery, 3:finished, 4:lott
    let sareeOpenedAt = 0;
    let activePassbookMeta = null; // { sareeName, karigerName, karkhanaId }

    // Pagination & Cursor State - Passbook
    let sareePassbookCurrentPage = 1;
    const SAREE_PAGE_SIZE = 20;
    let filteredSareePassbookCache = [];
    let sareePassbookActiveIdx = 0;

    // Pagination & Cursor State - Main Saree Table
    let sareeStockCurrentPage = 1;
    const SAREE_STOCK_PAGE_SIZE = 15;
    let currentSareeFilteredRowsCache = [];
    let sareeListActiveIdx = 0;

    let sareeSearchDebounceTimer = null;

    const STAGE_LIST = [
        { key: 'fresh', title: 'Fresh Saree', desc: 'Kariger Sheet & Direct Fresh Godown Stock', shortcut: 'F', num: '1' },
        { key: 'cutting', title: 'Cutting Saree', desc: 'Booti Cutting Stage Stock', shortcut: 'C', num: '2' },
        { key: 'embroidery', title: 'Embroidery Saree', desc: 'Kadhai / Embroidery Stage Stock', shortcut: 'E', num: '3' },
        { key: 'finished', title: 'Finished Saree', desc: 'Calender Ready & Dispatchable Stock', shortcut: 'N', num: '4' },
        { key: 'lott', title: 'Lott Saree', desc: 'Lott / Cut & Damage Stock', shortcut: 'L', num: '5' }
    ];

    /* ========================================================================
       1. SAFE DOM & DATA SANITIZATION UTILITIES
       ======================================================================== */
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

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function')
            ? window.formatDateDisplay(d)
            : (d || '-');
    };

    const normText = (txt, fallback = '') => {
        return String(txt || fallback).trim().toUpperCase();
    };

    const normGodownId = (kid) => {
        if (!kid || kid === 'all') return 'all';
        const clean = String(kid).trim();
        return (!clean || clean === 'k_main') ? 'k_main' : clean;
    };

    const normTabName = (t) => {
        const clean = String(t || 'fresh').trim().toLowerCase();
        if (clean === 'cutting' || clean === 'cut') return 'cutting';
        if (clean === 'embroidery' || clean === 'emb') return 'embroidery';
        if (clean === 'finished' || clean === 'finish' || clean === 'calender') return 'finished';
        if (clean === 'lott' || clean === 'lot' || clean === 'damage') return 'lott';
        return 'fresh';
    };

    const getStageTitle = (tabKey) => {
        const found = STAGE_LIST.find(s => s.key === normTabName(tabKey));
        return found ? found.title : 'Fresh Saree';
    };

    const isAnyExpressOverlayOpen = () => {
        return Boolean(
            document.getElementById('kariger-express-modal') ||
            document.getElementById('master-stock-express-modal') ||
            document.getElementById('master-jobwork-express-modal')
        );
    };

    const triggerSareeCacheInvalidation = () => {
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        } else if (window.SareeCalcEngine && typeof window.SareeCalcEngine.invalidateSareeCalcCache === 'function') {
            window.SareeCalcEngine.invalidateSareeCalcCache();
        }
    };

    /* ========================================================================
       2. SCOPED TALLYPRIME WHITE & GOLD STYLES FOR #saree-section
       ======================================================================== */
    const ensureSareeTallyStyles = () => {
        if (document.getElementById('saree-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'saree-tally-styles';
        style.textContent = `
            #saree-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #saree-section .module-header {
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
            #saree-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 17px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #saree-section .back-btn {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                padding: 6px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #saree-section .back-btn:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
            }
            #saree-section .add-btn {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 6px !important;
                padding: 6px 14px !important;
                font-size: 12.5px !important;
                font-weight: 800 !important;
                cursor: pointer;
            }
            #saree-section .add-btn:hover { background: #e5aa12 !important; }
            #saree-section .sheet-tabs-bar {
                padding: 10px 20px 0 20px;
                margin-bottom: 6px !important;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #saree-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #saree-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #saree-section #saree-stage-summary-box {
                margin: 6px 20px 10px 20px;
                padding: 9px 14px;
                background: #fdfcf7;
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            #saree-section .filter-panel {
                padding: 0 20px 10px 20px;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #saree-section .search-box {
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
            #saree-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #saree-section #add-saree-form {
                margin: 8px 20px 14px 20px !important;
                padding: 14px 16px !important;
                background: #fdfcf7 !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 6px !important;
            }
            #saree-section .table-responsive {
                padding: 0 20px;
                box-sizing: border-box;
            }
            #saree-section table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #saree-section table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #saree-section table th {
                padding: 9px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left;
            }
            #saree-section table td {
                padding: 9px 12px !important;
                font-size: 13px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
            }
            #saree-section .saree-hub-row,
            #saree-section .saree-stock-row,
            #saree-section .saree-pass-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #saree-section .saree-hub-row:hover,
            #saree-section .saree-stock-row:hover,
            #saree-section .saree-pass-row:hover {
                background: #fef9ea !important;
            }
            #saree-section .saree-hub-row.active,
            #saree-section .saree-stock-row.active,
            #saree-section .saree-pass-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #saree-section .saree-hub-row.active td,
            #saree-section .saree-stock-row.active td,
            #saree-section .saree-pass-row.active td {
                font-weight: 700 !important;
                color: #1f2937 !important;
            }
            #saree-section .saree-key-badge {
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
            #saree-section .saree-hub-row.active .saree-key-badge {
                background: #ffffff;
                color: #1f2937;
                border-color: #b47d00;
            }
            #saree-section .saree-tally-btn {
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
            #saree-section .saree-tally-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
            }
            #saree-section .saree-tally-btn-gold {
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
            #saree-section .saree-tally-btn-gold:hover { background: #e5aa12; }
            #saree-section .saree-status-strip {
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
            .saree-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 15px; box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .saree-modal-card {
                background: #ffffff;
                width: 100%; max-width: 480px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                color: #1f2937;
            }
            .saree-modal-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 11px 16px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .saree-modal-head h3 {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
            }
            .saree-modal-inp {
                width: 100%; box-sizing: border-box;
                padding: 7px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
            }
            .saree-modal-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       3. 3-LEVEL VIEW CONTROLLER: 'hub' (5 Stages) -> 'list' -> 'passbook'
       ======================================================================== */
    const ensureSareeHubView = () => {
        const sec = document.getElementById('saree-section');
        if (!sec) return null;

        let hub = document.getElementById('saree-stage-hub-view');
        if (hub) return hub;

        hub = document.createElement('div');
        hub.id = 'saree-stage-hub-view';
        hub.style.display = 'none';

        const rowsHtml = STAGE_LIST.map((st, idx) => `
            <tr class="saree-hub-row${idx === 0 ? ' active' : ''}" data-shidx="${idx}" onclick="window.__sareeOpenStageFromHub('${st.key}')">
                <td>${idx + 1}</td>
                <td>
                    <strong>${esc(st.title)}</strong>
                    <small style="display:block; font-size:11.5px; color:#6b7280; margin-top:2px;">${esc(st.desc)}</small>
                </td>
                <td style="text-align:center;"><span class="saree-key-badge">${st.shortcut}</span></td>
                <td style="text-align:right;" id="saree-hub-cnt-${st.key}">0</td>
                <td style="text-align:right; font-weight:800; color:#b47d00;" id="saree-hub-pcs-${st.key}">0 Pcs</td>
                <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
            </tr>
        `).join('');

        hub.innerHTML = `
            <div style="padding:16px 20px;">
                <table>
                    <thead>
                        <tr>
                            <th style="width:55px;">#</th>
                            <th>Saree Pipeline Stage (Particulars)</th>
                            <th style="width:90px; text-align:center;">Key</th>
                            <th style="text-align:right;">Types</th>
                            <th style="text-align:right;">Bachi Saree (Available)</th>
                            <th style="width:110px; text-align:right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr style="background:#fdfcf7; border-top:1.5px solid #e5d5a7;">
                            <th colspan="4" style="text-align:right; color:#92400e;">Kul Sabhi Stages Bachi Saree:</th>
                            <th id="saree-hub-grand-pcs" style="text-align:right; color:#b47d00; font-size:14px;">0 Pcs</th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="saree-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Stage Chunein · [Enter] ya [F / C / E / N / L] se Andar Jayein · [F7] + Saree Inward · [Esc] Back</span>
                <span>5 Pipeline Stages</span>
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

    const renderSareeHubTotals = () => {
        ensureSareeHubView();
        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        let grandTotalBachi = 0;

        STAGE_LIST.forEach((st) => {
            let rows = [];
            if (typeof window.groupSareeStockByTab === 'function') {
                rows = window.groupSareeStockByTab(history, st.key, window.currentSareeKarkhanaFilter);
            }
            let sumBachi = 0;
            rows.forEach((r) => { sumBachi += safeInt(r.bachi); });
            grandTotalBachi += sumBachi;

            const cntEl = document.getElementById(`saree-hub-cnt-${st.key}`);
            const pcsEl = document.getElementById(`saree-hub-pcs-${st.key}`);
            if (cntEl) cntEl.textContent = `${rows.length} Types`;
            if (pcsEl) pcsEl.textContent = `${sumBachi} Pcs`;
        });

        const grandEl = document.getElementById('saree-hub-grand-pcs');
        if (grandEl) grandEl.textContent = `${grandTotalBachi} Pcs`;

        highlightSareeHubRow(sareeHubActiveIdx);
    };

    const highlightSareeHubRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#saree-stage-hub-view .saree-hub-row'));
        if (!rows.length) return;
        sareeHubActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sareeHubActiveIdx));
    };

    window.__sareeOpenStageFromHub = (stageKey) => {
        const idx = STAGE_LIST.findIndex(s => s.key === normTabName(stageKey));
        sareeHubActiveIdx = idx >= 0 ? idx : 0;
        switchSareeStockTab(stageKey);
    };

    const setSareeViewMode = (mode) => {
        sareeViewMode = mode; // 'hub' | 'list' | 'passbook'
        const sec = document.getElementById('saree-section');
        if (!sec) return;

        ensureSareeHubView();

        const hubView = document.getElementById('saree-stage-hub-view');
        const stageTabsBar = document.getElementById('tab-saree-fresh')?.closest('.sheet-tabs-bar');
        const kTabsBar = document.getElementById('saree-karkhana-tabs-bar');
        const stageSumBox = document.getElementById('saree-stage-summary-box');
        const filterPanel = sec.querySelector(':scope > .filter-panel');
        const addForm = document.getElementById('add-saree-form');
        const mainTbl = document.getElementById('saree-table-body')?.closest('.table-responsive');
        const mainPager = document.getElementById('saree-stock-pagination-controls');
        const mainStrip = document.getElementById('saree-main-status-strip');
        const passView = document.getElementById('saree-inline-passbook-view');
        const headerTitle = sec.querySelector('.module-header h2');
        const headerBackBtn = sec.querySelector('.module-header .back-btn');

        const isHub = (mode === 'hub');
        const isList = (mode === 'list');
        const isPass = (mode === 'passbook');

        if (hubView) hubView.style.display = isHub ? 'block' : 'none';
        if (stageTabsBar) stageTabsBar.style.display = isList ? 'flex' : 'none';
        if (kTabsBar) kTabsBar.style.display = isList ? 'flex' : 'none';
        if (stageSumBox) stageSumBox.style.display = isList ? 'flex' : 'none';
        if (filterPanel) filterPanel.style.display = isList ? 'flex' : 'none';
        if (addForm && !isList) addForm.style.display = 'none';
        if (mainTbl) mainTbl.style.display = isList ? 'block' : 'none';
        if (mainPager) mainPager.style.display = isList ? 'flex' : 'none';
        if (mainStrip) mainStrip.style.display = isList ? 'flex' : 'none';
        if (passView) passView.style.display = isPass ? 'block' : 'none';

        const stageTitle = getStageTitle(window.currentSareeTab);
        if (headerTitle) {
            if (isHub) headerTitle.textContent = 'Saree Stock (5 Pipeline Stages)';
            else if (isList) headerTitle.textContent = `Saree Stock: ${stageTitle}`;
            else headerTitle.textContent = `Saree Passbook: ${window.currentPassbookSareeTitle || ''} (${stageTitle})`;
        }
        if (headerBackBtn) {
            if (isHub) headerBackBtn.textContent = window.__slReturnToStockSummary ? '← [Esc] Stock Summary' : '← Dashboard';
            else if (isList) headerBackBtn.textContent = '← [Esc] Saree Stages';
            else headerBackBtn.textContent = `← [Esc] ${stageTitle}`;
        }
    };

    const handleSareeBackStep = () => {
        if (sareeViewMode === 'passbook') {
            setSareeViewMode('list');
            renderSareeTable();
            return;
        }
        if (sareeViewMode === 'list') {
            sareeOpenedAt = performance.now();
            setSareeViewMode('hub');
            renderSareeHubTotals();
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
       4. NAVIGATION & 5-TAB PIPELINE CONTROLLER
       ======================================================================== */
    const openSareeModule = () => {
        sareeOpenedAt = performance.now();
        ensureSareeTallyStyles();
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        setDisplay('saree-section', 'block');

        setSareeViewMode('hub');
        renderSareeHubTotals();
        bindSareeSearchInput();
        bindSareeKeyboardEngine();
    };

    const switchSareeStockTab = (tabName) => {
        sareeOpenedAt = performance.now();
        ensureSareeTallyStyles();
        window.currentSareeTab = normTabName(tabName);
        const foundIdx = STAGE_LIST.findIndex(s => s.key === window.currentSareeTab);
        if (foundIdx >= 0) sareeHubActiveIdx = foundIdx;

        sareeStockCurrentPage = 1;
        sareeListActiveIdx = 0;

        STAGE_LIST.forEach((st) => {
            const el = document.getElementById(`tab-saree-${st.key}`);
            if (el) {
                el.classList.toggle('active', st.key === window.currentSareeTab);
            }
        });

        setSareeViewMode('list');
        renderSareeKarkhanaTabs();
        renderSareeTable();
        bindSareeSearchInput();
        bindSareeKeyboardEngine();
    };

    const renderSareeKarkhanaTabs = () => {
        const bar = document.getElementById('saree-karkhana-tabs-bar');
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

        const isAllActive = (window.currentSareeKarkhanaFilter === 'all') ? ' active' : '';
        let html = `<button type="button" class="sheet-tab${isAllActive}" onclick="switchSareeKarkhanaTab('all')">Sabhi Godam</button>`;

        karkhanas.forEach((k) => {
            const isActive = (String(window.currentSareeKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchSareeKarkhanaTab('${esc(k.id)}')">${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchSareeKarkhanaTab = (kId) => {
        window.currentSareeKarkhanaFilter = kId || 'all';
        sareeStockCurrentPage = 1;
        sareeListActiveIdx = 0;
        renderSareeKarkhanaTabs();
        renderSareeTable();
    };

    const cycleSareeKarkhanaTab = () => {
        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];

        const ids = ['all', ...karkhanas.map(k => String(k.id))];
        const curIdx = ids.indexOf(String(window.currentSareeKarkhanaFilter));
        const nextId = ids[(curIdx + 1) % ids.length];
        switchSareeKarkhanaTab(nextId);
    };

    const bindSareeSearchInput = () => {
        const searchInput = document.getElementById('search-saree-input');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = 'true';
            searchInput.addEventListener('input', () => {
                clearTimeout(sareeSearchDebounceTimer);
                sareeSearchDebounceTimer = setTimeout(() => {
                    sareeStockCurrentPage = 1;
                    sareeListActiveIdx = 0;
                    renderSareeTable();
                }, 150);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    searchInput.blur();
                    if (e.key === 'Enter' && currentSareeFilteredRowsCache.length > 0) {
                        const pageRows = getSareeCurrentPageRows();
                        const chosen = pageRows[sareeListActiveIdx] || pageRows[0];
                        if (chosen) {
                            openSareePassbook(
                                encodeURIComponent(chosen.sareeName),
                                encodeURIComponent(chosen.karigerName),
                                encodeURIComponent(chosen.karkhanaId)
                            );
                        }
                    }
                }
            });
        }
    };

    const filterSaree = () => {
        sareeStockCurrentPage = 1;
        sareeListActiveIdx = 0;
        renderSareeTable();
    };

    const getSareeCurrentPageRows = () => {
        const startIndex = (sareeStockCurrentPage - 1) * SAREE_STOCK_PAGE_SIZE;
        return currentSareeFilteredRowsCache.slice(startIndex, startIndex + SAREE_STOCK_PAGE_SIZE);
    };

    const highlightSareeListRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#saree-table-body .saree-stock-row'));
        if (!rows.length) return;
        sareeListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sareeListActiveIdx));
        rows[sareeListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    /* ========================================================================
       5. DIRECT MANUAL INWARD ENGINE (100% SUPABASE SAFE)
       ======================================================================== */
    const toggleSareeForm = () => {
        if (sareeViewMode !== 'list') {
            switchSareeStockTab(window.currentSareeTab || 'fresh');
        }
        const f = document.getElementById('add-saree-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('saree-date');
            if (dInp) dInp.value = getToday();
            setTimeout(() => { document.getElementById('saree-name')?.focus(); }, 40);
        }
    };

    const saveNewSareeStock = () => {
        const d = document.getElementById('saree-date')?.value || getToday();
        const name = normText(document.getElementById('saree-name')?.value);
        const source = normText(document.getElementById('saree-kariger')?.value, 'DIRECT INWARD');
        const pcs = safeInt(document.getElementById('saree-pcs')?.value);

        if (!name || pcs <= 0) return alert('Saree ka naam aur Sahi Pcs bharein!');

        const targetKid = (window.currentSareeKarkhanaFilter !== 'all') ? window.currentSareeKarkhanaFilter : 'k_main';

        const history = (window.safeArray ? window.safeArray(window.getStore('saree_history')) : []).slice();
        history.push({
            id: `saree_man_${Date.now()}`,
            date: d,
            sareeName: name,
            karigerName: source,
            kariger: source,
            partyName: source,
            karkhanaId: targetKid,
            type: window.currentSareeTab,
            typeLabel: `Direct Godown Inward (${window.currentSareeTab.toUpperCase()})`,
            aai: pcs,
            gai: 0,
            isOut: false,
            isOpening: false,
            note: 'Direct Entry',
            timestamp: Date.now()
        });

        if (typeof window.setStore === 'function') {
            window.setStore('saree_history', history);
        }

        triggerSareeCacheInvalidation();
        toggleSareeForm();

        const sNameEl = document.getElementById('saree-name');
        const sKarEl = document.getElementById('saree-kariger');
        const sPcsEl = document.getElementById('saree-pcs');
        if (sNameEl) sNameEl.value = '';
        if (sKarEl) sKarEl.value = '';
        if (sPcsEl) sPcsEl.value = '';

        renderSareeTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }

        alert(`✅ ${pcs} Pcs Saree Stock me jama ho gayi!`);
    };

    /* ========================================================================
       6. MAIN TABLE RENDERER (CLEAN WHITE & GOLD + KEYBOARD CURSOR)
       ======================================================================== */
    const renderSareeTable = () => {
        ensureSareeTallyStyles();
        bindSareeSearchInput();

        // Keep Hub counts fresh if Hub exists in DOM
        if (document.getElementById('saree-stage-hub-view') && sareeViewMode === 'hub') {
            renderSareeHubTotals();
        }

        const thead = document.getElementById('saree-table-head');
        const tbody = document.getElementById('saree-table-body');
        if (!thead || !tbody) return;

        const tabTitle = getStageTitle(window.currentSareeTab);

        thead.innerHTML = `
            <tr style="font-size:12px; text-align:left;">
                <th>Tarikh</th>
                <th>Saree Name</th>
                <th>Karigar (Maker)</th>
                <th>Godam</th>
                <th style="text-align:right;">Aai Saree</th>
                <th style="text-align:right;">Gai Saree</th>
                <th style="text-align:right;">Bachi Saree</th>
                <th style="text-align:right;">Action</th>
            </tr>`;

        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];

        let allStageRows = [];
        if (typeof window.groupSareeStockByTab === 'function') {
            allStageRows = window.groupSareeStockByTab(history, window.currentSareeTab, window.currentSareeKarkhanaFilter);
        }

        let totalAai = 0;
        let totalGai = 0;
        let totalBachi = 0;
        allStageRows.forEach((r) => {
            totalAai += safeInt(r.aai);
            totalGai += safeInt(r.gai);
            totalBachi += safeInt(r.bachi);
        });

        const searchInput = document.getElementById('search-saree-input');
        const searchText = searchInput ? searchInput.value : '';
        let rows = allStageRows;
        if (typeof window.searchSareeData === 'function') {
            rows = window.searchSareeData(allStageRows, searchText);
        }

        currentSareeFilteredRowsCache = rows;

        // Clean White & Gold Summary Strip above Filter Panel
        const sec = document.getElementById('saree-section');
        if (sec && searchInput?.parentElement) {
            if (!document.getElementById('saree-stage-summary-box')) {
                const sumBox = document.createElement('div');
                sumBox.id = 'saree-stage-summary-box';
                sumBox.innerHTML = `
                    <strong id="saree-stage-sum-val" style="color:#b47d00; font-size:14px;">Kul Bachi: 0 Pcs</strong>
                    <div id="saree-stage-sum-meta" style="font-size:12px; color:#6b7280; font-weight:700;">Total Aai: +0 · Total Gai: -0</div>
                `;
                searchInput.parentElement.parentElement.insertBefore(sumBox, searchInput.parentElement);
                if (sareeViewMode !== 'list') sumBox.style.display = 'none';
            }
            const sumVal = document.getElementById('saree-stage-sum-val');
            const sumMeta = document.getElementById('saree-stage-sum-meta');
            if (sumVal) sumVal.textContent = `Kul ${tabTitle} Bachi: ${totalBachi} Pcs`;
            if (sumMeta) sumMeta.textContent = `Total Aai: +${totalAai} Pcs · Total Gai: -${totalGai} Pcs`;

            if (!document.getElementById('saree-stock-transfer-btn')) {
                const trBtn = document.createElement('button');
                trBtn.id = 'saree-stock-transfer-btn';
                trBtn.type = 'button';
                trBtn.className = 'saree-tally-btn';
                trBtn.innerHTML = 'Bhejo / Move [T]';
                trBtn.onclick = () => triggerSelectedSareeTransfer();
                searchInput.parentElement.appendChild(trBtn);
            }
            if (!document.getElementById('saree-stock-print-btn')) {
                const printBtn = document.createElement('button');
                printBtn.id = 'saree-stock-print-btn';
                printBtn.type = 'button';
                printBtn.className = 'saree-tally-btn';
                printBtn.innerHTML = 'A6 Print [Alt+P]';
                printBtn.onclick = () => printSareeStockReport();
                searchInput.parentElement.appendChild(printBtn);
            }
        }

        const totalEntries = rows.length;
        let pager = document.getElementById('saree-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('.table-responsive') || tbody.closest('table')?.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'saree-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;';
                tbl.insertAdjacentElement('afterend', pager);
                if (sareeViewMode !== 'list') pager.style.display = 'none';
            }
        }

        if (sec && !document.getElementById('saree-main-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'saree-main-status-strip';
            strip.className = 'saree-status-strip';
            strip.innerHTML = `
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Item Chunein · [Enter / Click] Passbook · [T / F4] Transfer · [F7] + Inward · [F2] Godam · [/] Search · [Esc] Back</span>
                <span id="saree-main-count-lbl">0 Items</span>
            `;
            sec.appendChild(strip);
            if (sareeViewMode !== 'list') strip.style.display = 'none';
        }

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:22px; color:#6b7280;">Koi ${esc(tabTitle)} Stock nahi mila.</td></tr>`;
            if (pager) pager.innerHTML = '';
        } else {
            const totalPages = Math.ceil(totalEntries / SAREE_STOCK_PAGE_SIZE) || 1;
            if (sareeStockCurrentPage > totalPages) sareeStockCurrentPage = totalPages;
            if (sareeStockCurrentPage < 1) sareeStockCurrentPage = 1;

            const startIndex = (sareeStockCurrentPage - 1) * SAREE_STOCK_PAGE_SIZE;
            const pageRows = rows.slice(startIndex, startIndex + SAREE_STOCK_PAGE_SIZE);
            if (sareeListActiveIdx >= pageRows.length) sareeListActiveIdx = 0;
            if (sareeListActiveIdx < 0) sareeListActiveIdx = 0;

            let html = '';
            pageRows.forEach((row, idx) => {
                const safeSaree = encodeURIComponent(row.sareeName);
                const safeKariger = encodeURIComponent(row.karigerName);
                const safeKid = encodeURIComponent(row.karkhanaId);
                const bachi = safeInt(row.bachi);
                const activeCls = (idx === sareeListActiveIdx) ? ' active' : '';

                html += `<tr class="saree-stock-row${activeCls}" data-sridx="${idx}" onclick="window.__sareeSelectAndOpen(${idx}, '${safeSaree}', '${safeKariger}', '${safeKid}')">
                    <td>${formatDisplay(row.date)}</td>
                    <td><strong>${esc(row.sareeName)}</strong></td>
                    <td>${esc(row.karigerName)}</td>
                    <td>${esc(row.godamName)}</td>
                    <td style="text-align:right; font-weight:700;">+${safeInt(row.aai)}</td>
                    <td style="text-align:right; font-weight:700; color:#6b7280;">${safeInt(row.gai) > 0 ? `-${safeInt(row.gai)}` : '0'}</td>
                    <td style="text-align:right; font-weight:800; color:#b47d00;">${bachi} Pcs</td>
                    <td style="text-align:right; font-weight:700; font-size:12px;">Passbook →</td>
                </tr>`;
            });

            tbody.innerHTML = html;

            if (pager) {
                pager.innerHTML = `
                    <div style="font-size:12px; color:#6b7280; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SAREE_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="saree-tally-btn" ${sareeStockCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSareeStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${sareeStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="saree-tally-btn" ${sareeStockCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSareeStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const cntLbl = document.getElementById('saree-main-count-lbl');
        if (cntLbl) cntLbl.textContent = `${totalEntries} Items`;
    };

    window.__sareeSelectAndOpen = (idx, safeSaree, safeKariger, safeKid) => {
        highlightSareeListRow(idx);
        openSareePassbook(safeSaree, safeKariger, safeKid);
    };

    const triggerSelectedSareeTransfer = () => {
        if (sareeViewMode === 'passbook' && activePassbookMeta) {
            const { sareeName, karigerName, karkhanaId } = activePassbookMeta;
            const bachi = (typeof window.getSareeAvailableBalance === 'function')
                ? safeInt(window.getSareeAvailableBalance(sareeName, karigerName, karkhanaId, window.currentSareeTab))
                : 0;
            if (bachi <= 0) return alert('Is Saree item me transfer ke liye koi Pcs nahi bache hain.');
            openSareeTransferModal(
                encodeURIComponent(sareeName),
                encodeURIComponent(karigerName),
                encodeURIComponent(karkhanaId),
                bachi
            );
            return;
        }

        const pageRows = getSareeCurrentPageRows();
        const chosen = pageRows[sareeListActiveIdx];
        if (!chosen) return alert('Pehle koi Saree item chunein!');
        const bachi = safeInt(chosen.bacha !== undefined ? chosen.bacha : chosen.bachi);
        if (bachi <= 0) return alert(`[${chosen.sareeName}] me transfer ke liye koi Pcs nahi bache hain.`);
        openSareeTransferModal(
            encodeURIComponent(chosen.sareeName),
            encodeURIComponent(chosen.karigerName),
            encodeURIComponent(chosen.karkhanaId),
            bachi
        );
    };

    const changeSareeStockPage = (delta) => {
        sareeStockCurrentPage += delta;
        sareeListActiveIdx = 0;
        renderSareeTable();
    };

    /* ========================================================================
       7. TRANSFER MODAL (TALLY WHITE & GOLD + ENTER CHAINING)
       ======================================================================== */
    const openSareeTransferModal = (safeSaree, safeKariger, safeKid, availableBachi) => {
        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const currentKid = decodeURIComponent(safeKid);

        const existingModal = document.getElementById('saree-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }

        const currentGodamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(currentKid)
            : currentKid;

        let godownOptions = '';
        karkhanas.forEach((k) => {
            if (String(k.id) !== String(currentKid)) {
                const isMain = (k.id === 'k_main' || k.isDefault);
                const selected = (isMain || currentKid !== 'k_main') ? 'selected' : '';
                godownOptions += `<option value="${esc(k.id)}" ${selected}>${esc(k.name)}</option>`;
            }
        });

        const today = getToday();

        const modalHtml = `
            <div id="saree-transfer-popup-modal" class="saree-modal-overlay">
                <div class="saree-modal-card">
                    <div class="saree-modal-head">
                        <h3>Saree Transfer / Stage Move</h3>
                        <button type="button" class="saree-tally-btn" onclick="closeSareeTransferModal()">&larr; [Esc] Close</button>
                    </div>

                    <div style="padding:16px;">
                        <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:6px; padding:10px 12px; margin-bottom:12px; font-size:12.5px;">
                            <div><strong>Saree:</strong> ${esc(sName)}</div>
                            <div><strong>Maker:</strong> ${esc(kName)}</div>
                            <div><strong>Godam:</strong> ${esc(currentGodamName)} (${window.currentSareeTab.toUpperCase()})</div>
                            <div style="color:#b47d00; font-weight:800; font-size:13.5px; margin-top:4px;">Available Stock: ${availableBachi} Pcs</div>
                        </div>

                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Action Type :</label>
                            <select id="saree-transfer-action-type" onchange="toggleSareeTransferFields()" class="saree-modal-inp">
                                <option value="godown_transfer">Doosre Godam / Main Godown Bhejein (Fresh Stock)</option>
                                <option value="stage_move">Agli Process me Bhejein (Cutting / Embroidery / Finished)</option>
                            </select>
                        </div>

                        <div id="box-godown-transfer" style="display:block; margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Destination Godam :</label>
                            <select id="saree-dest-godam" class="saree-modal-inp">${godownOptions}</select>
                            <div style="font-size:11px; color:#6b7280; margin-top:4px;">Note: Main Godown jane par ye saree automatic Fresh Saree me jama hogi.</div>
                        </div>

                        <div id="box-stage-move" style="display:none; margin-bottom:10px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Destination Stage :</label>
                            <select id="saree-dest-stage" class="saree-modal-inp">
                                ${window.currentSareeTab !== 'cutting' ? '<option value="cutting">Cutting Saree</option>' : ''}
                                ${window.currentSareeTab !== 'embroidery' ? '<option value="embroidery">Embroidery Saree</option>' : ''}
                                ${window.currentSareeTab !== 'finished' ? '<option value="finished">Finished Saree</option>' : ''}
                                ${window.currentSareeTab !== 'lott' ? '<option value="lott">Lott Saree</option>' : ''}
                                ${window.currentSareeTab !== 'fresh' ? '<option value="fresh">Fresh Saree</option>' : ''}
                            </select>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Saree (Pcs) :</label>
                                <input type="number" id="saree-transfer-qty" max="${availableBachi}" min="1" value="${availableBachi}" class="saree-modal-inp">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Tarikh :</label>
                                <input type="date" id="saree-transfer-date" value="${today}" class="saree-modal-inp">
                            </div>
                        </div>

                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px;">Note / Gaadi / Parchi No. (Optional) :</label>
                            <input type="text" id="saree-transfer-note" placeholder="e.g. Tempo se bheja gaya" class="saree-modal-inp">
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="saree-tally-btn" onclick="closeSareeTransferModal()">Cancel [Esc]</button>
                            <button type="button" class="saree-tally-btn-gold" onclick="submitSareeTransferForm('${safeSaree}', '${safeKariger}', '${safeKid}', ${availableBachi})">Transfer Confirm [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const bindChain = (id, getNextId) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nxtId = getNextId();
                    if (!nxtId) {
                        submitSareeTransferForm(safeSaree, safeKariger, safeKid, availableBachi);
                    } else {
                        const nxt = document.getElementById(nxtId);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    }
                }
            });
        };

        bindChain('saree-transfer-action-type', () =>
            document.getElementById('saree-transfer-action-type')?.value === 'godown_transfer'
                ? 'saree-dest-godam'
                : 'saree-dest-stage'
        );
        bindChain('saree-dest-godam', () => 'saree-transfer-qty');
        bindChain('saree-dest-stage', () => 'saree-transfer-qty');
        bindChain('saree-transfer-qty', () => 'saree-transfer-date');
        bindChain('saree-transfer-date', () => 'saree-transfer-note');
        bindChain('saree-transfer-note', () => null);

        setTimeout(() => {
            const qtyEl = document.getElementById('saree-transfer-qty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
        }, 50);
    };

    const closeSareeTransferModal = () => {
        const modal = document.getElementById('saree-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const toggleSareeTransferFields = () => {
        const actionType = document.getElementById('saree-transfer-action-type')?.value;
        const godownBox = document.getElementById('box-godown-transfer');
        const stageBox = document.getElementById('box-stage-move');

        if (actionType === 'godown_transfer') {
            if (godownBox) godownBox.style.display = 'block';
            if (stageBox) stageBox.style.display = 'none';
        } else {
            if (godownBox) godownBox.style.display = 'none';
            if (stageBox) stageBox.style.display = 'block';
        }
    };

    const submitSareeTransferForm = (safeSaree, safeKariger, safeKid, maxAvailable) => {
        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const fromKid = decodeURIComponent(safeKid);

        const actionType = document.getElementById('saree-transfer-action-type')?.value;
        const qty = safeInt(document.getElementById('saree-transfer-qty')?.value);
        const d = document.getElementById('saree-transfer-date')?.value || getToday();
        const note = String(document.getElementById('saree-transfer-note')?.value || '').trim();

        if (qty <= 0) return alert('Kripya sahi Saree sankhya (Pcs) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable} Pcs hain!`);

        let success = false;

        if (actionType === 'godown_transfer') {
            const toKid = document.getElementById('saree-dest-godam')?.value;
            if (!toKid) return alert('Kripya Destination Godam chunein!');

            if (typeof window.transferSareeBetweenKarkhana === 'function') {
                success = window.transferSareeBetweenKarkhana(d, sName, kName, fromKid, toKid, qty, window.currentSareeTab, note);
            }
        } else {
            const toStage = document.getElementById('saree-dest-stage')?.value;
            if (!toStage) return alert('Kripya Agli Stage chunein!');

            if (typeof window.moveSareePipelineStage === 'function') {
                success = window.moveSareePipelineStage(d, sName, kName, fromKid, qty, window.currentSareeTab, toStage, note);
            }
        }

        if (success) {
            triggerSareeCacheInvalidation();
            closeSareeTransferModal();
            if (sareeViewMode === 'passbook') {
                applySareePassbookFilters();
            } else {
                renderSareeTable();
            }

            if (typeof window.updateDashboardBadgeTotals === 'function') {
                window.updateDashboardBadgeTotals();
            }

            alert('✅ Saree safalta-poorvak transfer ho gayi!');
        }
    };

    /* ========================================================================
       8. INLINE TALLY SAREE PASSBOOK ENGINE (WITH RUNNING CLOSING BALANCE)
       ======================================================================== */
    const ensureInlineSareePassbookContainer = () => {
        const sec = document.getElementById('saree-section');
        if (!sec) return null;

        let container = document.getElementById('saree-inline-passbook-view');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'saree-inline-passbook-view';
        container.style.display = 'none';
        container.innerHTML = `
            <div style="margin:12px 20px 10px 20px; padding:10px 14px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="saree-tally-btn" onclick="window.__closeSareePassbookView()">&larr; [Esc] Stage List</button>
                    <strong id="saree-pass-summary-title" style="font-size:14px; color:#1f2937;">Saree: -</strong>
                    <span id="saree-pass-summary-totals" style="font-size:12px; color:#b47d00; font-weight:800;"></span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="saree-tally-btn" onclick="window.__sareePassAction('delete')">Delete [Del]</button>
                    <button type="button" class="saree-tally-btn" onclick="window.__sareePassAction('print_single')">Slip [P]</button>
                    <button type="button" class="saree-tally-btn" onclick="window.__sareeTransferFromPass()">Bhejo / Move [T]</button>
                    <button type="button" class="saree-tally-btn-gold" onclick="printSareePassbookFiltered()">A6 Print [Alt+P]</button>
                </div>
            </div>

            <div style="padding:0 20px 10px 20px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">From Date [F]:</label>
                    <input type="date" id="saree-pass-from-date" onchange="applySareePassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div>
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">To Date:</label>
                    <input type="date" id="saree-pass-to-date" onchange="applySareePassbookFilters()" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12.5px; font-weight:600;">
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#6b7280; display:block; margin-bottom:2px;">Search [/]:</label>
                    <input type="text" id="saree-pass-search-input" class="search-box" placeholder="Search Party, Worker, Note, Qty..." oninput="applySareePassbookFilters()">
                </div>
                <button type="button" class="saree-tally-btn" onclick="resetSareePassbookFilters()">Reset [R]</button>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Tarikh</th>
                            <th>Kahan Gayi / Kisse Aayi (Party)</th>
                            <th>Detail (Vivran)</th>
                            <th style="text-align:right;">Aai (+)</th>
                            <th style="text-align:right;">Gayi (-)</th>
                            <th style="text-align:right;">Closing Bal</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="saree-passbook-table-body"></tbody>
                </table>
            </div>

            <div id="saree-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin:10px 20px 0 20px; padding:8px 0; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;"></div>

            <div class="saree-status-strip">
                <span style="color:#92400e; font-weight:700;">[↑ ↓] Entry Chunein · [Del] Delete Manual · [P] Single Slip · [T] Transfer · [Alt+P] Statement · [Esc] Stage List</span>
                <span id="saree-passbook-entry-status">-</span>
            </div>
        `;

        const mainStrip = document.getElementById('saree-main-status-strip');
        if (mainStrip) {
            sec.insertBefore(container, mainStrip);
        } else {
            sec.appendChild(container);
        }

        const fInp = document.getElementById('saree-pass-from-date');
        const tInp = document.getElementById('saree-pass-to-date');
        const sInp = document.getElementById('saree-pass-search-input');
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

    window.__closeSareePassbookView = () => {
        setSareeViewMode('list');
        renderSareeTable();
    };

    window.__sareeTransferFromPass = triggerSelectedSareeTransfer;

    const isSareeEntryLocked = (r) => {
        const isGai = (r.isOut === true) || (safeNum(r.gai) > 0) || String(r.typeLabel || '').includes('➔') || String(r.typeLabel || '').includes('Bheja') || String(r.note || '').includes('bheja');
        const isOpening = (r.isOpening === true) || String(r.typeLabel || '').includes('Opening');
        const isKarigerSheet = Boolean((r.refId && String(r.refId).startsWith('tani_')) || String(r.typeLabel || '').includes('Kariger Sheet'));
        if (isOpening) return 'Opening Stock';
        if (isGai) return 'Outward / Dispatch';
        if (isKarigerSheet) return 'Tani Sheet';
        return '';
    };

    window.__sareePassAction = (action) => {
        const startIndex = (sareePassbookCurrentPage - 1) * SAREE_PAGE_SIZE;
        const pageRows = filteredSareePassbookCache.slice(startIndex, startIndex + SAREE_PAGE_SIZE);
        const entry = pageRows[sareePassbookActiveIdx];
        if (!entry) return alert('Pehle koi entry chunein!');

        if (action === 'print_single') {
            printSingleSareePassbookEntry(entry.id);
            return;
        }

        if (action === 'delete') {
            const lockReason = isSareeEntryLocked(entry);
            if (lockReason) {
                return alert(`Ye entry locked hai (${lockReason}). Sirf manual inward entries delete ki ja sakti hain.`);
            }
            deleteManualSareeEntry(entry.id);
        }
    };

    const openSareePassbook = (safeSaree, safeKariger, safeKid) => {
        ensureSareeTallyStyles();
        setDisplay('dashboard-view', 'none');
        setDisplay('saree-section', 'block');

        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const kId = decodeURIComponent(safeKid);

        activePassbookMeta = { sareeName: sName, karigerName: kName, karkhanaId: kId };
        window.currentPassbookSareeKey = `${normText(sName)}___${normText(kName)}___${normGodownId(kId)}`.toLowerCase();
        window.currentPassbookSareeTitle = `${sName} (${kName})`;
        sareePassbookCurrentPage = 1;
        sareePassbookActiveIdx = 0;

        ensureInlineSareePassbookContainer();
        setSareeViewMode('passbook');
        bindSareeKeyboardEngine();
        applySareePassbookFilters();
    };

    const resetSareePassbookFilters = () => {
        const fDate = document.getElementById('saree-pass-from-date');
        const tDate = document.getElementById('saree-pass-to-date');
        const sInp = document.getElementById('saree-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        sareePassbookCurrentPage = 1;
        sareePassbookActiveIdx = 0;
        applySareePassbookFilters();
    };

    const applySareePassbookFilters = () => {
        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];

        const itemHist = history.filter((r) => {
            if (!r) return false;
            const sName = normText(r.sareeName || r.name, 'GENERAL SAREE');
            const kName = normText(r.karigerName || r.kariger, 'KARKHANA');
            const kid = normGodownId(r.karkhanaId);
            const key = `${sName}___${kName}___${kid}`.toLowerCase();
            const t = normTabName(r.type);

            return key === window.currentPassbookSareeKey && t === window.currentSareeTab.toLowerCase();
        });

        // Compute chronological Running Closing Balance
        const chrono = itemHist.slice().sort((a, b) => {
            const ta = a.timestamp || 0;
            const tb = b.timestamp || 0;
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        let runningBal = 0;
        let totIn = 0;
        let totOut = 0;
        const withRunning = chrono.map((r) => {
            const isGai = (r.isOut === true) || (safeNum(r.gai) > 0) || String(r.typeLabel || '').includes('➔') || String(r.typeLabel || '').includes('Bheja') || String(r.note || '').includes('bheja');
            const inQty = isGai ? 0 : safeInt(r.aai !== undefined ? r.aai : r.pcs);
            const outQty = isGai ? safeInt(r.gai !== undefined ? r.gai : r.pcs) : 0;
            totIn += inQty;
            totOut += outQty;
            runningBal = runningBal + inQty - outQty;
            return { ...r, _inQty: inQty, _outQty: outQty, _isGai: isGai, _runningBal: runningBal };
        });

        const fDate = document.getElementById('saree-pass-from-date')?.value || '';
        const tDate = document.getElementById('saree-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('saree-pass-search-input')?.value || '').toLowerCase().trim();

        let filtered = withRunning;
        if (fDate) filtered = filtered.filter((item) => (item.date || '') >= fDate);
        if (tDate) filtered = filtered.filter((item) => (item.date || '') <= tDate);

        if (sTxt) {
            filtered = filtered.filter((item) => {
                const fullText = `${item.date || ''} ${item.sareeName || ''} ${item.karigerName || ''} ${item.partyName || ''} ${item.targetWorker || ''} ${item.typeLabel || ''} ${item.note || ''} ${item.aai || ''} ${item.gai || ''}`.toLowerCase();
                return fullText.includes(sTxt);
            });
        }

        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredSareePassbookCache = filtered;

        const titleEl = document.getElementById('saree-pass-summary-title');
        const totEl = document.getElementById('saree-pass-summary-totals');
        if (titleEl) titleEl.textContent = `${window.currentPassbookSareeTitle} [${getStageTitle(window.currentSareeTab)}]`;
        if (totEl) {
            totEl.textContent = `Aai: +${totIn} Pcs · Gayi: -${totOut} Pcs · Closing: ${Math.max(0, runningBal)} Pcs`;
        }

        renderPaginatedSareePassbook();
    };

    const highlightSareePassbookRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#saree-passbook-table-body .saree-pass-row'));
        if (!rows.length) return;
        sareePassbookActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === sareePassbookActiveIdx));
        rows[sareePassbookActiveIdx]?.scrollIntoView({ block: 'nearest' });

        const startIndex = (sareePassbookCurrentPage - 1) * SAREE_PAGE_SIZE;
        const pageRows = filteredSareePassbookCache.slice(startIndex, startIndex + SAREE_PAGE_SIZE);
        const entry = pageRows[sareePassbookActiveIdx];
        const statusEl = document.getElementById('saree-passbook-entry-status');
        if (statusEl && entry) {
            const lockReason = isSareeEntryLocked(entry);
            statusEl.textContent = lockReason ? `Locked (${lockReason})` : 'Manual Entry [Del to Delete]';
        }
    };

    const renderPaginatedSareePassbook = () => {
        const tbody = document.getElementById('saree-passbook-table-body');
        const pager = document.getElementById('saree-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredSareePassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:18px; color:#6b7280;">Is Stage par abhi koi len-den nahi hua hai.</td></tr>';
            if (pager) pager.innerHTML = '';
            const statusEl = document.getElementById('saree-passbook-entry-status');
            if (statusEl) statusEl.textContent = '0 Entries';
            return;
        }

        const totalPages = Math.ceil(totalEntries / SAREE_PAGE_SIZE) || 1;
        if (sareePassbookCurrentPage > totalPages) sareePassbookCurrentPage = totalPages;
        if (sareePassbookCurrentPage < 1) sareePassbookCurrentPage = 1;

        const startIndex = (sareePassbookCurrentPage - 1) * SAREE_PAGE_SIZE;
        const pageRows = filteredSareePassbookCache.slice(startIndex, startIndex + SAREE_PAGE_SIZE);
        if (sareePassbookActiveIdx >= pageRows.length) sareePassbookActiveIdx = 0;
        if (sareePassbookActiveIdx < 0) sareePassbookActiveIdx = 0;

        let html = '';
        pageRows.forEach((r, idx) => {
            const inQty = r._inQty;
            const outQty = r._outQty;
            const runBal = safeInt(r._runningBal);
            const lockReason = isSareeEntryLocked(r);

            let partyDisplay = '';
            let typeDisplay = '';

            if (lockReason === 'Opening Stock') {
                partyDisplay = 'Pichla Bacha Stock';
                typeDisplay = 'Opening Stock';
            } else if (r._isGai) {
                partyDisplay = esc(r.partyName || r.targetWorker || r.note || 'Outward');
                typeDisplay = esc(r.typeLabel || 'Saree Out');
            } else if (lockReason === 'Tani Sheet') {
                partyDisplay = esc(r.karigerName || r.kariger || '-');
                typeDisplay = 'Kariger Sheet Se Aai';
            } else {
                partyDisplay = esc(r.partyName || r.targetWorker || r.note || 'Inward');
                typeDisplay = esc(r.typeLabel || 'Tayyar Saree Aai');
            }

            const statusBadge = lockReason
                ? `<span style="font-size:11px; color:#6b7280; font-weight:700;">${esc(lockReason)}</span>`
                : '<span style="font-size:11px; color:#b47d00; font-weight:700;">Manual</span>';

            const activeCls = (idx === sareePassbookActiveIdx) ? ' active' : '';

            html += `<tr class="saree-pass-row${activeCls}" data-spidx="${idx}" onclick="window.__sareeSelectPassRow(${idx})">
                <td>${formatDisplay(r.date)}</td>
                <td><strong>${partyDisplay}</strong></td>
                <td>${typeDisplay}</td>
                <td style="text-align:right; font-weight:700;">${inQty > 0 ? `+${inQty} Pcs` : '-'}</td>
                <td style="text-align:right; font-weight:700; color:#6b7280;">${outQty > 0 ? `-${outQty} Pcs` : '-'}</td>
                <td style="text-align:right; font-weight:800; color:#b47d00;">${runBal} Pcs</td>
                <td style="text-align:center;">${statusBadge}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        highlightSareePassbookRow(sareePassbookActiveIdx);

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#6b7280; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SAREE_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="saree-tally-btn" ${sareePassbookCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSareePassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${sareePassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="saree-tally-btn" ${sareePassbookCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeSareePassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    window.__sareeSelectPassRow = (idx) => {
        highlightSareePassbookRow(idx);
    };

    const changeSareePassbookPage = (delta) => {
        sareePassbookCurrentPage += delta;
        sareePassbookActiveIdx = 0;
        renderPaginatedSareePassbook();
    };

    const deleteManualSareeEntry = (id) => {
        if (!confirm('Kya aap sach me ye manual entry delete karna chahte hain?')) return;

        let history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        history = history.filter((x) => x && String(x.id) !== String(id));

        if (typeof window.setStore === 'function') {
            window.setStore('saree_history', history);
        }

        triggerSareeCacheInvalidation();
        applySareePassbookFilters();
        renderSareeTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }

        alert('✅ Entry delete ho gayi!');
    };

    /* ========================================================================
       9. KEYBOARD NAVIGATION ENGINE FOR #saree-section (ZERO CONFLICTS)
       ======================================================================== */
    const handleSareeKeydown = (e) => {
        const sec = document.getElementById('saree-section');
        if (!sec || sec.style.display === 'none') return;
        if (isAnyExpressOverlayOpen()) return;

        // 1. Transfer Modal open
        const trModal = document.getElementById('saree-transfer-popup-modal');
        if (trModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSareeTransferModal();
            }
            return;
        }

        // 2. Add Saree Form open
        const addForm = document.getElementById('add-saree-form');
        if (addForm && addForm.style.display === 'block') {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleSareeForm();
                return;
            }
            if (e.key === 'Enter') {
                const activeId = document.activeElement?.id || '';
                if (activeId === 'saree-date') { e.preventDefault(); document.getElementById('saree-name')?.focus(); }
                else if (activeId === 'saree-name') { e.preventDefault(); document.getElementById('saree-kariger')?.focus(); }
                else if (activeId === 'saree-kariger') { e.preventDefault(); document.getElementById('saree-pcs')?.focus(); }
                else if (activeId === 'saree-pcs') { e.preventDefault(); saveNewSareeStock(); }
            }
            return;
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            handleSareeBackStep();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            if (sareeViewMode === 'passbook') printSareePassbookFiltered();
            else if (sareeViewMode === 'list') printSareeStockReport();
            return;
        }

        if (e.key === 'F4' && sareeViewMode !== 'hub') {
            e.preventDefault();
            triggerSelectedSareeTransfer();
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            toggleSareeForm();
            return;
        }

        if (e.key === 'F2' && sareeViewMode === 'list') {
            e.preventDefault();
            cycleSareeKarkhanaTab();
            return;
        }

        if (e.key === 'F3' && sareeViewMode !== 'hub') {
            e.preventDefault();
            const sEl = document.getElementById(sareeViewMode === 'passbook' ? 'saree-pass-search-input' : 'search-saree-input');
            if (sEl) { sEl.focus(); sEl.select(); }
            return;
        }

        if (isTyping) return;

        // Guard: Prevent Enter bleed-through right after opening Hub or switching to Stage List
        if (e.key === 'Enter' && (performance.now() - sareeOpenedAt) < 200) {
            return;
        }

        // 3. Level 1: 5-Stage Hub View
        if (sareeViewMode === 'hub') {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                highlightSareeHubRow(sareeHubActiveIdx + (e.key === 'ArrowDown' ? 1 : -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                const st = STAGE_LIST[sareeHubActiveIdx] || STAGE_LIST[0];
                switchSareeStockTab(st.key);
            } else if (e.key === '+') {
                e.preventDefault();
                toggleSareeForm();
            } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                const found = STAGE_LIST.find(s => s.shortcut.toLowerCase() === k || s.num === k);
                if (found) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    switchSareeStockTab(found.key);
                }
            }
            return;
        }

        // 4. Level 3: Inline Passbook View
        if (sareeViewMode === 'passbook') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightSareePassbookRow(sareePassbookActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightSareePassbookRow(sareePassbookActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                changeSareePassbookPage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                changeSareePassbookPage(-1);
            } else if (e.key === 'Delete' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                window.__sareePassAction('delete');
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                window.__sareePassAction('print_single');
            } else if (e.key === 't' || e.key === 'T') {
                e.preventDefault();
                triggerSelectedSareeTransfer();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                document.getElementById('saree-pass-from-date')?.focus();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                resetSareePassbookFilters();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('saree-pass-search-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
            return;
        }

        // 5. Level 2: Main Saree Items List
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightSareeListRow(sareeListActiveIdx + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightSareeListRow(sareeListActiveIdx - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            changeSareeStockPage(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeSareeStockPage(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const pageRows = getSareeCurrentPageRows();
            const chosen = pageRows[sareeListActiveIdx];
            if (chosen) {
                openSareePassbook(
                    encodeURIComponent(chosen.sareeName),
                    encodeURIComponent(chosen.karigerName),
                    encodeURIComponent(chosen.karkhanaId)
                );
            }
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            triggerSelectedSareeTransfer();
        } else if (e.key === '+') {
            e.preventDefault();
            toggleSareeForm();
        } else if (e.key === '/') {
            e.preventDefault();
            const sEl = document.getElementById('search-saree-input');
            if (sEl) { sEl.focus(); sEl.select(); }
        }
    };

    const bindSareeKeyboardEngine = () => {
        if (window.__sareeKeysBound) return;
        window.__sareeKeysBound = true;
        document.addEventListener('keydown', handleSareeKeydown);
    };

    /* ========================================================================
       10. PRINT ENGINES (UNCHANGED)
       ======================================================================== */
    const getSareeKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Godam (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printSareeStockReport = () => {
        const rows = currentSareeFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi saree stock nahi mila!');
        }

        const kName = getSareeKarkhanaPrintName(window.currentSareeKarkhanaFilter);
        const stageName = (window.currentSareeTab || 'fresh').toUpperCase() + ' SAREE';
        const today = new Date().toLocaleDateString('hi-IN');

        let totalAai = 0;
        let totalGai = 0;
        let totalBachi = 0;

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            const aai = safeInt(r.aai);
            const gai = safeInt(r.gai);
            const bachi = safeInt(r.bachi);

            totalAai += aai;
            totalGai += gai;
            totalBachi += bachi;

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:4px 2px;">${idx + 1}</td>
                    <td style="padding:4px 2px; font-weight:bold;">${esc(r.sareeName)}</td>
                    <td style="padding:4px 2px;">${esc(r.karigerName || '-')}</td>
                    <td style="padding:4px 2px; text-align:right;">+${aai}</td>
                    <td style="padding:4px 2px; text-align:right;">-${gai}</td>
                    <td style="padding:4px 2px; text-align:right; font-weight:bold;">${bachi}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Stock Report - A6</title>
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
                        <p><strong>${stageName} STOCK REPORT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Godam:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Saree Types:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>SAREE</th><th>MAKER</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th><th style="text-align:right;">BACHI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aai Saree:</span> <span>+${totalAai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gai Saree:</span> <span>-${totalGai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI SAREE:</span> <span>${totalBachi} Pcs</span>
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

    const printSareePassbookFiltered = () => {
        const rows = filteredSareePassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const title = window.currentPassbookSareeTitle || 'Saree Passbook';
        const tabStage = (window.currentSareeTab || 'fresh').toUpperCase();
        const fDate = document.getElementById('saree-pass-from-date')?.value || '';
        const tDate = document.getElementById('saree-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAai = 0;
        let totalGai = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const isGai = (r.isOut === true) || (safeNum(r.gai) > 0) || String(r.typeLabel || '').includes('➔') || String(r.typeLabel || '').includes('Bheja') || String(r.note || '').includes('bheja');
            const inQty = isGai ? 0 : safeInt(r.aai !== undefined ? r.aai : r.pcs);
            const outQty = isGai ? safeInt(r.gai !== undefined ? r.gai : r.pcs) : 0;

            totalAai += inQty;
            totalGai += outQty;

            const partyInfo = r.partyName || r.targetWorker || r.note || r.karigerName || 'Movement';
            const vivran = r.typeLabel || 'Saree Movement';

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${formatDisplay(r.date)}</td>
                    <td style="padding:3px 2px; font-weight:600;">${esc(vivran)}</td>
                    <td style="padding:3px 2px;">${esc(partyInfo)}</td>
                    <td style="padding:3px 2px; text-align:right;">${inQty > 0 ? `+${inQty}` : '-'}</td>
                    <td style="padding:3px 2px; text-align:right;">${outQty > 0 ? `-${outQty}` : '-'}</td>
                </tr>`;
        });

        const netBalance = totalAai - totalGai;

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Passbook - A6</title>
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
                        <p><strong>SAREE PASSBOOK STATEMENT (${tabStage})</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Saree Details:</strong> ${esc(title)}</div>
                        <div><strong>Filter Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Kul Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>DETAIL</th><th>PARTY</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aai Saree:</span> <span>+${totalAai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gai Saree:</span> <span>-${totalGai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI SAREE:</span> <span>${netBalance} Pcs</span>
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

    const printSingleSareePassbookEntry = (id) => {
        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        const entry = history.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const sName = entry.sareeName || entry.name || 'Saree';
        const party = entry.partyName || entry.targetWorker || entry.karigerName || entry.kariger || '-';
        const godamName = getSareeKarkhanaPrintName(entry.karkhanaId);
        const isGai = (entry.isOut === true) || (safeNum(entry.gai) > 0) || String(entry.typeLabel || '').includes('➔') || String(entry.note || '').includes('bheja');
        const pcs = isGai ? safeInt(entry.gai !== undefined ? entry.gai : entry.pcs) : safeInt(entry.aai !== undefined ? entry.aai : entry.pcs);
        const pcsDisplay = isGai ? `-${pcs} Pcs` : `+${pcs} Pcs`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Voucher - A6</title>
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
                        <p>SAREE LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${formatDisplay(entry.date)}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(godamName)}</span></div>
                    <div class="row"><span><strong>Saree Name:</strong></span><span>${esc(sName)}</span></div>
                    <div class="row"><span><strong>Party / Karigar:</strong></span><span>${esc(party)}</span></div>
                    <div class="row"><span><strong>Detail:</strong></span><span>${esc(entry.typeLabel || entry.type || 'Movement')}</span></div>
                    <div class="total-highlight">
                        KUL SAREE: ${pcsDisplay}
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
       11. GLOBAL EXPORT
       ======================================================================== */
    const sareeUIAPI = {
        openSareeModule,
        switchSareeStockTab,
        renderSareeKarkhanaTabs,
        switchSareeKarkhanaTab,
        filterSaree,
        changeSareeStockPage,
        printSareeStockReport,
        toggleSareeForm,
        saveNewSareeStock,
        renderSareeTable,
        openSareeTransferModal,
        closeSareeTransferModal,
        toggleSareeTransferFields,
        submitSareeTransferForm,
        openSareePassbook,
        resetSareePassbookFilters,
        applySareePassbookFilters,
        changeSareePassbookPage,
        printSareePassbookFiltered,
        printSingleSareePassbookEntry,
        deleteManualSareeEntry
    };

    Object.keys(sareeUIAPI).forEach((fnName) => {
        window[fnName] = sareeUIAPI[fnName];
    });

    window.SareeUIEngine = sareeUIAPI;

    document.addEventListener('DOMContentLoaded', () => {
        bindSareeSearchInput();
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sareeUIAPI;
    }
})();
