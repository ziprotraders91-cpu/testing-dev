/* ============================================================================
   SIMPLICITY ERP - UNIFIED JOBWORK, DYNAMIC GROUPS & SAREE PROCESS TRAIL
   File: jobwork-trail/jobwork-trail.js
   100% Compatible with: core/storage.js, core/database.js (Supabase Row-Delta),
   core/karkhana.js, saree_history, jobwork_workers, jobwork_sheets_*, dukan, bills
============================================================================ */

(() => {
    'use strict';

    const GROUPS_STORE_KEY = 'jobwork_groups';
    const DEFAULT_GROUPS = [
        { key: 'cutting', label: 'Cutting' },
        { key: 'embroidery', label: 'Embroidery' },
        { key: 'calender', label: 'Calender' }
    ];

    /* ========================================================================
       1. MODULE & UI STATE
    ======================================================================== */
    let curScreen = 'gateway'; // 'gateway' | 'malik' | 'stock' | 'jobwork' | 'create'
    let gwIdx = 0;
    let stockFilter = 'all'; // 'all' | 'unfinished' | 'finished' | 'lott'
    let jwFilterGroup = 'all';
    let jwSubMode = 'list'; // 'list' | 'voucher'
    let activeWorkerId = null;
    let vchMode = 'issue'; // 'issue' | 'return' | 'history'
    let selectedGodamKey = null;
    let selectedPendingKey = null;
    let selectedPassbookKey = null;
    let createMode = 'worker'; // 'worker' | 'group'
    let selectedCreateGroupKey = 'cutting';
    let isSubmitting = false;
    let stockInwardOpen = false;
    let lastChallanData = null;
    let cachedSnapshot = null;

    /* ========================================================================
       2. BULLETPROOF SAFE HELPERS
    ======================================================================== */
    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const safeArr = (v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof window.safeArray === 'function') return window.safeArray(v).filter(Boolean);
        return [];
    };

    const safeInt = (v, fallback = 0) => {
        const n = parseInt(String(v == null ? '' : v).replace(/,/g, '').trim(), 10);
        return Number.isFinite(n) ? n : fallback;
    };

    const safeNum = (v, fallback = 0) => {
        const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : fallback;
    };

    const normText = (s, fb = '') => String(s == null ? fb : s).trim().toUpperCase() || fb;
    const normKeyPart = (s, fb = '') => normText(s, fb);

    const toIsoDate = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const p = s.split(/[-/]/);
        if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
            return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        return s;
    };

    const getTodayIso = () => {
        const raw = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
        const iso = toIsoDate(raw);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date().toISOString().split('T')[0];
    };

    const fmtDate = (d) => {
        if (!d) return '-';
        if (typeof window.formatDateDisplay === 'function') return window.formatDateDisplay(d);
        return d;
    };

    const genId = (prefix) => {
        const rand = Math.random().toString(36).slice(2, 7);
        return `${prefix}_${Date.now()}_${rand}`;
    };

    const getStoreSafe = (key) => {
        try {
            if (typeof window.getStore === 'function') return window.getStore(key);
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.warn('[JW-Trail] getStoreSafe error:', key, err);
            return [];
        }
    };

    const setStoreSafe = (key, val) => {
        if (typeof window.setStore === 'function') {
            window.setStore(key, val);
        } else {
            localStorage.setItem(key, JSON.stringify(val));
        }
    };

    const getActiveGodam = () => {
        try {
            if (typeof window.getActiveKarkhanaId === 'function') {
                return String(window.getActiveKarkhanaId() || 'all').trim() || 'all';
            }
        } catch (_) {}
        return 'all';
    };

    const normGodam = (kid) => {
        const clean = String(kid || '').trim();
        if (!clean || clean === 'k_main') return 'k_main';
        if (clean === 'all') return 'all';
        return clean;
    };

    const getGodamLabel = (kid) => {
        const k = normGodam(kid);
        if (k === 'all') return 'Sabhi Karkhane';
        if (typeof window.getKarkhanaNameById === 'function') return window.getKarkhanaNameById(k);
        return k === 'k_main' ? 'Main Godown' : k;
    };

    const getCleanMobile = (rawMob) => {
        let m = String(rawMob || '').replace(/[^0-9]/g, '');
        if (m.length === 11 && m.startsWith('0')) m = m.slice(1);
        if (m.length === 10) m = '91' + m;
        return m;
    };

    const toast = (msg, isErr = false) => {
        let el = document.getElementById('jwt-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'jwt-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.background = isErr ? '#991b1b' : '#1f2937';
        el.style.color = isErr ? '#ffffff' : '#fde68a';
        el.style.display = 'block';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.display = 'none'; }, 2800);
    };

    const invalidateAllCaches = (workerId = null) => {
        cachedSnapshot = null;
        try {
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(workerId);
            if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
        } catch (err) {
            console.warn('[JW-Trail] Cache invalidation warning:', err);
        }
    };

    /* ========================================================================
       3. DYNAMIC WORK GROUPS ENGINE (SYNCED VIA app_store)
    ======================================================================== */
    const getWorkGroups = () => {
        const stored = safeArr(getStoreSafe(GROUPS_STORE_KEY));
        const workers = safeArr(getStoreSafe('jobwork_workers'));
        const map = new Map();

        DEFAULT_GROUPS.forEach((g) => map.set(g.key, { key: g.key, label: g.label }));

        stored.forEach((g) => {
            if (!g || !g.key) return;
            const k = String(g.key).trim().toLowerCase();
            if (!k) return;
            map.set(k, { key: k, label: String(g.label || k).trim() });
        });

        workers.forEach((w) => {
            if (!w || !w.type) return;
            const k = String(w.type).trim().toLowerCase();
            if (k && !map.has(k)) {
                map.set(k, { key: k, label: k.charAt(0).toUpperCase() + k.slice(1) });
            }
        });

        return Array.from(map.values());
    };

    const grpLabel = (key) => {
        const k = String(key || '').trim().toLowerCase();
        const found = getWorkGroups().find((g) => g.key === k);
        return found ? found.label : (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'JobWork');
    };

    /* ========================================================================
       4. STAGE & TRAIL HELPERS (COMPATIBLE WITH LEGACY saree_history)
    ======================================================================== */
    const inferBucketFromLegacyType = (t) => {
        const clean = String(t || 'fresh').trim().toLowerCase();
        if (clean === 'finished' || clean === 'finish') return 'finished';
        if (clean === 'lott' || clean === 'lot' || clean === 'damage') return 'lott';
        return 'unfinished';
    };

    const inferStagesFromRow = (row) => {
        if (Array.isArray(row?.doneStages)) {
            return row.doneStages.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
        }
        const t = String(row?.type || 'fresh').trim().toLowerCase();
        if (t === 'cutting' || t === 'cut') return ['cutting'];
        if (t === 'embroidery' || t === 'emb') return ['embroidery'];
        if (t === 'finished' || t === 'finish' || t === 'calender') return ['calender'];
        return [];
    };

    const legacyTypeFromTrail = (doneStages, bucket) => {
        if (bucket === 'finished') return 'finished';
        if (bucket === 'lott') return 'lott';
        const arr = Array.isArray(doneStages) ? doneStages : [];
        if (arr.includes('embroidery')) return 'embroidery';
        if (arr.includes('cutting')) return 'cutting';
        return 'fresh';
    };

    const formatTrail = (doneStages, bucket = 'unfinished') => {
        const arr = Array.isArray(doneStages) ? doneStages : [];
        if (bucket === 'finished') {
            return arr.length ? `Finished (${arr.map(grpLabel).join(' → ')})` : 'Finished Ready';
        }
        if (bucket === 'lott') {
            return arr.length ? `Lott (${arr.map(grpLabel).join(' → ')})` : 'Lott (Fresh)';
        }
        if (!arr.length) return 'Fresh (Kora — Koi Kaam Nahi Hua)';
        return arr.map(grpLabel).join(' → ') + ' Complete';
    };

    /* ========================================================================
       5. UNIFIED RECONCILIATION ENGINE (100% STOCK MATCH ACROSS APP)
    ======================================================================== */
    const computeLiveState = (godamFilter = 'all') => {
        const groups = getWorkGroups();
        const workersRaw = safeArr(getStoreSafe('jobwork_workers'));
        const karigerMeta = new Map();
        safeArr(getStoreSafe('kariger_list')).forEach((k) => {
            if (k && k.name) {
                karigerMeta.set(normKeyPart(k.name), {
                    saree: normText(k.saree, 'GENERAL SAREE'),
                    karkhanaId: normGodam(k.karkhanaId || 'k_main')
                });
            }
        });

        const sareeHist = safeArr(getStoreSafe('saree_history'));
        const activeFilter = godamFilter || 'all';

        // --- A. GODAM STOCK (WITH EXACT STAGE TRAIL) ---
        const godamMap = new Map();
        const untrailedOuts = [];

        const chronoHist = sareeHist.slice().sort((a, b) => {
            const ta = safeNum(a.timestamp, 0);
            const tb = safeNum(b.timestamp, 0);
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        chronoHist.forEach((h) => {
            if (!h) return;
            const kid = normGodam(h.karkhanaId);
            if (activeFilter !== 'all' && kid !== activeFilter) return;

            const sName = normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
            const kName = normText(h.karigerName || h.kariger, 'KARKHANA');
            const bucket = h.stageBucket || inferBucketFromLegacyType(h.type);
            const hasExplicitTrail = Array.isArray(h.doneStages);
            const doneStages = inferStagesFromRow(h);
            const trailKey = doneStages.join('|');

            const isOut = (h.isOut === true) || (safeNum(h.gai) > 0);
            const qty = isOut
                ? safeInt(h.gai != null ? h.gai : h.pcs)
                : safeInt(h.aai != null ? h.aai : h.pcs);

            if (qty <= 0) return;

            const bKey = `${sName}|||${kName}|||${kid}|||${bucket}|||${trailKey}`;

            if (!isOut) {
                let b = godamMap.get(bKey);
                if (!b) {
                    b = {
                        key: bKey,
                        saree: sName,
                        maker: kName,
                        karkhanaId: kid,
                        godamName: getGodamLabel(kid),
                        bucket,
                        doneStages: [...doneStages],
                        trailKey,
                        pcs: 0,
                        lastDate: h.date || ''
                    };
                    godamMap.set(bKey, b);
                }
                b.pcs += qty;
                if (h.date && (!b.lastDate || h.date > b.lastDate)) b.lastDate = h.date;
            } else {
                const exact = godamMap.get(bKey);
                if (exact && exact.pcs >= qty) {
                    exact.pcs -= qty;
                } else if (hasExplicitTrail && exact) {
                    exact.pcs = Math.max(0, exact.pcs - qty);
                } else {
                    untrailedOuts.push({ sName, kName, kid, bucket, trailKey, qty });
                }
            }
        });

        // Reconcile legacy/external untrailed outs (e.g. Dukan Challan) FIFO on matching saree+maker+godam+bucket
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

        // --- B. WORKERS & EXACT PENDING SAREES ---
        const workers = [];
        const pendingBatches = [];

        workersRaw.forEach((w) => {
            if (!w || !w.id || !w.name) return;
            const wGroup = String(w.type || 'cutting').trim().toLowerCase();
            const sheets = safeArr(getStoreSafe(`jobwork_sheets_${w.id}`));

            let diya = 0;
            let aai = 0;
            const openingPend = sheets.length ? safeInt(sheets[0].closingPendingSaree, 0) : 0;
            const pMap = new Map();

            const addPending = (saree, maker, kid, stages, qty) => {
                if (qty <= 0) return;
                const sN = normText(saree, 'GENERAL SAREE');
                const mN = normText(maker, 'KARKHANA');
                const kId = normGodam(kid);
                const st = Array.isArray(stages) ? stages : [];
                const tKey = st.join('|');
                const pKey = `${w.id}|||${sN}|||${mN}|||${kId}|||${tKey}`;
                let ex = pMap.get(pKey);
                if (!ex) {
                    ex = {
                        key: pKey,
                        workerId: String(w.id),
                        workerName: w.name,
                        workerGroup: wGroup,
                        saree: sN,
                        maker: mN,
                        karkhanaId: kId,
                        godamName: getGodamLabel(kId),
                        doneStages: [...st],
                        trailKey: tKey,
                        pcs: 0
                    };
                    pMap.set(pKey, ex);
                }
                ex.pcs += qty;
            };

            const deductPending = (saree, maker, kid, prevStages, qty) => {
                let rem = qty;
                if (rem <= 0) return;
                const sN = saree ? normText(saree) : null;
                const mN = maker ? normText(maker) : null;
                const kId = kid ? normGodam(kid) : null;

                // 1. Exact match if prevStages is provided
                if (Array.isArray(prevStages) && sN && mN && kId) {
                    const exactKey = `${w.id}|||${sN}|||${mN}|||${kId}|||${prevStages.join('|')}`;
                    const ex = pMap.get(exactKey);
                    if (ex && ex.pcs > 0) {
                        const take = Math.min(ex.pcs, rem);
                        ex.pcs -= take;
                        rem -= take;
                    }
                }
                // 2. Fallback: match maker + saree
                if (rem > 0 && mN) {
                    for (const ex of pMap.values()) {
                        if (rem <= 0) break;
                        if (ex.pcs > 0 && ex.maker === mN && (!sN || ex.saree === sN)) {
                            const take = Math.min(ex.pcs, rem);
                            ex.pcs -= take;
                            rem -= take;
                        }
                    }
                }
                // 3. Fallback: FIFO across worker's pending
                if (rem > 0) {
                    for (const ex of pMap.values()) {
                        if (rem <= 0) break;
                        if (ex.pcs > 0) {
                            const take = Math.min(ex.pcs, rem);
                            ex.pcs -= take;
                            rem -= take;
                        }
                    }
                }
            };

            sheets.forEach((sh) => {
                if (!sh) return;
                safeArr(sh.rows).forEach((r) => {
                    if (!r) return;
                    const gItems = safeArr(r.gayiItems);
                    if (gItems.length) {
                        gItems.forEach((it) => {
                            const q = safeInt(it.qty);
                            if (q <= 0) return;
                            const mName = normText(it.karigar || it.maker, 'KARKHANA');
                            const meta = karigerMeta.get(mName) || { saree: 'GENERAL SAREE', karkhanaId: 'k_main' };
                            const sName = normText(it.saree || meta.saree, 'GENERAL SAREE');
                            const kid = normGodam(it.karkhanaId || meta.karkhanaId || 'k_main');
                            const stages = Array.isArray(it.doneStages)
                                ? it.doneStages
                                : inferStagesFromRow({ type: it.source || r.stockSource || 'fresh' });

                            diya += q;
                            if (activeFilter === 'all' || kid === activeFilter) {
                                addPending(sName, mName, kid, stages, q);
                            }
                        });
                    } else if (safeInt(r.gayiQty) > 0) {
                        const q = safeInt(r.gayiQty);
                        diya += q;
                        if (activeFilter === 'all' || activeFilter === 'k_main') {
                            addPending('GENERAL SAREE', 'KARKHANA', 'k_main', [], q);
                        }
                    }

                    const aItems = safeArr(r.aayiItems);
                    if (aItems.length) {
                        aItems.forEach((it) => {
                            const q = safeInt(it.qty);
                            if (q <= 0) return;
                            aai += q;
                            const mName = it.karigar || it.maker ? normText(it.karigar || it.maker) : null;
                            const sName = it.saree ? normText(it.saree) : null;
                            const kid = it.karkhanaId ? normGodam(it.karkhanaId) : null;
                            if (activeFilter === 'all' || !kid || kid === activeFilter) {
                                deductPending(sName, mName, kid, it.prevStages, q);
                            }
                        });
                        if (safeInt(r.damagePcs) > 0 && !aItems.some((it) => it.isDamage)) {
                            const dq = safeInt(r.damagePcs);
                            aai += dq;
                            deductPending(null, null, null, null, dq);
                        }
                    } else {
                        const aq = safeInt(r.aayiQty);
                        const dq = safeInt(r.damagePcs);
                        if (aq > 0) {
                            aai += aq;
                            deductPending(null, null, null, null, aq);
                        }
                        if (dq > 0) {
                            aai += dq;
                            deductPending(null, null, null, null, dq);
                        }
                    }
                });
            });

            // Reconcile opening pending balance if any
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

            const totWorkerPend = workerPendList.reduce((s, p) => s + p.pcs, 0);
            workers.push({
                id: String(w.id),
                name: w.name,
                group: wGroup,
                mobile: w.mobile || '',
                address: w.address || '',
                date: w.date || '',
                diya,
                aai,
                pending: totWorkerPend,
                pendingItems: workerPendList
            });
        });

        const rawPcs = godamBatches.filter((b) => b.bucket === 'unfinished').reduce((s, b) => s + b.pcs, 0);
        const pendPcs = pendingBatches.reduce((s, p) => s + p.pcs, 0);
        const finPcs = godamBatches.filter((b) => b.bucket === 'finished').reduce((s, b) => s + b.pcs, 0);
        const lottPcs = godamBatches.filter((b) => b.bucket === 'lott').reduce((s, b) => s + b.pcs, 0);

        cachedSnapshot = {
            godamFilter: activeFilter,
            groups,
            workers,
            godamBatches,
            pendingBatches,
            totals: {
                raw: rawPcs,
                pending: pendPcs,
                finished: finPcs,
                lott: lottPcs,
                total: rawPcs + pendPcs + finPcs + lottPcs
            }
        };
        return cachedSnapshot;
    };

    const getSnapshot = () => {
        const gFilter = getActiveGodam();
        if (cachedSnapshot && cachedSnapshot.godamFilter === gFilter) return cachedSnapshot;
        return computeLiveState(gFilter);
    };

    /* ========================================================================
       6. ATOMIC ISSUE, RETURN, UNDO & MASTER ACTIONS
    ======================================================================== */
    const ensureWorkerSheet = (workerId) => {
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${workerId}`)).slice();
        if (!sheets.length) {
            sheets.push({
                id: `jw_sh_${Date.now()}`,
                title: `Month 1 (${getTodayIso().slice(0, 7)})`,
                closingPendingSaree: 0,
                closingBakiAmt: 0,
                rows: []
            });
        }
        const last = sheets[sheets.length - 1];
        last.rows = safeArr(last.rows).slice();
        return { sheets, lastSheet: last };
    };

    window.jwtSubmitIssue = () => {
        if (isSubmitting) return;
        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        const batch = snap.godamBatches.find((b) => b.key === selectedGodamKey);

        if (!worker) return toast('Worker nahi mila!', true);
        if (!batch) return toast('Right side list se Saree batch chunein!', true);

        const qty = safeInt(document.getElementById('jwt-issue-qty')?.value);
        const dDate = toIsoDate(document.getElementById('jwt-issue-date')?.value) || getTodayIso();

        if (qty <= 0 || qty > batch.pcs) {
            return toast(`Sahi Pcs daalein (Max ${batch.pcs} Pcs available)!`, true);
        }

        isSubmitting = true;
        try {
            const txnId = genId('jwt');
            const now = Date.now();
            const gLabel = grpLabel(worker.group);
            const targetLabel = `${worker.name} (${gLabel})`;
            const lType = legacyTypeFromTrail(batch.doneStages, 'unfinished');

            // 1. Update saree_history (Outward from Godam)
            const sH = safeArr(getStoreSafe('saree_history')).slice();
            sH.push({
                id: `sh_jw_out_${txnId}`,
                refId: txnId,
                date: dDate,
                sareeName: batch.saree,
                karigerName: batch.maker,
                kariger: batch.maker,
                partyName: targetLabel,
                targetWorker: targetLabel,
                karkhanaId: batch.karkhanaId,
                type: lType,
                typeLabel: `📤 ${targetLabel} ko bheja [${formatTrail(batch.doneStages, 'unfinished')}]`,
                aai: 0,
                gai: qty,
                isOut: true,
                doneStages: [...batch.doneStages],
                stageBucket: 'unfinished',
                workerId: worker.id,
                note: `${targetLabel} Issue`,
                timestamp: now
            });

            // 2. Update jobwork_sheets_<workerId>
            const { sheets, lastSheet } = ensureWorkerSheet(worker.id);
            lastSheet.rows.push({
                id: txnId,
                date: dDate,
                gayiQty: qty,
                gayiItems: [{
                    id: `it_${txnId}`,
                    karigar: batch.maker,
                    saree: batch.saree,
                    karkhanaId: batch.karkhanaId,
                    doneStages: [...batch.doneStages],
                    bucket: 'unfinished',
                    qty
                }],
                stockSource: lType,
                aayiQty: 0,
                aayiItems: [],
                damagePcs: 0,
                damageAmt: 0,
                isTrailV2: true
            });

            setStoreSafe('saree_history', sH);
            setStoreSafe(`jobwork_sheets_${worker.id}`, sheets);

            lastChallanData = {
                mode: 'ISSUE (GAYI)',
                workerName: worker.name,
                groupLabel: gLabel,
                date: dDate,
                saree: batch.saree,
                maker: batch.maker,
                trail: formatTrail(batch.doneStages, 'unfinished'),
                pcs: qty
            };

            selectedGodamKey = null;
            const bInp = document.getElementById('jwt-issue-batch');
            const qInp = document.getElementById('jwt-issue-qty');
            if (bInp) bInp.value = '';
            if (qInp) qInp.value = '';

            invalidateAllCaches(worker.id);
            renderCurrent();
            toast(`✅ ${qty} Pcs ${worker.name} ko Issue ho gayi!`);
        } catch (err) {
            console.error('[JW-Trail] Issue Error:', err);
            toast('Issue save karne me dikkat aayi!', true);
        } finally {
            isSubmitting = false;
        }
    };

    window.jwtSubmitReturn = () => {
        if (isSubmitting) return;
        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        const pend = snap.pendingBatches.find((p) => p.key === selectedPendingKey);

        if (!worker) return toast('Worker nahi mila!', true);
        if (!pend) return toast('Right side list se Pending Saree chunein!', true);

        const qty = safeInt(document.getElementById('jwt-ret-qty')?.value);
        const dest = document.getElementById('jwt-ret-dest')?.value || 'godam';
        const fineAmt = safeNum(document.getElementById('jwt-ret-fine')?.value, 0);
        const dDate = toIsoDate(document.getElementById('jwt-ret-date')?.value) || getTodayIso();

        if (qty <= 0 || qty > pend.pcs) {
            return toast(`Sahi Pcs daalein (Max ${pend.pcs} Pcs pending)!`, true);
        }

        isSubmitting = true;
        try {
            const txnId = genId('jwt');
            const now = Date.now();
            const gLabel = grpLabel(worker.group);
            const targetLabel = `${worker.name} (${gLabel})`;
            const targetBucket = dest === 'finished' ? 'finished' : (dest === 'lott' ? 'lott' : 'unfinished');

            const nextTrail = [...pend.doneStages];
            if (worker.group && !nextTrail.includes(worker.group)) {
                nextTrail.push(worker.group);
            }
            const targetLegacyType = legacyTypeFromTrail(nextTrail, targetBucket);
            const icon = targetBucket === 'finished' ? '✨' : (targetBucket === 'lott' ? '⚠️' : '✅');

            // 1. Update saree_history (Inward back to Godam/Finished/Lott)
            const sH = safeArr(getStoreSafe('saree_history')).slice();
            sH.push({
                id: `sh_jw_in_${txnId}`,
                refId: txnId,
                date: dDate,
                sareeName: pend.saree,
                karigerName: pend.maker,
                kariger: pend.maker,
                partyName: targetLabel,
                targetWorker: targetLabel,
                karkhanaId: pend.karkhanaId,
                type: targetLegacyType,
                typeLabel: `${icon} ${targetLabel} se Aayi [${formatTrail(nextTrail, targetBucket)}]`,
                aai: qty,
                gai: 0,
                isOut: false,
                doneStages: nextTrail,
                stageBucket: targetBucket,
                workerId: worker.id,
                note: targetBucket === 'lott' && fineAmt > 0 ? `Lott Fine: ₹${fineAmt}` : `${gLabel} Return`,
                timestamp: now
            });

            // 2. Update jobwork_sheets_<workerId>
            const { sheets, lastSheet } = ensureWorkerSheet(worker.id);
            const isDmg = (targetBucket === 'lott');
            lastSheet.rows.push({
                id: txnId,
                date: dDate,
                gayiQty: 0,
                gayiItems: [],
                stockSource: 'fresh',
                aayiQty: isDmg ? 0 : qty,
                aayiItems: [{
                    id: `it_${txnId}`,
                    karigar: pend.maker,
                    saree: pend.saree,
                    karkhanaId: pend.karkhanaId,
                    prevStages: [...pend.doneStages],
                    doneStages: nextTrail,
                    destBucket: targetBucket,
                    isDamage: isDmg,
                    qty
                }],
                damagePcs: isDmg ? qty : 0,
                damageAmt: isDmg ? fineAmt : 0,
                isTrailV2: true
            });

            setStoreSafe('saree_history', sH);
            setStoreSafe(`jobwork_sheets_${worker.id}`, sheets);

            lastChallanData = {
                mode: targetBucket === 'lott' ? 'LOTT / DAMAGE' : 'RETURN (WAPAS AAYI)',
                workerName: worker.name,
                groupLabel: gLabel,
                date: dDate,
                saree: pend.saree,
                maker: pend.maker,
                trail: formatTrail(nextTrail, targetBucket),
                pcs: qty
            };

            selectedPendingKey = null;
            const bInp = document.getElementById('jwt-ret-batch');
            const qInp = document.getElementById('jwt-ret-qty');
            const fInp = document.getElementById('jwt-ret-fine');
            if (bInp) bInp.value = '';
            if (qInp) qInp.value = '';
            if (fInp) fInp.value = '';

            invalidateAllCaches(worker.id);
            renderCurrent();
            toast(`✅ ${qty} Pcs wapas → ${formatTrail(nextTrail, targetBucket)}`);
        } catch (err) {
            console.error('[JW-Trail] Return Error:', err);
            toast('Return save karne me dikkat aayi!', true);
        } finally {
            isSubmitting = false;
        }
    };

    window.jwtDeleteWorkerRow = (sheetId, rowId) => {
        if (!activeWorkerId || !rowId) return;
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${activeWorkerId}`)).slice();
        const sh = sheets.find((s) => s && String(s.id) === String(sheetId));
        if (!sh) return;
        const row = safeArr(sh.rows).find((r) => r && String(r.id) === String(rowId));
        if (!row) return;

        // Safety check: agar gayi entry delete karne se worker ka pending negative ho raha hai to rokein
        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        if (worker && safeInt(row.gayiQty) > worker.pending) {
            return toast('Is batch ki sarees pehle hi wapas aa chuki hain! Pehle Return entry delete karein.', true);
        }

        if (!confirm('Kya is entry ko delete karna chahte hain? Saree stock aur worker hisab automatic theek ho jayega.')) return;

        sh.rows = safeArr(sh.rows).filter((r) => r && String(r.id) !== String(rowId));
        const sH = safeArr(getStoreSafe('saree_history')).filter((h) => !h || String(h.refId) !== String(rowId));

        setStoreSafe('saree_history', sH);
        setStoreSafe(`jobwork_sheets_${activeWorkerId}`, sheets);
        invalidateAllCaches(activeWorkerId);
        renderCurrent();
        toast('Entry delete ho gayi aur stock adjust ho gaya!');
    };

    window.jwtSaveManualSareeInward = () => {
        const dDate = toIsoDate(document.getElementById('jwt-inw-date')?.value) || getTodayIso();
        const saree = normText(document.getElementById('jwt-inw-saree')?.value);
        const maker = normText(document.getElementById('jwt-inw-maker')?.value, 'DIRECT INWARD');
        const pcs = safeInt(document.getElementById('jwt-inw-pcs')?.value);
        const stage = document.getElementById('jwt-inw-stage')?.value || 'fresh';

        if (!saree || pcs <= 0) return toast('Saree Design aur Sahi Pcs bharein!', true);

        const activeG = getActiveGodam();
        const kid = (activeG && activeG !== 'all') ? activeG : 'k_main';
        const bucket = (stage === 'finished') ? 'finished' : (stage === 'lott' ? 'lott' : 'unfinished');
        const doneStages = (stage === 'fresh' || stage === 'lott') ? [] : (stage === 'finished' ? ['calender'] : [stage]);

        const sH = safeArr(getStoreSafe('saree_history')).slice();
        sH.push({
            id: genId('saree_man'),
            date: dDate,
            sareeName: saree,
            karigerName: maker,
            kariger: maker,
            partyName: maker,
            karkhanaId: kid,
            type: stage,
            typeLabel: `Direct Godown Inward (${formatTrail(doneStages, bucket)})`,
            aai: pcs,
            gai: 0,
            isOut: false,
            doneStages,
            stageBucket: bucket,
            note: 'Direct Inward',
            timestamp: Date.now()
        });

        setStoreSafe('saree_history', sH);
        stockInwardOpen = false;
        invalidateAllCaches();
        renderCurrent();
        toast(`✅ ${pcs} Pcs [${saree}] Godam me jama ho gayi!`);
    };

    window.jwtSaveNewWorkerProfile = () => {
        const name = normText(document.getElementById('jwt-cr-w-name')?.value);
        const mobile = String(document.getElementById('jwt-cr-w-mob')?.value || '').trim();
        const address = String(document.getElementById('jwt-cr-w-addr')?.value || '').trim();
        const joinDate = toIsoDate(document.getElementById('jwt-cr-w-date')?.value) || getTodayIso();

        if (!name) return toast('Worker Name zaroori hai!', true);

        const list = safeArr(getStoreSafe('jobwork_workers')).slice();
        list.push({
            id: `jw_${Date.now()}`,
            type: selectedCreateGroupKey || 'cutting',
            date: joinDate,
            name,
            address,
            mobile
        });

        setStoreSafe('jobwork_workers', list);
        ['jwt-cr-w-name', 'jwt-cr-w-mob', 'jwt-cr-w-addr'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        invalidateAllCaches();
        syncTallyMasterGroups();
        renderCurrent();
        toast(`✅ Worker [${name}] (${grpLabel(selectedCreateGroupKey)}) save ho gaya!`);
    };

    window.jwtSaveNewWorkGroup = () => {
        const raw = String(document.getElementById('jwt-cr-g-name')?.value || '').trim();
        if (!raw) return toast('Work Group Name likhein!', true);
        const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!key || key === 'all' || key === 'kariger') return toast('Yeh naam reserve hai, koi doosra naam likhein!', true);

        const groups = getWorkGroups();
        if (groups.some((g) => g.key === key)) return toast('Yeh Work Group pehle se maujood hai!', true);

        groups.push({ key, label: raw });
        setStoreSafe(GROUPS_STORE_KEY, groups);
        selectedCreateGroupKey = key;

        const gInp = document.getElementById('jwt-cr-g-name');
        if (gInp) gInp.value = '';

        setCreateMode('worker');
        invalidateAllCaches();
        syncTallyMasterGroups();
        renderCurrent();
        toast(`✅ Naya Group [${raw}] poore software me jud gaya!`);
    };

    /* ========================================================================
       7. A6 THERMAL PRINT & WHATSAPP SHARE
    ======================================================================== */
    window.jwtPrintLastChallan = () => {
        if (!lastChallanData) return toast('Abhi koi naya Issue/Return nahi hua hai.', true);
        const c = lastChallanData;
        const pw = window.open('', '', 'width=420,height=520');
        if (!pw) return alert('Popup block hai! Kripya allow karein.');
        pw.document.write(`<html><head><title>JobWork Slip - A6</title>
            <style>
                @page { size: A6 portrait; margin: 4mm; }
                body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                .box { border: 1.5px dashed #000; padding: 8px; max-width: 90mm; margin: 0 auto; }
                .hdr { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 4px; gap: 8px; }
                .tot { background: #eee; border: 1px solid #000; text-align: center; font-size: 14px; font-weight: 900; padding: 6px; margin: 10px 0; }
                .sign { display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; }
            </style></head><body>
            <div class="box">
                <div class="hdr"><h3 style="margin:0;">SIMPLICITY ERP</h3><div>${esc(c.mode)}</div></div>
                <div class="row"><strong>Worker:</strong><span>${esc(c.workerName)} (${esc(c.groupLabel)})</span></div>
                <div class="row"><strong>Tarikh:</strong><span>${esc(fmtDate(c.date))}</span></div>
                <div class="row"><strong>Saree:</strong><span>${esc(c.saree)} (${esc(c.maker)})</span></div>
                <div class="row"><strong>Process Trail:</strong><span>${esc(c.trail)}</span></div>
                <div class="tot">KUL SAREE: ${c.pcs} Pcs</div>
                <div class="sign"><div>हस्ताक्षर मुंशी<br><br>_______</div><div>हस्ताक्षर पाने वाला<br><br>_______</div></div>
            </div>
            <script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),600);};<\/script>
            </body></html>`);
        pw.document.close();
    };

    window.jwtShareWorkerWhatsApp = (wId) => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === (wId || activeWorkerId));
        if (!w) return;
        const mob = getCleanMobile(w.mobile);
        if (!mob || mob.length < 10) return toast(`${w.name} ka Mobile No. saved nahi hai!`, true);

        const details = w.pendingItems.length
            ? w.pendingItems.map((p) => `• ${p.saree} (${p.maker}): *${p.pcs} Pcs* [${formatTrail(p.doneStages, 'unfinished')}]`).join('\n')
            : '• Koi saree pending nahi';

        const msg = `*SIMPLICITY ERP — ${grpLabel(w.group).toUpperCase()} HISAB*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `Kariger: *${w.name}*\nTarikh: ${fmtDate(getTodayIso())}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `Diya: ${w.diya} Pcs | Aai: ${w.aai} Pcs\n` +
            `*ABHI BAKI SAREE: ${w.pending} Pcs*\n\n` +
            `*Pending Saree Detail:*\n${details}\n` +
            `━━━━━━━━━━━━━━━━━━━\n_Simplicity ERP_`;

        window.open(`https://wa.me/${mob}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       8. UI RENDERERS & DOM INJECTION (TALLY WHITE & GOLD)
    ======================================================================== */
    const injectStyles = () => {
        if (document.getElementById('jwt-styles')) return;
        const st = document.createElement('style');
        st.id = 'jwt-styles';
        st.textContent = `
            #jw-trail-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #1f2937;
            }
            #jw-trail-section * { box-sizing: border-box; }
            #jw-trail-section .jwt-topbar {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 18px; display: flex; justify-content: space-between;
                align-items: center; gap: 10px; flex-wrap: wrap;
            }
            #jw-trail-section .jwt-topbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            #jw-trail-section .jwt-topbar h2 { margin: 0; font-size: 16px; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-crumb {
                font-size: 11.5px; font-weight: 700; color: #92400e;
                background: #ffffff; border: 1px solid #d9b86c; padding: 2px 9px; border-radius: 999px;
            }
            #jw-trail-section .jwt-esc {
                background: #ffffff; border: 1px solid #d1d5db; color: #374151;
                padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;
            }
            #jw-trail-section .jwt-esc:hover { border-color: #d9a425; background: #fef9ea; }
            #jw-trail-section .jwt-kpi-strip {
                display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
                border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7;
            }
            #jw-trail-section .jwt-kpi-cell { padding: 9px 14px; border-right: 1px solid #e5d5a7; }
            #jw-trail-section .jwt-kpi-cell:last-child { border-right: none; background: #fdf6e2; }
            #jw-trail-section .jwt-kpi-cell small { display: block; font-size: 10.5px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-kpi-cell strong { display: block; font-size: 15px; color: #b47d00; font-weight: 900; margin-top: 2px; }
            #jw-trail-section .jwt-gw-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) 330px; min-height: 430px; }
            #jw-trail-section .jwt-gw-left { padding: 16px; border-right: 1.5px solid #e5d5a7; background: #ffffff; }
            #jw-trail-section .jwt-gw-right { background: #fdfcf7; display: flex; flex-direction: column; justify-content: space-between; }
            #jw-trail-section .jwt-gw-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 10px 14px;
                font-size: 13px; font-weight: 800; color: #1f2937; text-align: center;
            }
            #jw-trail-section .jwt-sec-lbl {
                padding: 10px 16px 4px; font-size: 10.5px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            #jw-trail-section .jwt-gw-item {
                width: 100%; text-align: left; background: transparent; border: none; border-bottom: 1px solid #f3f4f6;
                padding: 10px 16px; font-size: 13px; font-weight: 600; color: #1f2937; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center;
            }
            #jw-trail-section .jwt-gw-item:hover { background: #fef9ea; }
            #jw-trail-section .jwt-gw-item.active { background: #f2b71d; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-gw-key { color: #b45309; font-weight: 900; text-decoration: underline; }
            #jw-trail-section .jwt-gw-item.active .jwt-gw-key { color: #1f2937; }
            #jw-trail-section .jwt-gw-val { font-size: 11.5px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-gw-item.active .jwt-gw-val { color: #1f2937; }
            #jw-trail-section .jwt-sec-title {
                font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase;
                letter-spacing: 0.4px; margin: 0 0 8px 0;
            }
            #jw-trail-section table { width: 100%; min-width: 0 !important; border-collapse: collapse; border: 1px solid #e5d5a7; font-size: 12.5px; background: #fff; }
            #jw-trail-section th {
                background: #fdf6e2; color: #1f2937; font-size: 11.5px; font-weight: 800;
                padding: 8px 10px; text-align: left; border-bottom: 1.5px solid #e5d5a7;
            }
            #jw-trail-section td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #1f2937; vertical-align: top; }
            #jw-trail-section tr.jwt-row { cursor: pointer; }
            #jw-trail-section tr.jwt-row:hover { background: #fef9ea; }
            #jw-trail-section .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
            #jw-trail-section .gold-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; color: #b47d00; }
            #jw-trail-section .trail { font-size: 12px; font-weight: 700; color: #92400e; }
            #jw-trail-section .trail-muted { font-size: 11.5px; color: #6b7280; font-weight: 600; }
            #jw-trail-section .trail-done { font-size: 12px; font-weight: 800; color: #065f46; }
            #jw-trail-section .jwt-subnav {
                display: flex; gap: 18px; padding: 0 16px; border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7; overflow-x: auto;
            }
            #jw-trail-section .jwt-tab {
                background: none; border: none; border-bottom: 2.5px solid transparent;
                padding: 9px 2px; font-size: 12.5px; font-weight: 700; color: #6b7280; cursor: pointer; white-space: nowrap;
            }
            #jw-trail-section .jwt-tab.active { color: #1f2937; border-bottom-color: #d9a425; font-weight: 800; }
            #jw-trail-section .jwt-split { display: grid; grid-template-columns: minmax(0, 1.25fr) 320px; }
            #jw-trail-section .jwt-pane-l { padding: 16px; border-right: 1.5px solid #e5d5a7; }
            #jw-trail-section .jwt-pane-r { padding: 12px; background: #fdfcf7; }
            #jw-trail-section .jwt-frow { display: grid; grid-template-columns: 145px minmax(0, 1fr); align-items: center; gap: 10px; margin-bottom: 9px; }
            #jw-trail-section .jwt-frow label { font-size: 12px; font-weight: 700; color: #374151; }
            #jw-trail-section .jwt-inp {
                width: 100%; padding: 6px 9px; border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 12.5px; font-weight: 700; color: #111827; background: #fff; outline: none;
            }
            #jw-trail-section .jwt-inp:focus { border-color: #d9a425; background: #fffdf5; box-shadow: 0 0 0 2px rgba(242,183,29,0.2); }
            #jw-trail-section .jwt-save {
                background: #f2b71d; border: 1px solid #d9a425; color: #1f2937;
                padding: 7px 16px; border-radius: 4px; font-size: 12.5px; font-weight: 800; cursor: pointer;
            }
            #jw-trail-section .jwt-save:hover { background: #e5aa12; }
            #jw-trail-section .jwt-sidebox { border: 1.5px solid #d9b86c; border-radius: 5px; background: #fff; overflow: hidden; }
            #jw-trail-section .jwt-sidebox-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 7px 10px;
                font-size: 12px; font-weight: 800; color: #1f2937; display: flex; justify-content: space-between;
            }
            #jw-trail-section .jwt-side-opt {
                padding: 8px 10px; border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-size: 12px;
            }
            #jw-trail-section .jwt-side-opt:hover { background: #fef9ea; }
            #jw-trail-section .jwt-side-opt.selected { background: #f2b71d; font-weight: 700; }
            #jw-trail-section .jwt-footer {
                background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 8px 16px;
                display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
                font-size: 11.5px; color: #92400e; font-weight: 700;
            }
            #jwt-toast {
                position: fixed; bottom: 16px; right: 16px; z-index: 999999;
                padding: 9px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700;
                display: none; box-shadow: 0 8px 20px rgba(0,0,0,0.28);
            }
            @media (max-width: 860px) {
                #jw-trail-section .jwt-gw-grid,
                #jw-trail-section .jwt-split { grid-template-columns: 1fr; }
                #jw-trail-section .jwt-gw-left,
                #jw-trail-section .jwt-pane-l { border-right: none; border-bottom: 1.5px solid #e5d5a7; }
                #jw-trail-section .jwt-kpi-strip { grid-template-columns: repeat(2, 1fr); }
                #jw-trail-section .jwt-frow { grid-template-columns: 1fr; gap: 4px; }
            }
        `;
        document.head.appendChild(st);
    };

    const ensureSectionDOM = () => {
        injectStyles();
        let sec = document.getElementById('jw-trail-section');
        if (sec) return sec;

        sec = document.createElement('section');
        sec.id = 'jw-trail-section';
        sec.className = 'module-section';
        sec.style.display = 'none';

        sec.innerHTML = `
            <div class="jwt-topbar">
                <div class="jwt-topbar-left">
                    <button type="button" class="jwt-esc" id="jwt-top-back-btn" onclick="jwtHandleEsc()">&larr; [Esc] Dashboard</button>
                    <h2 id="jwt-screen-title">Simplicity JobWork &amp; Saree Trail</h2>
                    <span class="jwt-crumb" id="jwt-godam-badge">Sabhi Karkhane</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="jwt-esc" onclick="jwtOpenScreen('gateway')">Gateway</button>
                    <button type="button" class="jwt-esc" onclick="jwtOpenScreen('malik')">Malik Report</button>
                    <button type="button" class="jwt-esc" onclick="jwtOpenScreen('stock')">Saree Stock</button>
                    <button type="button" class="jwt-esc" onclick="jwtOpenScreen('jobwork')">Workers</button>
                    <button type="button" class="jwt-esc" onclick="jwtOpenScreen('create')">+ Create</button>
                </div>
            </div>

            <div class="jwt-kpi-strip" id="jwt-kpi-strip"></div>

            <!-- SCREEN 1: GATEWAY -->
            <div id="jwt-scr-gateway">
                <div class="jwt-gw-grid">
                    <div class="jwt-gw-left">
                        <h3 class="jwt-sec-title">JobWork Summary (Workers Ke Paas)</h3>
                        <div style="overflow-x:auto; margin-bottom:14px;">
                            <table>
                                <thead><tr><th>Work Group</th><th class="num">Diya</th><th class="num">Aai</th><th class="num">Abhi Pending</th></tr></thead>
                                <tbody id="jwt-gw-jw-tbody"></tbody>
                            </table>
                        </div>

                        <h3 class="jwt-sec-title">Godam Stock Haalat (Completed Trail)</h3>
                        <div style="overflow-x:auto;">
                            <table>
                                <thead><tr><th>Saree &amp; Completed Stages</th><th class="num">Available</th></tr></thead>
                                <tbody id="jwt-gw-stock-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <aside class="jwt-gw-right">
                        <div>
                            <div class="jwt-gw-head">Gateway of JobWork &amp; Trail</div>
                            <div class="jwt-sec-lbl">Reports &amp; Stock</div>
                            <button type="button" class="jwt-gw-item active" onclick="jwtOpenScreen('malik')">
                                <span><span class="jwt-gw-key">M</span>alik Report (Full Hisab)</span>
                                <span class="jwt-gw-val">Workers + Trail</span>
                            </button>
                            <button type="button" class="jwt-gw-item" onclick="jwtOpenScreen('stock')">
                                <span><span class="jwt-gw-key">S</span>aree Stock (Stage Trail)</span>
                                <span class="jwt-gw-val" id="jwt-gw-stock-val">0 Pcs</span>
                            </button>
                            <div class="jwt-sec-lbl">JobWork &amp; Masters</div>
                            <button type="button" class="jwt-gw-item" onclick="jwtOpenScreen('jobwork')">
                                <span><span class="jwt-gw-key">J</span>obWork Register</span>
                                <span class="jwt-gw-val" id="jwt-gw-jw-val">0 Pending</span>
                            </button>
                            <button type="button" class="jwt-gw-item" onclick="jwtOpenScreen('create')">
                                <span><span class="jwt-gw-key">C</span>reate (Worker / Group)</span>
                                <span class="jwt-gw-val" id="jwt-gw-grp-val">Groups</span>
                            </button>
                            <div class="jwt-sec-lbl">Dukan &amp; Accounts</div>
                            <button type="button" class="jwt-gw-item" onclick="jwtOpenLegacySub('dukan')">
                                <span><span class="jwt-gw-key">D</span>ukan Bheja (Dispatch)</span>
                                <span class="jwt-gw-val">Final Out</span>
                            </button>
                            <button type="button" class="jwt-gw-item" onclick="jwtOpenLegacySub('billing')">
                                <span><span class="jwt-gw-key">B</span>ills &amp; Hisab</span>
                                <span class="jwt-gw-val">Payments</span>
                            </button>
                        </div>
                        <div class="jwt-footer">
                            <span>[&uarr; &darr;] Chunein &middot; [Enter] Kholein</span>
                            <span>[M / S / J / C / D / B]</span>
                        </div>
                    </aside>
                </div>
            </div>

            <!-- SCREEN 2: MALIK REPORT -->
            <div id="jwt-scr-malik" style="display:none;">
                <div style="padding:14px 16px;">
                    <h3 class="jwt-sec-title">1. Har JobWorker Ke Paas Pending Sarees (Full Profile + Saree Detail)</h3>
                    <div style="overflow-x:auto; margin-bottom:16px;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Worker (Naam &amp; Group)</th>
                                    <th>Mobile &amp; Address</th>
                                    <th>Kaunsi Saree Paas Hai (Aur Pehle Kya Ho Chuka)</th>
                                    <th class="num">Diya / Aai</th>
                                    <th class="num">Pending</th>
                                </tr>
                            </thead>
                            <tbody id="jwt-malik-workers-tbody"></tbody>
                        </table>
                    </div>

                    <h3 class="jwt-sec-title">2. Godam Mein Maujood Saree (Exact Completed Stages Trail)</h3>
                    <div style="overflow-x:auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Saree Design &amp; Kariger</th>
                                    <th>Godam</th>
                                    <th>Ab Tak Kaun-Kaun Se Stages Complete Hue</th>
                                    <th>Status</th>
                                    <th class="num">Available Pcs</th>
                                </tr>
                            </thead>
                            <tbody id="jwt-malik-godam-tbody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="jwt-footer">
                    <span>Worker row par click karke seedha uska Issue/Return Voucher kholein</span>
                    <span>[Esc] Gateway</span>
                </div>
            </div>

            <!-- SCREEN 3: SAREE STOCK (COMPLETED PROCESS TRAIL) -->
            <div id="jwt-scr-stock" style="display:none;">
                <div class="jwt-subnav" id="jwt-stock-filter-tabs"></div>
                <div style="padding:12px 16px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; align-items:center;">
                        <input type="text" id="jwt-stock-search" class="jwt-inp" style="flex:1; min-width:200px;" placeholder="Search Saree, Maker, ya Stage (jaise: Cutting, Jhalar, Embroidery)..." oninput="jwtRenderStockScreen()">
                        <button type="button" class="jwt-save" onclick="jwtToggleInwardForm()">+ Saree Inward</button>
                    </div>

                    <div id="jwt-inward-form" style="display:none; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px 14px; margin-bottom:12px;">
                        <div class="jwt-sec-title" style="margin-top:0;">Direct Godam Saree Inward</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
                            <div><label style="font-size:11px; font-weight:700;">Tarikh</label><input type="date" id="jwt-inw-date" class="jwt-inp"></div>
                            <div><label style="font-size:11px; font-weight:700;">Saree Design</label><input type="text" id="jwt-inw-saree" class="jwt-inp" placeholder="e.g. Banarasi Katan"></div>
                            <div><label style="font-size:11px; font-weight:700;">Kariger (Maker)</label><input type="text" id="jwt-inw-maker" class="jwt-inp" placeholder="e.g. Raju"></div>
                            <div><label style="font-size:11px; font-weight:700;">Pcs</label><input type="text" inputmode="numeric" id="jwt-inw-pcs" class="jwt-inp" placeholder="e.g. 20"></div>
                            <div>
                                <label style="font-size:11px; font-weight:700;">Stage</label>
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
                            <button type="button" class="jwt-esc" onclick="jwtToggleInwardForm()">Cancel</button>
                            <button type="button" class="jwt-save" onclick="jwtSaveManualSareeInward()">Save Inward</button>
                        </div>
                    </div>

                    <div style="overflow-x:auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Saree Design</th>
                                    <th>Kariger (Maker)</th>
                                    <th>Godam</th>
                                    <th>Completed Stages Trail (Kaam Ho Chuka)</th>
                                    <th>Bucket</th>
                                    <th class="num">Bachi Saree</th>
                                </tr>
                            </thead>
                            <tbody id="jwt-stock-tbody"></tbody>
                        </table>
                    </div>

                    <div id="jwt-passbook-drawer" style="display:none; margin-top:12px; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px;"></div>
                </div>
                <div class="jwt-footer">
                    <span id="jwt-stock-foot-summary">0 Pcs</span>
                    <span>Row click par Passbook khulegi &middot; [Esc] Back</span>
                </div>
            </div>

            <!-- SCREEN 4: JOBWORK REGISTER & WORKER VOUCHER -->
            <div id="jwt-scr-jobwork" style="display:none;">
                <div id="jwt-jw-list-view">
                    <div class="jwt-subnav" id="jwt-jw-group-tabs"></div>
                    <div style="padding:12px 16px;">
                        <input type="text" id="jwt-jw-search" class="jwt-inp" style="margin-bottom:10px;" placeholder="Search Worker Name, Mobile, Address..." oninput="jwtRenderWorkersList()">
                        <div style="overflow-x:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Worker Name</th>
                                        <th>Work Group</th>
                                        <th>Mobile &amp; Address</th>
                                        <th>Kaunsi Saree Paas Hai</th>
                                        <th class="num">Pending Pcs</th>
                                        <th style="text-align:right;">Open</th>
                                    </tr>
                                </thead>
                                <tbody id="jwt-jw-workers-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="jwt-jw-voucher-view" style="display:none;">
                    <div style="background:#fdfcf7; border-bottom:1px solid #e5d5a7; padding:9px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:12.5px;">
                        <div>
                            <strong id="jwt-vch-worker-name">-</strong> &middot;
                            <span id="jwt-vch-worker-meta" style="color:#6b7280; font-weight:600;">-</span>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <span style="color:#92400e; font-weight:800;" id="jwt-vch-worker-totals">Pending: 0 Pcs</span>
                            <button type="button" class="jwt-esc" onclick="jwtShareWorkerWhatsApp()">WhatsApp</button>
                            <button type="button" class="jwt-esc" onclick="jwtPrintLastChallan()">Last A6 Slip</button>
                        </div>
                    </div>

                    <div class="jwt-subnav">
                        <button type="button" class="jwt-tab active" id="jwt-vch-tab-issue" onclick="jwtSetVchMode('issue')">1. Saree Issue Karein (Bhejein)</button>
                        <button type="button" class="jwt-tab" id="jwt-vch-tab-return" onclick="jwtSetVchMode('return')">2. Saree Wapas Lein (Return)</button>
                        <button type="button" class="jwt-tab" id="jwt-vch-tab-history" onclick="jwtSetVchMode('history')">3. Worker Khata History</button>
                    </div>

                    <div id="jwt-vch-split-pane" class="jwt-split">
                        <div class="jwt-pane-l">
                            <div id="jwt-vch-issue-form">
                                <div class="jwt-frow">
                                    <label>Tarikh :</label>
                                    <input type="date" id="jwt-issue-date" class="jwt-inp">
                                </div>
                                <div class="jwt-frow">
                                    <label>Selected Saree Batch :</label>
                                    <input type="text" id="jwt-issue-batch" class="jwt-inp" readonly placeholder="Right side list se Saree chunein...">
                                </div>
                                <div class="jwt-frow">
                                    <label>Quantity (Pcs) :</label>
                                    <input type="text" inputmode="numeric" id="jwt-issue-qty" class="jwt-inp" placeholder="e.g. 10">
                                </div>
                                <div style="text-align:right; margin-top:12px;">
                                    <button type="button" class="jwt-save" onclick="jwtSubmitIssue()">Issue Confirm [Enter]</button>
                                </div>
                            </div>

                            <div id="jwt-vch-return-form" style="display:none;">
                                <div class="jwt-frow">
                                    <label>Tarikh :</label>
                                    <input type="date" id="jwt-ret-date" class="jwt-inp">
                                </div>
                                <div class="jwt-frow">
                                    <label>Pending Saree Batch :</label>
                                    <input type="text" id="jwt-ret-batch" class="jwt-inp" readonly placeholder="Right side se pending saree chunein...">
                                </div>
                                <div class="jwt-frow">
                                    <label>Wapas Aai (Pcs) :</label>
                                    <input type="text" inputmode="numeric" id="jwt-ret-qty" class="jwt-inp" placeholder="e.g. 10">
                                </div>
                                <div class="jwt-frow">
                                    <label>Wapas Aake Kahan :</label>
                                    <select id="jwt-ret-dest" class="jwt-inp" onchange="jwtToggleFineRow()"></select>
                                </div>
                                <div class="jwt-frow" id="jwt-ret-fine-row" style="display:none;">
                                    <label>Damage Fine (₹) :</label>
                                    <input type="text" inputmode="decimal" id="jwt-ret-fine" class="jwt-inp" placeholder="0.00">
                                </div>
                                <div style="text-align:right; margin-top:12px;">
                                    <button type="button" class="jwt-save" onclick="jwtSubmitReturn()">Return Confirm [Enter]</button>
                                </div>
                            </div>
                        </div>

                        <div class="jwt-pane-r">
                            <div class="jwt-sidebox">
                                <div class="jwt-sidebox-head">
                                    <span id="jwt-vch-side-title">Godam Available Sarees</span>
                                    <small id="jwt-vch-side-count">0</small>
                                </div>
                                <div style="padding:6px; border-bottom:1px solid #f3f4f6;">
                                    <input type="text" id="jwt-vch-side-search" class="jwt-inp" placeholder="Search saree / stage..." oninput="jwtRenderVchSideList()">
                                </div>
                                <div id="jwt-vch-side-list" style="max-height:290px; overflow-y:auto;"></div>
                            </div>
                        </div>
                    </div>

                    <div id="jwt-vch-history-pane" style="display:none; padding:14px 16px;">
                        <div style="overflow-x:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tarikh</th>
                                        <th>Type</th>
                                        <th>Saree &amp; Trail Detail</th>
                                        <th class="num">Gayi</th>
                                        <th class="num">Aayi</th>
                                        <th class="num">Damage</th>
                                        <th style="text-align:right;">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="jwt-vch-hist-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="jwt-footer">
                    <span id="jwt-jw-footer-tip">Worker par click karke Issue / Return karein</span>
                    <span>[Esc] Back</span>
                </div>
            </div>

            <!-- SCREEN 5: CREATE WORKER / WORK GROUP -->
            <div id="jwt-scr-create" style="display:none;">
                <div class="jwt-subnav">
                    <button type="button" class="jwt-tab active" id="jwt-cr-tab-worker" onclick="jwtSetCreateMode('worker')">1. Create JobWorker Profile</button>
                    <button type="button" class="jwt-tab" id="jwt-cr-tab-group" onclick="jwtSetCreateMode('group')">2. Create New Work Group (Jhalar / Stone...)</button>
                </div>

                <div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div id="jwt-cr-worker-form">
                            <div class="jwt-frow"><label>Worker Name :</label><input type="text" id="jwt-cr-w-name" class="jwt-inp" placeholder="e.g. Aslam Bhai"></div>
                            <div class="jwt-frow"><label>Under (Work Group) :</label><input type="text" id="jwt-cr-w-grp" class="jwt-inp" readonly placeholder="Right side list se Group chunein"></div>
                            <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-cr-w-mob" maxlength="10" class="jwt-inp" placeholder="10-digit Mobile"></div>
                            <div class="jwt-frow"><label>Address / Mohalla :</label><input type="text" id="jwt-cr-w-addr" class="jwt-inp" placeholder="e.g. Alaipura, Varanasi"></div>
                            <div class="jwt-frow"><label>Join Date :</label><input type="date" id="jwt-cr-w-date" class="jwt-inp"></div>
                            <div style="text-align:right; margin-top:12px;">
                                <button type="button" class="jwt-save" onclick="jwtSaveNewWorkerProfile()">Save Worker</button>
                            </div>
                        </div>

                        <div id="jwt-cr-group-form" style="display:none;">
                            <div class="jwt-frow"><label>Work Group Name :</label><input type="text" id="jwt-cr-g-name" class="jwt-inp" placeholder="e.g. Jhalar, Stone, Tassel"></div>
                            <div style="font-size:12px; color:#6b7280; margin:6px 0 14px;">
                                Save karte hi yeh Group poore software (Create, JobWork, Saree Completed Trail aur Malik Report) mein automatic jud jayega aur Supabase par sync ho jayega.
                            </div>
                            <div style="text-align:right;">
                                <button type="button" class="jwt-save" onclick="jwtSaveNewWorkGroup()">Save Group</button>
                            </div>
                        </div>
                    </div>

                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head">
                                <span>List of Work Groups</span>
                                <small id="jwt-cr-grp-count">0</small>
                            </div>
                            <div id="jwt-cr-grp-side-list"></div>
                        </div>
                    </div>
                </div>

                <div class="jwt-footer">
                    <span>Side List se Work Group chunein &middot; Supabase row-by-row synced</span>
                    <span>[Esc] Gateway</span>
                </div>
            </div>
        `;

        const mainContainer = document.querySelector('#desktop-screen .main-container');
        if (mainContainer) mainContainer.appendChild(sec);
        else document.body.appendChild(sec);

        // Bind Enter inside Issue/Return qty inputs
        const issQ = document.getElementById('jwt-issue-qty');
        if (issQ) {
            issQ.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); window.jwtSubmitIssue(); }
            });
        }
        const retQ = document.getElementById('jwt-ret-qty');
        if (retQ) {
            retQ.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); window.jwtSubmitReturn(); }
            });
        }

        return sec;
    };

    const renderKpiStrip = (snap) => {
        const t = snap.totals;
        const el = document.getElementById('jwt-kpi-strip');
        if (el) {
            el.innerHTML = `
                <div class="jwt-kpi-cell"><small>Godam (Kaam Baaki)</small><strong>${t.raw} Pcs</strong></div>
                <div class="jwt-kpi-cell"><small>Workers Ke Paas (Pending)</small><strong>${t.pending} Pcs</strong></div>
                <div class="jwt-kpi-cell"><small>Finished (Tayyar)</small><strong>${t.finished} Pcs</strong></div>
                <div class="jwt-kpi-cell"><small>Lott (Damage)</small><strong>${t.lott} Pcs</strong></div>
                <div class="jwt-kpi-cell"><small>KUL SAREE (100% Match)</small><strong>${t.total} Pcs</strong></div>
            `;
        }
        const gEl = document.getElementById('jwt-godam-badge');
        if (gEl) gEl.textContent = getGodamLabel(snap.godamFilter);
        const sVal = document.getElementById('jwt-gw-stock-val');
        const jVal = document.getElementById('jwt-gw-jw-val');
        const grpVal = document.getElementById('jwt-gw-grp-val');
        if (sVal) sVal.textContent = `${t.raw + t.finished + t.lott} Pcs`;
        if (jVal) jVal.textContent = `${t.pending} Pending`;
        if (grpVal) grpVal.textContent = `${snap.groups.length} Groups`;
    };

    const renderGateway = (snap) => {
        const jwBody = document.getElementById('jwt-gw-jw-tbody');
        if (jwBody) {
            jwBody.innerHTML = snap.groups.map((grp) => {
                const ws = snap.workers.filter((w) => w.group === grp.key);
                const diya = ws.reduce((s, w) => s + w.diya, 0);
                const aai = ws.reduce((s, w) => s + w.aai, 0);
                const pend = ws.reduce((s, w) => s + w.pending, 0);
                return `<tr class="jwt-row" onclick="jwtOpenGroupWorkers('${esc(grp.key)}')">
                    <td><strong>${esc(grp.label)}</strong> <span class="trail-muted">(${ws.length})</span></td>
                    <td class="num">${diya}</td>
                    <td class="num">${aai}</td>
                    <td class="gold-num">${pend} Pcs</td>
                </tr>`;
            }).join('') || `<tr><td colspan="4" style="text-align:center; padding:16px; color:#6b7280;">Koi work group nahi hai.</td></tr>`;
        }

        const stBody = document.getElementById('jwt-gw-stock-tbody');
        if (stBody) {
            stBody.innerHTML = snap.godamBatches.length
                ? snap.godamBatches.map((b) => `
                    <tr class="jwt-row" onclick="jwtOpenScreen('stock')">
                        <td>
                            <strong>${esc(b.saree)}</strong> <span class="trail-muted">(${esc(b.maker)} &middot; ${esc(b.godamName)})</span>
                            <div class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${esc(formatTrail(b.doneStages, b.bucket))}</div>
                        </td>
                        <td class="gold-num">${b.pcs} Pcs</td>
                    </tr>`).join('')
                : `<tr><td colspan="2" style="text-align:center; padding:16px; color:#6b7280;">Godam me abhi koi saree nahi hai.</td></tr>`;
        }
    };

    const renderMalik = (snap) => {
        const wBody = document.getElementById('jwt-malik-workers-tbody');
        if (wBody) {
            wBody.innerHTML = snap.workers.length
                ? snap.workers.map((w) => {
                    const sHtml = w.pendingItems.length
                        ? w.pendingItems.map((p) => `<div><strong>${esc(p.saree)}</strong> (${esc(p.maker)}) &mdash; <strong>${p.pcs} Pcs</strong> <span class="trail-muted">[${esc(formatTrail(p.doneStages, 'unfinished'))}]</span></div>`).join('')
                        : '<span class="trail-muted">Koi saree pending nahi</span>';

                    return `<tr class="jwt-row" onclick="jwtOpenWorkerVoucher('${esc(w.id)}')">
                        <td><strong>${esc(w.name)}</strong><div class="trail">${esc(grpLabel(w.group))}</div></td>
                        <td><div>${esc(w.mobile || '-')}</div><div class="trail-muted">${esc(w.address || '-')}</div></td>
                        <td>${sHtml}</td>
                        <td class="num">${w.diya} / ${w.aai}</td>
                        <td class="gold-num">${w.pending} Pcs</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#6b7280;">Koi JobWorker nahi bana hai.</td></tr>`;
        }

        const gBody = document.getElementById('jwt-malik-godam-tbody');
        if (gBody) {
            gBody.innerHTML = snap.godamBatches.length
                ? snap.godamBatches.map((b) => {
                    const bLbl = b.bucket === 'finished' ? 'Finished' : (b.bucket === 'lott' ? 'Lott' : 'Godam (Kaam Baaki)');
                    const cls = b.bucket === 'finished' ? 'trail-done' : 'trail';
                    return `<tr>
                        <td><strong>${esc(b.saree)}</strong> <span class="trail-muted">(${esc(b.maker)})</span></td>
                        <td>${esc(b.godamName)}</td>
                        <td class="${cls}">${esc(formatTrail(b.doneStages, b.bucket))}</td>
                        <td>${bLbl}</td>
                        <td class="gold-num">${b.pcs} Pcs</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#6b7280;">Godam khali hai.</td></tr>`;
        }
    };

    window.jwtSetStockFilter = (f) => {
        stockFilter = f || 'all';
        selectedPassbookKey = null;
        jwtRenderStockScreen();
    };

    window.jwtToggleInwardForm = () => {
        stockInwardOpen = !stockInwardOpen;
        const f = document.getElementById('jwt-inward-form');
        if (f) f.style.display = stockInwardOpen ? 'block' : 'none';
        if (stockInwardOpen) {
            const dEl = document.getElementById('jwt-inw-date');
            if (dEl) dEl.value = getTodayIso();
            setTimeout(() => document.getElementById('jwt-inw-saree')?.focus(), 30);
        }
    };

    window.jwtRenderStockScreen = () => {
        const snap = getSnapshot();
        const active = snap.godamBatches;
        const tabs = [
            { key: 'all', lbl: 'Sabhi Godam Stock' },
            { key: 'unfinished', lbl: 'Kaam Baaki (WIP)' },
            { key: 'finished', lbl: 'Finished (Ready)' },
            { key: 'lott', lbl: 'Lott' }
        ];

        const tabsEl = document.getElementById('jwt-stock-filter-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = tabs.map((t) => {
                const cnt = (t.key === 'all' ? active : active.filter((b) => b.bucket === t.key)).reduce((s, b) => s + b.pcs, 0);
                return `<button type="button" class="jwt-tab ${stockFilter === t.key ? 'active' : ''}" onclick="jwtSetStockFilter('${t.key}')">${esc(t.lbl)} (${cnt})</button>`;
            }).join('');
        }

        const q = (document.getElementById('jwt-stock-search')?.value || '').trim().toLowerCase();
        const list = active
            .filter((b) => stockFilter === 'all' || b.bucket === stockFilter)
            .filter((b) => !q || `${b.saree} ${b.maker} ${b.godamName} ${formatTrail(b.doneStages, b.bucket)}`.toLowerCase().includes(q));

        const tot = list.reduce((s, b) => s + b.pcs, 0);
        const foot = document.getElementById('jwt-stock-foot-summary');
        if (foot) foot.textContent = `Dikh rahi Sarees: ${tot} Pcs (${list.length} batches)`;

        const tbody = document.getElementById('jwt-stock-tbody');
        if (tbody) {
            tbody.innerHTML = list.length
                ? list.map((b) => `
                    <tr class="jwt-row" onclick="jwtOpenBatchPassbook('${encodeURIComponent(b.key)}')">
                        <td><strong>${esc(b.saree)}</strong></td>
                        <td>${esc(b.maker)}</td>
                        <td>${esc(b.godamName)}</td>
                        <td class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${esc(formatTrail(b.doneStages, b.bucket))}</td>
                        <td>${b.bucket === 'finished' ? 'Finished' : (b.bucket === 'lott' ? 'Lott' : 'Godam WIP')}</td>
                        <td class="gold-num">${b.pcs} Pcs</td>
                    </tr>`).join('')
                : `<tr><td colspan="6" style="text-align:center; padding:20px; color:#6b7280;">Koi batch nahi mila.</td></tr>`;
        }

        const drawer = document.getElementById('jwt-passbook-drawer');
        if (drawer) {
            if (!selectedPassbookKey) {
                drawer.style.display = 'none';
            } else {
                const batch = active.find((b) => b.key === selectedPassbookKey);
                if (!batch) {
                    drawer.style.display = 'none';
                } else {
                    const sH = safeArr(getStoreSafe('saree_history')).filter((h) => {
                        if (!h) return false;
                        const sN = normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
                        const mN = normText(h.karigerName || h.kariger, 'KARKHANA');
                        const kid = normGodam(h.karkhanaId);
                        return sN === batch.saree && mN === batch.maker && kid === batch.karkhanaId;
                    }).sort((a, b) => safeNum(b.timestamp, 0) - safeNum(a.timestamp, 0)).slice(0, 25);

                    drawer.style.display = 'block';
                    drawer.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                            <strong>Passbook: ${esc(batch.saree)} (${esc(batch.maker)}) &mdash; ${esc(formatTrail(batch.doneStages, batch.bucket))}</strong>
                            <button type="button" class="jwt-esc" onclick="document.getElementById('jwt-passbook-drawer').style.display='none'">Close</button>
                        </div>
                        <div style="overflow-x:auto;">
                            <table>
                                <thead><tr><th>Tarikh</th><th>Detail / Worker</th><th class="num">Aai (+)</th><th class="num">Gayi (-)</th></tr></thead>
                                <tbody>
                                    ${sH.map((h) => {
                                        const isOut = (h.isOut === true) || (safeNum(h.gai) > 0);
                                        const qty = isOut ? safeInt(h.gai) : safeInt(h.aai);
                                        return `<tr>
                                            <td>${esc(fmtDate(h.date))}</td>
                                            <td>${esc(h.typeLabel || h.note || '-')}</td>
                                            <td class="num">${!isOut ? `+${qty}` : '-'}</td>
                                            <td class="num" style="color:#6b7280;">${isOut ? `-${qty}` : '-'}</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }
        }
    };

    window.jwtOpenBatchPassbook = (encKey) => {
        selectedPassbookKey = decodeURIComponent(encKey || '');
        jwtRenderStockScreen();
    };

    window.jwtSetJwGroup = (g) => {
        jwFilterGroup = g || 'all';
        jwtRenderWorkersList();
    };

    window.jwtOpenGroupWorkers = (gKey) => {
        jwFilterGroup = gKey || 'all';
        jwSubMode = 'list';
        jwtOpenScreen('jobwork');
    };

    window.jwtOpenWorkerVoucher = (wId) => {
        activeWorkerId = wId;
        jwSubMode = 'voucher';
        vchMode = 'issue';
        selectedGodamKey = null;
        selectedPendingKey = null;
        if (curScreen !== 'jobwork') jwtOpenScreen('jobwork');
        jwSubMode = 'voucher';
        renderCurrent();
    };

    window.jwtSetVchMode = (m) => {
        vchMode = m || 'issue';
        selectedGodamKey = null;
        selectedPendingKey = null;
        ['jwt-issue-batch', 'jwt-issue-qty', 'jwt-ret-batch', 'jwt-ret-qty', 'jwt-ret-fine'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        renderJobWorkScreen(getSnapshot());
    };

    window.jwtToggleFineRow = () => {
        const dest = document.getElementById('jwt-ret-dest')?.value;
        const row = document.getElementById('jwt-ret-fine-row');
        if (row) row.style.display = (dest === 'lott') ? 'grid' : 'none';
    };

    window.jwtRenderWorkersList = () => {
        const snap = getSnapshot();
        const tabsEl = document.getElementById('jwt-jw-group-tabs');
        if (tabsEl) {
            const tabs = [{ key: 'all', label: 'Sabhi' }, ...snap.groups];
            tabsEl.innerHTML = tabs.map((t) => `
                <button type="button" class="jwt-tab ${jwFilterGroup === t.key ? 'active' : ''}" onclick="jwtSetJwGroup('${esc(t.key)}')">${esc(t.label)}</button>
            `).join('');
        }

        const q = (document.getElementById('jwt-jw-search')?.value || '').trim().toLowerCase();
        const ws = snap.workers
            .filter((w) => jwFilterGroup === 'all' || w.group === jwFilterGroup)
            .filter((w) => !q || `${w.name} ${w.mobile} ${w.address} ${grpLabel(w.group)}`.toLowerCase().includes(q));

        const tbody = document.getElementById('jwt-jw-workers-tbody');
        if (tbody) {
            tbody.innerHTML = ws.length
                ? ws.map((w) => {
                    const det = w.pendingItems.length
                        ? w.pendingItems.map((p) => `${esc(p.saree)}: <strong>${p.pcs} Pc</strong>`).join(' &middot; ')
                        : '<span class="trail-muted">Nil</span>';
                    return `<tr class="jwt-row" onclick="jwtOpenWorkerVoucher('${esc(w.id)}')">
                        <td><strong>${esc(w.name)}</strong></td>
                        <td><span class="trail">${esc(grpLabel(w.group))}</span></td>
                        <td><div>${esc(w.mobile || '-')}</div><div class="trail-muted">${esc(w.address || '-')}</div></td>
                        <td>${det}</td>
                        <td class="gold-num">${w.pending} Pcs</td>
                        <td style="text-align:right; font-weight:700;">Issue / Return &rarr;</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="6" style="text-align:center; padding:20px; color:#6b7280;">Is group me koi worker nahi hai. [+ Create] me jaakar banayein.</td></tr>`;
        }
    };

    const renderJobWorkScreen = (snap) => {
        const isVch = (jwSubMode === 'voucher');
        const listV = document.getElementById('jwt-jw-list-view');
        const vchV = document.getElementById('jwt-jw-voucher-view');
        if (listV) listV.style.display = isVch ? 'none' : 'block';
        if (vchV) vchV.style.display = isVch ? 'block' : 'none';

        const backBtn = document.getElementById('jwt-top-back-btn');
        if (backBtn) backBtn.textContent = isVch ? '← [Esc] Workers List' : '← [Esc] Gateway';

        if (!isVch) {
            const tit = document.getElementById('jwt-screen-title');
            if (tit) tit.textContent = 'JobWork Register — Workers & Pending Sarees';
            const tip = document.getElementById('jwt-jw-footer-tip');
            if (tip) tip.textContent = 'Worker par click karke Issue / Return karein';
            jwtRenderWorkersList();
            return;
        }

        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        if (!worker) {
            jwSubMode = 'list';
            return renderJobWorkScreen(snap);
        }

        const tit = document.getElementById('jwt-screen-title');
        if (tit) tit.textContent = `Worker Voucher: ${worker.name} (${grpLabel(worker.group)})`;
        const wNm = document.getElementById('jwt-vch-worker-name');
        const wMt = document.getElementById('jwt-vch-worker-meta');
        const wTt = document.getElementById('jwt-vch-worker-totals');
        if (wNm) wNm.textContent = `${worker.name} [${grpLabel(worker.group)}]`;
        if (wMt) wMt.textContent = `Mob: ${worker.mobile || '-'} · ${worker.address || '-'}`;
        if (wTt) wTt.textContent = `Diya: ${worker.diya} · Aai: ${worker.aai} · Pending: ${worker.pending} Pcs`;

        document.getElementById('jwt-vch-tab-issue')?.classList.toggle('active', vchMode === 'issue');
        document.getElementById('jwt-vch-tab-return')?.classList.toggle('active', vchMode === 'return');
        document.getElementById('jwt-vch-tab-history')?.classList.toggle('active', vchMode === 'history');

        const splitEl = document.getElementById('jwt-vch-split-pane');
        const histEl = document.getElementById('jwt-vch-history-pane');
        if (splitEl) splitEl.style.display = (vchMode === 'history') ? 'none' : 'grid';
        if (histEl) histEl.style.display = (vchMode === 'history') ? 'block' : 'none';

        const issForm = document.getElementById('jwt-vch-issue-form');
        const retForm = document.getElementById('jwt-vch-return-form');
        if (issForm) issForm.style.display = (vchMode === 'issue') ? 'block' : 'none';
        if (retForm) retForm.style.display = (vchMode === 'return') ? 'block' : 'none';

        const issDate = document.getElementById('jwt-issue-date');
        const retDate = document.getElementById('jwt-ret-date');
        if (issDate && !issDate.value) issDate.value = getTodayIso();
        if (retDate && !retDate.value) retDate.value = getTodayIso();

        const destSel = document.getElementById('jwt-ret-dest');
        if (destSel) {
            const prevVal = destSel.value;
            destSel.innerHTML = `
                <option value="godam">Godam me Rakho (${esc(grpLabel(worker.group))} Complete — agle kaam ke liye)</option>
                <option value="finished">Final Tayyar (Seedha Finished Stock me)</option>
                <option value="lott">Lott / Damage</option>
            `;
            if (prevVal && ['godam', 'finished', 'lott'].includes(prevVal)) destSel.value = prevVal;
            else if (worker.group === 'calender') destSel.value = 'finished';
            jwtToggleFineRow();
        }

        if (vchMode === 'history') {
            renderWorkerHistoryTable(worker);
        } else {
            jwtRenderVchSideList();
        }
    };

    const renderWorkerHistoryTable = (worker) => {
        const tbody = document.getElementById('jwt-vch-hist-tbody');
        if (!tbody) return;
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${worker.id}`));
        const allRows = [];
        sheets.forEach((sh) => {
            safeArr(sh.rows).forEach((r) => allRows.push({ sheetId: sh.id, row: r }));
        });
        allRows.reverse();

        if (!allRows.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:18px; color:#6b7280;">Abhi koi transaction nahi hai.</td></tr>`;
            return;
        }

        tbody.innerHTML = allRows.map(({ sheetId, row }) => {
            const gQ = safeInt(row.gayiQty);
            const aQ = safeInt(row.aayiQty);
            const dQ = safeInt(row.damagePcs);
            const isGayi = gQ > 0;
            const items = isGayi ? safeArr(row.gayiItems) : safeArr(row.aayiItems);
            const det = items.length
                ? items.map((it) => `${esc(it.saree || 'Saree')} (${esc(it.karigar || '-')}) [${esc(formatTrail(it.doneStages || [], it.destBucket || 'unfinished'))}]`).join(', ')
                : '-';

            return `<tr>
                <td>${esc(fmtDate(row.date))}</td>
                <td><strong>${isGayi ? 'ISSUE' : (dQ > 0 ? 'LOTT' : 'RETURN')}</strong></td>
                <td>${det}</td>
                <td class="num">${gQ > 0 ? `-${gQ}` : '-'}</td>
                <td class="gold-num">${aQ > 0 ? `+${aQ}` : '-'}</td>
                <td class="num">${dQ > 0 ? dQ : '-'}</td>
                <td style="text-align:right;">
                    <button type="button" class="jwt-esc" onclick="jwtDeleteWorkerRow('${esc(sheetId)}', '${esc(row.id)}')">Delete</button>
                </td>
            </tr>`;
        }).join('');
    };

    window.jwtRenderVchSideList = () => {
        const snap = getSnapshot();
        const q = (document.getElementById('jwt-vch-side-search')?.value || '').trim().toLowerCase();
        const listEl = document.getElementById('jwt-vch-side-list');
        const titleEl = document.getElementById('jwt-vch-side-title');
        const cntEl = document.getElementById('jwt-vch-side-count');
        if (!listEl) return;

        if (vchMode === 'issue') {
            if (titleEl) titleEl.textContent = 'Godam Stock (Completed Trail)';
            const items = snap.godamBatches
                .filter((b) => b.bucket === 'unfinished' && b.pcs > 0)
                .filter((b) => !q || `${b.saree} ${b.maker} ${b.godamName} ${formatTrail(b.doneStages, b.bucket)}`.toLowerCase().includes(q));
            if (cntEl) cntEl.textContent = `${items.length} Batches`;

            listEl.innerHTML = items.length
                ? items.map((b) => `
                    <div class="jwt-side-opt ${selectedGodamKey === b.key ? 'selected' : ''}" onclick="jwtPickIssueBatch('${encodeURIComponent(b.key)}')">
                        <div>
                            <div><strong>${esc(b.saree)}</strong> (${esc(b.maker)})</div>
                            <div class="trail" style="font-size:11px;">${esc(formatTrail(b.doneStages, b.bucket))}</div>
                            <div class="trail-muted" style="font-size:10.5px;">${esc(b.godamName)}</div>
                        </div>
                        <strong style="white-space:nowrap;">${b.pcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Godam me unfinished stock nahi hai.</div>`;
        } else {
            if (titleEl) titleEl.textContent = 'Is Worker Ke Paas Pending';
            const items = snap.pendingBatches
                .filter((p) => p.workerId === activeWorkerId && p.pcs > 0)
                .filter((p) => !q || `${p.saree} ${p.maker} ${formatTrail(p.doneStages, 'unfinished')}`.toLowerCase().includes(q));
            if (cntEl) cntEl.textContent = `${items.length} Pending`;

            listEl.innerHTML = items.length
                ? items.map((p) => `
                    <div class="jwt-side-opt ${selectedPendingKey === p.key ? 'selected' : ''}" onclick="jwtPickReturnBatch('${encodeURIComponent(p.key)}')">
                        <div>
                            <div><strong>${esc(p.saree)}</strong> (${esc(p.maker)})</div>
                            <div class="trail-muted" style="font-size:11px;">${esc(formatTrail(p.doneStages, 'unfinished'))}</div>
                        </div>
                        <strong style="white-space:nowrap;">${p.pcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Koi pending saree nahi hai.</div>`;
        }
    };

    window.jwtPickIssueBatch = (encKey) => {
        const key = decodeURIComponent(encKey || '');
        const b = getSnapshot().godamBatches.find((x) => x.key === key);
        if (!b) return;
        selectedGodamKey = key;
        const bInp = document.getElementById('jwt-issue-batch');
        const qInp = document.getElementById('jwt-issue-qty');
        if (bInp) bInp.value = `${b.saree} (${b.maker}) [${formatTrail(b.doneStages, b.bucket)}] — ${b.pcs} Pc`;
        if (qInp) qInp.value = b.pcs;
        jwtRenderVchSideList();
        qInp?.focus();
        qInp?.select();
    };

    window.jwtPickReturnBatch = (encKey) => {
        const key = decodeURIComponent(encKey || '');
        const p = getSnapshot().pendingBatches.find((x) => x.key === key);
        if (!p) return;
        selectedPendingKey = key;
        const bInp = document.getElementById('jwt-ret-batch');
        const qInp = document.getElementById('jwt-ret-qty');
        if (bInp) bInp.value = `${p.saree} (${p.maker}) [${formatTrail(p.doneStages, 'unfinished')}] — ${p.pcs} Pc`;
        if (qInp) qInp.value = p.pcs;
        jwtRenderVchSideList();
        qInp?.focus();
        qInp?.select();
    };

    window.jwtSetCreateMode = (m) => {
        createMode = m || 'worker';
        document.getElementById('jwt-cr-tab-worker')?.classList.toggle('active', createMode === 'worker');
        document.getElementById('jwt-cr-tab-group')?.classList.toggle('active', createMode === 'group');
        const wF = document.getElementById('jwt-cr-worker-form');
        const gF = document.getElementById('jwt-cr-group-form');
        if (wF) wF.style.display = createMode === 'worker' ? 'block' : 'none';
        if (gF) gF.style.display = createMode === 'group' ? 'block' : 'none';
    };

    window.jwtPickCreateGroup = (key) => {
        selectedCreateGroupKey = key;
        renderCreateScreen(getSnapshot());
    };

    const renderCreateScreen = (snap) => {
        const groups = snap.groups;
        if (!groups.some((g) => g.key === selectedCreateGroupKey) && groups.length) {
            selectedCreateGroupKey = groups[0].key;
        }
        const cEl = document.getElementById('jwt-cr-grp-count');
        const gInp = document.getElementById('jwt-cr-w-grp');
        const dInp = document.getElementById('jwt-cr-w-date');
        if (cEl) cEl.textContent = `${groups.length}`;
        if (gInp) gInp.value = grpLabel(selectedCreateGroupKey);
        if (dInp && !dInp.value) dInp.value = getTodayIso();

        const listEl = document.getElementById('jwt-cr-grp-side-list');
        if (listEl) {
            listEl.innerHTML = groups.map((g) => `
                <div class="jwt-side-opt ${selectedCreateGroupKey === g.key ? 'selected' : ''}" onclick="jwtPickCreateGroup('${esc(g.key)}')">
                    <span>${esc(g.label)}</span>
                    <small style="color:#6b7280;">JobWork</small>
                </div>
            `).join('');
        }
    };

    const renderCurrent = () => {
        try {
            const snap = computeLiveState(getActiveGodam());
            renderKpiStrip(snap);

            const backBtn = document.getElementById('jwt-top-back-btn');
            const titleEl = document.getElementById('jwt-screen-title');

            if (curScreen === 'gateway') {
                if (backBtn) backBtn.textContent = '← [Esc] Dashboard';
                if (titleEl) titleEl.textContent = 'Simplicity JobWork & Saree Trail';
                renderGateway(snap);
            } else if (curScreen === 'malik') {
                if (backBtn) backBtn.textContent = '← [Esc] Gateway';
                if (titleEl) titleEl.textContent = 'Malik Report — Workers & Godam Trail';
                renderMalik(snap);
            } else if (curScreen === 'stock') {
                if (backBtn) backBtn.textContent = '← [Esc] Gateway';
                if (titleEl) titleEl.textContent = 'Saree Stock — Completed Process Trail';
                jwtRenderStockScreen();
            } else if (curScreen === 'jobwork') {
                renderJobWorkScreen(snap);
            } else if (curScreen === 'create') {
                if (backBtn) backBtn.textContent = '← [Esc] Gateway';
                if (titleEl) titleEl.textContent = 'Create Master (Worker Profile / Work Group)';
                renderCreateScreen(snap);
            }
        } catch (err) {
            console.error('[JW-Trail] Render failure prevented:', err);
        }
    };

    /* ========================================================================
       9. NAVIGATION & LEGACY ERP BRIDGE (ZERO BREAKAGE)
    ======================================================================== */
    window.jwtOpenScreen = (scr) => {
        curScreen = scr || 'gateway';
        if (scr === 'jobwork') jwSubMode = 'list';
        ['gateway', 'malik', 'stock', 'jobwork', 'create'].forEach((k) => {
            const el = document.getElementById(`jwt-scr-${k}`);
            if (el) el.style.display = (k === curScreen) ? 'block' : 'none';
        });
        renderCurrent();
    };

    window.jwtOpenLegacySub = (sub) => {
        window.__jwtReturnFromLegacy = true;
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const jwSec = document.getElementById('jobwork-section');
        if (jwSec) jwSec.style.display = 'block';
        if (typeof window.openJobWorkSubSection === 'function') {
            window.openJobWorkSubSection(sub);
        }
    };

    window.jwtHandleEsc = () => {
        if (curScreen === 'jobwork' && jwSubMode === 'voucher') {
            jwSubMode = 'list';
            renderCurrent();
            return;
        }
        if (curScreen !== 'gateway') {
            window.jwtOpenScreen('gateway');
            return;
        }
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    };

    const openUnifiedModule = (startScreen = 'gateway') => {
        ensureSectionDOM();
        window.__jwtReturnFromLegacy = false;
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('jw-trail-section');
        if (sec) sec.style.display = 'block';
        window.jwtOpenScreen(startScreen);
    };

    // Bridge into Gateway & Stock Summary
    window.openJobWorkModule = () => openUnifiedModule('gateway');
    window.openSareeModule = () => openUnifiedModule('stock');

    // Bridge showJobWorkHub so returning from Dukan/Billing comes back to our new Gateway
    const origShowJobWorkHub = window.showJobWorkHub;
    window.showJobWorkHub = () => {
        if (window.__jwtReturnFromLegacy) {
            window.__jwtReturnFromLegacy = false;
            openUnifiedModule('gateway');
            return;
        }
        if (typeof origShowJobWorkHub === 'function') origShowJobWorkHub();
    };

    // Refresh automatically when Karkhana changes or Supabase realtime updates arrive
    const origTriggerRefresh = window.triggerActiveSectionRefresh;
    window.triggerActiveSectionRefresh = () => {
        if (typeof origTriggerRefresh === 'function') origTriggerRefresh();
        const sec = document.getElementById('jw-trail-section');
        if (sec && sec.style.display !== 'none') {
            cachedSnapshot = null;
            renderCurrent();
        }
    };

    // Sync Dynamic Work Groups into core/tally-master.js Create screen (#tm-group-list)
    const syncTallyMasterGroups = () => {
        const listBox = document.getElementById('tm-group-list');
        if (!listBox) return;
        const groups = getWorkGroups();
        const existing = Array.from(listBox.querySelectorAll('.tm-group-opt')).map((x) => x.dataset.grp);
        groups.forEach((g) => {
            if (!existing.includes(g.key)) {
                const div = document.createElement('div');
                div.className = 'tm-group-opt';
                div.dataset.grp = g.key;
                div.dataset.label = g.label;
                div.onclick = () => window.tmPickGroup && window.tmPickGroup(g.key, true);
                div.innerHTML = `<span>${esc(g.label)}</span><small>JobWork</small>`;
                listBox.appendChild(div);
            }
        });
    };

    const origTmPickGroup = window.tmPickGroup;
    if (typeof origTmPickGroup === 'function') {
        window.tmPickGroup = (grp, openSheetOrFocus) => {
            origTmPickGroup(grp, openSheetOrFocus);
            const inp = document.getElementById('tm-group');
            if (inp && grp && grp !== 'kariger') {
                inp.value = grpLabel(grp);
            }
        };
    }

    const origOpenTallyCreate = window.openTallyCreateModule;
    if (typeof origOpenTallyCreate === 'function') {
        window.openTallyCreateModule = () => {
            origOpenTallyCreate();
            syncTallyMasterGroups();
        };
    }

    /* ========================================================================
       10. SCOPED KEYBOARD SHORTCUTS (NO CONFLICT WITH OTHER MODULES)
    ======================================================================== */
    document.addEventListener('keydown', (e) => {
        const sec = document.getElementById('jw-trail-section');
        if (!sec || sec.style.display === 'none') return;

        const anyModal = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display && m.style.display !== 'none');
        if (anyModal) return;

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const typing = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.jwtHandleEsc();
            return;
        }

        if (curScreen === 'gateway' && !typing) {
            const items = Array.from(document.querySelectorAll('#jwt-scr-gateway .jwt-gw-item'));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[gwIdx]?.classList.remove('active');
                gwIdx = (gwIdx + 1) % items.length;
                items[gwIdx]?.classList.add('active');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[gwIdx]?.classList.remove('active');
                gwIdx = (gwIdx - 1 + items.length) % items.length;
                items[gwIdx]?.classList.add('active');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                items[gwIdx]?.click();
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const k = e.key.toLowerCase();
                if (k === 'm') window.jwtOpenScreen('malik');
                else if (k === 's') window.jwtOpenScreen('stock');
                else if (k === 'j') window.jwtOpenScreen('jobwork');
                else if (k === 'c') window.jwtOpenScreen('create');
                else if (k === 'd') window.jwtOpenLegacySub('dukan');
                else if (k === 'b') window.jwtOpenLegacySub('billing');
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { ensureSectionDOM(); syncTallyMasterGroups(); });
    } else {
        ensureSectionDOM();
        syncTallyMasterGroups();
    }
})();
