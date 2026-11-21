/* ============================================================================
   ORDER FORM (Book Format + Firm Auto-Fill + Fixed Design Enter)
   + PENDING & COMPLETE ORDERS (Pahle Sari Party List -> Andar Order List)
   File: dukan-erp/dukan-order.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let selPartyId = '';
    let selFirmId = '';
    let rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];

    // Pending/Complete Reports state (Party List -> Order List)
    let repStatus = 'Pending', repStep = 'parties', repPartyId = '', repSearch = '', repPage = 1, repNav = 0;

    D.openOrderForm = () => {
        D.screen = 'order';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        const firms = D.get('dukan_firms');
        selFirmId = firms.length ? firms[0].id : '';
        selPartyId = '';
        rows = [{ name: '', qty: '', rate: '', fold: 'Box Fold', cancel: '-' }];
        renderForm('of-firm');
    };

    function applyFirmToHeader(f) {
        const nameEl = document.getElementById('of-firm');
        const infoEl = document.getElementById('of-firm-info');
        const phEl = document.getElementById('of-firm-ph');
        const forEl = document.getElementById('of-firm-for');
        if (nameEl) nameEl.value = f?.name || '';
        if (infoEl) infoEl.textContent = `GSTIN: ${f?.gst || '-'} · ${f?.address || ''}${f?.email ? ' · ' + f.email : ''}`;
        if (phEl) phEl.textContent = f?.mob ? `Mob: ${f.mob}` : '';
        if (forEl) forEl.textContent = `For: ${f?.name || 'FIRM'}`;
    }

    function bindRowEvents(i) {
        const rName = document.getElementById(`of-it-${i}-name`);
        const rCancel = document.getElementById(`of-it-${i}-cancel`);
        if (rName) rName.addEventListener('input', () => { rows[i].name = rName.value.toUpperCase(); });
        ['qty', 'rate', 'fold', 'cancel'].forEach((k) => {
            const el = document.getElementById(`of-it-${i}-${k}`);
            if (el) el.addEventListener('input', () => { rows[i][k] = el.value; });
        });
        if (rCancel) {
            rCancel.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    if (String(rows[i].name || '').trim()) {
                        if (i === rows.length - 1) appendBatchRow();
                        else D.focusField(`of-it-${i + 1}-name`);
                    } else D.focusField('of-no');
                }
            });
        }
    }

    function appendBatchRow() {
        const i = rows.length;
        const defFold = document.getElementById('of-fold')?.value || 'Box Fold';
        rows.push({ name: '', qty: '', rate: '', fold: defFold, cancel: '-' });
        const tb = document.getElementById('of-items-tb');
        if (!tb) return;
        tb.insertAdjacentHTML('beforeend', `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><input id="of-it-${i}-name" placeholder="Design..." autocomplete="off"></td>
                <td><input id="of-it-${i}-qty" type="number" placeholder="0"></td>
                <td><input id="of-it-${i}-rate" type="number" placeholder="0"></td>
                <td><input id="of-it-${i}-fold" value="${D.esc(defFold)}"></td>
                <td><input id="of-it-${i}-cancel" value="-"></td>
            </tr>
        `);
        bindRowEvents(i);
        rebuildOrderBindings();
        D.focusField(`of-it-${i}-name`);
    }

    function rebuildOrderBindings() {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const designs = D.get('dukan_designs');

        const focusOrder = ['of-firm', 'of-party', 'of-party-addr', 'of-party-mob'];
        const sideBindings = {
            'of-firm': {
                title: `List of Firms (${firms.length})`,
                getItems: (q) => firms.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
                    .map((f) => ({ id: f.id, label: f.name, meta: f.city || f.gst || 'Firm', f, active: f.id === selFirmId })),
                onPick: (it) => {
                    selFirmId = it.id;
                    applyFirmToHeader(it.f);
                    D.focusField('of-party');
                }
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
                    D.focusField('of-it-0-name');
                }
            },
            'of-pack': {
                title: 'Packing Type',
                getItems: (q) => ['Box', 'Paper', 'No Box']
                    .filter((x) => !q || x.toLowerCase().includes(q.toLowerCase()))
                    .map((x) => ({ label: x, meta: 'Pack' })),
                onPick: (it) => { document.getElementById('of-pack').value = it.label; D.focusField('of-fold'); }
            },
            'of-fold': {
                title: 'Fold Type',
                getItems: (q) => ['Box Fold', 'Book Fold', 'Patti Fold', 'Roll Fold']
                    .filter((x) => !q || x.toLowerCase().includes(q.toLowerCase()))
                    .map((x) => ({ label: x, meta: 'Fold' })),
                onPick: (it) => { document.getElementById('of-fold').value = it.label; D.focusField('of-rem'); }
            }
        };

        rows.forEach((_, i) => {
            focusOrder.push(`of-it-${i}-name`, `of-it-${i}-qty`, `of-it-${i}-rate`, `of-it-${i}-fold`, `of-it-${i}-cancel`);
            sideBindings[`of-it-${i}-name`] = {
                title: 'List of Designs (↑ ↓ + Enter)',
                noAutoHighlight: true,
                getItems: (q) => designs.filter((d) => !q || d.design.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60).map((d) => ({ label: d.design, meta: `${D.num(d.freshQty)} Pc · ${d.kariger || ''}` })),
                onPick: (it) => {
                    rows[i].name = it.label;
                    const inp = document.getElementById(`of-it-${i}-name`);
                    if (inp) inp.value = it.label;
                    D.focusField(`of-it-${i}-qty`);
                },
                onEmptyEnter: () => D.focusField('of-no')
            };
        });

        focusOrder.push('of-no', 'of-date', 'of-tin', 'of-marka', 'of-tr', 'of-agent', 'of-pack', 'of-fold', 'of-rem');

        D.bindFormControls({
            focusOrder,
            sideBindings,
            defaultSide: () => D.renderSide('Order Items Preview', `${rows.filter(r => r.name).length} Items`, rows.filter(r => r.name).map((r) => ({
                label: r.name, meta: `${r.qty || 0} Pc · ₹${r.rate || 0}`
            })), false),
            onFinishForm: () => D.askOrderSave()
        });
    }

    function renderForm(focusId = 'of-firm') {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) => x.id === selFirmId) || firms[0] || {};
        const orders = D.get('dukan_orders');
        const nextNo = String(197 + orders.length);

        const left = `
            <div class="dk-ord-book">
                <div class="dk-ord-hdr">
                    <div>
                        <input id="of-firm" value="${D.esc(fObj.name || '')}" placeholder="Apni Firm chunein (Side List)..." style="border:none;border-bottom:1px dashed #991b1b;font-size:17px;font-weight:800;color:#991b1b;background:transparent;outline:none;width:270px;" autocomplete="off">
                        <div id="of-firm-info" style="font-size:10.5px;color:#7f1d1d;font-weight:700;margin-top:2px;">GSTIN: ${D.esc(fObj.gst || '-')} · ${D.esc(fObj.address || '')}${fObj.email ? ' · ' + D.esc(fObj.email) : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <strong style="font-size:15px;color:#991b1b;letter-spacing:0.6px;">ORDER FORM</strong>
                        <div id="of-firm-ph" style="font-size:10.5px;color:#7f1d1d;font-weight:700;">${fObj.mob ? 'Mob: ' + D.esc(fObj.mob) : ''}</div>
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

                        <table class="dk-ord-tbl">
                            <thead>
                                <tr>
                                    <th style="width:36px;">S.No</th>
                                    <th>Particulars</th>
                                    <th style="width:58px;">Qnty.</th>
                                    <th style="width:62px;">Rate</th>
                                    <th style="width:80px;">Fold Size</th>
                                    <th style="width:82px;">Cancelled Colour</th>
                                </tr>
                            </thead>
                            <tbody id="of-items-tb">
                                ${rows.map((r, i) => `
                                    <tr>
                                        <td style="text-align:center;">${i + 1}</td>
                                        <td><input id="of-it-${i}-name" value="${D.esc(r.name)}" placeholder="Design..." autocomplete="off"></td>
                                        <td><input id="of-it-${i}-qty" type="number" value="${r.qty}" placeholder="0"></td>
                                        <td><input id="of-it-${i}-rate" type="number" value="${r.rate}" placeholder="0"></td>
                                        <td><input id="of-it-${i}-fold" value="${D.esc(r.fold)}"></td>
                                        <td><input id="of-it-${i}-cancel" value="${D.esc(r.cancel)}"></td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>

                        <div style="margin-top:auto;padding:8px 10px;border-top:1px solid #fca5a5;display:flex;justify-content:space-between;font-size:10.5px;color:#7f1d1d;">
                            <span>1. Subject to Jurisdiction · 2. No Rate Difference</span>
                            <strong id="of-firm-for">For: ${D.esc(fObj.name || 'FIRM')}</strong>
                        </div>
                    </div>

                    <div class="dk-ord-side">
                        <div class="dk-ord-2">
                            <div><label>No.</label><input id="of-no" value="${nextNo}"></div>
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

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
                <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print Book Form</button>
                <button type="button" class="dk-btn-gold" onclick="DukanERP.askOrderSave()">💾 Save Order [Ctrl+Enter]</button>
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

        D.renderShell(`<h2>Order Form (Book Format)</h2>`, left, 'Design box par ↓ dabakar Enter se Design chunein · Khali box par Enter se Order No. par jayein');
        rows.forEach((_, i) => bindRowEvents(i));
        rebuildOrderBindings();
        D.focusField(focusId);
    }

    D.askOrderSave = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ M/s. Party Name bharein!'); return D.focusField('of-party'); }
        const valid = rows.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!valid.length) { D.toast('⚠️ Kam se kam 1 item aur Qnty bharein!'); return D.focusField('of-it-0-name'); }
        D.askAccept(() => D.saveOrder());
    };

    D.saveOrder = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim().toUpperCase();
        const valid = rows.filter((r) => String(r.name || '').trim() && D.num(r.qty) > 0);
        if (!partyTxt || !valid.length) return;

        const orders = D.get('dukan_orders');
        orders.push({
            id: `ord_${Date.now()}`,
            no: document.getElementById('of-no').value.trim(),
            date: document.getElementById('of-date').value,
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
            items: valid.map((r) => ({ ...r, qty: D.num(r.qty), rate: D.num(r.rate) }))
        });
        D.set('dukan_orders', orders);
        D.toast(`✅ Order #${document.getElementById('of-no').value} save ho gaya!`);
        D.openOrderForm();
    };

    D.printOrderBook = () => {
        const book = document.querySelector('.dk-ord-book');
        if (!book) return;
        const clone = book.cloneNode(true);
        clone.querySelectorAll('input').forEach((inp) => {
            const orig = document.getElementById(inp.id);
            const span = document.createElement('span');
            span.textContent = orig ? orig.value : inp.value;
            span.style.cssText = inp.style.cssText + ';display:inline-block;border:none;';
            inp.replaceWith(span);
        });
        const w = window.open('', '_blank', 'width=900,height=700');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;padding:14px}.dk-ord-book{border:2px solid #991b1b}.dk-ord-hdr{background:#fff5f5;border-bottom:2px solid #991b1b;padding:10px;display:flex;justify-content:space-between}.dk-ord-grid{display:grid;grid-template-columns:1fr 230px}.dk-ord-main{border-right:1.5px solid #991b1b}.dk-ord-ms{padding:8px;border-bottom:1.5px solid #991b1b;display:flex;gap:8px}.dk-ord-tbl{width:100%;border-collapse:collapse}.dk-ord-tbl th,.dk-ord-tbl td{border:1px solid #fca5a5;padding:5px;font-size:12px}.dk-ord-box,.dk-ord-2{border-bottom:1px solid #fca5a5;padding:5px 8px;font-size:11px}.dk-ord-2{display:grid;grid-template-columns:1fr 1fr}</style></head><body>${clone.outerHTML}</body></html>`);
        w.document.close(); w.print();
    };

    /* PENDING / COMPLETE ALL ORDERS: PAHLE PARTY LIST -> ANDAR ORDER LIST */
    D.openAllOrders = (status) => {
        D.screen = status === 'Pending' ? 'pending' : 'complete';
        D.onCustomFieldEnter = null;
        repStatus = status; repStep = 'parties'; repPartyId = ''; repSearch = ''; repPage = 1; repNav = 0;
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
                        map.set(pid, { id: pid, name: o.partyName || pObj.name || pid, city: pObj.city || '', count: 0 });
                    }
                    map.get(pid).count++;
                });
                return Array.from(map.values()).filter((x) => !repSearch || `${x.name} ${x.city}`.toLowerCase().includes(repSearch.toLowerCase()));
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
                <div class="dk-row"><label>🔍 Search Party :</label><input id="rep-q" value="${D.esc(repSearch)}" placeholder="Party naam likhein..." autocomplete="off"></div>
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

        const pOrders = orders.filter((o) => matchSt(o) && (o.partyId === repPartyId || o.partyName === repPartyId));
        const pg = D.paginate(pOrders, repPage);
        if (repNav >= pg.rows.length) repNav = 0;
        const pName = pOrders[0]?.partyName || repPartyId;

        const left = `
            <table class="dk-tbl">
                <thead><tr><th>Order #</th><th>Date</th><th>Item-Wise (Ord · Gaya · Baki)</th><th>Marka</th><th>Action</th></tr></thead>
                <tbody id="rep-tb">${pg.rows.length ? pg.rows.map((o, i) => {
                    const prog = D.getOrderProgress(o);
                    const detail = prog.items.map((x) => `<div><strong>${D.esc(x.name)}</strong>: Ord <b>${x.ordered}</b> | <span style="color:#15803d;">Gaya ${x.sent}</span> | <span style="color:#b91c1c;">Baki ${x.baki}</span></div>`).join('');
                    return `
                    <tr class="dk-nav-row ${i === repNav ? 'active' : ''}" onclick="DukanERP.repPick(${i})">
                        <td><strong>#${D.esc(o.no)}</strong></td><td>${D.esc(o.date)}</td>
                        <td>${detail}</td><td>${D.esc(o.marka || '-')}</td>
                        <td>${repStatus === 'Pending' ? `<button type="button" class="dk-btn-gold" style="padding:4px 9px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${o.partyId}','${o.id}')">Challan →</button>` : '✅ Complete'}</td>
                    </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi order nahi</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkRepPage')}
        `;
        D.renderShell(`<h2>${D.esc(pName)} → ${repStatus} Orders</h2><button type="button" class="dk-btn" onclick="DukanERP.repBackParties()">← Party List</button>`, left, '[↑ ↓] Order Chunein · [Enter] Challan me Load');
        D.renderSide(pName, `${pOrders.length} Orders`, pg.rows.map((o, i) => ({
            label: `Order #${o.no}`, meta: o.date, active: i === repNav
        })), false);

        D.repPick = (i) => { repNav = i; const o = pg.rows[i]; if (o && repStatus === 'Pending') D.loadOrderInChallan(o.partyId, o.id); };
        D.bindFormControls({
            listNav: { selector: '#rep-tb .dk-nav-row', getIdx: () => repNav, setIdx: (i) => { repNav = i; }, onEnter: (i) => D.repPick(i) }
        });
    }

    D.repOpenParty = (pid) => { repPartyId = pid; repStep = 'orders'; repPage = 1; repNav = 0; renderReport(); };
    D.repBackParties = () => { repStep = 'parties'; repPage = 1; repNav = 0; renderReport(); };
})();
