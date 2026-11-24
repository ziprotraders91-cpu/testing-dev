/* ============================================================================
   CHALLAN & PACKING SLIP:
   - 2-Button Menu: [Challan & Packing Slip] & [Challan Register]
   - Manual Mode (Option 1: Order se auto-add nahi, Side List me Baki items)
   - Dedicated Challan Register with Universal Search + Edit / Delete / A5 Print
   - Edit / Delete par Finished Stock auto-restore + Order Status auto-update
   File: dukan-erp/dukan-challan.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let viewMode = 'choice'; // 'choice' | 'form' | 'register'
    let choiceIdx = 0;
    let editChallanId = '';
    let fromRegister = false;
    let selFirmId = '';
    let selPartyId = '';
    let linkedOrderId = '';
    let oldOrderId = '';
    let chBatch = [];
    let regSearch = '';
    let regPage = 1;
    let regNav = 0;
    let isSavingChallan = false;
    let lastSaveTime = 0;
    let isDeletingChallan = false;

    function bindEscHandler() {
        D.onEsc = () => {
            if (viewMode === 'form') {
                viewMode = fromRegister ? 'register' : 'choice';
                editChallanId = '';
                fromRegister = false;
                render();
            } else if (viewMode === 'register') {
                viewMode = 'choice';
                render();
            } else {
                window.openDukanGateway();
            }
        };
    }

    D.openChallan = (chId = '', opts = {}) => {
        D.screen = 'challan';
        D.onCustomFieldEnter = null;
        bindEscHandler();

        if (chId) {
            const rec = D.get('dukan_challans').find((c) => c.id === chId);
            if (rec) {
                viewMode = 'form';
                fromRegister = !!opts.fromReg;
                editChallanId = rec.id;
                selFirmId = rec.firmId || '';
                selPartyId = rec.partyId || '';
                linkedOrderId = rec.orderId || '';
                oldOrderId = rec.orderId || '';
                chBatch = (rec.items || []).map((x) => ({ ...x }));
                render('ch-cur-name', rec);
                return;
            }
        }

        viewMode = 'choice';
        choiceIdx = 0;
        editChallanId = '';
        fromRegister = false;
        selFirmId = '';
        selPartyId = '';
        linkedOrderId = '';
        oldOrderId = '';
        chBatch = [];
        regSearch = '';
        regPage = 1;
        regNav = 0;
        render();
    };

    D.loadChallan = (chId) => {
        D.openChallan(chId, { fromReg: false });
    };

    D.chEditFromReg = (chId) => {
        D.openChallan(chId, { fromReg: true });
    };

    // Manual Mode (Option 1): Order se auto-add nahi hoga, bagal me Order ke Baki items dikhenge
    D.loadOrderInChallan = (partyId, orderId) => {
        D.screen = 'challan';
        D.onCustomFieldEnter = null;
        bindEscHandler();
        viewMode = 'form';
        fromRegister = false;
        editChallanId = '';
        oldOrderId = '';
        const ord = D.get('dukan_orders').find((o) => o.id === orderId);
        selPartyId = partyId || ord?.partyId || '';
        linkedOrderId = orderId || '';
        selFirmId = ord?.firmId || '';
        chBatch = [];
        render(selFirmId ? 'ch-no' : 'ch-firm', null);
        if (ord) {
            D.toast(`📋 Order #${ord.no} link hua — Bagal ki list se Baki items manually add karein`);
        }
    };

    D.chOpenChoice = (idx) => {
        choiceIdx = idx;
        editChallanId = '';
        fromRegister = false;
        if (idx === 0) {
            viewMode = 'form';
            selFirmId = '';
            selPartyId = '';
            linkedOrderId = '';
            oldOrderId = '';
            chBatch = [];
            render('ch-firm', null);
        } else {
            viewMode = 'register';
            regPage = 1;
            regNav = 0;
            render();
        }
    };

    D.chBackToChoice = () => {
        viewMode = 'choice';
        editChallanId = '';
        fromRegister = false;
        render();
    };

    window.dkChRegPage = (p) => {
        regPage = p;
        regNav = 0;
        render();
    };

    function getEffectiveFinishedStock(designName) {
        const norm = String(designName || '').trim().toUpperCase();
        const currentAvail = D.getDesignFinishedStock(norm);
        if (!editChallanId) return currentAvail;
        const prevRec = D.get('dukan_challans').find((c) => c.id === editChallanId);
        if (!prevRec) return currentAvail;
        const prevQty = (prevRec.items || [])
            .filter((it) => String(it.name || '').trim().toUpperCase() === norm)
            .reduce((sum, it) => sum + D.num(it.qty), 0);
        return currentAvail + prevQty;
    }

    function getOrderItemBakiForChallan(ord, itemName, excludeChallanId = null) {
        if (!ord) return Infinity;
        const targetName = String(itemName || '').trim().toUpperCase();
        const matchingItems = (ord.items || []).filter((it) =>
            String(it.name || '').trim().toUpperCase() === targetName
        );
        if (!matchingItems.length) return 0;
        const ordered = matchingItems.reduce((sum, it) => sum + D.num(it.qty), 0);
        const challans = D.get('dukan_challans').filter((c) =>
            c.orderId === ord.id && c.id !== excludeChallanId
        );
        let sent = 0;
        challans.forEach((c) => {
            (c.items || []).forEach((it) => {
                if (String(it.name || '').trim().toUpperCase() === targetName) {
                    sent += D.num(it.qty);
                }
            });
        });
        return Math.max(0, ordered - sent);
    }

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

    function updateBatchTotals() {
        const totEl = document.getElementById('ch-batch-tot');
        const totPcs = chBatch.reduce((a, b) => a + D.num(b.qty), 0);
        const totAmt = chBatch.reduce((a, b) => a + D.num(b.qty) * D.num(b.rate), 0);
        if (totEl) totEl.textContent = `Total: ${chBatch.length} Designs · ${totPcs} Pcs · ₹ ${totAmt.toLocaleString('en-IN')}`;
    }

    function renderChBatchTable() {
        const tb = document.getElementById('ch-items-tb');
        if (!tb) return;
        updateBatchTotals();

        tb.innerHTML = chBatch.length ? chBatch.map((it, i) => {
            const finAvail = D.getDesignFinishedStock(it.name);
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${D.esc(it.name)}</strong></td>
                <td style="color:#15803d;font-weight:700;">${finAvail} Pc</td>
                <td style="width:72px;"><input type="number" value="${D.num(it.qty)}" min="1" oninput="DukanERP.chLiveRow(${i},'qty',this.value)" onchange="DukanERP.chUpdRow(${i},'qty',this.value)"></td>
                <td style="width:78px;"><input type="number" value="${D.num(it.rate)}" min="0" oninput="DukanERP.chLiveRow(${i},'rate',this.value)" onchange="DukanERP.chUpdRow(${i},'rate',this.value)"></td>
                <td id="ch-row-amt-${i}">₹ ${(D.num(it.qty) * D.num(it.rate)).toLocaleString('en-IN')}</td>
                <td style="text-align:center;"><button type="button" class="dk-btn" style="padding:2px 6px;color:#dc2626;" onclick="DukanERP.chDelRow(${i})">✕</button></td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;">Manual Mode: Item chunein → Qty → Rate → +Add (Enter)</td></tr>`;
    }

    D.chLiveRow = (i, field, val) => {
        if (!chBatch[i]) return;
        const n = D.num(val);
        if (field === 'qty') {
            const normName = String(chBatch[i].name || '').trim().toUpperCase();
            const otherQty = chBatch
                .filter((b, idx) => idx !== i && String(b.name || '').trim().toUpperCase() === normName)
                .reduce((a, b) => a + D.num(b.qty), 0);
            const finAvail = getEffectiveFinishedStock(normName);
            if (n <= 0 || n + otherQty > finAvail) return;
            if (linkedOrderId) {
                const ord = D.get('dukan_orders').find((o) => o.id === linkedOrderId);
                const itemBaki = getOrderItemBakiForChallan(ord, normName, editChallanId);
                if (n + otherQty > itemBaki) return;
            }
            chBatch[i].qty = n;
        } else {
            chBatch[i][field] = Math.max(0, n);
        }
        const amtEl = document.getElementById(`ch-row-amt-${i}`);
        if (amtEl) amtEl.textContent = `₹ ${(D.num(chBatch[i].qty) * D.num(chBatch[i].rate)).toLocaleString('en-IN')}`;
        updateBatchTotals();
    };

    D.chUpdRow = (i, field, val) => {
        if (!chBatch[i]) return;
        const n = D.num(val);
        if (field === 'qty') {
            if (n <= 0) {
                D.toast('⚠️ Qty 0 se zyada rakhein');
                renderChBatchTable();
                return;
            }
            const itemName = String(chBatch[i].name || '').trim().toUpperCase();
            const otherInBatch = chBatch
                .filter((b, idx) => idx !== i && String(b.name || '').trim().toUpperCase() === itemName)
                .reduce((a, b) => a + D.num(b.qty), 0);
            const finAvail = getEffectiveFinishedStock(itemName);
            if (n + otherInBatch > finAvail) {
                D.toast(`⚠️ Sirf ${finAvail} Pc available!`);
                renderChBatchTable();
                return;
            }
            if (linkedOrderId) {
                const ord = D.get('dukan_orders').find((o) => o.id === linkedOrderId);
                const itemBaki = getOrderItemBakiForChallan(ord, itemName, editChallanId);
                if (n + otherInBatch > itemBaki) {
                    D.toast(`⚠️ Order me sirf ${itemBaki} Pc baki hai!`);
                    renderChBatchTable();
                    return;
                }
            }
        }
        chBatch[i][field] = field === 'rate' ? Math.max(0, n) : n;
        renderChBatchTable();
    };

    D.chAddBatchItem = () => {
        const nmEl = document.getElementById('ch-cur-name');
        const qtEl = document.getElementById('ch-cur-qty');
        const rtEl = document.getElementById('ch-cur-rate');
        const name = (nmEl?.value || '').trim().toUpperCase();
        const qty = D.num(qtEl?.value);
        const rate = Math.max(0, D.num(rtEl?.value));
        if (!name) { D.toast('⚠️ Item / Design chunein!'); return D.focusField('ch-cur-name'); }
        if (qty <= 0) { D.toast('⚠️ Challan Qty (Pcs) bharein!'); return D.focusField('ch-cur-qty'); }

        const finAvail = getEffectiveFinishedStock(name);
        const alreadyInBatch = chBatch
            .filter((b) => String(b.name || '').trim().toUpperCase() === name)
            .reduce((a, b) => a + D.num(b.qty), 0);
        if (qty + alreadyInBatch > finAvail) {
            D.toast(`⚠️ Sirf ${finAvail} Pc available (batch me ${alreadyInBatch})!`);
            return D.focusField('ch-cur-qty');
        }

        if (linkedOrderId) {
            const ord = D.get('dukan_orders').find((o) => o.id === linkedOrderId);
            const itemBaki = getOrderItemBakiForChallan(ord, name, editChallanId);
            if (qty + alreadyInBatch > itemBaki) {
                D.toast(`⚠️ Order me sirf ${itemBaki} Pc baki hai (batch me ${alreadyInBatch})!`);
                return D.focusField('ch-cur-qty');
            }
        }

        const existing = chBatch.findIndex((b) => String(b.name || '').trim().toUpperCase() === name);
        if (existing >= 0) {
            chBatch[existing].qty = D.num(chBatch[existing].qty) + qty;
            if (rate > 0) chBatch[existing].rate = rate;
        } else {
            chBatch.push({ name, qty, rate });
        }

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

    function renderChoiceScreen() {
        const challans = D.get('dukan_challans');
        const pendOrders = D.get('dukan_orders').filter((o) => o.status !== 'Complete').length;

        const left = `
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:12px; margin-bottom:14px;">
                <strong style="font-size:15px;">Challan &amp; Packing Slip Menu</strong>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">
                    Naya Challan (Manual Mode) banane ya Saved Challan Register dekhne ke liye option chunein
                </div>
            </div>
            <button type="button" class="dk-choice-btn ${choiceIdx === 0 ? 'active' : ''}" onclick="DukanERP.chOpenChoice(0)">
                <span>📦 Challan &amp; Packing Slip (Manual Mode)</span>
                <span class="dk-cnt-pill">${pendOrders} Pend Ord</span>
            </button>
            <button type="button" class="dk-choice-btn ${choiceIdx === 1 ? 'active' : ''}" onclick="DukanERP.chOpenChoice(1)">
                <span>📋 Challan Register (All Saved List)</span>
                <span class="dk-cnt-pill">${challans.length}</span>
            </button>
        `;

        D.renderShell(`<h2>Challan &amp; Packing Slip</h2>`, left, '[↑ ↓] Option Chunein · [Enter] Kholein · [Esc] Back');
        D.renderSide('Challan Summary', `${challans.length} Saved`, [
            { label: 'Challan & Packing Slip', meta: 'Manual + A5 Print', active: choiceIdx === 0 },
            { label: 'Challan Register', meta: `${challans.length} Challans Saved`, active: choiceIdx === 1 },
            { label: 'Pending Orders', meta: `${pendOrders} Baki` }
        ], false);

        D.bindFormControls({
            listNav: {
                selector: '#dk-left .dk-choice-btn',
                getIdx: () => choiceIdx,
                setIdx: (i) => { choiceIdx = i; },
                onEnter: (i) => D.chOpenChoice(i)
            }
        });
        setTimeout(() => document.querySelectorAll('#dk-left .dk-choice-btn')[choiceIdx]?.focus(), 20);
    }

    function renderRegisterScreen() {
        const challans = D.get('dukan_challans').slice().reverse();
        const orders = D.get('dukan_orders');

        const getFiltered = () => {
            const q = regSearch.trim().toLowerCase();
            if (!q) return challans;
            return challans.filter((c) => {
                const ord = c.orderId ? orders.find((o) => o.id === c.orderId) : null;
                const itemTxt = (c.items || []).map((i) => `${i.name} ${i.qty}`).join(' ');
                const blob = `${c.no} ${c.date} ${D.fmtDate(c.date)} ${c.partyName} ${c.city} ${c.marka} ${c.firmName} ${ord ? ord.no : ''} ${itemTxt}`.toLowerCase();
                return blob.includes(q);
            });
        };

        const showRegSide = (c) => {
            if (!c) return D.renderSide('Challan Register', '0', [], false);
            const ord = c.orderId ? orders.find((o) => o.id === c.orderId) : null;
            const totPcs = (c.items || []).reduce((a, b) => a + D.num(b.qty), 0);
            D.renderSide(`Challan #${c.no}`, `${D.fmtDate(c.date)} · ${totPcs} Pc`, [
                { label: `Party: ${c.partyName}`, meta: c.city || '', active: true },
                { label: `Marka: ${c.marka || '-'}`, meta: ord ? `Order #${ord.no}` : 'Manual' },
                ...(c.items || []).map((it) => ({
                    label: it.name,
                    meta: `${it.qty} Pc · ₹${D.num(it.rate)}`
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

            const tb = document.getElementById('ch-reg-tb');
            if (tb) {
                tb.innerHTML = pg.rows.length ? pg.rows.map((c, i) => {
                    const ord = c.orderId ? orders.find((o) => o.id === c.orderId) : null;
                    const totPcs = (c.items || []).reduce((a, b) => a + D.num(b.qty), 0);
                    const itemsSummary = (c.items || []).map((it) => `${D.esc(it.name)}:${it.qty}`).join(', ');
                    const escId = D.esc(c.id);
                    return `
                        <tr class="dk-nav-row ${i === regNav ? 'active' : ''}" onclick="DukanERP.chEditFromReg('${escId}')">
                            <td><strong>#${D.esc(c.no)}</strong><br><small>${D.fmtDate(c.date)}</small></td>
                            <td><strong>${D.esc(c.partyName)}</strong><br><small>Marka: ${D.esc(c.marka || '-')}</small></td>
                            <td><strong>${totPcs} Pc</strong><br><small>${itemsSummary}</small></td>
                            <td>${ord ? `#${D.esc(ord.no)}` : '-'}</td>
                            <td style="white-space:nowrap;">
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.chEditFromReg('${escId}')">✏️ Edit</button>
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.printSavedChallan('${escId}')">🖨️ A5</button>
                                <button type="button" class="dk-btn-del" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.deleteChallan('${escId}')">🗑️ Del</button>
                            </td>
                        </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi saved challan nahi mila</td></tr>`;
            }

            const pgBox = document.getElementById('ch-reg-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkChRegPage');
            showRegSide(pg.rows[regNav]);
        };

        const headL = `
            <h2>Challan Register (${challans.length})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.chOpenChoice(0)">+ New Challan</button>
            <button type="button" class="dk-btn" onclick="DukanERP.chBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-row">
                <label>🔍 Universal Search :</label>
                <input id="ch-reg-q" value="${D.esc(regSearch)}" placeholder="Challan #, Party, Marka, Design, Order # ya Date likhein..." autocomplete="off">
            </div>
            <table class="dk-tbl">
                <thead>
                    <tr>
                        <th>Challan # / Date</th>
                        <th>Party / Marka</th>
                        <th>Items &amp; Total</th>
                        <th>Order #</th>
                        <th>Action (Edit / Del / Print)</th>
                    </tr>
                </thead>
                <tbody id="ch-reg-tb"></tbody>
            </table>
            <div id="ch-reg-pg"></div>
            <div class="dk-accept" id="dk-accept-box">
                <strong id="dk-accept-msg">Delete Challan?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none';">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left, '[↑ ↓] Select · [Enter / Click] Edit & Delete kholein · [Esc] Menu');
        drawRows();

        const qEl = document.getElementById('ch-reg-q');
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
                selector: '#ch-reg-tb .dk-nav-row',
                searchId: 'ch-reg-q',
                getIdx: () => regNav,
                setIdx: (i) => { regNav = i; },
                onHighlight: (i) => showRegSide(D.paginate(getFiltered(), regPage).rows[i]),
                onEnter: (i) => {
                    const row = D.paginate(getFiltered(), regPage).rows[i];
                    if (row) D.chEditFromReg(row.id);
                }
            }
        });
    }

    function readCurrentDraft() {
        return {
            firmName: document.getElementById('ch-firm')?.value || '',
            firmMeta: document.getElementById('ch-firm-meta')?.value || '',
            partyName: document.getElementById('ch-party')?.value || '',
            ordText: document.getElementById('ch-ord')?.value || '',
            address: document.getElementById('ch-addr')?.value || '',
            mob: document.getElementById('ch-mob')?.value || '',
            gst: document.getElementById('ch-gst')?.value || '',
            no: document.getElementById('ch-no')?.value || '',
            date: document.getElementById('ch-date')?.value || D.today(),
            marka: document.getElementById('ch-marka')?.value || ''
        };
    }

    function renderFormScreen(focusId = 'ch-firm', rec = null, draft = null) {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const orders = D.get('dukan_orders');
        const challans = D.get('dukan_challans');
        const designOpts = D.getSellableDesignOptions();

        const isEdit = !!editChallanId;
        const editRec = isEdit ? (rec || challans.find((c) => c.id === editChallanId) || null) : null;
        const getActiveOrd = () => (linkedOrderId ? orders.find((o) => o.id === linkedOrderId) : null);

        const fObj = selFirmId ? (firms.find((x) => x.id === selFirmId) || {}) : {};
        const p = selPartyId ? (parties.find((x) => x.id === selPartyId) || {}) : {};
        const ordObj = getActiveOrd();

        const firmVal = draft ? draft.firmName : (rec ? (rec.firmName || fObj.name || '') : (fObj.name || ''));
        const firmMeta = draft
            ? (fObj.name ? `${fObj.address || ''} · Mob: ${fObj.mob || '-'} · GST: ${fObj.gst || '-'}` : draft.firmMeta)
            : (fObj.name ? `${fObj.address || ''} · Mob: ${fObj.mob || '-'} · GST: ${fObj.gst || '-'}` : '');

        const partyVal = draft ? draft.partyName : (rec ? (rec.partyName || p.name || '') : (p.name || ordObj?.partyName || ''));
        const addrVal = draft ? draft.address : (rec ? (rec.address || '') : [p.address, p.city].filter(Boolean).join(', '));
        const mobVal = draft ? draft.mob : (rec ? (rec.mob || '') : (p.mob || ''));
        const gstVal = draft ? draft.gst : (rec ? (rec.gst || '') : (p.gst || ''));
        const chNoVal = draft ? draft.no : (rec ? (rec.no || '') : '');
        const chDateVal = draft ? draft.date : (rec ? (rec.date || D.today()) : D.today());
        const markaVal = draft ? draft.marka : (rec ? (rec.marka || '') : (ordObj ? (ordObj.marka || p.marka || '') : (p.marka || '')));
        const ordTextVal = draft ? draft.ordText : (ordObj ? `#${ordObj.no}` : '');

        const headL = `
            <h2>Challan &amp; Packing Slip (${isEdit ? `Edit #${D.esc(editRec?.no || chNoVal)}` : 'Manual Mode'})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.chOpenChoice(1)">📋 Challan Register (${challans.length})</button>
            <button type="button" class="dk-btn" onclick="DukanERP.chBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-row"><label>Firm (From) :</label><input id="ch-firm" value="${D.esc(firmVal)}" placeholder="Side List se Apni Firm chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Firm Info :</label><input id="ch-firm-meta" value="${D.esc(firmMeta)}" placeholder="Firm select karne par khud bharega" readonly style="background:#f9fafb;"></div>
            <div class="dk-sec">Party &amp; Order Details</div>
            <div class="dk-row"><label>Party Name :</label><input id="ch-party" value="${D.esc(partyVal)}" placeholder="Type karein ya Side List chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Order # (Baki List) :</label><input id="ch-ord" value="${D.esc(ordTextVal)}" placeholder="Side List se Pending Order chunein..." autocomplete="off"></div>
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

            <div style="max-height:220px;overflow-y:auto;">
                <table class="dk-tbl">
                    <thead><tr><th>#</th><th>Design</th><th>Finished Avail</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Del</th></tr></thead>
                    <tbody id="ch-items-tb"></tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:8px;">
                <strong id="ch-batch-tot" style="color:#92400e;font-size:12.5px;">Total: 0 Designs · 0 Pcs</strong>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${isEdit ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteChallan('${D.esc(editChallanId)}')">🗑️ Delete Challan</button>` : ''}
                    <button type="button" class="dk-btn" onclick="DukanERP.printChallanAndSlip()">🖨️ Print A5 Challan &amp; Slip</button>
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askChallanSave()">💾 ${isEdit ? 'Update' : 'Save'} [Ctrl+Enter]</button>
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong id="dk-accept-msg">${isEdit ? 'Update Challan (Purana Stock Restore hoke Naya Minus hoga)?' : 'Save Challan &amp; Minus Finished Stock?'}</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-print" onclick="DukanERP.printChallanAndSlip()">🖨️ Print A5</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('ch-cur-name');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left, '[Enter] Agla Box · [Ctrl+Enter] Save · [Esc] Back');
        renderChBatchTable();

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
                        .slice(0, 60).map((x) => ({ id: x.id, label: x.name, meta: `${x.city || ''} · ${x.marka || ''}`, party: x })),
                    onPick: (it) => {
                        const cur = readCurrentDraft();
                        const np = it.party || {};
                        selPartyId = it.id;
                        linkedOrderId = '';
                        if (!editChallanId) chBatch = [];
                        renderFormScreen('ch-ord', null, {
                            ...cur,
                            partyName: np.name || it.label || '',
                            ordText: '',
                            address: [np.address, np.city].filter(Boolean).join(', '),
                            mob: np.mob || '',
                            gst: np.gst || '',
                            marka: np.marka || cur.marka || ''
                        });
                    }
                },
                'ch-ord': {
                    title: `${p.name || partyVal || 'Party'} — Pending Orders`,
                    noAutoHighlight: true,
                    getItems: (q) => {
                        const pTxt = (document.getElementById('ch-party')?.value || partyVal || '').trim().toUpperCase();
                        return orders
                            .filter((o) => {
                                const partyMatch = (!selPartyId && !pTxt)
                                    || (selPartyId && o.partyId === selPartyId)
                                    || (pTxt && String(o.partyName || '').trim().toUpperCase() === pTxt);
                                const statusMatch = o.status !== 'Complete' || o.id === linkedOrderId;
                                const qMatch = !q || `${o.no} ${o.marka}`.toLowerCase().includes(q.toLowerCase());
                                return partyMatch && statusMatch && qMatch;
                            })
                            .map((o) => {
                                const prog = D.getOrderProgress(o);
                                const bakiTxt = prog.items.filter((x) => x.baki > 0).map((x) => `${x.name}:${x.baki}`).join(', ');
                                return { id: o.id, pid: o.partyId, label: `Order #${o.no}`, meta: `Baki: ${bakiTxt || '0'}`, ord: o };
                            });
                    },
                    onPick: (it) => {
                        const cur = readCurrentDraft();
                        linkedOrderId = it.id;
                        if (!selFirmId && it.ord?.firmId) {
                            selFirmId = it.ord.firmId;
                            const ordFirm = firms.find((f) => f.id === selFirmId);
                            if (ordFirm) {
                                cur.firmName = ordFirm.name || '';
                                cur.firmMeta = `${ordFirm.address || ''} · Mob: ${ordFirm.mob || '-'} · GST: ${ordFirm.gst || '-'}`;
                            }
                        }
                        if (!selPartyId && (it.pid || it.ord?.partyName)) {
                            const ordParty = parties.find((x) => (it.pid && x.id === it.pid)
                                || (it.ord?.partyName && String(x.name || '').toUpperCase() === String(it.ord.partyName).toUpperCase()));
                            if (ordParty) {
                                selPartyId = ordParty.id;
                                cur.partyName = ordParty.name || '';
                                cur.address = [ordParty.address, ordParty.city].filter(Boolean).join(', ');
                                cur.mob = ordParty.mob || '';
                                cur.gst = ordParty.gst || '';
                            } else {
                                cur.partyName = it.ord?.partyName || cur.partyName;
                            }
                        }
                        cur.ordText = `#${it.ord.no}`;
                        if (!cur.marka.trim()) cur.marka = it.ord.marka || '';
                        renderFormScreen(selFirmId ? 'ch-no' : 'ch-firm', null, cur);
                        D.toast(`📋 Order #${it.ord.no} link hua — Bagal ki list se Baki items manually add karein`);
                    },
                    onEmptyEnter: () => D.focusField('ch-no')
                },
                'ch-cur-name': {
                    title: ordObj ? `Order #${ordObj.no} Baki Items + Designs` : `Finished Designs (${designOpts.length})`,
                    noAutoHighlight: true,
                    getItems: (q) => {
                        const ql = q.toLowerCase();
                        const items = [];
                        const activeOrd = getActiveOrd();
                        if (activeOrd) {
                            getOrderPendingItems(activeOrd)
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

    function render(focusId = 'ch-firm', rec = null) {
        if (viewMode === 'choice') return renderChoiceScreen();
        if (viewMode === 'register') return renderRegisterScreen();
        return renderFormScreen(focusId, rec);
    }

    D.askChallanSave = () => {
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        if (!partyTxt) { D.toast('⚠️ Party chunein!'); return D.focusField('ch-party'); }
        if (!chNo) { D.toast('⚠️ Challan No. bharein!'); return D.focusField('ch-no'); }
        if (!chBatch.length) { D.toast('⚠️ 1 item add karein!'); return D.focusField('ch-cur-name'); }
        if (chBatch.some((r) => D.num(r.qty) <= 0)) {
            D.toast('⚠️ Har item ki Qty 0 se zyada rakhein!');
            return;
        }
        if (linkedOrderId) {
            const ord = D.get('dukan_orders').find((o) => o.id === linkedOrderId);
            if (ord) {
                const totalsByDesign = {};
                chBatch.forEach((item) => {
                    const k = String(item.name || '').trim().toUpperCase();
                    totalsByDesign[k] = (totalsByDesign[k] || 0) + D.num(item.qty);
                });
                for (const itemName of Object.keys(totalsByDesign)) {
                    const itemBaki = getOrderItemBakiForChallan(ord, itemName, editChallanId);
                    if (totalsByDesign[itemName] > itemBaki) {
                        D.toast(`❌ ${itemName}: order me sirf ${itemBaki} Pc baki hai, ${totalsByDesign[itemName]} Pc bhej rahe!`);
                        return;
                    }
                }
            }
        }
        if (isSavingChallan) { D.toast('⏳ Save chal raha hai...'); return; }

        const msgEl = document.getElementById('dk-accept-msg');
        if (msgEl) {
            msgEl.textContent = editChallanId
                ? 'Update Challan (Purana Stock Restore hoke Naya Minus hoga)?'
                : 'Save Challan & Minus Finished Stock?';
        }
        const prBtn = document.getElementById('dk-accept-print');
        if (prBtn) prBtn.style.display = '';

        D.askAccept(() => D.saveChallan());
    };

    D.saveChallan = () => {
        // Guard 1: Already saving
        if (isSavingChallan) {
            D.toast('⏳ Save chal raha hai...');
            return;
        }
        // Guard 2: 1 second debounce
        const now = Date.now();
        if (now - lastSaveTime < 1000) {
            D.toast('⏳ 1 second baad try karein');
            return;
        }
        // Guard 3: Validation
        const partyTxt = (document.getElementById('ch-party')?.value || '').trim().toUpperCase();
        const chNo = (document.getElementById('ch-no')?.value || '').trim();
        const chDate = document.getElementById('ch-date')?.value || D.today();
        if (!partyTxt) { D.toast('⚠️ Party chunein!'); return D.focusField('ch-party'); }
        if (!chNo) { D.toast('⚠️ Challan No. bharein!'); return D.focusField('ch-no'); }
        if (!chBatch.length) { D.toast('⚠️ 1 item add karein!'); return D.focusField('ch-cur-name'); }
        if (chBatch.some((r) => D.num(r.qty) <= 0)) {
            D.toast('⚠️ Har item ki Qty 0 se zyada rakhein!');
            return;
        }

        isSavingChallan = true;
        lastSaveTime = now;
        try {
            const challans = D.get('dukan_challans');
            const parties = D.get('dukan_parties');
            const firms = D.get('dukan_firms');

            // Guard 4: Stale editChallanId check
            const prevRec = editChallanId ? challans.find((c) => c.id === editChallanId) : null;
            const isActualEdit = !!prevRec;
            const chId = isActualEdit
                ? editChallanId
                : `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            const pById = selPartyId ? parties.find((x) => x.id === selPartyId) : null;
            const pValid = pById && String(pById.name || '').trim().toUpperCase() === partyTxt ? pById : null;
            const p = pValid || parties.find((x) => String(x.name || '').trim().toUpperCase() === partyTxt) || {};
            const finalPartyId = p.id || (pValid ? selPartyId : partyTxt);

            const firmTxt = (document.getElementById('ch-firm')?.value || '').trim().toUpperCase();
            const fById = selFirmId ? firms.find((x) => x.id === selFirmId) : null;
            const finalFirmId = (fById && String(fById.name || '').trim().toUpperCase() === firmTxt)
                ? selFirmId
                : (firms.find((x) => String(x.name || '').trim().toUpperCase() === firmTxt)?.id || '');

            // Guard 5: Duplicate check (only new)
            if (!isActualEdit) {
                const dup = challans.find((c) =>
                    c.no === chNo &&
                    c.partyId === finalPartyId &&
                    c.date === chDate
                );
                if (dup) {
                    D.toast(`⚠️ Challan #${chNo} already exists (${D.fmtDate(chDate)})!`);
                    return;
                }
            }

            // Guard 6: Order Baki limit check (stock restore se pehle)
            if (linkedOrderId) {
                const ord = D.get('dukan_orders').find((o) => o.id === linkedOrderId);
                if (ord) {
                    const totalsByDesign = {};
                    chBatch.forEach((item) => {
                        const k = String(item.name || '').trim().toUpperCase();
                        totalsByDesign[k] = (totalsByDesign[k] || 0) + D.num(item.qty);
                    });
                    for (const itemName of Object.keys(totalsByDesign)) {
                        const itemBaki = getOrderItemBakiForChallan(ord, itemName, editChallanId);
                        if (totalsByDesign[itemName] > itemBaki) {
                            D.toast(`❌ ${itemName}: order me sirf ${itemBaki} Pc baki hai, ${totalsByDesign[itemName]} Pc bhej rahe!`);
                            return;
                        }
                    }
                }
            }

            // Restore old stock only if actual edit
            if (isActualEdit) {
                D.restoreFinishedStockByRef(editChallanId);
            }

            const rec = {
                id: chId,
                no: chNo,
                date: chDate,
                firmId: finalFirmId,
                firmName: firmTxt,
                partyId: finalPartyId,
                partyName: partyTxt,
                city: p.city || prevRec?.city || '',
                address: document.getElementById('ch-addr')?.value || '',
                mob: document.getElementById('ch-mob')?.value || '',
                gst: document.getElementById('ch-gst')?.value || '',
                marka: document.getElementById('ch-marka')?.value || '',
                orderId: linkedOrderId,
                items: chBatch.map((r) => ({ ...r }))
            };

            if (isActualEdit) {
                const idx = challans.findIndex((c) => c.id === editChallanId);
                challans[idx] = rec;
            } else {
                challans.push(rec);
            }
            D.set('dukan_challans', challans);

            // Stock deduct
            rec.items.forEach((it) => {
                D.deductFinishedStock(it.name, D.num(it.qty), {
                    date: rec.date,
                    partyName: rec.partyName,
                    chNo: rec.no,
                    marka: rec.marka,
                    refId: chId
                });
            });

            // Order status
            if (oldOrderId && oldOrderId !== linkedOrderId) D.recalcOrderStatus(oldOrderId);
            if (linkedOrderId) D.recalcOrderStatus(linkedOrderId);

            D.toast(isActualEdit
                ? `✅ Challan #${rec.no} update + stock adjust!`
                : `✅ Challan #${rec.no} save + stock minus!`);

            // Reset state
            editChallanId = '';
            selFirmId = '';
            selPartyId = '';
            linkedOrderId = '';
            oldOrderId = '';
            chBatch = [];
            fromRegister = false;
            viewMode = 'register';
            render();

        } catch (e) {
            console.error('[saveChallan]', e);
            D.toast('❌ Save fail: ' + e.message);
        } finally {
            isSavingChallan = false;
        }
    };

    D.deleteChallan = (chId) => {
        if (!chId || isDeletingChallan) return;
        const challans = D.get('dukan_challans');
        const target = challans.find((c) => c.id === chId);
        if (!target) { D.toast('⚠️ Already deleted!'); return; }

        const msgEl = document.getElementById('dk-accept-msg');
        if (msgEl) {
            msgEl.textContent = `🗑️ Challan #${target.no} delete karein? (Finished Stock wapas restore hoga)`;
        }
        const prBtn = document.getElementById('dk-accept-print');
        if (prBtn) prBtn.style.display = 'none';

        D.askAccept(() => {
            isDeletingChallan = true;
            try {
                const fresh = D.get('dukan_challans');
                if (!fresh.find((c) => c.id === chId)) return;

                D.restoreFinishedStockByRef(chId);
                D.set('dukan_challans', fresh.filter((c) => c.id !== chId));
                if (target.orderId) D.recalcOrderStatus(target.orderId);

                if (editChallanId === chId) editChallanId = '';
                chBatch = [];
                D.toast(`🗑️ Challan #${target.no} delete + stock restore!`);

                viewMode = 'register';
                fromRegister = false;
                render();
            } finally {
                isDeletingChallan = false;
            }
        });
    };

    function buildChallanA5HTML(data) {
        const firms = D.get('dukan_firms');
        const fObj = firms.find((x) =>
            (data.firmId && x.id === data.firmId) ||
            (data.firmName && String(x.name || '').toUpperCase() === String(data.firmName).toUpperCase())
        ) || (!data.firmName ? firms[0] : null) || {};
        const parties = D.get('dukan_parties');
        const pObj = parties.find((x) =>
            (data.partyId && x.id === data.partyId) ||
            (data.partyName && String(x.name || '').toUpperCase() === String(data.partyName).toUpperCase())
        ) || {};

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
        if (!w) {
            D.toast('⚠️ Popup blocked! Browser me popups allow karein.');
            return;
        }
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 150);
    };

    D.printSavedChallan = (chId) => {
        const rec = D.get('dukan_challans').find((c) => c.id === chId);
        if (!rec) return;
        const w = window.open('', '_blank', 'width=720,height=650');
        if (!w) {
            D.toast('⚠️ Popup blocked! Browser me popups allow karein.');
            return;
        }
        w.document.write(buildChallanA5HTML(rec));
        w.document.close();
        setTimeout(() => w.print(), 150);
    };
})();
