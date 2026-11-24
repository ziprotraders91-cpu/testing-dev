/* ============================================================================
   SIMPLICITY ERP (THE TALLY BRIDGE) - DUKAN MANAGEMENT DAYBOOK (100% ZERO-MOUSE)
   File: dukan-erp/dukan-daybook.js
   Synced with: dukan-core.js, dukan-order.js, dukan-challan.js
   Features:
   - Step 1: Tally Day-Book Menu (All / Orders / Challans / Party Summary)
   - Step 2: Split Report + Right-Side Live Voucher Preview + Drill-Down
   - 100% Keyboard: ↑↓, Enter (Open), Esc (Back), A/O/H/P, F2/Alt+D, F3, F4/Tab, Alt+P, Alt+V
============================================================================ */
(() => {
    'use strict';

    const D = window.DukanERP;
    if (!D) return;

    if (window._daybookLoaded) {
        console.warn('[dukan-daybook] Already loaded — skip');
        return;
    }
    window._daybookLoaded = true;

    let dbMode = 'menu';          // 'menu' | 'report'
    let dbTab = 'all';            // 'all' | 'orders' | 'challans' | 'parties'
    let dbDate = D.today();
    let dbAllDates = false;
    let dbSearch = '';
    let dbPage = 1;
    let dbMenuIdx = 0;
    let dbNavIdx = 0;

    const toIso = (val) => {
        const s = String(val || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
    };

    const matchDate = (itemDate) => {
        if (dbAllDates) return true;
        return toIso(itemDate) === toIso(dbDate);
    };

    const sumPcs = (items) => (items || []).reduce((s, it) => s + D.num(it?.qty), 0);
    const sumAmt = (items) => (items || []).reduce((s, it) => s + (D.num(it?.qty) * D.num(it?.rate)), 0);

    const buildDayBookDataset = () => {
        const allOrders = D.get('dukan_orders');
        const allChallans = D.get('dukan_challans');

        const orders = allOrders.filter((o) => o && matchDate(o.date));
        const challans = allChallans.filter((c) => c && matchDate(c.date));

        const unified = [];
        orders.forEach((o) => {
            const pcs = sumPcs(o.items);
            const amt = sumAmt(o.items);
            const itemsTxt = (o.items || []).map((x) => `${x.name}:${x.qty}`).join(', ');
            unified.push({
                kind: 'order',
                id: o.id,
                no: String(o.no || '-'),
                date: toIso(o.date) || D.today(),
                firmName: o.firmName || '-',
                partyId: o.partyId || o.partyName || '',
                partyName: o.partyName || 'PARTY',
                marka: o.marka || '-',
                status: o.status || 'Pending',
                pcs,
                amt,
                items: o.items || [],
                itemsTxt,
                raw: o,
                blob: `order #${o.no} ${o.date} ${D.fmtDate(o.date)} ${o.firmName} ${o.partyName} ${o.marka} ${o.agent} ${o.transport} ${o.status} ${itemsTxt}`.toLowerCase()
            });
        });

        challans.forEach((c) => {
            const pcs = sumPcs(c.items);
            const amt = sumAmt(c.items);
            const itemsTxt = (c.items || []).map((x) => `${x.name}:${x.qty}`).join(', ');
            const linkedOrd = c.orderId ? allOrders.find((o) => o.id === c.orderId) : null;
            unified.push({
                kind: 'challan',
                id: c.id,
                no: String(c.no || '-'),
                date: toIso(c.date) || D.today(),
                firmName: c.firmName || '-',
                partyId: c.partyId || c.partyName || '',
                partyName: c.partyName || 'PARTY',
                marka: c.marka || '-',
                status: linkedOrd ? `Ord #${linkedOrd.no}` : 'Dispatch',
                pcs,
                amt,
                items: c.items || [],
                itemsTxt,
                raw: c,
                blob: `challan #${c.no} ${c.date} ${D.fmtDate(c.date)} ${c.firmName} ${c.partyName} ${c.city || ''} ${c.marka} ${linkedOrd ? linkedOrd.no : ''} ${itemsTxt}`.toLowerCase()
            });
        });

        unified.sort((a, b) => {
            const cmp = String(b.date).localeCompare(String(a.date));
            if (cmp !== 0) return cmp;
            return String(b.id).localeCompare(String(a.id));
        });

        // Party-wise daily summary
        const pMap = new Map();
        unified.forEach((u) => {
            const key = u.partyName || u.partyId || 'PARTY';
            if (!pMap.has(key)) {
                pMap.set(key, {
                    kind: 'party',
                    id: key,
                    partyName: key,
                    ordCount: 0,
                    ordPcs: 0,
                    chCount: 0,
                    chPcs: 0,
                    totAmt: 0,
                    entries: []
                });
            }
            const p = pMap.get(key);
            if (u.kind === 'order') {
                p.ordCount++;
                p.ordPcs += u.pcs;
            } else {
                p.chCount++;
                p.chPcs += u.pcs;
            }
            p.totAmt += u.amt;
            p.entries.push(u);
        });

        const partyRows = Array.from(pMap.values()).sort((a, b) => a.partyName.localeCompare(b.partyName));
        const ordPcs = orders.reduce((s, o) => s + sumPcs(o.items), 0);
        const chPcs = challans.reduce((s, c) => s + sumPcs(c.items), 0);

        return {
            orders,
            challans,
            unified,
            partyRows,
            totals: {
                ordCount: orders.length,
                ordPcs,
                chCount: challans.length,
                chPcs,
                partyCount: partyRows.length
            }
        };
    };

    const getFilteredRows = (ds) => {
        const q = dbSearch.trim().toLowerCase();
        if (dbTab === 'parties') {
            return ds.partyRows.filter((p) => !q || `${p.partyName} ${p.entries.map((e) => e.blob).join(' ')}`.toLowerCase().includes(q));
        }
        return ds.unified.filter((u) => {
            if (dbTab === 'orders' && u.kind !== 'order') return false;
            if (dbTab === 'challans' && u.kind !== 'challan') return false;
            if (q && !u.blob.includes(q)) return false;
            return true;
        });
    };

    const bindDayBookEsc = () => {
        D.onEsc = () => {
            if (dbMode === 'report') {
                dbMode = 'menu';
                render();
            } else {
                window.openDukanGateway();
            }
        };
    };

    D.openDayBook = (resume = false) => {
        D.screen = 'daybook';
        D.onCustomFieldEnter = null;
        if (!resume) {
            dbMode = 'menu';
            dbTab = 'all';
            dbDate = D.today();
            dbAllDates = false;
            dbSearch = '';
            dbPage = 1;
            dbMenuIdx = 0;
            dbNavIdx = 0;
        }
        bindDayBookEsc();
        render();
    };

    D.dbOpenTab = (tabKey, idx = 0) => {
        dbTab = tabKey;
        dbMenuIdx = idx;
        dbMode = 'report';
        dbPage = 1;
        dbNavIdx = 0;
        bindDayBookEsc();
        render();
    };

    D.dbSetDate = (iso) => {
        dbDate = toIso(iso) || D.today();
        dbAllDates = false;
        dbPage = 1;
        dbNavIdx = 0;
        render();
    };

    D.dbToggleAllDates = () => {
        dbAllDates = !dbAllDates;
        dbPage = 1;
        dbNavIdx = 0;
        render();
    };

    D.dbSetToday = () => {
        dbDate = D.today();
        dbAllDates = false;
        dbPage = 1;
        dbNavIdx = 0;
        render();
    };

    D.dbCycleTab = () => {
        const order = ['all', 'orders', 'challans', 'parties'];
        const next = order[(order.indexOf(dbTab) + 1) % order.length];
        D.dbOpenTab(next, order.indexOf(next));
    };

    D.dbOpenRow = (row) => {
        if (!row) return;
        if (row.kind === 'party') {
            dbSearch = row.partyName;
            dbTab = 'all';
            dbPage = 1;
            dbNavIdx = 0;
            render();
            return;
        }
        if (row.kind === 'order' && typeof D.openOrderEdit === 'function') {
            D.openOrderEdit(row.id);
            D.onEsc = () => D.openDayBook(true);
            return;
        }
        if (row.kind === 'challan' && typeof D.openChallan === 'function') {
            D.openChallan(row.id);
            D.onEsc = () => D.openDayBook(true);
        }
    };

    window.dkDbPage = (p) => {
        dbPage = p;
        dbNavIdx = 0;
        render();
    };

    const showSidePreview = (row, ds) => {
        if (!row) {
            return D.renderSide(
                `Dukan Day-Book`,
                dbAllDates ? 'All Dates' : D.fmtDate(dbDate),
                [
                    { label: 'Total Orders', meta: `${ds.totals.ordCount} Ord · ${ds.totals.ordPcs} Pc` },
                    { label: 'Total Challans', meta: `${ds.totals.chCount} Ch · ${ds.totals.chPcs} Pc` },
                    { label: 'Active Parties', meta: `${ds.totals.partyCount} Parties` }
                ],
                false
            );
        }

        if (row.kind === 'party') {
            D.renderSide(
                row.partyName,
                `Ord ${row.ordCount} · Ch ${row.chCount}`,
                row.entries.map((e) => ({
                    label: `${e.kind === 'order' ? '📝 Ord' : '📦 Ch'} #${e.no} (${D.fmtDate(e.date)})`,
                    meta: `${e.pcs} Pc · ${e.itemsTxt}`
                })),
                false
            );
            return;
        }

        const badge = row.kind === 'order' ? '📝 ORDER FORM' : '📦 CHALLAN';
        D.renderSide(
            `${badge} #${row.no}`,
            `${D.fmtDate(row.date)} · ${row.pcs} Pc`,
            [
                { label: `Party: ${row.partyName}`, meta: row.status, active: true },
                { label: `Firm: ${row.firmName}`, meta: `Marka: ${row.marka}` },
                ...(row.items || []).map((it) => ({
                    label: it.name,
                    meta: `${D.num(it.qty)} Pc${D.num(it.rate) ? ` · ₹${D.num(it.rate)}` : ''}`
                }))
            ],
            false
        );
    };

    function renderMenuScreen(ds) {
        const dateLabel = dbAllDates ? 'Sabhi Dates (All)' : D.fmtDate(dbDate);
        const menuItems = [
            {
                key: 'a',
                tab: 'all',
                label: '<span class="dk-gw-key">A</span>ll Vouchers (Orders + Challans)',
                meta: `${ds.totals.ordCount + ds.totals.chCount} Entries · ${ds.totals.ordPcs + ds.totals.chPcs} Pc`
            },
            {
                key: 'o',
                tab: 'orders',
                label: '<span class="dk-gw-key">O</span>rder Form (Daily Orders)',
                meta: `${ds.totals.ordCount} Ord · ${ds.totals.ordPcs} Pc`
            },
            {
                key: 'h',
                tab: 'challans',
                label: 'C<span class="dk-gw-key">h</span>allan &amp; Dispatch',
                meta: `${ds.totals.chCount} Ch · ${ds.totals.chPcs} Pc`
            },
            {
                key: 'p',
                tab: 'parties',
                label: '<span class="dk-gw-key">P</span>arty-Wise Summary',
                meta: `${ds.totals.partyCount} Parties`
            }
        ];

        if (dbMenuIdx >= menuItems.length || dbMenuIdx < 0) dbMenuIdx = 0;

        const left = `
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:10px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <strong style="font-size:14.5px;">Dukan Day-Book (${D.esc(dateLabel)})</strong>
                    <div style="font-size:11.5px; color:#6b7280; margin-top:2px;">[A / O / H / P] ya [↑ ↓ + Enter] se Register Kholein</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <input type="date" id="dk-db-menu-date" value="${D.esc(dbDate)}" onchange="DukanERP.dbSetDate(this.value)" style="padding:5px 8px; border:1px solid #d9b86c; border-radius:5px; font-weight:700; font-size:12px; background:#fff;">
                    <button type="button" tabindex="-1" class="dk-btn" onclick="DukanERP.dbSetToday()">Today [T]</button>
                    <button type="button" tabindex="-1" class="dk-tab ${dbAllDates ? 'active' : ''}" onclick="DukanERP.dbToggleAllDates()">${dbAllDates ? '✓ All Dates [F4]' : 'All Dates [F4]'}</button>
                </div>
            </div>
            ${menuItems.map((it, i) => `
                <button type="button" class="dk-choice-btn ${i === dbMenuIdx ? 'active' : ''}" data-dbkey="${it.key}" onclick="DukanERP.dbOpenTab('${it.tab}', ${i})">
                    <span>${it.label}</span>
                    <span class="dk-cnt-pill">${D.esc(it.meta)}</span>
                </button>
            `).join('')}
        `;

        D.renderShell(`<h2>Dukan Day-Book</h2>`, left, '[↑ ↓] Chunein · [Enter] Kholein · [F2] Date · [T] Today · [F4] All Dates · [Esc] Gateway');
        D.renderSide('Day-Book Summary', dateLabel, [
            { label: 'Total Orders', meta: `${ds.totals.ordCount} Ord · ${ds.totals.ordPcs} Pc`, active: dbMenuIdx === 1 },
            { label: 'Total Challans', meta: `${ds.totals.chCount} Ch · ${ds.totals.chPcs} Pc`, active: dbMenuIdx === 2 },
            { label: 'Parties Active', meta: `${ds.totals.partyCount} Parties`, active: dbMenuIdx === 3 }
        ], false);

        D.onCustomFieldEnter = (id) => {
            if (id === 'dk-db-menu-date') {
                D.dbSetDate(document.getElementById('dk-db-menu-date')?.value);
                return true;
            }
            return false;
        };

        D.bindFormControls({
            focusOrder: ['dk-db-menu-date'],
            listNav: {
                selector: '#dk-left .dk-choice-btn',
                getIdx: () => dbMenuIdx,
                setIdx: (i) => { dbMenuIdx = i; },
                onEnter: (i) => {
                    const item = menuItems[i];
                    if (item) D.dbOpenTab(item.tab, i);
                }
            }
        });

        setTimeout(() => document.querySelectorAll('#dk-left .dk-choice-btn')[dbMenuIdx]?.focus(), 20);
    }

    function renderReportScreen(ds) {
        const tabLabels = {
            all: 'Day-Book › All Vouchers',
            orders: 'Day-Book › Orders',
            challans: 'Day-Book › Challans',
            parties: 'Day-Book › Party Summary'
        };

        const headL = `
            <h2>${tabLabels[dbTab] || 'Dukan Day-Book'}</h2>
            <button type="button" tabindex="-1" class="dk-tab ${dbTab === 'all' ? 'active' : ''}" onclick="DukanERP.dbOpenTab('all', 0)">All (${ds.unified.length})</button>
            <button type="button" tabindex="-1" class="dk-tab ${dbTab === 'orders' ? 'active' : ''}" onclick="DukanERP.dbOpenTab('orders', 1)">Orders (${ds.totals.ordCount})</button>
            <button type="button" tabindex="-1" class="dk-tab ${dbTab === 'challans' ? 'active' : ''}" onclick="DukanERP.dbOpenTab('challans', 2)">Challans (${ds.totals.chCount})</button>
            <button type="button" tabindex="-1" class="dk-tab ${dbTab === 'parties' ? 'active' : ''}" onclick="DukanERP.dbOpenTab('parties', 3)">Party (${ds.totals.partyCount})</button>
            <button type="button" tabindex="-1" class="dk-btn" onclick="DukanERP.printDayBook()">🖨️ Print [Alt+P]</button>
        `;

        const left = `
            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; margin-bottom:10px;">
                <div style="background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; padding:7px 10px;">
                    <small style="font-size:10.5px; color:#6b7280; font-weight:700; display:block;">Orders</small>
                    <strong style="font-size:14px; color:#991b1b;">${ds.totals.ordCount} Ord · ${ds.totals.ordPcs} Pc</strong>
                </div>
                <div style="background:#fdfcf7; border:1px solid #e5d5a7; border-radius:6px; padding:7px 10px;">
                    <small style="font-size:10.5px; color:#6b7280; font-weight:700; display:block;">Challans (Dispatch)</small>
                    <strong style="font-size:14px; color:#15803d;">${ds.totals.chCount} Ch · ${ds.totals.chPcs} Pc</strong>
                </div>
                <div style="background:#fdf6e2; border:1px solid #d9b86c; border-radius:6px; padding:7px 10px;">
                    <small style="font-size:10.5px; color:#92400e; font-weight:700; display:block;">Active Parties</small>
                    <strong style="font-size:14px; color:#1f2937;">${ds.totals.partyCount} Parties</strong>
                </div>
            </div>

            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                <input type="date" id="dk-db-date" value="${D.esc(dbDate)}" onchange="DukanERP.dbSetDate(this.value)" style="padding:6px 9px; border:1px solid #d1d5db; border-radius:5px; font-weight:700; font-size:12px;">
                <button type="button" tabindex="-1" class="dk-btn" onclick="DukanERP.dbSetToday()">Today [T]</button>
                <button type="button" tabindex="-1" class="dk-tab ${dbAllDates ? 'active' : ''}" onclick="DukanERP.dbToggleAllDates()">${dbAllDates ? '✓ All Dates [F3]' : 'All Dates [F3]'}</button>
                <input id="dk-db-q" value="${D.esc(dbSearch)}" placeholder="🔍 Search Party, No., Marka, Design... (↑↓ Select · Enter Open)" autocomplete="off" style="flex:1; min-width:210px; padding:6px 10px; border:1px solid #d9b86c; border-radius:5px; font-size:12.5px; font-weight:600; outline:none;">
            </div>

            <table class="dk-tbl">
                <thead id="dk-db-th"></thead>
                <tbody id="dk-db-tb"></tbody>
            </table>
            <div id="dk-db-pg"></div>
        `;

        D.renderShell(headL, left, '[↑↓] Row · [Enter] Open · [Tab/F4] Tab · [F2] Date · [F3] All Dates · [Alt+P] DayBook Print · [Alt+V] Voucher Print · [Esc] Menu');

        const drawRows = () => {
            const flt = getFilteredRows(ds);
            const pg = D.paginate(flt, dbPage);
            if (dbNavIdx >= pg.rows.length) dbNavIdx = Math.max(0, pg.rows.length - 1);

            const th = document.getElementById('dk-db-th');
            const tb = document.getElementById('dk-db-tb');
            if (th) {
                th.innerHTML = dbTab === 'parties'
                    ? `<tr><th>Party Name</th><th>Orders</th><th>Challans</th><th>Total Amt</th></tr>`
                    : `<tr><th>Date / Type</th><th>No.</th><th>Party / Marka</th><th>Items Detail</th><th>Pcs</th></tr>`;
            }

            if (tb) {
                if (!pg.rows.length) {
                    tb.innerHTML = `<tr><td colspan="${dbTab === 'parties' ? 4 : 5}" style="text-align:center;color:#9ca3af;padding:16px;">Is tarikh/filter me koi entry nahi mili.</td></tr>`;
                } else if (dbTab === 'parties') {
                    tb.innerHTML = pg.rows.map((p, i) => `
                        <tr class="dk-nav-row ${i === dbNavIdx ? 'active' : ''}" onclick="DukanERP.dbOpenRowIdx(${i})">
                            <td><strong>${D.esc(p.partyName)}</strong></td>
                            <td>${p.ordCount} Ord · <b>${p.ordPcs} Pc</b></td>
                            <td>${p.chCount} Ch · <b>${p.chPcs} Pc</b></td>
                            <td><strong>₹ ${p.totAmt.toLocaleString('en-IN')}</strong></td>
                        </tr>`).join('');
                } else {
                    tb.innerHTML = pg.rows.map((u, i) => {
                        const typeBadge = u.kind === 'order'
                            ? `<span style="background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">ORDER</span>`
                            : `<span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">CHALLAN</span>`;
                        return `
                        <tr class="dk-nav-row ${i === dbNavIdx ? 'active' : ''}" onclick="DukanERP.dbOpenRowIdx(${i})">
                            <td>${D.fmtDate(u.date)}<br>${typeBadge}</td>
                            <td><strong>#${D.esc(u.no)}</strong><br><small>${D.esc(u.status)}</small></td>
                            <td><strong>${D.esc(u.partyName)}</strong><br><small>Marka: ${D.esc(u.marka)}</small></td>
                            <td><small>${D.esc(u.itemsTxt || '-')}</small></td>
                            <td><strong>${u.pcs} Pc</strong>${u.amt ? `<br><small>₹${u.amt.toLocaleString('en-IN')}</small>` : ''}</td>
                        </tr>`;
                    }).join('');
                }
            }

            const pgBox = document.getElementById('dk-db-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkDbPage');
            showSidePreview(pg.rows[dbNavIdx], ds);
        };

        drawRows();

        D.dbOpenRowIdx = (idx) => {
            const row = D.paginate(getFilteredRows(ds), dbPage).rows[idx];
            if (row) D.dbOpenRow(row);
        };

        const qEl = document.getElementById('dk-db-q');
        if (qEl) {
            qEl.addEventListener('input', () => {
                dbSearch = qEl.value;
                dbPage = 1;
                dbNavIdx = 0;
                drawRows();
            });
            qEl.focus();
        }

        D.onCustomFieldEnter = (id) => {
            if (id === 'dk-db-date') {
                D.dbSetDate(document.getElementById('dk-db-date')?.value);
                return true;
            }
            return false;
        };

        D.bindFormControls({
            focusOrder: ['dk-db-date'],
            listNav: {
                selector: '#dk-db-tb .dk-nav-row',
                searchId: 'dk-db-q',
                getIdx: () => dbNavIdx,
                setIdx: (i) => { dbNavIdx = i; },
                onHighlight: (i) => showSidePreview(D.paginate(getFilteredRows(ds), dbPage).rows[i], ds),
                onEnter: (i) => D.dbOpenRowIdx(i)
            }
        });
    }

    function render() {
        const ds = buildDayBookDataset();
        if (dbMode === 'menu') renderMenuScreen(ds);
        else renderReportScreen(ds);
    }

    /* ========================================================================
       A5 THERMAL / SUMMARY PRINT (DAYBOOK + SELECTED VOUCHER)
    ======================================================================== */
    D.printDayBook = () => {
        const ds = buildDayBookDataset();
        const rows = getFilteredRows(ds);
        if (!rows.length) return D.toast('⚠️ Print karne ke liye koi record nahi hai!');

        const dateTxt = dbAllDates ? 'All Dates' : D.fmtDate(dbDate);
        const titleMap = { all: 'ALL VOUCHERS', orders: 'DAILY ORDERS', challans: 'DAILY CHALLANS', parties: 'PARTY-WISE SUMMARY' };
        let bodyRows = '';
        let th = '';
        let totPcs = 0, totAmt = 0;

        if (dbTab === 'parties') {
            th = `<tr><th>#</th><th>PARTY</th><th>ORDERS</th><th>CHALLANS</th><th style="text-align:right;">AMT</th></tr>`;
            bodyRows = rows.map((p, i) => {
                totPcs += p.ordPcs + p.chPcs;
                totAmt += p.totAmt;
                return `<tr><td>${i + 1}</td><td><b>${D.esc(p.partyName)}</b></td><td>${p.ordCount} (${p.ordPcs} Pc)</td><td>${p.chCount} (${p.chPcs} Pc)</td><td style="text-align:right;">₹${p.totAmt.toLocaleString('en-IN')}</td></tr>`;
            }).join('');
        } else {
            th = `<tr><th>#</th><th>TYPE / NO.</th><th>PARTY</th><th>ITEMS</th><th style="text-align:right;">PCS</th></tr>`;
            bodyRows = rows.map((u, i) => {
                totPcs += u.pcs;
                totAmt += u.amt;
                return `<tr><td>${i + 1}</td><td><b>${u.kind === 'order' ? 'ORD' : 'CH'} #${D.esc(u.no)}</b><br><small>${D.fmtDate(u.date)}</small></td><td><b>${D.esc(u.partyName)}</b><br><small>${D.esc(u.marka)}</small></td><td>${D.esc(u.itemsTxt)}</td><td style="text-align:right;"><b>${u.pcs}</b></td></tr>`;
            }).join('');
        }

        const w = window.open('', '_blank', 'width=720,height=650');
        if (!w) return D.toast('⚠️ Popup blocked hai!');
        w.document.write(`<html><head><title>Dukan Day-Book</title><style>
            @page{size:A5 portrait;margin:6mm}
            body{font-family:Inter,sans-serif;margin:0;color:#111;font-size:11px}
            .box{border:2px solid #111;padding:10px}
            .hd{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #333;padding:4px 5px;font-size:10px;text-align:left;vertical-align:top}
            th{background:#f3f4f6}
        </style></head><body>
            <div class="box">
                <div class="hd">
                    <div><strong style="font-size:14px;">DUKAN MANAGEMENT DAY-BOOK</strong><div>${titleMap[dbTab] || 'DAY-BOOK'}</div></div>
                    <div style="text-align:right;"><div><b>Date:</b> ${D.esc(dateTxt)}</div><div><b>Entries:</b> ${rows.length}</div></div>
                </div>
                <table><thead>${th}</thead><tbody>${bodyRows}</tbody>
                <tfoot><tr><th colspan="4">TOTAL (${rows.length} Entries)${totAmt ? ` · ₹ ${totAmt.toLocaleString('en-IN')}` : ''}</th><th style="text-align:right;">${totPcs} Pc</th></tr></tfoot></table>
            </div>
            <script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),600);};<\/script>
        </body></html>`);
        w.document.close();
    };

    D.printSelectedDayBookVoucher = () => {
        const ds = buildDayBookDataset();
        const pg = D.paginate(getFilteredRows(ds), dbPage);
        const row = pg.rows[dbNavIdx];
        if (!row) return;
        if (row.kind === 'order' && typeof D.printSavedOrder === 'function') D.printSavedOrder(row.id);
        else if (row.kind === 'challan' && typeof D.printSavedChallan === 'function') D.printSavedChallan(row.id);
    };

    /* ========================================================================
       100% ZERO-MOUSE KEYBOARD SHORTCUT LAYER FOR DAYBOOK
    ======================================================================== */
    if (!window._dbKeyBound) {
        window._dbKeyBound = true;
        window.addEventListener('keydown', (e) => {
            if (!e || !e.key) return;
            const sec = document.getElementById('dukan-section');
            if (!sec || sec.style.display === 'none' || D.screen !== 'daybook') return;

            const activeId = document.activeElement?.id || '';
            const inDateBox = (activeId === 'dk-db-date' || activeId === 'dk-db-menu-date');

            // F2 or Alt+D -> Date Box focus
            if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'd')) {
                e.preventDefault(); e.stopImmediatePropagation();
                D.focusField(dbMode === 'menu' ? 'dk-db-menu-date' : 'dk-db-date');
                return;
            }

            // F3 -> Toggle Selected Date <-> All Dates
            if (e.key === 'F3') {
                e.preventDefault(); e.stopImmediatePropagation();
                D.dbToggleAllDates();
                return;
            }

            // F4 or Tab (Report mode) -> Cycle tabs
            if (e.key === 'F4' || (dbMode === 'report' && e.key === 'Tab')) {
                e.preventDefault(); e.stopImmediatePropagation();
                if (dbMode === 'menu') D.dbToggleAllDates();
                else D.dbCycleTab();
                return;
            }

            // Alt+P -> Print DayBook Summary
            if (e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (dbMode === 'report') D.printDayBook();
                return;
            }

            // Alt+V -> Print Highlighted Order/Challan
            if (e.altKey && e.key.toLowerCase() === 'v') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (dbMode === 'report') D.printSelectedDayBookVoucher();
                return;
            }

            // PageDown / PageUp -> Pagination without mouse
            if (dbMode === 'report' && (e.key === 'PageDown' || e.key === 'PageUp')) {
                e.preventDefault(); e.stopImmediatePropagation();
                const ds = buildDayBookDataset();
                const pg = D.paginate(getFilteredRows(ds), dbPage);
                const nxt = e.key === 'PageDown' ? Math.min(pg.pages, pg.page + 1) : Math.max(1, pg.page - 1);
                if (nxt !== pg.page) window.dkDbPage(nxt);
                return;
            }

            // Menu Mode single-letter Tally shortcuts (A, O, H, P, T)
            if (dbMode === 'menu' && !inDateBox && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                if (k === 't') { e.preventDefault(); e.stopImmediatePropagation(); D.dbSetToday(); return; }
                const map = { a: ['all', 0], o: ['orders', 1], h: ['challans', 2], p: ['parties', 3] };
                if (map[k]) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    D.dbOpenTab(map[k][0], map[k][1]);
                }
            }
        }, true);
    }

    // Cloud Sync auto-refresh agar DayBook khula ho
    if (!window._dbRefreshBound) {
        window._dbRefreshBound = true;
        const origRefresh = window.triggerActiveSectionRefresh;
        window.triggerActiveSectionRefresh = () => {
            if (typeof origRefresh === 'function') origRefresh();
            const sec = document.getElementById('dukan-section');
            if (sec && sec.style.display !== 'none' && D.screen === 'daybook') {
                render();
            }
        };
    }
})();
