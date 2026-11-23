/* ============================================================================
   SIMPLICITY ERP - TANI ORDER, RANGAI & A6 PARCHI ENGINE (TALLY WHITE & GOLD)
   File: tani/tani-order.js • Developed by Farhan Jawed
   Preserved 100%:
   - Auto-Loads Sancha Portal 2-Way Sync (sancha-portal-sync.js)
   - Push / Pull / Delete / Rangai Notifications & Injected Portal Buttons
   - New '5. Loom Par' Tab (Mounted tanis move cleanly out of active tabs into Loom tab)
   - Auto-Increment Serial #1, Learned Colors/Rangi Memory, Kariger Mohalla Fill
   - Urdu RTL A6 Physical Slip Print & WhatsApp Parchi Sharing
   - Kariger Sheet Gatekeeper Bridge (getAvailableReadyTanis / markTaniMountedOnLoom)
============================================================================ */

(() => {
    'use strict';

    // Auto-load Sancha Portal 2-Way Sync module without editing index.html
    if (!window.SanchaPortalSync && !document.getElementById('sancha-portal-sync-script')) {
        const s = document.createElement('script');
        s.id = 'sancha-portal-sync-script';
        s.src = 'tani/sancha-portal-sync.js?v=3.2';
        s.onload = () => {
            if (window.SanchaPortalSync && typeof window.SanchaPortalSync.injectSanchaPortalButtons === 'function') {
                window.SanchaPortalSync.injectSanchaPortalButtons();
            }
        };
        document.head.appendChild(s);
    }

    /* ========================================================================
       1. GLOBAL STATE & CONTEXT
       ======================================================================== */
    window.currentTaniOrderTab = 'all';
    window.currentTaniMonthFilter = 'all';
    window.activeTaniStatusOrderId = null;

    let taniOrderCurrentPage = 1;
    const TANI_PAGE_SIZE = 15;
    let filteredTaniOrdersCache = [];
    let currentPageOrdersCache = [];
    let taniListActiveIdx = 0;

    let taniViewMode = 'list'; // 'list' | 'detail'
    let activeDetailOrderId = null;
    let taniOpenedAt = 0;

    /* ========================================================================
       2. SAFE SANITIZATION & STORAGE BRIDGES
       ======================================================================== */
    const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof window.safeArray === 'function') return window.safeArray(v);
        return [];
    };

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
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
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

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null) ? String(val) : '';
    };

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const toIsoDate = (d) => {
        if (!d) return new Date().toISOString().split('T')[0];
        const s = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parts = s.split(/[-/]/);
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return new Date().toISOString().split('T')[0];
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
    };

    const getTodayIso = () => toIsoDate(getToday());

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function')
            ? window.formatDateDisplay(d)
            : (d || '-');
    };

    const isAnyExpressOverlayOpen = () => Boolean(
        document.getElementById('master-tani-express-modal') ||
        document.getElementById('kariger-express-modal') ||
        document.getElementById('master-stock-express-modal') ||
        document.getElementById('master-jobwork-express-modal')
    );

    const showTaniToast = (msg) => {
        const el = document.getElementById('tani-toast-msg');
        if (!el) return;
        const orig = el.dataset.origText || el.textContent;
        if (!el.dataset.origText) el.dataset.origText = orig;
        el.textContent = msg;
        clearTimeout(el.__tTimer);
        el.__tTimer = setTimeout(() => {
            el.textContent = el.dataset.origText || orig;
        }, 4000);
    };

    /* ========================================================================
       2B. SCOPED TALLYPRIME WHITE & GOLD STYLES (#tani-order-section & MODAL)
       ======================================================================== */
    const ensureTaniOrderTallyStyles = () => {
        if (document.getElementById('tani-order-tally-styles')) return;
        const st = document.createElement('style');
        st.id = 'tani-order-tally-styles';
        st.textContent = `
            #tani-order-section {
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                overflow-x: hidden !important;
                background: #ffffff !important;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #tani-order-section * { box-sizing: border-box; }
            #tani-order-section .module-header {
                background: #fdf6e2 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                padding: 10px 18px !important;
                margin-bottom: 0 !important;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #tani-order-section .module-header h2 {
                color: #1f2937 !important;
                font-size: 16px !important;
                font-weight: 800 !important;
                margin: 0 !important;
            }
            #tani-order-section .back-btn,
            .tani-tally-btn {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 11px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
                white-space: nowrap;
            }
            #tani-order-section .back-btn:hover,
            .tani-tally-btn:hover {
                border-color: #d9a425 !important;
                background: #fef9ea !important;
                color: #1f2937 !important;
            }
            #tani-order-section .add-btn,
            #tani-order-section .module-header button:not(.back-btn):not(.tani-tally-btn) {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border: 1px solid #d9a425 !important;
                border-radius: 5px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                cursor: pointer;
                white-space: nowrap;
            }
            #tani-order-section .add-btn:hover {
                background: #e5aa12 !important;
            }

            /* --- 5 STAT CARDS CLEAN STRIP --- */
            #tani-order-section > div[style*="grid-template-columns"] {
                padding: 10px 18px 0 18px !important;
                margin-bottom: 10px !important;
                gap: 8px !important;
            }
            #tani-order-section > div[style*="grid-template-columns"] > div {
                background: #fdfcf7 !important;
                border: 1px solid #e5d5a7 !important;
                border-radius: 6px !important;
                padding: 8px 10px !important;
            }
            #tani-order-section > div[style*="grid-template-columns"] small {
                color: #6b7280 !important;
                font-size: 11px !important;
                font-weight: 700 !important;
            }
            #tani-order-section > div[style*="grid-template-columns"] h4 {
                color: #b47d00 !important;
                font-size: 16px !important;
                font-weight: 900 !important;
                margin: 3px 0 0 0 !important;
            }

            /* --- TABS & MONTHLY TABS --- */
            #tani-order-section .sheet-tabs-bar {
                padding: 0 18px !important;
                margin-bottom: 8px !important;
            }
            #tani-order-section #tani-monthly-tabs-bar {
                margin: 0 18px 8px 18px !important;
                padding: 6px 10px !important;
                background: #fdfcf7 !important;
                border: 1px solid #e5d5a7 !important;
                border-radius: 6px !important;
            }
            #tani-order-section .sheet-tab {
                background: #ffffff !important;
                color: #374151 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                padding: 5px 11px !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer;
            }
            #tani-order-section .sheet-tab.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
                border-color: #d9a425 !important;
                font-weight: 800 !important;
            }

            /* --- SEARCH & FILTER BAR --- */
            #tani-order-section .filter-panel {
                padding: 0 18px 10px 18px !important;
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #tani-order-section .search-box {
                flex: 1;
                min-width: 210px;
                padding: 7px 12px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 5px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                background: #ffffff !important;
                color: #111827 !important;
                outline: none;
            }
            #tani-order-section .search-box:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.2);
            }

            /* --- INLINE PARCHI FORM (#add-tani-order-form) --- */
            #tani-order-section #add-tani-order-form {
                margin: 0 18px 12px 18px !important;
                background: #ffffff !important;
                border: 1.5px solid #d9b86c !important;
                border-radius: 8px !important;
                padding: 14px 16px !important;
            }
            #tani-order-section #add-tani-order-form h3 {
                color: #1f2937 !important;
                font-size: 15px !important;
            }
            #tani-order-section #add-tani-order-form > div[style*="border-bottom"] {
                border-bottom-color: #e5d5a7 !important;
            }
            #tani-order-section #add-tani-order-form div[style*="background:#fff"],
            #tani-order-section #add-tani-order-form div[style*="background:#eff6ff"] {
                background: #fdfcf7 !important;
                border-color: #e5d5a7 !important;
            }
            #tani-order-section #add-tani-order-form label {
                color: #374151 !important;
                font-size: 11.5px !important;
            }
            #tani-order-section #add-tani-order-form input[type="text"],
            #tani-order-section #add-tani-order-form input[type="number"],
            #tani-order-section #add-tani-order-form input[type="date"] {
                border: 1px solid #d1d5db !important;
                border-radius: 4px !important;
                font-weight: 700 !important;
                background: #ffffff !important;
                color: #111827 !important;
            }
            #tani-order-section #add-tani-order-form #tani-order-no {
                background: #fdf6e2 !important;
                border-color: #d9b86c !important;
                color: #92400e !important;
            }
            #tani-order-section #add-tani-order-form input:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                outline: none;
            }
            #tani-order-section #add-tani-order-form table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            .tani-sug-pop {
                position: absolute;
                left: 0;
                right: 0;
                top: 100%;
                z-index: 9999;
                background: #ffffff;
                border: 1.5px solid #d9b86c;
                border-radius: 5px;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
                max-height: 170px;
                overflow-y: auto;
                display: none;
            }
            .tani-sug-opt {
                padding: 6px 8px;
                font-size: 12px;
                font-weight: 700;
                color: #1f2937;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #f3f4f6;
            }
            .tani-sug-opt:hover,
            .tani-sug-opt.active {
                background: #f2b71d;
                color: #1f2937;
            }

            /* --- MAIN ORDERS TABLE --- */
            #tani-order-section .table-responsive {
                padding: 0 18px !important;
            }
            #tani-order-section .table-responsive > table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                background: #ffffff;
            }
            #tani-order-section .table-responsive > table thead tr {
                background: #fdf6e2 !important;
                color: #1f2937 !important;
            }
            #tani-order-section .table-responsive > table th {
                padding: 8px 9px !important;
                font-size: 11.5px !important;
                font-weight: 800 !important;
                color: #1f2937 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
                text-align: left !important;
                white-space: nowrap;
            }
            #tani-order-section .table-responsive > table td {
                padding: 8px 9px !important;
                font-size: 12.5px !important;
                color: #1f2937 !important;
                border-bottom: 1px solid #f3f4f6 !important;
                vertical-align: middle;
            }
            #tani-order-section .tani-list-row {
                cursor: pointer;
                transition: background 0.1s ease;
            }
            #tani-order-section .tani-list-row:hover {
                background: #fef9ea !important;
            }
            #tani-order-section .tani-list-row.active {
                background: #f2b71d !important;
                color: #1f2937 !important;
            }
            #tani-order-section .tani-list-row.active td,
            #tani-order-section .tani-list-row.active small,
            #tani-order-section .tani-list-row.active strong {
                color: #1f2937 !important;
                font-weight: 700 !important;
            }
            .tani-pill {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 800;
                border: 1px solid #e5d5a7;
                background: #fdfcf7;
                color: #92400e;
                white-space: nowrap;
            }
            .tani-pill.ready {
                background: #f2b71d;
                border-color: #d9a425;
                color: #1f2937;
            }
            .tani-pill.loom {
                background: #fdf6e2;
                border-color: #d9b86c;
                color: #1f2937;
            }
            .tani-pill-sub {
                display: inline-block;
                margin-top: 3px;
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 700;
                background: #ffffff;
                border: 1px solid #e5d5a7;
                color: #6b7280;
            }

            /* --- INLINE DETAIL VIEW --- */
            #tani-inline-detail-view {
                margin: 12px 18px 0 18px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                background: #ffffff;
                overflow: hidden;
            }
            .tani-det-head {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            }
            .tani-det-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
                gap: 14px;
                padding: 14px;
            }
            .tani-det-box {
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                background: #fdfcf7;
                padding: 11px 13px;
            }
            .tani-det-row {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                padding: 5px 0;
                border-bottom: 1px dashed #eadab0;
                font-size: 12.5px;
            }
            .tani-det-row:last-child { border-bottom: none; }
            .tani-stage-bar {
                background: #fdfcf7;
                border-top: 1px solid #e5d5a7;
                padding: 10px 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            }
            .tani-status-strip {
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

            /* --- STATUS MODAL WHITE & GOLD OVERRIDE --- */
            #tani-status-modal .modal-card {
                border: 1.5px solid #d9b86c !important;
                border-radius: 8px !important;
                overflow: hidden !important;
            }
            #tani-status-modal .modal-header {
                background: #fdf6e2 !important;
                border-bottom: 1.5px solid #e5d5a7 !important;
            }
            #tani-status-modal .modal-header h3 {
                color: #1f2937 !important;
            }
            #tani-status-modal .modal-body > div[style*="fffbeb"] {
                background: #fdfcf7 !important;
                border-color: #e5d5a7 !important;
                color: #1f2937 !important;
            }
            #tani-status-modal .modal-body .btn {
                background: #ffffff !important;
                color: #1f2937 !important;
                border: 1px solid #d9b86c !important;
                font-weight: 700 !important;
            }
            #tani-status-modal .modal-body .btn:hover {
                background: #f2b71d !important;
                border-color: #d9a425 !important;
            }

            @media (max-width: 860px) {
                .tani-det-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(st);
    };

    /* ========================================================================
       3. SMART DATE NORMALIZER
       ======================================================================== */
    const getMonthKeyFromDate = (dStr) => {
        if (!dStr) return '';
        const s = String(dStr).trim();

        if (/^\d{4}[-/]\d{1,2}/.test(s)) {
            const parts = s.split(/[-/]/);
            return `${parts[0]}-${parts[1].padStart(2, '0')}`;
        }

        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) {
            const parts = s.split(/[-/]/);
            return `${parts[2]}-${parts[1].padStart(2, '0')}`;
        }

        const dt = new Date(s);
        if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }
        return '';
    };

    /* ========================================================================
       4. DATA REPOSITORY & AUTO SERIAL NUMBER (#1)
       ======================================================================== */
    const getTaniOrders = () => toArray(getFromStore('tani_orders_list'));

    const saveTaniOrdersList = (list) => {
        setToStore('tani_orders_list', toArray(list));
        updateTaniOrderBadges();
        renderTaniMonthTabs();
        renderTaniOrdersTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
    };

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

    /* ========================================================================
       5. DYNAMIC LEARNED COLORS (MEMORY BASED)
       ======================================================================== */
    const getLearnedColors = () => {
        const stored = toArray(getFromStore('tani_learned_colors'));
        const orders = getTaniOrders();
        const colorsSet = new Set(stored.map(c => String(c).trim()).filter(Boolean));

        orders.forEach(o => {
            if (o.border) colorsSet.add(String(o.border).trim());
            if (o.bana) colorsSet.add(String(o.bana).trim());
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

    /* ========================================================================
       6. SMART INLINE SUGGESTIONS & 100% MOHALLA AUTO-FILL (MAKER-CLEAN)
       ======================================================================== */
    const getTaniSuggestList = (fieldId) => {
        if (fieldId === 'tani-order-kariger') {
            return toArray(getFromStore('kariger_list'))
                .filter(k => k && k.name && String(k.name).trim())
                .map(k => ({ value: k.name.trim(), meta: k.mohalla || k.saree || '' }));
        }
        if (fieldId === 'tani-order-sancha') {
            // Pull Sancha Makers (person) from Sancha Stock + Past Tani Orders (NOT Tani Item names!)
            const makerMap = new Map();
            const addMaker = (rawName, metaTxt) => {
                const nm = normPerson(rawName);
                if (!nm) return;
                const key = nm.toLowerCase();
                if (!makerMap.has(key)) {
                    makerMap.set(key, { value: nm, meta: metaTxt });
                }
            };

            if (typeof window.getSanchaMakersSummary === 'function') {
                window.getSanchaMakersSummary('tani', '', 'all').forEach((m) => {
                    addMaker(m.name, `${safeNum(m.bacha).toFixed(1)} Kg`);
                });
            } else {
                const sanchaItems = toArray(getFromStore('sancha_items'))
                    .filter(s => s && (s.category || 'tani').toLowerCase() === 'tani');
                sanchaItems.forEach((s) => addMaker(s.person, 'Sancha Maker'));
            }

            getTaniOrders().forEach((o) => addMaker(o?.sancha, 'Past Order'));

            return Array.from(makerMap.values()).sort((a, b) => a.value.localeCompare(b.value));
        }
        if (fieldId === 'tani-order-rangi') {
            const learnedRangi = toArray(getFromStore('tani_learned_rangi'));
            const names = [...new Set([
                ...learnedRangi,
                ...getTaniOrders().map(o => o.rangi).filter(Boolean)
            ])];
            return names.map(n => ({ value: n, meta: 'Rangi' }));
        }
        if (fieldId.startsWith('tani-col-')) {
            return getLearnedColors().map(c => ({ value: c, meta: 'Color' }));
        }
        return [];
    };

    const attachTaniInlineSuggest = (fieldId, onPickCallback = null) => {
        const inp = document.getElementById(fieldId);
        if (!inp) return;
        inp.removeAttribute('list');
        inp.setAttribute('autocomplete', 'off');
        if (inp.dataset.taniSugBound === '1') return;
        inp.dataset.taniSugBound = '1';

        const parent = inp.parentElement;
        if (!parent) return;
        parent.style.position = 'relative';

        const pop = document.createElement('div');
        pop.className = 'tani-sug-pop';
        parent.appendChild(pop);

        let sugIdx = 0;

        const renderPop = () => {
            const q = inp.value.trim().toLowerCase();
            const raw = getTaniSuggestList(fieldId);
            const prefix = [];
            const sub = [];
            raw.forEach((it) => {
                if (!q || it.value.toLowerCase().startsWith(q)) prefix.push(it);
                else if (it.value.toLowerCase().includes(q)) sub.push(it);
            });
            const opts = [...prefix, ...sub];
            if (!opts.length) {
                pop.style.display = 'none';
                pop.innerHTML = '';
                return;
            }
            if (sugIdx >= opts.length) sugIdx = 0;
            pop.innerHTML = opts.map((o, i) => `
                <div class="tani-sug-opt${i === sugIdx ? ' active' : ''}" data-val="${esc(o.value)}">
                    <span>${esc(o.value)}</span>
                    <small style="color:#92400e;">${esc(o.meta || '')}</small>
                </div>
            `).join('');
            pop.style.display = 'block';

            pop.querySelectorAll('.tani-sug-opt').forEach((el) => {
                el.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    inp.value = el.dataset.val || '';
                    pop.style.display = 'none';
                    if (typeof onPickCallback === 'function') onPickCallback();
                });
            });
        };

        inp.addEventListener('input', () => {
            sugIdx = 0;
            renderPop();
        });
        inp.addEventListener('blur', () => {
            setTimeout(() => { pop.style.display = 'none'; }, 140);
        });
        inp.addEventListener('keydown', (e) => {
            if (pop.style.display !== 'block') return;
            const opts = Array.from(pop.querySelectorAll('.tani-sug-opt'));
            if (!opts.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                sugIdx = (sugIdx + 1) % opts.length;
                opts.forEach((o, i) => o.classList.toggle('active', i === sugIdx));
                opts[sugIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                sugIdx = (sugIdx - 1 + opts.length) % opts.length;
                opts.forEach((o, i) => o.classList.toggle('active', i === sugIdx));
                opts[sugIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                const chosen = opts[sugIdx];
                if (chosen) {
                    inp.value = chosen.dataset.val || inp.value;
                    pop.style.display = 'none';
                    if (typeof onPickCallback === 'function') onPickCallback();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                pop.style.display = 'none';
            }
        });
    };

    const setupAutoDatalists = () => {
        attachTaniInlineSuggest('tani-order-kariger', autoFillKarigerMohalla);
        attachTaniInlineSuggest('tani-order-sancha');
        attachTaniInlineSuggest('tani-order-rangi');

        const karigerInp = document.getElementById('tani-order-kariger');
        if (karigerInp) {
            karigerInp.oninput = autoFillKarigerMohalla;
            karigerInp.onchange = autoFillKarigerMohalla;
        }

        clearAllInputPlaceholders();
    };

    const autoFillKarigerMohalla = () => {
        const karigerInp = document.getElementById('tani-order-kariger');
        const mohallaInp = document.getElementById('tani-order-mohalla');
        if (!karigerInp || !mohallaInp) return;

        const kName = String(karigerInp.value || '').trim().toUpperCase();
        if (!kName) return;

        const allKarigers = toArray(getFromStore('kariger_list'));
        const found = allKarigers.find(k => k && String(k.name || '').trim().toUpperCase() === kName);

        if (found) {
            const addr = found.mohalla || found.address || found.pata || found.area || found.location || '';
            mohallaInp.value = addr;
        }
    };

    const clearAllInputPlaceholders = () => {
        const fieldIds = [
            'tani-order-sancha', 'tani-order-kariger', 'tani-order-mohalla',
            'tani-order-paai', 'tani-order-border', 'tani-order-bana',
            'tani-order-meter', 'tani-order-pcs', 'tani-order-rangi'
        ];
        fieldIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.placeholder = '';
        });
    };

    const bindOrderFormEnterFlow = () => {
        const ids = [
            'tani-order-date', 'tani-order-sancha', 'tani-order-kariger', 'tani-order-mohalla',
            'tani-order-paai', 'tani-order-border', 'tani-order-bana',
            'tani-order-meter', 'tani-order-pcs', 'tani-order-rangi'
        ];
        for (let i = 1; i <= 8; i++) {
            ids.push(`tani-col-saree-${i}`, `tani-col-border-${i}`, `tani-col-bana-${i}`);
        }
        ids.forEach((fid, idx) => {
            const el = document.getElementById(fid);
            if (!el || el.dataset.taniEnterBound === '1') return;
            el.dataset.taniEnterBound = '1';
            if (el.type === 'number') {
                el.addEventListener('wheel', (we) => we.preventDefault(), { passive: false });
            }
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    saveTaniOrder();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.shiftKey) {
                        if (idx > 0) document.getElementById(ids[idx - 1])?.focus();
                        return;
                    }
                    if (idx < ids.length - 1) {
                        const nxt = document.getElementById(ids[idx + 1]);
                        if (nxt) { nxt.focus(); nxt.select?.(); }
                    } else {
                        saveTaniOrder();
                    }
                }
            });
        });
    };

    /* ========================================================================
       7. 8-COLORS TABLE
       ======================================================================== */
    const build8ColorInputs = () => {
        const tbody = document.getElementById('tani-colors-table-tbody');
        if (!tbody) return;

        let html = '';
        for (let i = 1; i <= 8; i++) {
            html += `<tr>
                <td style="text-align:center; font-weight:800; color:#92400e; background:#fdf6e2;">${i}</td>
                <td><input type="text" id="tani-col-saree-${i}" placeholder="" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-weight:bold;"></td>
                <td><input type="text" id="tani-col-border-${i}" placeholder="" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-weight:bold;"></td>
                <td><input type="text" id="tani-col-bana-${i}" placeholder="" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-weight:bold;"></td>
            </tr>`;
        }

        tbody.innerHTML = html;
        for (let i = 1; i <= 8; i++) {
            attachTaniInlineSuggest(`tani-col-saree-${i}`);
            attachTaniInlineSuggest(`tani-col-border-${i}`);
            attachTaniInlineSuggest(`tani-col-bana-${i}`);
        }
        upgradeContrastToMultiCheckboxes();
        bindOrderFormEnterFlow();
    };

    const upgradeContrastToMultiCheckboxes = () => {
        const rRadios = document.querySelectorAll('input[name="tani_contrast_style"]');
        if (!rRadios.length) return;
        rRadios.forEach(r => { r.type = 'checkbox'; });
    };

    /* ========================================================================
       8. VIEW CONTROLLER (LIST vs INLINE DETAIL) + 5. LOOM PAR TAB INJECTION
       ======================================================================== */
    const ensureTaniOrderChrome = () => {
        ensureTaniOrderTallyStyles();
        const sec = document.getElementById('tani-order-section');
        if (!sec) return;

        // Inject 5. Loom Par Tab right after 4. Karkhana Ready (without editing index.html)
        const readyTab = document.getElementById('tab-tani-ready');
        if (readyTab && readyTab.parentElement && !document.getElementById('tab-tani-loom')) {
            const loomBtn = document.createElement('button');
            loomBtn.type = 'button';
            loomBtn.className = 'sheet-tab';
            loomBtn.id = 'tab-tani-loom';
            loomBtn.textContent = '5. Loom Par (0)';
            loomBtn.onclick = () => switchTaniOrderTab('loom');
            readyTab.parentElement.appendChild(loomBtn);
        }

        if (!sec.dataset.taniChromeBuilt) {
            sec.dataset.taniChromeBuilt = '1';

            const titleEl = sec.querySelector('.module-header h2');
            if (titleEl) titleEl.textContent = 'Tani Order & Rangai Register';

            const backBtn = sec.querySelector('.module-header .back-btn');
            if (backBtn) backBtn.textContent = '← [Esc] Dashboard';

            const header = sec.querySelector('.module-header');
            if (header && !header.dataset.taniBackBound) {
                header.dataset.taniBackBound = '1';
                header.addEventListener('click', (e) => {
                    const btn = e.target.closest('.back-btn');
                    if (btn && taniViewMode === 'detail') {
                        e.preventDefault();
                        e.stopPropagation();
                        closeTaniDetailView();
                    }
                }, true);
            }

            if (!document.getElementById('tani-inline-detail-view')) {
                const detDiv = document.createElement('div');
                detDiv.id = 'tani-inline-detail-view';
                detDiv.style.display = 'none';
                const tblWrap = document.getElementById('tani-orders-table-body')?.closest('.table-responsive');
                if (tblWrap) tblWrap.insertAdjacentElement('beforebegin', detDiv);
                else sec.appendChild(detDiv);
            }

            if (!document.getElementById('tani-bottom-status-strip')) {
                const strip = document.createElement('div');
                strip.id = 'tani-bottom-status-strip';
                strip.className = 'tani-status-strip';
                strip.innerHTML = `
                    <span id="tani-toast-msg" style="color:#92400e; font-weight:700;">[↑ ↓] Parchi · [Enter / Click] Open Detail · [M] Quick Status · [P] Urdu A6 Print · [W] WhatsApp · [F7] Nayi Parchi · [F2] Tab · [Esc] Back</span>
                    <span id="tani-foot-count">0 Parchi</span>
                `;
                sec.appendChild(strip);
            }
        }
    };

    const setTaniViewMode = (mode, detailTitle = '') => {
        taniViewMode = mode; // 'list' | 'detail'
        const isList = (mode === 'list');
        const sec = document.getElementById('tani-order-section');
        if (!sec) return;

        const statRow = sec.querySelector(':scope > div[style*="grid-template-columns"]');
        const tabsBar = sec.querySelector(':scope > .sheet-tabs-bar');
        const monthBar = document.getElementById('tani-monthly-tabs-bar');
        const filterPanel = sec.querySelector(':scope > .filter-panel');
        const tblWrap = document.getElementById('tani-orders-table-body')?.closest('.table-responsive');
        const pager = document.getElementById('tani-order-pagination-controls');
        const detailView = document.getElementById('tani-inline-detail-view');
        const titleEl = sec.querySelector('.module-header h2');
        const backBtn = sec.querySelector('.module-header .back-btn');

        if (statRow) statRow.style.display = isList ? 'grid' : 'none';
        if (tabsBar) tabsBar.style.display = isList ? 'block' : 'none';
        if (monthBar) monthBar.style.display = isList ? 'flex' : 'none';
        if (filterPanel) filterPanel.style.display = isList ? 'flex' : 'none';
        if (tblWrap) tblWrap.style.display = isList ? 'block' : 'none';
        if (pager) pager.style.display = isList ? 'flex' : 'none';
        if (detailView) detailView.style.display = isList ? 'none' : 'block';

        if (titleEl) {
            titleEl.textContent = isList ? 'Tani Order & Rangai Register' : `Tani Parchi #${detailTitle}`;
        }
        if (backBtn) {
            backBtn.textContent = isList ? '← [Esc] Dashboard' : '← [Esc] Parchi List';
        }
    };

    const closeTaniDetailView = () => {
        activeDetailOrderId = null;
        setTaniViewMode('list');
        renderTaniOrdersTable();
    };

    const openTaniDetailView = (orderId) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(orderId));
        if (!item) return;

        activeDetailOrderId = item.id;
        setDisplay('add-tani-order-form', 'none');
        setTaniViewMode('detail', `${item.orderNo || '-'} (${item.kariger || '-'})`);

        const detailEl = document.getElementById('tani-inline-detail-view');
        if (!detailEl) return;

        const st = String(item.status || 'sancha').toLowerCase();
        const portalSt = String(item.sanchaPortalStatus || 'pending').toLowerCase();
        const stLabelMap = {
            sancha: '1. Sancha Par',
            baithak: '2. Baithak Me Padi',
            rangai: '3. Rangai Par',
            ready: '4. Karkhana Ready!',
            loom: '5. Loom Par Chadhi'
        };
        const stText = stLabelMap[st] || st;
        const portalText = portalSt === 'processing'
            ? 'Sancha Processing'
            : (portalSt === 'completed' ? 'Sancha Complete' : 'Sancha Pending');

        const matching = Array.isArray(item.matchingTable) ? item.matchingTable : [];
        let colorRowsHtml = '';
        for (let i = 1; i <= 8; i++) {
            const m = matching.find(r => r.row === i) || { saree: '', border: '', bana: '' };
            colorRowsHtml += `
                <tr>
                    <td style="text-align:center; font-weight:800; color:#92400e; background:#fdf6e2; width:30px;">${i}</td>
                    <td>${esc(m.saree || '-')}</td>
                    <td>${esc(m.border || '-')}</td>
                    <td>${esc(m.bana || '-')}</td>
                </tr>`;
        }

        const hist = Array.isArray(item.statusHistory) ? item.statusHistory : [];
        const histHtml = hist.length
            ? hist.slice().reverse().map(h => `<div style="font-size:11.5px; color:#4b5563; padding:3px 0; border-bottom:1px dashed #eee;"><strong>${formatDisplay(h.date)}</strong> — ${esc(h.note || h.status)}</div>`).join('')
            : '<div style="font-size:11.5px; color:#9ca3af;">Koi status history nahi hai.</div>';

        const safeId = esc(item.id);

        detailEl.innerHTML = `
            <div class="tani-det-head">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="tani-tally-btn" onclick="window.__taniCloseDetail()">← [Esc] Parchi List</button>
                    <strong style="font-size:14.5px; color:#1f2937;">Parchi #${esc(item.orderNo || '-')} · ${esc(item.kariger || '-')}</strong>
                    <span class="tani-pill ${st === 'ready' ? 'ready' : (st === 'loom' ? 'loom' : '')}">${esc(stText)}</span>
                    ${item.sancha ? `<span class="tani-pill-sub">${esc(portalText)}</span>` : ''}
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="tani-tally-btn" style="background:#f2b71d !important; border-color:#d9a425 !important; font-weight:800 !important;" onclick="printTaniOrderA6('${safeId}')">A6 Urdu Print [P]</button>
                    <button type="button" class="tani-tally-btn" onclick="sendTaniOrderWhatsApp('${safeId}')">WhatsApp [W]</button>
                    <button type="button" class="tani-tally-btn" onclick="editTaniOrder('${safeId}')">Edit [E]</button>
                    <button type="button" class="tani-tally-btn" onclick="deleteTaniOrder('${safeId}')">Delete [Del]</button>
                </div>
            </div>

            <div class="tani-det-grid">
                <div class="tani-det-box">
                    <div style="font-size:12px; font-weight:800; color:#92400e; margin-bottom:8px; text-transform:uppercase;">Order &amp; Loom Specifications</div>
                    <div class="tani-det-row"><span>Tarikh :</span><strong>${formatDisplay(item.date)}</strong></div>
                    <div class="tani-det-row"><span>Sancha :</span><strong>${esc(item.sancha || '-')}</strong></div>
                    <div class="tani-det-row"><span>Kariger / Mohalla :</span><strong>${esc(item.kariger || '-')}${item.mohalla ? ` (${esc(item.mohalla)})` : ''}</strong></div>
                    <div class="tani-det-row"><span>Rangi Wala (Dyer) :</span><strong>${esc(item.rangi || '-')}</strong></div>
                    <div class="tani-det-row"><span>Meter / Adad (Pcs) :</span><strong>${safeNum(item.meter)} Mtr · ${safeInt(item.pcs)} Saree</strong></div>
                    <div class="tani-det-row"><span>Paai / Border / Bana :</span><strong>${esc(item.paai || '-')} · ${esc(item.border || '-')} · ${esc(item.bana || '-')}</strong></div>
                    <div class="tani-det-row"><span>Matching Style :</span><strong>${esc(item.contrastLabel || 'Self')}</strong></div>
                    <div style="margin-top:10px;">
                        <div style="font-size:11px; font-weight:800; color:#6b7280; margin-bottom:4px;">STATUS LOG:</div>
                        ${histHtml}
                    </div>
                </div>

                <div class="tani-det-box" style="background:#ffffff;">
                    <div style="font-size:12px; font-weight:800; color:#92400e; margin-bottom:8px; text-transform:uppercase;">8-Colors Matching Table (${matching.length} Filled)</div>
                    <table style="width:100%; border-collapse:collapse; border:1px solid #e5d5a7; font-size:12px;">
                        <thead>
                            <tr style="background:#fdf6e2; color:#1f2937;">
                                <th style="padding:5px; border-bottom:1px solid #e5d5a7; text-align:center;">#</th>
                                <th style="padding:5px; border-bottom:1px solid #e5d5a7; text-align:left;">Saree</th>
                                <th style="padding:5px; border-bottom:1px solid #e5d5a7; text-align:left;">Border</th>
                                <th style="padding:5px; border-bottom:1px solid #e5d5a7; text-align:left;">Bana</th>
                            </tr>
                        </thead>
                        <tbody>${colorRowsHtml}</tbody>
                    </table>
                </div>
            </div>

            <div class="tani-stage-bar">
                <strong style="font-size:12px; color:#92400e;">Status Badlein (Auto-Sync Sancha &amp; Rangai):</strong>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="tani-tally-btn" onclick="quickStatusMove('${safeId}', 'sancha')">[1] Sancha Par</button>
                    <button type="button" class="tani-tally-btn" onclick="quickStatusMove('${safeId}', 'baithak')">[2] Baithak Aayi</button>
                    <button type="button" class="tani-tally-btn" onclick="quickStatusMove('${safeId}', 'rangai')">[3] Rangai Par</button>
                    <button type="button" class="tani-tally-btn" style="background:#f2b71d !important; border-color:#d9a425 !important; font-weight:800 !important;" onclick="quickStatusMove('${safeId}', 'ready')">[4] Karkhana Ready!</button>
                </div>
            </div>
        `;
    };

    window.__taniCloseDetail = closeTaniDetailView;

    /* ========================================================================
       8B. VIEW INITIALIZER & CLEAN RESET
       ======================================================================== */
    const initTaniOrderView = () => {
        taniOpenedAt = performance.now();
        ensureTaniOrderChrome();
        setDisplay('add-tani-order-form', 'none');
        setTaniViewMode('list');

        setupAutoDatalists();
        build8ColorInputs();

        taniOrderCurrentPage = 1;
        taniListActiveIdx = 0;
        updateTaniOrderBadges();
        renderTaniMonthTabs();
        renderTaniOrdersTable();
        bindTaniKeyboardEngine();

        if (window.SanchaPortalSync) {
            if (typeof window.SanchaPortalSync.injectSanchaPortalButtons === 'function') {
                window.SanchaPortalSync.injectSanchaPortalButtons();
            }
            if (typeof window.SanchaPortalSync.pullSanchaOrderStatuses === 'function') {
                window.SanchaPortalSync.pullSanchaOrderStatuses(true);
            }
        }
    };

    const toggleTaniOrderForm = () => {
        ensureTaniOrderChrome();
        const f = document.getElementById('add-tani-order-form');
        if (!f) return;

        if (taniViewMode === 'detail') {
            setTaniViewMode('list');
        }

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            setupAutoDatalists();
            build8ColorInputs();
            resetTaniOrderForm();
            setTimeout(() => document.getElementById('tani-order-sancha')?.focus(), 40);
        }
    };

    const resetTaniOrderForm = () => {
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };

        setVal('tani-edit-id', '');
        setVal('tani-order-date', getTodayIso());

        const noEl = document.getElementById('tani-order-no');
        if (noEl) {
            noEl.value = getNextParchiNumber();
            noEl.readOnly = true;
            noEl.style.cursor = 'not-allowed';
            noEl.title = 'Automatic Serial Number';
        }

        setVal('tani-order-sancha', '');
        setVal('tani-order-kariger', '');
        setVal('tani-order-mohalla', '');
        setVal('tani-order-paai', '');
        setVal('tani-order-border', '');
        setVal('tani-order-bana', '');
        setVal('tani-order-meter', '');
        setVal('tani-order-pcs', '');
        setVal('tani-order-rangi', '');

        clearAllInputPlaceholders();

        for (let i = 1; i <= 8; i++) {
            setVal(`tani-col-saree-${i}`, '');
            setVal(`tani-col-border-${i}`, '');
            setVal(`tani-col-bana-${i}`, '');
        }

        upgradeContrastToMultiCheckboxes();
        document.querySelectorAll('input[name="tani_contrast_style"]').forEach(c => {
            c.checked = (c.value === 'aanchal_blouse');
        });

        const rInit = document.querySelector('input[name="tani_initial_status"][value="sancha"]');
        if (rInit) rInit.checked = true;
    };

    /* ========================================================================
       9. MONTHLY TABS ENGINE
       ======================================================================== */
    const renderTaniMonthTabs = () => {
        let bar = document.getElementById('tani-monthly-tabs-bar');
        const orderSection = document.getElementById('tani-order-section');
        const filterTabsBar = document.querySelector('#tani-order-section .sheet-tabs-bar');

        if (!bar && orderSection && filterTabsBar) {
            bar = document.createElement('div');
            bar.id = 'tani-monthly-tabs-bar';
            bar.className = 'sheet-tabs-bar';
            bar.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center;';
            filterTabsBar.parentNode.insertBefore(bar, filterTabsBar.nextSibling);
        }

        if (!bar) return;

        const list = getTaniOrders();
        const monthsSet = new Set();

        list.forEach(item => {
            const mKey = getMonthKeyFromDate(item.date);
            if (mKey && mKey.length === 7) monthsSet.add(mKey);
        });

        const curMonthStr = getMonthKeyFromDate(getToday());
        if (curMonthStr) monthsSet.add(curMonthStr);

        const sortedMonths = Array.from(monthsSet).sort().reverse();

        let html = `<span style="font-size:12px; font-weight:800; color:#92400e; margin-right:4px;">Mahina:</span>`;
        const isAllActive = (window.currentTaniMonthFilter === 'all') ? 'active' : '';
        html += `<button type="button" class="sheet-tab ${isAllActive}" style="padding:4px 10px; font-size:12px;" onclick="TaniOrderEngine.switchTaniMonth('all')">Sabhi Mahine</button>`;

        sortedMonths.forEach(m => {
            const isActive = (window.currentTaniMonthFilter === m) ? 'active' : '';
            const parts = m.split('-');
            const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
            const label = dObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            html += `<button type="button" class="sheet-tab ${isActive}" style="padding:4px 10px; font-size:12px;" onclick="TaniOrderEngine.switchTaniMonth('${m}')">${label}</button>`;
        });

        bar.innerHTML = html;
        if (taniViewMode === 'detail') bar.style.display = 'none';
    };

    const switchTaniMonth = (monthKey) => {
        window.currentTaniMonthFilter = monthKey;
        taniOrderCurrentPage = 1;
        taniListActiveIdx = 0;
        renderTaniMonthTabs();
        renderTaniOrdersTable();
    };

    /* ========================================================================
       10. SAVE & UPDATE ORDER PARCHI (SANCHA PORTAL SYNC PRESERVED)
       ======================================================================== */
    const saveTaniOrder = () => {
        const editId = document.getElementById('tani-edit-id')?.value || '';
        const orderNo = String(document.getElementById('tani-order-no')?.value || '').trim() || getNextParchiNumber();
        const date = toIsoDate(document.getElementById('tani-order-date')?.value || '') || getTodayIso();
        const sancha = String(document.getElementById('tani-order-sancha')?.value || '').trim().toUpperCase();
        const kariger = String(document.getElementById('tani-order-kariger')?.value || '').trim().toUpperCase();
        const mohalla = String(document.getElementById('tani-order-mohalla')?.value || '').trim();

        const paai = String(document.getElementById('tani-order-paai')?.value || '').trim();
        const border = String(document.getElementById('tani-order-border')?.value || '').trim();
        const bana = String(document.getElementById('tani-order-bana')?.value || '').trim();
        const meter = safeNum(document.getElementById('tani-order-meter')?.value);
        const pcs = safeInt(document.getElementById('tani-order-pcs')?.value);
        const rangi = String(document.getElementById('tani-order-rangi')?.value || '').trim().toUpperCase();

        if (!kariger) return alert('Kripya Kariger chunein!');

        const allKarigers = toArray(getFromStore('kariger_list'));
        const karigerExists = allKarigers.some(k => k && String(k.name || '').trim().toUpperCase() === kariger);
        if (!karigerExists) {
            return alert('Chuna gaya Kariger Master Sheet me nahi hai! Kripya Master Sheet se chunein.');
        }

        const matchingTable = [];
        const usedColors = [];
        if (border) usedColors.push(border);
        if (bana) usedColors.push(bana);

        for (let i = 1; i <= 8; i++) {
            const sCol = String(document.getElementById(`tani-col-saree-${i}`)?.value || '').trim();
            const bCol = String(document.getElementById(`tani-col-border-${i}`)?.value || '').trim();
            const bnCol = String(document.getElementById(`tani-col-bana-${i}`)?.value || '').trim();
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
        document.querySelectorAll('input[name="tani_contrast_style"]:checked').forEach(c => {
            selectedContrasts.push(c.value);
            if (c.value === 'aanchal_blouse') contrastLabels.push('آنچل بلاؤز');
            else if (c.value === 'border_only') contrastLabels.push('صرف بارڈر');
            else if (c.value === 'self') contrastLabels.push('سیلف');
        });

        const contrastVal = selectedContrasts.length ? selectedContrasts.join(', ') : 'aanchal_blouse';
        const contrastLabel = contrastLabels.length ? contrastLabels.join(' + ') : 'آنچل بلاؤز کنٹراس';

        const initRadio = document.querySelector('input[name="tani_initial_status"]:checked');
        const initialStatus = initRadio ? initRadio.value : 'sancha';

        const list = [...getTaniOrders()];
        let targetId = editId;
        let savedOrder = null;

        if (editId) {
            const it = list.find((x) => String(x.id) === String(editId));
            if (it) {
                it.orderNo = orderNo;
                it.date = date;
                it.sancha = sancha;
                it.kariger = kariger;
                it.mohalla = mohalla;
                it.paai = paai;
                it.border = border;
                it.bana = bana;
                it.meter = meter;
                it.pcs = pcs;
                it.rangi = rangi;
                it.matchingTable = matchingTable;
                it.contrastVal = contrastVal;
                it.contrastLabel = contrastLabel;
                it.selectedContrasts = selectedContrasts;
                it.updatedAt = Date.now();
                savedOrder = it;
            }
        } else {
            targetId = `tani_${Date.now()}`;
            savedOrder = {
                id: targetId,
                orderNo,
                date,
                sancha,
                kariger,
                mohalla,
                paai,
                border,
                bana,
                meter,
                pcs,
                rangi,
                matchingTable,
                contrastVal,
                contrastLabel,
                selectedContrasts,
                status: initialStatus,
                sanchaPortalStatus: initialStatus === 'sancha' ? 'pending' : 'completed',
                statusHistory: [
                    { status: initialStatus, date: getToday(), note: 'Order Diya Gaya' }
                ],
                createdAt: Date.now()
            };
            list.unshift(savedOrder);
        }

        saveTaniOrdersList(list);
        setDisplay('add-tani-order-form', 'none');

        if (savedOrder && window.SanchaPortalSync && typeof window.SanchaPortalSync.pushTaniOrderToSanchaPortal === 'function') {
            window.SanchaPortalSync.pushTaniOrderToSanchaPortal(savedOrder).then((ok) => {
                if (ok) {
                    const latest = [...getTaniOrders()];
                    const found = latest.find(x => String(x.id) === String(savedOrder.id));
                    if (found && !found.sanchaPortalPushed) {
                        found.sanchaPortalPushed = true;
                        saveTaniOrdersList(latest);
                    }
                }
            });
        }

        showTaniToast(`✅ Parchi #${orderNo} (${kariger}) save & sync ho gayi!`);
    };

    /* ========================================================================
       11. PIPELINE TRACKING & BADGES (INCLUDES '5. LOOM PAR' TAB)
       ======================================================================== */
    const switchTaniOrderTab = (tab) => {
        window.currentTaniOrderTab = tab;
        taniOrderCurrentPage = 1;
        taniListActiveIdx = 0;

        const tabs = ['all', 'sancha', 'baithak', 'rangai', 'ready', 'loom'];
        tabs.forEach((t) => {
            const el = document.getElementById(`tab-tani-${t}`);
            if (el) {
                if (t === tab) el.classList.add('active');
                else el.classList.remove('active');
            }
        });
        renderTaniOrdersTable();
    };

    const cycleTaniOrderTab = () => {
        const tabs = ['all', 'sancha', 'baithak', 'rangai', 'ready', 'loom'];
        const curIdx = tabs.indexOf(String(window.currentTaniOrderTab || 'all'));
        switchTaniOrderTab(tabs[(curIdx + 1) % tabs.length]);
    };

    const updateTaniOrderBadges = () => {
        const list = getTaniOrders();
        let sanchaCount = 0, baithakCount = 0, rangaiCount = 0, readyCount = 0, loomCount = 0, activeCount = 0;

        list.forEach((item) => {
            const st = String(item.status || 'sancha').toLowerCase();
            if (st === 'loom') {
                loomCount++;
                return;
            }

            activeCount++;
            if (st === 'sancha') sanchaCount++;
            else if (st === 'baithak') baithakCount++;
            else if (st === 'rangai') rangaiCount++;
            else if (st === 'ready') readyCount++;
        });

        setText('tani-stat-total', activeCount);
        setText('tani-stat-sancha', sanchaCount);
        setText('tani-stat-baithak', baithakCount);
        setText('tani-stat-rangai', rangaiCount);
        setText('tani-stat-ready', readyCount);

        const loomTab = document.getElementById('tab-tani-loom');
        if (loomTab) {
            loomTab.textContent = `5. Loom Par (${loomCount})`;
        }

        const dashBadge = document.getElementById('btn-total-tani-orders');
        if (dashBadge) {
            dashBadge.textContent = `${rangaiCount} Rangai | ${readyCount} Ready`;
            dashBadge.style.background = 'transparent';
            dashBadge.style.color = '';
        }
    };

    const openTaniStatusModal = (orderId) => {
        ensureTaniOrderTallyStyles();
        const order = getTaniOrders().find((x) => String(x.id) === String(orderId));
        if (!order) return;

        window.activeTaniStatusOrderId = order.id;
        const sub = document.getElementById('tani-status-modal-sub');
        if (sub) {
            sub.textContent = `Parchi #${order.orderNo} | Sancha: ${order.sancha || '-'} | Kariger: ${order.kariger || '-'}`;
        }
        setDisplay('tani-status-modal', 'flex');
    };

    const closeTaniStatusModal = () => {
        setDisplay('tani-status-modal', 'none');
        window.activeTaniStatusOrderId = null;
    };

    const applyTaniStatusChange = (newStatus) => {
        if (!window.activeTaniStatusOrderId) return;
        const list = [...getTaniOrders()];
        const item = list.find((x) => String(x.id) === String(window.activeTaniStatusOrderId));
        if (!item) return;

        const prevStatus = item.status;
        item.status = newStatus;
        if (!Array.isArray(item.statusHistory)) item.statusHistory = [];

        let statusNote = 'Status Badla Gaya';
        if (newStatus === 'sancha') statusNote = 'Sancha Par (Tani Tanni Ja Rahi Hai)';
        else if (newStatus === 'baithak') statusNote = 'Sancha wala Tani Baithak me le aaya';
        else if (newStatus === 'rangai') {
            statusNote = (prevStatus === 'sancha') ? '⚡ Direct Sanche se Rangai Par Gayi' : 'Baithak se Rangai wale ko Diya';
        } else if (newStatus === 'ready') statusNote = '🟢 Rang Ke Tayyar Aayi (Karkhana Ready!)';
        else if (newStatus === 'loom') statusNote = '🪡 Loom Par Chadh Gayi (Stock Dispatched)';

        item.statusHistory.push({
            status: newStatus,
            date: getToday(),
            note: statusNote,
            timestamp: Date.now()
        });

        saveTaniOrdersList(list);
        closeTaniStatusModal();

        if (window.SanchaPortalSync && typeof window.SanchaPortalSync.pushTaniOrderToSanchaPortal === 'function') {
            window.SanchaPortalSync.pushTaniOrderToSanchaPortal(item);
        }

        if (taniViewMode === 'detail' && String(activeDetailOrderId) === String(item.id)) {
            openTaniDetailView(item.id);
        }
        showTaniToast(`✅ Status Update: ${statusNote}`);
    };

    /* ========================================================================
       12. TABLE RENDERER (CLEAN WHITE & GOLD — LOOM TAB ISOLATED)
       ======================================================================== */
    const highlightTaniRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#tani-orders-table-body .tani-list-row'));
        if (!rows.length) return;
        taniListActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === taniListActiveIdx));
        rows[taniListActiveIdx]?.scrollIntoView({ block: 'nearest' });
    };

    const renderTaniOrdersTable = () => {
        ensureTaniOrderChrome();

        if (taniViewMode === 'detail' && activeDetailOrderId) {
            openTaniDetailView(activeDetailOrderId);
        }

        const tbody = document.getElementById('tani-orders-table-body');
        if (!tbody) return;

        let list = getTaniOrders();

        if (window.currentTaniOrderTab !== 'loom') {
            list = list.filter(item => String(item.status || 'sancha').toLowerCase() !== 'loom');
        }

        if (window.currentTaniMonthFilter !== 'all') {
            list = list.filter((item) => getMonthKeyFromDate(item.date) === window.currentTaniMonthFilter);
        }

        const searchInput = document.getElementById('search-tani-order-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (txt) {
            list = list.filter((item) =>
                `${item.orderNo || ''} ${item.sancha || ''} ${item.kariger || ''} ${item.mohalla || ''} ${item.rangi || ''}`.toLowerCase().includes(txt)
            );
        }

        if (window.currentTaniOrderTab !== 'all') {
            list = list.filter((item) => String(item.status || 'sancha').toLowerCase() === window.currentTaniOrderTab);
        }

        filteredTaniOrdersCache = list;
        const totalEntries = list.length;
        setText('tani-foot-count', `${totalEntries} Parchi`);

        let pager = document.getElementById('tani-order-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'tani-order-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:8px 18px 0 18px; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.insertAdjacentElement('afterend', pager);
                if (taniViewMode === 'detail') pager.style.display = 'none';
            }
        }

        if (!totalEntries) {
            currentPageOrdersCache = [];
            const emptyMsg = (window.currentTaniOrderTab === 'loom')
                ? 'Abhi koi Tani Loom Par nahi chadhi hai.'
                : 'Koi Tani Order Parchi nahi mili.';
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#6b7280;">${emptyMsg}</td></tr>`;
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / TANI_PAGE_SIZE) || 1;
        if (taniOrderCurrentPage > totalPages) taniOrderCurrentPage = totalPages;
        if (taniOrderCurrentPage < 1) taniOrderCurrentPage = 1;

        const startIndex = (taniOrderCurrentPage - 1) * TANI_PAGE_SIZE;
        const pageRows = list.slice(startIndex, startIndex + TANI_PAGE_SIZE);
        currentPageOrdersCache = pageRows;
        if (taniListActiveIdx >= pageRows.length) taniListActiveIdx = 0;
        if (taniListActiveIdx < 0) taniListActiveIdx = 0;

        let html = '';
        pageRows.forEach((item, idx) => {
            const st = String(item.status || 'sancha').toLowerCase();
            const portalSt = String(item.sanchaPortalStatus || 'pending').toLowerCase();

            let statusText = '1. Sancha Par';
            if (st === 'baithak') statusText = '2. Baithak';
            else if (st === 'rangai') statusText = '3. Rangai Par';
            else if (st === 'ready') statusText = '4. Ready!';
            else if (st === 'loom') statusText = '5. Loom Par';

            let portalText = '-';
            if (st === 'loom') {
                portalText = 'Mounted on Loom';
            } else if (item.sancha) {
                if (portalSt === 'processing') portalText = 'Sancha Processing';
                else if (portalSt === 'completed') portalText = 'Sancha Complete';
                else if (st === 'sancha') portalText = 'Sancha Pending';
            }

            const matchingCount = Array.isArray(item.matchingTable) ? item.matchingTable.length : 0;
            const activeCls = (idx === taniListActiveIdx) ? ' active' : '';
            const pillCls = st === 'ready' ? 'ready' : (st === 'loom' ? 'loom' : '');

            html += `<tr class="tani-list-row${activeCls}" data-tidx="${idx}" onclick="window.__taniSelectAndOpen(${idx}, '${esc(item.id)}')">
                <td><strong style="color:#92400e;">#${esc(item.orderNo || '-')}</strong></td>
                <td>${formatDisplay(item.date)}</td>
                <td>
                    <strong>${esc(item.sancha || '-')}</strong><br>
                    <small style="color:#6b7280;">${esc(item.kariger || '-')}</small>
                </td>
                <td>
                    <strong>${safeNum(item.meter)} Mtr</strong><br>
                    <small style="color:#92400e; font-weight:700;">${safeInt(item.pcs)} Saree</small>
                </td>
                <td><strong>${esc(item.rangi || '-')}</strong></td>
                <td>
                    <span style="font-size:11.5px; font-weight:700;">${matchingCount} Colors</span><br>
                    <small style="color:#6b7280; font-size:10.5px;">${esc(item.contrastLabel || 'Self')}</small>
                </td>
                <td><span class="tani-pill ${pillCls}">${esc(statusText)}</span></td>
                <td><span class="tani-pill-sub">${esc(portalText)}</span></td>
                <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#6b7280; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + TANI_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Parchi
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="tani-tally-btn" ${taniOrderCurrentPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeTaniOrderPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 8px; background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px;">${taniOrderCurrentPage} / ${totalPages}</span>
                    <button type="button" class="tani-tally-btn" ${taniOrderCurrentPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} onclick="changeTaniOrderPage(1)">Next ▶</button>
                </div>`;
        }
    };

    window.__taniSelectAndOpen = (idx, id) => {
        highlightTaniRow(idx);
        openTaniDetailView(id);
    };

    const changeTaniOrderPage = (delta) => {
        taniOrderCurrentPage += delta;
        taniListActiveIdx = 0;
        renderTaniOrdersTable();
    };

    const quickStatusMove = (id, newStatus) => {
        window.activeTaniStatusOrderId = id;
        applyTaniStatusChange(newStatus);
    };

    const editTaniOrder = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return;

        if (taniViewMode === 'detail') {
            setTaniViewMode('list');
        }

        setDisplay('add-tani-order-form', 'block');
        setupAutoDatalists();
        build8ColorInputs();

        const setVal = (fid, v) => {
            const el = document.getElementById(fid);
            if (el) el.value = v;
        };

        setVal('tani-edit-id', item.id);
        setVal('tani-order-date', toIsoDate(item.date || getTodayIso()));
        setVal('tani-order-no', item.orderNo || '');
        setVal('tani-order-sancha', item.sancha || '');
        setVal('tani-order-kariger', item.kariger || '');
        setVal('tani-order-mohalla', item.mohalla || '');
        setVal('tani-order-paai', item.paai || '');
        setVal('tani-order-border', item.border || '');
        setVal('tani-order-bana', item.bana || '');
        setVal('tani-order-meter', item.meter || '');
        setVal('tani-order-pcs', item.pcs || '');
        setVal('tani-order-rangi', item.rangi || '');

        clearAllInputPlaceholders();

        for (let i = 1; i <= 8; i++) {
            setVal(`tani-col-saree-${i}`, '');
            setVal(`tani-col-border-${i}`, '');
            setVal(`tani-col-bana-${i}`, '');
        }

        if (Array.isArray(item.matchingTable)) {
            item.matchingTable.forEach((row) => {
                if (row && row.row) {
                    setVal(`tani-col-saree-${row.row}`, row.saree || '');
                    setVal(`tani-col-border-${row.row}`, row.border || '');
                    setVal(`tani-col-bana-${row.row}`, row.bana || '');
                }
            });
        }

        upgradeContrastToMultiCheckboxes();
        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : (item.contrastVal ? item.contrastVal.split(',').map(s => s.trim()) : []);
        document.querySelectorAll('input[name="tani_contrast_style"]').forEach(c => {
            c.checked = selContrasts.includes(c.value);
        });

        setTimeout(() => document.getElementById('tani-order-sancha')?.focus(), 40);
    };

    const deleteTaniOrder = (id) => {
        if (!confirm('Kya is Tani Order Parchi ko delete karna chahte hain?')) return;
        const list = getTaniOrders().filter((x) => String(x.id) !== String(id));
        if (taniViewMode === 'detail' && String(activeDetailOrderId) === String(id)) {
            activeDetailOrderId = null;
            setTaniViewMode('list');
        }
        saveTaniOrdersList(list);
        if (window.SanchaPortalSync && typeof window.SanchaPortalSync.deleteTaniOrderFromSanchaPortal === 'function') {
            window.SanchaPortalSync.deleteTaniOrderFromSanchaPortal(id);
        }
        showTaniToast('🗑️ Parchi delete ho gayi.');
    };

    /* ========================================================================
       12B. KEYBOARD NAVIGATION ENGINE FOR #tani-order-section
       ======================================================================== */
    const getActiveTaniOrderId = () => {
        if (taniViewMode === 'detail' && activeDetailOrderId) return activeDetailOrderId;
        return currentPageOrdersCache[taniListActiveIdx]?.id || null;
    };

    const handleTaniOrderKeydown = (e) => {
        if (isAnyExpressOverlayOpen()) return;

        // 1. Status Modal open
        const stModal = document.getElementById('tani-status-modal');
        if (stModal && stModal.style.display && stModal.style.display !== 'none') {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeTaniStatusModal(); }
            else if (e.key === '1') { e.preventDefault(); applyTaniStatusChange('sancha'); }
            else if (e.key === '2') { e.preventDefault(); applyTaniStatusChange('baithak'); }
            else if (e.key === '3') { e.preventDefault(); applyTaniStatusChange('rangai'); }
            else if (e.key === '4') { e.preventDefault(); applyTaniStatusChange('ready'); }
            return;
        }

        const sec = document.getElementById('tani-order-section');
        if (!sec || sec.style.display === 'none') return;

        const addForm = document.getElementById('add-tani-order-form');
        const isFormOpen = addForm && addForm.style.display === 'block';
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const isTyping = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (isFormOpen) {
                toggleTaniOrderForm();
            } else if (taniViewMode === 'detail') {
                closeTaniDetailView();
            } else if (typeof window.backToDashboard === 'function') {
                window.backToDashboard();
            }
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            e.stopImmediatePropagation();
            toggleTaniOrderForm();
            return;
        }

        if (e.key === 'F2' && taniViewMode === 'list' && !isFormOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cycleTaniOrderTab();
            return;
        }

        if (isTyping || isFormOpen) return;

        // Inside Detail View: 1/2/3/4 status shortcuts + P/W/E/Del
        if (taniViewMode === 'detail' && activeDetailOrderId) {
            const k = e.key.toLowerCase();
            if (e.key === '1') { e.preventDefault(); quickStatusMove(activeDetailOrderId, 'sancha'); }
            else if (e.key === '2') { e.preventDefault(); quickStatusMove(activeDetailOrderId, 'baithak'); }
            else if (e.key === '3') { e.preventDefault(); quickStatusMove(activeDetailOrderId, 'rangai'); }
            else if (e.key === '4') { e.preventDefault(); quickStatusMove(activeDetailOrderId, 'ready'); }
            else if (k === 'm') { e.preventDefault(); openTaniStatusModal(activeDetailOrderId); }
            else if (k === 'p') { e.preventDefault(); printTaniOrderA6(activeDetailOrderId); }
            else if (k === 'w') { e.preventDefault(); sendTaniOrderWhatsApp(activeDetailOrderId); }
            else if (k === 'e') { e.preventDefault(); editTaniOrder(activeDetailOrderId); }
            else if (e.key === 'Delete') { e.preventDefault(); deleteTaniOrder(activeDetailOrderId); }
            return;
        }

        // Inside List View
        if (e.key === 'Enter' && (performance.now() - taniOpenedAt) < 180) return;

        const targetId = getActiveTaniOrderId();
        const k = e.key.toLowerCase();

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightTaniRow(taniListActiveIdx + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightTaniRow(taniListActiveIdx - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            changeTaniOrderPage(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeTaniOrderPage(-1);
        } else if (e.key === 'Enter' && targetId) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openTaniDetailView(targetId);
        } else if (k === 'm' && targetId) {
            e.preventDefault();
            openTaniStatusModal(targetId);
        } else if (k === 'p' && targetId) {
            e.preventDefault();
            printTaniOrderA6(targetId);
        } else if (k === 'w' && targetId) {
            e.preventDefault();
            sendTaniOrderWhatsApp(targetId);
        } else if (k === 'e' && targetId) {
            e.preventDefault();
            editTaniOrder(targetId);
        } else if (e.key === 'Delete' && targetId) {
            e.preventDefault();
            deleteTaniOrder(targetId);
        } else if (e.key === '+') {
            e.preventDefault();
            toggleTaniOrderForm();
        } else if (e.key === '/') {
            e.preventDefault();
            const sEl = document.getElementById('search-tani-order-input');
            if (sEl) { sEl.focus(); sEl.select(); }
        }
    };

    const bindTaniKeyboardEngine = () => {
        if (window.__taniOrderKeysBound) return;
        window.__taniOrderKeysBound = true;
        document.addEventListener('keydown', handleTaniOrderKeydown);
    };

    /* ========================================================================
       13. A6 PHYSICAL SLIP PRINT (EXACT URDU RTL REPLICA - UNTOUCHED)
       ======================================================================== */
    const printTaniOrderA6 = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return alert('Parchi nahi mili!');

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

        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : (item.contrastVal ? item.contrastVal.split(',').map(s => s.trim()) : ['aanchal_blouse']);
        const isAanchal = selContrasts.includes('aanchal_blouse') ? '☑' : '☐';
        const isBorder = selContrasts.includes('border_only') ? '☑' : '☐';
        const isSelf = selContrasts.includes('self') ? '☑' : '☐';

        const printWin = window.open('', '', 'width=450,height=700');
        if (!printWin) return alert('Popup block hai! Browser me popup allow karein.');

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
       14. WHATSAPP PARCHI SHARING (UNTOUCHED)
       ======================================================================== */
    const sendTaniOrderWhatsApp = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return;

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
       15. KARIGER MODULE BRIDGE (UNTOUCHED)
       ======================================================================== */
    const getAvailableReadyTanis = (karigerName = '') => {
        const list = getTaniOrders();
        return list.filter(item => {
            const isReady = String(item.status || '').toLowerCase() === 'ready';
            if (!isReady) return false;
            if (karigerName) {
                return String(item.kariger || '').trim().toUpperCase() === String(karigerName).trim().toUpperCase();
            }
            return true;
        });
    };

    const markTaniMountedOnLoom = (orderNoOrId, karigerName = '') => {
        const list = [...getTaniOrders()];
        const item = list.find(x => String(x.id) === String(orderNoOrId) || String(x.orderNo) === String(orderNoOrId));
        if (!item) return false;

        item.status = 'loom';
        if (!Array.isArray(item.statusHistory)) item.statusHistory = [];
        item.statusHistory.push({
            status: 'loom',
            date: getToday(),
            note: `🪡 Kariger ${karigerName || item.kariger || ''} ne Loom par taana chadha liya (Consumed)`,
            timestamp: Date.now()
        });

        saveTaniOrdersList(list);
        if (window.SanchaPortalSync && typeof window.SanchaPortalSync.pushTaniOrderToSanchaPortal === 'function') {
            window.SanchaPortalSync.pushTaniOrderToSanchaPortal(item);
        }
        return item;
    };

    /* ========================================================================
       16. GLOBAL WINDOW EXPORTS
       ======================================================================== */
    const taniOrderAPI = {
        initTaniOrderView,
        toggleTaniOrderForm,
        resetTaniOrderForm,
        saveTaniOrder,
        switchTaniOrderTab,
        switchTaniMonth,
        updateTaniOrderBadges,
        openTaniStatusModal,
        closeTaniStatusModal,
        applyTaniStatusChange,
        quickStatusMove,
        renderTaniOrdersTable,
        renderTaniMonthTabs,
        editTaniOrder,
        deleteTaniOrder,
        printTaniOrderA6,
        sendTaniOrderWhatsApp,
        getTaniOrders,
        changeTaniOrderPage,
        getLearnedColors,
        getAvailableReadyTanis,
        markTaniMountedOnLoom,
        getMonthKeyFromDate
    };

    Object.keys(taniOrderAPI).forEach(fn => { window[fn] = taniOrderAPI[fn]; });
    window.TaniOrderEngine = taniOrderAPI;

    const bindSearch = () => {
        const searchInput = document.getElementById('search-tani-order-input');
        if (searchInput) {
            searchInput.oninput = () => {
                taniOrderCurrentPage = 1;
                taniListActiveIdx = 0;
                renderTaniOrdersTable();
            };
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    searchInput.blur();
                    if (e.key === 'Enter' && currentPageOrdersCache.length > 0) {
                        const chosen = currentPageOrdersCache[taniListActiveIdx] || currentPageOrdersCache[0];
                        if (chosen) openTaniDetailView(chosen.id);
                    }
                }
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindSearch();
            initTaniOrderView();
        });
    } else {
        bindSearch();
        initTaniOrderView();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = taniOrderAPI;
    }
})();
