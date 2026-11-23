/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE OFFLINE-FIRST STORAGE & TALLY LOADER ENGINE
   File: core/storage.js • Developed by Farhan Jawed
   Architecture: L1-RAM / L2-Tiny-LS (<50KB) / L3-IndexedDB (GBs) / L4-Delta Cloud Queue
   Upgraded: Global Master Keys + Key-Identity Support + Safe User Wipe + Queue Isolation
============================================================================ */

(() => {
    'use strict';

    let APP_MEMORY_CACHE = Object.create(null);
    let idbInstance = null;
    let isRemoteUpdating = false;
    let isBackupPreviewMode = false;
    let PREVIEW_BACKUP_DATA = null;

    let resolveStoragePreload = null;
    const StoragePreloadPromise = new Promise((resolve) => {
        resolveStoragePreload = resolve;
    });

    const SYNC_DEBOUNCE_TIMERS = new Map();
    const DEBOUNCE_DELAY_MS = 300;
    let isSyncQueueFlushing = false;

    // Generic Row-Level Diff & Delta Buffers (Permanent for all Row-by-Row modules)
    const LAST_SYNCED_SNAPSHOTS = new Map(); // fullKey -> Map<rowId, jsonString>
    const PENDING_ROW_DELTAS = new Map();    // fullKey -> { upserts: Map<rowId, obj>, deletes: Set<rowId> }

    const GLOBAL_APP_KEYS = Object.freeze([
        'app_sessions_list',
        'app_active_session',
        'karkhana_list',
        'active_karkhana_id',
        'karkhana_transfers',
        'app_users',
        'info_ledger',
        'jobwork_groups',
        'dukan_firms',
        'dukan_parties',
        'dukan_designs'
    ]);

    const PROTECTED_AUTH_LS_KEYS = new Set([
        'app_current_user_id',
        'app_active_session_auth',
        'app_last_user_id',
        'app_global_billing_config'
    ]);

    const DB_CONFIG = Object.freeze({
        NAME: 'SimplicityERP_DB',
        VERSION: 2,
        STORE_APP: 'app_store',
        STORE_QUEUE: 'sync_queue'
    });

    // Sirf chhoti aur instant startup keys localStorage me rahengi (< 50 KB)
    // Baaki saara heavy data (karigers, sheets, stock, payments, dukan) sirf IndexedDB me rahega
    const isLightweightKey = (key) => {
        const k = String(key || '').toLowerCase();
        return (
            k.includes('session') ||
            k.includes('user_id') ||
            k.includes('tenant_id') ||
            k.includes('app_users') ||
            k.includes('karkhana_list') ||
            k.includes('active_karkhana') ||
            k.includes('billing_config') ||
            k.includes('portal_token') ||
            k.includes('account_uid')
        );
    };

    const isUserLoggedIn = () => {
        try {
            if (window.currentUserId && String(window.currentUserId).trim() && window.currentUserId !== 'app') {
                return true;
            }
            if (window.currentUserProfile && window.currentUserProfile.id) {
                return true;
            }
            if (localStorage.getItem('app_active_session_auth')) {
                return true;
            }
            const stored = localStorage.getItem('app_current_user_id') || localStorage.getItem('currentUserId');
            if (stored && String(stored).trim() && String(stored).trim() !== 'app') {
                return true;
            }
        } catch (_) {}
        return false;
    };

    /* ========================================================================
       ROW-SYNC SNAPSHOT & GENERIC DIFF HELPERS
    ======================================================================== */
    const isRowSyncKey = (fullKey) => {
        try {
            return typeof window.CloudEngine?.isRowSyncKey === 'function' && window.CloudEngine.isRowSyncKey(fullKey);
        } catch (_) {
            return false;
        }
    };

    const getRowIdentity = (item) => {
        if (!item || typeof item !== 'object') return null;
        if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') {
            return String(item.id).trim();
        }
        if (item.key !== undefined && item.key !== null && String(item.key).trim() !== '') {
            return String(item.key).trim();
        }
        return null;
    };

    const buildSnapshotMap = (arr) => {
        const map = new Map();
        if (!Array.isArray(arr)) return map;
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            const rid = getRowIdentity(item);
            if (!rid) continue;
            try {
                map.set(rid, JSON.stringify(item));
            } catch (_) {}
        }
        return map;
    };

    const updateRowSnapshot = (fullKey, arr) => {
        if (!fullKey || !Array.isArray(arr)) return;
        LAST_SYNCED_SNAPSHOTS.set(fullKey, buildSnapshotMap(arr));
    };

    const computeAndAdvanceRowDiff = (fullKey, nextArr) => {
        const prevSnap = LAST_SYNCED_SNAPSHOTS.get(fullKey) || new Map();
        const nextSnap = new Map();
        const upserts = [];
        const deletes = [];

        if (Array.isArray(nextArr)) {
            for (let i = 0; i < nextArr.length; i++) {
                const item = nextArr[i];
                const rid = getRowIdentity(item);
                if (!rid) continue;
                let str = '';
                try { str = JSON.stringify(item); } catch (_) { continue; }
                nextSnap.set(rid, str);

                const oldStr = prevSnap.get(rid);
                if (oldStr === undefined || oldStr !== str) {
                    upserts.push(item);
                }
            }
        }

        prevSnap.forEach((_, rid) => {
            if (!nextSnap.has(rid)) {
                deletes.push(rid);
            }
        });

        LAST_SYNCED_SNAPSHOTS.set(fullKey, nextSnap);
        return { upserts, deletes };
    };

    /* ========================================================================
       TALLY-STYLE COMPANY DATA LOADER UI (0% - 100%)
    ======================================================================== */
    const ERPLoader = (() => {
        let hideTimer = null;
        let failsafeTimer = null;
        let currentPct = 0;

        const injectStyles = () => {
            if (document.getElementById('erp-tally-loader-style')) return;
            const style = document.createElement('style');
            style.id = 'erp-tally-loader-style';
            style.textContent = `
                #erp-tally-loader {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    background: rgba(15, 23, 42, 0.78);
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    font-family: system-ui, -apple-system, sans-serif;
                    transition: opacity 0.25s ease;
                }
                .erp-loader-card {
                    width: 100%;
                    max-width: 420px;
                    background: #ffffff;
                    border-radius: 18px;
                    padding: 24px 22px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
                    border: 1px solid #e2e8f0;
                    text-align: center;
                }
                .erp-loader-brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #ecfdf5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                    padding: 5px 12px;
                    border-radius: 999px;
                    font-size: 11.5px;
                    font-weight: 800;
                    letter-spacing: 0.4px;
                    text-transform: uppercase;
                    margin-bottom: 12px;
                }
                .erp-loader-spinner {
                    width: 42px;
                    height: 42px;
                    margin: 4px auto 12px;
                    border: 4px solid #e2e8f0;
                    border-top-color: #059669;
                    border-radius: 50%;
                    animation: erpSpin 0.8s linear infinite;
                }
                @keyframes erpSpin {
                    to { transform: rotate(360deg); }
                }
                .erp-loader-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .erp-loader-meta {
                    margin: 5px 0 14px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                }
                .erp-loader-pct-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 6px;
                }
                .erp-loader-msg {
                    font-size: 13px;
                    font-weight: 700;
                    color: #1e293b;
                    text-align: left;
                }
                .erp-loader-pct {
                    font-size: 22px;
                    font-weight: 900;
                    color: #059669;
                    min-width: 56px;
                    text-align: right;
                }
                .erp-loader-track {
                    width: 100%;
                    height: 12px;
                    background: #e2e8f0;
                    border-radius: 999px;
                    overflow: hidden;
                    margin-bottom: 10px;
                }
                .erp-loader-bar {
                    height: 100%;
                    width: 0%;
                    background: linear-gradient(90deg, #059669, #10b981, #34d399);
                    border-radius: 999px;
                    transition: width 0.2s ease;
                }
                .erp-loader-sub {
                    font-size: 11.5px;
                    color: #64748b;
                    font-weight: 600;
                    min-height: 16px;
                }
                .erp-loader-foot {
                    margin-top: 14px;
                    padding-top: 10px;
                    border-top: 1px dashed #e2e8f0;
                    font-size: 11px;
                    color: #94a3b8;
                    font-weight: 600;
                }
            `;
            document.head.appendChild(style);
        };

        const ensureDOM = () => {
            if (!document.body) return null;
            injectStyles();
            let el = document.getElementById('erp-tally-loader');
            if (!el) {
                el = document.createElement('div');
                el.id = 'erp-tally-loader';
                el.innerHTML = `
                    <div class="erp-loader-card">
                        <div class="erp-loader-brand">📊 SIMPLICITY ERP</div>
                        <div class="erp-loader-spinner" id="erp-loader-spinner"></div>
                        <h3 class="erp-loader-title" id="erp-loader-title">Company Data Load Ho Raha Hai...</h3>
                        <div class="erp-loader-meta" id="erp-loader-meta">Taiyari ho rahi hai...</div>
                        <div class="erp-loader-pct-row">
                            <div class="erp-loader-msg" id="erp-loader-msg">Data load ho raha hai...</div>
                            <div class="erp-loader-pct" id="erp-loader-pct">0%</div>
                        </div>
                        <div class="erp-loader-track">
                            <div class="erp-loader-bar" id="erp-loader-bar"></div>
                        </div>
                        <div class="erp-loader-sub" id="erp-loader-sub">Kripya intezar karein...</div>
                        <div class="erp-loader-foot">🔒 Secure Local IndexedDB + Cloud Sync</div>
                    </div>
                `;
                document.body.appendChild(el);
            }
            return el;
        };

        const getSessionBadgeText = () => {
            try {
                const uid = getEffectiveUserId();
                let sess = '2026-2027';
                if (typeof window.getActiveFinancialSession === 'function') {
                    sess = window.getActiveFinancialSession();
                } else {
                    sess = APP_MEMORY_CACHE[`${uid}_app_active_session`] || localStorage.getItem(`${uid}_app_active_session`) || '2026-2027';
                }
                sess = String(sess).replace(/['"]+/g, '').trim() || '2026-2027';
                return `👤 Account: ${String(uid).toUpperCase()} • 📅 Session: ${sess}`;
            } catch (_) {
                return 'Company Data Loading...';
            }
        };

        const show = (msg = 'Data load ho raha hai...', sub = 'Kripya intezar karein...', pct = 5) => {
            if (!document.body) return;
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            const el = ensureDOM();
            if (!el) return;

            const metaEl = document.getElementById('erp-loader-meta');
            const spinEl = document.getElementById('erp-loader-spinner');
            if (metaEl) metaEl.textContent = getSessionBadgeText();
            if (spinEl) spinEl.style.display = 'block';

            el.style.opacity = '1';
            el.style.display = 'flex';
            setProgress(pct, msg, sub);

            if (failsafeTimer) clearTimeout(failsafeTimer);
            failsafeTimer = setTimeout(() => hide(0), 20000);
        };

        const setProgress = (pct, msg, sub) => {
            const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
            if (safePct >= currentPct || safePct === 0) {
                currentPct = safePct;
            }
            const pctEl = document.getElementById('erp-loader-pct');
            const barEl = document.getElementById('erp-loader-bar');
            const msgEl = document.getElementById('erp-loader-msg');
            const subEl = document.getElementById('erp-loader-sub');
            const spinEl = document.getElementById('erp-loader-spinner');

            if (pctEl) pctEl.textContent = `${currentPct}%`;
            if (barEl) barEl.style.width = `${currentPct}%`;
            if (msg !== undefined && msgEl) msgEl.textContent = msg;
            if (sub !== undefined && subEl) subEl.textContent = sub;
            if (currentPct >= 100 && spinEl) spinEl.style.display = 'none';
        };

        const hide = (delayMs = 350) => {
            if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

            const doHide = () => {
                const el = document.getElementById('erp-tally-loader');
                if (!el) return;
                el.style.opacity = '0';
                setTimeout(() => {
                    el.style.display = 'none';
                    currentPct = 0;
                }, 250);
            };

            if (delayMs > 0) {
                hideTimer = setTimeout(doHide, delayMs);
            } else {
                doHide();
            }
        };

        return { show, setProgress, hide };
    })();

    window.ERPLoader = ERPLoader;

    const getSupabase = () => {
        return window.supabaseClient || window.supabase || (typeof window.supabase !== 'undefined' ? window.supabase : null);
    };

    const clearMemoryCache = () => {
        APP_MEMORY_CACHE = Object.create(null);
        window.APP_MEMORY_CACHE = APP_MEMORY_CACHE;
        LAST_SYNCED_SNAPSHOTS.clear();
        PENDING_ROW_DELTAS.clear();
        SYNC_DEBOUNCE_TIMERS.forEach((timer) => clearTimeout(timer));
        SYNC_DEBOUNCE_TIMERS.clear();
    };

    const getEffectiveUserId = () => {
        try {
            if (typeof window.currentUserId !== 'undefined' && window.currentUserId) {
                const sanitized = String(window.currentUserId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                if (sanitized && sanitized !== 'app') return sanitized;
            }
            const stored = localStorage.getItem('app_current_user_id') ||
                           localStorage.getItem('currentUserId') ||
                           sessionStorage.getItem('currentUserId');
            if (stored) {
                const sanitized = String(stored).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                if (sanitized && sanitized !== 'app') return sanitized;
            }
        } catch (_) {}
        return 'farhan';
    };

    const getStorageKey = (key) => {
        const uid = getEffectiveUserId();
        const safeKey = String(key || '').trim();

        if (GLOBAL_APP_KEYS.includes(safeKey)) {
            return `${uid}_${safeKey}`;
        }

        let sess = '2026-2027';
        try {
            if (typeof window.getActiveFinancialSession === 'function') {
                sess = window.getActiveFinancialSession();
            } else {
                const storedSess = APP_MEMORY_CACHE[`${uid}_app_active_session`] ||
                                   localStorage.getItem(`${uid}_app_active_session`);
                if (storedSess) sess = storedSess;
            }
        } catch (_) {}

        sess = String(sess).replace(/['"]+/g, '').trim().replace(/[^0-9-]/g, '') || '2026-2027';
        return `${uid}_${sess}_${safeKey}`;
    };

    const getIndexedDBPromise = () => {
        return new Promise((resolve) => {
            if (idbInstance) return resolve(idbInstance);
            if (!('indexedDB' in window)) return resolve(null);

            try {
                const req = window.indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);
                req.onupgradeneeded = (e) => {
                    const dbase = e.target.result;
                    if (!dbase.objectStoreNames.contains(DB_CONFIG.STORE_APP)) {
                        dbase.createObjectStore(DB_CONFIG.STORE_APP);
                    }
                    if (!dbase.objectStoreNames.contains(DB_CONFIG.STORE_QUEUE)) {
                        dbase.createObjectStore(DB_CONFIG.STORE_QUEUE, { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => {
                    idbInstance = e.target.result;
                    idbInstance.onclose = () => { idbInstance = null; };
                    resolve(idbInstance);
                };
                req.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
    };

    /**
     * ⭐ PERMANENT DELETE / RECREATE PROTECTION:
     * Kisi user ka poora local RAM, localStorage, Delta Cursors, IndexedDB app_store aur sync_queue wipe karein
     */
    const wipeUserLocalCache = async (targetUid) => {
        const uid = String(targetUid || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!uid) return;

        clearMemoryCache();

        // 1. localStorage se is user ki saari keys + delta sync cursors hatayein
        try {
            const toDel = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || PROTECTED_AUTH_LS_KEYS.has(k)) continue;
                const kl = k.toLowerCase();
                if (
                    kl.startsWith(`${uid}_`) ||
                    kl.includes(`_${uid}_`) ||
                    kl === `erp_account_uid_${uid}`
                ) {
                    toDel.push(k);
                }
            }
            toDel.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}

        // 2. IndexedDB (app_store + sync_queue) se is user ka SAARA data delete karein
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;

            await new Promise((resolve) => {
                try {
                    const tx = dbase.transaction([DB_CONFIG.STORE_APP, DB_CONFIG.STORE_QUEUE], 'readwrite');
                    const appStore = tx.objectStore(DB_CONFIG.STORE_APP);
                    const queueStore = tx.objectStore(DB_CONFIG.STORE_QUEUE);

                    const appReq = appStore.openCursor();
                    appReq.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            const kl = String(cursor.key || '').toLowerCase();
                            if (kl.startsWith(`${uid}_`)) {
                                cursor.delete();
                            }
                            cursor.continue();
                        }
                    };

                    const qReq = queueStore.openCursor();
                    qReq.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            const val = cursor.value || {};
                            const idStr = String(cursor.key || '').toLowerCase();
                            const tkStr = String(val.targetKey || '').toLowerCase();
                            if (
                                idStr.startsWith(`${uid}_`) ||
                                idStr.includes(`_${uid}_`) ||
                                tkStr.startsWith(`${uid}_`)
                            ) {
                                cursor.delete();
                            }
                            cursor.continue();
                        }
                    };

                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (_) {
                    resolve(false);
                }
            });
        } catch (_) {}
    };

    const openEnterpriseIndexedDB = (callback) => {
        getIndexedDBPromise().then((dbase) => {
            if (typeof callback === 'function') callback(dbase);
        });
    };

    const idbGet = async (key) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return null;
            return await new Promise((resolve) => {
                try {
                    const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readonly');
                    const req = tx.objectStore(DB_CONFIG.STORE_APP).get(key);
                    req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
                    req.onerror = () => resolve(null);
                } catch (_) {
                    resolve(null);
                }
            });
        } catch (_) {
            return null;
        }
    };

    const idbPut = async (key, value) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return false;
            return await new Promise((resolve) => {
                try {
                    const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readwrite');
                    tx.objectStore(DB_CONFIG.STORE_APP).put(value, key);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (_) {
                    resolve(false);
                }
            });
        } catch (_) {
            return false;
        }
    };

    const idbDelete = async (key) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;
            const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readwrite');
            tx.objectStore(DB_CONFIG.STORE_APP).delete(key);
        } catch (_) {}
    };

    // Offline delta queue ko merge karke safe rakhein taaki purani offline edits overwrite na hon
    const enqueueSyncMutation = async (mutation) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;

            if (mutation.mode === 'ROW_DELTA') {
                await new Promise((resolve) => {
                    const tx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readwrite');
                    const store = tx.objectStore(DB_CONFIG.STORE_QUEUE);
                    const getReq = store.get(mutation.id);

                    getReq.onsuccess = () => {
                        const existing = getReq.result;
                        if (existing && existing.mode === 'ROW_DELTA') {
                            const upsertMap = new Map();
                            const deleteSet = new Set(existing.deletes || []);

                            (existing.upserts || []).forEach((it) => {
                                const rid = getRowIdentity(it);
                                if (rid) upsertMap.set(rid, it);
                            });

                            (mutation.upserts || []).forEach((it) => {
                                const rid = getRowIdentity(it);
                                if (rid) {
                                    deleteSet.delete(rid);
                                    upsertMap.set(rid, it);
                                }
                            });

                            (mutation.deletes || []).forEach((rid) => {
                                const idStr = String(rid || '').trim();
                                if (idStr) {
                                    upsertMap.delete(idStr);
                                    deleteSet.add(idStr);
                                }
                            });

                            mutation.upserts = Array.from(upsertMap.values());
                            mutation.deletes = Array.from(deleteSet.values());
                        }
                        store.put(mutation);
                    };

                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
                return;
            }

            const tx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readwrite');
            tx.objectStore(DB_CONFIG.STORE_QUEUE).put(mutation);
        } catch (_) {}
    };

    const flushSyncQueue = async () => {
        if (isSyncQueueFlushing || !navigator.onLine || !isUserLoggedIn()) return;
        const sb = getSupabase();
        if (!sb || !window.CloudEngine) return;

        const currentUid = getEffectiveUserId();
        if (!currentUid) return;

        isSyncQueueFlushing = true;
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) { isSyncQueueFlushing = false; return; }

            const tx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readonly');
            const req = tx.objectStore(DB_CONFIG.STORE_QUEUE).getAll();

            req.onsuccess = async () => {
                const queue = (req.result || []).filter((item) => {
                    const tk = String(item?.targetKey || '').toLowerCase();
                    return tk.startsWith(`${currentUid}_`);
                });

                if (queue.length === 0) { isSyncQueueFlushing = false; return; }

                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('syncing');

                let hadError = false;
                for (const item of queue) {
                    try {
                        let ok = false;
                        if (item.mode === 'ROW_DELTA') {
                            if (typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                                ok = await window.CloudEngine.cloudWriteDelta(
                                    item.targetKey,
                                    item.upserts || [],
                                    item.deletes || []
                                );
                            }
                        } else if (typeof window.CloudEngine?.cloudWrite === 'function') {
                            ok = await window.CloudEngine.cloudWrite(item.targetKey, item.data);
                        }

                        if (!ok) {
                            hadError = true;
                            break;
                        }

                        const deleteTx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readwrite');
                        deleteTx.objectStore(DB_CONFIG.STORE_QUEUE).delete(item.id);
                    } catch (_) {
                        hadError = true;
                        break;
                    }
                }

                if (typeof window.showSyncStatus === 'function') {
                    window.showSyncStatus(hadError ? 'error' : 'online');
                }
                isSyncQueueFlushing = false;
            };
            req.onerror = () => { isSyncQueueFlushing = false; };
        } catch (_) {
            isSyncQueueFlushing = false;
        }
    };

    window.addEventListener('online', () => { flushSyncQueue(); });

    /**
     * Generic Row-Delta Cloud Sync Dispatcher (For Row-by-Row Modules)
     */
    const dispatchRowDeltaSync = (fullKey, upserts, deletes) => {
        const uid = getEffectiveUserId();
        if (isRemoteUpdating || !uid) return;
        if ((!upserts || upserts.length === 0) && (!deletes || deletes.length === 0)) return;

        let pending = PENDING_ROW_DELTAS.get(fullKey);
        if (!pending) {
            pending = { upserts: new Map(), deletes: new Set() };
            PENDING_ROW_DELTAS.set(fullKey, pending);
        }

        (upserts || []).forEach((it) => {
            const rid = getRowIdentity(it);
            if (rid) {
                pending.deletes.delete(rid);
                pending.upserts.set(rid, it);
            }
        });

        (deletes || []).forEach((rid) => {
            const idStr = String(rid || '').trim();
            if (idStr) {
                pending.upserts.delete(idStr);
                pending.deletes.add(idStr);
            }
        });

        const queueId = `delta_${uid}_${fullKey}`;

        if (SYNC_DEBOUNCE_TIMERS.has(fullKey)) {
            clearTimeout(SYNC_DEBOUNCE_TIMERS.get(fullKey));
        }

        const timer = setTimeout(async () => {
            SYNC_DEBOUNCE_TIMERS.delete(fullKey);
            const batch = PENDING_ROW_DELTAS.get(fullKey);
            PENDING_ROW_DELTAS.delete(fullKey);
            if (!batch) return;

            const finalUpserts = Array.from(batch.upserts.values());
            const finalDeletes = Array.from(batch.deletes.values());
            if (!finalUpserts.length && !finalDeletes.length) return;

            const sb = getSupabase();
            if (!navigator.onLine || !sb || typeof window.CloudEngine?.cloudWriteDelta !== 'function') {
                await enqueueSyncMutation({
                    id: queueId,
                    mode: 'ROW_DELTA',
                    targetKey: fullKey,
                    upserts: finalUpserts,
                    deletes: finalDeletes,
                    timestamp: Date.now()
                });
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('offline');
                return;
            }

            try {
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('syncing');
                const ok = await window.CloudEngine.cloudWriteDelta(fullKey, finalUpserts, finalDeletes);
                if (!ok) {
                    await enqueueSyncMutation({
                        id: queueId,
                        mode: 'ROW_DELTA',
                        targetKey: fullKey,
                        upserts: finalUpserts,
                        deletes: finalDeletes,
                        timestamp: Date.now()
                    });
                    if (typeof window.showSyncStatus === 'function') window.showSyncStatus('error');
                    return;
                }
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('online');
            } catch (_) {
                await enqueueSyncMutation({
                    id: queueId,
                    mode: 'ROW_DELTA',
                    targetKey: fullKey,
                    upserts: finalUpserts,
                    deletes: finalDeletes,
                    timestamp: Date.now()
                });
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('offline');
            }
        }, DEBOUNCE_DELAY_MS);

        SYNC_DEBOUNCE_TIMERS.set(fullKey, timer);
    };

    /**
     * Legacy JSONB Cloud Sync Engine (Debounced — for remaining JSONB modules)
     */
    const dispatchCloudSync = (fullKey, toSave, action = 'SET') => {
        const uid = getEffectiveUserId();
        if (isRemoteUpdating || !uid) return;

        const queueId = `${uid}_${fullKey}`;

        if (SYNC_DEBOUNCE_TIMERS.has(fullKey)) {
            clearTimeout(SYNC_DEBOUNCE_TIMERS.get(fullKey));
        }

        const timer = setTimeout(async () => {
            SYNC_DEBOUNCE_TIMERS.delete(fullKey);

            const sb = getSupabase();
            if (!navigator.onLine || !sb) {
                await enqueueSyncMutation({
                    id: queueId,
                    action,
                    targetKey: fullKey,
                    data: toSave,
                    timestamp: Date.now()
                });
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('offline');
                return;
            }

            try {
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('syncing');

                if (typeof window.CloudEngine?.cloudWrite === 'function') {
                    const ok = await window.CloudEngine.cloudWrite(fullKey, toSave);
                    if (ok === false) {
                        await enqueueSyncMutation({
                            id: queueId,
                            action,
                            targetKey: fullKey,
                            data: toSave,
                            timestamp: Date.now()
                        });
                        if (typeof window.showSyncStatus === 'function') window.showSyncStatus('error');
                        return;
                    }
                }

                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('online');
            } catch (networkErr) {
                await enqueueSyncMutation({
                    id: queueId,
                    action,
                    targetKey: fullKey,
                    data: toSave,
                    timestamp: Date.now()
                });
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('offline');
            }
        }, DEBOUNCE_DELAY_MS);

        SYNC_DEBOUNCE_TIMERS.set(fullKey, timer);
    };

    // Purane localStorage se heavy keys ko safely IndexedDB me shift karke 5MB khali rakhein
    const migrateLocalStorageToCache = async () => {
        const uid = getEffectiveUserId();
        try {
            const keysSnapshot = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) keysSnapshot.push(k);
            }

            for (const k of keysSnapshot) {
                if (k.startsWith(`${uid}_`) || k === 'app_users') {
                    let val = APP_MEMORY_CACHE[k];
                    if (!(k in APP_MEMORY_CACHE)) {
                        const raw = localStorage.getItem(k);
                        try {
                            val = JSON.parse(raw);
                        } catch (_) {
                            val = raw;
                        }
                        APP_MEMORY_CACHE[k] = val;
                        if (Array.isArray(val)) updateRowSnapshot(k, val);
                        await idbPut(k, val);
                    }
                    // Heavy keys ko IndexedDB me safe karne ke baad localStorage se hata dein
                    if (!isLightweightKey(k)) {
                        try { localStorage.removeItem(k); } catch (_) {}
                    }
                }
            }
        } catch (_) {}
    };

    const initIndexedDBPreload = async (callback) => {
        const uid = getEffectiveUserId();
        const showLoader = isUserLoggedIn();

        const finishPreload = async () => {
            try {
                await migrateLocalStorageToCache();
            } finally {
                if (typeof resolveStoragePreload === 'function') {
                    resolveStoragePreload(true);
                    resolveStoragePreload = null;
                }
            }

            flushSyncQueue();

            if (typeof window.triggerActiveSectionRefresh === 'function') {
                window.triggerActiveSectionRefresh();
            } else if (typeof window.renderDashboardDayBook === 'function') {
                window.renderDashboardDayBook();
            }

            if (showLoader) {
                if (!navigator.onLine) {
                    ERPLoader.setProgress(100, 'Offline Mode Taiyar Hai ✅', 'Local IndexedDB se data load ho gaya');
                    ERPLoader.hide(400);
                } else {
                    ERPLoader.setProgress(35, 'Local Data Ready • Cloud Sync Chalu Hai...', 'Supabase se taza data check ho raha hai...');
                }
            }

            if (typeof callback === 'function') callback();
        };

        if (showLoader) {
            ERPLoader.show('Local Database Load Ho Rahi Hai...', 'IndexedDB se purana hisab taiyar ho raha hai...', 12);
        }

        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) {
                await finishPreload();
                return;
            }

            const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readonly');
            const req = tx.objectStore(DB_CONFIG.STORE_APP).openCursor();

            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const k = String(cursor.key);
                    if (k.startsWith(`${uid}_`) || k === 'app_users') {
                        APP_MEMORY_CACHE[k] = cursor.value;
                        if (Array.isArray(cursor.value)) {
                            updateRowSnapshot(k, cursor.value);
                        }
                    }
                    cursor.continue();
                } else {
                    finishPreload();
                }
            };
            req.onerror = () => {
                finishPreload();
            };
        } catch (_) {
            await finishPreload();
        }
    };

    const safeArr = (val) => {
        if (typeof window.safeArray === 'function') return window.safeArray(val);
        return Array.isArray(val) ? val : [];
    };

    const getStore = (key) => {
        if (isBackupPreviewMode && PREVIEW_BACKUP_DATA) {
            if (key.startsWith('kariger_sheets_')) {
                const kId = key.replace('kariger_sheets_', '');
                return safeArr(PREVIEW_BACKUP_DATA.sheets?.[kId]);
            }
            if (key.startsWith('jobwork_sheets_')) {
                const wId = key.replace('jobwork_sheets_', '');
                return safeArr(PREVIEW_BACKUP_DATA.jobwork_sheets?.[wId]);
            }
            if (PREVIEW_BACKUP_DATA.data && Object.prototype.hasOwnProperty.call(PREVIEW_BACKUP_DATA.data, key)) {
                const pVal = PREVIEW_BACKUP_DATA.data[key];
                return Array.isArray(pVal) ? safeArr(pVal) : pVal;
            }
            return [];
        }

        try {
            const fullKey = getStorageKey(key);

            if (fullKey in APP_MEMORY_CACHE) {
                const cachedVal = APP_MEMORY_CACHE[fullKey];
                if (typeof cachedVal === 'string' || typeof cachedVal === 'number' || typeof cachedVal === 'boolean') {
                    return cachedVal;
                }
                if (cachedVal !== null && typeof cachedVal === 'object' && !Array.isArray(cachedVal)) {
                    return cachedVal;
                }
                const arrVal = safeArr(cachedVal);
                if (isRowSyncKey(fullKey) && !LAST_SYNCED_SNAPSHOTS.has(fullKey)) {
                    updateRowSnapshot(fullKey, arrVal);
                }
                return arrVal;
            }

            const raw = localStorage.getItem(fullKey);
            if (!raw || raw === 'null' || raw === 'undefined') return [];

            const parsed = JSON.parse(raw);
            APP_MEMORY_CACHE[fullKey] = parsed;
            if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
                return parsed;
            }
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            const arrParsed = safeArr(parsed);
            if (isRowSyncKey(fullKey)) {
                updateRowSnapshot(fullKey, arrParsed);
            }
            return arrParsed;
        } catch (_) {
            return [];
        }
    };

    const setStore = (key, data) => {
        if (isBackupPreviewMode) return;

        try {
            const fullKey = getStorageKey(key);
            const toSave = Array.isArray(data) ? safeArr(data) : data;
            const useRowSync = isRowSyncKey(fullKey) && Array.isArray(toSave);

            let diff = null;
            if (useRowSync && !isRemoteUpdating) {
                diff = computeAndAdvanceRowDiff(fullKey, toSave);
            } else if (Array.isArray(toSave)) {
                updateRowSnapshot(fullKey, toSave);
            }

            APP_MEMORY_CACHE[fullKey] = toSave;
            window.APP_MEMORY_CACHE[fullKey] = toSave;
            idbPut(fullKey, toSave);

            if (isLightweightKey(fullKey)) {
                try {
                    localStorage.setItem(fullKey, JSON.stringify(toSave));
                } catch (_) {}
            }

            if (useRowSync) {
                if (diff && (diff.upserts.length > 0 || diff.deletes.length > 0)) {
                    dispatchRowDeltaSync(fullKey, diff.upserts, diff.deletes);
                }
            } else {
                dispatchCloudSync(fullKey, toSave, 'SET');
            }
        } catch (fatalErr) {
            console.error('[Storage:setStore] Fatal write error:', fatalErr);
        }
    };

    const setRemoteStore = (fullKey, cleanData) => {
        APP_MEMORY_CACHE[fullKey] = cleanData;
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = cleanData;
        if (Array.isArray(cleanData)) {
            updateRowSnapshot(fullKey, cleanData);
        }
        if (isLightweightKey(fullKey)) {
            try {
                localStorage.setItem(fullKey, JSON.stringify(cleanData));
            } catch (_) {}
        }
        idbPut(fullKey, cleanData);
    };

    const deleteStoreKey = (key) => {
        try {
            const fullKey = getStorageKey(key);
            const useRowSync = isRowSyncKey(fullKey);
            let deletedIds = [];

            if (useRowSync && !isRemoteUpdating) {
                const prevSnap = LAST_SYNCED_SNAPSHOTS.get(fullKey);
                if (prevSnap) {
                    deletedIds = Array.from(prevSnap.keys());
                } else if (Array.isArray(APP_MEMORY_CACHE[fullKey])) {
                    deletedIds = APP_MEMORY_CACHE[fullKey].map(getRowIdentity).filter(Boolean);
                }
                LAST_SYNCED_SNAPSHOTS.set(fullKey, new Map());
            } else {
                LAST_SYNCED_SNAPSHOTS.delete(fullKey);
            }

            delete APP_MEMORY_CACHE[fullKey];
            if (window.APP_MEMORY_CACHE) delete window.APP_MEMORY_CACHE[fullKey];
            idbDelete(fullKey);
            try { localStorage.removeItem(fullKey); } catch (_) {}

            if (useRowSync) {
                if (deletedIds.length > 0) {
                    dispatchRowDeltaSync(fullKey, [], deletedIds);
                }
            } else {
                dispatchCloudSync(fullKey, null, 'REMOVE');
            }
        } catch (err) {
            console.error('[Storage:deleteStoreKey] Delete error:', err);
        }
    };

    const publicStorageAPI = {
        getStore,
        setStore,
        setRemoteStore,
        deleteStoreKey,
        updateRowSnapshot,
        clearMemoryCache,
        wipeUserLocalCache,
        getStorageKey,
        getEffectiveUserId,
        openEnterpriseIndexedDB,
        idbGet,
        idbPut,
        idbDelete,
        initIndexedDBPreload,
        flushSyncQueue,
        isLightweightKey,
        GLOBAL_APP_KEYS,
        StoragePreloadPromise,
        get isRemoteUpdating() { return isRemoteUpdating; },
        set isRemoteUpdating(val) { isRemoteUpdating = Boolean(val); },
        get isBackupPreviewMode() { return isBackupPreviewMode; },
        set isBackupPreviewMode(val) { isBackupPreviewMode = Boolean(val); },
        get PREVIEW_BACKUP_DATA() { return PREVIEW_BACKUP_DATA; },
        set PREVIEW_BACKUP_DATA(val) { PREVIEW_BACKUP_DATA = val; },
        get APP_MEMORY_CACHE() { return APP_MEMORY_CACHE; }
    };

    window.APP_MEMORY_CACHE = APP_MEMORY_CACHE;
    window.GLOBAL_APP_KEYS = GLOBAL_APP_KEYS;
    window.StoragePreloadPromise = StoragePreloadPromise;
    window.clearMemoryCache = clearMemoryCache;
    window.wipeUserLocalCache = wipeUserLocalCache;
    window.openEnterpriseIndexedDB = openEnterpriseIndexedDB;
    window.idbGet = idbGet;
    window.idbPut = idbPut;
    window.idbDelete = idbDelete;
    window.initIndexedDBPreload = initIndexedDBPreload;
    window.getEffectiveUserId = getEffectiveUserId;
    window.getStorageKey = getStorageKey;
    window.getStore = getStore;
    window.setStore = setStore;
    window.setRemoteStore = setRemoteStore;
    window.deleteStoreKey = deleteStoreKey;
    window.flushSyncQueue = flushSyncQueue;

    Object.defineProperty(window, 'isRemoteUpdating', {
        get: () => isRemoteUpdating,
        set: (v) => { isRemoteUpdating = Boolean(v); },
        configurable: true
    });
    Object.defineProperty(window, 'isBackupPreviewMode', {
        get: () => isBackupPreviewMode,
        set: (v) => { isBackupPreviewMode = Boolean(v); },
        configurable: true
    });
    Object.defineProperty(window, 'PREVIEW_BACKUP_DATA', {
        get: () => PREVIEW_BACKUP_DATA,
        set: (v) => { PREVIEW_BACKUP_DATA = v; },
        configurable: true
    });

    window.StorageEngine = publicStorageAPI;

    // 🌟 STARTUP PRELOAD: Har reload par IndexedDB se data turant memory me laao
    initIndexedDBPreload();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicStorageAPI;
    }
})();
