/* ============================================================================
   ORDER FORM (Tally Batch Entry — Zero "+ Add Row") + ALL PENDING/COMPLETE
   File: dukan-erp/dukan-order.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let selFirmName = 'INDIAN FABRICS';
    let rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];
    let repPage = 1, repStatus = 'Pending', repSearch = '', repNav = 0;

    D.openOrderForm = () => {
        D.screen = 'order';
        D.onEsc = null;
        const firms = D.get('dukan_firms');
        if (firms[0]) selFirmName = firms[0].name;
        selPartyId = '';
        rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];
        renderForm('of-firm');
    };

    function renderForm(focusId = 'of-firm') {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const designs = D.get('dukan_designs');
        const orders = D.get('dukan_orders');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const nextNo = String(197 + orders.length);

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="of-firm" value="${D.esc(selFirmName)}" placeholder="Firm Name..." autocomplete="off"></div>
            <div class="dk-row"><label>M/s. (Party) :</label><input id="of-party" value="${D.esc(p.name || '')}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Order No. &amp; Date :</label><div style="display:flex;gap:8px;"><input id="of-no" value="${nextNo}" style="width:100px;"><input id="of-date" type="date" value="${D.today()}"></div></div>
            <div class="dk-row"><label>TIN / GST No. :</label><input id="of-gst" value="${D.esc(p.gst || '')}" placeholder="GSTIN"></div>
            <div class="dk-row"><label>Marka / Through :</label><input id="of-marka" value="${D.esc(p.marka || '')}" placeholder="Marka"></div>
            <div class="dk-row"><label>Transport / Agent :</label><div style="display:flex;gap:8px;"><input id="of-tr" value="${D.esc(p.transport || '')}" placeholder="Transport"><input id="of-agent" value="${D.esc(p.agent || '')}" placeholder="Agent"></div></div>
            <div class="dk-row"><label>Packaging :</label><select id="of-pack"><option>Box</option><option>Paper</option><option>No Box</option></select></div>

            <div class="dk-sec">Batch Item Entry (Cancel Col. par Enter = Nayi Line | Khali Item par Enter = Finish)</div>
            <table class="dk-tbl">
                <thead><tr><th>#</th><th>Particulars (Design)</th><th>Qnty</th><th>Rate</th><th>Fold Size</th><th>Cancel Col.</th></tr></thead>
                <tbody>${rows.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><input id="of-it-${i}-name" value="${D.esc(r.name)}" oninput="DukanERP.ofUpd(${i},'name',this.value)" placeholder="Design..." autocomplete="off"></td>
                        <td><input id="of-it-${i}-qty" type="number" value="${r.qty}" oninput="DukanERP.ofUpd(${i},'qty',this.value)" placeholder="0"></td>
                        <td><input id="of-it-${i}-rate" type="number" value="${r.rate}" oninput="DukanERP.ofUpd(${i},'rate',this.value)" placeholder="0"></td>
                        <td><input id="of-it-${i}-fold" value="${D.esc(r.fold)}" oninput="DukanERP.ofUpd(${i},'fold',this.value)"></td>
                        <td><input id="of-it-${i}-cancel" value="${D.esc(r.cancel)}" oninput="DukanERP.ofUpd(${i},'cancel',this.value)"></td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="dk-row" style="margin-top:10px;"><label>Remarks :</label><input id="of-rem" placeholder="Special note... (Enter = Save)"></div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>Save Order &amp; Print?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveOrder()">Yes (Y)</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('of-rem');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Order Form (Batch Tally Mode)</h2>`, left, 'Batch Mode: Last box par Enter se nayi line aayegi · Khali Design par Enter se Remarks par jayega');

        const focusOrder = ['of-firm', 'of-party', 'of-no', 'of-date', 'of-gst', 'of-marka', 'of-tr', 'of-agent', 'of-pack'];
        const sideBindings = {
            'of-firm': {
                title: 'List of Firms',
                allowCustom: true,
                getItems: (q) => firms.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
                    .map((f) => ({ label: f.name, meta: f.city || 'Firm' })),
                onPick: (it) => { selFirmName = it.label; document.getElementById('of-firm').value = it.label; D.focusField('of-party'); }
            },
            'of-party': {
                title: 'List of Parties',
                allowCustom: false,
                getItems: (q) => parties.filter((x) => !q || `${x.name} ${x.city} ${x.marka}`.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}` })),
                onPick: (it) => {
                    selPartyId = it.id;
                    const pr = parties.find((x) => x.id === it.id) || {};
                    document.getElementById('of-party').value = pr.name || '';
                    document.getElementById('of-gst').value = pr.gst || '';
                    document.getElementById('of-marka').value = pr.marka || '';
                    document.getElementById('of-tr').value = pr.transport || '';
                    document.getElementById('of-agent').value = pr.agent || '';
                    D.focusField('of-no');
                }
            }
        };

        rows.forEach((_, i) => {
            focusOrder.push(`of-it-${i}-name`, `of-it-${i}-qty`, `of-it-${i}-rate`, `of-it-${i}-fold`, `of-it-${i}-cancel`);
            sideBindings[`of-it-${i}-name`] = {
                title: 'List of Designs (Fresh Stock)',
                allowCustom: true,
                getItems: (q) => designs.filter((d) => !q || d.design.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((d) => ({ label: d.design, meta: `${D.num(d.freshQty)} Pc · ${d.kariger || ''}` })),
                onPick: (it) => {
                    rows[i].name = it.label;
                    const inp = document.getElementById(`of-it-${i}-name`);
                    if (inp) inp.value = it.label;
                    D.focusField(`of-it-${i}-qty`);
                },
                onCustomEnter: (val) => {
                    if (!String(val || '').trim()) {
                        D.focusField('of-rem');
                        return true;
                    }
                    return false;
                }
            };
        });
        focusOrder.push('of-rem');

        // Auto-add next batch row when pressing Enter on last column of last row
        const lastCancelId = `of-it-${rows.length - 1}-cancel`;
        const lastCancelEl = document.getElementById(lastCancelId);
        if (lastCancelEl) {
            lastCancelEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if (String(rows[rows.length - 1].name || '').trim()) {
                        rows.push({ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' });
                        renderForm(`of-it-${rows.length - 1}-name`);
                    } else {
                        D.focusField('of-rem');
                    }
                }
            });
        }

        D.bindFormControls({
            focusOrder,
            sideBindings,
            defaultSide: () => D.renderSide('Order Summary', `${rows.filter(r => r.name).length} Items`, rows.filter(r => r.name).map((r) => ({
                label: r.name, meta: `${r.qty || 0} Pc`
            })), false),
            onFinishForm: () => D.askAccept(() => D.saveOrder())
        });

        D.focusField(focusId);
    }

    D.ofUpd = (i, k, v) => { rows[i][k] = k === 'name' ? v.toUpperCase() : v; };

    D.saveOrder = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim().toUpperCase();
        if (!selPartyId && !partyTxt) return alert('Pehle Party chunein!');
        const valid = rows.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) return alert('Kam se kam 1 item aur qty bharein!');

        const orders = D.get('dukan_orders');
        orders.push({
            id: `ord_${Date.now()}`,
            no: document.getElementById('of-no').value.trim(),
            date: document.getElementById('of-date').value,
            firmName: document.getElementById('of-firm').value.trim(),
            partyId: selPartyId || partyTxt,
            partyName: partyTxt,
            gst: document.getElementById('of-gst').value,
            marka: document.getElementById('of-marka').value,
            transport: document.getElementById('of-tr').value,
            agent: document.getElementById('of-agent').value,
            pack: document.getElementById('of-pack').value,
            remarks: document.getElementById('of-rem').value,
            status: 'Pending',
            items: valid.map((r) => ({ ...r, qty: D.num(r.qty), rate: D.num(r.rate) }))
        });
        D.set('dukan_orders', orders);
        D.openOrderForm();
    };

    D.printOrderBook = () => {
        const firm = document.getElementById('of-firm')?.value || 'INDIAN FABRICS';
        const fObj = D.get('dukan_firms').find((x) => x.name === firm) || {};
        const w = window.open('', '_blank', 'width=850,height=700');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #991b1b;padding:6px;font-size:12px;text-align:left}th{background:#fef2f2;color:#991b1b}</style></head><body>
            <div style="border:2px solid #991b1b;padding:14px;">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #991b1b;padding-bottom:8px;">
                    <div><strong style="font-size:18px;color:#991b1b;">${D.esc(firm)}</strong><div style="font-size:11px;">GSTIN: ${D.esc(fObj.gst || '-')} · ${D.esc(fObj.address || '')}</div></div>
                    <div style="text-align:right;"><strong style="color:#991b1b;">ORDER FORM</strong><div style="font-size:12px;">No: <b>${D.esc(document.getElementById('of-no')?.value)}</b> · Date: ${D.esc(document.getElementById('of-date')?.value)}</div></div>
                </div>
                <div style="font-size:12px;margin:8px 0;"><b>M/s.:</b> ${D.esc(document.getElementById('of-party')?.value)} | <b>Marka:</b> ${D.esc(document.getElementById('of-marka')?.value)} | <b>Transport:</b> ${D.esc(document.getElementById('of-tr')?.value)} | <b>Agent:</b> ${D.esc(document.getElementById('of-agent')?.value)} | <b>Pack:</b> ${D.esc(document.getElementById('of-pack')?.value)}</div>
                <table><thead><tr><th>S.No</th><th>Particulars</th><th>Qnty</th><th>Rate</th><th>Fold Size</th><th>Cancelled Colour</th></tr></thead>
                <tbody>${rows.filter(r => r.name).map((r, i) => `<tr><td>${i+1}</td><td><b>${D.esc(r.name)}</b></td><td>${r.qty}</td><td>${r.rate}</td><td>${D.esc(r.fold)}</td><td>${D.esc(r.cancel)}</td></tr>`).join('')}</tbody></table>
                <div style="margin-top:10px;font-size:11px;display:flex;justify-content:space-between;"><span>Remarks: ${D.esc(document.getElementById('of-rem')?.value || '-')}</span><b>For: ${D.esc(firm)}</b></div>
            </div></body></html>`);
        w.document.close(); w.print();
    };

    /* ALL PENDING / COMPLETE ORDERS REPORT */
    D.openAllOrders = (status) => {
        D.screen = status === 'Pending' ? 'pending' : 'complete';
        D.onEsc = null;
        repStatus = status; repPage = 1; repSearch = ''; repNav = 0;
        renderReport();
    };

    window.dkRepPage = (p) => { repPage = p; repNav = 0; renderReport(); };

    function renderReport() {
        const list = D.get('dukan_orders').filter((o) =>
            (repStatus === 'Pending' ? o.status !== 'Complete' : o.status === 'Complete') &&
            (!repSearch || `${o.no} ${o.partyName} ${o.marka} ${(o.items || []).map(i => i.name).join(' ')}`.toLowerCase().includes(repSearch.toLowerCase()))
        );
        const pg = D.paginate(list, repPage);
        if (repNav >= pg.rows.length) repNav = 0;

        const left = `
            <div class="dk-row"><label>🔍 Search Order :</label><input id="rep-q" value="${D.esc(repSearch)}" placeholder="Order No, Party, Design..." autocomplete="off"></div>
            <table class="dk-tbl">
                <thead><tr><th>Order #</th><th>Date</th><th>Party</th><th>Items</th><th>Action</th></tr></thead>
                <tbody id="rep-tb">${pg.rows.length ? pg.rows.map((o, i) => `
                    <tr class="dk-nav-row ${i === repNav ? 'active' : ''}" onclick="DukanERP.repPick(${i})">
                        <td><strong>#${D.esc(o.no)}</strong></td><td>${D.esc(o.date)}</td><td>${D.esc(o.partyName)}</td>
                        <td>${(o.items || []).map((x) => `${D.esc(x.name)} (${x.qty})`).join(', ')}</td>
                        <td>${repStatus === 'Pending' ? `<button type="button" class="dk-btn-gold" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${o.partyId}','${o.id}')">Challan →</button>` : '✅ Complete'}</td>
                    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi ${repStatus} order nahi</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkRepPage')}
        `;
        D.renderShell(`<h2>${repStatus} Orders (All Parties)</h2>`, left, '[↑ ↓] Order Chunein · [Enter] Challan me Load');
        D.renderSide(`${repStatus} Orders`, `${list.length} Total`, pg.rows.map((o, i) => ({
            label: `#${o.no} · ${o.partyName}`, meta: `${(o.items || []).reduce((a, b) => a + D.num(b.qty), 0)} Pc`, active: i === repNav
        })), false);

        D.repPick = (i) => { repNav = i; const o = pg.rows[i]; if (o && repStatus === 'Pending') D.loadOrderInChallan(o.partyId, o.id); };

        const qEl = document.getElementById('rep-q');
        if (qEl) {
            qEl.addEventListener('input', () => { repSearch = qEl.value; repPage = 1; repNav = 0; renderReport(); });
            qEl.focus();
        }
        D.bindFormControls({
            listNav: {
                selector: '#rep-tb .dk-nav-row',
                searchId: 'rep-q',
                getIdx: () => repNav,
                setIdx: (i) => { repNav = i; },
                onEnter: (i) => D.repPick(i)
            }
        });
    }
})();
