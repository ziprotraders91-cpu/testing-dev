/* ============================================================================
   ORDER FORM (Book Format + Batch Loop + Live Finished Stock)
   + PENDING & COMPLETE ALL ORDERS (Party List -> Order List + Universal Search)
   File: dukan-erp/dukan-order.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let selFirmId = '';
    let batch = [];

    let repStatus = 'Pending', repStep = 'parties', repPartyId = '', repSearch = '', repOrdSearch = '', repPage = 1, repNav = 0;

    function getNextOrderNo() {
        const orders = D.get('dukan_orders');
        if (!orders.length) return '';
        const last = orders[orders.length - 1];
        const m = String(last?.no || '').match(/^(.*?)(\d+)$/);
        if (m) return `${m[1]}${parseInt(m[2], 10) + 1}`;
        return '';
    }

    D.openOrderForm = () => {
        D.screen = 'order';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        selFirmId = '';
        selPartyId = '';
        batch = [];
        renderForm('of-firm');
    };

    function applyFirmToHeader(f) {
        const nameEl = document.getElementById('of-firm');
        const infoEl = document.getElementById('of-firm-info');
        const phEl = document.getElementById('of-firm-ph');
        const forEl = document.getElementById('of-firm-for');
        if (nameEl) nameEl.value = f?.name || '';
        if (infoEl) infoEl.textContent = f ? `GSTIN: ${f.gst || '-'} · ${f.address || ''}${f.email ? ' · ' + f.email : ''}` : 'Side List se Apni Firm chunein';
        if (phEl) phEl.textContent = f?.mob ? `Mob: ${f.mob}` : '';
        if (forEl) forEl.textContent = `For: ${f?.name || '-'}`;
    }

    function renderBatchTable() {
        const tb = document.getElementById('of-items-tb');
        const totEl = document.getElementById('of-batch-tot');
        if (!tb) return;
        const totPcs = batch.reduce((a, b) => a + D.num(b.qty), 0);
        if (totEl) totEl.textContent = `Total: ${batch.length} Designs · ${totPcs} Pcs`;

        tb.innerHTML = batch.length ? batch.map((r, i) => `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><strong>${D.esc(r.name)}</strong></td>
                <td><strong>${r.qty}</strong></td>
                <td>${r.rate}</td>
                <td>${D.esc(r.fold)}</td>
                <td>${D.esc(r.cancel)}</td>
                <td style="text-align:center;"><button type="button" class="dk-btn" style="padding:2px 6px;color:#dc2626;" onclick="DukanERP.ofDelRow(${i})">✕</button></td>
            </tr>`).join('')
            : `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;">Item chunein → Pcs → Rate → Fold → Cancel → +Add (Enter) — Batch yahan judega</td></tr>`;
    }

    D.ofAddBatchItem = () => {
        const nmEl = document.getElementById('of-cur-name');
        const qtEl = document.getElementById('of-cur-qty');
        const rtEl = document.getElementById('of-cur-rate');
        const flEl = document.getElementById('of-cur-fold');
        const cnEl = document.getElementById('of-cur-cancel');

        const name = (nmEl?.value || '').trim().toUpperCase();
        const qty = D.num(qtEl?.value);
        if (!name) { D.toast('⚠️ Item / Design chunein!'); return D.focusField('of-cur-name'); }
        if (qty <= 0) { D.toast('⚠️ Qnty (Pcs) bharein!'); return D.focusField('of-cur-qty'); }

        batch.push({
            name,
            qty,
            rate: D.num(rtEl?.value),
            fold: (flEl?.value || 'Box Fold').trim(),
            cancel: (cnEl?.value || '-').trim()
        });

        nmEl.value = '';
        qtEl.value = '';
        rtEl.value = '';
        flEl.value = document.getElementById('of-fold')?.value || 'Box Fold';
        cnEl.value = '-';

        renderBatchTable();
        D.toast(`✅ Added: ${name} (${qty} Pc) — Agla item chunein ya [Ctrl+Enter] se GST No. par jayein`);
        D.focusField('of-cur-name');
    };

    D.ofDelRow = (i) => {
        batch.splice(i, 1);
        renderBatchTable();
        D.focusField('of-cur-name');
    };

    function renderForm(focusId = 'of-firm') {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const designOpts = D.getSellableDesignOptions();
        const nextNo = getNextOrderNo();

        const left = `
            <div class="dk-ord-book">
                <div class="dk-ord-hdr">
                    <div>
                        <input id="of-firm" value="" placeholder="Apni Firm chunein (Side List)..." style="border:none;border-bottom:1.5px dashed #991b1b;font-size:17px;font-weight:800;color:#991b1b;background:transparent;outline:none;width:290px;" autocomplete="off">
                        <div id="of-firm-info" style="font-size:10.5px;color:#7f1d1d;font-weight:700;margin-top:2px;">Side List se Apni Firm chunein</div>
                    </div>
                    <div style="text-align:right;">
                        <strong style="font-size:15px;color:#991b1b;letter-spacing:0.6px;">ORDER FORM</strong>
                        <div id="of-firm-ph" style="font-size:10.5px;color:#7f1d1d;font-weight:700;"></div>
                    </div>
                </div>

                <div class="dk-ord-grid">
                    <div class="dk-ord-main">
                        <div class="dk-ord-ms">
                            <strong style="color:#991b1b;font-size:13px;">M/s.</strong>
                            <input id="of-party" placeholder="Party ka naam likhein ya Side List se chunein..." autocomplete="off">
                        </div>
                        <div style="padding:5px 10px;border-bottom:1.5px solid #991b1b;display:grid;grid-template-columns:1.5fr 0.8fr;gap:8px;background:#fffafa;">
                            <div style="display:flex;align-items:center;gap:5px;font-size:11.5px;">
                                <strong style="color:#991b1b;">Add:</strong>
                                <input id="of-party-addr" placeholder="Party Address &amp; City" style="flex:1;border:none;border-bottom:1px dashed #fca5a5;font-size:11.5px;font-weight:600;outline:none;background:transparent;">
                            </div>
                            <div style="display:flex;align-items:center;gap:5px;font-size:11.5px;">
                                <strong style="color:#991b1b;">Mob:</strong>
                                <input id="of-party-mob" placeholder="Mobile No." style="flex:1;border:none;border-bottom:1px dashed #fca5a5;font-size:11.5px;font-weight:600;outline:none;background:transparent;">
                            </div>
                        </div>

                        <div style="padding:7px 8px;background:#fef2f2;border-bottom:1.5px solid #991b1b;display:grid;grid-template-columns:1.8fr 0.7fr 0.7fr 0.9fr 0.9fr auto;gap:5px;align-items:end;">
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Item / Design (Finished)</label><input id="of-cur-name" placeholder="Design..." style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;" autocomplete="off"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Qnty (Pcs)</label><input id="of-cur-qty" type="number" placeholder="0" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Rate</label><input id="of-cur-rate" type="number" placeholder="0" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Fold Size</label><input id="of-cur-fold" value="Box Fold" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Cancel Col.</label><input id="of-cur-cancel" value="-" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <button type="button" id="of-add-btn" class="dk-btn-gold" style="padding:6px 10px;font-size:11.5px;" onclick="DukanERP.ofAddBatchItem()">+ Add</button>
                        </div>

                        <div style="max-height:240px;overflow-y:auto;">
                            <table class="dk-ord-tbl">
                                <thead>
                                    <tr>
                                        <th style="width:36px;">S.No</th>
                                        <th>Particulars</th>
                                        <th style="width:58px;">Qnty.</th>
                                        <th style="width:62px;">Rate</th>
                                        <th style="width:80px;">Fold Size</th>
                                        <th style="width:82px;">Cancelled Col.</th>
                                        <th style="width:36px;">Del</th>
                                    </tr>
                                </thead>
                                <tbody id="of-items-tb"></tbody>
                            </table>
                        </div>

                        <div style="margin-top:auto;padding:7px 10px;border-top:1.5px solid #991b1b;background:#fff5f5;display:flex;justify-content:space-between;font-size:11px;color:#7f1d1d;">
                            <strong id="of-batch-tot">Total: 0 Designs · 0 Pcs</strong>
                            <strong id="of-firm-for">For: -</strong>
                        </div>
                    </div>

                    <div class="dk-ord-side">
                        <div class="dk-ord-2">
                            <div><label>No.</label><input id="of-no" value="${D.esc(nextNo)}" placeholder="Manual No."></div>
                            <div><label>Date</label><input id="of-date" type="date" value="${D.today()}"></div>
                        </div>
                        <div class="dk-ord-box"><label>Tin No. / GSTIN</label><input id="of-tin" placeholder="TIN / GST"></div>
                        <div class="dk-ord-box"><label>Marka / Through</label><input id="of-marka" placeholder="Marka"></div>
                        <div class="dk-ord-box"><label>Transport</label><input id="of-tr" placeholder="Transport"></div>
                        <div class="dk-ord-box"><label>Agent Name</label><input id="of-agent" placeholder="Agent Name"></div>
                        <div class="dk-ord-box"><label>Box / Paper / No Box</label><input id="of-pack" value="Box" autocomplete="off"></div>
                        <div class="dk-ord-box"><label>Fold</label><input id="of-fold" value="Box Fold" autocomplete="off"></div>
                        <div class="dk-ord-box" style="border-bottom:none;"><label>Remarks</label><input id="of-rem" placeholder="Enter = Save"></div>
                    </div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <small style="color:#92400e;font-weight:700;">Cancel Col → <b>+Add</b> (Enter) → wapas Item · Sab items hone par <strong>[Ctrl + Enter]</strong> se GST No. par jayein</small>
                <div style="display:flex;gap:8px;">
                    <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print Book Form</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askOrderSave()">💾 Save Order [Ctrl+Enter]</button>
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>Save Order Form?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveOrder()">Yes (Y)</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('of-rem');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(`<h2>Order Form (Batch Mode)</h2>`, left);
        renderBatchTable();

        const batchIds = ['of-cur-name', 'of-cur-qty', 'of-cur-rate', 'of-cur-fold', 'of-cur-cancel', 'of-add-btn'];
        const focusOrder = [
            'of-firm', 'of-party', 'of-party-addr', 'of-party-mob',
            ...batchIds,
            'of-no', 'of-date', 'of-tin', 'of-marka', 'of-tr', 'of-agent', 'of-pack', 'of-fold', 'of-rem'
        ];

        D.bindFormControls({
            focusOrder,
            sideBindings: {
                'of-firm': {
                    title: `List of Firms (${firms.length})`,
                    getItems: (q) => firms.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
                        .map((f) => ({ id: f.id, label: f.name, meta: f.city || f.gst || 'Firm', f })),
                    onPick: (it) => { selFirmId = it.id; applyFirmToHeader(it.f); D.focusField('of-party'); }
                },
                'of-party': {
                    title: `List of Parties (${parties.length})`,
                    getItems: (q) => parties.filter((x) => !q || `${x.name} ${x.city} ${x.marka} ${x.mob}`.toLowerCase().includes(q.toLowerCase()))
                        .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}` })),
                    onPick: (it) => {
                        selPartyId = it.id;
                        const pr = parties.find((x) => x.id === it.id) || {};
                        document.getElementById('of-party').value = pr.name || '';
                        document.getElementById('of-party-addr').value = [pr.address, pr.city].filter(Boolean).join(', ');
                        document.getElementById('of-party-mob').value = pr.mob || '';
                        document.getElementById('of-tin').value = pr.gst || '';
                        document.getElementById('of-marka').value = pr.marka || '';
                        document.getElementById('of-tr').value = pr.transport || '';
                        document.getElementById('of-agent').value = pr.agent || '';
                        D.focusField('of-cur-name');
                    }
                },
                'of-cur-name': {
                    title: `Finished Designs (${designOpts.length})`,
                    noAutoHighlight: true,
                    getItems: (q) => designOpts.filter((d) => !q || `${d.design} ${d.kariger}`.toLowerCase().includes(q.toLowerCase()))
                        .slice(0, 60).map((d) => ({ label: d.design, meta: `${d.finishedQty} Pc Fin · ${d.kariger || ''}` })),
                    onPick: (it) => { document.getElementById('of-cur-name').value = it.label; D.focusField('of-cur-qty'); },
                    onEmptyEnter: () => D.focusField('of-tin')
                },
                'of-pack': {
                    title: 'Packing Type',
                    getItems: (q) => ['Box', 'Paper', 'No Box'].filter((x) => !q || x.toLowerCase().includes(q.toLowerCase())).map((x) => ({ label: x, meta: 'Pack' })),
                    onPick: (it) => { document.getElementById('of-pack').value = it.label; D.focusField('of-fold'); }
                },
                'of-fold': {
                    title: 'Fold Type',
                    getItems: (q) => ['Box Fold', 'Book Fold', 'Patti Fold', 'Roll Fold'].filter((x) => !q || x.toLowerCase().includes(q.toLowerCase())).map((x) => ({ label: x, meta: 'Fold' })),
                    onPick: (it) => { document.getElementById('of-fold').value = it.label; D.focusField('of-rem'); }
                }
            },
            defaultSide: () => D.renderSide('Batch Summary', `${batch.length} Items`, batch.map((r) => ({
                label: r.name, meta: `${r.qty} Pc · ₹${r.rate}`
            })), false),
            onFinishForm: () => {
                const curId = document.activeElement?.id || '';
                if (batchIds.includes(curId)) {
                    if (!batch.length) { D.toast('⚠️ Kam se kam 1 item +Add karein!'); return D.focusField('of-cur-name'); }
                    const noEl = document.getElementById('of-no');
                    if (noEl && !noEl.value.trim()) {
                        D.toast('➡️ Order No. manual bharein phir GST No. par jayein');
                        return D.focusField('of-no');
                    }
                    D.focusField('of-tin');
                    D.toast('➡️ GST / Marka / Transport / Pack / Fold check karke [Ctrl+Enter] se Save karein');
                } else {
                    D.askOrderSave();
                }
            }
        });

        D.focusField(focusId);
    }

    D.askOrderSave = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim();
        const ordNo = (document.getElementById('of-no')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ M/s. Party Name bharein!'); return D.focusField('of-party'); }
        if (!ordNo) { D.toast('⚠️ Order No. bharein!'); return D.focusField('of-no'); }
        if (!batch.length) { D.toast('⚠️ Kam se kam 1 item Batch me +Add karein!'); return D.focusField('of-cur-name'); }
        D.askAccept(() => D.saveOrder());
    };

    D.saveOrder = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim().toUpperCase();
        const ordNo = (document.getElementById('of-no')?.value || '').trim();
        if (!partyTxt || !ordNo || !batch.length) return;

        const orders = D.get('dukan_orders');
        orders.push({
            id: `ord_${Date.now()}`,
            no: ordNo,
            date: document.getElementById('of-date').value || D.today(),
            firmId: selFirmId,
            firmName: (document.getElementById('of-firm').value || '').trim().toUpperCase(),
            partyId: selPartyId || partyTxt,
            partyName: partyTxt,
            partyAddress: document.getElementById('of-party-addr').value,
            partyMob: document.getElementById('of-party-mob').value,
            gst: document.getElementById('of-tin').value,
            marka: document.getElementById('of-marka').value,
            transport: document.getElementById('of-tr').value,
            agent: document.getElementById('of-agent').value,
            pack: document.getElementById('of-pack').value,
            fold: document.getElementById('of-fold').value,
            remarks: document.getElementById('of-rem').value,
            status: 'Pending',
            items: batch.map((r) => ({ ...r }))
        });
        D.set('dukan_orders', orders);
        D.toast(`✅ Order #${ordNo} (${batch.length} items) save ho gaya!`);
        D.openOrderForm();
    };

    D.printOrderBook = () => {
        const firm = document.getElementById('of-firm')?.value || 'FIRM';
        const fObj = D.get('dukan_firms').find((x) => x.id === selFirmId) || {};
        const totPcs = batch.reduce((a, b) => a + D.num(b.qty), 0);
        const w = window.open('', '_blank', 'width=900,height=700');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:14px}.bk{border:2px solid #991b1b}.hd{background:#fff5f5;border-bottom:2px solid #991b1b;padding:10px;display:flex;justify-content:space-between}.gr{display:grid;grid-template-columns:1fr 220px}.mn{border-right:1.5px solid #991b1b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #fca5a5;padding:5px;font-size:12px;text-align:left}th{background:#fef2f2;color:#991b1b}.sb{border-bottom:1px solid #fca5a5;padding:5px 8px;font-size:11px}</style></head><body>
            <div class="bk">
                <div class="hd"><div><strong style="font-size:18px;color:#991b1b;">${D.esc(firm)}</strong><div style="font-size:11px;">GSTIN: ${D.esc(fObj.gst || '-')} · ${D.esc(fObj.address || '')}</div></div><div style="text-align:right;"><strong style="color:#991b1b;">ORDER FORM</strong><div style="font-size:11px;">Mob: ${D.esc(fObj.mob || '-')}</div></div></div>
                <div class="gr"><div class="mn">
                    <div class="sb"><b>M/s.:</b> ${D.esc(document.getElementById('of-party').value)}<br><small>${D.esc(document.getElementById('of-party-addr').value)} | Mob: ${D.esc(document.getElementById('of-party-mob').value)}</small></div>
                    <table><thead><tr><th>S.No</th><th>Particulars</th><th>Qnty</th><th>Rate</th><th>Fold Size</th><th>Cancel Col.</th></tr></thead>
                    <tbody>${batch.map((r, i) => `<tr><td>${i + 1}</td><td><b>${D.esc(r.name)}</b></td><td>${r.qty}</td><td>${r.rate}</td><td>${D.esc(r.fold)}</td><td>${D.esc(r.cancel)}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="2">TOTAL (${batch.length} Items)</th><th>${totPcs} Pcs</th><th colspan="3"></th></tr></tfoot></table>
                </div><div>
                    <div class="sb"><b>No:</b> ${D.esc(document.getElementById('of-no').value)} | <b>Date:</b> ${D.esc(D.fmtDate(document.getElementById('of-date').value))}</div>
                    <div class="sb"><b>TIN/GST:</b> ${D.esc(document.getElementById('of-tin').value)}</div>
                    <div class="sb"><b>Marka:</b> ${D.esc(document.getElementById('of-marka').value)}</div>
                    <div class="sb"><b>Transport:</b> ${D.esc(document.getElementById('of-tr').value)}</div>
                    <div class="sb"><b>Agent:</b> ${D.esc(document.getElementById('of-agent').value)}</div>
                    <div class="sb"><b>Pack:</b> ${D.esc(document.getElementById('of-pack').value)} | <b>Fold:</b> ${D.esc(document.getElementById('of-fold').value)}</div>
                    <div class="sb"><b>Remarks:</b> ${D.esc(document.getElementById('of-rem').value)}</div>
                </div></div>
            </div></body></html>`);
        w.document.close(); w.print();
    };

    /* PENDING / COMPLETE ALL ORDERS: PARTY LIST -> ORDER LIST + UNIVERSAL SEARCH */
    D.openAllOrders = (status) => {
        D.screen = status === 'Pending' ? 'pending' : 'complete';
        D.onCustomFieldEnter = null;
        repStatus = status; repStep = 'parties'; repPartyId = ''; repSearch = ''; repOrdSearch = ''; repPage = 1; repNav = 0;
        D.onEsc = () => {
            if (repStep === 'orders') { repStep = 'parties'; repPage = 1; repNav = 0; renderReport(); }
            else window.openDukanGateway();
        };
        renderReport();
    };

    window.dkRepPage = (p) => { repPage = p; repNav = 0; renderReport(); };

    function renderReport() {
        const orders = D.get('dukan_orders');
        const parties = D.get('dukan_parties');
        const matchSt = (o) => repStatus === 'Pending' ? o.status !== 'Complete' : o.status === 'Complete';

        if (repStep === 'parties') {
            const getPList = () => {
                const map = new Map();
                orders.filter(matchSt).forEach((o) => {
                    const pid = o.partyId || o.partyName;
                    if (!map.has(pid)) {
                        const pObj = parties.find((x) => x.id === pid) || {};
                        map.set(pid, { id: pid, name: o.partyName || pObj.name || pid, city: pObj.city || '', count: 0, blob: '' });
                    }
                    const entry = map.get(pid);
                    entry.count++;
                    entry.blob += ' ' + D.getOrderProgress(o).searchText;
                });
                const q = repSearch.trim().toLowerCase();
                return Array.from(map.values()).filter((x) => !q || `${x.name} ${x.city} ${x.blob}`.toLowerCase().includes(q));
            };

            const drawRows = () => {
                const flt = getPList();
                const pg = D.paginate(flt, repPage);
                if (repNav >= pg.rows.length) repNav = 0;
                const tb = document.getElementById('rep-ptb');
                if (tb) {
                    tb.innerHTML = pg.rows.length ? pg.rows.map((p, i) => `
                        <tr class="dk-nav-row ${i === repNav ? 'active' : ''}" onclick="DukanERP.repOpenParty('${D.esc(p.id)}')">
                            <td><strong>${D.esc(p.name)}</strong></td>
                            <td>${D.esc(p.city || '-')}</td>
                            <td><strong>${p.count} ${repStatus}</strong></td>
                        </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:#9ca3af;">Koi ${repStatus} party nahi</td></tr>`;
                }
                const pgBox = document.getElementById('rep-pg');
                if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkRepPage');
                D.renderSide(`${repStatus} Parties`, `${flt.length} Parties`, pg.rows.map((p, i) => ({
                    label: p.name, meta: `${p.count} Orders`, active: i === repNav
                })), false);
            };

            D.renderShell(`<h2>${repStatus} Orders — Sari Party List</h2>`, `
                <div class="dk-row"><label>🔍 Universal Search :</label><input id="rep-q" value="${D.esc(repSearch)}" placeholder="Party, Marka, Design, Date ya Challan #..." autocomplete="off"></div>
                <table class="dk-tbl"><thead><tr><th>Party Name</th><th>City</th><th>${repStatus} Orders</th></tr></thead><tbody id="rep-ptb"></tbody></table>
                <div id="rep-pg"></div>
            `, '[↑ ↓] Party Chunein · [Enter] Orders Dekhein · [Esc] Back');

            drawRows();
            const qEl = document.getElementById('rep-q');
            if (qEl) {
                qEl.addEventListener('input', () => { repSearch = qEl.value; repPage = 1; repNav = 0; drawRows(); });
                qEl.focus();
            }
            D.bindFormControls({
                listNav: {
                    selector: '#rep-ptb .dk-nav-row',
                    searchId: 'rep-q',
                    getIdx: () => repNav,
                    setIdx: (i) => { repNav = i; },
                    onEnter: (i) => {
                        const row = D.paginate(getPList(), repPage).rows[i];
                        if (row) D.repOpenParty(row.id);
                    }
                }
            });
            return;
        }

        const pBaseOrders = orders.filter((o) => matchSt(o) && (o.partyId === repPartyId || o.partyName === repPartyId));
        const pName = pBaseOrders[0]?.partyName || repPartyId;
        const getFilteredOrders = () => {
            const q = repOrdSearch.trim().toLowerCase();
            return pBaseOrders.filter((o) => !q || D.getOrderProgress(o).searchText.includes(q));
        };

        const showSide = (ord) => {
            if (!ord) return D.renderSide(pName, '0', [], false);
            const prog = D.getOrderProgress(ord);
            D.renderSide(`Order #${ord.no}`, `Marka: ${ord.marka || '-'}`, [
                ...prog.items.map((x) => ({ label: x.name, meta: `Gaya ${x.sent}/${x.ordered} · Baki ${x.baki}` })),
                ...prog.challans.map((c) => ({
                    label: `📦 Ch #${c.no} (${D.fmtDate(c.date)})`,
                    meta: `Marka: ${c.marka || '-'} → ${(c.items || []).map((ci) => `${ci.name}:${ci.qty}`).join(', ')}`
                }))
            ], false);
        };

        const drawOrdRows = () => {
            const flt = getFilteredOrders();
            const pg = D.paginate(flt, repPage);
            if (repNav >= pg.rows.length) repNav = 0;
            const tb = document.getElementById('rep-tb');
            if (tb) {
                tb.innerHTML = pg.rows.length ? pg.rows.map((o, i) => {
                    const prog = D.getOrderProgress(o);
                    const detail = prog.items.map((x) => `<div><strong>${D.esc(x.name)}</strong>: Ord <b>${x.ordered}</b> | <span style="color:#15803d;">Gaya ${x.sent}</span> | <span style="color:#b91c1c;">Baki ${x.baki}</span></div>`).join('');
                    const chHTML = prog.challans.map((c) =>
                        `<div style="font-size:11px;color:#4b5563;margin-top:2px;">📦 <b>Ch #${D.esc(c.no)}</b> (${D.fmtDate(c.date)}) · Marka: <b>${D.esc(c.marka || '-')}</b> → ${(c.items || []).map((ci) => `${D.esc(ci.name)}:${ci.qty}`).join(', ')}</div>`
                    ).join('');
                    return `
                    <tr class="dk-nav-row ${i === repNav ? 'active' : ''}" onclick="DukanERP.repPick(${i})">
                        <td><strong>#${D.esc(o.no)}</strong><br><small>${D.fmtDate(o.date)}</small></td>
                        <td>${detail}${chHTML}</td><td>${D.esc(o.marka || '-')}</td>
                        <td>${repStatus === 'Pending' ? `<button type="button" class="dk-btn-gold" style="padding:4px 9px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${o.partyId}','${o.id}')">Challan →</button>` : '✅ Complete'}</td>
                    </tr>`;
                }).join('') : `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Koi order nahi mila</td></tr>`;
            }
            const pgBox = document.getElementById('rep-ord-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkRepPage');
            showSide(pg.rows[repNav]);
        };

        const left = `
            <div class="dk-row"><label>🔍 Universal Search :</label><input id="rep-ord-q" value="${D.esc(repOrdSearch)}" placeholder="Marka, Design, Date (21-11-2026), Order # ya Challan #..." autocomplete="off"></div>
            <table class="dk-tbl">
                <thead><tr><th>Order # / Date</th><th>Item Hisab &amp; Dispatch (Marka · Date · Pcs)</th><th>Order Marka</th><th>Action</th></tr></thead>
                <tbody id="rep-tb"></tbody>
            </table>
            <div id="rep-ord-pg"></div>
        `;
        D.renderShell(`<h2>${D.esc(pName)} → ${repStatus} Orders</h2><button type="button" class="dk-btn" onclick="DukanERP.repBackParties()">← Party List</button>`, left, 'Marka / Date / Design search karein · [↑ ↓] + [Enter]');
        drawOrdRows();

        const oq = document.getElementById('rep-ord-q');
        if (oq) {
            oq.addEventListener('input', () => { repOrdSearch = oq.value; repPage = 1; repNav = 0; drawOrdRows(); });
            oq.focus();
        }
        D.repPick = (i) => {
            repNav = i;
            document.querySelectorAll('#rep-tb .dk-nav-row').forEach((r, idx) => r.classList.toggle('active', idx === i));
            const o = D.paginate(getFilteredOrders(), repPage).rows[i];
            showSide(o);
            if (o && repStatus === 'Pending') D.loadOrderInChallan(o.partyId, o.id);
        };
        D.bindFormControls({
            listNav: {
                selector: '#rep-tb .dk-nav-row',
                searchId: 'rep-ord-q',
                getIdx: () => repNav,
                setIdx: (i) => { repNav = i; },
                onHighlight: (i) => showSide(D.paginate(getFilteredOrders(), repPage).rows[i]),
                onEnter: (i) => D.repPick(i)
            }
        });
    }

    D.repOpenParty = (pid) => { repPartyId = pid; repStep = 'orders'; repOrdSearch = ''; repPage = 1; repNav = 0; renderReport(); };
    D.repBackParties = () => { repStep = 'parties'; repPage = 1; repNav = 0; renderReport(); };
})();
