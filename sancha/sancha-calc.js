/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE SANCHA (TANI & CHUKKA) CALCULATION ENGINE
   File: sancha/sancha-calc.js • Developed by Farhan Jawed
   (Maker-Wise Live Calculation • Zero Over-Deduction • Seamless Kariger Sync)
============================================================================ */

(() => {
    'use strict';

    window.currentSanchaKarkhanaFilter = 'all';

    const roundWeight = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const normalizeGodownId = (id) => {
        if (!id || id === 'all') return 'all';
        const clean = String(id).trim();
        return (!clean || clean === 'k_main') ? 'k_main' : clean;
    };

    const normalizeCategory = (cat) => {
        const c = String(cat || 'tani').trim().toLowerCase();
        return (c === 'chukka') ? 'chukka' : 'tani';
    };

    const normalizePerson = (p) => {
        const s = String(p ?? '').trim();
        if (!s || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return '';
        return s;
    };

    const invalidateSanchaCalcCache = () => {
        // Cache bust hook for UI triggers
    };

    /* ========================================================================
       1. CORE CRUD OPERATIONS (SANCHA ITEMS)
       ======================================================================== */
    const getSanchaItems = () => {
        try {
            const raw = (typeof window.getStore === 'function')
                ? window.getStore('sancha_items')
                : localStorage.getItem('sancha_items');
            return window.safeArray ? window.safeArray(raw) : (Array.isArray(raw) ? raw : []);
        } catch (err) {
            console.error('[SanchaCalc] getSanchaItems error:', err);
            return [];
        }
    };

    const saveSanchaItems = (list) => {
        try {
            const cleanList = window.safeArray ? window.safeArray(list) : (Array.isArray(list) ? list : []);
            if (typeof window.setStore === 'function') {
                window.setStore('sancha_items', cleanList);
            } else {
                localStorage.setItem('sancha_items', JSON.stringify(cleanList));
            }
        } catch (err) {
            console.error('[SanchaCalc] saveSanchaItems error:', err);
        }
    };

    /* ========================================================================
       2. LIVE ITEM STATS ENGINE (ITEM + MAKER WISE AAYA, GAYA, BACHA)
       ======================================================================== */
    const getSanchaItemStats = (itemId, itemName, category, targetKarkhanaId, targetPerson = null) => {
        const kId = normalizeGodownId(targetKarkhanaId || window.currentSanchaKarkhanaFilter || 'all');
        const cat = normalizeCategory(category);
        const cleanName = String(itemName || '').trim();
        const nameLower = cleanName.toLowerCase();
        const cleanId = itemId ? String(itemId).trim() : '';
        const filterByPerson = (targetPerson !== null && targetPerson !== undefined);
        const personNorm = filterByPerson ? normalizePerson(targetPerson) : '';
        const personLower = personNorm.toLowerCase();

        if (!cleanName && !cleanId) {
            return {
                id: '', name: '', category: cat, karkhanaId: kId,
                person: personNorm || '-', date: '', aaya: 0, gaya: 0, bacha: 0
            };
        }

        let totalAaya = 0;
        let totalGaya = 0;
        let lastDate = '';
        let detectedPerson = personNorm;

        const sItems = getSanchaItems();
        const sHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];

        // Count how many distinct makers exist for this item+cat+godown (for legacy history fallback)
        const makersForItem = new Set();
        sItems.forEach((s) => {
            if (!s || !s.name) return;
            if (normalizeCategory(s.category) !== cat) return;
            if (s.name.trim().toLowerCase() !== nameLower) return;
            const sKid = normalizeGodownId(s.karkhanaId);
            const matchK = (kId === 'all') || (sKid === kId) || (!s.karkhanaId && kId === 'k_main');
            if (matchK) {
                makersForItem.add(normalizePerson(s.person).toLowerCase());
            }
        });

        // 1. Direct Purchase / Opening Stock (from sancha_items)
        sItems.forEach((s) => {
            if (!s) return;
            const sCat = normalizeCategory(s.category);
            if (sCat !== cat) return;

            const nameMatch = (cleanId && String(s.id) === cleanId) ||
                              (!cleanId && s.name && s.name.trim().toLowerCase() === nameLower);
            if (!nameMatch) return;

            const sKid = normalizeGodownId(s.karkhanaId);
            const matchK = (kId === 'all') || (sKid === kId) || (!s.karkhanaId && kId === 'k_main');
            if (!matchK) return;

            const sPerNorm = normalizePerson(s.person);
            if (filterByPerson && sPerNorm.toLowerCase() !== personLower) return;

            if (!detectedPerson && sPerNorm) detectedPerson = sPerNorm;

            totalAaya += safeNum(s.aaya !== undefined ? s.aaya : s.totalQty);
            if (s.date && (!lastDate || s.date > lastDate)) {
                lastDate = s.date;
            }
        });

        // 2. Scan Sancha History (Kariger Issues, Transfers & Usage)
        sHist.forEach((h) => {
            if (!h) return;
            const hCat = normalizeCategory(h.category);
            if (hCat !== cat) return;

            const nameMatch = (cleanId && String(h.itemId) === cleanId) ||
                              (h.name && h.name.trim().toLowerCase() === nameLower);
            if (!nameMatch) return;

            const hKid = normalizeGodownId(h.karkhanaId);
            const matchK = (kId === 'all') || (hKid === kId) || (!h.karkhanaId && kId === 'k_main');
            if (!matchK) return;

            const t = String(h.type || '');
            const isPurchase = (t.includes('Khareed') || t.includes('Inward') || t.includes('Opening'));

            if (filterByPerson) {
                const hasExplicitPerson = (h.person !== undefined || h.sanchaMaker !== undefined);
                if (hasExplicitPerson) {
                    const hPer = normalizePerson(h.person !== undefined ? h.person : h.sanchaMaker).toLowerCase();
                    if (hPer !== personLower) return;
                } else if (isPurchase) {
                    const hKarPer = normalizePerson(h.kariger);
                    const mappedPer = (hKarPer.toLowerCase() === 'factory inward') ? '' : hKarPer.toLowerCase();
                    if (mappedPer !== personLower) return;
                } else {
                    // Legacy Kariger Issue / Transfer without h.person:
                    // Match only if there's 0 or 1 maker for this item (avoid cross-maker distortion)
                    if (makersForItem.size > 1 && personLower !== '') return;
                    if (makersForItem.size === 1 && !makersForItem.has(personLower)) return;
                }
            }

            const inQ = safeNum(h.aaya);
            const outQ = safeNum(h.gaya !== undefined ? h.gaya : h.qty);

            if (outQ > 0) {
                totalGaya += outQ;
            } else if (t.includes('Le Gaya') || t.includes('Out') || t.includes('Diya') || t.includes('Issue')) {
                totalGaya += safeNum(h.qty || h.wazan);
            }

            if (!isPurchase) {
                if (inQ > 0) {
                    totalAaya += inQ;
                } else if (t.includes('Wapas') || t.includes('Jama') || t.includes('Return')) {
                    totalAaya += safeNum(h.qty || h.wazan);
                }
            }

            if (h.date && (!lastDate || h.date > lastDate)) {
                lastDate = h.date;
            }
        });

        const bacha = Math.max(0, roundWeight(totalAaya - totalGaya));

        return {
            id: cleanId || `sancha_${nameLower}_${personLower}`,
            name: cleanName || '-',
            category: cat,
            karkhanaId: kId,
            person: detectedPerson || '-',
            date: lastDate || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : ''),
            aaya: roundWeight(totalAaya),
            gaya: roundWeight(totalGaya),
            bacha: bacha
        };
    };

    const getSanchaAvailableBalance = (itemName, category, karkhanaId, targetPerson = null) => {
        const stats = getSanchaItemStats(null, itemName, category, karkhanaId, targetPerson);
        return safeNum(stats.bacha);
    };

    /* ========================================================================
       2B. UNIQUE (ITEM + MAKER) ROWS & MAKER SUMMARY HELPERS
       ======================================================================== */
    const getSanchaUniqueStockRows = (category, targetKarkhanaId = 'all') => {
        const cat = normalizeCategory(category);
        const kId = normalizeGodownId(targetKarkhanaId || window.currentSanchaKarkhanaFilter || 'all');
        const sItems = getSanchaItems();
        const sHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];

        const pairs = new Map();
        const addPair = (rawName, rawPerson) => {
            const nm = String(rawName || '').trim();
            if (!nm) return;
            const per = normalizePerson(rawPerson);
            const key = `${nm.toLowerCase()}___${per.toLowerCase()}`;
            if (!pairs.has(key)) {
                pairs.set(key, { name: nm, person: per });
            }
        };

        sItems.forEach((s) => {
            if (!s || !s.name) return;
            if (normalizeCategory(s.category) !== cat) return;
            addPair(s.name, s.person);
        });

        sHist.forEach((h) => {
            if (!h || !h.name) return;
            if (normalizeCategory(h.category) !== cat) return;
            if (h.person !== undefined || h.sanchaMaker !== undefined) {
                addPair(h.name, h.person !== undefined ? h.person : h.sanchaMaker);
            }
        });

        const rows = [];
        pairs.forEach((pair) => {
            const stats = getSanchaItemStats(null, pair.name, cat, kId, pair.person);
            if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                rows.push(stats);
            }
        });

        return rows;
    };

    const getSanchaMakersSummary = (category, itemName = '', targetKarkhanaId = 'all') => {
        const cat = normalizeCategory(category);
        const kId = normalizeGodownId(targetKarkhanaId || 'all');
        const targetItemLower = String(itemName || '').trim().toLowerCase();
        const rows = getSanchaUniqueStockRows(cat, kId);

        const makerMap = new Map();
        rows.forEach((r) => {
            const per = normalizePerson(r.person);
            if (!per) return;
            if (targetItemLower && r.name.toLowerCase() !== targetItemLower) return;

            const key = per.toLowerCase();
            if (!makerMap.has(key)) {
                makerMap.set(key, { name: per, bacha: 0, items: [] });
            }
            const m = makerMap.get(key);
            m.bacha = roundWeight(m.bacha + safeNum(r.bacha));
            m.items.push({ name: r.name, bacha: safeNum(r.bacha) });
        });

        return Array.from(makerMap.values()).sort((a, b) => b.bacha - a.bacha || a.name.localeCompare(b.name));
    };

    /* ========================================================================
       3. INTER-GODOWN SANCHA TRANSFER ENGINE (MAKER-AWARE)
       ======================================================================== */
    const transferSanchaStock = (date, itemName, category, fromKarkhanaId, toKarkhanaId, qty, note = '', targetPerson = null) => {
        const weight = safeNum(qty);
        if (weight <= 0) {
            alert('Kripya sahi wazan (Qty Kg me) darj karein!');
            return false;
        }

        const sourceKid = normalizeGodownId(fromKarkhanaId);
        const targetKid = normalizeGodownId(toKarkhanaId);

        if (sourceKid === targetKid) {
            alert('Bhejne wala aur Paane wala Godam alag-alag hona chahiye!');
            return false;
        }

        const cleanName = String(itemName || '').trim();
        if (!cleanName) {
            alert('Sancha Item ka naam chunein!');
            return false;
        }

        const cat = normalizeCategory(category);
        const catLabel = cat === 'chukka' ? 'Chukka' : 'Tani';
        const personNorm = targetPerson !== null && targetPerson !== undefined ? normalizePerson(targetPerson) : null;

        const available = getSanchaAvailableBalance(cleanName, cat, sourceKid, personNorm);
        if (weight > available) {
            alert(`Bhejne wale godam me sirf ${available.toFixed(2)} Kg ${catLabel} bacha hai! Aap ${weight.toFixed(2)} Kg transfer nahi kar sakte.`);
            return false;
        }

        try {
            const cleanDate = date || ((typeof window.getTodayDate === 'function')
                ? window.getTodayDate()
                : new Date().toISOString().split('T')[0]);

            const fromName = (typeof window.getKarkhanaNameById === 'function')
                ? window.getKarkhanaNameById(sourceKid)
                : sourceKid;
            const toName = (typeof window.getKarkhanaNameById === 'function')
                ? window.getKarkhanaNameById(targetKid)
                : targetKid;

            const transferRef = `tr_sancha_${Date.now()}`;
            const cleanNote = note ? String(note).trim() : `${catLabel} Transfer: ${fromName} ➔ ${toName}`;

            const hist = window.safeArray
                ? window.safeArray(window.getStore('sancha_history'))
                : [];

            const makerLabel = personNorm || '-';

            hist.push({
                id: `shist_out_${Date.now()}`,
                date: cleanDate,
                name: cleanName,
                category: cat,
                person: makerLabel,
                kariger: personNorm ? `${personNorm} (Transfer)` : 'Godown Transfer',
                type: `Transfer Out ➔ ${toName}${note ? ` (${note})` : ''}`,
                aaya: 0,
                gaya: weight,
                karkhanaId: sourceKid,
                refId: transferRef,
                timestamp: Date.now()
            });

            hist.push({
                id: `shist_in_${Date.now() + 1}`,
                date: cleanDate,
                name: cleanName,
                category: cat,
                person: makerLabel,
                kariger: personNorm ? `${personNorm} (Transfer)` : 'Godown Transfer',
                type: `Transfer In ⬅ ${fromName}${note ? ` (${note})` : ''}`,
                aaya: weight,
                gaya: 0,
                karkhanaId: targetKid,
                refId: transferRef,
                timestamp: Date.now() + 1
            });

            if (typeof window.setStore === 'function') {
                window.setStore('sancha_history', hist);
            }

            if (typeof window.recordTransferEntry === 'function') {
                window.recordTransferEntry({
                    id: transferRef,
                    date: cleanDate,
                    fromKarkhanaId: sourceKid,
                    toKarkhanaId: targetKid,
                    type: `sancha_${cat}`,
                    itemName: cleanName,
                    quantity: weight,
                    remarks: cleanNote
                });
            }

            return true;
        } catch (txErr) {
            console.error('[SanchaCalcEngine] Transfer failure:', txErr);
            alert('Transfer process me takleef aayi.');
            return false;
        }
    };

    /* ========================================================================
       4. GLOBAL EXPORTS
       ======================================================================== */
    const sanchaCalcAPI = {
        getSanchaItems,
        saveSanchaItems,
        getSanchaItemStats,
        getSanchaAvailableBalance,
        getSanchaUniqueStockRows,
        getSanchaMakersSummary,
        transferSanchaStock,
        invalidateSanchaCalcCache,
        normalizeGodownId,
        normalizeCategory,
        normalizePerson,
        roundWeight
    };

    Object.keys(sanchaCalcAPI).forEach((fnName) => {
        window[fnName] = sanchaCalcAPI[fnName];
    });

    window.SanchaCalcEngine = sanchaCalcAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sanchaCalcAPI;
    }
})();
