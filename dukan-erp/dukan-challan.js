/* ============================================================================
   CHALLAN & PACKING SLIP:
   - Firm Auto-Fill (Address, Mob, GSTIN)
   - Challan No. Manual | Marka Order Form wala | Bale No. Removed
   - Complete Orders Hide | Challan + Privacy Packing Slip Ek Saath Print
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selFirmId = '';
    let selPartyId = '';
    let linkedOrderId = '';
    let chItems = [{ name: '', qty: '', rate: '' }];

    D.openChallan = () => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        const firms = D.get('dukan_firms');
        selFirmId = firms.length ? firms[0].id : '';
        selPartyId = ''; linkedOrderId = '';
        chItems = [{ name: '', qty: '', rate: '' }];
        render('ch-firm');
    };

    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        selPartyId = partyId;
        linkedOrderId = orderId;
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        const firms = D.get('dukan_firms');
        if (ord?.firmId) selFirmId = ord.firmId;
        else if (!selFirmId && firms[0]) selFirmId = firms[0].id;

        if (ord) {
            const prog = D.getOrderProgress(ord);
            const bakiItems = prog.items.filter((x) => x.baki > 0);
            chItems = bakiItems.length
                ? bakiItems.map((i) => ({ name: i.name, qty: i.baki, rate: i.rate }))
                : [{ name: '', qty: '', rate: '' }];
        }
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
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const p = parties.find((x) => x.id === selPartyId) || {};

        const focusOrder = ['ch-firm', 'ch-party', 'ch-ord', 'ch-addr', 'ch-mob', 'ch-gst', 'ch-no', 'ch-marka'];
        const sideBindings = {
            'ch-firm': {
                title: `List of Firms (${firms.length})`,
                getItems: (q) => firms.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
                    .map((f) => ({ id: f.id, label: f.name, meta: f.city || f.gst || 'Firm', f, active: f.id === selFirmId })),
                onPick: (it) => {
                    selFirmId = it.id;
                    document.getElementById('ch-firm').value = it.f?.name || '';
                    document.getElementById('ch-firm-meta').value = `${it.f?.address || ''} · Mob: ${it.f?.mob || '-'} · GST: ${it.f?.gst || '-'}`;
                    D.focusField('ch-party');
                }
            },
            'ch-party': {
                title: `List of Parties (${parties.length})`,
                getItems: (q) => parties.filter((x) => !q || `${x.name} ${x.city} ${x.marka}`.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}` })),
                onPick: (it) => { selPartyId = it.id; linkedOrderId = ''; render('ch-ord'); }
            },
            'ch-ord': {
                title: `${p.name || 'Party'} — Pending Orders Only`,
                noAutoHighlight: true,
                getItems: (q) => orders
                    // Complete orders kabhi nahi dikhenge
                    .filter((o) => (!selPartyId || o.partyId === selPartyId) && o.status !== 'Complete' && (!q || String(o.no).includes(q)))
                    .map((o) => {
                        const prog = D.getOrderProgress(o);
                        const bakiTxt = prog.items.filter((x) => x.baki > 0).map((x) => `${x.name}:${x.baki}`).join(', ');
                        return { id: o.id, pid: o.partyId, label: `Order #${o.no}`, meta: `Baki: ${bakiTxt || '0'}` };
                    }),
                onPick: (it) => D.loadOrderInChallan(it.pid, it.id),
                onEmptyEnter: () => D.focusField('ch-no')
            }
        };

        chItems.forEach((_, i) => {
            focusOrder.push(`ch-it-${i}-name`, `ch-it-${i}-qty`, `ch-it-${i}-rate`);
            sideBindings[`ch-it-${i}-name`] = {
                title: 'List of Designs (↑ ↓ + Enter)',
                noAutoHighlight: true,
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

    function render(focusId = 'ch-firm') {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) => x.id === selFirmId) || firms[0] || {};
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const ordObj = linkedOrderId ? orders.find((o) => o.id === linkedOrderId) : null;
        const markaVal = ordObj ? (ordObj.marka || p.marka || '') : (p.marka || '');

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="ch-firm" value="${D.esc(fObj.name || '')}" placeholder="Side List se Firm chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Firm Info :</label><input id="ch-firm-meta" value="${D.esc(`${fObj.address || ''} · Mob: ${fObj.mob || '-'} · GST: ${fObj.gst || '-'}`)}" readonly style="background:#f9fafb;"></div>
            <div class="dk-sec">Party &amp; Order Details</div>
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(p.name || '')}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Pending Order # :</label><input id="ch-ord" value="${D.esc(ordObj ? `#${ordObj.no}` : '')}" placeholder="Side List se Pending Order chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Address / City :</label><input id="ch-addr" value="${D.esc([p.address, p.city].filter(Boolean).join(', '))}"></div>
            <div class="dk-row"><label>Mobile / GST :</label><div style="display:flex;gap:8px;"><input id="ch-mob" value="${D.esc(p.mob || '')}" placeholder="Mobile"><input id="ch-gst" value="${D.esc(p.gst || '')}" placeholder="GSTIN"></div></div>
            <div class="dk-row"><label>Challan No (Manual) :</label><div style="display:flex;gap:8px;"><input id="ch-no" placeholder="Manual Challan No. (e.g. 105)" autocomplete="off"><input id="ch-marka" value="${D.esc(markaVal)}" placeholder="Marka (Order wala)"></div></div>

            <div class="dk-sec">Batch Items (Save par Fresh Stock Minus hoga)</div>
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
                <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print Challan &amp; Packing Slip (Ek Saath)</button>
                <button type="button" class="dk-btn-gold" onclick="DukanERP.askChallanSave()">💾 Save [Ctrl+Enter]</button>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>Save Challan &amp; Minus Fresh Stock?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveChallan()">Yes (Y)</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('ch-no');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Challan &amp; Packing Slip</h2>`, left, 'Print par Challan + Privacy Packing Slip dono ek saath niklenge');
        chItems.forEach((_, i) => bindChRow(i));
        rebuildChBindings();
        D.focusField(focusId);
    }

    D.askChallanSave = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ Pehle Party chunein!'); return D.focusField('ch-party'); }
        if (!chNo) { D.toast('⚠️ Manual Challan No. bharein!'); return D.focusField('ch-no'); }
        const valid = chItems.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) { D.toast('⚠️ Challan item aur Qty bharein!'); return D.focusField('ch-it-0-name'); }
        D.askAccept(() => D.saveChallan());
    };

    D.saveChallan = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim().toUpperCase();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        const valid = chItems.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!partyTxt || !chNo || !valid.length) return;

        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const challans = D.get('dukan_challans');
        const rec = {
            id: `ch_${Date.now()}`,
            no: chNo,
            date: D.today(),
            firmId: selFirmId,
            firmName: (document.getElementById('ch-firm')?.value || '').trim().toUpperCase(),
            partyId: selPartyId || partyTxt,
            partyName: partyTxt,
            city: p.city || '',
            address: document.getElementById('ch-addr').value,
            mob: document.getElementById('ch-mob').value,
            gst: document.getElementById('ch-gst').value,
            marka: document.getElementById('ch-marka').value,
            orderId: linkedOrderId,
            items: valid.map((r) => ({ name: r.name, qty: D.num(r.qty), rate: D.num(r.rate) }))
        };
        challans.push(rec);
        D.set('dukan_challans', challans);

        rec.items.forEach((it) => D.adjustFreshStock(it.name, -D.num(it.qty)));

        // Sirf tabhi Complete mark hoga jab saare items ka Baki <= 0 ho jaye
        if (linkedOrderId) {
            const ords = D.get('dukan_orders');
            const ord = ords.find((o) => o.id === linkedOrderId);
            if (ord) {
                const prog = D.getOrderProgress(ord);
                ord.status = prog.allDone ? 'Complete' : 'Pending';
                D.set('dukan_orders', ords);
            }
        }
        D.toast(`✅ Challan ${rec.no} save hua aur Fresh Stock minus ho gaya!`);
        D.openChallan();
    };

    // CHALLAN AUR PRIVACY PACKING SLIP DONO EK SAATH PRINT
    D.printChallanAndSlip = () => {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) => x.id === selFirmId) || firms[0] || {};
        const firmName = document.getElementById('ch-firm')?.value || fObj.name || 'FIRM';
        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const toCity = p.city || 'DESTINATION';
        const chNo = document.getElementById('ch-no')?.value || '-';
        const marka = document.getElementById('ch-marka')?.value || '-';
        const valid = chItems.filter((i) => i.name);
        const tot = valid.reduce((a, b) => a + D.num(b.qty), 0);

        const w = window.open('', '_blank', 'width=850,height=700');
        w.document.write(`<html><head><style>
            body{font-family:Inter,sans-serif;padding:20px;color:#111}
            .box{border:2px solid #111;padding:14px;margin-bottom:20px}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #333;padding:6px;font-size:12px;text-align:left}
            th{background:#f3f4f6}
            .page-break{page-break-before:always}
        </style></head><body>
            <!-- PAGE 1: DELIVERY CHALLAN -->
            <div class="box">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;">
                    <div>
                        <strong style="font-size:18px;">${D.esc(firmName)}</strong>
                        <div style="font-size:11px;">${D.esc(fObj.address || '')} · Mob: ${D.esc(fObj.mob || '-')} · GSTIN: ${D.esc(fObj.gst || '-')}</div>
                    </div>
                    <div style="text-align:right;">
                        <strong>DELIVERY CHALLAN</strong>
                        <div style="font-size:12px;">Challan No: <b>${D.esc(chNo)}</b> · Date: ${D.esc(D.today())}</div>
                    </div>
                </div>
                <div style="margin:8px 0;font-size:12px;">
                    <div><b>M/s.:</b> ${D.esc(document.getElementById('ch-party').value)} | <b>Mob:</b> ${D.esc(document.getElementById('ch-mob').value)} | <b>GST:</b> ${D.esc(document.getElementById('ch-gst').value)}</div>
                    <div><b>Address:</b> ${D.esc(document.getElementById('ch-addr').value)} | <b>Marka:</b> ${D.esc(marka)}</div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Design / Particulars</th><th>Qty (Pcs)</th><th>Rate</th><th>Amount</th></tr></thead>
                    <tbody>${valid.map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td>${i.qty}</td><td>${i.rate}</td><td>${D.num(i.qty)*D.num(i.rate)}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="2">TOTAL PCS</th><th>${tot} Pcs</th><th></th><th></th></tr></tfoot>
                </table>
            </div>

            <!-- PAGE 2: COMPETITION-SAFE PACKING SLIP (NO PARTY NAME / MOBILE) -->
            <div class="box page-break" style="max-width:520px;">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;">
                    <div><small>PACKING SLIP</small><div style="font-size:20px;font-weight:800;">TO: ${D.esc(toCity)}</div></div>
                    <div style="text-align:right;"><div>Challan: <b>${D.esc(chNo)}</b></div><div>Marka: <b>${D.esc(marka)}</b></div></div>
                </div>
                <div style="margin:8px 0;font-size:12px;"><b>FROM:</b> ${D.esc(firmName)} (${D.esc(fObj.address || '')})</div>
                <table>
                    <thead><tr><th>#</th><th>Item / Design</th><th>Pcs</th></tr></thead>
                    <tbody>${valid.map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td><b>${i.qty}</b></td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="2">TOTAL PCS</th><th>${tot} Pcs</th></tr></tfoot>
                </table>
            </div>
        </body></html>`);
        w.document.close(); w.print();
    };
})();
