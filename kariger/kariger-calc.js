/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE WEAVER (KARIGER) CALCULATION ENGINE
   File: kariger/kariger-calc.js • Developed by Farhan Jawed
   (Accurate Wages + Bana/Zari + Zero Duplicate Saree Stock + Auto-Tani Engine)
============================================================================ */

(() => {
    'use strict';

    // Default rate standards (Varanasi / Mau handloom & powerloom standard)
    const DEFAULT_RATES = Object.freeze({
        BANI: 240,       // Rs per saree wage
        BANA: 0.311,     // Kg per saree weft consumption
        ZARI: 0.110      // Kg per saree zari consumption
    });

    const roundCurrency = (val) => {
        const num = parseFloat(val);
        return isNaN(num) || !isFinite(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const roundWeight = (val) => {
        const num = parseFloat(val);
        return isNaN(num) || !isFinite(num) ? 0 : Math.round((num + Number.EPSILON) * 1000) / 1000;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const getStoreData = (key) => {
        if (typeof window.getStore === 'function') return window.getStore(key);
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            return [];
        }
    };

    const setStoreData = (key, val) => {
        if (typeof window.setStore === 'function') {
            window.setStore(key, val);
        } else {
            localStorage.setItem(key, JSON.stringify(val));
        }
    };

    /**
     * 1. Kariger ki Tani Sheets safe get karna
     */
    const getKarigerSheets = (karigerId) => {
        if (!karigerId) return [];
        try {
            const storeKey = `kariger_sheets_${String(karigerId).trim()}`;
            const raw = getStoreData(storeKey);
            const sheets = window.safeArray ? window.safeArray(raw) : (Array.isArray(raw) ? raw : []);
            sheets.forEach((sh) => {
                if (sh) sh.rows = window.safeArray ? window.safeArray(sh.rows) : (Array.isArray(sh.rows) ? sh.rows : []);
            });
            return sheets;
        } catch (err) {
            console.error(`[KarigerCalc] Error getting sheets:`, err);
            return [];
        }
    };

    /**
     * 2. Kariger ki Tani Sheets save karna
     */
    const saveKarigerSheets = (karigerId, sheets) => {
        if (!karigerId) return;
        try {
            const cleanId = String(karigerId).trim();
            const clean = window.safeArray ? window.safeArray(sheets) : (Array.isArray(sheets) ? sheets : []);
            clean.forEach((sh) => {
                if (sh) sh.rows = window.safeArray ? window.safeArray(sh.rows) : (Array.isArray(sh.rows) ? sh.rows : []);
            });

            const storeKey = `kariger_sheets_${cleanId}`;
            setStoreData(storeKey, clean);

            // Saree stock cache invalidate karo taaki live totals theek rahein
            if (typeof window.invalidateSareeCalcCache === 'function') {
                window.invalidateSareeCalcCache();
            }
        } catch (err) {
            console.error(`[KarigerCalc] Error saving sheets:`, err);
        }
    };

    /**
     * ⭐ DUPLICATE CLEANUP ENGINE
     * Jo duplicate k_sheet_ wali 20 saree ban gayi thi, use automatically saaf karna
     */
    const cleanupDuplicateSareeHistory = () => {
        try {
            let sH = getStoreData('saree_history');
            if (!Array.isArray(sH) || sH.length === 0) return;

            const initialLen = sH.length;
            // Sirf k_sheet_ wali duplicate entries hatani hain, asli tani_sheet wali surakshit rahegi
            sH = sH.filter((item) => {
                if (!item) return false;
                const rId = String(item.refId || '');
                return !rId.startsWith('k_sheet_');
            });

            if (sH.length !== initialLen) {
                setStoreData('saree_history', sH);
                if (typeof window.invalidateSareeCalcCache === 'function') {
                    window.invalidateSareeCalcCache();
                }
                if (typeof window.renderSareeTable === 'function') {
                    window.renderSareeTable();
                }
                if (typeof window.updateDashboardBadgeTotals === 'function') {
                    window.updateDashboardBadgeTotals();
                }
                console.log('✅ Duplicate Saree entries cleaned up successfully.');
            }
        } catch (e) {
            console.error('[KarigerCalc] Cleanup duplicates error:', e);
        }
    };

    /**
     * 3. Tani Sheet ke Grand Totals (Mazdoori + Bana + Zari Hisab)
     */
    const calculateSheetTotals = (sh) => {
        const def = {
            totSaree: 0, totLott: 0, netSaree: 0, grossBani: 0, totPaid: 0, remainingAmt: 0,
            totTaniWazan: 0, totBana: 0, retBana: 0, banaConsumption: 0, banaWaste: 0, remainingBana: 0,
            totZari: 0, retZari: 0, zariConsumption: 0, zariWaste: 0, remainingZari: 0
        };

        if (!sh || typeof sh !== 'object') return def;

        const rows = window.safeArray ? window.safeArray(sh.rows) : (Array.isArray(sh.rows) ? sh.rows : []);
        let saree = 0, lott = 0, paid = 0, netB = 0, retB = 0, netZ = 0, retZ = 0, taniW = 0;

        rows.forEach((r) => {
            if (!r) return;
            saree += safeNum(r.saree);
            lott  += safeNum(r.lott);
            paid  += safeNum(r.paid);
            netB  += safeNum(r.netBana);
            retB  += safeNum(r.retBana);
            netZ  += safeNum(r.netZari);
            retZ  += safeNum(r.retZari);
            taniW += safeNum(r.taniWazan);
        });

        // 1. Mazdoori (Bani Wage) Hisab
        const netSaree = Math.max(0, saree - lott);
        const rateBani = (sh.rateBani !== undefined && sh.rateBani !== null) ? safeNum(sh.rateBani, DEFAULT_RATES.BANI) : DEFAULT_RATES.BANI;
        const grossBani = netSaree * rateBani;
        const pichlaBani = safeNum(sh.pichlaBani);
        const remAmt = (grossBani + pichlaBani) - paid;

        // 2. Weft (Bana) Hisab
        const rateBana = (sh.rateBana !== undefined && sh.rateBana !== null) ? safeNum(sh.rateBana, DEFAULT_RATES.BANA) : DEFAULT_RATES.BANA;
        const banaCons = saree * rateBana;
        const pichlaBana = safeNum(sh.pichlaBana);
        const banaWaste = safeNum(sh.banaWaste);
        const remBana = (pichlaBana + netB) - (retB + banaCons + banaWaste);

        // 3. Metallic Thread (Zari) Hisab
        const rateZari = (sh.rateZari !== undefined && sh.rateZari !== null) ? safeNum(sh.rateZari, DEFAULT_RATES.ZARI) : DEFAULT_RATES.ZARI;
        const zariCons = saree * rateZari;
        const pichlaZari = safeNum(sh.pichlaZari);
        const zariWaste = safeNum(sh.zariWaste);
        const remZari = (pichlaZari + netZ) - (retZ + zariCons + zariWaste);

        return {
            totSaree: saree,
            totLott: lott,
            netSaree: netSaree,
            grossBani: roundCurrency(grossBani),
            totPaid: roundCurrency(paid),
            remainingAmt: roundCurrency(remAmt),
            totTaniWazan: roundWeight(taniW),
            totBana: roundWeight(netB),
            retBana: roundWeight(retB),
            banaConsumption: roundWeight(banaCons),
            banaWaste: roundWeight(banaWaste),
            remainingBana: roundWeight(remBana),
            totZari: roundWeight(netZ),
            retZari: roundWeight(retZ),
            zariConsumption: roundWeight(zariCons),
            zariWaste: roundWeight(zariWaste),
            remainingZari: roundWeight(remZari)
        };
    };

    /**
     * ⭐ 4. AUTO-TANI COMPLETE & ROLLOVER ENGINE HELPERS
     * Tani poori hui ya nahi, aur auto-transfer calculation
     */
    const isTaniTargetReached = (sh) => {
        if (!sh || typeof sh !== 'object') return false;
        const target = safeNum(sh.taniPcs, 72);
        if (target <= 0) return false;
        const c = calculateSheetTotals(sh);
        return safeNum(c.totSaree) >= target;
    };

    const executeTaniAutoRollover = (karigerId) => {
        if (!karigerId) return null;
        const sheets = getKarigerSheets(karigerId);
        if (!sheets.length) return null;

        const curSheet = sheets[sheets.length - 1];
        const target = safeNum(curSheet.taniPcs, 72);
        const c = calculateSheetTotals(curSheet);

        if (target > 0 && safeNum(c.totSaree) >= target) {
            const nextNum = sheets.length + 1;
            const newSheet = {
                id: `tani_${nextNum}`,
                title: `Tani ${nextNum}`,
                pichlaBana: safeNum(c.remainingBana),
                pichlaZari: safeNum(c.remainingZari),
                pichlaBani: safeNum(c.remainingAmt),
                banaWaste: 0,
                zariWaste: 0,
                rateBana: safeNum(curSheet.rateBana, DEFAULT_RATES.BANA),
                rateZari: safeNum(curSheet.rateZari, DEFAULT_RATES.ZARI),
                rateBani: safeNum(curSheet.rateBani, DEFAULT_RATES.BANI),
                taniPcs: target,
                chukkaPcs: safeNum(curSheet.chukkaPcs, 72),
                taniItem: curSheet.taniItem || '',
                taniSancha: curSheet.taniSancha || '',
                taniWazan: 0,
                chukkaItem: curSheet.chukkaItem || '',
                chukkaSancha: curSheet.chukkaSancha || '',
                chukkaWazan: 0,
                colors: Array.isArray(curSheet.colors) ? [...curSheet.colors] : [],
                note: `Auto Rollover: ${curSheet.title} (${target} Saree Poori Hui)`,
                rows: []
            };

            sheets.push(newSheet);
            saveKarigerSheets(karigerId, sheets);
            return newSheet;
        }
        return null;
    };

    /**
     * 5. Kisi Kariger ka Total Lifetime Summary
     */
    const getKarigerLifetimeSummary = (karigerId) => {
        const summary = {
            totalSarees: 0,
            totalLott: 0,
            totalBaniEarned: 0,
            totalPaid: 0,
            currentBalanceAmt: 0,
            currentBanaBalance: 0,
            currentZariBalance: 0
        };

        if (!karigerId) return summary;

        const sheets = getKarigerSheets(karigerId);
        if (!sheets.length) return summary;

        sheets.forEach((sh) => {
            const c = calculateSheetTotals(sh);
            summary.totalSarees += c.totSaree;
            summary.totalLott += c.totLott;
            summary.totalBaniEarned += c.grossBani;
            summary.totalPaid += c.totPaid;
        });

        summary.totalBaniEarned = roundCurrency(summary.totalBaniEarned);
        summary.totalPaid = roundCurrency(summary.totalPaid);

        const lastSheet = sheets[sheets.length - 1];
        const lastCalc = calculateSheetTotals(lastSheet);
        summary.currentBalanceAmt = lastCalc.remainingAmt;
        summary.currentBanaBalance = lastCalc.remainingBana;
        summary.currentZariBalance = lastCalc.remainingZari;

        return summary;
    };

    /**
     * 6. Karkhana-Wise Production Aggregator
     */
    const getKarkhanaProductionStats = (targetKarkhanaId = 'all') => {
        const allKarigers = window.safeArray 
            ? window.safeArray(getStoreData('kariger_list')) 
            : (Array.isArray(getStoreData('kariger_list')) ? getStoreData('kariger_list') : []);

        const kId = String(targetKarkhanaId || 'all').trim();
        const filtered = allKarigers.filter((k) => {
            if (!k) return false;
            if (kId === 'all') return true;
            const kid = k.karkhanaId || 'k_main';
            return String(kid) === String(kId);
        });

        const stats = {
            totalKarigers: filtered.length,
            totalSarees: 0,
            totalLott: 0,
            totalPendingBani: 0
        };

        filtered.forEach((k) => {
            const s = getKarigerLifetimeSummary(k.id);
            stats.totalSarees += s.totalSarees;
            stats.totalLott += s.totalLott;
            stats.totalPendingBani += s.currentBalanceAmt;
        });

        stats.totalPendingBani = roundCurrency(stats.totalPendingBani);
        return stats;
    };

    const karigerCalcAPI = {
        DEFAULT_RATES,
        getKarigerSheets,
        saveKarigerSheets,
        calculateSheetTotals,
        isTaniTargetReached,
        executeTaniAutoRollover,
        getKarigerLifetimeSummary,
        getKarkhanaProductionStats,
        cleanupDuplicateSareeHistory,
        roundCurrency,
        roundWeight
    };

    Object.keys(karigerCalcAPI).forEach((fn) => { window[fn] = karigerCalcAPI[fn]; });
    window.KarigerCalcEngine = karigerCalcAPI;

    // Page load hote hi duplicate entry ko turant saaf kar dega
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(cleanupDuplicateSareeHistory, 200));
    } else {
        setTimeout(cleanupDuplicateSareeHistory, 200);
    }
})();
