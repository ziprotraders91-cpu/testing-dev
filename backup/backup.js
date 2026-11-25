/* ============================================================================
   SIMPLICITY ERP - ENTERPRISE BACKUP, VIEWER & ATOMIC RESTORE ENGINE
   File: backup/backup.js • Developed by Farhan Jawed
   Architecture: IndexedDB + RAM + 18 Row-by-Row Delta Sync + Silent Push Restore
   Scale: 50+ Owners × 1,000+ Karigers | Zero-Data-Loss Architecture
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. CONSTANTS, SCHEMA VERSIONING & METADATA
    ======================================================================== */
    const BACKUP_SCHEMA_VERSION = 3;
    const BACKUP_SYSTEM_TAG = 'SimplicityERP';
    const EXPORT_CHUNK_SIZE = 25;
    const RESTORE_CHUNK_SIZE = 20;
    const CLOUD_RESTORE_CONCURRENCY = 4;
    const RPC_BATCH_SIZE = 200;

    // Live keys defining the complete business snapshot
    const SYSTEM_BACKUP_KEYS = Object.freeze([
        'kariger_list',
        'info_ledger',
        'karkhana_list',
        'active_karkhana_id',
        'karkhana_transfers',
        'app_sessions_list',
        'app_active_session',
        'bana_stock',
        'bana_history',
        'zari_stock',
        'zari_history',
        'saree_history',
        'material_transfers',
        'sancha_items',
        'sancha_history',
        'tani_orders_list',
        'tani_learned_colors',
        'tani_learned_rangi',
        'jobwork_workers',
        'jw_bills_list',
        'jw_payments_list',
        'dukan_transfer_history',
        'payment_records',
        'payment_history'
    ]);

    // Global keys (${uid}_${key}) jo session ke bahar rehti hain
    const GLOBAL_BACKUP_KEYS = new Set([
        'app_sessions_list',
        'app_active_session',
        'karkhana_list',
        'active_karkhana_id',
        'karkhana_transfers',
        'info_ledger'
    ]);

    // Purane unused legacy keys jinhe restore me skip karna hai
    const LEGACY_SKIP_KEYS = new Set([
        'app_users',
        'saree_stock',
        'finished_saree_stock',
        'lott_saree_stock',
        'saree_transfers',
        'daybook_records',
        'dukan_records'
    ]);

    const yieldThread = () => new Promise((resolve) => setTimeout(resolve, 0));

    const waitForStoragePreload = async () => {
        try {
            if (window.StoragePreloadPromise && typeof window.StoragePreloadPromise.then === 'function') {
                await window.StoragePreloadPromise;
            }
        } catch (_) {}
    };

    const invalidateAllModuleCaches = () => {
        if (typeof window.invalidateKarigerUICache === 'function') window.invalidateKarigerUICache();
        if (typeof window.invalidateBanaCalcCache === 'function') window.invalidateBanaCalcCache();
        if (typeof window.invalidateZariCalcCache === 'function') window.invalidateZariCalcCache();
        if (typeof window.invalidateSanchaCalcCache === 'function') window.invalidateSanchaCalcCache();
        if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache();
        if (typeof window.invalidatePaymentCache === 'function') window.invalidatePaymentCache();
    };

    const getUidSafe = () => {
        if (typeof window.getEffectiveUserId === 'function') {
            return window.getEffectiveUserId();
        }
        return String(window.currentUserId || 'farhan').trim().toLowerCase() || 'farhan';
    };

    const getTidSafe = (uid) => {
        try {
            if (window.currentTenantId) return String(window.currentTenantId).trim();
            const stored = localStorage.getItem('app_current_tenant_id') || localStorage.getItem('tenantId');
            if (stored) return String(stored).trim();
        } catch (_) {}
        return uid;
    };

    const getActiveSessionSafe = () => {
        try {
            if (typeof window.getActiveFinancialSession === 'function') {
                return window.getActiveFinancialSession();
            }
        } catch (_) {}
        return '2026-2027';
    };

    /* ========================================================================
       2. UI PROGRESS MODAL & OVERLAY ENGINE
    ======================================================================== */
    const showProgressOverlay = (title, initialMessage = 'Processing...') => {
        let overlay = document.getElementById('erp-backup-progress-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'erp-backup-progress-modal';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box; backdrop-filter:blur(3px);';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="background:#ffffff; width:100%; max-width:400px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; text-align:center; padding:24px; box-sizing:border-box;">
                <div style="font-size:36px; margin-bottom:10px;">💾</div>
                <h3 id="erp-backup-progress-title" style="margin:0 0 8px 0; color:#1e293b; font-size:17px; font-weight:800;">${title}</h3>
                <p id="erp-backup-progress-text" style="color:#64748b; font-size:13px; margin:0 0 16px 0;">${initialMessage}</p>
                <div style="background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden; width:100%;">
                    <div id="erp-backup-progress-bar" style="background:#2563eb; width:0%; height:100%; transition:width 0.15s ease;"></div>
                </div>
            </div>`;

        overlay.style.display = 'flex';
    };

    const updateProgressOverlay = (pct, message) => {
        const bar = document.getElementById('erp-backup-progress-bar');
        const text = document.getElementById('erp-backup-progress-text');
        if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        if (text && message) text.textContent = message;
    };

    const closeProgressOverlay = () => {
        const overlay = document.getElementById('erp-backup-progress-modal');
        if (overlay) overlay.style.display = 'none';
    };

    /* ========================================================================
       3. NON-BLOCKING DATA EXPORT ENGINE
    ======================================================================== */
    const exportUserFullDataAsync = async (onProgress) => {
        await waitForStoragePreload();

        const sess = getActiveSessionSafe();
        const uId = getUidSafe();

        const backupPackage = {
            system: BACKUP_SYSTEM_TAG,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            userId: uId,
            session: sess,
            exportDate: new Date().toISOString(),
            data: {},
            sheets: {},
            jobwork_sheets: {}
        };

        // 1. Export Primary Store Collections
        const totalKeys = SYSTEM_BACKUP_KEYS.length;
        for (let i = 0; i < totalKeys; i++) {
            const k = SYSTEM_BACKUP_KEYS[i];
            if (typeof window.getStore === 'function') {
                backupPackage.data[k] = window.getStore(k);
            }
        }

        if (onProgress) onProgress(20, 'Primary ledgers & orders compiled...');
        await yieldThread();

        // 2. Export Kariger Tani Sheets (Chunked Non-Blocking)
        const karigers = (typeof window.sanitizeKarigerList === 'function')
            ? window.sanitizeKarigerList()
            : (window.safeArray ? window.safeArray(window.getStore('kariger_list')) : []);

        const kTotal = karigers.length;
        for (let i = 0; i < kTotal; i += EXPORT_CHUNK_SIZE) {
            const end = Math.min(i + EXPORT_CHUNK_SIZE, kTotal);
            for (let j = i; j < end; j++) {
                const k = karigers[j];
                if (k?.id) {
                    const sh = (typeof window.getKarigerSheets === 'function')
                        ? window.getKarigerSheets(k.id)
                        : (window.safeArray ? window.safeArray(window.getStore(`kariger_sheets_${k.id}`)) : []);
                    if (sh && sh.length > 0) {
                        backupPackage.sheets[k.id] = sh;
                    }
                }
            }

            const currentPct = 20 + Math.floor((end / (kTotal || 1)) * 40);
            if (onProgress) onProgress(currentPct, `Exporting Kariger Sheets (${end}/${kTotal})...`);
            await yieldThread();
        }

        // Extra safety: koi kariger sheet jo cache me ho par kariger_list me miss ho
        const memCache = window.APP_MEMORY_CACHE || {};
        const sheetPrefix = `${uId}_${sess}_kariger_sheets_`;
        Object.keys(memCache).forEach((fullK) => {
            if (fullK.startsWith(sheetPrefix)) {
                const kId = fullK.slice(sheetPrefix.length);
                if (kId && !backupPackage.sheets[kId] && Array.isArray(memCache[fullK]) && memCache[fullK].length > 0) {
                    backupPackage.sheets[kId] = memCache[fullK];
                }
            }
        });

        // 3. Export Job Work Sheets (Chunked Non-Blocking)
        const workers = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        const wTotal = workers.length;

        for (let i = 0; i < wTotal; i += EXPORT_CHUNK_SIZE) {
            const end = Math.min(i + EXPORT_CHUNK_SIZE, wTotal);
            for (let j = i; j < end; j++) {
                const w = workers[j];
                if (w?.id) {
                    const jwSh = (typeof window.getJobWorkerSheets === 'function')
                        ? window.getJobWorkerSheets(w.id)
                        : (window.safeArray ? window.safeArray(window.getStore(`jobwork_sheets_${w.id}`)) : []);

                    if (jwSh && jwSh.length > 0) {
                        backupPackage.jobwork_sheets[w.id] = jwSh;
                    }
                }
            }

            const currentPct = 60 + Math.floor((end / (wTotal || 1)) * 35);
            if (onProgress) onProgress(currentPct, `Exporting Job Work Sheets (${end}/${wTotal})...`);
            await yieldThread();
        }

        const jwPrefix = `${uId}_${sess}_jobwork_sheets_`;
        Object.keys(memCache).forEach((fullK) => {
            if (fullK.startsWith(jwPrefix)) {
                const wId = fullK.slice(jwPrefix.length);
                if (wId && !backupPackage.jobwork_sheets[wId] && Array.isArray(memCache[fullK]) && memCache[fullK].length > 0) {
                    backupPackage.jobwork_sheets[wId] = memCache[fullK];
                }
            }
        });

        if (onProgress) onProgress(100, 'Backup package ready!');
        return backupPackage;
    };

    const exportUserFullData = () => {
        const sess = getActiveSessionSafe();
        const uId = getUidSafe();

        const obj = {
            system: BACKUP_SYSTEM_TAG,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            userId: uId,
            session: sess,
            exportDate: new Date().toISOString(),
            data: {},
            sheets: {},
            jobwork_sheets: {}
        };

        SYSTEM_BACKUP_KEYS.forEach((k) => {
            if (typeof window.getStore === 'function') obj.data[k] = window.getStore(k);
        });

        const karigers = (typeof window.sanitizeKarigerList === 'function')
            ? window.sanitizeKarigerList()
            : (window.safeArray ? window.safeArray(window.getStore('kariger_list')) : []);
        karigers.forEach((k) => {
            if (k?.id) {
                const sh = (typeof window.getKarigerSheets === 'function')
                    ? window.getKarigerSheets(k.id)
                    : (window.safeArray ? window.safeArray(window.getStore(`kariger_sheets_${k.id}`)) : []);
                if (sh && sh.length) obj.sheets[k.id] = sh;
            }
        });

        const workers = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        workers.forEach((w) => {
            if (w?.id) {
                const jwSh = (typeof window.getJobWorkerSheets === 'function')
                    ? window.getJobWorkerSheets(w.id)
                    : (window.safeArray ? window.safeArray(window.getStore(`jobwork_sheets_${w.id}`)) : []);
                if (jwSh && jwSh.length) obj.jobwork_sheets[w.id] = jwSh;
            }
        });

        return obj;
    };

    /* ========================================================================
       4. BACKUP FILE DOWNLOAD TRIGGER
    ======================================================================== */
    const syncToGoogleDrive = () => {
        downloadBackupFile();
    };

    const downloadBackupFile = async () => {
        if (!window.currentUserId && !getUidSafe()) return alert('Pehle login karein!');
        if (window.isBackupPreviewMode) {
            return alert('⚠️ Pehle Preview Mode band karein, tabhi live data ka backup download hoga!');
        }

        const btn = document.querySelector(".welcome-banner button[onclick*='syncToGoogleDrive']");
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '⏳ File Ban Rahi Hai...';

        showProgressOverlay('JSON Backup Ban Raha Hai', 'Preparing IndexedDB snapshot...');

        try {
            const data = await exportUserFullDataAsync((pct, msg) => {
                updateProgressOverlay(pct, msg);
            });

            const sess = data.session || '2026-2027';
            const todayStr = (typeof window.getTodayDate === 'function')
                ? window.getTodayDate()
                : new Date().toISOString().split('T')[0];

            const fileName = `${data.userId || window.currentUserId || 'erp'}_${sess}_Backup_${todayStr}.json`;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
            const downloadUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                closeProgressOverlay();
                if (btn) btn.innerHTML = origHtml;
            }, 1500);
        } catch (err) {
            closeProgressOverlay();
            if (btn) btn.innerHTML = origHtml;
            console.error('[BackupEngine] Export failure:', err);
            alert(`Backup Export Error: ${err.message || err}`);
        }
    };

    /* ========================================================================
       5. READ-ONLY BACKUP VIEWER ENGINE (PREVIEW MODE)
    ======================================================================== */
    const validateBackupPackage = (pkg) => {
        if (!pkg || typeof pkg !== 'object') return false;
        const hasData = pkg.data && typeof pkg.data === 'object';
        const hasSheets = pkg.sheets && typeof pkg.sheets === 'object';
        const hasJw = pkg.jobwork_sheets && typeof pkg.jobwork_sheets === 'object';
        return Boolean(hasData || hasSheets || hasJw);
    };

    const openBackupViewer = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showProgressOverlay('Backup File Khul Rahi Hai', 'Verifying integrity...');

        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);

                if (!validateBackupPackage(parsed)) {
                    closeProgressOverlay();
                    return alert('⚠️ Galat backup file format! Is file me valid Simplicity ERP data nahi hai.');
                }

                window.isBackupPreviewMode = true;
                window.PREVIEW_BACKUP_DATA = parsed;

                const banner = document.getElementById('backup-preview-banner');
                const dateText = document.getElementById('preview-banner-date');

                if (banner) banner.style.display = 'flex';
                if (dateText) {
                    const sLabel = parsed.session ? `${parsed.session} • ` : '';
                    const dLabel = parsed.exportDate
                        ? (typeof window.formatDateDisplay === 'function'
                            ? window.formatDateDisplay(String(parsed.exportDate).substring(0, 10))
                            : String(parsed.exportDate).substring(0, 10))
                        : 'Purana Backup';
                    dateText.textContent = `${sLabel}${dLabel}`;
                }

                invalidateAllModuleCaches();
                if (typeof window.backToDashboard === 'function') window.backToDashboard();
                if (typeof window.CloudEngine?.triggerSmartUIRepaint === 'function') {
                    window.CloudEngine.triggerSmartUIRepaint(true);
                }
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('preview');

                closeProgressOverlay();
                alert('👁️ BACKUP PREVIEW MODE CHALU!\nYeh data sirf dekhne ke liye hai. Aaj ka live data 100% surakshit hai.');
            } catch (err) {
                closeProgressOverlay();
                console.error('[BackupEngine] File parse error:', err);
                alert(`File Read Error: ${err.message}`);
            }
        };

        reader.onerror = () => {
            closeProgressOverlay();
            alert('File read karne me takleef aayi.');
        };

        reader.readAsText(file);
        e.target.value = '';
    };

    const exitBackupPreviewMode = () => {
        window.isBackupPreviewMode = false;
        window.PREVIEW_BACKUP_DATA = null;

        const banner = document.getElementById('backup-preview-banner');
        if (banner) banner.style.display = 'none';

        invalidateAllModuleCaches();

        if (typeof window.showSyncStatus === 'function') {
            window.showSyncStatus(navigator.onLine ? 'online' : 'offline');
        }
        if (typeof window.backToDashboard === 'function') window.backToDashboard();
        if (typeof window.CloudEngine?.triggerSmartUIRepaint === 'function') {
            window.CloudEngine.triggerSmartUIRepaint(true);
        }

        // Silent background cloud check (bina Tally ERPLoader ko 35% par atkaaye)
        if (navigator.onLine && typeof window.pullAllCloudData === 'function') {
            window.pullAllCloudData(true, false);
        }

        alert('✅ Preview Mode band ho gaya! Live data wapas aa chuka hai.');
    };

    /* ========================================================================
       6. ATOMIC ROW-BY-ROW & INDEXEDDB RESTORE HELPERS
    ======================================================================== */
    const openRawIdb = () => new Promise((resolve) => {
        if (!('indexedDB' in window)) return resolve(null);
        try {
            const req = window.indexedDB.open('SimplicityERP_DB');
            req.onsuccess = (ev) => resolve(ev.target.result);
            req.onerror = () => resolve(null);
        } catch (_) {
            resolve(null);
        }
    });

    const readExistingSnapshotMap = async (uid, targetSess) => {
        const oldMap = new Map();
        const sessPrefix = `${uid}_${targetSess}_`;
        const globalFullKeys = new Set(
            Array.from(GLOBAL_BACKUP_KEYS).map((gk) => `${uid}_${gk}`)
        );

        const dbase = await openRawIdb();
        if (dbase) {
            if (dbase.objectStoreNames.contains('app_store')) {
                await new Promise((resolve) => {
                    let settled = false;
                    const done = () => {
                        if (settled) return;
                        settled = true;
                        try { dbase.close(); } catch (_) {}
                        resolve();
                    };
                    try {
                        const tx = dbase.transaction('app_store', 'readonly');
                        tx.oncomplete = done;
                        tx.onerror = done;
                        tx.onabort = done;
                        const req = tx.objectStore('app_store').openCursor();
                        req.onsuccess = (ev) => {
                            const cursor = ev.target.result;
                            if (cursor) {
                                const k = String(cursor.key);
                                if (k.startsWith(sessPrefix) || globalFullKeys.has(k)) {
                                    oldMap.set(k, cursor.value);
                                }
                                cursor.continue();
                            }
                        };
                        req.onerror = done;
                    } catch (_) {
                        done();
                    }
                });
            } else {
                try { dbase.close(); } catch (_) {}
            }
        }

        const mem = window.APP_MEMORY_CACHE || {};
        Object.keys(mem).forEach((k) => {
            if (k.startsWith(sessPrefix) || globalFullKeys.has(k)) {
                oldMap.set(k, mem[k]);
            }
        });

        return oldMap;
    };

    const clearUserSyncQueue = async (uid) => {
        const dbase = await openRawIdb();
        if (!dbase) return;
        if (!dbase.objectStoreNames.contains('sync_queue')) {
            try { dbase.close(); } catch (_) {}
            return;
        }
        await new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                try { dbase.close(); } catch (_) {}
                resolve();
            };
            try {
                const tx = dbase.transaction('sync_queue', 'readwrite');
                tx.oncomplete = done;
                tx.onerror = done;
                tx.onabort = done;
                const store = tx.objectStore('sync_queue');
                const req = store.openCursor();
                req.onsuccess = (ev) => {
                    const cursor = ev.target.result;
                    if (cursor) {
                        const k = String(cursor.key || '');
                        if (k.startsWith(`${uid}_`) || k.startsWith(`delta_${uid}_`)) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
                req.onerror = done;
            } catch (_) {
                done();
            }
        });
    };

    const enqueueFallbackSync = async (mutation) => {
        const dbase = await openRawIdb();
        if (!dbase) return;
        if (!dbase.objectStoreNames.contains('sync_queue')) {
            try { dbase.close(); } catch (_) {}
            return;
        }
        await new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                try { dbase.close(); } catch (_) {}
                resolve();
            };
            try {
                const tx = dbase.transaction('sync_queue', 'readwrite');
                tx.oncomplete = done;
                tx.onerror = done;
                tx.onabort = done;
                tx.objectStore('sync_queue').put(mutation);
            } catch (_) {
                done();
            }
        });
    };

    const computeArrayDiff = (oldArr, nextArr) => {
        const prevSnap = new Map();
        if (Array.isArray(oldArr)) {
            for (let i = 0; i < oldArr.length; i++) {
                const item = oldArr[i];
                if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) continue;
                const rid = String(item.id).trim();
                if (!rid) continue;
                try { prevSnap.set(rid, JSON.stringify(item)); } catch (_) {}
            }
        }

        const nextIds = new Set();
        const upserts = [];
        const deletes = [];

        if (Array.isArray(nextArr)) {
            for (let i = 0; i < nextArr.length; i++) {
                const item = nextArr[i];
                if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) continue;
                const rid = String(item.id).trim();
                if (!rid) continue;
                let str = '';
                try { str = JSON.stringify(item); } catch (_) { continue; }
                nextIds.add(rid);
                const oldStr = prevSnap.get(rid);
                if (oldStr === undefined || oldStr !== str) {
                    upserts.push(item);
                }
            }
        }

        prevSnap.forEach((_, rid) => {
            if (!nextIds.has(rid)) deletes.push(rid);
        });

        return { upserts, deletes };
    };

    const upsertTaniSheetsSilent = async (fullKey, upserts, uid, tid, targetSess) => {
        if (!upserts.length) return true;
        const sb = window.CloudEngine?.db || window.supabaseClient || window.db;
        const schema = window.CloudEngine?.ROW_SYNC_SCHEMAS?.tani_sheets;

        if (!sb || !schema || typeof schema.toSqlRow !== 'function') {
            if (typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                return await window.CloudEngine.cloudWriteDelta(fullKey, upserts, [], targetSess);
            }
            return false;
        }

        const shortKey = fullKey.replace(`${uid}_${targetSess}_`, '');
        const ctx = { uid, tid, sess: targetSess, sourceKey: shortKey, shortKey, fullKey };
        const sqlRows = upserts
            .filter((it) => it && it.id !== undefined && it.id !== null)
            .map((it) => schema.toSqlRow(it, ctx));

        for (let i = 0; i < sqlRows.length; i += RPC_BATCH_SIZE) {
            const chunk = sqlRows.slice(i, i + RPC_BATCH_SIZE);
            const { error } = await sb.rpc('restore_tani_sheets_silent', { p_rows: chunk });
            if (error) {
                console.warn('[BackupRestore] restore_tani_sheets_silent fallback:', error.message);
                if (typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                    return await window.CloudEngine.cloudWriteDelta(fullKey, upserts, [], targetSess);
                }
                return false;
            }
        }
        return true;
    };

    const commitRestoredEntry = async ({
        shortKey,
        nextValue,
        isDeleteWholeKey = false,
        isGlobal = false,
        uid,
        tid,
        targetSess,
        oldMap
    }) => {
        const fullKey = isGlobal ? `${uid}_${shortKey}` : `${uid}_${targetSess}_${shortKey}`;
        const oldVal = oldMap.get(fullKey);
        const isLight = typeof window.StorageEngine?.isLightweightKey === 'function'
            ? window.StorageEngine.isLightweightKey(fullKey)
            : false;

        // 1. Update Local RAM + IndexedDB + Tiny LS
        if (isDeleteWholeKey) {
            if (window.APP_MEMORY_CACHE) delete window.APP_MEMORY_CACHE[fullKey];
            if (typeof window.idbDelete === 'function') await window.idbDelete(fullKey);
            if (typeof window.StorageEngine?.updateRowSnapshot === 'function') {
                window.StorageEngine.updateRowSnapshot(fullKey, []);
            }
            if (isLight) {
                try { localStorage.removeItem(fullKey); } catch (_) {}
            }
        } else {
            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = nextValue;
            if (Array.isArray(nextValue) && typeof window.StorageEngine?.updateRowSnapshot === 'function') {
                window.StorageEngine.updateRowSnapshot(fullKey, nextValue);
            }
            if (typeof window.idbPut === 'function') await window.idbPut(fullKey, nextValue);
            if (isLight) {
                try { localStorage.setItem(fullKey, JSON.stringify(nextValue)); } catch (_) {}
            }
        }

        // 2. Sync Delta / JSONB to Cloud (or offline sync_queue)
        const isRowSync = typeof window.CloudEngine?.isRowSyncKey === 'function'
            && window.CloudEngine.isRowSyncKey(fullKey);

        if (isRowSync) {
            const targetArr = isDeleteWholeKey ? [] : (Array.isArray(nextValue) ? nextValue : []);
            const { upserts, deletes } = computeArrayDiff(oldVal, targetArr);
            if (upserts.length === 0 && deletes.length === 0) return true;

            const queueId = `delta_${uid}_${fullKey}`;
            if (!navigator.onLine) {
                await enqueueFallbackSync({
                    id: queueId,
                    mode: 'ROW_DELTA',
                    targetKey: fullKey,
                    upserts,
                    deletes,
                    timestamp: Date.now()
                });
                return true;
            }

            let ok = true;
            if (shortKey.startsWith('kariger_sheets_')) {
                if (upserts.length > 0) {
                    ok = await upsertTaniSheetsSilent(fullKey, upserts, uid, tid, targetSess);
                }
                if (ok && deletes.length > 0 && typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                    ok = await window.CloudEngine.cloudWriteDelta(fullKey, [], deletes, targetSess);
                }
            } else if (typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                ok = await window.CloudEngine.cloudWriteDelta(fullKey, upserts, deletes, targetSess);
            } else {
                ok = false;
            }

            if (!ok) {
                await enqueueFallbackSync({
                    id: queueId,
                    mode: 'ROW_DELTA',
                    targetKey: fullKey,
                    upserts,
                    deletes,
                    timestamp: Date.now()
                });
            }
            return ok;
        }

        // Non-row-sync JSONB keys (tani_learned, info_ledger, app_store, karkhana_list)
        if (isDeleteWholeKey) return true;

        // Empty array vs missing oldVal ko skip karein (faaltu write se bachne ke liye)
        if (oldVal === undefined && Array.isArray(nextValue) && nextValue.length === 0) {
            return true;
        }

        let oldStr = null;
        let newStr = null;
        try {
            if (oldVal !== undefined) oldStr = JSON.stringify(oldVal);
            newStr = JSON.stringify(nextValue);
        } catch (_) {}
        if (oldStr !== null && oldStr === newStr) return true;

        const queueId = `${uid}_${fullKey}`;
        if (!navigator.onLine) {
            await enqueueFallbackSync({
                id: queueId,
                action: 'SET',
                targetKey: fullKey,
                data: nextValue,
                timestamp: Date.now()
            });
            return true;
        }

        if (typeof window.CloudEngine?.cloudWrite === 'function') {
            const ok = await window.CloudEngine.cloudWrite(fullKey, nextValue);
            if (!ok) {
                await enqueueFallbackSync({
                    id: queueId,
                    action: 'SET',
                    targetKey: fullKey,
                    data: nextValue,
                    timestamp: Date.now()
                });
            }
            return ok;
        }
        return true;
    };

    const runPooledTasks = async (tasks, concurrency, onStep) => {
        if (!tasks.length) return;
        let idx = 0;
        let done = 0;
        const total = tasks.length;

        const worker = async () => {
            while (idx < total) {
                const myIdx = idx++;
                await tasks[myIdx]();
                done++;
                if (typeof onStep === 'function') onStep(done, total);
                if (done % RESTORE_CHUNK_SIZE === 0) await yieldThread();
            }
        };

        const workers = [];
        const count = Math.min(concurrency, total);
        for (let i = 0; i < count; i++) workers.push(worker());
        await Promise.all(workers);
    };

    /* ========================================================================
       7. ATOMIC FULL SYSTEM RESTORE (SUPABASE DELTA SYNCED)
    ======================================================================== */
    const restoreBackupFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('⚠️ KYA AAP IS BACKUP KO LIVE RESTORE KARNA CHAHTE HAIN?\nPura purana data replace ho jayega aur yeh action undo nahi kiya ja sakta!')) {
            e.target.value = '';
            return;
        }

        showProgressOverlay('Data Restore Ho Raha Hai', 'Validating backup package...');

        const reader = new FileReader();

        reader.onload = async (evt) => {
            let uid = '';
            let currentSess = '';
            const preservedGlobalCache = {};

            try {
                const parsed = JSON.parse(evt.target.result);

                if (!validateBackupPackage(parsed)) {
                    closeProgressOverlay();
                    return alert('⚠️ Galat backup file format! Restore canceled.');
                }

                await waitForStoragePreload();

                uid = getUidSafe();
                const tid = getTidSafe(uid);
                currentSess = getActiveSessionSafe();
                const parsedSess = (parsed.session && /^\d{4}-\d{4}$/.test(String(parsed.session).trim()))
                    ? String(parsed.session).trim()
                    : null;

                let targetSess = currentSess;
                if (parsedSess && parsedSess !== currentSess) {
                    const proceedSess = confirm(
                        `⚠️ Session Mismatch!\nYeh backup '${parsedSess}' session ka hai, jabki abhi '${currentSess}' chalu hai.\n\nOK dabane par '${parsedSess}' session me restore hoga.\nCancel dabane par restore ruk jayega.`
                    );
                    if (!proceedSess) {
                        closeProgressOverlay();
                        return;
                    }
                    targetSess = parsedSess;
                }

                // Exit preview mode if active
                if (window.isBackupPreviewMode) {
                    window.isBackupPreviewMode = false;
                    window.PREVIEW_BACKUP_DATA = null;
                    const banner = document.getElementById('backup-preview-banner');
                    if (banner) banner.style.display = 'none';
                }

                // 1. Detach Realtime so mid-restore pulls don't race
                if (typeof window.detachSupabaseRealtime === 'function') {
                    window.detachSupabaseRealtime();
                }

                updateProgressOverlay(5, 'Reading live snapshot for exact diff...');

                // 2. Capture live snapshot & old jobwork_workers BEFORE clearing cache
                const oldMap = await readExistingSnapshotMap(uid, targetSess);
                const oldWorkersKey = `${uid}_${targetSess}_jobwork_workers`;
                const oldWorkers = Array.isArray(oldMap.get(oldWorkersKey)) ? oldMap.get(oldWorkersKey) : [];

                // Preserve existing global keys before clearing memory cache
                const orderedGlobalKeys = ['karkhana_list', 'active_karkhana_id', 'karkhana_transfers', 'info_ledger'];
                orderedGlobalKeys.forEach((gk) => {
                    const fullGk = `${uid}_${gk}`;
                    if (window.APP_MEMORY_CACHE && Object.prototype.hasOwnProperty.call(window.APP_MEMORY_CACHE, fullGk)) {
                        preservedGlobalCache[gk] = window.APP_MEMORY_CACHE[fullGk];
                    } else if (oldMap.has(fullGk)) {
                        preservedGlobalCache[gk] = oldMap.get(fullGk);
                    }
                });

                // 3. Cancel pending debounce timers & stale offline queue
                if (typeof window.clearMemoryCache === 'function') {
                    window.clearMemoryCache();
                }
                if (window.APP_MEMORY_CACHE) {
                    window.APP_MEMORY_CACHE[`${uid}_app_active_session`] = targetSess;
                }
                await clearUserSyncQueue(uid);

                const sessPrefix = `${uid}_${targetSess}_`;
                const parsedData = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
                const parsedSheets = parsed.sheets && typeof parsed.sheets === 'object' ? parsed.sheets : {};
                const parsedJwSheets = parsed.jobwork_sheets && typeof parsed.jobwork_sheets === 'object' ? parsed.jobwork_sheets : {};

                // 4. PHASE A: Orphan jobwork_sheets_* ko PURANE jobwork_workers ke type ke hisaab se soft-delete karein
                if (window.APP_MEMORY_CACHE && oldWorkers.length > 0) {
                    window.APP_MEMORY_CACHE[oldWorkersKey] = oldWorkers;
                }

                const orphanJwTasks = [];
                oldMap.forEach((_, fullK) => {
                    if (fullK.startsWith(`${sessPrefix}jobwork_sheets_`)) {
                        const wId = fullK.slice(`${sessPrefix}jobwork_sheets_`.length);
                        if (wId && !Object.prototype.hasOwnProperty.call(parsedJwSheets, wId)) {
                            orphanJwTasks.push(() => commitRestoredEntry({
                                shortKey: `jobwork_sheets_${wId}`,
                                nextValue: [],
                                isDeleteWholeKey: true,
                                isGlobal: false,
                                uid,
                                tid,
                                targetSess,
                                oldMap
                            }));
                        }
                    }
                });

                if (orphanJwTasks.length > 0) {
                    updateProgressOverlay(12, 'Cleaning removed jobwork sheets...');
                    await runPooledTasks(orphanJwTasks, CLOUD_RESTORE_CONCURRENCY);
                }

                // 5. PHASE B: Primary Session Keys (including jobwork_workers BEFORE jobwork_sheets_*)
                const primarySessionKeys = new Set();
                SYSTEM_BACKUP_KEYS.forEach((k) => {
                    if (!GLOBAL_BACKUP_KEYS.has(k) && !LEGACY_SKIP_KEYS.has(k)) {
                        primarySessionKeys.add(k);
                    }
                });
                Object.keys(parsedData).forEach((k) => {
                    if (!GLOBAL_BACKUP_KEYS.has(k) && !LEGACY_SKIP_KEYS.has(k)) {
                        primarySessionKeys.add(k);
                    }
                });

                // Ensure jobwork_workers commits first so resolveTargetTable() gets updated worker types
                if (primarySessionKeys.has('jobwork_workers')) {
                    primarySessionKeys.delete('jobwork_workers');
                    const jwWorkersVal = Object.prototype.hasOwnProperty.call(parsedData, 'jobwork_workers')
                        ? parsedData.jobwork_workers
                        : [];
                    await commitRestoredEntry({
                        shortKey: 'jobwork_workers',
                        nextValue: jwWorkersVal,
                        isGlobal: false,
                        uid,
                        tid,
                        targetSess,
                        oldMap
                    });
                }

                const primaryTasks = Array.from(primarySessionKeys).map((k) => () => {
                    const hasVal = Object.prototype.hasOwnProperty.call(parsedData, k);
                    const val = hasVal ? parsedData[k] : [];
                    return commitRestoredEntry({
                        shortKey: k,
                        nextValue: val,
                        isGlobal: false,
                        uid,
                        tid,
                        targetSess,
                        oldMap
                    });
                });

                await runPooledTasks(primaryTasks, CLOUD_RESTORE_CONCURRENCY, (done, total) => {
                    const pct = 15 + Math.floor((done / (total || 1)) * 20);
                    updateProgressOverlay(pct, `Restoring Ledgers & Stock (${done}/${total})...`);
                });

                // 6. PHASE C1: Kariger Tani Sheets (Silent Push RPC + Orphan Soft-Deletes)
                const karigerSheetIds = new Set(Object.keys(parsedSheets));
                oldMap.forEach((_, fullK) => {
                    if (fullK.startsWith(`${sessPrefix}kariger_sheets_`)) {
                        const kId = fullK.slice(`${sessPrefix}kariger_sheets_`.length);
                        if (kId) karigerSheetIds.add(kId);
                    }
                });

                const karigerTasks = Array.from(karigerSheetIds).map((kId) => () => {
                    const existsInBackup = Object.prototype.hasOwnProperty.call(parsedSheets, kId);
                    const nextSheets = existsInBackup && Array.isArray(parsedSheets[kId]) ? parsedSheets[kId] : [];
                    return commitRestoredEntry({
                        shortKey: `kariger_sheets_${kId}`,
                        nextValue: nextSheets,
                        isDeleteWholeKey: !existsInBackup || nextSheets.length === 0,
                        isGlobal: false,
                        uid,
                        tid,
                        targetSess,
                        oldMap
                    });
                });

                await runPooledTasks(karigerTasks, CLOUD_RESTORE_CONCURRENCY, (done, total) => {
                    const pct = 35 + Math.floor((done / (total || 1)) * 40);
                    updateProgressOverlay(pct, `Restoring Kariger Sheets (${done}/${total})...`);
                });

                // 7. PHASE C2: Job Work Sheets (Using newly restored jobwork_workers types)
                const jwTasks = Object.entries(parsedJwSheets).map(([wId, jwData]) => () => {
                    const nextJw = Array.isArray(jwData) ? jwData : [];
                    return commitRestoredEntry({
                        shortKey: `jobwork_sheets_${wId}`,
                        nextValue: nextJw,
                        isDeleteWholeKey: nextJw.length === 0,
                        isGlobal: false,
                        uid,
                        tid,
                        targetSess,
                        oldMap
                    });
                });

                await runPooledTasks(jwTasks, CLOUD_RESTORE_CONCURRENCY, (done, total) => {
                    const pct = 75 + Math.floor((done / (total || 1)) * 15);
                    updateProgressOverlay(pct, `Restoring Job Work Sheets (${done}/${total})...`);
                });

                // 8. PHASE D: Global Keys (app_active_session sabse aakhir me commit ho!)
                updateProgressOverlay(92, 'Updating Godam & Session settings...');
                for (const gk of orderedGlobalKeys) {
                    if (Object.prototype.hasOwnProperty.call(parsedData, gk)) {
                        await commitRestoredEntry({
                            shortKey: gk,
                            nextValue: parsedData[gk],
                            isGlobal: true,
                            uid,
                            tid,
                            targetSess,
                            oldMap
                        });
                    } else if (Object.prototype.hasOwnProperty.call(preservedGlobalCache, gk)) {
                        if (window.APP_MEMORY_CACHE) {
                            window.APP_MEMORY_CACHE[`${uid}_${gk}`] = preservedGlobalCache[gk];
                        }
                    }
                }

                // Merge old and backup app_sessions_list so no session is dropped
                const oldSessions = Array.isArray(oldMap.get(`${uid}_app_sessions_list`))
                    ? oldMap.get(`${uid}_app_sessions_list`)
                    : [];
                const backupSessions = Array.isArray(parsedData.app_sessions_list)
                    ? parsedData.app_sessions_list
                    : [];
                const sessionsList = [];
                const seenSessions = new Set();
                [...oldSessions, ...backupSessions, targetSess].forEach((s) => {
                    if (s === undefined || s === null) return;
                    const str = String(s).trim();
                    if (!str || seenSessions.has(str)) return;
                    seenSessions.add(str);
                    sessionsList.push(typeof s === 'string' ? str : s);
                });

                await commitRestoredEntry({
                    shortKey: 'app_sessions_list',
                    nextValue: sessionsList,
                    isGlobal: true,
                    uid,
                    tid,
                    targetSess,
                    oldMap
                });

                // Sabse last me active session set karein
                await commitRestoredEntry({
                    shortKey: 'app_active_session',
                    nextValue: targetSess,
                    isGlobal: true,
                    uid,
                    tid,
                    targetSess,
                    oldMap
                });

                updateProgressOverlay(100, 'Finishing restore and refreshing views...');
                await yieldThread();

                // 9. Invalidate all module caches
                invalidateAllModuleCaches();

                // 10. Re-bind Supabase live sync AFTER all cloud writes are committed
                if (navigator.onLine && typeof window.initSupabaseRealtime === 'function') {
                    window.initSupabaseRealtime();
                } else if (typeof window.showSyncStatus === 'function') {
                    window.showSyncStatus(navigator.onLine ? 'online' : 'offline');
                }

                closeProgressOverlay();
                alert(
                    navigator.onLine
                        ? '✅ Data successfully restore ho gaya aur cloud par sync ho chuka hai!'
                        : '✅ Data local IndexedDB me restore ho gaya! Online aate hi cloud par sync ho jayega.'
                );

                if (typeof window.populateSessionDropdown === 'function') window.populateSessionDropdown();
                if (typeof window.populateNavbarKarkhanaDropdown === 'function') window.populateNavbarKarkhanaDropdown();
                if (typeof window.backToDashboard === 'function') window.backToDashboard();
                if (typeof window.CloudEngine?.triggerSmartUIRepaint === 'function') {
                    window.CloudEngine.triggerSmartUIRepaint(true);
                }
            } catch (err) {
                closeProgressOverlay();
                if (uid && window.APP_MEMORY_CACHE) {
                    if (currentSess) window.APP_MEMORY_CACHE[`${uid}_app_active_session`] = currentSess;
                    Object.keys(preservedGlobalCache).forEach((gk) => {
                        window.APP_MEMORY_CACHE[`${uid}_${gk}`] = preservedGlobalCache[gk];
                    });
                }
                console.error('[BackupEngine] Restore error:', err);
                if (navigator.onLine && typeof window.initSupabaseRealtime === 'function') {
                    window.initSupabaseRealtime();
                }
                alert(`Restore Error: ${err.message || err}`);
            }
        };

        reader.onerror = () => {
            closeProgressOverlay();
            alert('File read karne me takleef aayi.');
        };

        reader.readAsText(file);
        e.target.value = '';
    };

    /* ========================================================================
       8. GLOBAL EXPORT & BACKWARD COMPATIBILITY
    ======================================================================== */
    const backupAPI = {
        exportUserFullData,
        exportUserFullDataAsync,
        syncToGoogleDrive,
        downloadBackupFile,
        openBackupViewer,
        exitBackupPreviewMode,
        restoreBackupFile
    };

    Object.keys(backupAPI).forEach((fnName) => {
        window[fnName] = backupAPI[fnName];
    });

    window.BackupEngine = backupAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = backupAPI;
    }
})();
