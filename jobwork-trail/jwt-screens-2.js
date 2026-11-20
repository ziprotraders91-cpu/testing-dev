/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 5/6: SCREENS PART 2)
   File: jobwork-trail/jwt-screens-2.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    /* ========================================================================
       11B. SCREEN RENDERERS PART 2 (OWNER, STOCK, FINAL OUT, BILLS)
    ======================================================================== */
    J.renderScreensPart2 = (body, snap) => {
        const s = J.s;

        // 5. OWNER REPORT
        if (s.curView === 'owner-menu') {
            J.setTopHeader('Owner Report', '← [Esc] Gateway');
            const t = snap.totals;
            const opts = [
                { label: '1. Har Job Worker Ke Pass', val: `${t.pending} Pcs`, action: "jwtSetMenuIdx(0); jwtGo('owner-workers')" },
                { label: '2. Godam Me Maujud', val: `${t.raw + t.finished + t.lott} Pcs`, action: "jwtSetMenuIdx(1); jwtGo('owner-godam')" }
            ];
            if (s.menuIdx >= opts.length || s.menuIdx < 0) s.menuIdx = 0;

            body.innerHTML = `
                <div class="jwt-kpi-5">
                    <div class="jwt-kpi-cell"><small>Godam (Kaam Baki)</small><strong>${t.raw} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>Worker Ke Pass</small><strong>${t.pending} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>Finished (Tayyar)</small><strong>${t.finished} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>Lot (Damage)</small><strong>${t.lott} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>Kul Saree (100% Match)</small><strong>${t.total} Pcs</strong></div>
                </div>
                <div style="padding:10px 16px;">
                    <div class="jwt-menu-shell">
                        <div class="jwt-menu-head"><span>Select Report View</span></div>
                        ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${J.esc(o.val)}</span></button>`).join('')}
                        <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
                    </div>
                </div>
            `;
            return true;
        }

        if (s.curView === 'owner-workers') {
            J.setTopHeader('Har Job Worker Ke Pass (Summary)', '← [Esc] Owner Report', '[↑ ↓] Worker Chunein · [Enter] Batch Detail · [Alt+P] Print', true);
            const q = (document.getElementById('jwt-ow-search')?.value || '').trim().toLowerCase();
            const list = snap.workers.filter((w) => !q || `${w.name} ${J.grpLabel(w.group)} ${w.mobile}`.toLowerCase().includes(q));
            if (s.menuIdx >= list.length || s.menuIdx < 0) s.menuIdx = Math.max(0, list.length - 1);

            body.innerHTML = `<div style="padding:12px 16px;">
                <input type="text" id="jwt-ow-search" class="jwt-inp" style="margin-bottom:10px;" value="${J.esc(q)}" placeholder="Search Worker..." oninput="jwtFilterList()">
                <table>
                    <thead><tr><th>Worker Name</th><th>Work Group</th><th>Mobile &amp; Address</th><th class="num">Diya</th><th class="num">Aai</th><th class="num">Pending Pcs</th><th style="text-align:right;">Batch</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map((w, i) => `
                            <tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenOwnerWorkerDetail('${J.esc(w.id)}')">
                                <td><strong>${J.esc(w.name)}</strong></td>
                                <td>${J.esc(J.grpLabel(w.group))}</td>
                                <td>${J.esc(w.mobile || '-')} &middot; ${J.esc(w.address || '-')}</td>
                                <td class="num">${w.diya}</td>
                                <td class="num">${w.aai}</td>
                                <td class="gold-num">${w.pending} Pcs</td>
                                <td style="text-align:right;">Detail &rarr;</td>
                            </tr>`).join('') : `<tr><td colspan="7" style="text-align:center; padding:18px; color:#6b7280;">Koi worker nahi hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            J.bindSearchKey('jwt-ow-search');
            return true;
        }

        if (s.curView === 'owner-worker-detail') {
            const w = snap.workers.find((x) => x.id === s.ownerWorkerId);
            if (!w) { J.jwtBackTo('owner-workers'); return true; }
            J.setTopHeader(`${w.name} (${J.grpLabel(w.group)}) — Pending Batch Detail`, '← [Esc] Workers List', '[Alt+P] Print Statement', true);

            body.innerHTML = `<div style="padding:14px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div><strong>${J.esc(w.name)}</strong> &middot; Mob: ${J.esc(w.mobile || '-')} &middot; <strong style="color:#b47d00;">Total Pending: ${w.pending} Pcs</strong></div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="jwt-esc" onclick="jwtShareWorkerWhatsApp('${J.esc(w.id)}')">WhatsApp</button>
                        <button type="button" class="jwt-save" onclick="jwtSelectWorker('${J.esc(w.id)}')">Open Out / In</button>
                    </div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Saree Design</th><th>Kariger (Maker)</th><th>Godam</th><th>Pehle Kya Ho Chuka (Trail)</th><th class="num">Pending Pcs</th></tr></thead>
                    <tbody>
                        ${w.pendingItems.length ? w.pendingItems.map((p, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${J.esc(p.saree)}</strong></td>
                                <td>${J.esc(p.maker)}</td>
                                <td>${J.esc(p.godamName)}</td>
                                <td class="trail">${J.esc(J.formatTrail(p.doneStages, 'unfinished'))}</td>
                                <td class="gold-num">${p.pcs} Pcs</td>
                            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Koi pending saree nahi hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            return true;
        }

        if (s.curView === 'owner-godam') {
            J.setTopHeader('Godam Me Maujud (Summary)', '← [Esc] Owner Report', '[↑ ↓] Row · [Enter] Trail Detail · [Alt+P] Print', true);
            const q = (document.getElementById('jwt-og-search')?.value || '').trim().toLowerCase();
            const list = snap.godamSummaries.filter((g) => !q || `${g.saree} ${g.maker} ${g.godamName} ${g.bucket}`.toLowerCase().includes(q));
            if (s.menuIdx >= list.length || s.menuIdx < 0) s.menuIdx = Math.max(0, list.length - 1);

            body.innerHTML = `<div style="padding:12px 16px;">
                <input type="text" id="jwt-og-search" class="jwt-inp" style="margin-bottom:10px;" value="${J.esc(q)}" placeholder="Search Saree, Maker, Godam..." oninput="jwtFilterList()">
                <table>
                    <thead><tr><th>Saree Design</th><th>Kariger (Maker)</th><th>Godam</th><th>Status</th><th class="num">Total Available</th><th style="text-align:right;">Stages</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map((g, i) => `
                            <tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenOwnerGodamDetail('${encodeURIComponent(g.summaryKey)}')">
                                <td><strong>${J.esc(g.saree)}</strong></td>
                                <td>${J.esc(g.maker)}</td>
                                <td>${J.esc(g.godamName)}</td>
                                <td>${g.bucket === 'finished' ? 'Finished' : (g.bucket === 'lott' ? 'Lott' : 'Godam WIP')}</td>
                                <td class="gold-num">${g.pcs} Pcs</td>
                                <td style="text-align:right;">Trail (${g.batches.length}) &rarr;</td>
                            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Godam khali hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            J.bindSearchKey('jwt-og-search');
            return true;
        }

        if (s.curView === 'owner-godam-detail') {
            const g = snap.godamSummaries.find((x) => x.summaryKey === s.ownerGodamSummaryKey);
            if (!g) { J.jwtBackTo('owner-godam'); return true; }
            J.setTopHeader(`${g.saree} (${g.maker}) — Stages Detail`, '← [Esc] Godam Summary');

            body.innerHTML = `<div style="padding:14px 16px;">
                <div style="margin-bottom:10px;"><strong>${J.esc(g.saree)}</strong> (${J.esc(g.maker)}) &middot; ${J.esc(g.godamName)} &middot; <strong style="color:#b47d00;">Total: ${g.pcs} Pcs</strong></div>
                <table>
                    <thead><tr><th>#</th><th>Completed Stages Trail</th><th>Last Date</th><th class="num">Available Pcs</th></tr></thead>
                    <tbody>
                        ${g.batches.map((b, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${J.esc(J.formatTrail(b.doneStages, b.bucket))}</td>
                                <td>${J.esc(J.fmtDate(b.lastDate))}</td>
                                <td class="gold-num">${b.pcs} Pcs</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
            return true;
        }

        // 6. SAREE STOCK
        if (s.curView === 'stock-list') {
            J.setTopHeader('Saree Stock', '← [Esc] Gateway', '[↑ ↓] Chunein · [Enter] Trail & Passbook · [Alt+P] Print', true);
            const tabs = [
                { key: 'all', lbl: 'Sabhi' },
                { key: 'unfinished', lbl: 'Kaam Baaki (WIP)' },
                { key: 'finished', lbl: 'Finished (Ready)' },
                { key: 'lott', lbl: 'Lott' }
            ];
            const q = (document.getElementById('jwt-st-search')?.value || '').trim().toLowerCase();
            const list = snap.godamSummaries
                .filter((g) => s.stockBucketFilter === 'all' || g.bucket === s.stockBucketFilter)
                .filter((g) => !q || `${g.saree} ${g.maker} ${g.godamName} ${g.batches.map((b) => J.formatTrail(b.doneStages, b.bucket)).join(' ')}`.toLowerCase().includes(q));
            if (s.menuIdx >= list.length || s.menuIdx < 0) s.menuIdx = Math.max(0, list.length - 1);

            body.innerHTML = `
                <div class="jwt-subnav">
                    ${tabs.map((t) => {
                        const cnt = (t.key === 'all' ? snap.godamSummaries : snap.godamSummaries.filter((x) => x.bucket === t.key)).reduce((sum, x) => sum + x.pcs, 0);
                        return `<button type="button" class="jwt-tab ${s.stockBucketFilter === t.key ? 'active' : ''}" onclick="jwtSetStockBucket('${t.key}')">${J.esc(t.lbl)} (${cnt})</button>`;
                    }).join('')}
                </div>
                <div style="padding:12px 16px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                        <input type="text" id="jwt-st-search" class="jwt-inp" style="flex:1; min-width:200px;" value="${J.esc(q)}" placeholder="Search Saree, Maker, Stage..." oninput="jwtFilterList()">
                        <button type="button" class="jwt-save" onclick="jwtToggleInward()">+ Saree Inward</button>
                    </div>
                    <div id="jwt-inw-box" style="display:${s.stockInwardOpen ? 'block' : 'none'}; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:12px;">
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                            <div><label style="font-size:11px; font-weight:700;">Tarikh</label><input type="date" id="jwt-inw-date" class="jwt-inp" value="${J.getTodayIso()}"></div>
                            <div><label style="font-size:11px; font-weight:700;">Saree Design</label><input type="text" id="jwt-inw-saree" class="jwt-inp" placeholder="Banarasi Katan"></div>
                            <div><label style="font-size:11px; font-weight:700;">Kariger (Maker)</label><input type="text" id="jwt-inw-maker" class="jwt-inp" placeholder="Raju"></div>
                            <div><label style="font-size:11px; font-weight:700;">Pcs</label><input type="text" inputmode="numeric" id="jwt-inw-pcs" class="jwt-inp" placeholder="20"></div>
                            <div><label style="font-size:11px; font-weight:700;">Stage</label>
                                <select id="jwt-inw-stage" class="jwt-inp">
                                    <option value="fresh">Fresh (Kora)</option>
                                    <option value="cutting">Cutting Complete</option>
                                    <option value="embroidery">Embroidery Complete</option>
                                    <option value="finished">Finished Ready</option>
                                    <option value="lott">Lott</option>
                                </select>
                            </div>
                        </div>
                        <div style="text-align:right; margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
                            <button type="button" class="jwt-esc" onclick="jwtToggleInward()">Cancel</button>
                            <button type="button" class="jwt-save" onclick="jwtSaveInward()">Save Inward</button>
                        </div>
                    </div>
                    <table>
                        <thead><tr><th>Saree Design</th><th>Kariger (Maker)</th><th>Godam</th><th>Bucket</th><th class="num">Total Bachi</th><th style="text-align:right;">Detail</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map((g, i) => `
                                <tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenStockDetail('${encodeURIComponent(g.summaryKey)}')">
                                    <td><strong>${J.esc(g.saree)}</strong></td>
                                    <td>${J.esc(g.maker)}</td>
                                    <td>${J.esc(g.godamName)}</td>
                                    <td>${g.bucket === 'finished' ? 'Finished' : (g.bucket === 'lott' ? 'Lott' : 'Godam WIP')}</td>
                                    <td class="gold-num">${g.pcs} Pcs</td>
                                    <td style="text-align:right;">Trail (${g.batches.length}) &rarr;</td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Koi stock nahi mila.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;
            J.bindSearchKey('jwt-st-search');
            return true;
        }

        if (s.curView === 'stock-detail') {
            const g = snap.godamSummaries.find((x) => x.summaryKey === s.stockDetailKey);
            if (!g) { J.jwtBackTo('stock-list'); return true; }
            J.setTopHeader(`${g.saree} (${g.maker}) — Stage Trail & Passbook`, '← [Esc] Saree Stock');

            const sH = J.safeArr(J.getStoreSafe('saree_history')).filter((h) => {
                if (!h) return false;
                const sN = J.normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
                const mN = J.normText(h.karigerName || h.kariger, 'KARKHANA');
                const kid = J.normGodam(h.karkhanaId);
                return sN === g.saree && mN === g.maker && kid === g.karkhanaId;
            }).sort((a, b) => J.safeNum(b.timestamp, 0) - J.safeNum(a.timestamp, 0)).slice(0, 40);

            body.innerHTML = `<div style="padding:14px 16px;">
                <div style="margin-bottom:8px;"><strong>${J.esc(g.saree)}</strong> (${J.esc(g.maker)}) &middot; ${J.esc(g.godamName)} &middot; <strong style="color:#b47d00;">Total: ${g.pcs} Pcs</strong></div>
                <h4 style="margin:10px 0 6px; font-size:12px; color:#92400e; text-transform:uppercase;">1. Stage-Wise Available Stock</h4>
                <table style="margin-bottom:14px;">
                    <thead><tr><th>#</th><th>Completed Stages Trail</th><th class="num">Available Pcs</th></tr></thead>
                    <tbody>
                        ${g.batches.map((b, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${J.esc(J.formatTrail(b.doneStages, b.bucket))}</td>
                                <td class="gold-num">${b.pcs} Pcs</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
                <h4 style="margin:10px 0 6px; font-size:12px; color:#92400e; text-transform:uppercase;">2. Movement Passbook</h4>
                <table>
                    <thead><tr><th>Tarikh</th><th>Detail</th><th class="num">Aai (+)</th><th class="num">Gayi (-)</th></tr></thead>
                    <tbody>
                        ${sH.map((h) => {
                            const isOut = (h.isOut === true) || (J.safeNum(h.gai) > 0);
                            const q = isOut ? J.safeInt(h.gai) : J.safeInt(h.aai);
                            return `<tr>
                                <td>${J.esc(J.fmtDate(h.date))}</td>
                                <td>${J.esc(h.typeLabel || h.note || '-')}</td>
                                <td class="num">${!isOut ? `+${q}` : '-'}</td>
                                <td class="num" style="color:#6b7280;">${isOut ? `-${q}` : '-'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
            return true;
        }

        // 7. FINAL OUT (DISPATCH)
        if (s.curView === 'final-out') {
            J.setTopHeader('Final Out (Dispatch)', '← [Esc] Gateway', 'Kariger ➔ Stage ➔ Pcs · Khali Kariger Enter = Save', true);
            const allBatches = snap.godamBatches.filter((b) => b.bucket !== 'lott' && b.pcs > 0);
            const totFoPcs = s.foBatch.reduce((sum, x) => sum + x.qty, 0);
            const dukanHist = J.safeArr(J.getStoreSafe('dukan_transfer_history')).slice().sort((a, b) => J.safeNum(b.timestamp, 0) - J.safeNum(a.timestamp, 0)).slice(0, 25);

            let editFoHtml = '';
            if (s.editFoId) {
                const target = dukanHist.find((x) => String(x.id) === String(s.editFoId));
                if (target) {
                    editFoHtml = `<div style="background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:10px 12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="color:#92400e;">Edit Final Out: ${J.esc(target.sareeName)} (${J.esc(target.karigerName || '-')})</strong>
                            <button type="button" class="jwt-esc" onclick="jwtCancelFinalOutEdit()">Cancel</button>
                        </div>
                        <div style="display:grid; grid-template-columns:140px 1fr 100px auto; gap:8px; align-items:center;">
                            <input type="date" id="jwt-efo-date" class="jwt-inp" value="${J.esc(J.toIsoDate(target.date) || J.getTodayIso())}">
                            <input type="text" id="jwt-efo-note" class="jwt-inp" value="${J.esc(target.note || '')}">
                            <input type="text" inputmode="numeric" id="jwt-efo-pcs" class="jwt-inp" value="${J.safeInt(target.pcs)}">
                            <button type="button" class="jwt-save" onclick="jwtSaveFinalOutEdit('${J.esc(target.id)}')">Save</button>
                        </div>
                    </div>`;
                }
            }

            body.innerHTML = `
                <div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-fo-date" class="jwt-inp" value="${J.getTodayIso()}"></div>
                        <div class="jwt-frow"><label>Dukan / Party :</label><input type="text" id="jwt-fo-note" class="jwt-inp" value="Apni Main Dukan" placeholder="Dukan / Party naam..."></div>
                        <div class="jwt-frow"><label>Kariger :</label><input type="text" id="jwt-fo-kariger" class="jwt-inp" autocomplete="off" placeholder="Name likhein ya ↑↓ (Khali Enter=Save)"></div>
                        <div class="jwt-frow"><label>Stage Batch :</label><input type="text" id="jwt-fo-stage" class="jwt-inp" readonly placeholder="Stage chunein..."></div>
                        <div class="jwt-frow">
                            <label>Pcs :</label>
                            <div style="display:flex; gap:6px;">
                                <input type="text" inputmode="numeric" id="jwt-fo-qty" class="jwt-inp" placeholder="0" style="flex:1;">
                                <button type="button" tabindex="-1" class="jwt-save" onclick="jwtAddFoItem()">+ Add</button>
                            </div>
                        </div>

                        <div style="margin-top:10px; border:1px solid #e5d5a7; border-radius:5px; overflow:hidden;">
                            <div class="jwt-sidebox-head"><span>Dispatch Batch</span><strong>${totFoPcs} Pcs (${s.foBatch.length})</strong></div>
                            <div style="max-height:165px; overflow-y:auto;">
                                <table>
                                    <thead><tr><th>#</th><th>Kariger</th><th>Saree &amp; Stage</th><th class="num">Pcs</th><th></th></tr></thead>
                                    <tbody>
                                        ${s.foBatch.length ? s.foBatch.map((it, idx) => `
                                            <tr>
                                                <td>${idx + 1}</td>
                                                <td><strong>${J.esc(it.maker)}</strong></td>
                                                <td>${J.esc(it.saree)}<div class="trail">${J.esc(J.formatTrail(it.doneStages, it.bucket))}</div></td>
                                                <td class="gold-num">${it.qty}</td>
                                                <td style="text-align:center;"><button type="button" tabindex="-1" class="jwt-esc" style="padding:1px 6px;" onclick="jwtRemoveFoItem(${idx})">&times;</button></td>
                                            </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; padding:10px; color:#6b7280;">Batch khali hai.</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap;">
                            <span class="trail-muted">${s.foBatch.length ? 'Khali Kariger par Enter ya Save dabayein' : 'Kariger ➔ Stage ➔ Pcs add karein'}</span>
                            ${s.foBatch.length ? `<button type="button" class="jwt-save" onclick="jwtAskFoAccept()">Save Final Out [Ctrl+Enter]</button>` : ''}
                        </div>

                        <div id="jwt-fo-accept" class="jwt-accept-bar" style="display:${s.foAcceptOpen ? 'flex' : 'none'};">
                            <strong style="font-size:12px;">Accept? Final Out Save Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="jwt-save" onclick="jwtCommitFo(true)">Save &amp; Print [P]</button>
                                <button type="button" id="jwt-fo-yes" class="jwt-save" onclick="jwtCommitFo(false)">Yes [Y / Enter]</button>
                                <button type="button" class="jwt-esc" onclick="jwtCancelFoAccept()">No [N]</button>
                            </div>
                        </div>
                    </div>

                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head"><span id="jwt-fo-r-title">1. List of Karigers</span><small id="jwt-fo-r-cnt">0</small></div>
                            <div id="jwt-fo-r-list" class="jwt-side-list-big"></div>
                        </div>
                    </div>
                </div>

                <div style="padding:12px 16px; border-top:1.5px solid #e5d5a7;">
                    <div style="font-size:11.5px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:6px;">Recent Final Out Register</div>
                    ${editFoHtml}
                    <table>
                        <thead><tr><th>Tarikh</th><th>Saree</th><th>Kariger</th><th>Note / Stage</th><th class="num">Pcs</th><th style="text-align:right;">Actions</th></tr></thead>
                        <tbody>
                            ${dukanHist.length ? dukanHist.map((d) => `
                                <tr>
                                    <td>${J.esc(J.fmtDate(d.date))}</td>
                                    <td><strong>${J.esc(d.sareeName)}</strong></td>
                                    <td>${J.esc(d.karigerName || '-')}</td>
                                    <td>${J.esc(d.note || '-')}</td>
                                    <td class="gold-num">${J.safeInt(d.pcs)}</td>
                                    <td style="text-align:right; white-space:nowrap;">
                                        <button type="button" class="jwt-esc" onclick="jwtEditFinalOut('${J.esc(d.id)}')">Edit</button>
                                        <button type="button" class="jwt-esc" onclick="jwtPrintFinalOutRow('${J.esc(d.id)}')">Print</button>
                                        <button type="button" class="jwt-del" onclick="jwtDeleteFinalOutEntry('${J.esc(d.id)}')">Del</button>
                                    </td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:14px; color:#6b7280;">Abhi koi Final Out entry nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;
            J.renderFoRightPanel(allBatches);
            J.bindFinalOutKeys(allBatches);
            setTimeout(() => document.getElementById('jwt-fo-kariger')?.focus(), 25);
            return true;
        }

        // 8. BILLS & HISAB
        if (s.curView === 'bills-menu') {
            J.setTopHeader('Bills & Hisab', '← [Esc] Gateway', '[↑ ↓] + [Enter] · [Esc] Gateway');
            const bills = J.safeArr(J.getStoreSafe('jw_bills_list'));
            let totAmt = 0, totPaid = 0, pendCnt = 0, paidCnt = 0;
            bills.forEach((b) => {
                totAmt += J.safeNum(b.billAmt);
                totPaid += J.safeNum(b.paidAmt);
                if (Math.max(0, J.safeNum(b.billAmt) - J.safeNum(b.paidAmt)) > 0) pendCnt++;
                else paidCnt++;
            });
            const totBaki = Math.max(0, totAmt - totPaid);

            const opts = [
                { label: '1. New Bill (Entry)', val: 'Create', action: "jwtSetMenuIdx(0); jwtOpenBillNew()" },
                { label: '2. Pending Bill', val: `${pendCnt} Bills`, action: "jwtSetMenuIdx(1); jwtOpenBillsList('pending')" },
                { label: '3. Paid Bill', val: `${paidCnt} Bills`, action: "jwtSetMenuIdx(2); jwtOpenBillsList('paid')" }
            ];
            if (s.menuIdx >= opts.length || s.menuIdx < 0) s.menuIdx = 0;

            body.innerHTML = `
                <div class="jwt-kpi-3">
                    <div class="jwt-kpi-cell"><small>Kul Bill Amount</small><strong>₹ ${totAmt.toFixed(2)}</strong></div>
                    <div class="jwt-kpi-cell"><small>Kul Paid</small><strong>₹ ${totPaid.toFixed(2)}</strong></div>
                    <div class="jwt-kpi-cell"><small>Dena Baki</small><strong>₹ ${totBaki.toFixed(2)}</strong></div>
                </div>
                <div style="padding:10px 16px;">
                    <div class="jwt-menu-shell">
                        <div class="jwt-menu-head"><span>Bills &amp; Hisab Menu</span></div>
                        ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${J.esc(o.val)}</span></button>`).join('')}
                        <div class="jwt-footer"><span>[&uarr; &darr;] Chunein &middot; [Enter] Kholein</span><span>[Esc] Gateway</span></div>
                    </div>
                </div>
            `;
            return true;
        }

        if (s.curView === 'bills-new') {
            J.setTopHeader('New Bill Entry', '← [Esc] Bills Menu', '[Enter] Agla Box · [↑↓] Worker Chunein · Paid=Total par direct Paid Bill');
            s.billAcceptOpen = false;
            body.innerHTML = `<div class="jwt-split">
                <div class="jwt-pane-l">
                    <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-b-date" class="jwt-inp" value="${J.getTodayIso()}"></div>
                    <div class="jwt-frow"><label>Job Worker :</label><input type="text" id="jwt-b-worker" class="jwt-inp" autocomplete="off" placeholder="Worker likhein ya ↑↓ chunein..."></div>
                    <div class="jwt-frow"><label>Bill No. :</label><input type="text" id="jwt-b-no" class="jwt-inp" placeholder="e.g. 101"></div>
                    <div class="jwt-frow"><label>Saree Pcs :</label><input type="text" inputmode="numeric" id="jwt-b-pcs" class="jwt-inp" placeholder="0"></div>
                    <div class="jwt-frow"><label>Total Bill (₹) :</label><input type="text" inputmode="decimal" id="jwt-b-amt" class="jwt-inp" placeholder="0.00"></div>
                    <div class="jwt-frow"><label>Paid Now (₹) :</label><input type="text" inputmode="decimal" id="jwt-b-paid" class="jwt-inp" value="0" placeholder="0.00 (Direct Paid)"></div>
                    <div class="jwt-frow"><label>Pay Mode :</label>
                        <select id="jwt-b-mode" class="jwt-inp">
                            <option value="Cash">Cash</option>
                            <option value="UPI / Online">UPI / Online</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div class="jwt-frow"><label>Note :</label><input type="text" id="jwt-b-note" class="jwt-inp" placeholder="Detail..."></div>
                    <div id="jwt-b-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Naya Bill Save Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-b-yes" class="jwt-save" onclick="jwtSaveNewBill()">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelBillAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:10px;"><button type="button" class="jwt-save" onclick="jwtAskBillAccept()">Save Bill [Ctrl+Enter]</button></div>
                </div>
                <div class="jwt-pane-r">
                    <div class="jwt-sidebox">
                        <div class="jwt-sidebox-head"><span>List of Job Workers</span><small>${snap.workers.length}</small></div>
                        <div id="jwt-b-wlist" class="jwt-side-list-big"></div>
                    </div>
                </div>
            </div>`;
            J.renderBillWorkerList('');
            J.bindBillNewKeys();
            setTimeout(() => document.getElementById('jwt-b-worker')?.focus(), 25);
            return true;
        }

        if (s.curView === 'bills-list') {
            const isPend = (s.billsListMode === 'pending');
            J.setTopHeader(isPend ? 'Pending Bills' : 'Paid Bills', '← [Esc] Bills Menu', '[↑ ↓] Bill Chunein · [Enter] Pay / Receipt · [/] Search');
            const bills = J.safeArr(J.getStoreSafe('jw_bills_list'));
            const q = (document.getElementById('jwt-bl-search')?.value || '').trim().toLowerCase();
            const filtered = bills.filter((b) => {
                const baki = Math.max(0, J.safeNum(b.billAmt) - J.safeNum(b.paidAmt));
                const matchMode = isPend ? baki > 0 : baki <= 0;
                const matchQ = !q || `${b.workerName} ${b.billNo} ${b.date}`.toLowerCase().includes(q);
                return matchMode && matchQ;
            });
            if (s.menuIdx >= filtered.length || s.menuIdx < 0) s.menuIdx = Math.max(0, filtered.length - 1);

            body.innerHTML = `<div style="padding:12px 16px;">
                <input type="text" id="jwt-bl-search" class="jwt-inp" style="margin-bottom:10px;" value="${J.esc(q)}" placeholder="Search Worker, Bill No..." oninput="jwtFilterList()">
                <table>
                    <thead><tr><th>Tarikh</th><th>Bill No</th><th>Job Worker</th><th>Work</th><th class="num">Pcs</th><th class="num">Total (₹)</th><th class="num">Paid (₹)</th><th class="num">Baki (₹)</th><th style="text-align:right;">Open</th></tr></thead>
                    <tbody>
                        ${filtered.length ? filtered.map((b, i) => {
                            const baki = Math.max(0, J.safeNum(b.billAmt) - J.safeNum(b.paidAmt));
                            return `<tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenBillDetail('${J.esc(b.id)}')">
                                <td>${J.esc(J.fmtDate(b.date))}</td>
                                <td><strong>${J.esc(b.billNo || '-')}</strong></td>
                                <td><strong>${J.esc(b.workerName)}</strong></td>
                                <td>${J.esc(J.grpLabel(b.workType || 'cutting'))}</td>
                                <td class="num">${J.safeInt(b.pcs)}</td>
                                <td class="num">₹ ${J.safeNum(b.billAmt).toFixed(2)}</td>
                                <td class="num">₹ ${J.safeNum(b.paidAmt).toFixed(2)}</td>
                                <td class="gold-num">₹ ${baki.toFixed(2)}</td>
                                <td style="text-align:right;">Open &rarr;</td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="9" style="text-align:center; padding:18px; color:#6b7280;">${isPend ? 'Koi pending bill nahi hai.' : 'Koi paid bill nahi hai.'}</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            J.bindSearchKey('jwt-bl-search');
            return true;
        }

        if (s.curView === 'bill-detail') {
            const bills = J.safeArr(J.getStoreSafe('jw_bills_list'));
            const b = bills.find((x) => String(x.id) === String(s.activeBillId));
            if (!b) { J.jwtBackTo('bills-list'); return true; }
            const baki = Math.max(0, J.safeNum(b.billAmt) - J.safeNum(b.paidAmt));
            const bPays = J.safeArr(J.getStoreSafe('jw_payments_list')).filter((p) => String(p.billId) === String(b.id));
            s.billPayAcceptOpen = false;
            J.setTopHeader(`Bill #${b.billNo || '-'} — ${b.workerName}`, '← [Esc] Bills List', '[Enter] Pay Entry · [Alt+P] Receipt Print', true);

            body.innerHTML = `<div style="padding:14px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                    <div>
                        <strong>Bill #${J.esc(b.billNo || '-')}</strong> &middot; ${J.esc(b.workerName)} &middot;
                        Total: ₹ ${J.safeNum(b.billAmt).toFixed(2)} | Paid: ₹ ${J.safeNum(b.paidAmt).toFixed(2)} |
                        <strong style="color:#b47d00;">Baki: ₹ ${baki.toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="jwt-esc" onclick="jwtPrintBillReceipt('${J.esc(b.id)}')">Print Receipt [Alt+P]</button>
                        <button type="button" class="jwt-del" onclick="jwtDeleteBill('${J.esc(b.id)}')">Delete Bill</button>
                    </div>
                </div>

                ${baki > 0 ? `<div style="max-width:480px; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:14px;">
                    <div style="font-size:12px; font-weight:800; color:#92400e; margin-bottom:8px;">PAYMENT ENTRY (BAKI: ₹ ${baki.toFixed(2)})</div>
                    <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-bp-date" class="jwt-inp" value="${J.getTodayIso()}"></div>
                    <div class="jwt-frow"><label>Amount (₹) :</label><input type="text" inputmode="decimal" id="jwt-bp-amt" class="jwt-inp" value="${baki}"></div>
                    <div class="jwt-frow"><label>Mode :</label><select id="jwt-bp-mode" class="jwt-inp"><option>Cash</option><option>UPI / Online</option><option>Bank Transfer</option></select></div>
                    <div class="jwt-frow"><label>Note :</label><input type="text" id="jwt-bp-note" class="jwt-inp" value="Payment for Bill ${J.esc(b.billNo || '')}"></div>
                    <div id="jwt-bp-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Payment Save Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-bp-yes" class="jwt-save" onclick="jwtSaveBillPayment('${J.esc(b.id)}')">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelBpAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:8px;"><button type="button" class="jwt-save" onclick="jwtAskBpAccept()">Save Payment [Ctrl+Enter]</button></div>
                </div>` : ''}

                <div style="font-size:11.5px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:6px;">Payment Passbook</div>
                <table>
                    <thead><tr><th>Tarikh</th><th>Mode &amp; Note</th><th class="num">Paid (₹)</th><th style="text-align:right;">Action</th></tr></thead>
                    <tbody>
                        ${bPays.length ? bPays.map((p) => `<tr>
                            <td>${J.esc(J.fmtDate(p.date))}</td>
                            <td>${J.esc(p.mode || 'Cash')} &middot; ${J.esc(p.note || '')}</td>
                            <td class="gold-num">₹ ${J.safeNum(p.amount).toFixed(2)}</td>
                            <td style="text-align:right;"><button type="button" class="jwt-del" onclick="jwtDeleteBillPay('${J.esc(p.id)}', '${J.esc(b.id)}')">Del</button></td>
                        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; padding:12px; color:#6b7280;">Koi payment nahi hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            if (baki > 0) {
                J.bindBillPayKeys();
                setTimeout(() => { const a = document.getElementById('jwt-bp-amt'); a?.focus(); a?.select(); }, 25);
            }
            return true;
        }

        return false;
    };

    J.renderScreen = () => {
        try {
            const body = document.getElementById('jwt-body');
            if (!body) return;
            const snap = J.getSnapshot();
            if (typeof J.renderScreensPart1 === 'function' && J.renderScreensPart1(body, snap)) return;
            J.renderScreensPart2(body, snap);
        } catch (err) {
            console.error('[JW-Trail] Render failure prevented:', err);
        }
    };

    window.renderScreenNow = () => J.renderScreen();
    window.highlightRegRow = (idx) => {
        document.querySelectorAll('#jw-trail-section tbody tr.jwt-row').forEach((tr, i) => tr.classList.toggle('active', i === idx));
    };
})();
