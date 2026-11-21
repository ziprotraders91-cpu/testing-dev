/* ============================================================================
   CHALLAN & PACKING SLIP (Batch Entry + Fresh Stock Minus + Privacy Slip)
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let linkedOrderId = '';
    let chItems = [{ name: '', qty: '', rate: '' }];

    D.openChallan = () => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        selPartyId = ''; linkedOrderId = '';
        chItems = [{ name: '', qty: '', rate: '' }];
        render('ch-party');
    };

    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        selPartyId = partyId;
        linkedOrderId = orderId;
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        chItems = ord ? ord.items.map((i) => ({ name: i.name, qty: i.qty, rate: i.rate })) : [{ name: '', qty: '', rate: '' }];
        render('ch-no');
    };

    function bindChRow(i) {
        const designs = D.get('dukan_designs');
        const nm = document.getElementById(`ch-it-${i}-name`);
        const qt = document.getElementById(`ch-it-${i}-qty`);
        const rt = document.getElementById(`ch-it-${i}-rate`);
        if (nm) {
            nm.addEventListener('input', () => {
                chItems[i].name = nm.value.toUpperCase();
                const ds = designs.find((d) => d.design === chItems[i].name);
                const av = document.getElementById(`ch-av-${i}`);
                if (av) av.textContent = `${ds ? D.num(ds.freshQty) : 0} Pc`;
            });
        }
        if (qt) qt.addEventListener('input', () => { chItems[i].qty = qt.value; });
        if (rt) {
            rt.addEventListener('input', () => { chItems[i].rate = rt.value; });
            rt.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if (String(chItems[i].name || '').trim()) {
                        if (i === chItems.length - 1) appendChRow();
                        else D.focusField(`ch-it-${i + 1}-name`);
                    } else D.askChallanSave();
                }
            });
        }
    }

    function appendChRow() {
        const i = chItems.length;
        chItems.push({ name: '', qty: '', rate: '' });
        const tb = document.getElementById('ch-items-tb');
        if (!tb) return;
        tb.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${i + 1}</td>
                <td><input id="ch-it-${i}-name" placeholder="Design..." autocomplete="off"></td>
                <td id="ch-av-${i}" style="color:#15803d;font-weight:700;">0 Pc</td>
                <td><input id="ch-it-${i}-qty" type="number" placeholder="0"></td>
                <td><input id="ch-it-${i}-rate" type="number" placeholder="0"></td>
            </tr>
        `);
        bindChRow(i);
        rebuildChBindings();
        D.focusField(`ch-it-${i}-name`);
    }

    function rebuildChBindings() {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const p = parties.find((x) => x.id === selPartyId) || {};

        const focusOrder = ['ch-party', 'ch-ord', 'ch-addr', 'ch-mob', 'ch-gst', 'ch-no', 'ch-marka', 'ch-bale'];
        const sideBindings = {
            'ch-party': {
                title: `List of Parties (${parties.length})`,
                getItems: (q) => parties.filter((x) => !q || `${x.name} ${x.city} ${x.marka}`.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}` })),
                onPick: (it) => { selPartyId = it.id; linkedOrderId = ''; render('ch-ord'); }
            },
            'ch-ord': {
                title: `${p.name || 'Party'} — Pending Orders`,
                getItems: (q) => orders
                    .filter((o) => (!selPartyId || o.partyId === selPartyId) && o.status !== 'Complete' && (!q || String(o.no).includes(q)))
                    .map((o) => ({ id: o.id, pid: o.partyId, label: `Order #${o.no}`, meta: (o.items || []).map((i) => `${i.name}:${i.qty}`).join(', ') })),
                onPick: (it) => D.loadOrderInChallan(it.pid, it.id),
                onEmptyEnter: () => D.focusField('ch-addr')
            }
        };

        chItems.forEach((_, i) => {
            focusOrder.push(`ch-it-${i}-name`, `ch-it-${i}-qty`, `ch-it-${i}-rate`);
            sideBindings[`ch-it-${i}-name`] = {
                title: 'List of Designs (Fresh Stock)',
                getItems: (q) => designs.filter((d) => !q || d.design.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((d) => ({ label: d.design, meta: `${D.num(d.freshQty)} Pc` })),
                onPick: (it) => {
                    chItems[i].name = it.label;
                    document.getElementById(`ch-it-${i}-name`).value = it.label;
                    const ds = designs.find((d) => d.design === it.label);
                    const av = document.getElementById(`ch-av-${i}`);
                    if (av) av.textContent = `${ds ? D.num(ds.freshQty) : 0} Pc`;
                    D.focusField(`ch-it-${i}-qty`);
                },
                onEmptyEnter: () => D.askChallanSave()
            };
        });

        D.bindFormControls({
            focusOrder,
            sideBindings,
            defaultSide: () => D.renderSide('Challan Summary', `${chItems.filter(x => x.name).length} Items`, chItems.filter(x => x.name).map((x) => ({
                label: x.name, meta: `${x.qty || 0} Pc`
            })), false),
            onFinishForm: () => D.askChallanSave()
        });
    }

    function render(focusId = 'ch-party') {
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const challans = D.get('dukan_challans');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const ordObj = linkedOrderId ? orders.find((o) => o.id === linkedOrderId) : null;

        const left = `
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(p.name || '')}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Load Order # :</label><input id="ch-ord" value="${D.esc(ordObj ? `#${ordObj.no}` : '')}" placeholder="Pending Order chunein ya Enter dabaye" autocomplete="off"></div>
            <div class="dk-row"><label>Address / City :</label><input id="ch-addr" value="${D.esc([p.address, p.city].filter(Boolean).join(', '))}"></div>
            <div class="dk-row"><label>Mobile / GST :</label><div style="display:flex;gap:8px;"><input id="ch-mob" value="${D.esc(p.mob || '')}" placeholder="Mobile"><input id="ch-gst" value="${D.esc(p.gst || '')}" placeholder="GSTIN"></div></div>
            <div class="dk-row"><label>Challan # / Marka :</label><div style="display:flex;gap:8px;"><input id="ch-no" value="CH-${101 + challans.length}"><input id="ch-marka" value="${D.esc(p.marka || '')}" placeholder="Marka"></div></div>
            <div class="dk-row"><label>Bale No. (Slip) :</label><input id="ch-bale" value="BALE-${String(challans.length + 1).padStart(2, '0')}"></div>

            <div class="dk-sec">Batch Items (Rate par Enter = Nayi Line | Khali Design par Enter = Save)</div>
            <table class="dk-tbl">
                <thead><tr><th>#</th><th>Design</th><th>Fresh Avail</th><th>Challan Qty</th><th>Rate</th></tr></thead>
                <tbody id="ch-items-tb">${chItems.map((it, i) => {
                    const ds = designs.find((d) => String(d.design || '').toUpperCase() === String(it.name || '').toUpperCase());
                    return `<tr>
                        <td>${i + 1}</td>
                        <td><input id="ch-it-${i}-name" value="${D.esc(it.name)}" placeholder="Design..." autocomplete="off"></td>
                        <td id="ch-av-${i}" style="color:#15803d;font-weight:700;">${ds ? D.num(ds.freshQty) : 0} Pc</td>
                        <td><input id="ch-it-${i}-qty" type="number" value="${it.qty}" placeholder="0"></td>
                        <td><input id="ch-it-${i}-rate" type="number" value="${it.rate}" placeholder="0"></td>
                    </tr>`;
                }).join('')}</tbody>
            </table>

            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap;">
                <button type="button" class="dk-btn" onclick="DukanERP.printChallan()">🖨️ Print Challan</button>
                <button type="button" class="dk-btn" onclick="DukanERP.printPackingSlip()">📦 Privacy Packing Slip</button>
                <button type="button" class="dk-btn-gold" onclick="DukanERP.askChallanSave()">💾 Save [Ctrl+Enter]</button>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>Save Challan &amp; Minus Fresh Stock?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveChallan()">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('ch-bale');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Challan &amp; Packing Slip</h2>`, left);
        chItems.forEach((_, i) => bindChRow(i));
        rebuildChBindings();
        D.focusField(focusId);
    }

    D.askChallanSave = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ Pehle Party chunein!'); return D.focusField('ch-party'); }
        const valid = chItems.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) { D.toast('⚠️ Challan item aur Qty bharein!'); return D.focusField('ch-it-0-name'); }
        D.askAccept(() => D.saveChallan());
    };

    D.saveChallan = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim().toUpperCase();
        const valid = chItems.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!partyTxt || !valid.length) return;

        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const challans = D.get('dukan_challans');
        const rec = {
            id: `ch_${Date.now()}`,
            no: document.getElementById('ch-no').value,
            date: D.today(),
            partyId: selPartyId || partyTxt,
            partyName: partyTxt,
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

        rec.items.forEach((it) => D.adjustFreshStock(it.name, -D.num(it.qty)));

        if (linkedOrderId) {
            const ords = D.get('dukan_orders');
            const ord = ords.find((o) => o.id === linkedOrderId);
            if (ord) { ord.status = 'Complete'; D.set('dukan_orders', ords); }
        }
        D.toast(`✅ Challan ${rec.no} save hua aur Fresh Stock minus ho gaya!`);
        D.openChallan();
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
