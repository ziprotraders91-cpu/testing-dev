/* ============================================================================
   PARTY REGISTER: Party List -> Pending [n] / Complete [n] -> List of Orders
   File: dukan-erp/dukan-party-reg.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let step = 'parties'; // 'parties' | 'summary' | 'orders'
    let selPartyId = '';
    let orderStatusView = 'Pending'; // 'Pending' | 'Complete'
    let searchQ = '';
    let page = 1;

    D.openPartyRegister = () => {
        D.screen = 'party-reg';
        step = 'parties'; page = 1; searchQ = '';
        D.onEsc = () => {
            if (step === 'orders') { step = 'summary'; render(); }
            else if (step === 'summary') { step = 'parties'; render(); }
            else window.openDukanGateway();
        };
        render();
    };

    window.dkPrPage = (p) => { page = p; render(); };

    function render() {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const challans = D.get('dukan_challans');

        if (step === 'parties') {
            const filtered = parties.filter((p) =>
                !searchQ || `${p.name} ${p.city} ${p.agent} ${p.marka} ${p.mob}`.toLowerCase().includes(searchQ.toLowerCase())
            );
            const pg = D.paginate(filtered, page);

            const left = `
                <div class="dk-row"><label>🔍 Search Party :</label><input id="pr-q" value="${D.esc(searchQ)}" placeholder="Party, City, Agent, Marka..." oninput="DukanERP.prSearch(this.value)"></div>
                <table class="dk-tbl">
                    <thead><tr><th>Party Name</th><th>City</th><th>Agent</th><th>Pending</th><th>Complete</th></tr></thead>
                    <tbody>${pg.rows.length ? pg.rows.map((p) => {
                        const pO = orders.filter((o) => o.partyId === p.id);
                        const pend = pO.filter((o) => o.status !== 'Complete').length;
                        const comp = pO.filter((o) => o.status === 'Complete').length;
                        return `<tr class="click-row" onclick="DukanERP.prOpenParty('${p.id}')">
                            <td><strong>${D.esc(p.name)}</strong><br><small style="color:#6b7280;">${D.esc(p.mob)}</small></td>
                            <td>${D.esc(p.city || '-')}</td><td>${D.esc(p.agent || '-')}</td>
                            <td><strong style="color:#b45309;">${pend}</strong></td>
                            <td><strong style="color:#15803d;">${comp}</strong></td>
                        </tr>`;
                    }).join('') : `<tr><td colspan="5" style="text-align:center; color:#9ca3af;">Koi party nahi (Create me add karein)</td></tr>`}</tbody>
                </table>
                ${D.pagerHTML(pg, 'dkPrPage')}
            `;
            D.renderShell(`<h2>Party Register → Party List</h2>`, left, 'Party par click karein');
            D.setSide('List of Parties', `${filtered.length} Parties`, pg.rows.map((p) => ({
                label: p.name, meta: p.city || p.agent || '', id: p.id
            })), (it) => D.prOpenParty(it.id));
            return;
        }

        const p = parties.find((x) => x.id === selPartyId) || {};
        const pOrders = orders.filter((o) => o.partyId === selPartyId);
        const pendList = pOrders.filter((o) => o.status !== 'Complete');
        const compList = pOrders.filter((o) => o.status === 'Complete');

        if (step === 'summary') {
            const left = `
                <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:12px; margin-bottom:12px;">
                    <strong style="font-size:15px;">M/s. ${D.esc(p.name)}</strong>
                    <div style="font-size:12px; color:#6b7280; margin-top:3px;">${D.esc(p.address)} · ${D.esc(p.city)} · Mob: ${D.esc(p.mob)} · Agent: <strong>${D.esc(p.agent || '-')}</strong></div>
                </div>
                <div class="dk-sec">Select Order Register (${D.esc(p.name)})</div>
                <table class="dk-tbl">
                    <tbody>
                        <tr class="click-row" onclick="DukanERP.prOpenStatus('Pending')">
                            <td><strong>1. Pending orders [${pendList.length}]</strong></td>
                            <td style="text-align:right;">List of Pending orders →</td>
                        </tr>
                        <tr class="click-row" onclick="DukanERP.prOpenStatus('Complete')">
                            <td><strong>2. Complete orders [${compList.length}]</strong></td>
                            <td style="text-align:right;">List of Complete orders →</td>
                        </tr>
                    </tbody>
                </table>
            `;
            D.renderShell(`<h2>Party Register → ${D.esc(p.name)}</h2><button type="button" class="dk-btn" onclick="DukanERP.openPartyRegister()">← Party List</button>`, left);
            D.setSide(p.name, 'Summary', [
                { label: `Pending orders [${pendList.length}]`, meta: 'Open List', active: true, st: 'Pending' },
                { label: `Complete orders [${compList.length}]`, meta: 'Open List', st: 'Complete' }
            ], (it) => D.prOpenStatus(it.st));
            return;
        }

        const targetOrders = orderStatusView === 'Pending' ? pendList : compList;
        const pg = D.paginate(targetOrders, page);
        const pChallans = challans.filter((c) => c.partyId === selPartyId);

        const left = `
            <table class="dk-tbl">
                <thead><tr><th>Order #</th><th>Date</th><th>Items (Particulars &amp; Qnty)</th><th>Marka</th><th>Action</th></tr></thead>
                <tbody>${pg.rows.length ? pg.rows.map((o) => `
                    <tr>
                        <td><strong>#${D.esc(o.no)}</strong></td><td>${D.esc(o.date)}</td>
                        <td>${(o.items || []).map((i) => `${D.esc(i.name)} (${i.qty})`).join(', ')}</td>
                        <td>${D.esc(o.marka || '-')}</td>
                        <td>${orderStatusView === 'Pending'
                            ? `<button type="button" class="dk-btn-gold" style="padding:4px 8px; font-size:11px;" onclick="DukanERP.loadOrderInChallan('${p.id}','${o.id}')">Make Challan →</button>`
                            : `<small style="color:#15803d; font-weight:700;">Dispatched</small>`}
                        </td>
                    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; color:#9ca3af;">Koi ${orderStatusView} order nahi</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkPrPage')}
        `;
        D.renderShell(`<h2>${D.esc(p.name)} → List of ${orderStatusView} orders</h2><button type="button" class="dk-btn" onclick="DukanERP.prBackSummary()">← Back</button>`, left);
        D.setSide(`Challans (${pChallans.length})`, p.name, pChallans.map((c) => ({
            label: `Challan ${c.no}`, meta: `${c.date} · ${(c.items || []).reduce((a, b) => a + D.num(b.qty), 0)} Pc`
        })), () => {});
    }

    D.prSearch = (v) => { searchQ = v; page = 1; render(); };
    D.prOpenParty = (pid) => { selPartyId = pid; step = 'summary'; page = 1; render(); };
    D.prOpenStatus = (st) => { orderStatusView = st; step = 'orders'; page = 1; render(); };
    D.prBackSummary = () => { step = 'summary'; render(); };
})();
