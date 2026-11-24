/* ============================================================================
   ORDER FORM:
   - 2-Button Menu: [Order Form] & [Order Register]
   - Dedicated Order Register with Universal Search + Edit / Delete / A5 Print / Challan
   - Create / Edit / Delete + A5 Book Print + Batch Loop
   - PENDING & COMPLETE ALL ORDERS (Party List -> Order List + Universal Search)
   File: dukan-erp/dukan-order.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let viewMode = 'choice'; // 'choice' | 'form' | 'register'
    let choiceIdx = 0;
    let fromRegister = false;
    let fromExternal = false;
    let editOrderId = '';
    let selPartyId = '';
    let selFirmId = '';
    let batch = [];
    let isSavingOrder = false;
    let lastOrderSaveTime = 0;
    let isDeletingOrder = false;

    let regSearch = '', regPage = 1, regNav = 0;
    let repStatus = 'Pending', repStep = 'parties', repPartyId = '', repSearch = '', repOrdSearch = '', repPage = 1, repNav = 0;

    function getNextOrderNo() {
        const orders = D.get('dukan_orders');
        if (!orders.length) return '';
        const last = orders[orders.length - 1];
        const m = String(last?.no || '').match(/^(.*?)(\d+)$/);
        if (m) return `${m[1]}${parseInt(m[2], 10) + 1}`;
        return '';
    }

    function bindOrderEsc() {
        D.onEsc = () => {
            if (viewMode === 'form') {
                if (fromExternal) {
                    fromExternal = false;
                    window.openDukanGateway();
                    return;
                }
                viewMode = fromRegister ? 'register' : 'choice';
                editOrderId = '';
                fromRegister = false;
                renderOrderScreen();
            } else if (viewMode === 'register') {
                viewMode = 'choice';
                renderOrderScreen();
            } else {
                window.openDukanGateway();
            }
        };
    }

    D.openOrderForm = (ordId = '', opts = {}) => {
        D.screen = 'order';
        D.onCustomFieldEnter = null;
        bindOrderEsc();
        fromExternal = !!opts.fromExt;

        if (ordId) {
            const ord = D.get('dukan_orders').find((o) => o.id === ordId);
            if (ord) {
                viewMode = 'form';
                editOrderId = ord.id;
                selFirmId = ord.firmId || '';
                selPartyId = ord.partyId || '';
                batch = (ord.items || []).map((x) => ({ ...x }));
                renderOrderScreen('of-cur-name', ord);
                return;
            }
        }

        viewMode = 'choice';
        choiceIdx = 0;
        fromRegister = false;
        editOrderId = '';
        selFirmId = '';
        selPartyId = '';
        batch = [];
        regSearch = '';
        regPage = 1;
        regNav = 0;
        renderOrderScreen();
    };

    D.openOrderEdit = (ordId) => {
        fromRegister = false;
        D.openOrderForm(ordId, { fromExt: true });
    };

    D.ofEditFromReg = (ordId) => {
        fromRegister = true;
        D.openOrderForm(ordId);
    };

    D.ofOpenChoice = (idx) => {
        choiceIdx = idx;
        fromRegister = false;
        fromExternal = false;
        editOrderId = '';
        if (idx === 0) {
            viewMode = 'form';
            selFirmId = '';
            selPartyId = '';
            batch = [];
            renderOrderScreen('of-firm', null);
        } else {
            viewMode = 'register';
            regPage = 1;
            regNav = 0;
            renderOrderScreen();
        }
    };

    D.ofBackToChoice = () => {
        viewMode = 'choice';
        editOrderId = '';
        fromRegister = false;
        fromExternal = false;
        renderOrderScreen();
    };

    window.dkOfRegPage = (p) => {
        regPage = p;
        regNav = 0;
        renderOrderScreen();
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
        if (!Number.isInteger(qty)) {
            D.toast('⚠️ Qty poora number (Pcs) me daalein!');
            return D.focusField('of-cur-qty');
        }

        const foldVal = (flEl?.value || 'Box Fold').trim();
        const cancelVal = (cnEl?.value || '-').trim();
        const existing = batch.findIndex((b) =>
            b.name === name && b.fold === foldVal && b.cancel === cancelVal
        );
        if (existing >= 0) {
            batch[existing].qty = D.num(batch[existing].qty) + qty;
        } else {
            batch.push({
                name,
                qty,
                rate: D.num(rtEl?.value),
                fold: foldVal,
                cancel: cancelVal
            });
        }

        nmEl.value = '';
        qtEl.value = '';
        rtEl.value = '';
        flEl.value = document.getElementById('of-fold')?.value || 'Box Fold';
        cnEl.value = '-';

        renderBatchTable();
        if (existing >= 0) {
            D.toast(`✅ ${name} qty ${batch[existing].qty} ho gayi (merged)`);
        } else {
            D.toast(`✅ Added: ${name} (${qty} Pc) — Agla item chunein ya [Ctrl+Enter] se GST No. par jayein`);
        }
        D.focusField('of-cur-name');
    };

    D.ofDelRow = (i) => {
        batch.splice(i, 1);
        renderBatchTable();
        D.focusField('of-cur-name');
    };

    function renderChoiceScreen() {
        const orders = D.get('dukan_orders');
        const pendCnt = orders.filter((o) => o.status !== 'Complete').length;
        const compCnt = orders.filter((o) => o.status === 'Complete').length;

        const left = `
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:12px; margin-bottom:14px;">
                <strong style="font-size:15px;">Order Form Menu</strong>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">
                    Naya Order banane ya Saved Order Register dekhne ke liye option chunein
                </div>
            </div>
            <button type="button" class="dk-choice-btn ${choiceIdx === 0 ? 'active' : ''}" onclick="DukanERP.ofOpenChoice(0)">
                <span>📝 Order Form (New Batch Entry)</span>
                <span class="dk-cnt-pill">${pendCnt} Pend</span>
            </button>
            <button type="button" class="dk-choice-btn ${choiceIdx === 1 ? 'active' : ''}" onclick="DukanERP.ofOpenChoice(1)">
                <span>📋 Order Register (All Saved Orders)</span>
                <span class="dk-cnt-pill">${orders.length}</span>
            </button>
        `;

        D.renderShell(`<h2>Order Form</h2>`, left, '[↑ ↓] Option Chunein · [Enter] Kholein · [Esc] Back');
        D.renderSide('Orders Summary', `${orders.length} Saved`, [
            { label: 'Order Form', meta: 'Naya Order + A5 Print', active: choiceIdx === 0 },
            { label: 'Order Register', meta: `${orders.length} Orders Saved`, active: choiceIdx === 1 },
            { label: 'Pending Orders', meta: `${pendCnt} Baki` },
            { label: 'Complete Orders', meta: `${compCnt} Done` }
        ], false);

        D.bindFormControls({
            listNav: {
                selector: '#dk-left .dk-choice-btn',
                getIdx: () => choiceIdx,
                setIdx: (i) => { choiceIdx = i; },
                onEnter: (i) => D.ofOpenChoice(i)
            }
        });
        setTimeout(() => document.querySelectorAll('#dk-left .dk-choice-btn')[choiceIdx]?.focus(), 20);
    }

    function renderRegisterScreen() {
        const orders = D.get('dukan_orders').slice().reverse();

        const getFiltered = () => {
            const q = regSearch.trim().toLowerCase();
            if (!q) return orders;
            return orders.filter((o) => {
                const prog = D.getOrderProgress(o);
                const blob = `${prog.searchText} ${o.status || ''} ${o.firmName || ''}`.toLowerCase();
                return blob.includes(q);
            });
        };

        const showRegSide = (ord) => {
            if (!ord) return D.renderSide('Order Register', '0', [], false);
            const prog = D.getOrderProgress(ord);
            D.renderSide(`Order #${ord.no}`, `${D.fmtDate(ord.date)} · ${ord.status || 'Pending'}`, [
                { label: `Party: ${ord.partyName}`, meta: `Marka: ${ord.marka || '-'}`, active: true },
                ...prog.items.map((x) => ({
                    label: x.name,
                    meta: `Gaya ${x.sent}/${x.ordered} · Baki ${x.baki}`
                })),
                ...prog.challans.map((c) => ({
                    label: `📦 Ch #${c.no} (${D.fmtDate(c.date)})`,
                    meta: `${(c.items || []).map((ci) => `${ci.name}:${ci.qty}`).join(', ')}`
                }))
            ], false);
        };

        const drawRows = () => {
            const flt = getFiltered();
            let pg = D.paginate(flt, regPage);
            if (pg.totalPages && regPage > pg.totalPages) {
                regPage = pg.totalPages;
                pg = D.paginate(flt, regPage);
            }
            if (regNav >= pg.rows.length) regNav = Math.max(0, pg.rows.length - 1);

            const tb = document.getElementById('of-reg-tb');
            if (tb) {
                tb.innerHTML = pg.rows.length ? pg.rows.map((o, i) => {
                    const prog = D.getOrderProgress(o);
                    const isDone = o.status === 'Complete';
                    const badge = isDone
                        ? `<span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">Complete</span>`
                        : `<span style="background:#fef2f2;color:#b91c1c;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">Pending</span>`;
                    const itemsHTML = prog.items.map((x) =>
                        `<div><strong>${D.esc(x.name)}</strong>: Ord <b>${x.ordered}</b> | <span style="color:#15803d;">Gaya ${x.sent}</span> | <span style="color:#b91c1c;">Baki ${x.baki}</span></div>`
                    ).join('');
                    const chHTML = prog.challans.map((c) =>
                        `<div style="font-size:10.5px;color:#4b5563;margin-top:2px;">📦 Ch #${D.esc(c.no)} (${D.fmtDate(c.date)})</div>`
                    ).join('');

                    return `
                        <tr class="dk-nav-row ${i === regNav ? 'active' : ''}" onclick="DukanERP.ofEditFromReg('${o.id}')">
                            <td><strong>#${D.esc(o.no)}</strong><br><small>${D.fmtDate(o.date)}</small><br>${badge}</td>
                            <td><strong>${D.esc(o.partyName)}</strong><br><small>Marka: ${D.esc(o.marka || '-')} · ${D.esc(o.agent || '-')}</small></td>
                            <td>${itemsHTML}${chHTML}</td>
                            <td style="white-space:nowrap;">
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.ofEditFromReg('${o.id}')">✏️ Edit</button>
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.printSavedOrder('${o.id}')">🖨️ A5</button>
                                <button type="button" class="dk-btn-del" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.deleteOrder('${o.id}')">🗑️ Del</button>
                                ${!isDone ? `<button type="button" class="dk-btn-gold" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${D.esc(o.partyId)}','${o.id}')">Challan →</button>` : ''}
                            </td>
                        </tr>`;
                }).join('') : `<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Koi saved order nahi mila</td></tr>`;
            }

            const pgBox = document.getElementById('of-reg-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkOfRegPage');
            showRegSide(pg.rows[regNav]);
        };

        const headL = `
            <h2>Order Register (${orders.length})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.ofOpenChoice(0)">+ New Order Form</button>
            <button type="button" class="dk-btn" onclick="DukanERP.ofBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-row">
                <label>🔍 Universal Search :</label>
                <input id="of-reg-q" value="${D.esc(regSearch)}" placeholder="Order #, Party, Marka, Design, Agent, Date, Challan # ya Status..." autocomplete="off">
            </div>
            <table class="dk-tbl">
                <thead>
                    <tr>
                        <th>Order # / Status</th>
                        <th>Party / Marka</th>
                        <th>Items Hisab (Ord / Gaya / Baki)</th>
                        <th>Action (Edit / Del / Print)</th>
                    </tr>
                </thead>
                <tbody id="of-reg-tb"></tbody>
            </table>
            <div id="of-reg-pg"></div>
            <div class="dk-accept" id="dk-accept-box">
                <strong id="dk-accept-msg">Delete Order?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none';">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left, '[↑ ↓] Select · [Enter / Click] Edit & Delete kholein · [Esc] Menu');
        drawRows();

        const qEl = document.getElementById('of-reg-q');
        if (qEl) {
            qEl.addEventListener('input', () => {
                regSearch = qEl.value;
                regPage = 1;
                regNav = 0;
                drawRows();
            });
            qEl.focus();
        }

        D.bindFormControls({
            listNav: {
                selector: '#of-reg-tb .dk-nav-row',
                searchId: 'of-reg-q',
                getIdx: () => regNav,
                setIdx: (i) => { regNav = i; },
                onHighlight: (i) => showRegSide(D.paginate(getFiltered(), regPage).rows[i]),
                onEnter: (i) => {
                    const row = D.paginate(getFiltered(), regPage).rows[i];
                    if (row) D.ofEditFromReg(row.id);
                }
            }
        });
    }

    function renderForm(focusId = 'of-firm', ord = null) {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designOpts = D.getSellableDesignOptions();
        const fObj = selFirmId ? (firms.find((x) => x.id === selFirmId) || {}) : {};
        const nextNo = ord ? ord.no : getNextOrderNo();

        const headL = `
            <h2>Order Form (${ord ? `Edit #${D.esc(ord.no)}` : 'Batch Mode'})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.ofOpenChoice(1)">📋 Order Register (${orders.length})</button>
            <button type="button" class="dk-btn" onclick="DukanERP.ofBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-ord-book">
                <div class="dk-ord-hdr">
                    <div>
                        <input id="of-firm" value="${D.esc(ord ? (ord.firmName || fObj.name || '') : '')}" placeholder="Apni Firm chunein (Side List)..." style="border:none;border-bottom:1.5px dashed #991b1b;font-size:17px;font-weight:800;color:#991b1b;background:transparent;outline:none;width:290px;" autocomplete="off">
                        <div id="of-firm-info" style="font-size:10.5px;color:#7f1d1d;font-weight:700;margin-top:2px;">${ord && fObj.name ? D.esc(`GSTIN: ${fObj.gst || '-'} · ${fObj.address || ''}`) : 'Side List se Apni Firm chunein'}</div>
                    </div>
                    <div style="text-align:right;">
                        <strong style="font-size:15px;color:#991b1b;letter-spacing:0.6px;">ORDER FORM ${ord ? '(EDIT)' : ''}</strong>
                        <div id="of-firm-ph" style="font-size:10.5px;color:#7f1d1d;font-weight:700;">${ord && fObj.mob ? 'Mob: ' + D.esc(fObj.mob) : ''}</div>
                    </div>
                </div>

                <div class="dk-ord-grid">
                    <div class="dk-ord-main">
                        <div class="dk-ord-ms">
                            <strong style="color:#991b1b;font-size:13px;">M/s.</strong>
                            <input id="of-party" value="${D.esc(ord?.partyName || '')}" placeholder="Party ka naam likhein ya Side List se chunein..." autocomplete="off">
                        </div>
                        <div style="padding:5px 10px;border-bottom:1.5px solid #991b1b;display:grid;grid-template-columns:1.5fr 0.8fr;gap:8px;background:#fffafa;">
                            <div style="display:flex;align-items:center;gap:5px;font-size:11.5px;">
                                <strong style="color:#991b1b;">Add:</strong>
                                <input id="of-party-addr" value="${D.esc(ord?.partyAddress || '')}" placeholder="Party Address &amp; City" style="flex:1;border:none;border-bottom:1px dashed #fca5a5;font-size:11.5px;font-weight:600;outline:none;background:transparent;">
                            </div>
                            <div style="display:flex;align-items:center;gap:5px;font-size:11.5px;">
                                <strong style="color:#991b1b;">Mob:</strong>
                                <input id="of-party-mob" value="${D.esc(ord?.partyMob || '')}" placeholder="Mobile No." style="flex:1;border:none;border-bottom:1px dashed #fca5a5;font-size:11.5px;font-weight:600;outline:none;background:transparent;">
                            </div>
                        </div>

                        <div style="padding:7px 8px;background:#fef2f2;border-bottom:1.5px solid #991b1b;display:grid;grid-template-columns:1.8fr 0.7fr 0.7fr 0.9fr 0.9fr auto;gap:5px;align-items:end;">
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Item / Design (Finished)</label><input id="of-cur-name" placeholder="Design..." style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;" autocomplete="off"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Qnty (Pcs)</label><input id="of-cur-qty" type="number" placeholder="0" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Rate</label><input id="of-cur-rate" type="number" placeholder="0" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Fold Size</label><input id="of-cur-fold" value="${D.esc(ord?.fold || 'Box Fold')}" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <div><label style="font-size:10px;font-weight:800;color:#991b1b;">Cancel Col.</label><input id="of-cur-cancel" value="-" style="width:100%;padding:5px;border:1px solid #fca5a5;border-radius:4px;font-weight:700;background:#fff;"></div>
                            <button type="button" id="of-add-btn" class="dk-btn-gold" style="padding:6px 10px;font-size:11.5px;" onclick="DukanERP.ofAddBatchItem()">+ Add</button>
                        </div>

                        <div style="max-height:230px;overflow-y:auto;">
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
                            <strong id="of-firm-for">For: ${D.esc(ord?.firmName || fObj.name || '-')}</strong>
                        </div>
                    </div>

                    <div class="dk-ord-side">
                        <div class="dk-ord-2">
                            <div><label>No.</label><input id="of-no" value="${D.esc(nextNo)}" placeholder="Manual No."></div>
                            <div><label>Date</label><input id="of-date" type="date" value="${ord?.date || D.today()}"></div>
                        </div>
                        <div class="dk-ord-box"><label>Tin No. / GSTIN</label><input id="of-tin" value="${D.esc(ord?.gst || '')}" placeholder="TIN / GST"></div>
                        <div class="dk-ord-box"><label>Marka / Through</label><input id="of-marka" value="${D.esc(ord?.marka || '')}" placeholder="Marka"></div>
                        <div class="dk-ord-box"><label>Transport</label><input id="of-tr" value="${D.esc(ord?.transport || '')}" placeholder="Transport"></div>
                        <div class="dk-ord-box"><label>Agent Name</label><input id="of-agent" value="${D.esc(ord?.agent || '')}" placeholder="Agent Name"></div>
                        <div class="dk-ord-box"><label>Box / Paper / No Box</label><input id="of-pack" value="${D.esc(ord?.pack || 'Box')}" autocomplete="off"></div>
                        <div class="dk-ord-box"><label>Fold</label><input id="of-fold" value="${D.esc(ord?.fold || 'Box Fold')}" autocomplete="off"></div>
                        <div class="dk-ord-box" style="border-bottom:none;"><label>Remarks</label><input id="of-rem" value="${D.esc(ord?.remarks || '')}" placeholder="Enter = Save"></div>
                    </div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <div style="display:flex;gap:8px;align-items:center;">
                    ${ord ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteOrder('${ord.id}')">🗑️ Delete Order</button>` : ''}
                    <small style="color:#92400e;font-weight:700;">[Ctrl + Enter] se GST No. / Save par jayein</small>
                </div>
                <div style="display:flex;gap:8px;">
                    <button type="button" class="dk-btn" onclick="DukanERP.printOrderBook()">🖨️ Print A5 Form</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askOrderSave()">💾 ${ord ? 'Update' : 'Save'} Order [Ctrl+Enter]</button>
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong id="dk-accept-msg">${ord ? 'Update Order Form?' : 'Save Order Form?'}</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-print" onclick="DukanERP.printOrderBook()">🖨️ Print A5</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('of-rem');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left);
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

    function renderOrderScreen(focusId = 'of-firm', ord = null) {
        if (viewMode === 'choice') return renderChoiceScreen();
        if (viewMode === 'register') return renderRegisterScreen();
        return renderForm(focusId, ord);
    }

    D.askOrderSave = () => {
        const partyTxt = (document.getElementById('of-party')?.value || '').trim();
        const ordNo = (document.getElementById('of-no')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ Party Name bharein!'); return D.focusField('of-party'); }
        if (!ordNo) { D.toast('⚠️ Order No. bharein!'); return D.focusField('of-no'); }
        if (!batch.length) { D.toast('⚠️ 1 item add karein!'); return D.focusField('of-cur-name'); }
        if (isSavingOrder) { D.toast('⏳ Save chal raha hai...'); return; }

        const msgEl = document.getElementById('dk-accept-msg');
        if (msgEl) msgEl.textContent = editOrderId ? 'Update Order Form?' : 'Save Order Form?';
        const prBtn = document.getElementById('dk-accept-print');
        if (prBtn) prBtn.style.display = '';

        D.askAccept(() => D.saveOrder());
    };

    D.saveOrder = () => {
        // Guard 1: Already saving
        if (isSavingOrder) {
            D.toast('⏳ Save chal raha hai...');
            return;
        }
        // Guard 2: 1 second debounce
        const now = Date.now();
        if (now - lastOrderSaveTime < 1000) {
            D.toast('⏳ 1 second baad try karein');
            return;
        }
        // Guard 3: Validation
        const partyTxt = (document.getElementById('of-party')?.value || '').trim().toUpperCase();
        const ordNo = (document.getElementById('of-no')?.value || '').trim();
        const ordDate = document.getElementById('of-date')?.value || D.today();
        if (!partyTxt) { D.toast('⚠️ Party Name bharein!'); return D.focusField('of-party'); }
        if (!ordNo) { D.toast('⚠️ Order No. bharein!'); return D.focusField('of-no'); }
        if (!batch.length) { D.toast('⚠️ 1 item add karein!'); return D.focusField('of-cur-name'); }

        isSavingOrder = true;
        lastOrderSaveTime = now;
        try {
            const orders = D.get('dukan_orders');

            // Guard 4: Stale editOrderId — record mila toh edit, nahi toh NEW
            const prevOrd = editOrderId ? orders.find((o) => o.id === editOrderId) : null;
            const isActualEdit = !!prevOrd;
            const ordId = isActualEdit
                ? editOrderId
                : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            // Guard 5: Duplicate check (only new entry)
            if (!isActualEdit) {
                const dup = orders.find((o) =>
                    o.no === ordNo &&
                    o.partyId === (selPartyId || partyTxt) &&
                    o.date === ordDate
                );
                if (dup) {
                    D.toast(`⚠️ Order #${ordNo} already saved (${D.fmtDate(ordDate)})!`);
                    return;
                }
            }

            // Guard 6: Status preserve karo (Complete order edit pe Pending na bane)
            let finalStatus = 'Pending';
            if (isActualEdit && prevOrd) {
                const hasChallans = D.get('dukan_challans').some((c) => c.orderId === editOrderId);
                if (prevOrd.status === 'Complete' && !hasChallans) {
                    finalStatus = 'Complete';   // auto-completed order preserve
                }
            }

            const rec = {
                id: ordId,
                no: ordNo,
                date: ordDate,
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
                status: finalStatus,
                items: batch.map((r) => ({ ...r }))
            };

            if (isActualEdit) {
                const idx = orders.findIndex((o) => o.id === editOrderId);
                orders[idx] = rec;
                D.set('dukan_orders', orders);
                // Sirf tab recalc karo jab challans hon
                const hasChallans = D.get('dukan_challans').some((c) => c.orderId === ordId);
                if (hasChallans) D.recalcOrderStatus(rec.id);
                D.toast(`✅ Order #${ordNo} update ho gaya!`);
            } else {
                orders.push(rec);
                D.set('dukan_orders', orders);
                D.toast(`✅ Order #${ordNo} (${batch.length} items) save ho gaya!`);
            }

            // Reset state
            editOrderId = '';
            selFirmId = '';
            selPartyId = '';
            batch = [];
            fromExternal = false;

            if (fromRegister) {
                fromRegister = false;
                viewMode = 'register';
                renderOrderScreen();
            } else {
                viewMode = 'form';
                renderOrderScreen('of-firm', null);
            }

        } catch (e) {
            console.error('[saveOrder]', e);
            D.toast('❌ Save fail: ' + e.message);
        } finally {
            isSavingOrder = false;
        }
    };

    D.deleteOrder = (ordId) => {
        if (!ordId || isDeletingOrder) return;
        const orders = D.get('dukan_orders');
        const target = orders.find((o) => o.id === ordId);
        if (!target) { D.toast('⚠️ Already deleted!'); return; }

        const msgEl = document.getElementById('dk-accept-msg');
        if (msgEl) msgEl.textContent = `🗑️ Order #${target.no} delete karein?`;
        const prBtn = document.getElementById('dk-accept-print');
        if (prBtn) prBtn.style.display = 'none';

        D.askAccept(() => {
            isDeletingOrder = true;
            try {
                const fresh = D.get('dukan_orders');
                if (!fresh.find((o) => o.id === ordId)) return;

                D.set('dukan_orders', fresh.filter((o) => o.id !== ordId));

                if (editOrderId === ordId) editOrderId = '';
                if (fromExternal) fromExternal = false;
                batch = [];
                D.toast(`🗑️ Order #${target.no} delete ho gaya!`);

                viewMode = 'register';
                fromRegister = false;
                renderOrderScreen();
            } finally {
                isDeletingOrder = false;
            }
        });
    };

    const buildOrderA5HTML = (data) => {
        const fObj = D.get('dukan_firms').find((x) => x.id === data.firmId || x.name === data.firmName) || {};
        const totPcs = (data.items || []).reduce((a, b) => a + D.num(b.qty), 0);
        return `<html><head><style>
            @page{size:A5 portrait;margin:6mm}
            body{font-family:Inter,sans-serif;margin:0;color:#111}
            .bk{border:2px solid #991b1b}
            .hd{background:#fff5f5;border-bottom:2px solid #991b1b;padding:7px 10px;display:flex;justify-content:space-between}
            .gr{display:grid;grid-template-columns:1fr 165px}
            .mn{border-right:1.5px solid #991b1b}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #fca5a5;padding:4px;font-size:10.5px;text-align:left}
            th{background:#fef2f2;color:#991b1b}
            .sb{border-bottom:1px solid #fca5a5;padding:4px 7px;font-size:10px}
        </style></head><body>
            <div class="bk">
                <div class="hd">
                    <div><strong style="font-size:15px;color:#991b1b;">${D.esc(data.firmName || fObj.name || 'FIRM')}</strong><div style="font-size:9.5px;">GSTIN: ${D.esc(fObj.gst || '-')} · ${D.esc(fObj.address || '')}</div></div>
                    <div style="text-align:right;"><strong style="color:#991b1b;font-size:12px;">ORDER FORM</strong><div style="font-size:9.5px;">Mob: ${D.esc(fObj.mob || '-')}</div></div>
                </div>
                <div class="gr">
                    <div class="mn">
                        <div class="sb"><b>M/s.:</b> ${D.esc(data.partyName)}<br><small>${D.esc(data.partyAddress || '')} | Mob: ${D.esc(data.partyMob || '-')}</small></div>
                        <table><thead><tr><th>S.No</th><th>Particulars</th><th>Qnty</th><th>Rate</th><th>Fold</th><th>Cancel</th></tr></thead>
                        <tbody>${(data.items || []).map((r, i) => `<tr><td>${i + 1}</td><td><b>${D.esc(r.name)}</b></td><td>${r.qty}</td><td>${r.rate}</td><td>${D.esc(r.fold)}</td><td>${D.esc(r.cancel)}</td></tr>`).join('')}</tbody>
                        <tfoot><tr><th colspan="2">TOTAL (${(data.items || []).length} Items)</th><th>${totPcs} Pcs</th><th colspan="3"></th></tr></tfoot></table>
                    </div>
                    <div>
                        <div class="sb"><b>No:</b> ${D.esc(data.no)} | <b>Date:</b> ${D.esc(D.fmtDate(data.date))}</div>
                        <div class="sb"><b>TIN/GST:</b> ${D.esc(data.gst || '-')}</div>
                        <div class="sb"><b>Marka:</b> ${D.esc(data.marka || '-')}</div>
                        <div class="sb"><b>Transport:</b> ${D.esc(data.transport || '-')}</div>
                        <div class="sb"><b>Agent:</b> ${D.esc(data.agent || '-')}</div>
                        <div class="sb"><b>Pack:</b> ${D.esc(data.pack || '-')} | <b>Fold:</b> ${D.esc(data.fold || '-')}</div>
                        <div class="sb" style="border-bottom:none;"><b>Remarks:</b> ${D.esc(data.remarks || '-')}</div>
                    </div>
                </div>
            </div></body></html>`;
    };

    D.printOrderBook = () => {
        const html = buildOrderA5HTML({
            firmId: selFirmId,
            firmName: document.getElementById('of-firm')?.value,
            partyName: document.getElementById('of-party')?.value,
            partyAddress: document.getElementById('of-party-addr')?.value,
            partyMob: document.getElementById('of-party-mob')?.value,
            no: document.getElementById('of-no')?.value,
            date: document.getElementById('of-date')?.value,
            gst: document.getElementById('of-tin')?.value,
            marka: document.getElementById('of-marka')?.value,
            transport: document.getElementById('of-tr')?.value,
            agent: document.getElementById('of-agent')?.value,
            pack: document.getElementById('of-pack')?.value,
            fold: document.getElementById('of-fold')?.value,
            remarks: document.getElementById('of-rem')?.value,
            items: batch
        });
        const w = window.open('', '_blank', 'width=720,height=650');
        if (!w) { D.toast('⚠️ Popup blocked! Browser me popups allow karein.'); return; }
        w.document.write(html);
        w.document.close(); setTimeout(() => w.print(), 150);
    };

    D.printSavedOrder = (ordId) => {
        const ord = D.get('dukan_orders').find((o) => o.id === ordId);
        if (!ord) return;
        const w = window.open('', '_blank', 'width=720,height=650');
        if (!w) { D.toast('⚠️ Popup blocked! Browser me popups allow karein.'); return; }
        w.document.write(buildOrderA5HTML(ord));
        w.document.close(); setTimeout(() => w.print(), 150);
    };

    /* PENDING / COMPLETE ALL ORDERS: PARTY LIST -> ORDER LIST + EDIT/PRINT/CHALLAN */
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
                        <td style="white-space:nowrap;">
                            <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.openOrderEdit('${o.id}')">✏️ Edit</button>
                            <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.printSavedOrder('${o.id}')">🖨️</button>
                            ${repStatus === 'Pending' ? `<button type="button" class="dk-btn-gold" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadOrderInChallan('${D.esc(o.partyId)}','${o.id}')">Challan →</button>` : ''}
                        </td>
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
        D.renderShell(`<h2>${D.esc(pName)} → ${repStatus} Orders</h2><button type="button" class="dk-btn" onclick="DukanERP.repBackParties()">← Party List</button>`, left, '[Enter] Order Edit/Open · [✏️ Edit] · [🖨️] A5 Print · [Challan →]');
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
            if (o) D.openOrderEdit(o.id);
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
