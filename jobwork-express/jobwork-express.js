/* ============================================================================
   SIMPLICITY ERP - JOBWORK EXPRESS VOUCHER (UNIFIED TRAIL & DYNAMIC GROUPS)
   File: jobwork-express/jobwork-express.js (v3.5 - Final Out = Finished Stock)
   100% Synced with: jobwork-trail, saree_history, jobwork_workers,
   jobwork_groups, jobwork_firm_profile, jw_challan_seq,
   jobwork_sheets_*, dukan_transfer_history
============================================================================ */

(() => {
    'use strict';

    const GROUPS_STORE_KEY = 'jobwork_groups';
    const FIRM_STORE_KEY = 'jobwork_firm_profile';
    const SEQ_STORE_KEY = 'jw_challan_seq';

    const DEFAULT_GROUPS = [
        { key: 'cutting', label: 'Cutting', outstation: false },
        { key: 'embroidery', label: 'Embroidery', outstation: false },
        { key: 'calender', label: 'Calender', outstation: false }
    ];

    let activeCategory = 'cutting';
    let movementType = 'gayi';
    let expressBatchItems = [];
    let lastSavedExpressBatch = null;
    let expMeta = { jwNo: '', transport: '', lrNo: '', designNote: '' };

    let jwPickerMode = 'process';
    let jwPickerItems = [];
    let jwPickerActiveIdx = 0;
    let selectedMaker = null;
    let selectedBatchKey = null;
    let jwMakerArrowUsed = false;
    let isSubmitting = false;

    const safeArr = (v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof window.safeArray === 'function') return window.safeArray(v).filter(Boolean);
        return [];
    };

    const getFromStore = (key) => {
        try {
            if (typeof window.getStore === 'function') return window.getStore(key);
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch {
            return [];
        }
    };

    const setToStore = (key, val) => {
        if (typeof window.setStore === 'function') window.setStore(key, val);
        else localStorage.setItem(key, JSON.stringify(val));
    };

    const safeNum = (v, fb = 0) => {
        const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : fb;
    };

    const safeInt = (v, fb = 0) => {
        const n = parseInt(String(v == null ? '' : v).replace(/,/g, '').trim(), 10);
        return Number.isFinite(n) ? n : fb;
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const normText = (txt, fb = '') => String(txt == null ? fb : txt).trim().toUpperCase() || fb;

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

    const getToday = () => {
        const raw = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
        const iso = toIsoDate(raw);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date().toISOString().split('T')[0];
    };

    const formatDisplay = (d) => (typeof window.formatDateDisplay === 'function') ? window.formatDateDisplay(d) : (d || '-');

    const normGodamId = (kid) => {
        const clean = String(kid || '').trim();
        if (!clean || clean === 'k_main') return 'k_main';
        if (clean === 'all') return 'all';
        return clean;
    };

    const getEffectiveGodown = () => {
        try {
            if (typeof window.getActiveKarkhanaId === 'function') {
                return String(window.getActiveKarkhanaId() || 'all').trim() || 'all';
            }
        } catch (_) {}
        return 'all';
    };

    const getGodamLabel = (kid) => {
        const k = normGodamId(kid);
        if (k === 'all') return 'Sabhi Karkhane';
        if (typeof window.getKarkhanaNameById === 'function') return window.getKarkhanaNameById(k);
        return k === 'k_main' ? 'Main Godown' : k;
    };

    const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const getFirmProfile = () => {
        const raw = getFromStore(FIRM_STORE_KEY);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            return {
                name: String(raw.name || 'INDIAN FABRICS').trim(),
                address: String(raw.address || '').trim(),
                mobile: String(raw.mobile || '').trim(),
                gst: String(raw.gst || '').trim()
            };
        }
        return { name: 'INDIAN FABRICS', address: '', mobile: '', gst: '' };
    };

    const getWorkGroups = () => {
        const stored = safeArr(getFromStore(GROUPS_STORE_KEY));
        const workers = safeArr(getFromStore('jobwork_workers'));
        const map = new Map();

        if (stored.length) {
            stored.forEach((g) => {
                if (!g || !g.key) return;
                const k = String(g.key).trim().toLowerCase();
                if (k) map.set(k, { key: k, label: String(g.label || k).trim(), outstation: Boolean(g.outstation) });
            });
        } else {
            DEFAULT_GROUPS.forEach((g) => map.set(g.key, { ...g }));
        }

        workers.forEach((w) => {
            if (!w || !w.type) return;
            const k = String(w.type).trim().toLowerCase();
            if (k && !map.has(k)) {
                map.set(k, { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), outstation: false });
            }
        });

        return Array.from(map.values());
    };

    const getGroupObj = (key) => {
        const k = String(key || '').trim().toLowerCase();
        return getWorkGroups().find((g) => g.key === k) || { key: k, label: k ? k.charAt(0).toUpperCase() + k.slice(1) : 'JobWork', outstation: false };
    };

    const grpLabel = (key) => {
        if (key === 'dukan') return 'Final Out (Finished)';
        return getGroupObj(key).label;
    };

    const isOutstationOutActive = () => (activeCategory !== 'dukan' && movementType === 'gayi' && Boolean(getGroupObj(activeCategory).outstation));

    const getNextChallanNo = () => {
        const storedSeq = safeInt(getFromStore(SEQ_STORE_KEY), 0);
        let maxSeq = storedSeq;
        safeArr(getFromStore('jobwork_workers')).forEach((w) => {
            safeArr(getFromStore(`jobwork_sheets_${w.id}`)).forEach((sh) => {
                safeArr(sh?.rows).forEach((r) => {
                    const m = String(r?.jwNo || '').match(/(\d+)$/);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (n > maxSeq) maxSeq = n;
                    }
                });
            });
        });
        return `JW-${String(maxSeq + 1).padStart(3, '0')}`;
    };

    const bumpChallanSeq = (jwNoStr) => {
        const m = String(jwNoStr || '').match(/(\d+)$/);
        if (!m) return;
        const n = parseInt(m[1], 10);
        const cur = safeInt(getFromStore(SEQ_STORE_KEY), 0);
        if (n > cur) setToStore(SEQ_STORE_KEY, n);
    };

    const syncExpMetaFromDom = () => {
        const jEl = document.getElementById('jw-exp-jwno');
        const tEl = document.getElementById('jw-exp-trans');
        const lEl = document.getElementById('jw-exp-lr');
        const nEl = document.getElementById('jw-exp-design');
        if (jEl) expMeta.jwNo = jEl.value;
        if (tEl) expMeta.transport = tEl.value;
        if (lEl) expMeta.lrNo = lEl.value;
        if (nEl) expMeta.designNote = nEl.value;
    };

    const inferBucket = (t) => {
        const c = String(t || 'fresh').trim().toLowerCase();
        if (c === 'finished' || c === 'finish') return 'finished';
        if (c === 'lott' || c === 'lot' || c === 'damage') return 'lott';
        return 'unfinished';
    };

    const inferStages = (row) => {
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

    const getGodamAvailableBatches = (includeFinished = false) => {
        const activeFilter = getEffectiveGodown();
        const sareeHist = safeArr(getFromStore('saree_history'));
        const godamMap = new Map();
        const untrailedOuts = [];

        const chrono = sareeHist.slice().sort((a, b) => {
            const ta = safeNum(a.timestamp, 0);
            const tb = safeNum(b.timestamp, 0);
            if (ta !== tb) return ta - tb;
            return String(a.date || '').localeCompare(String(b.date || ''));
        });

        chrono.forEach((h) => {
            if (!h) return;
            const kid = normGodamId(h.karkhanaId);
            if (activeFilter !== 'all' && kid !== activeFilter) return;

            const sName = normText(h.sareeName || h.name || h.saree, 'GENERAL SAREE');
            const kName = normText(h.karigerName || h.kariger, 'KARKHANA');
            const bucket = h.stageBucket || inferBucket(h.type);
            const hasExplicit = Array.isArray(h.doneStages);
            const doneStages = inferStages(h);
            const trailKey = doneStages.join('|');
            const isOut = (h.isOut === true) || (safeNum(h.gai) > 0);
            const qty = isOut ? safeInt(h.gai != null ? h.gai : h.pcs) : safeInt(h.aai != null ? h.aai : h.pcs);
            if (qty <= 0) return;

            const bKey = `${sName}|||${kName}|||${kid}|||${bucket}|||${trailKey}`;
            if (!isOut) {
                let b = godamMap.get(bKey);
                if (!b) {
                    b = {
                        key: bKey, saree: sName, maker: kName, karkhanaId: kid,
                        godamName: getGodamLabel(kid), bucket, doneStages: [...doneStages], trailKey, pcs: 0
                    };
                    godamMap.set(bKey, b);
                }
                b.pcs += qty;
            } else {
                const exact = godamMap.get(bKey);
                if (exact && exact.pcs >= qty) exact.pcs -= qty;
                else if (hasExplicit && exact) exact.pcs = Math.max(0, exact.pcs - qty);
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

        return Array.from(godamMap.values()).filter((b) => {
            if (b.pcs <= 0) return false;
            if (includeFinished) return b.bucket !== 'lott';
            return b.bucket === 'unfinished';
        });
    };

    const getWorkerPendingBatches = (workerId) => {
        if (!workerId) return [];
        const activeFilter = getEffectiveGodown();
        const karigerMeta = new Map();
        safeArr(getFromStore('kariger_list')).forEach((k) => {
            if (k && k.name) {
                karigerMeta.set(normText(k.name), {
                    saree: normText(k.saree, 'GENERAL SAREE'),
                    karkhanaId: normGodamId(k.karkhanaId || 'k_main')
                });
            }
        });

        const sheets = safeArr(getFromStore(`jobwork_sheets_${workerId}`));
        const pMap = new Map();
        let diya = 0, aai = 0;
        const openingPend = sheets.length ? safeInt(sheets[0].closingPendingSaree, 0) : 0;

        const addP = (saree, maker, kid, stages, qty) => {
            if (qty <= 0) return;
            const sN = normText(saree, 'GENERAL SAREE');
            const mN = normText(maker, 'KARKHANA');
            const kId = normGodamId(kid);
            const st = Array.isArray(stages) ? stages : [];
            const pKey = `${workerId}|||${sN}|||${mN}|||${kId}|||${st.join('|')}`;
            let ex = pMap.get(pKey);
            if (!ex) {
                ex = {
                    key: pKey, saree: sN, maker: mN, karkhanaId: kId,
                    godamName: getGodamLabel(kId), bucket: 'unfinished', doneStages: [...st], pcs: 0
                };
                pMap.set(pKey, ex);
            }
            ex.pcs += qty;
        };

        const dedP = (saree, maker, kid, prevStages, qty) => {
            let rem = qty;
            if (rem <= 0) return;
            const sN = saree ? normText(saree) : null;
            const mN = maker ? normText(maker) : null;
            const kId = kid ? normGodamId(kid) : null;

            if (Array.isArray(prevStages) && sN && mN && kId) {
                const ex = pMap.get(`${workerId}|||${sN}|||${mN}|||${kId}|||${prevStages.join('|')}`);
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
            safeArr(sh?.rows).forEach((r) => {
                if (!r) return;
                const gItems = safeArr(r.gayiItems);
                if (gItems.length) {
                    gItems.forEach((it) => {
                        const q = safeInt(it.qty);
                        if (q <= 0) return;
                        const mN = normText(it.karigar || it.maker, 'KARKHANA');
                        const meta = karigerMeta.get(mN) || { saree: 'GENERAL SAREE', karkhanaId: 'k_main' };
                        const sN = normText(it.saree || meta.saree, 'GENERAL SAREE');
                        const kid = normGodamId(it.karkhanaId || meta.karkhanaId || 'k_main');
                        const st = Array.isArray(it.doneStages) ? it.doneStages : inferStages({ type: it.source || r.stockSource || 'fresh' });
                        diya += q;
                        if (activeFilter === 'all' || kid === activeFilter) addP(sN, mN, kid, st, q);
                    });
                } else if (safeInt(r.gayiQty) > 0) {
                    const q = safeInt(r.gayiQty);
                    diya += q;
                    if (activeFilter === 'all' || activeFilter === 'k_main') addP('GENERAL SAREE', 'KARKHANA', 'k_main', [], q);
                }

                const aItems = safeArr(r.aayiItems);
                if (aItems.length) {
                    aItems.forEach((it) => {
                        const q = safeInt(it.qty);
                        if (q <= 0) return;
                        aai += q;
                        const mN = it.karigar || it.maker ? normText(it.karigar || it.maker) : null;
                        const sN = it.saree ? normText(it.saree) : null;
                        const kid = it.karkhanaId ? normGodamId(it.karkhanaId) : null;
                        if (activeFilter === 'all' || !kid || kid === activeFilter) dedP(sN, mN, kid, it.prevStages, q);
                    });
                    if (safeInt(r.damagePcs) > 0 && !aItems.some((it) => it.isDamage)) {
                        const dq = safeInt(r.damagePcs); aai += dq; dedP(null, null, null, null, dq);
                    }
                } else {
                    const aq = safeInt(r.aayiQty), dq = safeInt(r.damagePcs);
                    if (aq > 0) { aai += aq; dedP(null, null, null, null, aq); }
                    if (dq > 0) { aai += dq; dedP(null, null, null, null, dq); }
                }
            });
        });

        if (openingPend > 0) {
            diya += openingPend;
            const curSum = Array.from(pMap.values()).reduce((s, x) => s + x.pcs, 0);
            const net = Math.max(0, diya - aai);
            if (net > curSum && (activeFilter === 'all' || activeFilter === 'k_main')) {
                addP('OPENING SAREE', 'PICHLA BAKI', 'k_main', [], net - curSum);
            }
        }

        return Array.from(pMap.values()).filter((p) => p.pcs > 0);
    };

    const getUsedBatchQty = (batchKey) => expressBatchItems.filter((x) => x.batchKey === batchKey).reduce((s, x) => s + safeInt(x.qty), 0);

    const getActiveSourceBatches = () => {
        if (activeCategory === 'dukan') return getGodamAvailableBatches(false);
        if (movementType === 'gayi') return getGodamAvailableBatches(false);
        const wId = document.getElementById('jw-exp-worker')?.value;
        return getWorkerPendingBatches(wId);
    };

    const resetCurrentBatchPickerFields = () => {
        selectedMaker = null;
        selectedBatchKey = null;
        jwMakerArrowUsed = false;
        const mInp = document.getElementById('jw-exp-maker-input');
        const sInp = document.getElementById('jw-exp-stage-input');
        const qInp = document.getElementById('jw-exp-qty-input');
        if (mInp) mInp.value = '';
        if (sInp) sInp.value = '';
        if (qInp) qInp.value = '';
    };

    const ensureTallyJobWorkStyles = () => {
        const old = document.getElementById('jw-tally-styles');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'jw-tally-styles';
        style.textContent = `
            .jw-overlay {
                position: fixed; inset: 0;
                background: rgba(31, 41, 55, 0.42);
                backdrop-filter: blur(2px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                padding: 12px; box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            .jw-card {
                background: #ffffff;
                width: 100%; max-width: 1020px;
                border: 1.5px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
                overflow: hidden;
                max-height: 95vh;
                display: flex; flex-direction: column;
                color: #1f2937;
                box-sizing: border-box;
            }
            .jw-header {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 9px 18px;
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px; flex-wrap: wrap;
            }
            .jw-title { margin: 0; font-size: 15px; font-weight: 800; color: #1f2937; }
            .jw-pill-btn {
                background: #ffffff; color: #374151;
                border: 1px solid #d1d5db; border-radius: 5px;
                padding: 4px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            }
            .jw-pill-btn:hover { border-color: #d9a425; background: #fef9ea; }
            .jw-pill-btn.active { background: #f2b71d; color: #1f2937; border-color: #d9a425; font-weight: 800; }
            .jw-body {
                display: flex; flex-direction: column; gap: 10px;
                padding: 12px 18px; overflow-y: auto; flex: 1; background: #ffffff;
            }
            .jw-top-grid {
                display: grid;
                grid-template-columns: minmax(0, 0.95fr) minmax(380px, 1.05fr);
                gap: 16px; align-items: stretch; min-width: 0;
            }
            @media (max-width: 840px) { .jw-top-grid { grid-template-columns: 1fr; } }
            .jw-left-col, .jw-right-col { min-width: 0; }
            .jw-right-col { display: flex; flex-direction: column; }
            .jw-sec-title {
                font-size: 10.5px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.5px;
                border-bottom: 1px solid #eadab0; padding-bottom: 3px; margin: 8px 0 6px 0;
            }
            .jw-row {
                display: grid; grid-template-columns: 128px minmax(0, 1fr);
                align-items: center; gap: 8px; margin-bottom: 5px;
            }
            .jw-lbl { font-size: 11.5px; font-weight: 700; color: #374151; }
            .jw-inp {
                width: 100%; padding: 5px 9px; border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 12.5px; font-weight: 700; color: #111827; background: #ffffff; outline: none;
            }
            .jw-inp:focus { border-color: #d9a425 !important; background: #fffdf5 !important; box-shadow: 0 0 0 2px rgba(242,183,29,0.22); }
            .jw-right-panel {
                border: 1.5px solid #d9b86c; border-radius: 6px;
                background: #ffffff; display: flex; flex-direction: column; overflow: hidden; flex: 1;
            }
            .jw-right-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7;
                padding: 7px 11px; font-size: 12px; font-weight: 800; color: #1f2937;
                display: flex; justify-content: space-between; align-items: center;
            }
            .jw-picker-list { overflow-y: auto; flex: 1; min-height: 250px; max-height: 370px; }
            .jw-picker-item {
                padding: 8px 11px; font-size: 12.5px; font-weight: 600; color: #1f2937;
                border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
            }
            .jw-picker-item:hover { background: #fef9ea; }
            .jw-picker-item.active { background: #f2b71d; color: #1f2937; font-weight: 800; }
            .jw-picker-sub { font-size: 11px; color: #92400e; font-weight: 700; }
            .jw-picker-item.active .jw-picker-sub { color: #1f2937; }
            .jw-batch-panel { border: 1px solid #e5d5a7; border-radius: 6px; background: #ffffff; overflow: hidden; }
            .jw-batch-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .jw-batch-table th { background: #fdf6e2; padding: 6px 9px; text-align: left; border-bottom: 1px solid #e5d5a7; font-size: 11px; }
            .jw-batch-table td { padding: 5px 9px; border-bottom: 1px solid #f3f4f6; }
            .jw-btn-save {
                background: #f2b71d; color: #1f2937; border: 1px solid #d9a425; border-radius: 5px;
                padding: 6px 15px; font-size: 12.5px; font-weight: 800; cursor: pointer;
            }
            .jw-btn-save:hover { background: #e5aa12; }
            .jw-btn-sec {
                background: #ffffff; color: #1f2937; border: 1px solid #d1d5db; border-radius: 5px;
                padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
            }
            .jw-btn-sec:hover { border-color: #d9a425; background: #fef9ea; }
            .jw-accept-bar {
                background: #fdf6e2; border: 1.5px solid #d9a425; border-radius: 5px;
                padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
            }
            .jw-footer {
                background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 7px 18px;
                display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
                font-size: 11px; color: #92400e; font-weight: 700;
            }
            @media (max-width: 768px) {
                .jw-overlay { padding: 0; align-items: stretch; }
                .jw-card { max-width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; border: none; }
                .jw-header { padding: 10px 12px; }
                .jw-body { padding: 12px; }
                .jw-row { grid-template-columns: 1fr; gap: 3px; }
                .jw-picker-list { min-height: 150px; max-height: 220px; }
                .jw-batch-panel > div { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .jw-footer { display: none; }
            }
        `;
        document.head.appendChild(style);
    };

    window.openJobWorkExpressModal = () => {
        ensureTallyJobWorkStyles();
        const existing = document.getElementById('master-jobwork-express-modal');
        if (existing) existing.remove();

        const groups = getWorkGroups();
        activeCategory = groups[0]?.key || 'cutting';
        movementType = 'gayi';
        expressBatchItems = [];
        lastSavedExpressBatch = null;
        expMeta = { jwNo: '', transport: '', lrNo: '', designNote: '' };
        jwPickerMode = 'process';
        jwPickerItems = [];
        jwPickerActiveIdx = 0;
        selectedMaker = null;
        selectedBatchKey = null;
        jwMakerArrowUsed = false;

        const today = getToday();
        const godamName = getGodamLabel(getEffectiveGodown());
        const firm = getFirmProfile();

        const catBtnsHtml = groups.map((g, i) => `
            <button type="button" tabindex="-1" id="jw-exp-cat-${esc(g.key)}" class="jw-pill-btn ${i === 0 ? 'active' : ''}" onclick="switchJobWorkCategory('${esc(g.key)}')">
                ${esc(g.label)}${i < 4 ? ` [F${i + 1}]` : ''}${g.outstation ? ' ★' : ''}
            </button>
        `).join('') + `<button type="button" tabindex="-1" id="jw-exp-cat-dukan" class="jw-pill-btn" onclick="switchJobWorkCategory('dukan')">Final Out (Finished)</button>`;

        const modalHtml = `
        <div id="master-jobwork-express-modal" class="jw-overlay">
            <div class="jw-card">
                <div class="jw-header">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <h3 class="jw-title">JobWork Express</h3>
                        ${catBtnsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11.5px; color:#6b7280; font-weight:700;">Godown: ${esc(godamName)}</span>
                        <button type="button" tabindex="-1" class="jw-pill-btn" onclick="closeJobWorkExpressModal()">&larr; [Esc] Back</button>
                    </div>
                </div>

                <div class="jw-body">
                    <div class="jw-top-grid">
                        <div class="jw-left-col">
                            <div class="jw-sec-title" style="margin-top:0;">1. Process, Len-Den &amp; Worker</div>

                            <div class="jw-row">
                                <label class="jw-lbl">Process :</label>
                                <input type="text" id="jw-exp-cat-input" value="${esc(grpLabel(activeCategory))}" readonly class="jw-inp" style="border-color:#d9a425; cursor:pointer;">
                            </div>

                            <div class="jw-row" id="jw-exp-movement-row">
                                <label class="jw-lbl">Len-Den [F5] :</label>
                                <input type="text" id="jw-exp-movement-input" value="Out (Bhejein)" readonly class="jw-inp" style="cursor:pointer;">
                            </div>

                            <div class="jw-row">
                                <label id="jw-exp-lbl-worker" class="jw-lbl">Worker :</label>
                                <div>
                                    <input type="text" id="jw-exp-worker-input" placeholder="Select Worker..." autocomplete="off" class="jw-inp" style="border-color:#d9a425;">
                                    <input type="hidden" id="jw-exp-worker" value="">
                                </div>
                            </div>

                            <div class="jw-row">
                                <label class="jw-lbl">Date :</label>
                                <input type="date" id="jw-exp-date" value="${today}" class="jw-inp">
                            </div>

                            <div id="jw-exp-outstation-box" style="display:none; background:#fdfcf7; border:1px solid #eadab0; border-radius:5px; padding:7px 9px; margin:6px 0;">
                                <div class="jw-row">
                                    <label class="jw-lbl">From (Firm) :</label>
                                    <input type="text" id="jw-exp-firm" class="jw-inp" readonly value="${esc(firm.name)}${firm.gst ? ` (GST: ${esc(firm.gst)})` : ''}">
                                </div>
                                <div class="jw-row">
                                    <label class="jw-lbl">JobWork No. :</label>
                                    <input type="text" id="jw-exp-jwno" class="jw-inp" value="">
                                </div>
                                <div class="jw-row">
                                    <label class="jw-lbl">Transport :</label>
                                    <input type="text" id="jw-exp-trans" class="jw-inp" placeholder="e.g. Patel / VRL Transport">
                                </div>
                                <div class="jw-row">
                                    <label class="jw-lbl">L.R. / Bale :</label>
                                    <input type="text" id="jw-exp-lr" class="jw-inp" placeholder="e.g. 4589 / 1 Bale">
                                </div>
                                <div class="jw-row" style="margin-bottom:0;">
                                    <label class="jw-lbl">Design / Work :</label>
                                    <input type="text" id="jw-exp-design" class="jw-inp" placeholder="e.g. Swarovski D.No 402">
                                </div>
                            </div>

                            <div class="jw-sec-title">2. Batch Entry (Kariger ➔ Stage ➔ Pcs)</div>

                            <div class="jw-row">
                                <label class="jw-lbl">Kariger (Maker) :</label>
                                <input type="text" id="jw-exp-maker-input" placeholder="Name likhein ya ↑↓ (Khali Enter=Save)" autocomplete="off" class="jw-inp" style="border-color:#d9a425;">
                            </div>

                            <div class="jw-row">
                                <label class="jw-lbl">Stage Batch :</label>
                                <input type="text" id="jw-exp-stage-input" placeholder="Kariger select hone par stage chunein..." readonly class="jw-inp">
                            </div>

                            <div class="jw-row" id="jw-exp-dest-row" style="display:none;">
                                <label class="jw-lbl">Wapas Kahan :</label>
                                <select id="jw-exp-dest-select" class="jw-inp"></select>
                            </div>

                            <div class="jw-row">
                                <label class="jw-lbl">Pcs :</label>
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <input type="text" inputmode="numeric" id="jw-exp-qty-input" placeholder="0" class="jw-inp" style="flex:1; border-color:#d9a425;">
                                    <button type="button" tabindex="-1" class="jw-btn-save" style="padding:5px 11px;" onclick="addExpressBatchRow()">+ Add</button>
                                </div>
                            </div>
                        </div>

                        <div class="jw-right-col">
                            <div class="jw-right-panel">
                                <div class="jw-right-head">
                                    <span id="jw-right-title">List of Processes</span>
                                    <span id="jw-right-hint" style="font-size:11px; color:#6b7280;">&uarr;&darr; + Enter</span>
                                </div>
                                <div id="jw-right-picker" class="jw-picker-list"></div>
                            </div>
                        </div>
                    </div>

                    <div class="jw-batch-panel">
                        <div class="jw-right-head">
                            <span>Gatthi / Batch List</span>
                            <div style="display:flex; gap:12px;">
                                <span id="jw-exp-batch-count-badge" style="color:#6b7280;">0 Items</span>
                                <strong>Total: <span id="jw-exp-live-batch-total" style="color:#b47d00;">0 Pcs</span></strong>
                            </div>
                        </div>
                        <div style="overflow-y:auto; max-height:145px;">
                            <table class="jw-batch-table">
                                <thead>
                                    <tr>
                                        <th style="width:40px;">#</th>
                                        <th>Kariger (Maker)</th>
                                        <th>Saree &amp; Stage Trail</th>
                                        <th id="jw-exp-th-dest" style="display:none;">Kahan</th>
                                        <th style="width:90px; text-align:right;">Pcs</th>
                                        <th style="width:50px; text-align:center;">Del</th>
                                    </tr>
                                </thead>
                                <tbody id="jw-exp-table-body"></tbody>
                            </table>
                        </div>
                    </div>

                    <div id="jw-exp-accept-strip" class="jw-accept-bar" style="display:none;"></div>

                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span id="jw-exp-status-msg" style="font-size:11.5px; color:#92400e; font-weight:700;">Kariger ➔ Stage ➔ Pcs · Khali Kariger Enter = Save</span>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button type="button" tabindex="-1" class="jw-btn-sec" onclick="printLastSavedJobWorkChallan()">Last Challan [Alt+P]</button>
                            <button type="button" tabindex="-1" id="jw-exp-last-slip-btn" class="jw-btn-sec" style="display:none;" onclick="printLastSavedJobWorkPackingSlip()">Packing Slip [Alt+L]</button>
                            <button type="button" id="jw-exp-submit-btn" class="jw-btn-save" onclick="askSaveMasterJobWorkExpress()">Save Batch [Ctrl+Enter]</button>
                        </div>
                    </div>
                </div>

                <div class="jw-footer">
                    <span>[&uarr;&darr; + Enter] Right List Select &middot; [F5] Out/In &middot; [Ctrl+&crarr;] Save &middot; [Esc] Close</span>
                    <span>Unified Trail Mode</span>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        updateCategoryUI();
        populateExpressWorkers();
        updateMovementUI();
        renderExpressBatchGrid();
        bindJobWorkExpressEvents();
        showJwRightPicker('process', '');
    };

    const getWorkerPickerList = (queryText = '') => {
        const q = String(queryText || '').trim().toLowerCase();
        if (activeCategory === 'dukan') {
            return [
                { label: 'Godam Finished', sub: 'Finished Stock', id: 'Godam Finished' },
                { label: 'Main Godown', sub: 'Finished Stock', id: 'Main Godown' }
            ].filter((x) => !q || x.label.toLowerCase().includes(q));
        }

        return safeArr(getFromStore('jobwork_workers'))
            .filter((w) => w && String(w.type || '').toLowerCase().trim() === activeCategory)
            .filter((w) => !q || `${w.name} ${w.mobile || ''}`.toLowerCase().includes(q))
            .map((w) => ({ label: w.name, sub: w.mobile || grpLabel(activeCategory), id: w.id }));
    };

    const showJwRightPicker = (mode, queryText = '') => {
        jwPickerMode = mode;
        const pickerEl = document.getElementById('jw-right-picker');
        const titleEl = document.getElementById('jw-right-title');
        const hintEl = document.getElementById('jw-right-hint');
        if (!pickerEl) return;

        jwPickerItems = [];

        if (mode === 'process') {
            if (titleEl) titleEl.textContent = 'List of Processes (Work Groups)';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            const groups = getWorkGroups();
            jwPickerItems = [
                ...groups.map((g, i) => ({ label: `${i + 1}. ${g.label}`, sub: g.outstation ? 'Bill+Slip' : (i < 4 ? `F${i + 1}` : 'Group'), data: g.key })),
                { label: `${groups.length + 1}. Final Out (Finished)`, sub: 'Finished Stock', data: 'dukan' }
            ];
            const idx = jwPickerItems.findIndex((x) => x.data === activeCategory);
            jwPickerActiveIdx = idx >= 0 ? idx : 0;
        } else if (mode === 'movement') {
            if (titleEl) titleEl.textContent = 'Select Len-Den';
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            jwPickerItems = [
                { label: `${grpLabel(activeCategory)} Out (Bhejein)`, sub: 'Godam ➔ Worker', data: 'gayi' },
                { label: `${grpLabel(activeCategory)} In (Wapas Lein)`, sub: 'Worker ➔ Godam', data: 'aayi' }
            ];
            jwPickerActiveIdx = movementType === 'aayi' ? 1 : 0;
        } else if (mode === 'worker') {
            if (titleEl) titleEl.textContent = activeCategory === 'dukan' ? 'Remark / Godam' : `List of ${grpLabel(activeCategory)} Workers`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            jwPickerItems = getWorkerPickerList(queryText).map((w) => ({ label: w.label, sub: w.sub, data: w }));
            const curVal = document.getElementById('jw-exp-worker')?.value;
            const curIdx = jwPickerItems.findIndex((x) => String(x.data.id) === String(curVal));
            jwPickerActiveIdx = curIdx >= 0 ? curIdx : 0;
        } else if (mode === 'kariger') {
            const batches = getActiveSourceBatches();
            const q = String(queryText || '').trim().toLowerCase();
            const kMap = new Map();
            batches.forEach((b) => {
                const avail = b.pcs - getUsedBatchQty(b.key);
                if (avail <= 0) return;
                let ex = kMap.get(b.maker);
                if (!ex) { ex = { maker: b.maker, pcs: 0, stages: 0, sarees: new Set() }; kMap.set(b.maker, ex); }
                ex.pcs += avail;
                ex.stages += 1;
                ex.sarees.add(b.saree);
            });
            jwPickerItems = Array.from(kMap.values())
                .filter((k) => !q || `${k.maker} ${Array.from(k.sarees).join(' ')}`.toLowerCase().includes(q))
                .sort((a, b) => a.maker.localeCompare(b.maker))
                .map((k) => ({ label: k.maker, sub: `${k.pcs} Pc (${k.stages} Stage)`, data: k.maker }));
            if (jwPickerActiveIdx >= jwPickerItems.length) jwPickerActiveIdx = jwPickerItems.length ? 0 : -1;
            if (titleEl) titleEl.textContent = (expressBatchItems.length && jwPickerActiveIdx < 0)
                ? '1. [↓] Kariger Chunein · [↵] Save'
                : '1. List of Karigers (Makers)';
            if (hintEl) hintEl.textContent = expressBatchItems.length > 0 ? 'Khali Enter = Save' : '↑↓ + Enter';
        } else if (mode === 'stage') {
            const batches = getActiveSourceBatches().filter((b) => b.maker === selectedMaker);
            jwPickerItems = batches
                .map((b) => ({ ...b, avail: b.pcs - getUsedBatchQty(b.key) }))
                .filter((b) => b.avail > 0)
                .map((b) => ({
                    label: `${b.saree}`,
                    sub: `${formatTrail(b.doneStages, b.bucket)} · ${b.avail} Pc`,
                    data: b
                }));
            if (titleEl) titleEl.textContent = `2. ${selectedMaker || ''} ke Stages`;
            if (hintEl) hintEl.textContent = '↑↓ + Enter';
            if (jwPickerActiveIdx >= jwPickerItems.length || jwPickerActiveIdx < 0) jwPickerActiveIdx = 0;
        } else if (mode === 'summary') {
            if (titleEl) titleEl.textContent = 'Active Context';
            if (hintEl) hintEl.textContent = 'Live';
            const wTxt = document.getElementById('jw-exp-worker-input')?.value || '-';
            pickerEl.innerHTML = `<div style="padding:12px; font-size:12.5px; line-height:1.7;">
                <div><strong>Process:</strong> ${esc(grpLabel(activeCategory))}</div>
                <div><strong>Len-Den:</strong> ${activeCategory === 'dukan' ? 'Final Out (Finished)' : (movementType === 'gayi' ? 'Out (Bhejein)' : 'In (Wapas Lein)')}</div>
                <div><strong>Worker / Remark:</strong> ${esc(wTxt)}</div>
            </div>`;
            return;
        }

        renderJwRightPickerList();
    };

    const renderJwRightPickerList = () => {
        const pickerEl = document.getElementById('jw-right-picker');
        if (!pickerEl) return;

        if (!jwPickerItems.length) {
            pickerEl.innerHTML = `<div style="padding:18px 12px; text-align:center; color:#6b7280; font-size:12px;">Koi matching stock/record nahi mila.</div>`;
            return;
        }

        pickerEl.innerHTML = jwPickerItems.map((item, idx) => `
            <div class="jw-picker-item ${idx === jwPickerActiveIdx ? 'active' : ''}" onmousedown="event.preventDefault(); window.__jwPickItem(${idx})">
                <span>${esc(item.label)}</span>
                <span class="jw-picker-sub">${esc(item.sub)}</span>
            </div>
        `).join('');

        pickerEl.querySelector('.jw-picker-item.active')?.scrollIntoView({ block: 'nearest' });
    };

    window.__jwPickItem = (idx) => {
        const item = jwPickerItems[idx];
        if (!item) return;

        if (jwPickerMode === 'process') {
            if (item.data !== activeCategory) {
                if (!switchJobWorkCategory(item.data, true)) return;
            } else {
                focusFirstField(activeCategory === 'dukan' ? 'jw-exp-worker-input' : 'jw-exp-movement-input');
            }
        } else if (jwPickerMode === 'movement') {
            if (item.data !== movementType) {
                if (!confirmClearBatchIfNeeded('Len-Den')) return;
                movementType = item.data;
                resetCurrentBatchPickerFields();
                updateMovementUI();
                renderExpressBatchGrid();
            }
            focusFirstField('jw-exp-worker-input');
        } else if (jwPickerMode === 'worker') {
            const wSel = document.getElementById('jw-exp-worker');
            const wInp = document.getElementById('jw-exp-worker-input');
            const prevWorkerId = wSel ? wSel.value : '';
            const nextWorkerId = String(item.data.id || '');
            if (prevWorkerId && nextWorkerId !== prevWorkerId && movementType === 'aayi' && activeCategory !== 'dukan') {
                if (!confirmClearBatchIfNeeded('Worker')) return;
            }
            if (nextWorkerId !== prevWorkerId) resetCurrentBatchPickerFields();
            if (wSel) wSel.value = nextWorkerId;
            if (wInp) wInp.value = item.data.label;
            focusFirstField('jw-exp-date');
        } else if (jwPickerMode === 'kariger') {
            selectedMaker = item.data;
            const mInp = document.getElementById('jw-exp-maker-input');
            if (mInp) mInp.value = item.data;
            jwPickerActiveIdx = 0;
            focusFirstField('jw-exp-stage-input');
        } else if (jwPickerMode === 'stage') {
            const b = item.data;
            selectedBatchKey = b.key;
            const sInp = document.getElementById('jw-exp-stage-input');
            const qInp = document.getElementById('jw-exp-qty-input');
            if (sInp) sInp.value = `${b.saree} [${formatTrail(b.doneStages, b.bucket)}] — ${b.avail} Pc`;
            if (qInp) qInp.value = b.avail;
            if (activeCategory !== 'dukan' && movementType === 'aayi') {
                focusFirstField('jw-exp-dest-select');
            } else {
                focusFirstField('jw-exp-qty-input');
            }
        }
    };

    const getOrderedInputs = () => {
        const ids = [
            'jw-exp-cat-input',
            'jw-exp-movement-input',
            'jw-exp-worker-input',
            'jw-exp-date',
            'jw-exp-jwno',
            'jw-exp-trans',
            'jw-exp-lr',
            'jw-exp-design',
            'jw-exp-maker-input',
            'jw-exp-stage-input',
            'jw-exp-dest-select',
            'jw-exp-qty-input'
        ];
        return ids.map((id) => document.getElementById(id)).filter((el) => el && !el.disabled && el.offsetParent !== null);
    };

    const focusFirstField = (targetId) => {
        setTimeout(() => {
            const el = document.getElementById(targetId);
            if (el && el.offsetParent !== null) {
                el.focus();
                if (typeof el.select === 'function' && !el.readOnly) el.select();
            }
        }, 30);
    };

    const showJwAcceptPrompt = (show) => {
        const bar = document.getElementById('jw-exp-accept-strip');
        if (!bar) return;
        if (!show) {
            bar.style.display = 'none';
            return;
        }
        const outst = isOutstationOutActive();
        bar.innerHTML = outst ? `
            <strong style="font-size:12.5px;">Save Karein — Kya Print Karna Hai?</strong>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="jw-btn-save" onclick="submitMasterJobWorkExpress('challan')">Print Challan [P]</button>
                <button type="button" class="jw-btn-save" onclick="submitMasterJobWorkExpress('slip')">Packing Slip [L]</button>
                <button type="button" class="jw-btn-save" onclick="submitMasterJobWorkExpress('both')">Both (Challan+Slip) [B]</button>
                <button type="button" id="jw-exp-accept-yes" class="jw-btn-sec" onclick="submitMasterJobWorkExpress('')">Save Only [Y / Enter]</button>
                <button type="button" class="jw-btn-sec" onclick="window.__jwCancelAccept()">No [N / Esc]</button>
            </div>
        ` : `
            <strong style="font-size:12.5px;">Accept? Batch Save &amp; Print Karein?</strong>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="jw-btn-save" onclick="submitMasterJobWorkExpress('challan')">Save &amp; Print [P]</button>
                <button type="button" id="jw-exp-accept-yes" class="jw-btn-save" onclick="submitMasterJobWorkExpress('')">Yes (Save Only) [Y / Enter]</button>
                <button type="button" class="jw-btn-sec" onclick="window.__jwCancelAccept()">No [N / Esc]</button>
            </div>
        `;
        bar.style.display = 'flex';
        bar.scrollIntoView({ block: 'nearest' });
        setTimeout(() => document.getElementById('jw-exp-accept-yes')?.focus(), 20);
    };

    window.askSaveMasterJobWorkExpress = () => {
        if (!expressBatchItems.length) {
            alert('Batch me kam se kam 1 Saree jodein!');
            focusFirstField('jw-exp-maker-input');
            return;
        }
        const isDukan = (activeCategory === 'dukan');
        const workerId = document.getElementById('jw-exp-worker')?.value;
        if (!isDukan && !workerId) {
            alert('Kripya list me se Worker chunein!');
            focusFirstField('jw-exp-worker-input');
            return;
        }
        showJwAcceptPrompt(true);
    };

    const bindJobWorkExpressEvents = () => {
        window.__jwCancelAccept = () => {
            showJwAcceptPrompt(false);
            focusFirstField('jw-exp-maker-input');
        };

        const catInp = document.getElementById('jw-exp-cat-input');
        const movInp = document.getElementById('jw-exp-movement-input');
        const workerInp = document.getElementById('jw-exp-worker-input');
        const dateEl = document.getElementById('jw-exp-date');
        const jwNoEl = document.getElementById('jw-exp-jwno');
        const transEl = document.getElementById('jw-exp-trans');
        const lrEl = document.getElementById('jw-exp-lr');
        const designEl = document.getElementById('jw-exp-design');
        const makerInp = document.getElementById('jw-exp-maker-input');
        const stageInp = document.getElementById('jw-exp-stage-input');
        const destSel = document.getElementById('jw-exp-dest-select');
        const qtyInp = document.getElementById('jw-exp-qty-input');

        const attachPicker = (el, modeName, filterable) => {
            if (!el) return;
            el.addEventListener('focus', () => showJwRightPicker(modeName, ''));
            if (filterable) {
                el.addEventListener('input', () => {
                    if (modeName === 'worker') {
                        const wSel = document.getElementById('jw-exp-worker');
                        const typed = el.value.trim().toLowerCase();
                        const exact = getWorkerPickerList('').find((w) => w.label.toLowerCase() === typed);
                        if (wSel) wSel.value = exact ? exact.id : '';
                    }
                    jwPickerActiveIdx = 0;
                    showJwRightPicker(modeName, el.value);
                });
            }
            el.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (jwPickerItems.length) {
                        e.preventDefault();
                        jwPickerActiveIdx = e.key === 'ArrowDown' ? (jwPickerActiveIdx + 1) % jwPickerItems.length : (jwPickerActiveIdx - 1 + jwPickerItems.length) % jwPickerItems.length;
                        renderJwRightPickerList();
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && jwPickerItems[jwPickerActiveIdx]) {
                    e.preventDefault();
                    window.__jwPickItem(jwPickerActiveIdx);
                }
            });
        };

        attachPicker(catInp, 'process', false);
        attachPicker(movInp, 'movement', false);
        attachPicker(workerInp, 'worker', true);

        if (dateEl) {
            dateEl.addEventListener('focus', () => showJwRightPicker('summary', ''));
            dateEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    focusFirstField(isOutstationOutActive() ? 'jw-exp-jwno' : 'jw-exp-maker-input');
                }
            });
        }

        const outstOrder = [jwNoEl, transEl, lrEl, designEl];
        outstOrder.forEach((el, idx) => {
            if (!el) return;
            el.addEventListener('focus', () => showJwRightPicker('summary', ''));
            el.addEventListener('input', syncExpMetaFromDom);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    syncExpMetaFromDom();
                    const nxt = outstOrder[idx + 1];
                    focusFirstField(nxt ? nxt.id : 'jw-exp-maker-input');
                }
            });
        });

        if (makerInp) {
            makerInp.addEventListener('focus', () => {
                jwMakerArrowUsed = false;
                jwPickerActiveIdx = (expressBatchItems.length > 0 && !makerInp.value.trim()) ? -1 : 0;
                showJwRightPicker('kariger', makerInp.value);
            });
            makerInp.addEventListener('input', () => {
                jwMakerArrowUsed = true;
                jwPickerActiveIdx = (!makerInp.value.trim() && expressBatchItems.length > 0) ? -1 : 0;
                showJwRightPicker('kariger', makerInp.value);
            });
            makerInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (jwPickerItems.length) {
                        e.preventDefault();
                        jwMakerArrowUsed = true;
                        if (jwPickerActiveIdx < 0) jwPickerActiveIdx = (e.key === 'ArrowDown') ? 0 : (jwPickerItems.length - 1);
                        else jwPickerActiveIdx = e.key === 'ArrowDown' ? (jwPickerActiveIdx + 1) % jwPickerItems.length : (jwPickerActiveIdx - 1 + jwPickerItems.length) % jwPickerItems.length;
                        renderJwRightPickerList();
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (!makerInp.value.trim() && expressBatchItems.length > 0 && jwPickerActiveIdx < 0) {
                        window.askSaveMasterJobWorkExpress();
                        return;
                    }
                    if (jwPickerActiveIdx >= 0 && jwPickerItems[jwPickerActiveIdx]) window.__jwPickItem(jwPickerActiveIdx);
                }
            });
        }

        if (stageInp) {
            stageInp.addEventListener('focus', () => { jwPickerActiveIdx = 0; showJwRightPicker('stage', ''); });
            stageInp.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (jwPickerItems.length) {
                        e.preventDefault();
                        jwPickerActiveIdx = e.key === 'ArrowDown' ? (jwPickerActiveIdx + 1) % jwPickerItems.length : (jwPickerActiveIdx - 1 + jwPickerItems.length) % jwPickerItems.length;
                        renderJwRightPickerList();
                    }
                    return;
                }
                if (e.key === 'Enter' && !e.ctrlKey && jwPickerItems[jwPickerActiveIdx]) {
                    e.preventDefault();
                    window.__jwPickItem(jwPickerActiveIdx);
                }
            });
        }

        if (destSel) {
            destSel.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); focusFirstField('jw-exp-qty-input'); }
            });
        }

        if (qtyInp) {
            qtyInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); addExpressBatchRow(); }
            });
        }

        focusFirstField('jw-exp-cat-input');
        window.removeEventListener('keydown', handleJobWorkExpressGlobalKeydown, true);
        window.addEventListener('keydown', handleJobWorkExpressGlobalKeydown, true);
    };

    const handleJobWorkExpressGlobalKeydown = (e) => {
        const modal = document.getElementById('master-jobwork-express-modal');
        if (!modal || modal.style.display === 'none') return;

        const acceptBar = document.getElementById('jw-exp-accept-strip');
        const acceptOpen = Boolean(acceptBar && acceptBar.style.display !== 'none');

        if (acceptOpen) {
            const k = e.key.toLowerCase();
            if (k === 'y') { e.preventDefault(); e.stopImmediatePropagation(); submitMasterJobWorkExpress(''); return; }
            if (k === 'p') { e.preventDefault(); e.stopImmediatePropagation(); submitMasterJobWorkExpress('challan'); return; }
            if (k === 'l' && isOutstationOutActive()) { e.preventDefault(); e.stopImmediatePropagation(); submitMasterJobWorkExpress('slip'); return; }
            if (k === 'b' && isOutstationOutActive()) { e.preventDefault(); e.stopImmediatePropagation(); submitMasterJobWorkExpress('both'); return; }
            if (k === 'n' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); window.__jwCancelAccept(); return; }
            if (e.key === 'Enter' && document.activeElement?.id === 'jw-exp-accept-yes') {
                e.preventDefault(); e.stopImmediatePropagation(); submitMasterJobWorkExpress(''); return;
            }
        }

        if (e.key === 'Tab') {
            const list = getOrderedInputs();
            if (!list.length) return;
            e.preventDefault(); e.stopImmediatePropagation();
            const cur = list.indexOf(document.activeElement);
            const nxt = e.shiftKey ? (cur - 1 + list.length) % list.length : (cur + 1) % list.length;
            list[nxt]?.focus();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault(); e.stopImmediatePropagation();
            if (acceptOpen) {
                window.__jwCancelAccept();
            } else if (document.activeElement?.id === 'jw-exp-stage-input') {
                selectedMaker = null;
                selectedBatchKey = null;
                document.getElementById('jw-exp-stage-input').value = '';
                focusFirstField('jw-exp-maker-input');
            } else {
                closeJobWorkExpressModal();
            }
            return;
        }

        const groups = getWorkGroups();
        if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) {
            e.preventDefault(); e.stopImmediatePropagation();
            const idx = parseInt(e.key.slice(1), 10) - 1;
            if (groups[idx]) switchJobWorkCategory(groups[idx].key, true);
            else if (e.key === 'F4') switchJobWorkCategory('dukan', true);
            return;
        }
        if (e.key === 'F5') { e.preventDefault(); e.stopImmediatePropagation(); toggleMovementType(true); return; }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); window.askSaveMasterJobWorkExpress(); return; }
        if (e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); e.stopImmediatePropagation(); printLastSavedJobWorkChallan(); return; }
        if (e.altKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); e.stopImmediatePropagation(); printLastSavedJobWorkPackingSlip(); }
    };

    window.closeJobWorkExpressModal = () => {
        window.removeEventListener('keydown', handleJobWorkExpressGlobalKeydown, true);
        document.getElementById('master-jobwork-express-modal')?.remove();
        expressBatchItems = [];
    };

    const confirmClearBatchIfNeeded = (lbl) => {
        if (!expressBatchItems.length) return true;
        const ok = confirm(`Batch list me ${expressBatchItems.length} item hain. ${lbl} badalne par list clear hogi. Aage badhein?`);
        if (ok) { expressBatchItems = []; renderExpressBatchGrid(); }
        return ok;
    };

    window.switchJobWorkCategory = (cat, advanceFocus = false) => {
        if (cat !== activeCategory) {
            if (!confirmClearBatchIfNeeded('Process')) return false;
            activeCategory = cat;
            movementType = 'gayi';
            expMeta = { jwNo: '', transport: '', lrNo: '', designNote: '' };
            resetCurrentBatchPickerFields();
            updateCategoryUI();
            populateExpressWorkers();
            updateMovementUI();
            renderExpressBatchGrid();
        }
        if (advanceFocus) {
            focusFirstField(activeCategory === 'dukan' ? 'jw-exp-worker-input' : 'jw-exp-movement-input');
        }
        return true;
    };

    window.toggleMovementType = (advanceFocus = false) => {
        if (activeCategory === 'dukan') return;
        if (!confirmClearBatchIfNeeded('Len-Den')) return;
        movementType = (movementType === 'gayi') ? 'aayi' : 'gayi';
        resetCurrentBatchPickerFields();
        updateMovementUI();
        renderExpressBatchGrid();
        if (advanceFocus) focusFirstField('jw-exp-worker-input');
    };

    const updateCategoryUI = () => {
        document.querySelectorAll('#master-jobwork-express-modal [id^="jw-exp-cat-"]').forEach((b) => {
            if (b.tagName === 'BUTTON') b.classList.toggle('active', b.id === `jw-exp-cat-${activeCategory}`);
        });
        const catInp = document.getElementById('jw-exp-cat-input');
        if (catInp) catInp.value = grpLabel(activeCategory);

        const lblW = document.getElementById('jw-exp-lbl-worker');
        if (lblW) lblW.textContent = activeCategory === 'dukan' ? 'Remark / Godam :' : `${grpLabel(activeCategory)} Worker :`;
    };

    const updateMovementUI = () => {
        const movRow = document.getElementById('jw-exp-movement-row');
        const movInp = document.getElementById('jw-exp-movement-input');
        const destRow = document.getElementById('jw-exp-dest-row');
        const destSel = document.getElementById('jw-exp-dest-select');
        const thDest = document.getElementById('jw-exp-th-dest');
        const outstBox = document.getElementById('jw-exp-outstation-box');
        const slipBtn = document.getElementById('jw-exp-last-slip-btn');

        if (movRow) movRow.style.display = activeCategory === 'dukan' ? 'none' : 'grid';
        if (movInp) movInp.value = movementType === 'gayi' ? `${grpLabel(activeCategory)} Out (Bhejein)` : `${grpLabel(activeCategory)} In (Wapas Lein)`;

        const isOutst = isOutstationOutActive();
        if (outstBox) {
            outstBox.style.display = isOutst ? 'block' : 'none';
            if (isOutst) {
                const firm = getFirmProfile();
                const fEl = document.getElementById('jw-exp-firm');
                const jEl = document.getElementById('jw-exp-jwno');
                const tEl = document.getElementById('jw-exp-trans');
                const lEl = document.getElementById('jw-exp-lr');
                const nEl = document.getElementById('jw-exp-design');
                if (fEl) fEl.value = `${firm.name}${firm.gst ? ` (GST: ${firm.gst})` : ''}`;
                if (!expMeta.jwNo) expMeta.jwNo = getNextChallanNo();
                if (jEl) jEl.value = expMeta.jwNo;
                if (tEl) tEl.value = expMeta.transport;
                if (lEl) lEl.value = expMeta.lrNo;
                if (nEl) nEl.value = expMeta.designNote;
            }
        }
        if (slipBtn) slipBtn.style.display = (isOutst || lastSavedExpressBatch?.isOutstation) ? 'inline-block' : 'none';

        const isIn = (activeCategory !== 'dukan' && movementType === 'aayi');
        if (destRow) destRow.style.display = isIn ? 'grid' : 'none';
        if (thDest) thDest.style.display = isIn ? 'table-cell' : 'none';

        if (destSel && isIn) {
            destSel.innerHTML = `
                <option value="godam" selected>Godam (${esc(grpLabel(activeCategory))} Complete)</option>
                <option value="lott">Lott / Damage</option>
            `;
        }
    };

    const populateExpressWorkers = () => {
        const wHid = document.getElementById('jw-exp-worker');
        const wInp = document.getElementById('jw-exp-worker-input');
        if (!wHid) return;

        if (activeCategory === 'dukan') {
            wHid.value = 'Godam Finished';
            if (wInp) wInp.value = 'Godam Finished';
            return;
        }

        const list = getWorkerPickerList('');
        if (!list.length) {
            wHid.value = '';
            if (wInp) wInp.value = '';
        } else {
            wHid.value = list[0].id;
            if (wInp) wInp.value = list[0].label;
        }
    };

    window.addExpressBatchRow = () => {
        const batch = getActiveSourceBatches().find((b) => b.key === selectedBatchKey);
        if (!batch) {
            alert('Pehle Kariger aur Stage Batch chunein!');
            focusFirstField('jw-exp-maker-input');
            return;
        }

        const avail = batch.pcs - getUsedBatchQty(batch.key);
        const qty = safeInt(document.getElementById('jw-exp-qty-input')?.value);
        if (qty <= 0 || qty > avail) {
            alert(`Sahi Pcs daalein (Max ${avail} Pcs available)!`);
            focusFirstField('jw-exp-qty-input');
            return;
        }

        const isIn = (activeCategory !== 'dukan' && movementType === 'aayi');
        const dest = isIn ? (document.getElementById('jw-exp-dest-select')?.value || 'godam') : 'out';

        expressBatchItems.push({
            batchKey: batch.key,
            maker: batch.maker,
            saree: batch.saree,
            karkhanaId: batch.karkhanaId,
            doneStages: [...batch.doneStages],
            bucket: batch.bucket,
            dest,
            qty
        });

        resetCurrentBatchPickerFields();
        jwPickerActiveIdx = -1;

        renderExpressBatchGrid();
        focusFirstField('jw-exp-maker-input');
    };

    window.removeExpressBatchItem = (idx) => {
        expressBatchItems.splice(idx, 1);
        jwPickerActiveIdx = expressBatchItems.length ? -1 : 0;
        renderExpressBatchGrid();
    };

    const renderExpressBatchGrid = () => {
        const tbody = document.getElementById('jw-exp-table-body');
        const totEl = document.getElementById('jw-exp-live-batch-total');
        const cntEl = document.getElementById('jw-exp-batch-count-badge');
        if (!tbody) return;

        const isIn = (activeCategory !== 'dukan' && movementType === 'aayi');
        if (!expressBatchItems.length) {
            tbody.innerHTML = `<tr><td colspan="${isIn ? 6 : 5}" style="text-align:center; padding:14px; color:#6b7280;">Gatthi khali hai.</td></tr>`;
            if (totEl) totEl.textContent = '0 Pcs';
            if (cntEl) cntEl.textContent = '0 Items';
            return;
        }

        let tot = 0;
        tbody.innerHTML = expressBatchItems.map((it, i) => {
            tot += it.qty;
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${esc(it.maker)}</strong></td>
                <td>${esc(it.saree)} <small style="color:#92400e;">[${esc(formatTrail(it.doneStages, it.bucket))}]</small></td>
                ${isIn ? `<td>${it.dest === 'finished' ? 'Fin' : (it.dest === 'lott' ? 'Lott' : 'Gdm')}</td>` : ''}
                <td style="text-align:right; font-weight:800;">${it.qty} Pcs</td>
                <td style="text-align:center;"><button type="button" tabindex="-1" onclick="removeExpressBatchItem(${i})" class="jw-pill-btn" style="padding:1px 6px;">&times;</button></td>
            </tr>`;
        }).join('');

        if (totEl) totEl.textContent = `${tot} Pcs`;
        if (cntEl) cntEl.textContent = `${expressBatchItems.length} Items`;
    };

    window.submitMasterJobWorkExpress = (printMode = '') => {
        if (isSubmitting) return;
        showJwAcceptPrompt(false);

        const resolvedPrint = (printMode === true) ? 'challan' : (printMode || '');

        if (!expressBatchItems.length) {
            alert('Batch me kam se kam 1 Saree jodein!');
            focusFirstField('jw-exp-maker-input');
            return;
        }

        const isDukan = (activeCategory === 'dukan');
        const workerId = document.getElementById('jw-exp-worker')?.value;
        const workerNameInput = document.getElementById('jw-exp-worker-input')?.value || '';
        const dDate = toIsoDate(document.getElementById('jw-exp-date')?.value) || getToday();

        if (!isDukan && !workerId) {
            alert('Kripya list me se Worker chunein!');
            focusFirstField('jw-exp-worker-input');
            return;
        }

        syncExpMetaFromDom();
        const isOutstOut = isOutstationOutActive();

        isSubmitting = true;
        try {
            const txnId = genId(isDukan ? 'dukan' : 'jwt');
            const now = Date.now();
            const sH = safeArr(getFromStore('saree_history')).slice();

            if (isDukan) {
                const partyNote = workerNameInput.trim() || 'Godam Finished';
                const dukanHist = safeArr(getFromStore('dukan_transfer_history')).slice();

                expressBatchItems.forEach((it, idx) => {
                    const refKey = `${txnId}_${idx}`;
                    const trTxt = formatTrail(it.doneStages, 'unfinished');

                    sH.push({
                        id: `sh_fo_out_${refKey}`,
                        refId: refKey,
                        date: dDate,
                        sareeName: it.saree,
                        karigerName: it.maker,
                        kariger: it.maker,
                        partyName: partyNote,
                        targetWorker: partyNote,
                        karkhanaId: it.karkhanaId,
                        type: legacyTypeFromTrail(it.doneStages, 'unfinished'),
                        typeLabel: `✅ Final Out ➔ Finished [${trTxt}]`,
                        aai: 0,
                        gai: it.qty,
                        isOut: true,
                        doneStages: [...it.doneStages],
                        stageBucket: 'unfinished',
                        note: partyNote,
                        timestamp: now + (idx * 2)
                    });

                    sH.push({
                        id: `sh_fo_fin_${refKey}`,
                        refId: refKey,
                        date: dDate,
                        sareeName: it.saree,
                        karigerName: it.maker,
                        kariger: it.maker,
                        partyName: partyNote,
                        targetWorker: partyNote,
                        karkhanaId: it.karkhanaId,
                        type: 'finished',
                        typeLabel: `🟣 Finished Stock (Final Out) [${trTxt}]`,
                        aai: it.qty,
                        gai: 0,
                        isOut: false,
                        doneStages: [...it.doneStages],
                        stageBucket: 'finished',
                        note: partyNote,
                        timestamp: now + (idx * 2) + 1
                    });

                    dukanHist.unshift({
                        id: refKey,
                        date: dDate,
                        sareeName: it.saree,
                        karigerName: it.maker,
                        pcs: it.qty,
                        note: `${partyNote} [${trTxt}]`,
                        karkhanaId: it.karkhanaId,
                        doneStages: [...it.doneStages],
                        stageBucket: 'finished',
                        timestamp: now + (idx * 2)
                    });
                });

                setToStore('saree_history', sH);
                setToStore('dukan_transfer_history', dukanHist);

                lastSavedExpressBatch = {
                    isOutstation: false,
                    title: 'FINAL OUT (FINISHED STOCK)',
                    party: partyNote,
                    date: dDate,
                    items: expressBatchItems.map((x) => ({ maker: x.maker, saree: x.saree, trail: formatTrail(x.doneStages, 'unfinished'), qty: x.qty }))
                };
                if (typeof window.renderDukanTransferTable === 'function') { try { window.renderDukanTransferTable(); } catch (_) {} }
            } else {
                const worker = safeArr(getFromStore('jobwork_workers')).find((w) => String(w.id) === String(workerId));
                const wName = worker ? worker.name : workerNameInput;
                const gLabel = grpLabel(activeCategory);
                const targetLabel = `${wName} (${gLabel})`;
                const isGayi = (movementType === 'gayi');

                const jwNo = isOutstOut ? (expMeta.jwNo || getNextChallanNo()).trim() : '';
                const transport = isOutstOut ? (expMeta.transport || '').trim() : '';
                const lrNo = isOutstOut ? (expMeta.lrNo || '').trim() : '';
                const designNote = isOutstOut ? (expMeta.designNote || '').trim() : '';

                let sheets = safeArr(getFromStore(`jobwork_sheets_${workerId}`)).slice();
                if (!sheets.length) {
                    sheets.push({ id: `jw_sh_${Date.now()}`, title: `Month 1 (${dDate.slice(0, 7)})`, closingPendingSaree: 0, closingBakiAmt: 0, rows: [] });
                }
                const lastSh = { ...sheets[sheets.length - 1], rows: safeArr(sheets[sheets.length - 1].rows).slice() };
                sheets[sheets.length - 1] = lastSh;

                let totQty = 0, totDmg = 0;
                const shItems = [];

                expressBatchItems.forEach((it, idx) => {
                    if (isGayi) {
                        totQty += it.qty;
                        sH.push({
                            id: `sh_jw_out_${txnId}_${idx}`,
                            refId: txnId,
                            date: dDate,
                            sareeName: it.saree,
                            karigerName: it.maker,
                            kariger: it.maker,
                            partyName: targetLabel,
                            targetWorker: targetLabel,
                            karkhanaId: it.karkhanaId,
                            type: legacyTypeFromTrail(it.doneStages, 'unfinished'),
                            typeLabel: `📤 ${targetLabel} Out [${formatTrail(it.doneStages, 'unfinished')}]`,
                            aai: 0,
                            gai: it.qty,
                            isOut: true,
                            doneStages: [...it.doneStages],
                            stageBucket: 'unfinished',
                            workerId,
                            note: jwNo ? `${jwNo} (${gLabel} Out)` : `${gLabel} Out`,
                            timestamp: now + idx
                        });
                        shItems.push({
                            id: `it_${txnId}_${idx}`,
                            karigar: it.maker,
                            saree: it.saree,
                            karkhanaId: it.karkhanaId,
                            doneStages: [...it.doneStages],
                            bucket: 'unfinished',
                            qty: it.qty
                        });
                    } else {
                        const nextTrail = [...it.doneStages];
                        if (activeCategory && !nextTrail.includes(activeCategory)) nextTrail.push(activeCategory);
                        const bucket = it.dest === 'finished' ? 'finished' : (it.dest === 'lott' ? 'lott' : 'unfinished');
                        const isDmg = (bucket === 'lott');
                        if (isDmg) totDmg += it.qty; else totQty += it.qty;

                        const icon = bucket === 'finished' ? '✨' : (isDmg ? '⚠️' : '✅');
                        sH.push({
                            id: `sh_jw_in_${txnId}_${idx}`,
                            refId: txnId,
                            date: dDate,
                            sareeName: it.saree,
                            karigerName: it.maker,
                            kariger: it.maker,
                            partyName: targetLabel,
                            targetWorker: targetLabel,
                            karkhanaId: it.karkhanaId,
                            type: legacyTypeFromTrail(nextTrail, bucket),
                            typeLabel: `${icon} ${targetLabel} In [${formatTrail(nextTrail, bucket)}]`,
                            aai: it.qty,
                            gai: 0,
                            isOut: false,
                            doneStages: nextTrail,
                            stageBucket: bucket,
                            workerId,
                            note: `${gLabel} In`,
                            timestamp: now + idx
                        });
                        shItems.push({
                            id: `it_${txnId}_${idx}`,
                            karigar: it.maker,
                            saree: it.saree,
                            karkhanaId: it.karkhanaId,
                            prevStages: [...it.doneStages],
                            doneStages: nextTrail,
                            destBucket: bucket,
                            isDamage: isDmg,
                            qty: it.qty
                        });
                    }
                });

                const rowObj = {
                    id: txnId,
                    date: dDate,
                    gayiQty: isGayi ? totQty : 0,
                    gayiItems: isGayi ? shItems : [],
                    stockSource: 'fresh',
                    aayiQty: isGayi ? 0 : totQty,
                    aayiItems: isGayi ? [] : shItems,
                    damagePcs: isGayi ? 0 : totDmg,
                    damageAmt: 0,
                    isTrailV2: true
                };
                if (isOutstOut) {
                    rowObj.isOutstation = true;
                    rowObj.jwNo = jwNo;
                    rowObj.transport = transport;
                    rowObj.lrNo = lrNo;
                    rowObj.designNote = designNote;
                    if (jwNo) bumpChallanSeq(jwNo);
                }

                lastSh.rows.push(rowObj);
                setToStore('saree_history', sH);
                setToStore(`jobwork_sheets_${workerId}`, sheets);

                if (isOutstOut) {
                    const sareeMap = new Map();
                    shItems.forEach((it) => {
                        const s = it.saree || 'GENERAL SAREE';
                        sareeMap.set(s, (sareeMap.get(s) || 0) + safeInt(it.qty));
                    });
                    lastSavedExpressBatch = {
                        isOutstation: true,
                        title: 'JOB WORK CHALLAN',
                        groupLabel: gLabel,
                        firm: getFirmProfile(),
                        worker: {
                            name: wName,
                            address: worker?.address || '',
                            mobile: worker?.mobile || '',
                            gst: worker?.gst || ''
                        },
                        jwNo: jwNo || getNextChallanNo(),
                        date: dDate,
                        transport: transport || '-',
                        lrNo: lrNo || '-',
                        designNote: designNote || '-',
                        sareeRows: Array.from(sareeMap.entries()).map(([saree, pcs]) => ({ saree, pcs })),
                        totalPcs: totQty,
                        items: shItems.map((x) => ({
                            maker: x.karigar || '-',
                            saree: x.saree || 'Saree',
                            trail: formatTrail(x.doneStages || [], 'unfinished'),
                            qty: safeInt(x.qty)
                        }))
                    };
                } else {
                    lastSavedExpressBatch = {
                        isOutstation: false,
                        title: `${gLabel.toUpperCase()} ${isGayi ? 'OUT (GAYI)' : 'IN (AAYI)'}`,
                        party: targetLabel,
                        date: dDate,
                        items: expressBatchItems.map((x) => ({
                            maker: x.maker,
                            saree: x.saree,
                            trail: isGayi
                                ? formatTrail(x.doneStages, 'unfinished')
                                : formatTrail([...x.doneStages, ...(x.doneStages.includes(activeCategory) ? [] : [activeCategory])], x.dest === 'finished' ? 'finished' : (x.dest === 'lott' ? 'lott' : 'unfinished')),
                            qty: x.qty
                        }))
                    };
                }
            }

            if (window._JWT && window._JWT.s) window._JWT.s.cachedSnapshot = null;
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(isDukan ? null : workerId);
            if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
            if (typeof window.triggerActiveSectionRefresh === 'function') window.triggerActiveSectionRefresh();

            if (resolvedPrint === 'both' && lastSavedExpressBatch?.isOutstation) {
                printOutstationBoth(lastSavedExpressBatch);
            } else if (resolvedPrint === 'slip' && lastSavedExpressBatch?.isOutstation) {
                printOutstationPackingSlip(lastSavedExpressBatch);
            } else if (resolvedPrint === 'challan' || resolvedPrint === 'both') {
                printLastSavedJobWorkChallan();
            }

            expressBatchItems = [];
            resetCurrentBatchPickerFields();
            jwPickerActiveIdx = 0;
            expMeta = {
                jwNo: isOutstOut ? getNextChallanNo() : '',
                transport: '',
                lrNo: '',
                designNote: ''
            };
            updateMovementUI();
            renderExpressBatchGrid();

            const statusEl = document.getElementById('jw-exp-status-msg');
            if (statusEl) statusEl.textContent = isDukan ? '✅ Final Out save hua — Finished Stock me jud gaya!' : '✅ Batch safalta-poorvak save ho gaya!';
            focusFirstField('jw-exp-maker-input');
        } finally {
            isSubmitting = false;
        }
    };

    const openPrintWin = (title, css, bodyHtml, w = 520, h = 680) => {
        const pw = window.open('', '', `width=${w},height=${h}`);
        if (!pw) return alert('Popup block hai! Kripya browser me allow karein.');
        pw.document.write(`<html><head><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}<script>window.onload=function(){window.focus();window.print();setTimeout(()=>window.close(),600);};<\/script></body></html>`);
        pw.document.close();
    };

    const buildOutstationChallanParts = (c) => {
        const rowsHtml = c.sareeRows.map((r, i) => `
            <tr>
                <td style="width:42px;">${i + 1}</td>
                <td><strong>${esc(r.saree)}</strong></td>
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
                    <div><h2>JOB WORK CHALLAN</h2><small>${esc(c.groupLabel)} Dispatch</small></div>
                    <div style="text-align:right; font-size:11.5px; line-height:1.45;">
                        <div><strong>JobWork No.:</strong> ${esc(c.jwNo)}</div>
                        <div><strong>Date:</strong> ${esc(formatDisplay(c.date))}</div>
                    </div>
                </div>
                <div class="pgrid">
                    <div class="pbox">
                        <small>From (Sender)</small>
                        <strong>${esc(c.firm.name)}</strong><br>
                        ${c.firm.address ? `${esc(c.firm.address)}<br>` : ''}
                        ${c.firm.mobile ? `Mob: ${esc(c.firm.mobile)}<br>` : ''}
                        ${c.firm.gst ? `<strong>GSTIN:</strong> ${esc(c.firm.gst)}` : ''}
                    </div>
                    <div class="pbox">
                        <small>To (Job Worker)</small>
                        <strong>${esc(c.worker.name)}</strong><br>
                        ${c.worker.address ? `${esc(c.worker.address)}<br>` : ''}
                        ${c.worker.mobile ? `Mob: ${esc(c.worker.mobile)}<br>` : ''}
                        ${c.worker.gst ? `<strong>GSTIN:</strong> ${esc(c.worker.gst)}` : ''}
                    </div>
                </div>
                <div class="tr">
                    <span><strong>Transport:</strong> ${esc(c.transport)}</span>
                    <span><strong>L.R. / Bale:</strong> ${esc(c.lrNo)}</span>
                </div>
                <table class="ch-tbl">
                    <thead><tr><th>Sr.</th><th>Saree Name / Quality</th><th style="text-align:right; width:85px;">Pcs</th></tr></thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="tot"><td colspan="2" style="text-align:right;">TOTAL SAREE :</td><td style="text-align:right;">${c.totalPcs} Pcs</td></tr>
                    </tbody>
                </table>
                <div class="dbox"><strong>Design / Work Detail:</strong><br>${esc(c.designNote)}</div>
                <div class="sign"><span>Checked By: ___________</span><span>Receiver Sign: ___________</span></div>
            </div>
        `;
        return { css, html };
    };

    const buildOutstationSlipParts = (c) => {
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
                <div class="shdr"><h3>PACKING SLIP</h3><div>${esc(c.groupLabel.toUpperCase())} PARCEL</div></div>
                <div class="tobox">
                    <div style="font-size:10px; font-weight:bold;">TO (DELIVERY):</div>
                    <strong style="font-size:14px;">${esc(c.worker.name)}</strong><br>
                    ${c.worker.address ? `${esc(c.worker.address)}<br>` : ''}
                    ${c.worker.mobile ? `Mob: ${esc(c.worker.mobile)}<br>` : ''}
                    ${c.worker.gst ? `GSTIN: ${esc(c.worker.gst)}` : ''}
                </div>
                <div class="frombox">
                    <strong>FROM:</strong> ${esc(c.firm.name)}${c.firm.address ? `, ${esc(c.firm.address)}` : ''}<br>
                    ${c.firm.mobile ? `Mob: ${esc(c.firm.mobile)}` : ''} ${c.firm.gst ? `| GST: ${esc(c.firm.gst)}` : ''}
                </div>
                <div class="info">
                    <div><strong>JobWork No.:</strong> ${esc(c.jwNo)}</div>
                    <div><strong>Date:</strong> ${esc(formatDisplay(c.date))}</div>
                    <div><strong>Transport:</strong> ${esc(c.transport)}</div>
                    <div><strong>L.R. / Bale:</strong> ${esc(c.lrNo)}</div>
                </div>
                <div class="stot">TOTAL: ${c.totalPcs} PCS</div>
                <div class="sdbox">DESIGN: ${esc(c.designNote)}</div>
            </div>
        `;
        return { css, html };
    };

    const printOutstationChallan = (c) => {
        if (!c || !c.sareeRows || !c.sareeRows.length) return alert('Print karne ke liye data nahi hai.');
        const p = buildOutstationChallanParts(c);
        openPrintWin(`Challan-${c.jwNo}`, `@page { size: A5 portrait; margin: 7mm; } body { margin: 0; padding: 6px; } ${p.css}`, p.html, 680, 760);
    };

    const printOutstationPackingSlip = (c) => {
        if (!c) return alert('Packing slip ke liye data nahi hai.');
        const p = buildOutstationSlipParts(c);
        openPrintWin(`PackingSlip-${c.jwNo}`, `@page { size: A6 portrait; margin: 4mm; } body { margin: 0; padding: 4mm; } ${p.css}`, p.html, 420, 560);
    };

    const printOutstationBoth = (c) => {
        if (!c || !c.sareeRows || !c.sareeRows.length) return alert('Print karne ke liye data nahi hai.');
        const ch = buildOutstationChallanParts(c);
        const sl = buildOutstationSlipParts(c);
        const css = `
            @page challanPage { size: A5 portrait; margin: 7mm; }
            @page slipPage { size: A6 portrait; margin: 4mm; }
            body { margin: 0; padding: 6px; }
            .pg-challan { page: challanPage; page-break-after: always; }
            .pg-slip { page: slipPage; padding-top: 4mm; }
            ${ch.css}
            ${sl.css}
        `;
        openPrintWin(`Challan+Slip-${c.jwNo}`, css, `<div class="pg-challan">${ch.html}</div><div class="pg-slip">${sl.html}</div>`, 680, 760);
    };

    window.printLastSavedJobWorkPackingSlip = () => {
        if (!lastSavedExpressBatch || !lastSavedExpressBatch.isOutstation) {
            return alert('Pehle Outstation Challan save karein!');
        }
        printOutstationPackingSlip(lastSavedExpressBatch);
    };

    window.printLastSavedJobWorkChallan = () => {
        if (!lastSavedExpressBatch || !lastSavedExpressBatch.items.length) {
            return alert('Print karne ke liye koi recent batch entry nahi mili!');
        }
        if (lastSavedExpressBatch.isOutstation) {
            printOutstationChallan(lastSavedExpressBatch);
            return;
        }

        const b = lastSavedExpressBatch;
        let tot = 0;
        const rowsHtml = b.items.map((it, i) => {
            tot += safeInt(it.qty);
            return `<tr style="border-bottom:1px dashed #ccc;">
                <td style="padding:3px 2px;">${i + 1}</td>
                <td style="padding:3px 2px; font-weight:bold;">${esc(it.maker)}</td>
                <td style="padding:3px 2px;">${esc(it.saree)}<br><small>${esc(it.trail)}</small></td>
                <td style="padding:3px 2px; text-align:right; font-weight:bold;">${it.qty}</td>
            </tr>`;
        }).join('');

        openPrintWin('JobWork Challan - A6', `
            @page { size: A6 portrait; margin: 4mm; }
            body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
            .box { border: 1.5px dashed #000; padding: 8px; max-width: 92mm; margin: 0 auto; }
            .hdr { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 6px 0; }
            th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
            .tot { background: #eee; border: 1px solid #000; text-align: center; font-size: 13px; font-weight: 900; padding: 5px; margin: 8px 0; }
            .sign { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; }
        `, `
            <div class="box">
                <div class="hdr"><h3 style="margin:0;">SIMPLICITY ERP</h3><div>${esc(b.title)}</div></div>
                <div><strong>Party / Worker:</strong> ${esc(b.party)}</div>
                <div><strong>Tarikh:</strong> ${esc(formatDisplay(b.date))}</div>
                <table><thead><tr><th>#</th><th>KARIGER</th><th>SAREE &amp; TRAIL</th><th style="text-align:right;">PCS</th></tr></thead><tbody>${rowsHtml}</tbody></table>
                <div class="tot">KUL SAREE: ${tot} Pcs</div>
                <div class="sign"><div>हस्ताक्षर मुंशी<br><br>_______</div><div>हस्ताक्षर पाने वाला<br><br>_______</div></div>
            </div>
        `, 420, 560);
    };

    window.JobWorkExpressEngine = {
        openJobWorkExpressModal,
        closeJobWorkExpressModal,
        switchJobWorkCategory,
        toggleMovementType,
        addExpressBatchRow,
        removeExpressBatchItem,
        askSaveMasterJobWorkExpress,
        submitMasterJobWorkExpress,
        printLastSavedJobWorkChallan,
        printLastSavedJobWorkPackingSlip
    };
})();
