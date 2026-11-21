/* ============================================================================
   PARTY REGISTER:
   1. Sari Party List -> 2. Pending / Completed Buttons -> 3. Order List + Universal Search
   File: dukan-erp/dukan-party-reg.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let step = 'parties'; // 'parties' | 'choice' | 'orders'
    let selPartyId = '';
    let orderStatusView = 'Pending';
    let searchQ = '';
    let ordSearchQ = '';
    let page = 1;
    let navIdx = 0;

    D.openPartyRegister = () => {
        D.screen = 'party-reg';
        D.onCustomFieldEnter = null;
        step = 'parties'; page = 1; searchQ = ''; ordSearchQ = ''; navIdx = 0;
        D.onEsc = () => {
            if (step === 'orders') { step = 'choice'; navIdx = 0; render(); }
            else if (step === 'choice') { step = 'parties'; navIdx = 0; render(); }
            else window.openDukanGateway();
        };
        render();
    };

    window.dkPrPage = (p) => { page = p; navIdx = 0; render(); };

    function renderPartyRows(pg) {
        const tb = document.getElementById('pr-tbody');
        if (!tb) return;
        tb.innerHTML = pg.rows.length ? pg.rows.map((p, i) => `
            <tr class="dk-nav-row ${i === navIdx ? 'active' : ''}" onclick="DukanERP.prOpenParty('${p.id}')">
                <td><strong>${D.esc(p.name)}</strong></td>
                <td>${D.esc(p.city || '-')}</td>
                <td>${D.esc(p.agent || '-')}</td>
                <td><small>${D.esc(p.mob || '-')}</small></td>
            </tr>`).join('')
            : `<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Koi party nahi (Create me add karein)</td></tr>`;

        const pgBox = document.getElementById('pr-pager-box');
        if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkPrPage');
        showPartySide(pg.rows[navIdx]);
    }

    function showPartySide(p) {
        if (!p) return D.renderSide('Party Info', '0', [], false);
        const pOrders = D.get('dukan_orders').filter((o) => o.partyId === p.id);
        D.renderSide(p.name, p.city || 'Party', [
            { label: 'Pending Orders', meta: String(pOrders.filter((o) => o.status !== 'Complete').length), active: true },
            { label: 'Completed Orders', meta: String(pOrders.filter((o) => o.status === 'Complete').length) },
            { label: `Agent: ${p.agent || '-'}`, meta: p.marka || '' },
            { label: `Mobile: ${p.mob || '-'}`, meta: '' }
        ], false);
    }

    function render() {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');

        if (step === 'parties') {
            const getFiltered = () => parties.filter((p) =>
                !searchQ || `${p.name} ${p.city} ${p.agent} ${p.mob} ${p.marka}`.toLowerCase().includes(searchQ.toLowerCase())
            );
            const pg = D.paginate(getFiltered(), page);
            if (navIdx >= pg.rows.length) navIdx = 0;

            const left = `
                <div class="dk-row"><label>🔍 Search Party :</label><input id="pr-q" value="${D.esc(searchQ)}" placeholder="Party ka naam, City, Agent likhein..." autocomplete="off"></div>
                <table class="dk-tbl">
                    <thead><tr><th>Party Name</th><th>City</th><th>Agent</th><th>Mobile</th></tr></thead>
                    <tbody id="pr-tbody"></tbody>
                </table>
                <div id="pr-pager-box"></div>
            `;
            D.renderShell(`<h2>Party Register — Sari Party List</h2>`, left, '[↑ ↓] Party Chunein · [Enter] Kholein · [Esc] Back');
            renderPartyRows(pg);

            const qInp = document.getElementById('pr-q');
            if (qInp) {
                qInp.addEventListener('input', () => {
                    searchQ = qInp.value; page = 1; navIdx = 0;
                    renderPartyRows(D.paginate(getFiltered(), 1));
                });
                qInp.focus();
            }

            D.bindFormControls({
                listNav: {
                    selector: '#pr-tbody .dk-nav-row',
                    searchId: 'pr-q',
                    getIdx: () => navIdx,
                    setIdx: (i) => { navIdx = i; },
                    onHighlight: (i) => showPartySide(D.paginate(getFiltered(), page).rows[i]),
                    onEnter: (i) => {
                        const row = D.paginate(getFiltered(), page).rows[i];
                        if (row) D.prOpenParty(row.id);
                    }
                }
            });
            return;
        }

        const p = parties.find((x) => x.id === selPartyId) || {};
        const pOrders = orders.filter((o) => o.partyId === selPartyId);
        const pendList = pOrders.filter((o) => o.status !== 'Complete');
        const compList = pOrders.filter((o) => o.status === 'Complete');

        if (step === 'choice') {
            const left = `
                <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:12px; margin-bottom:14px;">
                    <strong style="font-size:15px;">M/s. ${D.esc(p.name)}</strong>
                    <div style="font-size:12px; color:#6b7280; margin-top:2px;">${D.esc(p.city || '')} · Agent: <strong>${D.esc(p.agent || '-')}</strong> · Mob: ${D.esc(p.mob || '-')}</div>
                </div>
                <button type="button" class="dk-choice-btn ${navIdx === 0 ? 'active' : ''}" onclick="DukanERP.prOpenStatus('Pending')">
                    <span>Pending Orders</span>
                    <span class="dk-cnt-pill">${pendList.length}</span>
                </button>
                <button type="button" class="dk-choice-btn ${navIdx === 1 ? 'active' : ''}" onclick="DukanERP.prOpenStatus('Complete')">
                    <span>Completed Orders</span>
                    <span class="dk-cnt-pill">${compList.length}</span>
                </button>
            `;
            D.renderShell(`<h2>${D.esc(p.name)}</h2><button type="button" class="dk-btn" onclick="DukanERP.openPartyRegister()">← Party List</button>`, left, '[↑ ↓] Button Chunein · [Enter] List Kholein');
            D.renderSide(p.name, 'Orders Count', [
                { label: 'Pending Orders', meta: String(pendList.length), active: navIdx === 0 },
                { label: 'Completed Orders', meta: String(compList.length), active: navIdx === 1 }
            ], false);

            D.bindFormControls({
                listNav: {
                    selector: '#dk-left .dk-choice-btn',
                    getIdx: () => navIdx,
                    setIdx: (i) => { navIdx = i; },
                    onEnter: (i) => D.prOpenStatus(i === 0 ? 'Pending' : 'Complete')
                }
            });
            setTimeout(() => document.querySelectorAll('#dk-left .dk-choice-btn')[navIdx]?.focus(), 20);
            return;
        }

        /* STEP 3: ORDER LIST + UNIVERSAL SEARCH BAR (Marka, Date, Design, Challan #) */
        const baseList = orderStatusView === 'Pending' ? pendList : compList;
        const getFilteredOrders = () => {
            const q = ordSearchQ.trim().toLowerCase();
            return baseList.filter((o) => !q || D.getOrderProgress(o).searchText.includes(q));
        };

        const showOrdSide = (ord) => {
            if (!ord) return D.renderSide('Order & Marka Dispatch', '-', [], false);
            const prog = D.getOrderProgress(ord);
            const sideRows = [
                ...prog.items.map((x) => ({ label: x.name, meta: `Gaya ${x.sent}/${x.ordered} · Baki ${x.baki}` })),
                ...prog.challans.map((c) => ({
                    label: `📦 Ch #${c.no} (${D.fmtDate(c.date)})`,
                    meta: `Marka: ${c.marka || '-'} → ${(c.items || []).map((ci) => `${ci.name}:${ci.qty}`).join(', ')}`
                }))
            ];
            D.renderSide(`Order #${ord.no}`, `Marka: ${ord.marka || '-'}`, sideRows, false);
        };

        const drawOrderRows = () => {
            const flt = getFilteredOrders();
            const pg = D.paginate(flt, page);
            if (navIdx >= pg.rows.length) navIdx = 0;

            const tb = document.getElementById('pr-ord-tb');
            if (tb) {
                tb.innerHTML = pg.rows.length ? pg.rows.map((o, i) => {
                    const prog = D.getOrderProgress(o);
                    const detailHTML = prog.items.map((x) =>
                        `<div><strong>${D.esc(x.name)}</strong>: Ord <b>${x.ordered}</b> | <span style="color:#15803d;">Gaya ${x.sent}</span> | <span style="color:#b91c1c;">Baki ${x.baki}</span></div>`
                    ).join('');
                    const chHTML = prog.challans.map((c) =>
                        `<div style="font-size:11px;color:#4b5563;margin-top:2px;">📦 <b>Ch #${D.esc(c.no)}</b> (${D.fmtDate(c.date)}) · Marka: <b>${D.esc(c.marka || '-')}</b> → ${(c.items || []).map((ci) => `${D.esc(ci.name)}:${ci.qty}`).join(', ')}</div>`
                    ).join('');

                    return `
                    <tr class="dk-nav-row ${i === navIdx ? 'active' : ''}" onclick="DukanERP.prSelectOrder(${i})">
                        <td><strong>#${D.esc(o.no)}</strong><br><small>${D.fmtDate(o.date)}</small></td>
                        <td>${detailHTML}${chHTML}</td>
                        <td>${D.esc(o.marka || '-')}</td>
                        <td>${orderStatusView === 'Pending'
                            ? `<button type="button" class="dk-btn-gold" style="padding:4px 9px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${p.id}','${o.id}')">Challan →</button>`
                            : '✅ Complete'}</td>
                    </tr>`;
                }).join('') : `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Koi order nahi mila</td></tr>`;
            }
            const pgBox = document.getElementById('pr-ord-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkPrPage');
            showOrdSide(pg.rows[navIdx]);
        };

        const left = `
            <div class="dk-row"><label>🔍 Universal Search :</label><input id="pr-ord-q" value="${D.esc(ordSearchQ)}" placeholder="Marka, Design, Date (21-11-2026), Order # ya Challan #..." autocomplete="off"></div>
            <table class="dk-tbl">
                <thead><tr><th>Order # / Date</th><th>Item Hisab &amp; Dispatch (Marka · Date · Pcs)</th><th>Order Marka</th><th>Action</th></tr></thead>
                <tbody id="pr-ord-tb"></tbody>
            </table>
            <div id="pr-ord-pg"></div>
        `;
        D.renderShell(`<h2>${D.esc(p.name)} → List of ${orderStatusView} Orders</h2><button type="button" class="dk-btn" onclick="DukanERP.prBackChoice()">← Back</button>`, left, 'Marka / Date / Design search karein · [↑ ↓] + [Enter] Challan me Load');
        drawOrderRows();

        const oqEl = document.getElementById('pr-ord-q');
        if (oqEl) {
            oqEl.addEventListener('input', () => { ordSearchQ = oqEl.value; page = 1; navIdx = 0; drawOrderRows(); });
            oqEl.focus();
        }

        D.prSelectOrder = (i) => {
            navIdx = i;
            document.querySelectorAll('#pr-ord-tb .dk-nav-row').forEach((r, idx) => r.classList.toggle('active', idx === i));
            showOrdSide(D.paginate(getFilteredOrders(), page).rows[i]);
        };

        D.bindFormControls({
            listNav: {
                selector: '#pr-ord-tb .dk-nav-row',
                searchId: 'pr-ord-q',
                getIdx: () => navIdx,
                setIdx: (i) => { navIdx = i; },
                onHighlight: (i) => showOrdSide(D.paginate(getFilteredOrders(), page).rows[i]),
                onEnter: (i) => {
                    const o = D.paginate(getFilteredOrders(), page).rows[i];
                    if (o && orderStatusView === 'Pending') D.loadOrderInChallan(p.id, o.id);
                }
            }
        });
    }

    D.prOpenParty = (pid) => { selPartyId = pid; step = 'choice'; navIdx = 0; render(); };
    D.prOpenStatus = (st) => { orderStatusView = st; step = 'orders'; page = 1; ordSearchQ = ''; navIdx = 0; render(); };
    D.prBackChoice = () => { step = 'choice'; navIdx = 0; render(); };
})();
