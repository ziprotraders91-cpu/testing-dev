/* ============================================================================
   PARTY REGISTER:
   1. Sirf Party List -> 2. Pending / Completed Buttons (Count Side Me) -> 3. Order List
   File: dukan-erp/dukan-party-reg.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let step = 'parties'; // 'parties' | 'choice' | 'orders'
    let selPartyId = '';
    let orderStatusView = 'Pending';
    let searchQ = '';
    let page = 1;
    let navIdx = 0;

    D.openPartyRegister = () => {
        D.screen = 'party-reg';
        step = 'parties'; page = 1; searchQ = ''; navIdx = 0;
        D.onEsc = () => {
            if (step === 'orders') { step = 'choice'; navIdx = 0; render(); }
            else if (step === 'choice') { step = 'parties'; navIdx = 0; render(); }
            else window.openDukanGateway();
        };
        render();
    };

    window.dkPrPage = (p) => { page = p; navIdx = 0; render(); };

    function renderPartyTable(filtered, pg) {
        const tb = document.getElementById('pr-tbody');
        if (!tb) return;
        tb.innerHTML = pg.rows.length ? pg.rows.map((p, i) => `
            <tr class="dk-nav-row ${i === navIdx ? 'active' : ''}" onclick="DukanERP.prOpenParty('${p.id}')">
                <td><strong>${D.esc(p.name)}</strong></td>
                <td>${D.esc(p.city || '-')}</td>
                <td>${D.esc(p.agent || '-')}</td>
                <td><small>${D.esc(p.mob || '-')}</small></td>
            </tr>`).join('')
            : `<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Koi party nahi mili</td></tr>`;

        const pgBox = document.getElementById('pr-pager-box');
        if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkPrPage');
        showPartySidePreview(pg.rows[navIdx]);
    }

    function showPartySidePreview(p) {
        if (!p) return D.renderSide('Party Info', '0', [], false);
        const pOrders = D.get('dukan_orders').filter((o) => o.partyId === p.id);
        const pend = pOrders.filter((o) => o.status !== 'Complete').length;
        const comp = pOrders.filter((o) => o.status === 'Complete').length;
        D.renderSide(p.name, p.city || 'Party', [
            { label: `Pending Orders`, meta: String(pend), active: true },
            { label: `Completed Orders`, meta: String(comp) },
            { label: `Agent: ${p.agent || '-'}`, meta: p.marka || '' },
            { label: `Mobile: ${p.mob || '-'}`, meta: '' }
        ], false);
    }

    function render() {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');

        /* STEP 1: SIRF PARTY LIST */
        if (step === 'parties') {
            const filtered = parties.filter((p) =>
                !searchQ || `${p.name} ${p.city} ${p.agent} ${p.mob}`.toLowerCase().includes(searchQ.toLowerCase())
            );
            const pg = D.paginate(filtered, page);
            if (navIdx >= pg.rows.length) navIdx = 0;

            const left = `
                <div class="dk-row"><label>🔍 Search Party :</label><input id="pr-q" value="${D.esc(searchQ)}" placeholder="Party ka naam likhein..." autocomplete="off"></div>
                <table class="dk-tbl">
                    <thead><tr><th>Party Name</th><th>City</th><th>Agent</th><th>Mobile</th></tr></thead>
                    <tbody id="pr-tbody"></tbody>
                </table>
                <div id="pr-pager-box"></div>
            `;
            D.renderShell(`<h2>Party Register — Party List</h2>`, left, '[↑ ↓] Party Chunein · [Enter] Kholein · [Esc] Back');
            renderPartyTable(filtered, pg);

            const qInp = document.getElementById('pr-q');
            if (qInp) {
                qInp.addEventListener('input', () => {
                    searchQ = qInp.value; page = 1; navIdx = 0;
                    const flt = parties.filter((p) => !searchQ || `${p.name} ${p.city} ${p.agent} ${p.mob}`.toLowerCase().includes(searchQ.toLowerCase()));
                    const pg2 = D.paginate(flt, 1);
                    renderPartyTable(flt, pg2);
                });
                qInp.focus();
            }

            D.bindFormControls({
                listNav: {
                    selector: '#pr-tbody .dk-nav-row',
                    searchId: 'pr-q',
                    getIdx: () => navIdx,
                    setIdx: (i) => { navIdx = i; },
                    onHighlight: (i) => {
                        const flt = parties.filter((p) => !searchQ || `${p.name} ${p.city} ${p.agent} ${p.mob}`.toLowerCase().includes(searchQ.toLowerCase()));
                        const pgCur = D.paginate(flt, page);
                        showPartySidePreview(pgCur.rows[i]);
                    },
                    onEnter: (i) => {
                        const flt = parties.filter((p) => !searchQ || `${p.name} ${p.city} ${p.agent} ${p.mob}`.toLowerCase().includes(searchQ.toLowerCase()));
                        const pgCur = D.paginate(flt, page);
                        if (pgCur.rows[i]) D.prOpenParty(pgCur.rows[i].id);
                    }
                }
            });
            return;
        }

        const p = parties.find((x) => x.id === selPartyId) || {};
        const pOrders = orders.filter((o) => o.partyId === selPartyId);
        const pendList = pOrders.filter((o) => o.status !== 'Complete');
        const compList = pOrders.filter((o) => o.status === 'Complete');

        /* STEP 2: DO BUTTON (PENDING & COMPLETED) + SIDE ME CHHOTA COUNT */
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
            return;
        }

        /* STEP 3: LIST OF PENDING / COMPLETED ORDERS */
        const target = orderStatusView === 'Pending' ? pendList : compList;
        const pg = D.paginate(target, page);
        if (navIdx >= pg.rows.length) navIdx = 0;

        const left = `
            <table class="dk-tbl">
                <thead><tr><th>Order #</th><th>Date</th><th>Items (Particulars &amp; Qnty)</th><th>Marka</th><th>Action</th></tr></thead>
                <tbody id="pr-ord-tb">${pg.rows.length ? pg.rows.map((o, i) => `
                    <tr class="dk-nav-row ${i === navIdx ? 'active' : ''}" onclick="DukanERP.prSelectOrder(${i})">
                        <td><strong>#${D.esc(o.no)}</strong></td>
                        <td>${D.esc(o.date)}</td>
                        <td>${(o.items || []).map((x) => `${D.esc(x.name)} (${x.qty})`).join(', ')}</td>
                        <td>${D.esc(o.marka || '-')}</td>
                        <td>${orderStatusView === 'Pending'
                            ? `<button type="button" class="dk-btn-gold" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${p.id}','${o.id}')">Challan →</button>`
                            : '✅ Complete'}</td>
                    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi ${orderStatusView} order nahi</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkPrPage')}
        `;
        D.renderShell(`<h2>${D.esc(p.name)} → List of ${orderStatusView} Orders</h2><button type="button" class="dk-btn" onclick="DukanERP.prBackChoice()">← Back</button>`, left, '[↑ ↓] Order Chunein · [Enter] Challan me Load · [Esc] Back');

        const showOrdSide = (ord) => {
            if (!ord) return D.renderSide('Order Details', '-', [], false);
            D.renderSide(`Order #${ord.no}`, ord.date, (ord.items || []).map((x) => ({
                label: x.name, meta: `${x.qty} Pc · ₹${x.rate}`
            })), false);
        };
        showOrdSide(pg.rows[navIdx]);

        D.prSelectOrder = (i) => {
            navIdx = i;
            document.querySelectorAll('#pr-ord-tb .dk-nav-row').forEach((r, idx) => r.classList.toggle('active', idx === i));
            showOrdSide(pg.rows[i]);
        };

        D.bindFormControls({
            listNav: {
                selector: '#pr-ord-tb .dk-nav-row',
                getIdx: () => navIdx,
                setIdx: (i) => { navIdx = i; },
                onHighlight: (i) => showOrdSide(pg.rows[i]),
                onEnter: (i) => {
                    const o = pg.rows[i];
                    if (o && orderStatusView === 'Pending') D.loadOrderInChallan(p.id, o.id);
                }
            }
        });
    }

    D.prOpenParty = (pid) => { selPartyId = pid; step = 'choice'; navIdx = 0; render(); };
    D.prOpenStatus = (st) => { orderStatusView = st; step = 'orders'; page = 1; navIdx = 0; render(); };
    D.prBackChoice = () => { step = 'choice'; navIdx = 0; render(); };
})();
