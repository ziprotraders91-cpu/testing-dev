/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE OFFLINE-FIRST STORAGE ENGINE
   File: core/storage.js • Developed by Farhan Jawed
   Architecture: 4-Tier L1-RAM / L2-LS / L3-IDB / L4-Supabase Cloud Queue
   [FIXED: Instant DOM Startup Preload & Multi-Session Isolation]
============================================================================ */

(() => {
    'use strict';

    let APP_MEMORY_CACHE = Object.create(null);
    let idbInstance = null;
    let isRemoteUpdating = false;
    let isBackupPreviewMode = false;
    let PREVIEW_BACKUP_DATA = null;

    const SYNC_DEBOUNCE_TIMERS = new Map();
    const DEBOUNCE_DELAY_MS = 300;
    let isSyncQueueFlushing = false;

    const GLOBAL_APP_KEYS = Object.freeze([
        'app_sessions_list',
        'app_active_session',
        'karkhana_list',
        'active_karkhana_id',
        'karkhana_transfers',
        'app_users',
        'info_ledger'
    ]);

    const DB_CONFIG = Object.freeze({
        NAME: 'SimplicityERP_DB',
        VERSION: 2,
        STORE_APP: 'app_store',
        STORE_QUEUE: 'sync_queue'
    });

    const getSupabase = () => {
        return window.supabaseClient || window.supabase || (typeof window.supabase !== 'undefined' ? window.supabase : null);
    };

    const clearMemoryCache = () => {
        APP_MEMORY_CACHE = Object.create(null);
        window.APP_MEMORY_CACHE = APP_MEMORY_CACHE;
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

    const openEnterpriseIndexedDB = (callback) => {
        getIndexedDBPromise().then((dbase) => {
            if (typeof callback === 'function') callback(dbase);
        });
    };

    const idbPut = async (key, value) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;
            const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readwrite');
            tx.objectStore(DB_CONFIG.STORE_APP).put(value, key);
        } catch (_) {}
    };

    const idbDelete = async (key) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;
            const tx = dbase.transaction(DB_CONFIG.STORE_APP, 'readwrite');
            tx.objectStore(DB_CONFIG.STORE_APP).delete(key);
        } catch (_) {}
    };

    const enqueueSyncMutation = async (mutation) => {
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) return;
            const tx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readwrite');
            tx.objectStore(DB_CONFIG.STORE_QUEUE).put(mutation);
        } catch (_) {}
    };

    const flushSyncQueue = async () => {
        if (isSyncQueueFlushing || !navigator.onLine) return;
        const sb = getSupabase();
        if (!sb) return;

        isSyncQueueFlushing = true;
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) { isSyncQueueFlushing = false; return; }

            const tx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readonly');
            const req = tx.objectStore(DB_CONFIG.STORE_QUEUE).getAll();

            req.onsuccess = async () => {
                const queue = req.result || [];
                if (queue.length === 0) { isSyncQueueFlushing = false; return; }

                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('syncing');

                for (const item of queue) {
                    try {
                        if (typeof window.CloudEngine?.cloudWrite === 'function') {
                            await window.CloudEngine.cloudWrite(item.targetKey, item.data);
                        }
                        const deleteTx = dbase.transaction(DB_CONFIG.STORE_QUEUE, 'readwrite');
                        deleteTx.objectStore(DB_CONFIG.STORE_QUEUE).delete(item.id);
                    } catch (_) {
                        break;
                    }
                }

                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('online');
                isSyncQueueFlushing = false;
            };
            req.onerror = () => { isSyncQueueFlushing = false; };
        } catch (_) {
            isSyncQueueFlushing = false;
        }
    };

    window.addEventListener('online', () => { flushSyncQueue(); });

    /**
     * Supabase Cloud Sync Engine (Debounced)
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
                    await window.CloudEngine.cloudWrite(fullKey, toSave);
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

    const migrateLocalStorageToCache = () => {
        const uid = getEffectiveUserId();
        try {
            const len = localStorage.length;
            for (let i = 0; i < len; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith(`${uid}_`) || k === 'app_users') && !(k in APP_MEMORY_CACHE)) {
                    const raw = localStorage.getItem(k);
                    try {
                        const parsed = JSON.parse(raw);
                        APP_MEMORY_CACHE[k] = parsed;
                        idbPut(k, parsed);
                    } catch (_) {
                        APP_MEMORY_CACHE[k] = raw;
                        idbPut(k, raw);
                    }
                }
            }
        } catch (_) {}
    };

    const initIndexedDBPreload = async (callback) => {
        const uid = getEffectiveUserId();
        try {
            const dbase = await getIndexedDBPromise();
            if (!dbase) {
                migrateLocalStorageToCache();
                if (typeof callback === 'function') callback();
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
                    }
                    cursor.continue();
                } else {
                    migrateLocalStorageToCache();
                    flushSyncQueue();
                    if (typeof callback === 'function') callback();
                }
            };
            req.onerror = () => {
                migrateLocalStorageToCache();
                if (typeof callback === 'function') callback();
            };
        } catch (_) {
            migrateLocalStorageToCache();
            if (typeof callback === 'function') callback();
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
                return safeArr(cachedVal);
            }

            const raw = localStorage.getItem(fullKey);
            if (!raw || raw === 'null' || raw === 'undefined') return [];

            const parsed = JSON.parse(raw);
            APP_MEMORY_CACHE[fullKey] = parsed;
            if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
                return parsed;
            }
            return safeArr(parsed);
        } catch (_) {
            return [];
        }
    };

    const setStore = (key, data) => {
        if (isBackupPreviewMode) return;

        try {
            const fullKey = getStorageKey(key);
            const toSave = Array.isArray(data) ? safeArr(data) : data;

            APP_MEMORY_CACHE[fullKey] = toSave;
            window.APP_MEMORY_CACHE[fullKey] = toSave;
            idbPut(fullKey, toSave);

            try {
                localStorage.setItem(fullKey, JSON.stringify(toSave));
            } catch (_) {}

            dispatchCloudSync(fullKey, toSave, 'SET');
        } catch (fatalErr) {
            console.error('[Storage:setStore] Fatal write error:', fatalErr);
        }
    };

    const setRemoteStore = (fullKey, cleanData) => {
        APP_MEMORY_CACHE[fullKey] = cleanData;
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = cleanData;
        try {
            localStorage.setItem(fullKey, JSON.stringify(cleanData));
        } catch (_) {}
        idbPut(fullKey, cleanData);
    };

    const deleteStoreKey = (key) => {
        try {
            const fullKey = getStorageKey(key);
            delete APP_MEMORY_CACHE[fullKey];
            if (window.APP_MEMORY_CACHE) delete window.APP_MEMORY_CACHE[fullKey];
            idbDelete(fullKey);
            try { localStorage.removeItem(fullKey); } catch (_) {}
            dispatchCloudSync(fullKey, null, 'REMOVE');
        } catch (err) {
            console.error('[Storage:deleteStoreKey] Delete error:', err);
        }
    };

    const publicStorageAPI = {
        getStore,
        setStore,
        setRemoteStore,
        deleteStoreKey,
        clearMemoryCache,
        getStorageKey,
        getEffectiveUserId,
        openEnterpriseIndexedDB,
        idbPut,
        idbDelete,
        initIndexedDBPreload,
        flushSyncQueue,
        GLOBAL_APP_KEYS,
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
    window.clearMemoryCache = clearMemoryCache;
    window.openEnterpriseIndexedDB = openEnterpriseIndexedDB;
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
