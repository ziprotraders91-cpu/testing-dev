/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE SAREE INVENTORY & PIPELINE ENGINE
   File: saree/saree-calc.js • Developed by Farhan Jawed
   Stages: Fresh ➔ Cutting ➔ Embroidery ➔ Finished ➔ Lott
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & CACHE
       ======================================================================== */
    const SAREE_TAB_CACHE = new Map();

    const invalidateSareeCalcCache = () => {
        SAREE_TAB_CACHE.clear();
    };

    /* ========================================================================
       2. TYPE-SAFE NORMALIZERS & NUMERIC PARSERS
       ======================================================================== */
    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const normText = (txt, fallback = '') => {
        return String(txt || fallback).trim().toUpperCase();
    };

    const normTab = (tab) => {
        const clean = String(tab || 'fresh').trim().toLowerCase();
        if (clean === 'cutting' || clean === 'cut') return 'cutting';
        if (clean === 'embroidery' || clean === 'emb') return 'embroidery';
        if (clean === 'finished' || clean === 'finish' || clean === 'calender') return 'finished';
        if (clean === 'lott' || clean === 'lot' || clean === 'damage') return 'lott';
        return 'fresh';
    };

    const normGodownId = (kid) => {
        if (!kid || kid === 'all') return 'all';
        const clean = String(kid).trim();
        return (!clean || clean === 'k_main') ? 'k_main' : clean;
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
    };

    const getGodownDisplayName = (kid) => {
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kid);
        }
        return (!kid || kid === 'k_main') ? 'Main Godown' : 'Godown';
    };

    /* ========================================================================
       3. KARIGER SHEET INWARD & OUTWARD LEDGER SYNC
       ======================================================================== */
    const recordSareeFromKariger = (date, sareeName, karigerName, karkhanaId, sareeQty, lottQty, refId = '') => {
        const sQty = safeInt(sareeQty);
        const lQty = safeInt(lottQty);

        if (sQty <= 0 && lQty <= 0) return;

        const cleanDate = date || getToday();
        const cleanSaree = normText(sareeName, 'GENERAL SAREE');
        const cleanKariger = normText(karigerName, 'KARIGER');
        const kid = normGodownId(karkhanaId);

        try {
            const history = window.safeArray 
                ? window.safeArray(window.getStore('saree_history')) 
                : (JSON.parse(localStorage.getItem('saree_history') || '[]'));

            const now = Date.now();

            if (sQty > 0) {
                history.push({
                    id: `saree_in_${now}_f`,
                    date: cleanDate,
                    sareeName: cleanSaree,
                    karigerName: cleanKariger,
                    kariger: cleanKariger,
                    karkhanaId: kid,
                    type: 'fresh',
                    typeLabel: 'Fresh Saree (Kariger Sheet)',
                    aai: sQty,
                    gai: 0,
                    isOut: false,
                    refId: String(refId || ''),
                    timestamp: now
                });
            }

            if (lQty > 0) {
                history.push({
                    id: `saree_in_${now + 1}_l`,
                    date: cleanDate,
                    sareeName: cleanSaree,
                    karigerName: cleanKariger,
                    kariger: cleanKariger,
                    karkhanaId: kid,
                    type: 'lott',
                    typeLabel: 'Lott Saree (Kariger Sheet)',
                    aai: lQty,
                    gai: 0,
                    isOut: false,
                    refId: String(refId || ''),
                    timestamp: now + 1
                });
            }

            if (typeof window.setStore === 'function') {
                window.setStore('saree_history', history);
            } else {
                localStorage.setItem('saree_history', JSON.stringify(history));
            }

            invalidateSareeCalcCache();
        } catch (err) {
            console.error('[SareeCalcEngine] recordSareeFromKariger failure:', err);
        }
    };

    const removeSareeByRefId = (refId) => {
        if (!refId) return;
        const targetRef = String(refId).trim();

        try {
            let history = window.safeArray 
                ? window.safeArray(window.getStore('saree_history')) 
                : (JSON.parse(localStorage.getItem('saree_history') || '[]'));

            history = history.filter((item) => !item || String(item.refId) !== targetRef);

            if (typeof window.setStore === 'function') {
                window.setStore('saree_history', history);
            } else {
                localStorage.setItem('saree_history', JSON.stringify(history));
            }

            invalidateSareeCalcCache();
        } catch (err) {
            console.error('[SareeCalcEngine] removeSareeByRefId failure:', err);
        }
    };

    /* ========================================================================
       4. INTER-BRANCH SAREE TRANSFER ENGINE
       ======================================================================== */
    const transferSareeBetweenKarkhana = (date, sareeName, karigerName, fromKarkhanaId, toKarkhanaId, pcs, currentTab = 'fresh', note = '') => {
        const qty = safeInt(pcs);
        if (qty <= 0) {
            alert('Valid Saree sankhya (Pcs) darj karein!');
            return false;
        }

        const sourceKid = normGodownId(fromKarkhanaId);
        const targetKid = normGodownId(toKarkhanaId);

        if (sourceKid === targetKid) {
            alert('Bhejne wala aur Paane wala Godam alag-alag hona chahiye!');
            return false;
        }

        const cleanSaree = normText(sareeName);
        const cleanKariger = normText(karigerName);
        const sourceTab = normTab(currentTab);

        if (!cleanSaree) {
            alert('Saree Design ka naam zaroori hai!');
            return false;
        }

        const available = getSareeAvailableBalance(cleanSaree, cleanKariger, sourceKid, sourceTab);
        if (qty > available) {
            alert(`Stock me sirf ${available} Pcs maujood hain! Aap ${qty} Pcs transfer nahi kar sakte.`);
            return false;
        }

        try {
            const cleanDate = date || getToday();
            const fromName = getGodownDisplayName(sourceKid);
            const toName = getGodownDisplayName(targetKid);
            const transferRef = `tr_saree_${Date.now()}`;
            const destinationTab = (targetKid === 'k_main') ? 'fresh' : sourceTab;

            const history = window.safeArray 
                ? window.safeArray(window.getStore('saree_history')) 
                : (JSON.parse(localStorage.getItem('saree_history') || '[]'));

            const now = Date.now();

            history.push({
                id: `saree_out_${now}_tr`,
                date: cleanDate,
                sareeName: cleanSaree,
                karigerName: cleanKariger,
                kariger: cleanKariger,
                karkhanaId: sourceKid,
                type: sourceTab,
                typeLabel: `Transfer Out ➔ ${toName}${note ? ` (${note})` : ''}`,
                aai: 0,
                gai: qty,
                isOut: true,
                refId: transferRef,
                timestamp: now
            });

            history.push({
                id: `saree_in_${now + 1}_tr`,
                date: cleanDate,
                sareeName: cleanSaree,
                karigerName: cleanKariger,
                kariger: cleanKariger,
                karkhanaId: targetKid,
                type: destinationTab,
                typeLabel: `Transfer In ⬅ ${fromName}${destinationTab === 'fresh' ? ' (Fresh Stock)' : ''}${note ? ` (${note})` : ''}`,
                aai: qty,
                gai: 0,
                isOut: false,
                refId: transferRef,
                timestamp: now + 1
            });

            if (typeof window.setStore === 'function') {
                window.setStore('saree_history', history);
            } else {
                localStorage.setItem('saree_history', JSON.stringify(history));
            }

            if (typeof window.recordTransferEntry === 'function') {
                window.recordTransferEntry({
                    id: transferRef,
                    date: cleanDate,
                    fromKarkhanaId: sourceKid,
                    toKarkhanaId: targetKid,
                    type: 'saree',
                    targetStock: destinationTab,
                    sareeName: cleanSaree,
                    karigerName: cleanKariger,
                    quantity: qty,
                    remarks: note || `Saree Transfer: ${fromName} ➔ ${toName}`
                });
            }

            invalidateSareeCalcCache();
            return true;
        } catch (err) {
            console.error('[SareeCalcEngine] transferSareeBetweenKarkhana failure:', err);
            alert('Transfer record save karne me dikkat aayi.');
            return false;
        }
    };

    /* ========================================================================
       5. ATOMIC PIPELINE STAGE MOVE
       ======================================================================== */
    const moveSareePipelineStage = (date, sareeName, karigerName, karkhanaId, pcs, fromTab, toTab, note = '') => {
        const qty = safeInt(pcs);
        if (qty <= 0) {
            alert('Valid Pcs sankhya darj karein!');
            return false;
        }

        const cleanSaree = normText(sareeName);
        const cleanKariger = normText(karigerName);
        const kid = normGodownId(karkhanaId);
        const sourceTab = normTab(fromTab);
        const targetTab = normTab(toTab);

        if (sourceTab === targetTab) {
            alert('Source aur Destination alag hone chahiye!');
            return false;
        }

        const available = getSareeAvailableBalance(cleanSaree, cleanKariger, kid, sourceTab);
        if (qty > available) {
            alert(`Is stage me sirf ${available} Pcs hain! Aap ${qty} move nahi kar sakte.`);
            return false;
        }

        try {
            const cleanDate = date || getToday();
            const stageRef = `stage_move_${Date.now()}`;
            const stageNames = {
                fresh: 'Fresh',
                cutting: 'Cutting',
                embroidery: 'Embroidery',
                finished: 'Finished',
                lott: 'Lott'
            };

            const history = window.safeArray 
                ? window.safeArray(window.getStore('saree_history')) 
                : (JSON.parse(localStorage.getItem('saree_history') || '[]'));

            const now = Date.now();

            history.push({
                id: `saree_stage_out_${now}`,
                date: cleanDate,
                sareeName: cleanSaree,
                karigerName: cleanKariger,
                kariger: cleanKariger,
                karkhanaId: kid,
                type: sourceTab,
                typeLabel: `Moved ➔ ${stageNames[targetTab] || targetTab}${note ? ` (${note})` : ''}`,
                aai: 0,
                gai: qty,
                isOut: true,
                refId: stageRef,
                timestamp: now
            });

            history.push({
                id: `saree_stage_in_${now + 1}`,
                date: cleanDate,
                sareeName: cleanSaree,
                karigerName: cleanKariger,
                kariger: cleanKariger,
                karkhanaId: kid,
                type: targetTab,
                typeLabel: `Received ⬅ ${stageNames[sourceTab] || sourceTab}${note ? ` (${note})` : ''}`,
                aai: qty,
                gai: 0,
                isOut: false,
                refId: stageRef,
                timestamp: now + 1
            });

            if (typeof window.setStore === 'function') {
                window.setStore('saree_history', history);
            } else {
                localStorage.setItem('saree_history', JSON.stringify(history));
            }

            invalidateSareeCalcCache();
            return true;
        } catch (err) {
            console.error('[SareeCalcEngine] moveSareePipelineStage failure:', err);
            alert('Stage transition update karne me dikkat aayi.');
            return false;
        }
    };

    /* ========================================================================
       6. MEMOIZED AVAILABLE BALANCE RESOLVER
       ======================================================================== */
    const getSareeAvailableBalance = (sareeName, karigerName, karkhanaId, tabName = 'fresh') => {
        const targetSaree = normText(sareeName);
        const targetKariger = normText(karigerName);
        const targetKid = normGodownId(karkhanaId);
        const targetTab = normTab(tabName);

        if (!targetSaree) return 0;

        const historyList = window.safeArray 
            ? window.safeArray(window.getStore('saree_history')) 
            : (JSON.parse(localStorage.getItem('saree_history') || '[]'));
            
        const rows = groupSareeStockByTab(historyList, targetTab, targetKid);

        const found = rows.find((r) => 
            normText(r.sareeName) === targetSaree && 
            normText(r.karigerName) === targetKariger && 
            normGodownId(r.karkhanaId) === targetKid
        );

        return found ? safeInt(found.bachi) : 0;
    };

    /* ========================================================================
       7. GROUPED SAREE STOCK BY TAB
       ======================================================================== */
    const groupSareeStockByTab = (historyList, currentTab = 'fresh', karkhanaFilter = 'all') => {
        const targetTab = normTab(currentTab);
        const kId = normGodownId(karkhanaFilter);

        const cacheKey = `${targetTab}___${kId}`;
        if (SAREE_TAB_CACHE.has(cacheKey)) {
            return SAREE_TAB_CACHE.get(cacheKey);
        }

        const map = new Map();
        const list = window.safeArray 
            ? window.safeArray(historyList) 
            : (Array.isArray(historyList) ? historyList : []);
        const len = list.length;

        for (let i = 0; i < len; i++) {
            const h = list[i];
            if (!h) continue;

            const hType = normTab(h.type);
            if (hType !== targetTab) continue;

            const hKid = normGodownId(h.karkhanaId);
            if (kId !== 'all' && hKid !== kId) continue;

            const sName = normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
            const kName = normText(h.karigerName || h.kariger, 'KARKHANA');
            const rowKey = `${sName}___${kName}___${hKid}`;

            let entry = map.get(rowKey);
            if (!entry) {
                entry = {
                    date: h.date || getToday(),
                    sareeName: sName,
                    karigerName: kName,
                    karkhanaId: hKid,
                    godamName: getGodownDisplayName(hKid),
                    aai: 0,
                    gai: 0,
                    bachi: 0
                };
                map.set(rowKey, entry);
            }

            const isGai = (h.isOut === true) || (safeNum(h.gai) > 0);
            const inQ = isGai ? 0 : safeNum(h.aai !== undefined && h.aai !== null ? h.aai : h.pcs);
            const outQ = isGai ? safeNum(h.gai !== undefined && h.gai !== null ? h.gai : h.pcs) : 0;

            entry.aai += inQ;
            entry.gai += outQ;
            if (h.date && (!entry.date || h.date > entry.date)) {
                entry.date = h.date;
            }
        }

        const rows = [];
        map.forEach((item) => {
            item.bachi = Math.max(0, safeInt(item.aai - item.gai));
            item.aai = safeInt(item.aai);
            item.gai = safeInt(item.gai);
            rows.push(item);
        });

        SAREE_TAB_CACHE.set(cacheKey, rows);
        return rows;
    };

    /* ========================================================================
       8. SEARCH & FILTER HELPERS
       ======================================================================== */
    const searchSareeData = (list, searchText) => {
        if (!searchText || !String(searchText).trim()) return list;
        const query = String(searchText).toLowerCase().trim();

        return (list || []).filter((row) => {
            const rowText = `${row.date || ''} ${row.sareeName || ''} ${row.karigerName || ''} ${row.godamName || ''} ${row.aai || ''} ${row.gai || ''} ${row.bachi || ''}`.toLowerCase();
            return rowText.includes(query);
        });
    };

    const filterPassbookHistory = (historyList, fromDate, toDate, searchTxt) => {
        let filtered = window.safeArray ? window.safeArray(historyList) : (Array.isArray(historyList) ? historyList : []);

        if (fromDate) filtered = filtered.filter((item) => item.date >= fromDate);
        if (toDate) filtered = filtered.filter((item) => item.date <= toDate);

        if (searchTxt && String(searchTxt).trim()) {
            const query = String(searchTxt).toLowerCase().trim();
            filtered = filtered.filter((item) => {
                const fullText = `${item.date || ''} ${item.sareeName || ''} ${item.karigerName || ''} ${item.typeLabel || ''} ${item.aai || ''} ${item.gai || ''}`.toLowerCase();
                return fullText.includes(query);
            });
        }

        return filtered;
    };

    /* ========================================================================
       9. EXPORTS
       ======================================================================== */
    const sareeCalcAPI = {
        recordSareeFromKariger,
        removeSareeByRefId,
        transferSareeBetweenKarkhana,
        moveSareePipelineStage,
        getSareeAvailableBalance,
        groupSareeStockByTab,
        searchSareeData,
        filterPassbookHistory,
        invalidateSareeCalcCache
    };

    Object.keys(sareeCalcAPI).forEach((fnName) => {
        window[fnName] = sareeCalcAPI[fnName];
    });

    window.SareeCalcEngine = sareeCalcAPI;
    window.invalidateSareeCalcCache = invalidateSareeCalcCache;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sareeCalcAPI;
    }
})();
