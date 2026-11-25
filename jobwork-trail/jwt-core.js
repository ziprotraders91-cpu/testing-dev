/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 1/6: CORE, STATE & HELPERS)
   File: jobwork-trail/jwt-core.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    J.GROUPS_STORE_KEY = 'jobwork_groups';
    J.FIRM_STORE_KEY = 'jobwork_firm_profile';
    J.FIRMS_LIST_KEY = 'dukan_firms';
    J.SEQ_STORE_KEY = 'jw_challan_seq';

    J.DEFAULT_GROUPS = [
        { key: 'cutting', label: 'Cutting', outstation: false },
        { key: 'embroidery', label: 'Embroidery', outstation: false },
        { key: 'calender', label: 'Calender', outstation: false }
    ];

    /* ========================================================================
       1. MODULE STATE & CURSOR MEMORY
    ======================================================================== */
    J.s = {
        curView: 'gateway',
        menuIdx: 0,
        viewCursor: Object.create(null),
        entryRoot: 'gateway',

        activeGroupKey: 'cutting',
        activeWorkerId: null,
        vchDir: 'out',
        vchPickStep: 'kariger',
        vchSelectedMaker: null,
        vchSelectedBatchKey: null,
        vchRightItems: [],
        vchRightIdx: 0,
        vchBatch: [],
        vchAcceptOpen: false,
        vchMeta: { date: '', firmId: '', firmName: '', jwNo: '', transport: '', lrNo: '', designNote: '' },
        lastChallanObj: null,

        editWorkerRowInfo: null,
        regPrintRowInfo: null,
        regDateFrom: '',
        regDateTo: '',
        ownerWorkerId: null,
        ownerGodamSummaryKey: null,

        stockBucketFilter: 'all',
        stockDetailKey: null,
        stockInwardOpen: false,

        createSideIdx: 0,
        selectedCreateGroupKey: 'cutting',
        alterEditWorkerId: null,
        alterEditGroupKey: null,
        crAcceptOpen: false,

        foPickStep: 'kariger',
        foSelectedMaker: null,
        foSelectedBatchKey: null,
        foRightItems: [],
        foRightIdx: 0,
        foBatch: [],
        foAcceptOpen: false,
        editFoId: null,
        foRegDateFrom: '',
        foRegDateTo: '',

        billsListMode: 'pending',
        billSelectedWorkerId: null,
        billWorkerItems: [],
        billWorkerIdx: 0,
        activeBillId: null,
        billAcceptOpen: false,
        billPayAcceptOpen: false,

        isSaving: false,
        isSavingVch: false,
        isSavingFo: false,
        isSavingBill: false,
        isSavingInward: false,
        lastSaveTime: 0,
        navGuardTs: 0,
        cachedSnapshot: null
    };

    J.armNavGuard = () => { J.s.navGuardTs = performance.now(); };
    J.isNavGuarded = () => (performance.now() - J.s.navGuardTs) < 130;

    /* ========================================================================
       2. SAFE HELPERS & STORAGE
    ======================================================================== */
    J.esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    J.safeArr = (v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof window.safeArray === 'function') return window.safeArray(v).filter(Boolean);
        return [];
    };

    J.safeInt = (v, fb = 0) => {
        const n = parseInt(String(v == null ? '' : v).replace(/,/g, '').trim(), 10);
        return Number.isFinite(n) ? n : fb;
    };

    J.safeNum = (v, fb = 0) => {
        const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : fb;
    };

    J.normText = (s, fb = '') => String(s == null ? fb : s).trim().toUpperCase() || fb;

    J.toIsoDate = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const p = s.split(/[-/]/);
        if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
            return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        return s;
    };

    J.getTodayIso = () => {
        const raw = (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
        const iso = J.toIsoDate(raw);
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date().toISOString().split('T')[0];
    };

    J.fmtDate = (d) => {
        if (!d) return '-';
        if (typeof window.formatDateDisplay === 'function') return window.formatDateDisplay(d);
        return d;
    };

    J.genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    J.getStoreSafe = (key) => {
        try {
            if (typeof window.getStore === 'function') return window.getStore(key);
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    };

    J.setStoreSafe = (key, val) => {
        if (typeof window.setStore === 'function') window.setStore(key, val);
        else localStorage.setItem(key, JSON.stringify(val));
    };

    J.getActiveGodam = () => {
        try {
            if (typeof window.getActiveKarkhanaId === 'function') {
                return String(window.getActiveKarkhanaId() || 'all').trim() || 'all';
            }
        } catch (_) {}
        return 'all';
    };

    J.normGodam = (kid) => {
        const c = String(kid || '').trim();
        if (!c || c === 'k_main') return 'k_main';
        if (c === 'all') return 'all';
        return c;
    };

    J.getGodamLabel = (kid) => {
        const k = J.normGodam(kid);
        if (k === 'all') return 'Sabhi Karkhane';
        if (typeof window.getKarkhanaNameById === 'function') return window.getKarkhanaNameById(k);
        return k === 'k_main' ? 'Main Godown' : k;
    };

    J.getCleanMobile = (rawMob) => {
        let m = String(rawMob || '').replace(/[^0-9]/g, '');
        if (m.length === 11 && m.startsWith('0')) m = m.slice(1);
        if (m.length === 10) m = '91' + m;
        return m;
    };

    J.toast = (msg, isErr = false) => {
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

    J.safeSave = (lockKey, fn) => {
        if (J.s[lockKey]) return J.toast('⏳ Save chal raha hai...', true);
        if (Date.now() - (J.s.lastSaveTime || 0) < 1000) return J.toast('⏳ 1 second baad try karein', true);

        J.s[lockKey] = true;
        J.s.lastSaveTime = Date.now();

        try {
            return fn();
        } catch (error) {
            console.error(`[Save Failed - ${lockKey}]`, error);
            J.toast(`❌ Error: ${error.message}`, true);
        } finally {
            J.s[lockKey] = false;
        }
    };

    J.invalidateAllCaches = (workerId = null) => {
        J.s.cachedSnapshot = null;
        try {
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(workerId);
            if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
        } catch (_) {}
    };

    /* ========================================================================
       3. UNIFIED MULTI-FIRM (dukan_firms) & DYNAMIC WORK GROUPS
    ======================================================================== */
    J.getFirmsList = () => {
        const firms = J.safeArr(J.getStoreSafe(J.FIRMS_LIST_KEY)).filter((f) => f && f.name);
        if (firms.length) return firms;

        // Auto-migrate old single jobwork_firm_profile into dukan_firms if needed
        const legacy = J.getStoreSafe(J.FIRM_STORE_KEY);
        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && legacy.name) {
            const migrated = [{
                id: 'firm_main',
                name: String(legacy.name || 'INDIAN FABRICS').trim().toUpperCase(),
                address: String(legacy.address || '').trim(),
                mob: String(legacy.mobile || legacy.mob || '').trim(),
                gst: String(legacy.gst || '').trim().toUpperCase(),
                city: '',
                agent: '',
                email: '',
                isDefault: true
            }];
            J.setStoreSafe(J.FIRMS_LIST_KEY, migrated);
            return migrated;
        }
        return [];
    };

    J.getFirmProfile = (firmId = '', firmName = '') => {
        const firms = J.getFirmsList();
        let raw = null;
        if (firmId) raw = firms.find((f) => String(f.id) === String(firmId));
        if (!raw && firmName) raw = firms.find((f) => J.normText(f.name) === J.normText(firmName));
        if (!raw) raw = firms.find((f) => f.isDefault) || firms[0];

        if (raw && typeof raw === 'object') {
            const mobVal = String(raw.mobile || raw.mob || '').trim();
            const fullAddr = [raw.address, raw.city].filter(Boolean).join(', ');
            return {
                id: String(raw.id || ''),
                name: String(raw.name || 'INDIAN FABRICS').trim(),
                address: fullAddr,
                mobile: mobVal,
                mob: mobVal,
                gst: String(raw.gst || '').trim(),
                isDefault: Boolean(raw.isDefault)
            };
        }

        return { id: '', name: 'INDIAN FABRICS', address: '', mobile: '', mob: '', gst: '', isDefault: true };
    };

    J.getWorkGroups = () => {
        const stored = J.safeArr(J.getStoreSafe(J.GROUPS_STORE_KEY));
        const workers = J.safeArr(J.getStoreSafe('jobwork_workers'));
        const map = new Map();

        if (stored.length) {
            stored.forEach((g) => {
                if (!g || !g.key) return;
                const k = String(g.key).trim().toLowerCase();
                if (k) map.set(k, { key: k, label: String(g.label || k).trim(), outstation: Boolean(g.outstation) });
            });
        } else {
            J.DEFAULT_GROUPS.forEach((g) => map.set(g.key, { ...g }));
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

    J.getGroupObj = (key) => {
        const k = String(key || '').trim().toLowerCase();
        return J.getWorkGroups().find((g) => g.key === k) || { key: k, label: k ? k.charAt(0).toUpperCase() + k.slice(1) : 'JobWork', outstation: false };
    };

    J.grpLabel = (key) => J.getGroupObj(key).label;

    J.getNextChallanNo = () => {
        const storedSeq = J.safeInt(J.getStoreSafe(J.SEQ_STORE_KEY), 0);
        let maxSeq = storedSeq;
        J.safeArr(J.getStoreSafe('jobwork_workers')).forEach((w) => {
            J.safeArr(J.getStoreSafe(`jobwork_sheets_${w.id}`)).forEach((sh) => {
                J.safeArr(sh?.rows).forEach((r) => {
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

    J.bumpChallanSeq = (jwNoStr) => {
        const m = String(jwNoStr || '').match(/(\d+)$/);
        if (!m) return;
        const n = parseInt(m[1], 10);
        const cur = J.safeInt(J.getStoreSafe(J.SEQ_STORE_KEY), 0);
        if (n > cur) J.setStoreSafe(J.SEQ_STORE_KEY, n);
    };

    /* ========================================================================
       4. STAGE & TRAIL HELPERS
    ======================================================================== */
    J.inferBucketFromLegacyType = (t) => {
        const c = String(t || 'fresh').trim().toLowerCase();
        if (c === 'finished' || c === 'finish') return 'finished';
        if (c === 'lott' || c === 'lot' || c === 'damage') return 'lott';
        return 'unfinished';
    };

    J.inferStagesFromRow = (row) => {
        if (Array.isArray(row?.doneStages)) {
            return row.doneStages.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
        }
        const t = String(row?.type || 'fresh').trim().toLowerCase();
        if (t === 'cutting' || t === 'cut') return ['cutting'];
        if (t === 'embroidery' || t === 'emb') return ['embroidery'];
        if (t === 'finished' || t === 'finish' || t === 'calender') return ['calender'];
        return [];
    };

    J.legacyTypeFromTrail = (doneStages, bucket) => {
        if (bucket === 'finished') return 'finished';
        if (bucket === 'lott') return 'lott';
        const arr = Array.isArray(doneStages) ? doneStages : [];
        if (arr.includes('embroidery')) return 'embroidery';
        if (arr.includes('cutting')) return 'cutting';
        return 'fresh';
    };

    J.formatTrail = (doneStages, bucket = 'unfinished') => {
        const arr = Array.isArray(doneStages) ? doneStages : [];
        if (bucket === 'finished') return arr.length ? `Finished (${arr.map(J.grpLabel).join(' → ')})` : 'Finished (Calender)';
        if (bucket === 'lott') return arr.length ? `Lott (${arr.map(J.grpLabel).join(' → ')})` : 'Lott (Fresh)';
        if (!arr.length) return 'Fresh (Kora)';
        return arr.map(J.grpLabel).join(' → ');
    };
})();
