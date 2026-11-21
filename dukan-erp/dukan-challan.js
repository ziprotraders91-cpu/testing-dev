/* ============================================================================
   CHALLAN & PACKING SLIP (Blank Firm Start + Rate->+Add Loop + Combo Print)
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selFirmId = '';
    let selPartyId = '';
    let linkedOrderId = '';
    let chBatch = [];

    D.openChallan = () => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        selFirmId = '';
        selPartyId = ''; linkedOrderId = '';
        chBatch = [];
        render('ch-firm');
    };

    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onEsc = null; D.onCustomFieldEnter = null;
        selPartyId = partyId;
        linkedOrderId = orderId;
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        selFirmId = ord?.firmId || '';

        if (ord) {
            const prog = D.getOrderProgress(ord);
            chBatch = prog.items.filter((x) => x.baki > 0).map((i) => ({ name: i.name, qty: i.baki, rate: i.rate }));
        } else chBatch = [];
        render(selFirmId ? 'ch-no' : 'ch-firm');
    };

    function renderChBatchTable() {
        const designs = D.get('dukan_designs');
        const tb = document.getElementById('ch-items-tb');
        const totEl = document.getElementById('ch-batch-tot');
        if (!tb) return;
        const totPcs = chBatch.reduce((a, b) => a + D.num(b.qty), 0);
        const totAmt = chBatch.reduce((a, b) => a + D.num(b.qty) * D.num(b.rate), 0);
        if (totEl) totEl.textContent = `Total: ${chBatch.length} Designs · ${totPcs} Pcs · ₹ ${totAmt.toLocaleString('en-IN')}`;

        tb.innerHTML = chBatch.length ? chBatch.map((it, i) => {
            const ds = designs.find((d) => String(d.design || '').toUpperCase() === String(it.name || '').toUpperCase());
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${D.esc(it.name)}</strong></td>
                <td style="color:#15803d;font-weight:700;">${ds ? D.num(ds.freshQty) : 0} Pc</td>
                <td><strong>${it.qty}</strong></td>
                <td>${it.rate}</td>
                <td>₹ ${(D.num(it.qty) * D.num(it.rate)).toLocaleString('en-IN')}</td>
                <td style="text-align:center;"><button type="button" class="dk-btn" style="padding:2px 6px;color:#dc2626;" onclick="DukanERP.chDelRow(${i})">✕</button></td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;">Item chunein → Qty → Rate → +Add (Enter) — Batch yahan judega</td></tr>`;
    }

    D.chAddBatchItem = () => {
        const nmEl = document.getElementById('ch-cur-name');
        const qtEl = document.getElementById('ch-cur-qty');
        const rtEl = document.getElementById('ch-cur-rate');
        const name = (nmEl?.value || '').trim().toUpperCase();
        const qty = D.num(qtEl?.value);
        if (!name) { D.toast('⚠️ Item / Design chunein!'); return D.focusField('ch-cur-name'); }
        if (qty <= 0) { D.toast('⚠️ Challan Qty (Pcs) bharein!'); return D.focusField('ch-cur-qty'); }

        chBatch.push({ name, qty, rate: D.num(rtEl?.value) });
        nmEl.value = '';
        qtEl.value = '';
        rtEl.value = '';
        const avEl = document.getElementById('ch-cur-av');
        if (avEl) avEl.textContent = '(Avail: -)';

        renderChBatchTable();
        D.toast(`✅ Added: ${name} (${qty} Pc) — Agla item chunein ya [Ctrl+Enter] se Save karein`);
        D.focusField('ch-cur-name');
    };

    D.chDelRow = (i) => {
        chBatch.splice(i, 1);
        renderChBatchTable();
        D.focusField('ch-cur-name');
    };

    function render(focusId = 'ch-firm') {
        const firms = D.get('dukan_firms');
        const fObj = selFirmId ? (firms.find((x) => x.id === selFirmId) || {}) : {};
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designs = D.get('dukan_designs');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const ordObj = linkedOrderId ? orders.find((o) => o.id === linkedOrderId) : null;
        const markaVal = ordObj ? (ordObj.marka || p.marka || '') : (p.marka || '');

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="ch-firm" value="${D.esc(fObj.name || '')}" placeholder="Side List se Apni Firm chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Firm Info :</label><input id="ch-firm-meta" value="${fObj.name ? D.esc(`${fObj.address || ''} · Mob: ${fObj.mob || '-'} · GST: ${fObj.gst || '-'}`) : ''}" placeholder="Firm select karne par khud bharega" readonly style="background:#f9fafb;"></div>
            <div class="dk-sec">Party &amp; Order Details</div>
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(p.name || '')}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Pending Order # :</label><input id="ch-ord" value="${D.esc(ordObj ? `#${ordObj.no}` : '')}" placeholder="Side List se Pending Order chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Address / City :</label><input id="ch-addr" value="${D.esc([p.address, p.city].filter(Boolean).join(', '))}"></div>
            <div class="dk-row"><label>Mobile / GST :</label><div style="display:flex;gap:8px;"><input id="ch-mob" value="${D.esc(p.mob || '')}" placeholder="Mobile"><input id="ch-gst" value="${D.esc(p.gst || '')}" placeholder="GSTIN"></div></div>
            <div class="dk-row"><label>Challan No (Manual) :</label><div style="display:flex;gap:8px;"><input id="ch-no" placeholder="Manual Challan No. (e.g. 105)" autocomplete="off"><input id="ch-marka" value="${D.esc(markaVal)}" placeholder="Marka (Order wala)"></div></div>

            <div class="dk-sec">Batch Entry (Rate → +Add (Enter) → wapas Item · [Ctrl+Enter] Save)</div>
            <div style="padding:8px;background:#fdf6e2;border:1.5px solid #e5d5a7;border-radius:6px;display:grid;grid-template-columns:1.8fr 0.8fr 0.8fr auto;gap:6px;align-items:end;margin-bottom:8px;">
                <div>
                    <label style="font-size:10.5px;font-weight:800;color:#92400e;">Item / Design <small id="ch-cur-av" style="color:#15803d;">(Avail: -)</small></label>
                    <input id="ch-cur-name" placeholder="Design..." style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;" autocomplete="off">
                </div>
                <div><label style="font-size:10.5px;font-weight:800;color:#92400e;">Challan Pcs</label><input id="ch-cur-qty" type="number" placeholder="0" style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;"></div>
                <div><label style="font-size:10.5px;font-weight:800;color:#92400e;">Rate (₹)</label><input id="ch-cur-rate" type="number" placeholder="0" style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;"></div>
                <button type="button" id="ch-add-btn" class="dk-btn-gold" style="padding:7px 12px;" onclick="DukanERP.chAddBatchItem()">+ Add</button>
            </div>

            <div style="max-height:220px;overflow-y:auto;">
                <table class="dk-tbl">
                    <thead><tr><th>#</th><th>Design</th><th>Fresh Avail</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Del</th></tr></thead>
                    <tbody id="ch-items-tb"></tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:8px;">
                <strong id="ch-batch-tot" style="color:#92400e;font-size:12.5px;">Total: 0 Designs · 0 Pcs</strong>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print Challan &amp; Packing Slip</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askChallanSave()">💾 Save [Ctrl+Enter]</button>
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>Save Challan &amp; Minus Fresh Stock?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveChallan()">Yes (Y)</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('ch-cur-name');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Challan &amp; Packing Slip (Batch Mode)</h2>`, left, 'Rate → +Add (Enter) → wapas Item · Poora batch hone par [Ctrl+Enter] se Save');
        renderChBatchTable();

        D.bindFormControls({
            focusOrder: ['ch-firm', 'ch-party', 'ch-ord', 'ch-addr', 'ch-mob', 'ch-gst', 'ch-no', 'ch-marka', 'ch-cur-name', 'ch-cur-qty', 'ch-cur-rate', 'ch-add-btn'],
            sideBindings: {
                'ch-firm': {
                    title: `List of Firms (${firms.length})`,
                    getItems: (q) => firms.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
                        .map((f) => ({ id: f.id, label: f.name, meta: f.city || f.gst || 'Firm', f })),
                    onPick: (it) => {
                        selFirmId = it.id;
                        document.getElementById('ch-firm').value = it.f?.name || '';
                        document.getElementById('ch-firm-meta').value = `${it.f?.address || ''} · Mob: ${it.f?.mob || '-'} · GST: ${it.f?.gst || '-'}`;
                        D.focusField(selPartyId ? 'ch-no' : 'ch-party');
                    }
                },
                'ch-party': {
                    title: `List of Parties (${parties.length})`,
                    getItems: (q) => parties.filter((x) => !q || `${x.name} ${x.city} ${x.marka}`.toLowerCase().includes(q.toLowerCase()))
                        .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}` })),
                    onPick: (it) => { selPartyId = it.id; linkedOrderId = ''; chBatch = []; render('ch-ord'); }
                },
                'ch-ord': {
                    title: `${p.name || 'Party'} — Pending Orders Only`,
                    noAutoHighlight: true,
                    getItems: (q) => orders
                        .filter((o) => (!selPartyId || o.partyId === selPartyId) && o.status !== 'Complete' && (!q || String(o.no).includes(q)))
                        .map((o) => {
                            const prog = D.getOrderProgress(o);
                            const bakiTxt = prog.items.filter((x) => x.baki > 0).map((x) => `${x.name}:${x.baki}`).join(', ');
                            return { id: o.id, pid: o.partyId, label: `Order #${o.no}`, meta: `Baki: ${bakiTxt || '0'}` };
                        }),
                    onPick: (it) => D.loadOrderInChallan(it.pid, it.id),
                    onEmptyEnter: () => D.focusField('ch-no')
                },
                'ch-cur-name': {
                    title: `List of Designs (${designs.length})`,
                    noAutoHighlight: true,
                    getItems: (q) => designs.filter((d) => !q || d.design.toLowerCase().includes(q.toLowerCase()))
                        .slice(0, 60).map((d) => ({ label: d.design, meta: `${D.num(d.freshQty)} Pc`, qty: D.num(d.freshQty) })),
                    onPick: (it) => {
                        document.getElementById('ch-cur-name').value = it.label;
                        const av = document.getElementById('ch-cur-av');
                        if (av) av.textContent = `(Avail: ${it.qty} Pc)`;
                        D.focusField('ch-cur-qty');
                    },
                    onEmptyEnter: () => D.askChallanSave()
                }
            },
            defaultSide: () => D.renderSide('Challan Batch', `${chBatch.length} Items`, chBatch.map((x) => ({
                label: x.name, meta: `${x.qty} Pc`
            })), false),
            onFinishForm: () => D.askChallanSave()
        });

        D.focusField(focusId);
    }

    D.askChallanSave = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ Pehle Party chunein!'); return D.focusField('ch-party'); }
        if (!chNo) { D.toast('⚠️ Manual Challan No. bharein!'); return D.focusField('ch-no'); }
        if (!chBatch.length) { D.toast('⚠️ Kam se kam 1 item Batch me +Add karein!'); return D.focusField('ch-cur-name'); }
        D.askAccept(() => D.saveChallan());
    };

    D.saveChallan = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim().toUpperCase();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        if (!partyTxt || !chNo || !chBatch.length) return;

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
            items: chBatch.map((r) => ({ ...r }))
        };
        challans.push(rec);
        D.set('dukan_challans', challans);

        rec.items.forEach((it) => D.adjustFreshStock(it.name, -D.num(it.qty)));

        if (linkedOrderId) {
            const ords = D.get('dukan_orders');
            const ord = ords.find((o) => o.id === linkedOrderId);
            if (ord) {
                const prog = D.getOrderProgress(ord);
                ord.status = prog.allDone ? 'Complete' : 'Pending';
                D.set('dukan_orders', ords);
            }
        }
        D.toast(`✅ Challan ${rec.no} (${chBatch.length} items) save hua aur Fresh Stock minus ho gaya!`);
        D.openChallan();
    };

    D.printChallanAndSlip = () => {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) => x.id === selFirmId) || firms[0] || {};
        const firmName = document.getElementById('ch-firm')?.value || fObj.name || 'FIRM';
        const p = D.get('dukan_parties').find((x) => x.id === selPartyId) || {};
        const toCity = p.city || 'DESTINATION';
        const chNo = document.getElementById('ch-no')?.value || '-';
        const marka = document.getElementById('ch-marka')?.value || '-';
        const tot = chBatch.reduce((a, b) => a + D.num(b.qty), 0);

        const w = window.open('', '_blank', 'width=850,height=700');
        w.document.write(`<html><head><style>
            body{font-family:Inter,sans-serif;padding:20px;color:#111}
            .box{border:2px solid #111;padding:14px;margin-bottom:20px}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #333;padding:6px;font-size:12px;text-align:left}
            th{background:#f3f4f6}
            .page-break{page-break-before:always}
        </style></head><body>
            <div class="box">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;">
                    <div><strong style="font-size:18px;">${D.esc(firmName)}</strong><div style="font-size:11px;">${D.esc(fObj.address || '')} · Mob: ${D.esc(fObj.mob || '-')} · GSTIN: ${D.esc(fObj.gst || '-')}</div></div>
                    <div style="text-align:right;"><strong>DELIVERY CHALLAN</strong><div style="font-size:12px;">Challan No: <b>${D.esc(chNo)}</b> · Date: ${D.esc(D.fmtDate(D.today()))}</div></div>
                </div>
                <div style="margin:8px 0;font-size:12px;">
                    <div><b>M/s.:</b> ${D.esc(document.getElementById('ch-party').value)} | <b>Mob:</b> ${D.esc(document.getElementById('ch-mob').value)} | <b>GST:</b> ${D.esc(document.getElementById('ch-gst').value)}</div>
                    <div><b>Address:</b> ${D.esc(document.getElementById('ch-addr').value)} | <b>Marka:</b> ${D.esc(marka)}</div>
                </div>
                <table><thead><tr><th>#</th><th>Design / Particulars</th><th>Qty (Pcs)</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>${chBatch.map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td>${i.qty}</td><td>${i.rate}</td><td>${D.num(i.qty)*D.num(i.rate)}</td></tr>`).join('')}</tbody>
                <tfoot><tr><th colspan="2">TOTAL (${chBatch.length} Items)</th><th>${tot} Pcs</th><th></th><th></th></tr></tfoot></table>
            </div>

            <div class="box page-break" style="max-width:520px;">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;">
                    <div><small>PACKING SLIP</small><div style="font-size:20px;font-weight:800;">TO: ${D.esc(toCity)}</div></div>
                    <div style="text-align:right;"><div>Challan: <b>${D.esc(chNo)}</b></div><div>Marka: <b>${D.esc(marka)}</b></div></div>
                </div>
                <div style="margin:8px 0;font-size:12px;"><b>FROM:</b> ${D.esc(firmName)} (${D.esc(fObj.address || '')})</div>
                <table><thead><tr><th>#</th><th>Item / Design</th><th>Pcs</th></tr></thead>
                <tbody>${chBatch.map((i, idx) => `<tr><td>${idx+1}</td><td><b>${D.esc(i.name)}</b></td><td><b>${i.qty}</b></td></tr>`).join('')}</tbody>
                <tfoot><tr><th colspan="2">TOTAL PCS</th><th>${tot} Pcs</th></tr></tfoot></table>
            </div>
        </body></html>`);
        w.document.close(); w.print();
    };
})();
