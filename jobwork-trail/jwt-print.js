/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 3/6: PRINT & WHATSAPP ENGINE)
   File: jobwork-trail/jwt-print.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    /* ========================================================================
       8. PRINT ENGINE (OUTSTATION CHALLAN + PACKING SLIP + BOTH + A6 SLIPS)
    ======================================================================== */
    J.openPrintWin = (title, css, bodyHtml, w = 520, h = 680) => {
        const pw = window.open('', '', `width=${w},height=${h}`);
        if (!pw) return alert('Popup block hai! Kripya browser me allow karein.');
        pw.document.write(`<html><head><title>${J.esc(title)}</title><style>${css}</style></head><body>${bodyHtml}<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),600);};<\/script></body></html>`);
        pw.document.close();
    };

    J.buildOutstationChallanParts = (c) => {
        const rowsHtml = c.sareeRows.map((r, i) => `
            <tr>
                <td style="width:42px;">${i + 1}</td>
                <td><strong>${J.esc(r.saree)}</strong></td>
                <td style="text-align:right; font-weight:800;">${r.pcs}</td>
            </tr>`).join('');

        const css = `
            * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
            .wrap { border: 2px solid #111; padding: 14px; color: #111; }
            .head { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
            .head h2 { margin: 0; font-size: 16px; font-weight: 900; }
            .pgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
            .pbox { border: 1.5px solid #111; padding: 7px 9px; font-size: 11.5px; line-height: 1.45; }
            .pbox small { display: block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; border-bottom: 1px dashed #888; margin-bottom: 3px; padding-bottom: 2px; }
            .tr { border: 1.5px solid #111; background: #f9fafb; padding: 5px 9px; font-size: 11.5px; margin-bottom: 10px; display: flex; justify-content: space-between; }
            .ch-tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
            .ch-tbl th, .ch-tbl td { border: 1px solid #111; padding: 6px 7px; text-align: left; }
            .ch-tbl th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; }
            .tot td { background: #f3f4f6; font-weight: 900; font-size: 13px; border-top: 2px solid #111; }
            .dbox { border: 1.5px dashed #111; padding: 8px 10px; font-size: 12px; margin-bottom: 18px; }
            .sign { display: flex; justify-content: space-between; margin-top: 26px; font-size: 11px; font-weight: 700; }
        `;
        const html = `
            <div class="wrap">
                <div class="head">
                    <div><h2>JOB WORK CHALLAN</h2><small>${J.esc(c.groupLabel)} Dispatch</small></div>
                    <div style="text-align:right; font-size:11.5px; line-height:1.45;">
                        <div><strong>JobWork No.:</strong> ${J.esc(c.jwNo)}</div>
                        <div><strong>Date:</strong> ${J.esc(J.fmtDate(c.date))}</div>
                    </div>
                </div>
                <div class="pgrid">
                    <div class="pbox">
                        <small>From (Sender)</small>
                        <strong>${J.esc(c.firm.name)}</strong><br>
                        ${c.firm.address ? `${J.esc(c.firm.address)}<br>` : ''}
                        ${c.firm.mobile ? `Mob: ${J.esc(c.firm.mobile)}<br>` : ''}
                        ${c.firm.gst ? `<strong>GSTIN:</strong> ${J.esc(c.firm.gst)}` : ''}
                    </div>
                    <div class="pbox">
                        <small>To (Job Worker)</small>
                        <strong>${J.esc(c.worker.name)}</strong><br>
                        ${c.worker.address ? `${J.esc(c.worker.address)}<br>` : ''}
                        ${c.worker.mobile ? `Mob: ${J.esc(c.worker.mobile)}<br>` : ''}
                        ${c.worker.gst ? `<strong>GSTIN:</strong> ${J.esc(c.worker.gst)}` : ''}
                    </div>
                </div>
                <div class="tr">
                    <span><strong>Transport:</strong> ${J.esc(c.transport)}</span>
                    <span><strong>L.R. / Bale:</strong> ${J.esc(c.lrNo)}</span>
                </div>
                <table class="ch-tbl">
                    <thead><tr><th>Sr.</th><th>Saree Name / Quality</th><th style="text-align:right; width:85px;">Pcs</th></tr></thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="tot"><td colspan="2" style="text-align:right;">TOTAL SAREE :</td><td style="text-align:right;">${c.totalPcs} Pcs</td></tr>
                    </tbody>
                </table>
                <div class="dbox"><strong>Design / Work Detail:</strong><br>${J.esc(c.designNote)}</div>
                <div class="sign"><span>Checked By: ___________</span><span>Receiver Sign: ___________</span></div>
            </div>
        `;
        return { css, html };
    };

    J.buildOutstationSlipParts = (c) => {
        const css = `
            .slip { font-family: monospace, sans-serif; font-size: 11.5px; color: #000; border: 2.5px dashed #000; padding: 10px; max-width: 92mm; margin: 0 auto; }
            .shdr { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 8px; }
            .shdr h3 { margin: 0; font-size: 15px; }
            .tobox { border: 2px solid #000; padding: 7px; margin-bottom: 7px; font-size: 12px; line-height: 1.4; }
            .frombox { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 7px; font-size: 11px; line-height: 1.4; }
            .info { font-size: 11.5px; line-height: 1.55; margin-bottom: 7px; }
            .stot { background: #eee; border: 2px solid #000; text-align: center; font-size: 16px; font-weight: 900; padding: 6px; margin: 8px 0; }
            .sdbox { border: 1.5px solid #000; padding: 6px; font-size: 11.5px; font-weight: 700; }
        `;
        const html = `
            <div class="slip">
                <div class="shdr"><h3>PACKING SLIP</h3><div>${J.esc(c.groupLabel.toUpperCase())} PARCEL</div></div>
                <div class="tobox">
                    <div style="font-size:10px; font-weight:bold;">TO (DELIVERY):</div>
                    <strong style="font-size:14px;">${J.esc(c.worker.name)}</strong><br>
                    ${c.worker.address ? `${J.esc(c.worker.address)}<br>` : ''}
                    ${c.worker.mobile ? `Mob: ${J.esc(c.worker.mobile)}<br>` : ''}
                    ${c.worker.gst ? `GSTIN: ${J.esc(c.worker.gst)}` : ''}
                </div>
                <div class="frombox">
                    <strong>FROM:</strong> ${J.esc(c.firm.name)}${c.firm.address ? `, ${J.esc(c.firm.address)}` : ''}<br>
                    ${c.firm.mobile ? `Mob: ${J.esc(c.firm.mobile)}` : ''} ${c.firm.gst ? `| GST: ${J.esc(c.firm.gst)}` : ''}
                </div>
                <div class="info">
                    <div><strong>JobWork No.:</strong> ${J.esc(c.jwNo)}</div>
                    <div><strong>Date:</strong> ${J.esc(J.fmtDate(c.date))}</div>
                    <div><strong>Transport:</strong> ${J.esc(c.transport)}</div>
                    <div><strong>L.R. / Bale:</strong> ${J.esc(c.lrNo)}</div>
                </div>
                <div class="stot">TOTAL: ${c.totalPcs} PCS</div>
                <div class="sdbox">DESIGN: ${J.esc(c.designNote)}</div>
            </div>
        `;
        return { css, html };
    };

    // A. OUTSTATION JOBWORK CHALLAN / BILL (FROM + TO + GST + SAREE DETAIL + DESIGN)
    J.printOutstationChallan = (c) => {
        if (!c || !c.sareeRows || !c.sareeRows.length) return J.toast('Print karne ke liye data nahi hai.', true);
        const p = J.buildOutstationChallanParts(c);
        J.openPrintWin(`Challan-${c.jwNo}`, `@page { size: A5 portrait; margin: 7mm; } body { margin: 0; padding: 6px; } ${p.css}`, p.html, 680, 760);
    };

    // B. PACKING SLIP (NO SAREE DETAIL — STRICTLY TO, FROM, JW NO, TRANSPORT, TOTAL PCS, DESIGN)
    J.printPackingSlip = (c) => {
        if (!c) return J.toast('Packing slip ke liye data nahi hai.', true);
        const p = J.buildOutstationSlipParts(c);
        J.openPrintWin(`PackingSlip-${c.jwNo}`, `@page { size: A6 portrait; margin: 4mm; } body { margin: 0; padding: 4mm; } ${p.css}`, p.html, 420, 560);
    };

    // C. BOTH (CHALLAN PAGE 1 + PACKING SLIP PAGE 2 IN ONE PRINT DIALOG)
    J.printOutstationBoth = (c) => {
        if (!c || !c.sareeRows || !c.sareeRows.length) return J.toast('Print karne ke liye data nahi hai.', true);
        const ch = J.buildOutstationChallanParts(c);
        const sl = J.buildOutstationSlipParts(c);
        const css = `
            @page challanPage { size: A5 portrait; margin: 7mm; }
            @page slipPage { size: A6 portrait; margin: 4mm; }
            body { margin: 0; padding: 6px; }
            .pg-challan { page: challanPage; page-break-after: always; }
            .pg-slip { page: slipPage; padding-top: 4mm; }
            ${ch.css}
            ${sl.css}
        `;
        J.openPrintWin(`Challan+Slip-${c.jwNo}`, css, `<div class="pg-challan">${ch.html}</div><div class="pg-slip">${sl.html}</div>`, 680, 760);
    };

    J.openA6Window = (title, bodyHtml) => {
        const css = `
            @page { size: A6 portrait; margin: 4mm; }
            body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
            .box { border: 1.5px dashed #000; padding: 8px; max-width: 92mm; margin: 0 auto; }
            .hdr { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
            .hdr h3 { margin: 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 6px 0; }
            th, td { padding: 3px 2px; border-bottom: 1px dashed #ccc; text-align: left; }
            th { border-top: 1px solid #000; border-bottom: 1px solid #000; }
            .tot { background: #eee; border: 1px solid #000; text-align: center; font-size: 13px; font-weight: 900; padding: 5px; margin: 8px 0; }
            .sign { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; }
        `;
        J.openPrintWin(title, css, `<div class="box">${bodyHtml}</div>`, 440, 600);
    };

    J.printBatchChallan = (c) => {
        if (!c || !c.items || !c.items.length) return J.toast('Print ke liye koi item nahi hai.', true);
        let tot = 0;
        const rowsHtml = c.items.map((it, i) => {
            tot += J.safeInt(it.qty);
            return `<tr><td>${i + 1}</td><td><strong>${J.esc(it.maker)}</strong></td><td>${J.esc(it.saree)}<br><small>${J.esc(it.trail)}</small></td><td style="text-align:right; font-weight:bold;">${it.qty}</td></tr>`;
        }).join('');
        J.openA6Window('Challan A6', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>${J.esc(c.title)}</div></div>
            <div><strong>Party / Worker:</strong> ${J.esc(c.party)}</div>
            <div><strong>Tarikh:</strong> ${J.esc(J.fmtDate(c.date))}</div>
            <table><thead><tr><th>#</th><th>KARIGER</th><th>SAREE &amp; TRAIL</th><th style="text-align:right;">PCS</th></tr></thead><tbody>${rowsHtml}</tbody></table>
            <div class="tot">KUL SAREE: ${tot} Pcs</div>
            <div class="sign"><div>हस्ताक्षर मुंशी<br><br>_______</div><div>हस्ताक्षर पाने वाला<br><br>_______</div></div>
        `);
    };

    window.jwtPrintLastChallan = () => {
        if (!J.s.lastChallanObj) return J.toast('Abhi koi batch save nahi hua hai.', true);
        if (J.s.lastChallanObj.isOutstation) J.printOutstationChallan(J.s.lastChallanObj);
        else J.printBatchChallan(J.s.lastChallanObj);
    };

    window.jwtPrintLastPackingSlip = () => {
        if (!J.s.lastChallanObj || !J.s.lastChallanObj.isOutstation) return J.toast('Pehle Outstation Challan save karein.', true);
        J.printPackingSlip(J.s.lastChallanObj);
    };

    window.jwtPrintLastBoth = () => {
        if (!J.s.lastChallanObj || !J.s.lastChallanObj.isOutstation) return J.toast('Pehle Outstation Challan save karein.', true);
        J.printOutstationBoth(J.s.lastChallanObj);
    };

    window.jwtPrintWorkerRow = (sheetId, rowId, mode = 'challan') => {
        const snap = J.getSnapshot();
        const w = snap.workers.find((x) => x.id === J.s.activeWorkerId);
        const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${J.s.activeWorkerId}`));
        const sh = sheets.find((s) => String(s.id) === String(sheetId));
        const r = sh ? J.safeArr(sh.rows).find((x) => String(x.id) === String(rowId)) : null;
        if (!w || !r) return;

        const isOut = J.safeInt(r.gayiQty) > 0;
        const isOutst = isOut && (r.isOutstation || J.getGroupObj(w.group).outstation);

        if (isOutst) {
            const payload = J.buildOutstationPayloadFromRow(w, r);
            if (J.s.regPrintRowInfo) {
                J.s.regPrintRowInfo = null;
                if (J.s.curView === 'jw-worker-hist' && typeof J.renderScreen === 'function') J.renderScreen();
            }
            if (mode === 'both') return J.printOutstationBoth(payload);
            if (mode === 'slip') return J.printPackingSlip(payload);
            return J.printOutstationChallan(payload);
        }

        const items = isOut ? J.safeArr(r.gayiItems) : J.safeArr(r.aayiItems);
        J.printBatchChallan({
            title: `${J.grpLabel(w.group).toUpperCase()} ${isOut ? 'OUT (GAYI)' : 'IN (WAPAS AAYI)'}`,
            party: `${w.name} (${J.grpLabel(w.group)})`,
            date: r.date,
            items: items.map((it) => ({
                maker: it.karigar || '-',
                saree: it.saree || 'Saree',
                trail: J.formatTrail(it.doneStages || [], it.destBucket || 'unfinished'),
                qty: it.qty
            }))
        });
    };

    window.jwtPrintWorkerStatement = (wId) => {
        const snap = J.getSnapshot();
        const targetId = wId || J.s.activeWorkerId;
        const w = snap.workers.find((x) => x.id === targetId);
        if (!w) return;

        const useDateFilter = (J.s.curView === 'jw-worker-hist' && String(targetId) === String(J.s.activeWorkerId) && (J.s.regDateFrom || J.s.regDateTo));
        const dFrom = useDateFilter ? J.s.regDateFrom : '';
        const dTo = useDateFilter ? J.s.regDateTo : '';

        const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${w.id}`));
        const rows = [];
        sheets.forEach((sh) => J.safeArr(sh.rows).forEach((r) => {
            const iso = J.toIsoDate(r.date);
            if (dFrom && (!iso || iso < dFrom)) return;
            if (dTo && (!iso || iso > dTo)) return;
            rows.push(r);
        }));

        let pOut = 0, pIn = 0;
        const rHtml = rows.map((r) => {
            const gQ = J.safeInt(r.gayiQty);
            const aQ = J.safeInt(r.aayiQty) + J.safeInt(r.damagePcs);
            pOut += gQ;
            pIn += aQ;
            return `<tr><td>${J.esc(J.fmtDate(r.date))}</td><td>${gQ > 0 ? 'OUT' : 'IN'}</td><td style="text-align:right;">${gQ || '-'}</td><td style="text-align:right;">${aQ || '-'}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center;">No Entries</td></tr>';

        const periodLine = useDateFilter
            ? `<div><strong>Period:</strong> ${J.esc(dFrom ? J.fmtDate(dFrom) : 'Start')} to ${J.esc(dTo ? J.fmtDate(dTo) : 'Today')}</div>`
            : `<div><strong>Tarikh:</strong> ${J.esc(J.fmtDate(J.getTodayIso()))}</div>`;
        const totLine = useDateFilter
            ? `PERIOD OUT: ${pOut} | IN: ${pIn} | KUL BAKI: ${w.pending} Pcs`
            : `DIYA: ${w.diya} | AAI: ${w.aai} | PENDING: ${w.pending} Pcs`;

        J.openA6Window('Worker Statement', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>${J.esc(J.grpLabel(w.group).toUpperCase())} KHATA STATEMENT</div></div>
            <div><strong>Worker:</strong> ${J.esc(w.name)} (${J.esc(w.mobile || '-')})</div>
            ${periodLine}
            <table><thead><tr><th>TARIKH</th><th>TYPE</th><th style="text-align:right;">OUT</th><th style="text-align:right;">IN</th></tr></thead><tbody>${rHtml}</tbody></table>
            <div class="tot">${totLine}</div>
        `);
    };

    window.jwtPrintFinalOutRow = (entryId) => {
        const d = J.safeArr(J.getStoreSafe('dukan_transfer_history')).find((x) => String(x.id) === String(entryId));
        if (!d) return;
        J.printBatchChallan({
            title: 'FINAL OUT (DISPATCH SLIP)',
            party: d.note || 'Apni Dukan',
            date: d.date,
            items: [{ maker: d.karigerName || '-', saree: d.sareeName || 'Saree', trail: d.note || '-', qty: J.safeInt(d.pcs) }]
        });
    };

    window.jwtPrintCurrentScreen = () => {
        const snap = J.getSnapshot();
        if (J.s.curView === 'jw-voucher' || J.s.curView === 'final-out') return window.jwtPrintLastChallan();
        if (J.s.curView === 'jw-worker-hist' || J.s.curView === 'owner-worker-detail') {
            return window.jwtPrintWorkerStatement(J.s.curView === 'owner-worker-detail' ? J.s.ownerWorkerId : J.s.activeWorkerId);
        }
        if (J.s.curView === 'owner-workers') {
            const rows = snap.workers.map((w) => `<tr><td><strong>${J.esc(w.name)}</strong><br><small>${J.esc(J.grpLabel(w.group))}</small></td><td style="text-align:right;">${w.diya}</td><td style="text-align:right;">${w.aai}</td><td style="text-align:right;"><strong>${w.pending}</strong></td></tr>`).join('');
            return J.openA6Window('Owner Report - Workers', `
                <div class="hdr"><h3>SIMPLICITY ERP</h3><div>HAR JOB WORKER KE PASS</div></div>
                <table><thead><tr><th>WORKER</th><th style="text-align:right;">DIYA</th><th style="text-align:right;">AAI</th><th style="text-align:right;">BAKI</th></tr></thead><tbody>${rows}</tbody></table>
                <div class="tot">KUL PENDING: ${snap.totals.pending} Pcs</div>
            `);
        }
        if (J.s.curView === 'owner-godam' || J.s.curView === 'stock-list') {
            const rows = snap.godamBatches.map((b) => `<tr><td><strong>${J.esc(b.saree)}</strong> (${J.esc(b.maker)})<br><small>${J.esc(J.formatTrail(b.doneStages, b.bucket))}</small></td><td style="text-align:right;"><strong>${b.pcs}</strong></td></tr>`).join('');
            return J.openA6Window('Godam Stock Trail', `
                <div class="hdr"><h3>SIMPLICITY ERP</h3><div>GODAM SAREE STOCK TRAIL</div></div>
                <table><thead><tr><th>SAREE &amp; STAGES</th><th style="text-align:right;">PCS</th></tr></thead><tbody>${rows}</tbody></table>
                <div class="tot">GODAM TOTAL: ${snap.totals.raw + snap.totals.finished + snap.totals.lott} Pcs</div>
            `);
        }
        if (J.s.curView === 'bill-detail' && J.s.activeBillId) return window.jwtPrintBillReceipt(J.s.activeBillId);
    };

    window.jwtPrintBillReceipt = (billId) => {
        const b = J.safeArr(J.getStoreSafe('jw_bills_list')).find((x) => String(x.id) === String(billId));
        if (!b) return;
        const baki = Math.max(0, J.safeNum(b.billAmt) - J.safeNum(b.paidAmt));
        J.openA6Window('Bill Receipt', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>JOB WORK BILL RASEED</div></div>
            <div><strong>Bill No:</strong> ${J.esc(b.billNo || '-')}</div>
            <div><strong>Worker:</strong> ${J.esc(b.workerName)} (${J.esc(J.grpLabel(b.workType || 'cutting'))})</div>
            <div><strong>Tarikh:</strong> ${J.esc(J.fmtDate(b.date))}</div>
            <table><tbody>
                <tr><td>Saree Pcs</td><td style="text-align:right;">${J.safeInt(b.pcs)} Pcs</td></tr>
                <tr><td>Total Bill</td><td style="text-align:right;">₹ ${J.safeNum(b.billAmt).toFixed(2)}</td></tr>
                <tr><td>Paid Amount</td><td style="text-align:right;">₹ ${J.safeNum(b.paidAmt).toFixed(2)}</td></tr>
            </tbody></table>
            <div class="tot">${baki > 0 ? `BAKI HAI: ₹ ${baki.toFixed(2)}` : 'STATUS: PAID / CHUKTA'}</div>
        `);
    };

    window.jwtShareWorkerWhatsApp = (wId) => {
        const snap = J.getSnapshot();
        const w = snap.workers.find((x) => x.id === (wId || J.s.activeWorkerId));
        if (!w) return;
        const mob = J.getCleanMobile(w.mobile);
        if (!mob || mob.length < 10) return J.toast(`${w.name} ka Mobile No. saved nahi hai!`, true);

        const details = w.pendingItems.length
            ? w.pendingItems.map((p) => `• ${p.saree} (${p.maker}): *${p.pcs} Pcs* [${J.formatTrail(p.doneStages, 'unfinished')}]`).join('\n')
            : '• Koi saree pending nahi';

        const msg = `*SIMPLICITY ERP — ${J.grpLabel(w.group).toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━\n` +
            `Kariger: *${w.name}*\nTarikh: ${J.fmtDate(J.getTodayIso())}\n━━━━━━━━━━━━━━━━━━━\n` +
            `Diya: ${w.diya} Pcs | Aai: ${w.aai} Pcs\n*ABHI BAKI SAREE: ${w.pending} Pcs*\n\n` +
            `*Pending Detail:*\n${details}\n━━━━━━━━━━━━━━━━━━━`;
        window.open(`https://wa.me/${mob}?text=${encodeURIComponent(msg)}`, '_blank');
    };
})();
