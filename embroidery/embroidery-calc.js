/* ============================================================================
   SIMPLICITY ERP - EMBROIDERY (KADHAI) CALCULATION & RECONCILIATION ENGINE
   File: embroidery/embroidery-calc.js • Developed by Farhan Jawed
   Architecture: Single-Pass O(N) Compute | Live Finished Stock & Pipeline Balance
   Rules: Inward from Embroidery | Outward to Calender (from Embroidery Stock)
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. IN-MEMORY CALCULATION CACHE & STATE
       ======================================================================== */
    let EMBROIDERY_STATS_CACHE = null;

    /**
     * Cache Invalidation Hook
     */
    const invalidateEmbroideryCalcCache = () => {
        EMBROIDERY_STATS_CACHE = null;
    };

    /* ========================================================================
       2. TYPE-SAFE NUMERIC PARSERS
       ======================================================================== */
    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    /* ========================================================================
       3. SINGLE-PASS LIVE STOCK STATS ENGINE (EMBROIDERY ➔ CALENDER)
       ======================================================================== */
    /**
     * Calculates live stock balances for Embroidery
     * @param {boolean} [forceRefresh=false]
     * @returns {Object} { totAayi: number, sentToCal: number, totGayi: number, bacha: number, pendingInWorkers: number, totDamage: number }
     */
    const getEmbroiderySareeLiveStats = (forceRefresh = false) => {
        if (!forceRefresh && EMBROIDERY_STATS_CACHE !== null) {
            return EMBROIDERY_STATS_CACHE;
        }

        const defaultStats = Object.freeze({
            totAayi: 0,
            sentToCal: 0,
            totGayi: 0,
            bacha: 0,
            pendingInWorkers: 0,
            totDamage: 0
        });

        try {
            const allWorkers = (typeof window.getJobWorkers === 'function') 
                ? window.getJobWorkers() 
                : (window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : []);

            if (!Array.isArray(allWorkers) || allWorkers.length === 0) {
                EMBROIDERY_STATS_CACHE = { ...defaultStats };
                return EMBROIDERY_STATS_CACHE;
            }

            let totEmbAayi = 0;
            let totEmbGayi = 0;
            let totSentToCalender = 0;
            let totDamagePcs = 0;
            const wLen = allWorkers.length;

            for (let i = 0; i < wLen; i++) {
                const w = allWorkers[i];
                if (!w || !w.id) continue;

                const workerType = String(w.type || '').trim().toLowerCase();
                const isEmbroidery = (workerType === 'embroidery');
                const isCalender = (workerType === 'calender');

                if (!isEmbroidery && !isCalender) continue;

                const sheets = (typeof window.getJobWorkerSheets === 'function')
                    ? window.getJobWorkerSheets(w.id)
                    : (window.safeArray ? window.safeArray(window.getStore(`jobwork_sheets_${w.id}`)) : []);

                const sLen = sheets.length;
                for (let j = 0; j < sLen; j++) {
                    const sh = sheets[j];
                    if (!sh) continue;

                    const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                    const rLen = rows.length;

                    for (let m = 0; m < rLen; m++) {
                        const r = rows[m];
                        if (!r) continue;

                        if (isEmbroidery) {
                            // 1. Embroidery Kariger se wapas tayyar aayi saree (+)
                            totEmbAayi += safeInt(r.aayiQty !== undefined ? r.aayiQty : r.aai);
                            totEmbGayi += safeInt(r.gayiQty !== undefined ? r.gayiQty : r.gai);
                            totDamagePcs += safeInt(r.damagePcs !== undefined ? r.damagePcs : r.dmg);
                        } else if (isCalender) {
                            // 2. Embroidery Stock se Calender me bheji gayi saree (-)
                            const src = String(r.stockSource || r.source || '').trim().toLowerCase();
                            if (src === 'embroidery') {
                                totSentToCalender += safeInt(r.gayiQty !== undefined ? r.gayiQty : r.gai);
                            }
                        }
                    }
                }
            }

            // Godam me bacha hua Embroidery Stock = (Kul Aayi - Calender me Gayi)
            const bachaStock = Math.max(0, totEmbAayi - totSentToCalender);
            // Karigaron ke paas pending = Gayi - (Aayi + Damage)
            const pendingWithWorkers = Math.max(0, totEmbGayi - (totEmbAayi + totDamagePcs));

            const result = {
                totAayi: totEmbAayi,
                sentToCal: totSentToCalender,
                totGayi: totEmbGayi,
                bacha: bachaStock,
                pendingInWorkers: pendingWithWorkers,
                totDamage: totDamagePcs
            };

            EMBROIDERY_STATS_CACHE = result;
            return result;

        } catch (err) {
            console.error('[EmbroideryCalcEngine] Calculation error:', err);
            return { ...defaultStats };
        }
    };

    /* ========================================================================
       4. GLOBAL EXPORT
       ======================================================================== */
    const embroideryCalcAPI = {
        getEmbroiderySareeLiveStats,
        invalidateEmbroideryCalcCache,
        safeInt,
        safeNum
    };

    window.getEmbroiderySareeLiveStats = getEmbroiderySareeLiveStats;
    window.invalidateEmbroideryCalcCache = invalidateEmbroideryCalcCache;
    window.EmbroideryCalcEngine = embroideryCalcAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = embroideryCalcAPI;
    }
})();
