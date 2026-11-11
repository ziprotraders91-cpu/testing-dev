/* ========================================================
   SIMPLICITY ERP - BANA STOCK CALCULATION ENGINE
   File: bana/bana-calc.js • Developed by Farhan Jawed
   (Multi-Godam Stock, Inter-Transfer & Passbook Reconcile)
   [FIXED: Sheet-Level Default Item & Zero-Leakage Kariger Match]
======================================================== */

var currentBanaKarkhanaFilter = "all";

var normalizeGodownId = function(id) {
    if (!id || id === 'all') return 'all';
    var clean = String(id).trim();
    return (!clean || clean === 'k_main') ? 'k_main' : clean;
};

/**
 * 1. Kisi specific Bana Item ka wazan calculate karna (Aaya, Gaya, Bacha)
 * @param {string} itemName - Bana ka naam (e.g. 2/120, 2/80 etc.)
 * @param {string} targetKarkhanaId - 'all', 'k_main', ya branch karkhana id
 */
function getBanaItemStats(itemName, targetKarkhanaId) {
    var kId = normalizeGodownId(targetKarkhanaId || currentBanaKarkhanaFilter || "all");
    var cleanName = String(itemName || "").trim();
    var nameLower = cleanName.toLowerCase();

    if (!cleanName) {
        return { name: "", date: "", aaya: 0, gaya: 0, bacha: 0 };
    }

    var totalAaya = 0;
    var totalGaya = 0;
    var lastDate = "";

    var bStock = safeArray(getStore("bana_stock"));
    var transfers = safeArray(getStore("material_transfers")).filter(function(t) { 
        return t && t.type === "bana"; 
    });
    var allKarigers = (typeof sanitizeKarigerList === "function") 
        ? sanitizeKarigerList() 
        : safeArray(getStore("kariger_list"));

    // Check karein ki godam me kul kitne alag-alag bana items hain
    var uniqueItemCount = 0;
    var seenNames = [];
    bStock.forEach(function(b) {
        if (b && b.name) {
            var n = b.name.trim().toLowerCase();
            if (seenNames.indexOf(n) === -1) {
                seenNames.push(n);
                uniqueItemCount++;
            }
        }
    });

    // Helper match rule: Item name strictly match hona chahiye
    var isItemMatch = function(rowItemName) {
        var rN = (rowItemName || "").trim().toLowerCase();
        if (rN === nameLower) return true;
        if (!rN && uniqueItemCount <= 1) return true; // Business me sirf 1 hi item ho toh bina naam wala count hoga
        return false;
    };

    // --- CASE 1: SABHI KARKHANE (TOTAL CONSOLIDATED VIEW) ---
    if (kId === "all") {
        // 1. All Direct Purchases / Openings across all branches
        bStock.forEach(function(b) {
            if (b && b.name && b.name.trim().toLowerCase() === nameLower) {
                totalAaya += (Number(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0)) || 0);
                if (b.date && (!lastDate || b.date > lastDate)) lastDate = b.date;
            }
        });

        // 2. All Kariger Consumption across all branches (Line + Sheet Default Match)
        allKarigers.forEach(function(k) {
            var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                var defaultSheetItem = (sh.banaItem || "").trim();
                safeArray(sh.rows).forEach(function(r) {
                    if (!r) return;
                    var item = r.banaItemName || r.banaItem || defaultSheetItem;
                    if (isItemMatch(item)) {
                        totalGaya += (Number(r.netBana) || 0);
                        totalAaya += (Number(r.retBana) || 0);
                        if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                    }
                });
            });
        });
    }

    // --- CASE 2: MAIN GODOWN ONLY ---
    else if (kId === "k_main") {
        // 1. Main Godown Purchase / Opening
        bStock.forEach(function(b) {
            var matchK = (!b.karkhanaId || b.karkhanaId === "k_main");
            if (b && matchK && b.name && b.name.trim().toLowerCase() === nameLower) {
                totalAaya += (Number(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0)) || 0);
                if (b.date && (!lastDate || b.date > lastDate)) lastDate = b.date;
            }
        });

        // 2. Transfers Sent OUT to branches (-)
        transfers.forEach(function(t) {
            var fromK = normalizeGodownId(t.fromKarkhanaId);
            if (fromK === "k_main" && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalGaya += (Number(t.qty || t.quantity) || 0);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        // 3. Transfers Received IN from branches (+)
        transfers.forEach(function(t) {
            var toK = normalizeGodownId(t.toKarkhanaId);
            if (toK === "k_main" && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalAaya += (Number(t.qty || t.quantity) || 0);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        // 4. Main Godown Kariger Consumption
        allKarigers.forEach(function(k) {
            var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                var defaultSheetItem = (sh.banaItem || "").trim();
                safeArray(sh.rows).forEach(function(r) {
                    if (!r) return;
                    var rowKarkhana = normalizeGodownId(r.karkhanaId || k.karkhanaId || "k_main");
                    if (rowKarkhana === "k_main") {
                        var item = r.banaItemName || r.banaItem || defaultSheetItem;
                        if (isItemMatch(item)) {
                            totalGaya += (Number(r.netBana) || 0);
                            totalAaya += (Number(r.retBana) || 0);
                            if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                        }
                    }
                });
            });
        });
    }

    // --- CASE 3: BRANCH GODOWN (Mau, Mubarakpur, Bahadurganj etc.) ---
    else {
        // 1. Direct Purchase at Branch
        bStock.forEach(function(b) {
            if (b && String(b.karkhanaId) === String(kId) && b.name && b.name.trim().toLowerCase() === nameLower) {
                totalAaya += (Number(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0)) || 0);
                if (b.date && (!lastDate || b.date > lastDate)) lastDate = b.date;
            }
        });

        // 2. Transfers Received IN from Main/other Godam (+)
        transfers.forEach(function(t) {
            var toK = normalizeGodownId(t.toKarkhanaId);
            if (String(toK) === String(kId) && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalAaya += (Number(t.qty || t.quantity) || 0);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        // 3. Transfers Sent OUT from this branch (-)
        transfers.forEach(function(t) {
            var fromK = normalizeGodownId(t.fromKarkhanaId);
            if (String(fromK) === String(kId) && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalGaya += (Number(t.qty || t.quantity) || 0);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        // 4. Branch Kariger Consumption
        allKarigers.forEach(function(k) {
            var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                var defaultSheetItem = (sh.banaItem || "").trim();
                safeArray(sh.rows).forEach(function(r) {
                    if (!r) return;
                    var rowKarkhana = normalizeGodownId(r.karkhanaId || k.karkhanaId || "k_main");
                    if (String(rowKarkhana) === String(kId)) {
                        var item = r.banaItemName || r.banaItem || defaultSheetItem;
                        if (isItemMatch(item)) {
                            totalGaya += (Number(r.netBana) || 0);
                            totalAaya += (Number(r.retBana) || 0);
                            if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                        }
                    }
                });
            });
        });
    }

    var bacha = Math.max(0, totalAaya - totalGaya);

    return {
        name: cleanName,
        date: lastDate || (typeof getTodayDate === "function" ? getTodayDate() : ""),
        aaya: Number(totalAaya.toFixed(2)),
        gaya: Number(totalGaya.toFixed(2)),
        bacha: Number(bacha.toFixed(2))
    };
}

/**
 * 2. Bana Available Balance Checker
 */
function getBanaAvailableBalance(itemName, karkhanaId) {
    var stats = getBanaItemStats(itemName, karkhanaId);
    return stats.bacha;
}

/**
 * 🌟 3. INTER-KARKHANA BANA TRANSFER ENGINE
 */
function transferBanaStock(date, itemName, fromKarkhanaId, toKarkhanaId, qty, note) {
    var weight = parseFloat(qty) || 0;
    if (weight <= 0) {
        alert("Kripya sahi wazan (Qty) darj karein!");
        return false;
    }

    var sourceKid = normalizeGodownId(fromKarkhanaId);
    var targetKid = normalizeGodownId(toKarkhanaId);

    if (String(sourceKid) === String(targetKid)) {
        alert("Bhejne wala aur Paane wala Godam alag-alag hona chahiye!");
        return false;
    }

    var cleanName = (itemName || "").trim();
    if (!cleanName) {
        alert("Bana Item ka naam chunein!");
        return false;
    }

    var available = getBanaAvailableBalance(cleanName, sourceKid);
    if (weight > available) {
        alert("Bhejne wale godam me sirf " + available.toFixed(2) + " Kg Bana bacha hai! Aap " + weight.toFixed(2) + " Kg transfer nahi kar sakte.");
        return false;
    }

    var cleanDate = date || (typeof getTodayDate === "function" ? getTodayDate() : new Date().toISOString().split("T")[0]);
    var fromName = (typeof getKarkhanaNameById === "function") ? getKarkhanaNameById(sourceKid) : sourceKid;
    var toName = (typeof getKarkhanaNameById === "function") ? getKarkhanaNameById(targetKid) : targetKid;
    var transferRef = "tr_bana_" + Date.now();

    var transfers = safeArray(getStore("material_transfers"));
    transfers.push({
        id: transferRef,
        date: cleanDate,
        type: "bana",
        itemName: cleanName,
        fromKarkhanaId: sourceKid,
        toKarkhanaId: targetKid,
        qty: weight,
        quantity: weight,
        note: note || ("Transfer: " + fromName + " ➔ " + toName),
        timestamp: Date.now()
    });
    setStore("material_transfers", transfers);

    var hist = safeArray(getStore("bana_history"));
    hist.push({
        id: "bhist_out_" + Date.now(),
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
        id: "bhist_in_" + (Date.now() + 1),
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

    setStore("bana_history", hist);

    if (typeof recordTransferEntry === "function") {
        recordTransferEntry({
            id: transferRef,
            date: cleanDate,
            fromKarkhanaId: sourceKid,
            toKarkhanaId: targetKid,
            type: "bana",
            itemName: cleanName,
            quantity: weight,
            remarks: note || ("Bana Transfer: " + fromName + " ➔ " + toName)
        });
    }

    return true;
}

var banaCalcAPI = {
    getBanaItemStats: getBanaItemStats,
    getBanaAvailableBalance: getBanaAvailableBalance,
    transferBanaStock: transferBanaStock
};

Object.keys(banaCalcAPI).forEach(function(fn) { window[fn] = banaCalcAPI[fn]; });
window.BanaCalcEngine = banaCalcAPI;
