/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE SANCHA (TANI & CHUKKA) CALCULATION ENGINE
   File: sancha/sancha-calc.js • Developed by Farhan Jawed
   (100% Accurate Live Calculation • Zero Over-Deduction • Seamless Kariger Sync)
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
       2. LIVE ITEM STATS ENGINE (AAYA, GAYA, BACHA)
       ======================================================================== */
    const getSanchaItemStats = (itemId, itemName, category, targetKarkhanaId) => {
        const kId = normalizeGodownId(targetKarkhanaId || window.currentSanchaKarkhanaFilter || 'all');
        const cat = normalizeCategory(category);
        const cleanName = String(itemName || '').trim();
        const nameLower = cleanName.toLowerCase();
        const cleanId = itemId ? String(itemId).trim() : '';

        if (!cleanName && !cleanId) {
            return { id: '', name: '', category: cat, karkhanaId: kId, date: '', aaya: 0, gaya: 0, bacha: 0 };
        }

        let totalAaya = 0;
        let totalGaya = 0;
        let lastDate = '';

        const sItems = getSanchaItems();
        const sHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];

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

            if (matchK) {
                totalAaya += safeNum(s.aaya !== undefined ? s.aaya : s.totalQty);
                if (s.date && (!lastDate || s.date > lastDate)) {
                    lastDate = s.date;
                }
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

            const inQ = safeNum(h.aaya);
            const outQ = safeNum(h.gaya !== undefined ? h.gaya : h.qty);
            const t = String(h.type || '');

            const isPurchase = (t.includes('Khareed') || t.includes('Inward') || t.includes('Opening'));

            // Outward / Gaya logic (Kariger Issue, Transfer Out, etc.)
            if (outQ > 0) {
                totalGaya += outQ;
            } else if (t.includes('Le Gaya') || t.includes('Out') || t.includes('Diya') || t.includes('Issue')) {
                totalGaya += safeNum(h.qty || h.wazan);
            }

            // Inward logic (Only Transfer In or Kariger Returns - not direct purchase duplicate)
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
            id: cleanId || `sancha_${nameLower}`,
            name: cleanName || '-',
            category: cat,
            karkhanaId: kId,
            date: lastDate || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : ''),
            aaya: roundWeight(totalAaya),
            gaya: roundWeight(totalGaya),
            bacha: bacha
        };
    };

    const getSanchaAvailableBalance = (itemName, category, karkhanaId) => {
        const stats = getSanchaItemStats(null, itemName, category, karkhanaId);
        return safeNum(stats.bacha);
    };

    /* ========================================================================
       3. INTER-GODOWN SANCHA TRANSFER ENGINE
       ======================================================================== */
    const transferSanchaStock = (date, itemName, category, fromKarkhanaId, toKarkhanaId, qty, note = '') => {
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

        const available = getSanchaAvailableBalance(cleanName, cat, sourceKid);
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

            hist.push({
                id: `shist_out_${Date.now()}`,
                date: cleanDate,
                name: cleanName,
                category: cat,
                kariger: 'Godown Transfer',
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
                kariger: 'Godown Transfer',
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
        transferSanchaStock,
        invalidateSanchaCalcCache,
        normalizeGodownId,
        normalizeCategory,
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
