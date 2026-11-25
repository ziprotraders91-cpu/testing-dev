/* ============================================================================
   SIMPLICITY ERP - WEAVER (KARIGER) UI & SHEET CONTROLLER (TALLY WHITE & GOLD)
   File: kariger/kariger-ui.js • Developed by Farhan Jawed
   Layout:
   - Left Full-Height: Rozana Line Entry Voucher
   - Right Top: Tani Khata Register (Fits Screen, Zero Scrollbars)
   - Right Bottom: 3 Aligned Cards (Mazdoori | Bana | Zari)
   - Strict Manual Entry (ArrowUp/Down & Wheel Number Stepping Disabled)
   - Enterprise Guards: Save Locks, Debounce, Multi-Store Rollback, Zero Native Popups
============================================================================ */

(() => {
    'use strict';

    if (window.__karigerUiLoaded) {
        console.warn('[kariger-ui] Already loaded — skip');
        return;
    }
    window.__karigerUiLoaded = true;

    window.activeKarigerId = null;
    window.activeSheetIndex = 0;
    window.currentKarigerKarkhanaFilter = 'all';
    window.currentKarigerPage = 1;
    window.karigerPageSize = 50;
    window.editingRowIndex = null;

    let karigerListActiveIdx = 0;
    let currentKarigerPageRowsCache = [];
    let sheetSetupExpanded = false;
    let karigerDirOpenedAt = 0;
    let isSavingKariger = false;
    let lastKarigerSaveTime = 0;
    let isSavingTaniRow = false;
    let lastTaniRowSaveTime = 0;
    let isAddingTaniSheet = false;
    let isDeletingKarItem = false;
    let activeKarConfirm = null;

    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = (v !== undefined && v !== null) ? v : '';
    };

    const setText = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (v !== undefined && v !== null) ? v : '';
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const getLocalTodayIso = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const toIsoDate = (d) => {
        if (!d) return getLocalTodayIso();
        const s = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parts = s.split(/[-/]/);
        if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return getLocalTodayIso();
    };

    const getTodayIso = () => {
        const raw = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : getLocalTodayIso();
        return toIsoDate(raw);
    };

    const isAnyExpressOverlayOpen = () => Boolean(
        document.getElementById('kariger-express-modal') ||
        document.getElementById('master-stock-express-modal') ||
        document.getElementById('master-jobwork-express-modal') ||
        document.getElementById('tani-express-modal')
    );

    const sanitizeKarigerList = () => {
        let raw = (typeof window.getStore === 'function') ? window.getStore('kariger_list') : null;
        if (raw === null || raw === undefined) {
            try {
                const uid = window.currentUserId || localStorage.getItem('app_current_user_id') || '';
                const lsRaw = (uid ? localStorage.getItem(`${uid}_kariger_list`) : null) || localStorage.getItem('kariger_list');
                raw = lsRaw ? JSON.parse(lsRaw) : [];
            } catch (_) {
                raw = [];
            }
        }
        const list = window.safeArray ? window.safeArray(raw) : (Array.isArray(raw) ? raw : []);
        return list.filter((k) => k && k.name && String(k.name).trim() !== '');
    };

    const getKarigerAbsentDays = (kId, joinDate) => {
        if (!kId) return 0;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];
        const todayIso = getTodayIso();
        let lastIso = toIsoDate(joinDate || todayIso);

        sheets.forEach((sh) => {
            const rows = window.safeArray ? window.safeArray(sh.rows) : [];
            rows.forEach((r) => {
                if (r && r.date) {
                    const rowIso = toIsoDate(r.date);
                    if (rowIso > lastIso) lastIso = rowIso;
                }
            });
        });

        const today = new Date(todayIso);
        const last = new Date(lastIso);
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        return (!isNaN(diffDays) && diffDays > 0) ? diffDays : 0;
    };

    const notifyGlobalSync = () => {
        if (typeof window.invalidatePaymentCache === 'function' && window.activeKarigerId) {
            window.invalidatePaymentCache(window.activeKarigerId);
        }
        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }
        if (typeof window.slSyncDashboardCharts === 'function') {
            window.slSyncDashboardCharts();
        }
    };

    const showSheetToast = (msg, isErr = false) => {
        const shSec = document.getElementById('kariger-sheet-section');
        const kSec = document.getElementById('kariger-section');
        const isSheetOpen = shSec && shSec.style.display !== 'none';
        const isDirOpen = kSec && kSec.style.display !== 'none';

        const el = isSheetOpen
            ? document.getElementById('kar-sheet-toast-msg')
            : (isDirOpen ? document.getElementById('kar-dir-toast-msg') : null);

        if (el) {
            if (!el.dataset.origText) el.dataset.origText = el.textContent;
            el.textContent = msg;
            el.style.color = isErr || String(msg).startsWith('⚠️') || String(msg).startsWith('❌') ? '#dc2626' : '#92400e';
            clearTimeout(el.__tTimer);
            el.__tTimer = setTimeout(() => {
                el.style.color = '#92400e';
                el.textContent = el.dataset.origText || '';
            }, 3800);
        }

        let floatEl = document.getElementById('kar-float-toast');
        if (!floatEl) {
            floatEl = document.createElement('div');
            floatEl.id = 'kar-float-toast';
            floatEl.style.cssText = 'position:fixed; right:16px; bottom:16px; z-index:1000001; padding:9px 14px; border-radius:7px; font-size:12.5px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.22); display:none; max-width:90vw; font-family:Inter,sans-serif;';
            document.body.appendChild(floatEl);
        }
        const errTone = isErr || String(msg).startsWith('❌');
        floatEl.textContent = msg;
        floatEl.style.background = errTone ? '#991b1b' : '#1f2937';
        floatEl.style.color = errTone ? '#ffffff' : '#fde68a';
        floatEl.style.display = 'block';
        clearTimeout(floatEl._t);
        floatEl._t = setTimeout(() => { floatEl.style.display = 'none'; }, 3400);
    };
    window.__karShowToast = showSheetToast;

    const closeKarConfirm = (restoreFocusEl = null) => {
        activeKarConfirm = null;
        document.getElementById('kar-inline-confirm-bar')?.remove();
        if (restoreFocusEl && typeof restoreFocusEl.focus === 'function') {
            setTimeout(() => restoreFocusEl.focus(), 20);
        }
    };

    const showKarConfirm = (msg, onYes, yesLabel = 'Yes (Y / Enter)', noLabel = 'No (N / Esc)', restoreFocusEl = null) => {
        closeKarConfirm();
        activeKarConfirm = { onYes, restoreFocusEl };
        const bar = document.createElement('div');
        bar.id = 'kar-inline-confirm-bar';
        bar.style.cssText = 'position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:1000000; background:#fdf6e2; border:2px solid #d9a425; border-radius:8px; padding:10px 14px; box-shadow:0 12px 30px rgba(0,0,0,0.22); display:flex; align-items:center; gap:12px; flex-wrap:wrap; max-width:94vw; font-family:Inter,sans-serif;';
        bar.innerHTML = `
            <strong style="font-size:12.5px; color:#1f2937;">${esc(msg)}</strong>
            <div style="display:flex; gap:8px;">
                <button type="button" id="kar-confirm-yes-btn" class="kar-btn-gold">${esc(yesLabel)}</button>
                <button type="button" id="kar-confirm-no-btn" class="kar-btn-plain">${esc(noLabel)}</button>
            </div>
        `;
        document.body.appendChild(bar);
        document.getElementById('kar-confirm-yes-btn').onclick = () => {
            const fn = activeKarConfirm?.onYes;
            closeKarConfirm();
            if (typeof fn === 'function') fn();
        };
        document.getElementById('kar-confirm-no-btn').onclick = () => {
            closeKarConfirm(restoreFocusEl);
        };
        setTimeout(() => document.getElementById('kar-confirm-yes-btn')?.focus(), 15);
    };
    window.__karShowConfirm = showKarConfirm;

    /* ========================================================================
       0. SCOPED TALLYPRIME WHITE & GOLD STYLES (ZERO OVERFLOW, ZERO SCROLLBARS)
    ======================================================================== */
    const ensureKarigerTallyStyles = () => {
        const old = document.getElementById('kariger-tally-styles');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'kariger-tally-styles';
        style.textContent = `
            /* --- SHARED WHITE & GOLD SHELL (STRICT FIT WITHIN VIEWPORT) --- */
            #kariger-section,
            #kariger-sheet-section {
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                overflow-x: hidden !important;
                background: #ffffff !important;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #kariger-section *,
            #kariger-sheet-section * {
                box-sizing: border-box;
            }
            #kariger-section input[type="number"]::-webkit-outer-spin-button,
            #kariger-section input[type="number"]::-webkit-inner-spin-button,
            #kariger-sheet-section input[type="number"]::-webkit-outer-spin-button,
            #kariger-sheet-section input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none !important;
                margin: 0 !important;
            }
            #kariger-section input[type="number"],
            #kariger-sheet-section input[type="number"] {
                -moz-appearance: textfield !important;
            }
            #kariger-section .module-header,
            #kariger-sheet-section .module-header {
                background: #fdf6e2 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                padding: 9px 14px !important;
                margin-bottom: 0 !important;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                width: 100%;
            }
            #kariger-section .module-header h2,
            #kariger-sheet-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 15.5px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #kariger-section .back-btn,
            #kariger-sheet-section .back-btn,
            .kar-btn-plain {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 10px !important;
                font-size: 11.5px !important;
                font-weight: 700 !important;
                cursor: pointer;
                white-space: nowrap;
            }
            #kariger-section .back-btn:hover,
            #kariger-sheet-section .back-btn:hover,
            .kar-btn-plain:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
                color: #1f2937 !important;
            }
            #kariger-section .add-btn,
            #kariger-sheet-section .add-btn,
            .kar-btn-gold {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 5px !important;
                padding: 5px 11px !important;
                font-size: 11.5px !important;
                font-weight: 800 !important;
                cursor: pointer;
                white-space: nowrap;
            }
            #kariger-section .add-btn:hover,
            #kariger-sheet-section .add-btn:hover,
            .kar-btn-gold:hover {
                background: #e5aa12 !important;
            }
            #kariger-sheet-section .module-header .sheet-btn,
            #kariger-sheet-section .module-header .add-btn[onclick*="WhatsApp"] {
                background: #ffffff !important;
                color: #1f2937 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 9px !important;
                font-size: 11.5px !important;
                font-weight: 700 !important;
            }
            #kariger-sheet-section .module-header .sheet-btn:hover,
            #kariger-sheet-section .module-header .add-btn[onclick*="WhatsApp"]:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
            }
            #kariger-sheet-section .module-header > div {
                display: flex;
                gap: 6px !important;
                flex-wrap: wrap;
                align-items: center;
            }

            /* --- TABS --- */
            #kariger-karkhana-tabs-bar,
            #sheet-tabs-container {
                padding: 9px 14px 0 14px !important;
                margin-bottom: 8px !important;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
            }
            #kariger-section .sheet-tab,
            #kariger-sheet-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 4px 11px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #kariger-section .sheet-tab.active,
            #kariger-sheet-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }
            #sheet-tabs-container .del-tab-btn {
                margin-left: 6px;
                color: #92400e;
                font-weight: 900;
            }

            /* --- KARIGER DIRECTORY --- */
            #kariger-section .filter-panel {
                padding: 0 14px 10px 14px !important;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #kariger-section .search-box {
                padding: 7px 12px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                background: #ffffff !important;
                color: #111827 !important;
                outline: none;
            }
            #kariger-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }
            #kariger-absent-pills {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                align-items: center;
            }
            .kar-abs-pill {
                background: #ffffff;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                padding: 5px 9px;
                font-size: 11.5px;
                font-weight: 700;
                cursor: pointer;
            }
            .kar-abs-pill.active {
                background: #fdf6e2;
                border-color: #d9a425;
                color: #92400e;
                font-weight: 800;
            }
            #kariger-section #add-kariger-form {
                margin: 0 14px 12px 14px !important;
                background: #fdfcf7 !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 8px !important;
                padding: 12px 14px !important;
            }
            #kariger-section .table-responsive {
                padding: 0 14px !important;
                overflow: visible !important;
            }
            #kariger-section table,
            #kariger-sheet-section .kar-khata-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #kariger-section table thead tr,
            #kariger-sheet-section .kar-khata-table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #kariger-section table th,
            #kariger-sheet-section .kar-khata-table th {
                padding: 7px 6px !important;
                font-size: 10.5px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left;
                line-height: 1.2;
            }
            #kariger-section table td,
            #kariger-sheet-section .kar-khata-table td {
                padding: 7px 6px !important;
                font-size: 12px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
                font-variant-numeric: tabular-nums;
            }
            #kariger-section .kar-dir-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #kariger-section .kar-dir-row:hover {
                background: #fef9ea !important;
            }
            #kariger-section .kar-dir-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #kariger-section .kar-dir-row.active td {
                font-weight: 700 !important;
                color: #1f2937 !important;
            }
            #kariger-pagination-bar {
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                font-size: 12px;
            }
            .kar-status-strip {
                background: #fdf6e2;
                border-top: 1px solid #e5d5a7;
                padding: 8px 14px;
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

            /* --- TANI KHATA SHEET: TOP THIN LINE + COLLAPSIBLE SETUP [F9] --- */
            .kar-setup-wrap {
                margin: 0 14px 10px 14px;
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                background: #fdfcf7;
                width: calc(100% - 28px);
                max-width: 100%;
                overflow: visible;
            }
            .kar-setup-strip {
                padding: 7px 12px;
                background: #fdf6e2;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                cursor: pointer;
                border-radius: 5px;
            }
            .kar-setup-summary {
                font-size: 12px;
                font-weight: 800;
                color: #92400e;
                line-height: 1.35;
            }
            .kar-setup-body {
                padding: 10px 12px;
                border-top: 1px solid #e5d5a7;
                background: #ffffff;
                width: 100%;
                overflow: visible !important;
            }
            #kariger-sheet-section .tani-closing-grid {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 8px !important;
                margin-bottom: 10px !important;
                padding: 9px !important;
                background: #fdfcf7 !important;
                border: 1px solid #e5d5a7 !important;
                border-radius: 6px !important;
                width: 100% !important;
                overflow: visible !important;
                max-height: none !important;
            }
            #kariger-sheet-section .tani-closing-grid > div {
                display: flex;
                flex-direction: column;
                gap: 3px;
                min-width: 0 !important;
            }
            #kariger-sheet-section .tani-closing-grid label {
                font-size: 11px !important;
                font-weight: 700 !important;
                color: #6b7280 !important;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #kariger-sheet-section .tani-closing-grid input {
                width: 100% !important;
                min-width: 0 !important;
                padding: 6px 8px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 4px !important;
                font-size: 12.5px !important;
                font-weight: 700 !important;
                color: #111827 !important;
                background: #ffffff !important;
            }
            #kariger-sheet-section .tani-closing-grid input:focus {
                border-color: #d9a425 !important;
                outline: none;
                background: #fffdf5 !important;
            }
            .kar-setup-item-box {
                background: #ffffff !important;
                border: 1px solid #e5d5a7 !important;
                border-radius: 6px !important;
                padding: 9px 10px !important;
                margin-bottom: 0 !important;
                width: 100%;
                overflow: visible !important;
            }
            .kar-setup-item-box .form-row-4 {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 8px !important;
                background: #fdfcf7 !important;
                border: 1px solid #e5d5a7 !important;
                padding: 8px 9px !important;
                border-radius: 6px !important;
                width: 100% !important;
                overflow: visible !important;
            }
            .kar-setup-item-box .input-group {
                min-width: 0 !important;
                margin: 0 !important;
            }
            .kar-setup-item-box .input-group input {
                width: 100% !important;
                min-width: 0 !important;
            }
            .kar-setup-item-box label {
                color: #374151 !important;
                font-size: 11px !important;
            }
            .kar-setup-item-box small {
                color: #b47d00 !important;
            }
            .kar-setup-item-box input {
                border-color: #d1d5db !important;
            }
            .kar-setup-item-box > div[style*="fffbeb"] {
                background: #fdfcf7 !important;
                border-color: #e5d5a7 !important;
            }
            .kar-setup-item-box > div[style*="fffbeb"] label {
                color: #92400e !important;
            }

            /* --- SKETCH-EXACT 2-COLUMN WORKSPACE: LEFT ENTRY | RIGHT (TABLE + 3 CARDS) --- */
            .kar-sheet-split {
                display: grid;
                grid-template-columns: 295px minmax(0, 1fr);
                gap: 12px;
                padding: 0 14px 12px 14px;
                align-items: start;
                width: 100%;
                max-width: 100%;
            }
            .kar-left-entry-card {
                background: #ffffff;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                overflow: visible;
                min-width: 0;
            }
            .kar-right-main-col {
                display: flex;
                flex-direction: column;
                gap: 12px;
                min-width: 0;
                max-width: 100%;
            }
            .kar-table-card {
                background: #ffffff;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                overflow: hidden;
                min-width: 0;
                max-width: 100%;
            }
            .kar-pane-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            .kar-pane-head strong {
                font-size: 13px;
                font-weight: 800;
                color: #1f2937;
            }
            .kar-pane-head small {
                font-size: 11px;
                font-weight: 700;
                color: #92400e;
            }
            .kar-table-card .table-responsive {
                padding: 0 !important;
                overflow: visible !important;
                max-height: none !important;
                width: 100%;
            }
            .kar-table-card .kar-khata-table {
                border: none !important;
                width: 100%;
            }
            .kar-khata-table tfoot tr {
                background: #fdf6e2 !important;
                border-top: 1.5px solid #d9b86c !important;
            }
            .kar-khata-table tfoot th {
                padding: 7px 5px !important;
                font-size: 11px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
            }
            .kar-khata-row:hover {
                background: #fef9ea !important;
            }
            .kar-khata-row.editing {
                background: #fef3c7 !important;
            }
            .kar-row-act-btn {
                background: #ffffff;
                border: 1px solid #d1d5db;
                color: #374151;
                border-radius: 4px;
                padding: 2px 5px;
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                margin-left: 1px;
            }
            .kar-row-act-btn:hover {
                border-color: #d9a425;
                background: #fdf6e2;
            }

            /* --- LEFT SIDE VOUCHER ENTRY PANEL (CLEAN, ZERO SCROLL) --- */
            .kar-voucher-body {
                padding: 10px 11px;
                background: #ffffff;
            }
            .kar-v-sec {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.45px;
                color: #92400e;
                border-top: 1px solid #efe4c4;
                padding-top: 7px;
                margin: 8px 0 5px 0;
            }
            .kar-v-grid-2 {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 7px;
                margin-bottom: 5px;
            }
            .kar-v-row-1 {
                display: grid;
                grid-template-columns: 88px minmax(0, 1fr);
                align-items: center;
                gap: 7px;
                margin-bottom: 5px;
                min-width: 0;
            }
            .kar-v-row-1 label,
            .kar-v-grid-2 .input-group label,
            .kar-voucher-body .input-group label {
                font-size: 11px !important;
                font-weight: 700 !important;
                color: #374151 !important;
                margin: 0 0 2px 0 !important;
                display: block;
            }
            .kar-voucher-body .input-group {
                margin: 0 !important;
                min-width: 0;
                position: relative;
            }
            .kar-voucher-body input {
                width: 100% !important;
                min-width: 0 !important;
                padding: 6px 8px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 4px !important;
                font-size: 12.5px !important;
                font-weight: 700 !important;
                color: #111827 !important;
                background: #ffffff !important;
                outline: none;
            }
            .kar-voucher-body input:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            .kar-voucher-body small {
                display: block;
                margin-top: 2px;
                font-size: 10.5px !important;
                font-weight: 700 !important;
                color: #b47d00 !important;
            }
            .kar-voucher-actions {
                display: flex;
                gap: 7px;
                margin-top: 9px;
                padding-top: 9px;
                border-top: 1px solid #efe4c4;
            }
            .kar-voucher-actions #row-submit-btn {
                flex: 1;
                padding: 8px 10px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
            }

            /* --- INLINE TALLY SUGGESTION LIST --- */
            .kar-suggest-pop {
                position: absolute;
                left: 0;
                right: 0;
                top: 100%;
                z-index: 9999;
                background: #ffffff;
                border: 1.5px solid #d9b86c;
                border-radius: 5px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.12);
                max-height: 170px;
                overflow-y: auto;
                display: none;
            }
            .kar-suggest-opt {
                padding: 6px 8px;
                font-size: 12px;
                font-weight: 700;
                color: #1f2937;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #f3f4f6;
            }
            .kar-suggest-opt:hover,
            .kar-suggest-opt.active {
                background: #f2b71d;
                color: #1f2937;
            }

            /* --- RIGHT BOTTOM: 3 EQUAL ALIGNED CARDS (MAZDOORI | BANA | ZARI) --- */
            .kar-summary-3col {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 10px !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100%;
            }
            .kar-summary-3col > div {
                background: #ffffff !important;
                border: 1.5px solid #e5d5a7 !important;
                border-radius: 8px !important;
                padding: 11px 12px !important;
                box-shadow: none !important;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-width: 0;
            }
            .kar-summary-3col > div > div:first-child {
                color: #1f2937 !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                border-bottom: 1.5px solid #fdf6e2;
                padding-bottom: 6px;
                margin-bottom: 7px !important;
            }
            .kar-summary-3col > div > div {
                font-size: 12px !important;
                color: #374151 !important;
                margin-bottom: 4px !important;
            }
            .kar-summary-3col > div > div:last-child {
                background: #fdf6e2 !important;
                border-left: 4px solid #f2b71d !important;
                border-radius: 5px !important;
                padding: 7px 9px !important;
                margin-top: 7px !important;
                margin-bottom: 0 !important;
            }
            .kar-summary-3col > div > div:last-child span {
                color: #92400e !important;
                font-size: 11px !important;
                font-weight: 800 !important;
            }
            .kar-summary-3col > div > div:last-child strong {
                color: #b47d00 !important;
                font-size: 14.5px !important;
                font-weight: 900 !important;
            }

            /* --- RESPONSIVE FALLBACK --- */
            @media (max-width: 980px) {
                .kar-sheet-split {
                    grid-template-columns: 1fr;
                }
                .kar-summary-3col {
                    grid-template-columns: 1fr !important;
                }
                .kar-table-card .table-responsive {
                    overflow-x: auto !important;
                }
                #kariger-sheet-section .tani-closing-grid,
                .kar-setup-item-box .form-row-4 {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }
            }

            /* --- CLEAN BROWSER PRINT: ONLY HISAB KITAB --- */
            @media print {
                .navbar,
                #kariger-sheet-section .module-header,
                #sheet-tabs-container,
                #kar-sheet-setup-wrapper,
                .kar-left-entry-card,
                #kar-sheet-status-strip,
                #kar-inline-confirm-bar,
                #kar-float-toast,
                .kar-khata-table th:last-child,
                .kar-khata-table td:last-child,
                .kar-khata-table tfoot th:last-child {
                    display: none !important;
                }
                .kar-sheet-split {
                    display: block !important;
                    padding: 0 !important;
                }
                .kar-right-main-col {
                    width: 100% !important;
                }
                .kar-summary-3col {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 8px !important;
                    margin-top: 12px !important;
                }
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       1. NAVIGATION & KARIGER MASTER (PURE WHITE & GOLD DIRECTORY)
    ======================================================================== */
    const ensureKarigerMohallaField = () => {
        if (document.getElementById('kar-mohalla')) return;
        const mobileInp = document.getElementById('kar-mobile');
        if (!mobileInp) return;

        const container = mobileInp.closest('.input-group') || mobileInp.closest('div') || mobileInp.parentElement;
        if (!container || !container.parentElement) return;

        const wrap = document.createElement('div');
        wrap.id = 'kar-mohalla-wrapper';
        wrap.className = 'input-group';
        wrap.innerHTML = `
            <label for="kar-mohalla">Mohalla / Address:</label>
            <input type="text" id="kar-mohalla" placeholder="Mohalla / City">
        `;

        const emptySibling = container.nextElementSibling;
        if (emptySibling && emptySibling.tagName === 'DIV' && emptySibling.children.length === 0) {
            emptySibling.replaceWith(wrap);
        } else {
            container.parentElement.insertBefore(wrap, container.nextSibling);
        }
    };

    const bindFieldListTraversal = (order, onComplete, allowUpDownMove = true) => {
        order.forEach((fid, idx) => {
            const el = document.getElementById(fid);
            if (!el || el.dataset.karListBound === '1') return;
            el.dataset.karListBound = '1';

            el.addEventListener('keydown', (e) => {
                const pop = el.parentElement?.querySelector('.kar-suggest-pop');
                if (pop && pop.style.display === 'block' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    return;
                }

                if (e.key === 'Enter' && e.ctrlKey && typeof onComplete === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    onComplete();
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.shiftKey) {
                        if (idx > 0) {
                            const prev = document.getElementById(order[idx - 1]);
                            if (prev) { prev.focus(); if (prev.select) prev.select(); }
                        }
                        return;
                    }
                    if (idx < order.length - 1) {
                        const nxt = document.getElementById(order[idx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else if (typeof onComplete === 'function') {
                        onComplete();
                    }
                    return;
                }

                if (allowUpDownMove && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === 'ArrowDown' && idx < order.length - 1) {
                        const nxt = document.getElementById(order[idx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else if (e.key === 'ArrowUp' && idx > 0) {
                        const prev = document.getElementById(order[idx - 1]);
                        if (prev) { prev.focus(); if (prev.select) prev.select(); }
                    }
                }
            });
        });
    };

    const bindKarigerFormEnterFlow = () => {
        bindFieldListTraversal(
            ['kar-date', 'kar-karkhana', 'kar-name', 'kar-saree', 'kar-mobile', 'kar-mohalla'],
            () => saveKariger(),
            true
        );
    };

    const ensureKarigerDirectoryChrome = () => {
        const kSec = document.getElementById('kariger-section');
        if (!kSec || kSec.dataset.dirChromeReady === '1') return;
        kSec.dataset.dirChromeReady = '1';

        const headerTitle = kSec.querySelector('.module-header h2');
        if (headerTitle) headerTitle.textContent = 'Kariger Master Directory';
        const backBtn = kSec.querySelector('.module-header .back-btn');
        if (backBtn) backBtn.textContent = '← [Esc] Dashboard';

        const absSel = document.getElementById('kariger-absent-filter');
        if (absSel && !document.getElementById('kariger-absent-pills')) {
            absSel.style.display = 'none';
            const pills = document.createElement('div');
            pills.id = 'kariger-absent-pills';
            pills.innerHTML = `
                <button type="button" class="kar-abs-pill active" data-days="0" onclick="window.__karSetAbsentFilter(0)">Sabhi</button>
                <button type="button" class="kar-abs-pill" data-days="15" onclick="window.__karSetAbsentFilter(15)">15d+ Absent</button>
                <button type="button" class="kar-abs-pill" data-days="30" onclick="window.__karSetAbsentFilter(30)">30d+ Absent</button>
            `;
            absSel.insertAdjacentElement('afterend', pills);
        }

        const filterPanel = kSec.querySelector('.filter-panel');
        if (filterPanel && !document.getElementById('kar-dir-toolbar-actions')) {
            const actWrap = document.createElement('div');
            actWrap.id = 'kar-dir-toolbar-actions';
            actWrap.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-left:auto;';
            actWrap.innerHTML = `
                <button type="button" class="kar-btn-plain" onclick="window.__karEditSelected()">Edit [E]</button>
                <button type="button" class="kar-btn-plain" onclick="window.__karDeleteSelected()">Delete [Del]</button>
                <button type="button" class="kar-btn-plain" onclick="openKarigerPortalLoginModal()">App PIN [A]</button>
            `;
            filterPanel.appendChild(actWrap);
        }

        if (!document.getElementById('kar-dir-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'kar-dir-status-strip';
            strip.className = 'kar-status-strip';
            strip.innerHTML = `
                <span id="kar-dir-toast-msg" style="color:#92400e; font-weight:700;">[↑ ↓] Kariger Chunein · [Enter / Click] Open Tani Khata · [E] Edit · [Del] Delete · [F7 / +] Naya Kariger · [A] App PIN · [F2] Karkhana · [/] Search · [Esc] Back</span>
                <span id="kar-dir-count-lbl">0 Karigers</span>
            `;
            kSec.appendChild(strip);
        }
    };

    window.__karSetAbsentFilter = (days) => {
        const absSel = document.getElementById('kariger-absent-filter');
        if (absSel) absSel.value = String(days);
        document.querySelectorAll('#kariger-absent-pills .kar-abs-pill').forEach((b) => {
            b.classList.toggle('active', String(b.dataset.days) === String(days));
        });
        filterKariger();
    };

    const openKarigerModule = () => {
        karigerDirOpenedAt = performance.now();
        closeKarConfirm();
        ensureKarigerTallyStyles();
        ensureKarigerDirectoryChrome();

        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const kSec = document.getElementById('kariger-section');
        if (kSec) kSec.style.display = 'block';

        window.currentKarigerPage = 1;
        karigerListActiveIdx = 0;
        ensureKarigerMohallaField();
        bindKarigerFormEnterFlow();
        renderKarigerKarkhanaTabs();
        populateKarigerKarkhanaDropdown();
        renderKarigerTable();
        bindKarigerSearchInput();
        bindKarigerKeyboardEngine();
    };

    const backToDashboard = () => {
        closeKarConfirm();
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = window.innerWidth <= 860 ? 'block' : 'flex';
        notifyGlobalSync();
    };

    const renderKarigerKarkhanaTabs = () => {
        const bar = document.getElementById('kariger-karkhana-tabs-bar');
        if (!bar) return;

        const allKarigers = sanitizeKarigerList();
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const isAllActive = window.currentKarigerKarkhanaFilter === 'all';
        let html = `<button type="button" class="sheet-tab ${isAllActive ? 'active' : ''}" onclick="switchKarigerKarkhanaTab('all')">Sabhi (${allKarigers.length})</button>`;

        karkhanas.forEach((k) => {
            const count = allKarigers.filter((w) =>
                String(w.karkhanaId) === String(k.id) || (!w.karkhanaId && (k.isDefault || k.id === 'k_main'))
            ).length;
            const isActive = String(window.currentKarigerKarkhanaFilter) === String(k.id) ? 'active' : '';
            html += `<button type="button" class="sheet-tab ${isActive}" onclick="switchKarigerKarkhanaTab('${esc(k.id)}')">${esc(k.name)} (${count})</button>`;
        });

        bar.innerHTML = html;
    };

    const switchKarigerKarkhanaTab = (kId) => {
        window.currentKarigerKarkhanaFilter = kId || 'all';
        window.currentKarigerPage = 1;
        karigerListActiveIdx = 0;
        renderKarigerKarkhanaTabs();
        populateKarigerKarkhanaDropdown();
        renderKarigerTable();
    };

    const cycleKarigerKarkhanaTab = () => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown' }];
        const ids = ['all', ...karkhanas.map((k) => String(k.id))];
        const curIdx = ids.indexOf(String(window.currentKarigerKarkhanaFilter));
        switchKarigerKarkhanaTab(ids[(curIdx + 1) % ids.length]);
    };

    const bindKarigerSearchInput = () => {
        const searchInput = document.getElementById('search-kariger-input');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = 'true';
            searchInput.addEventListener('input', () => {
                window.currentKarigerPage = 1;
                karigerListActiveIdx = 0;
                renderKarigerTable();
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    searchInput.blur();
                    if (e.key === 'Enter' && currentKarigerPageRowsCache.length > 0) {
                        const chosen = currentKarigerPageRowsCache[karigerListActiveIdx] || currentKarigerPageRowsCache[0];
                        if (chosen) openKarigerSheet(chosen.id);
                    }
                }
            });
        }
    };

    const filterKariger = () => {
        window.currentKarigerPage = 1;
        karigerListActiveIdx = 0;
        renderKarigerTable();
    };

    const highlightKarigerDirRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#kariger-table-body .kar-dir-row'));
        if (!rows.length) return;
        karigerListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === karigerListActiveIdx));
        rows[karigerListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    const renderKarigerTable = () => {
        ensureKarigerTallyStyles();
        ensureKarigerDirectoryChrome();
        bindKarigerSearchInput();

        const tbody = document.getElementById('kariger-table-body');
        if (!tbody) return;

        let list = sanitizeKarigerList();

        if (window.currentKarigerKarkhanaFilter !== 'all') {
            list = list.filter((k) =>
                String(k.karkhanaId) === String(window.currentKarigerKarkhanaFilter) ||
                (!k.karkhanaId && window.currentKarigerKarkhanaFilter === 'k_main')
            );
        }

        const searchInput = document.getElementById('search-kariger-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (txt) {
            list = list.filter((k) => {
                const kName = k.karkhanaName || ((typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : '');
                return `${k.name || ''} ${k.saree || ''} ${k.mobile || ''} ${k.mohalla || ''} ${kName || ''} ${k.date || ''}`.toLowerCase().includes(txt);
            });
        }

        const absentFilterEl = document.getElementById('kariger-absent-filter');
        const absentFilterVal = parseInt(absentFilterEl ? absentFilterEl.value : 0, 10) || 0;
        if (absentFilterVal > 0) {
            list = list.filter((k) => getKarigerAbsentDays(k.id, k.date) >= absentFilterVal);
        }

        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / window.karigerPageSize) || 1;
        if (window.currentKarigerPage > totalPages) window.currentKarigerPage = totalPages;
        if (window.currentKarigerPage < 1) window.currentKarigerPage = 1;

        setText('kar-dir-count-lbl', `${totalItems} Karigers`);

        const pagBar = document.getElementById('kariger-pagination-bar');
        if (pagBar) {
            if (!totalItems) {
                pagBar.style.display = 'none';
            } else {
                pagBar.style.display = 'flex';
                const startIdx = (window.currentKarigerPage - 1) * window.karigerPageSize + 1;
                const endIdx = Math.min(window.currentKarigerPage * window.karigerPageSize, totalItems);

                pagBar.innerHTML = `
                    <div style="color:#6b7280; font-weight:600;">Dikh rahe hain: <strong>${startIdx} - ${endIdx}</strong> (Kul: <strong>${totalItems}</strong>)</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button type="button" class="kar-btn-plain" onclick="prevKarigerPage()">◀ Pichla</button>
                        <span style="background:#fdf6e2; border:1px solid #e5d5a7; padding:4px 10px; border-radius:4px; font-weight:700;">Page ${window.currentKarigerPage} / ${totalPages}</span>
                        <button type="button" class="kar-btn-plain" onclick="nextKarigerPage()">Agla ▶</button>
                    </div>`;
            }
        }

        if (!totalItems) {
            currentKarigerPageRowsCache = [];
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:22px; color:#6b7280;">Koi Kariger nahi mila${absentFilterVal > 0 ? ` jo ${absentFilterVal} din se absent ho.` : '.'}</td></tr>`;
            return;
        }

        const startIndex = (window.currentKarigerPage - 1) * window.karigerPageSize;
        const pageList = list.slice(startIndex, startIndex + window.karigerPageSize);
        currentKarigerPageRowsCache = pageList;
        if (karigerListActiveIdx >= pageList.length) karigerListActiveIdx = 0;
        if (karigerListActiveIdx < 0) karigerListActiveIdx = 0;

        let html = '';
        pageList.forEach((k, idx) => {
            const actualIdx = startIndex + idx + 1;
            const kName = k.karkhanaName || ((typeof window.getKarkhanaNameById === 'function')
                ? window.getKarkhanaNameById(k.karkhanaId)
                : 'Main Godown');

            const kBadge = `<span style="font-size:11px; background:#fdf6e2; color:#92400e; border:1px solid #e5d5a7; padding:2px 7px; border-radius:4px; font-weight:700;">${esc(kName)}</span>`;

            const absentDays = getKarigerAbsentDays(k.id, k.date);
            let absentBadge = '';
            if (absentDays >= 30) {
                absentBadge = ` <span style="background:#fdf6e2; color:#92400e; border:1px solid #d9a425; font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px;">${absentDays}d Absent</span>`;
            } else if (absentDays >= 15) {
                absentBadge = ` <span style="background:#fdfcf7; color:#b47d00; border:1px solid #e5d5a7; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;">${absentDays}d Absent</span>`;
            }

            const mohallaDisplay = k.mohalla ? `<br><small style="color:#6b7280; font-size:11px;">${esc(k.mohalla)}</small>` : '';
            const activeCls = (idx === karigerListActiveIdx) ? ' active' : '';

            html += `<tr class="kar-dir-row${activeCls}" data-kidx="${idx}" onclick="window.__karSelectAndOpen(${idx}, '${esc(k.id)}')">
                <td>${actualIdx}</td>
                <td>${kBadge}</td>
                <td><strong>${esc(k.name)}</strong>${absentBadge}${mohallaDisplay}</td>
                <td>${esc(k.saree || '-')}</td>
                <td>${esc(k.mobile || '-')}</td>
                <td>${esc(k.date || '-')}</td>
                <td style="text-align:right; font-weight:700; font-size:12px;">Tani Khata →</td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    window.__karSelectAndOpen = (idx, id) => {
        highlightKarigerDirRow(idx);
        openKarigerSheet(id);
    };

    window.__karEditSelected = () => {
        const chosen = currentKarigerPageRowsCache[karigerListActiveIdx];
        if (!chosen) return showSheetToast('⚠️ Pehle list me se Kariger chunein!', true);
        editKariger(chosen.id);
    };

    window.__karDeleteSelected = () => {
        const chosen = currentKarigerPageRowsCache[karigerListActiveIdx];
        if (!chosen) return showSheetToast('⚠️ Pehle list me se Kariger chunein!', true);
        deleteKariger(chosen.id);
    };

    const nextKarigerPage = () => { window.currentKarigerPage++; karigerListActiveIdx = 0; renderKarigerTable(); };
    const prevKarigerPage = () => { if (window.currentKarigerPage > 1) { window.currentKarigerPage--; karigerListActiveIdx = 0; renderKarigerTable(); } };

    const populateKarigerKarkhanaDropdown = () => {
        const sel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        if (!sel) return;
        sel.innerHTML = '';
        let kList = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!kList.length) kList = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        kList.forEach((k) => {
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.textContent = k.name;
            sel.appendChild(opt);
        });

        if (window.currentKarigerKarkhanaFilter !== 'all') {
            sel.value = window.currentKarigerKarkhanaFilter;
        }
    };

    const toggleKarigerForm = () => {
        const f = document.getElementById('add-kariger-form');
        if (!f) return;
        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';
        if (isOpening) {
            ensureKarigerMohallaField();
            bindKarigerFormEnterFlow();
            setVal('kar-edit-id', '');
            setVal('kar-name', '');
            setVal('kar-saree', '');
            setVal('kar-mobile', '');
            setVal('kar-mohalla', '');
            setVal('kar-date', getTodayIso());
            populateKarigerKarkhanaDropdown();
            setTimeout(() => document.getElementById('kar-name')?.focus(), 40);
        }
    };

    const saveKariger = () => {
        if (isSavingKariger) return showSheetToast('⏳ Save chal raha hai...');
        const now = Date.now();
        if (now - lastKarigerSaveTime < 1000) return showSheetToast('⏳ 1 second baad try karein');

        ensureKarigerMohallaField();
        const editId = (document.getElementById('kar-edit-id')?.value) || '';
        const n = String(document.getElementById('kar-name')?.value || '').trim().toUpperCase();
        const s = String(document.getElementById('kar-saree')?.value || '').trim();
        const m = String(document.getElementById('kar-mobile')?.value || '').trim();
        const moh = String(document.getElementById('kar-mohalla')?.value || '').trim();
        const d = toIsoDate(document.getElementById('kar-date')?.value || '') || getTodayIso();

        if (!n) {
            showSheetToast('⚠️ Kariger ka naam zaroori hai!', true);
            document.getElementById('kar-name')?.focus();
            return;
        }

        const kSel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        const chosenKid = kSel ? kSel.value : (window.currentKarigerKarkhanaFilter !== 'all' ? window.currentKarigerKarkhanaFilter : 'k_main');
        const kName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(chosenKid) : 'Main Godown';

        isSavingKariger = true;
        lastKarigerSaveTime = now;
        try {
            const list = sanitizeKarigerList();

            if (editId) {
                const it = list.find((x) => String(x.id) === String(editId));
                if (!it) throw new Error('Edit record nahi mila!');
                it.name = n;
                it.saree = s;
                it.mobile = m;
                it.mohalla = moh;
                it.date = d;
                it.karkhanaId = chosenKid;
                it.karkhanaName = kName;
            } else {
                const dup = list.find((x) =>
                    String(x.name || '').trim().toUpperCase() === n &&
                    String(x.karkhanaId || 'k_main') === String(chosenKid || 'k_main')
                );
                if (dup) throw new Error(`[${n}] is karkhane me pehle se saved hai!`);
                list.push({
                    id: `kar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    name: n,
                    saree: s,
                    mobile: m,
                    mohalla: moh,
                    date: d,
                    karkhanaId: chosenKid,
                    karkhanaName: kName
                });
            }

            if (typeof window.setStore === 'function') window.setStore('kariger_list', list);
            if (typeof window.populateKarigersDatalist === 'function') window.populateKarigersDatalist();
            toggleKarigerForm();
            renderKarigerKarkhanaTabs();
            renderKarigerTable();
            notifyGlobalSync();
            showSheetToast('✅ Kariger safalta-poorvak save ho gaya!');
        } catch (error) {
            showSheetToast('⚠️ ' + error.message, true);
        } finally {
            isSavingKariger = false;
        }
    };

    const editKariger = (id) => {
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(id));
        if (!k) return;
        const f = document.getElementById('add-kariger-form');
        if (f) f.style.display = 'block';

        ensureKarigerMohallaField();
        bindKarigerFormEnterFlow();
        populateKarigerKarkhanaDropdown();

        setVal('kar-edit-id', k.id);
        setVal('kar-name', k.name);
        setVal('kar-saree', k.saree || '');
        setVal('kar-mobile', k.mobile || '');
        setVal('kar-mohalla', k.mohalla || k.address || k.pata || '');
        setVal('kar-date', toIsoDate(k.date || getTodayIso()));

        const kSel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        if (kSel) kSel.value = k.karkhanaId || 'k_main';
        setTimeout(() => document.getElementById('kar-name')?.focus(), 40);
    };

    const deleteKariger = (id) => {
        if (!id || isDeletingKarItem) return;
        const target = sanitizeKarigerList().find((x) => String(x.id) === String(id));
        if (!target) return showSheetToast('⚠️ Kariger record nahi mila!', true);

        showKarConfirm(`🗑️ Kya aap Kariger [${target.name}] ko delete karna chahte hain?`, () => {
            if (isDeletingKarItem) return;
            isDeletingKarItem = true;
            try {
                const list = sanitizeKarigerList().filter((x) => String(x.id) !== String(id));
                if (typeof window.setStore === 'function') window.setStore('kariger_list', list);
                if (typeof window.populateKarigersDatalist === 'function') window.populateKarigersDatalist();
                renderKarigerKarkhanaTabs();
                renderKarigerTable();
                notifyGlobalSync();
                showSheetToast(`🗑️ Kariger [${target.name}] delete ho gaya!`);
            } finally {
                isDeletingKarItem = false;
            }
        });
    };

    /* ========================================================================
       2. LIVE STOCK DISPLAY & INLINE TALLY ITEM PICKER (NO BROWSER DROPDOWN)
    ======================================================================== */
    const getStockOptionsForField = (inputId) => {
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';
        const seen = new Set();
        const items = [];

        if (inputId === 'line-bana-name') {
            const raw = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
            raw.forEach((b) => {
                const nm = b?.name ? b.name.trim() : '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getBanaItemStats === 'function')
                        ? safeNum(window.getBanaItemStats(nm, kGodown).bacha)
                        : safeNum(b.bacha);
                    items.push({ name: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        } else if (inputId === 'line-zari-name') {
            const raw = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
            raw.forEach((z) => {
                const nm = z?.name ? z.name.trim() : '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getZariItemStats === 'function')
                        ? safeNum(window.getZariItemStats(nm, kGodown).bacha)
                        : safeNum(z.bacha);
                    items.push({ name: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        } else if (inputId === 'sheet-tani-item' || inputId === 'sheet-chukka-item') {
            const targetCat = (inputId === 'sheet-chukka-item') ? 'chukka' : 'tani';
            const raw = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            raw.filter((s) => (s?.category || 'tani').toLowerCase() === targetCat).forEach((s) => {
                const nm = s?.name ? s.name.trim() : '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = safeNum(s.bacha !== undefined ? s.bacha : s.aaya);
                    items.push({ name: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        }
        return items;
    };

    const attachTallyInlineSuggest = (inputId, nextFocusId) => {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        inp.removeAttribute('list');
        inp.setAttribute('autocomplete', 'off');

        if (inp.dataset.suggestBound) return;
        inp.dataset.suggestBound = 'true';

        const parent = inp.parentElement;
        if (!parent) return;
        parent.style.position = 'relative';

        const pop = document.createElement('div');
        pop.className = 'kar-suggest-pop';
        parent.appendChild(pop);

        let activeSugIdx = 0;

        const renderPop = () => {
            const q = inp.value.trim().toLowerCase();
            const opts = getStockOptionsForField(inputId).filter((o) => !q || o.name.toLowerCase().includes(q));
            if (!opts.length) {
                pop.style.display = 'none';
                pop.innerHTML = '';
                return;
            }
            if (activeSugIdx >= opts.length) activeSugIdx = 0;
            pop.innerHTML = opts.map((o, i) => `
                <div class="kar-suggest-opt${i === activeSugIdx ? ' active' : ''}" data-val="${esc(o.name)}">
                    <span>${esc(o.name)}</span>
                    <small style="color:#92400e;">${esc(o.meta)}</small>
                </div>
            `).join('');
            pop.style.display = 'block';

            pop.querySelectorAll('.kar-suggest-opt').forEach((el) => {
                el.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    inp.value = el.dataset.val || '';
                    pop.style.display = 'none';
                    updateLiveStockDisplay();
                    saveCurrentSheetConfig();
                    if (nextFocusId) document.getElementById(nextFocusId)?.focus();
                });
            });
        };

        inp.addEventListener('input', () => {
            activeSugIdx = 0;
            renderPop();
        });

        inp.addEventListener('blur', () => {
            setTimeout(() => { pop.style.display = 'none'; }, 140);
        });

        inp.addEventListener('keydown', (e) => {
            if (pop.style.display !== 'block') return;
            const opts = Array.from(pop.querySelectorAll('.kar-suggest-opt'));
            if (!opts.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                activeSugIdx = (activeSugIdx + 1) % opts.length;
                opts.forEach((o, i) => o.classList.toggle('active', i === activeSugIdx));
                opts[activeSugIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                activeSugIdx = (activeSugIdx - 1 + opts.length) % opts.length;
                opts.forEach((o, i) => o.classList.toggle('active', i === activeSugIdx));
                opts[activeSugIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                const chosen = opts[activeSugIdx];
                if (chosen) {
                    inp.value = chosen.dataset.val || inp.value;
                    pop.style.display = 'none';
                    updateLiveStockDisplay();
                    saveCurrentSheetConfig();
                }
            } else if (e.key === 'Escape') {
                pop.style.display = 'none';
            }
        });
    };

    const populateSheetDatalists = () => {
        attachTallyInlineSuggest('line-bana-name', 'row-cone');
        attachTallyInlineSuggest('line-zari-name', 'row-zariqty');
        attachTallyInlineSuggest('sheet-tani-item', 'sheet-tani-sancha');
        attachTallyInlineSuggest('sheet-chukka-item', 'sheet-chukka-sancha');
    };

    const updateLiveStockDisplay = () => {
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        const bName = String(document.getElementById('line-bana-name')?.value || '').trim();
        const zName = String(document.getElementById('line-zari-name')?.value || '').trim();
        const tName = String(document.getElementById('sheet-tani-item')?.value || '').trim().toLowerCase();
        const cName = String(document.getElementById('sheet-chukka-item')?.value || '').trim().toLowerCase();

        let bBacha = 0;
        if (bName && typeof window.getBanaItemStats === 'function') {
            bBacha = safeNum(window.getBanaItemStats(bName, kGodown).bacha);
        }

        let zBacha = 0;
        if (zName && typeof window.getZariItemStats === 'function') {
            zBacha = safeNum(window.getZariItemStats(zName, kGodown).bacha);
        }

        const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const tItem = sList.find((x) => {
            const matchK = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === tName && matchK;
        });

        const cItem = sList.find((x) => {
            const matchK = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === cName && matchK;
        });

        setText('live-bana-stock-badge', `Bacha: ${bBacha.toFixed(2)} Kg`);
        setText('live-zari-stock-badge', `Bacha: ${zBacha.toFixed(2)} Kg`);
        setText('live-tani-stock-badge', `Bacha: ${tItem ? safeNum(tItem.bacha !== undefined ? tItem.bacha : tItem.aaya).toFixed(2) : '0.00'} Kg`);
        setText('live-chukka-stock-badge', `Bacha: ${cItem ? safeNum(cItem.bacha !== undefined ? cItem.bacha : cItem.aaya).toFixed(2) : '0.00'} Kg`);
    };

    /* ========================================================================
       2B. SKETCH-EXACT WORKSPACE BUILDER:
           LEFT FULL-HEIGHT: Rozana Line Entry
           RIGHT TOP: Tani Khata Register
           RIGHT BOTTOM: 3 Aligned Cards (Mazdoori | Bana | Zari)
    ======================================================================== */
    const toggleSheetSetupDrawer = (forceState = null) => {
        const body = document.getElementById('kar-sheet-setup-body');
        const btn = document.getElementById('kar-sheet-setup-toggle-btn');
        if (!body) return;
        sheetSetupExpanded = (forceState !== null) ? Boolean(forceState) : !sheetSetupExpanded;
        body.style.display = sheetSetupExpanded ? 'block' : 'none';
        if (btn) btn.textContent = sheetSetupExpanded ? 'Hide Setup [F9]' : 'Rates, Sancha & 8 Colors [F9]';
    };

    const updateSheetSetupSummaryLine = (sh) => {
        if (!sh) return;
        const rateBani = (sh.rateBani !== undefined) ? sh.rateBani : 240;
        const tPcs = (sh.taniPcs !== undefined) ? sh.taniPcs : 72;
        const pBana = safeNum(sh.pichlaBana);
        const pZari = safeNum(sh.pichlaZari);
        const pBani = safeNum(sh.pichlaBani);
        const sanchaTxt = sh.taniSancha ? sh.taniSancha : '-';
        setText(
            'kar-sheet-setup-summary',
            `Bani Rate: ₹${rateBani}/Pc · Target: ${tPcs} Pcs · Pichla: Bana ${pBana.toFixed(2)} Kg | Zari ${pZari.toFixed(2)} Kg | Bani ₹${pBani.toFixed(0)} · Sancha: ${sanchaTxt}`
        );
    };

    const cancelEditTaniRow = () => {
        window.editingRowIndex = null;
        setVal('row-date', getTodayIso());
        setVal('row-cone', '');
        setVal('row-lesstp', '');
        setVal('row-zariqty', '');
        setVal('row-topi', '');
        setVal('row-saree', '');
        setVal('row-lott', '');
        setVal('row-paid', '');
        setVal('row-retbana', '');
        setVal('row-retzari', '');

        const sheets = (typeof window.getKarigerSheets === 'function' && window.activeKarigerId)
            ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (sh) {
            setVal('line-bana-name', sh.banaItem || '');
            setVal('line-zari-name', sh.zariItem || '');
        }

        const btn = document.getElementById('row-submit-btn');
        if (btn) btn.textContent = '+ Line Jodein & Stock Minus';
        const cBtn = document.getElementById('kar-row-cancel-edit-btn');
        if (cBtn) cBtn.style.display = 'none';
        document.querySelectorAll('#sheet-table-body .kar-khata-row').forEach((tr) => tr.classList.remove('editing'));
    };

    const bindLineEntryEnterFlow = () => {
        bindFieldListTraversal(
            [
                'row-date', 'row-saree', 'row-lott', 'row-retbana', 'row-retzari',
                'line-bana-name', 'row-cone', 'row-lesstp',
                'line-zari-name', 'row-zariqty', 'row-topi', 'row-paid'
            ],
            () => saveTaniRow(),
            true
        );

        bindFieldListTraversal(
            [
                'rate-bana-input', 'rate-zari-input', 'rate-bani-input', 'pichla-bana-input',
                'pichla-zari-input', 'pichla-bani-input', 'waste-bana-input', 'waste-zari-input',
                'sheet-tani-item', 'sheet-tani-sancha', 'sheet-tani-wazan', 'sheet-tani-pcs',
                'sheet-chukka-item', 'sheet-chukka-sancha', 'sheet-chukka-wazan', 'sheet-chukka-pcs',
                'sheet-color-1', 'sheet-color-2', 'sheet-color-3', 'sheet-color-4',
                'sheet-color-5', 'sheet-color-6', 'sheet-color-7', 'sheet-color-8'
            ],
            () => {
                saveCurrentSheetConfig();
                toggleSheetSetupDrawer(false);
                document.getElementById('row-saree')?.focus();
            },
            true
        );
    };

    const bindStrictManualNumberGuard = () => {
        if (window.__karManualNumGuardBound) return;
        window.__karManualNumGuardBound = true;

        document.addEventListener('wheel', (e) => {
            const target = e.target;
            if (target && target.tagName === 'INPUT' && target.type === 'number') {
                if (target.closest('#kariger-section, #kariger-sheet-section')) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            const target = e.target;
            if (target && target.tagName === 'INPUT' && target.type === 'number') {
                if (target.closest('#kariger-section, #kariger-sheet-section')) {
                    e.preventDefault();
                }
            }
        }, true);
    };

    const setupKarigerSheetTallyLayout = () => {
        ensureKarigerTallyStyles();
        bindStrictManualNumberGuard();
        const shSec = document.getElementById('kariger-sheet-section');
        if (!shSec || shSec.dataset.tallyLayoutBuilt === '1') return;
        shSec.dataset.tallyLayoutBuilt = '1';

        const backBtn = shSec.querySelector('.module-header .back-btn');
        if (backBtn) backBtn.textContent = '← [Esc] Kariger List';
        const nayiTaniBtn = shSec.querySelector('.module-header button[onclick*="addNewTaniSheet"]');
        if (nayiTaniBtn) nayiTaniBtn.textContent = '+ Nayi Tani [Alt+N]';
        const waHeaderBtn = shSec.querySelector('.module-header button[onclick*="sendKarigerWhatsAppParchi"]');
        if (waHeaderBtn) waHeaderBtn.textContent = 'WhatsApp';

        const tabsBar = document.getElementById('sheet-tabs-container');
        const closingGrid = shSec.querySelector('.tani-closing-grid');
        const banaInput = document.getElementById('line-bana-name');
        const zariInput = document.getElementById('line-zari-name');
        const banaGroup = banaInput?.closest('.input-group');
        const zariGroup = zariInput?.closest('.input-group');
        const itemBox = document.getElementById('sheet-tani-item')?.closest('.form-row-4')?.parentElement;
        const submitBtn = document.getElementById('row-submit-btn');
        const entryBox = submitBtn?.closest('.form-row-3')?.parentElement;
        const tableWrap = document.getElementById('sheet-table-body')?.closest('.table-responsive');
        const summaryWrap = document.getElementById('calc-remaining-amt')?.parentElement?.parentElement?.parentElement;

        const tbl = tableWrap?.querySelector('table');
        if (tbl) {
            tbl.classList.add('kar-khata-table');
            const ths = tbl.querySelectorAll('thead th');
            const compactHeads = ['DATE', 'BANA', 'ZARI', 'SAREE', 'LOTT', 'PAID', 'RET.B', 'RET.Z', 'ACT'];
            ths.forEach((th, i) => { if (compactHeads[i]) th.textContent = compactHeads[i]; });
        }
        const theadRow = tbl?.querySelector('thead tr');
        if (theadRow) theadRow.removeAttribute('style');
        const tfoot = tbl?.querySelector('tfoot');
        if (tfoot) tfoot.removeAttribute('style');

        const setupWrap = document.createElement('div');
        setupWrap.id = 'kar-sheet-setup-wrapper';
        setupWrap.className = 'kar-setup-wrap';
        setupWrap.innerHTML = `
            <div class="kar-setup-strip" onclick="window.__karToggleSetupDrawer()">
                <span class="kar-setup-summary" id="kar-sheet-setup-summary">Bani Rate: ₹240/Pc · Target: 72 Pcs · Pichla: Bana 0.00 Kg | Zari 0.00 Kg | Bani ₹0</span>
                <button type="button" id="kar-sheet-setup-toggle-btn" class="kar-btn-plain" onclick="event.stopPropagation(); window.__karToggleSetupDrawer()">Rates, Sancha &amp; 8 Colors [F9]</button>
            </div>
            <div class="kar-setup-body" id="kar-sheet-setup-body" style="display:none;"></div>
        `;
        if (tabsBar) tabsBar.insertAdjacentElement('afterend', setupWrap);
        else shSec.appendChild(setupWrap);

        const setupBody = document.getElementById('kar-sheet-setup-body');
        if (closingGrid) setupBody.appendChild(closingGrid);
        if (itemBox) {
            itemBox.className = 'kar-setup-item-box';
            itemBox.removeAttribute('style');
            const firstTitle = itemBox.querySelector('div');
            if (firstTitle && firstTitle.textContent.includes('Item Selection')) {
                firstTitle.style.display = 'none';
            }
            const emptyRow2 = banaGroup?.parentElement;
            setupBody.appendChild(itemBox);
            if (emptyRow2) emptyRow2.style.display = 'none';
        }

        const splitGrid = document.createElement('div');
        splitGrid.id = 'kar-sheet-split-grid';
        splitGrid.className = 'kar-sheet-split';

        const leftEntryCard = document.createElement('div');
        leftEntryCard.className = 'kar-left-entry-card';
        leftEntryCard.innerHTML = `
            <div class="kar-pane-head">
                <strong>Rozana Line Entry</strong>
                <small>[Enter / ↓] Next · Save</small>
            </div>
            <div class="kar-voucher-body" id="kar-voucher-entry-body"></div>
        `;

        const rightMainCol = document.createElement('div');
        rightMainCol.className = 'kar-right-main-col';

        const tableCard = document.createElement('div');
        tableCard.className = 'kar-table-card';
        tableCard.innerHTML = `
            <div class="kar-pane-head">
                <strong>Tani Khata Register</strong>
                <small id="kar-sheet-row-count">0 Entries</small>
            </div>
        `;
        if (tableWrap) tableCard.appendChild(tableWrap);
        rightMainCol.appendChild(tableCard);

        if (summaryWrap) {
            summaryWrap.classList.add('kar-summary-3col');
            rightMainCol.appendChild(summaryWrap);
        }

        splitGrid.appendChild(leftEntryCard);
        splitGrid.appendChild(rightMainCol);
        setupWrap.insertAdjacentElement('afterend', splitGrid);

        const vBody = document.getElementById('kar-voucher-entry-body');
        const gDate = document.getElementById('row-date')?.closest('.input-group');
        const gCone = document.getElementById('row-cone')?.closest('.input-group');
        const gLessTp = document.getElementById('row-lesstp')?.closest('.input-group');
        const gZariQty = document.getElementById('row-zariqty')?.closest('.input-group');
        const gTopi = document.getElementById('row-topi')?.closest('.input-group');
        const gSaree = document.getElementById('row-saree')?.closest('.input-group');
        const gLott = document.getElementById('row-lott')?.closest('.input-group');
        const gPaid = document.getElementById('row-paid')?.closest('.input-group');
        const gRetBana = document.getElementById('row-retbana')?.closest('.input-group');
        const gRetZari = document.getElementById('row-retzari')?.closest('.input-group');

        if (gDate) {
            gDate.classList.remove('input-group');
            gDate.classList.add('kar-v-row-1');
            vBody.appendChild(gDate);
        }

        const secIn = document.createElement('div');
        secIn.className = 'kar-v-sec';
        secIn.textContent = 'INWARD — SAREE & WAPSI';
        vBody.appendChild(secIn);

        const rIn1 = document.createElement('div');
        rIn1.className = 'kar-v-grid-2';
        if (gSaree) rIn1.appendChild(gSaree);
        if (gLott) rIn1.appendChild(gLott);
        vBody.appendChild(rIn1);

        const rIn2 = document.createElement('div');
        rIn2.className = 'kar-v-grid-2';
        if (gRetBana) rIn2.appendChild(gRetBana);
        if (gRetZari) rIn2.appendChild(gRetZari);
        vBody.appendChild(rIn2);

        const secOut = document.createElement('div');
        secOut.className = 'kar-v-sec';
        secOut.textContent = 'OUTWARD — BANA & ZARI';
        vBody.appendChild(secOut);

        if (banaGroup) {
            banaGroup.style.marginBottom = '6px';
            vBody.appendChild(banaGroup);
        }
        const rOut1 = document.createElement('div');
        rOut1.className = 'kar-v-grid-2';
        if (gCone) rOut1.appendChild(gCone);
        if (gLessTp) rOut1.appendChild(gLessTp);
        vBody.appendChild(rOut1);

        if (zariGroup) {
            zariGroup.style.marginBottom = '6px';
            vBody.appendChild(zariGroup);
        }
        const rOut2 = document.createElement('div');
        rOut2.className = 'kar-v-grid-2';
        if (gZariQty) rOut2.appendChild(gZariQty);
        if (gTopi) rOut2.appendChild(gTopi);
        vBody.appendChild(rOut2);

        const secPay = document.createElement('div');
        secPay.className = 'kar-v-sec';
        secPay.textContent = 'MAZDOORI PAYMENT';
        vBody.appendChild(secPay);

        if (gPaid) {
            gPaid.classList.remove('input-group');
            gPaid.classList.add('kar-v-row-1');
            vBody.appendChild(gPaid);
        }

        const actRow = document.createElement('div');
        actRow.className = 'kar-voucher-actions';
        const cancelEditBtn = document.createElement('button');
        cancelEditBtn.type = 'button';
        cancelEditBtn.id = 'kar-row-cancel-edit-btn';
        cancelEditBtn.className = 'kar-btn-plain';
        cancelEditBtn.style.display = 'none';
        cancelEditBtn.textContent = 'Cancel';
        cancelEditBtn.onclick = () => cancelEditTaniRow();
        actRow.appendChild(cancelEditBtn);
        if (submitBtn) actRow.appendChild(submitBtn);
        vBody.appendChild(actRow);

        if (entryBox && entryBox !== vBody) entryBox.style.display = 'none';

        if (!document.getElementById('kar-sheet-status-strip')) {
            const strip = document.createElement('div');
            strip.id = 'kar-sheet-status-strip';
            strip.className = 'kar-status-strip';
            strip.innerHTML = `
                <span id="kar-sheet-toast-msg" style="color:#92400e; font-weight:700;">[Enter / ↓] Next Field &amp; Save · [F9] Rates, Sancha &amp; 8 Colors · [Alt+N] Nayi Tani · [Ctrl+P / Alt+P] A6 Print · [Esc] Back</span>
                <span>TallyPrime Sheet Workspace</span>
            `;
            shSec.appendChild(strip);
        }

        bindLineEntryEnterFlow();
    };

    window.__karToggleSetupDrawer = () => toggleSheetSetupDrawer();

    /* ========================================================================
       3. TANI KHATA CONTROLLER & STRICT GATEKEEPER
    ======================================================================== */
    const openKarigerSheet = (id) => {
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(id));
        if (!k) return showSheetToast('⚠️ Kariger nahi mila!', true);

        closeKarConfirm();
        window.activeKarigerId = k.id;
        window.editingRowIndex = null;

        if (typeof window.syncKarigerSheetLive === 'function') {
            window.syncKarigerSheetLive(k.id);
        } else if (window.CloudEngine && typeof window.CloudEngine.syncKarigerSheetLive === 'function') {
            window.CloudEngine.syncKarigerSheetLive(k.id);
        }

        ensureKarigerTallyStyles();
        bindStrictManualNumberGuard();
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const shSec = document.getElementById('kariger-sheet-section');
        if (shSec) shSec.style.display = 'block';

        setupKarigerSheetTallyLayout();
        cancelEditTaniRow();
        bindKarigerKeyboardEngine();

        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        setText('sheet-kariger-title', `${k.name} (${kGodamName}) — Saree: ${k.saree || '-'}`);
        setVal('row-date', getTodayIso());

        const waBtn = document.querySelector('button[onclick*="sendKarigerWhatsAppParchi"]');
        if (waBtn && waBtn.parentElement && !document.getElementById('btn-print-kariger-sheet')) {
            const printBtn = document.createElement('button');
            printBtn.id = 'btn-print-kariger-sheet';
            printBtn.type = 'button';
            printBtn.className = 'sheet-btn';
            printBtn.innerHTML = 'Print [Ctrl+P]';
            printBtn.onclick = () => openKarigerPrintModal();
            waBtn.parentElement.insertBefore(printBtn, waBtn.nextSibling);
        }

        let sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        if (!sheets || !sheets.length) {
            sheets = [{
                id: 'tani_1', title: 'Tani 1',
                pichlaBana: 0, pichlaZari: 0, pichlaBani: 0,
                banaWaste: 0, zariWaste: 0,
                rateBana: 0.311, rateZari: 0.110, rateBani: 240,
                taniPcs: 72, chukkaPcs: 72, colors: [],
                note: '', rows: []
            }];
            if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        }

        window.activeSheetIndex = sheets.length ? sheets.length - 1 : 0;

        populateSheetDatalists();
        renderSheetTabs();
        loadCurrentSheetData();
        setTimeout(() => document.getElementById('row-saree')?.focus(), 50);
    };

    const renderSheetTabs = () => {
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const box = document.getElementById('sheet-tabs-container');
        if (!box) return;
        box.innerHTML = '';
        sheets.forEach((sh, idx) => {
            if (!sh) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `sheet-tab ${idx === window.activeSheetIndex ? 'active' : ''}`;
            btn.innerHTML = `${esc(sh.title)}${sheets.length > 1 ? `<span class="del-tab-btn" onclick="deleteTaniSheet(${idx}, event)"> ×</span>` : ''}`;
            btn.onclick = () => switchTaniSheetTab(idx);
            box.appendChild(btn);
        });
    };

    const switchTaniSheetTab = (idx) => {
        closeKarConfirm();
        window.activeSheetIndex = idx;
        cancelEditTaniRow();
        renderSheetTabs();
        loadCurrentSheetData();
    };

    const addNewTaniSheet = () => {
        if (isAddingTaniSheet) return showSheetToast('⏳ Nayi Tani load ho rahi hai...');
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kName = kariger ? String(kariger.name || '').trim().toUpperCase() : '';

        const rawOrders = (typeof window.getStore === 'function') ? window.getStore('tani_orders_list') : localStorage.getItem('tani_orders_list');
        const orders = window.safeArray ? window.safeArray(rawOrders) : (Array.isArray(rawOrders) ? rawOrders : []);

        const readyTani = orders.find((o) => {
            if (!o) return false;
            const isReady = String(o.status || '').toLowerCase() === 'ready';
            const oKariger = String(o.kariger || '').trim().toUpperCase();
            return isReady && oKariger === kName;
        });

        if (!readyTani) {
            return showSheetToast(`⚠️ [${kariger?.name || 'Kariger'}] ka naya taana abhi 'Ready' nahi hai! Pehle Tani Order me 'Ready' mark karein.`, true);
        }

        isAddingTaniSheet = true;
        const snapOrders = JSON.parse(JSON.stringify(orders));
        const snapSheets = JSON.parse(JSON.stringify((typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : []));
        let mutatedOrder = false;

        try {
            saveCurrentSheetConfig();

            const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
            const cur = sheets.length ? sheets[sheets.length - 1] : null;
            const calc = (cur && typeof window.calculateSheetTotals === 'function')
                ? window.calculateSheetTotals(cur)
                : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

            let maxNum = sheets.length;
            sheets.forEach((s) => {
                if (!s) return;
                const m1 = String(s.id || '').match(/(\d+)$/);
                const m2 = String(s.title || '').match(/(\d+)$/);
                if (m1) maxNum = Math.max(maxNum, parseInt(m1[1], 10) || 0);
                if (m2) maxNum = Math.max(maxNum, parseInt(m2[1], 10) || 0);
            });
            const nextNum = maxNum + 1;

            const newColors = [];
            if (Array.isArray(readyTani.matchingTable)) {
                readyTani.matchingTable.forEach((m) => {
                    if (m) newColors.push(m.saree || m.bana || m.border || '');
                });
            }

            const sanchaRangiCombined = `${readyTani.sancha || ''}${readyTani.rangi ? ' | Rangi: ' + readyTani.rangi : ''}`.trim();

            mutatedOrder = true;
            if (window.TaniOrderEngine && typeof window.TaniOrderEngine.markTaniMountedOnLoom === 'function') {
                window.TaniOrderEngine.markTaniMountedOnLoom(readyTani.id, kName);
            } else {
                readyTani.status = 'loom';
                if (!Array.isArray(readyTani.statusHistory)) readyTani.statusHistory = [];
                readyTani.statusHistory.push({
                    status: 'loom',
                    date: getTodayIso(),
                    note: `🪡 Kariger ${kName} ne Loom par taana chadha liya (Consumed)`,
                    timestamp: Date.now()
                });
                if (typeof window.setStore === 'function') {
                    window.setStore('tani_orders_list', orders);
                }
            }

            const carryBana = safeNum(calc.remainingBana);
            const carryZari = safeNum(calc.remainingZari);
            const carryBani = safeNum(calc.remainingAmt);

            sheets.push({
                id: `tani_${nextNum}`,
                title: `Tani ${nextNum}`,
                pichlaBana: carryBana,
                pichlaZari: carryZari,
                pichlaBani: carryBani,
                banaWaste: 0,
                zariWaste: 0,
                rateBana: cur ? safeNum(cur.rateBana, 0.311) : 0.311,
                rateZari: cur ? safeNum(cur.rateZari, 0.110) : 0.110,
                rateBani: cur ? safeNum(cur.rateBani, 240) : 240,
                taniPcs: safeNum(readyTani.pcs, 72),
                chukkaPcs: cur ? safeNum(cur.chukkaPcs, 72) : 72,
                taniSancha: sanchaRangiCombined,
                banaItem: readyTani.bana || (cur ? (cur.banaItem || '') : ''),
                zariItem: cur ? (cur.zariItem || '') : '',
                colors: newColors,
                linkedTaniOrderId: readyTani.id,
                linkedTaniOrderNo: readyTani.orderNo,
                note: `Tani #${readyTani.orderNo} (Sancha: ${readyTani.sancha || '-'}, Rangi: ${readyTani.rangi || '-'})`,
                rows: []
            });

            if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
            window.activeSheetIndex = sheets.length - 1;
            renderSheetTabs();
            loadCurrentSheetData();
            notifyGlobalSync();

            showSheetToast(`✅ Tani #${readyTani.orderNo} load hui! Pichla: Bana ${carryBana.toFixed(2)} Kg · Zari ${carryZari.toFixed(2)} Kg · Bani ₹${carryBani.toFixed(0)}`);
        } catch (err) {
            if (mutatedOrder) {
                if (typeof window.setStore === 'function') window.setStore('tani_orders_list', snapOrders);
                if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, snapSheets);
            }
            showSheetToast('❌ Nayi Tani load fail: ' + err.message, true);
        } finally {
            isAddingTaniSheet = false;
        }
    };

    const revertSanchaStock = (itemName, category, wazan) => {
        if (!itemName || !wazan) return;
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const found = sList.find((x) => {
            const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() && (x.category || 'tani').toLowerCase() === category.toLowerCase() && matchKid;
        });

        if (found) {
            found.gaya = Math.max(0, safeNum((safeNum(found.gaya) - safeNum(wazan)).toFixed(2)));
            found.bacha = safeNum((safeNum(found.aaya) - found.gaya).toFixed(2));
            if (typeof window.setStore === 'function') window.setStore('sancha_items', sList);
        }
    };

    const deleteTaniSheet = (idx, e) => {
        if (e) e.stopPropagation();
        if (isDeletingKarItem) return;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        if (sheets.length <= 1) return showSheetToast('⚠️ Pehli Tani Sheet delete nahi ho sakti!', true);
        const targetSh = sheets[idx];
        if (!targetSh) return;

        showKarConfirm(`🗑️ Kya aap [${targetSh.title}] sheet ko delete karna chahte hain?`, () => {
            if (isDeletingKarItem) return;
            isDeletingKarItem = true;
            const snapSancha = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('sancha_items')) : []));
            const snapSanchaHist = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('sancha_history')) : []));
            const snapSaree = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('saree_history')) : []));
            const snapBana = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('bana_history')) : []));
            const snapZari = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('zari_history')) : []));
            const snapSheets = JSON.parse(JSON.stringify((typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : []));
            let mutatedStorage = false;

            try {
                const curSheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
                const delSh = curSheets[idx];
                if (!delSh) return;

                mutatedStorage = true;
                if (delSh.taniItem && safeNum(delSh.taniWazan) > 0) {
                    revertSanchaStock(delSh.taniItem, 'tani', safeNum(delSh.taniWazan));
                }
                if (delSh.chukkaItem && safeNum(delSh.chukkaWazan) > 0) {
                    revertSanchaStock(delSh.chukkaItem, 'chukka', safeNum(delSh.chukkaWazan));
                }

                const refT = `${window.activeKarigerId}_${delSh.id}_tani`;
                const refC = `${window.activeKarigerId}_${delSh.id}_chukka`;
                let sanchaHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
                sanchaHist = sanchaHist.filter((h) => !h || (h.refId !== refT && h.refId !== refC));
                if (typeof window.setStore === 'function') window.setStore('sancha_history', sanchaHist);

                const rowIds = new Set((window.safeArray ? window.safeArray(delSh.rows) : []).map((r) => String(r?.id || '')));
                if (rowIds.size > 0 && typeof window.setStore === 'function') {
                    const sHist = (window.safeArray ? window.safeArray(window.getStore('saree_history')) : []).filter((h) => !h || !rowIds.has(String(h.refId || '')));
                    const bHist = (window.safeArray ? window.safeArray(window.getStore('bana_history')) : []).filter((h) => !h || !rowIds.has(String(h.refId || '')));
                    const zHist = (window.safeArray ? window.safeArray(window.getStore('zari_history')) : []).filter((h) => !h || !rowIds.has(String(h.refId || '')));
                    window.setStore('saree_history', sHist);
                    window.setStore('bana_history', bHist);
                    window.setStore('zari_history', zHist);
                }

                curSheets.splice(idx, 1);
                if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, curSheets);
                window.activeSheetIndex = Math.max(0, Math.min(idx, curSheets.length - 1));
                window.editingRowIndex = null;
                renderSheetTabs();
                loadCurrentSheetData();
                notifyGlobalSync();
                showSheetToast(`🗑️ [${delSh.title}] delete ho gayi!`);
            } catch (err) {
                if (mutatedStorage) {
                    if (typeof window.setStore === 'function') {
                        window.setStore('sancha_items', snapSancha);
                        window.setStore('sancha_history', snapSanchaHist);
                        window.setStore('saree_history', snapSaree);
                        window.setStore('bana_history', snapBana);
                        window.setStore('zari_history', snapZari);
                    }
                    if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, snapSheets);
                }
                showSheetToast('❌ Sheet delete fail: ' + err.message, true);
            } finally {
                isDeletingKarItem = false;
            }
        });
    };

    const loadCurrentSheetData = () => {
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex] || sheets[0];
        if (!sh) return;

        setVal('rate-bana-input', (sh.rateBana !== undefined) ? sh.rateBana : 0.311);
        setVal('rate-zari-input', (sh.rateZari !== undefined) ? sh.rateZari : 0.110);
        setVal('rate-bani-input', (sh.rateBani !== undefined) ? sh.rateBani : 240);
        setVal('pichla-bana-input', sh.pichlaBana || 0);
        setVal('pichla-zari-input', sh.pichlaZari || 0);
        setVal('pichla-bani-input', sh.pichlaBani || 0);
        setVal('waste-bana-input', sh.banaWaste || 0);
        setVal('waste-zari-input', sh.zariWaste || 0);

        setVal('line-bana-name', sh.banaItem || '');
        setVal('line-zari-name', sh.zariItem || '');
        setVal('sheet-tani-item', sh.taniItem || '');
        setVal('sheet-tani-sancha', sh.taniSancha || '');
        setVal('sheet-tani-wazan', sh.taniWazan || '');
        setVal('sheet-chukka-item', sh.chukkaItem || '');
        setVal('sheet-chukka-sancha', sh.chukkaSancha || '');
        setVal('sheet-chukka-wazan', sh.chukkaWazan || '');

        setVal('sheet-tani-pcs', (sh.taniPcs !== undefined) ? sh.taniPcs : 72);
        setVal('sheet-chukka-pcs', (sh.chukkaPcs !== undefined) ? sh.chukkaPcs : 72);

        for (let i = 1; i <= 8; i++) {
            setVal(`sheet-color-${i}`, (sh.colors && sh.colors[i - 1]) ? sh.colors[i - 1] : '');
        }

        updateSheetSetupSummaryLine(sh);
        renderSheetRows(sh);
        updateLiveStockDisplay();
    };

    /* ========================================================================
       4. SAVE CONFIG (MANUAL WAZAN INTACT + TANI ORDER MINUS)
    ======================================================================== */
    const saveCurrentSheetConfig = () => {
        if (!window.activeKarigerId) return;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh) return;

        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kName = kariger ? kariger.name : 'Kariger';
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        sh.rateBana = safeNum(document.getElementById('rate-bana-input')?.value, 0.311);
        sh.rateZari = safeNum(document.getElementById('rate-zari-input')?.value, 0.110);
        sh.rateBani = safeNum(document.getElementById('rate-bani-input')?.value, 240);
        sh.pichlaBana = safeNum(document.getElementById('pichla-bana-input')?.value);
        sh.pichlaZari = safeNum(document.getElementById('pichla-zari-input')?.value);
        sh.pichlaBani = safeNum(document.getElementById('pichla-bani-input')?.value);
        sh.banaWaste = safeNum(document.getElementById('waste-bana-input')?.value);
        sh.zariWaste = safeNum(document.getElementById('waste-zari-input')?.value);

        sh.banaItem = String(document.getElementById('line-bana-name')?.value || '').trim();
        sh.zariItem = String(document.getElementById('line-zari-name')?.value || '').trim();

        sh.taniPcs = safeNum(document.getElementById('sheet-tani-pcs')?.value, 72);
        sh.chukkaPcs = safeNum(document.getElementById('sheet-chukka-pcs')?.value, 72);

        sh.colors = [];
        for (let i = 1; i <= 8; i++) {
            const cVal = String(document.getElementById(`sheet-color-${i}`)?.value || '').trim();
            if (cVal) sh.colors.push(cVal);
        }

        const oldTaniWazan = safeNum(sh.taniWazan);
        const newTaniWazan = safeNum(document.getElementById('sheet-tani-wazan')?.value);
        const oldChukkaWazan = safeNum(sh.chukkaWazan);
        const newChukkaWazan = safeNum(document.getElementById('sheet-chukka-wazan')?.value);

        const oldTaniItem = sh.taniItem || '';
        const oldChukkaItem = sh.chukkaItem || '';

        sh.taniItem = String(document.getElementById('sheet-tani-item')?.value || '').trim();
        sh.taniSancha = String(document.getElementById('sheet-tani-sancha')?.value || '').trim();
        sh.taniWazan = newTaniWazan;
        sh.chukkaItem = String(document.getElementById('sheet-chukka-item')?.value || '').trim();
        sh.chukkaSancha = String(document.getElementById('sheet-chukka-sancha')?.value || '').trim();
        sh.chukkaWazan = newChukkaWazan;

        const taniItemChanged = oldTaniItem.toLowerCase() !== sh.taniItem.toLowerCase();
        if (newTaniWazan !== oldTaniWazan || taniItemChanged) {
            if (oldTaniItem && taniItemChanged && oldTaniWazan > 0) {
                revertSanchaStock(oldTaniItem, 'tani', oldTaniWazan);
            }

            if (sh.taniItem) {
                const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
                const tFound = sList.find((x) => {
                    const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                    return x && x.name && x.name.toLowerCase() === sh.taniItem.toLowerCase() && (x.category || 'tani').toLowerCase() === 'tani' && matchKid;
                });
                if (tFound) {
                    const diffT = (oldTaniItem && taniItemChanged) ? newTaniWazan : (newTaniWazan - oldTaniWazan);
                    tFound.gaya = Math.max(0, safeNum((safeNum(tFound.gaya) + diffT).toFixed(2)));
                    tFound.bacha = safeNum((safeNum(tFound.aaya) - tFound.gaya).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('sancha_items', sList);
                }
            }

            let sHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
            const refKey = `${window.activeKarigerId}_${sh.id}_tani`;
            sHist = sHist.filter((h) => !h || h.refId !== refKey);

            if (sh.taniItem && newTaniWazan > 0) {
                sHist.push({
                    id: `shist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_t`,
                    refId: refKey,
                    date: getTodayIso(),
                    category: 'tani',
                    name: sh.taniItem,
                    kariger: kName,
                    type: 'Kariger Issue (Tani)',
                    aaya: 0,
                    gaya: newTaniWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_history', sHist);
        }

        const chukkaItemChanged = oldChukkaItem.toLowerCase() !== sh.chukkaItem.toLowerCase();
        if (newChukkaWazan !== oldChukkaWazan || chukkaItemChanged) {
            if (oldChukkaItem && chukkaItemChanged && oldChukkaWazan > 0) {
                revertSanchaStock(oldChukkaItem, 'chukka', oldChukkaWazan);
            }

            if (sh.chukkaItem) {
                const sList2 = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
                const cFound = sList2.find((x) => {
                    const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                    return x && x.name && x.name.toLowerCase() === sh.chukkaItem.toLowerCase() && (x.category || '').toLowerCase() === 'chukka' && matchKid;
                });
                if (cFound) {
                    const diffC = (oldChukkaItem && chukkaItemChanged) ? newChukkaWazan : (newChukkaWazan - oldChukkaWazan);
                    cFound.gaya = Math.max(0, safeNum((safeNum(cFound.gaya) + diffC).toFixed(2)));
                    cFound.bacha = safeNum((safeNum(cFound.aaya) - cFound.gaya).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('sancha_items', sList2);
                }
            }

            let sHist2 = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
            const refKey2 = `${window.activeKarigerId}_${sh.id}_chukka`;
            sHist2 = sHist2.filter((h) => !h || h.refId !== refKey2);

            if (sh.chukkaItem && newChukkaWazan > 0) {
                sHist2.push({
                    id: `shist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_c`,
                    refId: refKey2,
                    date: getTodayIso(),
                    category: 'chukka',
                    name: sh.chukkaItem,
                    kariger: kName,
                    type: 'Kariger Issue (Chukka)',
                    aaya: 0,
                    gaya: newChukkaWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_history', sHist2);
        }

        const linkedId = sh.linkedTaniOrderId || sh.linkedTaniOrderNo;
        if (linkedId) {
            if (window.TaniOrderEngine && typeof window.TaniOrderEngine.markTaniMountedOnLoom === 'function') {
                window.TaniOrderEngine.markTaniMountedOnLoom(linkedId, kName);
            } else {
                const rawOrders = (typeof window.getStore === 'function') ? window.getStore('tani_orders_list') : localStorage.getItem('tani_orders_list');
                const orders = window.safeArray ? window.safeArray(rawOrders) : (Array.isArray(rawOrders) ? rawOrders : []);
                const it = orders.find((x) => String(x.id) === String(linkedId) || String(x.orderNo) === String(linkedId));
                if (it) {
                    it.status = 'loom';
                    if (typeof window.setStore === 'function') window.setStore('tani_orders_list', orders);
                }
            }
        }

        if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        updateSheetSetupSummaryLine(sh);
        renderSheetRows(sh);
        updateLiveStockDisplay();
        notifyGlobalSync();
        showSheetToast('✅ Sheet config save & sync ho gayi!');
    };

    /* ========================================================================
       5. LINE ROW SAVE / EDIT / DELETE (TRANSACTIONAL LOCK + ROLLBACK)
    ======================================================================== */
    const saveTaniRow = () => {
        if (!window.activeKarigerId) return showSheetToast('⚠️ Pehle Kariger chunein!', true);
        if (isSavingTaniRow) return showSheetToast('⏳ Save chal raha hai...');
        const now = Date.now();
        if (now - lastTaniRowSaveTime < 1000) return showSheetToast('⏳ 1 second baad try karein');

        const d = toIsoDate(document.getElementById('row-date')?.value || '') || getTodayIso();
        const bCone = safeNum(document.getElementById('row-cone')?.value);
        const bLess = safeNum(document.getElementById('row-lesstp')?.value);
        const zQty = safeNum(document.getElementById('row-zariqty')?.value);
        const topi = safeNum(document.getElementById('row-topi')?.value);

        const saree = safeNum(document.getElementById('row-saree')?.value);
        const lott = safeNum(document.getElementById('row-lott')?.value);
        const paid = safeNum(document.getElementById('row-paid')?.value);
        const retB = safeNum(document.getElementById('row-retbana')?.value);
        const retZ = safeNum(document.getElementById('row-retzari')?.value);

        if (bCone === 0 && zQty === 0 && saree === 0 && lott === 0 && paid === 0 && retB === 0 && retZ === 0) {
            showSheetToast('⚠️ Kam se kam ek value (Saree, Bana, Zari ya Paid) bharein!', true);
            document.getElementById('row-saree')?.focus();
            return;
        }

        // Snapshot for Rollback
        const snapSaree = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('saree_history')) : (window.getStore('saree_history') || [])));
        const snapBana = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('bana_history')) : (window.getStore('bana_history') || [])));
        const snapZari = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('zari_history')) : (window.getStore('zari_history') || [])));
        const snapSheets = JSON.parse(JSON.stringify((typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : []));
        let mutatedStorage = false;

        isSavingTaniRow = true;
        lastTaniRowSaveTime = now;
        try {
            const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
            const sh = sheets[window.activeSheetIndex];
            if (!sh) throw new Error('Tani Sheet nahi mili!');

            const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
            const kName = kariger ? kariger.name : 'Kariger';
            const sDesign = (kariger && kariger.saree) ? kariger.saree : 'General Saree';
            const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

            const banaItemName = String(document.getElementById('line-bana-name')?.value || sh.banaItem || '').trim();
            const zariItemName = String(document.getElementById('line-zari-name')?.value || sh.zariItem || '').trim();
            if (window.editingRowIndex === null) {
                sh.banaItem = banaItemName;
                sh.zariItem = zariItemName;
            }

            const liveTargetInput = document.getElementById('sheet-tani-pcs')?.value;
            const targetTaniPcs = safeNum(liveTargetInput !== undefined && liveTargetInput !== '' ? liveTargetInput : sh.taniPcs, 72);
            sh.taniPcs = targetTaniPcs;

            const nBana = Math.max(0, bCone - bLess);
            const nZari = Math.max(0, zQty - topi);

            const isEditing = (window.editingRowIndex !== null && sh.rows[window.editingRowIndex]);
            const rowId = isEditing ? sh.rows[window.editingRowIndex].id : `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

            mutatedStorage = true;

            if (isEditing) {
                let sHistOld = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
                sHistOld = sHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
                if (typeof window.setStore === 'function') window.setStore('saree_history', sHistOld);

                let bHistOld = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
                bHistOld = bHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
                if (typeof window.setStore === 'function') window.setStore('bana_history', bHistOld);

                let zHistOld = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
                zHistOld = zHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
                if (typeof window.setStore === 'function') window.setStore('zari_history', zHistOld);
            }

            const rowObj = {
                id: rowId,
                date: d,
                cone: bCone,
                lessTp: bLess,
                netBana: safeNum(nBana.toFixed(2)),
                zariQty: zQty,
                topi: topi,
                netZari: safeNum(nZari.toFixed(2)),
                saree: saree,
                lott: lott,
                paid: paid,
                retBana: retB,
                retZari: retZ,
                banaItem: banaItemName,
                zariItem: zariItemName
            };

            sh.rows = window.safeArray ? window.safeArray(sh.rows) : [];

            let savedIndex = 0;
            if (isEditing) {
                savedIndex = window.editingRowIndex;
                sh.rows[window.editingRowIndex] = rowObj;
                window.editingRowIndex = null;
                const sBtn = document.getElementById('row-submit-btn');
                if (sBtn) sBtn.textContent = '+ Line Jodein & Stock Minus';
                const cBtn = document.getElementById('kar-row-cancel-edit-btn');
                if (cBtn) cBtn.style.display = 'none';
            } else {
                savedIndex = sh.rows.length;
                sh.rows.push(rowObj);
            }

            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(window.activeKarigerId, sheets);
            }

            const freshSaree = Math.max(0, saree - lott);

            if (typeof window.recordSareeFromKariger === 'function') {
                window.recordSareeFromKariger(d, sDesign, kName, kGodown, freshSaree, lott, rowId);
            } else {
                let sHist = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
                sHist = sHist.filter((h) => !h || String(h.refId) !== String(rowId));
                const uid = Math.random().toString(36).slice(2, 6);

                if (freshSaree > 0) {
                    sHist.push({
                        id: `saree_${Date.now()}_${uid}_f`,
                        refId: rowId,
                        date: d,
                        sareeName: sDesign,
                        karigerName: kName,
                        karkhanaId: kGodown,
                        type: 'fresh',
                        typeLabel: 'Fresh Saree (Kariger Sheet)',
                        aai: freshSaree,
                        gai: 0,
                        timestamp: Date.now()
                    });
                }

                if (lott > 0) {
                    sHist.push({
                        id: `saree_${Date.now()}_${uid}_l`,
                        refId: rowId,
                        date: d,
                        sareeName: sDesign,
                        karigerName: kName,
                        karkhanaId: kGodown,
                        type: 'lott',
                        typeLabel: 'Lott Saree (Kariger Sheet)',
                        aai: lott,
                        gai: 0,
                        timestamp: Date.now() + 1
                    });
                }

                if (typeof window.setStore === 'function') {
                    window.setStore('saree_history', sHist);
                }
            }

            if (banaItemName && (nBana > 0 || retB > 0)) {
                const bHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
                bHist.push({
                    id: `bhist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    refId: rowId,
                    date: d,
                    name: banaItemName,
                    kariger: kName,
                    type: 'Kariger Issue',
                    aaya: retB > 0 ? retB : 0,
                    gaya: nBana > 0 ? nBana : 0,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
                if (typeof window.setStore === 'function') window.setStore('bana_history', bHist);
            }

            if (zariItemName && (nZari > 0 || retZ > 0)) {
                const zHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
                zHist.push({
                    id: `zhist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    refId: rowId,
                    date: d,
                    name: zariItemName,
                    kariger: kName,
                    type: 'Kariger Issue',
                    aaya: retZ > 0 ? retZ : 0,
                    gaya: nZari > 0 ? nZari : 0,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
                if (typeof window.setStore === 'function') window.setStore('zari_history', zHist);
            }

            setVal('row-date', getTodayIso());
            setVal('row-saree', '');
            setVal('row-lott', '');
            setVal('row-cone', '');
            setVal('row-lesstp', '');
            setVal('row-zariqty', '');
            setVal('row-topi', '');
            setVal('row-paid', '');
            setVal('row-retbana', '');
            setVal('row-retzari', '');
            setVal('line-bana-name', sh.banaItem || '');
            setVal('line-zari-name', sh.zariItem || '');

            const totalsAfter = (typeof window.calculateSheetTotals === 'function')
                ? window.calculateSheetTotals(sh)
                : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

            const deliveredSoFar = safeNum(totalsAfter.totSaree);
            const isLastSheet = (window.activeSheetIndex === sheets.length - 1);
            const savedSheetIndex = window.activeSheetIndex;

            updateSheetSetupSummaryLine(sh);
            renderSheetRows(sh);
            updateLiveStockDisplay();
            notifyGlobalSync();
            showSheetToast(isEditing ? '✅ Line update ho gayi!' : '✅ Line save & stock sync ho gaya!');

            if (!isEditing && isLastSheet && targetTaniPcs > 0 && deliveredSoFar >= targetTaniPcs) {
                showSheetToast(`🎉 Mubarak! ${kName} ki [${sh.title}] (${targetTaniPcs} Saree) poori ho gayi! '+ Nayi Tani' dabayein.`);
                setTimeout(() => document.getElementById('row-saree')?.focus(), 40);
            } else if (!isEditing) {
                showKarConfirm(
                    '✅ Line jud gayi! Kya aap is le-den ki A6 Thermal Parchi print karna chahte hain?',
                    () => printSingleKarigerRowSlip(savedIndex, savedSheetIndex),
                    'Print Slip [Y / Enter]',
                    'Skip [N / Esc]',
                    document.getElementById('row-saree')
                );
            } else {
                setTimeout(() => document.getElementById('row-saree')?.focus(), 40);
            }
        } catch (error) {
            console.error('[Save Tani Row Failed]', error);
            if (mutatedStorage) {
                if (typeof window.setStore === 'function') {
                    window.setStore('saree_history', snapSaree);
                    window.setStore('bana_history', snapBana);
                    window.setStore('zari_history', snapZari);
                }
                if (typeof window.saveKarigerSheets === 'function') {
                    window.saveKarigerSheets(window.activeKarigerId, snapSheets);
                }
                const restoredSh = snapSheets[window.activeSheetIndex] || snapSheets[0];
                if (restoredSh) {
                    updateSheetSetupSummaryLine(restoredSh);
                    renderSheetRows(restoredSh);
                }
                updateLiveStockDisplay();
                notifyGlobalSync();
            }
            showSheetToast('❌ Save Fail: ' + error.message, true);
        } finally {
            isSavingTaniRow = false;
        }
    };

    const editTaniRow = (idx) => {
        closeKarConfirm();
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh || !sh.rows || !sh.rows[idx]) return;
        const r = sh.rows[idx];

        window.editingRowIndex = idx;
        setVal('row-date', toIsoDate(r.date || getTodayIso()));
        setVal('row-cone', r.cone || '');
        setVal('row-lesstp', r.lessTp || '');
        setVal('row-zariqty', r.zariQty || '');
        setVal('row-topi', r.topi || '');
        setVal('row-saree', r.saree || '');
        setVal('row-lott', r.lott || '');
        setVal('row-paid', r.paid || '');
        setVal('row-retbana', r.retBana || '');
        setVal('row-retzari', r.retZari || '');
        if (r.banaItem !== undefined) setVal('line-bana-name', r.banaItem || sh.banaItem || '');
        if (r.zariItem !== undefined) setVal('line-zari-name', r.zariItem || sh.zariItem || '');

        const sBtn = document.getElementById('row-submit-btn');
        if (sBtn) sBtn.textContent = 'Update Line [Enter]';
        const cBtn = document.getElementById('kar-row-cancel-edit-btn');
        if (cBtn) cBtn.style.display = 'inline-block';

        renderSheetRows(sh);
        updateLiveStockDisplay();
        setTimeout(() => document.getElementById('row-saree')?.focus(), 40);
    };

    const deleteTaniRow = (idx) => {
        if (isDeletingKarItem) return;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh || !sh.rows || !sh.rows[idx]) return;

        showKarConfirm('🗑️ Kya aap is line row ko delete karna chahte hain?', () => {
            if (isDeletingKarItem) return;
            isDeletingKarItem = true;

            const snapSaree = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('saree_history')) : []));
            const snapBana = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('bana_history')) : []));
            const snapZari = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore('zari_history')) : []));
            const snapSheets = JSON.parse(JSON.stringify((typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : []));
            let mutatedStorage = false;

            try {
                const freshSheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
                const freshSh = freshSheets[window.activeSheetIndex];
                if (!freshSh || !freshSh.rows || !freshSh.rows[idx]) return;

                const r = freshSh.rows[idx];
                mutatedStorage = true;

                let sHist = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
                sHist = sHist.filter((h) => !h || String(h.refId) !== String(r.id));
                if (typeof window.setStore === 'function') window.setStore('saree_history', sHist);

                let bHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
                bHist = bHist.filter((h) => !h || String(h.refId) !== String(r.id));
                if (typeof window.setStore === 'function') window.setStore('bana_history', bHist);

                let zHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
                zHist = zHist.filter((h) => !h || String(h.refId) !== String(r.id));
                if (typeof window.setStore === 'function') window.setStore('zari_history', zHist);

                freshSh.rows.splice(idx, 1);
                if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, freshSheets);

                if (window.editingRowIndex === idx) cancelEditTaniRow();
                else if (window.editingRowIndex !== null && window.editingRowIndex > idx) window.editingRowIndex -= 1;
                updateSheetSetupSummaryLine(freshSh);
                renderSheetRows(freshSh);
                updateLiveStockDisplay();
                notifyGlobalSync();
                showSheetToast('🗑️ Line delete ho gayi!');
            } catch (err) {
                if (mutatedStorage) {
                    if (typeof window.setStore === 'function') {
                        window.setStore('saree_history', snapSaree);
                        window.setStore('bana_history', snapBana);
                        window.setStore('zari_history', snapZari);
                    }
                    if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, snapSheets);
                }
                showSheetToast('❌ Row delete fail: ' + err.message, true);
            } finally {
                isDeletingKarItem = false;
            }
        });
    };

    /* ========================================================================
       6. 9-COLUMN SHEET ROWS RENDERER & CALCULATIONS
    ======================================================================== */
    const renderSheetRows = (sh) => {
        const tbody = document.getElementById('sheet-table-body');
        if (!tbody) return;

        const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
        setText('kar-sheet-row-count', `${rows.length} Entries`);

        let totS = 0, totL = 0, totB = 0, totZ = 0, totP = 0, totRB = 0, totRZ = 0;

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:22px; color:#6b7280;">Is Tani me koi entry nahi hai. Left side panel se pehli line jodein.</td></tr>';
        } else {
            let html = '';
            rows.forEach((r, idx) => {
                if (!r) return;
                totS  += safeNum(r.saree);
                totL  += safeNum(r.lott);
                totB  += safeNum(r.netBana);
                totZ  += safeNum(r.netZari);
                totP  += safeNum(r.paid);
                totRB += safeNum(r.retBana);
                totRZ += safeNum(r.retZari);

                const isEditCls = (window.editingRowIndex === idx) ? ' editing' : '';

                html += `<tr class="kar-khata-row${isEditCls}">
                    <td>${esc(r.date || '-')}</td>
                    <td><strong style="color:#92400e;">${r.netBana ? safeNum(r.netBana).toFixed(2) : '-'}</strong></td>
                    <td><strong style="color:#b47d00;">${r.netZari ? safeNum(r.netZari).toFixed(2) : '-'}</strong></td>
                    <td><strong>${safeNum(r.saree) || '-'}</strong></td>
                    <td style="color:#6b7280;">${safeNum(r.lott) || '-'}</td>
                    <td style="color:#b47d00; font-weight:800;">${safeNum(r.paid) ? `₹ ${safeNum(r.paid)}` : '-'}</td>
                    <td>${safeNum(r.retBana) || '-'}</td>
                    <td>${safeNum(r.retZari) || '-'}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button type="button" title="Is Line Ki Parchi Print" class="kar-row-act-btn" onclick="printSingleKarigerRowSlip(${idx})">Slip</button>
                        <button type="button" title="Edit Line" class="kar-row-act-btn" onclick="editTaniRow(${idx})">Edit</button>
                        <button type="button" title="Delete Line" class="kar-row-act-btn" onclick="deleteTaniRow(${idx})">Del</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }

        setText('tot-bana-net', totB.toFixed(2));
        setText('tot-zari-net', totZ.toFixed(2));
        setText('tot-saree', totS);
        setText('tot-lott', totL);
        setText('tot-paid', `₹ ${totP.toFixed(2)}`);
        setText('tot-ret-bana', totRB.toFixed(2));
        setText('tot-ret-zari', totRZ.toFixed(2));

        const c = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(sh)
            : {
                totSaree: 0, totLott: 0, netSaree: 0, grossBani: 0, totPaid: 0, remainingAmt: 0,
                totBana: 0, retBana: 0, banaConsumption: 0, banaWaste: 0, remainingBana: 0,
                totZari: 0, retZari: 0, zariConsumption: 0, zariWaste: 0, remainingZari: 0
            };

        setText('calc-tot-saree', c.totSaree);
        setText('calc-tot-lott', `- ${c.totLott}`);
        setText('calc-net-saree', c.netSaree);
        setText('calc-bani-rate', `₹ ${sh.rateBani !== undefined ? sh.rateBani : 240}`);
        setText('calc-gross-bani', `₹ ${c.grossBani.toFixed(2)}`);
        setText('calc-last-tani-bani', `+ ₹ ${safeNum(sh.pichlaBani).toFixed(2)}`);
        setText('calc-tot-paid', `- ₹ ${c.totPaid.toFixed(2)}`);
        setText('calc-remaining-amt', `₹ ${c.remainingAmt.toFixed(2)}`);

        setText('calc-last-tani-bana', safeNum(sh.pichlaBana).toFixed(2));
        setText('calc-tot-bana', c.totBana.toFixed(2));
        setText('calc-ret-bana', `- ${c.retBana.toFixed(2)}`);
        setText('calc-bana-consumption', c.banaConsumption.toFixed(2));
        setText('calc-bana-wastage', `- ${safeNum(sh.banaWaste).toFixed(2)}`);
        setText('calc-remaining-bana', c.remainingBana.toFixed(2));

        setText('calc-last-tani-zari', safeNum(sh.pichlaZari).toFixed(2));
        setText('calc-tot-zari', c.totZari.toFixed(2));
        setText('calc-ret-zari', `- ${c.retZari.toFixed(2)}`);
        setText('calc-zari-consumption', c.zariConsumption.toFixed(2));
        setText('calc-zari-wastage', `- ${safeNum(sh.zariWaste).toFixed(2)}`);
        setText('calc-remaining-zari', c.remainingZari.toFixed(2));
    };

    /* ========================================================================
       7. KEYBOARD NAVIGATION ENGINE (WITH DOUBLE-ENTER & CTRL+P PROTECTION)
    ======================================================================== */
    const handleKarigerKeydown = (e) => {
        if (isAnyExpressOverlayOpen()) return;

        // 0. Inline Tally confirm bar takes top priority
        if (activeKarConfirm) {
            const k = e.key.toLowerCase();
            if (k === 'y' || (e.key === 'Enter' && document.activeElement?.id !== 'kar-confirm-no-btn')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const fn = activeKarConfirm.onYes;
                closeKarConfirm();
                if (typeof fn === 'function') fn();
                return;
            }
            if (k === 'n' || e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeKarConfirm(activeKarConfirm.restoreFocusEl);
                return;
            }
        }

        // 1. Modals take priority
        const printModal = document.getElementById('kariger-print-options-modal');
        if (printModal) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeKarigerPrintModal(); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); confirmPrintKarigerSheet(); }
            return;
        }
        const pinModal = document.getElementById('kariger-portal-admin-modal');
        if (pinModal) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); pinModal.remove(); }
            return;
        }

        const kSec = document.getElementById('kariger-section');
        const shSec = document.getElementById('kariger-sheet-section');
        const isDirOpen = kSec && kSec.style.display !== 'none';
        const isSheetOpen = shSec && shSec.style.display !== 'none';
        if (!isDirOpen && !isSheetOpen) return;

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        // 2. Inside Tani Khata Sheet
        if (isSheetOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.editingRowIndex !== null) {
                    cancelEditTaniRow();
                } else if (sheetSetupExpanded) {
                    toggleSheetSetupDrawer(false);
                } else {
                    openKarigerModule();
                }
                return;
            }
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopImmediatePropagation();
                toggleSheetSetupDrawer();
                return;
            }
            if ((e.ctrlKey || e.altKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                openKarigerPrintModal();
                return;
            }
            if (e.altKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                addNewTaniSheet();
                return;
            }
            if (e.altKey && (e.key === 'w' || e.key === 'W')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                sendKarigerWhatsAppParchi();
                return;
            }
            if (e.key === 'F6') {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.getElementById('row-saree')?.focus();
                return;
            }
            if (!isTyping && (e.key === '[' || e.key === ']')) {
                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
                if (sheets.length > 1) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const nextIdx = (e.key === ']')
                        ? (window.activeSheetIndex + 1) % sheets.length
                        : (window.activeSheetIndex - 1 + sheets.length) % sheets.length;
                    switchTaniSheetTab(nextIdx);
                }
            }
            return;
        }

        // 3. Inside Kariger Directory
        if (isDirOpen) {
            if (e.key === 'Enter' && (performance.now() - karigerDirOpenedAt) < 180) {
                return;
            }

            const addForm = document.getElementById('add-kariger-form');
            const isFormOpen = addForm && addForm.style.display === 'block';

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (isFormOpen) toggleKarigerForm();
                else if (typeof window.backToDashboard === 'function') window.backToDashboard();
                return;
            }

            if (e.key === 'F2') {
                e.preventDefault();
                e.stopImmediatePropagation();
                cycleKarigerKarkhanaTab();
                return;
            }

            if (isTyping) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightKarigerDirRow(karigerListActiveIdx + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightKarigerDirRow(karigerListActiveIdx - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                nextKarigerPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                prevKarigerPage();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                const chosen = currentKarigerPageRowsCache[karigerListActiveIdx];
                if (chosen) openKarigerSheet(chosen.id);
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                window.__karEditSelected();
            } else if (e.key === 'Delete') {
                e.preventDefault();
                window.__karDeleteSelected();
            } else if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                openKarigerPortalLoginModal();
            } else if (e.key === 'F7' || e.key === '+') {
                e.preventDefault();
                toggleKarigerForm();
            } else if (e.key === '/') {
                e.preventDefault();
                const sEl = document.getElementById('search-kariger-input');
                if (sEl) { sEl.focus(); sEl.select(); }
            }
        }
    };

    const bindKarigerKeyboardEngine = () => {
        if (window.__karigerKeysBound) return;
        window.__karigerKeysBound = true;
        document.addEventListener('keydown', handleKarigerKeydown);
    };

    /* ========================================================================
       8. PRINT ENGINES & WHATSAPP (CLEAN A6 HISAB KITAB PRINT)
    ======================================================================== */
    const printSingleKarigerRowSlip = (idx, sheetIdx = null) => {
        if (!window.activeKarigerId) return showSheetToast('⚠️ Pehle Kariger chunein!', true);
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const targetSheetIdx = (sheetIdx !== null && sheetIdx !== undefined) ? sheetIdx : window.activeSheetIndex;
        const sh = sheets[targetSheetIdx];
        if (!k || !sh || !sh.rows || !sh.rows[idx]) return showSheetToast('⚠️ Row entry nahi mili!', true);

        const r = sh.rows[idx];
        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        const sDesign = k.saree || 'General Saree';

        const printWindow = window.open('', '', 'width=420,height=580');
        if (!printWindow) return showSheetToast('⚠️ Popup block hai! Kripya browser me allow karein.', true);

        printWindow.document.open();
        printWindow.document.write(`
            <html>
            <head>
                <title>Kariger Parchi - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { margin-bottom: 8px; font-size: 11px; border-bottom: 1px dashed #666; padding-bottom: 6px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
                    th, td { padding: 4px 2px; text-align: left; border-bottom: 1px dashed #aaa; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 10px; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>कारीगर ले-देन पर्ची (RAW MATERIAL & WORK)</p>
                    </div>
                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(k.name)}</span><span><strong>तारीख:</strong> ${esc(r.date || '-')}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(sDesign)}</span><span><strong>खाता:</strong> ${esc(sh.title)}</span></div>
                        <div class="meta-row"><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span><span><strong>मो.:</strong> ${esc(k.mobile || '-')}</span></div>
                    </div>
                    <table>
                        <thead>
                            <tr><th>विवरण (ITEM / DETAIL)</th><th style="text-align:right;">मात्रा / वज़न</th></tr>
                        </thead>
                        <tbody>
                            ${safeNum(r.netBana) > 0 ? `<tr><td>बाना दिया (${esc(r.banaItem || sh.banaItem || 'बाना')})</td><td style="text-align:right; font-weight:bold;">${safeNum(r.netBana).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.netZari) > 0 ? `<tr><td>जरी दिया (${esc(r.zariItem || sh.zariItem || 'जरी')})</td><td style="text-align:right; font-weight:bold;">${safeNum(r.netZari).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.saree) > 0 ? `<tr><td>साड़ी जमा</td><td style="text-align:right; font-weight:bold;">+${safeNum(r.saree)} Pcs</td></tr>` : ''}
                            ${safeNum(r.lott) > 0 ? `<tr><td>लोट साड़ी</td><td style="text-align:right; font-weight:bold;">-${safeNum(r.lott)} Pcs</td></tr>` : ''}
                            ${safeNum(r.paid) > 0 ? `<tr><td>मजदूरी दिया (Paid)</td><td style="text-align:right; font-weight:bold;">₹ ${safeNum(r.paid).toFixed(2)}</td></tr>` : ''}
                            ${safeNum(r.retBana) > 0 ? `<tr><td>वापस बाना</td><td style="text-align:right;">${safeNum(r.retBana).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.retZari) > 0 ? `<tr><td>वापस जरी</td><td style="text-align:right;">${safeNum(r.retZari).toFixed(2)} Kg</td></tr>` : ''}
                        </tbody>
                    </table>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>___________</div>
                        <div>हस्ताक्षर कारीगर<br><br>___________</div>
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

    const openKarigerPrintModal = () => {
        const existingModal = document.getElementById('kariger-print-options-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="kariger-print-options-modal" style="position:fixed; inset:0; background:rgba(31,41,55,0.38); backdrop-filter:blur(2px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box; font-family:'Inter','Segoe UI',system-ui,sans-serif;">
                <div style="background:#ffffff; width:100%; max-width:420px; border:1.5px solid #d9b86c; border-radius:8px; box-shadow:0 18px 42px rgba(0,0,0,0.16); overflow:hidden;">
                    <div style="background:#fdf6e2; color:#1f2937; border-bottom:1.5px solid #e5d5a7; padding:11px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:15px; font-weight:800;">Tani Khata Print (A6 Format)</h3>
                        <button type="button" onclick="closeKarigerPrintModal()" style="background:#ffffff; border:1px solid #d1d5db; border-radius:4px; color:#374151; font-size:12px; font-weight:700; padding:4px 9px; cursor:pointer;">[Esc] Close</button>
                    </div>
                    <div style="padding:16px;">
                        <p style="font-size:13px; color:#374151; margin-top:0;">Aap is Tani Khata ko kis format me print karna chahte hain?</p>
                        <div style="background:#fdfcf7; border:1px solid #e5d5a7; padding:12px; border-radius:6px; margin-bottom:15px;">
                            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="chk-include-tani-summary" checked style="margin-top:3px; cursor:pointer;">
                                <div>
                                    <strong style="color:#92400e; font-size:13px;">Niche wali Summary sath me print karein</strong>
                                    <div style="font-size:11px; color:#6b7280; margin-top:2px;">(Gross Mazdoori, Diya, Baaki Rupya, aur Bana/Zari ka bacha wazan sath me aayega)</div>
                                </div>
                            </label>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" onclick="closeKarigerPrintModal()" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; padding:8px 14px; border-radius:5px; font-weight:700; font-size:12.5px; cursor:pointer;">Cancel [Esc]</button>
                            <button type="button" onclick="confirmPrintKarigerSheet()" style="background:#f2b71d; color:#1f2937; border:1px solid #d9a425; padding:8px 16px; border-radius:5px; font-weight:800; font-size:12.5px; cursor:pointer;">Print Shuru Karein [Enter]</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeKarigerPrintModal = () => {
        const modal = document.getElementById('kariger-print-options-modal');
        if (modal) modal.remove();
    };

    const confirmPrintKarigerSheet = () => {
        const includeSummary = document.getElementById('chk-include-tani-summary')?.checked ?? true;
        closeKarigerPrintModal();
        printKarigerTaniSheet(includeSummary);
    };

    const printKarigerTaniSheet = (includeSummary = true) => {
        if (!window.activeKarigerId) return showSheetToast('⚠️ Pehle Kariger chunein!', true);
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!k || !sh) return showSheetToast('⚠️ Khata nahi mila!', true);

        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        const sDesign = k.saree || 'General Saree';
        const today = new Date().toLocaleDateString('hi-IN');
        const rows = window.safeArray ? window.safeArray(sh.rows) : [];

        let totS = 0, totL = 0, totB = 0, totZ = 0, totP = 0, totRB = 0, totRZ = 0;
        let rowsHtml = '';

        rows.forEach((r) => {
            totS  += safeNum(r.saree);
            totL  += safeNum(r.lott);
            totB  += safeNum(r.netBana);
            totZ  += safeNum(r.netZari);
            totP  += safeNum(r.paid);
            totRB += safeNum(r.retBana);
            totRZ += safeNum(r.retZari);

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 1px;">${esc(r.date || '-')}</td>
                    <td style="padding:3px 1px; text-align:right;">${r.netBana ? safeNum(r.netBana).toFixed(2) : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${r.netZari ? safeNum(r.netZari).toFixed(2) : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.saree) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.lott) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.paid) ? `₹${safeNum(r.paid)}` : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.retBana) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.retZari) || '-'}</td>
                </tr>`;
        });

        const c = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(sh)
            : {
                totSaree: totS, totLott: totL, netSaree: totS - totL, grossBani: 0, totPaid: totP, remainingAmt: 0,
                totBana: totB, retBana: totRB, banaConsumption: 0, banaWaste: 0, remainingBana: 0,
                totZari: totZ, retZari: totRZ, zariConsumption: 0, zariWaste: 0, remainingZari: 0
            };

        let summaryHtml = '';
        if (includeSummary) {
            summaryHtml = `
                <div style="margin-top:8px; border-top:1.5px dashed #000; padding-top:4px;">
                    <div style="font-weight:bold; font-size:11px; margin-bottom:3px; background:#f5f5f5; padding:2px 4px; border:1px solid #999;">💰 मजदूरी & साड़ी हिसाब</div>
                    <div style="display:flex; justify-content:space-between; font-size:10px;">
                        <span>कुल साड़ी: ${c.totSaree} Pcs | लोट: -${c.totLott} Pcs</span>
                        <span><strong>नेट साड़ी: ${c.netSaree} Pcs</strong></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>बनी रेट: ₹ ${sh.rateBani !== undefined ? sh.rateBani : 240} | पिछली: +₹ ${safeNum(sh.pichlaBani).toFixed(2)}</span>
                        <span>ग्रॉस: ₹ ${c.grossBani.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>दिया गया: -₹ ${c.totPaid.toFixed(2)}</span>
                        <span style="font-size:11px; font-weight:bold; color:#000;">अंतिम बाकी: ₹ ${c.remainingAmt.toFixed(2)}</span>
                    </div>

                    <div style="font-weight:bold; font-size:11px; margin:6px 0 3px; background:#f5f5f5; padding:2px 4px; border:1px solid #999;">🧶 कच्चा माल हिसाब (बाना & जरी)</div>
                    <div style="display:flex; justify-content:space-between; font-size:10px;">
                        <span>बाना (खपत: ${c.banaConsumption.toFixed(2)} Kg)</span>
                        <span><strong>बचा बाना: ${c.remainingBana.toFixed(2)} Kg</strong></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>जरी (खपत: ${c.zariConsumption.toFixed(2)} Kg)</span>
                        <span><strong>बची जरी: ${c.remainingZari.toFixed(2)} Kg</strong></span>
                    </div>
                </div>`;
        }

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return showSheetToast('⚠️ Popup block hai! Kripya browser me popup allow karein.', true);

        printWindow.document.open();
        printWindow.document.write(`
            <html>
            <head>
                <title>Tani Khata - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 10px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: right; padding: 3px 1px; font-size: 9px; }
                    th:first-child { text-align: left; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>तानी खाता पर्ची (${esc(sh.title)})</p>
                    </div>
                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(k.name)}</span><span><strong>तारीख:</strong> ${today}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(sDesign)}</span><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span></div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>BANA</th><th>ZARI</th><th>SAREE</th><th>LOTT</th><th>PAID</th><th>RET.B</th><th>RET.Z</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot>
                            <tr style="border-top:1px solid #000; font-weight:bold;">
                                <td>TOTAL</td>
                                <td style="text-align:right;">${totB.toFixed(2)}</td>
                                <td style="text-align:right;">${totZ.toFixed(2)}</td>
                                <td style="text-align:right;">${totS}</td>
                                <td style="text-align:right;">${totL}</td>
                                <td style="text-align:right;">₹${totP}</td>
                                <td style="text-align:right;">${totRB.toFixed(2)}</td>
                                <td style="text-align:right;">${totRZ.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    ${summaryHtml}
                    <div class="footer">
                        <p>हस्ताक्षर कारीगर: ________________ &nbsp; मुंशी: ________________</p>
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

    const sendKarigerWhatsAppParchi = () => {
        if (!window.activeKarigerId) return;
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!k || !sh) return;

        const c = (typeof window.calculateSheetTotals === 'function') ? window.calculateSheetTotals(sh) : {};

        let mob = String(k.mobile || '').trim().replace(/[^0-9]/g, '');
        if (!mob || mob.length < 10) {
            return showSheetToast(`⚠️ ${k.name} ka 10-digit WhatsApp number saved nahi hai! Pehle Edit karke mobile daalein.`, true);
        }
        if (mob.length === 10) mob = `91${mob}`;

        const msg = `🧵 *SIMPLICITY KARKHANA ERP*\n` +
                    `👤 *कारीगर:* ${k.name}\n` +
                    `📑 *खाता:* ${sh.title}\n` +
                    `🥻 कुल साड़ी: *${c.totSaree || 0} Pcs*\n` +
                    `⚠️ लोट साड़ी: *${c.totLott || 0} Pcs*\n` +
                    `✅ नेट साड़ी: *${c.netSaree || 0} Pcs*\n` +
                    `🧶 बाना बकाया: *${c.remainingBana || 0} Kg*\n` +
                    `✨ जरी बकाया: *${c.remainingZari || 0} Kg*\n` +
                    `💰 कुल मजदूरी: *₹ ${c.grossBani || 0}*\n` +
                    `💵 दिया गया: *₹ ${c.totPaid || 0}*\n` +
                    `🔴 *अंतिम बाकी रुपया: ₹ ${c.remainingAmt || 0}*`;

        window.open(`https://wa.me/${mob}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       9. GLOBAL EXPORTS
    ======================================================================== */
    const karigerUIAPI = {
        openKarigerModule,
        backToDashboard,
        renderKarigerKarkhanaTabs,
        switchKarigerKarkhanaTab,
        bindKarigerSearchInput,
        filterKariger,
        renderKarigerTable,
        nextKarigerPage,
        prevKarigerPage,
        populateKarigerKarkhanaDropdown,
        toggleKarigerForm,
        saveKariger,
        editKariger,
        deleteKariger,
        populateSheetDatalists,
        updateLiveStockDisplay,
        openKarigerSheet,
        renderSheetTabs,
        switchTaniSheetTab,
        addNewTaniSheet,
        deleteTaniSheet,
        loadCurrentSheetData,
        saveCurrentSheetConfig,
        saveTaniRow,
        editTaniRow,
        deleteTaniRow,
        renderSheetRows,
        printSingleKarigerRowSlip,
        openKarigerPrintModal,
        closeKarigerPrintModal,
        confirmPrintKarigerSheet,
        printKarigerTaniSheet,
        sendKarigerWhatsAppParchi,
        getKarigerAbsentDays,
        sanitizeKarigerList,
        ensureKarigerMohallaField
    };

    Object.keys(karigerUIAPI).forEach((fnName) => {
        if (fnName === 'backToDashboard' && typeof window.backToDashboard === 'function') return;
        window[fnName] = karigerUIAPI[fnName];
    });

    window.KarigerUIEngine = karigerUIAPI;
})();
/* ============================================================================
   KARIGER MOBILE PORTAL ADMIN MODAL (STRICT TENANT LOCKED — WHITE & GOLD)
============================================================================ */
(() => {
    'use strict';

    if (window.__karPortalModalLoaded) return;
    window.__karPortalModalLoaded = true;

    const PORTAL_LINK = 'https://ziprotraders91-cpu.github.io/testing-dev/kariger-portal/';
    const SB_URL = 'https://mvbejtoylowskerlgfxs.supabase.co';
    const SB_KEY = 'sb_publishable_NhTU4xzRMi0gtKH4CzVf_Q_lRfzjg3c';

    let sbClient = null;
    const getSb = () => {
        if (window.supabaseClient) return window.supabaseClient;
        if (sbClient) return sbClient;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            sbClient = window.supabase.createClient(SB_URL, SB_KEY);
        }
        return sbClient;
    };

    const toastPortal = (msg, isErr = false) => {
        if (typeof window.__karShowToast === 'function') window.__karShowToast(msg, isErr);
    };

    const detectTenantId = () => {
        if (window.currentUserId && String(window.currentUserId).trim()) {
            return String(window.currentUserId).trim();
        }
        if (window.currentTenantId && String(window.currentTenantId).trim()) {
            return String(window.currentTenantId).trim();
        }
        const savedUid = localStorage.getItem('app_current_user_id');
        if (savedUid && savedUid.trim()) return savedUid.trim();
        try {
            const rawAuth = localStorage.getItem('app_active_session_auth');
            if (rawAuth) {
                const parsed = JSON.parse(rawAuth);
                if (parsed && parsed.id) return String(parsed.id).trim();
            }
        } catch (_) {}
        return null;
    };

    const getDefaultFirmName = (tenantId) => {
        const saved = tenantId ? localStorage.getItem(`${tenantId}_kariger_portal_firm_name`) : null;
        if (saved && saved.trim()) return saved.trim();
        try {
            const rawAuth = localStorage.getItem('app_active_session_auth');
            if (rawAuth) {
                const parsed = JSON.parse(rawAuth);
                if (parsed && parsed.name) return String(parsed.name).trim();
            }
        } catch (_) {}
        return 'Simplicity ERP';
    };

    const escH = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));

    let cachedAccounts = [];

    const loadKarigerPortalAccounts = async () => {
        const sb = getSb();
        if (!sb) return;
        const tenantId = detectTenantId();
        const tbody = document.getElementById('kp-accounts-tbody');
        if (!tenantId) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#92400e; padding:12px;">Pehle apne account se login karein!</td></tr>';
            return;
        }
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:12px; color:#6b7280;">Loading...</td></tr>';

        try {
            const { data, error } = await sb.rpc('kariger_admin_list_accounts', { p_tenant_id: tenantId });
            if (error || !data || !data.ok) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#92400e; padding:12px;">Error: ${escH(error?.message || 'Load nahi hua')}</td></tr>`;
                return;
            }
            cachedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
            renderAccountsTable();
        } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626; padding:12px;">Network Error: ${escH(err?.message || 'Load nahi hua')}</td></tr>`;
        }
    };

    const renderAccountsTable = () => {
        const tbody = document.getElementById('kp-accounts-tbody');
        if (!tbody) return;
        if (!cachedAccounts.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:14px; color:#6b7280;">Abhi koi Kariger PIN nahi bana hai.</td></tr>';
            return;
        }
        tbody.innerHTML = cachedAccounts.map((a) => `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 6px; font-weight:700; color:#1f2937;">${escH(a.kariger_name)}</td>
                <td style="padding:8px 6px; color:#374151;">${escH(a.mobile)}</td>
                <td style="padding:8px 6px; font-weight:800; color:#b47d00;">${escH(a.pin)}</td>
                <td style="padding:8px 6px;">${a.is_active ? '<span style="color:#92400e; font-weight:700;">Active</span>' : '<span style="color:#6b7280; font-weight:700;">Blocked</span>'}</td>
                <td style="padding:8px 6px; white-space:nowrap;">
                    <button type="button" onclick="kpShareWa('${escH(a.kariger_id)}')" style="background:#f2b71d; color:#1f2937; border:1px solid #d9a425; border-radius:4px; padding:3px 7px; font-size:11px; font-weight:700; cursor:pointer;">WA</button>
                    <button type="button" onclick="kpFillForm('${escH(a.kariger_id)}')" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; border-radius:4px; padding:3px 7px; font-size:11px; font-weight:700; cursor:pointer;">Edit</button>
                    <button type="button" onclick="kpDeleteAcc('${escH(a.kariger_id)}')" style="background:#ffffff; color:#374151; border:1px solid #d1d5db; border-radius:4px; padding:3px 7px; font-size:11px; font-weight:700; cursor:pointer;">Del</button>
                </td>
            </tr>
        `).join('');
    };

    window.kpFillForm = (karigerId) => {
        const list = typeof window.sanitizeKarigerList === 'function' ? window.sanitizeKarigerList() : [];
        const k = list.find((x) => String(x.id) === String(karigerId));
        const acc = cachedAccounts.find((x) => String(x.kariger_id) === String(karigerId));

        const sel = document.getElementById('kp-kar-select');
        if (sel && karigerId) sel.value = karigerId;

        const mobEl = document.getElementById('kp-mobile');
        const pinEl = document.getElementById('kp-pin');
        const stEl = document.getElementById('kp-status');

        if (mobEl) mobEl.value = (acc?.mobile || k?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
        if (pinEl) pinEl.value = acc?.pin || String(Math.floor(1000 + Math.random() * 9000));
        if (stEl) stEl.value = (acc && acc.is_active === false) ? 'false' : 'true';
    };

    window.kpSaveAccount = async () => {
        const sb = getSb();
        if (!sb) return toastPortal('⚠️ Supabase library load nahi hui.', true);
        const tenantId = detectTenantId();
        if (!tenantId) return toastPortal('⚠️ Pehle apne account se login karein!', true);

        const sel = document.getElementById('kp-kar-select');
        const karigerId = sel?.value || '';
        const karigerName = sel?.options[sel.selectedIndex]?.dataset?.name || 'Kariger';
        const mobile = String(document.getElementById('kp-mobile')?.value || '').replace(/[^0-9]/g, '');
        const pin = String(document.getElementById('kp-pin')?.value || '').replace(/[^0-9]/g, '');
        const firm = String(document.getElementById('kp-firm')?.value || 'Simplicity ERP').trim();
        const isActive = document.getElementById('kp-status')?.value === 'true';

        if (!karigerId) return toastPortal('⚠️ Pehle Kariger chunein!', true);
        if (mobile.length !== 10) return toastPortal('⚠️ 10-digit Mobile Number daalein!', true);
        if (pin.length !== 4) return toastPortal('⚠️ 4-digit PIN daalein!', true);

        localStorage.setItem(`${tenantId}_kariger_portal_firm_name`, firm);

        const btn = document.getElementById('kp-save-btn');
        if (btn) {
            if (btn.disabled) return;
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }

        try {
            const { data, error } = await sb.rpc('kariger_admin_save_account', {
                p_tenant_id: tenantId,
                p_kariger_id: karigerId,
                p_kariger_name: karigerName,
                p_mobile: mobile,
                p_pin: pin,
                p_firm_name: firm,
                p_is_active: isActive
            });

            if (error || !data || !data.ok) {
                return toastPortal('❌ Save nahi hua: ' + (error?.message || data?.error || ''), true);
            }
            await loadKarigerPortalAccounts();
            toastPortal(`✅ ${karigerName} ka App Login Save ho gaya! (Mob: ${mobile}, PIN: ${pin})`);
        } catch (err) {
            toastPortal('❌ Network Error: ' + (err?.message || 'Save nahi hua'), true);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Save ID';
            }
        }
    };

    window.kpDeleteAcc = (karigerId) => {
        const doDelete = async () => {
            const sb = getSb();
            const tenantId = detectTenantId();
            if (!sb || !tenantId) return;
            try {
                const { data, error } = await sb.rpc('kariger_admin_delete_account', {
                    p_tenant_id: tenantId,
                    p_kariger_id: karigerId
                });
                if (error || (data && data.ok === false)) {
                    return toastPortal('❌ Delete nahi hua: ' + (error?.message || data?.error || ''), true);
                }
                await loadKarigerPortalAccounts();
                toastPortal('🗑️ Mobile Portal login delete ho gaya!');
            } catch (err) {
                toastPortal('❌ Network Error: ' + (err?.message || 'Delete fail'), true);
            }
        };

        if (typeof window.__karShowConfirm === 'function') {
            window.__karShowConfirm('🗑️ Is Kariger ka Mobile Portal login delete karein?', doDelete);
        } else {
            doDelete();
        }
    };

    window.kpShareWa = (karigerId) => {
        const acc = cachedAccounts.find((x) => String(x.kariger_id) === String(karigerId));
        if (!acc) return;
        const msg = `🧵 *${acc.firm_name || 'Simplicity ERP'} - Kariger Hisab App*\n\n` +
                    `👤 *Kariger:* ${acc.kariger_name}\n` +
                    `📲 *App Link:* ${PORTAL_LINK}\n` +
                    `📱 *Mobile:* ${acc.mobile}\n` +
                    `🔑 *4-Digit PIN:* ${acc.pin}\n\n` +
                    `*(Link Google Chrome me kholkar Install kar lein, apna Tani, Bana, Zari aur Mazdoori ka poora hisab live dekhein)*`;
        window.open(`https://wa.me/91${acc.mobile}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    window.kpCopyLink = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(PORTAL_LINK)
                .then(() => toastPortal('✅ Link Copy ho gaya: ' + PORTAL_LINK))
                .catch(() => toastPortal('📋 Link: ' + PORTAL_LINK));
        } else {
            toastPortal('📋 Link: ' + PORTAL_LINK);
        }
    };

    window.openKarigerPortalLoginModal = (preselectKarigerId = null) => {
        const tenantId = detectTenantId();
        if (!tenantId) return toastPortal('⚠️ Pehle apne account se login karein!', true);

        const old = document.getElementById('kariger-portal-admin-modal');
        if (old) old.remove();

        const list = typeof window.sanitizeKarigerList === 'function' ? window.sanitizeKarigerList() : [];
        const optionsHtml = list.map((k) =>
            `<option value="${escH(k.id)}" data-name="${escH(k.name)}">${escH(k.name)}${k.mobile ? ' (' + escH(k.mobile) + ')' : ''}</option>`
        ).join('');

        const savedFirm = getDefaultFirmName(tenantId);

        const html = `
        <div id="kariger-portal-admin-modal" style="position:fixed; inset:0; background:rgba(31,41,55,0.38); backdrop-filter:blur(2px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; font-family:'Inter','Segoe UI',system-ui,sans-serif;">
            <div style="background:#ffffff; width:100%; max-width:540px; max-height:92vh; border:1.5px solid #d9b86c; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
                <div style="background:#fdf6e2; color:#1f2937; border-bottom:1.5px solid #e5d5a7; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:15px; font-weight:800;">Kariger Mobile Logins (Hisab Portal)</div>
                        <div style="font-size:11.5px; color:#92400e;">Master list se Kariger chunein aur 4-Digit PIN banayein</div>
                    </div>
                    <button type="button" onclick="document.getElementById('kariger-portal-admin-modal').remove()" style="background:#ffffff; border:1px solid #d1d5db; border-radius:4px; color:#374151; font-size:12px; font-weight:700; padding:4px 9px; cursor:pointer;">[Esc] Close</button>
                </div>
                <div style="padding:14px; overflow-y:auto; flex:1;">
                    <div style="background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; padding:10px 12px; margin-bottom:12px;">
                        <div style="font-size:12px; font-weight:700; color:#92400e;">Kariger Mobile Link:</div>
                        <div style="font-size:12px; color:#1f2937; word-break:break-all; margin:4px 0 8px; font-weight:700;">${PORTAL_LINK}</div>
                        <button type="button" onclick="kpCopyLink()" style="background:#ffffff; color:#1f2937; border:1px solid #d1d5db; border-radius:5px; padding:5px 12px; font-size:12px; font-weight:700; cursor:pointer;">Copy Link</button>
                    </div>

                    <div style="border:1px solid #e5d5a7; border-radius:6px; padding:12px; margin-bottom:14px; background:#fdfcf7;">
                        <div style="font-size:13px; font-weight:800; color:#1f2937; margin-bottom:10px;">Kariger Login Banayein / Update Karein:</div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:11.5px; font-weight:700; color:#374151;">Kariger Chunein:</label>
                            <select id="kp-kar-select" onchange="kpFillForm(this.value)" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; margin-top:3px; background:#fff;">
                                <option value="">-- Kariger Select Karein --</option>
                                ${optionsHtml}
                            </select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11.5px; font-weight:700; color:#374151;">Mobile No (Login ID):</label>
                                <input type="tel" id="kp-mobile" maxlength="10" placeholder="10-digit Mobile" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; margin-top:3px;">
                            </div>
                            <div>
                                <label style="font-size:11.5px; font-weight:700; color:#374151;">4-Digit PIN:</label>
                                <input type="text" id="kp-pin" maxlength="4" value="1234" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #d9a425; border-radius:4px; font-size:13px; font-weight:800; margin-top:3px;">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:end;">
                            <div>
                                <label style="font-size:11.5px; font-weight:700; color:#374151;">Karkhane Ka Naam:</label>
                                <input type="text" id="kp-firm" value="${escH(savedFirm)}" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; margin-top:3px;">
                            </div>
                            <div>
                                <label style="font-size:11.5px; font-weight:700; color:#374151;">Status:</label>
                                <select id="kp-status" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; margin-top:3px; background:#fff;">
                                    <option value="true">Active</option>
                                    <option value="false">Blocked</option>
                                </select>
                            </div>
                            <button type="button" id="kp-save-btn" onclick="kpSaveAccount()" style="background:#f2b71d; color:#1f2937; border:1px solid #d9a425; border-radius:5px; padding:8px 14px; font-size:12.5px; font-weight:800; cursor:pointer;">Save ID</button>
                        </div>
                    </div>

                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #e5d5a7;">
                            <thead>
                                <tr style="background:#fdf6e2; color:#1f2937; text-align:left; border-bottom:1.5px solid #e5d5a7;">
                                    <th style="padding:8px 6px;">Kariger</th>
                                    <th style="padding:8px 6px;">Mobile</th>
                                    <th style="padding:8px 6px;">PIN</th>
                                    <th style="padding:8px 6px;">Status</th>
                                    <th style="padding:8px 6px;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="kp-accounts-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        loadKarigerPortalAccounts().then(() => {
            if (preselectKarigerId) kpFillForm(preselectKarigerId);
        });
    };

    const injectPortalButtons = () => {
        const waBtn = document.querySelector('button[onclick*="sendKarigerWhatsAppParchi"]');
        if (waBtn && waBtn.parentElement && !document.getElementById('btn-sheet-kariger-pin')) {
            const sBtn = document.createElement('button');
            sBtn.id = 'btn-sheet-kariger-pin';
            sBtn.type = 'button';
            sBtn.className = 'sheet-btn';
            sBtn.textContent = 'App PIN';
            sBtn.onclick = () => openKarigerPortalLoginModal(window.activeKarigerId || null);
            waBtn.parentElement.insertBefore(sBtn, waBtn.nextSibling);
        }
    };

    if (!window.__karPortalWrapped) {
        window.__karPortalWrapped = true;
        const origOpenSheet = window.openKarigerSheet;
        if (typeof origOpenSheet === 'function') {
            window.openKarigerSheet = function () {
                origOpenSheet.apply(this, arguments);
                injectPortalButtons();
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPortalButtons);
    } else {
        injectPortalButtons();
    }
})();
