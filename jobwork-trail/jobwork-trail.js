/* ============================================================================
   SIMPLICITY ERP - TALLYPRIME UNIFIED JOBWORK, SAREE TRAIL, DISPATCH & BILLS
   File: jobwork-trail/jobwork-trail.js (v3.1)
   100% Compatible with: core/storage.js, core/database.js (Supabase Row-Delta),
   core/karkhana.js, core/tally-master.js, saree_history, jobwork_workers
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
       1. NAVIGATION, CURSOR MEMORY & VOUCHER STATE
    ======================================================================== */
    let curView = 'gateway';
    let menuIdx = 0;
    const viewCursor = Object.create(null);

    let activeGroupKey = 'cutting';
    let activeWorkerId = null;
    let vchDir = 'out';
    let vchPickStep = 'kariger';
    let vchSelectedMaker = null;
    let vchSelectedBatchKey = null;
    let vchRightItems = [];
    let vchRightIdx = 0;
    let vchBatch = [];
    let vchAcceptOpen = false;
    let lastChallanObj = null;

    let editWorkerRowInfo = null;
    let ownerWorkerId = null;
    let ownerGodamSummaryKey = null;

    let stockBucketFilter = 'all';
    let stockDetailKey = null;
    let stockInwardOpen = false;

    let createSideIdx = 0;
    let selectedCreateGroupKey = 'cutting';
    let alterEditWorkerId = null;
    let alterEditGroupKey = null;
    let crAcceptOpen = false;

    let foPickStep = 'kariger';
    let foSelectedMaker = null;
    let foSelectedBatchKey = null;
    let foRightItems = [];
    let foRightIdx = 0;
    let foBatch = [];
    let foAcceptOpen = false;
    let editFoId = null;

    let billsListMode = 'pending';
    let billSelectedWorkerId = null;
    let billWorkerItems = [];
    let billWorkerIdx = 0;
    let activeBillId = null;
    let billAcceptOpen = false;
    let billPayAcceptOpen = false;

    let isSaving = false;
    let navGuardTs = 0;
    let cachedSnapshot = null;

    const armNavGuard = () => { navGuardTs = performance.now(); };
    const isNavGuarded = () => (performance.now() - navGuardTs) < 130;

    /* ========================================================================
       2. SAFE HELPERS & STORAGE WRAPPERS
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

    const safeInt = (v, fb = 0) => {
        const n = parseInt(String(v == null ? '' : v).replace(/,/g, '').trim(), 10);
        return Number.isFinite(n) ? n : fb;
    };

    const safeNum = (v, fb = 0) => {
        const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : fb;
    };

    const normText = (s, fb = '') => String(s == null ? fb : s).trim().toUpperCase() || fb;

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

    const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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
        if (typeof window.setStore === 'function') window.setStore(key, val);
        else localStorage.setItem(key, JSON.stringify(val));
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
        const c = String(kid || '').trim();
        if (!c || c === 'k_main') return 'k_main';
        if (c === 'all') return 'all';
        return c;
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
        el._t = setTimeout(() => { el.style.display = 'none'; }, 2600);
    };

    const invalidateAllCaches = (workerId = null) => {
        cachedSnapshot = null;
        try {
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(workerId);
            if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
        } catch (_) {}
    };

    /* ========================================================================
       3. DYNAMIC WORK GROUPS ENGINE
    ======================================================================== */
    const getWorkGroups = () => {
        const stored = safeArr(getStoreSafe(GROUPS_STORE_KEY));
        const workers = safeArr(getStoreSafe('jobwork_workers'));
        const map = new Map();

        if (stored.length) {
            stored.forEach((g) => {
                if (!g || !g.key) return;
                const k = String(g.key).trim().toLowerCase();
                if (k) map.set(k, { key: k, label: String(g.label || k).trim() });
            });
        } else {
            DEFAULT_GROUPS.forEach((g) => map.set(g.key, { key: g.key, label: g.label }));
        }

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
        const f = getWorkGroups().find((g) => g.key === k);
        return f ? f.label : (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'JobWork');
    };

    /* ========================================================================
       4. STAGE & TRAIL HELPERS
    ======================================================================== */
    const inferBucketFromLegacyType = (t) => {
        const c = String(t || 'fresh').trim().toLowerCase();
        if (c === 'finished' || c === 'finish') return 'finished';
        if (c === 'lott' || c === 'lot' || c === 'damage') return 'lott';
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
        if (bucket === 'finished') return arr.length ? `Finished (${arr.map(grpLabel).join(' → ')})` : 'Finished (Calender)';
        if (bucket === 'lott') return arr.length ? `Lott (${arr.map(grpLabel).join(' → ')})` : 'Lott (Fresh)';
        if (!arr.length) return 'Fresh (Kora)';
        return arr.map(grpLabel).join(' → ');
    };

    /* ========================================================================
       5. UNIFIED RECONCILIATION ENGINE (100% STOCK MATCH)
    ======================================================================== */
    const computeLiveState = (godamFilter = 'all') => {
        const groups = getWorkGroups();
        const workersRaw = safeArr(getStoreSafe('jobwork_workers'));
        const karigerMeta = new Map();
        safeArr(getStoreSafe('kariger_list')).forEach((k) => {
            if (k && k.name) {
                karigerMeta.set(normText(k.name), {
                    saree: normText(k.saree, 'GENERAL SAREE'),
                    karkhanaId: normGodam(k.karkhanaId || 'k_main')
                });
            }
        });

        const sareeHist = safeArr(getStoreSafe('saree_history'));
        const activeFilter = godamFilter || 'all';

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
            const qty = isOut ? safeInt(h.gai != null ? h.gai : h.pcs) : safeInt(h.aai != null ? h.aai : h.pcs);
            if (qty <= 0) return;

            const bKey = `${sName}|||${kName}|||${kid}|||${bucket}|||${trailKey}`;

            if (!isOut) {
                let b = godamMap.get(bKey);
                if (!b) {
                    b = {
                        key: bKey,
                        summaryKey: `${sName}|||${kName}|||${kid}|||${bucket}`,
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
                    untrailedOuts.push({ sName, kName, kid, bucket, qty });
                }
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
                    summaryKey: b.summaryKey,
                    saree: b.saree,
                    maker: b.maker,
                    karkhanaId: b.karkhanaId,
                    godamName: b.godamName,
                    bucket: b.bucket,
                    pcs: 0,
                    batches: []
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

                if (Array.isArray(prevStages) && sN && mN && kId) {
                    const exactKey = `${w.id}|||${sN}|||${mN}|||${kId}|||${prevStages.join('|')}`;
                    const ex = pMap.get(exactKey);
                    if (ex && ex.pcs > 0) {
                        const take = Math.min(ex.pcs, rem);
                        ex.pcs -= take;
                        rem -= take;
                    }
                }
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

        cachedSnapshot = {
            godamFilter: activeFilter,
            groups,
            workers,
            godamBatches,
            godamSummaries,
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
        const gF = getActiveGodam();
        if (cachedSnapshot && cachedSnapshot.godamFilter === gF) return cachedSnapshot;
        return computeLiveState(gF);
    };

    /* ========================================================================
       6. SHARED 2-STEP KARIGER -> STAGE PICKER HELPERS
    ======================================================================== */
    const getBatchUsedQty = (batchArr, batchKey) => {
        return batchArr.filter((x) => x.batchKey === batchKey).reduce((s, x) => s + safeInt(x.qty), 0);
    };

    const buildKarigerPickerList = (batches, usedBatchArr, query = '') => {
        const q = String(query || '').trim().toLowerCase();
        const kMap = new Map();
        batches.forEach((b) => {
            const avail = b.pcs - getBatchUsedQty(usedBatchArr, b.key);
            if (avail <= 0) return;
            let ex = kMap.get(b.maker);
            if (!ex) {
                ex = { maker: b.maker, totalPcs: 0, stagesCount: 0, sarees: new Set() };
                kMap.set(b.maker, ex);
            }
            ex.totalPcs += avail;
            ex.stagesCount += 1;
            ex.sarees.add(b.saree);
        });
        return Array.from(kMap.values())
            .filter((k) => !q || `${k.maker} ${Array.from(k.sarees).join(' ')}`.toLowerCase().includes(q))
            .sort((a, b) => a.maker.localeCompare(b.maker));
    };

    const buildStagePickerList = (batches, makerName, usedBatchArr) => {
        return batches
            .filter((b) => b.maker === makerName)
            .map((b) => ({ ...b, availPcs: b.pcs - getBatchUsedQty(usedBatchArr, b.key) }))
            .filter((b) => b.availPcs > 0);
    };

    /* ========================================================================
       7. DATA MUTATIONS (OUT / IN / EDIT / DELETE / FINAL OUT / BILLS)
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
        const last = { ...sheets[sheets.length - 1] };
        last.rows = safeArr(last.rows).slice();
        sheets[sheets.length - 1] = last;
        return { sheets, lastSheet: last };
    };

    const rebuildWorkerRowSareeHistory = (sH, worker, rowObj) => {
        const refId = String(rowObj.id);
        const filtered = sH.filter((h) => !h || String(h.refId) !== refId);
        const gLabel = grpLabel(worker.group);
        const targetLabel = `${worker.name} (${gLabel})`;
        const dDate = toIsoDate(rowObj.date) || getTodayIso();
        const now = Date.now();

        safeArr(rowObj.gayiItems).forEach((it, idx) => {
            const stages = Array.isArray(it.doneStages) ? it.doneStages : [];
            filtered.push({
                id: `sh_jw_out_${refId}_${idx}`,
                refId,
                date: dDate,
                sareeName: it.saree || 'GENERAL SAREE',
                karigerName: it.karigar || 'KARKHANA',
                kariger: it.karigar || 'KARKHANA',
                partyName: targetLabel,
                targetWorker: targetLabel,
                karkhanaId: it.karkhanaId || 'k_main',
                type: legacyTypeFromTrail(stages, 'unfinished'),
                typeLabel: `📤 ${targetLabel} Out [${formatTrail(stages, 'unfinished')}]`,
                aai: 0,
                gai: safeInt(it.qty),
                isOut: true,
                doneStages: [...stages],
                stageBucket: 'unfinished',
                workerId: worker.id,
                note: `${gLabel} Out`,
                timestamp: now + idx
            });
        });

        safeArr(rowObj.aayiItems).forEach((it, idx) => {
            const stages = Array.isArray(it.doneStages) ? it.doneStages : [worker.group];
            const bucket = it.destBucket || (it.isDamage ? 'lott' : 'unfinished');
            const icon = bucket === 'finished' ? '✨' : (bucket === 'lott' ? '⚠️' : '✅');
            filtered.push({
                id: `sh_jw_in_${refId}_${idx}`,
                refId,
                date: dDate,
                sareeName: it.saree || 'GENERAL SAREE',
                karigerName: it.karigar || 'KARKHANA',
                kariger: it.karigar || 'KARKHANA',
                partyName: targetLabel,
                targetWorker: targetLabel,
                karkhanaId: it.karkhanaId || 'k_main',
                type: legacyTypeFromTrail(stages, bucket),
                typeLabel: `${icon} ${targetLabel} In [${formatTrail(stages, bucket)}]`,
                aai: safeInt(it.qty),
                gai: 0,
                isOut: false,
                doneStages: [...stages],
                stageBucket: bucket,
                workerId: worker.id,
                note: `${gLabel} In`,
                timestamp: now + idx
            });
        });

        return filtered;
    };

    const commitVchBatch = (doPrint = false) => {
        if (isSaving) return;
        if (!vchBatch.length) return toast('Batch khali hai! Pehle kam se kam 1 saree add karein.', true);

        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        if (!worker) return toast('Worker nahi mila!', true);

        const dDate = toIsoDate(document.getElementById('jwt-vch-date')?.value) || getTodayIso();
        const gLabel = grpLabel(worker.group);

        isSaving = true;
        try {
            const txnId = genId('jwt');
            const sH = safeArr(getStoreSafe('saree_history')).slice();
            const { sheets, lastSheet } = ensureWorkerSheet(worker.id);

            let totQty = 0;
            let totDmg = 0;
            const sheetItems = [];

            if (vchDir === 'out') {
                vchBatch.forEach((it, idx) => {
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
                const newRow = {
                    id: txnId,
                    date: dDate,
                    gayiQty: totQty,
                    gayiItems: sheetItems,
                    stockSource: 'fresh',
                    aayiQty: 0,
                    aayiItems: [],
                    damagePcs: 0,
                    damageAmt: 0,
                    isTrailV2: true
                };
                lastSheet.rows.push(newRow);
                setStoreSafe('saree_history', rebuildWorkerRowSareeHistory(sH, worker, newRow));
            } else {
                vchBatch.forEach((it, idx) => {
                    const nextTrail = [...it.doneStages];
                    if (worker.group && !nextTrail.includes(worker.group)) nextTrail.push(worker.group);
                    const targetBucket = it.dest === 'finished' ? 'finished' : (it.dest === 'lott' ? 'lott' : 'unfinished');
                    const isDmg = (targetBucket === 'lott');
                    if (isDmg) totDmg += it.qty;
                    else totQty += it.qty;

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
                const newRow = {
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
                lastSheet.rows.push(newRow);
                setStoreSafe('saree_history', rebuildWorkerRowSareeHistory(sH, worker, newRow));
            }

            setStoreSafe(`jobwork_sheets_${worker.id}`, sheets);

            lastChallanObj = {
                title: `${gLabel.toUpperCase()} ${vchDir === 'out' ? 'OUT (GAYI)' : 'IN (WAPAS AAYI)'}`,
                party: `${worker.name} (${gLabel})`,
                date: dDate,
                items: vchBatch.map((x) => ({
                    maker: x.maker,
                    saree: x.saree,
                    trail: vchDir === 'out'
                        ? formatTrail(x.doneStages, 'unfinished')
                        : formatTrail([...x.doneStages, ...(x.doneStages.includes(worker.group) ? [] : [worker.group])], x.dest === 'finished' ? 'finished' : (x.dest === 'lott' ? 'lott' : 'unfinished')),
                    qty: x.qty
                }))
            };

            vchBatch = [];
            vchAcceptOpen = false;
            vchPickStep = 'kariger';
            vchSelectedMaker = null;
            vchSelectedBatchKey = null;
            vchRightIdx = 0;

            invalidateAllCaches(worker.id);
            toast(`✅ ${totQty + totDmg} Pcs Save ho gayi!`);
            if (doPrint) printBatchChallan(lastChallanObj);
            renderScreen();
        } catch (err) {
            console.error('[JW-Trail] commitVchBatch error:', err);
            toast('Batch save karne me error aaya!', true);
        } finally {
            isSaving = false;
        }
    };

    window.jwtSaveWorkerHistEdit = (sheetId, rowId) => {
        if (!activeWorkerId || !rowId) return;
        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        if (!worker) return;

        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${activeWorkerId}`)).slice();
        const sIdx = sheets.findIndex((s) => s && String(s.id) === String(sheetId));
        if (sIdx < 0) return;

        const sheet = { ...sheets[sIdx], rows: safeArr(sheets[sIdx].rows).slice() };
        const rIdx = sheet.rows.findIndex((r) => r && String(r.id) === String(rowId));
        if (rIdx < 0) return;

        const oldRow = sheet.rows[rIdx];
        const newDate = toIsoDate(document.getElementById('jwt-eh-date')?.value) || oldRow.date;
        const isOut = safeInt(oldRow.gayiQty) > 0;
        const oldItems = isOut ? safeArr(oldRow.gayiItems) : safeArr(oldRow.aayiItems);

        if (!oldItems.length) return toast('Is legacy entry ke items edit nahi ho sakte.', true);

        const newItems = [];
        let newTot = 0;
        let newDmg = 0;

        for (let i = 0; i < oldItems.length; i++) {
            const it = { ...oldItems[i] };
            const qVal = safeInt(document.getElementById(`jwt-eh-qty-${i}`)?.value);
            if (qVal <= 0) return toast('Har item ki Qty 1 ya zyada honi chahiye!', true);

            const oldQ = safeInt(it.qty);
            const diff = qVal - oldQ;

            if (isOut && diff > 0) {
                const b = snap.godamBatches.find((x) =>
                    x.saree === normText(it.saree) &&
                    x.maker === normText(it.karigar) &&
                    x.karkhanaId === normGodam(it.karkhanaId) &&
                    x.bucket === 'unfinished' &&
                    x.trailKey === (Array.isArray(it.doneStages) ? it.doneStages.join('|') : '')
                );
                const avail = b ? b.pcs : 0;
                if (diff > avail) return toast(`${it.karigar} (${it.saree}) ka Godam stock sirf ${avail} aur bacha hai!`, true);
            }
            if (!isOut && diff > 0 && diff > worker.pending) {
                return toast(`Worker ke paas sirf ${worker.pending} Pcs aur pending hain!`, true);
            }
            if (isOut && diff < 0 && (-diff) > worker.pending) {
                return toast(`Out Qty kam karne par pending minus me jayega! Pehle IN entry edit/delete karein.`, true);
            }

            it.qty = qVal;
            if (!isOut) {
                const destEl = document.getElementById(`jwt-eh-dest-${i}`);
                if (destEl) {
                    it.destBucket = destEl.value;
                    it.isDamage = (destEl.value === 'lott');
                }
                if (it.isDamage) newDmg += qVal;
                else newTot += qVal;
            } else {
                newTot += qVal;
            }
            newItems.push(it);
        }

        const updatedRow = {
            ...oldRow,
            date: newDate,
            gayiQty: isOut ? newTot : 0,
            gayiItems: isOut ? newItems : [],
            aayiQty: isOut ? 0 : newTot,
            aayiItems: isOut ? [] : newItems,
            damagePcs: isOut ? 0 : newDmg
        };
        sheet.rows[rIdx] = updatedRow;
        sheets[sIdx] = sheet;

        const sH = rebuildWorkerRowSareeHistory(safeArr(getStoreSafe('saree_history')), worker, updatedRow);
        setStoreSafe('saree_history', sH);
        setStoreSafe(`jobwork_sheets_${activeWorkerId}`, sheets);
        editWorkerRowInfo = null;
        invalidateAllCaches(activeWorkerId);
        toast('✅ Register entry update ho gayi!');
        renderScreen();
    };

    window.jwtDeleteWorkerHistRow = (sheetId, rowId) => {
        if (!activeWorkerId || !rowId) return;
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${activeWorkerId}`)).slice();
        const sIdx = sheets.findIndex((s) => s && String(s.id) === String(sheetId));
        if (sIdx < 0) return;
        const sheet = { ...sheets[sIdx], rows: safeArr(sheets[sIdx].rows).slice() };
        const row = sheet.rows.find((r) => r && String(r.id) === String(rowId));
        if (!row) return;

        const snap = getSnapshot();
        const worker = snap.workers.find((w) => w.id === activeWorkerId);
        if (worker && safeInt(row.gayiQty) > worker.pending) {
            return toast('Is batch ki sarees pehle hi wapas aa chuki hain! Pehle IN entry delete karein.', true);
        }
        if (!confirm('Kya is entry ko delete karna chahte hain? Stock automatic adjust ho jayega.')) return;

        sheet.rows = sheet.rows.filter((r) => r && String(r.id) !== String(rowId));
        sheets[sIdx] = sheet;
        const sH = safeArr(getStoreSafe('saree_history')).filter((h) => !h || String(h.refId) !== String(rowId));
        setStoreSafe('saree_history', sH);
        setStoreSafe(`jobwork_sheets_${activeWorkerId}`, sheets);
        editWorkerRowInfo = null;
        invalidateAllCaches(activeWorkerId);
        toast('Entry delete ho gayi!');
        renderScreen();
    };

    const commitFinalOutBatch = (doPrint = false) => {
        if (isSaving) return;
        if (!foBatch.length) return toast('Batch khali hai! Kam se kam 1 Saree add karein.', true);

        const dDate = toIsoDate(document.getElementById('jwt-fo-date')?.value) || getTodayIso();
        const note = String(document.getElementById('jwt-fo-note')?.value || '').trim() || 'Apni Main Dukan';

        isSaving = true;
        try {
            const challanId = genId('dukan');
            const now = Date.now();
            const sH = safeArr(getStoreSafe('saree_history')).slice();
            const dukanHist = safeArr(getStoreSafe('dukan_transfer_history')).slice();

            foBatch.forEach((it, idx) => {
                const lType = legacyTypeFromTrail(it.doneStages, it.bucket);
                const trTxt = formatTrail(it.doneStages, it.bucket);

                sH.push({
                    id: `sh_fo_${challanId}_${idx}`,
                    refId: `${challanId}_${idx}`,
                    date: dDate,
                    sareeName: it.saree,
                    karigerName: it.maker,
                    kariger: it.maker,
                    partyName: note,
                    targetWorker: note,
                    karkhanaId: it.karkhanaId,
                    type: lType,
                    typeLabel: `🚚 Final Out ➔ ${note} [${trTxt}]`,
                    aai: 0,
                    gai: it.qty,
                    isOut: true,
                    doneStages: [...it.doneStages],
                    stageBucket: it.bucket,
                    note,
                    timestamp: now + idx
                });

                dukanHist.unshift({
                    id: `${challanId}_${idx}`,
                    date: dDate,
                    sareeName: it.saree,
                    karigerName: it.maker,
                    pcs: it.qty,
                    note: `${note} [${trTxt}]`,
                    karkhanaId: it.karkhanaId,
                    doneStages: [...it.doneStages],
                    stageBucket: it.bucket,
                    timestamp: now + idx
                });
            });

            setStoreSafe('saree_history', sH);
            setStoreSafe('dukan_transfer_history', dukanHist);

            lastChallanObj = {
                title: 'FINAL OUT (DISPATCH CHALLAN)',
                party: note,
                date: dDate,
                items: foBatch.map((x) => ({
                    maker: x.maker,
                    saree: x.saree,
                    trail: formatTrail(x.doneStages, x.bucket),
                    qty: x.qty
                }))
            };

            foBatch = [];
            foAcceptOpen = false;
            foPickStep = 'kariger';
            foSelectedMaker = null;
            foSelectedBatchKey = null;
            foRightIdx = 0;

            invalidateAllCaches();
            if (typeof window.renderDukanTransferTable === 'function') {
                try { window.renderDukanTransferTable(); } catch (_) {}
            }
            toast('✅ Final Out Challan save ho gaya!');
            if (doPrint) printBatchChallan(lastChallanObj);
            renderScreen();
        } catch (err) {
            console.error('[JW-Trail] commitFinalOutBatch error:', err);
            toast('Final Out save karne me error aaya!', true);
        } finally {
            isSaving = false;
        }
    };

    window.jwtSaveFinalOutEdit = (entryId) => {
        const dukanHist = safeArr(getStoreSafe('dukan_transfer_history')).slice();
        const dIdx = dukanHist.findIndex((x) => x && String(x.id) === String(entryId));
        if (dIdx < 0) return;

        const oldEntry = dukanHist[dIdx];
        const newDate = toIsoDate(document.getElementById('jwt-efo-date')?.value) || oldEntry.date;
        const newNote = String(document.getElementById('jwt-efo-note')?.value || '').trim() || oldEntry.note;
        const newPcs = safeInt(document.getElementById('jwt-efo-pcs')?.value);
        if (newPcs <= 0) return toast('Sahi Pcs daalein!', true);

        const diff = newPcs - safeInt(oldEntry.pcs);
        if (diff > 0) {
            const snap = getSnapshot();
            const trKey = Array.isArray(oldEntry.doneStages) ? oldEntry.doneStages.join('|') : null;
            const b = snap.godamBatches.find((x) =>
                x.saree === normText(oldEntry.sareeName) &&
                x.maker === normText(oldEntry.karigerName) &&
                (!oldEntry.karkhanaId || x.karkhanaId === normGodam(oldEntry.karkhanaId)) &&
                (trKey === null || x.trailKey === trKey)
            );
            const avail = b ? b.pcs : 0;
            if (diff > avail) return toast(`Godam me sirf ${avail} Pcs aur bache hain!`, true);
        }

        dukanHist[dIdx] = { ...oldEntry, date: newDate, note: newNote, pcs: newPcs };
        const sH = safeArr(getStoreSafe('saree_history')).map((h) => {
            if (!h) return h;
            if (String(h.refId) === String(entryId) || String(h.id) === `sh_fo_${entryId}`) {
                return { ...h, date: newDate, partyName: newNote, targetWorker: newNote, gai: newPcs, note: newNote };
            }
            return h;
        });

        setStoreSafe('dukan_transfer_history', dukanHist);
        setStoreSafe('saree_history', sH);
        editFoId = null;
        invalidateAllCaches();
        toast('✅ Final Out entry update ho gayi!');
        renderScreen();
    };

    window.jwtDeleteFinalOutEntry = (entryId) => {
        if (!entryId) return;
        if (!confirm('Kya is Final Out entry ko delete karna chahte hain? Saree wapas Godam stock me jud jayegi.')) return;
        const dukanHist = safeArr(getStoreSafe('dukan_transfer_history')).filter((x) => !x || String(x.id) !== String(entryId));
        const sH = safeArr(getStoreSafe('saree_history')).filter((h) => !h || (String(h.refId) !== String(entryId) && String(h.id) !== `sh_fo_${entryId}`));
        setStoreSafe('dukan_transfer_history', dukanHist);
        setStoreSafe('saree_history', sH);
        editFoId = null;
        invalidateAllCaches();
        toast('Final Out entry delete ho gayi!');
        renderScreen();
    };

    /* ========================================================================
       8. A6 THERMAL PRINT ENGINE
    ======================================================================== */
    const openA6Window = (title, bodyHtml) => {
        const pw = window.open('', '', 'width=440,height=600');
        if (!pw) return alert('Popup block hai! Kripya browser me allow karein.');
        pw.document.write(`<html><head><title>${esc(title)}</title>
            <style>
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
            </style></head><body>
            <div class="box">${bodyHtml}</div>
            <script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),600);};<\/script>
            </body></html>`);
        pw.document.close();
    };

    const printBatchChallan = (c) => {
        if (!c || !c.items || !c.items.length) return toast('Print ke liye koi item nahi hai.', true);
        let tot = 0;
        const rowsHtml = c.items.map((it, i) => {
            tot += safeInt(it.qty);
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${esc(it.maker)}</strong></td>
                <td>${esc(it.saree)}<br><small>${esc(it.trail)}</small></td>
                <td style="text-align:right; font-weight:bold;">${it.qty}</td>
            </tr>`;
        }).join('');
        openA6Window('Challan A6', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>${esc(c.title)}</div></div>
            <div><strong>Party / Worker:</strong> ${esc(c.party)}</div>
            <div><strong>Tarikh:</strong> ${esc(fmtDate(c.date))}</div>
            <table><thead><tr><th>#</th><th>KARIGER</th><th>SAREE &amp; TRAIL</th><th style="text-align:right;">PCS</th></tr></thead><tbody>${rowsHtml}</tbody></table>
            <div class="tot">KUL SAREE: ${tot} Pcs</div>
            <div class="sign"><div>हस्ताक्षर मुंशी<br><br>_______</div><div>हस्ताक्षर पाने वाला<br><br>_______</div></div>
        `);
    };

    window.jwtPrintLastChallan = () => printBatchChallan(lastChallanObj);

    window.jwtPrintWorkerRow = (sheetId, rowId) => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === activeWorkerId);
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${activeWorkerId}`));
        const sh = sheets.find((s) => String(s.id) === String(sheetId));
        const r = sh ? safeArr(sh.rows).find((x) => String(x.id) === String(rowId)) : null;
        if (!w || !r) return;
        const isOut = safeInt(r.gayiQty) > 0;
        const items = isOut ? safeArr(r.gayiItems) : safeArr(r.aayiItems);
        printBatchChallan({
            title: `${grpLabel(w.group).toUpperCase()} ${isOut ? 'OUT (GAYI)' : 'IN (WAPAS AAYI)'}`,
            party: `${w.name} (${grpLabel(w.group)})`,
            date: r.date,
            items: items.map((it) => ({
                maker: it.karigar || '-',
                saree: it.saree || 'Saree',
                trail: formatTrail(it.doneStages || [], it.destBucket || 'unfinished'),
                qty: it.qty
            }))
        });
    };

    window.jwtPrintWorkerStatement = (wId) => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === (wId || activeWorkerId));
        if (!w) return;
        const sheets = safeArr(getStoreSafe(`jobwork_sheets_${w.id}`));
        const rows = [];
        sheets.forEach((sh) => safeArr(sh.rows).forEach((r) => rows.push(r)));
        const rHtml = rows.map((r) => {
            const gQ = safeInt(r.gayiQty);
            const aQ = safeInt(r.aayiQty) + safeInt(r.damagePcs);
            return `<tr><td>${esc(fmtDate(r.date))}</td><td>${gQ > 0 ? 'OUT' : 'IN'}</td><td style="text-align:right;">${gQ || '-'}</td><td style="text-align:right;">${aQ || '-'}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center;">No Entries</td></tr>';

        openA6Window('Worker Statement', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>${esc(grpLabel(w.group).toUpperCase())} KHATA STATEMENT</div></div>
            <div><strong>Worker:</strong> ${esc(w.name)} (${esc(w.mobile || '-')})</div>
            <div><strong>Tarikh:</strong> ${esc(fmtDate(getTodayIso()))}</div>
            <table><thead><tr><th>TARIKH</th><th>TYPE</th><th style="text-align:right;">OUT</th><th style="text-align:right;">IN</th></tr></thead><tbody>${rHtml}</tbody></table>
            <div class="tot">DIYA: ${w.diya} | AAI: ${w.aai} | PENDING: ${w.pending} Pcs</div>
        `);
    };

    window.jwtPrintFinalOutRow = (entryId) => {
        const d = safeArr(getStoreSafe('dukan_transfer_history')).find((x) => String(x.id) === String(entryId));
        if (!d) return;
        printBatchChallan({
            title: 'FINAL OUT (DISPATCH SLIP)',
            party: d.note || 'Apni Dukan',
            date: d.date,
            items: [{ maker: d.karigerName || '-', saree: d.sareeName || 'Saree', trail: d.note || '-', qty: safeInt(d.pcs) }]
        });
    };

    window.jwtPrintCurrentScreen = () => {
        const snap = getSnapshot();
        if (curView === 'jw-voucher' || curView === 'final-out') {
            if (lastChallanObj) return printBatchChallan(lastChallanObj);
            return toast('Abhi koi batch save nahi hua hai.', true);
        }
        if (curView === 'jw-worker-hist' || curView === 'owner-worker-detail') {
            return window.jwtPrintWorkerStatement(curView === 'owner-worker-detail' ? ownerWorkerId : activeWorkerId);
        }
        if (curView === 'owner-workers') {
            const rows = snap.workers.map((w) => `<tr><td><strong>${esc(w.name)}</strong><br><small>${esc(grpLabel(w.group))}</small></td><td style="text-align:right;">${w.diya}</td><td style="text-align:right;">${w.aai}</td><td style="text-align:right;"><strong>${w.pending}</strong></td></tr>`).join('');
            return openA6Window('Owner Report - Workers', `
                <div class="hdr"><h3>SIMPLICITY ERP</h3><div>HAR JOB WORKER KE PASS</div></div>
                <table><thead><tr><th>WORKER</th><th style="text-align:right;">DIYA</th><th style="text-align:right;">AAI</th><th style="text-align:right;">BAKI</th></tr></thead><tbody>${rows}</tbody></table>
                <div class="tot">KUL PENDING: ${snap.totals.pending} Pcs</div>
            `);
        }
        if (curView === 'owner-godam' || curView === 'stock-list') {
            const rows = snap.godamBatches.map((b) => `<tr><td><strong>${esc(b.saree)}</strong> (${esc(b.maker)})<br><small>${esc(formatTrail(b.doneStages, b.bucket))}</small></td><td style="text-align:right;"><strong>${b.pcs}</strong></td></tr>`).join('');
            return openA6Window('Godam Stock Trail', `
                <div class="hdr"><h3>SIMPLICITY ERP</h3><div>GODAM SAREE STOCK TRAIL</div></div>
                <table><thead><tr><th>SAREE &amp; STAGES</th><th style="text-align:right;">PCS</th></tr></thead><tbody>${rows}</tbody></table>
                <div class="tot">GODAM TOTAL: ${snap.totals.raw + snap.totals.finished + snap.totals.lott} Pcs</div>
            `);
        }
        if (curView === 'bill-detail' && activeBillId) {
            return window.jwtPrintBillReceipt(activeBillId);
        }
    };

    window.jwtPrintBillReceipt = (billId) => {
        const b = safeArr(getStoreSafe('jw_bills_list')).find((x) => String(x.id) === String(billId));
        if (!b) return;
        const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
        openA6Window('Bill Receipt', `
            <div class="hdr"><h3>SIMPLICITY ERP</h3><div>JOB WORK BILL RASEED</div></div>
            <div><strong>Bill No:</strong> ${esc(b.billNo || '-')}</div>
            <div><strong>Worker:</strong> ${esc(b.workerName)} (${esc(grpLabel(b.workType || 'cutting'))})</div>
            <div><strong>Tarikh:</strong> ${esc(fmtDate(b.date))}</div>
            <table>
                <tbody>
                    <tr><td>Saree Pcs</td><td style="text-align:right;">${safeInt(b.pcs)} Pcs</td></tr>
                    <tr><td>Total Bill</td><td style="text-align:right;">₹ ${safeNum(b.billAmt).toFixed(2)}</td></tr>
                    <tr><td>Paid Amount</td><td style="text-align:right;">₹ ${safeNum(b.paidAmt).toFixed(2)}</td></tr>
                </tbody>
            </table>
            <div class="tot">${baki > 0 ? `BAKI HAI: ₹ ${baki.toFixed(2)}` : 'STATUS: PAID / CHUKTA'}</div>
        `);
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

        const msg = `*SIMPLICITY ERP — ${grpLabel(w.group).toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━\n` +
            `Kariger: *${w.name}*\nTarikh: ${fmtDate(getTodayIso())}\n━━━━━━━━━━━━━━━━━━━\n` +
            `Diya: ${w.diya} Pcs | Aai: ${w.aai} Pcs\n*ABHI BAKI SAREE: ${w.pending} Pcs*\n\n` +
            `*Pending Detail:*\n${details}\n━━━━━━━━━━━━━━━━━━━`;
        window.open(`https://wa.me/${mob}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       9. STYLES & SHELL DOM INJECTION
    ======================================================================== */
    const injectStyles = () => {
        const old = document.getElementById('jwt-styles');
        if (old) old.remove();
        const st = document.createElement('style');
        st.id = 'jwt-styles';
        st.textContent = `
            #jw-trail-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #1f2937;
                background: #ffffff;
            }
            #jw-trail-section * { box-sizing: border-box; }
            #jw-trail-section .jwt-topbar {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7;
                padding: 9px 16px; display: flex; justify-content: space-between;
                align-items: center; gap: 10px; flex-wrap: wrap;
            }
            #jw-trail-section .jwt-topbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            #jw-trail-section .jwt-topbar h2 { margin: 0; font-size: 15.5px; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-pill {
                font-size: 11.5px; font-weight: 700; color: #92400e;
                background: #ffffff; border: 1px solid #d9b86c; padding: 2px 9px; border-radius: 999px;
            }
            #jw-trail-section .jwt-esc {
                background: #ffffff; border: 1px solid #d1d5db; color: #374151;
                padding: 4px 11px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            }
            #jw-trail-section .jwt-esc:hover { border-color: #d9a425; background: #fef9ea; }
            #jw-trail-section .jwt-save {
                background: #f2b71d; border: 1px solid #d9a425; color: #1f2937;
                padding: 5px 13px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer;
            }
            #jw-trail-section .jwt-save:hover { background: #e5aa12; }
            #jw-trail-section .jwt-del {
                background: #ffffff; border: 1px solid #fca5a5; color: #b91c1c;
                padding: 4px 10px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            }
            #jw-trail-section .jwt-del:hover { background: #fef2f2; }

            #jw-trail-section .jwt-menu-shell {
                max-width: 540px; margin: 18px auto; border: 1.5px solid #d9b86c;
                border-radius: 6px; overflow: hidden; background: #ffffff;
                box-shadow: 0 6px 20px rgba(0,0,0,0.05);
            }
            #jw-trail-section .jwt-menu-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 9px 16px;
                font-size: 13px; font-weight: 800; color: #1f2937;
                display: flex; justify-content: space-between; align-items: center;
            }
            #jw-trail-section .jwt-sec-lbl {
                padding: 8px 18px 4px; font-size: 10.5px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.5px; background: #fdfcf7; border-top: 1px solid #f3efe0;
            }
            #jw-trail-section .jwt-sec-lbl.first { border-top: none; }
            #jw-trail-section .jwt-menu-item {
                width: 100%; text-align: left; background: #ffffff; border: none;
                border-bottom: 1px solid #f3f4f6; padding: 10px 18px; font-size: 13px;
                font-weight: 600; color: #1f2937; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
            }
            #jw-trail-section .jwt-menu-item:hover { background: #fef9ea; }
            #jw-trail-section .jwt-menu-item.active { background: #f2b71d !important; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-menu-key { color: #b45309; font-weight: 900; text-decoration: underline; }
            #jw-trail-section .jwt-menu-item.active .jwt-menu-key { color: #1f2937; }
            #jw-trail-section .jwt-menu-val { font-size: 11.5px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-menu-item.active .jwt-menu-val { color: #1f2937; }

            #jw-trail-section .jwt-kpi-5 {
                display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
                border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7;
            }
            #jw-trail-section .jwt-kpi-3 {
                display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
                border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7;
            }
            #jw-trail-section .jwt-kpi-cell { padding: 9px 14px; border-right: 1px solid #e5d5a7; }
            #jw-trail-section .jwt-kpi-cell:last-child { border-right: none; background: #fdf6e2; }
            #jw-trail-section .jwt-kpi-cell small { display: block; font-size: 11px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-kpi-cell strong { display: block; font-size: 16px; color: #b47d00; font-weight: 900; margin-top: 2px; }

            #jw-trail-section table {
                width: 100%; min-width: 0 !important; border-collapse: collapse;
                border: 1px solid #e5d5a7; font-size: 12px; background: #fff;
            }
            #jw-trail-section th {
                background: #fdf6e2; color: #1f2937; font-size: 11px; font-weight: 800;
                padding: 7px 9px; text-align: left; border-bottom: 1.5px solid #e5d5a7;
            }
            #jw-trail-section td { padding: 7px 9px; border-bottom: 1px solid #f3f4f6; color: #1f2937; vertical-align: middle; }
            #jw-trail-section tr.jwt-row { cursor: pointer; }
            #jw-trail-section tr.jwt-row:hover { background: #fef9ea; }
            #jw-trail-section tr.jwt-row.active { background: #f2b71d !important; font-weight: 700; }
            #jw-trail-section .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
            #jw-trail-section .gold-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; color: #b47d00; }
            #jw-trail-section tr.jwt-row.active .gold-num { color: #1f2937; }
            #jw-trail-section .trail { font-size: 11px; font-weight: 700; color: #92400e; }
            #jw-trail-section .trail-muted { font-size: 11px; color: #6b7280; font-weight: 600; }
            #jw-trail-section .trail-done { font-size: 11px; font-weight: 800; color: #065f46; }

            #jw-trail-section .jwt-split { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(380px, 1.05fr); }
            #jw-trail-section .jwt-pane-l { padding: 12px 14px; border-right: 1.5px solid #e5d5a7; }
            #jw-trail-section .jwt-pane-r { padding: 10px 12px; background: #fdfcf7; }
            #jw-trail-section .jwt-frow {
                display: grid; grid-template-columns: 128px minmax(0, 1fr);
                align-items: center; gap: 8px; margin-bottom: 6px;
            }
            #jw-trail-section .jwt-frow label { font-size: 11.5px; font-weight: 700; color: #374151; }
            #jw-trail-section .jwt-inp {
                width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 12.5px; font-weight: 700; color: #111827; background: #fff; outline: none;
            }
            #jw-trail-section .jwt-inp:focus {
                border-color: #d9a425; background: #fffdf5;
                box-shadow: 0 0 0 2px rgba(242,183,29,0.22);
            }
            #jw-trail-section .jwt-sidebox { border: 1.5px solid #d9b86c; border-radius: 5px; background: #fff; overflow: hidden; }
            #jw-trail-section .jwt-sidebox-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 7px 10px;
                font-size: 12px; font-weight: 800; color: #1f2937; display: flex; justify-content: space-between;
            }
            #jw-trail-section .jwt-side-list-big { max-height: 430px; overflow-y: auto; }
            #jw-trail-section .jwt-side-opt {
                padding: 9px 11px; border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-size: 12.5px;
            }
            #jw-trail-section .jwt-side-opt:hover { background: #fef9ea; }
            #jw-trail-section .jwt-side-opt.active { background: #f2b71d !important; font-weight: 700; }
            #jw-trail-section .jwt-accept-bar {
                background: #fdf6e2; border: 1.5px solid #d9a425; border-radius: 5px;
                padding: 7px 12px; margin-top: 8px; display: flex; justify-content: space-between;
                align-items: center; gap: 8px; flex-wrap: wrap;
            }
            #jw-trail-section .jwt-subnav {
                display: flex; gap: 14px; padding: 0 16px; border-bottom: 1.5px solid #e5d5a7;
                background: #fdfcf7; overflow-x: auto;
            }
            #jw-trail-section .jwt-tab {
                background: none; border: none; border-bottom: 2.5px solid transparent;
                padding: 8px 4px; font-size: 12px; font-weight: 700; color: #6b7280; cursor: pointer; white-space: nowrap;
            }
            #jw-trail-section .jwt-tab.active { color: #1f2937; border-bottom-color: #d9a425; font-weight: 800; }
            #jw-trail-section .jwt-footer {
                background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 7px 16px;
                display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
                font-size: 11px; color: #92400e; font-weight: 700;
            }
            #jwt-toast {
                position: fixed; bottom: 16px; right: 16px; z-index: 999999;
                padding: 9px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700;
                display: none; box-shadow: 0 8px 20px rgba(0,0,0,0.28);
            }
            @media (max-width: 860px) {
                #jw-trail-section .jwt-split { grid-template-columns: 1fr; }
                #jw-trail-section .jwt-pane-l { border-right: none; border-bottom: 1.5px solid #e5d5a7; }
                #jw-trail-section .jwt-kpi-5, #jw-trail-section .jwt-kpi-3 { grid-template-columns: repeat(2, 1fr); }
                #jw-trail-section .jwt-frow { grid-template-columns: 1fr; gap: 3px; }
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
                    <button type="button" class="jwt-esc" id="jwt-back-btn" onclick="jwtHandleEsc()">&larr; [Esc] Back</button>
                    <h2 id="jwt-title">JobWork Hub</h2>
                    <span class="jwt-pill" id="jwt-godam-pill">Sabhi Karkhane</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button type="button" class="jwt-esc" id="jwt-top-print-btn" style="display:none;" onclick="jwtPrintCurrentScreen()">Print [Alt+P]</button>
                    <span id="jwt-top-hint" style="font-size:11.5px; font-weight:700; color:#92400e;">Tally Mode</span>
                </div>
            </div>
            <div id="jwt-body"></div>
        `;
        const main = document.querySelector('#desktop-screen .main-container');
        if (main) main.appendChild(sec);
        else document.body.appendChild(sec);
        return sec;
    };

    /* ========================================================================
       10. NAVIGATION HELPERS WITH EXACT CURSOR RESTORE
    ======================================================================== */
    window.jwtGo = (view, preserveCursor = false) => {
        if (curView) viewCursor[curView] = menuIdx;
        curView = view;
        menuIdx = preserveCursor ? (viewCursor[view] || 0) : 0;
        armNavGuard();
        renderScreen();
    };

    const jwtBackTo = (parentView) => {
        if (curView) viewCursor[curView] = menuIdx;
        curView = parentView;
        menuIdx = viewCursor[parentView] || 0;
        armNavGuard();
        renderScreen();
        setTimeout(() => {
            const sec = document.getElementById('jw-trail-section');
            sec?.querySelector('.jwt-menu-item.active, tbody tr.jwt-row.active')?.scrollIntoView({ block: 'nearest' });
        }, 15);
    };

    const setTopHeader = (title, backLabel, hint = '[↑ ↓] Chunein · [Enter] Kholein · [Esc] Back', showPrint = false) => {
        const tEl = document.getElementById('jwt-title');
        const bEl = document.getElementById('jwt-back-btn');
        const gEl = document.getElementById('jwt-godam-pill');
        const hEl = document.getElementById('jwt-top-hint');
        const pEl = document.getElementById('jwt-top-print-btn');
        if (tEl) tEl.textContent = title;
        if (bEl) bEl.textContent = backLabel;
        if (gEl) gEl.textContent = getGodamLabel(getActiveGodam());
        if (hEl) hEl.textContent = hint;
        if (pEl) pEl.style.display = showPrint ? 'inline-block' : 'none';
    };

    /* ========================================================================
       11. ALL SCREEN RENDERERS
    ======================================================================== */
    const renderScreen = () => {
        try {
            const body = document.getElementById('jwt-body');
            if (!body) return;
            const snap = getSnapshot();

            if (curView === 'gateway') {
                setTopHeader('JobWork Hub', '← [Esc] Dashboard', '[↑ ↓] + [Enter] · [Esc] Dashboard', false);
                const items = [
                    { sec: 'JobWork Master', key: 'c', label: '<span class="jwt-menu-key">C</span>reate (Worker / Group)', val: 'New', action: "jwtGo('create-menu')" },
                    { key: 'a', label: '<span class="jwt-menu-key">A</span>lter (Worker / Group)', val: 'Edit / Del', action: "jwtGo('alter-menu')" },
                    { key: 'j', label: '<span class="jwt-menu-key">J</span>ob Work Register', val: `${snap.totals.pending} Pending`, action: "jwtGo('jw-groups')" },
                    { sec: 'Report & Stock', key: 'o', label: '<span class="jwt-menu-key">O</span>wner Report', val: `${snap.totals.total} Pcs`, action: "jwtGo('owner-menu')" },
                    { key: 's', label: '<span class="jwt-menu-key">S</span>aree Stock', val: `${snap.totals.raw + snap.totals.finished + snap.totals.lott} Pcs`, action: "jwtGo('stock-list')" },
                    { sec: 'Out & Account', key: 'f', label: '<span class="jwt-menu-key">F</span>inal Out (Dispatch)', val: 'Batch Out', action: "jwtOpenFinalOut()" },
                    { key: 'b', label: '<span class="jwt-menu-key">B</span>ills &amp; Hisab', val: 'Hisab', action: "jwtGo('bills-menu')" }
                ];
                if (menuIdx >= items.length || menuIdx < 0) menuIdx = 0;

                let html = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head"><span>Gateway of Job Work</span><span style="font-size:11px; color:#92400e;">[C/A/J/O/S/F/B]</span></div>`;
                items.forEach((it, i) => {
                    if (it.sec) html += `<div class="jwt-sec-lbl ${i === 0 ? 'first' : ''}">${esc(it.sec)}</div>`;
                    html += `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" data-key="${it.key}" onclick="menuIdx=${i}; ${it.action}">
                        <span>${it.label}</span><span class="jwt-menu-val">${esc(it.val)}</span>
                    </button>`;
                });
                html += `<div class="jwt-footer"><span>[&uarr; &darr;] Upar-Niche &middot; [Enter] Select</span><span>[Esc] Dashboard</span></div></div></div>`;
                body.innerHTML = html;
                return;
            }

            if (curView === 'create-menu') {
                setTopHeader('Create (Worker / Group)', '← [Esc] Gateway');
                const opts = [
                    { label: '1. Create JobWorker', val: `${snap.workers.length} Workers`, action: "menuIdx=0; jwtOpenCreateWorker()" },
                    { label: '2. Create New Work Group', val: `${snap.groups.length} Groups`, action: "menuIdx=1; jwtOpenCreateGroup()" }
                ];
                if (menuIdx >= opts.length || menuIdx < 0) menuIdx = 0;
                body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head"><span>Create Master</span></div>
                    ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${esc(o.val)}</span></button>`).join('')}
                    <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
                </div></div>`;
                return;
            }

            if (curView === 'create-worker') {
                setTopHeader('Create JobWorker', '← [Esc] Create Menu', '[Enter] Agla Box · [↑↓] Group Chunein · [Esc] Back');
                const groups = snap.groups;
                if (!groups.some((g) => g.key === selectedCreateGroupKey) && groups.length) selectedCreateGroupKey = groups[0].key;
                createSideIdx = Math.max(0, groups.findIndex((g) => g.key === selectedCreateGroupKey));
                crAcceptOpen = false;

                body.innerHTML = `<div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Worker Name :</label><input type="text" id="jwt-cw-name" class="jwt-inp" placeholder="e.g. ASLAM BHAI"></div>
                        <div class="jwt-frow"><label>Under (Work Group) :</label><input type="text" id="jwt-cw-grp" class="jwt-inp" readonly value="${esc(grpLabel(selectedCreateGroupKey))}"></div>
                        <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-cw-mob" maxlength="10" class="jwt-inp" placeholder="10-digit Mobile"></div>
                        <div class="jwt-frow"><label>Address / Mohalla :</label><input type="text" id="jwt-cw-addr" class="jwt-inp" placeholder="e.g. Alaipura, Varanasi"></div>
                        <div class="jwt-frow"><label>Join Date :</label><input type="date" id="jwt-cw-date" class="jwt-inp" value="${getTodayIso()}"></div>
                        <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                            <strong style="font-size:12px;">Accept? Worker Save Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtSaveNewWorker()">Yes [Y / Enter]</button>
                                <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                            </div>
                        </div>
                        <div style="text-align:right; margin-top:10px;"><button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Save Worker [Ctrl+Enter]</button></div>
                    </div>
                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head"><span>List of Work Groups</span><small>${groups.length}</small></div>
                            <div id="jwt-cw-side-list" class="jwt-side-list-big">${groups.map((g, i) => `
                                <div class="jwt-side-opt ${i === createSideIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickCwGroup(${i})">
                                    <span>${esc(g.label)}</span><small>JobWork</small>
                                </div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>`;
                bindCreateWorkerKeys();
                setTimeout(() => document.getElementById('jwt-cw-name')?.focus(), 25);
                return;
            }

            if (curView === 'create-group') {
                setTopHeader('Create New Work Group', '← [Esc] Create Menu');
                crAcceptOpen = false;
                body.innerHTML = `<div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Work Group Name :</label><input type="text" id="jwt-cg-name" class="jwt-inp" placeholder="e.g. Jhalar, Stone, Tassel"></div>
                        <div style="font-size:11.5px; color:#6b7280; margin:6px 0 12px;">Save karte hi yeh group poore software me automatic jud jayega.</div>
                        <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                            <strong style="font-size:12px;">Accept? Naya Group Save Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtSaveNewGroup()">Yes [Y / Enter]</button>
                                <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                            </div>
                        </div>
                        <div style="text-align:right;"><button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Save Group [Enter]</button></div>
                    </div>
                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head"><span>Existing Work Groups</span><small>${snap.groups.length}</small></div>
                            <div class="jwt-side-list-big">${snap.groups.map((g) => `<div class="jwt-side-opt"><span>${esc(g.label)}</span><small>Active</small></div>`).join('')}</div>
                        </div>
                    </div>
                </div>`;
                const gInp = document.getElementById('jwt-cg-name');
                if (gInp) {
                    gInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jwtAskCrAccept(); } });
                    setTimeout(() => gInp.focus(), 25);
                }
                return;
            }

            if (curView === 'alter-menu') {
                setTopHeader('Alter (Worker / Group)', '← [Esc] Gateway');
                const opts = [
                    { label: '1. Alter JobWorker (Edit / Delete)', val: `${snap.workers.length} Workers`, action: "menuIdx=0; jwtGo('alter-worker-list')" },
                    { label: '2. Alter JobWork Group (Rename / Delete)', val: `${snap.groups.length} Groups`, action: "menuIdx=1; jwtGo('alter-group-list')" }
                ];
                if (menuIdx >= opts.length || menuIdx < 0) menuIdx = 0;
                body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head"><span>Alter Master</span></div>
                    ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${esc(o.val)}</span></button>`).join('')}
                    <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
                </div></div>`;
                return;
            }

            if (curView === 'alter-worker-list') {
                setTopHeader('Alter JobWorker — List', '← [Esc] Alter Menu', '[↑ ↓] Chunein · [Enter] Edit / Delete · [/] Search');
                const q = (document.getElementById('jwt-aw-search')?.value || '').trim().toLowerCase();
                const list = snap.workers.filter((w) => !q || `${w.name} ${grpLabel(w.group)} ${w.mobile} ${w.address}`.toLowerCase().includes(q));
                if (menuIdx >= list.length || menuIdx < 0) menuIdx = Math.max(0, list.length - 1);

                body.innerHTML = `<div style="padding:12px 16px;">
                    <input type="text" id="jwt-aw-search" class="jwt-inp" style="margin-bottom:10px;" value="${esc(q)}" placeholder="Search Worker..." oninput="jwtFilterList()">
                    <table>
                        <thead><tr><th>Worker Name</th><th>Work Group</th><th>Mobile &amp; Address</th><th class="num">Pending</th><th style="text-align:right;">Action</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map((w, i) => `
                                <tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenAlterWorkerEdit('${esc(w.id)}')">
                                    <td><strong>${esc(w.name)}</strong></td>
                                    <td>${esc(grpLabel(w.group))}</td>
                                    <td>${esc(w.mobile || '-')} &middot; ${esc(w.address || '-')}</td>
                                    <td class="gold-num">${w.pending} Pcs</td>
                                    <td style="text-align:right;">Edit / Del &rarr;</td>
                                </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#6b7280;">Koi worker nahi mila.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                bindSearchKey('jwt-aw-search');
                return;
            }

            if (curView === 'alter-worker-edit') {
                const w = snap.workers.find((x) => x.id === alterEditWorkerId);
                if (!w) return jwtBackTo('alter-worker-list');
                setTopHeader(`Alter Worker: ${w.name}`, '← [Esc] Workers List');
                const groups = snap.groups;
                crAcceptOpen = false;

                body.innerHTML = `<div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Worker Name :</label><input type="text" id="jwt-ew-name" class="jwt-inp" value="${esc(w.name)}"></div>
                        <div class="jwt-frow"><label>Work Group :</label>
                            <select id="jwt-ew-grp" class="jwt-inp">
                                ${groups.map((g) => `<option value="${esc(g.key)}" ${g.key === w.group ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-ew-mob" maxlength="10" class="jwt-inp" value="${esc(w.mobile)}"></div>
                        <div class="jwt-frow"><label>Address :</label><input type="text" id="jwt-ew-addr" class="jwt-inp" value="${esc(w.address)}"></div>
                        <div class="jwt-frow"><label>Join Date :</label><input type="date" id="jwt-ew-date" class="jwt-inp" value="${esc(toIsoDate(w.date) || getTodayIso())}"></div>
                        <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                            <strong style="font-size:12px;">Accept? Worker Update Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtUpdateWorker('${esc(w.id)}')">Yes [Y / Enter]</button>
                                <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:12px; gap:8px;">
                            <button type="button" class="jwt-del" onclick="jwtDeleteWorker('${esc(w.id)}')">Delete Worker</button>
                            <button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Update Worker [Ctrl+Enter]</button>
                        </div>
                    </div>
                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head"><span>Worker Stock Info</span></div>
                            <div style="padding:12px; font-size:12.5px; line-height:1.7;">
                                <div><strong>Diya:</strong> ${w.diya} Pcs</div>
                                <div><strong>Aai:</strong> ${w.aai} Pcs</div>
                                <div><strong>Pending:</strong> ${w.pending} Pcs</div>
                            </div>
                        </div>
                    </div>
                </div>`;
                setTimeout(() => document.getElementById('jwt-ew-name')?.focus(), 25);
                return;
            }

            if (curView === 'alter-group-list') {
                setTopHeader('Alter JobWork Group — List', '← [Esc] Alter Menu');
                const groups = snap.groups;
                if (menuIdx >= groups.length || menuIdx < 0) menuIdx = Math.max(0, groups.length - 1);

                body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head"><span>Select Work Group to Alter / Delete</span></div>
                    ${groups.map((g, i) => {
                        const wc = snap.workers.filter((w) => w.group === g.key).length;
                        return `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenAlterGroupEdit('${esc(g.key)}')">
                            <span>${esc(g.label)}</span><span class="jwt-menu-val">${wc} Workers</span>
                        </button>`;
                    }).join('')}
                    <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Alter Menu</span></div>
                </div></div>`;
                return;
            }

            if (curView === 'alter-group-edit') {
                const g = snap.groups.find((x) => x.key === alterEditGroupKey);
                if (!g) return jwtBackTo('alter-group-list');
                setTopHeader(`Alter Work Group: ${g.label}`, '← [Esc] Groups List');
                const wc = snap.workers.filter((w) => w.group === g.key).length;
                crAcceptOpen = false;

                body.innerHTML = `<div style="padding:16px; max-width:540px;">
                    <div class="jwt-frow"><label>Group Name :</label><input type="text" id="jwt-eg-name" class="jwt-inp" value="${esc(g.label)}"></div>
                    <div style="font-size:12px; color:#6b7280; margin:6px 0 12px;">Is group me abhi <strong>${wc} Workers</strong> hain.</div>
                    <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Group Update Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtUpdateGroup('${esc(g.key)}')">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; gap:8px; margin-top:10px;">
                        <button type="button" class="jwt-del" onclick="jwtDeleteGroup('${esc(g.key)}')">Delete Group</button>
                        <button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Update Group [Enter]</button>
                    </div>
                </div>`;
                const el = document.getElementById('jwt-eg-name');
                if (el) {
                    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jwtAskCrAccept(); } });
                    setTimeout(() => { el.focus(); el.select(); }, 25);
                }
                return;
            }

            if (curView === 'jw-groups') {
                setTopHeader('Job Work Register — Select Work Group', '← [Esc] Gateway');
                const groups = snap.groups;
                if (menuIdx >= groups.length || menuIdx < 0) menuIdx = 0;

                body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head"><span>Select JobWork Group</span><span>Pending</span></div>
                    ${groups.map((g, i) => {
                        const ws = snap.workers.filter((w) => w.group === g.key);
                        const pend = ws.reduce((s, w) => s + w.pending, 0);
                        return `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtSelectJwGroup('${esc(g.key)}')">
                            <span>${esc(g.label)} <small style="color:#6b7280;">(${ws.length} Workers)</small></span>
                            <span class="jwt-menu-val">${pend} Pcs</span>
                        </button>`;
                    }).join('')}
                    <div class="jwt-footer"><span>[&uarr; &darr;] Group Chunein &middot; [Enter] Workers List</span><span>[Esc] Gateway</span></div>
                </div></div>`;
                return;
            }

            if (curView === 'jw-workers') {
                const gLbl = grpLabel(activeGroupKey);
                setTopHeader(`List of ${gLbl} Workers`, '← [Esc] Work Groups', '[↑ ↓] Worker Chunein · [Enter] Kholein · [/] Search');
                const q = (document.getElementById('jwt-jww-search')?.value || '').trim().toLowerCase();
                const list = snap.workers
                    .filter((w) => w.group === activeGroupKey)
                    .filter((w) => !q || `${w.name} ${w.mobile} ${w.address}`.toLowerCase().includes(q));
                if (menuIdx >= list.length || menuIdx < 0) menuIdx = Math.max(0, list.length - 1);

                body.innerHTML = `<div style="padding:12px 16px;">
                    <input type="text" id="jwt-jww-search" class="jwt-inp" style="margin-bottom:10px;" value="${esc(q)}" placeholder="Search ${esc(gLbl)} Worker..." oninput="jwtFilterList()">
                    <table>
                        <thead><tr><th>Worker Name</th><th>Mobile &amp; Address</th><th class="num">Diya</th><th class="num">Aai</th><th class="num">Pending Pcs</th><th style="text-align:right;">Open</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map((w, i) => `
                                <tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtSelectWorker('${esc(w.id)}')">
                                    <td><strong>${esc(w.name)}</strong></td>
                                    <td>${esc(w.mobile || '-')} &middot; ${esc(w.address || '-')}</td>
                                    <td class="num">${w.diya}</td>
                                    <td class="num">${w.aai}</td>
                                    <td class="gold-num">${w.pending} Pcs</td>
                                    <td style="text-align:right;">Open &rarr;</td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:20px; color:#6b7280;">Is group me koi worker nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                bindSearchKey('jwt-jww-search');
                return;
            }

            if (curView === 'jw-worker-menu') {
                const w = snap.workers.find((x) => x.id === activeWorkerId);
                if (!w) return jwtBackTo('jw-workers');
                const gLbl = grpLabel(w.group);
                setTopHeader(`${w.name} (${gLbl})`, '← [Esc] Workers List', '[↑ ↓] + [Enter] · [Esc] Workers List', true);

                const opts = [
                    { label: `1. ${gLbl} Out (Saree Bhejein)`, val: 'Godam ➔ Worker', action: "menuIdx=0; jwtOpenWorkerVoucher('out')" },
                    { label: `2. ${gLbl} In (Saree Wapas Lein)`, val: `${w.pending} Pending`, action: "menuIdx=1; jwtOpenWorkerVoucher('in')" },
                    { label: '3. Worker Register (Edit / Delete / Print)', val: `Diya ${w.diya} / Aai ${w.aai}`, action: "menuIdx=2; editWorkerRowInfo=null; jwtGo('jw-worker-hist')" }
                ];
                if (menuIdx >= opts.length || menuIdx < 0) menuIdx = 0;

                body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                    <div class="jwt-menu-head">
                        <span>${esc(w.name)} (${esc(gLbl)})</span>
                        <span style="color:#b47d00;">Pending: ${w.pending} Pcs</span>
                    </div>
                    ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${esc(o.val)}</span></button>`).join('')}
                    <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Workers List</span></div>
                </div></div>`;
                return;
            }

            if (curView === 'jw-voucher') {
                const w = snap.workers.find((x) => x.id === activeWorkerId);
                if (!w) return jwtBackTo('jw-workers');
                const gLbl = grpLabel(w.group);
                const isOut = (vchDir === 'out');
                setTopHeader(`${w.name} — ${gLbl} ${isOut ? 'Out' : 'In'}`, '← [Esc] Worker Menu', 'Kariger ➔ Stage ➔ Pcs · Khali Kariger Enter = Save', true);

                const sourceBatches = isOut
                    ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0)
                    : w.pendingItems;

                const totBatchPcs = vchBatch.reduce((s, x) => s + x.qty, 0);
                const defDest = (w.group === 'calender') ? 'finished' : 'godam';

                body.innerHTML = `<div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-vch-date" class="jwt-inp" value="${getTodayIso()}"></div>
                        <div class="jwt-frow"><label>Kariger :</label><input type="text" id="jwt-vch-kariger" class="jwt-inp" autocomplete="off" placeholder="Name likhein ya ↑↓ (Khali Enter=Save)"></div>
                        <div class="jwt-frow"><label>Stage Batch :</label><input type="text" id="jwt-vch-stage" class="jwt-inp" readonly placeholder="Stage chunein..."></div>
                        ${!isOut ? `<div class="jwt-frow"><label>Wapas Kahan :</label>
                            <select id="jwt-vch-dest" class="jwt-inp">
                                <option value="godam" ${defDest === 'godam' ? 'selected' : ''}>Godam (${esc(gLbl)} Complete)</option>
                                <option value="finished" ${defDest === 'finished' ? 'selected' : ''}>Final Tayyar (Finished)</option>
                                <option value="lott">Lott / Damage</option>
                            </select>
                        </div>` : ''}
                        <div class="jwt-frow">
                            <label>Pcs :</label>
                            <div style="display:flex; gap:6px;">
                                <input type="text" inputmode="numeric" id="jwt-vch-qty" class="jwt-inp" placeholder="0" style="flex:1;">
                                <button type="button" tabindex="-1" class="jwt-save" onclick="jwtAddVchItem()">+ Add</button>
                            </div>
                        </div>

                        <div style="margin-top:10px; border:1px solid #e5d5a7; border-radius:5px; overflow:hidden;">
                            <div class="jwt-sidebox-head"><span>${isOut ? 'Out' : 'In'} Batch</span><strong>${totBatchPcs} Pcs (${vchBatch.length})</strong></div>
                            <div style="max-height:175px; overflow-y:auto;">
                                <table>
                                    <thead><tr><th>#</th><th>Kariger</th><th>Saree &amp; Trail</th>${!isOut ? '<th>Kahan</th>' : ''}<th class="num">Pcs</th><th></th></tr></thead>
                                    <tbody>
                                        ${vchBatch.length ? vchBatch.map((it, idx) => `
                                            <tr>
                                                <td>${idx + 1}</td>
                                                <td><strong>${esc(it.maker)}</strong></td>
                                                <td>${esc(it.saree)}<div class="trail">${esc(formatTrail(it.doneStages, 'unfinished'))}</div></td>
                                                ${!isOut ? `<td>${it.dest === 'finished' ? 'Fin' : (it.dest === 'lott' ? 'Lott' : 'Gdm')}</td>` : ''}
                                                <td class="gold-num">${it.qty}</td>
                                                <td style="text-align:center;"><button type="button" tabindex="-1" class="jwt-esc" style="padding:1px 6px;" onclick="jwtRemoveVchItem(${idx})">&times;</button></td>
                                            </tr>`).join('') : `<tr><td colspan="${isOut ? 5 : 6}" style="text-align:center; padding:10px; color:#6b7280;">Batch khali hai.</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div id="jwt-vch-accept" class="jwt-accept-bar" style="display:${vchAcceptOpen ? 'flex' : 'none'};">
                            <strong style="font-size:12px;">Accept? Batch Save Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="jwt-save" onclick="jwtCommitVch(true)">Save &amp; Print [P]</button>
                                <button type="button" id="jwt-vch-yes" class="jwt-save" onclick="jwtCommitVch(false)">Yes [Y / Enter]</button>
                                <button type="button" class="jwt-esc" onclick="jwtCancelVchAccept()">No [N]</button>
                            </div>
                        </div>
                    </div>

                    <div class="jwt-pane-r">
                        <div class="jwt-sidebox">
                            <div class="jwt-sidebox-head"><span id="jwt-vch-r-title">1. List of Karigers</span><small id="jwt-vch-r-cnt">0</small></div>
                            <div id="jwt-vch-r-list" class="jwt-side-list-big"></div>
                        </div>
                    </div>
                </div>`;
                renderVchRightPanel(sourceBatches);
                bindVchVoucherKeys(sourceBatches);
                setTimeout(() => document.getElementById('jwt-vch-kariger')?.focus(), 25);
                return;
            }

            if (curView === 'jw-worker-hist') {
                const w = snap.workers.find((x) => x.id === activeWorkerId);
                if (!w) return jwtBackTo('jw-workers');
                setTopHeader(`${w.name} — Register (Edit / Print)`, '← [Esc] Worker Menu', '[↑ ↓] Row · [E] Edit · [P] Slip · [Alt+P] Statement', true);
                const sheets = safeArr(getStoreSafe(`jobwork_sheets_${w.id}`));
                const rows = [];
                sheets.forEach((sh) => safeArr(sh.rows).forEach((r) => rows.push({ sheetId: sh.id, r })));
                rows.reverse();
                if (menuIdx >= rows.length || menuIdx < 0) menuIdx = Math.max(0, rows.length - 1);

                let editBoxHtml = '';
                if (editWorkerRowInfo) {
                    const target = rows.find((x) => String(x.sheetId) === String(editWorkerRowInfo.sheetId) && String(x.r.id) === String(editWorkerRowInfo.rowId));
                    if (target) {
                        const r = target.r;
                        const isOut = safeInt(r.gayiQty) > 0;
                        const items = isOut ? safeArr(r.gayiItems) : safeArr(r.aayiItems);
                        editBoxHtml = `<div style="background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="color:#92400e;">Edit Entry (${isOut ? 'OUT' : 'IN'})</strong>
                                <button type="button" class="jwt-esc" onclick="editWorkerRowInfo=null; renderScreenNow();">Cancel [Esc]</button>
                            </div>
                            <div class="jwt-frow" style="max-width:340px;"><label>Tarikh :</label><input type="date" id="jwt-eh-date" class="jwt-inp" value="${esc(toIsoDate(r.date) || getTodayIso())}"></div>
                            ${items.map((it, idx) => `
                                <div style="display:grid; grid-template-columns:1.5fr 100px ${!isOut ? '140px' : ''}; gap:8px; align-items:center; margin-bottom:6px;">
                                    <div style="font-size:12px;"><strong>${esc(it.karigar || '-')}</strong> (${esc(it.saree || 'Saree')}) <span class="trail">[${esc(formatTrail(it.doneStages || [], it.destBucket || 'unfinished'))}]</span></div>
                                    <input type="text" inputmode="numeric" id="jwt-eh-qty-${idx}" class="jwt-inp" value="${safeInt(it.qty)}">
                                    ${!isOut ? `<select id="jwt-eh-dest-${idx}" class="jwt-inp">
                                        <option value="unfinished" ${(it.destBucket || 'unfinished') === 'unfinished' ? 'selected' : ''}>Godam WIP</option>
                                        <option value="finished" ${it.destBucket === 'finished' ? 'selected' : ''}>Finished</option>
                                        <option value="lott" ${it.destBucket === 'lott' ? 'selected' : ''}>Lott</option>
                                    </select>` : ''}
                                </div>`).join('')}
                            <div style="text-align:right; margin-top:8px;">
                                <button type="button" class="jwt-save" onclick="jwtSaveWorkerHistEdit('${esc(target.sheetId)}', '${esc(r.id)}')">Save Changes</button>
                            </div>
                        </div>`;
                    }
                }

                body.innerHTML = `<div style="padding:12px 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                        <div><strong>${esc(w.name)}</strong> (${esc(grpLabel(w.group))}) &middot; Diya: ${w.diya} &middot; Aai: ${w.aai} &middot; <strong style="color:#b47d00;">Pending: ${w.pending} Pcs</strong></div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="jwt-esc" onclick="jwtShareWorkerWhatsApp('${esc(w.id)}')">WhatsApp</button>
                            <button type="button" class="jwt-save" onclick="jwtPrintWorkerStatement('${esc(w.id)}')">Print Statement [Alt+P]</button>
                        </div>
                    </div>
                    ${editBoxHtml}
                    <table>
                        <thead><tr><th>Tarikh</th><th>Type</th><th>Batch Detail (Kariger &amp; Trail)</th><th class="num">Out</th><th class="num">In / Lott</th><th style="text-align:right;">Actions</th></tr></thead>
                        <tbody>
                            ${rows.length ? rows.map(({ sheetId, r }, i) => {
                                const gQ = safeInt(r.gayiQty);
                                const aQ = safeInt(r.aayiQty) + safeInt(r.damagePcs);
                                const items = gQ > 0 ? safeArr(r.gayiItems) : safeArr(r.aayiItems);
                                const det = items.length
                                    ? items.map((it) => `${esc(it.karigar || '-')} (${esc(it.saree || 'Saree')} &middot; ${esc(formatTrail(it.doneStages || [], it.destBucket || 'unfinished'))}: ${it.qty})`).join('<br>')
                                    : '-';
                                return `<tr class="jwt-row ${i === menuIdx ? 'active' : ''}" data-shid="${esc(sheetId)}" data-rid="${esc(r.id)}" onclick="menuIdx=${i}; highlightRegRow(${i});">
                                    <td>${esc(fmtDate(r.date))}</td>
                                    <td><strong>${gQ > 0 ? 'OUT' : (safeInt(r.damagePcs) > 0 && safeInt(r.aayiQty) === 0 ? 'LOTT' : 'IN')}</strong></td>
                                    <td>${det}</td>
                                    <td class="num">${gQ > 0 ? `-${gQ}` : '-'}</td>
                                    <td class="gold-num">${aQ > 0 ? `+${aQ}` : '-'}</td>
                                    <td style="text-align:right; white-space:nowrap;">
                                        <button type="button" class="jwt-esc" onclick="event.stopPropagation(); editWorkerRowInfo={sheetId:'${esc(sheetId)}',rowId:'${esc(r.id)}'}; renderScreenNow();">Edit</button>
                                        <button type="button" class="jwt-esc" onclick="event.stopPropagation(); jwtPrintWorkerRow('${esc(sheetId)}', '${esc(r.id)}')">Print</button>
                                        <button type="button" class="jwt-del" onclick="event.stopPropagation(); jwtDeleteWorkerHistRow('${esc(sheetId)}', '${esc(r.id)}')">Del</button>
                                    </td>
                                </tr>`;
                            }).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Abhi koi entry nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                return;
            }

            if (curView === 'owner-menu') {
                setTopHeader('Owner Report', '← [Esc] Gateway');
                const t = snap.totals;
                const opts = [
                    { label: '1. Har Job Worker Ke Pass', val: `${t.pending} Pcs`, action: "menuIdx=0; jwtGo('owner-workers')" },
                    { label: '2. Godam Me Maujud', val: `${t.raw + t.finished + t.lott} Pcs`, action: "menuIdx=1; jwtGo('owner-godam')" }
                ];
                if (menuIdx >= opts.length || menuIdx < 0) menuIdx = 0;

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
                            ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${esc(o.val)}</span></button>`).join('')}
                            <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
                        </div>
                    </div>
                `;
                return;
            }

            if (curView === 'owner-workers') {
                setTopHeader('Har Job Worker Ke Pass (Summary)', '← [Esc] Owner Report', '[↑ ↓] Worker Chunein · [Enter] Batch Detail · [Alt+P] Print', true);
                const q = (document.getElementById('jwt-ow-search')?.value || '').trim().toLowerCase();
                const list = snap.workers.filter((w) => !q || `${w.name} ${grpLabel(w.group)} ${w.mobile}`.toLowerCase().includes(q));
                if (menuIdx >= list.length || menuIdx < 0) menuIdx = Math.max(0, list.length - 1);

                body.innerHTML = `<div style="padding:12px 16px;">
                    <input type="text" id="jwt-ow-search" class="jwt-inp" style="margin-bottom:10px;" value="${esc(q)}" placeholder="Search Worker..." oninput="jwtFilterList()">
                    <table>
                        <thead><tr><th>Worker Name</th><th>Work Group</th><th>Mobile &amp; Address</th><th class="num">Diya</th><th class="num">Aai</th><th class="num">Pending Pcs</th><th style="text-align:right;">Batch</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map((w, i) => `
                                <tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenOwnerWorkerDetail('${esc(w.id)}')">
                                    <td><strong>${esc(w.name)}</strong></td>
                                    <td>${esc(grpLabel(w.group))}</td>
                                    <td>${esc(w.mobile || '-')} &middot; ${esc(w.address || '-')}</td>
                                    <td class="num">${w.diya}</td>
                                    <td class="num">${w.aai}</td>
                                    <td class="gold-num">${w.pending} Pcs</td>
                                    <td style="text-align:right;">Detail &rarr;</td>
                                </tr>`).join('') : `<tr><td colspan="7" style="text-align:center; padding:18px; color:#6b7280;">Koi worker nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                bindSearchKey('jwt-ow-search');
                return;
            }

            if (curView === 'owner-worker-detail') {
                const w = snap.workers.find((x) => x.id === ownerWorkerId);
                if (!w) return jwtBackTo('owner-workers');
                setTopHeader(`${w.name} (${grpLabel(w.group)}) — Pending Batch Detail`, '← [Esc] Workers List', '[Alt+P] Print Statement', true);

                body.innerHTML = `<div style="padding:14px 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                        <div><strong>${esc(w.name)}</strong> &middot; Mob: ${esc(w.mobile || '-')} &middot; <strong style="color:#b47d00;">Total Pending: ${w.pending} Pcs</strong></div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="jwt-esc" onclick="jwtShareWorkerWhatsApp('${esc(w.id)}')">WhatsApp</button>
                            <button type="button" class="jwt-save" onclick="activeWorkerId='${esc(w.id)}'; jwtGo('jw-worker-menu');">Open Out / In</button>
                        </div>
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Saree Design</th><th>Kariger (Maker)</th><th>Godam</th><th>Pehle Kya Ho Chuka (Trail)</th><th class="num">Pending Pcs</th></tr></thead>
                        <tbody>
                            ${w.pendingItems.length ? w.pendingItems.map((p, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td><strong>${esc(p.saree)}</strong></td>
                                    <td>${esc(p.maker)}</td>
                                    <td>${esc(p.godamName)}</td>
                                    <td class="trail">${esc(formatTrail(p.doneStages, 'unfinished'))}</td>
                                    <td class="gold-num">${p.pcs} Pcs</td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Koi pending saree nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                return;
            }

            if (curView === 'owner-godam') {
                setTopHeader('Godam Me Maujud (Summary)', '← [Esc] Owner Report', '[↑ ↓] Row · [Enter] Trail Detail · [Alt+P] Print', true);
                const q = (document.getElementById('jwt-og-search')?.value || '').trim().toLowerCase();
                const list = snap.godamSummaries.filter((g) => !q || `${g.saree} ${g.maker} ${g.godamName} ${g.bucket}`.toLowerCase().includes(q));
                if (menuIdx >= list.length || menuIdx < 0) menuIdx = Math.max(0, list.length - 1);

                body.innerHTML = `<div style="padding:12px 16px;">
                    <input type="text" id="jwt-og-search" class="jwt-inp" style="margin-bottom:10px;" value="${esc(q)}" placeholder="Search Saree, Maker, Godam..." oninput="jwtFilterList()">
                    <table>
                        <thead><tr><th>Saree Design</th><th>Kariger (Maker)</th><th>Godam</th><th>Status</th><th class="num">Total Available</th><th style="text-align:right;">Stages</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map((g, i) => `
                                <tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenOwnerGodamDetail('${encodeURIComponent(g.summaryKey)}')">
                                    <td><strong>${esc(g.saree)}</strong></td>
                                    <td>${esc(g.maker)}</td>
                                    <td>${esc(g.godamName)}</td>
                                    <td>${g.bucket === 'finished' ? 'Finished' : (g.bucket === 'lott' ? 'Lott' : 'Godam WIP')}</td>
                                    <td class="gold-num">${g.pcs} Pcs</td>
                                    <td style="text-align:right;">Trail (${g.batches.length}) &rarr;</td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Godam khali hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                bindSearchKey('jwt-og-search');
                return;
            }

            if (curView === 'owner-godam-detail') {
                const g = snap.godamSummaries.find((x) => x.summaryKey === ownerGodamSummaryKey);
                if (!g) return jwtBackTo('owner-godam');
                setTopHeader(`${g.saree} (${g.maker}) — Stages Detail`, '← [Esc] Godam Summary');

                body.innerHTML = `<div style="padding:14px 16px;">
                    <div style="margin-bottom:10px;"><strong>${esc(g.saree)}</strong> (${esc(g.maker)}) &middot; ${esc(g.godamName)} &middot; <strong style="color:#b47d00;">Total: ${g.pcs} Pcs</strong></div>
                    <table>
                        <thead><tr><th>#</th><th>Completed Stages Trail</th><th>Last Date</th><th class="num">Available Pcs</th></tr></thead>
                        <tbody>
                            ${g.batches.map((b, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${esc(formatTrail(b.doneStages, b.bucket))}</td>
                                    <td>${esc(fmtDate(b.lastDate))}</td>
                                    <td class="gold-num">${b.pcs} Pcs</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
                return;
            }

            if (curView === 'stock-list') {
                setTopHeader('Saree Stock', '← [Esc] Gateway', '[↑ ↓] Chunein · [Enter] Trail & Passbook · [Alt+P] Print', true);
                const tabs = [
                    { key: 'all', lbl: 'Sabhi' },
                    { key: 'unfinished', lbl: 'Kaam Baaki (WIP)' },
                    { key: 'finished', lbl: 'Finished (Ready)' },
                    { key: 'lott', lbl: 'Lott' }
                ];
                const q = (document.getElementById('jwt-st-search')?.value || '').trim().toLowerCase();
                const list = snap.godamSummaries
                    .filter((g) => stockBucketFilter === 'all' || g.bucket === stockBucketFilter)
                    .filter((g) => !q || `${g.saree} ${g.maker} ${g.godamName} ${g.batches.map((b) => formatTrail(b.doneStages, b.bucket)).join(' ')}`.toLowerCase().includes(q));
                if (menuIdx >= list.length || menuIdx < 0) menuIdx = Math.max(0, list.length - 1);

                body.innerHTML = `
                    <div class="jwt-subnav">
                        ${tabs.map((t) => {
                            const cnt = (t.key === 'all' ? snap.godamSummaries : snap.godamSummaries.filter((x) => x.bucket === t.key)).reduce((s, x) => s + x.pcs, 0);
                            return `<button type="button" class="jwt-tab ${stockBucketFilter === t.key ? 'active' : ''}" onclick="jwtSetStockBucket('${t.key}')">${esc(t.lbl)} (${cnt})</button>`;
                        }).join('')}
                    </div>
                    <div style="padding:12px 16px;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                            <input type="text" id="jwt-st-search" class="jwt-inp" style="flex:1; min-width:200px;" value="${esc(q)}" placeholder="Search Saree, Maker, Stage..." oninput="jwtFilterList()">
                            <button type="button" class="jwt-save" onclick="jwtToggleInward()">+ Saree Inward</button>
                        </div>
                        <div id="jwt-inw-box" style="display:${stockInwardOpen ? 'block' : 'none'}; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:12px;">
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                                <div><label style="font-size:11px; font-weight:700;">Tarikh</label><input type="date" id="jwt-inw-date" class="jwt-inp" value="${getTodayIso()}"></div>
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
                                    <tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenStockDetail('${encodeURIComponent(g.summaryKey)}')">
                                        <td><strong>${esc(g.saree)}</strong></td>
                                        <td>${esc(g.maker)}</td>
                                        <td>${esc(g.godamName)}</td>
                                        <td>${g.bucket === 'finished' ? 'Finished' : (g.bucket === 'lott' ? 'Lott' : 'Godam WIP')}</td>
                                        <td class="gold-num">${g.pcs} Pcs</td>
                                        <td style="text-align:right;">Trail (${g.batches.length}) &rarr;</td>
                                    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Koi stock nahi mila.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                `;
                bindSearchKey('jwt-st-search');
                return;
            }

            if (curView === 'stock-detail') {
                const g = snap.godamSummaries.find((x) => x.summaryKey === stockDetailKey);
                if (!g) return jwtBackTo('stock-list');
                setTopHeader(`${g.saree} (${g.maker}) — Stage Trail & Passbook`, '← [Esc] Saree Stock');

                const sH = safeArr(getStoreSafe('saree_history')).filter((h) => {
                    if (!h) return false;
                    const sN = normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
                    const mN = normText(h.karigerName || h.kariger, 'KARKHANA');
                    const kid = normGodam(h.karkhanaId);
                    return sN === g.saree && mN === g.maker && kid === g.karkhanaId;
                }).sort((a, b) => safeNum(b.timestamp, 0) - safeNum(a.timestamp, 0)).slice(0, 40);

                body.innerHTML = `<div style="padding:14px 16px;">
                    <div style="margin-bottom:8px;"><strong>${esc(g.saree)}</strong> (${esc(g.maker)}) &middot; ${esc(g.godamName)} &middot; <strong style="color:#b47d00;">Total: ${g.pcs} Pcs</strong></div>
                    <h4 style="margin:10px 0 6px; font-size:12px; color:#92400e; text-transform:uppercase;">1. Stage-Wise Available Stock</h4>
                    <table style="margin-bottom:14px;">
                        <thead><tr><th>#</th><th>Completed Stages Trail</th><th class="num">Available Pcs</th></tr></thead>
                        <tbody>
                            ${g.batches.map((b, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}">${esc(formatTrail(b.doneStages, b.bucket))}</td>
                                    <td class="gold-num">${b.pcs} Pcs</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                    <h4 style="margin:10px 0 6px; font-size:12px; color:#92400e; text-transform:uppercase;">2. Movement Passbook</h4>
                    <table>
                        <thead><tr><th>Tarikh</th><th>Detail</th><th class="num">Aai (+)</th><th class="num">Gayi (-)</th></tr></thead>
                        <tbody>
                            ${sH.map((h) => {
                                const isOut = (h.isOut === true) || (safeNum(h.gai) > 0);
                                const q = isOut ? safeInt(h.gai) : safeInt(h.aai);
                                return `<tr>
                                    <td>${esc(fmtDate(h.date))}</td>
                                    <td>${esc(h.typeLabel || h.note || '-')}</td>
                                    <td class="num">${!isOut ? `+${q}` : '-'}</td>
                                    <td class="num" style="color:#6b7280;">${isOut ? `-${q}` : '-'}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>`;
                return;
            }

            if (curView === 'final-out') {
                setTopHeader('Final Out (Dispatch)', '← [Esc] Gateway', 'Kariger ➔ Stage ➔ Pcs · Khali Kariger Enter = Save', true);
                const allBatches = snap.godamBatches.filter((b) => b.bucket !== 'lott' && b.pcs > 0);
                const totFoPcs = foBatch.reduce((s, x) => s + x.qty, 0);
                const dukanHist = safeArr(getStoreSafe('dukan_transfer_history')).slice().sort((a, b) => safeNum(b.timestamp, 0) - safeNum(a.timestamp, 0)).slice(0, 25);

                let editFoHtml = '';
                if (editFoId) {
                    const target = dukanHist.find((x) => String(x.id) === String(editFoId));
                    if (target) {
                        editFoHtml = `<div style="background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:10px 12px; margin-bottom:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="color:#92400e;">Edit Final Out: ${esc(target.sareeName)} (${esc(target.karigerName || '-')})</strong>
                                <button type="button" class="jwt-esc" onclick="editFoId=null; renderScreenNow();">Cancel</button>
                            </div>
                            <div style="display:grid; grid-template-columns:140px 1fr 100px auto; gap:8px; align-items:center;">
                                <input type="date" id="jwt-efo-date" class="jwt-inp" value="${esc(toIsoDate(target.date) || getTodayIso())}">
                                <input type="text" id="jwt-efo-note" class="jwt-inp" value="${esc(target.note || '')}">
                                <input type="text" inputmode="numeric" id="jwt-efo-pcs" class="jwt-inp" value="${safeInt(target.pcs)}">
                                <button type="button" class="jwt-save" onclick="jwtSaveFinalOutEdit('${esc(target.id)}')">Save</button>
                            </div>
                        </div>`;
                    }
                }

                body.innerHTML = `
                    <div class="jwt-split">
                        <div class="jwt-pane-l">
                            <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-fo-date" class="jwt-inp" value="${getTodayIso()}"></div>
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
                                <div class="jwt-sidebox-head"><span>Dispatch Batch</span><strong>${totFoPcs} Pcs (${foBatch.length})</strong></div>
                                <div style="max-height:165px; overflow-y:auto;">
                                    <table>
                                        <thead><tr><th>#</th><th>Kariger</th><th>Saree &amp; Stage</th><th class="num">Pcs</th><th></th></tr></thead>
                                        <tbody>
                                            ${foBatch.length ? foBatch.map((it, idx) => `
                                                <tr>
                                                    <td>${idx + 1}</td>
                                                    <td><strong>${esc(it.maker)}</strong></td>
                                                    <td>${esc(it.saree)}<div class="trail">${esc(formatTrail(it.doneStages, it.bucket))}</div></td>
                                                    <td class="gold-num">${it.qty}</td>
                                                    <td style="text-align:center;"><button type="button" tabindex="-1" class="jwt-esc" style="padding:1px 6px;" onclick="jwtRemoveFoItem(${idx})">&times;</button></td>
                                                </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; padding:10px; color:#6b7280;">Batch khali hai.</td></tr>`}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div id="jwt-fo-accept" class="jwt-accept-bar" style="display:${foAcceptOpen ? 'flex' : 'none'};">
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
                                        <td>${esc(fmtDate(d.date))}</td>
                                        <td><strong>${esc(d.sareeName)}</strong></td>
                                        <td>${esc(d.karigerName || '-')}</td>
                                        <td>${esc(d.note || '-')}</td>
                                        <td class="gold-num">${safeInt(d.pcs)}</td>
                                        <td style="text-align:right; white-space:nowrap;">
                                            <button type="button" class="jwt-esc" onclick="editFoId='${esc(d.id)}'; renderScreenNow();">Edit</button>
                                            <button type="button" class="jwt-esc" onclick="jwtPrintFinalOutRow('${esc(d.id)}')">Print</button>
                                            <button type="button" class="jwt-del" onclick="jwtDeleteFinalOutEntry('${esc(d.id)}')">Del</button>
                                        </td>
                                    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:14px; color:#6b7280;">Abhi koi Final Out entry nahi hai.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                `;
                renderFoRightPanel(allBatches);
                bindFinalOutKeys(allBatches);
                setTimeout(() => document.getElementById('jwt-fo-kariger')?.focus(), 25);
                return;
            }

            if (curView === 'bills-menu') {
                setTopHeader('Bills & Hisab', '← [Esc] Gateway', '[↑ ↓] + [Enter] · [Esc] Gateway');
                const bills = safeArr(getStoreSafe('jw_bills_list'));
                let totAmt = 0, totPaid = 0, pendCnt = 0, paidCnt = 0;
                bills.forEach((b) => {
                    totAmt += safeNum(b.billAmt);
                    totPaid += safeNum(b.paidAmt);
                    if (Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt)) > 0) pendCnt++;
                    else paidCnt++;
                });
                const totBaki = Math.max(0, totAmt - totPaid);

                const opts = [
                    { label: '1. New Bill (Entry)', val: 'Create', action: "menuIdx=0; jwtOpenBillNew()" },
                    { label: '2. Pending Bill', val: `${pendCnt} Bills`, action: "menuIdx=1; billsListMode='pending'; jwtGo('bills-list')" },
                    { label: '3. Paid Bill', val: `${paidCnt} Bills`, action: "menuIdx=2; billsListMode='paid'; jwtGo('bills-list')" }
                ];
                if (menuIdx >= opts.length || menuIdx < 0) menuIdx = 0;

                body.innerHTML = `
                    <div class="jwt-kpi-3">
                        <div class="jwt-kpi-cell"><small>Kul Bill Amount</small><strong>₹ ${totAmt.toFixed(2)}</strong></div>
                        <div class="jwt-kpi-cell"><small>Kul Paid</small><strong>₹ ${totPaid.toFixed(2)}</strong></div>
                        <div class="jwt-kpi-cell"><small>Dena Baki</small><strong>₹ ${totBaki.toFixed(2)}</strong></div>
                    </div>
                    <div style="padding:10px 16px;">
                        <div class="jwt-menu-shell">
                            <div class="jwt-menu-head"><span>Bills &amp; Hisab Menu</span></div>
                            ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${esc(o.val)}</span></button>`).join('')}
                            <div class="jwt-footer"><span>[&uarr; &darr;] Chunein &middot; [Enter] Kholein</span><span>[Esc] Gateway</span></div>
                        </div>
                    </div>
                `;
                return;
            }

            if (curView === 'bills-new') {
                setTopHeader('New Bill Entry', '← [Esc] Bills Menu', '[Enter] Agla Box · [↑↓] Worker Chunein · Paid=Total par direct Paid Bill');
                billAcceptOpen = false;
                body.innerHTML = `<div class="jwt-split">
                    <div class="jwt-pane-l">
                        <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-b-date" class="jwt-inp" value="${getTodayIso()}"></div>
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
                renderBillWorkerList('');
                bindBillNewKeys();
                setTimeout(() => document.getElementById('jwt-b-worker')?.focus(), 25);
                return;
            }

            if (curView === 'bills-list') {
                const isPend = (billsListMode === 'pending');
                setTopHeader(isPend ? 'Pending Bills' : 'Paid Bills', '← [Esc] Bills Menu', '[↑ ↓] Bill Chunein · [Enter] Pay / Receipt · [/] Search');
                const bills = safeArr(getStoreSafe('jw_bills_list'));
                const q = (document.getElementById('jwt-bl-search')?.value || '').trim().toLowerCase();
                const filtered = bills.filter((b) => {
                    const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
                    const matchMode = isPend ? baki > 0 : baki <= 0;
                    const matchQ = !q || `${b.workerName} ${b.billNo} ${b.date}`.toLowerCase().includes(q);
                    return matchMode && matchQ;
                });
                if (menuIdx >= filtered.length || menuIdx < 0) menuIdx = Math.max(0, filtered.length - 1);

                body.innerHTML = `<div style="padding:12px 16px;">
                    <input type="text" id="jwt-bl-search" class="jwt-inp" style="margin-bottom:10px;" value="${esc(q)}" placeholder="Search Worker, Bill No..." oninput="jwtFilterList()">
                    <table>
                        <thead><tr><th>Tarikh</th><th>Bill No</th><th>Job Worker</th><th>Work</th><th class="num">Pcs</th><th class="num">Total (₹)</th><th class="num">Paid (₹)</th><th class="num">Baki (₹)</th><th style="text-align:right;">Open</th></tr></thead>
                        <tbody>
                            ${filtered.length ? filtered.map((b, i) => {
                                const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
                                return `<tr class="jwt-row ${i === menuIdx ? 'active' : ''}" onclick="menuIdx=${i}; jwtOpenBillDetail('${esc(b.id)}')">
                                    <td>${esc(fmtDate(b.date))}</td>
                                    <td><strong>${esc(b.billNo || '-')}</strong></td>
                                    <td><strong>${esc(b.workerName)}</strong></td>
                                    <td>${esc(grpLabel(b.workType || 'cutting'))}</td>
                                    <td class="num">${safeInt(b.pcs)}</td>
                                    <td class="num">₹ ${safeNum(b.billAmt).toFixed(2)}</td>
                                    <td class="num">₹ ${safeNum(b.paidAmt).toFixed(2)}</td>
                                    <td class="gold-num">₹ ${baki.toFixed(2)}</td>
                                    <td style="text-align:right;">Open &rarr;</td>
                                </tr>`;
                            }).join('') : `<tr><td colspan="9" style="text-align:center; padding:18px; color:#6b7280;">${isPend ? 'Koi pending bill nahi hai.' : 'Koi paid bill nahi hai.'}</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                bindSearchKey('jwt-bl-search');
                return;
            }

            if (curView === 'bill-detail') {
                const bills = safeArr(getStoreSafe('jw_bills_list'));
                const b = bills.find((x) => String(x.id) === String(activeBillId));
                if (!b) return jwtBackTo('bills-list');
                const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
                const bPays = safeArr(getStoreSafe('jw_payments_list')).filter((p) => String(p.billId) === String(b.id));
                billPayAcceptOpen = false;
                setTopHeader(`Bill #${b.billNo || '-'} — ${b.workerName}`, '← [Esc] Bills List', '[Enter] Pay Entry · [Alt+P] Receipt Print', true);

                body.innerHTML = `<div style="padding:14px 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                        <div>
                            <strong>Bill #${esc(b.billNo || '-')}</strong> &middot; ${esc(b.workerName)} &middot;
                            Total: ₹ ${safeNum(b.billAmt).toFixed(2)} | Paid: ₹ ${safeNum(b.paidAmt).toFixed(2)} |
                            <strong style="color:#b47d00;">Baki: ₹ ${baki.toFixed(2)}</strong>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="jwt-esc" onclick="jwtPrintBillReceipt('${esc(b.id)}')">Print Receipt [Alt+P]</button>
                            <button type="button" class="jwt-del" onclick="jwtDeleteBill('${esc(b.id)}')">Delete Bill</button>
                        </div>
                    </div>

                    ${baki > 0 ? `<div style="max-width:480px; background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:14px;">
                        <div style="font-size:12px; font-weight:800; color:#92400e; margin-bottom:8px;">PAYMENT ENTRY (BAKI: ₹ ${baki.toFixed(2)})</div>
                        <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-bp-date" class="jwt-inp" value="${getTodayIso()}"></div>
                        <div class="jwt-frow"><label>Amount (₹) :</label><input type="text" inputmode="decimal" id="jwt-bp-amt" class="jwt-inp" value="${baki}"></div>
                        <div class="jwt-frow"><label>Mode :</label><select id="jwt-bp-mode" class="jwt-inp"><option>Cash</option><option>UPI / Online</option><option>Bank Transfer</option></select></div>
                        <div class="jwt-frow"><label>Note :</label><input type="text" id="jwt-bp-note" class="jwt-inp" value="Payment for Bill ${esc(b.billNo || '')}"></div>
                        <div id="jwt-bp-accept" class="jwt-accept-bar" style="display:none;">
                            <strong style="font-size:12px;">Accept? Payment Save Karein?</strong>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="jwt-bp-yes" class="jwt-save" onclick="jwtSaveBillPayment('${esc(b.id)}')">Yes [Y / Enter]</button>
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
                                <td>${esc(fmtDate(p.date))}</td>
                                <td>${esc(p.mode || 'Cash')} &middot; ${esc(p.note || '')}</td>
                                <td class="gold-num">₹ ${safeNum(p.amount).toFixed(2)}</td>
                                <td style="text-align:right;"><button type="button" class="jwt-del" onclick="jwtDeleteBillPay('${esc(p.id)}', '${esc(b.id)}')">Del</button></td>
                            </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; padding:12px; color:#6b7280;">Koi payment nahi hai.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
                if (baki > 0) {
                    bindBillPayKeys();
                    setTimeout(() => { const a = document.getElementById('jwt-bp-amt'); a?.focus(); a?.select(); }, 25);
                }
                return;
            }
        } catch (err) {
            console.error('[JW-Trail] Render failure prevented:', err);
        }
    };

    window.renderScreenNow = () => renderScreen();
    window.highlightRegRow = (idx) => {
        document.querySelectorAll('#jw-trail-section tbody tr.jwt-row').forEach((tr, i) => tr.classList.toggle('active', i === idx));
    };

    /* ========================================================================
       12. VOUCHER & FINAL OUT 2-STEP PICKER CONTROLLERS
    ======================================================================== */
    const renderVchRightPanel = (sourceBatches) => {
        const titleEl = document.getElementById('jwt-vch-r-title');
        const cntEl = document.getElementById('jwt-vch-r-cnt');
        const listEl = document.getElementById('jwt-vch-r-list');
        if (!listEl) return;

        const kQuery = document.getElementById('jwt-vch-kariger')?.value || '';
        if (vchPickStep === 'kariger') {
            vchRightItems = buildKarigerPickerList(sourceBatches, vchBatch, kQuery);
            if (vchRightIdx >= vchRightItems.length) vchRightIdx = vchRightItems.length ? 0 : -1;
            if (titleEl) titleEl.textContent = vchBatch.length && vchRightIdx < 0 ? '1. [↓] Kariger Chunein · [↵] Save' : '1. List of Karigers';
            if (cntEl) cntEl.textContent = `${vchRightItems.length} Karigers`;

            listEl.innerHTML = vchRightItems.length
                ? vchRightItems.map((it, i) => `
                    <div class="jwt-side-opt ${i === vchRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickVchRight(${i})">
                        <div><strong>${esc(it.maker)}</strong><div class="trail-muted">${it.stagesCount} Stage(s)</div></div>
                        <strong style="white-space:nowrap;">${it.totalPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Koi available stock nahi hai.</div>`;
        } else {
            vchRightItems = buildStagePickerList(sourceBatches, vchSelectedMaker, vchBatch);
            if (vchRightIdx >= vchRightItems.length || vchRightIdx < 0) vchRightIdx = 0;
            if (titleEl) titleEl.textContent = `2. ${vchSelectedMaker} ke Stages`;
            if (cntEl) cntEl.textContent = `${vchRightItems.length} Batches`;

            listEl.innerHTML = vchRightItems.length
                ? vchRightItems.map((b, i) => `
                    <div class="jwt-side-opt ${i === vchRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickVchRight(${i})">
                        <div>
                            <div><strong>${esc(b.saree)}</strong></div>
                            <div class="trail" style="font-size:11px;">${esc(formatTrail(b.doneStages, 'unfinished'))}</div>
                            <div class="trail-muted" style="font-size:10.5px;">${esc(b.godamName)}</div>
                        </div>
                        <strong style="white-space:nowrap;">${b.availPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Aur stock nahi bacha.</div>`;
        }
        listEl.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickVchRight = (idx) => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === activeWorkerId);
        const sourceBatches = (vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
        const item = vchRightItems[idx];
        if (!item) return;

        if (vchPickStep === 'kariger') {
            vchSelectedMaker = item.maker;
            const kInp = document.getElementById('jwt-vch-kariger');
            if (kInp) kInp.value = item.maker;
            vchPickStep = 'stage';
            vchRightIdx = 0;
            renderVchRightPanel(sourceBatches);
            setTimeout(() => document.getElementById('jwt-vch-stage')?.focus(), 20);
        } else {
            vchSelectedBatchKey = item.key;
            const sInp = document.getElementById('jwt-vch-stage');
            const qInp = document.getElementById('jwt-vch-qty');
            if (sInp) sInp.value = `${item.saree} [${formatTrail(item.doneStages, 'unfinished')}] — ${item.availPcs} Pc`;
            if (qInp) qInp.value = item.availPcs;
            setTimeout(() => {
                if (vchDir === 'in') document.getElementById('jwt-vch-dest')?.focus();
                else { qInp?.focus(); qInp?.select(); }
            }, 20);
        }
    };

    window.jwtAddVchItem = () => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === activeWorkerId);
        const sourceBatches = (vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
        const batch = sourceBatches.find((b) => b.key === vchSelectedBatchKey);
        if (!batch) return toast('Pehle Kariger aur Stage Batch chunein!', true);

        const avail = batch.pcs - getBatchUsedQty(vchBatch, batch.key);
        const qty = safeInt(document.getElementById('jwt-vch-qty')?.value);
        if (qty <= 0 || qty > avail) return toast(`Sahi Pcs daalein (Max ${avail} Pcs)!`, true);

        const dest = (vchDir === 'in') ? (document.getElementById('jwt-vch-dest')?.value || 'godam') : 'out';
        vchBatch.push({
            batchKey: batch.key,
            saree: batch.saree,
            maker: batch.maker,
            karkhanaId: batch.karkhanaId,
            doneStages: [...batch.doneStages],
            dest,
            qty
        });

        vchPickStep = 'kariger';
        vchSelectedMaker = null;
        vchSelectedBatchKey = null;
        vchRightIdx = -1;
        renderScreen();
    };

    window.jwtRemoveVchItem = (idx) => { vchBatch.splice(idx, 1); vchRightIdx = vchBatch.length ? -1 : 0; renderScreen(); };
    window.jwtCommitVch = (doPrint) => commitVchBatch(doPrint);
    window.jwtCancelVchAccept = () => {
        vchAcceptOpen = false;
        const bar = document.getElementById('jwt-vch-accept');
        if (bar) bar.style.display = 'none';
        document.getElementById('jwt-vch-kariger')?.focus();
    };

    const bindVchVoucherKeys = (sourceBatches) => {
        const kInp = document.getElementById('jwt-vch-kariger');
        const sInp = document.getElementById('jwt-vch-stage');
        const dSel = document.getElementById('jwt-vch-dest');
        const qInp = document.getElementById('jwt-vch-qty');
        const dtInp = document.getElementById('jwt-vch-date');
        const yesBtn = document.getElementById('jwt-vch-yes');

        if (dtInp) dtInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kInp?.focus(); } });
        if (kInp) {
            kInp.addEventListener('focus', () => {
                vchPickStep = 'kariger';
                vchRightIdx = (vchBatch.length > 0 && !kInp.value.trim()) ? -1 : 0;
                renderVchRightPanel(sourceBatches);
            });
            kInp.addEventListener('input', () => {
                vchPickStep = 'kariger';
                vchRightIdx = 0;
                renderVchRightPanel(sourceBatches);
            });
            kInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (vchRightItems.length) {
                        e.preventDefault();
                        if (vchRightIdx < 0) vchRightIdx = (e.key === 'ArrowDown') ? 0 : (vchRightItems.length - 1);
                        else vchRightIdx = e.key === 'ArrowDown' ? (vchRightIdx + 1) % vchRightItems.length : (vchRightIdx - 1 + vchRightItems.length) % vchRightItems.length;
                        renderVchRightPanel(sourceBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (!kInp.value.trim() && vchBatch.length > 0 && vchRightIdx < 0) {
                        vchAcceptOpen = true;
                        const bar = document.getElementById('jwt-vch-accept');
                        if (bar) bar.style.display = 'flex';
                        setTimeout(() => document.getElementById('jwt-vch-yes')?.focus(), 20);
                        return;
                    }
                    if (vchRightIdx >= 0 && vchRightItems[vchRightIdx]) window.jwtPickVchRight(vchRightIdx);
                }
            });
        }
        if (sInp) {
            sInp.addEventListener('focus', () => { if (vchSelectedMaker) { vchPickStep = 'stage'; renderVchRightPanel(sourceBatches); } });
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (vchRightItems.length) {
                        e.preventDefault();
                        vchRightIdx = e.key === 'ArrowDown' ? (vchRightIdx + 1) % vchRightItems.length : (vchRightIdx - 1 + vchRightItems.length) % vchRightItems.length;
                        renderVchRightPanel(sourceBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && vchRightItems[vchRightIdx]) {
                    e.preventDefault();
                    window.jwtPickVchRight(vchRightIdx);
                }
            });
        }
        if (dSel) dSel.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qInp?.focus(); qInp?.select(); } });
        if (qInp) qInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAddVchItem(); } });
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitVchBatch(false); }
                else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); commitVchBatch(true); }
                else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); window.jwtCancelVchAccept(); }
            });
        }
    };

    const renderFoRightPanel = (allBatches) => {
        const titleEl = document.getElementById('jwt-fo-r-title');
        const cntEl = document.getElementById('jwt-fo-r-cnt');
        const listEl = document.getElementById('jwt-fo-r-list');
        if (!listEl) return;

        const kQuery = document.getElementById('jwt-fo-kariger')?.value || '';
        if (foPickStep === 'kariger') {
            foRightItems = buildKarigerPickerList(allBatches, foBatch, kQuery);
            if (foRightIdx >= foRightItems.length) foRightIdx = foRightItems.length ? 0 : -1;
            if (titleEl) titleEl.textContent = foBatch.length && foRightIdx < 0 ? '1. [↓] Kariger Chunein · [↵] Save' : '1. List of Karigers';
            if (cntEl) cntEl.textContent = `${foRightItems.length} Karigers`;

            listEl.innerHTML = foRightItems.length
                ? foRightItems.map((it, i) => `
                    <div class="jwt-side-opt ${i === foRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickFoRight(${i})">
                        <div><strong>${esc(it.maker)}</strong><div class="trail-muted">${it.stagesCount} Stage(s)</div></div>
                        <strong style="white-space:nowrap;">${it.totalPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Godam me stock nahi hai.</div>`;
        } else {
            foRightItems = buildStagePickerList(allBatches, foSelectedMaker, foBatch);
            if (foRightIdx >= foRightItems.length || foRightIdx < 0) foRightIdx = 0;
            if (titleEl) titleEl.textContent = `2. ${foSelectedMaker} ke Stages`;
            if (cntEl) cntEl.textContent = `${foRightItems.length} Stages`;

            listEl.innerHTML = foRightItems.length
                ? foRightItems.map((b, i) => `
                    <div class="jwt-side-opt ${i === foRightIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickFoRight(${i})">
                        <div>
                            <div><strong>${esc(b.saree)}</strong></div>
                            <div class="${b.bucket === 'finished' ? 'trail-done' : 'trail'}" style="font-size:11px;">${esc(formatTrail(b.doneStages, b.bucket))}</div>
                            <div class="trail-muted" style="font-size:10.5px;">${esc(b.godamName)}</div>
                        </div>
                        <strong style="white-space:nowrap;">${b.availPcs} Pc</strong>
                    </div>`).join('')
                : `<div style="padding:16px; text-align:center; color:#6b7280; font-size:12px;">Aur stock nahi bacha.</div>`;
        }
        listEl.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickFoRight = (idx) => {
        const allBatches = getSnapshot().godamBatches.filter((b) => b.bucket !== 'lott' && b.pcs > 0);
        const item = foRightItems[idx];
        if (!item) return;

        if (foPickStep === 'kariger') {
            foSelectedMaker = item.maker;
            const kInp = document.getElementById('jwt-fo-kariger');
            if (kInp) kInp.value = item.maker;
            foPickStep = 'stage';
            foRightIdx = 0;
            renderFoRightPanel(allBatches);
            setTimeout(() => document.getElementById('jwt-fo-stage')?.focus(), 20);
        } else {
            foSelectedBatchKey = item.key;
            const sInp = document.getElementById('jwt-fo-stage');
            const qInp = document.getElementById('jwt-fo-qty');
            if (sInp) sInp.value = `${item.saree} [${formatTrail(item.doneStages, item.bucket)}] — ${item.availPcs} Pc`;
            if (qInp) qInp.value = item.availPcs;
            setTimeout(() => { qInp?.focus(); qInp?.select(); }, 20);
        }
    };

    window.jwtAddFoItem = () => {
        const allBatches = getSnapshot().godamBatches.filter((b) => b.bucket !== 'lott' && b.pcs > 0);
        const batch = allBatches.find((b) => b.key === foSelectedBatchKey);
        if (!batch) return toast('Pehle Kariger aur Stage chunein!', true);

        const avail = batch.pcs - getBatchUsedQty(foBatch, batch.key);
        const qty = safeInt(document.getElementById('jwt-fo-qty')?.value);
        if (qty <= 0 || qty > avail) return toast(`Sahi Pcs daalein (Max ${avail} Pcs)!`, true);

        foBatch.push({
            batchKey: batch.key,
            saree: batch.saree,
            maker: batch.maker,
            karkhanaId: batch.karkhanaId,
            doneStages: [...batch.doneStages],
            bucket: batch.bucket,
            qty
        });

        foPickStep = 'kariger';
        foSelectedMaker = null;
        foSelectedBatchKey = null;
        foRightIdx = -1;
        renderScreen();
    };

    window.jwtRemoveFoItem = (idx) => { foBatch.splice(idx, 1); foRightIdx = foBatch.length ? -1 : 0; renderScreen(); };
    window.jwtCommitFo = (doPrint) => commitFinalOutBatch(doPrint);
    window.jwtCancelFoAccept = () => {
        foAcceptOpen = false;
        const bar = document.getElementById('jwt-fo-accept');
        if (bar) bar.style.display = 'none';
        document.getElementById('jwt-fo-kariger')?.focus();
    };

    const bindFinalOutKeys = (allBatches) => {
        const kInp = document.getElementById('jwt-fo-kariger');
        const sInp = document.getElementById('jwt-fo-stage');
        const qInp = document.getElementById('jwt-fo-qty');
        const yesBtn = document.getElementById('jwt-fo-yes');

        if (kInp) {
            kInp.addEventListener('focus', () => {
                foPickStep = 'kariger';
                foRightIdx = (foBatch.length > 0 && !kInp.value.trim()) ? -1 : 0;
                renderFoRightPanel(allBatches);
            });
            kInp.addEventListener('input', () => {
                foPickStep = 'kariger';
                foRightIdx = 0;
                renderFoRightPanel(allBatches);
            });
            kInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (foRightItems.length) {
                        e.preventDefault();
                        if (foRightIdx < 0) foRightIdx = (e.key === 'ArrowDown') ? 0 : (foRightItems.length - 1);
                        else foRightIdx = e.key === 'ArrowDown' ? (foRightIdx + 1) % foRightItems.length : (foRightIdx - 1 + foRightItems.length) % foRightItems.length;
                        renderFoRightPanel(allBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (!kInp.value.trim() && foBatch.length > 0 && foRightIdx < 0) {
                        foAcceptOpen = true;
                        const bar = document.getElementById('jwt-fo-accept');
                        if (bar) bar.style.display = 'flex';
                        setTimeout(() => document.getElementById('jwt-fo-yes')?.focus(), 20);
                        return;
                    }
                    if (foRightIdx >= 0 && foRightItems[foRightIdx]) window.jwtPickFoRight(foRightIdx);
                }
            });
        }
        if (sInp) {
            sInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (foRightItems.length) {
                        e.preventDefault();
                        foRightIdx = e.key === 'ArrowDown' ? (foRightIdx + 1) % foRightItems.length : (foRightIdx - 1 + foRightItems.length) % foRightItems.length;
                        renderFoRightPanel(allBatches);
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && foRightItems[foRightIdx]) {
                    e.preventDefault();
                    window.jwtPickFoRight(foRightIdx);
                }
            });
        }
        if (qInp) qInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAddFoItem(); } });
        if (yesBtn) {
            yesBtn.addEventListener('keydown', (e) => {
                if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitFinalOutBatch(false); }
                else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); commitFinalOutBatch(true); }
                else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); window.jwtCancelFoAccept(); }
            });
        }
    };

    /* ========================================================================
       13. CREATE, ALTER, STOCK, BILLS CONTROLLERS
    ======================================================================== */
    window.jwtOpenCreateWorker = () => {
        selectedCreateGroupKey = getWorkGroups()[0]?.key || 'cutting';
        window.jwtGo('create-worker');
    };
    window.jwtOpenCreateGroup = () => window.jwtGo('create-group');

    window.jwtPickCwGroup = (idx) => {
        const groups = getWorkGroups();
        if (!groups[idx]) return;
        createSideIdx = idx;
        selectedCreateGroupKey = groups[idx].key;
        const gInp = document.getElementById('jwt-cw-grp');
        if (gInp) gInp.value = groups[idx].label;
        document.querySelectorAll('#jwt-cw-side-list .jwt-side-opt').forEach((el, i) => el.classList.toggle('active', i === idx));
        document.getElementById('jwt-cw-mob')?.focus();
    };

    window.jwtAskCrAccept = () => {
        crAcceptOpen = true;
        const bar = document.getElementById('jwt-cr-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-cr-yes')?.focus(), 20);
    };
    window.jwtCancelCrAccept = () => {
        crAcceptOpen = false;
        const bar = document.getElementById('jwt-cr-accept');
        if (bar) bar.style.display = 'none';
    };

    const bindCreateWorkerKeys = () => {
        const order = ['jwt-cw-name', 'jwt-cw-grp', 'jwt-cw-mob', 'jwt-cw-addr', 'jwt-cw-date'];
        order.forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (id === 'jwt-cw-grp' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    const groups = getWorkGroups();
                    if (!groups.length) return;
                    createSideIdx = e.key === 'ArrowDown' ? (createSideIdx + 1) % groups.length : (createSideIdx - 1 + groups.length) % groups.length;
                    selectedCreateGroupKey = groups[createSideIdx].key;
                    el.value = groups[createSideIdx].label;
                    document.querySelectorAll('#jwt-cw-side-list .jwt-side-opt').forEach((opt, idx) => opt.classList.toggle('active', idx === createSideIdx));
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) document.getElementById(order[i + 1])?.focus();
                    else window.jwtAskCrAccept();
                }
            });
        });
    };

    window.jwtSaveNewWorker = () => {
        const name = normText(document.getElementById('jwt-cw-name')?.value);
        const mobile = String(document.getElementById('jwt-cw-mob')?.value || '').trim();
        const address = String(document.getElementById('jwt-cw-addr')?.value || '').trim();
        const joinDate = toIsoDate(document.getElementById('jwt-cw-date')?.value) || getTodayIso();
        if (!name) return toast('Worker Name zaroori hai!', true);

        const list = safeArr(getStoreSafe('jobwork_workers')).slice();
        list.push({ id: `jw_${Date.now()}`, type: selectedCreateGroupKey, date: joinDate, name, address, mobile });
        setStoreSafe('jobwork_workers', list);
        invalidateAllCaches();
        toast(`✅ Worker [${name}] (${grpLabel(selectedCreateGroupKey)}) save ho gaya!`);
        window.jwtGo('create-worker');
    };

    window.jwtSaveNewGroup = () => {
        const raw = String(document.getElementById('jwt-cg-name')?.value || '').trim();
        if (!raw) return toast('Work Group Name likhein!', true);
        const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!key || key === 'all' || key === 'kariger') return toast('Yeh naam reserve hai!', true);

        const groups = getWorkGroups();
        if (groups.some((g) => g.key === key)) return toast('Yeh Work Group pehle se maujood hai!', true);
        groups.push({ key, label: raw });
        setStoreSafe(GROUPS_STORE_KEY, groups);
        selectedCreateGroupKey = key;
        invalidateAllCaches();
        syncTallyMasterGroups();
        toast(`✅ Work Group [${raw}] add ho gaya!`);
        jwtBackTo('create-menu');
    };

    window.jwtOpenAlterWorkerEdit = (wId) => { alterEditWorkerId = wId; window.jwtGo('alter-worker-edit'); };
    window.jwtUpdateWorker = (wId) => {
        const name = normText(document.getElementById('jwt-ew-name')?.value);
        const type = document.getElementById('jwt-ew-grp')?.value || 'cutting';
        const mobile = String(document.getElementById('jwt-ew-mob')?.value || '').trim();
        const address = String(document.getElementById('jwt-ew-addr')?.value || '').trim();
        const date = toIsoDate(document.getElementById('jwt-ew-date')?.value) || getTodayIso();
        if (!name) return toast('Worker Name zaroori hai!', true);

        const list = safeArr(getStoreSafe('jobwork_workers')).map((w) => {
            if (String(w.id) !== String(wId)) return w;
            return { ...w, name, type, mobile, address, date };
        });
        setStoreSafe('jobwork_workers', list);
        invalidateAllCaches(wId);
        toast(`✅ [${name}] update ho gaya!`);
        jwtBackTo('alter-worker-list');
    };

    window.jwtDeleteWorker = (wId) => {
        const snap = getSnapshot();
        const w = snap.workers.find((x) => x.id === wId);
        if (w && w.pending > 0) return toast(`Is worker ke paas abhi ${w.pending} Pcs pending hai! Pehle wapas lein.`, true);
        if (!confirm(`Kya worker [${w?.name || ''}] ko delete karna chahte hain?`)) return;
        const list = safeArr(getStoreSafe('jobwork_workers')).filter((x) => String(x.id) !== String(wId));
        setStoreSafe('jobwork_workers', list);
        invalidateAllCaches(wId);
        toast('Worker delete ho gaya!');
        jwtBackTo('alter-worker-list');
    };

    window.jwtOpenAlterGroupEdit = (gKey) => { alterEditGroupKey = gKey; window.jwtGo('alter-group-edit'); };
    window.jwtUpdateGroup = (gKey) => {
        const raw = String(document.getElementById('jwt-eg-name')?.value || '').trim();
        if (!raw) return toast('Group Name likhein!', true);
        const groups = getWorkGroups().map((g) => (g.key === gKey ? { ...g, label: raw } : g));
        setStoreSafe(GROUPS_STORE_KEY, groups);
        invalidateAllCaches();
        syncTallyMasterGroups();
        toast(`✅ Group [${raw}] update ho gaya!`);
        jwtBackTo('alter-group-list');
    };

    window.jwtDeleteGroup = (gKey) => {
        const snap = getSnapshot();
        const wc = snap.workers.filter((w) => w.group === gKey).length;
        if (wc > 0) return toast(`Is group me abhi ${wc} workers hain! Pehle unhe delete/shift karein.`, true);
        if (!confirm(`Kya Work Group [${grpLabel(gKey)}] ko delete karna chahte hain?`)) return;
        const groups = getWorkGroups().filter((g) => g.key !== gKey);
        setStoreSafe(GROUPS_STORE_KEY, groups);
        invalidateAllCaches();
        syncTallyMasterGroups();
        toast('Work Group delete ho gaya!');
        jwtBackTo('alter-group-list');
    };

    window.jwtSelectJwGroup = (gKey) => { activeGroupKey = gKey; window.jwtGo('jw-workers'); };
    window.jwtSelectWorker = (wId) => { activeWorkerId = wId; window.jwtGo('jw-worker-menu'); };
    window.jwtOpenWorkerVoucher = (dir) => {
        vchDir = dir;
        vchBatch = [];
        vchAcceptOpen = false;
        vchPickStep = 'kariger';
        vchSelectedMaker = null;
        vchSelectedBatchKey = null;
        vchRightIdx = 0;
        window.jwtGo('jw-voucher');
    };

    window.jwtOpenOwnerWorkerDetail = (wId) => { ownerWorkerId = wId; window.jwtGo('owner-worker-detail'); };
    window.jwtOpenOwnerGodamDetail = (encKey) => { ownerGodamSummaryKey = decodeURIComponent(encKey || ''); window.jwtGo('owner-godam-detail'); };

    window.jwtSetStockBucket = (b) => { stockBucketFilter = b; menuIdx = 0; renderScreen(); };
    window.jwtOpenStockDetail = (encKey) => { stockDetailKey = decodeURIComponent(encKey || ''); window.jwtGo('stock-detail'); };
    window.jwtToggleInward = () => {
        stockInwardOpen = !stockInwardOpen;
        const b = document.getElementById('jwt-inw-box');
        if (b) b.style.display = stockInwardOpen ? 'block' : 'none';
        if (stockInwardOpen) setTimeout(() => document.getElementById('jwt-inw-saree')?.focus(), 20);
    };
    window.jwtSaveInward = () => {
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
        toast(`✅ ${pcs} Pcs [${saree}] jama ho gayi!`);
        renderScreen();
    };

    window.jwtOpenFinalOut = () => {
        foBatch = [];
        foAcceptOpen = false;
        foPickStep = 'kariger';
        foSelectedMaker = null;
        foSelectedBatchKey = null;
        foRightIdx = 0;
        editFoId = null;
        window.jwtGo('final-out');
    };

    window.jwtOpenBillNew = () => {
        billSelectedWorkerId = null;
        billWorkerIdx = 0;
        window.jwtGo('bills-new');
    };
    window.jwtOpenBillDetail = (bId) => {
        activeBillId = bId;
        window.jwtGo('bill-detail');
    };

    const renderBillWorkerList = (q) => {
        const box = document.getElementById('jwt-b-wlist');
        if (!box) return;
        const query = String(q || '').trim().toLowerCase();
        billWorkerItems = getSnapshot().workers.filter((w) => !query || `${w.name} ${grpLabel(w.group)}`.toLowerCase().includes(query));
        if (billWorkerIdx >= billWorkerItems.length) billWorkerIdx = 0;
        box.innerHTML = billWorkerItems.length
            ? billWorkerItems.map((w, i) => `
                <div class="jwt-side-opt ${i === billWorkerIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickBillWorker(${i})">
                    <span>${esc(w.name)}</span><small>${esc(grpLabel(w.group))}</small>
                </div>`).join('')
            : `<div style="padding:14px; text-align:center; color:#6b7280; font-size:12px;">Koi worker nahi mila.</div>`;
        box.querySelector('.jwt-side-opt.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.jwtPickBillWorker = (idx) => {
        const w = billWorkerItems[idx];
        if (!w) return;
        billSelectedWorkerId = w.id;
        const inp = document.getElementById('jwt-b-worker');
        if (inp) inp.value = w.name;
        document.getElementById('jwt-b-no')?.focus();
    };

    window.jwtAskBillAccept = () => {
        billAcceptOpen = true;
        const bar = document.getElementById('jwt-b-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-b-yes')?.focus(), 20);
    };
    window.jwtCancelBillAccept = () => {
        billAcceptOpen = false;
        const bar = document.getElementById('jwt-b-accept');
        if (bar) bar.style.display = 'none';
    };

    const bindBillNewKeys = () => {
        const wInp = document.getElementById('jwt-b-worker');
        const order = ['jwt-b-date', 'jwt-b-worker', 'jwt-b-no', 'jwt-b-pcs', 'jwt-b-amt', 'jwt-b-paid', 'jwt-b-mode', 'jwt-b-note'];
        if (wInp) {
            wInp.addEventListener('input', () => { billWorkerIdx = 0; renderBillWorkerList(wInp.value); });
            wInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (billWorkerItems.length) {
                        e.preventDefault();
                        billWorkerIdx = e.key === 'ArrowDown' ? (billWorkerIdx + 1) % billWorkerItems.length : (billWorkerIdx - 1 + billWorkerItems.length) % billWorkerItems.length;
                        renderBillWorkerList(wInp.value);
                    }
                    return;
                }
                if (e.key === 'Enter' && billWorkerItems[billWorkerIdx]) {
                    e.preventDefault();
                    window.jwtPickBillWorker(billWorkerIdx);
                }
            });
        }
        order.forEach((id, i) => {
            if (id === 'jwt-b-worker') return;
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) {
                        const nxt = document.getElementById(order[i + 1]);
                        nxt?.focus();
                        if (nxt?.select) nxt.select();
                    } else {
                        window.jwtAskBillAccept();
                    }
                }
            });
        });
    };

    window.jwtSaveNewBill = () => {
        const dDate = toIsoDate(document.getElementById('jwt-b-date')?.value) || getTodayIso();
        const billNo = String(document.getElementById('jwt-b-no')?.value || '-').trim();
        const pcs = safeInt(document.getElementById('jwt-b-pcs')?.value);
        const amt = safeNum(document.getElementById('jwt-b-amt')?.value);
        const paidNow = Math.max(0, safeNum(document.getElementById('jwt-b-paid')?.value, 0));
        const mode = document.getElementById('jwt-b-mode')?.value || 'Cash';
        const note = String(document.getElementById('jwt-b-note')?.value || billNo).trim();
        const worker = getSnapshot().workers.find((w) => w.id === billSelectedWorkerId);

        if (!worker || amt <= 0) return toast('Worker aur Total Bill Amount (₹) bharein!', true);
        if (paidNow > amt) return toast('Paid Amount Total Bill se zyada nahi ho sakta!', true);

        const billId = `bill_${Date.now()}`;
        const bills = safeArr(getStoreSafe('jw_bills_list')).slice();
        bills.push({
            id: billId,
            billNo,
            date: dDate,
            workerId: worker.id,
            workerName: worker.name,
            workType: worker.group,
            pcs,
            billAmt: amt,
            paidAmt: paidNow,
            note
        });
        setStoreSafe('jw_bills_list', bills);

        if (paidNow > 0) {
            const pays = safeArr(getStoreSafe('jw_payments_list')).slice();
            pays.push({
                id: `pay_${Date.now()}`,
                billId,
                billNo,
                date: dDate,
                workerName: worker.name,
                amount: paidNow,
                mode,
                note: note || `Bill #${billNo} Payment`
            });
            setStoreSafe('jw_payments_list', pays);
        }

        invalidateAllCaches();
        const isPaidFull = (paidNow >= amt);
        toast(isPaidFull ? `✅ Bill #${billNo} Paid Bill me save ho gaya!` : `✅ Bill #${billNo} Pending Bill me save ho gaya!`);
        billsListMode = isPaidFull ? 'paid' : 'pending';
        jwtBackTo('bills-menu');
    };

    window.jwtAskBpAccept = () => {
        billPayAcceptOpen = true;
        const bar = document.getElementById('jwt-bp-accept');
        if (bar) bar.style.display = 'flex';
        setTimeout(() => document.getElementById('jwt-bp-yes')?.focus(), 20);
    };
    window.jwtCancelBpAccept = () => {
        billPayAcceptOpen = false;
        const bar = document.getElementById('jwt-bp-accept');
        if (bar) bar.style.display = 'none';
    };

    const bindBillPayKeys = () => {
        const order = ['jwt-bp-date', 'jwt-bp-amt', 'jwt-bp-mode', 'jwt-bp-note'];
        order.forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < order.length - 1) {
                        const nxt = document.getElementById(order[i + 1]);
                        nxt?.focus();
                        if (nxt?.select) nxt.select();
                    } else {
                        window.jwtAskBpAccept();
                    }
                }
            });
        });
    };

    window.jwtSaveBillPayment = (billId) => {
        const dDate = toIsoDate(document.getElementById('jwt-bp-date')?.value) || getTodayIso();
        const amt = safeNum(document.getElementById('jwt-bp-amt')?.value);
        const mode = document.getElementById('jwt-bp-mode')?.value || 'Cash';
        const note = String(document.getElementById('jwt-bp-note')?.value || '').trim();
        if (amt <= 0) return toast('Sahi Amount daalein!', true);

        let targetBill = null;
        const bills = safeArr(getStoreSafe('jw_bills_list')).map((b) => {
            if (String(b.id) !== String(billId)) return b;
            targetBill = { ...b, paidAmt: safeNum(b.paidAmt) + amt };
            return targetBill;
        });
        if (!targetBill) return;

        const pays = safeArr(getStoreSafe('jw_payments_list')).slice();
        pays.push({
            id: `pay_${Date.now()}`,
            billId,
            billNo: targetBill.billNo || '-',
            date: dDate,
            workerName: targetBill.workerName,
            amount: amt,
            mode,
            note
        });
        setStoreSafe('jw_bills_list', bills);
        setStoreSafe('jw_payments_list', pays);
        invalidateAllCaches();
        toast(`✅ ₹ ${amt.toFixed(2)} Payment save ho gaya!`);
        renderScreen();
    };

    window.jwtDeleteBillPay = (payId, billId) => {
        if (!confirm('Is payment ko delete karein?')) return;
        const pays = safeArr(getStoreSafe('jw_payments_list'));
        const targetP = pays.find((p) => String(p.id) === String(payId));
        if (!targetP) return;

        const bills = safeArr(getStoreSafe('jw_bills_list')).map((b) => {
            if (String(b.id) !== String(billId)) return b;
            return { ...b, paidAmt: Math.max(0, safeNum(b.paidAmt) - safeNum(targetP.amount)) };
        });
        setStoreSafe('jw_bills_list', bills);
        setStoreSafe('jw_payments_list', pays.filter((p) => String(p.id) !== String(payId)));
        invalidateAllCaches();
        toast('Payment delete ho gaya!');
        renderScreen();
    };

    window.jwtDeleteBill = (billId) => {
        if (!confirm('Kya is Bill ko delete karna chahte hain?')) return;
        const bills = safeArr(getStoreSafe('jw_bills_list')).filter((b) => String(b.id) !== String(billId));
        const pays = safeArr(getStoreSafe('jw_payments_list')).filter((p) => String(p.billId) !== String(billId));
        setStoreSafe('jw_bills_list', bills);
        setStoreSafe('jw_payments_list', pays);
        activeBillId = null;
        invalidateAllCaches();
        toast('Bill delete ho gaya!');
        jwtBackTo('bills-list');
    };

    window.jwtFilterList = () => {
        const active = document.activeElement;
        const aId = active?.id;
        const aVal = active?.value || '';
        const pos = active?.selectionStart || aVal.length;
        menuIdx = 0;
        renderScreen();
        if (aId) {
            const el = document.getElementById(aId);
            if (el) {
                el.value = aVal;
                el.focus();
                try { el.setSelectionRange(pos, pos); } catch (_) {}
            }
        }
    };

    const bindSearchKey = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
    };

    /* ========================================================================
       14. STRICT HIERARCHICAL ESC (RESTORES EXACT CURSOR!) & KEYBOARD ENGINE
    ======================================================================== */
    window.jwtHandleEsc = () => {
        if (curView === 'jw-voucher') {
            if (vchAcceptOpen) { window.jwtCancelVchAccept(); return; }
            if (vchPickStep === 'stage') {
                vchPickStep = 'kariger';
                vchSelectedMaker = null;
                vchRightIdx = 0;
                const kInp = document.getElementById('jwt-vch-kariger');
                const sInp = document.getElementById('jwt-vch-stage');
                if (kInp) kInp.value = '';
                if (sInp) sInp.value = '';
                const snap = getSnapshot();
                const w = snap.workers.find((x) => x.id === activeWorkerId);
                const src = (vchDir === 'out') ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : (w ? w.pendingItems : []);
                renderVchRightPanel(src);
                kInp?.focus();
                return;
            }
            jwtBackTo('jw-worker-menu');
            return;
        }
        if (curView === 'final-out') {
            if (editFoId) { editFoId = null; renderScreen(); return; }
            if (foAcceptOpen) { window.jwtCancelFoAccept(); return; }
            if (foPickStep === 'stage') {
                foPickStep = 'kariger';
                foSelectedMaker = null;
                foRightIdx = 0;
                const kInp = document.getElementById('jwt-fo-kariger');
                const sInp = document.getElementById('jwt-fo-stage');
                if (kInp) kInp.value = '';
                if (sInp) sInp.value = '';
                renderFoRightPanel(getSnapshot().godamBatches.filter((b) => b.bucket !== 'lott' && b.pcs > 0));
                kInp?.focus();
                return;
            }
            jwtBackTo('gateway');
            return;
        }
        if (curView === 'bill-detail') {
            if (billPayAcceptOpen) { window.jwtCancelBpAccept(); return; }
            jwtBackTo('bills-list');
            return;
        }
        if (curView === 'bills-new') {
            if (billAcceptOpen) { window.jwtCancelBillAccept(); return; }
            jwtBackTo('bills-menu');
            return;
        }
        if (curView === 'bills-list') { jwtBackTo('bills-menu'); return; }
        if (curView === 'bills-menu') { jwtBackTo('gateway'); return; }

        if (curView === 'create-worker' || curView === 'create-group') {
            if (crAcceptOpen) { window.jwtCancelCrAccept(); return; }
            jwtBackTo('create-menu');
            return;
        }
        if (curView === 'alter-worker-edit') {
            if (crAcceptOpen) { window.jwtCancelCrAccept(); return; }
            jwtBackTo('alter-worker-list');
            return;
        }
        if (curView === 'alter-group-edit') {
            if (crAcceptOpen) { window.jwtCancelCrAccept(); return; }
            jwtBackTo('alter-group-list');
            return;
        }
        if (curView === 'alter-worker-list' || curView === 'alter-group-list') { jwtBackTo('alter-menu'); return; }
        if (curView === 'create-menu' || curView === 'alter-menu') { jwtBackTo('gateway'); return; }

        if (curView === 'jw-worker-hist') {
            if (editWorkerRowInfo) { editWorkerRowInfo = null; renderScreen(); return; }
            jwtBackTo('jw-worker-menu');
            return;
        }
        if (curView === 'jw-worker-menu') { jwtBackTo('jw-workers'); return; }
        if (curView === 'jw-workers') { jwtBackTo('jw-groups'); return; }
        if (curView === 'jw-groups') { jwtBackTo('gateway'); return; }

        if (curView === 'owner-worker-detail') { jwtBackTo('owner-workers'); return; }
        if (curView === 'owner-godam-detail') { jwtBackTo('owner-godam'); return; }
        if (curView === 'owner-workers' || curView === 'owner-godam') { jwtBackTo('owner-menu'); return; }
        if (curView === 'owner-menu') { jwtBackTo('gateway'); return; }

        if (curView === 'stock-detail') { jwtBackTo('stock-list'); return; }
        if (curView === 'stock-list') {
            if (stockInwardOpen) { window.jwtToggleInward(); return; }
            jwtBackTo('gateway');
            return;
        }

        if (typeof window.backToDashboard === 'function') window.backToDashboard();
    };

    const handleKeyDown = (e) => {
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
            e.preventDefault();
            e.stopImmediatePropagation();
            window.jwtPrintCurrentScreen();
            return;
        }

        if (crAcceptOpen && ['create-worker', 'create-group', 'alter-worker-edit', 'alter-group-edit'].includes(curView)) {
            if (e.key.toLowerCase() === 'y' || e.key === 'Enter') {
                e.preventDefault(); e.stopImmediatePropagation();
                document.getElementById('jwt-cr-yes')?.click();
            } else if (e.key.toLowerCase() === 'n') {
                e.preventDefault(); e.stopImmediatePropagation();
                window.jwtCancelCrAccept();
            }
            return;
        }
        if (billAcceptOpen && curView === 'bills-new') {
            if (e.key.toLowerCase() === 'y' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtSaveNewBill(); }
            else if (e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtCancelBillAccept(); }
            return;
        }
        if (billPayAcceptOpen && curView === 'bill-detail') {
            if (e.key.toLowerCase() === 'y' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); document.getElementById('jwt-bp-yes')?.click(); }
            else if (e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.jwtCancelBpAccept(); }
            return;
        }

        if (e.ctrlKey && e.key === 'Enter') {
            if (['create-worker', 'alter-worker-edit'].includes(curView)) { e.preventDefault(); window.jwtAskCrAccept(); return; }
            if (curView === 'jw-voucher' && vchBatch.length) { e.preventDefault(); commitVchBatch(false); return; }
            if (curView === 'final-out' && foBatch.length) { e.preventDefault(); commitFinalOutBatch(false); return; }
            if (curView === 'bills-new') { e.preventDefault(); window.jwtAskBillAccept(); return; }
            if (curView === 'bill-detail') { e.preventDefault(); window.jwtAskBpAccept(); return; }
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const typing = (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA');

        if (!typing && e.key === '/') {
            const sBox = sec.querySelector('input[id$="-search"]');
            if (sBox) { e.preventDefault(); sBox.focus(); sBox.select(); return; }
        }

        if (curView === 'jw-worker-hist' && !editWorkerRowInfo && !typing) {
            const rows = Array.from(sec.querySelectorAll('tbody tr.jwt-row'));
            const activeRow = rows[menuIdx];
            if (activeRow) {
                if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    editWorkerRowInfo = { sheetId: activeRow.dataset.shid, rowId: activeRow.dataset.rid };
                    renderScreen();
                    return;
                }
                if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    window.jwtPrintWorkerRow(activeRow.dataset.shid, activeRow.dataset.rid);
                    return;
                }
            }
        }

        const navViews = [
            'gateway', 'create-menu', 'alter-menu', 'alter-worker-list', 'alter-group-list',
            'jw-groups', 'jw-workers', 'jw-worker-menu', 'jw-worker-hist',
            'owner-menu', 'owner-workers', 'owner-godam', 'stock-list',
            'bills-menu', 'bills-list'
        ];

        if (navViews.includes(curView) && !typing) {
            const rows = Array.from(sec.querySelectorAll('.jwt-menu-item, tbody tr.jwt-row'));
            if (rows.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    rows[menuIdx]?.classList.remove('active');
                    menuIdx = (menuIdx + 1) % rows.length;
                    rows[menuIdx]?.classList.add('active');
                    rows[menuIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    rows[menuIdx]?.classList.remove('active');
                    menuIdx = (menuIdx - 1 + rows.length) % rows.length;
                    rows[menuIdx]?.classList.add('active');
                    rows[menuIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }
                if (e.key === 'Enter' && !isNavGuarded() && curView !== 'jw-worker-hist') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    rows[menuIdx]?.click();
                    return;
                }
            }

            if (curView === 'gateway' && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const k = e.key.toLowerCase();
                const match = Array.from(sec.querySelectorAll('.jwt-menu-item')).find((b) => b.dataset.key === k);
                if (match) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    match.click();
                }
            }
        }
    };

    /* ========================================================================
       15. ENTRY POINTS & LEGACY ERP BRIDGE
    ======================================================================== */
    const openModuleAt = (startView) => {
        ensureSectionDOM();
        document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('jw-trail-section');
        if (sec) sec.style.display = 'block';
        window.jwtGo(startView || 'gateway');
    };

    window.openJobWorkModule = () => openModuleAt('gateway');
    window.openSareeModule = () => openModuleAt('stock-list');

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
            if (inp && grp && grp !== 'kariger') inp.value = grpLabel(grp);
        };
    }

    const origOpenTallyCreate = window.openTallyCreateModule;
    if (typeof origOpenTallyCreate === 'function') {
        window.openTallyCreateModule = () => {
            origOpenTallyCreate();
            syncTallyMasterGroups();
        };
    }

    const origTriggerRefresh = window.triggerActiveSectionRefresh;
    window.triggerActiveSectionRefresh = () => {
        if (typeof origTriggerRefresh === 'function') origTriggerRefresh();
        const sec = document.getElementById('jw-trail-section');
        if (sec && sec.style.display !== 'none') {
            cachedSnapshot = null;
            renderScreen();
        }
    };

    window.removeEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { ensureSectionDOM(); syncTallyMasterGroups(); });
    } else {
        ensureSectionDOM();
        syncTallyMasterGroups();
    }
})();
