/* ========================================================
   SIMPLICITY ERP - BANA STOCK CALCULATION ENGINE
   File: bana/bana-calc.js • Developed by Farhan Jawed
   (Multi-Godam Stock, Inter-Transfer & Passbook Reconcile)
   [ENTERPRISE: Save Lock, Rollback, Strict Godown & Fast Stats]
======================================================== */

var currentBanaKarkhanaFilter = "all";
let isTransferringBana = false;

var normalizeGodownId = function(id) {
    if (!id || id === 'all') return 'all';
    var clean = String(id).trim();
    if (!clean || clean.toLowerCase() === 'all') return 'all';
    return clean === 'k_main' ? 'k_main' : clean;
};

var normalizeRecordGodownId = function(id) {
    if (id === undefined || id === null) return 'k_main';
    var clean = String(id).trim();
    if (!clean || clean === 'k_main') return 'k_main';
    if (clean.toLowerCase() === 'all') return 'all';
    return clean;
};

var safeBanaNum = function(val) {
    var n = Number(val);
    return (typeof isFinite === 'function' ? isFinite(n) : Number.isFinite(n)) ? n : 0;
};

function invalidateBanaCalcCache() {
    // Reserved hook for BackupEngine & StorageEngine cache invalidation
}

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

    // Sirf active (aaya > 0) items count karein taaki 0 Kg dead rows match na bigaadein
    var uniqueItemCount = 0;
    var seenNames = [];
    bStock.forEach(function(b) {
        if (b && b.name) {
            var qtyVal = safeBanaNum(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0));
            if (qtyVal <= 0) return;
            var n = b.name.trim().toLowerCase();
            if (seenNames.indexOf(n) === -1) {
                seenNames.push(n);
                uniqueItemCount++;
            }
        }
    });

    // Helper match rule: Item name strictly match hona chahiye; blank fallback sirf tab jab wahi ek active item ho
    var isItemMatch = function(rowItemName) {
        var rN = String(rowItemName || "").trim().toLowerCase();
        if (rN === nameLower) return true;
        if (!rN && uniqueItemCount === 1 && seenNames[0] === nameLower) return true;
        return false;
    };

    // --- CASE 1: SABHI KARKHANE (TOTAL CONSOLIDATED VIEW) ---
    if (kId === "all") {
        bStock.forEach(function(b) {
            if (b && b.name && b.name.trim().toLowerCase() === nameLower) {
                totalAaya += safeBanaNum(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0));
                if (b.date && (!lastDate || b.date > lastDate)) lastDate = b.date;
            }
        });

        allKarigers.forEach(function(k) {
            var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                var defaultSheetItem = (sh.banaItem || "").trim();
                safeArray(sh.rows).forEach(function(r) {
                    if (!r) return;
                    var item = r.banaItemName || r.banaItem || defaultSheetItem;
                    if (isItemMatch(item)) {
                        totalGaya += safeBanaNum(r.netBana);
                        totalAaya += safeBanaNum(r.retBana);
                        if (r.date && (!lastDate || r.date > lastDate)) lastDate = r.date;
                    }
                });
            });
        });
    }

    // --- CASE 2 & 3: MAIN GODOWN YA SPECIFIC BRANCH GODOWN ---
    else {
        bStock.forEach(function(b) {
            var itemKid = normalizeRecordGodownId(b && b.karkhanaId ? b.karkhanaId : "k_main");
            if (b && itemKid === kId && b.name && b.name.trim().toLowerCase() === nameLower) {
                totalAaya += safeBanaNum(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0));
                if (b.date && (!lastDate || b.date > lastDate)) lastDate = b.date;
            }
        });

        transfers.forEach(function(t) {
            var fromK = normalizeRecordGodownId(t.fromKarkhanaId);
            if (fromK === kId && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalGaya += safeBanaNum(t.qty || t.quantity);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        transfers.forEach(function(t) {
            var toK = normalizeRecordGodownId(t.toKarkhanaId);
            if (toK === kId && t.itemName && t.itemName.trim().toLowerCase() === nameLower) {
                totalAaya += safeBanaNum(t.qty || t.quantity);
                if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
            }
        });

        allKarigers.forEach(function(k) {
            var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
            sheets.forEach(function(sh) {
                var defaultSheetItem = (sh.banaItem || "").trim();
                safeArray(sh.rows).forEach(function(r) {
                    if (!r) return;
                    var rowKarkhana = normalizeRecordGodownId(r.karkhanaId || sh.karkhanaId || k.karkhanaId || "k_main");
                    if (rowKarkhana === kId) {
                        var item = r.banaItemName || r.banaItem || defaultSheetItem;
                        if (isItemMatch(item)) {
                            totalGaya += safeBanaNum(r.netBana);
                            totalAaya += safeBanaNum(r.retBana);
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
 * 1B. Single-Pass Batch Stats (1,000+ Karigers par fast table render ke liye)
 */
function getAllBanaStats(targetKarkhanaId) {
    var kId = normalizeGodownId(targetKarkhanaId || currentBanaKarkhanaFilter || "all");
    var bStock = safeArray(getStore("bana_stock"));
    var transfers = safeArray(getStore("material_transfers")).filter(function(t) {
        return t && t.type === "bana";
    });
    var allKarigers = (typeof sanitizeKarigerList === "function")
        ? sanitizeKarigerList()
        : safeArray(getStore("kariger_list"));

    var statsMap = {};
    var orderList = [];
    var activeNames = [];

    var ensureItem = function(rawName) {
        var clean = String(rawName || "").trim();
        if (!clean) return null;
        var lower = clean.toLowerCase();
        if (!statsMap[lower]) {
            statsMap[lower] = { name: clean, date: "", aaya: 0, gaya: 0 };
            orderList.push(lower);
        }
        return statsMap[lower];
    };

    bStock.forEach(function(b) {
        if (!b || !b.name) return;
        var entry = ensureItem(b.name);
        if (!entry) return;

        var qtyVal = safeBanaNum(b.aaya !== undefined ? b.aaya : (b.qty || b.totalQty || 0));
        var lower = entry.name.toLowerCase();
        if (qtyVal > 0 && activeNames.indexOf(lower) === -1) {
            activeNames.push(lower);
        }

        var itemKid = normalizeRecordGodownId(b.karkhanaId || "k_main");
        if (kId === "all" || itemKid === kId) {
            entry.aaya += qtyVal;
            if (b.date && (!entry.date || b.date > entry.date)) entry.date = b.date;
        }
    });

    if (kId !== "all") {
        transfers.forEach(function(t) {
            if (!t.itemName) return;
            var entry = ensureItem(t.itemName);
            if (!entry) return;
            var fromK = normalizeRecordGodownId(t.fromKarkhanaId);
            var toK = normalizeRecordGodownId(t.toKarkhanaId);
            var q = safeBanaNum(t.qty || t.quantity);
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

    var singleActiveLower = (activeNames.length === 1) ? activeNames[0] : "";

    allKarigers.forEach(function(k) {
        var sheets = (typeof getKarigerSheets === "function") ? getKarigerSheets(k.id) : [];
        sheets.forEach(function(sh) {
            var defaultSheetItem = (sh.banaItem || "").trim();
            safeArray(sh.rows).forEach(function(r) {
                if (!r) return;
                if (kId !== "all") {
                    var rowKarkhana = normalizeRecordGodownId(r.karkhanaId || sh.karkhanaId || k.karkhanaId || "k_main");
                    if (rowKarkhana !== kId) return;
                }
                var rawItem = String(r.banaItemName || r.banaItem || defaultSheetItem || "").trim();
                var targetLower = rawItem ? rawItem.toLowerCase() : singleActiveLower;
                if (!targetLower || !statsMap[targetLower]) return;

                var entry = statsMap[targetLower];
                entry.gaya += safeBanaNum(r.netBana);
                entry.aaya += safeBanaNum(r.retBana);
                if (r.date && (!entry.date || r.date > entry.date)) entry.date = r.date;
            });
        });
    });

    var todayFallback = (typeof getTodayDate === "function" ? getTodayDate() : "");
    var result = [];
    orderList.forEach(function(lower) {
        var e = statsMap[lower];
        var bacha = Math.max(0, e.aaya - e.gaya);
        var aayaRounded = Number(e.aaya.toFixed(2));
        var gayaRounded = Number(e.gaya.toFixed(2));
        var bachaRounded = Number(bacha.toFixed(2));
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
}

/**
 * 2. Bana Available Balance Checker
 */
function getBanaAvailableBalance(itemName, karkhanaId) {
    var stats = getBanaItemStats(itemName, karkhanaId);
    return stats.bacha;
}

/**
 * 🌟 3. INTER-KARKHANA BANA TRANSFER ENGINE (LOCKED & TRANSACTIONAL)
 */
function transferBanaStock(date, itemName, fromKarkhanaId, toKarkhanaId, qty, note) {
    if (isTransferringBana) {
        return { success: false, message: '⏳ Transfer pehle se chal raha hai!' };
    }
    isTransferringBana = true;

    try {
        var rawWeight = parseFloat(qty);
        if (!isFinite(rawWeight) || rawWeight <= 0) {
            return { success: false, message: "Kripya sahi wazan (Qty) darj karein!" };
        }
        var weight = Number(rawWeight.toFixed(2));
        if (weight <= 0) {
            return { success: false, message: "Kripya sahi wazan (Qty) darj karein!" };
        }

        var sourceKid = normalizeGodownId(fromKarkhanaId);
        var targetKid = normalizeGodownId(toKarkhanaId);

        if (!fromKarkhanaId || sourceKid === 'all' || !toKarkhanaId || targetKid === 'all') {
            return { success: false, message: "Kripya sahi Bhejne wala aur Paane wala Godam chunein!" };
        }

        if (String(sourceKid) === String(targetKid)) {
            return { success: false, message: "Bhejne wala aur Paane wala Godam alag-alag hona chahiye!" };
        }

        var cleanName = String(itemName || "").trim();
        if (!cleanName) {
            return { success: false, message: "Bana Item ka naam chunein!" };
        }

        var available = getBanaAvailableBalance(cleanName, sourceKid);
        if (weight > available) {
            return {
                success: false,
                message: "Bhejne wale godam me sirf " + available.toFixed(2) + " Kg Bana bacha hai! Aap " + weight.toFixed(2) + " Kg transfer nahi kar sakte."
            };
        }

        var cleanDate = date || (typeof getTodayDate === "function" ? getTodayDate() : new Date().toISOString().split("T")[0]);
        var fromName = (typeof getKarkhanaNameById === "function") ? getKarkhanaNameById(sourceKid) : sourceKid;
        var toName = (typeof getKarkhanaNameById === "function") ? getKarkhanaNameById(targetKid) : targetKid;
        var nowTs = Date.now();
        var uidSuffix = Math.random().toString(36).slice(2, 6);
        var transferRef = "tr_bana_" + nowTs + "_" + uidSuffix;

        // Snapshot for Rollback
        var snapTransfers = JSON.parse(JSON.stringify(safeArray(getStore("material_transfers"))));
        var snapBanaHist = JSON.parse(JSON.stringify(safeArray(getStore("bana_history"))));
        var hasTransferLog = (typeof recordTransferEntry === "function");
        var snapKarkhanaTransfers = hasTransferLog
            ? JSON.parse(JSON.stringify(safeArray(getStore("karkhana_transfers"))))
            : null;

        try {
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
                timestamp: nowTs
            });
            setStore("material_transfers", transfers);

            var hist = safeArray(getStore("bana_history"));
            hist.push({
                id: "bhist_out_" + nowTs + "_" + uidSuffix,
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
                id: "bhist_in_" + (nowTs + 1) + "_" + uidSuffix,
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

            setStore("bana_history", hist);

            if (hasTransferLog) {
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

            return {
                success: true,
                message: "✅ " + weight.toFixed(2) + " Kg Bana safalta-poorvak transfer ho gaya!"
            };
        } catch (error) {
            console.error('[Bana Transfer Failed]', error);
            // ROLLBACK
            try {
                setStore("material_transfers", snapTransfers);
                setStore("bana_history", snapBanaHist);
                if (hasTransferLog && snapKarkhanaTransfers !== null) {
                    setStore("karkhana_transfers", snapKarkhanaTransfers);
                }
            } catch (rbErr) {
                console.error('[Bana Transfer Rollback Error]', rbErr);
            }
            return {
                success: false,
                message: "❌ Transfer fail: " + (error && error.message ? error.message : error)
            };
        }
    } finally {
        isTransferringBana = false;
    }
}

var banaCalcAPI = {
    getBanaItemStats: getBanaItemStats,
    getAllBanaStats: getAllBanaStats,
    getBanaAvailableBalance: getBanaAvailableBalance,
    transferBanaStock: transferBanaStock,
    invalidateBanaCalcCache: invalidateBanaCalcCache
};

Object.keys(banaCalcAPI).forEach(function(fn) { window[fn] = banaCalcAPI[fn]; });
window.BanaCalcEngine = banaCalcAPI;
