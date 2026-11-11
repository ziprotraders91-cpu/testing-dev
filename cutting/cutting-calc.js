/* ============================================================================
   SIMPLICITY ERP - BOOTI CUTTING CALCULATION & RECONCILIATION ENGINE
   File: cutting/cutting-calc.js • Developed by Farhan Jawed (Multi-Pipeline Fixed)
   Architecture: Single-Pass O(N) Aggregation | Memoized Live Stock Index
   Rules: Inward from Cutting | Outward to Embroidery (Cutting) & Calender (Cutting)
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. IN-MEMORY CALCULATION CACHE & STATE
       ======================================================================== */
    let CUTTING_STATS_CACHE = null;

    /**
     * Cache Invalidation Hook
     */
    const invalidateCuttingCalcCache = () => {
        CUTTING_STATS_CACHE = null;
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
       3. SINGLE-PASS LIVE STOCK STATS ENGINE (CUTTING ➔ EMBROIDERY / CALENDER)
       ======================================================================== */
    /**
     * Calculates live stock balances for Booti Cutting
     * @param {boolean} [forceRefresh=false]
     * @returns {Object} { totAayi: number, sentToEmb: number, sentToCal: number, totGayi: number, bacha: number }
     */
    const getCuttingSareeLiveStats = (forceRefresh = false) => {
        if (!forceRefresh && CUTTING_STATS_CACHE !== null) {
            return CUTTING_STATS_CACHE;
        }

        const defaultStats = Object.freeze({
            totAayi: 0,
            sentToEmb: 0,
            sentToCal: 0,
            totGayi: 0,
            bacha: 0
        });

        try {
            const allWorkers = (typeof window.getJobWorkers === 'function') 
                ? window.getJobWorkers() 
                : (window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : []);

            if (!Array.isArray(allWorkers) || allWorkers.length === 0) {
                CUTTING_STATS_CACHE = { ...defaultStats };
                return CUTTING_STATS_CACHE;
            }

            let totCuttingAayi = 0;
            let totSentToEmbroidery = 0;
            let totSentToCalender = 0;
            const wLen = allWorkers.length;

            for (let i = 0; i < wLen; i++) {
                const w = allWorkers[i];
                if (!w || !w.id) continue;

                const workerType = String(w.type || '').trim().toLowerCase();
                const isCutting = (workerType === 'cutting');
                const isEmbroidery = (workerType === 'embroidery');
                const isCalender = (workerType === 'calender');

                if (!isCutting && !isEmbroidery && !isCalender) continue;

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

                        if (isCutting) {
                            // 1. Cutting Kariger se wapas tayyar aayi saree (+)
                            totCuttingAayi += safeInt(r.aayiQty);
                        } else if (isEmbroidery) {
                            // 2. Cutting se Embroidery me bheji gayi saree (-)
                            const src = String(r.stockSource || '').trim().toLowerCase();
                            if (src === 'cutting') {
                                totSentToEmbroidery += safeInt(r.gayiQty);
                            }
                        } else if (isCalender) {
                            // 3. Cutting se Calender me bheji gayi saree (-)
                            const src = String(r.stockSource || '').trim().toLowerCase();
                            if (src === 'cutting') {
                                totSentToCalender += safeInt(r.gayiQty);
                            }
                        }
                    }
                }
            }

            const totalSent = totSentToEmbroidery + totSentToCalender;
            const bacha = Math.max(0, totCuttingAayi - totalSent);

            const result = {
                totAayi: totCuttingAayi,
                sentToEmb: totSentToEmbroidery,
                sentToCal: totSentToCalender,
                totGayi: totalSent,
                bacha: bacha
            };

            CUTTING_STATS_CACHE = result;
            return result;

        } catch (err) {
            console.error('[CuttingCalcEngine] Calculation error:', err);
            return { ...defaultStats };
        }
    };

    /* ========================================================================
       4. GLOBAL EXPORT
       ======================================================================== */
    const cuttingCalcAPI = {
        getCuttingSareeLiveStats,
        invalidateCuttingCalcCache
    };

    window.getCuttingSareeLiveStats = getCuttingSareeLiveStats;
    window.invalidateCuttingCalcCache = invalidateCuttingCalcCache;
    window.CuttingCalcEngine = cuttingCalcAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = cuttingCalcAPI;
    }
})();
