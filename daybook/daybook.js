/* ============================================================================
   SIMPLICITY ERP - TALLYPRIME ROZANA DAY-BOOK & DASHBOARD ENGINE (v3.5)
   File: daybook/daybook.js • Developed by Farhan Jawed
   100% Synced with: jobwork-trail, jobwork-express, core/tally-master.js
   - Live Saree Stock: Godam (WIP + Finished + Lott) + JobWork (Workers)
   - Dynamic JobWork Groups (Cutting, Embroidery, Calender, Outstation, etc.)
   - Final Out (Dispatch) DayBook + A6 Print
============================================================================ */

(() => {
    'use strict';

    window.currentDayBookTab = 'bana';
    window.currentDashboardKarkhanaFilter = 'all';
    window.badgeCalculationTimer = null;

    // Tally Drill-Down State: 'menu' | 'sancha-menu' | 'saree-menu' | 'report'
    let daybookViewMode = 'menu';
    let daybookMenuActiveIdx = 0;

    // Pagination State (15 Entries / Page)
    let daybookCurrentPage = 1;
    const DAYBOOK_PAGE_SIZE = 15;
    let currentDaybookFilteredRowsCache = [];
    let daybookSearchDebounceTimer = null;

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const safeArr = (v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof window.safeArray === 'function') return window.safeArray(v).filter(Boolean);
        return [];
    };

    const getStoreSafe = (key) => {
        try {
            if (typeof window.getStore === 'function') return window.getStore(key);
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch {
            return [];
        }
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const roundCurrency = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const roundWeight = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const setElementText = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (v !== undefined && v !== null) ? v : '';
    };

    const setElementHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = (html !== undefined && html !== null) ? html : '';
    };

    const setDisplay = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.style.display = val;
    };

    const toIsoDate = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parts = s.split(/[-/]/);
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return s;
    };

    const isSameDay = (itemDate, targetIso) => {
        if (!itemDate || !targetIso) return false;
        return toIsoDate(itemDate) === toIsoDate(targetIso);
    };

    const getToday = () => {
        const raw = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
        const iso = toIsoDate(raw);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date().toISOString().split('T')[0];
    };

    const matchesGodown = (itemKid, targetKid) => {
        if (!targetKid || targetKid === 'all') return true;
        const cleanTarget = (!targetKid || targetKid === 'k_main') ? 'k_main' : String(targetKid).trim();
        const cleanItem = (!itemKid || itemKid === 'k_main') ? 'k_main' : String(itemKid).trim();
        return cleanItem === cleanTarget;
    };

    const getWorkGroups = () => {
        if (window._JWT && typeof window._JWT.getWorkGroups === 'function') {
            return window._JWT.getWorkGroups();
        }
        const stored = safeArr(getStoreSafe('jobwork_groups'));
        const workers = safeArr(getStoreSafe('jobwork_workers'));
        const map = new Map();
        if (stored.length) {
            stored.forEach((g) => {
                if (!g || !g.key) return;
                const k = String(g.key).trim().toLowerCase();
                if (k) map.set(k, { key: k, label: String(g.label || k).trim(), outstation: Boolean(g.outstation) });
            });
        } else {
            map.set('cutting', { key: 'cutting', label: 'Cutting', outstation: false });
            map.set('embroidery', { key: 'embroidery', label: 'Embroidery', outstation: false });
            map.set('calender', { key: 'calender', label: 'Calender', outstation: false });
        }
        workers.forEach((w) => {
            if (!w || !w.type) return;
            const k = String(w.type).trim().toLowerCase();
            if (k && !map.has(k)) {
                map.set(k, { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), outstation: false });
            }
        });
        return Array.from(map.values());
    };

    const getLiveSareeTotals = (targetKid) => {
        const kid = targetKid || 'all';
        if (window._JWT && typeof window._JWT.computeLiveState === 'function') {
            return window._JWT.computeLiveState(kid).totals;
        }
        let raw = 0, finished = 0, lott = 0, pending = 0;
        safeArr(getStoreSafe('saree_history')).forEach((h) => {
            if (!h || !matchesGodown(h.karkhanaId, kid)) return;
            const bkt = h.stageBucket || ((h.type === 'finished' || h.type === 'finish') ? 'finished' : ((h.type === 'lott' || h.type === 'lot' || h.type === 'damage') ? 'lott' : 'unfinished'));
            const isOut = (h.isOut === true) || (safeNum(h.gai) > 0);
            const q = isOut ? safeInt(h.gai != null ? h.gai : h.pcs) : safeInt(h.aai != null ? h.aai : h.pcs);
            const delta = isOut ? -q : q;
            if (bkt === 'finished') finished += delta;
            else if (bkt === 'lott') lott += delta;
            else raw += delta;
        });
        raw = Math.max(0, raw); finished = Math.max(0, finished); lott = Math.max(0, lott);
        if (kid === 'all') {
            safeArr(getStoreSafe('jobwork_workers')).forEach((w) => {
                const shs = safeArr(getStoreSafe(`jobwork_sheets_${w.id}`));
                let d = shs.length ? safeInt(shs[0].closingPendingSaree, 0) : 0, a = 0;
                shs.forEach((sh) => safeArr(sh?.rows).forEach((r) => {
                    d += safeInt(r.gayiQty);
                    a += safeInt(r.aayiQty) + safeInt(r.damagePcs);
                }));
                pending += Math.max(0, d - a);
            });
        }
        return { raw, pending, finished, lott, total: raw + pending + finished + lott };
    };

    /* ========================================================================
       1. TALLY DRILL-DOWN NAVIGATION HELPERS
    ======================================================================== */
    const getParentViewForTab = (tab) => {
        if (tab === 'sancha_tani' || tab === 'sancha_chukka') return 'sancha-menu';
        if (String(tab || '').startsWith('saree_')) return 'saree-menu';
        return 'menu';
    };

    const goDayBookBack = () => {
        if (daybookViewMode === 'report') {
            daybookViewMode = getParentViewForTab(window.currentDayBookTab);
            daybookMenuActiveIdx = 0;
            renderDashboardDayBook();
            return;
        }
        if (daybookViewMode === 'sancha-menu' || daybookViewMode === 'saree-menu') {
            daybookViewMode = 'menu';
            daybookMenuActiveIdx = 0;
            renderDashboardDayBook();
            return;
        }
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    };

    const openDayBookSubMenu = (mode) => {
        daybookViewMode = mode;
        daybookMenuActiveIdx = 0;
        renderDashboardDayBook();
    };

    const openDayBookReport = (tabKey) => {
        window.currentDayBookTab = tabKey;
        daybookViewMode = 'report';
        daybookCurrentPage = 1;
        const searchInp = document.getElementById('dash-daybook-search');
        if (searchInp) searchInp.value = '';
        renderDashboardDayBook();
    };

    const setDashboardToday = () => {
        const dateInput = document.getElementById('dash-day-date');
        if (dateInput) dateInput.value = getToday();
        daybookCurrentPage = 1;
        renderDashboardDayBook();
    };

    const switchDayBookTab = (tab) => {
        const mapped = tab === 'sancha' ? 'sancha_tani' : (tab === 'saree' ? 'saree_fresh' : tab);
        openDayBookReport(mapped);
    };

    const renderDashboardKarkhanaTabs = () => {
        const bar = document.getElementById('dash-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = safeArr(getStoreSafe('karkhana_list'));
        }
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }

        const isAllActive = (window.currentDashboardKarkhanaFilter === 'all') ? ' active' : '';
        let html = `
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="sheet-tab${isAllActive}" onclick="switchDashboardKarkhanaTab('all')">👥 Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = (String(window.currentDashboardKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchDashboardKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)}</button>`;
        });

        html += `</div>`;
        bar.innerHTML = html;
    };

    const switchDashboardKarkhanaTab = (kId) => {
        window.currentDashboardKarkhanaFilter = kId || 'all';
        daybookCurrentPage = 1;
        renderDashboardKarkhanaTabs();
        renderDashboardDayBook();
        updateDashboardBadgeTotals();
    };

    const onDaybookSearchInput = () => {
        clearTimeout(daybookSearchDebounceTimer);
        daybookSearchDebounceTimer = setTimeout(() => {
            daybookCurrentPage = 1;
            renderDashboardDayBook();
        }, 150);
    };

    /* ========================================================================
       2. AGGREGATION HELPER (READS ALL STORES FOR DATE d)
    ======================================================================== */
    const collectDayBookData = (d, targetKid) => {
        const isAll = (targetKid === 'all');

        const bStock = safeArr(getStoreSafe('bana_stock'));
        const zStock = safeArr(getStoreSafe('zari_stock'));
        const karList = (typeof window.sanitizeKarigerList === 'function')
            ? window.sanitizeKarigerList()
            : safeArr(getStoreSafe('kariger_list'));
        const transfers = safeArr(getStoreSafe('material_transfers')).filter((t) => isSameDay(t?.date, d));
        const payRecords = safeArr(getStoreSafe('payment_records')).filter((x) => isSameDay(x?.date, d));
        const rawSareeHistory = safeArr(getStoreSafe('saree_history'));
        const sanchaHist = safeArr(getStoreSafe('sancha_history')).filter((h) => isSameDay(h?.date, d) && matchesGodown(h.karkhanaId, targetKid));
        const dukanHist = safeArr(getStoreSafe('dukan_transfer_history')).filter((x) => isSameDay(x?.date, d) && matchesGodown(x.karkhanaId, targetKid));
        const jobWorkers = (typeof window.getJobWorkers === 'function')
            ? window.getJobWorkers()
            : safeArr(getStoreSafe('jobwork_workers'));

        // 1. BANA ROWS
        const banaRows = [];
        let bIn = 0, bOut = 0;
        bStock.forEach((b) => {
            if (isSameDay(b?.date, d) && matchesGodown(b.karkhanaId, targetKid) && safeNum(b.aaya) > 0) {
                const q = safeNum(b.aaya);
                bIn += q;
                banaRows.push({ name: b.name, desc: b.isOpening ? '📦 Opening Stock' : 'Godam Purchase', inQty: q, outQty: 0 });
            }
        });

        // 2. ZARI ROWS
        const zariRows = [];
        let zIn = 0, zOut = 0;
        zStock.forEach((z) => {
            if (isSameDay(z?.date, d) && matchesGodown(z.karkhanaId, targetKid) && safeNum(z.aaya) > 0) {
                const q = safeNum(z.aaya);
                zIn += q;
                zariRows.push({ name: z.name, desc: z.isOpening ? '📦 Opening Stock' : 'Godam Purchase', inQty: q, outQty: 0 });
            }
        });

        // 3. KARIGER TANI SHEETS (BANA / ZARI / PAYMENT)
        const payRows = [];
        let pIn = 0, pOut = 0;
        karList.forEach((k) => {
            if (!matchesGodown(k.karkhanaId, targetKid)) return;
            const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
            sheets.forEach((sh) => {
                safeArr(sh?.rows).forEach((r) => {
                    if (!isSameDay(r?.date, d)) return;
                    const netB = safeNum(r.netBana), retB = safeNum(r.retBana);
                    const netZ = safeNum(r.netZari), retZ = safeNum(r.retZari);
                    const paid = safeNum(r.paid);

                    const bName = r.banaItemName || r.banaItem || sh.banaItem || 'Bana';
                    const zName = r.zariItemName || r.zariItem || sh.zariItem || 'Zari';

                    if (netB > 0) { bOut += netB; banaRows.push({ name: bName, desc: `${k.name} (${sh.title})`, inQty: 0, outQty: netB }); }
                    if (retB > 0) { bIn += retB; banaRows.push({ name: bName, desc: `${k.name} (${sh.title}) Return`, inQty: retB, outQty: 0 }); }
                    if (netZ > 0) { zOut += netZ; zariRows.push({ name: zName, desc: `${k.name} (${sh.title})`, inQty: 0, outQty: netZ }); }
                    if (retZ > 0) { zIn += retZ; zariRows.push({ name: zName, desc: `${k.name} (${sh.title}) Return`, inQty: retZ, outQty: 0 }); }
                    if (paid > 0) { pOut += paid; payRows.push({ party: k.name, desc: `Mazdoori (${sh.title})`, inAmt: 0, outAmt: paid }); }
                });
            });
        });

        // 4. TRANSFERS (BANA & ZARI)
        transfers.forEach((t) => {
            const q = safeNum(t.qty || t.quantity);
            const fName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.fromKarkhanaId) : t.fromKarkhanaId;
            const tName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.toKarkhanaId) : t.toKarkhanaId;

            if (t.type === 'bana') {
                if (isAll) {
                    banaRows.push({ name: t.itemName, desc: `Transfer: ${fName} ➔ ${tName}`, inQty: q, outQty: q });
                } else {
                    if (matchesGodown(t.fromKarkhanaId, targetKid)) { bOut += q; banaRows.push({ name: t.itemName, desc: `Transfer Out ➔ ${tName}`, inQty: 0, outQty: q }); }
                    if (matchesGodown(t.toKarkhanaId, targetKid)) { bIn += q; banaRows.push({ name: t.itemName, desc: `Transfer In ⬅ ${fName}`, inQty: q, outQty: 0 }); }
                }
            } else if (t.type === 'zari') {
                if (isAll) {
                    zariRows.push({ name: t.itemName, desc: `Transfer: ${fName} ➔ ${tName}`, inQty: q, outQty: q });
                } else {
                    if (matchesGodown(t.fromKarkhanaId, targetKid)) { zOut += q; zariRows.push({ name: t.itemName, desc: `Transfer Out ➔ ${tName}`, inQty: 0, outQty: q }); }
                    if (matchesGodown(t.toKarkhanaId, targetKid)) { zIn += q; zariRows.push({ name: t.itemName, desc: `Transfer In ⬅ ${fName}`, inQty: q, outQty: 0 }); }
                }
            }
        });

        // 5. PAYMENT RECORDS
        payRecords.forEach((e) => {
            if (!matchesGodown(e.karkhanaId, targetKid)) return;
            if (e.karigerId) return;
            const amt = safeNum(e.amount);
            if (e.type === 'cash_transfer_in' || e.type === 'receipt') {
                pIn += amt;
                payRows.push({ party: e.party || 'Cash Inward', desc: e.remarks || e.category || 'Cash Transfer', inAmt: amt, outAmt: 0 });
            } else {
                pOut += amt;
                payRows.push({ party: e.party || 'Cash Outward', desc: e.remarks || e.category || 'Cash Transfer', inAmt: 0, outAmt: amt });
            }
        });

        // 6. SANCHA SUB-CATEGORIES: TANI & CHUKKA
        const taniRows = [];
        const chukkaRows = [];
        let taniIn = 0, taniOut = 0, chukkaIn = 0, chukkaOut = 0;

        sanchaHist.forEach((h) => {
            const inQ = safeNum(h.aaya || h.qty);
            const outQ = safeNum(h.gaya);
            if (String(h.category || 'tani').toLowerCase() === 'chukka') {
                chukkaIn += inQ; chukkaOut += outQ; chukkaRows.push(h);
            } else {
                taniIn += inQ; taniOut += outQ; taniRows.push(h);
            }
        });

        // 7. SAREE SUB-CATEGORIES: FRESH/DIRECT, ALL DYNAMIC JOBWORK GROUPS, FINAL OUT, LOTT
        const sareeFreshRows = [];
        const sareeLottRows = [];
        let sfIn = 0, sfOut = 0, slIn = 0, slOut = 0;

        rawSareeHistory.forEach((h) => {
            if (!h || !isSameDay(h.date, d)) return;
            if (!matchesGodown(h.karkhanaId, targetKid)) return;

            const ref = String(h.refId || '');
            const hid = String(h.id || '');
            if (ref.startsWith('duk_') || ref.startsWith('dukan_') || hid.startsWith('sh_fo_')) return;

            const hType = String(h.type || 'fresh').toLowerCase();
            const bucket = String(h.stageBucket || '').toLowerCase();
            const inQ = safeInt(h.aai !== undefined ? h.aai : h.pcs);
            const outQ = safeInt(h.gai);

            if ((hType === 'lott' || hType === 'lot' || hType === 'damage' || bucket === 'lott') && (inQ > 0 || outQ > 0)) {
                slIn += inQ;
                slOut += outQ;
                sareeLottRows.push({
                    sareeName: h.sareeName || h.name || 'Lott Saree',
                    karigerName: h.karigerName || h.kariger || '-',
                    aai: inQ,
                    gai: outQ,
                    detail: h.typeLabel || h.note || 'Lott / Damage'
                });
            } else if (!h.workerId && (inQ > 0 || outQ > 0)) {
                sfIn += inQ;
                sfOut += outQ;
                sareeFreshRows.push({
                    sareeName: h.sareeName || h.name || 'Saree',
                    karigerName: h.karigerName || h.kariger || '-',
                    aai: inQ,
                    gai: outQ,
                    detail: h.typeLabel || h.note || 'Fresh / Godam Inward'
                });
            }
        });

        const buildJobWorkRows = (wType) => {
            const rows = [];
            let gTot = 0, aTot = 0, dTot = 0;
            jobWorkers.forEach((w) => {
                if (!w || String(w.type || '').toLowerCase().trim() !== wType) return;
                const sheets = (typeof window.getJobWorkerSheets === 'function')
                    ? window.getJobWorkerSheets(w.id)
                    : safeArr(getStoreSafe(`jobwork_sheets_${w.id}`));
                sheets.forEach((sh) => {
                    safeArr(sh?.rows).forEach((r) => {
                        if (!r || !isSameDay(r.date, d)) return;
                        const gItemsAll = safeArr(r.gayiItems);
                        const aItemsAll = safeArr(r.aayiItems);

                        const gFiltered = gItemsAll.length
                            ? gItemsAll.filter((it) => matchesGodown(it.karkhanaId || 'k_main', targetKid))
                            : [];
                        const aFiltered = aItemsAll.length
                            ? aItemsAll.filter((it) => matchesGodown(it.karkhanaId || 'k_main', targetKid))
                            : [];

                        const gQ = gItemsAll.length
                            ? gFiltered.reduce((sum, it) => sum + safeInt(it.qty), 0)
                            : ((targetKid === 'all' || targetKid === 'k_main') ? safeInt(r.gayiQty) : 0);

                        let aQ = 0, dQ = 0;
                        if (aItemsAll.length) {
                            aFiltered.forEach((it) => {
                                if (it.isDamage || it.destBucket === 'lott') dQ += safeInt(it.qty);
                                else aQ += safeInt(it.qty);
                            });
                        } else if (targetKid === 'all' || targetKid === 'k_main') {
                            aQ = safeInt(r.aayiQty);
                            dQ = safeInt(r.damagePcs);
                        }

                        if (gQ > 0 || aQ > 0 || dQ > 0) {
                            gTot += gQ;
                            aTot += aQ;
                            dTot += dQ;
                            const gKars = gFiltered.length
                                ? gFiltered.map((x) => `${x.karigar || '-'}(${x.qty})`).join(', ')
                                : '';
                            const aKars = aFiltered.length
                                ? aFiltered.map((x) => `${x.karigar || '-'}(${x.qty})`).join(', ')
                                : '';
                            const detailParts = [];
                            if (r.jwNo) detailParts.push(r.jwNo);
                            if (r.transport) detailParts.push(r.transport);
                            if (gKars) detailParts.push(`Out: ${gKars}`);
                            if (aKars) detailParts.push(`In: ${aKars}`);
                            rows.push({
                                worker: w.name,
                                sheet: r.jwNo ? `${sh.title || 'Sheet'} (${r.jwNo})` : (sh.title || '-'),
                                gayi: gQ,
                                aayi: aQ,
                                damagePcs: dQ,
                                detail: detailParts.join(' · ') || '-'
                            });
                        }
                    });
                });
            });
            return { rows, gayi: gTot, aayi: aTot, damage: dTot };
        };

        const groups = getWorkGroups();
        const sareeGroups = {};
        let jwInAll = 0, jwOutAll = 0;
        groups.forEach((g) => {
            const res = buildJobWorkRows(g.key);
            sareeGroups[g.key] = { key: g.key, label: g.label, ...res };
            jwInAll += res.aayi + res.damage;
            jwOutAll += res.gayi;
        });

        const finalOutRows = dukanHist.map((x) => ({
            sareeName: x.sareeName || 'Saree',
            karigerName: x.karigerName || '-',
            pcs: safeInt(x.pcs),
            note: x.note || 'Apni Main Dukan'
        }));
        const foOutTot = finalOutRows.reduce((sum, x) => sum + x.pcs, 0);

        const sInAll = sfIn + jwInAll + slIn;
        const sOutAll = sfOut + jwOutAll + foOutTot + slOut;

        return {
            bana: { rows: banaRows, inTot: bIn, outTot: bOut },
            zari: { rows: zariRows, inTot: zIn, outTot: zOut },
            sancha_tani: { rows: taniRows, inTot: taniIn, outTot: taniOut },
            sancha_chukka: { rows: chukkaRows, inTot: chukkaIn, outTot: chukkaOut },
            saree_fresh: { rows: sareeFreshRows, inTot: sfIn, outTot: sfOut },
            saree_groups: sareeGroups,
            saree_final_out: { rows: finalOutRows, outTot: foOutTot },
            saree_lott: { rows: sareeLottRows, inTot: slIn, outTot: slOut },
            groups,
            payment: { rows: payRows, inTot: pIn, outTot: pOut },
            totals: {
                bIn, bOut, zIn, zOut,
                sIn: sInAll, sOut: sOutAll,
                pIn, pOut,
                sanchaIn: taniIn + chukkaIn, sanchaOut: taniOut + chukkaOut
            }
        };
    };

    /* ========================================================================
       3. TALLY MENU + REPORT RENDER ENGINE
    ======================================================================== */
    const ensureDaybookTallyShell = () => {
        const container = document.querySelector('#daybook-section .daybook-container');
        if (!container) return null;

        const oldGrid = container.querySelector('.daybook-btn-grid');
        if (oldGrid) oldGrid.style.display = 'none';

        let menuWrap = document.getElementById('tally-daybook-menu-wrap');
        if (!menuWrap) {
            menuWrap = document.createElement('div');
            menuWrap.id = 'tally-daybook-menu-wrap';
            container.insertBefore(menuWrap, container.firstChild);
        }

        let reportHeader = document.getElementById('tally-daybook-report-bar');
        if (!reportHeader) {
            reportHeader = document.createElement('div');
            reportHeader.id = 'tally-daybook-report-bar';
            container.insertBefore(reportHeader, menuWrap.nextSibling);
        }

        return {
            menuWrap,
            reportHeader,
            tableWrap: container.querySelector('.table-responsive')
        };
    };

    const renderTallyMenuCard = (menuWrap, title, items, showBackToMain, topStripHtml = '') => {
        let html = `
            <div style="max-width:560px; margin:14px auto 18px; background:#ffffff; border:1px solid #eef0f4; border-radius:10px; box-shadow:0 20px 45px rgba(133, 92, 0, 0.12), 0 4px 12px rgba(0,0,0,0.04); overflow:hidden;">
                <div style="background:#fdf6e2; border-bottom:1.5px solid #f2b71d; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:14.5px; color:#1f2937;">${esc(title)}</strong>
                    ${showBackToMain
                        ? `<button type="button" onclick="goDayBookBack()" style="background:#ffffff; color:#374151; border:1px solid #e5e7eb; padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer;">← [Esc] Day-Book List</button>`
                        : `<span style="font-size:11px; color:#92400e; font-weight:700;">Select Register</span>`
                    }
                </div>
                ${topStripHtml}
                <div style="padding:8px 0;">`;

        if (daybookMenuActiveIdx >= items.length || daybookMenuActiveIdx < 0) daybookMenuActiveIdx = 0;

        items.forEach((it, idx) => {
            const isAct = (idx === daybookMenuActiveIdx);
            const bg = isAct ? '#f2b71d' : 'transparent';
            const fg = isAct ? '#1f2937' : '#1f2937';
            const subFg = isAct ? '#1f2937' : '#b47d00';
            const keyFg = isAct ? '#1f2937' : '#b45309';

            html += `
                <button type="button" class="tally-db-menu-item${isAct ? ' active' : ''}" data-idx="${idx}" data-key="${esc(it.key)}"
                    onclick="${it.onclick}"
                    style="width:100%; background:${bg}; color:${fg}; border:none; padding:10px 18px; display:flex; justify-content:space-between; align-items:center; gap:10px; cursor:pointer; font-size:13.5px; font-weight:${isAct ? '800' : '600'}; text-align:left; border-bottom:1px solid #f9fafb;">
                    <span>${it.labelHtml.replace('class="k"', `style="color:${keyFg}; font-weight:900; text-decoration:underline;"`)}</span>
                    <span style="font-size:11.5px; font-weight:700; color:${subFg};">${esc(it.summary)}</span>
                </button>`;
        });

        html += `
                </div>
                <div style="background:#fbfbfc; border-top:1px solid #eef0f4; padding:8px 14px; font-size:11px; color:#9ca3af; text-align:center;">
                    ↑ ↓ Arrow Keys · [Enter] Kholein · [Esc] Wapas
                </div>
            </div>`;

        menuWrap.innerHTML = html;
    };

    const renderDashboardDayBook = () => {
        const dateEl = document.getElementById('dash-day-date');
        if (dateEl && !dateEl.value) dateEl.value = getToday();
        const rawD = dateEl?.value || getToday();
        const d = toIsoDate(rawD) || getToday();

        const thead = document.getElementById('dash-daybook-thead');
        const tbody = document.getElementById('dash-daybook-tbody');
        const tfoot = document.getElementById('dash-daybook-tfoot');
        if (!thead || !tbody || !tfoot) return;

        const targetKid = window.currentDashboardKarkhanaFilter;
        const data = collectDayBookData(d, targetKid);
        const tot = data.totals;

        setElementText('sub-day-bana', `In: +${tot.bIn.toFixed(1)} | Out: -${tot.bOut.toFixed(1)}`);
        setElementText('sub-day-zari', `In: +${tot.zIn.toFixed(1)} | Out: -${tot.zOut.toFixed(1)}`);
        setElementText('sub-day-saree', `In: +${tot.sIn} | Out: -${tot.sOut}`);
        setElementText('sub-day-payment', `${tot.pIn > 0 ? `In: +₹${tot.pIn.toFixed(0)} | ` : ''}Diya: ₹${tot.pOut.toFixed(0)}`);
        setElementText('sub-day-sancha', `In: +${tot.sanchaIn.toFixed(1)} | Out: -${tot.sanchaOut.toFixed(1)}`);

        const shell = ensureDaybookTallyShell();
        if (!shell) return;
        const { menuWrap, reportHeader, tableWrap } = shell;

        // MENU VIEWS
        if (daybookViewMode === 'menu') {
            menuWrap.style.display = 'block';
            reportHeader.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'none';

            const liveS = getLiveSareeTotals(targetKid);
            renderTallyMenuCard(menuWrap, `Day-Book List (${d})`, [
                { key: 'b', labelHtml: '<span class="k">B</span>ana', summary: `In: +${tot.bIn.toFixed(1)} | Out: -${tot.bOut.toFixed(1)} Kg`, onclick: "openDayBookReport('bana')" },
                { key: 'z', labelHtml: '<span class="k">Z</span>ari', summary: `In: +${tot.zIn.toFixed(1)} | Out: -${tot.zOut.toFixed(1)} Kg`, onclick: "openDayBookReport('zari')" },
                { key: 's', labelHtml: '<span class="k">S</span>ancha ▸', summary: `Tani & Chukka (In: +${tot.sanchaIn.toFixed(1)} | Out: -${tot.sanchaOut.toFixed(1)})`, onclick: "openDayBookSubMenu('sancha-menu')" },
                { key: 'e', labelHtml: 'Sare<span class="k">e</span> ▸', summary: `Gdm: ${liveS.raw + liveS.finished + liveS.lott} | JW: ${liveS.pending} Pc`, onclick: "openDayBookSubMenu('saree-menu')" },
                { key: 'p', labelHtml: '<span class="k">P</span>ayment', summary: `${tot.pIn > 0 ? `In: +₹${tot.pIn.toFixed(0)} | ` : ''}Diya: ₹${tot.pOut.toFixed(0)}`, onclick: "openDayBookReport('payment')" }
            ], false);
            return;
        }

        if (daybookViewMode === 'sancha-menu') {
            menuWrap.style.display = 'block';
            reportHeader.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'none';

            renderTallyMenuCard(menuWrap, `Sancha Day-Book (${d})`, [
                { key: 't', labelHtml: '🧵 <span class="k">T</span>ani', summary: `In: +${data.sancha_tani.inTot.toFixed(2)} | Out: -${data.sancha_tani.outTot.toFixed(2)} Kg`, onclick: "openDayBookReport('sancha_tani')" },
                { key: 'c', labelHtml: '⚙️ <span class="k">C</span>hukka', summary: `In: +${data.sancha_chukka.inTot.toFixed(2)} | Out: -${data.sancha_chukka.outTot.toFixed(2)} Kg`, onclick: "openDayBookReport('sancha_chukka')" }
            ], true);
            return;
        }

        if (daybookViewMode === 'saree-menu') {
            menuWrap.style.display = 'block';
            reportHeader.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'none';

            const liveS = getLiveSareeTotals(targetKid);
            const liveStrip = `
                <div style="display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); background:#fdfcf7; border-bottom:1.5px solid #e5d5a7; text-align:center;">
                    <div style="padding:7px 4px; border-right:1px solid #f3efe0;"><small style="display:block; font-size:10px; color:#6b7280; font-weight:700;">Godam WIP</small><strong style="font-size:13px; color:#b47d00;">${liveS.raw}</strong></div>
                    <div style="padding:7px 4px; border-right:1px solid #f3efe0;"><small style="display:block; font-size:10px; color:#6b7280; font-weight:700;">JobWork</small><strong style="font-size:13px; color:#92400e;">${liveS.pending}</strong></div>
                    <div style="padding:7px 4px; border-right:1px solid #f3efe0;"><small style="display:block; font-size:10px; color:#6b7280; font-weight:700;">Finished</small><strong style="font-size:13px; color:#065f46;">${liveS.finished}</strong></div>
                    <div style="padding:7px 4px; border-right:1px solid #f3efe0;"><small style="display:block; font-size:10px; color:#6b7280; font-weight:700;">Lott</small><strong style="font-size:13px; color:#b91c1c;">${liveS.lott}</strong></div>
                    <div style="padding:7px 4px; background:#fdf6e2;"><small style="display:block; font-size:10px; color:#92400e; font-weight:800;">Kul Stock</small><strong style="font-size:13px; color:#1f2937;">${liveS.total} Pc</strong></div>
                </div>`;

            const usedKeys = new Set(['f', 'd', 'o']);
            const sareeItems = [
                { key: 'f', labelHtml: '🟢 <span class="k">F</span>resh / Direct Inward', summary: `In: +${data.saree_fresh.inTot} | Out: -${data.saree_fresh.outTot} Pcs`, onclick: "openDayBookReport('saree_fresh')" }
            ];

            data.groups.forEach((g) => {
                const gd = data.saree_groups[g.key] || { gayi: 0, aayi: 0, damage: 0 };
                let kChar = '';
                for (const ch of g.label.toLowerCase()) {
                    if (/[a-z]/.test(ch) && !usedKeys.has(ch)) { kChar = ch; usedKeys.add(ch); break; }
                }
                const icon = g.key === 'cutting' ? '✂️ ' : (g.key === 'embroidery' ? '🪡 ' : (g.key === 'calender' ? '🎛️ ' : '✨ '));
                const lblHtml = kChar
                    ? icon + esc(g.label).replace(new RegExp(kChar, 'i'), (m) => `<span class="k">${m}</span>`)
                    : icon + esc(g.label);
                const dmgTxt = gd.damage > 0 ? ` | Dmg: ${gd.damage}` : '';
                sareeItems.push({
                    key: kChar,
                    labelHtml: lblHtml,
                    summary: `Gayi: -${gd.gayi} | Aayi: +${gd.aayi}${dmgTxt} Pcs`,
                    onclick: `openDayBookReport('saree_jw_${esc(g.key)}')`
                });
            });

            sareeItems.push(
                { key: 'd', labelHtml: '🚚 Final Out (<span class="k">D</span>ispatch)', summary: `Gaya: -${data.saree_final_out.outTot} Pcs`, onclick: "openDayBookReport('saree_final_out')" },
                { key: 'o', labelHtml: '🔴 L<span class="k">o</span>tt / Damage', summary: `In: +${data.saree_lott.inTot} | Out: -${data.saree_lott.outTot} Pcs`, onclick: "openDayBookReport('saree_lott')" }
            );

            renderTallyMenuCard(menuWrap, `Saree Day-Book (${d})`, sareeItems, true, liveStrip);
            return;
        }

        // REPORT VIEW
        menuWrap.style.display = 'none';
        reportHeader.style.display = 'flex';
        if (tableWrap) tableWrap.style.display = 'block';

        const curTab = window.currentDayBookTab || 'bana';
        const tabBreadcrumbs = {
            bana: 'Day-Book › Bana',
            zari: 'Day-Book › Zari',
            sancha_tani: 'Day-Book › Sancha › Tani',
            sancha_chukka: 'Day-Book › Sancha › Chukka',
            saree_fresh: 'Day-Book › Saree › Fresh / Inward',
            saree_final_out: 'Day-Book › Saree › Final Out (Dispatch)',
            saree_lott: 'Day-Book › Saree › Lott / Damage',
            payment: 'Day-Book › Payment'
        };
        data.groups.forEach((g) => {
            tabBreadcrumbs[`saree_jw_${g.key}`] = `Day-Book › Saree › ${g.label}`;
        });

        reportHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#fdf6e2; border:1px solid #fde68a; border-radius:8px; padding:9px 14px; margin-bottom:10px;';
        reportHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <button type="button" onclick="goDayBookBack()" style="background:#ffffff; color:#1f2937; border:1px solid #e5e7eb; padding:5px 11px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">← [Esc] Wapas</button>
                <strong style="font-size:14px; color:#1f2937;">${esc(tabBreadcrumbs[curTab] || 'Day-Book')}</strong>
            </div>
            <span style="font-size:12px; font-weight:700; color:#92400e;">Tarikh: ${esc(d)}</span>
        `;

        const tableEl = thead.closest('table');
        if (tableEl && tableEl.parentElement && !document.getElementById('dash-daybook-controls-bar')) {
            const ctrlBar = document.createElement('div');
            ctrlBar.id = 'dash-daybook-controls-bar';
            ctrlBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin:6px 0 12px 0;';
            ctrlBar.innerHTML = `
                <div style="flex:1; min-width:220px;">
                    <input type="text" id="dash-daybook-search" class="search-box" placeholder="🔍 Search Kariger, Vivran, Item..." style="width:100%; padding:8px 12px; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; box-sizing:border-box;" oninput="onDaybookSearchInput()">
                </div>
                <div>
                    <button type="button" id="dash-daybook-print-btn" class="add-btn" onclick="printDaybookReport()">🖨️ A6 Print</button>
                </div>`;
            tableEl.parentElement.insertBefore(ctrlBar, tableEl);
        }

        let pager = document.getElementById('dash-daybook-pagination-controls');
        if (!pager && tableEl && tableEl.parentElement) {
            pager = document.createElement('div');
            pager.id = 'dash-daybook-pagination-controls';
            pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #eef0f4; flex-wrap:wrap; gap:8px;';
            tableEl.parentElement.appendChild(pager);
        }

        const searchInp = document.getElementById('dash-daybook-search') || document.getElementById('search-daybook-input');
        const searchTxt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        if (curTab === 'bana' || curTab === 'zari') {
            let rows = [...(curTab === 'bana' ? data.bana.rows : data.zari.rows)];
            const label = curTab === 'bana' ? 'Bana' : 'Zari';
            thead.innerHTML = `<tr><th>${label} Ka Naam</th><th>Kariger / Godam Vivran</th><th>📥 Aaya (In)</th><th>📤 Gaya (Out)</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((r) => `${r.name || ''} ${r.desc || ''} ${r.inQty} ${r.outQty}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (r) => `
                <tr>
                    <td><strong>${esc(r.name)}</strong></td>
                    <td>${esc(r.desc)}</td>
                    <td style="color:#92400e; font-weight:700;">${r.inQty > 0 ? `+${r.inQty.toFixed(2)} Kg` : '-'}</td>
                    <td style="color:#1f2937; font-weight:700;">${r.outQty > 0 ? `-${r.outQty.toFixed(2)} Kg` : '-'}</td>
                </tr>
            `, `Is tarikh me ${label} ki koi entry nahi hai.`, 4);

            let curIn = 0, curOut = 0;
            rows.forEach((r) => { curIn += r.inQty; curOut += r.outQty; });
            tfoot.innerHTML = `<tr><td colspan="2"><strong>Total Rozana ${label}:</strong></td><td><strong>+${curIn.toFixed(2)} Kg</strong></td><td><strong>-${curOut.toFixed(2)} Kg</strong></td></tr>`;

        } else if (curTab === 'sancha_tani' || curTab === 'sancha_chukka') {
            const isChukka = (curTab === 'sancha_chukka');
            const label = isChukka ? 'Chukka' : 'Tani';
            let rows = [...(isChukka ? data.sancha_chukka.rows : data.sancha_tani.rows)];
            thead.innerHTML = `<tr><th>${label} Item</th><th>Kariger / Vivran</th><th>📥 Aaya (In)</th><th>📤 Gaya (Out)</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((h) => `${h.name || ''} ${h.kariger || ''} ${h.type || ''}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (h) => {
                const inQ = safeNum(h.aaya || h.qty);
                const outQ = safeNum(h.gaya);
                return `
                    <tr>
                        <td><strong>${esc(h.name || label)}</strong></td>
                        <td>${h.kariger ? `👤 ${esc(h.kariger)}` : esc(h.type || 'Godam Purchase')}</td>
                        <td style="color:#92400e; font-weight:700;">${inQ > 0 ? `+${inQ.toFixed(2)} Kg` : '-'}</td>
                        <td style="color:#1f2937; font-weight:700;">${outQ > 0 ? `-${outQ.toFixed(2)} Kg` : '-'}</td>
                    </tr>`;
            }, `Is tarikh me ${label} ki koi entry nahi hai.`, 4);

            let curIn = 0, curOut = 0;
            rows.forEach((h) => { curIn += safeNum(h.aaya || h.qty); curOut += safeNum(h.gaya); });
            tfoot.innerHTML = `<tr><td colspan="2"><strong>Total Rozana ${label}:</strong></td><td><strong>+${curIn.toFixed(2)} Kg</strong></td><td><strong>-${curOut.toFixed(2)} Kg</strong></td></tr>`;

        } else if (curTab === 'saree_fresh' || curTab === 'saree_lott') {
            const isLott = (curTab === 'saree_lott');
            const label = isLott ? 'Lott Saree' : 'Fresh / Godam Inward';
            let rows = [...(isLott ? data.saree_lott.rows : data.saree_fresh.rows)];
            thead.innerHTML = `<tr><th>Saree Ka Naam</th><th>Kariger / Party</th><th>📥 Aayi (In)</th><th>📤 Gayi (Out)</th><th>Detail</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((h) => `${h.sareeName || ''} ${h.karigerName || ''} ${h.detail || ''}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (h) => {
                const inQ = safeInt(h.aai);
                const outQ = safeInt(h.gai);
                return `
                    <tr>
                        <td><strong>${esc(h.sareeName)}</strong></td>
                        <td>${esc(h.karigerName)}</td>
                        <td style="color:#92400e; font-weight:700;">${inQ > 0 ? `+${inQ} Pcs` : '-'}</td>
                        <td style="color:#1f2937; font-weight:700;">${outQ > 0 ? `-${outQ} Pcs` : '-'}</td>
                        <td>${esc(h.detail)}</td>
                    </tr>`;
            }, `Is tarikh me ${label} ki koi entry nahi hai.`, 5);

            let curIn = 0, curOut = 0;
            rows.forEach((h) => { curIn += safeInt(h.aai); curOut += safeInt(h.gai); });
            tfoot.innerHTML = `<tr><td colspan="2"><strong>Total ${label}:</strong></td><td><strong>+${curIn} Pcs</strong></td><td><strong>-${curOut} Pcs</strong></td><td>-</td></tr>`;

        } else if (curTab === 'saree_final_out') {
            let rows = [...data.saree_final_out.rows];
            thead.innerHTML = `<tr><th>Saree Ka Naam</th><th>Kariger (Maker)</th><th>Dukan / Party &amp; Stage</th><th>📤 Gaya (Out)</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((r) => `${r.sareeName} ${r.karigerName} ${r.note}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (r) => `
                <tr>
                    <td><strong>${esc(r.sareeName)}</strong></td>
                    <td>${esc(r.karigerName)}</td>
                    <td>${esc(r.note)}</td>
                    <td style="color:#b47d00; font-weight:800;">-${r.pcs} Pcs</td>
                </tr>
            `, 'Is tarikh me Final Out ki koi entry nahi hai.', 4);

            const curOut = rows.reduce((sum, r) => sum + safeInt(r.pcs), 0);
            tfoot.innerHTML = `<tr><td colspan="3"><strong>Total Final Out:</strong></td><td><strong>-${curOut} Pcs</strong></td></tr>`;

        } else if (curTab.startsWith('saree_jw_') || curTab === 'saree_cutting' || curTab === 'saree_embroidery' || curTab === 'saree_calender') {
            const gKey = curTab.startsWith('saree_jw_') ? curTab.slice('saree_jw_'.length) : curTab.replace('saree_', '');
            const cfg = data.saree_groups[gKey] || { label: gKey, rows: [] };
            let rows = [...cfg.rows];
            thead.innerHTML = `<tr><th>${esc(cfg.label)} Worker</th><th>Sheet / JW No.</th><th>📤 Gayi (Out)</th><th>📥 Wapas Aayi (In)</th><th>⚠️ Lott/Dmg</th><th>Kariger Detail</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((r) => `${r.worker || ''} ${r.sheet || ''} ${r.detail || ''}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (r) => `
                <tr>
                    <td><strong>${esc(r.worker)}</strong></td>
                    <td>${esc(r.sheet)}</td>
                    <td style="color:#1f2937; font-weight:700;">${r.gayi > 0 ? `-${r.gayi} Pcs` : '-'}</td>
                    <td style="color:#92400e; font-weight:700;">${r.aayi > 0 ? `+${r.aayi} Pcs` : '-'}</td>
                    <td>${r.damagePcs > 0 ? `⚠️ ${r.damagePcs} Pcs` : '-'}</td>
                    <td style="font-size:11.5px; color:#4b5563;">${esc(r.detail)}</td>
                </tr>
            `, `Is tarikh me ${cfg.label} ki koi entry nahi hai.`, 6);

            let curG = 0, curA = 0, curD = 0;
            rows.forEach((r) => { curG += r.gayi; curA += r.aayi; curD += r.damagePcs; });
            tfoot.innerHTML = `<tr><td colspan="2"><strong>Total ${esc(cfg.label)}:</strong></td><td><strong>-${curG} Pcs</strong></td><td><strong>+${curA} Pcs</strong></td><td><strong>${curD > 0 ? curD + ' Pcs' : '-'}</strong></td><td>-</td></tr>`;

        } else if (curTab === 'payment') {
            let rows = [...data.payment.rows];
            thead.innerHTML = `<tr><th>Party / Kariger</th><th>Vivran / Khata</th><th>📥 Aamad (In)</th><th>📤 Diya (Out)</th></tr>`;

            if (searchTxt) {
                rows = rows.filter((dp) => `${dp.party || ''} ${dp.desc || ''} ${dp.inAmt} ${dp.outAmt}`.toLowerCase().includes(searchTxt));
            }
            currentDaybookFilteredRowsCache = rows;

            renderPaginatedDaybookRows(rows, tbody, pager, (dp) => `
                <tr>
                    <td><strong>${esc(dp.party)}</strong></td>
                    <td>${esc(dp.desc)}</td>
                    <td style="color:#92400e; font-weight:700;">${dp.inAmt > 0 ? `+ ₹ ${dp.inAmt.toFixed(2)}` : '-'}</td>
                    <td style="color:#1f2937; font-weight:700;">${dp.outAmt > 0 ? `- ₹ ${dp.outAmt.toFixed(2)}` : '-'}</td>
                </tr>
            `, 'Is tarikh me koi payment ya cash transfer nahi mila.', 4);

            let curIn = 0, curOut = 0;
            rows.forEach((dp) => { curIn += dp.inAmt; curOut += dp.outAmt; });
            tfoot.innerHTML = `<tr><td colspan="2"><strong>Total Rozana Cash Movement:</strong></td><td><strong>+ ₹ ${curIn.toFixed(2)}</strong></td><td><strong>- ₹ ${curOut.toFixed(2)}</strong></td></tr>`;
        }
    };

    const renderPaginatedDaybookRows = (rows, tbody, pager, rowTemplateFn, emptyMsg, colSpan) => {
        const totalEntries = rows.length;

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan='${colSpan}' style='text-align:center; padding:18px; color:#6b7280;'>${emptyMsg}</td></tr>`;
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / DAYBOOK_PAGE_SIZE) || 1;
        if (daybookCurrentPage > totalPages) daybookCurrentPage = totalPages;
        if (daybookCurrentPage < 1) daybookCurrentPage = 1;

        const startIndex = (daybookCurrentPage - 1) * DAYBOOK_PAGE_SIZE;
        const pageRows = rows.slice(startIndex, startIndex + DAYBOOK_PAGE_SIZE);

        let html = '';
        pageRows.forEach((r) => {
            html += rowTemplateFn(r);
        });
        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#4b5563; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + DAYBOOK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="quick-btn btn-out" ${daybookCurrentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeDaybookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:700; padding:4px 10px; background:#fdf6e2; border:1px solid #fde68a; border-radius:6px; color:#92400e;">${daybookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="quick-btn btn-in" ${daybookCurrentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeDaybookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeDaybookPage = (delta) => {
        daybookCurrentPage += delta;
        renderDashboardDayBook();
    };

    /* ========================================================================
       4. TALLY KEYBOARD NAVIGATION INSIDE DAY-BOOK (↑ ↓ ENTER ESC + LETTERS)
    ======================================================================== */
    document.addEventListener('keydown', (e) => {
        const dbSec = document.getElementById('daybook-section');
        if (!dbSec || dbSec.style.display === 'none') return;

        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display && m.style.display !== 'none');
        if (anyModalOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            goDayBookBack();
            return;
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        if (daybookViewMode === 'menu' || daybookViewMode === 'sancha-menu' || daybookViewMode === 'saree-menu') {
            const btns = Array.from(document.querySelectorAll('#tally-daybook-menu-wrap .tally-db-menu-item'));
            if (!btns.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                daybookMenuActiveIdx = (daybookMenuActiveIdx + 1) % btns.length;
                renderDashboardDayBook();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                daybookMenuActiveIdx = (daybookMenuActiveIdx - 1 + btns.length) % btns.length;
                renderDashboardDayBook();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                btns[daybookMenuActiveIdx]?.click();
            } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                const hit = btns.find((b) => b.dataset.key === k);
                if (hit) {
                    e.preventDefault();
                    hit.click();
                }
            }
        }
    });

    const initDaybookVisibilityObserver = () => {
        const dbSec = document.getElementById('daybook-section');
        if (!dbSec || dbSec.dataset.dbObsBound === '1') return;
        dbSec.dataset.dbObsBound = '1';
        let wasVisible = dbSec.style.display !== 'none';

        const obs = new MutationObserver(() => {
            const isNowVisible = dbSec.style.display !== 'none';
            if (isNowVisible && !wasVisible) {
                daybookViewMode = 'menu';
                daybookMenuActiveIdx = 0;
                daybookCurrentPage = 1;
                renderDashboardDayBook();
            }
            wasVisible = isNowVisible;
        });
        obs.observe(dbSec, { attributes: true, attributeFilter: ['style'] });
    };

    /* ========================================================================
       5. A6 THERMAL PRINT ENGINE (ALL DYNAMIC REGISTERS SUPPORTED)
    ======================================================================== */
    const getDashboardKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') return window.getKarkhanaNameById(kId);
        return kId;
    };

    const printDaybookReport = () => {
        const rows = currentDaybookFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi record nahi mila!');
        }

        const tab = window.currentDayBookTab || 'bana';
        const d = toIsoDate(document.getElementById('dash-day-date')?.value || getToday());
        const kName = getDashboardKarkhanaPrintName(window.currentDashboardKarkhanaFilter);
        const searchInp = document.getElementById('dash-daybook-search') || document.getElementById('search-daybook-input');
        const sTxt = searchInp ? searchInp.value.trim() : '';

        const tabTitles = {
            bana: 'BANA ROZANA DAYBOOK',
            zari: 'ZARI ROZANA DAYBOOK',
            sancha_tani: 'SANCHA (TANI) DAYBOOK',
            sancha_chukka: 'SANCHA (CHUKKA) DAYBOOK',
            saree_fresh: 'SAREE (FRESH/INWARD) DAYBOOK',
            saree_final_out: 'SAREE (FINAL OUT) DAYBOOK',
            saree_lott: 'SAREE (LOTT) DAYBOOK',
            payment: 'PAYMENT & CASH MOVEMENT DAYBOOK'
        };

        let title = tabTitles[tab] || 'ROZANA DAYBOOK';
        if (tab.startsWith('saree_jw_')) {
            const gKey = tab.slice('saree_jw_'.length);
            const gObj = getWorkGroups().find((g) => g.key === gKey);
            title = `SAREE (${(gObj ? gObj.label : gKey).toUpperCase()}) DAYBOOK`;
        }

        let thHtml = '';
        let rowsHtml = '';
        let totHtml = '';

        if (tab === 'bana' || tab === 'zari') {
            thHtml = `<tr><th>ITEM</th><th>KARIGER / VIVRAN</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((r) => {
                tIn += safeNum(r.inQty); tOut += safeNum(r.outQty);
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(r.name)}</td><td style="padding:4px 2px;">${esc(r.desc)}</td><td style="padding:4px 2px; text-align:right;">${r.inQty > 0 ? `+${r.inQty.toFixed(2)}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${r.outQty > 0 ? `-${r.outQty.toFixed(2)}` : '-'}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Aaya:</span><span>+${tIn.toFixed(2)} Kg</span></div><div style="display:flex; justify-content:space-between;"><span>Kul Gaya:</span><span>-${tOut.toFixed(2)} Kg</span></div>`;
        } else if (tab === 'sancha_tani' || tab === 'sancha_chukka') {
            thHtml = `<tr><th>ITEM</th><th>KARIGER / VIVRAN</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((h) => {
                const inQ = safeNum(h.aaya || h.qty); const outQ = safeNum(h.gaya);
                tIn += inQ; tOut += outQ;
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(h.name)}</td><td style="padding:4px 2px;">${esc(h.kariger || h.type || '-')}</td><td style="padding:4px 2px; text-align:right;">${inQ > 0 ? `+${inQ.toFixed(2)}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${outQ > 0 ? `-${outQ.toFixed(2)}` : '-'}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Aaya:</span><span>+${tIn.toFixed(2)} Kg</span></div><div style="display:flex; justify-content:space-between;"><span>Kul Gaya:</span><span>-${tOut.toFixed(2)} Kg</span></div>`;
        } else if (tab === 'saree_fresh' || tab === 'saree_lott') {
            thHtml = `<tr><th>SAREE</th><th>MAKER</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th><th>DETAIL</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((h) => {
                const inQ = safeInt(h.aai); const outQ = safeInt(h.gai);
                tIn += inQ; tOut += outQ;
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(h.sareeName)}</td><td style="padding:4px 2px;">${esc(h.karigerName)}</td><td style="padding:4px 2px; text-align:right;">${inQ > 0 ? `+${inQ}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${outQ > 0 ? `-${outQ}` : '-'}</td><td style="padding:4px 2px; font-size:9px;">${esc(h.detail)}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Aai:</span><span>+${tIn} Pcs</span></div><div style="display:flex; justify-content:space-between;"><span>Kul Gai:</span><span>-${tOut} Pcs</span></div>`;
        } else if (tab === 'saree_final_out') {
            thHtml = `<tr><th>SAREE</th><th>MAKER</th><th>PARTY</th><th style="text-align:right;">PCS</th></tr>`;
            let tOut = 0;
            rows.forEach((r) => {
                tOut += safeInt(r.pcs);
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(r.sareeName)}</td><td style="padding:4px 2px;">${esc(r.karigerName)}</td><td style="padding:4px 2px; font-size:9px;">${esc(r.note)}</td><td style="padding:4px 2px; text-align:right; font-weight:bold;">-${r.pcs}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Final Out:</span><span>-${tOut} Pcs</span></div>`;
        } else if (tab.startsWith('saree_jw_') || tab === 'saree_cutting' || tab === 'saree_embroidery' || tab === 'saree_calender') {
            thHtml = `<tr><th>WORKER</th><th>SHEET</th><th style="text-align:right;">GAYI</th><th style="text-align:right;">AAYI</th><th style="text-align:right;">DMG</th></tr>`;
            let tG = 0, tA = 0, tD = 0;
            rows.forEach((r) => {
                tG += r.gayi; tA += r.aayi; tD += r.damagePcs;
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(r.worker)}</td><td style="padding:4px 2px;">${esc(r.sheet)}</td><td style="padding:4px 2px; text-align:right;">${r.gayi > 0 ? `-${r.gayi}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${r.aayi > 0 ? `+${r.aayi}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${r.damagePcs > 0 ? r.damagePcs : '-'}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Gayi:</span><span>-${tG} Pcs</span></div><div style="display:flex; justify-content:space-between;"><span>Kul Aayi:</span><span>+${tA} Pcs</span></div><div style="display:flex; justify-content:space-between;"><span>Lott/Dmg:</span><span>${tD} Pcs</span></div>`;
        } else if (tab === 'payment') {
            thHtml = `<tr><th>PARTY / KARIGER</th><th>KHATA / NOTE</th><th style="text-align:right;">AAMAD</th><th style="text-align:right;">DIYA</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((dp) => {
                tIn += safeNum(dp.inAmt); tOut += safeNum(dp.outAmt);
                rowsHtml += `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 2px; font-weight:bold;">${esc(dp.party)}</td><td style="padding:4px 2px;">${esc(dp.desc)}</td><td style="padding:4px 2px; text-align:right;">${dp.inAmt > 0 ? `+₹${dp.inAmt.toFixed(2)}` : '-'}</td><td style="padding:4px 2px; text-align:right;">${dp.outAmt > 0 ? `-₹${dp.outAmt.toFixed(2)}` : '-'}</td></tr>`;
            });
            totHtml = `<div style="display:flex; justify-content:space-between;"><span>Kul Aamad:</span><span>+₹ ${tIn.toFixed(2)}</span></div><div style="display:flex; justify-content:space-between;"><span>Kul Diya:</span><span>-₹ ${tOut.toFixed(2)}</span></div>`;
        }

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Daybook Report - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header"><h2>SIMPLICITY ERP</h2><p><strong>${esc(title)}</strong></p></div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Tarikh:</strong> ${esc(d)}</div>
                        ${sTxt ? `<div><strong>Search Filter:</strong> "${esc(sTxt)}"</div>` : ''}
                        <div><strong>Total Entries:</strong> ${rows.length}</div>
                    </div>
                    <table><thead>${thHtml}</thead><tbody>${rowsHtml}</tbody></table>
                    <div class="total-box">${totHtml}</div>
                    <div class="footer"><p>हस्ताक्षर / मुंशी: ____________________</p></div>
                </div>
                <script>window.onload = function() { window.focus(); window.print(); setTimeout(() => window.close(), 600); };<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    /* ========================================================================
       6. DASHBOARD BADGES ENGINE (LIVE GODAM + JOBWORK SYNCED)
    ======================================================================== */
    const updateDashboardBadgeTotals = () => {
        const targetKid = window.currentDashboardKarkhanaFilter;
        const isAll = (targetKid === 'all');

        let karList = (typeof window.sanitizeKarigerList === 'function')
            ? window.sanitizeKarigerList()
            : safeArr(getStoreSafe('kariger_list'));

        if (!isAll) {
            karList = karList.filter((k) => matchesGodown(k.karkhanaId, targetKid));
        }

        setElementText('btn-total-kariger', `Total: ${karList.length}`);

        const infoLen = safeArr(getStoreSafe('info_ledger')).length;
        setElementText('btn-total-info', `Total: ${infoLen}`);

        const sTotals = getLiveSareeTotals(targetKid);
        const godamSaree = sTotals.raw + sTotals.finished + sTotals.lott;
        setElementText('btn-total-saree', `Stock: ${sTotals.total} Pcs (Gdm: ${godamSaree} · JW: ${sTotals.pending})`);

        if (window.badgeCalculationTimer) clearTimeout(window.badgeCalculationTimer);

        window.badgeCalculationTimer = setTimeout(() => {
            let tb = 0;
            const uniqueBana = new Set();
            safeArr(getStoreSafe('bana_stock')).forEach((b) => {
                const name = b?.name ? b.name.trim() : '';
                if (name && !uniqueBana.has(name.toLowerCase())) {
                    uniqueBana.add(name.toLowerCase());
                    if (typeof window.getBanaItemStats === 'function') {
                        tb += safeNum(window.getBanaItemStats(name, targetKid).bacha);
                    } else {
                        tb += safeNum(b.bacha);
                    }
                }
            });
            setElementText('btn-total-bana', `Bacha: ${roundWeight(tb).toFixed(2)} Kg`);

            let tz = 0;
            const uniqueZari = new Set();
            safeArr(getStoreSafe('zari_stock')).forEach((z) => {
                const name = z?.name ? z.name.trim() : '';
                if (name && !uniqueZari.has(name.toLowerCase())) {
                    uniqueZari.add(name.toLowerCase());
                    if (typeof window.getZariItemStats === 'function') {
                        tz += safeNum(window.getZariItemStats(name, targetKid).bacha);
                    } else {
                        tz += safeNum(z.bacha);
                    }
                }
            });
            setElementText('btn-total-zari', `Bacha: ${roundWeight(tz).toFixed(2)} Kg`);

            let totalBakiAll = 0;
            let totalDiyaAll = 0;

            if (window.KarigerCalcEngine && typeof window.KarigerCalcEngine.getKarkhanaProductionStats === 'function') {
                const kStats = window.KarigerCalcEngine.getKarkhanaProductionStats(targetKid);
                totalBakiAll = safeNum(kStats.totalPendingBani);
            }

            karList.forEach((k) => {
                if (k?.id && typeof window.calculateSheetTotals === 'function') {
                    const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                    const curSheet = sheets[sheets.length - 1];
                    if (curSheet) {
                        const c = window.calculateSheetTotals(curSheet);
                        totalDiyaAll += safeNum(c.totPaid);
                        if (!(window.KarigerCalcEngine && typeof window.KarigerCalcEngine.getKarkhanaProductionStats === 'function')) {
                            totalBakiAll += safeNum(c.remainingAmt);
                        }
                    }
                }
            });

            setElementHTML('btn-total-payment', `<span style='color:#059669; font-weight:bold;'>Diya: ₹ ${roundCurrency(totalDiyaAll).toFixed(0)}</span> • <span style='color:#dc2626; font-weight:bold;'>Baki: ₹ ${roundCurrency(totalBakiAll).toFixed(0)}</span>`);

            let totTani = 0, totChukka = 0;
            safeArr(getStoreSafe('sancha_items')).forEach((s) => {
                if (!matchesGodown(s?.karkhanaId, targetKid)) return;
                const cat = String(s.category || 'tani').toLowerCase();
                const bacha = safeNum(s.bacha !== undefined ? s.bacha : s.aaya);

                if (cat === 'chukka') totChukka += bacha;
                else totTani += bacha;
            });

            setElementHTML('btn-total-sancha', `<span style='color:#0284c7; font-weight:bold;'>🧵 Tani: ${roundWeight(totTani).toFixed(1)} Kg</span> • <span style='color:#7c3aed; font-weight:bold;'>⚙️ Chukka: ${roundWeight(totChukka).toFixed(1)} Kg</span>`);
        }, 100);
    };

    /* ========================================================================
       7. SPA VIEW TOGGLING & BOOTSTRAP
    ======================================================================== */
    const hideAllSections = () => {
        document.querySelectorAll('.module-section').forEach((el) => {
            el.style.display = 'none';
        });
        setDisplay('dashboard-view', 'none');
        setDisplay('daybook-section', 'none');
    };

    const backToDashboard = () => {
        hideAllSections();
        setDisplay('dashboard-view', window.innerWidth <= 860 ? 'block' : 'flex');
        setDisplay('daybook-section', 'none');

        renderDashboardKarkhanaTabs();
        if (typeof window.populateSessionDropdown === 'function') {
            window.populateSessionDropdown();
        }
        renderDashboardDayBook();
        updateDashboardBadgeTotals();
    };

    const openDayBookModule = () => {
        hideAllSections();
        daybookViewMode = 'menu';
        daybookMenuActiveIdx = 0;
        setDisplay('daybook-section', 'block');
        renderDashboardDayBook();
    };

    const getCurrentActiveSection = () => {
        const sections = [
            'dashboard-view', 'tally-master-section', 'admin-section', 'info-section',
            'kariger-section', 'kariger-sheet-section', 'bana-section',
            'zari-section', 'saree-section', 'payment-section', 'sancha-section',
            'jobwork-section', 'jw-trail-section', 'stock-summary-section', 'daybook-section'
        ];
        for (let i = 0; i < sections.length; i++) {
            const el = document.getElementById(sections[i]);
            if (el && el.style.display !== 'none') return sections[i];
        }
        return 'dashboard-view';
    };

    const triggerActiveSectionRefresh = () => {
        const cur = getCurrentActiveSection();
        if (cur === 'dashboard-view') {
            renderDashboardKarkhanaTabs();
            renderDashboardDayBook();
            updateDashboardBadgeTotals();
        } else if (cur === 'daybook-section') {
            renderDashboardDayBook();
        } else if (cur === 'kariger-section' && typeof window.renderKarigerTable === 'function') {
            window.renderKarigerTable();
        } else if (cur === 'bana-section' && typeof window.renderBanaTable === 'function') {
            window.renderBanaTable();
        } else if (cur === 'zari-section' && typeof window.renderZariTable === 'function') {
            window.renderZariTable();
        } else if (cur === 'saree-section' && typeof window.renderSareeTable === 'function') {
            window.renderSareeTable();
        } else if (cur === 'payment-section' && typeof window.renderPaymentTable === 'function') {
            window.renderPaymentTable();
        } else if (cur === 'sancha-section' && typeof window.renderSanchaTable === 'function') {
            window.renderSanchaTable();
        }
    };

    const initApp = () => {
        initDaybookVisibilityObserver();
        const dEl = document.getElementById('dash-day-date');
        if (dEl) {
            dEl.value = getToday();
            dEl.addEventListener('change', () => {
                daybookCurrentPage = 1;
                renderDashboardDayBook();
            });
        }

        renderDashboardKarkhanaTabs();
        if (typeof window.populateSessionDropdown === 'function') {
            window.populateSessionDropdown();
        }
        renderDashboardDayBook();
        updateDashboardBadgeTotals();
    };

    const bootstrapAppStartup = () => {
        initDaybookVisibilityObserver();
        const idInp = document.getElementById('login-id');
        const passInp = document.getElementById('login-pass');

        const triggerEnterLogin = (e) => {
            if (e.key === 'Enter' && typeof window.handleLogin === 'function') {
                window.handleLogin();
            }
        };

        if (idInp) idInp.addEventListener('keypress', triggerEnterLogin);
        if (passInp) passInp.addEventListener('keypress', triggerEnterLogin);

        if (typeof window.checkAutoLogin === 'function') {
            window.checkAutoLogin();
        } else if (typeof window.showLogin === 'function') {
            window.showLogin();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapAppStartup);
    } else {
        bootstrapAppStartup();
    }

    const daybookAPI = {
        setElementText,
        setElementHTML,
        setT: setElementText,
        setDashboardToday,
        switchDayBookTab,
        openDayBookSubMenu,
        openDayBookReport,
        goDayBookBack,
        renderDashboardKarkhanaTabs,
        switchDashboardKarkhanaTab,
        onDaybookSearchInput,
        changeDaybookPage,
        printDaybookReport,
        renderDashboardDayBook,
        updateDashboardBadgeTotals,
        hideAllSections,
        backToDashboard,
        openDayBookModule,
        triggerActiveSectionRefresh,
        getCurrentActiveSection,
        initApp
    };

    Object.keys(daybookAPI).forEach((fnName) => { window[fnName] = daybookAPI[fnName]; });
    window.DaybookEngine = daybookAPI;
    window.openDayBookModule = openDayBookModule;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = daybookAPI;
    }
})();
