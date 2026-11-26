/* ========================================================
   SIMPLICITY ERP - ACCURATE ZARI STOCK CALCULATION ENGINE
   File: zari/zari-calc.js • Developed by Farhan Jawed
   (Accurate Calculation + Save Lock, Rollback & Fast Stats)
======================================================== */

(() => {
    'use strict';

    window.currentZariKarkhanaFilter = "all";
    let isTransferringZari = false;

    const roundWeight = (val) => {
        const num = parseFloat(val);
        return isNaN(num) || !isFinite(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const normalizeGodownId = (id) => {
        if (!id || id === 'all') return 'all';
        const clean = String(id).trim();
        if (!clean || clean.toLowerCase() === 'all') return 'all';
        return clean === 'k_main' ? 'k_main' : clean;
    };

    const normalizeRecordGodownId = (id) => {
        if (id === undefined || id === null) return 'k_main';
        const clean = String(id).trim();
        if (!clean || clean === 'k_main') return 'k_main';
        if (clean.toLowerCase() === 'all') return 'all';
        return clean;
    };

    const invalidateZariCalcCache = () => {
        // Reserved hook for BackupEngine & StorageEngine cache invalidation
    };

    /**
     * 1. Kisi specific Zari Item ka wazan calculate karna (Aaya, Gaya, Bacha)
     */
    const getZariItemStats = (itemName, targetKarkhanaId) => {
        const kId = normalizeGodownId(targetKarkhanaId || window.currentZariKarkhanaFilter || "all");
        const cleanName = String(itemName || '').trim();
        const nameLower = cleanName.toLowerCase();

        if (!cleanName) {
            return { name: '', date: '', aaya: 0, gaya: 0, bacha: 0 };
        }

        let totalAaya = 0;
        let totalGaya = 0;
        let lastDate = "";

        const zStock = window.safeArray ? window.safeArray(window.getStore("zari_stock")) : [];
        const transfers = (window.safeArray ? window.safeArray(window.getStore("material_transfers")) : []).filter(function(t) {
            return t && t.type === "zari";
        });
        const allKarigers = (typeof window.sanitizeKarigerList === "function")
            ? window.sanitizeKarigerList()
            : (window.safeArray ? window.safeArray(window.getStore("kariger_list")) : []);

        // Sirf active (aaya > 0) items count karein taaki 0 Kg dead rows match na bigaadein
        let uniqueItemCount = 0;
        const seenNames = [];
        zStock.forEach(function(z) {
            if (z && z.name) {
                const qtyVal = safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                if (qtyVal <= 0) return;
                const n = z.name.trim().toLowerCase();
                if (seenNames.indexOf(n) === -1) {
                    seenNames.push(n);
                    uniqueItemCount++;
                }
            }
        });

        // Helper match rule: Item name strictly match hona chahiye; blank fallback sirf tab jab wahi ek active item ho
        const isItemMatch = function(rowItemName) {
            const rN = String(rowItemName || "").trim().toLowerCase();
            if (rN === nameLower) return true;
            if (!rN && uniqueItemCount === 1 && seenNames[0] === nameLower) return true;
            return false;
        };

        // --- CASE 1: SABHI KARKHANE (TOTAL CONSOLIDATED VIEW) ---
        if (kId === "all") {
            zStock.forEach(function(z) {
                if (z && z.name && z.name.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                    if (z.date && (!lastDate || z.date > lastDate)) lastDate = z.date;
                }
            });

            allKarigers.forEach(function(k) {
                const sheets = (typeof window.getKarigerSheets === "function") ? window.getKarigerSheets(k.id) : [];
                sheets.forEach(function(sh) {
                    const defaultSheetItem = (sh.zariItem || '').trim();
                    const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                    rows.forEach(function(r) {
                        if (!r) return;
                        const item = r.zariItemName || r.zariItem || defaultSheetItem;
                        if (isItemMatch(item)) {
                            totalGaya += safeNum(r.netZari);
                            totalAaya += safeNum(r.retZari);
                            if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                        }
                    });
                });
            });
        }

        // --- CASE 2 & 3: MAIN GODOWN YA SPECIFIC BRANCH GODOWN ---
        else {
            zStock.forEach(function(z) {
                const itemKid = normalizeRecordGodownId(z && z.karkhanaId ? z.karkhanaId : "k_main");
                if (z && itemKid === kId && z.name && z.name.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                    if (z.date && (!lastDate || z.date > lastDate)) lastDate = z.date;
                }
            });

            transfers.forEach(function(t) {
                const fromK = normalizeRecordGodownId(t.fromKarkhanaId);
                if (fromK === kId && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalGaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            transfers.forEach(function(t) {
                const toK = normalizeRecordGodownId(t.toKarkhanaId);
                if (toK === kId && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            allKarigers.forEach(function(k) {
                const sheets = (typeof window.getKarigerSheets === "function") ? window.getKarigerSheets(k.id) : [];
                sheets.forEach(function(sh) {
                    const defaultSheetItem = (sh.zariItem || '').trim();
                    const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                    rows.forEach(function(r) {
                        if (!r) return;
                        const rowKarkhana = normalizeRecordGodownId(r.karkhanaId || sh.karkhanaId || k.karkhanaId || "k_main");
                        if (rowKarkhana === kId) {
                            const item = r.zariItemName || r.zariItem || defaultSheetItem;
                            if (isItemMatch(item)) {
                                totalGaya += safeNum(r.netZari);
                                totalAaya += safeNum(r.retZari);
                                if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                            }
                        }
                    });
                });
            });
        }

        const bacha = Math.max(0, totalAaya - totalGaya);

        return {
            name: cleanName,
            date: lastDate || (typeof window.getTodayDate === "function" ? window.getTodayDate() : ""),
            aaya: roundWeight(totalAaya),
            gaya: roundWeight(totalGaya),
            bacha: roundWeight(bacha)
        };
    };

    /**
     * 1B. Single-Pass Batch Stats (1,000+ Karigers par fast table render ke liye)
     */
    const getAllZariStats = (targetKarkhanaId) => {
        const kId = normalizeGodownId(targetKarkhanaId || window.currentZariKarkhanaFilter || "all");
        const zStock = window.safeArray ? window.safeArray(window.getStore("zari_stock")) : [];
        const transfers = (window.safeArray ? window.safeArray(window.getStore("material_transfers")) : []).filter(function(t) {
            return t && t.type === "zari";
        });
        const allKarigers = (typeof window.sanitizeKarigerList === "function")
            ? window.sanitizeKarigerList()
            : (window.safeArray ? window.safeArray(window.getStore("kariger_list")) : []);

        const statsMap = {};
        const orderList = [];
        const activeNames = [];

        const ensureItem = (rawName) => {
            const clean = String(rawName || '').trim();
            if (!clean) return null;
            const lower = clean.toLowerCase();
            if (!statsMap[lower]) {
                statsMap[lower] = { name: clean, date: '', aaya: 0, gaya: 0 };
                orderList.push(lower);
            }
            return statsMap[lower];
        };

        zStock.forEach(function(z) {
            if (!z || !z.name) return;
            const entry = ensureItem(z.name);
            if (!entry) return;

            const qtyVal = safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
            const lower = entry.name.toLowerCase();
            if (qtyVal > 0 && activeNames.indexOf(lower) === -1) {
                activeNames.push(lower);
            }

            const itemKid = normalizeRecordGodownId(z.karkhanaId || "k_main");
            if (kId === "all" || itemKid === kId) {
                entry.aaya += qtyVal;
                if (z.date && (!entry.date || z.date > entry.date)) entry.date = z.date;
            }
        });

        if (kId !== "all") {
            transfers.forEach(function(t) {
                if (!t.itemName) return;
                const entry = ensureItem(t.itemName);
                if (!entry) return;
                const fromK = normalizeRecordGodownId(t.fromKarkhanaId);
                const toK = normalizeRecordGodownId(t.toKarkhanaId);
                const q = safeNum(t.qty || t.quantity);
                if (fromK === kId) {
                    entry.gaya += q;
                    if (t.date && (!entry.date || t.date > entry.date)) entry.date = t.date;
                }
                if (toK === kId) {
                    entry.aaya += q;
                    if (t.date && (!entry.date || t.date > entry.date)) entry.date = t.date;
                }
            });
        }

        const singleActiveLower = (activeNames.length === 1) ? activeNames[0] : "";

        allKarigers.forEach(function(k) {
            const sheets = (typeof window.getKarigerSheets === "function") ? window.getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                const defaultSheetItem = (sh.zariItem || '').trim();
                const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                rows.forEach(function(r) {
                    if (!r) return;
                    if (kId !== "all") {
                        const rowKarkhana = normalizeRecordGodownId(r.karkhanaId || sh.karkhanaId || k.karkhanaId || "k_main");
                        if (rowKarkhana !== kId) return;
                    }
                    const rawItem = String(r.zariItemName || r.zariItem || defaultSheetItem || '').trim();
                    const targetLower = rawItem ? rawItem.toLowerCase() : singleActiveLower;
                    if (!targetLower || !statsMap[targetLower]) return;

                    const entry = statsMap[targetLower];
                    entry.gaya += safeNum(r.netZari);
                    entry.aaya += safeNum(r.retZari);
                    if (r.date && (!entry.date || r.date > entry.date)) entry.date = r.date;
                });
            });
        });

        const todayFallback = (typeof window.getTodayDate === "function" ? window.getTodayDate() : "");
        const result = [];
        orderList.forEach(function(lower) {
            const e = statsMap[lower];
            const bacha = Math.max(0, e.aaya - e.gaya);
            const aayaRounded = roundWeight(e.aaya);
            const gayaRounded = roundWeight(e.gaya);
            const bachaRounded = roundWeight(bacha);
            if (aayaRounded > 0 || gayaRounded > 0 || bachaRounded > 0) {
                result.push({
                    name: e.name,
                    date: e.date || todayFallback,
                    aaya: aayaRounded,
                    gaya: gayaRounded,
                    bacha: bachaRounded
                });
            }
        });

        return result;
    };

    /**
     * 2. Zari Available Balance Checker
     */
    const getZariAvailableBalance = (itemName, karkhanaId) => {
        const stats = getZariItemStats(itemName, karkhanaId);
        return stats.bacha;
    };

    /**
     * 3. Inter-Karkhana Zari Transfer Engine (Locked & Rollback Safe)
     */
    const transferZariStock = (date, itemName, fromKarkhanaId, toKarkhanaId, qty, note) => {
        if (isTransferringZari) {
            alert("⏳ Transfer pehle se chal raha hai!");
            return false;
        }
        isTransferringZari = true;

        try {
            const weight = roundWeight(qty);
            if (weight <= 0) {
                alert("Kripya sahi wazan (Qty) darj karein!");
                return false;
            }

            const sourceKid = normalizeGodownId(fromKarkhanaId);
            const targetKid = normalizeGodownId(toKarkhanaId);

            if (!fromKarkhanaId || sourceKid === 'all' || !toKarkhanaId || targetKid === 'all') {
                alert("Kripya sahi Bhejne wala aur Paane wala Godam chunein!");
                return false;
            }

            if (sourceKid === targetKid) {
                alert("Bhejne wala aur Paane wala Godam alag-alag hona chahiye!");
                return false;
            }

            const cleanName = String(itemName || "").trim();
            if (!cleanName) {
                alert("Zari Item ka naam chunein!");
                return false;
            }

            const available = getZariAvailableBalance(cleanName, sourceKid);
            if (weight > available) {
                alert("Bhejne wale godam me sirf " + available.toFixed(2) + " Kg Zari bachi hai! Aap " + weight.toFixed(2) + " Kg transfer nahi kar sakte.");
                return false;
            }

            const cleanDate = date || (typeof window.getTodayDate === "function" ? window.getTodayDate() : new Date().toISOString().split("T")[0]);
            const fromName = (typeof window.getKarkhanaNameById === "function") ? window.getKarkhanaNameById(sourceKid) : sourceKid;
            const toName = (typeof window.getKarkhanaNameById === "function") ? window.getKarkhanaNameById(targetKid) : targetKid;
            const nowTs = Date.now();
            const uidSuffix = Math.random().toString(36).slice(2, 6);
            const transferRef = "tr_zari_" + nowTs + "_" + uidSuffix;

            const snapTransfers = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore("material_transfers")) : []));
            const snapZariHist = JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore("zari_history")) : []));
            const hasTransferLog = (typeof window.recordTransferEntry === "function");
            const snapKarkhanaTransfers = hasTransferLog
                ? JSON.parse(JSON.stringify(window.safeArray ? window.safeArray(window.getStore("karkhana_transfers")) : []))
                : null;

            try {
                const transfers = window.safeArray ? window.safeArray(window.getStore("material_transfers")) : [];
                transfers.push({
                    id: transferRef,
                    date: cleanDate,
                    type: "zari",
                    itemName: cleanName,
                    fromKarkhanaId: sourceKid,
                    toKarkhanaId: targetKid,
                    qty: weight,
                    quantity: weight,
                    note: note || ("Transfer: " + fromName + " ➔ " + toName),
                    timestamp: nowTs
                });
                if (typeof window.setStore === "function") window.setStore("material_transfers", transfers);

                const hist = window.safeArray ? window.safeArray(window.getStore("zari_history")) : [];
                hist.push({
                    id: "zhist_out_" + nowTs + "_" + uidSuffix,
                    date: cleanDate,
                    name: cleanName,
                    kariger: "Godown Transfer",
                    type: "Transfer Out ➔ " + toName + (note ? " (" + note + ")" : ""),
                    aaya: 0,
                    gaya: weight,
                    karkhanaId: sourceKid,
                    refId: transferRef,
                    timestamp: nowTs
                });

                hist.push({
                    id: "zhist_in_" + (nowTs + 1) + "_" + uidSuffix,
                    date: cleanDate,
                    name: cleanName,
                    kariger: "Godown Transfer",
                    type: "Transfer In ⬅ " + fromName + (note ? " (" + note + ")" : ""),
                    aaya: weight,
                    gaya: 0,
                    karkhanaId: targetKid,
                    refId: transferRef,
                    timestamp: nowTs + 1
                });
                if (typeof window.setStore === "function") window.setStore("zari_history", hist);

                if (hasTransferLog) {
                    window.recordTransferEntry({
                        id: transferRef,
                        date: cleanDate,
                        fromKarkhanaId: sourceKid,
                        toKarkhanaId: targetKid,
                        type: "zari",
                        itemName: cleanName,
                        quantity: weight,
                        remarks: note || ("Zari Transfer: " + fromName + " ➔ " + toName)
                    });
                }

                return true;
            } catch (err) {
                console.error('[ZariTransfer Failed]', err);
                try {
                    if (typeof window.setStore === "function") {
                        window.setStore("material_transfers", snapTransfers);
                        window.setStore("zari_history", snapZariHist);
                        if (hasTransferLog && snapKarkhanaTransfers !== null) {
                            window.setStore("karkhana_transfers", snapKarkhanaTransfers);
                        }
                    }
                } catch (rbErr) {
                    console.error('[ZariTransfer Rollback Error]', rbErr);
                }
                alert("❌ Transfer save karne me dikkat aayi — purana data surakshit hai!");
                return false;
            }
        } finally {
            isTransferringZari = false;
        }
    };

    const zariCalcAPI = {
        getZariItemStats,
        getAllZariStats,
        getZariAvailableBalance,
        transferZariStock,
        invalidateZariCalcCache,
        roundWeight
    };

    Object.keys(zariCalcAPI).forEach((fn) => { window[fn] = zariCalcAPI[fn]; });
    window.ZariCalcEngine = zariCalcAPI;
})();
