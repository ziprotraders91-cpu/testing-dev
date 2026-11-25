/* ============================================================================
   SIMPLICITY ERP - KARIGER EXPRESS VOUCHER (TALLYPRIME WHITE & GOLD EDITION)
   Folder: kariger-express / File: kariger-express.js
   Developed for: Farhan Jawed
   Features:
   - TallyPrime White & Gold 2-Column Voucher Layout (Matching Profile Creation)
   - Dynamic Right-Pane Picker in Main Voucher, Alt+C (Naya Kariger) & Alt+N
   - Separate Tani/Chukka Item & Sancha Maker Pickers + Maker-Wise Stock Deduction
   - Clean Empty Inputs (No Pre-Filled 72 / 240 / 0.311 / 0.110 Defaults)
   - Auto-Tani Detection & Carry-Forward Rollover
   - Zero-Mouse Enter Chaining, Shift+Enter Back, Arrow Navigation & A6 Print
   - Double-Submit Locks, Transactional Snapshot Rollback & PWA-Safe Alerts
============================================================================ */

(() => {
    'use strict';

    let selectedKariger = null;
    let currentActiveSheet = null;
    let activeSheetIndex = 0;
    let prevDeliveredSarees = 0;
    let lastSavedTransaction = null;

    // Global Double-Submit Locks
    let isSubmittingExpress = false;
    let isSavingAltC = false;
    let isSavingNtani = false;

    // Main Voucher Right-Pane Picker State
    let pickerMode = 'kariger'; // 'kariger' | 'bana' | 'zari' | 'summary'
    let pickerItems = [];
    let pickerActiveIdx = 0;
    let pickerArrowUsed = false;

    // Alt+C Modal Right-Pane Picker State
    let altcPickerMode = 'preview'; // 'dup_kariger' | 'karkhana' | 'design' | 'tani' | 'tani_maker' | 'chukka' | 'chukka_maker' | 'preview'
    let altcPickerItems = [];
    let altcPickerActiveIdx = 0;
    let altcPickerArrowUsed = false;

    // Alt+N Modal Right-Pane Picker State
    let ntaniPickerMode = 'tani'; // 'tani' | 'tani_maker' | 'preview'
    let ntaniPickerItems = [];
    let ntaniPickerActiveIdx = 0;
    let ntaniPickerArrowUsed = false;
    let ntaniSaveParams = { nextNum: 2, pBana: 0, pZari: 0, pBani: 0 };

    /* ========================================================================
       1. SAFE HELPERS & DATA STORES
       ------------------------------------------------------------------------
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
        } catch {
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
        return (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
    };

    const setExpressStatus = (htmlMsg, color = '#b47d00') => {
        const el = document.getElementById('kexp-status-msg');
        if (!el) return;
        el.style.color = color;
        el.innerHTML = htmlMsg;
    };

    const setModalStatus = (elId, msg, isError = true) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.style.color = isError ? '#dc2626' : '#15803d';
        el.textContent = msg || '';
    };

    const getNextTaniNumber = (sheets) => {
        const arr = toArray(sheets);
        let maxNum = arr.length;
        arr.forEach((s) => {
            if (!s) return;
            const m1 = String(s.id || '').match(/(\d+)$/);
            const m2 = String(s.title || '').match(/(\d+)$/);
            if (m1) maxNum = Math.max(maxNum, parseInt(m1[1], 10) || 0);
            if (m2) maxNum = Math.max(maxNum, parseInt(m2[1], 10) || 0);
        });
        return maxNum + 1;
    };

    const refreshUnderlyingERPViews = (kId = null) => {
        if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
        if (typeof window.invalidateBanaCalcCache === 'function') window.invalidateBanaCalcCache();
        if (typeof window.invalidateZariCalcCache === 'function') window.invalidateZariCalcCache();
        if (typeof window.invalidatePaymentCache === 'function' && kId) window.invalidatePaymentCache(kId);
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();

        const kSec = document.getElementById('kariger-section');
        if (kSec && kSec.style.display !== 'none') {
            if (typeof window.renderKarigerKarkhanaTabs === 'function') window.renderKarigerKarkhanaTabs();
            if (typeof window.renderKarigerTable === 'function') window.renderKarigerTable();
        }

        const shSec = document.getElementById('kariger-sheet-section');
        if (shSec && shSec.style.display !== 'none' && kId && String(window.activeKarigerId) === String(kId)) {
            if (typeof window.renderSheetTabs === 'function') window.renderSheetTabs();
            if (typeof window.loadCurrentSheetData === 'function') window.loadCurrentSheetData();
        }
    };

    const getSafeKarkhanas = () => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : toArray(getFromStore('karkhana_list'));
        karkhanas = toArray(karkhanas).filter(k => k && k.id && k.name);
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }
        return karkhanas;
    };

    const getBanaStockBacha = (itemName, kGodown) => {
        if (!itemName) return 0;
        if (typeof window.getBanaItemStats === 'function') {
            return safeNum(window.getBanaItemStats(itemName, kGodown).bacha);
        }
        const raw = toArray(getFromStore('bana_stock'));
        const item = raw.find(x => x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
            ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
        return item ? safeNum(item.bacha) : 0;
    };

    const getZariStockBacha = (itemName, kGodown) => {
        if (!itemName) return 0;
        if (typeof window.getZariItemStats === 'function') {
            return safeNum(window.getZariItemStats(itemName, kGodown).bacha);
        }
        const raw = toArray(getFromStore('zari_stock'));
        const item = raw.find(x => x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
            ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
        return item ? safeNum(item.bacha) : 0;
    };

    const getSanchaStockList = (category, kGodown, queryText = '', makerFilter = '') => {
        const q = String(queryText || '').trim().toLowerCase();
        const catTarget = String(category || 'tani').toLowerCase();
        const mFilterNorm = normPerson(makerFilter);
        const mFilterLower = mFilterNorm.toLowerCase();
        const seen = new Map();

        if (typeof window.getSanchaUniqueStockRows === 'function') {
            const rows = window.getSanchaUniqueStockRows(catTarget, kGodown);
            rows.forEach((r) => {
                const nm = String(r.name || '').trim();
                if (!nm) return;
                if (mFilterLower && normPerson(r.person).toLowerCase() !== mFilterLower) return;
                const key = nm.toLowerCase();
                if (q && !key.includes(q)) return;
                if (seen.has(key)) {
                    seen.get(key).bacha = safeNum((seen.get(key).bacha + safeNum(r.bacha)).toFixed(2));
                } else {
                    seen.set(key, { name: nm, bacha: safeNum(r.bacha) });
                }
            });
            return Array.from(seen.values());
        }

        const rawSancha = toArray(getFromStore('sancha_items'));
        rawSancha.forEach((s) => {
            if (!s || !s.name) return;
            const cat = String(s.category || 'tani').toLowerCase();
            if (cat !== catTarget) return;

            const matchKid = !kGodown || (!s.karkhanaId && kGodown === 'k_main') || String(s.karkhanaId) === String(kGodown);
            if (!matchKid) return;

            if (mFilterLower && normPerson(s.person).toLowerCase() !== mFilterLower) return;

            const nm = s.name.trim();
            const key = nm.toLowerCase();
            if (q && !key.includes(q)) return;

            const bacha = safeNum(s.bacha !== undefined ? s.bacha : (safeNum(s.aaya) - safeNum(s.gaya)));
            if (seen.has(key)) {
                seen.get(key).bacha += bacha;
            } else {
                seen.set(key, { name: nm, bacha });
            }
        });

        return Array.from(seen.values());
    };

    const getSanchaMakerList = (category, kGodown, itemName = '', queryText = '') => {
        const catTarget = String(category || 'tani').toLowerCase();
        const itemLower = String(itemName || '').trim().toLowerCase();
        const q = String(queryText || '').trim().toLowerCase();
        const makerMap = new Map();

        const addMaker = (rawName, bachaAdd = 0, matchesItem = false) => {
            const per = normPerson(rawName);
            if (!per) return;
            const key = per.toLowerCase();
            if (!makerMap.has(key)) {
                makerMap.set(key, { name: per, bacha: 0, matchesItem: false });
            }
            const m = makerMap.get(key);
            m.bacha = safeNum((m.bacha + safeNum(bachaAdd)).toFixed(2));
            if (matchesItem) m.matchesItem = true;
        };

        if (typeof window.getSanchaUniqueStockRows === 'function') {
            const rows = window.getSanchaUniqueStockRows(catTarget, kGodown);
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
            const rawSancha = toArray(getFromStore('sancha_items'));
            rawSancha.forEach((s) => {
                if (!s) return;
                const cat = String(s.category || 'tani').toLowerCase();
                if (cat !== catTarget) return;
                const matchKid = !kGodown || (!s.karkhanaId && kGodown === 'k_main') || String(s.karkhanaId) === String(kGodown);
                if (!matchKid) return;
                const per = normPerson(s.person);
                if (!per) return;
                const bacha = safeNum(s.bacha !== undefined ? s.bacha : (safeNum(s.aaya) - safeNum(s.gaya)));
                const matchIt = itemLower && String(s.name || '').trim().toLowerCase() === itemLower;
                addMaker(per, (!itemLower || matchIt) ? bacha : 0, matchIt);
            });
        }

        // Include known Sancha Makers from Tani Orders
        if (catTarget === 'tani') {
            toArray(getFromStore('tani_orders_list')).forEach((o) => {
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

        return list;
    };

    const getKarigerExpressDatalists = () => {
        const rawKarigers = toArray(getFromStore('kariger_list'));
        let kOpts = '';
        rawKarigers.forEach((k) => {
            if (k && k.name) {
                const sDesign = k.saree ? ` [${k.saree}]` : '';
                kOpts += `<option value="${esc(k.name)}">${esc(k.name)}${esc(sDesign)}</option>`;
            }
        });

        const rawBana = toArray(getFromStore('bana_stock'));
        const uB = [];
        let bOpts = '';
        rawBana.forEach((b) => {
            if (b && b.name && uB.indexOf(b.name.trim().toLowerCase()) === -1) {
                uB.push(b.name.trim().toLowerCase());
                bOpts += `<option value="${esc(b.name.trim())}">`;
            }
        });

        const rawZari = toArray(getFromStore('zari_stock'));
        const uZ = [];
        let zOpts = '';
        rawZari.forEach((z) => {
            if (z && z.name && uZ.indexOf(z.name.trim().toLowerCase()) === -1) {
                uZ.push(z.name.trim().toLowerCase());
                zOpts += `<option value="${esc(z.name.trim())}">`;
            }
        });

        const rawSancha = toArray(getFromStore('sancha_items'));
        let taniOpts = '';
        let chukkaOpts = '';
        const uT = [], uC = [];

        rawSancha.forEach((s) => {
            if (!s || !s.name) return;
            const cat = String(s.category || 'tani').toLowerCase();
            const bacha = safeNum(s.bacha !== undefined ? s.bacha : s.aaya);
            if (cat === 'tani' && uT.indexOf(s.name.trim().toLowerCase()) === -1) {
                uT.push(s.name.trim().toLowerCase());
                taniOpts += `<option value="${esc(s.name.trim())}">${esc(s.name.trim())} (Bacha: ${bacha.toFixed(2)} Kg)</option>`;
            } else if (cat === 'chukka' && uC.indexOf(s.name.trim().toLowerCase()) === -1) {
                uC.push(s.name.trim().toLowerCase());
                chukkaOpts += `<option value="${esc(s.name.trim())}">${esc(s.name.trim())} (Bacha: ${bacha.toFixed(2)} Kg)</option>`;
            }
        });

        return { kOpts, bOpts, zOpts, taniOpts, chukkaOpts };
    };

    const deductSanchaStockItem = (itemName, category, wazan, kGodown, refKey, kName, makerName = '') => {
        if (!itemName || !wazan || wazan <= 0) return;
        const sList = toArray(getFromStore('sancha_items'));
        const catLower = String(category || 'tani').toLowerCase();
        const makerNorm = normPerson(makerName);
        const makerLower = makerNorm.toLowerCase();

        // 1. Exact match: Item + Maker + Category + Godown
        let found = sList.find((x) => {
            const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            const xPer = normPerson(x.person).toLowerCase();
            return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
                   String(x.category || 'tani').toLowerCase() === catLower &&
                   matchKid &&
                   xPer === makerLower;
        });

        // 2. Fallback: if makerName wasn't provided, or only unassigned entry exists
        if (!found && !makerNorm) {
            found = sList.find((x) => {
                const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
                       String(x.category || 'tani').toLowerCase() === catLower && matchKid;
            });
        } else if (!found && makerNorm) {
            found = sList.find((x) => {
                const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
                       String(x.category || 'tani').toLowerCase() === catLower &&
                       matchKid && normPerson(x.person) === '';
            });
        }

        if (found) {
            found.gaya = Math.max(0, safeNum((safeNum(found.gaya) + safeNum(wazan)).toFixed(2)));
            found.bacha = safeNum((safeNum(found.aaya) - found.gaya).toFixed(2));
            setToStore('sancha_items', sList);
        }

        let sHist = toArray(getFromStore('sancha_history'));
        sHist.push({
            id: `shist_${Date.now()}_${catLower.charAt(0)}_${Math.floor(Math.random() * 1000)}`,
            refId: refKey,
            date: getToday(),
            category: catLower,
            name: itemName,
            person: makerNorm || '-',
            sanchaMaker: makerNorm || '-',
            kariger: kName,
            type: `Kariger Issue (${catLower === 'tani' ? 'Tani' : 'Chukka'})`,
            aaya: 0,
            gaya: safeNum(wazan),
            karkhanaId: kGodown,
            timestamp: Date.now()
        });
        setToStore('sancha_history', sHist);

        if (typeof window.invalidateSanchaCalcCache === 'function') window.invalidateSanchaCalcCache();
        if (typeof window.renderSanchaTable === 'function') window.renderSanchaTable();
    };

    /* ========================================================================
       2. SCOPED TALLYPRIME WHITE & GOLD STYLES
       ------------------------------------------------------------------------
    ======================================================================== */
    const ensureTallyExpressStyles = () => {
        if (document.getElementById('kexp-tally-styles')) return;
        const style = document.createElement('style');
        style.id = 'kexp-tally-styles';
        style.textContent = `
            .kexp-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.38);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 14px; box-sizing: border-box;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            .kexp-card {
                background: #ffffff;
                width: 100%; max-width: 980px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.14);
                overflow: hidden;
                max-height: 95vh;
                display: flex; flex-direction: column;
                color: #1f2937;
            }
            .kexp-header {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 18px;
                display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
            }
            .kexp-title {
                margin: 0; font-size: 15px; font-weight: 800; color: #1f2937;
                letter-spacing: 0.2px;
            }
            .kexp-pill-btn {
                background: #ffffff; color: #374151;
                border: 1px solid #d1d5db; border-radius: 5px;
                padding: 5px 11px; font-size: 12px; font-weight: 700;
                cursor: pointer; transition: all 0.12s ease;
            }
            .kexp-pill-btn:hover { border-color: #d9a425; background: #fef9ea; color: #1f2937; }
            .kexp-pill-gold {
                background: #f2b71d; color: #1f2937;
                border: 1px solid #d9a425; border-radius: 5px;
                padding: 5px 12px; font-size: 12px; font-weight: 800;
                cursor: pointer;
            }
            .kexp-pill-gold:hover { background: #e5aa12; }
            .kexp-body {
                display: grid; grid-template-columns: 1.55fr 1fr;
                gap: 16px; padding: 14px 18px;
                overflow-y: auto; flex: 1; background: #ffffff;
            }
            @media (max-width: 820px) {
                .kexp-body { grid-template-columns: 1fr; }
            }
            .kexp-sec-title {
                font-size: 11px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.6px;
                border-bottom: 1px solid #eadab0;
                padding-bottom: 4px; margin: 11px 0 8px 0;
            }
            .kexp-row {
                display: grid; grid-template-columns: 150px 1fr;
                align-items: center; gap: 10px; margin-bottom: 7px;
            }
            .kexp-row-2 {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 12px; margin-bottom: 7px;
            }
            .kexp-mini-row {
                display: grid; grid-template-columns: 115px 1fr;
                align-items: center; gap: 8px;
            }
            .kexp-lbl {
                font-size: 12.5px; font-weight: 600; color: #374151;
            }
            .kexp-inp {
                width: 100%; box-sizing: border-box;
                padding: 6px 10px;
                border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 13px; font-weight: 700; color: #111827;
                background: #ffffff; outline: none;
                transition: border-color 0.12s, background 0.12s;
            }
            .kexp-inp:focus {
                border-color: #d9a425 !important;
                background: #fffdf5 !important;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            .kexp-inp-num { text-align: right; font-variant-numeric: tabular-nums; }
            .kexp-right-panel {
                border: 1px solid #e5d5a7; border-radius: 6px;
                background: #ffffff; display: flex; flex-direction: column;
                overflow: hidden; min-height: 360px;
            }
            .kexp-right-head {
                background: #fdf6e2; border-bottom: 1px solid #e5d5a7;
                padding: 8px 12px; font-size: 12.5px; font-weight: 800; color: #1f2937;
                display: flex; justify-content: space-between; align-items: center;
            }
            .kexp-picker-list {
                flex: 1; overflow-y: auto; max-height: 390px;
            }
            .kexp-picker-item {
                padding: 7px 12px; font-size: 12.5px; font-weight: 600; color: #1f2937;
                border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center; gap: 8px;
            }
            .kexp-picker-item:hover { background: #fef9ea; }
            .kexp-picker-item.active {
                background: #f2b71d; color: #1f2937; font-weight: 800;
            }
            .kexp-picker-sub {
                font-size: 11px; color: #6b7280; font-weight: 600;
            }
            .kexp-picker-item.active .kexp-picker-sub { color: #374151; }
            .kexp-footer {
                background: #fdf6e2; border-top: 1px solid #e5d5a7;
                padding: 8px 18px;
                display: flex; justify-content: space-between; align-items: center;
                flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: #6b7280;
            }
            .kexp-btn-save {
                background: #f2b71d; color: #1f2937;
                border: 1px solid #d9a425; border-radius: 5px;
                padding: 7px 20px; font-size: 13px; font-weight: 800;
                cursor: pointer;
            }
            .kexp-btn-save:hover { background: #e5aa12; }
            .kexp-btn-sec {
                background: #ffffff; color: #1f2937;
                border: 1px solid #d1d5db; border-radius: 5px;
                padding: 7px 14px; font-size: 12.5px; font-weight: 700;
                cursor: pointer;
            }
            .kexp-btn-sec:hover { border-color: #d9a425; background: #fef9ea; }
            .kexp-accept-bar {
                background: #fdf6e2; border: 1.5px solid #d9a425; border-radius: 5px;
                padding: 8px 12px; margin-top: 10px;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
            }
        `;
        document.head.appendChild(style);
    };

    /* ========================================================================
       3. OPEN KARIGER EXPRESS VOUCHER (TALLY WHITE & GOLD)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.openKarigerExpressModal = () => {
        ensureTallyExpressStyles();
        const existing = document.getElementById('kariger-express-modal');
        if (existing) existing.remove();

        selectedKariger = null;
        currentActiveSheet = null;
        activeSheetIndex = 0;
        prevDeliveredSarees = 0;
        lastSavedTransaction = null;
        isSubmittingExpress = false;
        isSavingAltC = false;
        isSavingNtani = false;
        pickerMode = 'kariger';
        pickerItems = [];
        pickerActiveIdx = 0;
        pickerArrowUsed = false;

        const { kOpts, bOpts, zOpts } = getKarigerExpressDatalists();
        const today = getToday();

        const modalHtml = `
        <div id="kariger-express-modal" class="kexp-overlay">
            <div class="kexp-card">

                <!-- Top Cream Tally Header -->
                <div class="kexp-header">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <h3 class="kexp-title">Kariger Baithak Voucher</h3>
                        <button type="button" id="kexp-btn-alt-c" class="kexp-pill-gold" onclick="openAltCKarigerModal()">+ Naya Kariger [Alt+C]</button>
                        <button type="button" class="kexp-pill-btn" onclick="openExpressNewTaniModal()">+ Nayi Tani [Alt+N]</button>
                    </div>
                    <button type="button" class="kexp-pill-btn" onclick="closeKarigerExpressModal()">&larr; [Esc] Back</button>
                </div>

                <!-- Main 2-Column Split Body -->
                <div class="kexp-body">

                    <!-- LEFT PANE: CLEAN TALLY FORM -->
                    <div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Date :</label>
                                <input type="date" id="kexp-date" value="${today}" data-next="kexp-kariger-input" class="kexp-inp">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Kariger [F2] :</label>
                                <input type="text" id="kexp-kariger-input" data-next="kexp-saree-qty" placeholder="Type name or &uarr;&darr;..." autocomplete="off" class="kexp-inp">
                                <datalist id="kexp-kariger-dl">${kOpts}</datalist>
                            </div>
                        </div>

                        <!-- Tani Selection Tabs Strip -->
                        <div id="kexp-tani-tabs-bar" style="display:none; margin:6px 0 8px 0; background:#fdf6e2; padding:5px 8px; border-radius:4px; border:1px solid #e5d5a7; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                            <div id="kexp-tani-chips-container" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;"></div>
                            <span style="font-size:11px; color:#92400e; font-weight:700;">Active Tani</span>
                        </div>

                        <!-- SECTION 1: INWARD -->
                        <div class="kexp-sec-title">Inward &mdash; Saree Jama &amp; Material Return</div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Saree Jama (Pcs) :</label>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-saree-qty" data-next="kexp-saree-lott" placeholder="0" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num" style="border-color:#d9a425;">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Lott / Cut (Pcs) :</label>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-saree-lott" data-next="kexp-ret-bana" placeholder="0" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Bana Wapsi (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-ret-bana" data-next="kexp-ret-zari" placeholder="0.00" class="kexp-inp kexp-inp-num">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Zari Wapsi (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-ret-zari" data-next="kexp-bana-name" placeholder="0.00" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>

                        <!-- SECTION 2: OUTWARD -->
                        <div class="kexp-sec-title">Outward &mdash; Bana &amp; Zari Issue</div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Bana Item : <small id="kexp-live-bana-badge" style="display:block; font-size:10.5px; color:#b47d00; font-weight:700;">Bacha: 0.00 Kg</small></label>
                            <input type="text" id="kexp-bana-name" data-next="kexp-bana-cone" placeholder="Select Bana..." autocomplete="off" oninput="updateExpressStockBadges()" class="kexp-inp">
                            <datalist id="kexp-bana-dl">${bOpts}</datalist>
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Bana Gross (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-bana-cone" data-next="kexp-bana-lesstp" placeholder="0.00" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Less TP (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-bana-lesstp" data-next="kexp-zari-name" placeholder="0.00" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>

                        <div class="kexp-row" style="margin-top:8px;">
                            <label class="kexp-lbl">Zari Item : <small id="kexp-live-zari-badge" style="display:block; font-size:10.5px; color:#b47d00; font-weight:700;">Bacha: 0.00 Kg</small></label>
                            <input type="text" id="kexp-zari-name" data-next="kexp-zari-qty" placeholder="Select Zari..." autocomplete="off" oninput="updateExpressStockBadges()" class="kexp-inp">
                            <datalist id="kexp-zari-dl">${zOpts}</datalist>
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Zari Gross (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-zari-qty" data-next="kexp-zari-topi" placeholder="0.00" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Topi Less (Kg) :</label>
                                <input type="text" inputmode="decimal" id="kexp-zari-topi" data-next="kexp-paid-amount" placeholder="0.00" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>

                        <!-- SECTION 3: MAZDOORI & ROKAD -->
                        <div class="kexp-sec-title">Mazdoori &amp; Rokad Payment</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#fdfcf7; border:1px solid #eadab0; border-radius:4px; padding:6px 10px; margin-bottom:8px; font-size:12.5px;">
                            <span>Bani Rate: <strong id="kexp-disp-bani-rate" style="color:#1f2937;">₹ 0.00</strong></span>
                            <span>Aaj ki Mazdoori: <strong id="kexp-disp-gross-bani" style="color:#b47d00;">₹ 0.00</strong></span>
                        </div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Aaj Rokad Diya (₹) :</label>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-paid-amount" placeholder="0" oninput="calculateKarigerExpressLive()" class="kexp-inp kexp-inp-num" style="border-color:#d9a425; font-size:15px;">
                        </div>

                        <!-- Bottom Voucher Action Strip -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1px solid #eadab0; flex-wrap:wrap; gap:8px;">
                            <div style="font-size:13px; font-weight:700; color:#374151;">
                                Antim Baki: <span id="kexp-disp-net-balance" style="font-size:17px; font-weight:900; color:#b47d00; margin-left:4px;">₹ 0.00</span>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button type="button" id="kexp-print-btn" class="kexp-btn-sec" onclick="printLastSavedExpressSlip()">A6 Parchi [Alt+P]</button>
                                <button type="button" id="kexp-submit-btn" class="kexp-btn-save" onclick="submitKarigerExpress()">Save &amp; Parchi [Enter]</button>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT PANE: TALLY CONTEXTUAL PANEL -->
                    <div class="kexp-right-panel">
                        <div class="kexp-right-head">
                            <span id="kexp-right-title">List of Karigers</span>
                            <span id="kexp-right-hint" style="font-size:11px; color:#6b7280; font-weight:600;">&uarr;&darr; + Enter</span>
                        </div>

                        <div id="kexp-right-picker" class="kexp-picker-list"></div>

                        <div id="kexp-weaver-banner" style="display:none; padding:12px; font-size:12.5px; line-height:1.5; flex:1; overflow-y:auto;">
                            <span style="color:#6b7280;">Kariger chunein — tani ka poora hisab aur 8 colors yahan dikhenge.</span>
                        </div>
                    </div>

                </div>

                <!-- Bottom Tally Status Bar -->
                <div class="kexp-footer">
                    <div>
                        <span id="kexp-status-msg" style="font-weight:700; color:#b47d00;">[F2] Kariger &bull; [Enter] Next / Save &bull; [Shift+Enter] Prev &bull; [Alt+C] Naya Kariger &bull; [Alt+N] Nayi Tani &bull; [Esc] Back</span>
                    </div>
                    <div style="font-weight:600;">TallyPrime White &amp; Gold Mode</div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        bindKarigerExpressEvents();
        showRightPicker('kariger', '');
    };

    /* ========================================================================
       4. MAIN VOUCHER RIGHT-PANE CONTEXTUAL PICKER
       ------------------------------------------------------------------------
    ======================================================================== */
    const showRightPicker = (mode, queryText) => {
        pickerMode = mode;
        const pickerEl = document.getElementById('kexp-right-picker');
        const bannerEl = document.getElementById('kexp-weaver-banner');
        const titleEl = document.getElementById('kexp-right-title');
        const hintEl = document.getElementById('kexp-right-hint');
        if (!pickerEl || !bannerEl) return;

        if (mode === 'summary') {
            pickerEl.style.display = 'none';
            bannerEl.style.display = 'block';
            if (titleEl) titleEl.textContent = selectedKariger ? `Snapshot: ${selectedKariger.name}` : 'Tani & Hisab Snapshot';
            if (hintEl) hintEl.textContent = 'Live Balance';
            return;
        }

        pickerEl.style.display = 'block';
        bannerEl.style.display = 'none';
        if (hintEl) hintEl.textContent = '↑↓ + Enter';

        const q = String(queryText || '').trim().toLowerCase();
        const kGodown = selectedKariger ? (selectedKariger.karkhanaId || 'k_main') : 'k_main';
        pickerItems = [];

        if (mode === 'kariger') {
            if (titleEl) titleEl.textContent = 'List of Karigers';
            const list = toArray(getFromStore('kariger_list')).filter(k => k && k.name);
            list.forEach((k) => {
                const text = `${k.name} ${k.saree || ''}`.toLowerCase();
                if (!q || text.includes(q)) {
                    pickerItems.push({
                        label: k.name,
                        sub: k.saree || 'Saree',
                        data: k,
                        exact: q && String(k.name).trim().toLowerCase() === q
                    });
                }
            });
            if (q) {
                pickerItems.sort((a, b) => (a.exact === b.exact ? 0 : (a.exact ? -1 : 1)));
            }
        } else if (mode === 'bana') {
            if (titleEl) titleEl.textContent = 'List of Bana Stock';
            const raw = toArray(getFromStore('bana_stock'));
            const seen = new Set();
            raw.forEach((b) => {
                if (!b || !b.name) return;
                const nm = b.name.trim();
                const key = nm.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (!q || key.includes(q)) {
                    const bacha = getBanaStockBacha(nm, kGodown);
                    pickerItems.push({
                        label: nm,
                        sub: `${bacha.toFixed(2)} Kg`,
                        data: nm
                    });
                }
            });
        } else if (mode === 'zari') {
            if (titleEl) titleEl.textContent = 'List of Zari Stock';
            const raw = toArray(getFromStore('zari_stock'));
            const seen = new Set();
            raw.forEach((z) => {
                if (!z || !z.name) return;
                const nm = z.name.trim();
                const key = nm.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (!q || key.includes(q)) {
                    const bacha = getZariStockBacha(nm, kGodown);
                    pickerItems.push({
                        label: nm,
                        sub: `${bacha.toFixed(2)} Kg`,
                        data: nm
                    });
                }
            });
        }

        if (pickerActiveIdx >= pickerItems.length) pickerActiveIdx = 0;
        if (pickerActiveIdx < 0) pickerActiveIdx = 0;
        renderRightPickerList();
    };

    const renderRightPickerList = () => {
        const pickerEl = document.getElementById('kexp-right-picker');
        if (!pickerEl) return;

        if (!pickerItems.length) {
            pickerEl.innerHTML = `<div style="padding:18px 12px; text-align:center; color:#6b7280; font-size:12px;">Koi matching record nahi mila.</div>`;
            return;
        }

        let html = '';
        pickerItems.forEach((item, idx) => {
            const cls = idx === pickerActiveIdx ? 'kexp-picker-item active' : 'kexp-picker-item';
            html += `<div class="${cls}" data-pidx="${idx}" onmousedown="event.preventDefault(); window.__kexpPickItem(${idx})">
                <span>${esc(item.label)}</span>
                <span class="kexp-picker-sub">${esc(item.sub)}</span>
            </div>`;
        });
        pickerEl.innerHTML = html;

        const activeEl = pickerEl.querySelector('.kexp-picker-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    };

    window.__kexpPickItem = (idx) => {
        const item = pickerItems[idx];
        if (!item) return;

        if (pickerMode === 'kariger') {
            const k = item.data;
            const kInp = document.getElementById('kexp-kariger-input');
            if (kInp) kInp.value = k.name;
            applySelectedKariger(k);
            const nextEl = document.getElementById('kexp-saree-qty');
            if (nextEl) { nextEl.focus(); nextEl.select(); }
        } else if (pickerMode === 'bana') {
            const bInp = document.getElementById('kexp-bana-name');
            if (bInp) bInp.value = item.data;
            updateExpressStockBadges();
            const nextEl = document.getElementById('kexp-bana-cone');
            if (nextEl) { nextEl.focus(); nextEl.select(); }
        } else if (pickerMode === 'zari') {
            const zInp = document.getElementById('kexp-zari-name');
            if (zInp) zInp.value = item.data;
            updateExpressStockBadges();
            const nextEl = document.getElementById('kexp-zari-qty');
            if (nextEl) { nextEl.focus(); nextEl.select(); }
        }
    };

    const applySelectedKariger = (k) => {
        selectedKariger = k;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
        activeSheetIndex = sheets.length ? sheets.length - 1 : 0;
        currentActiveSheet = sheets[activeSheetIndex] || null;

        renderKarigerExpressTaniTabs();
        updateWeaverBannerSnapshot(true);
        calculateKarigerExpressLive();
    };

    /* ========================================================================
       5. TANI SELECTION & SNAPSHOT BANNER
       ------------------------------------------------------------------------
    ======================================================================== */
    const renderKarigerExpressTaniTabs = () => {
        const bar = document.getElementById('kexp-tani-tabs-bar');
        const container = document.getElementById('kexp-tani-chips-container');
        if (!bar || !container || !selectedKariger) {
            if (bar) bar.style.display = 'none';
            return;
        }

        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        if (!sheets.length) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        let html = '';

        sheets.forEach((sh, idx) => {
            const isActive = (idx === activeSheetIndex);
            html += `<button type="button" onclick="switchExpressTaniSheet(${idx})" style="background:${isActive ? '#f2b71d' : '#ffffff'}; color:#1f2937; border:1px solid ${isActive ? '#d9a425' : '#d1d5db'}; padding:3px 10px; border-radius:4px; font-size:11.5px; font-weight:${isActive ? '800' : '600'}; cursor:pointer;">
                ${esc(sh.title || `Tani ${idx + 1}`)}
            </button>`;
        });

        container.innerHTML = html;
    };

    window.switchExpressTaniSheet = (idx) => {
        activeSheetIndex = idx;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        currentActiveSheet = sheets[idx] || sheets[sheets.length - 1];

        renderKarigerExpressTaniTabs();
        updateWeaverBannerSnapshot(true);
        calculateKarigerExpressLive();
        showRightPicker('summary', '');
    };

    const getSheetRateBani = (sh) => {
        if (!sh) return 0;
        const defBani = (window.DEFAULT_RATES && window.DEFAULT_RATES.BANI !== undefined) ? window.DEFAULT_RATES.BANI : 240;
        return (sh.rateBani !== undefined && sh.rateBani !== null) ? safeNum(sh.rateBani, 0) : defBani;
    };

    const updateWeaverBannerSnapshot = (syncSheetItems = false) => {
        const banner = document.getElementById('kexp-weaver-banner');
        if (!banner || !selectedKariger || !currentActiveSheet) return;

        const k = selectedKariger;
        const calc = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(currentActiveSheet)
            : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

        prevDeliveredSarees = safeNum(calc.totSaree);

        const rateBani = getSheetRateBani(currentActiveSheet);
        const totalTaniTarget = safeNum(currentActiveSheet.taniPcs, 0);
        const taniSancha = currentActiveSheet.taniSancha || 'N/A';
        const chukkaSancha = currentActiveSheet.chukkaSancha || 'N/A';
        const taniItem = currentActiveSheet.taniItem || 'Tani';

        const colorsArr = Array.isArray(currentActiveSheet.colors) ? currentActiveSheet.colors : [];
        let colorsHtml = '';
        if (colorsArr.length) {
            colorsArr.forEach((c, idx) => {
                if (c && String(c).trim()) {
                    colorsHtml += `<span style="background:#fdf6e2; color:#1f2937; border:1px solid #e5d5a7; font-size:11px; font-weight:600; padding:1px 6px; border-radius:3px;">${idx + 1}. ${esc(c)}</span> `;
                }
            });
        }
        if (!colorsHtml) colorsHtml = `<span style="color:#9ca3af; font-size:11px;">Colors set nahi hain</span>`;

        const banaInp = document.getElementById('kexp-bana-name');
        const zariInp = document.getElementById('kexp-zari-name');
        if (banaInp && (syncSheetItems || (currentActiveSheet.banaItem && !banaInp.value))) {
            banaInp.value = currentActiveSheet.banaItem || '';
        }
        if (zariInp && (syncSheetItems || (currentActiveSheet.zariItem && !zariInp.value))) {
            zariInp.value = currentActiveSheet.zariItem || '';
        }

        updateExpressStockBadges();

        banner.innerHTML = `
            <div style="border-bottom:1px solid #eadab0; padding-bottom:8px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:800; color:#1f2937;">${esc(k.name)}</div>
                <div style="font-size:11.5px; color:#6b7280;">Design: <strong style="color:#1f2937;">${esc(k.saree || 'Satan')}</strong> &bull; ${esc(currentActiveSheet.title || 'Tani')}</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px; margin-bottom:10px;">
                <div style="background:#fdfcf7; border:1px solid #eadab0; padding:6px 8px; border-radius:4px;">
                    <div style="font-size:10.5px; color:#6b7280;">Sancha / Tani</div>
                    <strong style="color:#1f2937;">${esc(taniSancha)}</strong> <span style="font-size:11px; color:#6b7280;">(${esc(taniItem)})</span>
                </div>
                <div style="background:#fdfcf7; border:1px solid #eadab0; padding:6px 8px; border-radius:4px;">
                    <div style="font-size:10.5px; color:#6b7280;">Chukka Sancha</div>
                    <strong style="color:#1f2937;">${esc(chukkaSancha)}</strong>
                </div>
            </div>

            <div id="kexp-live-tani-progress" style="background:#fdf6e2; border:1px solid #e5d5a7; padding:7px 9px; border-radius:4px; font-size:12px; margin-bottom:10px;">
                Tani: <strong>${totalTaniTarget} Pcs</strong> &bull; Aayi: <strong>${prevDeliveredSarees}</strong> &bull; Baki: <strong style="color:#b47d00;">${Math.max(0, totalTaniTarget - prevDeliveredSarees)} Pcs</strong>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #f3f4f6; padding-bottom:6px; margin-bottom:6px;">
                <span style="color:#6b7280;">Pichla Baki Rupya:</span>
                <strong style="color:#b47d00;">₹ ${safeNum(calc.remainingAmt).toFixed(2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #f3f4f6; padding-bottom:6px; margin-bottom:6px;">
                <span style="color:#6b7280;">Kariger ke paas Bana:</span>
                <strong>${safeNum(calc.remainingBana).toFixed(2)} Kg</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #f3f4f6; padding-bottom:6px; margin-bottom:8px;">
                <span style="color:#6b7280;">Kariger ke paas Zari:</span>
                <strong>${safeNum(calc.remainingZari).toFixed(2)} Kg</strong>
            </div>

            <div>
                <div style="font-size:10.5px; font-weight:700; color:#92400e; text-transform:uppercase; margin-bottom:4px;">8 Colors Matching</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${colorsHtml}</div>
            </div>
        `;
        const rateEl = document.getElementById('kexp-disp-bani-rate');
        if (rateEl) rateEl.textContent = `₹ ${rateBani.toFixed(2)}`;
    };

    /* ========================================================================
       6. ALT + C MODAL: 2-COLUMN TALLY NAYA KARIGER & TANI 1 SETUP
       ------------------------------------------------------------------------
    ======================================================================== */
    const ALTC_FIELD_ORDER = [
        'altc-kar-name',
        'altc-kar-godown',
        'altc-kar-saree',
        'altc-kar-mobile',
        'altc-kar-mohalla',
        'altc-kar-date',
        'altc-tani-item',
        'altc-tani-sancha',
        'altc-tani-wazan',
        'altc-tani-pcs',
        'altc-chukka-item',
        'altc-chukka-sancha',
        'altc-chukka-wazan',
        'altc-chukka-pcs',
        'altc-rate-bani',
        'altc-rate-bana',
        'altc-rate-zari',
        'altc-col-1',
        'altc-col-2',
        'altc-col-3',
        'altc-col-4',
        'altc-col-5',
        'altc-col-6',
        'altc-col-7',
        'altc-col-8'
    ];

    const moveAltCField = (currentId, dir) => {
        const idx = ALTC_FIELD_ORDER.indexOf(currentId);
        if (idx === -1) return;
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < ALTC_FIELD_ORDER.length) {
            const el = document.getElementById(ALTC_FIELD_ORDER[nextIdx]);
            if (el) {
                el.focus();
                if (typeof el.select === 'function') el.select();
            }
        }
    };

    const getSelectedAltcKarkhanaObj = () => {
        const karkhanas = getSafeKarkhanas();
        const inp = document.getElementById('altc-kar-godown');
        const kidAttr = inp ? inp.getAttribute('data-kid') : '';
        const val = String(inp?.value || '').trim().toLowerCase();

        let matched = null;
        if (kidAttr) {
            matched = karkhanas.find(k => String(k.id) === String(kidAttr));
        }
        if (!matched && val) {
            matched = karkhanas.find(k => String(k.name).trim().toLowerCase() === val);
        }
        if (!matched && val) {
            matched = karkhanas.find(k => String(k.name).trim().toLowerCase().includes(val));
        }
        return matched || karkhanas[0];
    };

    const showAltCRightPicker = (mode, queryText) => {
        altcPickerMode = mode;
        const pickerEl = document.getElementById('altc-right-picker');
        const previewEl = document.getElementById('altc-right-preview');
        const titleEl = document.getElementById('altc-right-title');
        const hintEl = document.getElementById('altc-right-hint');
        if (!pickerEl || !previewEl) return;

        if (mode === 'preview') {
            pickerEl.style.display = 'none';
            previewEl.style.display = 'block';
            if (titleEl) titleEl.textContent = 'Account Preview';
            if (hintEl) hintEl.textContent = 'Live Summary';
            updateAltCAccountPreview();
            return;
        }

        pickerEl.style.display = 'block';
        previewEl.style.display = 'none';

        const q = String(queryText || '').trim().toLowerCase();
        const activeK = getSelectedAltcKarkhanaObj();
        const activeKid = activeK ? activeK.id : 'k_main';
        altcPickerItems = [];

        if (mode === 'dup_kariger') {
            if (titleEl) titleEl.textContent = 'Existing Karigers (Check)';
            if (hintEl) hintEl.textContent = 'Duplicate Check';
            const list = toArray(getFromStore('kariger_list')).filter(k => k && k.name);
            list.forEach((k) => {
                const nm = String(k.name || '').trim();
                if (!q || nm.toLowerCase().includes(q)) {
                    altcPickerItems.push({
                        label: nm,
                        sub: k.saree || 'Kariger',
                        data: k,
                        readOnly: true
                    });
                }
            });
        } else if (mode === 'karkhana') {
            if (titleEl) titleEl.textContent = 'List of Karkhanas';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const list = getSafeKarkhanas();
            list.forEach((k) => {
                if (!q || String(k.name).toLowerCase().includes(q)) {
                    altcPickerItems.push({
                        label: k.name,
                        sub: (k.id === 'k_main' || k.isDefault) ? 'Default' : 'Branch',
                        data: k
                    });
                }
            });
        } else if (mode === 'design') {
            if (titleEl) titleEl.textContent = 'List of Saree Designs';
            if (hintEl) hintEl.textContent = '↑↓ + Enter or Type New';
            const seen = new Set();
            const addDesign = (d) => {
                const nm = String(d || '').trim();
                if (!nm) return;
                const key = nm.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (!q || key.includes(q)) {
                    altcPickerItems.push({ label: nm, sub: 'Design', data: nm });
                }
            };
            toArray(getFromStore('kariger_list')).forEach(k => k && addDesign(k.saree));
            toArray(getFromStore('saree_history')).forEach(s => s && addDesign(s.sareeName));
        } else if (mode === 'tani') {
            if (titleEl) titleEl.textContent = `List of Tani Items (${activeK?.name || 'Godown'})`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const selMaker = normPerson(document.getElementById('altc-tani-sancha')?.value);
            const list = getSanchaStockList('tani', activeKid, q, selMaker);
            list.forEach((item) => {
                altcPickerItems.push({
                    label: item.name,
                    sub: `${item.bacha.toFixed(2)} Kg`,
                    data: item.name
                });
            });
        } else if (mode === 'tani_maker') {
            const selItem = String(document.getElementById('altc-tani-item')?.value || '').trim();
            if (titleEl) titleEl.textContent = selItem ? `Tani Makers (${selItem})` : `List of Tani Makers`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const list = getSanchaMakerList('tani', activeKid, selItem, q);
            list.forEach((m) => {
                altcPickerItems.push({
                    label: m.name,
                    sub: m.bacha > 0 ? `${m.bacha.toFixed(2)} Kg` : 'Maker',
                    data: m.name
                });
            });
        } else if (mode === 'chukka') {
            if (titleEl) titleEl.textContent = `List of Chukka Items (${activeK?.name || 'Godown'})`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const selMaker = normPerson(document.getElementById('altc-chukka-sancha')?.value);
            const list = getSanchaStockList('chukka', activeKid, q, selMaker);
            list.forEach((item) => {
                altcPickerItems.push({
                    label: item.name,
                    sub: `${item.bacha.toFixed(2)} Kg`,
                    data: item.name
                });
            });
        } else if (mode === 'chukka_maker') {
            const selItem = String(document.getElementById('altc-chukka-item')?.value || '').trim();
            if (titleEl) titleEl.textContent = selItem ? `Chukka Makers (${selItem})` : `List of Chukka Makers`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const list = getSanchaMakerList('chukka', activeKid, selItem, q);
            list.forEach((m) => {
                altcPickerItems.push({
                    label: m.name,
                    sub: m.bacha > 0 ? `${m.bacha.toFixed(2)} Kg` : 'Maker',
                    data: m.name
                });
            });
        }

        if (altcPickerActiveIdx >= altcPickerItems.length) altcPickerActiveIdx = 0;
        if (altcPickerActiveIdx < 0) altcPickerActiveIdx = 0;
        renderAltCRightPickerList();
    };

    const renderAltCRightPickerList = () => {
        const pickerEl = document.getElementById('altc-right-picker');
        if (!pickerEl) return;

        if (!altcPickerItems.length) {
            const emptyMsg = altcPickerMode === 'dup_kariger'
                ? 'Koi matching purana Kariger nahi mila (Naya naam safe hai).'
                : (altcPickerMode === 'design'
                    ? 'Naya Saree Design seedha type karein.'
                    : ((altcPickerMode === 'tani_maker' || altcPickerMode === 'chukka_maker')
                        ? 'Koi Maker nahi mila — naya Maker naam type karke [Enter] dabayein.'
                        : 'Is Godam me koi stock item nahi mila.'));
            pickerEl.innerHTML = `<div style="padding:18px 12px; text-align:center; color:#6b7280; font-size:12px;">${emptyMsg}</div>`;
            return;
        }

        let html = '';
        altcPickerItems.forEach((item, idx) => {
            const isHighlighted = !item.readOnly && idx === altcPickerActiveIdx;
            const cls = isHighlighted ? 'kexp-picker-item active' : 'kexp-picker-item';
            const actionAttr = item.readOnly
                ? ''
                : `onmousedown="event.preventDefault(); window.__altcPickItem(${idx})"`;

            html += `<div class="${cls}" ${actionAttr}>
                <span>${esc(item.label)}</span>
                <span class="kexp-picker-sub">${esc(item.sub)}</span>
            </div>`;
        });
        pickerEl.innerHTML = html;

        const activeEl = pickerEl.querySelector('.kexp-picker-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    };

    window.__altcPickItem = (idx) => {
        const item = altcPickerItems[idx];
        if (!item || item.readOnly) return;

        if (altcPickerMode === 'karkhana') {
            const k = item.data;
            const inp = document.getElementById('altc-kar-godown');
            if (inp) {
                inp.value = k.name;
                inp.setAttribute('data-kid', k.id);
            }
            moveAltCField('altc-kar-godown', 1);
        } else if (altcPickerMode === 'design') {
            const inp = document.getElementById('altc-kar-saree');
            if (inp) inp.value = item.data;
            moveAltCField('altc-kar-saree', 1);
        } else if (altcPickerMode === 'tani') {
            const inp = document.getElementById('altc-tani-item');
            if (inp) inp.value = item.data;
            moveAltCField('altc-tani-item', 1);
        } else if (altcPickerMode === 'tani_maker') {
            const inp = document.getElementById('altc-tani-sancha');
            if (inp) inp.value = item.data;
            moveAltCField('altc-tani-sancha', 1);
        } else if (altcPickerMode === 'chukka') {
            const inp = document.getElementById('altc-chukka-item');
            if (inp) inp.value = item.data;
            moveAltCField('altc-chukka-item', 1);
        } else if (altcPickerMode === 'chukka_maker') {
            const inp = document.getElementById('altc-chukka-sancha');
            if (inp) inp.value = item.data;
            moveAltCField('altc-chukka-sancha', 1);
        }
        updateAltCAccountPreview();
    };

    const updateAltCAccountPreview = () => {
        const previewEl = document.getElementById('altc-right-preview');
        if (!previewEl) return;

        const nm = String(document.getElementById('altc-kar-name')?.value || '').trim().toUpperCase() || '-';
        const godownObj = getSelectedAltcKarkhanaObj();
        const saree = String(document.getElementById('altc-kar-saree')?.value || '').trim() || 'General Saree';
        const mobile = String(document.getElementById('altc-kar-mobile')?.value || '').trim() || '-';
        const mohalla = String(document.getElementById('altc-kar-mohalla')?.value || '').trim() || '-';
        const joinDate = document.getElementById('altc-kar-date')?.value || getToday();
        const taniItem = String(document.getElementById('altc-tani-item')?.value || '').trim() || '-';
        const taniMaker = String(document.getElementById('altc-tani-sancha')?.value || '').trim() || '-';
        const taniPcs = safeNum(document.getElementById('altc-tani-pcs')?.value, 0);
        const rateBani = safeNum(document.getElementById('altc-rate-bani')?.value, 0);

        previewEl.innerHTML = `
            <div style="border-bottom:1px solid #eadab0; padding-bottom:8px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:800; color:#1f2937;">${esc(nm)}</div>
                <div style="font-size:11.5px; color:#6b7280;">Group: <strong style="color:#b47d00;">Kariger (Weaver)</strong></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Karkhana:</span><strong>${esc(godownObj?.name || 'Main Godown')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Saree Design:</span><strong>${esc(saree)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Mobile:</span><strong>${esc(mobile)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Mohalla:</span><strong>${esc(mohalla)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                <span style="color:#6b7280;">Join Date:</span><strong>${esc(joinDate)}</strong>
            </div>
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:4px; padding:8px; margin-top:10px; font-size:12px;">
                <div>Tani 1: <strong>${esc(taniItem)}</strong> (${taniPcs} Pcs)</div>
                <div style="margin-top:2px;">Maker: <strong>${esc(taniMaker)}</strong></div>
                <div style="margin-top:3px;">Bani Rate: <strong style="color:#b47d00;">₹ ${rateBani.toFixed(2)} / Saree</strong></div>
            </div>
        `;
    };

    const showAltcAcceptPrompt = (show) => {
        const bar = document.getElementById('altc-accept-strip');
        if (!bar) return;
        bar.style.display = show ? 'flex' : 'none';
        if (show) {
            const yesBtn = document.getElementById('altc-accept-yes');
            if (yesBtn) yesBtn.focus();
        }
    };

    window.openAltCKarigerModal = () => {
        ensureTallyExpressStyles();
        const existing = document.getElementById('alt-c-kariger-modal');
        if (existing) existing.remove();

        isSavingAltC = false;
        altcPickerMode = 'dup_kariger';
        altcPickerItems = [];
        altcPickerActiveIdx = 0;
        altcPickerArrowUsed = false;

        const { taniOpts, chukkaOpts } = getKarigerExpressDatalists();
        const activeKid = (selectedKariger && selectedKariger.karkhanaId) ? selectedKariger.karkhanaId : 'k_main';
        const karkhanas = getSafeKarkhanas();
        const defaultK = karkhanas.find(k => String(k.id) === String(activeKid)) || karkhanas[0];
        const today = getToday();

        const modalHtml = `
        <div id="alt-c-kariger-modal" class="kexp-overlay" style="z-index:1000005;">
            <div class="kexp-card" style="max-width:940px;">

                <div class="kexp-header">
                    <div>
                        <h3 class="kexp-title">Naya Kariger &amp; Tani 1 Setup (Tally Style &bull; Alt+C)</h3>
                        <span style="font-size:11px; color:#6b7280;">[Enter] Next &bull; [Shift+Enter] Prev &bull; [&uarr;&darr;] Select List &bull; [Ctrl+Enter] Save &bull; [Esc] Back</span>
                    </div>
                    <button type="button" class="kexp-pill-btn" onclick="closeAltCKarigerModal()">&larr; [Esc] Back</button>
                </div>

                <div class="kexp-body">

                    <!-- LEFT PANE: FULL PROFILE CREATION + TANI 1 SETUP -->
                    <div>
                        <div class="kexp-sec-title" style="margin-top:0;">1. Kariger Master Details</div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Kariger Name :</label>
                            <input type="text" id="altc-kar-name" placeholder="Jaise: FARHAN" autocomplete="off" class="kexp-inp" style="border-color:#d9a425;">
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Karkhana :</label>
                                <input type="text" id="altc-kar-godown" value="${esc(defaultK.name)}" data-kid="${esc(defaultK.id)}" placeholder="Select Karkhana..." autocomplete="off" class="kexp-inp">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Saree Design :</label>
                                <input type="text" id="altc-kar-saree" placeholder="Jaise: Banarasi Katan" autocomplete="off" class="kexp-inp">
                            </div>
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Mobile No. :</label>
                                <input type="tel" id="altc-kar-mobile" placeholder="10-digit Mobile" class="kexp-inp">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Address / Mohalla :</label>
                                <input type="text" id="altc-kar-mohalla" placeholder="Mohalla / City" class="kexp-inp">
                            </div>
                        </div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Join Date :</label>
                            <input type="date" id="altc-kar-date" value="${today}" class="kexp-inp">
                        </div>

                        <div class="kexp-sec-title">2. Taana &amp; Chukka Setup (Tani 1)</div>
                        <div style="display:grid; grid-template-columns:1.4fr 1fr 0.8fr 0.8fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Tani Item :</label>
                                <input type="text" id="altc-tani-item" placeholder="Select Tani..." autocomplete="off" class="kexp-inp" style="font-size:12px;">
                                <datalist id="altc-tani-dl">${taniOpts}</datalist>
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Sancha Maker :</label>
                                <input type="text" id="altc-tani-sancha" placeholder="Select Maker..." autocomplete="off" class="kexp-inp" style="font-size:12px;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="altc-tani-wazan" placeholder="0.00" class="kexp-inp kexp-inp-num" style="font-size:12px;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Tani Saree :</label>
                                <input type="number" id="altc-tani-pcs" placeholder="0" class="kexp-inp kexp-inp-num" style="font-size:12px;">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1.4fr 1fr 0.8fr 0.8fr; gap:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Chukka Item :</label>
                                <input type="text" id="altc-chukka-item" placeholder="Select Chukka..." autocomplete="off" class="kexp-inp" style="font-size:12px;">
                                <datalist id="altc-chukka-dl">${chukkaOpts}</datalist>
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Chukka Maker :</label>
                                <input type="text" id="altc-chukka-sancha" placeholder="Select Maker..." autocomplete="off" class="kexp-inp" style="font-size:12px;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="altc-chukka-wazan" placeholder="0.00" class="kexp-inp kexp-inp-num" style="font-size:12px;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Chukka Pcs :</label>
                                <input type="number" id="altc-chukka-pcs" placeholder="0" class="kexp-inp kexp-inp-num" style="font-size:12px;">
                            </div>
                        </div>

                        <div class="kexp-sec-title">3. Mazdoori &amp; Consumption Rates</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Bani Rate (₹/Saree) :</label>
                                <input type="number" id="altc-rate-bani" placeholder="0" class="kexp-inp kexp-inp-num">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Bana Rate (Kg/Saree) :</label>
                                <input type="number" step="0.001" id="altc-rate-bana" placeholder="0.000" class="kexp-inp kexp-inp-num">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Zari Rate (Kg/Saree) :</label>
                                <input type="number" step="0.001" id="altc-rate-zari" placeholder="0.000" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>

                        <div class="kexp-sec-title">4. Tani Ke 8 Colors (Optional)</div>
                        <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; margin-bottom:6px;">
                            <input type="text" id="altc-col-1" placeholder="1. Rani" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-2" placeholder="2. Lal" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-3" placeholder="3. Mehendi" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-4" placeholder="4. Blue" class="kexp-inp" style="font-size:12px;">
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px;">
                            <input type="text" id="altc-col-5" placeholder="5. Peela" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-6" placeholder="6. Wine" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-7" placeholder="7. Firozi" class="kexp-inp" style="font-size:12px;">
                            <input type="text" id="altc-col-8" placeholder="8. Mungia" class="kexp-inp" style="font-size:12px;">
                        </div>

                        <!-- Tally Accept? (Yes / No) Confirmation Bar -->
                        <div id="altc-accept-strip" class="kexp-accept-bar" style="display:none;">
                            <span style="font-size:13px; font-weight:800; color:#1f2937;">Accept? Naya Kariger Save Karein?</span>
                            <div style="display:flex; gap:8px;">
                                <button type="button" id="altc-accept-yes" class="kexp-btn-save" style="padding:5px 14px;" onclick="saveAltCKariger()">Yes [Y / Enter]</button>
                                <button type="button" id="altc-accept-no" class="kexp-btn-sec" style="padding:5px 14px;" onclick="window.__altcCancelAccept()">No [N / Esc]</button>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT PANE: TALLY CONTEXTUAL LIST / LIVE PREVIEW -->
                    <div class="kexp-right-panel">
                        <div class="kexp-right-head">
                            <span id="altc-right-title">Existing Karigers (Check)</span>
                            <span id="altc-right-hint" style="font-size:11px; color:#6b7280; font-weight:600;">Duplicate Check</span>
                        </div>

                        <div id="altc-right-picker" class="kexp-picker-list"></div>

                        <div id="altc-right-preview" style="display:none; padding:12px; font-size:12.5px; flex:1; overflow-y:auto;"></div>
                    </div>

                </div>

                <div class="kexp-footer">
                    <button type="button" class="kexp-btn-sec" onclick="closeAltCKarigerModal()">Cancel [Esc]</button>
                    <span id="altc-status-msg" style="font-size:12px; font-weight:700;"></span>
                    <button type="button" class="kexp-btn-save" onclick="saveAltCKariger()">Save &amp; Load in Voucher [Ctrl+Enter]</button>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        window.__altcCancelAccept = () => {
            showAltcAcceptPrompt(false);
            document.getElementById('altc-col-8')?.focus();
        };

        const yesBtn = document.getElementById('altc-accept-yes');
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    saveAltCKariger();
                } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    window.__altcCancelAccept();
                }
            });
        }

        const pickerFocusMap = {
            'altc-kar-name': 'dup_kariger',
            'altc-kar-godown': 'karkhana',
            'altc-kar-saree': 'design',
            'altc-tani-item': 'tani',
            'altc-tani-sancha': 'tani_maker',
            'altc-chukka-item': 'chukka',
            'altc-chukka-sancha': 'chukka_maker'
        };

        ALTC_FIELD_ORDER.forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;

            el.addEventListener('focus', () => {
                altcPickerArrowUsed = false;
                altcPickerActiveIdx = 0;
                const mode = pickerFocusMap[fid] || 'preview';
                const qVal = (fid === 'altc-kar-godown') ? '' : el.value;
                showAltCRightPicker(mode, qVal);
            });

            el.addEventListener('input', () => {
                setModalStatus('altc-status-msg', '');
                if (fid === 'altc-kar-godown') {
                    el.removeAttribute('data-kid');
                    altcPickerArrowUsed = el.value.trim() !== '';
                }
                altcPickerActiveIdx = 0;
                const mode = pickerFocusMap[fid] || 'preview';
                showAltCRightPicker(mode, el.value);
            });

            el.addEventListener('keydown', (e) => {
                const mode = pickerFocusMap[fid];
                const isNavList = (
                    mode === 'karkhana' ||
                    mode === 'design' ||
                    mode === 'tani' ||
                    mode === 'tani_maker' ||
                    mode === 'chukka' ||
                    mode === 'chukka_maker'
                );

                if (isNavList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    if (altcPickerItems.length) {
                        e.preventDefault();
                        altcPickerArrowUsed = true;
                        if (e.key === 'ArrowDown') {
                            altcPickerActiveIdx = (altcPickerActiveIdx + 1) % altcPickerItems.length;
                        } else {
                            altcPickerActiveIdx = (altcPickerActiveIdx - 1 + altcPickerItems.length) % altcPickerItems.length;
                        }
                        renderAltCRightPickerList();
                    }
                    return;
                }

                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveAltCField(fid, -1);
                        return;
                    }

                    if (fid === 'altc-kar-godown' && altcPickerArrowUsed && altcPickerItems.length && el.value.trim() !== '') {
                        window.__altcPickItem(altcPickerActiveIdx);
                        return;
                    }

                    if ((
                        fid === 'altc-kar-saree' ||
                        fid === 'altc-tani-item' ||
                        fid === 'altc-tani-sancha' ||
                        fid === 'altc-chukka-item' ||
                        fid === 'altc-chukka-sancha'
                    ) && altcPickerArrowUsed && altcPickerItems.length) {
                        window.__altcPickItem(altcPickerActiveIdx);
                        return;
                    }

                    if (fid === 'altc-col-8') {
                        showAltcAcceptPrompt(true);
                        return;
                    }

                    moveAltCField(fid, 1);
                }
            });
        });

        setTimeout(() => { document.getElementById('altc-kar-name')?.focus(); }, 80);
    };

    window.closeAltCKarigerModal = () => {
        const modal = document.getElementById('alt-c-kariger-modal');
        if (modal) modal.remove();
        document.getElementById('kexp-kariger-input')?.focus();
    };

    window.saveAltCKariger = () => {
        if (isSavingAltC) return;

        const nameInp = document.getElementById('altc-kar-name');
        const name = String(nameInp?.value || '').trim().toUpperCase();
        const saree = String(document.getElementById('altc-kar-saree')?.value || '').trim();
        const mobile = String(document.getElementById('altc-kar-mobile')?.value || '').trim();
        const mohalla = String(document.getElementById('altc-kar-mohalla')?.value || '').trim();
        const joinDate = document.getElementById('altc-kar-date')?.value || getToday();

        const godownObj = getSelectedAltcKarkhanaObj();
        const kGodown = godownObj ? godownObj.id : 'k_main';
        const kGodownName = godownObj ? godownObj.name : 'Main Godown';

        if (!name) {
            showAltcAcceptPrompt(false);
            setModalStatus('altc-status-msg', '⚠️ Kripya naye Kariger ka naam likhein!', true);
            nameInp?.focus();
            return;
        }

        isSavingAltC = true;
        const now = Date.now();
        const newKarigerId = `kar_${now}`;

        // Snapshot for safe rollback
        const snapKarigers = cloneSnap(getFromStore('kariger_list'));
        const snapSanchaItems = cloneSnap(getFromStore('sancha_items'));
        const snapSanchaHist = cloneSnap(getFromStore('sancha_history'));

        try {
            const list = toArray(getFromStore('kariger_list'));
            const newKarObj = {
                id: newKarigerId,
                name: name,
                saree: saree || 'General Saree',
                mobile: mobile,
                mohalla: mohalla,
                date: joinDate,
                karkhanaId: kGodown,
                karkhanaName: kGodownName
            };
            list.push(newKarObj);
            setToStore('kariger_list', list);

            const rateBani = safeNum(document.getElementById('altc-rate-bani')?.value, 0);
            const rateBana = safeNum(document.getElementById('altc-rate-bana')?.value, 0);
            const rateZari = safeNum(document.getElementById('altc-rate-zari')?.value, 0);
            const taniPcs = safeNum(document.getElementById('altc-tani-pcs')?.value, 0);
            const chukkaPcs = safeNum(document.getElementById('altc-chukka-pcs')?.value, 0);

            const taniItem = String(document.getElementById('altc-tani-item')?.value || '').trim();
            const taniSancha = String(document.getElementById('altc-tani-sancha')?.value || '').trim();
            const taniWazan = safeNum(document.getElementById('altc-tani-wazan')?.value, 0);

            const chukkaItem = String(document.getElementById('altc-chukka-item')?.value || '').trim();
            const chukkaSancha = String(document.getElementById('altc-chukka-sancha')?.value || '').trim();
            const chukkaWazan = safeNum(document.getElementById('altc-chukka-wazan')?.value, 0);

            const colors = [];
            for (let i = 1; i <= 8; i++) {
                const cVal = String(document.getElementById(`altc-col-${i}`)?.value || '').trim();
                if (cVal) colors.push(cVal);
            }

            const newSheetObj = {
                id: 'tani_1',
                title: 'Tani 1',
                pichlaBana: 0,
                pichlaZari: 0,
                pichlaBani: 0,
                banaWaste: 0,
                zariWaste: 0,
                rateBana: rateBana,
                rateZari: rateZari,
                rateBani: rateBani,
                taniPcs: taniPcs,
                chukkaPcs: chukkaPcs,
                taniItem: taniItem,
                taniSancha: taniSancha,
                taniWazan: taniWazan,
                chukkaItem: chukkaItem,
                chukkaSancha: chukkaSancha,
                chukkaWazan: chukkaWazan,
                colors: colors,
                note: 'Naya Kariger (Alt+C Mode)',
                rows: []
            };

            const sheets = [newSheetObj];
            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(newKarigerId, sheets);
            } else {
                setToStore(`kariger_sheets_${newKarigerId}`, sheets);
            }

            // Deduct from exact chosen Sancha Maker's stock
            if (taniItem && taniWazan > 0) {
                deductSanchaStockItem(taniItem, 'tani', taniWazan, kGodown, `${newKarigerId}_tani_1_t`, name, taniSancha);
            }
            if (chukkaItem && chukkaWazan > 0) {
                deductSanchaStockItem(chukkaItem, 'chukka', chukkaWazan, kGodown, `${newKarigerId}_tani_1_c`, name, chukkaSancha);
            }

            if (typeof window.populateKarigersDatalist === 'function') {
                window.populateKarigersDatalist();
            }
            refreshUnderlyingERPViews(newKarigerId);

            closeAltCKarigerModal();

            const kInp = document.getElementById('kexp-kariger-input');
            if (kInp) kInp.value = name;

            selectedKariger = newKarObj;
            currentActiveSheet = newSheetObj;
            activeSheetIndex = 0;

            renderKarigerExpressTaniTabs();
            updateWeaverBannerSnapshot(true);
            calculateKarigerExpressLive();
            showRightPicker('summary', '');

            setExpressStatus(`✅ Naya Kariger [${esc(name)}] Tani 1 (${taniPcs} Pcs) ke sath Voucher me load ho gaya!`, '#15803d');
            console.log(`✅ Naya Kariger [${name}] Tani 1 (${taniPcs} Pcs) ke sath ban gaya aur Voucher me load ho gaya!`);

            setTimeout(() => {
                const sareeInp = document.getElementById('kexp-saree-qty');
                if (sareeInp) sareeInp.focus();
            }, 100);
        } catch (err) {
            console.error('[Alt+C Save Failed]', err);
            setToStore('kariger_list', snapKarigers);
            setToStore('sancha_items', snapSanchaItems);
            setToStore('sancha_history', snapSanchaHist);
            try { localStorage.removeItem(`kariger_sheets_${newKarigerId}`); } catch (_) {}
            if (typeof window.invalidateSanchaCalcCache === 'function') window.invalidateSanchaCalcCache();
            setModalStatus('altc-status-msg', '❌ Save fail hua — data rollback kar diya gaya!', true);
        } finally {
            isSavingAltC = false;
        }
    };

    /* ========================================================================
       7. NAYI TANI MODAL (2-COLUMN TALLY WHITE & GOLD WITH ITEM + MAKER PICKER)
       ------------------------------------------------------------------------
    ======================================================================== */
    const NTANI_FIELD_ORDER = [
        'ntani-tani-item',
        'ntani-tani-sancha',
        'ntani-tani-wazan',
        'ntani-tani-pcs',
        'ntani-rate-bani',
        'ntani-rate-bana',
        'ntani-rate-zari'
    ];

    const moveNtaniField = (currentId, dir) => {
        const idx = NTANI_FIELD_ORDER.indexOf(currentId);
        if (idx === -1) return;
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < NTANI_FIELD_ORDER.length) {
            const el = document.getElementById(NTANI_FIELD_ORDER[nextIdx]);
            if (el) {
                el.focus();
                if (typeof el.select === 'function') el.select();
            }
        }
    };

    const showNtaniRightPicker = (mode, queryText) => {
        ntaniPickerMode = mode;
        const pickerEl = document.getElementById('ntani-right-picker');
        const previewEl = document.getElementById('ntani-right-preview');
        const titleEl = document.getElementById('ntani-right-title');
        const hintEl = document.getElementById('ntani-right-hint');
        if (!pickerEl || !previewEl) return;

        if (mode === 'preview') {
            pickerEl.style.display = 'none';
            previewEl.style.display = 'block';
            if (titleEl) titleEl.textContent = 'Carry Forward & Tani Summary';
            if (hintEl) hintEl.textContent = 'Preview';
            return;
        }

        pickerEl.style.display = 'block';
        previewEl.style.display = 'none';
        const kGodown = selectedKariger ? (selectedKariger.karkhanaId || 'k_main') : 'k_main';

        if (mode === 'tani_maker') {
            const selItem = String(document.getElementById('ntani-tani-item')?.value || '').trim();
            if (titleEl) titleEl.textContent = selItem ? `Tani Makers (${selItem})` : 'List of Tani Makers';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const list = getSanchaMakerList('tani', kGodown, selItem, queryText);
            ntaniPickerItems = list.map(m => ({
                label: m.name,
                sub: m.bacha > 0 ? `${m.bacha.toFixed(2)} Kg` : 'Maker',
                data: m.name
            }));
        } else {
            if (titleEl) titleEl.textContent = 'List of Tani Items';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const selMaker = normPerson(document.getElementById('ntani-tani-sancha')?.value);
            const list = getSanchaStockList('tani', kGodown, queryText, selMaker);
            ntaniPickerItems = list.map(item => ({
                label: item.name,
                sub: `${item.bacha.toFixed(2)} Kg`,
                data: item.name
            }));
        }

        if (ntaniPickerActiveIdx >= ntaniPickerItems.length) ntaniPickerActiveIdx = 0;
        if (ntaniPickerActiveIdx < 0) ntaniPickerActiveIdx = 0;
        renderNtaniRightPickerList();
    };

    const renderNtaniRightPickerList = () => {
        const pickerEl = document.getElementById('ntani-right-picker');
        if (!pickerEl) return;

        if (!ntaniPickerItems.length) {
            const msg = ntaniPickerMode === 'tani_maker'
                ? 'Koi Maker nahi mila — naya Maker naam type karke [Enter] dabayein.'
                : 'Is Godam me koi Tani stock item nahi mila.';
            pickerEl.innerHTML = `<div style="padding:18px 12px; text-align:center; color:#6b7280; font-size:12px;">${msg}</div>`;
            return;
        }

        let html = '';
        ntaniPickerItems.forEach((item, idx) => {
            const cls = idx === ntaniPickerActiveIdx ? 'kexp-picker-item active' : 'kexp-picker-item';
            html += `<div class="${cls}" onmousedown="event.preventDefault(); window.__ntaniPickItem(${idx})">
                <span>${esc(item.label)}</span>
                <span class="kexp-picker-sub">${esc(item.sub)}</span>
            </div>`;
        });
        pickerEl.innerHTML = html;

        const activeEl = pickerEl.querySelector('.kexp-picker-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    };

    window.__ntaniPickItem = (idx) => {
        const item = ntaniPickerItems[idx];
        if (!item) return;
        if (ntaniPickerMode === 'tani_maker') {
            const inp = document.getElementById('ntani-tani-sancha');
            if (inp) inp.value = item.data;
            moveNtaniField('ntani-tani-sancha', 1);
        } else {
            const inp = document.getElementById('ntani-tani-item');
            if (inp) inp.value = item.data;
            moveNtaniField('ntani-tani-item', 1);
        }
    };

    window.openExpressNewTaniModal = () => {
        ensureTallyExpressStyles();
        if (!selectedKariger || !currentActiveSheet) {
            setExpressStatus('⚠️ Pehle koi Kariger chunein!', '#dc2626');
            document.getElementById('kexp-kariger-input')?.focus();
            return;
        }

        const existing = document.getElementById('express-new-tani-modal');
        if (existing) existing.remove();

        isSavingNtani = false;
        ntaniPickerMode = 'tani';
        ntaniPickerItems = [];
        ntaniPickerActiveIdx = 0;
        ntaniPickerArrowUsed = false;

        const { taniOpts } = getKarigerExpressDatalists();
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        const nextNum = getNextTaniNumber(sheets);

        const calc = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(currentActiveSheet)
            : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

        const pBana = safeNum(calc.remainingBana);
        const pZari = safeNum(calc.remainingZari);
        const pBani = safeNum(calc.remainingAmt);
        ntaniSaveParams = { nextNum, pBana, pZari, pBani };

        const modalHtml = `
        <div id="express-new-tani-modal" class="kexp-overlay" style="z-index:1000005;">
            <div class="kexp-card" style="max-width:860px;">

                <div class="kexp-header">
                    <div>
                        <h3 class="kexp-title">Nayi Tani Chadhayein &bull; Tani ${nextNum} (${esc(selectedKariger.name)})</h3>
                        <span style="font-size:11px; color:#6b7280;">[Enter] Next &bull; [Shift+Enter] Prev &bull; [&uarr;&darr;] Select List &bull; [Ctrl+Enter] Save &bull; [Esc] Close</span>
                    </div>
                    <button type="button" class="kexp-pill-btn" onclick="closeExpressNewTaniModal()">&larr; [Esc] Close</button>
                </div>

                <div class="kexp-body">

                    <!-- LEFT PANE -->
                    <div>
                        <div class="kexp-sec-title" style="margin-top:0;">Naya Taana / Sancha Details</div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Tani Item :</label>
                            <input type="text" id="ntani-tani-item" placeholder="Select Tani Item..." autocomplete="off" class="kexp-inp" style="border-color:#d9a425;">
                            <datalist id="ntani-tani-dl">${taniOpts}</datalist>
                        </div>
                        <div class="kexp-row">
                            <label class="kexp-lbl">Sancha Maker :</label>
                            <input type="text" id="ntani-tani-sancha" placeholder="Select Sancha Maker..." autocomplete="off" class="kexp-inp">
                        </div>
                        <div class="kexp-row-2">
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Wazan (Kg) :</label>
                                <input type="number" step="0.01" id="ntani-tani-wazan" placeholder="0.00" class="kexp-inp kexp-inp-num">
                            </div>
                            <div class="kexp-mini-row">
                                <label class="kexp-lbl">Target Pcs :</label>
                                <input type="number" id="ntani-tani-pcs" placeholder="0" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>

                        <div class="kexp-sec-title">Mazdoori Rates</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Bani (₹/Saree) :</label>
                                <input type="number" id="ntani-rate-bani" placeholder="0" class="kexp-inp kexp-inp-num">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Bana Rate :</label>
                                <input type="number" step="0.001" id="ntani-rate-bana" placeholder="0.000" class="kexp-inp kexp-inp-num">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:700; color:#374151;">Zari Rate :</label>
                                <input type="number" step="0.001" id="ntani-rate-zari" placeholder="0.000" class="kexp-inp kexp-inp-num">
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT PANE -->
                    <div class="kexp-right-panel" style="min-height:260px;">
                        <div class="kexp-right-head">
                            <span id="ntani-right-title">List of Tani Items</span>
                            <span id="ntani-right-hint" style="font-size:11px; color:#6b7280; font-weight:600;">&uarr;&darr; + Enter</span>
                        </div>
                        <div id="ntani-right-picker" class="kexp-picker-list"></div>
                        <div id="ntani-right-preview" style="display:none; padding:12px; font-size:12.5px;">
                            <div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:8px;">Carry Forward from Previous Tani</div>
                            <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f3f4f6;">
                                <span style="color:#6b7280;">Bacha Bana:</span><strong>+${pBana.toFixed(2)} Kg</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f3f4f6;">
                                <span style="color:#6b7280;">Bachi Zari:</span><strong>+${pZari.toFixed(2)} Kg</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:5px 0;">
                                <span style="color:#6b7280;">Baki Rupya:</span><strong style="color:#b47d00;">₹ ${pBani.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="kexp-footer">
                    <button type="button" class="kexp-btn-sec" onclick="closeExpressNewTaniModal()">Cancel [Esc]</button>
                    <span id="ntani-status-msg" style="font-size:12px; font-weight:700;"></span>
                    <button type="button" class="kexp-btn-save" onclick="saveExpressNewTani(${nextNum}, ${pBana}, ${pZari}, ${pBani})">Tani ${nextNum} Chadhayein [Save]</button>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        NTANI_FIELD_ORDER.forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;

            const pickerKind = (fid === 'ntani-tani-item')
                ? 'tani'
                : (fid === 'ntani-tani-sancha' ? 'tani_maker' : 'preview');

            el.addEventListener('focus', () => {
                ntaniPickerArrowUsed = false;
                ntaniPickerActiveIdx = 0;
                showNtaniRightPicker(pickerKind, el.value);
            });

            if (pickerKind !== 'preview') {
                el.addEventListener('input', () => {
                    setModalStatus('ntani-status-msg', '');
                    ntaniPickerActiveIdx = 0;
                    showNtaniRightPicker(pickerKind, el.value);
                });
            }

            el.addEventListener('keydown', (e) => {
                if (pickerKind !== 'preview' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    if (ntaniPickerItems.length) {
                        e.preventDefault();
                        ntaniPickerArrowUsed = true;
                        if (e.key === 'ArrowDown') {
                            ntaniPickerActiveIdx = (ntaniPickerActiveIdx + 1) % ntaniPickerItems.length;
                        } else {
                            ntaniPickerActiveIdx = (ntaniPickerActiveIdx - 1 + ntaniPickerItems.length) % ntaniPickerItems.length;
                        }
                        renderNtaniRightPickerList();
                    }
                    return;
                }

                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveNtaniField(fid, -1);
                        return;
                    }
                    if (pickerKind !== 'preview' && ntaniPickerArrowUsed && ntaniPickerItems.length) {
                        window.__ntaniPickItem(ntaniPickerActiveIdx);
                        return;
                    }
                    if (fid === 'ntani-rate-zari') {
                        saveExpressNewTani(nextNum, pBana, pZari, pBani);
                        return;
                    }
                    moveNtaniField(fid, 1);
                }
            });
        });

        setTimeout(() => { document.getElementById('ntani-tani-item')?.focus(); }, 80);
    };

    window.closeExpressNewTaniModal = () => {
        const modal = document.getElementById('express-new-tani-modal');
        if (modal) modal.remove();
        document.getElementById('kexp-saree-qty')?.focus();
    };

    window.saveExpressNewTani = (nextNum, pBana, pZari, pBani) => {
        if (isSavingNtani) return;
        if (!selectedKariger || !currentActiveSheet) {
            setModalStatus('ntani-status-msg', '⚠️ Kariger select nahi hai!', true);
            return;
        }

        isSavingNtani = true;
        const kId = selectedKariger.id;
        const kGodown = selectedKariger.karkhanaId || 'k_main';

        // Snapshot for safe rollback
        const snapSheets = cloneSnap(typeof window.getKarigerSheets === 'function' ? window.getKarigerSheets(kId) : getFromStore(`kariger_sheets_${kId}`));
        const snapSanchaItems = cloneSnap(getFromStore('sancha_items'));
        const snapSanchaHist = cloneSnap(getFromStore('sancha_history'));

        try {
            const taniItem = String(document.getElementById('ntani-tani-item')?.value || '').trim();
            const taniSancha = String(document.getElementById('ntani-tani-sancha')?.value || '').trim();
            const taniWazan = safeNum(document.getElementById('ntani-tani-wazan')?.value, 0);
            const taniPcs = safeNum(document.getElementById('ntani-tani-pcs')?.value, 0);

            const rateBani = safeNum(document.getElementById('ntani-rate-bani')?.value, 0);
            const rateBana = safeNum(document.getElementById('ntani-rate-bana')?.value, 0);
            const rateZari = safeNum(document.getElementById('ntani-rate-zari')?.value, 0);

            const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];

            const newSheetObj = {
                id: `tani_${nextNum}`,
                title: `Tani ${nextNum}`,
                pichlaBana: pBana,
                pichlaZari: pZari,
                pichlaBani: pBani,
                banaWaste: 0,
                zariWaste: 0,
                rateBana: rateBana,
                rateZari: rateZari,
                rateBani: rateBani,
                taniPcs: taniPcs,
                chukkaPcs: safeNum(currentActiveSheet.chukkaPcs, 0),
                taniItem: taniItem,
                taniSancha: taniSancha,
                taniWazan: taniWazan,
                chukkaItem: currentActiveSheet.chukkaItem || '',
                chukkaSancha: currentActiveSheet.chukkaSancha || '',
                chukkaWazan: 0,
                colors: Array.isArray(currentActiveSheet.colors) ? [...currentActiveSheet.colors] : [],
                note: `Tani ${nextNum} (Kariger Express Mode)`,
                rows: []
            };

            sheets.push(newSheetObj);
            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(kId, sheets);
            } else {
                setToStore(`kariger_sheets_${kId}`, sheets);
            }

            // Deduct from exact chosen Sancha Maker's stock
            if (taniItem && taniWazan > 0) {
                deductSanchaStockItem(taniItem, 'tani', taniWazan, kGodown, `${kId}_tani_${nextNum}_t`, selectedKariger.name, taniSancha);
            }

            refreshUnderlyingERPViews(kId);
            closeExpressNewTaniModal();

            activeSheetIndex = sheets.length - 1;
            currentActiveSheet = newSheetObj;

            renderKarigerExpressTaniTabs();
            updateWeaverBannerSnapshot(true);
            calculateKarigerExpressLive();
            showRightPicker('summary', '');

            setExpressStatus(`✅ Tani ${nextNum} safalta-poorvak shuru ho gayi! Pichla hisab carry-forward ho gaya.`, '#15803d');
            console.log(`✅ Tani ${nextNum} safalta-poorvak shuru ho gayi! Pichla hisab carry-forward ho gaya.`);
        } catch (err) {
            console.error('[New Tani Save Failed]', err);
            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(kId, snapSheets);
            } else {
                setToStore(`kariger_sheets_${kId}`, snapSheets);
            }
            setToStore('sancha_items', snapSanchaItems);
            setToStore('sancha_history', snapSanchaHist);
            if (typeof window.invalidateSanchaCalcCache === 'function') window.invalidateSanchaCalcCache();
            setModalStatus('ntani-status-msg', '❌ Save fail hua — data rollback kar diya gaya!', true);
        } finally {
            isSavingNtani = false;
        }
    };

    /* ========================================================================
       8. ZERO-MOUSE KEYBOARD CHAINING, PICKER NAV & SHORTCUT LISTENERS
       ------------------------------------------------------------------------
    ======================================================================== */
    const FIELD_ORDER = [
        'kexp-date',
        'kexp-kariger-input',
        'kexp-saree-qty',
        'kexp-saree-lott',
        'kexp-ret-bana',
        'kexp-ret-zari',
        'kexp-bana-name',
        'kexp-bana-cone',
        'kexp-bana-lesstp',
        'kexp-zari-name',
        'kexp-zari-qty',
        'kexp-zari-topi',
        'kexp-paid-amount'
    ];

    const moveField = (currentId, dir) => {
        const idx = FIELD_ORDER.indexOf(currentId);
        if (idx === -1) return;
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < FIELD_ORDER.length) {
            const el = document.getElementById(FIELD_ORDER[nextIdx]);
            if (el) {
                el.focus();
                if (typeof el.select === 'function') el.select();
            }
        }
    };

    const resetExpressDisplayState = () => {
        selectedKariger = null;
        currentActiveSheet = null;
        activeSheetIndex = 0;
        prevDeliveredSarees = 0;

        const banaInp = document.getElementById('kexp-bana-name');
        const zariInp = document.getElementById('kexp-zari-name');
        if (banaInp) banaInp.value = '';
        if (zariInp) zariInp.value = '';

        renderKarigerExpressTaniTabs();
        const banner = document.getElementById('kexp-weaver-banner');
        if (banner) banner.innerHTML = `<span style="font-size:12px; color:#6b7280;">Kariger chunein — tani ka poora hisab aur colors yahan dikhenge.</span>`;
        const rateEl = document.getElementById('kexp-disp-bani-rate');
        if (rateEl) rateEl.textContent = `₹ 0.00`;
        updateExpressStockBadges();
        calculateKarigerExpressLive();
    };

    const bindKarigerExpressEvents = () => {
        const modal = document.getElementById('kariger-express-modal');
        if (!modal) return;

        const karigerInp = document.getElementById('kexp-kariger-input');
        const banaInp = document.getElementById('kexp-bana-name');
        const zariInp = document.getElementById('kexp-zari-name');
        const paidInp = document.getElementById('kexp-paid-amount');

        setTimeout(() => { if (karigerInp) karigerInp.focus(); }, 100);

        if (karigerInp) {
            karigerInp.addEventListener('focus', () => {
                pickerArrowUsed = false;
                pickerActiveIdx = 0;
                showRightPicker('kariger', karigerInp.value);
            });
            karigerInp.addEventListener('input', () => {
                pickerArrowUsed = false;
                pickerActiveIdx = 0;
                const val = karigerInp.value.trim().toLowerCase();
                showRightPicker('kariger', val);

                const raw = toArray(getFromStore('kariger_list'));
                const k = raw.find(x => x && x.name && x.name.trim().toLowerCase() === val);
                if (k) {
                    applySelectedKariger(k);
                } else {
                    resetExpressDisplayState();
                }
            });
        }

        if (banaInp) {
            banaInp.addEventListener('focus', () => {
                pickerArrowUsed = false;
                pickerActiveIdx = 0;
                showRightPicker('bana', '');
            });
            banaInp.addEventListener('input', () => {
                pickerArrowUsed = banaInp.value.trim() !== '';
                pickerActiveIdx = 0;
                showRightPicker('bana', banaInp.value);
            });
        }

        if (zariInp) {
            zariInp.addEventListener('focus', () => {
                pickerArrowUsed = false;
                pickerActiveIdx = 0;
                showRightPicker('zari', '');
            });
            zariInp.addEventListener('input', () => {
                pickerArrowUsed = zariInp.value.trim() !== '';
                pickerActiveIdx = 0;
                showRightPicker('zari', zariInp.value);
            });
        }

        FIELD_ORDER.forEach((fid) => {
            if (fid === 'kexp-kariger-input' || fid === 'kexp-bana-name' || fid === 'kexp-zari-name') return;
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('focus', () => {
                showRightPicker('summary', '');
            });
        });

        FIELD_ORDER.forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;

            el.addEventListener('keydown', (e) => {
                if ((fid === 'kexp-kariger-input' || fid === 'kexp-bana-name' || fid === 'kexp-zari-name') &&
                    (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    if (pickerItems.length) {
                        e.preventDefault();
                        pickerArrowUsed = true;
                        if (e.key === 'ArrowDown') {
                            pickerActiveIdx = (pickerActiveIdx + 1) % pickerItems.length;
                        } else {
                            pickerActiveIdx = (pickerActiveIdx - 1 + pickerItems.length) % pickerItems.length;
                        }
                        renderRightPickerList();
                    }
                    return;
                }

                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        moveField(fid, -1);
                        return;
                    }

                    if (fid === 'kexp-kariger-input') {
                        const typedLower = karigerInp.value.trim().toLowerCase();
                        const exactAlreadySelected = !pickerArrowUsed && selectedKariger &&
                            String(selectedKariger.name || '').trim().toLowerCase() === typedLower;

                        if (!exactAlreadySelected && pickerItems.length && (pickerArrowUsed || typedLower !== '' || !selectedKariger)) {
                            window.__kexpPickItem(pickerActiveIdx);
                            return;
                        }
                    }

                    if ((fid === 'kexp-bana-name' || fid === 'kexp-zari-name') && pickerArrowUsed && pickerItems.length && el.value.trim() !== '') {
                        window.__kexpPickItem(pickerActiveIdx);
                        return;
                    }

                    if (fid === 'kexp-paid-amount') {
                        submitKarigerExpress();
                        return;
                    }

                    moveField(fid, 1);
                }
            });
        });

        if (paidInp) {
            paidInp.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    submitKarigerExpress();
                }
            });
        }

        window.removeEventListener('keydown', handleKarigerExpressKeydown, true);
        window.addEventListener('keydown', handleKarigerExpressKeydown, true);
    };

    const handleKarigerExpressKeydown = (e) => {
        const modal = document.getElementById('kariger-express-modal');
        if (!modal || modal.style.display === 'none') return;

        // If Alt+C modal is open
        const altCModal = document.getElementById('alt-c-kariger-modal');
        if (altCModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                const acceptBar = document.getElementById('altc-accept-strip');
                if (acceptBar && acceptBar.style.display !== 'none') {
                    showAltcAcceptPrompt(false);
                    document.getElementById('altc-col-8')?.focus();
                } else {
                    closeAltCKarigerModal();
                }
                return;
            }
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                saveAltCKariger();
                return;
            }
            return;
        }

        // If New Tani modal is open
        const newTaniModal = document.getElementById('express-new-tani-modal');
        if (newTaniModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeExpressNewTaniModal();
                return;
            }
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                saveExpressNewTani(ntaniSaveParams.nextNum, ntaniSaveParams.pBana, ntaniSaveParams.pZari, ntaniSaveParams.pBani);
                return;
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeKarigerExpressModal();
            return;
        }

        if (e.altKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openAltCKarigerModal();
            return;
        }

        if (e.altKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openExpressNewTaniModal();
            return;
        }

        if (e.key === 'F2') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const inp = document.getElementById('kexp-kariger-input');
            if (inp) { inp.focus(); inp.select(); }
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            printLastSavedExpressSlip();
            return;
        }

        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();
            submitKarigerExpress();
            return;
        }

        if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
            if (document.activeElement?.id !== 'kexp-kariger-input') {
                e.preventDefault();
                e.stopImmediatePropagation();
                submitKarigerExpress();
                return;
            }
        }
    };

    window.closeKarigerExpressModal = () => {
        window.removeEventListener('keydown', handleKarigerExpressKeydown, true);
        const modal = document.getElementById('kariger-express-modal');
        if (modal) modal.remove();
        selectedKariger = null;
        currentActiveSheet = null;
        isSubmittingExpress = false;
        isSavingAltC = false;
        isSavingNtani = false;
    };

    // Live Calculation
    window.calculateKarigerExpressLive = () => {
        const saree = safeNum(document.getElementById('kexp-saree-qty')?.value);
        const lott = safeNum(document.getElementById('kexp-saree-lott')?.value);
        const paid = safeNum(document.getElementById('kexp-paid-amount')?.value);

        const rateBani = getSheetRateBani(currentActiveSheet);

        let pichlaAmt = 0;
        if (currentActiveSheet && typeof window.calculateSheetTotals === 'function') {
            pichlaAmt = safeNum(window.calculateSheetTotals(currentActiveSheet).remainingAmt);
        }

        const netSaree = Math.max(0, saree - lott);
        const grossBani = netSaree * rateBani;
        const netRemaining = (pichlaAmt + grossBani) - paid;

        const dispGross = document.getElementById('kexp-disp-gross-bani');
        const dispNet = document.getElementById('kexp-disp-net-balance');

        if (dispGross) dispGross.textContent = `₹ ${grossBani.toFixed(2)}`;
        if (dispNet) {
            dispNet.textContent = `₹ ${netRemaining.toFixed(2)}`;
            dispNet.style.color = netRemaining > 0 ? '#b47d00' : '#1f2937';
        }

        const progEl = document.getElementById('kexp-live-tani-progress');
        if (progEl && currentActiveSheet) {
            const totalTaniTarget = safeNum(currentActiveSheet.taniPcs, 0);
            const liveTotalDelivered = prevDeliveredSarees + saree;
            const liveRemainingOnLoom = Math.max(0, totalTaniTarget - liveTotalDelivered);
            progEl.innerHTML = `Tani: <strong>${totalTaniTarget} Pcs</strong> &bull; Aayi: <strong>${liveTotalDelivered}</strong> &bull; Baki: <strong style="color:#b47d00;">${liveRemainingOnLoom} Pcs</strong>`;
        }
    };

    window.updateExpressStockBadges = () => {
        const kGodown = selectedKariger ? (selectedKariger.karkhanaId || 'k_main') : 'k_main';
        const bName = String(document.getElementById('kexp-bana-name')?.value || '').trim();
        const zName = String(document.getElementById('kexp-zari-name')?.value || '').trim();

        const bBacha = getBanaStockBacha(bName, kGodown);
        const zBacha = getZariStockBacha(zName, kGodown);

        const bBadge = document.getElementById('kexp-live-bana-badge');
        const zBadge = document.getElementById('kexp-live-zari-badge');

        if (bBadge) bBadge.textContent = `Bacha: ${bBacha.toFixed(2)} Kg`;
        if (zBadge) zBadge.textContent = `Bacha: ${zBacha.toFixed(2)} Kg`;
    };

    /* ========================================================================
       9. ATOMIC SUBMIT & AUTO-TANI COMPLETE ROLLOVER ENGINE (WITH ROLLBACK)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.submitKarigerExpress = () => {
        if (isSubmittingExpress) return;

        if (!selectedKariger) {
            setExpressStatus('⚠️ Kripya Kariger ka sahi naam chunein (ya Alt+C se naya banayein)!', '#dc2626');
            document.getElementById('kexp-kariger-input')?.focus();
            return;
        }

        const kId = selectedKariger.id;
        const kName = selectedKariger.name;
        const sDesign = selectedKariger.saree || 'General Saree';
        const kGodown = selectedKariger.karkhanaId || 'k_main';
        const date = document.getElementById('kexp-date')?.value || getToday();

        const bCone = safeNum(document.getElementById('kexp-bana-cone')?.value);
        const bLess = safeNum(document.getElementById('kexp-bana-lesstp')?.value);
        const zQty = safeNum(document.getElementById('kexp-zari-qty')?.value);
        const topi = safeNum(document.getElementById('kexp-zari-topi')?.value);

        const saree = safeNum(document.getElementById('kexp-saree-qty')?.value);
        const lott = safeNum(document.getElementById('kexp-saree-lott')?.value);
        const paid = safeNum(document.getElementById('kexp-paid-amount')?.value);
        const retB = safeNum(document.getElementById('kexp-ret-bana')?.value);
        const retZ = safeNum(document.getElementById('kexp-ret-zari')?.value);

        const banaItemName = String(document.getElementById('kexp-bana-name')?.value || '').trim();
        const zariItemName = String(document.getElementById('kexp-zari-name')?.value || '').trim();

        if (saree === 0 && lott === 0 && bCone === 0 && zQty === 0 && paid === 0 && retB === 0 && retZ === 0) {
            setExpressStatus('⚠️ Kam se kam ek entry (Saree, Bana, Zari ya Payment) bharein!', '#dc2626');
            document.getElementById('kexp-saree-qty')?.focus();
            return;
        }

        isSubmittingExpress = true;

        // SNAPSHOT FOR ATOMIC ROLLBACK
        const snapSaree = cloneSnap(getFromStore('saree_history'));
        const snapBana = cloneSnap(getFromStore('bana_history'));
        const snapZari = cloneSnap(getFromStore('zari_history'));
        const snapPay = cloneSnap(getFromStore('payment_history'));
        const snapSheets = cloneSnap(typeof window.getKarigerSheets === 'function' ? window.getKarigerSheets(kId) : getFromStore(`kariger_sheets_${kId}`));

        let saveSucceeded = false;

        try {
            const nBana = Math.max(0, bCone - bLess);
            const nZari = Math.max(0, zQty - topi);
            const rowId = `row_${Date.now()}`;

            let sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];
            if (!sheets || !sheets.length) {
                sheets = [{
                    id: 'tani_1', title: 'Tani 1',
                    pichlaBana: 0, pichlaZari: 0, pichlaBani: 0,
                    banaWaste: 0, zariWaste: 0,
                    rateBana: 0, rateZari: 0, rateBani: 0,
                    taniPcs: 0, chukkaPcs: 0, colors: [],
                    note: '', rows: []
                }];
            }

            const targetIdx = (activeSheetIndex >= 0 && activeSheetIndex < sheets.length) ? activeSheetIndex : (sheets.length - 1);
            const activeSheet = sheets[targetIdx];
            if (banaItemName) activeSheet.banaItem = banaItemName;
            if (zariItemName) activeSheet.zariItem = zariItemName;

            const rowObj = {
                id: rowId,
                date: date,
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

            if (!activeSheet.rows) activeSheet.rows = [];
            activeSheet.rows.push(rowObj);

            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(kId, sheets);
            } else {
                setToStore(`kariger_sheets_${kId}`, sheets);
            }

            const freshSaree = Math.max(0, saree - lott);
            let sHist = toArray(getFromStore('saree_history'));

            if (freshSaree > 0) {
                sHist.push({
                    id: `saree_${Date.now()}_f`,
                    refId: rowId,
                    date: date,
                    sareeName: sDesign,
                    karigerName: kName,
                    kariger: kName,
                    partyName: kName,
                    karkhanaId: kGodown,
                    type: 'fresh',
                    typeLabel: 'Fresh Saree (Kariger Sheet)',
                    aai: freshSaree,
                    gai: 0,
                    isOut: false,
                    timestamp: Date.now()
                });
            }
            if (lott > 0) {
                sHist.push({
                    id: `saree_${Date.now()}_l`,
                    refId: rowId,
                    date: date,
                    sareeName: sDesign,
                    karigerName: kName,
                    kariger: kName,
                    partyName: kName,
                    karkhanaId: kGodown,
                    type: 'lott',
                    typeLabel: 'Lott Saree (Kariger Sheet)',
                    aai: lott,
                    gai: 0,
                    isOut: false,
                    timestamp: Date.now() + 1
                });
            }
            setToStore('saree_history', sHist);

            if (banaItemName && (nBana > 0 || retB > 0)) {
                const bHist = toArray(getFromStore('bana_history'));
                bHist.push({
                    id: `bhist_${Date.now()}`,
                    refId: rowId,
                    date: date,
                    name: banaItemName,
                    kariger: kName,
                    type: 'Kariger Issue',
                    aaya: retB > 0 ? retB : 0,
                    gaya: nBana > 0 ? nBana : 0,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
                setToStore('bana_history', bHist);
            }

            if (zariItemName && (nZari > 0 || retZ > 0)) {
                const zHist = toArray(getFromStore('zari_history'));
                zHist.push({
                    id: `zhist_${Date.now()}`,
                    refId: rowId,
                    date: date,
                    name: zariItemName,
                    kariger: kName,
                    type: 'Kariger Issue',
                    aaya: retZ > 0 ? retZ : 0,
                    gaya: nZari > 0 ? nZari : 0,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
                setToStore('zari_history', zHist);
            }

            if (paid > 0) {
                const payList = toArray(getFromStore('payment_history'));
                payList.push({
                    id: `pay_${Date.now()}`,
                    date: date,
                    party: kName,
                    type: 'कारीगर मजदूरी',
                    amount: paid,
                    mode: 'Cash',
                    timestamp: Date.now()
                });
                setToStore('payment_history', payList);
            }

            const totalsAfter = (typeof window.calculateSheetTotals === 'function')
                ? window.calculateSheetTotals(activeSheet)
                : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

            const targetTaniPcs = safeNum(activeSheet.taniPcs, 0);
            const deliveredSoFar = safeNum(totalsAfter.totSaree);
            const isLastSheet = (targetIdx === sheets.length - 1);

            // AUTO-TANI COMPLETE & ROLLOVER TRIGGER (ONLY ON LATEST SHEET)
            let isTaniCompleted = false;
            let completedTaniTitle = activeSheet.title;
            let nextTaniTitle = '';
            let pBana = 0, pZari = 0, pBani = 0;

            if (isLastSheet && targetTaniPcs > 0 && deliveredSoFar >= targetTaniPcs) {
                isTaniCompleted = true;
                const nextNum = getNextTaniNumber(sheets);
                nextTaniTitle = `Tani ${nextNum}`;

                pBana = safeNum(totalsAfter.remainingBana);
                pZari = safeNum(totalsAfter.remainingZari);
                pBani = safeNum(totalsAfter.remainingAmt);

                const autoNewSheet = {
                    id: `tani_${nextNum}`,
                    title: nextTaniTitle,
                    pichlaBana: pBana,
                    pichlaZari: pZari,
                    pichlaBani: pBani,
                    banaWaste: 0,
                    zariWaste: 0,
                    rateBana: safeNum(activeSheet.rateBana, 0),
                    rateZari: safeNum(activeSheet.rateZari, 0),
                    rateBani: safeNum(activeSheet.rateBani, 0),
                    taniPcs: targetTaniPcs,
                    chukkaPcs: safeNum(activeSheet.chukkaPcs, 0),
                    taniItem: activeSheet.taniItem || '',
                    taniSancha: activeSheet.taniSancha || '',
                    taniWazan: 0,
                    chukkaItem: activeSheet.chukkaItem || '',
                    chukkaSancha: activeSheet.chukkaSancha || '',
                    chukkaWazan: 0,
                    colors: Array.isArray(activeSheet.colors) ? [...activeSheet.colors] : [],
                    note: `Auto Rollover: ${completedTaniTitle} (${targetTaniPcs} Saree Poori Hui)`,
                    rows: []
                };

                sheets.push(autoNewSheet);

                if (typeof window.saveKarigerSheets === 'function') {
                    window.saveKarigerSheets(kId, sheets);
                } else {
                    setToStore(`kariger_sheets_${kId}`, sheets);
                }

                activeSheetIndex = sheets.length - 1;
                currentActiveSheet = autoNewSheet;
            }

            lastSavedTransaction = {
                karigerName: kName,
                sDesign: sDesign,
                kGodown: kGodown,
                date: date,
                taniTitle: completedTaniTitle,
                sanchaMaker: activeSheet.taniSancha || 'N/A',
                taniPcs: targetTaniPcs,
                deliveredSarees: deliveredSoFar,
                colors: activeSheet.colors || [],
                saree: saree,
                lott: lott,
                netBana: nBana,
                banaItem: banaItemName,
                netZari: nZari,
                zariItem: zariItemName,
                retBana: retB,
                retZari: retZ,
                paid: paid,
                netRemaining: safeNum(totalsAfter.remainingAmt),
                isTaniCompleted: isTaniCompleted,
                nextTaniTitle: nextTaniTitle
            };

            refreshUnderlyingERPViews(kId);

            document.getElementById('kexp-saree-qty').value = '';
            document.getElementById('kexp-saree-lott').value = '';
            document.getElementById('kexp-ret-bana').value = '';
            document.getElementById('kexp-ret-zari').value = '';
            document.getElementById('kexp-bana-cone').value = '';
            document.getElementById('kexp-bana-lesstp').value = '';
            document.getElementById('kexp-zari-qty').value = '';
            document.getElementById('kexp-zari-topi').value = '';
            document.getElementById('kexp-paid-amount').value = '';

            if (isTaniCompleted) {
                setExpressStatus(
                    `🎉 ${esc(kName)} ki ${esc(completedTaniTitle)} (${targetTaniPcs} Pcs) poori! ${esc(nextTaniTitle)} shuru (Bana +${pBana.toFixed(2)} Kg, Zari +${pZari.toFixed(2)} Kg, Baki ₹${pBani.toFixed(2)}).`,
                    '#15803d'
                );
            } else {
                setExpressStatus(`✅ ${esc(kName)} (${esc(completedTaniTitle)}) ka hisab save ho gaya!`, '#15803d');
            }

            saveSucceeded = true;
        } catch (error) {
            console.error('[Express Save Failed]', error);

            // ROLLBACK SYSTEM
            try {
                setToStore('saree_history', snapSaree);
                setToStore('bana_history', snapBana);
                setToStore('zari_history', snapZari);
                setToStore('payment_history', snapPay);
                if (typeof window.saveKarigerSheets === 'function') {
                    window.saveKarigerSheets(kId, snapSheets);
                } else {
                    setToStore(`kariger_sheets_${kId}`, snapSheets);
                }
                refreshUnderlyingERPViews(kId);
            } catch (rbErr) {
                console.error('[Express Rollback Error]', rbErr);
            }

            setExpressStatus('❌ Error: Save fail hua, data rollback ho gaya!', '#dc2626');
        } finally {
            isSubmittingExpress = false;
        }

        if (!saveSucceeded) return;

        // Print runs outside transaction rollback block so popup blocker never rolls back saved data
        try {
            printLastSavedExpressSlip();
        } catch (printErr) {
            console.warn('[Express Print Warning]', printErr);
        }

        const kInp = document.getElementById('kexp-kariger-input');
        if (kInp) {
            kInp.value = '';
            kInp.focus();
        }
        resetExpressDisplayState();
        showRightPicker('kariger', '');
    };

    /* ========================================================================
       10. A6 THERMAL SLIP PRINT (PWA SAFE — NO BLOCKING POPUP ALERTS)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.printLastSavedExpressSlip = () => {
        if (!lastSavedTransaction) {
            console.warn('[Express Print] Print karne ke liye koi recent hisab nahi mila.');
            setExpressStatus('⚠️ Print karne ke liye koi recent hisab nahi mila!', '#dc2626');
            return;
        }

        const t = lastSavedTransaction;
        const kGodamName = (typeof window.getKarkhanaNameById === 'function')
            ? window.getKarkhanaNameById(t.kGodown)
            : 'Main Godown';

        const remainingOnLoom = Math.max(0, t.taniPcs - t.deliveredSarees);
        const colorsTxt = (t.colors && t.colors.length) ? t.colors.join(', ') : 'N/A';

        const printWindow = window.open('', '', 'width=420,height=600');
        if (!printWindow) {
            console.warn('[Express Print] Popup block hai! Browser me popup allow karein.');
            setExpressStatus('⚠️ Hisab saved hai, lekin Print Popup block hai (Browser me allow karein).', '#b47d00');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Baithak Parchi - ${esc(t.karigerName)}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { margin-bottom: 6px; font-size: 10.5px; border-bottom: 1.5px dashed #666; padding-bottom: 4px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 6px 0; }
                    th, td { padding: 3px 2px; text-align: left; border-bottom: 1px dashed #ccc; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 10px; }
                    .highlight-box { background: #f4f4f4; border: 1px solid #000; padding: 4px 6px; margin: 6px 0; font-size: 11px; font-weight: bold; }
                    .completed-banner { background: #eee; border: 1.5px solid #000; padding: 5px; text-align: center; font-weight: 900; font-size: 11px; margin-bottom: 6px; }
                    .signs { display: flex; justify-content: space-between; margin-top: 22px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>⚡ बैठक ले-देन पर्ची (EXPRESS RECEIPT)</p>
                    </div>

                    ${t.isTaniCompleted ? `
                    <div class="completed-banner">
                        🎉 ताना पूरा हुआ: ${esc(t.taniTitle)} (${t.taniPcs} Saree)<br>
                        ✨ अगली ताना (${esc(t.nextTaniTitle)}) स्वतः शुरू हो गई!
                    </div>` : ''}

                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(t.karigerName)}</span><span><strong>तारीख:</strong> ${esc(t.date)}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(t.sDesign)}</span><span><strong>खाता:</strong> ${esc(t.taniTitle)}</span></div>
                        <div class="meta-row"><span><strong>साँचा (Maker):</strong> ${esc(t.sanchaMaker)}</span><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span></div>
                    </div>

                    <div class="highlight-box">
                        <div style="display:flex; justify-content:space-between;">
                            <span>कुल तानी: ${t.taniPcs} Pcs</span>
                            <span>अब तक आई: ${t.deliveredSarees} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:2px;">
                            <span>लूम पर बाकी: ${remainingOnLoom} Pcs</span>
                        </div>
                        <div style="font-size:9.5px; font-weight:normal; margin-top:3px; color:#333;">
                            रंग (Colors): ${esc(colorsTxt)}
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr><th>विवरण (ITEM / DETAIL)</th><th style="text-align:right;">मात्रा / वज़न</th></tr>
                        </thead>
                        <tbody>
                            ${t.saree > 0 ? `<tr><td>साड़ी जमा</td><td style="text-align:right; font-weight:bold;">+${t.saree} Pcs</td></tr>` : ''}
                            ${t.lott > 0 ? `<tr><td>लोट साड़ी</td><td style="text-align:right; font-weight:bold;">-${t.lott} Pcs</td></tr>` : ''}
                            ${t.netBana > 0 ? `<tr><td>बाना दिया (${esc(t.banaItem || 'बाना')})</td><td style="text-align:right; font-weight:bold;">${t.netBana.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.netZari > 0 ? `<tr><td>जरी दी (${esc(t.zariItem || 'जरी')})</td><td style="text-align:right; font-weight:bold;">${t.netZari.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.retBana > 0 ? `<tr><td>वापस बाना</td><td style="text-align:right;">${t.retBana.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.retZari > 0 ? `<tr><td>वापस जरी</td><td style="text-align:right;">${t.retZari.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.paid > 0 ? `<tr><td>मजदूरी दिया (Paid)</td><td style="text-align:right; font-weight:bold;">₹ ${t.paid.toFixed(2)}</td></tr>` : ''}
                        </tbody>
                    </table>

                    <div style="border-top:1.5px dashed #000; padding-top:4px; font-size:11.5px; font-weight:bold; display:flex; justify-content:space-between;">
                        <span>अंतिम बाकी रुपया:</span>
                        <span>₹ ${t.netRemaining.toFixed(2)}</span>
                    </div>

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

    /* ========================================================================
       11. GLOBAL EXPORT
       ------------------------------------------------------------------------
    ======================================================================== */
    window.KarigerExpressEngine = {
        openKarigerExpressModal,
        closeKarigerExpressModal,
        openAltCKarigerModal,
        closeAltCKarigerModal,
        saveAltCKariger,
        openExpressNewTaniModal,
        closeExpressNewTaniModal,
        saveExpressNewTani,
        switchExpressTaniSheet,
        calculateKarigerExpressLive,
        updateExpressStockBadges,
        submitKarigerExpress,
        printLastSavedExpressSlip
    };

})();
