/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 6/6: CONTROLLERS, KEYS & INIT)
   File: jobwork-trail/jwt-controllers.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    /* ========================================================================
       12. VOUCHER & FINAL OUT 2-STEP PICKER CONTROLLERS
    ======================================================================== */
    J.renderVchRightPanel = (sourceBatches) => {
        const s = J.s;
        if (!s) return;
        const titleEl = document.getElementById('jwt-vch-r-title');
        const cntEl = document.getElementById('jwt-vch-r-cnt');
        const listEl = document.getElementById('jwt-vch-r-list');
        if (!listEl) return;

        if (s.vchPickStep === 'firm') {
            const firms = typeof J.getFirmsList === 'function' ? J.getFirmsList() : [];
            const fInpVal = String(document.getElementById('jwt-vch-firm')?.value || '').trim();
            const isExactCur = fInpVal && J.normText(fInpVal) === J.normText(s.vchMeta.firmName);
            const fQuery = isExactCur ? '' : fInpVal.toLowerCase();
            s.vchRightItems = firms.filter((f) => !fQuery || `${f.name} ${f.city || ''} ${f.gst || ''}`.toLowerCase().includes(fQuery));
            if (s.vchRightIdx >= s.vchRightItems.length || s.vchRightIdx < 0) {
                const defIdx = s.vchRightItems.findIndex((f) => String(f.id) === String(s.vchMeta.firmId) || J.normText(f.name) === J.normText(s.vchMeta.firmName));
                s.vchRightIdx = defIdx >= 0 ? defIdx : (s.vchRightItems.length ? 0 : -1);
            }
            if (titleEl) titleEl.textContent = 'List of Firms (Billing)';
            if (cntEl) cntEl.textContent = `${s.vchRightItems.length} Firms`;

            listEl.innerHTML = s.vchRightItems.length
                ? s.vchRightItems.map((f, i) => `
                    <div class="jwt-side-opt ${i === s.vchRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickVchRight(${i})">
                        <div><strong>${J.esc(f.name)}</strong><div class="trail-muted">${J.esc(f.gst || f.address || 'Firm')}</div></div>
                        <small>${f.isDefault ? '★ Default' : J.esc(f.city || 'Firm')}</small>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Koi Firm saved nahi hai.</div>`;
            listEl.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
            return;
        }

        const kQuery = document.getElementById('jwt-vch-kariger')?.value || '';
        if (s.vchPickStep === 'kariger') {
            s.vchRightItems = J.buildKarigerPickerList(sourceBatches, s.vchBatch, kQuery);
            if (s.vchRightIdx >= s.vchRightItems.length) s.vchRightIdx = s.vchRightItems.length ? 0 : -1;
            if (titleEl) titleEl.textContent = s.vchBatch.length && s.vchRightIdx < 0 ? '1. [↓] Kariger Chunein · [↵] Save' : '1. List of Karigers';
            if (cntEl) cntEl.textContent = `${s.vchRightItems.length} Karigers`;

            listEl.innerHTML = s.vchRightItems.length
                ? s.vchRightItems.map((it, i) => `
                    <div class="jwt-side-opt ${i === s.vchRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickVchRight(${i})">
                        <div><strong>${J.esc(it.maker)}</strong><div class="trail-muted">${it.stagesCount} Stage(s)</div></div>
                        <strong style="white-space:nowrap;">${it.totalPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Koi available stock nahi hai.</div>`;
        } else {
            s.vchRightItems = J.buildStagePickerList(sourceBatches, s.vchSelectedMaker, s.vchBatch);
            if (s.vchRightIdx >= s.vchRightItems.length || s.vchRightIdx < 0) s.vchRightIdx = 0;
            if (titleEl) titleEl.textContent = `2. ${s.vchSelectedMaker} ke Stages`;
            if (cntEl) cntEl.textContent = `${s.vchRightItems.length} Batches`;

            listEl.innerHTML = s.vchRightItems.length
                ? s.vchRightItems.map((b, i) => `
                    <div class="jwt-side-opt ${i === s.vchRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickVchRight(${i})">
                        <div>
                            <div><strong>${J.esc(b.saree)}</strong></div>
                            <div class="trail" style="font-size:11px;">${J.esc(J.formatTrail(b.doneStages, 'unfinished'))}</div>
                            <div class="trail-muted" style="font-size:10.5px;">${J.esc(b.godamName)}</div>
                        </div>
                        <strong style="white-space:nowrap;">${b.availPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Aur stock nahi bacha.</div>`;
        }
        listEl.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickVchRight = (idx) => {
        const s = J.s;
        if (!s) return;
        const snap = J.getSnapshot();
        const w = snap.workers.find((x) => x.id === s.activeWorkerId);
        const sourceBatches = (s.vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
        const item = s.vchRightItems[idx];
        if (!item) return;

        if (s.vchPickStep === 'firm') {
            s.vchMeta.firmId = item.id || '';
            s.vchMeta.firmName = item.name || '';
            const fInp = document.getElementById('jwt-vch-firm');
            if (fInp) fInp.value = item.name || '';
            s.vchPickStep = 'kariger';
            s.vchRightIdx = 0;
            J.renderVchRightPanel(sourceBatches);
            setTimeout(() => document.getElementById('jwt-vch-jwno')?.focus(), 20);
            return;
        }

        if (s.vchPickStep === 'kariger') {
            s.vchSelectedMaker = item.maker;
            const kInp = document.getElementById('jwt-vch-kariger');
            if (kInp) kInp.value = item.maker;
            s.vchPickStep = 'stage';
            s.vchRightIdx = 0;
            J.renderVchRightPanel(sourceBatches);
            setTimeout(() => document.getElementById('jwt-vch-stage')?.focus(), 20);
        } else {
            s.vchSelectedBatchKey = item.key;
            const sInp = document.getElementById('jwt-vch-stage');
            const qInp = document.getElementById('jwt-vch-qty');
            if (sInp) sInp.value = `${item.saree} [${J.formatTrail(item.doneStages, 'unfinished')}] — ${item.availPcs} Pc`;
            if (qInp) qInp.value = item.availPcs;
            setTimeout(() => {
                if (s.vchDir === 'in') document.getElementById('jwt-vch-dest')?.focus();
                else { qInp?.focus(); qInp?.select(); }
            }, 20);
        }
    };

    window.jwtAddVchItem = () => {
        const s = J.s;
        if (!s) return;
        J.syncVchMetaFromDom();
        const snap = J.getSnapshot();
        const w = snap.workers.find((x) => x.id === s.activeWorkerId);
        const sourceBatches = (s.vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
        const batch = sourceBatches.find((b) => b.key === s.vchSelectedBatchKey);
        if (!batch) return J.toast('Pehle Kariger aur Stage Batch chunein!', true);

        const avail = batch.pcs - J.getBatchUsedQty(s.vchBatch, batch.key);
        const qty = J.safeInt(document.getElementById('jwt-vch-qty')?.value);
        if (qty <= 0 || qty > avail) return J.toast(`Sahi Pcs daalein (Max ${avail} Pcs)!`, true);

        const dest = (s.vchDir === 'in') ? (document.getElementById('jwt-vch-dest')?.value || 'godam') : 'out';
        s.vchBatch.push({
            batchKey: batch.key, saree: batch.saree, maker: batch.maker,
            karkhanaId: batch.karkhanaId, doneStages: [...batch.doneStages], dest, qty
        });

        s.vchPickStep = 'kariger';
        s.vchSelectedMaker = null;
        s.vchSelectedBatchKey = null;
        s.vchRightIdx = -1;
        J.renderScreen();
    };

    window.jwtRemoveVchItem = (idx) => {
        J.syncVchMetaFromDom();
        J.s.vchBatch.splice(idx, 1);
        J.s.vchRightIdx = J.s.vchBatch.length ? -1 : 0;
        J.renderScreen();
    };
    window.jwtCommitVch = (printType) => J.commitVchBatch(printType);

    window.jwtAskVchAccept = () => {
        if (!J.s.vchBatch.length) return J.toast('Batch khali hai!', true);
        J.s.vchAcceptOpen = true;
        const bar = document.getElementById('jwt-vch-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-vch-yes')?.focus(), 20);
    };

    window.jwtCancelVchAccept = () => {
        J.s.vchAcceptOpen = false;
        const bar = document.getElementById('jwt-vch-accept');
        if (bar) bar.style.display = 'none';
        document.getElementById('jwt-vch-kariger')?.focus();
    };

    J.bindVchVoucherKeys = (sourceBatches, isOutstationOut) => {
        const s = J.s;
        if (!s) return;
        const fInp = document.getElementById('jwt-vch-firm');
        const kInp = document.getElementById('jwt-vch-kariger');
        const sInp = document.getElementById('jwt-vch-stage');
        const dSel = document.getElementById('jwt-vch-dest');
        const qInp = document.getElementById('jwt-vch-qty');
        const yesBtn = document.getElementById('jwt-vch-yes');

        const metaChain = isOutstationOut
            ? ['jwt-vch-date', 'jwt-vch-firm', 'jwt-vch-jwno', 'jwt-vch-trans', 'jwt-vch-lr', 'jwt-vch-design', 'jwt-vch-kariger']
            : ['jwt-vch-date', 'jwt-vch-kariger'];

        metaChain.forEach((id, i) => {
            if (id === 'jwt-vch-kariger' || id === 'jwt-vch-firm') return;
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('focus', () => {
                if (s.vchPickStep === 'firm') {
                    s.vchPickStep = 'kariger';
                    s.vchRightIdx = 0;
                    J.renderVchRightPanel(sourceBatches);
                }
            });
            el.addEventListener('input', J.syncVchMetaFromDom);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    J.syncVchMetaFromDom();
                    document.getElementById(metaChain[i + 1])?.focus();
                }
            });
        });

        if (fInp) {
            fInp.addEventListener('focus', () => {
                s.vchPickStep = 'firm';
                s.vchRightIdx = -1;
                J.renderVchRightPanel(sourceBatches);
            });
            fInp.addEventListener('input', () => {
                s.vchPickStep = 'firm';
                s.vchRightIdx = 0;
                s.vchMeta.firmName = fInp.value;
                J.renderVchRightPanel(sourceBatches);
            });
            fInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (s.vchRightItems.length) {
                        e.preventDefault();
                        s.vchRightIdx = e.key === 'ArrowDown'
                            ? (s.vchRightIdx + 1) % s.vchRightItems.length
                            : (s.vchRightIdx - 1 + s.vchRightItems.length) % s.vchRightItems.length;
                        J.renderVchRightPanel(sourceBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (s.vchRightIdx >= 0 && s.vchRightItems[s.vchRightIdx]) window.jwtPickVchRight(s.vchRightIdx);
                    else document.getElementById('jwt-vch-jwno')?.focus();
                }
            });
        }

        if (kInp) {
            kInp.addEventListener('focus', () => {
                s.vchPickStep = 'kariger';
                s.vchRightIdx = (s.vchBatch.length > 0 && !kInp.value.trim()) ? -1 : 0;
                J.renderVchRightPanel(sourceBatches);
            });
            kInp.addEventListener('input', () => {
                s.vchPickStep = 'kariger';
                s.vchRightIdx = (!kInp.value.trim() && s.vchBatch.length > 0) ? -1 : 0;
                J.renderVchRightPanel(sourceBatches);
            });
            kInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (s.vchRightItems.length) {
                        e.preventDefault();
                        if (s.vchRightIdx < 0) s.vchRightIdx = (e.key === 'ArrowDown') ? 0 : (s.vchRightItems.length - 1);
                        else s.vchRightIdx = e.key === 'ArrowDown' ? (s.vchRightIdx + 1) % s.vchRightItems.length : (s.vchRightIdx - 1 + s.vchRightItems.length) % s.vchRightItems.length;
                        J.renderVchRightPanel(sourceBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (!kInp.value.trim() && s.vchBatch.length > 0 && s.vchRightIdx < 0) {
                        s.vchAcceptOpen = true;
                        const bar = document.getElementById('jwt-vch-accept');
                        if (bar) bar.style.display = 'flex';
                        setTimeout(() => document.getElementById('jwt-vch-yes')?.focus(), 20);
                        return;
                    }
                    if (s.vchRightIdx >= 0 && s.vchRightItems[s.vchRightIdx]) window.jwtPickVchRight(s.vchRightIdx);
                }
            });
        }
        if (sInp) {
            sInp.addEventListener('focus', () => { if (s.vchSelectedMaker) { s.vchPickStep = 'stage'; J.renderVchRightPanel(sourceBatches); } });
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (s.vchRightItems.length) {
                        e.preventDefault();
                        s.vchRightIdx = e.key === 'ArrowDown' ? (s.vchRightIdx + 1) % s.vchRightItems.length : (s.vchRightIdx - 1 + s.vchRightItems.length) % s.vchRightItems.length;
                        J.renderVchRightPanel(sourceBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && s.vchRightItems[s.vchRightIdx]) {
                    e.preventDefault();
                    window.jwtPickVchRight(s.vchRightIdx);
                }
            });
        }
        if (dSel) dSel.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qInp?.focus(); qInp?.select(); } });
        if (qInp) qInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAddVchItem(); } });
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); J.commitVchBatch(''); }
                else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); J.commitVchBatch('challan'); }
                else if ((e.key === 'l' || e.key === 'L') && isOutstationOut) { e.preventDefault(); e.stopPropagation(); J.commitVchBatch('slip'); }
                else if ((e.key === 'b' || e.key === 'B') && isOutstationOut) { e.preventDefault(); e.stopPropagation(); J.commitVchBatch('both'); }
                else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); window.jwtCancelVchAccept(); }
            });
        }
    };

    J.renderFoRightPanel = (allBatches) => {
        const s = J.s;
        if (!s) return;
        const titleEl = document.getElementById('jwt-fo-r-title');
        const cntEl = document.getElementById('jwt-fo-r-cnt');
        const listEl = document.getElementById('jwt-fo-r-list');
        if (!listEl) return;

        const kQuery = document.getElementById('jwt-fo-kariger')?.value || '';
        if (s.foPickStep === 'kariger') {
            s.foRightItems = J.buildKarigerPickerList(allBatches, s.foBatch, kQuery);
            if (s.foRightIdx >= s.foRightItems.length) s.foRightIdx = s.foRightItems.length ? 0 : -1;
            if (titleEl) titleEl.textContent = s.foBatch.length && s.foRightIdx < 0 ? '1. [↓] Kariger Chunein · [↵] Save' : '1. List of Karigers';
            if (cntEl) cntEl.textContent = `${s.foRightItems.length} Karigers`;

            listEl.innerHTML = s.foRightItems.length
                ? s.foRightItems.map((it, i) => `
                    <div class="jwt-side-opt ${i === s.foRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickFoRight(${i})">
                        <div><strong>${J.esc(it.maker)}</strong><div class="trail-muted">${it.stagesCount} Stage(s)</div></div>
                        <strong style="white-space:nowrap;">${it.totalPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Godam me stock nahi hai.</div>`;
        } else {
            s.foRightItems = J.buildStagePickerList(allBatches, s.foSelectedMaker, s.foBatch);
            if (s.foRightIdx >= s.foRightItems.length || s.foRightIdx < 0) s.foRightIdx = 0;
            if (titleEl) titleEl.textContent = `2. ${s.foSelectedMaker} ke Stages`;
            if (cntEl) cntEl.textContent = `${s.foRightItems.length} Stages`;

            listEl.innerHTML = s.foRightItems.length
                ? s.foRightItems.map((b, i) => `
                    <div class="jwt-side-opt ${i === s.foRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickFoRight(${i})">
                        <div>
                            <div><strong>${J.esc(b.saree)}</strong></div>
                            <div class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}" style="font-size:11px;">${J.esc(J.formatTrail(b.doneStages, b.bucket))}</div>
                            <div class="trail-muted" style="font-size:10.5px;">${J.esc(b.godamName)}</div>
                        </div>
                        <strong style="white-space:nowrap;">${b.availPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Aur stock nahi bacha.</div>`;
        }
        listEl.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickFoRight = (idx) => {
        const s = J.s;
        if (!s) return;
        const allBatches = J.getSnapshot().godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0);
        const item = s.foRightItems[idx];
        if (!item) return;

        if (s.foPickStep === 'kariger') {
            s.foSelectedMaker = item.maker;
            const kInp = document.getElementById('jwt-fo-kariger');
            if (kInp) kInp.value = item.maker;
            s.foPickStep = 'stage';
            s.foRightIdx = 0;
            J.renderFoRightPanel(allBatches);
            setTimeout(() => document.getElementById('jwt-fo-stage')?.focus(), 20);
        } else {
            s.foSelectedBatchKey = item.key;
            const sInp = document.getElementById('jwt-fo-stage');
            const qInp = document.getElementById('jwt-fo-qty');
            if (sInp) sInp.value = `${item.saree} [${J.formatTrail(item.doneStages, item.bucket)}] — ${item.availPcs} Pc`;
            if (qInp) qInp.value = item.availPcs;
            setTimeout(() => { qInp?.focus(); qInp?.select(); }, 20);
        }
    };

    window.jwtAddFoItem = () => {
        const s = J.s;
        if (!s) return;
        const allBatches = J.getSnapshot().godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0);
        const batch = allBatches.find((b) => b.key === s.foSelectedBatchKey);
        if (!batch) return J.toast('Pehle Kariger aur Stage chunein!', true);

        const avail = batch.pcs - J.getBatchUsedQty(s.foBatch, batch.key);
        const qty = J.safeInt(document.getElementById('jwt-fo-qty')?.value);
        if (qty <= 0 || qty > avail) return J.toast(`Sahi Pcs daalein (Max ${avail} Pcs)!`, true);

        s.foBatch.push({
            batchKey: batch.key, saree: batch.saree, maker: batch.maker,
            karkhanaId: batch.karkhanaId, doneStages: [...batch.doneStages], bucket: batch.bucket, qty
        });

        s.foPickStep = 'kariger';
        s.foSelectedMaker = null;
        s.foSelectedBatchKey = null;
        s.foRightIdx = -1;
        J.renderScreen();
    };

    window.jwtRemoveFoItem = (idx) => {
        J.s.foBatch.splice(idx, 1);
        J.s.foRightIdx = J.s.foBatch.length ? -1 : 0;
        J.renderScreen();
    };
    window.jwtCommitFo = (doPrint) => J.commitFinalOutBatch(doPrint);

    window.jwtAskFoAccept = () => {
        if (!J.s.foBatch.length) return J.toast('Batch khali hai!', true);
        J.s.foAcceptOpen = true;
        const bar = document.getElementById('jwt-fo-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-fo-yes')?.focus(), 20);
    };

    window.jwtCancelFoAccept = () => {
        J.s.foAcceptOpen = false;
        const bar = document.getElementById('jwt-fo-accept');
        if (bar) bar.style.display = 'none';
        document.getElementById('jwt-fo-kariger')?.focus();
    };

    J.bindFinalOutKeys = (allBatches) => {
        const s = J.s;
        if (!s) return;
        const kInp = document.getElementById('jwt-fo-kariger');
        const sInp = document.getElementById('jwt-fo-stage');
        const qInp = document.getElementById('jwt-fo-qty');
        const yesBtn = document.getElementById('jwt-fo-yes');

        if (kInp) {
            kInp.addEventListener('focus', () => {
                s.foPickStep = 'kariger';
                s.foRightIdx = (s.foBatch.length > 0 && !kInp.value.trim()) ? -1 : 0;
                J.renderFoRightPanel(allBatches);
            });
            kInp.addEventListener('input', () => {
                s.foPickStep = 'kariger';
                s.foRightIdx = (!kInp.value.trim() && s.foBatch.length > 0) ? -1 : 0;
                J.renderFoRightPanel(allBatches);
            });
            kInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (s.foRightItems.length) {
                        e.preventDefault();
                        if (s.foRightIdx < 0) s.foRightIdx = (e.key === 'ArrowDown') ? 0 : (s.foRightItems.length - 1);
                        else s.foRightIdx = e.key === 'ArrowDown' ? (s.foRightIdx + 1) % s.foRightItems.length : (s.foRightIdx - 1 + s.foRightItems.length) % s.foRightItems.length;
                        J.renderFoRightPanel(allBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (!kInp.value.trim() && s.foBatch.length > 0 && s.foRightIdx < 0) {
                        s.foAcceptOpen = true;
                        const bar = document.getElementById('jwt-fo-accept');
                        if (bar) bar.style.display = 'flex';
                        setTimeout(() => document.getElementById('jwt-fo-yes')?.focus(), 20);
                        return;
                    }
                    if (s.foRightIdx >= 0 && s.foRightItems[s.foRightIdx]) window.jwtPickFoRight(s.foRightIdx);
                }
            });
        }
        if (sInp) {
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (s.foRightItems.length) {
                        e.preventDefault();
                        s.foRightIdx = e.key === 'ArrowDown' ? (s.foRightIdx + 1) % s.foRightItems.length : (s.foRightIdx - 1 + s.foRightItems.length) % s.foRightItems.length;
                        J.renderFoRightPanel(allBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && s.foRightItems[s.foRightIdx]) {
                    e.preventDefault();
                    window.jwtPickFoRight(s.foRightIdx);
                }
            });
        }
        if (qInp) qInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAddFoItem(); } });
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); J.commitFinalOutBatch(false); }
                else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); J.commitFinalOutBatch(true); }
                else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); window.jwtCancelFoAccept(); }
            });
        }
    };

    /* ========================================================================
       13. REGISTER, STOCK, FINAL OUT, BILLS CONTROLLERS
    ======================================================================== */
    window.jwtSetMenuIdx = (idx) => { if (J.s) J.s.menuIdx = J.safeInt(idx, 0); };

    window.jwtSelectJwGroup = (gKey) => { J.s.activeGroupKey = gKey; window.jwtGo('jw-workers'); };
    window.jwtSelectWorker = (wId) => { J.s.activeWorkerId = wId; window.jwtGo('jw-worker-menu'); };

    window.jwtOpenWorkerVoucher = (dir) => {
        const s = J.s;
        if (!s) return;
        s.vchDir = dir;
        s.vchBatch = [];
        s.vchAcceptOpen = false;
        s.vchPickStep = 'kariger';
        s.vchSelectedMaker = null;
        s.vchSelectedBatchKey = null;
        s.vchRightIdx = 0;
        const w = J.getSnapshot().workers.find((x) => x.id === s.activeWorkerId);
        const isOutst = (dir === 'out' && w && J.getGroupObj(w.group).outstation);
        const defFirm = J.getFirmProfile();
        s.vchMeta = {
            date: J.getTodayIso(),
            firmId: isOutst ? defFirm.id : '',
            firmName: isOutst ? defFirm.name : '',
            jwNo: isOutst ? J.getNextChallanNo() : '',
            transport: '',
            lrNo: '',
            designNote: ''
        };
        window.jwtGo('jw-voucher');
    };

    window.jwtOpenWorkerHist = () => {
        J.s.editWorkerRowInfo = null;
        J.s.regPrintRowInfo = null;
        J.s.regDateFrom = '';
        J.s.regDateTo = '';
        window.jwtGo('jw-worker-hist');
    };

    window.jwtEditWorkerRow = (sheetId, rowId) => {
        J.s.regPrintRowInfo = null;
        J.s.editWorkerRowInfo = { sheetId, rowId };
        J.renderScreen();
    };

    window.jwtCancelEditWorkerRow = () => {
        J.s.editWorkerRowInfo = null;
        J.renderScreen();
    };

    window.jwtAskRegPrint = (sheetId, rowId) => {
        J.s.editWorkerRowInfo = null;
        J.s.regPrintRowInfo = { sheetId, rowId };
        J.renderScreen();
    };

    window.jwtCloseRegPrint = () => {
        J.s.regPrintRowInfo = null;
        J.renderScreen();
    };

    window.jwtApplyRegDates = () => {
        J.s.regDateFrom = J.toIsoDate(document.getElementById('jwt-reg-from')?.value || '');
        J.s.regDateTo = J.toIsoDate(document.getElementById('jwt-reg-to')?.value || '');
        J.s.menuIdx = 0;
        J.renderScreen();
    };

    window.jwtClearRegDates = () => {
        J.s.regDateFrom = '';
        J.s.regDateTo = '';
        J.s.menuIdx = 0;
        J.renderScreen();
    };

    window.jwtOpenOwnerWorkerDetail = (wId) => { J.s.ownerWorkerId = wId; window.jwtGo('owner-worker-detail'); };
    window.jwtOpenOwnerGodamDetail = (encKey) => { J.s.ownerGodamSummaryKey = decodeURIComponent(encKey || ''); window.jwtGo('owner-godam-detail'); };

    window.jwtSetStockBucket = (b) => { J.s.stockBucketFilter = b; J.s.menuIdx = 0; J.renderScreen(); };
    window.jwtOpenStockDetail = (encKey) => { J.s.stockDetailKey = decodeURIComponent(encKey || ''); window.jwtGo('stock-detail'); };
    window.jwtToggleInward = () => {
        J.s.stockInwardOpen = !J.s.stockInwardOpen;
        const b = document.getElementById('jwt-inw-box');
        if (b) b.style.display = J.s.stockInwardOpen ? 'block' : 'none';
        if (J.s.stockInwardOpen) setTimeout(() => document.getElementById('jwt-inw-saree')?.focus(), 20);
    };
    window.jwtSaveInward = () => {
        return J.safeSave('isSavingInward', () => {
            const dDate = J.toIsoDate(document.getElementById('jwt-inw-date')?.value) || J.getTodayIso();
            const saree = J.normText(document.getElementById('jwt-inw-saree')?.value);
            const maker = J.normText(document.getElementById('jwt-inw-maker')?.value, 'DIRECT INWARD');
            const pcs = J.safeInt(document.getElementById('jwt-inw-pcs')?.value);
            const stage = document.getElementById('jwt-inw-stage')?.value || 'fresh';
            if (!saree || pcs <= 0) return J.toast('Saree Design aur Sahi Pcs bharein!', true);

            const activeG = J.getActiveGodam();
            const kid = (activeG && activeG !== 'all') ? activeG : 'k_main';
            const bucket = (stage === 'finished') ? 'finished' : (stage === 'lott' ? 'lott' : 'unfinished');
            const doneStages = (stage === 'fresh' || stage === 'lott') ? [] : (stage === 'finished' ? ['calender'] : [stage]);

            const sH = J.safeArr(J.getStoreSafe('saree_history')).slice();
            sH.push({
                id: J.genId('saree_man'), date: dDate, sareeName: saree, karigerName: maker, kariger: maker,
                partyName: maker, karkhanaId: kid, type: stage,
                typeLabel: `Direct Godown Inward (${J.formatTrail(doneStages, bucket)})`,
                aai: pcs, gai: 0, isOut: false, doneStages, stageBucket: bucket, note: 'Direct Inward', timestamp: Date.now()
            });
            J.setStoreSafe('saree_history', sH);
            J.s.stockInwardOpen = false;
            J.invalidateAllCaches();
            J.toast(`✅ ${pcs} Pcs [${saree}] jama ho gayi!`);
            J.renderScreen();
        });
    };

    window.jwtOpenFinalOut = () => window.jwtGo('final-out-menu');

    window.jwtOpenFinalOutEntry = () => {
        const s = J.s;
        if (!s) return;
        s.foBatch = []; s.foAcceptOpen = false; s.foPickStep = 'kariger';
        s.foSelectedMaker = null; s.foSelectedBatchKey = null; s.foRightIdx = 0; s.editFoId = null;
        window.jwtGo('final-out');
    };

    window.jwtOpenFinalOutReg = () => {
        J.s.editFoId = null;
        J.s.foRegDateFrom = '';
        J.s.foRegDateTo = '';
        window.jwtGo('final-out-reg');
    };

    window.jwtApplyFoRegDates = () => {
        J.s.foRegDateFrom = J.toIsoDate(document.getElementById('jwt-foreg-from')?.value || '');
        J.s.foRegDateTo = J.toIsoDate(document.getElementById('jwt-foreg-to')?.value || '');
        J.renderScreen();
    };

    window.jwtClearFoRegDates = () => {
        J.s.foRegDateFrom = '';
        J.s.foRegDateTo = '';
        J.renderScreen();
    };

    window.jwtEditFinalOut = (entryId) => { J.s.editFoId = entryId; J.renderScreen(); };
    window.jwtCancelFinalOutEdit = () => { J.s.editFoId = null; J.renderScreen(); };

    window.jwtOpenBillNew = () => {
        J.s.billSelectedWorkerId = null;
        J.s.billWorkerIdx = 0;
        J.s.billAcceptOpen = false;
        window.jwtGo('bills-new');
    };
    window.jwtOpenBillsList = (mode) => { J.s.billsListMode = mode || 'pending'; window.jwtGo('bills-list'); };
    window.jwtOpenBillDetail = (bId) => {
        J.s.activeBillId = bId;
        J.s.billPayAcceptOpen = false;
        window.jwtGo('bill-detail');
    };

    J.renderBillWorkerList = (q) => {
        const box = document.getElementById('jwt-b-wlist');
        if (!box || !J.s) return;
        const query = String(q || '').trim().toLowerCase();
        J.s.billWorkerItems = J.getSnapshot().workers.filter((w) => !query || `${w.name} ${J.grpLabel(w.group)}`.toLowerCase().includes(query));
        if (J.s.billWorkerIdx >= J.s.billWorkerItems.length) J.s.billWorkerIdx = 0;
        box.innerHTML = J.s.billWorkerItems.length
            ? J.s.billWorkerItems.map((w, i) => `
                <div class="jwt-side-opt ${i === J.s.billWorkerIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickBillWorker(${i})">
                    <span>${J.esc(w.name)}</span><small>${J.esc(J.grpLabel(w.group))}</small>
                </div>`).join('')
            : `<div style="padding:14px; text-align:center; color:#6b7280; font-size:12px;">Koi worker nahi mila.</div>`;
        box.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickBillWorker = (idx) => {
        const w = J.s.billWorkerItems[idx];
        if (!w) return;
        J.s.billSelectedWorkerId = w.id;
        const inp = document.getElementById('jwt-b-worker');
        if (inp) inp.value = w.name;
        document.getElementById('jwt-b-no')?.focus();
    };

    window.jwtAskBillAccept = () => {
        J.s.billAcceptOpen = true;
        const bar = document.getElementById('jwt-b-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-b-yes')?.focus(), 20);
    };
    window.jwtCancelBillAccept = () => {
        J.s.billAcceptOpen = false;
        const bar = document.getElementById('jwt-b-accept');
        if (bar) bar.style.display = 'none';
    };

    J.bindBillNewKeys = () => {
        const wInp = document.getElementById('jwt-b-worker');
        const order = ['jwt-b-date', 'jwt-b-worker', 'jwt-b-no', 'jwt-b-pcs', 'jwt-b-amt', 'jwt-b-paid', 'jwt-b-mode', 'jwt-b-note'];
        if (wInp) {
            wInp.addEventListener('input', () => { J.s.billWorkerIdx = 0; J.renderBillWorkerList(wInp.value); });
            wInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (J.s.billWorkerItems.length) {
                        e.preventDefault();
                        J.s.billWorkerIdx = e.key === 'ArrowDown' ? (J.s.billWorkerIdx + 1) % J.s.billWorkerItems.length : (J.s.billWorkerIdx - 1 + J.s.billWorkerItems.length) % J.s.billWorkerItems.length;
                        J.renderBillWorkerList(wInp.value);
                    }
                    return;
                }
                if (e.key === 'Enter' && J.s.billWorkerItems[J.s.billWorkerIdx]) { e.preventDefault(); window.jwtPickBillWorker(J.s.billWorkerIdx); }
            });
        }
        order.forEach((id, i) => {
            if (id === 'jwt-b-worker') return;
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) { const nxt = document.getElementById(order[i + 1]); nxt?.focus(); if (nxt?.select) nxt.select(); }
                    else window.jwtAskBillAccept();
                }
            });
        });
    };

    window.jwtSaveNewBill = () => {
        return J.safeSave('isSavingBill', () => {
            const dDate = J.toIsoDate(document.getElementById('jwt-b-date')?.value) || J.getTodayIso();
            const billNo = String(document.getElementById('jwt-b-no')?.value || '-').trim();
            const pcs = J.safeInt(document.getElementById('jwt-b-pcs')?.value);
            const amt = J.safeNum(document.getElementById('jwt-b-amt')?.value);
            const paidNow = Math.max(0, J.safeNum(document.getElementById('jwt-b-paid')?.value, 0));
            const mode = document.getElementById('jwt-b-mode')?.value || 'Cash';
            const note = String(document.getElementById('jwt-b-note')?.value || billNo).trim();
            const worker = J.getSnapshot().workers.find((w) => w.id === J.s.billSelectedWorkerId);

            if (!worker || amt <= 0) return J.toast('Worker aur Total Bill Amount (₹) bharein!', true);
            if (paidNow > amt) return J.toast('Paid Amount Total Bill se zyada nahi ho sakta!', true);

            const snapshot = {
                bills: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_bills_list')))),
                pays: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_payments_list'))))
            };
            let mutatedStorage = false;
            try {
                const billId = J.genId('bill');
                const bills = J.safeArr(J.getStoreSafe('jw_bills_list')).slice();
                bills.push({ id: billId, billNo, date: dDate, workerId: worker.id, workerName: worker.name, workType: worker.group, pcs, billAmt: amt, paidAmt: paidNow, note });
                mutatedStorage = true;
                J.setStoreSafe('jw_bills_list', bills);

                if (paidNow > 0) {
                    const pays = J.safeArr(J.getStoreSafe('jw_payments_list')).slice();
                    pays.push({ id: J.genId('pay'), billId, billNo, date: dDate, workerName: worker.name, amount: paidNow, mode, note: note || `Bill #${billNo} Payment` });
                    J.setStoreSafe('jw_payments_list', pays);
                }

                J.s.billAcceptOpen = false;
                J.invalidateAllCaches();
                const isPaidFull = (paidNow >= amt);
                J.toast(isPaidFull ? `✅ Bill #${billNo} Paid Bill me save ho gaya!` : `✅ Bill #${billNo} Pending Bill me save ho gaya!`);
                J.s.billsListMode = isPaidFull ? 'paid' : 'pending';
                J.jwtBackTo('bills-menu');
            } catch (err) {
                if (mutatedStorage) {
                    J.setStoreSafe('jw_bills_list', snapshot.bills);
                    J.setStoreSafe('jw_payments_list', snapshot.pays);
                    J.invalidateAllCaches();
                }
                throw err;
            }
        });
    };

    window.jwtAskBpAccept = () => {
        J.s.billPayAcceptOpen = true;
        const bar = document.getElementById('jwt-bp-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-bp-yes')?.focus(), 20);
    };
    window.jwtCancelBpAccept = () => {
        J.s.billPayAcceptOpen = false;
        const bar = document.getElementById('jwt-bp-accept');
        if (bar) bar.style.display = 'none';
    };

    J.bindBillPayKeys = () => {
        const order = ['jwt-bp-date', 'jwt-bp-amt', 'jwt-bp-mode', 'jwt-bp-note'];
        order.forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) { const nxt = document.getElementById(order[i + 1]); nxt?.focus(); if (nxt?.select) nxt.select(); }
                    else window.jwtAskBpAccept();
                }
            });
        });
    };

    window.jwtSaveBillPayment = (billId) => {
        return J.safeSave('isSavingBill', () => {
            const dDate = J.toIsoDate(document.getElementById('jwt-bp-date')?.value) || J.getTodayIso();
            const amt = J.safeNum(document.getElementById('jwt-bp-amt')?.value);
            const mode = document.getElementById('jwt-bp-mode')?.value || 'Cash';
            const note = String(document.getElementById('jwt-bp-note')?.value || '').trim();
            if (amt <= 0) return J.toast('Sahi Amount daalein!', true);

            const snapshot = {
                bills: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_bills_list')))),
                pays: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_payments_list'))))
            };

            let targetBill = null;
            const bills = J.safeArr(J.getStoreSafe('jw_bills_list')).map((b) => {
                if (String(b.id) !== String(billId)) return b;
                targetBill = { ...b, paidAmt: J.safeNum(b.paidAmt) + amt };
                return targetBill;
            });
            if (!targetBill) return;

            let mutatedStorage = false;
            try {
                const pays = J.safeArr(J.getStoreSafe('jw_payments_list')).slice();
                pays.push({ id: J.genId('pay'), billId, billNo: targetBill.billNo || '-', date: dDate, workerName: targetBill.workerName, amount: amt, mode, note });
                mutatedStorage = true;
                J.setStoreSafe('jw_bills_list', bills);
                J.setStoreSafe('jw_payments_list', pays);
                J.s.billPayAcceptOpen = false;
                J.invalidateAllCaches();
                J.toast(`✅ ₹ ${amt.toFixed(2)} Payment save ho gaya!`);
                J.renderScreen();
            } catch (err) {
                if (mutatedStorage) {
                    J.setStoreSafe('jw_bills_list', snapshot.bills);
                    J.setStoreSafe('jw_payments_list', snapshot.pays);
                    J.invalidateAllCaches();
                }
                throw err;
            }
        });
    };

    window.jwtDeleteBillPay = (payId, billId) => {
        return J.safeSave('isDeleting', () => {
            const snapshot = {
                bills: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_bills_list')))),
                pays: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_payments_list'))))
            };
            const pays = J.safeArr(J.getStoreSafe('jw_payments_list'));
            const targetP = pays.find((p) => String(p.id) === String(payId));
            if (!targetP) return;

            const bills = J.safeArr(J.getStoreSafe('jw_bills_list')).map((b) => {
                if (String(b.id) !== String(billId)) return b;
                return { ...b, paidAmt: Math.max(0, J.safeNum(b.paidAmt) - J.safeNum(targetP.amount)) };
            });

            let mutatedStorage = false;
            try {
                mutatedStorage = true;
                J.setStoreSafe('jw_bills_list', bills);
                J.setStoreSafe('jw_payments_list', pays.filter((p) => String(p.id) !== String(payId)));
                J.invalidateAllCaches();
                J.toast('Payment delete ho gaya!');
                J.renderScreen();
            } catch (err) {
                if (mutatedStorage) {
                    J.setStoreSafe('jw_bills_list', snapshot.bills);
                    J.setStoreSafe('jw_payments_list', snapshot.pays);
                    J.invalidateAllCaches();
                }
                throw err;
            }
        });
    };

    window.jwtDeleteBill = (billId) => {
        return J.safeSave('isDeleting', () => {
            const snapshot = {
                bills: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_bills_list')))),
                pays: JSON.parse(JSON.stringify(J.safeArr(J.getStoreSafe('jw_payments_list'))))
            };
            const bills = J.safeArr(J.getStoreSafe('jw_bills_list')).filter((b) => String(b.id) !== String(billId));
            const pays = J.safeArr(J.getStoreSafe('jw_payments_list')).filter((p) => String(p.billId) !== String(billId));

            let mutatedStorage = false;
            try {
                mutatedStorage = true;
                J.setStoreSafe('jw_bills_list', bills);
                J.setStoreSafe('jw_payments_list', pays);
                J.s.activeBillId = null;
                J.s.billPayAcceptOpen = false;
                J.invalidateAllCaches();
                J.toast('Bill delete ho gaya!');
                J.jwtBackTo('bills-list');
            } catch (err) {
                if (mutatedStorage) {
                    J.setStoreSafe('jw_bills_list', snapshot.bills);
                    J.setStoreSafe('jw_payments_list', snapshot.pays);
                    J.invalidateAllCaches();
                }
                throw err;
            }
        });
    };

    window.jwtFilterList = () => {
        const active = document.activeElement;
        const aId = active?.id;
        const aVal = active?.value || '';
        const pos = active?.selectionStart || aVal.length;
        J.s.menuIdx = 0;
        J.renderScreen();
        if (aId) {
            const el = document.getElementById(aId);
            if (el) {
                el.value = aVal;
                el.focus();
                try { el.setSelectionRange(pos, pos); } catch (_) {}
            }
        }
    };

    J.bindSearchKey = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
    };

    /* ========================================================================
       14. STRICT HIERARCHICAL ESC & TALLY KEYBOARD ENGINE
    ======================================================================== */
    window.jwtHandleEsc = () => {
        const s = J.s;
        if (!s) {
            if (typeof window.backToDashboard === 'function') window.backToDashboard();
            return;
        }
        if (s.curView === 'jw-voucher') {
            if (s.vchAcceptOpen) { window.jwtCancelVchAccept(); return; }
            if (s.vchPickStep === 'stage') {
                s.vchPickStep = 'kariger';
                s.vchSelectedMaker = null;
                s.vchRightIdx = 0;
                const kInp = document.getElementById('jwt-vch-kariger');
                const sInp = document.getElementById('jwt-vch-stage');
                if (kInp) kInp.value = '';
                if (sInp) sInp.value = '';
                const snap = J.getSnapshot();
                const w = snap.workers.find((x) => x.id === s.activeWorkerId);
                const src = (s.vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
                J.renderVchRightPanel(src);
                kInp?.focus();
                return;
            }
            J.jwtBackTo('jw-worker-menu');
            return;
        }
        if (s.curView === 'final-out') {
            if (s.foAcceptOpen) { window.jwtCancelFoAccept(); return; }
            if (s.foPickStep === 'stage') {
                s.foPickStep = 'kariger';
                s.foSelectedMaker = null;
                s.foRightIdx = 0;
                const kInp = document.getElementById('jwt-fo-kariger');
                const sInp = document.getElementById('jwt-fo-stage');
                if (kInp) kInp.value = '';
                if (sInp) sInp.value = '';
                J.renderFoRightPanel(J.getSnapshot().godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0));
                kInp?.focus();
                return;
            }
            J.jwtBackTo('final-out-menu');
            return;
        }
        if (s.curView === 'final-out-reg') {
            if (s.editFoId) { s.editFoId = null; J.renderScreen(); return; }
            J.jwtBackTo('final-out-menu');
            return;
        }
        if (s.curView === 'final-out-menu') { J.jwtBackTo('gateway'); return; }
        if (s.curView === 'bill-detail') {
            if (s.billPayAcceptOpen) { window.jwtCancelBpAccept(); return; }
            J.jwtBackTo('bills-list');
            return;
        }
        if (s.curView === 'bills-new') {
            if (s.billAcceptOpen) { window.jwtCancelBillAccept(); return; }
            J.jwtBackTo('bills-menu');
            return;
        }
        if (s.curView === 'bills-list') { J.jwtBackTo('bills-menu'); return; }
        if (s.curView === 'bills-menu') { J.jwtBackTo('gateway'); return; }

        if (s.curView === 'jw-worker-hist') {
            if (s.regPrintRowInfo) { s.regPrintRowInfo = null; J.renderScreen(); return; }
            if (s.editWorkerRowInfo) { s.editWorkerRowInfo = null; J.renderScreen(); return; }
            J.jwtBackTo('jw-worker-menu');
            return;
        }
        if (s.curView === 'jw-worker-menu') { J.jwtBackTo('jw-workers'); return; }
        if (s.curView === 'jw-workers') { J.jwtBackTo('jw-groups'); return; }
        if (s.curView === 'jw-groups') { J.jwtBackTo('gateway'); return; }

        if (s.curView === 'owner-worker-detail') { J.jwtBackTo('owner-workers'); return; }
        if (s.curView === 'owner-godam-detail') { J.jwtBackTo('owner-godam'); return; }
        if (s.curView === 'owner-workers' || s.curView === 'owner-godam') { J.jwtBackTo('owner-menu'); return; }
        if (s.curView === 'owner-menu') {
            if (s.entryRoot === 'external') {
                s.entryRoot = 'gateway';
                if (window.__slReturnToStockSummary && typeof window.openStockSummaryModule === 'function') {
                    window.__slReturnToStockSummary = false;
                    window.openStockSummaryModule();
                } else if (typeof window.backToDashboard === 'function') {
                    window.backToDashboard();
                }
                return;
            }
            J.jwtBackTo('gateway');
            return;
        }

        if (s.curView === 'stock-detail') { J.jwtBackTo('stock-list'); return; }
        if (s.curView === 'stock-list') {
            if (s.stockInwardOpen) { window.jwtToggleInward(); return; }
            J.jwtBackTo('gateway');
            return;
        }

        if (typeof window.backToDashboard === 'function') window.backToDashboard();
    };

    J.handleKeyDown = (e) => {
        const s = J.s;
        if (!s) return;
        if (document.getElementById('master-jobwork-express-modal')) return;

        const sec = document.getElementById('jw-trail-section');
        if (!sec || sec.style.display === 'none') return;

        const anyModal = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display && m.style.display !== 'none');
        if (anyModal) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.jwtHandleEsc();
            return;
        }

        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault(); e.stopImmediatePropagation();
            window.jwtPrintCurrentScreen();
            return;
        }
        if (e.altKey && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault(); e.stopImmediatePropagation();
            window.jwtPrintLastPackingSlip();
            return;
        }

        if (s.billAcceptOpen && s.curView === 'bills-new') {
            if (e.key.toLowerCase() === 'y' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtSaveNewBill(); }
            else if (e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtCancelBillAccept(); }
            return;
        }
        if (s.billPayAcceptOpen && s.curView === 'bill-detail') {
            if (e.key.toLowerCase() === 'y' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); document.getElementById('jwt-bp-yes')?.click(); }
            else if (e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtCancelBpAccept(); }
            return;
        }

        if (s.curView === 'jw-worker-hist' && s.regPrintRowInfo) {
            const k = e.key.toLowerCase();
            if (k === 'p') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtPrintWorkerRow(s.regPrintRowInfo.sheetId, s.regPrintRowInfo.rowId, 'challan'); return; }
            if (k === 'l') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtPrintWorkerRow(s.regPrintRowInfo.sheetId, s.regPrintRowInfo.rowId, 'slip'); return; }
            if (k === 'b') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtPrintWorkerRow(s.regPrintRowInfo.sheetId, s.regPrintRowInfo.rowId, 'both'); return; }
            if (k === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtCloseRegPrint(); return; }
        }

        if (e.ctrlKey && e.key === 'Enter') {
            if (s.curView === 'jw-voucher' && s.vchBatch.length) { e.preventDefault(); J.commitVchBatch(''); return; }
            if (s.curView === 'final-out' && s.foBatch.length) { e.preventDefault(); J.commitFinalOutBatch(false); return; }
            if (s.curView === 'bills-new') { e.preventDefault(); window.jwtAskBillAccept(); return; }
            if (s.curView === 'bill-detail') { e.preventDefault(); window.jwtAskBpAccept(); return; }
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const typing = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (!typing && e.key === '/') {
            const sBox = sec.querySelector('input[id$="-search"]');
            if (sBox) { e.preventDefault(); sBox.focus(); sBox.select(); return; }
        }

        if (s.curView === 'jw-worker-hist' && !s.editWorkerRowInfo && !s.regPrintRowInfo && !typing) {
            const rows = Array.from(sec.querySelectorAll('tbody tr.jwt-row'));
            const activeRow = rows[s.menuIdx];
            if (activeRow) {
                if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    window.jwtEditWorkerRow(activeRow.dataset.shid, activeRow.dataset.rid);
                    return;
                }
                if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    if (activeRow.dataset.outst === '1') window.jwtAskRegPrint(activeRow.dataset.shid, activeRow.dataset.rid);
                    else window.jwtPrintWorkerRow(activeRow.dataset.shid, activeRow.dataset.rid, 'challan');
                    return;
                }
                if (e.key === 'l' || e.key === 'L') {
                    e.preventDefault();
                    window.jwtPrintWorkerRow(activeRow.dataset.shid, activeRow.dataset.rid, 'slip');
                    return;
                }
                if ((e.key === 'b' || e.key === 'B') && activeRow.dataset.outst === '1') {
                    e.preventDefault();
                    window.jwtPrintWorkerRow(activeRow.dataset.shid, activeRow.dataset.rid, 'both');
                    return;
                }
            }
        }

        const navViews = [
            'gateway', 'jw-groups', 'jw-workers', 'jw-worker-menu', 'jw-worker-hist',
            'owner-menu', 'owner-workers', 'owner-godam', 'stock-list',
            'final-out-menu', 'bills-menu', 'bills-list'
        ];

        if (navViews.includes(s.curView) && !typing) {
            const rows = Array.from(sec.querySelectorAll('.jwt-menu-item, tbody tr.jwt-row'));
            if (rows.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    rows[s.menuIdx]?.classList.remove('active');
                    s.menuIdx = (s.menuIdx + 1) % rows.length;
                    rows[s.menuIdx]?.classList.add('active');
                    rows[s.menuIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    rows[s.menuIdx]?.classList.remove('active');
                    s.menuIdx = (s.menuIdx - 1 + rows.length) % rows.length;
                    rows[s.menuIdx]?.classList.add('active');
                    rows[s.menuIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }
                if (e.key === 'Enter' && typeof J.isNavGuarded === 'function' && !J.isNavGuarded() && s.curView !== 'jw-worker-hist') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    rows[s.menuIdx]?.click();
                    return;
                }
            }

            if (s.curView === 'gateway' && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const k = e.key.toLowerCase();
                const match = Array.from(sec.querySelectorAll('.jwt-menu-item')).find((b) => b.dataset.key === k);
                if (match) { e.preventDefault(); e.stopImmediatePropagation(); match.click(); }
            }
        }
    };

    /* ========================================================================
       15. ENTRY POINTS & LEGACY ERP BRIDGE
    ======================================================================== */
    J.openModuleAt = (startView, entryRoot = 'gateway') => {
        if (!J.s) J.s = {};
        J.s.cachedSnapshot = null;
        J.s.entryRoot = entryRoot;
        if (typeof J.ensureSectionDOM === 'function') J.ensureSectionDOM();
        document.querySelectorAll('.module-section').forEach((secEl) => { secEl.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('jw-trail-section');
        if (sec) sec.style.display = 'block';
        if (typeof window.jwtGo === 'function') window.jwtGo(startView || 'gateway');
    };

    window.openJobWorkModule = () => J.openModuleAt('gateway', 'gateway');
    window.openSareeModule = () => J.openModuleAt('owner-menu', 'external');
    J.syncTallyMasterGroups = () => {};

    if (!window._jwtCtrlHooksBound) {
        window._jwtCtrlHooksBound = true;

        const origInvalidateJw = window.invalidateJobWorkCache;
        window.invalidateJobWorkCache = (workerId) => {
            if (J.s) J.s.cachedSnapshot = null;
            if (typeof origInvalidateJw === 'function') origInvalidateJw(workerId);
        };

        const origInvalidateSaree = window.invalidateSareeCalcCache;
        window.invalidateSareeCalcCache = () => {
            if (J.s) J.s.cachedSnapshot = null;
            if (typeof origInvalidateSaree === 'function') origInvalidateSaree();
        };

        const origTriggerRefresh = window.triggerActiveSectionRefresh;
        window.triggerActiveSectionRefresh = () => {
            if (J.s) J.s.cachedSnapshot = null;
            if (typeof origTriggerRefresh === 'function') origTriggerRefresh();
            const sec = document.getElementById('jw-trail-section');
            if (!sec || sec.style.display === 'none' || typeof J.renderScreen !== 'function') return;

            const s = J.s || {};
            const isEditingForm = (
                s.curView === 'jw-voucher' ||
                s.curView === 'final-out' ||
                s.curView === 'bills-new' ||
                Boolean(s.editWorkerRowInfo) ||
                Boolean(s.editFoId) ||
                Boolean(s.stockInwardOpen) ||
                Boolean(s.billAcceptOpen) ||
                Boolean(s.billPayAcceptOpen) ||
                Boolean(s.vchAcceptOpen) ||
                Boolean(s.foAcceptOpen)
            );
            const activeTag = document.activeElement?.tagName || '';
            const isTypingInSection = sec.contains(document.activeElement) && (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA');
            if (!isEditingForm && !isTypingInSection) {
                J.renderScreen();
            }
        };
    }

    if (window._jwtCtrlKeyHandler) {
        window.removeEventListener('keydown', window._jwtCtrlKeyHandler, true);
    }
    window._jwtCtrlKeyHandler = J.handleKeyDown;
    window.addEventListener('keydown', window._jwtCtrlKeyHandler, true);

    const initJwtControllers = () => {
        if (typeof J.ensureSectionDOM === 'function') J.ensureSectionDOM();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJwtControllers);
    } else {
        initJwtControllers();
    }
})();
