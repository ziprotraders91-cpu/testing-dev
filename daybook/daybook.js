/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE ROZANA DAY-BOOK & DASHBOARD ENGINE
   File: daybook/daybook.js • Developed by Farhan Jawed
   (Universal Section Isolation + Pagination + Clean Tabs & A6 Print)
============================================================================ */

(() => {
    'use strict';

    window.currentDayBookTab = 'bana';
    window.currentDashboardKarkhanaFilter = 'all';
    window.badgeCalculationTimer = null;

    let daybookCurrentPage = 1;
    const DAYBOOK_PAGE_SIZE = 15;
    let currentDaybookFilteredRowsCache = [];
    let daybookSearchDebounceTimer = null;

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
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

    const getToday = () => {
        return (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];
    };

    const matchesGodown = (itemKid, targetKid) => {
        if (!targetKid || targetKid === 'all') return true;
        const cleanTarget = (!targetKid || targetKid === 'k_main') ? 'k_main' : String(targetKid).trim();
        const cleanItem = (!itemKid || itemKid === 'k_main') ? 'k_main' : String(itemKid).trim();
        return cleanItem === cleanTarget;
    };

    /* ========================================================================
       NAVIGATION & TABS
       ======================================================================== */
    const setDashboardToday = () => {
        const dateInput = document.getElementById('dash-day-date');
        if (dateInput) dateInput.value = getToday();
        daybookCurrentPage = 1;
        renderDashboardDayBook();
    };

    const switchDayBookTab = (tab) => {
        window.currentDayBookTab = tab;
        daybookCurrentPage = 1;
        ['bana', 'zari', 'saree', 'payment', 'sancha'].forEach((t) => {
            const el = document.getElementById(`btn-tab-${t}`);
            if (el) {
                if (t === tab) el.classList.add('active');
                else el.classList.remove('active');
            }
        });
        renderDashboardDayBook();
    };

    const renderDashboardKarkhanaTabs = () => {
        const bar = document.getElementById('dash-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }

        const isAllActive = (window.currentDashboardKarkhanaFilter === 'all') ? ' active' : '';
        let html = `
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
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
       DAY-BOOK RENDER ENGINE
       ======================================================================== */
    const renderDashboardDayBook = () => {
        const d = document.getElementById('dash-day-date')?.value || getToday();
        const thead = document.getElementById('dash-daybook-thead');
        const tbody = document.getElementById('dash-daybook-tbody');
        const tfoot = document.getElementById('dash-daybook-tfoot');
        if (!thead || !tbody || !tfoot) return;

        const targetKid = window.currentDashboardKarkhanaFilter;
        const isAll = (targetKid === 'all');

        const tableEl = thead.closest('table');
        if (tableEl && tableEl.parentElement && !document.getElementById('dash-daybook-controls-bar')) {
            const ctrlBar = document.createElement('div');
            ctrlBar.id = 'dash-daybook-controls-bar';
            ctrlBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin:10px 0 12px 0;';
            ctrlBar.innerHTML = `
                <div style="flex:1; min-width:220px;">
                    <input type="text" id="dash-daybook-search" class="search-box" placeholder="🔍 Search Kariger, Vivran, Item, In/Out..." style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;" oninput="onDaybookSearchInput()">
                </div>
                <div>
                    <button type="button" id="dash-daybook-print-btn" class="sheet-btn" style="background:#1e3a8a; color:#ffffff; padding:7px 14px; font-weight:bold; border-radius:6px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" onclick="printDaybookReport()">
                        🖨️ A6 Print
                    </button>
                </div>`;
            tableEl.parentElement.insertBefore(ctrlBar, tableEl);
        }

        const searchInp = document.getElementById('dash-daybook-search') || document.getElementById('search-daybook-input');
        const searchTxt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        let bIn = 0, bOut = 0, zIn = 0, zOut = 0, pIn = 0, pOut = 0;
        const bStock = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const zStock = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];

        bStock.forEach((b) => {
            if (b?.date === d && matchesGodown(b.karkhanaId, targetKid)) {
                bIn += safeNum(b.aaya);
            }
        });

        zStock.forEach((z) => {
            if (z?.date === d && matchesGodown(z.karkhanaId, targetKid)) {
                zIn += safeNum(z.aaya);
            }
        });

        const karList = (typeof window.sanitizeKarigerList === 'function') 
            ? window.sanitizeKarigerList() 
            : (window.safeArray ? window.safeArray(window.getStore('kariger_list')) : []);

        karList.forEach((k) => {
            if (!matchesGodown(k.karkhanaId, targetKid)) return;

            const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
            sheets.forEach((sh) => {
                const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
                rows.forEach((r) => {
                    if (r?.date === d) {
                        const netB = safeNum(r.netBana);
                        const retB = safeNum(r.retBana);
                        const netZ = safeNum(r.netZari);
                        const retZ = safeNum(r.retZari);
                        const paid = safeNum(r.paid);

                        if (netB > 0) bOut += netB;
                        if (retB > 0) bIn += retB;
                        if (netZ > 0) zOut += netZ;
                        if (retZ > 0) zIn += retZ;
                        if (paid > 0) pOut += paid;
                    }
                });
            });
        });

        const transfers = (window.safeArray ? window.safeArray(window.getStore('material_transfers')) : [])
            .filter((t) => t?.date === d);

        transfers.forEach((t) => {
            const qty = safeNum(t.qty || t.quantity);
            const isFrom = matchesGodown(t.fromKarkhanaId, targetKid);
            const isTo = matchesGodown(t.toKarkhanaId, targetKid);

            if (t.type === 'bana') {
                if (!isAll && isFrom) bOut += qty;
                if (!isAll && isTo) bIn += qty;
            } else if (t.type === 'zari') {
                if (!isAll && isFrom) zOut += qty;
                if (!isAll && isTo) zIn += qty;
            }
        });

        const dbEntries = (window.safeArray ? window.safeArray(window.getStore('daybook_entries')) : [])
            .filter((x) => x?.date === d);

        dbEntries.forEach((e) => {
            if (!matchesGodown(e.karkhanaId, targetKid)) return;

            const amt = safeNum(e.amount);
            if (e.type === 'receipt') {
                pIn += amt;
            } else if (e.type === 'payment' && !e.karigerId) {
                pOut += amt;
            }
        });

        const rawSareeHistory = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        const sH = [];

        rawSareeHistory.forEach((h) => {
            if (!h || h.date !== d) return;
            if (!matchesGodown(h.karkhanaId, targetKid)) return;

            const ref = String(h.refId || '');
            const isJobWork = ref.startsWith('jwb_');
            const isDukan = ref.startsWith('duk_');
            const inQ = safeInt(h.aai !== undefined ? h.aai : h.pcs);
            const outQ = safeInt(h.gai);

            if (isDukan) return;
            if (isJobWork && inQ > 0) return;

            if (isJobWork && outQ > 0) {
                const workerLabel = h.note || h.typeLabel || 'Job Work';
                const isCal = String(h.typeLabel || '').toLowerCase().includes('calender');
                const cleanLabel = isCal 
                    ? `Calender me hai (${workerLabel.replace(' ko bheja', '')})` 
                    : `Cutting me hai (${workerLabel.replace(' ko bheja', '')})`;

                sH.push({
                    sareeName: h.sareeName || 'Saree',
                    karigerName: h.karigerName || h.kariger || '-',
                    aai: 0,
                    gai: outQ,
                    detail: cleanLabel
                });
                return;
            }

            if (inQ > 0 || outQ > 0) {
                sH.push({
                    sareeName: h.sareeName || h.name || 'Saree',
                    karigerName: h.karigerName || h.kariger || '-',
                    aai: inQ,
                    gai: outQ,
                    detail: h.typeLabel || h.note || 'Fresh Saree Movement'
                });
            }
        });

        let sIn = 0, sOut = 0;
        sH.forEach((h) => {
            sIn += safeInt(h.aai);
            sOut += safeInt(h.gai);
        });

        const sanchaHist = (window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [])
            .filter((h) => h?.date === d && matchesGodown(h.karkhanaId, targetKid));

        let sanchaIn = 0, sanchaOut = 0;
        sanchaHist.forEach((h) => {
            sanchaIn += safeNum(h.aaya);
            sanchaOut += safeNum(h.gaya);
        });

        setElementText('sub-day-bana', `In: +${bIn.toFixed(1)} | Out: -${bOut.toFixed(1)}`);
        setElementText('sub-day-zari', `In: +${zIn.toFixed(1)} | Out: -${zOut.toFixed(1)}`);
        setElementText('sub-day-saree', `In: +${sIn} | Out: -${sOut}`);
        setElementText('sub-day-payment', `${pIn > 0 ? `In: +₹${pIn.toFixed(0)} | ` : ''}Diya: ₹${pOut.toFixed(0)}`);
        setElementText('sub-day-sancha', `In: +${sanchaIn.toFixed(1)} | Out: -${sanchaOut.toFixed(1)}`);

        let pager = document.getElementById('dash-daybook-pagination-controls');
        if (!pager && tableEl && tableEl.parentElement) {
            pager = document.createElement('div');
            pager.id = 'dash-daybook-pagination-controls';
            pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
            tableEl.parentElement.appendChild(pager);
        }

        // ================= TAB 1: BANA =================
        if (window.currentDayBookTab === 'bana') {
            thead.innerHTML = "<tr style='background:#059669; color:white;'><th>Bana Ka Naam</th><th>Kariger / Godam Vivran</th><th>📥 Aaya (In)</th><th>📤 Gaya (Out)</th></tr>";
            let bRows = [];

            bStock.forEach((b) => {
                if (b?.date === d && matchesGodown(b.karkhanaId, targetKid) && safeNum(b.aaya) > 0) {
                    bRows.push({
                        name: b.name,
                        desc: b.isOpening ? '📦 Opening Stock' : 'Godam Purchase',
                        inQty: safeNum(b.aaya),
                        outQty: 0
                    });
                }
            });

            karList.forEach((k) => {
                if (!matchesGodown(k.karkhanaId, targetKid)) return;

                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                sheets.forEach((sh) => {
                    const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
                    rows.forEach((r) => {
                        if (r?.date === d) {
                            const itName = r.banaItemName || r.banaItem || 'Bana';
                            const netB = safeNum(r.netBana);
                            const retB = safeNum(r.retBana);

                            if (netB > 0) bRows.push({ name: itName, desc: `${k.name} (${sh.title})`, inQty: 0, outQty: netB });
                            if (retB > 0) bRows.push({ name: itName, desc: `${k.name} (${sh.title}) Return`, inQty: retB, outQty: 0 });
                        }
                    });
                });
            });

            transfers.filter((t) => t?.type === 'bana').forEach((t) => {
                const q = safeNum(t.qty || t.quantity);
                const fName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.fromKarkhanaId) : t.fromKarkhanaId;
                const tName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.toKarkhanaId) : t.toKarkhanaId;

                if (isAll) {
                    bRows.push({ name: t.itemName, desc: `Transfer: ${fName} ➔ ${tName}`, inQty: q, outQty: q });
                } else {
                    if (matchesGodown(t.fromKarkhanaId, targetKid)) {
                        bRows.push({ name: t.itemName, desc: `Transfer Out ➔ ${tName}`, inQty: 0, outQty: q });
                    }
                    if (matchesGodown(t.toKarkhanaId, targetKid)) {
                        bRows.push({ name: t.itemName, desc: `Transfer In ⬅ ${fName}`, inQty: q, outQty: 0 });
                    }
                }
            });

            if (searchTxt) {
                bRows = bRows.filter((r) => `${r.name || ''} ${r.desc || ''} ${r.inQty} ${r.outQty} In Out Aaya Gaya`.toLowerCase().includes(searchTxt));
            }

            currentDaybookFilteredRowsCache = bRows;
            renderPaginatedDaybookRows(bRows, tbody, pager, '#059669', (r) => `
                <tr>
                    <td><strong>${esc(r.name)}</strong></td>
                    <td>${esc(r.desc)}</td>
                    <td style='color:#059669; font-weight:700;'>${r.inQty > 0 ? `+${r.inQty.toFixed(2)}` : '-'}</td>
                    <td style='color:#dc2626; font-weight:700;'>${r.outQty > 0 ? `-${r.outQty.toFixed(2)}` : '-'}</td>
                </tr>
            `, 'Is tarikh / filter me Bana ki koi entry nahi hai.', 4);

            let curIn = 0, curOut = 0;
            bRows.forEach(r => { curIn += r.inQty; curOut += r.outQty; });
            tfoot.innerHTML = `<tr><td colspan='2'><strong>Total Rozana Bana:</strong></td><td><strong style='color:#059669;'>+${curIn.toFixed(2)}</strong></td><td><strong style='color:#dc2626;'>-${curOut.toFixed(2)}</strong></td></tr>`;

        // ================= TAB 2: ZARI =================
        } else if (window.currentDayBookTab === 'zari') {
            thead.innerHTML = "<tr style='background:#ea580c; color:white;'><th>Zari Ka Naam</th><th>Kariger / Godam Vivran</th><th>📥 Aayi (In)</th><th>📤 Gayi (Out)</th></tr>";
            let zRows = [];

            zStock.forEach((z) => {
                if (z?.date === d && matchesGodown(z.karkhanaId, targetKid) && safeNum(z.aaya) > 0) {
                    zRows.push({
                        name: z.name,
                        desc: z.isOpening ? '📦 Opening Stock' : 'Godam Purchase',
                        inQty: safeNum(z.aaya),
                        outQty: 0
                    });
                }
            });

            karList.forEach((k) => {
                if (!matchesGodown(k.karkhanaId, targetKid)) return;

                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                sheets.forEach((sh) => {
                    const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
                    rows.forEach((r) => {
                        if (r?.date === d) {
                            const itName = r.zariItemName || r.zariItem || 'Zari';
                            const netZ = safeNum(r.netZari);
                            const retZ = safeNum(r.retZari);

                            if (netZ > 0) zRows.push({ name: itName, desc: `${k.name} (${sh.title})`, inQty: 0, outQty: netZ });
                            if (retZ > 0) zRows.push({ name: itName, desc: `${k.name} (${sh.title}) Return`, inQty: retZ, outQty: 0 });
                        }
                    });
                });
            });

            transfers.filter((t) => t?.type === 'zari').forEach((t) => {
                const q = safeNum(t.qty || t.quantity);
                const fName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.fromKarkhanaId) : t.fromKarkhanaId;
                const tName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.toKarkhanaId) : t.toKarkhanaId;

                if (isAll) {
                    zRows.push({ name: t.itemName, desc: `Transfer: ${fName} ➔ ${tName}`, inQty: q, outQty: q });
                } else {
                    if (matchesGodown(t.fromKarkhanaId, targetKid)) {
                        zRows.push({ name: t.itemName, desc: `Transfer Out ➔ ${tName}`, inQty: 0, outQty: q });
                    }
                    if (matchesGodown(t.toKarkhanaId, targetKid)) {
                        zRows.push({ name: t.itemName, desc: `Transfer In ⬅ ${fName}`, inQty: q, outQty: 0 });
                    }
                }
            });

            if (searchTxt) {
                zRows = zRows.filter((r) => `${r.name || ''} ${r.desc || ''} ${r.inQty} ${r.outQty} In Out Aayi Gayi`.toLowerCase().includes(searchTxt));
            }

            currentDaybookFilteredRowsCache = zRows;
            renderPaginatedDaybookRows(zRows, tbody, pager, '#ea580c', (r) => `
                <tr>
                    <td><strong>${esc(r.name)}</strong></td>
                    <td>${esc(r.desc)}</td>
                    <td style='color:#059669; font-weight:700;'>${r.inQty > 0 ? `+${r.inQty.toFixed(2)}` : '-'}</td>
                    <td style='color:#dc2626; font-weight:700;'>${r.outQty > 0 ? `-${r.outQty.toFixed(2)}` : '-'}</td>
                </tr>
            `, 'Is tarikh / filter me Zari ki koi entry nahi hai.', 4);

            let curIn = 0, curOut = 0;
            zRows.forEach(r => { curIn += r.inQty; curOut += r.outQty; });
            tfoot.innerHTML = `<tr><td colspan='2'><strong>Total Rozana Zari:</strong></td><td><strong style='color:#059669;'>+${curIn.toFixed(2)}</strong></td><td><strong style='color:#dc2626;'>-${curOut.toFixed(2)}</strong></td></tr>`;

        // ================= TAB 3: SAREE =================
        } else if (window.currentDayBookTab === 'saree') {
            thead.innerHTML = "<tr style='background:#2563eb; color:white;'><th>Saree Ka Naam</th><th>Kariger / Vivran</th><th>📥 Aayi (In)</th><th>📤 Gayi (Out)</th><th>Detail</th></tr>";
            let sRows = sH;

            if (searchTxt) {
                sRows = sRows.filter((h) => `${h.sareeName || ''} ${h.karigerName || ''} ${h.detail || ''} ${h.aai} ${h.gai} In Out Aai Gai`.toLowerCase().includes(searchTxt));
            }

            currentDaybookFilteredRowsCache = sRows;
            renderPaginatedDaybookRows(sRows, tbody, pager, '#2563eb', (h) => {
                const inQ = safeInt(h.aai);
                const outQ = safeInt(h.gai);
                return `<tr>
                    <td><strong>${esc(h.sareeName)}</strong></td>
                    <td>👤 ${esc(h.karigerName)}</td>
                    <td style='color:#059669; font-weight:700;'>${inQ > 0 ? `+${inQ}` : '-'}</td>
                    <td style='color:#dc2626; font-weight:700;'>${outQ > 0 ? `-${outQ}` : '-'}</td>
                    <td>${outQ > 0 ? `<span style='color:#dc2626; font-weight:bold;'>${esc(h.detail)}</span>` : esc(h.detail)}</td>
                </tr>`;
            }, 'Is tarikh / filter me Saree ki koi entry nahi hai.', 5);

            let curIn = 0, curOut = 0;
            sRows.forEach(h => { curIn += safeInt(h.aai); curOut += safeInt(h.gai); });
            tfoot.innerHTML = `<tr><td colspan='2'><strong>Kul Saree:</strong></td><td><strong style='color:#059669;'>+${curIn} Pcs</strong></td><td><strong style='color:#dc2626;'>-${curOut} Pcs</strong></td><td>-</td></tr>`;

        // ================= TAB 4: PAYMENT =================
        } else if (window.currentDayBookTab === 'payment') {
            thead.innerHTML = "<tr style='background:#7c3aed; color:white;'><th>Party / Kariger</th><th>Vivran / Khata</th><th>📥 Aamad (In)</th><th>📤 Diya (Out)</th></tr>";
            let pRows = [];

            karList.forEach((k) => {
                if (!matchesGodown(k.karkhanaId, targetKid)) return;

                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                sheets.forEach((sh) => {
                    const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
                    rows.forEach((r) => {
                        if (r?.date === d && safeNum(r.paid) > 0) {
                            pRows.push({
                                party: k.name,
                                desc: `Mazdoori (${sh.title})`,
                                inAmt: 0,
                                outAmt: safeNum(r.paid)
                            });
                        }
                    });
                });
            });

            dbEntries.forEach((e) => {
                if (!matchesGodown(e.karkhanaId, targetKid) || e.karigerId) return;

                const amt = safeNum(e.amount);
                if (e.type === 'receipt') {
                    pRows.push({ party: e.party || 'Cash Inward', desc: e.remarks || e.category, inAmt: amt, outAmt: 0 });
                } else {
                    pRows.push({ party: e.party || 'Cash Payment', desc: e.remarks || e.category, inAmt: 0, outAmt: amt });
                }
            });

            if (searchTxt) {
                pRows = pRows.filter((dp) => `${dp.party || ''} ${dp.desc || ''} ${dp.inAmt} ${dp.outAmt} In Out Aamad Diya`.toLowerCase().includes(searchTxt));
            }

            currentDaybookFilteredRowsCache = pRows;
            renderPaginatedDaybookRows(pRows, tbody, pager, '#7c3aed', (dp) => `
                <tr>
                    <td><strong>${esc(dp.party)}</strong></td>
                    <td>${esc(dp.desc)}</td>
                    <td style='color:#059669; font-weight:700;'>${dp.inAmt > 0 ? `+ ₹ ${dp.inAmt.toFixed(2)}` : '-'}</td>
                    <td style='color:#dc2626; font-weight:700;'>${dp.outAmt > 0 ? `- ₹ ${dp.outAmt.toFixed(2)}` : '-'}</td>
                </tr>
            `, 'Is tarikh / filter me koi payment ya cash transfer nahi mila.', 4);

            let curIn = 0, curOut = 0;
            pRows.forEach(dp => { curIn += dp.inAmt; curOut += dp.outAmt; });
            tfoot.innerHTML = `<tr><td colspan='2'><strong>Total Rozana Cash Movement:</strong></td><td><strong style='color:#059669;'>+ ₹ ${curIn.toFixed(2)}</strong></td><td><strong style='color:#dc2626;'>- ₹ ${curOut.toFixed(2)}</strong></td></tr>`;

        // ================= TAB 5: SANCHA =================
        } else if (window.currentDayBookTab === 'sancha') {
            thead.innerHTML = "<tr style='background:#0284c7; color:white;'><th>Item (Category)</th><th>Kariger / Vivran</th><th>📥 Aaya (In)</th><th>📤 Gaya (Out)</th></tr>";
            let sRows = sanchaHist;

            if (searchTxt) {
                sRows = sRows.filter((h) => `${h.name || ''} ${h.category || ''} ${h.kariger || ''} ${h.type || ''} ${h.aaya || h.qty || ''} ${h.gaya || ''} Tani Chukka In Out`.toLowerCase().includes(searchTxt));
            }

            currentDaybookFilteredRowsCache = sRows;
            renderPaginatedDaybookRows(sRows, tbody, pager, '#0284c7', (h) => {
                const catBadge = (h.category === 'chukka') 
                    ? "<span class='badge-blue' style='background:#ede9fe; color:#6d28d9; font-size:10px;'>⚙️ Chukka</span>" 
                    : "<span class='badge-blue' style='font-size:10px;'>🧵 Tani</span>";
                const inQ = safeNum(h.aaya || h.qty);
                const outQ = safeNum(h.gaya);

                return `<tr>
                    <td><strong>${esc(h.name || 'Sancha')}</strong> ${catBadge}</td>
                    <td>${h.kariger ? `👤 ${esc(h.kariger)}` : esc(h.type || 'Godam Purchase')}</td>
                    <td style='color:#059669; font-weight:700;'>${inQ > 0 ? `+${inQ.toFixed(2)} Kg` : '-'}</td>
                    <td style='color:#dc2626; font-weight:700;'>${outQ > 0 ? `-${outQ.toFixed(2)} Kg` : '-'}</td>
                </tr>`;
            }, 'Is tarikh / filter me Sancha (Tani / Chukka) ki koi entry nahi hai.', 4);

            let curIn = 0, curOut = 0;
            sRows.forEach(h => { curIn += safeNum(h.aaya || h.qty); curOut += safeNum(h.gaya); });
            tfoot.innerHTML = `<tr><td colspan='2'><strong>Total Rozana Sancha:</strong></td><td><strong style='color:#059669;'>+${curIn.toFixed(2)} Kg</strong></td><td><strong style='color:#dc2626;'>-${curOut.toFixed(2)} Kg</strong></td></tr>`;
        }
    };

    const renderPaginatedDaybookRows = (rows, tbody, pager, themeColor, rowTemplateFn, emptyMsg, colSpan) => {
        const totalEntries = rows.length;

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan='${colSpan}' style='text-align:center; padding:15px; color:#888;'>${emptyMsg}</td></tr>`;
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
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + DAYBOOK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${daybookCurrentPage <= 1 ? '#cbd5e1' : themeColor}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${daybookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${daybookCurrentPage <= 1 ? 'disabled' : ''} onclick="changeDaybookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${daybookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${daybookCurrentPage >= totalPages ? '#cbd5e1' : themeColor}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${daybookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${daybookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeDaybookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeDaybookPage = (delta) => {
        daybookCurrentPage += delta;
        renderDashboardDayBook();
    };

    /* ========================================================================
       PRINT ENGINE
       ======================================================================== */
    const getDashboardKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printDaybookReport = () => {
        const rows = currentDaybookFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi record nahi mila!');
        }

        const tab = window.currentDayBookTab || 'bana';
        const d = document.getElementById('dash-day-date')?.value || getToday();
        const kName = getDashboardKarkhanaPrintName(window.currentDashboardKarkhanaFilter);
        const searchInp = document.getElementById('dash-daybook-search') || document.getElementById('search-daybook-input');
        const sTxt = searchInp ? searchInp.value.trim() : '';

        const tabTitles = {
            bana: 'BANA ROZANA DAYBOOK',
            zari: 'ZARI ROZANA DAYBOOK',
            saree: 'SAREE ROZANA DAYBOOK',
            payment: 'PAYMENT & CASH MOVEMENT DAYBOOK',
            sancha: 'SANCHA (TANI & CHUKKA) DAYBOOK'
        };

        const title = tabTitles[tab] || 'ROZANA DAYBOOK';

        let thHtml = '';
        let rowsHtml = '';
        let totHtml = '';

        if (tab === 'bana' || tab === 'zari') {
            thHtml = `<tr><th>ITEM</th><th>KARIGER / VIVRAN</th><th style="text-align:right;">AAYA (IN)</th><th style="text-align:right;">GAYA (OUT)</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((r) => {
                tIn += safeNum(r.inQty);
                tOut += safeNum(r.outQty);
                rowsHtml += `
                    <tr style="border-bottom:1px dashed #ccc;">
                        <td style="padding:4px 2px; font-weight:bold;">${esc(r.name)}</td>
                        <td style="padding:4px 2px;">${esc(r.desc)}</td>
                        <td style="padding:4px 2px; text-align:right;">${r.inQty > 0 ? `+${r.inQty.toFixed(2)}` : '-'}</td>
                        <td style="padding:4px 2px; text-align:right;">${r.outQty > 0 ? `-${r.outQty.toFixed(2)}` : '-'}</td>
                    </tr>`;
            });
            totHtml = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Aaya:</span> <span>+${tIn.toFixed(2)} Kg</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Gaya:</span> <span>-${tOut.toFixed(2)} Kg</span></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                    <span>NET BALANCE:</span> <span>${(tIn - tOut).toFixed(2)} Kg</span>
                </div>`;
        } else if (tab === 'saree') {
            thHtml = `<tr><th>SAREE</th><th>MAKER</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th><th>DETAIL</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((h) => {
                const inQ = safeInt(h.aai);
                const outQ = safeInt(h.gai);
                tIn += inQ;
                tOut += outQ;
                rowsHtml += `
                    <tr style="border-bottom:1px dashed #ccc;">
                        <td style="padding:4px 2px; font-weight:bold;">${esc(h.sareeName)}</td>
                        <td style="padding:4px 2px;">${esc(h.karigerName)}</td>
                        <td style="padding:4px 2px; text-align:right;">${inQ > 0 ? `+${inQ}` : '-'}</td>
                        <td style="padding:4px 2px; text-align:right;">${outQ > 0 ? `-${outQ}` : '-'}</td>
                        <td style="padding:4px 2px; font-size:9px;">${esc(h.detail)}</td>
                    </tr>`;
            });
            totHtml = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Aai Saree:</span> <span>+${tIn} Pcs</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Gai Saree:</span> <span>-${tOut} Pcs</span></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                    <span>NET SAREE:</span> <span>${tIn - tOut} Pcs</span>
                </div>`;
        } else if (tab === 'payment') {
            thHtml = `<tr><th>PARTY / KARIGER</th><th>KHATA / NOTE</th><th style="text-align:right;">AAMAD (₹)</th><th style="text-align:right;">DIYA (₹)</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((dp) => {
                tIn += safeNum(dp.inAmt);
                tOut += safeNum(dp.outAmt);
                rowsHtml += `
                    <tr style="border-bottom:1px dashed #ccc;">
                        <td style="padding:4px 2px; font-weight:bold;">${esc(dp.party)}</td>
                        <td style="padding:4px 2px;">${esc(dp.desc)}</td>
                        <td style="padding:4px 2px; text-align:right;">${dp.inAmt > 0 ? `+₹${dp.inAmt.toFixed(2)}` : '-'}</td>
                        <td style="padding:4px 2px; text-align:right;">${dp.outAmt > 0 ? `-₹${dp.outAmt.toFixed(2)}` : '-'}</td>
                    </tr>`;
            });
            totHtml = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Cash Aamad:</span> <span>+₹ ${tIn.toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Cash Diya:</span> <span>-₹ ${tOut.toFixed(2)}</span></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                    <span>NET CASH FLOW:</span> <span>₹ ${(tIn - tOut).toFixed(2)}</span>
                </div>`;
        } else if (tab === 'sancha') {
            thHtml = `<tr><th>ITEM</th><th>KARIGER / VIVRAN</th><th style="text-align:right;">AAYA (IN)</th><th style="text-align:right;">GAYA (OUT)</th></tr>`;
            let tIn = 0, tOut = 0;
            rows.forEach((h) => {
                const inQ = safeNum(h.aaya || h.qty);
                const outQ = safeNum(h.gaya);
                tIn += inQ;
                tOut += outQ;
                const catStr = h.category === 'chukka' ? '(Chukka)' : '(Tani)';
                rowsHtml += `
                    <tr style="border-bottom:1px dashed #ccc;">
                        <td style="padding:4px 2px; font-weight:bold;">${esc(h.name)} ${catStr}</td>
                        <td style="padding:4px 2px;">${esc(h.kariger || h.type || '-')}</td>
                        <td style="padding:4px 2px; text-align:right;">${inQ > 0 ? `+${inQ.toFixed(2)}` : '-'}</td>
                        <td style="padding:4px 2px; text-align:right;">${outQ > 0 ? `-${outQ.toFixed(2)}` : '-'}</td>
                    </tr>`;
            });
            totHtml = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Aaya:</span> <span>+${tIn.toFixed(2)} Kg</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Kul Gaya:</span> <span>-${tOut.toFixed(2)} Kg</span></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                    <span>NET SANCHA:</span> <span>${(tIn - tOut).toFixed(2)} Kg</span>
                </div>`;
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
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p><strong>${title}</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Tarikh:</strong> ${esc(d)}</div>
                        ${sTxt ? `<div><strong>Search Filter:</strong> "${esc(sTxt)}"</div>` : ''}
                        <div><strong>Total Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>${thHtml}</thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">${totHtml}</div>
                    <div class="footer">
                        <p>हस्ताक्षर / मुंशी: ____________________</p>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 600);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    /* ========================================================================
       DASHBOARD BADGES ENGINE
       ======================================================================== */
    const updateDashboardBadgeTotals = () => {
        const targetKid = window.currentDashboardKarkhanaFilter;
        const isAll = (targetKid === 'all');

        let karList = (typeof window.sanitizeKarigerList === 'function') 
            ? window.sanitizeKarigerList() 
            : (window.safeArray ? window.safeArray(window.getStore('kariger_list')) : []);

        if (!isAll) {
            karList = karList.filter((k) => matchesGodown(k.karkhanaId, targetKid));
        }

        setElementText('btn-total-kariger', `Total: ${karList.length}`);

        const infoLen = window.safeArray ? window.safeArray(window.getStore('info_ledger')).length : 0;
        setElementText('btn-total-info', `Total: ${infoLen}`);

        let ts = 0;
        const sH = (window.safeArray ? window.safeArray(window.getStore('saree_history')) : [])
            .filter((x) => (x.type || 'fresh') === 'fresh' && matchesGodown(x.karkhanaId, targetKid));

        if (sH.length) {
            sH.forEach((s) => {
                const inQ = safeInt(s.aai !== undefined ? s.aai : s.pcs);
                const outQ = safeInt(s.gai);
                ts += (inQ - outQ);
            });
        }
        setElementText('btn-total-saree', `Stock: ${Math.max(0, ts)} Pcs`);

        if (window.badgeCalculationTimer) clearTimeout(window.badgeCalculationTimer);

        window.badgeCalculationTimer = setTimeout(() => {
            let tb = 0;
            const uniqueBana = new Set();
            const bStock = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];

            bStock.forEach((b) => {
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
            const zStock = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];

            zStock.forEach((z) => {
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
            } else {
                karList.forEach((k) => {
                    if (k?.id && typeof window.calculateSheetTotals === 'function') {
                        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                        const curSheet = sheets[sheets.length - 1];
                        if (curSheet) {
                            const c = window.calculateSheetTotals(curSheet);
                            totalDiyaAll += safeNum(c.totPaid);
                            totalBakiAll += safeNum(c.remainingAmt);
                        }
                    }
                });
            }

            setElementHTML('btn-total-payment', `<span style='color:#059669; font-weight:bold;'>Diya: ₹ ${roundCurrency(totalDiyaAll).toFixed(0)}</span> • <span style='color:#dc2626; font-weight:bold;'>Baki: ₹ ${roundCurrency(totalBakiAll).toFixed(0)}</span>`);

            let totTani = 0, totChukka = 0;
            const sanchaList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];

            sanchaList.forEach((s) => {
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
       🔹 SPA VIEW TOGGLING (DAYBOOK ISOLATION)
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
        setDisplay('dashboard-view', 'block');
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
        setDisplay('daybook-section', 'block');
        renderDashboardDayBook();
    };

    const getCurrentActiveSection = () => {
        const sections = [
            'dashboard-view', 'admin-section', 'info-section', 
            'kariger-section', 'kariger-sheet-section', 'bana-section', 
            'zari-section', 'saree-section', 'payment-section', 'sancha-section',
            'jobwork-section', 'daybook-section'
        ];
        for (let i = 0; i < sections.length; i++) {
            const el = document.getElementById(sections[i]);
            if (el && el.style.display === 'block') return sections[i];
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

    /* ========================================================================
       BOOTSTRAP & EXPORTS
       ======================================================================== */
    const initApp = () => {
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

    Object.keys(daybookAPI).forEach((fnName) => {
        window[fnName] = daybookAPI[fnName];
    });

    window.DaybookEngine = daybookAPI;
    window.openDayBookModule = openDayBookModule;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = daybookAPI;
    }
})();
