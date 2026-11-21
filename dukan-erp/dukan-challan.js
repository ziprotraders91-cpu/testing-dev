/* ============================================================================
   CHALLAN & PACKING SLIP:
   - Manual Mode (Option 1: Order se auto-add nahi, Side List me Baki items)
   - Saved Challan Edit / Update / Delete (Auto Stock Restore + Order Status Recalc)
   - Exact A5 Paper Print (Challan + Packing Slip)
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let editChallanId = '';
    let selFirmId = '';
    let selPartyId = '';
    let linkedOrderId = '';
    let oldOrderId = '';
    let chBatch = [];
    let listSearch = '';
    let listPage = 1;

    D.openChallan = (chId = '') => {
        D.screen = 'challan';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        editChallanId = chId || '';

        if (editChallanId) {
            const rec = D.get('dukan_challans').find((c) => c.id === editChallanId);
            if (rec) {
                selFirmId = rec.firmId || '';
                selPartyId = rec.partyId || '';
                linkedOrderId = rec.orderId || '';
                oldOrderId = rec.orderId || '';
                chBatch = (rec.items || []).map((x) => ({ ...x }));
                render('ch-cur-name', rec);
                return;
            }
            editChallanId = '';
        }

        selFirmId = '';
        selPartyId = '';
        linkedOrderId = '';
        oldOrderId = '';
        chBatch = [];
        render('ch-firm', null);
    };

    D.loadChallan = (chId) => D.openChallan(chId);

    // Manual Mode (Option 1): Order se auto-add nahi hoga, bagal me Order ke Baki items dikhenge
    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        editChallanId = '';
        oldOrderId = '';
        selPartyId = partyId || '';
        linkedOrderId = orderId || '';
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        selFirmId = ord?.firmId || '';
        chBatch = [];
        render(selFirmId ? 'ch-no' : 'ch-firm', null);
        if (ord) {
            D.toast(`📋 Order #${ord.no} link hua — Bagal ki list se Baki items manually add karein`);
        }
    };

    window.dkChPage = (p) => {
        listPage = p;
        renderSavedChallans();
    };

    function getOrderPendingItems(ord) {
        if (!ord) return [];
        const prog = D.getOrderProgress(ord);
        return prog.items
            .filter((x) => x.baki > 0)
            .map((x) => ({
                name: String(x.name || '').trim().toUpperCase(),
                ordered: x.ordered,
                sent: x.sent,
                baki: x.baki,
                rate: D.num(x.rate),
                finishedQty: D.getDesignFinishedStock(x.name)
            }));
    }

    function showOrderPendingSide(ord) {
        if (!ord) {
            D.renderSide('Challan Batch', `${chBatch.length} Items`, chBatch.map((x) => ({
                label: x.name, meta: `${x.qty} Pc · ₹${D.num(x.rate)}`
            })), false);
            return;
        }
        const bakiItems = getOrderPendingItems(ord);
        const list = bakiItems.length
            ? bakiItems.map((x) => ({
                label: `${x.name} (Baki: ${x.baki} Pc)`,
                meta: `Ord ${x.ordered} · Fin ${x.finishedQty} Pc`
            }))
            : [{ label: `Order #${ord.no} ke sab items complete hain`, meta: '0 Baki' }];

        D.renderSide(`Order #${ord.no} — Baki Items`, `Marka: ${ord.marka || '-'}`, list, false);
    }

    function renderChBatchTable() {
        const tb = document.getElementById('ch-items-tb');
        const totEl = document.getElementById('ch-batch-tot');
        if (!tb) return;
        const totPcs = chBatch.reduce((a, b) => a + D.num(b.qty), 0);
        const totAmt = chBatch.reduce((a, b) => a + D.num(b.qty) * D.num(b.rate), 0);
        if (totEl) totEl.textContent = `Total: ${chBatch.length} Designs · ${totPcs} Pcs · ₹ ${totAmt.toLocaleString('en-IN')}`;

        tb.innerHTML = chBatch.length ? chBatch.map((it, i) => {
            const finAvail = D.getDesignFinishedStock(it.name);
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${D.esc(it.name)}</strong></td>
                <td style="color:#15803d;font-weight:700;">${finAvail} Pc</td>
                <td style="width:72px;"><input type="number" value="${D.num(it.qty)}" min="1" onchange="DukanERP.chUpdRow(${i},'qty',this.value)"></td>
                <td style="width:78px;"><input type="number" value="${D.num(it.rate)}" min="0" onchange="DukanERP.chUpdRow(${i},'rate',this.value)"></td>
                <td>₹ ${(D.num(it.qty) * D.num(it.rate)).toLocaleString('en-IN')}</td>
                <td style="text-align:center;"><button type="button" class="dk-btn" style="padding:2px 6px;color:#dc2626;" onclick="DukanERP.chDelRow(${i})">✕</button></td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;">Manual Mode: Item chunein → Qty → Rate → +Add (Enter)</td></tr>`;
    }

    D.chUpdRow = (i, field, val) => {
        if (!chBatch[i]) return;
        const n = D.num(val);
        if (field === 'qty' && n <= 0) {
            D.toast('⚠️ Qty 0 se zyada rakhein (ya ✕ se hatayein)');
            renderChBatchTable();
            return;
        }
        chBatch[i][field] = n;
        renderChBatchTable();
    };

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
        if (avEl) avEl.textContent = '(Finished: -)';

        renderChBatchTable();
        D.toast(`✅ Added: ${name} (${qty} Pc) — Agla item chunein ya [Ctrl+Enter] se Save karein`);
        D.focusField('ch-cur-name');
    };

    D.chDelRow = (i) => {
        chBatch.splice(i, 1);
        renderChBatchTable();
        D.focusField('ch-cur-name');
    };

    function renderSavedChallans() {
        const tb = document.getElementById('ch-saved-tb');
        const pgBox = document.getElementById('ch-saved-pg');
        if (!tb) return;

        const all = D.get('dukan_challans').slice().reverse();
        const orders = D.get('dukan_orders');
        const q = listSearch.trim().toLowerCase();
        const filtered = all.filter((c) => {
            if (!q) return true;
            const itemTxt = (c.items || []).map((i) => `${i.name} ${i.qty}`).join(' ');
            const blob = `${c.no} ${c.date} ${D.fmtDate(c.date)} ${c.partyName} ${c.marka} ${c.firmName} ${itemTxt}`.toLowerCase();
            return blob.includes(q);
        });

        const pg = D.paginate(filtered, listPage);
        tb.innerHTML = pg.rows.length ? pg.rows.map((c) => {
            const ord = c.orderId ? orders.find((o) => o.id === c.orderId) : null;
            const totPcs = (c.items || []).reduce((a, b) => a + D.num(b.qty), 0);
            const itemsSummary = (c.items || []).map((i) => `${D.esc(i.name)}:${i.qty}`).join(', ');
            return `
                <tr class="dk-nav-row ${c.id === editChallanId ? 'active' : ''}" onclick="DukanERP.loadChallan('${c.id}')">
                    <td><strong>#${D.esc(c.no)}</strong><br><small>${D.fmtDate(c.date)}</small></td>
                    <td><strong>${D.esc(c.partyName)}</strong><br><small>Marka: ${D.esc(c.marka || '-')}</small></td>
                    <td><strong>${totPcs} Pc</strong><br><small>${itemsSummary}</small></td>
                    <td>${ord ? `#${D.esc(ord.no)}` : '-'}</td>
                    <td style="white-space:nowrap;">
                        <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.loadChallan('${c.id}')">✏️ Edit</button>
                        <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.printSavedChallan('${c.id}')">🖨️ A5</button>
                        <button type="button" class="dk-btn-del" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.deleteChallan('${c.id}')">🗑️</button>
                    </td>
                </tr>`;
        }).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi saved challan nahi mila</td></tr>`;

        if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkChPage');
    }

    function render(focusId = 'ch-firm', rec = null) {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const designOpts = D.getSellableDesignOptions();

        const fObj = selFirmId ? (firms.find((x) => x.id === selFirmId) || {}) : {};
        const p = selPartyId ? (parties.find((x) => x.id === selPartyId) || {}) : {};
        const ordObj = linkedOrderId ? orders.find((o) => o.id === linkedOrderId) : null;

        const firmVal = rec ? (rec.firmName || fObj.name || '') : (fObj.name || '');
        const firmMeta = fObj.name
            ? `${fObj.address || ''} · Mob: ${fObj.mob || '-'} · GST: ${fObj.gst || '-'}`
            : '';
        const partyVal = rec ? (rec.partyName || p.name || '') : (p.name || '');
        const addrVal = rec ? (rec.address || '') : [p.address, p.city].filter(Boolean).join(', ');
        const mobVal = rec ? (rec.mob || '') : (p.mob || '');
        const gstVal = rec ? (rec.gst || '') : (p.gst || '');
        const chNoVal = rec ? (rec.no || '') : '';
        const chDateVal = rec ? (rec.date || D.today()) : D.today();
        const markaVal = rec ? (rec.marka || '') : (ordObj ? (ordObj.marka || p.marka || '') : (p.marka || ''));

        const headL = `
            <h2>Challan &amp; Packing Slip (${rec ? `Edit #${D.esc(rec.no)}` : 'Manual Mode'})</h2>
            ${rec ? `<button type="button" class="dk-tab active" onclick="DukanERP.openChallan('')">+ New Challan</button>` : ''}
        `;

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="ch-firm" value="${D.esc(firmVal)}" placeholder="Side List se Apni Firm chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Firm Info :</label><input id="ch-firm-meta" value="${D.esc(firmMeta)}" placeholder="Firm select karne par khud bharega" readonly style="background:#f9fafb;"></div>
            <div class="dk-sec">Party &amp; Order Details</div>
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(partyVal)}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Order # (Baki List) :</label><input id="ch-ord" value="${D.esc(ordObj ? `#${ordObj.no}` : '')}" placeholder="Side List se Pending Order chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Address / City :</label><input id="ch-addr" value="${D.esc(addrVal)}"></div>
            <div class="dk-row"><label>Mobile / GST :</label><div style="display:flex;gap:8px;"><input id="ch-mob" value="${D.esc(mobVal)}" placeholder="Mobile"><input id="ch-gst" value="${D.esc(gstVal)}" placeholder="GSTIN"></div></div>
            <div class="dk-row"><label>Challan No / Date :</label><div style="display:flex;gap:8px;"><input id="ch-no" value="${D.esc(chNoVal)}" placeholder="Manual Challan No." autocomplete="off"><input id="ch-date" type="date" value="${D.esc(chDateVal)}"><input id="ch-marka" value="${D.esc(markaVal)}" placeholder="Marka"></div></div>

            <div class="dk-sec">Manual Batch Entry (Bagal me Order ke Baki Items · Save par Finished Stock update hoga)</div>
            <div style="padding:8px;background:#fdf6e2;border:1.5px solid #e5d5a7;border-radius:6px;display:grid;grid-template-columns:1.8fr 0.8fr 0.8fr auto;gap:6px;align-items:end;margin-bottom:8px;">
                <div>
                    <label style="font-size:10.5px;font-weight:800;color:#92400e;">Item / Design <small id="ch-cur-av" style="color:#15803d;">(Finished: -)</small></label>
                    <input id="ch-cur-name" placeholder="Baki item ya Design chunein..." style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;" autocomplete="off">
                </div>
                <div><label style="font-size:10.5px;font-weight:800;color:#92400e;">Challan Pcs</label><input id="ch-cur-qty" type="number" placeholder="0" style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;"></div>
                <div><label style="font-size:10.5px;font-weight:800;color:#92400e;">Rate (₹)</label><input id="ch-cur-rate" type="number" placeholder="0" style="width:100%;padding:6px;border:1px solid #d9b86c;border-radius:4px;font-weight:700;background:#fff;"></div>
                <button type="button" id="ch-add-btn" class="dk-btn-gold" style="padding:7px 12px;" onclick="DukanERP.chAddBatchItem()">+ Add</button>
            </div>

            <div style="max-height:200px;overflow-y:auto;">
                <table class="dk-tbl">
                    <thead><tr><th>#</th><th>Design</th><th>Finished Avail</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Del</th></tr></thead>
                    <tbody id="ch-items-tb"></tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:8px;">
                <strong id="ch-batch-tot" style="color:#92400e;font-size:12.5px;">Total: 0 Designs · 0 Pcs</strong>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${rec ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteChallan('${rec.id}')">🗑️ Delete Challan</button>` : ''}
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print A5 Challan &amp; Slip</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askChallanSave()">💾 ${rec ? 'Update' : 'Save'} [Ctrl+Enter]</button>
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>${rec ? 'Update Challan (Purana Stock Restore hoke Naya Minus hoga)?' : 'Save Challan &amp; Minus Finished Stock?'}</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveChallan()">Yes (Y)</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print A5</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('ch-cur-name');">No (N)</button>
                </div>
            </div>

            <div class="dk-sec">Saved Challans Register (Click karke Edit / Delete / A5 Print karein)</div>
            <div class="dk-row"><label>🔍 Search Challan :</label><input id="ch-list-q" value="${D.esc(listSearch)}" placeholder="Challan #, Party, Marka, Design ya Date..." autocomplete="off"></div>
            <table class="dk-tbl">
                <thead><tr><th>Challan # / Date</th><th>Party / Marka</th><th>Items &amp; Total</th><th>Order #</th><th>Action</th></tr></thead>
                <tbody id="ch-saved-tb"></tbody>
            </table>
            <div id="ch-saved-pg"></div>
        `;

        D.renderShell(headL, left, 'Manual Mode · Click karke koi bhi Saved Challan Edit, Delete (Stock Restore) ya A5 Print karein');
        renderChBatchTable();
        renderSavedChallans();

        const lqEl = document.getElementById('ch-list-q');
        if (lqEl) {
            lqEl.addEventListener('input', () => {
                listSearch = lqEl.value;
                listPage = 1;
                renderSavedChallans();
            });
        }

        D.bindFormControls({
            focusOrder: ['ch-firm', 'ch-party', 'ch-ord', 'ch-addr', 'ch-mob', 'ch-gst', 'ch-no', 'ch-date', 'ch-marka', 'ch-cur-name', 'ch-cur-qty', 'ch-cur-rate', 'ch-add-btn'],
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
                    onPick: (it) => {
                        selPartyId = it.id;
                        linkedOrderId = '';
                        if (!editChallanId) chBatch = [];
                        render('ch-ord', rec);
                    }
                },
                'ch-ord': {
                    title: `${p.name || 'Party'} — Pending Orders`,
                    noAutoHighlight: true,
                    getItems: (q) => orders
                        .filter((o) => (!selPartyId || o.partyId === selPartyId || o.partyName === partyVal) && (o.status !== 'Complete' || o.id === linkedOrderId) && (!q || `${o.no} ${o.marka}`.toLowerCase().includes(q.toLowerCase())))
                        .map((o) => {
                            const prog = D.getOrderProgress(o);
                            const bakiTxt = prog.items.filter((x) => x.baki > 0).map((x) => `${x.name}:${x.baki}`).join(', ');
                            return { id: o.id, pid: o.partyId, label: `Order #${o.no}`, meta: `Baki: ${bakiTxt || '0'}`, ord: o };
                        }),
                    onPick: (it) => {
                        if (editChallanId) {
                            linkedOrderId = it.id;
                            document.getElementById('ch-ord').value = `#${it.ord.no}`;
                            if (!document.getElementById('ch-marka').value.trim()) {
                                document.getElementById('ch-marka').value = it.ord.marka || '';
                            }
                            showOrderPendingSide(it.ord);
                            D.focusField('ch-no');
                        } else {
                            D.loadOrderInChallan(it.pid, it.id);
                        }
                    },
                    onEmptyEnter: () => D.focusField('ch-no')
                },
                'ch-cur-name': {
                    title: ordObj ? `Order #${ordObj.no} Baki Items + Designs` : `Finished Designs (${designOpts.length})`,
                    noAutoHighlight: true,
                    getItems: (q) => {
                        const ql = q.toLowerCase();
                        const items = [];
                        if (ordObj) {
                            const bakiList = getOrderPendingItems(ordObj);
                            bakiList
                                .filter((x) => !ql || x.name.toLowerCase().includes(ql))
                                .forEach((x) => {
                                    items.push({
                                        label: `${x.name} [Baki: ${x.baki}]`,
                                        meta: `Ord ${x.ordered} · Fin ${x.finishedQty} Pc`,
                                        design: x.name,
                                        qty: x.finishedQty,
                                        baki: x.baki,
                                        rate: x.rate
                                    });
                                });
                        }
                        const usedInOrd = new Set(items.map((x) => x.design));
                        designOpts
                            .filter((d) => !usedInOrd.has(d.design) && (!ql || `${d.design} ${d.kariger}`.toLowerCase().includes(ql)))
                            .slice(0, 60)
                            .forEach((d) => {
                                items.push({
                                    label: d.design,
                                    meta: `${d.finishedQty} Pc Fin${d.kariger ? ` · ${d.kariger}` : ''}`,
                                    design: d.design,
                                    qty: d.finishedQty,
                                    baki: 0,
                                    rate: 0
                                });
                            });
                        return items.slice(0, 70);
                    },
                    onPick: (it) => {
                        document.getElementById('ch-cur-name').value = it.design;
                        const rtEl = document.getElementById('ch-cur-rate');
                        if (rtEl && it.rate > 0) rtEl.value = it.rate;
                        const qtEl = document.getElementById('ch-cur-qty');
                        if (qtEl && it.baki > 0) qtEl.value = it.baki;
                        const av = document.getElementById('ch-cur-av');
                        if (av) av.textContent = `(Finished: ${it.qty} Pc${it.baki > 0 ? ` · Ord Baki: ${it.baki}` : ''})`;
                        D.focusField('ch-cur-qty');
                    },
                    onEmptyEnter: () => D.askChallanSave()
                }
            },
            defaultSide: () => showOrderPendingSide(ordObj),
            onFinishForm: () => D.askChallanSave()
        });

        showOrderPendingSide(ordObj);
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

        const parties = D.get('dukan_parties');
        const p = parties.find((x) => x.id === selPartyId || String(x.name || '').toUpperCase() === partyTxt) || {};
        const challans = D.get('dukan_challans');
        const prevRec = editChallanId ? challans.find((c) => c.id === editChallanId) : null;
        const chId = editChallanId || `ch_${Date.now()}`;

        // Edit/Update par purani Finished Stock deduction pehle restore karein
        if (editChallanId) {
            D.restoreFinishedStockByRef(editChallanId);
        }

        const rec = {
            id: chId,
            no: chNo,
            date: document.getElementById('ch-date')?.value || D.today(),
            firmId: selFirmId,
            firmName: (document.getElementById('ch-firm')?.value || '').trim().toUpperCase(),
            partyId: selPartyId || p.id || partyTxt,
            partyName: partyTxt,
            city: p.city || prevRec?.city || '',
            address: document.getElementById('ch-addr')?.value || '',
            mob: document.getElementById('ch-mob')?.value || '',
            gst: document.getElementById('ch-gst')?.value || '',
            marka: document.getElementById('ch-marka')?.value || '',
            orderId: linkedOrderId,
            items: chBatch.map((r) => ({ ...r }))
        };

        if (editChallanId) {
            const idx = challans.findIndex((c) => c.id === editChallanId);
            if (idx >= 0) challans[idx] = rec;
            else challans.push(rec);
        } else {
            challans.push(rec);
        }
        D.set('dukan_challans', challans);

        rec.items.forEach((it) => {
            D.deductFinishedStock(it.name, D.num(it.qty), {
                date: rec.date,
                partyName: rec.partyName,
                chNo: rec.no,
                marka: rec.marka,
                refId: chId
            });
        });

        if (oldOrderId && oldOrderId !== linkedOrderId) {
            D.recalcOrderStatus(oldOrderId);
        }
        if (linkedOrderId) {
            D.recalcOrderStatus(linkedOrderId);
        }

        D.toast(editChallanId
            ? `✅ Challan #${rec.no} update hua (Stock adjust + Order status update)!`
            : `✅ Challan #${rec.no} save hua aur Finished Stock se minus ho gaya!`);
        D.openChallan('');
    };

    D.deleteChallan = (chId) => {
        if (!chId) return;
        const challans = D.get('dukan_challans');
        const target = challans.find((c) => c.id === chId);
        if (!target) return;
        if (!confirm(`Kya aap Challan #${target.no} delete karna chahte hain? Iska Finished Stock wapas restore ho jayega.`)) return;

        D.restoreFinishedStockByRef(chId);
        D.set('dukan_challans', challans.filter((c) => c.id !== chId));
        if (target.orderId) D.recalcOrderStatus(target.orderId);

        D.toast(`🗑️ Challan #${target.no} delete hua aur Finished Stock restore ho gaya!`);
        D.openChallan('');
    };

    function buildChallanA5HTML(data) {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) => x.id === data.firmId || x.name === data.firmName) || firms[0] || {};
        const parties = D.get('dukan_parties');
        const pObj = parties.find((x) => x.id === data.partyId || x.name === data.partyName) || {};

        const firmName = data.firmName || fObj.name || 'FIRM';
        const toCity = data.city || pObj.city || 'DESTINATION';
        const items = data.items || [];
        const totPcs = items.reduce((a, b) => a + D.num(b.qty), 0);
        const totAmt = items.reduce((a, b) => a + D.num(b.qty) * D.num(b.rate), 0);

        return `<html><head><style>
            @page{size:A5 portrait;margin:6mm}
            body{font-family:Inter,sans-serif;margin:0;color:#111}
            .box{border:2px solid #111;padding:10px;box-sizing:border-box}
            .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:6px;gap:8px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            th,td{border:1px solid #333;padding:4px 5px;font-size:10.5px;text-align:left}
            th{background:#f3f4f6}
            .page-break{page-break-before:always}
        </style></head><body>
            <div class="box">
                <div class="hd">
                    <div>
                        <strong style="font-size:15px;">${D.esc(firmName)}</strong>
                        <div style="font-size:9.5px;">${D.esc(fObj.address || '')}${fObj.mob ? ` · Mob: ${D.esc(fObj.mob)}` : ''}${fObj.gst ? ` · GSTIN: ${D.esc(fObj.gst)}` : ''}</div>
                    </div>
                    <div style="text-align:right;white-space:nowrap;">
                        <strong style="font-size:12px;">DELIVERY CHALLAN</strong>
                        <div style="font-size:10px;">No: <b>${D.esc(data.no || '-')}</b><br>Date: ${D.esc(D.fmtDate(data.date || D.today()))}</div>
                    </div>
                </div>
                <div style="margin:6px 0;font-size:10.5px;line-height:1.4;">
                    <div><b>M/s.:</b> ${D.esc(data.partyName || '-')} | <b>Mob:</b> ${D.esc(data.mob || '-')} | <b>GST:</b> ${D.esc(data.gst || '-')}</div>
                    <div><b>Address:</b> ${D.esc(data.address || '-')} | <b>Marka:</b> ${D.esc(data.marka || '-')}</div>
                </div>
                <table>
                    <thead><tr><th style="width:28px;">#</th><th>Design / Particulars</th><th style="width:55px;">Qty</th><th style="width:55px;">Rate</th><th style="width:68px;">Amount</th></tr></thead>
                    <tbody>${items.map((i, idx) => `<tr><td>${idx + 1}</td><td><b>${D.esc(i.name)}</b></td><td><b>${i.qty}</b></td><td>${D.num(i.rate) || '-'}</td><td>${D.num(i.rate) ? (D.num(i.qty) * D.num(i.rate)).toLocaleString('en-IN') : '-'}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="2">TOTAL (${items.length} Items)</th><th>${totPcs} Pcs</th><th></th><th>${totAmt ? '₹ ' + totAmt.toLocaleString('en-IN') : ''}</th></tr></tfoot>
                </table>
                <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:10px;">
                    <span>Receiver's Sign</span>
                    <span><b>For ${D.esc(firmName)}</b></span>
                </div>
            </div>

            <div class="box page-break">
                <div class="hd">
                    <div>
                        <small style="font-weight:700;">PACKING SLIP</small>
                        <div style="font-size:17px;font-weight:800;">TO: ${D.esc(toCity)}</div>
                    </div>
                    <div style="text-align:right;font-size:10.5px;">
                        <div>Challan: <b>${D.esc(data.no || '-')}</b></div>
                        <div>Marka: <b>${D.esc(data.marka || '-')}</b></div>
                        <div>Date: ${D.esc(D.fmtDate(data.date || D.today()))}</div>
                    </div>
                </div>
                <div style="margin:6px 0;font-size:10.5px;line-height:1.4;">
                    <div><b>PARTY:</b> ${D.esc(data.partyName || '-')}</div>
                    <div><b>FROM:</b> ${D.esc(firmName)} ${fObj.address ? `(${D.esc(fObj.address)})` : ''}</div>
                </div>
                <table>
                    <thead><tr><th style="width:32px;">#</th><th>Item / Design</th><th style="width:70px;">Pcs</th></tr></thead>
                    <tbody>${items.map((i, idx) => `<tr><td>${idx + 1}</td><td><b>${D.esc(i.name)}</b></td><td><b>${i.qty}</b></td></tr>`).join('')}</tbody>
                    <tfoot><tr><th colspan="2">TOTAL PCS</th><th>${totPcs} Pcs</th></tr></tfoot>
                </table>
            </div>
        </body></html>`;
    }

    D.printChallanAndSlip = () => {
        const parties = D.get('dukan_parties');
        const p = parties.find((x) => x.id === selPartyId) || {};
        const prevRec = editChallanId ? D.get('dukan_challans').find((c) => c.id === editChallanId) : null;
        const html = buildChallanA5HTML({
            firmId: selFirmId,
            firmName: document.getElementById('ch-firm')?.value || '',
            partyId: selPartyId,
            partyName: document.getElementById('ch-party')?.value || '',
            city: p.city || prevRec?.city || '',
            address: document.getElementById('ch-addr')?.value || '',
            mob: document.getElementById('ch-mob')?.value || '',
            gst: document.getElementById('ch-gst')?.value || '',
            no: document.getElementById('ch-no')?.value || '-',
            date: document.getElementById('ch-date')?.value || D.today(),
            marka: document.getElementById('ch-marka')?.value || '-',
            items: chBatch
        });
        const w = window.open('', '_blank', 'width=720,height=650');
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 150);
    };

    D.printSavedChallan = (chId) => {
        const rec = D.get('dukan_challans').find((c) => c.id === chId);
        if (!rec) return;
        const w = window.open('', '_blank', 'width=720,height=650');
        w.document.write(buildChallanA5HTML(rec));
        w.document.close();
        setTimeout(() => w.print(), 150);
    };
})();
