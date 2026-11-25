/* ============================================================================
   SIMPLICITY ERP - KARIGER INFO LEDGER (TALLYPRIME WHITE & GOLD DIRECTORY)
   File: info/info-ledger.js • Developed by Farhan Jawed
   Architecture: Row-by-Row Global Sync + Live Sheet Auto-Sync + 20-Row Paging
   UX: Clean White & Gold Table -> Enter/Click Inline Editor -> F8 Tani Sheet
   Hardening: Double-Load Guard • 200ms Search Debounce • Save Lock • PWA Safe UI
============================================================================ */

(() => {
    'use strict';

    if (window._infoLedgerLoaded) {
        console.warn('[InfoLedger] Already loaded — skip duplicate');
        return;
    }
    window._infoLedgerLoaded = true;

    const PAGE_SIZE = 20;
    const META_ROW_ID = '__columns__';

    let currentKarkhanaFilter = 'all';
    let currentSearchQuery = '';
    let currentPage = 1;
    let listActiveIdx = 0;
    let currentPageRowsCache = [];
    let currentFilteredRowsCache = [];

    let infoViewMode = 'list'; // 'list' | 'edit'
    let activeEditKarigerId = null;
    let infoOpenedAt = 0;

    let isInternalSyncRunning = false;
    let isSavingInfoEdit = false;
    let syncTimer = null;
    let searchDebounceTimer = null;

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s ?? '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const isAnyOtherOverlayOpen = () => {
        if (
            document.getElementById('kariger-express-modal') ||
            document.getElementById('master-stock-express-modal') ||
            document.getElementById('master-jobwork-express-modal') ||
            document.getElementById('tani-express-modal') ||
            document.getElementById('client-payment-modal') ||
            document.getElementById('kariger-portal-admin-modal')
        ) {
            return true;
        }
        return Array.from(document.querySelectorAll('.modal-overlay, #profile-modal'))
            .some((m) => m.style.display && m.style.display !== 'none');
    };

    const getKarigersSafe = () => {
        if (typeof window.sanitizeKarigerList === 'function') {
            return window.sanitizeKarigerList();
        }
        const raw = typeof window.getStore === 'function' ? window.getStore('kariger_list') : [];
        const list = Array.isArray(raw) ? raw : [];
        return list.filter((k) => k && k.name && String(k.name).trim() !== '');
    };

    const getSheetsSafe = (karigerId) => {
        if (!karigerId) return [];
        if (typeof window.getKarigerSheets === 'function') {
            const sh = window.getKarigerSheets(karigerId);
            return Array.isArray(sh) ? sh : [];
        }
        const raw = typeof window.getStore === 'function' ? window.getStore(`kariger_sheets_${karigerId}`) : [];
        return Array.isArray(raw) ? raw : [];
    };

    const getStoredInfoArray = () => {
        const raw = typeof window.getStore === 'function' ? window.getStore('info_ledger') : [];
        return Array.isArray(raw) ? raw : [];
    };

    const extractLatestSheetInfo = (karigerId) => {
        const sheets = getSheetsSafe(karigerId);
        const latest = sheets.length ? sheets[sheets.length - 1] : null;
        if (!latest || typeof latest !== 'object') {
            return { bana: '', zari: '', chukka: '', tani: '', bani: '' };
        }

        const bana = String(latest.banaItem || '').trim();
        const zari = String(latest.zariItem || '').trim();

        const chukkaItem = String(latest.chukkaItem || '').trim();
        const chukkaSancha = String(latest.chukkaSancha || '').trim();
        let chukka = '';
        if (chukkaItem && chukkaSancha && chukkaItem.toLowerCase() !== chukkaSancha.toLowerCase()) {
            chukka = `${chukkaItem} (${chukkaSancha})`;
        } else {
            chukka = chukkaItem || chukkaSancha;
        }

        const taniItem = String(latest.taniItem || '').trim();
        const taniSancha = String(latest.taniSancha || '').trim();
        let tani = '';
        if (taniItem && taniSancha && taniItem.toLowerCase() !== taniSancha.toLowerCase()) {
            tani = `${taniItem} (${taniSancha})`;
        } else {
            tani = taniItem || taniSancha;
        }

        const baniRaw = latest.rateBani;
        const bani = (baniRaw !== undefined && baniRaw !== null && String(baniRaw).trim() !== '')
            ? String(baniRaw).trim()
            : '';

        return { bana, zari, chukka, tani, bani };
    };

    const buildMergedSnapshot = () => {
        const rawArr = getStoredInfoArray();
        let metaRow = null;
        const storedById = new Map();

        rawArr.forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const rid = String(row.id || '').trim();
            if (!rid) return;
            if (rid === META_ROW_ID || row.rowType === 'columns_meta') {
                metaRow = {
                    id: META_ROW_ID,
                    rowType: 'columns_meta',
                    customCols: Array.isArray(row.customCols)
                        ? row.customCols.filter((c) => c && c.id && c.label)
                        : []
                };
            } else {
                storedById.set(rid, row);
            }
        });

        if (!metaRow) {
            metaRow = { id: META_ROW_ID, rowType: 'columns_meta', customCols: [] };
        }

        const karigers = getKarigersSafe();
        const mergedRows = [];

        karigers.forEach((k) => {
            const kid = String(k.id || '').trim();
            if (!kid) return;

            const prev = storedById.get(kid) || {};
            const liveSheet = extractLatestSheetInfo(kid);
            const addr = String(k.mohalla || k.address || k.pata || '').trim();

            mergedRows.push({
                id: kid,
                rowType: 'kariger_info',
                karigerId: kid,
                name: String(k.name || '').trim(),
                saree: String(k.saree || '').trim(),
                mobile: String(k.mobile || '').trim(),
                address: addr,
                bana: liveSheet.bana,
                zari: liveSheet.zari,
                chukka: liveSheet.chukka,
                tani: liveSheet.tani,
                bani: liveSheet.bani,
                kadi: String(prev.kadi || ''),
                baithka: String(prev.baithka || ''),
                custom: (prev.custom && typeof prev.custom === 'object' && !Array.isArray(prev.custom))
                    ? { ...prev.custom }
                    : {},
                karkhanaId: k.karkhanaId || 'k_main',
                karkhanaName: k.karkhanaName || ''
            });
        });

        return { metaRow, mergedRows, rawArr };
    };

    const persistInfoArrayIfChanged = (metaRow, mergedRows, rawArr, forceSave = false) => {
        if (window.isBackupPreviewMode || window.isRemoteUpdating || isInternalSyncRunning) return;
        if (typeof window.setStore !== 'function') return;

        const nextArr = [
            {
                id: META_ROW_ID,
                rowType: 'columns_meta',
                customCols: metaRow.customCols || []
            },
            ...mergedRows.map((r) => ({
                id: r.id,
                rowType: 'kariger_info',
                karigerId: r.karigerId,
                name: r.name,
                saree: r.saree,
                mobile: r.mobile,
                address: r.address,
                bana: r.bana,
                zari: r.zari,
                chukka: r.chukka,
                tani: r.tani,
                bani: r.bani,
                kadi: r.kadi,
                baithka: r.baithka,
                custom: r.custom || {}
            }))
        ];

        if (!forceSave) {
            let prevStr = '';
            let nextStr = '';
            try {
                prevStr = JSON.stringify(rawArr);
                nextStr = JSON.stringify(nextArr);
            } catch (_) {}
            if (prevStr === nextStr) return;
        }

        isInternalSyncRunning = true;
        try {
            window.setStore('info_ledger', nextArr);
        } finally {
            isInternalSyncRunning = false;
        }
    };

    const syncAllKarigersToInfoLedger = () => {
        if (window.isBackupPreviewMode || window.isRemoteUpdating) return;
        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, false);
        updateInfoLedgerBadge();
        const sec = document.getElementById('info-ledger-section');
        if (sec && sec.style.display !== 'none' && infoViewMode === 'list') {
            renderInfoLedgerTable(false);
        }
    };

    const scheduleInfoLedgerSync = () => {
        if (window.isBackupPreviewMode || window.isRemoteUpdating) return;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            syncTimer = null;
            syncAllKarigersToInfoLedger();
        }, 120);
    };

    const showInfoToast = (msg) => {
        const el = document.getElementById('il-toast-msg');
        if (!el) return;
        const orig = el.dataset.origText || el.textContent;
        if (!el.dataset.origText) el.dataset.origText = orig;
        el.textContent = msg;
        clearTimeout(el.__tTimer);
        el.__tTimer = setTimeout(() => {
            el.textContent = el.dataset.origText || orig;
        }, 3800);
    };

    const setColModalMsg = (msg, isError = true) => {
        const el = document.getElementById('il-col-modal-msg');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.style.display = 'block';
        el.style.color = isError ? '#b91c1c' : '#15803d';
        el.style.background = isError ? '#fef2f2' : '#ecfdf5';
        el.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
        el.textContent = msg;
    };

    /* ========================================================================
       SCOPED TALLYPRIME WHITE & GOLD STYLES (#info-ledger-section)
    ======================================================================== */
    const ensureInfoLedgerStyles = () => {
        const old = document.getElementById('info-ledger-styles');
        if (old) old.remove();

        const st = document.createElement('style');
        st.id = 'info-ledger-styles';
        st.textContent = `
            #info-ledger-section {
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                overflow-x: hidden !important;
                background: #ffffff !important;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #info-ledger-section * { box-sizing: border-box; }
            #info-ledger-section .il-topbar {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 18px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            #info-ledger-section .il-topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            #info-ledger-section .il-topbar h2 {
                margin: 0;
                font-size: 16px;
                font-weight: 800;
                color: #1f2937;
            }
            #info-ledger-section .il-btn {
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
            #info-ledger-section .il-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
                color: #1f2937;
            }
            #info-ledger-section .il-btn-gold {
                background: #f2b71d;
                color: #1f2937;
                border: 1px solid #d9a425;
                border-radius: 5px;
                padding: 5px 12px;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
                white-space: nowrap;
            }
            #info-ledger-section .il-btn-gold:hover { background: #e5aa12; }
            #info-ledger-section .il-body {
                padding: 12px 18px 0 18px;
            }
            #info-ledger-section #info-karkhana-tabs-bar {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                margin-bottom: 10px;
            }
            #info-ledger-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #info-ledger-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #info-ledger-section .il-search-bar {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
                margin-bottom: 10px;
            }
            #info-ledger-section .il-search-wrap {
                position: relative;
                flex: 1;
                min-width: 220px;
                display: flex;
                align-items: center;
            }
            #info-ledger-section .il-search-input {
                width: 100%;
                padding: 7px 32px 7px 11px;
                border: 1px solid #d1d5db;
                border-radius: 5px;
                font-size: 13px;
                font-weight: 600;
                color: #111827;
                background: #ffffff;
                outline: none;
            }
            #info-ledger-section .il-search-input:focus {
                border-color: #d9a425;
                background: #fffdf5;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #info-ledger-section .il-clear-btn {
                position: absolute;
                right: 7px;
                background: #fdf6e2;
                color: #92400e;
                border: 1px solid #e5d5a7;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
            }
            #info-ledger-section .il-table-wrap {
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                background: #ffffff;
                overflow-x: auto;
            }
            #info-ledger-section .il-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                background: #ffffff;
            }
            #info-ledger-section .il-table thead tr {
                background: #fdf6e2;
                color: #1f2937;
            }
            #info-ledger-section .il-table th {
                padding: 8px 8px;
                text-align: left;
                font-weight: 800;
                font-size: 11px;
                color: #1f2937;
                border-bottom: 1.5px solid #e5d5a7;
                white-space: nowrap;
            }
            #info-ledger-section .il-table td {
                padding: 8px 8px;
                border-bottom: 1px solid #f3f4f6;
                color: #1f2937;
                font-size: 12.5px;
                vertical-align: middle;
                font-variant-numeric: tabular-nums;
            }
            #info-ledger-section .il-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #info-ledger-section .il-row:hover { background: #fef9ea; }
            #info-ledger-section .il-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #info-ledger-section .il-row.active td {
                font-weight: 700;
                color: #1f2937 !important;
            }
            #info-ledger-section .il-plus-th-btn {
                background: #ffffff;
                color: #92400e;
                border: 1px solid #d9b86c;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                font-size: 15px;
                font-weight: 900;
                line-height: 1;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            #info-ledger-section .il-plus-th-btn:hover {
                background: #f2b71d;
                color: #1f2937;
                border-color: #d9a425;
            }
            #info-ledger-section .il-pag-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
                padding: 8px 0;
                border-top: 1px solid #eadab0;
                font-size: 12px;
            }
            #info-ledger-section .il-status-strip {
                background: #fdf6e2;
                border-top: 1px solid #e5d5a7;
                padding: 8px 18px;
                margin-top: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                font-size: 11.5px;
                color: #6b7280;
                font-weight: 600;
            }

            /* --- INLINE KARIGER INFO EDITOR (1-FIELD-PER-ROW) --- */
            #info-ledger-section .il-edit-card {
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                background: #ffffff;
                overflow: hidden;
                margin-bottom: 12px;
            }
            #info-ledger-section .il-edit-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            #info-ledger-section .il-live-strip {
                background: #fdfcf7;
                border-bottom: 1px solid #e5d5a7;
                padding: 9px 14px;
                display: flex;
                gap: 14px;
                flex-wrap: wrap;
                font-size: 12px;
                color: #374151;
            }
            #info-ledger-section .il-live-strip span strong {
                color: #92400e;
            }
            #info-ledger-section .il-edit-form {
                padding: 14px 18px;
                max-width: 680px;
            }
            #info-ledger-section .il-form-row {
                display: grid;
                grid-template-columns: 155px minmax(0, 1fr);
                align-items: center;
                gap: 10px;
                margin-bottom: 9px;
                min-width: 0;
            }
            #info-ledger-section .il-form-row label {
                font-size: 12.5px;
                font-weight: 700;
                color: #374151;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #info-ledger-section .il-inp {
                width: 100%;
                min-width: 0;
                padding: 7px 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 700;
                color: #111827;
                background: #ffffff;
                outline: none;
            }
            #info-ledger-section .il-inp:focus {
                border-color: #d9a425;
                background: #fffdf5;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            #info-ledger-section .il-accept-bar {
                background: #fdf6e2;
                border: 1.5px solid #d9a425;
                border-radius: 5px;
                padding: 8px 12px;
                margin-top: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            /* --- COLUMN MANAGER MODAL --- */
            .il-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 15px;
                font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            }
            .il-modal-card {
                background: #ffffff;
                width: 100%;
                max-width: 470px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                color: #1f2937;
            }
            .il-modal-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 11px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .il-modal-head h3 { margin: 0; font-size: 15px; font-weight: 800; }
        `;
        document.head.appendChild(st);
    };

    const ensureInfoLedgerSection = () => {
        ensureInfoLedgerStyles();

        let sec = document.getElementById('info-ledger-section');
        if (sec) return sec;

        const container = document.querySelector('.main-container') || document.body;
        sec = document.createElement('section');
        sec.id = 'info-ledger-section';
        sec.className = 'module-section';
        sec.style.display = 'none';
        sec.innerHTML = `
            <div class="il-topbar">
                <div class="il-topbar-left">
                    <button type="button" class="il-btn" id="il-header-back-btn" onclick="window.__ilBackStep()">← [Esc] Dashboard</button>
                    <h2 id="il-header-title">Info Ledger — Kariger Directory</h2>
                </div>
                <div style="display:flex; gap:7px; align-items:center; flex-wrap:wrap;">
                    <button type="button" class="il-btn" onclick="window.__ilOpenSelectedTaniSheet()">Open Tani Sheet [F8]</button>
                    <button type="button" class="il-btn" onclick="window.__ilPrintDirectory()">A6 Print [Alt+P]</button>
                    <button type="button" class="il-btn-gold" onclick="addInfoLedgerCustomColumn()">+ Naya Column [F7]</button>
                </div>
            </div>

            <div class="il-body">
                <div id="info-karkhana-tabs-bar"></div>

                <div class="il-search-bar" id="il-search-bar-wrap">
                    <div class="il-search-wrap">
                        <input type="text" id="search-info-ledger-input" class="il-search-input"
                               placeholder="Search [/]: Name, Saree, Mob, Address, Bana, Zari, Chukka, Tani, Kadi, Baithka..."
                               oninput="handleInfoLedgerSearch(this.value)">
                        <button type="button" id="info-search-clear-btn" class="il-clear-btn" onclick="clearInfoLedgerSearch()" title="Clear Search">×</button>
                    </div>
                    <div id="info-search-stats" style="font-size:12px; font-weight:700; color:#6b7280;"></div>
                </div>

                <div id="il-list-view">
                    <div class="il-table-wrap">
                        <table class="il-table">
                            <thead id="info-ledger-thead"></thead>
                            <tbody id="info-ledger-tbody"></tbody>
                        </table>
                    </div>
                    <div id="info-ledger-pagination-bar" class="il-pag-bar"></div>
                </div>

                <div id="il-edit-view" style="display:none;"></div>
            </div>

            <div class="il-status-strip">
                <span id="il-toast-msg" style="color:#92400e; font-weight:700;">[↑ ↓] Row · [Enter / Click] Edit Info · [F8] Tani Sheet · [F7 / +] Columns · [F2] Karkhana · [/] Search · [Alt+P] Print · [Esc] Back</span>
                <span id="il-foot-count">0 Karigers</span>
            </div>
        `;
        container.appendChild(sec);

        const sInp = document.getElementById('search-info-ledger-input');
        if (sInp && !sInp.dataset.ilKeyBound) {
            sInp.dataset.ilKeyBound = 'true';
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    sInp.blur();
                    if (e.key === 'Enter' && currentPageRowsCache.length > 0) {
                        const chosen = currentPageRowsCache[listActiveIdx] || currentPageRowsCache[0];
                        if (chosen) openInfoRowEditor(chosen.id);
                    }
                }
            });
        }

        return sec;
    };

    const updateInfoLedgerBadge = () => {
        const badge = document.getElementById('btn-total-info');
        if (!badge) return;
        const count = getKarigersSafe().length;
        badge.textContent = `Total: ${count}`;
    };

    /* ========================================================================
       VIEW MODE TOGGLING (LIST vs INLINE EDITOR)
    ======================================================================== */
    const setInfoViewMode = (mode, titleSuffix = '') => {
        infoViewMode = mode; // 'list' | 'edit'
        const isList = (mode === 'list');

        const tabsBar = document.getElementById('info-karkhana-tabs-bar');
        const searchBar = document.getElementById('il-search-bar-wrap');
        const listView = document.getElementById('il-list-view');
        const editView = document.getElementById('il-edit-view');
        const titleEl = document.getElementById('il-header-title');
        const backBtn = document.getElementById('il-header-back-btn');

        if (tabsBar) tabsBar.style.display = isList ? 'flex' : 'none';
        if (searchBar) searchBar.style.display = isList ? 'flex' : 'none';
        if (listView) listView.style.display = isList ? 'block' : 'none';
        if (editView) editView.style.display = isList ? 'none' : 'block';

        if (titleEl) {
            titleEl.textContent = isList
                ? 'Info Ledger — Kariger Directory'
                : `Kariger Info: ${titleSuffix || '-'}`;
        }
        if (backBtn) {
            backBtn.textContent = isList ? '← [Esc] Dashboard' : '← [Esc] Directory';
        }
    };

    window.__ilBackStep = () => {
        if (infoViewMode === 'edit') {
            activeEditKarigerId = null;
            setInfoViewMode('list');
            renderInfoLedgerTable(false);
            return;
        }
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    };

    /* ========================================================================
       KARKHANA TABS, SEARCH (200ms DEBOUNCED) & 20-ROW PAGINATION
    ======================================================================== */
    const renderInfoKarkhanaTabs = (allRows) => {
        const bar = document.getElementById('info-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (Array.isArray(window.getStore?.('karkhana_list')) ? window.getStore('karkhana_list') : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        let html = `<button type="button" class="sheet-tab ${currentKarkhanaFilter === 'all' ? 'active' : ''}" onclick="switchInfoKarkhanaTab('all')">Sabhi (${allRows.length})</button>`;

        karkhanas.forEach((k) => {
            const count = allRows.filter((r) =>
                String(r.karkhanaId) === String(k.id) || (!r.karkhanaId && (k.isDefault || k.id === 'k_main'))
            ).length;
            const isActive = String(currentKarkhanaFilter) === String(k.id) ? 'active' : '';
            html += `<button type="button" class="sheet-tab ${isActive}" onclick="switchInfoKarkhanaTab(decodeURIComponent('${encodeURIComponent(String(k.id))}'))">${esc(k.name)} (${count})</button>`;
        });

        bar.innerHTML = html;
    };

    const switchInfoKarkhanaTab = (kId) => {
        currentKarkhanaFilter = kId || 'all';
        currentPage = 1;
        listActiveIdx = 0;
        renderInfoLedgerTable(false);
    };

    const cycleInfoKarkhanaTab = () => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (Array.isArray(window.getStore?.('karkhana_list')) ? window.getStore('karkhana_list') : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];
        const ids = ['all', ...karkhanas.map((k) => String(k.id))];
        const curIdx = ids.indexOf(String(currentKarkhanaFilter));
        switchInfoKarkhanaTab(ids[(curIdx + 1) % ids.length]);
    };

    const handleInfoLedgerSearch = (val) => {
        currentSearchQuery = String(val || '');
        currentPage = 1;
        listActiveIdx = 0;
        const clearBtn = document.getElementById('info-search-clear-btn');
        if (clearBtn) clearBtn.style.display = currentSearchQuery.trim() ? 'flex' : 'none';

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            searchDebounceTimer = null;
            renderInfoLedgerTable(false);
        }, 200);
    };

    const clearInfoLedgerSearch = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
        const inp = document.getElementById('search-info-ledger-input');
        if (inp) inp.value = '';
        currentSearchQuery = '';
        currentPage = 1;
        listActiveIdx = 0;
        const clearBtn = document.getElementById('info-search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        renderInfoLedgerTable(false);
    };

    const nextInfoLedgerPage = () => {
        currentPage++;
        listActiveIdx = 0;
        renderInfoLedgerTable(false);
    };

    const prevInfoLedgerPage = () => {
        if (currentPage > 1) {
            currentPage--;
            listActiveIdx = 0;
            renderInfoLedgerTable(false);
        }
    };

    /* ========================================================================
       TALLY WHITE & GOLD COLUMN MANAGER MODAL (ZERO BROWSER PROMPT / CONFIRM)
    ======================================================================== */
    const closeInfoColumnModal = () => {
        const m = document.getElementById('il-col-modal');
        if (m) m.remove();
    };

    const openInfoColumnModal = (inlineRenameId = null, inlineDeleteId = null) => {
        if (window.isBackupPreviewMode) {
            showInfoToast('⚠️ Preview Mode me column edit nahi ho sakta.');
            return;
        }
        closeInfoColumnModal();

        const { metaRow } = buildMergedSnapshot();
        const customCols = Array.isArray(metaRow.customCols) ? metaRow.customCols : [];

        const colsListHtml = customCols.length
            ? customCols.map((c) => {
                const cid = String(c.id);
                const encCid = encodeURIComponent(cid);
                if (inlineRenameId && String(inlineRenameId) === cid) {
                    return `
                    <div style="display:flex; gap:6px; align-items:center; padding:7px 10px; border-bottom:1px solid #f3f4f6; background:#fffdf5;">
                        <input type="text" id="il-rename-col-inp" maxlength="40" value="${esc(c.label)}" style="flex:1; padding:5px 8px; border:1px solid #d9a425; border-radius:4px; font-size:12.5px; font-weight:700;">
                        <button type="button" onclick="window.__ilConfirmRenameCol(decodeURIComponent('${encCid}'))" style="background:#f2b71d; color:#1f2937; border:1px solid #d9a425; border-radius:4px; padding:4px 9px; font-size:11px; font-weight:800; cursor:pointer;">Save</button>
                        <button type="button" onclick="window.__ilRefreshColModal()" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:700; cursor:pointer;">Cancel</button>
                    </div>`;
                }
                if (inlineDeleteId && String(inlineDeleteId) === cid) {
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px; border-bottom:1px solid #f3f4f6; background:#fef2f2;">
                        <span style="font-size:12px; font-weight:700; color:#b91c1c;">'${esc(c.label)}' sabhi rows se hatayein?</span>
                        <div style="display:flex; gap:6px;">
                            <button type="button" onclick="window.__ilConfirmDeleteCol(decodeURIComponent('${encCid}'))" style="background:#dc2626; color:#ffffff; border:none; border-radius:4px; padding:4px 9px; font-size:11px; font-weight:800; cursor:pointer;">Yes, Del</button>
                            <button type="button" onclick="window.__ilRefreshColModal()" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:700; cursor:pointer;">No</button>
                        </div>
                    </div>`;
                }
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px; border-bottom:1px solid #f3f4f6;">
                    <strong style="font-size:12.5px; color:#1f2937;">${esc(c.label)}</strong>
                    <div style="display:flex; gap:6px;">
                        <button type="button" onclick="renameInfoLedgerCustomColumn(decodeURIComponent('${encCid}'))" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer;">Rename</button>
                        <button type="button" onclick="deleteInfoLedgerCustomColumn(decodeURIComponent('${encCid}'))" style="background:#ffffff; color:#92400e; border:1px solid #d9b86c; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer;">Del</button>
                    </div>
                </div>`;
            }).join('')
            : '<div style="padding:12px; text-align:center; font-size:12px; color:#6b7280;">Abhi koi extra column nahi bana hai.</div>';

        const modalHtml = `
            <div id="il-col-modal" class="il-modal-overlay">
                <div class="il-modal-card">
                    <div class="il-modal-head">
                        <h3>Manage Custom Columns (+)</h3>
                        <button type="button" onclick="window.__ilCloseColModal()" style="background:#ffffff; border:1px solid #d1d5db; border-radius:4px; padding:4px 9px; font-size:12px; font-weight:700; cursor:pointer;">[Esc] Close</button>
                    </div>
                    <div style="padding:14px 16px;">
                        <label for="il-new-col-name" style="display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:5px;">Naya Column Naam (jaise: Loom No, Paai, Border, Note):</label>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <input type="text" id="il-new-col-name" maxlength="40" placeholder="Column Name..." style="flex:1; padding:7px 10px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; font-weight:700; outline:none;">
                            <button type="button" onclick="window.__ilSaveNewColumn()" style="background:#f2b71d; color:#1f2937; border:1px solid #d9a425; border-radius:5px; padding:7px 14px; font-size:12px; font-weight:800; cursor:pointer;">Add [Enter]</button>
                        </div>

                        <div id="il-col-modal-msg" style="display:none; font-size:12px; font-weight:700; padding:6px 9px; border-radius:5px; border:1px solid #fecaca; margin-bottom:10px;"></div>

                        <div style="border:1px solid #e5d5a7; border-radius:6px; overflow:hidden;">
                            <div style="background:#fdf6e2; padding:7px 10px; font-size:11.5px; font-weight:800; color:#92400e; border-bottom:1px solid #e5d5a7;">Maujooda Custom Columns (${customCols.length})</div>
                            <div style="max-height:220px; overflow-y:auto;">${colsListHtml}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        if (inlineRenameId) {
            const renInp = document.getElementById('il-rename-col-inp');
            if (renInp) {
                renInp.focus();
                renInp.select();
                renInp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        window.__ilConfirmRenameCol(inlineRenameId);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        openInfoColumnModal();
                    }
                });
            }
        } else {
            const inp = document.getElementById('il-new-col-name');
            if (inp) {
                if (!inlineDeleteId) inp.focus();
                inp.addEventListener('input', () => setColModalMsg(''));
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        window.__ilSaveNewColumn();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        closeInfoColumnModal();
                    }
                });
            }
        }
    };

    window.__ilCloseColModal = closeInfoColumnModal;
    window.__ilRefreshColModal = () => openInfoColumnModal();

    window.__ilSaveNewColumn = () => {
        const inp = document.getElementById('il-new-col-name');
        const cleanLabel = String(inp?.value || '').trim().slice(0, 40);
        if (!cleanLabel) {
            setColModalMsg('⚠️ Pehle Column ka naam likhein!', true);
            inp?.focus();
            return;
        }

        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        const duplicate = (metaRow.customCols || []).some(
            (c) => String(c.label || '').trim().toLowerCase() === cleanLabel.toLowerCase()
        );
        if (duplicate) {
            setColModalMsg('⚠️ Is naam ka column pehle se maujood hai!', true);
            inp?.focus();
            return;
        }

        metaRow.customCols.push({ id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: cleanLabel });
        persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, true);
        closeInfoColumnModal();
        if (infoViewMode === 'edit' && activeEditKarigerId) openInfoRowEditor(activeEditKarigerId);
        else renderInfoLedgerTable(false);
        showInfoToast(`✅ Column [${cleanLabel}] add ho gaya!`);
    };

    const addInfoLedgerCustomColumn = () => {
        openInfoColumnModal();
    };

    window.__ilConfirmRenameCol = (colId) => {
        const renInp = document.getElementById('il-rename-col-inp');
        const nextLabel = String(renInp?.value || '').trim().slice(0, 40);
        if (!nextLabel) {
            setColModalMsg('⚠️ Column ka naya naam likhein!', true);
            renInp?.focus();
            return;
        }

        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        const col = (metaRow.customCols || []).find((c) => String(c.id) === String(colId));
        if (!col) return;

        const duplicate = (metaRow.customCols || []).some(
            (c) => String(c.id) !== String(colId) && String(c.label || '').trim().toLowerCase() === nextLabel.toLowerCase()
        );
        if (duplicate) {
            setColModalMsg('⚠️ Is naam ka column pehle se maujood hai!', true);
            renInp?.focus();
            return;
        }

        col.label = nextLabel;
        persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, true);
        openInfoColumnModal();
        if (infoViewMode === 'edit' && activeEditKarigerId) openInfoRowEditor(activeEditKarigerId);
        else renderInfoLedgerTable(false);
        showInfoToast(`✅ Column rename ho gaya: ${col.label}`);
    };

    window.__ilConfirmDeleteCol = (colId) => {
        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        const col = (metaRow.customCols || []).find((c) => String(c.id) === String(colId));
        if (!col) return;

        metaRow.customCols = (metaRow.customCols || []).filter((c) => String(c.id) !== String(colId));
        mergedRows.forEach((r) => {
            if (r.custom && Object.prototype.hasOwnProperty.call(r.custom, colId)) {
                delete r.custom[colId];
            }
        });

        persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, true);
        openInfoColumnModal();
        if (infoViewMode === 'edit' && activeEditKarigerId) openInfoRowEditor(activeEditKarigerId);
        else renderInfoLedgerTable(false);
        showInfoToast(`🗑️ Column [${col.label}] delete ho gaya.`);
    };

    const renameInfoLedgerCustomColumn = (colId) => {
        if (window.isBackupPreviewMode) {
            showInfoToast('⚠️ Preview Mode me rename nahi ho sakta.');
            return;
        }
        openInfoColumnModal(colId, null);
    };

    const deleteInfoLedgerCustomColumn = (colId) => {
        if (window.isBackupPreviewMode) {
            showInfoToast('⚠️ Preview Mode me delete nahi ho sakta.');
            return;
        }
        openInfoColumnModal(null, colId);
    };

    /* ========================================================================
       INLINE KARIGER INFO EDITOR (1-FIELD-PER-ROW + ACCEPT? Y/N + F8 TANI SHEET)
    ======================================================================== */
    const openInfoRowEditor = (karigerId) => {
        const { metaRow, mergedRows } = buildMergedSnapshot();
        const row = mergedRows.find((r) => String(r.id) === String(karigerId));
        if (!row) return;

        activeEditKarigerId = row.id;
        setInfoViewMode('edit', `${row.name}${row.saree ? ` · ${row.saree}` : ''}`);

        const customCols = Array.isArray(metaRow.customCols) ? metaRow.customCols : [];
        const isPreview = Boolean(window.isBackupPreviewMode);
        const roAttr = isPreview ? 'readonly' : '';

        const customFieldsHtml = customCols.map((c) => `
            <div class="il-form-row">
                <label for="il-ed-custom-${esc(c.id)}">${esc(c.label)} :</label>
                <input type="text" id="il-ed-custom-${esc(c.id)}" class="il-inp il-ed-field" data-custom-id="${esc(c.id)}" ${roAttr} value="${esc(row.custom?.[c.id] || '')}" placeholder="-">
            </div>
        `).join('');

        const editView = document.getElementById('il-edit-view');
        if (!editView) return;

        editView.innerHTML = `
            <div class="il-edit-card">
                <div class="il-edit-head">
                    <div>
                        <strong style="font-size:14.5px; color:#1f2937;">${esc(row.name)}</strong>
                        <span style="font-size:12px; color:#6b7280; margin-left:8px;">Saree: <strong>${esc(row.saree || '-')}</strong> · Mob: <strong>${esc(row.mobile || '-')}</strong></span>
                    </div>
                    <div style="display:flex; gap:7px; flex-wrap:wrap;">
                        <button type="button" class="il-btn" onclick="window.__ilBackStep()">← [Esc] Directory</button>
                        <button type="button" class="il-btn-gold" onclick="window.__ilOpenSelectedTaniSheet()">Open Tani Sheet [F8]</button>
                    </div>
                </div>

                <div class="il-live-strip">
                    <span>Bana: <strong>${esc(row.bana || '-')}</strong></span>
                    <span>Zari: <strong>${esc(row.zari || '-')}</strong></span>
                    <span>Chukka: <strong>${esc(row.chukka || '-')}</strong></span>
                    <span>Tani: <strong>${esc(row.tani || '-')}</strong></span>
                    <span>Bani Rate: <strong style="color:#b47d00;">${row.bani ? `₹ ${esc(row.bani)}` : '-'}</strong></span>
                </div>

                <div class="il-edit-form">
                    <div class="il-form-row">
                        <label for="il-ed-address">Address / Mohalla :</label>
                        <input type="text" id="il-ed-address" class="il-inp il-ed-field" ${roAttr} value="${esc(row.address || '')}" placeholder="Mohalla / City">
                    </div>
                    <div class="il-form-row">
                        <label for="il-ed-kadi">Kadi :</label>
                        <input type="text" id="il-ed-kadi" class="il-inp il-ed-field" ${roAttr} value="${esc(row.kadi || '')}" placeholder="Kadi...">
                    </div>
                    <div class="il-form-row">
                        <label for="il-ed-baithka">Baithka :</label>
                        <input type="text" id="il-ed-baithka" class="il-inp il-ed-field" ${roAttr} value="${esc(row.baithka || '')}" placeholder="Baithka...">
                    </div>
                    ${customFieldsHtml}

                    <div id="il-ed-accept-bar" class="il-accept-bar" style="display:none;">
                        <span style="font-size:13px; font-weight:800; color:#1f2937;">Accept? Info Update Karein?</span>
                        <div style="display:flex; gap:8px;">
                            <button type="button" id="il-ed-yes-btn" class="il-btn-gold" onclick="window.__ilSaveInlineEditor()">Yes [Y / Enter]</button>
                            <button type="button" id="il-ed-no-btn" class="il-btn" onclick="window.__ilCancelEditAccept()">No [N / Esc]</button>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
                        <button type="button" class="il-btn" onclick="window.__ilBackStep()">Cancel [Esc]</button>
                        ${!isPreview ? `<button type="button" class="il-btn-gold" onclick="window.__ilSaveInlineEditor()">Save Info [Ctrl+Enter]</button>` : ''}
                    </div>
                </div>
            </div>
        `;

        const fields = Array.from(editView.querySelectorAll('.il-ed-field'));
        fields.forEach((el, idx) => {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__ilSaveInlineEditor();
                    return;
                }
                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.shiftKey) {
                        if (idx > 0) { fields[idx - 1].focus(); fields[idx - 1].select(); }
                        return;
                    }
                    if (idx < fields.length - 1) {
                        fields[idx + 1].focus();
                        fields[idx + 1].select();
                    } else if (!isPreview) {
                        const acc = document.getElementById('il-ed-accept-bar');
                        if (acc) {
                            acc.style.display = 'flex';
                            document.getElementById('il-ed-yes-btn')?.focus();
                        }
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (idx > 0) { fields[idx - 1].focus(); fields[idx - 1].select(); }
                }
            });
        });

        const yesBtn = document.getElementById('il-ed-yes-btn');
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__ilSaveInlineEditor();
                } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__ilCancelEditAccept();
                }
            });
        }

        setTimeout(() => {
            const first = fields[0];
            if (first) { first.focus(); first.select(); }
        }, 40);
    };

    window.__ilCancelEditAccept = () => {
        const acc = document.getElementById('il-ed-accept-bar');
        if (acc) acc.style.display = 'none';
        const fields = Array.from(document.querySelectorAll('#il-edit-view .il-ed-field'));
        const last = fields[fields.length - 1];
        if (last) last.focus();
    };

    window.__ilSaveInlineEditor = () => {
        if (isSavingInfoEdit || window.isBackupPreviewMode || !activeEditKarigerId) return;
        isSavingInfoEdit = true;

        try {
            const addrVal = String(document.getElementById('il-ed-address')?.value || '').trim();
            const kadiVal = String(document.getElementById('il-ed-kadi')?.value || '').trim();
            const baithkaVal = String(document.getElementById('il-ed-baithka')?.value || '').trim();

            // Sync address back to kariger_list if changed
            const kList = getKarigersSafe();
            const targetK = kList.find((x) => String(x.id) === String(activeEditKarigerId));
            if (targetK && String(targetK.mohalla || targetK.address || targetK.pata || '').trim() !== addrVal) {
                targetK.mohalla = addrVal;
                if (typeof window.setStore === 'function') {
                    isInternalSyncRunning = true;
                    try {
                        window.setStore('kariger_list', kList);
                    } finally {
                        isInternalSyncRunning = false;
                    }
                }
                if (typeof window.renderKarigerTable === 'function') {
                    window.renderKarigerTable();
                }
            }

            const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
            const row = mergedRows.find((r) => String(r.id) === String(activeEditKarigerId));
            if (!row) return;

            row.address = addrVal;
            row.kadi = kadiVal;
            row.baithka = baithkaVal;
            if (!row.custom || typeof row.custom !== 'object') row.custom = {};

            document.querySelectorAll('#il-edit-view .il-ed-field[data-custom-id]').forEach((inp) => {
                const cid = inp.dataset.customId;
                if (cid) row.custom[cid] = String(inp.value || '').trim();
            });

            persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, true);

            const savedName = row.name;
            activeEditKarigerId = null;
            setInfoViewMode('list');
            renderInfoLedgerTable(false);
            showInfoToast(`✅ [${savedName}] ki info save & sync ho gayi!`);
        } finally {
            isSavingInfoEdit = false;
        }
    };

    // Keep legacy cell-save API intact for any external callers
    const saveInfoLedgerCell = (karigerId, fieldKey, value, isCustom = false) => {
        if (window.isBackupPreviewMode) return;
        const cleanVal = String(value ?? '').trim();

        if (!isCustom && fieldKey === 'address') {
            const kList = getKarigersSafe();
            const targetK = kList.find((x) => String(x.id) === String(karigerId));
            if (targetK && String(targetK.mohalla || targetK.address || targetK.pata || '').trim() !== cleanVal) {
                targetK.mohalla = cleanVal;
                if (typeof window.setStore === 'function') {
                    isInternalSyncRunning = true;
                    try {
                        window.setStore('kariger_list', kList);
                    } finally {
                        isInternalSyncRunning = false;
                    }
                }
                if (typeof window.renderKarigerTable === 'function') {
                    window.renderKarigerTable();
                }
            }
        }

        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        const row = mergedRows.find((r) => String(r.id) === String(karigerId));
        if (!row) return;

        if (isCustom) {
            if (!row.custom || typeof row.custom !== 'object') row.custom = {};
            if (String(row.custom[fieldKey] || '') === cleanVal) return;
            row.custom[fieldKey] = cleanVal;
        } else {
            if (fieldKey === 'kadi' && String(row.kadi || '') === cleanVal) return;
            if (fieldKey === 'baithka' && String(row.baithka || '') === cleanVal) return;
            row[fieldKey] = cleanVal;
        }

        persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, true);
        showInfoToast('✅ Saved!');
    };

    const handleCellKeyDown = (e, karigerId, colKey) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.target.blur();
    };

    /* ========================================================================
       TABLE RENDERER (CLEAN WHITE & GOLD — ZERO INLINE INPUT CLUTTER)
    ======================================================================== */
    const highlightInfoRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#info-ledger-tbody .il-row'));
        if (!rows.length) return;
        listActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === listActiveIdx));
        rows[listActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    const renderInfoLedgerTable = (syncIfNeeded = true) => {
        ensureInfoLedgerSection();
        updateInfoLedgerBadge();

        const { metaRow, mergedRows, rawArr } = buildMergedSnapshot();
        if (syncIfNeeded) {
            persistInfoArrayIfChanged(metaRow, mergedRows, rawArr, false);
        }

        renderInfoKarkhanaTabs(mergedRows);

        const customCols = Array.isArray(metaRow.customCols) ? metaRow.customCols : [];

        // 1. Karkhana Filter
        let list = mergedRows;
        if (currentKarkhanaFilter !== 'all') {
            list = list.filter((r) =>
                String(r.karkhanaId) === String(currentKarkhanaFilter) ||
                (!r.karkhanaId && currentKarkhanaFilter === 'k_main')
            );
        }

        // 2. Universal Search across ALL fixed + dynamic '+' columns
        const q = currentSearchQuery.trim().toLowerCase();
        if (q) {
            const terms = q.split(/\s+/).filter(Boolean);
            list = list.filter((r) => {
                const kName = r.karkhanaName || (typeof window.getKarkhanaNameById === 'function' ? window.getKarkhanaNameById(r.karkhanaId) : '');
                const customVals = customCols.map((c) => r.custom?.[c.id] || '').join(' ');
                const haystack = [
                    r.name, r.saree, r.mobile, r.address, kName,
                    r.bana, r.zari, r.chukka, r.tani, r.bani,
                    r.kadi, r.baithka, customVals
                ].join(' ').toLowerCase();
                return terms.every((t) => haystack.includes(t));
            });
        }

        currentFilteredRowsCache = list;
        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const statsEl = document.getElementById('info-search-stats');
        if (statsEl) {
            statsEl.textContent = q
                ? `Match: ${totalItems} / ${mergedRows.length}`
                : `Kul Kariger: ${totalItems}`;
        }
        const footCnt = document.getElementById('il-foot-count');
        if (footCnt) footCnt.textContent = `${totalItems} Karigers`;

        // Render <thead>
        const thead = document.getElementById('info-ledger-thead');
        if (thead) {
            const customThs = customCols.map((c) => `<th>${esc(c.label)}</th>`).join('');
            thead.innerHTML = `
                <tr>
                    <th style="width:38px; text-align:center;">#</th>
                    <th>Name</th>
                    <th>Saree</th>
                    <th>Mob</th>
                    <th>Address</th>
                    <th>Bana</th>
                    <th>Zari</th>
                    <th>Chukka</th>
                    <th>Tani</th>
                    <th style="text-align:right;">Bani</th>
                    <th>Kadi</th>
                    <th>Baithka</th>
                    ${customThs}
                    <th style="width:68px; text-align:right;">
                        <button type="button" class="il-plus-th-btn" title="Manage Columns (+)" onclick="addInfoLedgerCustomColumn()">+</button>
                    </th>
                </tr>
            `;
        }

        // Render <tbody>
        const tbody = document.getElementById('info-ledger-tbody');
        const colSpan = 13 + customCols.length;

        if (tbody) {
            if (!totalItems) {
                currentPageRowsCache = [];
                tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:24px; color:#6b7280; font-weight:700;">${q ? 'Search se koi Kariger match nahi hua.' : 'Koi Kariger nahi mila.'}</td></tr>`;
            } else {
                const startIdx = (currentPage - 1) * PAGE_SIZE;
                const pageRows = list.slice(startIdx, startIdx + PAGE_SIZE);
                currentPageRowsCache = pageRows;
                if (listActiveIdx >= pageRows.length) listActiveIdx = 0;
                if (listActiveIdx < 0) listActiveIdx = 0;

                tbody.innerHTML = pageRows.map((r, idx) => {
                    const rowNo = startIdx + idx + 1;
                    const activeCls = (idx === listActiveIdx) ? ' active' : '';
                    const customTds = customCols.map((c) => {
                        const val = r.custom?.[c.id] || '';
                        return `<td>${val ? esc(val) : '<span style="color:#9ca3af;">-</span>'}</td>`;
                    }).join('');
                    const encRowId = encodeURIComponent(String(r.id));

                    return `
                        <tr class="il-row${activeCls}" data-ilidx="${idx}" onclick="window.__ilSelectAndEdit(${idx}, decodeURIComponent('${encRowId}'))">
                            <td style="text-align:center; color:#6b7280; font-weight:700;">${rowNo}</td>
                            <td style="font-weight:800; white-space:nowrap;">${esc(r.name)}</td>
                            <td style="white-space:nowrap;">${esc(r.saree || '-')}</td>
                            <td style="white-space:nowrap;">${esc(r.mobile || '-')}</td>
                            <td>${r.address ? esc(r.address) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.bana ? esc(r.bana) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.zari ? esc(r.zari) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.chukka ? esc(r.chukka) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.tani ? esc(r.tani) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td style="text-align:right; font-weight:800; color:#b47d00; white-space:nowrap;">${r.bani ? `₹ ${esc(r.bani)}` : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.kadi ? esc(r.kadi) : '<span style="color:#9ca3af;">-</span>'}</td>
                            <td>${r.baithka ? esc(r.baithka) : '<span style="color:#9ca3af;">-</span>'}</td>
                            ${customTds}
                            <td style="text-align:right; font-weight:700; font-size:11.5px; white-space:nowrap;">Edit →</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Render 20-20 Pagination Bar
        const pagBar = document.getElementById('info-ledger-pagination-bar');
        if (pagBar) {
            if (!totalItems) {
                pagBar.style.display = 'none';
            } else {
                pagBar.style.display = 'flex';
                const sIdx = (currentPage - 1) * PAGE_SIZE + 1;
                const eIdx = Math.min(currentPage * PAGE_SIZE, totalItems);
                pagBar.innerHTML = `
                    <div style="color:#6b7280; font-weight:600;">Dikh rahe hain: <strong>${sIdx} - ${eIdx}</strong> (Kul: <strong>${totalItems}</strong>) · 20 / Page</div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="il-btn" ${currentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="prevInfoLedgerPage()">◀ Pichla</button>
                        <span style="background:#fdf6e2; border:1px solid #e5d5a7; padding:4px 10px; border-radius:4px; font-weight:700;">Page ${currentPage} / ${totalPages}</span>
                        <button type="button" class="il-btn" ${currentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="nextInfoLedgerPage()">Agla ▶</button>
                    </div>
                `;
            }
        }
    };

    window.__ilSelectAndEdit = (idx, karigerId) => {
        highlightInfoRow(idx);
        openInfoRowEditor(karigerId);
    };

    window.__ilOpenSelectedTaniSheet = () => {
        const targetId = (infoViewMode === 'edit' && activeEditKarigerId)
            ? activeEditKarigerId
            : currentPageRowsCache[listActiveIdx]?.id;
        if (!targetId) {
            showInfoToast('⚠️ Pehle koi Kariger chunein!');
            return;
        }
        if (typeof window.openKarigerSheet !== 'function') {
            showInfoToast('⚠️ Kariger Sheet module load nahi hua hai.');
            return;
        }
        const sec = document.getElementById('info-ledger-section');
        if (sec) sec.style.display = 'none';
        window.openKarigerSheet(targetId);
    };

    /* ========================================================================
       A6 PRINT DIRECTORY (PWA SAFE)
    ======================================================================== */
    window.__ilPrintDirectory = () => {
        const rows = currentFilteredRowsCache;
        if (!rows || !rows.length) {
            console.warn('[InfoLedger Print] Print karne ke liye koi Kariger record nahi mila.');
            showInfoToast('⚠️ Print karne ke liye koi Kariger record nahi mila!');
            return;
        }

        const today = new Date().toLocaleDateString('hi-IN');
        const rowsHtml = rows.map((r, i) => `
            <tr style="border-bottom:1px dashed #ccc;">
                <td style="padding:3px 2px;">${i + 1}</td>
                <td style="padding:3px 2px;"><strong>${esc(r.name)}</strong><br><small>${esc(r.mobile || '-')}${r.address ? ` · ${esc(r.address)}` : ''}</small></td>
                <td style="padding:3px 2px;">${esc(r.saree || '-')}<br><small>B:${esc(r.bana || '-')} · Z:${esc(r.zari || '-')}</small></td>
                <td style="padding:3px 2px; text-align:right;">${r.bani ? `₹${esc(r.bani)}` : '-'}<br><small>${esc(r.kadi || '')} ${esc(r.baithka || '')}</small></td>
            </tr>
        `).join('');

        const pw = window.open('', '', 'width=450,height=650');
        if (!pw) {
            console.warn('[InfoLedger Print] Popup block hai! Browser me popup allow karein.');
            showInfoToast('⚠️ Print Popup block hai! Browser me popup allow karein.');
            return;
        }
        pw.document.write(`
            <html>
            <head>
                <title>Info Ledger Directory - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 10px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 14px; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 2px; text-align: left; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>INFO LEDGER DIRECTORY (${today}) · Kul: ${rows.length}</p>
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>KARIGER / PATA</th><th>SAREE / MAT</th><th style="text-align:right;">BANI / NOTE</th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
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
        pw.document.close();
    };

    /* ========================================================================
       KEYBOARD ENGINE FOR #info-ledger-section
    ======================================================================== */
    const handleInfoKeydown = (e) => {
        if (isAnyOtherOverlayOpen()) return;

        const colModal = document.getElementById('il-col-modal');
        if (colModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeInfoColumnModal();
            }
            return;
        }

        const sec = document.getElementById('info-ledger-section');
        if (!sec || sec.style.display === 'none') return;

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (infoViewMode === 'edit') {
                const acc = document.getElementById('il-ed-accept-bar');
                if (acc && acc.style.display !== 'none') window.__ilCancelEditAccept();
                else window.__ilBackStep();
                return;
            }
            if (currentSearchQuery.trim()) {
                clearInfoLedgerSearch();
                return;
            }
            window.__ilBackStep();
            return;
        }

        if (e.key === 'F8') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.__ilOpenSelectedTaniSheet();
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            e.stopImmediatePropagation();
            openInfoColumnModal();
            return;
        }

        if ((e.ctrlKey || e.altKey) && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.__ilPrintDirectory();
            return;
        }

        if (infoViewMode === 'list') {
            if (e.key === 'Enter' && (performance.now() - infoOpenedAt) < 180) return;

            if (e.key === 'F2') {
                e.preventDefault();
                e.stopImmediatePropagation();
                cycleInfoKarkhanaTab();
                return;
            }

            if (isTyping) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightInfoRow(listActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightInfoRow(listActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                nextInfoLedgerPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                prevInfoLedgerPage();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                const chosen = currentPageRowsCache[listActiveIdx];
                if (chosen) openInfoRowEditor(chosen.id);
            } else if (e.key === '+') {
                e.preventDefault();
                openInfoColumnModal();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('search-info-ledger-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
        }
    };

    const bindInfoKeyboardEngine = () => {
        if (window.__infoKeysBound) return;
        window.__infoKeysBound = true;
        document.addEventListener('keydown', handleInfoKeydown);
    };

    const openInfoLedgerModule = () => {
        infoOpenedAt = performance.now();
        ensureInfoLedgerSection();
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';

        const sec = document.getElementById('info-ledger-section');
        if (sec) sec.style.display = 'block';

        activeEditKarigerId = null;
        setInfoViewMode('list');
        currentPage = 1;
        listActiveIdx = 0;
        renderInfoLedgerTable(true);
        bindInfoKeyboardEngine();
    };

    /* ========================================================================
       AUTO-SYNC HOOKS (KARIGER SHEET & KARIGER MASTER CHANGES -> INFO LEDGER)
    ======================================================================== */
    const installAutoSyncHooks = () => {
        if (typeof window.saveKarigerSheets === 'function' && !window.saveKarigerSheets._infoWrapped) {
            const origSaveSheets = window.saveKarigerSheets;
            window.saveKarigerSheets = function () {
                const res = origSaveSheets.apply(this, arguments);
                scheduleInfoLedgerSync();
                return res;
            };
            window.saveKarigerSheets._infoWrapped = true;
        }

        if (typeof window.setStore === 'function' && !window.setStore._infoWrapped) {
            const origSetStore = window.setStore;
            window.setStore = function (key) {
                const res = origSetStore.apply(this, arguments);
                if (!isInternalSyncRunning && String(key) === 'kariger_list') {
                    scheduleInfoLedgerSync();
                }
                return res;
            };
            window.setStore._infoWrapped = true;
        }

        if (typeof window.updateDashboardBadgeTotals === 'function' && !window.updateDashboardBadgeTotals._infoWrapped) {
            const origBadgeFn = window.updateDashboardBadgeTotals;
            window.updateDashboardBadgeTotals = function () {
                const res = origBadgeFn.apply(this, arguments);
                updateInfoLedgerBadge();
                return res;
            };
            window.updateDashboardBadgeTotals._infoWrapped = true;
        }
    };

    const initInfoLedger = async () => {
        installAutoSyncHooks();
        try {
            if (window.StoragePreloadPromise && typeof window.StoragePreloadPromise.then === 'function') {
                await window.StoragePreloadPromise;
            }
        } catch (_) {}
        installAutoSyncHooks();
        updateInfoLedgerBadge();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInfoLedger);
    } else {
        initInfoLedger();
    }

    const infoAPI = {
        openInfoLedgerModule,
        renderInfoLedgerTable,
        updateInfoLedgerBadge,
        switchInfoKarkhanaTab,
        handleInfoLedgerSearch,
        clearInfoLedgerSearch,
        nextInfoLedgerPage,
        prevInfoLedgerPage,
        addInfoLedgerCustomColumn,
        renameInfoLedgerCustomColumn,
        deleteInfoLedgerCustomColumn,
        saveInfoLedgerCell,
        handleInfoLedgerCellKey: handleCellKeyDown,
        syncAllKarigersToInfoLedger
    };

    Object.keys(infoAPI).forEach((fn) => {
        window[fn] = infoAPI[fn];
    });

    window.InfoLedgerEngine = infoAPI;
})();
