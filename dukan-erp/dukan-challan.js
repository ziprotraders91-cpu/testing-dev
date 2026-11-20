/* ============================================================================
   CHALLAN & PACKING SLIP (Fresh Stock Auto-Minus + Privacy Parcel Print)
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let linkedOrderId = '';
    let chItems = [{ name: '', qty: '', rate: '' }];

    D.openChallan = () => {
        D.screen = 'challan';
        D.onEsc = null;
        const parties = D.get('dukan_parties');
        if (!selPartyId && parties[0]) selPartyId = parties[0].id;
        linkedOrderId = '';
        chItems = [{ name: '', qty: '', rate: '' }];
        render();
    };

    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onEsc = null;
        selPartyId = partyId;
        linkedOrderId = orderId;
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        chItems = ord ? ord.items.map((i) => ({ name: i.name, qty: i.qty, rate: i.rate })) : [{ name: '', qty: '', rate: '' }];
        render();
    };

    function render() {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const challans = D.get('dukan_challans');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const pPending = orders.filter((o) => o.partyId === selPartyId && o.status !== 'Complete');

        const left = `
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(p.name || '')}" readonly></div>
            <div class="dk-row"><label>Address / City :</label><input id="ch-addr" value="${D.esc([p.address, p.city].filter(Boolean).join(', '))}"></div>
            <div class="dk-row"><label>Mobile / GST :</label><div style="display:flex;gap:8px;"><input id="ch-mob" value="${D.esc(p.mob || '')}"><input id="ch-gst" value="${D.esc(p.gst || '')}"></div></div>
            <div class="dk-row"><label>Challan # / Marka :</label><div style="display:flex;gap:8px;"><input id="ch-no" value="CH-${101 + challans.length}"><input id="ch-marka" value="${D.esc(p.marka || '')}"></div></div>
            <div class="dk-row"><label>Bale No. (Slip) :</label><input id="ch-bale" value="BALE-${String(challans.length + 1).padStart(2, '0')}"></div>

            <div class="dk-sec">Challan Items (Save par Fresh Saree Stock Auto-Minus hoga)</div>
            <table class="dk-tbl">
                <thead><tr><th>Design</th><th>Fresh Avail</th><th>Challan Qty</th><th>Rate</th></tr></thead>
                <tbody>${chItems.map((it, i) => {
                    const ds = designs.find((d) => String(d.design || '').toUpperCase() === String(it.name || '').toUpperCase());
                    return `<tr>
                        <td><input value="${D.esc(it.name)}" onchange="DukanERP.chUpd(${i},'name',this.value)" style="width:100%;padding:4px;border:1px solid #d1d5db;"></td>
                        <td style="color:#15803d;font-weight:700;">${ds ? D.num(ds.freshQty) : 0} Pc</td>
                        <td><input type="number" value="${it.qty}" onchange="DukanERP.chUpd(${i},'qty',this.value)" style="width:70px;padding:4px;border:1px solid #d1d5db;"></td>
                        <td><input type="number" value="${it.rate}" onchange="DukanERP.chUpd(${i},'rate',this.value)" style="width:70px;padding:4px;border:1px solid #d1d5db;"></td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
            <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:8px;">
                <button type="button" class="dk-btn" onclick="DukanERP.chAddRow()">+ Add Row</button>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.saveChallan()">💾 Save &amp; Minus Stock</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallan()">🖨️ Print Challan</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printPackingSlip()">📦 Privacy Packing Slip</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Challan &amp; Packing Slip</h2>`, left, 'Privacy Slip par Party Name / Mobile print nahi hoga');

        // Bagal me: Pehle Party switch, phir us Party ke Pending Orders load karne ka option
        const sideArr = [
            ...pPending.map((o) => ({
                label: `Load Order #${o.no}`,
                meta: (o.items || []).map((i) => `${i.name}:${i.qty}`).join(', '),
                active: o.id === linkedOrderId,
                ordId: o.id
            })),
            ...parties.slice(0, 40).map((x) => ({
                label: `Party: ${x.name}`, meta: x.city || '', pid: x.id
            }))
        ];
        D.setSide(`${p.name || 'Select Party'} — Orders`, `${pPending.length} Pending`, sideArr, (it) => {
            if (it.ordId) D.loadOrderInChallan(selPartyId, it.ordId);
            else if (it.pid) { selPartyId = it.pid; linkedOrderId = ''; chItems = [{ name: '', qty: '', rate: '' }]; render(); }
        }, 'ch-party');
    }

    D.chUpd = (i, k, v) => { chItems[i][k] = k === 'name' ? v.toUpperCase() : v; render(); };
    D.chAddRow = () => { chItems.push({ name: '', qty: '', rate: '' }); render(); };

    D.saveChallan = () => {
        if (!selPartyId) return alert('Party chunein!');
        const valid = chItems.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) return alert('Challan item bharein!');

        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const challans = D.get('dukan_challans');
        const rec = {
            id: `ch_${Date.now()}`,
            no: document.getElementById('ch-no').value,
            date: D.today(),
            partyId: selPartyId,
            partyName: p.name || '',
            city: p.city || '',
            address: document.getElementById('ch-addr').value,
            mob: document.getElementById('ch-mob').value,
            gst: document.getElementById('ch-gst').value,
            marka: document.getElementById('ch-marka').value,
            baleNo: document.getElementById('ch-bale').value,
            orderId: linkedOrderId,
            items: valid.map((r) => ({ name: r.name, qty: D.num(r.qty), rate: D.num(r.rate) }))
        };
        challans.push(rec);
        D.set('dukan_challans', challans);

        // Fresh Stock Auto-Minus
        rec.items.forEach((it) => D.adjustFreshStock(it.name, -D.num(it.qty)));

        // Mark linked order Complete
        if (linkedOrderId) {
            const ords = D.get('dukan_orders');
            const ord = ords.find((o) => o.id === linkedOrderId);
            if (ord) { ord.status = 'Complete'; D.set('dukan_orders', ords); }
        }
        alert(`✅ Challan ${rec.no} save hua aur Fresh Stock minus ho gaya!`);
        render();
    };

    D.printChallan = () => {
        const tot = chItems.reduce((a, b) => a + D.num(b.qty), 0);
        const w = window.open('', '_blank', 'width=800,height=650');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #333;padding:6px;font-size:12px}</style></head><body>
            <h3>SAREE DELIVERY CHALLAN (${D.esc(document.getElementById('ch-no').value)})</h3>
            <div><b>M/s.:</b> ${D.esc(document.getElementById('ch-party').value)} | <b>Mob:</b> ${D.esc(document.getElementById('ch-mob').value)} | <b>GST:</b> ${D.esc(document.getElementById('ch-gst').value)}</div>
            <div><b>Address:</b> ${D.esc(document.getElementById('ch-addr').value)} | <b>Marka:</b> ${D.esc(document.getElementById('ch-marka').value)}</div>
            <table><thead><tr><th>#</th><th>Design</th><th>Qty (Pcs)</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>${chItems.filter(i => i.name).map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td>${i.qty}</td><td>${i.rate}</td><td>${D.num(i.qty)*D.num(i.rate)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><th colspan="2">TOTAL</th><th>${tot} Pcs</th><th></th><th></th></tr></tfoot></table></body></html>`);
        w.document.close(); w.print();
    };

    // Competition-Safe Packing Slip (NO Party Name / Mobile!)
    D.printPackingSlip = () => {
        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const firm = (D.get('dukan_firms')[0] || {}).name || 'INDIAN FABRICS';
        const toCity = p.city || 'DESTINATION';
        const tot = chItems.reduce((a, b) => a + D.num(b.qty), 0);
        const w = window.open('', '_blank', 'width=650,height=550');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:20px}.box{border:2px solid #111;padding:14px;max-width:480px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #111;padding:6px;font-size:13px}</style></head><body>
            <div class="box">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;">
                    <div><small>PACKING SLIP</small><div style="font-size:20px;font-weight:800;">TO: ${D.esc(toCity)}</div></div>
                    <div style="text-align:right;"><b>${D.esc(document.getElementById('ch-bale').value)}</b><div>Marka: <b>${D.esc(document.getElementById('ch-marka').value)}</b></div></div>
                </div>
                <div style="margin:8px 0;font-size:12px;"><b>FROM:</b> ${D.esc(firm)}</div>
                <table><thead><tr><th>#</th><th>Item / Design</th><th>Pcs</th></tr></thead>
                <tbody>${chItems.filter(i => i.name).map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td><b>${i.qty}</b></td></tr>`).join('')}</tbody>
                <tfoot><tr><th colspan="2">TOTAL PCS</th><th>${tot} Pcs</th></tr></tfoot></table>
            </div></body></html>`);
        w.document.close(); w.print();
    };
})();
