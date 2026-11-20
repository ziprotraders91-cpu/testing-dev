/* ============================================================================
   ORDER FORM (Book Format) + PENDING / COMPLETE ALL ORDERS
   File: dukan-erp/dukan-order.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let selFirmId = '';
    let rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];
    let repPage = 1;
    let repStatus = 'Pending';
    let repSearch = '';

    D.openOrderForm = () => {
        D.screen = 'order';
        D.onEsc = null;
        const parties = D.get('dukan_parties');
        const firms = D.get('dukan_firms');
        if (!selPartyId && parties[0]) selPartyId = parties[0].id;
        if (!selFirmId && firms[0]) selFirmId = firms[0].id;
        rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];
        renderForm();
    };

    function renderForm() {
        const parties = D.get('dukan_parties');
        const firms = D.get('dukan_firms');
        const orders = D.get('dukan_orders');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const f = firms.find((x) => x.id === selFirmId) || { name: 'INDIAN FABRICS' };
        const nextNo = String(197 + orders.length);

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="of-firm" value="${D.esc(f.name)}" readonly></div>
            <div class="dk-row"><label>M/s. (Party) :</label><input id="of-party" value="${D.esc(p.name || '')}" placeholder="Right Side List se Party chunein" readonly></div>
            <div class="dk-row"><label>Order No. &amp; Date :</label><div style="display:flex;gap:8px;"><input id="of-no" value="${nextNo}" style="width:100px;"><input id="of-date" type="date" value="${D.today()}"></div></div>
            <div class="dk-row"><label>TIN / GST No. :</label><input id="of-gst" value="${D.esc(p.gst || '')}"></div>
            <div class="dk-row"><label>Marka / Through :</label><input id="of-marka" value="${D.esc(p.marka || '')}"></div>
            <div class="dk-row"><label>Transport / Agent :</label><div style="display:flex;gap:8px;"><input id="of-tr" value="${D.esc(p.transport || '')}" placeholder="Transport"><input id="of-agent" value="${D.esc(p.agent || '')}" placeholder="Agent"></div></div>
            <div class="dk-row"><label>Packaging :</label><select id="of-pack"><option>Box</option><option>Paper</option><option>No Box</option></select></div>
            <div class="dk-row"><label>Remarks :</label><input id="of-rem" placeholder="Note / Instructions"></div>

            <div class="dk-sec">Order Items (Particulars · Qnty · Rate · Fold Size · Cancelled Colour)</div>
            <table class="dk-tbl">
                <thead><tr><th>#</th><th>Particulars</th><th>Qnty</th><th>Rate</th><th>Fold Size</th><th>Cancel Col.</th></tr></thead>
                <tbody id="of-items-tb">${rows.map((r, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><input value="${D.esc(r.name)}" onchange="DukanERP.ofUpd(${i},'name',this.value)" style="width:100%;padding:4px;border:1px solid #d1d5db;"></td>
                        <td><input type="number" value="${r.qty}" onchange="DukanERP.ofUpd(${i},'qty',this.value)" style="width:60px;padding:4px;border:1px solid #d1d5db;"></td>
                        <td><input type="number" value="${r.rate}" onchange="DukanERP.ofUpd(${i},'rate',this.value)" style="width:65px;padding:4px;border:1px solid #d1d5db;"></td>
                        <td><input value="${D.esc(r.fold)}" onchange="DukanERP.ofUpd(${i},'fold',this.value)" style="width:80px;padding:4px;border:1px solid #d1d5db;"></td>
                        <td><input value="${D.esc(r.cancel)}" onchange="DukanERP.ofUpd(${i},'cancel',this.value)" style="width:75px;padding:4px;border:1px solid #d1d5db;"></td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <button type="button" class="dk-btn" onclick="DukanERP.ofAddRow()">+ Add Item Row</button>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print Order Form</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.saveOrder()">💾 Save Order</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Order Form (Book Format)</h2>`, left, 'Bagal wali list se Party chunein');
        D.setSide('List of Parties', `${parties.length} Parties`, parties.slice(0, 60).map((x) => ({
            id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}`, active: x.id === selPartyId
        })), (it) => { selPartyId = it.id; renderForm(); }, 'of-party');
    }

    D.ofUpd = (i, k, v) => { rows[i][k] = k === 'name' ? v.toUpperCase() : v; };
    D.ofAddRow = () => { rows.push({ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }); renderForm(); };

    D.saveOrder = () => {
        if (!selPartyId) return alert('Pehle Party chunein!');
        const valid = rows.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) return alert('Kam se kam 1 item & qty bharein!');
        const parties = D.get('dukan_parties');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const orders = D.get('dukan_orders');
        orders.push({
            id: `ord_${Date.now()}`,
            no: document.getElementById('of-no').value.trim(),
            date: document.getElementById('of-date').value,
            firmName: document.getElementById('of-firm').value,
            partyId: selPartyId,
            partyName: p.name || '',
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
        alert('✅ Order Save ho gaya!');
        D.openOrderForm();
    };

    D.printOrderBook = () => {
        const firms = D.get('dukan_firms');
        const f = firms.find((x) => x.id === selFirmId) || { name: document.getElementById('of-firm')?.value || 'INDIAN FABRICS', gst: '', address: '', mob: '', email: '' };
        const w = window.open('', '_blank', 'width=850,height=700');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #991b1b;padding:6px;font-size:12px;text-align:left}th{background:#fef2f2;color:#991b1b}</style></head><body>
            <div style="border:2px solid #991b1b;padding:14px;">
                <div style="display:flex;justify-content:space-between;border-bottom:2px solid #991b1b;padding-bottom:8px;">
                    <div><strong style="font-size:18px;color:#991b1b;">${D.esc(f.name)}</strong><div style="font-size:11px;">GSTIN: ${D.esc(f.gst || '-')} · ${D.esc(f.address || '')}</div></div>
                    <div style="text-align:right;"><strong style="color:#991b1b;">ORDER FORM</strong><div style="font-size:12px;">No: <b>${D.esc(document.getElementById('of-no')?.value)}</b> · Date: ${D.esc(document.getElementById('of-date')?.value)}</div></div>
                </div>
                <div style="font-size:12px;margin:8px 0;"><b>M/s.:</b> ${D.esc(document.getElementById('of-party')?.value)} | <b>Marka:</b> ${D.esc(document.getElementById('of-marka')?.value)} | <b>Transport:</b> ${D.esc(document.getElementById('of-tr')?.value)} | <b>Agent:</b> ${D.esc(document.getElementById('of-agent')?.value)} | <b>Pack:</b> ${D.esc(document.getElementById('of-pack')?.value)}</div>
                <table><thead><tr><th>S.No</th><th>Particulars</th><th>Qnty</th><th>Rate</th><th>Fold Size</th><th>Cancelled Colour</th></tr></thead>
                <tbody>${rows.filter(r => r.name).map((r, i) => `<tr><td>${i+1}</td><td><b>${D.esc(r.name)}</b></td><td>${r.qty}</td><td>${r.rate}</td><td>${D.esc(r.fold)}</td><td>${D.esc(r.cancel)}</td></tr>`).join('')}</tbody></table>
                <div style="margin-top:10px;font-size:11px;display:flex;justify-content:space-between;"><span>Remarks: ${D.esc(document.getElementById('of-rem')?.value || '-')}</span><b>For: ${D.esc(f.name)}</b></div>
            </div></body></html>`);
        w.document.close(); w.print();
    };

    /* ALL PENDING / COMPLETE ORDERS REPORT (PAGINATED) */
    D.openAllOrders = (status) => {
        D.screen = status === 'Pending' ? 'pending' : 'complete';
        D.onEsc = null;
        repStatus = status; repPage = 1; repSearch = '';
        renderReport();
    };

    window.dkRepPage = (p) => { repPage = p; renderReport(); };

    function renderReport() {
        const orders = D.get('dukan_orders').filter((o) =>
            (repStatus === 'Pending' ? o.status !== 'Complete' : o.status === 'Complete') &&
            (!repSearch || `${o.no} ${o.partyName} ${o.marka} ${(o.items || []).map(i => i.name).join(' ')}`.toLowerCase().includes(repSearch.toLowerCase()))
        );
        const pg = D.paginate(orders, repPage);
        const left = `
            <div class="dk-row"><label>🔍 Search Order :</label><input value="${D.esc(repSearch)}" placeholder="Order No, Party, Design..." oninput="DukanERP.repFind(this.value)"></div>
            <table class="dk-tbl">
                <thead><tr><th>Order #</th><th>Date</th><th>Party</th><th>Items</th><th>Action</th></tr></thead>
                <tbody>${pg.rows.length ? pg.rows.map((o) => `
                    <tr>
                        <td><strong>#${D.esc(o.no)}</strong></td><td>${D.esc(o.date)}</td><td>${D.esc(o.partyName)}</td>
                        <td>${(o.items || []).map((i) => `${D.esc(i.name)} (${i.qty})`).join(', ')}</td>
                        <td>${repStatus === 'Pending' ? `<button type="button" class="dk-btn-gold" style="padding:4px 8px;font-size:11px;" onclick="DukanERP.loadOrderInChallan('${o.partyId}','${o.id}')">Challan →</button>` : '✅ Done'}</td>
                    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi ${repStatus} order nahi</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkRepPage')}
        `;
        D.renderShell(`<h2>${repStatus} Orders (All Parties)</h2>`, left);
        D.setSide(`${repStatus} Summary`, `${orders.length} Orders`, pg.rows.map((o) => ({
            label: `#${o.no} · ${o.partyName}`, meta: `${(o.items || []).reduce((a, b) => a + D.num(b.qty), 0)} Pcs`
        })), () => {});
    }

    D.repFind = (v) => { repSearch = v; repPage = 1; renderReport(); };
})();
