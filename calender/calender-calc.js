/* ============================================================================
   SIMPLICITY ERP - CALENDER FINISHING CALCULATION ENGINE
   File: calender/calender-calc.js • Developed by Farhan Jawed (Synced & Crash-Free)
   Architecture: Single-Pass O(N) Compute | Accurate Finished Stock & Damage Routing
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. IN-MEMORY CALCULATION CACHE & STATE
       ======================================================================== */
    let CALENDER_STATS_CACHE = null;

    const invalidateCalenderCalcCache = () => {
        CALENDER_STATS_CACHE = null;
    };

    /* ========================================================================
       2. TYPE-SAFE NUMERIC PARSERS
       ======================================================================== */
    const safeInt = (val, fallback = 0) => {
        if (typeof val === 'number') {
            return Number.isFinite(val) ? Math.trunc(val) : fallback;
        }
        if (val === null || val === undefined || val === '') {
            return fallback;
        }
        if (typeof val === 'string') {
            const cleanStr = val.trim().replace(/,/g, '');
            const n = parseInt(cleanStr, 10);
            return Number.isFinite(n) ? n : fallback;
        }
        const parsed = parseInt(val, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const safeNum = (val, fallback = 0) => {
        if (typeof val === 'number') {
            return Number.isFinite(val) ? val : fallback;
        }
        if (val === null || val === undefined || val === '') {
            return fallback;
        }
        if (typeof val === 'string') {
            let cleanStr = val.trim();
            if (cleanStr.charCodeAt(0) === 0x20B9) {
                cleanStr = cleanStr.slice(1).trim();
            }
            if (cleanStr.indexOf(',') !== -1) {
                cleanStr = cleanStr.replace(/,/g, '');
            }
            const n = Number(cleanStr);
            return Number.isFinite(n) ? n : fallback;
        }
        const parsed = Number(val);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    /* ========================================================================
       3. SAFE STORE DATA RESOLUTION (BOTH SCOPED & DIRECT)
       ======================================================================== */
    const getStoreData = (key) => {
        if (typeof window.getStore === 'function') {
            const res = window.getStore(key);
            if (res && (!Array.isArray(res) || res.length > 0)) return res;
        }
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (_) {
            return [];
        }
    };

    /* ========================================================================
       4. SINGLE-PASS CALENDER FINISHED STATS ENGINE
       ======================================================================== */
    /**
     * Calculates live finished stock balances from Calender workers
     * @param {boolean} [forceRefresh=false]
     * @returns {Object} { totFinished: number, totGayi: number, pendingInCalender: number, totDamage: number }
     */
    const getCalenderFinishedLiveStats = (forceRefresh = false) => {
        if (!forceRefresh && CALENDER_STATS_CACHE !== null) {
            return CALENDER_STATS_CACHE;
        }

        const defaultStats = Object.freeze({
            totFinished: 0,
            totGayi: 0,
            pendingInCalender: 0,
            totDamage: 0
        });

        try {
            let allWorkers = [];
            if (typeof window.getJobWorkers === 'function') {
                allWorkers = window.getJobWorkers();
            } else {
                allWorkers = getStoreData('jobwork_workers');
            }

            allWorkers = window.safeArray ? window.safeArray(allWorkers) : (Array.isArray(allWorkers) ? allWorkers : []);

            if (allWorkers.length === 0) {
                CALENDER_STATS_CACHE = { ...defaultStats };
                return CALENDER_STATS_CACHE;
            }

            let totCalAayi = 0;
            let totCalGayi = 0;
            let totDamagePcs = 0;
            const wLen = allWorkers.length;

            for (let i = 0; i < wLen; i++) {
                const w = allWorkers[i];
                if (!w || !w.id) continue;

                const workerType = String(w.type || '').trim().toLowerCase();
                if (workerType !== 'calender') continue;

                let sheets = [];
                if (typeof window.getJobWorkerSheets === 'function') {
                    sheets = window.getJobWorkerSheets(w.id);
                } else {
                    sheets = getStoreData(`jobwork_sheets_${w.id}`);
                }

                sheets = window.safeArray ? window.safeArray(sheets) : (Array.isArray(sheets) ? sheets : []);
                const sLen = sheets.length;

                for (let j = 0; j < sLen; j++) {
                    const sh = sheets[j];
                    if (!sh) continue;

                    const rows = window.safeArray ? window.safeArray(sh.rows) : (Array.isArray(sh.rows) ? sh.rows : []);
                    const rLen = rows.length;

                    for (let m = 0; m < rLen; m++) {
                        const r = rows[m];
                        if (!r) continue;

                        totCalAayi += safeInt(r.aayiQty !== undefined ? r.aayiQty : r.aai);
                        totCalGayi += safeInt(r.gayiQty !== undefined ? r.gayiQty : r.gai);
                        totDamagePcs += safeInt(r.damagePcs !== undefined ? r.damagePcs : r.dmg);
                    }
                }
            }

            // Accurate Damage Accounting: Pending = Gayi - (Tayyar Aayi + Damaged Pcs)
            const pending = Math.max(0, totCalGayi - (totCalAayi + totDamagePcs));

            const result = {
                totFinished: totCalAayi,
                totGayi: totCalGayi,
                pendingInCalender: pending,
                totDamage: totDamagePcs
            };

            CALENDER_STATS_CACHE = result;
            return result;

        } catch (err) {
            console.error('[CalenderCalcEngine] Calculation error:', err);
            return { ...defaultStats };
        }
    };

    /* ========================================================================
       5. GLOBAL EXPORT
       ======================================================================== */
    const calenderCalcAPI = Object.freeze({
        getCalenderFinishedLiveStats,
        invalidateCalenderCalcCache,
        safeInt,
        safeNum
    });

    window.getCalenderFinishedLiveStats = getCalenderFinishedLiveStats;
    window.invalidateCalenderCalcCache = invalidateCalenderCalcCache;
    window.CalenderCalcEngine = calenderCalcAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = calenderCalcAPI;
    }
})();
