/* ========================================================
   SIMPLICITY ERP - ACCURATE ZARI STOCK CALCULATION ENGINE
   File: zari/zari-calc.js • Developed by Farhan Jawed
   (Purana Accurate Calculation + Zero Over-Deduction Math)
======================================================== */

(() => {
    'use strict';

    window.currentZariKarkhanaFilter = "all";

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
        return (!clean || clean === 'k_main') ? 'k_main' : clean;
    };

    /**
     * 1. Kisi specific Zari Item ka wazan calculate karna (Aaya, Gaya, Bacha)
     * Purane zari-calc (1).js ka authentic logic
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

        // Check karein ki godam me kul kitne alag-alag zari items hain
        let uniqueItemCount = 0;
        const seenNames = [];
        zStock.forEach(function(z) {
            if (z && z.name) {
                const n = z.name.trim().toLowerCase();
                if (seenNames.indexOf(n) === -1) {
                    seenNames.push(n);
                    uniqueItemCount++;
                }
            }
        });

        // Helper match rule: Item name strictly match hona chahiye (Khali naam se doosre item ka wazan na kate)
        const isItemMatch = function(rowItemName) {
            const rN = (rowItemName || "").trim().toLowerCase();
            if (rN === nameLower) return true;
            if (!rN && uniqueItemCount <= 1) return true;
            return false;
        };

        // --- CASE 1: SABHI KARKHANE (TOTAL CONSOLIDATED VIEW) ---
        if (kId === "all") {
            // 1. Direct Purchases / Openings across all branches
            zStock.forEach(function(z) {
                if (z && z.name && z.name.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                    if (z.date && (!lastDate || z.date > lastDate)) lastDate = z.date;
                }
            });

            // 2. Kariger Consumption across all branches
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

        // --- CASE 2: MAIN GODOWN ONLY ---
        else if (kId === "k_main") {
            // 1. Main Godown Purchase / Opening
            zStock.forEach(function(z) {
                const matchK = (!z.karkhanaId || z.karkhanaId === "k_main");
                if (z && matchK && z.name && z.name.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                    if (z.date && (!lastDate || z.date > lastDate)) lastDate = z.date;
                }
            });

            // 2. Transfers Sent OUT to branches (-)
            transfers.forEach(function(t) {
                const fromK = normalizeGodownId(t.fromKarkhanaId);
                if (fromK === "k_main" && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalGaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            // 3. Transfers Received IN from branches (+)
            transfers.forEach(function(t) {
                const toK = normalizeGodownId(t.toKarkhanaId);
                if (toK === "k_main" && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            // 4. Main Godown Kariger Consumption
            allKarigers.forEach(function(k) {
                const sheets = (typeof window.getKarigerSheets === "function") ? window.getKarigerSheets(k.id) : [];
                sheets.forEach(function(sh) {
                    const defaultSheetItem = (sh.zariItem || '').trim();
                    const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                    rows.forEach(function(r) {
                        if (!r) return;
                        const rowKarkhana = normalizeGodownId(r.karkhanaId || k.karkhanaId || "k_main");
                        if (rowKarkhana === "k_main") {
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

        // --- CASE 3: BRANCH GODOWN ---
        else {
            // 1. Direct Purchase at Branch
            zStock.forEach(function(z) {
                if (z && String(z.karkhanaId) === String(kId) && z.name && z.name.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(z.aaya !== undefined ? z.aaya : (z.qty || z.totalQty));
                    if (z.date && (!lastDate || z.date > lastDate)) lastDate = z.date;
                }
            });

            // 2. Transfers Received IN from Main/other Godam (+)
            transfers.forEach(function(t) {
                const toK = normalizeGodownId(t.toKarkhanaId);
                if (String(toK) === String(kId) && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalAaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            // 3. Transfers Sent OUT from this branch (-)
            transfers.forEach(function(t) {
                const fromK = normalizeGodownId(t.fromKarkhanaId);
                if (String(fromK) === String(kId) && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                    totalGaya += safeNum(t.qty || t.quantity);
                    if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                }
            });

            // 4. Branch Kariger Consumption
            allKarigers.forEach(function(k) {
                const sheets = (typeof window.getKarigerSheets === "function") ? window.getKarigerSheets(k.id) : [];
                sheets.forEach(function(sh) {
                    const defaultSheetItem = (sh.zariItem || '').trim();
                    const rows = window.safeArray ? window.safeArray(sh.rows) : [];
                    rows.forEach(function(r) {
                        if (!r) return;
                        const rowKarkhana = normalizeGodownId(r.karkhanaId || k.karkhanaId || "k_main");
                        if (String(rowKarkhana) === String(kId)) {
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
     * 2. Zari Available Balance Checker
     */
    const getZariAvailableBalance = (itemName, karkhanaId) => {
        const stats = getZariItemStats(itemName, karkhanaId);
        return stats.bacha;
    };

    /**
     * 3. Inter-Karkhana Zari Transfer Engine
     */
    const transferZariStock = (date, itemName, fromKarkhanaId, toKarkhanaId, qty, note) => {
        const weight = safeNum(qty);
        if (weight <= 0) {
            alert("Kripya sahi wazan (Qty) darj karein!");
            return false;
        }

        const sourceKid = normalizeGodownId(fromKarkhanaId);
        const targetKid = normalizeGodownId(toKarkhanaId);

        if (sourceKid === targetKid) {
            alert("Bhejne wala aur Paane wala Godam alag-alag hona chahiye!");
            return false;
        }

        const cleanName = (itemName || "").trim();
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
        const transferRef = "tr_zari_" + Date.now();

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
            timestamp: Date.now()
        });
        if (typeof window.setStore === "function") window.setStore("material_transfers", transfers);

        const hist = window.safeArray ? window.safeArray(window.getStore("zari_history")) : [];
        hist.push({
            id: "zhist_out_" + Date.now(),
            date: cleanDate,
            name: cleanName,
            kariger: "Godown Transfer",
            type: "Transfer Out ➔ " + toName + (note ? " (" + note + ")" : ""),
            aaya: 0,
            gaya: weight,
            karkhanaId: sourceKid,
            refId: transferRef,
            timestamp: Date.now()
        });

        hist.push({
            id: "zhist_in_" + (Date.now() + 1),
            date: cleanDate,
            name: cleanName,
            kariger: "Godown Transfer",
            type: "Transfer In ⬅ " + fromName + (note ? " (" + note + ")" : ""),
            aaya: weight,
            gaya: 0,
            karkhanaId: targetKid,
            refId: transferRef,
            timestamp: Date.now() + 1
        });
        if (typeof window.setStore === "function") window.setStore("zari_history", hist);

        if (typeof window.recordTransferEntry === "function") {
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
    };

    const zariCalcAPI = {
        getZariItemStats,
        getZariAvailableBalance,
        transferZariStock,
        roundWeight
    };

    Object.keys(zariCalcAPI).forEach((fn) => { window[fn] = zariCalcAPI[fn]; });
    window.ZariCalcEngine = zariCalcAPI;
})();
