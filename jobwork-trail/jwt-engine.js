/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 2/6: ENGINE & DATA MUTATIONS)
   File: jobwork-trail/jwt-engine.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    /* ========================================================================
       5. UNIFIED RECONCILIATION ENGINE
    ======================================================================== */
    J.computeLiveState = (godamFilter = 'all') => {
        const groups = J.getWorkGroups();
        const workersRaw = J.safeArr(J.getStoreSafe('jobwork_workers'));
        const karigerMeta = new Map();
        J.safeArr(J.getStoreSafe('kariger_list')).forEach((k) => {
            if (k && k.name) {
                karigerMeta.set(J.normText(k.name), {
                    saree: J.normText(k.saree, 'GENERAL SAREE'),
                    karkhanaId: J.normGodam(k.karkhanaId || 'k_main')
                });
            }
        });

        const sareeHist = J.safeArr(J.getStoreSafe('saree_history'));
        const activeFilter = godamFilter || 'all';
        const godamMap = new Map();
        const untrailedOuts = [];

        const chronoHist = sareeHist.slice().sort((a, b) => {
            const ta = J.safeNum(a.timestamp, 0);
            const tb = J.safeNum(b.timestamp, 0);
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        chronoHist.forEach((h) => {
            if (!h) return;
            const kid = J.normGodam(h.karkhanaId);
            if (activeFilter !== 'all' && kid !== activeFilter) return;

            const sName = J.normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
            const kName = J.normText(h.karigerName || h.kariger, 'KARKHANA');
            const bucket = h.stageBucket || J.inferBucketFromLegacyType(h.type);
            const hasExplicitTrail = Array.isArray(h.doneStages);
            const doneStages = J.inferStagesFromRow(h);
            const trailKey = doneStages.join('|');
            const isOut = (h.isOut === true) || (J.safeNum(h.gai) > 0);
            const qty = isOut ? J.safeInt(h.gai != null ? h.gai : h.pcs) : J.safeInt(h.aai != null ? h.aai : h.pcs);
            if (qty <= 0) return;

            const bKey = `${sName}|||${kName}|||${kid}|||${bucket}|||${trailKey}`;
            if (!isOut) {
                let b = godamMap.get(bKey);
                if (!b) {
                    b = {
                        key: bKey,
                        summaryKey: `${sName}|||${kName}|||${kid}|||${bucket}`,
                        saree: sName, maker: kName, karkhanaId: kid,
                        godamName: J.getGodamLabel(kid), bucket, doneStages: [...doneStages], trailKey,
                        pcs: 0, lastDate: h.date || ''
                    };
                    godamMap.set(bKey, b);
                }
                b.pcs += qty;
                if (h.date && (!b.lastDate || h.date > b.lastDate)) b.lastDate = h.date;
            } else {
                const exact = godamMap.get(bKey);
                if (exact && exact.pcs >= qty) exact.pcs -= qty;
                else if (hasExplicitTrail && exact) exact.pcs = Math.max(0, exact.pcs - qty);
                else untrailedOuts.push({ sName, kName, kid, bucket, qty });
            }
        });

        untrailedOuts.forEach((out) => {
            let rem = out.qty;
            for (const b of godamMap.values()) {
                if (rem <= 0) break;
                if (b.saree === out.sName && b.maker === out.kName && b.karkhanaId === out.kid && b.bucket === out.bucket && b.pcs > 0) {
                    const take = Math.min(b.pcs, rem);
                    b.pcs -= take;
                    rem -= take;
                }
            }
            if (rem > 0) {
                for (const b of godamMap.values()) {
                    if (rem <= 0) break;
                    if (b.saree === out.sName && b.karkhanaId === out.kid && b.bucket === out.bucket && b.pcs > 0) {
                        const take = Math.min(b.pcs, rem);
                        b.pcs -= take;
                        rem -= take;
                    }
                }
            }
        });

        const godamBatches = Array.from(godamMap.values()).filter((b) => b.pcs > 0);
        const godamSummaryMap = new Map();
        godamBatches.forEach((b) => {
            let sg = godamSummaryMap.get(b.summaryKey);
            if (!sg) {
                sg = {
                    summaryKey: b.summaryKey, saree: b.saree, maker: b.maker,
                    karkhanaId: b.karkhanaId, godamName: b.godamName, bucket: b.bucket, pcs: 0, batches: []
                };
                godamSummaryMap.set(b.summaryKey, sg);
            }
            sg.pcs += b.pcs;
            sg.batches.push(b);
        });
        const godamSummaries = Array.from(godamSummaryMap.values());

        const workers = [];
        const pendingBatches = [];

        workersRaw.forEach((w) => {
            if (!w || !w.id || !w.name) return;
            const wGroup = String(w.type || 'cutting').trim().toLowerCase();
            const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${w.id}`));

            let diya = 0, aai = 0;
            const openingPend = sheets.length ? J.safeInt(sheets[0].closingPendingSaree, 0) : 0;
            const pMap = new Map();

            const addPending = (saree, maker, kid, stages, qty) => {
                if (qty <= 0) return;
                const sN = J.normText(saree, 'GENERAL SAREE');
                const mN = J.normText(maker, 'KARKHANA');
                const kId = J.normGodam(kid);
                const st = Array.isArray(stages) ? stages : [];
                const tKey = st.join('|');
                const pKey = `${w.id}|||${sN}|||${mN}|||${kId}|||${tKey}`;
                let ex = pMap.get(pKey);
                if (!ex) {
                    ex = {
                        key: pKey, workerId: String(w.id), workerName: w.name, workerGroup: wGroup,
                        saree: sN, maker: mN, karkhanaId: kId, godamName: J.getGodamLabel(kId),
                        doneStages: [...st], trailKey: tKey, pcs: 0
                    };
                    pMap.set(pKey, ex);
                }
                ex.pcs += qty;
            };

            const deductPending = (saree, maker, kid, prevStages, qty) => {
                let rem = qty;
                if (rem <= 0) return;
                const sN = saree ? J.normText(saree) : null;
                const mN = maker ? J.normText(maker) : null;
                const kId = kid ? J.normGodam(kid) : null;

                if (Array.isArray(prevStages) && sN && mN && kId) {
                    const ex = pMap.get(`${w.id}|||${sN}|||${mN}|||${kId}|||${prevStages.join('|')}`);
                    if (ex && ex.pcs > 0) { const t = Math.min(ex.pcs, rem); ex.pcs -= t; rem -= t; }
                }
                if (rem > 0 && mN) {
                    for (const ex of pMap.values()) {
                        if (rem <= 0) break;
                        if (ex.pcs > 0 && ex.maker === mN && (!sN || ex.saree === sN)) {
                            const t = Math.min(ex.pcs, rem); ex.pcs -= t; rem -= t;
                        }
                    }
                }
                if (rem > 0) {
                    for (const ex of pMap.values()) {
                        if (rem <= 0) break;
                        if (ex.pcs > 0) { const t = Math.min(ex.pcs, rem); ex.pcs -= t; rem -= t; }
                    }
                }
            };

            sheets.forEach((sh) => {
                J.safeArr(sh?.rows).forEach((r) => {
                    if (!r) return;
                    const gItems = J.safeArr(r.gayiItems);
                    if (gItems.length) {
                        gItems.forEach((it) => {
                            const q = J.safeInt(it.qty);
                            if (q <= 0) return;
                            const mName = J.normText(it.karigar || it.maker, 'KARKHANA');
                            const meta = karigerMeta.get(mName) || { saree: 'GENERAL SAREE', karkhanaId: 'k_main' };
                            const sName = J.normText(it.saree || meta.saree, 'GENERAL SAREE');
                            const kid = J.normGodam(it.karkhanaId || meta.karkhanaId || 'k_main');
                            const stages = Array.isArray(it.doneStages) ? it.doneStages : J.inferStagesFromRow({ type: it.source || r.stockSource || 'fresh' });
                            diya += q;
                            if (activeFilter === 'all' || kid === activeFilter) addPending(sName, mName, kid, stages, q);
                        });
                    } else if (J.safeInt(r.gayiQty) > 0) {
                        const q = J.safeInt(r.gayiQty);
                        diya += q;
                        if (activeFilter === 'all' || activeFilter === 'k_main') addPending('GENERAL SAREE', 'KARKHANA', 'k_main', [], q);
                    }

                    const aItems = J.safeArr(r.aayiItems);
                    if (aItems.length) {
                        aItems.forEach((it) => {
                            const q = J.safeInt(it.qty);
                            if (q <= 0) return;
                            aai += q;
                            const mName = it.karigar || it.maker ? J.normText(it.karigar || it.maker) : null;
                            const sName = it.saree ? J.normText(it.saree) : null;
                            const kid = it.karkhanaId ? J.normGodam(it.karkhanaId) : null;
                            if (activeFilter === 'all' || !kid || kid === activeFilter) deductPending(sName, mName, kid, it.prevStages, q);
                        });
                        if (J.safeInt(r.damagePcs) > 0 && !aItems.some((it) => it.isDamage)) {
                            const dq = J.safeInt(r.damagePcs); aai += dq; deductPending(null, null, null, null, dq);
                        }
                    } else {
                        const aq = J.safeInt(r.aayiQty), dq = J.safeInt(r.damagePcs);
                        if (aq > 0) { aai += aq; deductPending(null, null, null, null, aq); }
                        if (dq > 0) { aai += dq; deductPending(null, null, null, null, dq); }
                    }
                });
            });

            if (openingPend > 0) {
                diya += openingPend;
                const curMapSum = Array.from(pMap.values()).reduce((s, x) => s + x.pcs, 0);
                const expectedNet = Math.max(0, diya - aai);
                if (expectedNet > curMapSum && (activeFilter === 'all' || activeFilter === 'k_main')) {
                    addPending('OPENING SAREE', 'PICHLA BAKI', 'k_main', [], expectedNet - curMapSum);
                }
            }

            const workerPendList = Array.from(pMap.values()).filter((p) => p.pcs > 0);
            workerPendList.forEach((p) => pendingBatches.push(p));

            workers.push({
                id: String(w.id),
                name: w.name,
                group: wGroup,
                mobile: w.mobile || '',
                address: w.address || '',
                gst: w.gst || '',
                date: w.date || '',
                diya,
                aai,
                pending: workerPendList.reduce((s, p) => s + p.pcs, 0),
                pendingItems: workerPendList
            });
        });

        const rawPcs = godamBatches.filter((b) => b.bucket === 'unfinished').reduce((s, b) => s + b.pcs, 0);
        const pendPcs = pendingBatches.reduce((s, p) => s + p.pcs, 0);
        const finPcs = godamBatches.filter((b) => b.bucket === 'finished').reduce((s, b) => s + b.pcs, 0);
        const lottPcs = godamBatches.filter((b) => b.bucket === 'lott').reduce((s, b) => s + b.pcs, 0);

        J.s.cachedSnapshot = {
            godamFilter: activeFilter,
            groups,
            workers,
            godamBatches,
            godamSummaries,
            pendingBatches,
            totals: { raw: rawPcs, pending: pendPcs, finished: finPcs, lott: lottPcs, total: rawPcs + pendPcs + finPcs + lottPcs }
        };
        return J.s.cachedSnapshot;
    };

    J.getSnapshot = () => {
        const gF = J.getActiveGodam();
        if (J.s.cachedSnapshot && J.s.cachedSnapshot.godamFilter === gF) return J.s.cachedSnapshot;
        return J.computeLiveState(gF);
    };

    /* ========================================================================
       6. SHARED 2-STEP PICKER HELPERS
    ======================================================================== */
    J.getBatchUsedQty = (batchArr, batchKey) => batchArr.filter((x) => x.batchKey === batchKey).reduce((s, x) => s + J.safeInt(x.qty), 0);

    J.buildKarigerPickerList = (batches, usedBatchArr, query = '') => {
        const q = String(query || '').trim().toLowerCase();
        const kMap = new Map();
        batches.forEach((b) => {
            const avail = b.pcs - J.getBatchUsedQty(usedBatchArr, b.key);
            if (avail <= 0) return;
            let ex = kMap.get(b.maker);
            if (!ex) { ex = { maker: b.maker, totalPcs: 0, stagesCount: 0, sarees: new Set() }; kMap.set(b.maker, ex); }
            ex.totalPcs += avail;
            ex.stagesCount += 1;
            ex.sarees.add(b.saree);
        });
        return Array.from(kMap.values())
            .filter((k) => !q || `${k.maker} ${Array.from(k.sarees).join(' ')}`.toLowerCase().includes(q))
            .sort((a, b) => a.maker.localeCompare(b.maker));
    };

    J.buildStagePickerList = (batches, makerName, usedBatchArr) => {
        return batches
            .filter((b) => b.maker === makerName)
            .map((b) => ({ ...b, availPcs: b.pcs - J.getBatchUsedQty(usedBatchArr, b.key) }))
            .filter((b) => b.availPcs > 0);
    };

    /* ========================================================================
       7. DATA MUTATIONS
    ======================================================================== */
    J.ensureWorkerSheet = (workerId) => {
        const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${workerId}`)).slice();
        if (!sheets.length) {
            sheets.push({
                id: `jw_sh_${Date.now()}`,
                title: `Month 1 (${J.getTodayIso().slice(0, 7)})`,
                closingPendingSaree: 0,
                closingBakiAmt: 0,
                rows: []
            });
        }
        const last = { ...sheets[sheets.length - 1] };
        last.rows = J.safeArr(last.rows).slice();
        sheets[sheets.length - 1] = last;
        return { sheets, lastSheet: last };
    };

    J.rebuildWorkerRowSareeHistory = (sH, worker, rowObj) => {
        const refId = String(rowObj.id);
        const filtered = sH.filter((h) => !h || String(h.refId) !== refId);
        const gLabel = J.grpLabel(worker.group);
        const targetLabel = `${worker.name} (${gLabel})`;
        const dDate = J.toIsoDate(rowObj.date) || J.getTodayIso();
        const now = Date.now();

        J.safeArr(rowObj.gayiItems).forEach((it, idx) => {
            const stages = Array.isArray(it.doneStages) ? it.doneStages : [];
            filtered.push({
                id: `sh_jw_out_${refId}_${idx}`,
                refId, date: dDate,
                sareeName: it.saree || 'GENERAL SAREE',
                karigerName: it.karigar || 'KARKHANA',
                kariger: it.karigar || 'KARKHANA',
                partyName: targetLabel, targetWorker: targetLabel,
                karkhanaId: it.karkhanaId || 'k_main',
                type: J.legacyTypeFromTrail(stages, 'unfinished'),
                typeLabel: `📤 ${targetLabel} Out [${J.formatTrail(stages, 'unfinished')}]`,
                aai: 0, gai: J.safeInt(it.qty), isOut: true,
                doneStages: [...stages], stageBucket: 'unfinished',
                workerId: worker.id, note: rowObj.jwNo ? `${rowObj.jwNo} (${gLabel} Out)` : `${gLabel} Out`,
                timestamp: now + idx
            });
        });

        J.safeArr(rowObj.aayiItems).forEach((it, idx) => {
            const stages = Array.isArray(it.doneStages) ? it.doneStages : [worker.group];
            const bucket = it.destBucket || (it.isDamage ? 'lott' : 'unfinished');
            const icon = bucket === 'finished' ? '✨' : (bucket === 'lott' ? '⚠️' : '✅');
            filtered.push({
                id: `sh_jw_in_${refId}_${idx}`,
                refId, date: dDate,
                sareeName: it.saree || 'GENERAL SAREE',
                karigerName: it.karigar || 'KARKHANA',
                kariger: it.karigar || 'KARKHANA',
                partyName: targetLabel, targetWorker: targetLabel,
                karkhanaId: it.karkhanaId || 'k_main',
                type: J.legacyTypeFromTrail(stages, bucket),
                typeLabel: `${icon} ${targetLabel} In [${J.formatTrail(stages, bucket)}]`,
                aai: J.safeInt(it.qty), gai: 0, isOut: false,
                doneStages: [...stages], stageBucket: bucket,
                workerId: worker.id, note: `${gLabel} In`,
                timestamp: now + idx
            });
        });

        return filtered;
    };

    J.syncVchMetaFromDom = () => {
        const dEl = document.getElementById('jwt-vch-date');
        const jEl = document.getElementById('jwt-vch-jwno');
        const tEl = document.getElementById('jwt-vch-trans');
        const lEl = document.getElementById('jwt-vch-lr');
        const nEl = document.getElementById('jwt-vch-design');
        if (dEl) J.s.vchMeta.date = dEl.value || J.getTodayIso();
        if (jEl) J.s.vchMeta.jwNo = jEl.value;
        if (tEl) J.s.vchMeta.transport = tEl.value;
        if (lEl) J.s.vchMeta.lrNo = lEl.value;
        if (nEl) J.s.vchMeta.designNote = nEl.value;
    };

    J.buildOutstationPayloadFromRow = (worker, row) => {
        const items = J.safeArr(row.gayiItems);
        const sareeMap = new Map();
        items.forEach((it) => {
            const s = it.saree || 'GENERAL SAREE';
            sareeMap.set(s, (sareeMap.get(s) || 0) + J.safeInt(it.qty));
        });
        return {
            isOutstation: true,
            title: 'JOB WORK CHALLAN',
            groupLabel: J.grpLabel(worker.group),
            firm: J.getFirmProfile(),
            worker: {
                name: worker.name,
                address: worker.address || '',
                mobile: worker.mobile || '',
                gst: worker.gst || ''
            },
            jwNo: row.jwNo || J.getNextChallanNo(),
            date: row.date,
            transport: row.transport || '-',
            lrNo: row.lrNo || '-',
            designNote: row.designNote || '-',
            sareeRows: Array.from(sareeMap.entries()).map(([saree, pcs]) => ({ saree, pcs })),
            totalPcs: J.safeInt(row.gayiQty),
            items: items.map((x) => ({
                maker: x.karigar || '-',
                saree: x.saree || 'Saree',
                trail: J.formatTrail(x.doneStages || [], 'unfinished'),
                qty: J.safeInt(x.qty)
            }))
        };
    };

    J.commitVchBatch = (printType = '') => {
        if (J.s.isSaving) return;
        J.syncVchMetaFromDom();
        if (!J.s.vchBatch.length) return J.toast('Batch khali hai! Pehle kam se kam 1 saree add karein.', true);

        const snap = J.getSnapshot();
        const worker = snap.workers.find((w) => w.id === J.s.activeWorkerId);
        if (!worker) return J.toast('Worker nahi mila!', true);

        const grpObj = J.getGroupObj(worker.group);
        const isOutstationOut = (J.s.vchDir === 'out' && grpObj.outstation);
        const dDate = J.toIsoDate(J.s.vchMeta.date) || J.getTodayIso();
        const gLabel = grpObj.label;

        J.s.isSaving = true;
        try {
            const txnId = J.genId('jwt');
            const sH = J.safeArr(J.getStoreSafe('saree_history')).slice();
            const { sheets, lastSheet } = J.ensureWorkerSheet(worker.id);

            let totQty = 0;
            let totDmg = 0;
            const sheetItems = [];
            let savedRow = null;

            if (J.s.vchDir === 'out') {
                J.s.vchBatch.forEach((it, idx) => {
                    totQty += it.qty;
                    sheetItems.push({
                        id: `it_${txnId}_${idx}`,
                        karigar: it.maker,
                        saree: it.saree,
                        karkhanaId: it.karkhanaId,
                        doneStages: [...it.doneStages],
                        bucket: 'unfinished',
                        qty: it.qty
                    });
                });
                savedRow = {
                    id: txnId,
                    date: dDate,
                    gayiQty: totQty,
                    gayiItems: sheetItems,
                    stockSource: 'fresh',
                    aayiQty: 0,
                    aayiItems: [],
                    damagePcs: 0,
                    damageAmt: 0,
                    isTrailV2: true,
                    isOutstation: isOutstationOut,
                    jwNo: isOutstationOut ? (J.s.vchMeta.jwNo || J.getNextChallanNo()).trim() : '',
                    transport: isOutstationOut ? (J.s.vchMeta.transport || '').trim() : '',
                    lrNo: isOutstationOut ? (J.s.vchMeta.lrNo || '').trim() : '',
                    designNote: isOutstationOut ? (J.s.vchMeta.designNote || '').trim() : ''
                };
                if (isOutstationOut && savedRow.jwNo) J.bumpChallanSeq(savedRow.jwNo);
                lastSheet.rows.push(savedRow);
                J.setStoreSafe('saree_history', J.rebuildWorkerRowSareeHistory(sH, worker, savedRow));
            } else {
                J.s.vchBatch.forEach((it, idx) => {
                    const nextTrail = [...it.doneStages];
                    if (worker.group && !nextTrail.includes(worker.group)) nextTrail.push(worker.group);
                    const targetBucket = it.dest === 'finished' ? 'finished' : (it.dest === 'lott' ? 'lott' : 'unfinished');
                    const isDmg = (targetBucket === 'lott');
                    if (isDmg) totDmg += it.qty; else totQty += it.qty;

                    sheetItems.push({
                        id: `it_${txnId}_${idx}`,
                        karigar: it.maker,
                        saree: it.saree,
                        karkhanaId: it.karkhanaId,
                        prevStages: [...it.doneStages],
                        doneStages: nextTrail,
                        destBucket: targetBucket,
                        isDamage: isDmg,
                        qty: it.qty
                    });
                });
                savedRow = {
                    id: txnId,
                    date: dDate,
                    gayiQty: 0,
                    gayiItems: [],
                    stockSource: 'fresh',
                    aayiQty: totQty,
                    aayiItems: sheetItems,
                    damagePcs: totDmg,
                    damageAmt: 0,
                    isTrailV2: true
                };
                lastSheet.rows.push(savedRow);
                J.setStoreSafe('saree_history', J.rebuildWorkerRowSareeHistory(sH, worker, savedRow));
            }

            J.setStoreSafe(`jobwork_sheets_${worker.id}`, sheets);

            if (isOutstationOut) {
                J.s.lastChallanObj = J.buildOutstationPayloadFromRow(worker, savedRow);
            } else {
                J.s.lastChallanObj = {
                    isOutstation: false,
                    title: `${gLabel.toUpperCase()} ${J.s.vchDir === 'out' ? 'OUT (GAYI)' : 'IN (WAPAS AAYI)'}`,
                    party: `${worker.name} (${gLabel})`,
                    date: dDate,
                    items: J.s.vchBatch.map((x) => ({
                        maker: x.maker,
                        saree: x.saree,
                        trail: J.s.vchDir === 'out'
                            ? J.formatTrail(x.doneStages, 'unfinished')
                            : J.formatTrail([...x.doneStages, ...(x.doneStages.includes(worker.group) ? [] : [worker.group])], x.dest === 'finished' ? 'finished' : (x.dest === 'lott' ? 'lott' : 'unfinished')),
                        qty: x.qty
                    }))
                };
            }

            J.s.vchBatch = [];
            J.s.vchAcceptOpen = false;
            J.s.vchPickStep = 'kariger';
            J.s.vchSelectedMaker = null;
            J.s.vchSelectedBatchKey = null;
            J.s.vchRightIdx = 0;
            J.s.vchMeta = {
                date: J.getTodayIso(),
                jwNo: isOutstationOut ? J.getNextChallanNo() : '',
                transport: '',
                lrNo: '',
                designNote: ''
            };

            J.invalidateAllCaches(worker.id);
            J.toast(`✅ ${totQty + totDmg} Pcs Save ho gayi!`);
            if (printType === 'both' && J.s.lastChallanObj.isOutstation) {
                J.printOutstationBoth(J.s.lastChallanObj);
            } else if (printType === 'challan' || printType === 'both') {
                if (J.s.lastChallanObj.isOutstation) J.printOutstationChallan(J.s.lastChallanObj);
                else J.printBatchChallan(J.s.lastChallanObj);
            } else if (printType === 'slip' && J.s.lastChallanObj.isOutstation) {
                J.printPackingSlip(J.s.lastChallanObj);
            }
            J.renderScreen();
        } catch (err) {
            console.error('[JW-Trail] commitVchBatch error:', err);
            J.toast('Batch save karne me error aaya!', true);
        } finally {
            J.s.isSaving = false;
        }
    };

    window.jwtSaveWorkerHistEdit = (sheetId, rowId) => {
        if (!J.s.activeWorkerId || !rowId) return;
        const snap = J.getSnapshot();
        const worker = snap.workers.find((w) => w.id === J.s.activeWorkerId);
        if (!worker) return;

        const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${J.s.activeWorkerId}`)).slice();
        const sIdx = sheets.findIndex((s) => s && String(s.id) === String(sheetId));
        if (sIdx < 0) return;

        const sheet = { ...sheets[sIdx], rows: J.safeArr(sheets[sIdx].rows).slice() };
        const rIdx = sheet.rows.findIndex((r) => r && String(r.id) === String(rowId));
        if (rIdx < 0) return;

        const oldRow = sheet.rows[rIdx];
        const newDate = J.toIsoDate(document.getElementById('jwt-eh-date')?.value) || oldRow.date;
        const isOut = J.safeInt(oldRow.gayiQty) > 0;
        const oldItems = isOut ? J.safeArr(oldRow.gayiItems) : J.safeArr(oldRow.aayiItems);
        if (!oldItems.length) return J.toast('Is legacy entry ke items edit nahi ho sakte.', true);

        const newItems = [];
        let newTot = 0, newDmg = 0;

        for (let i = 0; i < oldItems.length; i++) {
            const it = { ...oldItems[i] };
            const qVal = J.safeInt(document.getElementById(`jwt-eh-qty-${i}`)?.value);
            if (qVal <= 0) return J.toast('Har item ki Qty 1 ya zyada honi chahiye!', true);

            const oldQ = J.safeInt(it.qty);
            const diff = qVal - oldQ;

            if (isOut && diff > 0) {
                const b = snap.godamBatches.find((x) =>
                    x.saree === J.normText(it.saree) &&
                    x.maker === J.normText(it.karigar) &&
                    x.karkhanaId === J.normGodam(it.karkhanaId) &&
                    x.bucket === 'unfinished' &&
                    x.trailKey === (Array.isArray(it.doneStages) ? it.doneStages.join('|') : '')
                );
                const avail = b ? b.pcs : 0;
                if (diff > avail) return J.toast(`${it.karigar} (${it.saree}) ka Godam stock sirf ${avail} aur bacha hai!`, true);
            }
            if (!isOut && diff > 0 && diff > worker.pending) {
                return J.toast(`Worker ke paas sirf ${worker.pending} Pcs aur pending hain!`, true);
            }
            if (isOut && diff < 0 && (-diff) > worker.pending) {
                return J.toast(`Out Qty kam karne par pending minus me jayega! Pehle IN entry edit/delete karein.`, true);
            }

            it.qty = qVal;
            if (!isOut) {
                const destEl = document.getElementById(`jwt-eh-dest-${i}`);
                if (destEl) { it.destBucket = destEl.value; it.isDamage = (destEl.value === 'lott'); }
                if (it.isDamage) newDmg += qVal; else newTot += qVal;
            } else {
                newTot += qVal;
            }
            newItems.push(it);
        }

        const updatedRow = {
            ...oldRow,
            date: newDate,
            jwNo: document.getElementById('jwt-eh-jwno') ? document.getElementById('jwt-eh-jwno').value.trim() : oldRow.jwNo,
            transport: document.getElementById('jwt-eh-trans') ? document.getElementById('jwt-eh-trans').value.trim() : oldRow.transport,
            lrNo: document.getElementById('jwt-eh-lr') ? document.getElementById('jwt-eh-lr').value.trim() : oldRow.lrNo,
            designNote: document.getElementById('jwt-eh-design') ? document.getElementById('jwt-eh-design').value.trim() : oldRow.designNote,
            gayiQty: isOut ? newTot : 0,
            gayiItems: isOut ? newItems : [],
            aayiQty: isOut ? 0 : newTot,
            aayiItems: isOut ? [] : newItems,
            damagePcs: isOut ? 0 : newDmg
        };
        sheet.rows[rIdx] = updatedRow;
        sheets[sIdx] = sheet;

        const sH = J.rebuildWorkerRowSareeHistory(J.safeArr(J.getStoreSafe('saree_history')), worker, updatedRow);
        J.setStoreSafe('saree_history', sH);
        J.setStoreSafe(`jobwork_sheets_${J.s.activeWorkerId}`, sheets);
        J.s.editWorkerRowInfo = null;
        J.invalidateAllCaches(J.s.activeWorkerId);
        J.toast('✅ Register entry update ho gayi!');
        J.renderScreen();
    };

    window.jwtDeleteWorkerHistRow = (sheetId, rowId) => {
        if (!J.s.activeWorkerId || !rowId) return;
        const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${J.s.activeWorkerId}`)).slice();
        const sIdx = sheets.findIndex((s) => s && String(s.id) === String(sheetId));
        if (sIdx < 0) return;
        const sheet = { ...sheets[sIdx], rows: J.safeArr(sheets[sIdx].rows).slice() };
        const row = sheet.rows.find((r) => r && String(r.id) === String(rowId));
        if (!row) return;

        const snap = J.getSnapshot();
        const worker = snap.workers.find((w) => w.id === J.s.activeWorkerId);
        if (worker && J.safeInt(row.gayiQty) > worker.pending) {
            return J.toast('Is batch ki sarees pehle hi wapas aa chuki hain! Pehle IN entry delete karein.', true);
        }
        if (!confirm('Kya is entry ko delete karna chahte hain? Stock automatic adjust ho jayega.')) return;

        sheet.rows = sheet.rows.filter((r) => r && String(r.id) !== String(rowId));
        sheets[sIdx] = sheet;
        const sH = J.safeArr(J.getStoreSafe('saree_history')).filter((h) => !h || String(h.refId) !== String(rowId));
        J.setStoreSafe('saree_history', sH);
        J.setStoreSafe(`jobwork_sheets_${J.s.activeWorkerId}`, sheets);
        J.s.editWorkerRowInfo = null;
        J.s.regPrintRowInfo = null;
        J.invalidateAllCaches(J.s.activeWorkerId);
        J.toast('Entry delete ho gayi!');
        J.renderScreen();
    };

    J.commitFinalOutBatch = (doPrint = false) => {
        if (J.s.isSaving) return;
        if (!J.s.foBatch.length) return J.toast('Batch khali hai! Kam se kam 1 Saree add karein.', true);

        const dDate = J.toIsoDate(document.getElementById('jwt-fo-date')?.value) || J.getTodayIso();
        const note = String(document.getElementById('jwt-fo-note')?.value || '').trim() || 'Apni Main Dukan';

        J.s.isSaving = true;
        try {
            const challanId = J.genId('dukan');
            const now = Date.now();
            const sH = J.safeArr(J.getStoreSafe('saree_history')).slice();
            const dukanHist = J.safeArr(J.getStoreSafe('dukan_transfer_history')).slice();

            J.s.foBatch.forEach((it, idx) => {
                const lType = J.legacyTypeFromTrail(it.doneStages, it.bucket);
                const trTxt = J.formatTrail(it.doneStages, it.bucket);
                sH.push({
                    id: `sh_fo_${challanId}_${idx}`,
                    refId: `${challanId}_${idx}`,
                    date: dDate, sareeName: it.saree, karigerName: it.maker, kariger: it.maker,
                    partyName: note, targetWorker: note, karkhanaId: it.karkhanaId,
                    type: lType, typeLabel: `🚚 Final Out ➔ ${note} [${trTxt}]`,
                    aai: 0, gai: it.qty, isOut: true,
                    doneStages: [...it.doneStages], stageBucket: it.bucket, note, timestamp: now + idx
                });
                dukanHist.unshift({
                    id: `${challanId}_${idx}`, date: dDate, sareeName: it.saree, karigerName: it.maker,
                    pcs: it.qty, note: `${note} [${trTxt}]`, karkhanaId: it.karkhanaId,
                    doneStages: [...it.doneStages], stageBucket: it.bucket, timestamp: now + idx
                });
            });

            J.setStoreSafe('saree_history', sH);
            J.setStoreSafe('dukan_transfer_history', dukanHist);

            J.s.lastChallanObj = {
                isOutstation: false,
                title: 'FINAL OUT (DISPATCH CHALLAN)',
                party: note,
                date: dDate,
                items: J.s.foBatch.map((x) => ({ maker: x.maker, saree: x.saree, trail: J.formatTrail(x.doneStages, x.bucket), qty: x.qty }))
            };

            J.s.foBatch = [];
            J.s.foAcceptOpen = false;
            J.s.foPickStep = 'kariger';
            J.s.foSelectedMaker = null;
            J.s.foSelectedBatchKey = null;
            J.s.foRightIdx = 0;

            J.invalidateAllCaches();
            if (typeof window.renderDukanTransferTable === 'function') { try { window.renderDukanTransferTable(); } catch (_) {} }
            J.toast('✅ Final Out Challan save ho gaya!');
            if (doPrint) J.printBatchChallan(J.s.lastChallanObj);
            J.renderScreen();
        } finally {
            J.s.isSaving = false;
        }
    };

    window.jwtSaveFinalOutEdit = (entryId) => {
        const dukanHist = J.safeArr(J.getStoreSafe('dukan_transfer_history')).slice();
        const dIdx = dukanHist.findIndex((x) => x && String(x.id) === String(entryId));
        if (dIdx < 0) return;

        const oldEntry = dukanHist[dIdx];
        const newDate = J.toIsoDate(document.getElementById('jwt-efo-date')?.value) || oldEntry.date;
        const newNote = String(document.getElementById('jwt-efo-note')?.value || '').trim() || oldEntry.note;
        const newPcs = J.safeInt(document.getElementById('jwt-efo-pcs')?.value);
        if (newPcs <= 0) return J.toast('Sahi Pcs daalein!', true);

        const diff = newPcs - J.safeInt(oldEntry.pcs);
        if (diff > 0) {
            const snap = J.getSnapshot();
            const trKey = Array.isArray(oldEntry.doneStages) ? oldEntry.doneStages.join('|') : null;
            const b = snap.godamBatches.find((x) =>
                x.saree === J.normText(oldEntry.sareeName) &&
                x.maker === J.normText(oldEntry.karigerName) &&
                (!oldEntry.karkhanaId || x.karkhanaId === J.normGodam(oldEntry.karkhanaId)) &&
                (trKey === null || x.trailKey === trKey)
            );
            const avail = b ? b.pcs : 0;
            if (diff > avail) return J.toast(`Godam me sirf ${avail} Pcs aur bache hain!`, true);
        }

        dukanHist[dIdx] = { ...oldEntry, date: newDate, note: newNote, pcs: newPcs };
        const sH = J.safeArr(J.getStoreSafe('saree_history')).map((h) => {
            if (!h) return h;
            if (String(h.refId) === String(entryId) || String(h.id) === `sh_fo_${entryId}`) {
                return { ...h, date: newDate, partyName: newNote, targetWorker: newNote, gai: newPcs, note: newNote };
            }
            return h;
        });

        J.setStoreSafe('dukan_transfer_history', dukanHist);
        J.setStoreSafe('saree_history', sH);
        J.s.editFoId = null;
        J.invalidateAllCaches();
        J.toast('✅ Final Out entry update ho gayi!');
        J.renderScreen();
    };

    window.jwtDeleteFinalOutEntry = (entryId) => {
        if (!entryId) return;
        if (!confirm('Kya is Final Out entry ko delete karna chahte hain? Saree wapas Godam stock me jud jayegi.')) return;
        const dukanHist = J.safeArr(J.getStoreSafe('dukan_transfer_history')).filter((x) => !x || String(x.id) !== String(entryId));
        const sH = J.safeArr(J.getStoreSafe('saree_history')).filter((h) => !h || (String(h.refId) !== String(entryId) && String(h.id) !== `sh_fo_${entryId}`));
        J.setStoreSafe('dukan_transfer_history', dukanHist);
        J.setStoreSafe('saree_history', sH);
        J.s.editFoId = null;
        J.invalidateAllCaches();
        J.toast('Final Out entry delete ho gayi!');
        J.renderScreen();
    };
})();
