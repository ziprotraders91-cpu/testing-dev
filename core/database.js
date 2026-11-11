/* ============================================================================
   SIMPLICITY ERP - ENTERPRISE AUTO-POLLING & LIVE REALTIME ENGINE (ALL MODULES)
   File: core/database.js • Developed by Farhan Jawed
   Architecture: Loop-Protected Realtime • Smooth Repaint • 100% Reliable Sync
============================================================================ */

(() => {
    'use strict';

    // 🚀 SUPABASE CONFIGURATION
    const SUPABASE_CONFIG = Object.freeze({
        url: "https://mvbejtoylowskerlgfxs.supabase.co",
        anonKey: "sb_publishable_NhTU4xzRMi0gtKH4CzVf_Q_lRfzjg3c"
    });

    let supabaseClient = null;
    let isConnectedToCloud = false;
    let renderDebounceTimer = null;
    let realtimeChannel = null;
    let isSyncingInProgress = false;
    let hasInitialPushed = false;

    try {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            window.supabaseClient = supabaseClient;
            console.log('✅ [CloudEngine] Supabase Realtime Engine Initialized (test-dav).');
        }
    } catch (initErr) {
        console.error('❌ [CloudEngine] Supabase Init failure:', initErr);
    }

    const getSafeUserId = () => {
        try {
            if (window.currentUserProfile && window.currentUserProfile.id) {
                return String(window.currentUserProfile.id).trim();
            }
            const authData = localStorage.getItem('app_active_session_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed.id) return String(parsed.id).trim();
            }
            if (typeof window.getEffectiveUserId === 'function') {
                const id = window.getEffectiveUserId();
                if (id && id !== 'app') return id;
            }
            const stored = localStorage.getItem('currentUserId') || 
                           localStorage.getItem('app_current_user_id') || 
                           sessionStorage.getItem('currentUserId');
            if (stored) {
                const clean = String(stored).trim().replace(/[^a-zA-Z0-9_@-]/g, '');
                if (clean && clean !== 'app') return clean;
            }
        } catch (_) {}
        return '10001';
    };

    const getSafeTenantId = () => {
        try {
            if (window.currentTenantId) return String(window.currentTenantId).trim();
            const stored = localStorage.getItem('app_current_tenant_id') || 
                           localStorage.getItem('tenantId');
            if (stored) return String(stored).trim();
        } catch (_) {}
        return getSafeUserId();
    };

    const getActiveSessionVal = () => {
        try {
            if (typeof window.getActiveFinancialSession === 'function') {
                return window.getActiveFinancialSession();
            }
            const uId = getSafeUserId();
            const stored = localStorage.getItem(`${uId}_app_active_session`) || 
                           localStorage.getItem('app_active_session');
            if (stored) return String(stored).replace(/['"]+/g, '').trim();
        } catch (_) {}
        return '2026-2027';
    };

    const getAllLocalWorkers = () => {
        let workers = [];
        try {
            if (typeof window.getStore === 'function') {
                const w = window.getStore('jobwork_workers');
                if (Array.isArray(w) && w.length > 0) return w;
            }
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('jobwork_workers')) {
                    const parsed = JSON.parse(localStorage.getItem(k) || '[]');
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            }
        } catch (_) {}
        return [];
    };

    const syncWorkersDirectToCuttingAndCalender = async () => {
        if (!supabaseClient || !navigator.onLine) return;

        const uid = getSafeUserId();
        const tid = getSafeTenantId();
        const sess = getActiveSessionVal();
        const now = new Date().toISOString();

        const allWorkers = getAllLocalWorkers();
        if (!allWorkers || allWorkers.length === 0) return;

        const cuttingWorkers = allWorkers.filter(w => String(w?.type || '').toLowerCase() === 'cutting');
        const calenderWorkers = allWorkers.filter(w => String(w?.type || '').toLowerCase() === 'calender');
        const embroideryWorkers = allWorkers.filter(w => String(w?.type || '').toLowerCase() === 'embroidery');

        if (cuttingWorkers.length > 0) {
            await supabaseClient.from('cutting').upsert({
                id: `${uid}_${sess}_cutting_workers`,
                user_id: uid, tenant_id: tid, session: sess,
                data: cuttingWorkers, updated_at: now
            }, { onConflict: 'id' });
        }

        if (calenderWorkers.length > 0) {
            await supabaseClient.from('calender').upsert({
                id: `${uid}_${sess}_calender_workers`,
                user_id: uid, tenant_id: tid, session: sess,
                data: calenderWorkers, updated_at: now
            }, { onConflict: 'id' });
        }

        if (embroideryWorkers.length > 0) {
            await supabaseClient.from('embroidery').upsert({
                id: `${uid}_${sess}_embroidery_workers`,
                user_id: uid, tenant_id: tid, session: sess,
                data: embroideryWorkers, updated_at: now
            }, { onConflict: 'id' });
        }
    };

    const resolveTargetTable = (fullKey) => {
        const k = String(fullKey).toLowerCase();

        if (k.includes('saree_history')) return 'saree_history';
        if (k.includes('saree_stock') || k.includes('saree_items') || k.includes('saree')) return 'saree_stock';

        if (k.includes('zari_history')) return 'zari_history';
        if (k.includes('zari_stock') || k.includes('zari')) return 'zari_stock';

        if (k.includes('bana_history')) return 'bana_history';
        if (k.includes('bana_stock') || k.includes('bana')) return 'bana_stock';

        if (k.includes('sancha_history')) return 'sancha_history';
        if (k.includes('sancha_items') || k.includes('sancha_list') || k.includes('sancha')) return 'sancha_list';

        if (k.includes('kariger_sheet') || k.includes('tani_sheet') || k.includes('tani_sheets')) return 'tani_sheets';
        if (k.includes('kariger_list') || k.includes('karigers') || k.includes('kariger')) return 'karigers';

        if (k.includes('payments') || k.includes('payment_list') || k.includes('kharcha')) return 'payments';

        if (k.includes('material_transfer') || k.includes('transfer')) return 'material_transfers';
        if (k.includes('dukan')) return 'dukan_challans';

        if (k.includes('jobwork_sheets_') || k.includes('jw_sheet_')) {
            const workerId = k.replace(/.*jobwork_sheets_/, '').replace(/.*jw_sheet_/, '');
            const workers = getAllLocalWorkers();
            const found = workers.find(w => w && String(w.id).toLowerCase() === workerId.toLowerCase());
            const wType = String(found?.type || '').toLowerCase();

            if (wType === 'calender') return 'calender_history';
            if (wType === 'embroidery') return 'embroidery_history';
            return 'cutting_history';
        }

        if (k.includes('jobwork_workers') || k.includes('cutting_workers') || k.includes('calender_workers')) {
            return 'WORKERS_SPLIT_ACTION';
        }

        if (k.includes('jw_bill') || k.includes('jobwork_bill') || k.includes('jw_payment') || k.includes('jobwork')) {
            return 'job_work_bills';
        }

        return null;
    };

    const mapCloudKeyToLocalKey = (cloudKey, tableName) => {
        const k = String(cloudKey).toLowerCase();
        if (k.includes('sancha_list') || tableName === 'sancha_list') return 'sancha_items';
        if (k.includes('karigers') || tableName === 'karigers') return 'kariger_list';
        if (tableName === 'job_work_bills' && k.includes('jw_bills_list')) return 'jw_bills_list';
        if (tableName === 'job_work_bills' && k.includes('jw_payments_list')) return 'jw_payments_list';
        return cloudKey;
    };

    const showSyncStatus = (status) => {
        const badge = document.getElementById('cloud-status-badge');
        if (!badge) return;

        if (typeof window.isBackupPreviewMode !== 'undefined' && window.isBackupPreviewMode) {
            badge.className = 'sync-badge';
            badge.style.background = '#fef08a';
            badge.style.color = '#854d0e';
            badge.innerHTML = '👁️ Preview Mode';
            return;
        }

        switch (status) {
            case 'syncing':
                badge.className = 'sync-badge sync-syncing';
                badge.style.background = '#dbeafe';
                badge.style.color = '#1d4ed8';
                badge.innerHTML = '🔄 Syncing...';
                break;
            case 'offline':
                badge.className = 'sync-badge';
                badge.style.background = '#fff7ed';
                badge.style.color = '#ea580c';
                badge.innerHTML = '🟠 Offline Mode';
                break;
            case 'error':
                badge.className = 'sync-badge';
                badge.style.background = '#fee2e2';
                badge.style.color = '#dc2626';
                badge.innerHTML = '⚠️ Sync Error';
                break;
            case 'online':
            default:
                badge.className = 'sync-badge';
                badge.style.background = '#ecfdf5';
                badge.style.color = '#059669';
                badge.innerHTML = '🟢 Cloud Synced';
                break;
        }
    };

    // ⭐ SMOOTH DEBOUNCED REPAINT (Screen bar-bar nahi hilegi)
    const triggerSmartUIRepaint = () => {
        const activeEl = document.activeElement;
        const isUserTyping = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
        if (isUserTyping) return;

        if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
        renderDebounceTimer = setTimeout(() => {
            if (typeof window.renderSheetTabs === 'function') window.renderSheetTabs();
            if (typeof window.renderKarigerTable === 'function') window.renderKarigerTable();
            if (typeof window.renderBanaTable === 'function') window.renderBanaTable();
            if (typeof window.renderZariTable === 'function') window.renderZariTable();
            if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
            if (typeof window.renderSanchaTable === 'function') window.renderSanchaTable();
            if (typeof window.renderJobWorkersTable === 'function') window.renderJobWorkersTable();
            if (typeof window.renderJobWorkMovementDaybook === 'function') window.renderJobWorkMovementDaybook();
            if (typeof window.renderJobWorkBillsTable === 'function') window.renderJobWorkBillsTable();
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.renderDashboardDayBook === 'function') window.renderDashboardDayBook();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        }, 150);
    };

    const smartApplyRemoteData = (targetKey, rowData) => {
        if (!targetKey || rowData === undefined || rowData === null) return false;

        const uid = getSafeUserId();
        const sess = getActiveSessionVal();

        let shortKey = targetKey;
        const prefix = `${uid}_${sess}_`;
        if (shortKey.startsWith(prefix)) {
            shortKey = shortKey.replace(prefix, '');
        }

        const fullStorageKey = (typeof window.getStorageKey === 'function') 
            ? window.getStorageKey(shortKey) 
            : `${uid}_${sess}_${shortKey}`;

        try {
            const currentStr = localStorage.getItem(fullStorageKey);
            const newStr = JSON.stringify(rowData);
            if (currentStr === newStr) return false; // Koi badlaav nahi to repaint mat karo

            if (window.APP_MEMORY_CACHE) {
                window.APP_MEMORY_CACHE[fullStorageKey] = rowData;
                window.APP_MEMORY_CACHE[shortKey] = rowData;
            }
            localStorage.setItem(fullStorageKey, newStr);
            localStorage.setItem(shortKey, newStr);
            if (typeof window.idbPut === 'function') {
                window.idbPut(fullStorageKey, rowData);
            }
            return true;
        } catch (_) {
            return false;
        }
    };

    const cloudWrite = async (fullKey, data) => {
        if (!supabaseClient) return false;

        const targetTable = resolveTargetTable(fullKey);
        if (!targetTable) return false;

        if (targetTable === 'WORKERS_SPLIT_ACTION') {
            await syncWorkersDirectToCuttingAndCalender();
            return true;
        }

        const uid = getSafeUserId();
        const tid = getSafeTenantId();
        const sess = getActiveSessionVal();

        if (!uid) return false;
        showSyncStatus('syncing');

        try {
            const cleanKey = String(fullKey).replace(`${uid}_${sess}_`, '').replace(`${uid}_`, '');
            const recordId = `${uid}_${sess}_${cleanKey}`;

            const payload = {
                id: recordId,
                user_id: uid,
                tenant_id: tid,
                session: sess,
                data: data,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from(targetTable)
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.error(`❌ [Supabase Error in ${targetTable}]:`, error.message);
                showSyncStatus('error');
                return false;
            }

            if (targetTable === 'saree_history' && Array.isArray(data)) {
                try {
                    let groupedStock = [];
                    if (typeof window.groupSareeStockByTab === 'function') {
                        groupedStock = window.groupSareeStockByTab(data, 'fresh', 'all') || [];
                    }
                    if (groupedStock.length > 0) {
                        await supabaseClient.from('saree_stock').upsert({
                            id: `${uid}_${sess}_saree_stock`,
                            user_id: uid, tenant_id: tid, session: sess,
                            data: groupedStock, updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                    }
                } catch (_) {}
            }

            isConnectedToCloud = true;
            showSyncStatus('online');
            return true;
        } catch (err) {
            console.error(`❌ [Supabase Exception]:`, err);
            showSyncStatus('error');
            return false;
        }
    };

    /**
     * 📥 CLOUD PULL (LOOP GUARDED)
     */
    const pullAllCloudData = async (silent = true) => {
        if (!supabaseClient || !navigator.onLine || isSyncingInProgress) return;
        const uid = getSafeUserId();
        if (!uid) return;

        isSyncingInProgress = true;
        if (!silent) showSyncStatus('syncing');

        const tables = [
            'saree_stock', 'saree_history',
            'zari_stock', 'zari_history',
            'bana_stock', 'bana_history',
            'sancha_list', 'sancha_history',
            'karigers', 'tani_sheets', 
            'material_transfers', 'dukan_challans', 
            'payments',
            'cutting', 'cutting_history',
            'embroidery', 'embroidery_history',
            'calender', 'calender_history',
            'job_work_bills'
        ];

        let hasNewData = false;
        const collectedWorkersMap = new Map();

        for (const tbl of tables) {
            try {
                const { data, error } = await supabaseClient
                    .from(tbl)
                    .select('*')
                    .eq('user_id', uid);

                if (!error && data && data.length > 0) {
                    data.forEach((row) => {
                        let localKey = row.id;
                        const sess = getActiveSessionVal();
                        const prefix = `${uid}_${sess}_`;

                        if (localKey.startsWith(prefix)) {
                            localKey = localKey.replace(prefix, '');
                        }

                        if (tbl === 'cutting' || tbl === 'calender' || tbl === 'embroidery') {
                            if (Array.isArray(row.data)) {
                                row.data.forEach(w => {
                                    if (w && w.id) collectedWorkersMap.set(String(w.id), w);
                                });
                            }
                        }

                        const mappedLocalKey = mapCloudKeyToLocalKey(localKey, tbl);
                        if (mappedLocalKey && row.data !== undefined) {
                            const updated = smartApplyRemoteData(mappedLocalKey, row.data);
                            if (updated) hasNewData = true;
                        }
                    });
                }
            } catch (_) {}
        }

        if (collectedWorkersMap.size > 0) {
            const allWorkers = Array.from(collectedWorkersMap.values());
            const updated = smartApplyRemoteData('jobwork_workers', allWorkers);
            if (updated) hasNewData = true;
        }

        // Pehli baar khulne par hi push karo, bar-bar loop me nahi
        if (!hasInitialPushed) {
            hasInitialPushed = true;
            await syncWorkersDirectToCuttingAndCalender();
        }

        isSyncingInProgress = false;

        if (hasNewData || !silent) {
            triggerSmartUIRepaint();
        }
        showSyncStatus('online');
    };

    const initSupabaseRealtime = () => {
        if (!supabaseClient) return;
        detachSupabaseRealtime();
        const uid = getSafeUserId();

        try {
            realtimeChannel = supabaseClient.channel('public_db_realtime')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public' },
                    (payload) => {
                        if (typeof window.isBackupPreviewMode !== 'undefined' && window.isBackupPreviewMode) return;
                        const row = payload.new;
                        // Dusre device ka event aane par hi pull karo, khud ke loop ko roko
                        if (row && row.user_id === uid && !isSyncingInProgress) {
                            pullAllCloudData(true);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        isConnectedToCloud = true;
                        showSyncStatus('online');
                    }
                });

            pullAllCloudData(false);
        } catch (err) {
            console.warn('[CloudEngine] Realtime setup:', err);
        }
    };

    const detachSupabaseRealtime = () => {
        try {
            if (realtimeChannel && supabaseClient) {
                supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
        } catch (_) {}
    };

    const switchSessionListeners = () => { pullAllCloudData(false); };

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine) pullAllCloudData(false);
    });

    window.addEventListener('focus', () => {
        if (navigator.onLine) pullAllCloudData(false);
    });

    const publicCloudAPI = {
        get db() { return supabaseClient; },
        get supabase() { return supabaseClient; },
        get isConnectedToCloud() { return isConnectedToCloud; },
        showSyncStatus,
        initSupabaseRealtime,
        detachSupabaseRealtime,
        initFirebaseLiveListeners: initSupabaseRealtime,
        detachFirebaseLiveListeners: detachSupabaseRealtime,
        switchSessionListeners,
        cloudWrite,
        pullAllCloudData,
        syncWorkersDirectToCuttingAndCalender,
        triggerSmartUIRepaint
    };

    window.db = supabaseClient;
    window.supabaseClient = supabaseClient;
    window.showSyncStatus = showSyncStatus;
    window.initSupabaseRealtime = initSupabaseRealtime;
    window.detachSupabaseRealtime = detachSupabaseRealtime;
    window.CloudEngine = publicCloudAPI;
    window.cloudWrite = cloudWrite;
    window.pullAllCloudData = pullAllCloudData;

    window.addEventListener('online', () => {
        isConnectedToCloud = true;
        showSyncStatus('online');
        initSupabaseRealtime();
    });

    window.addEventListener('offline', () => {
        isConnectedToCloud = false;
        showSyncStatus('offline');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initSupabaseRealtime, 200));
    } else {
        setTimeout(initSupabaseRealtime, 200);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicCloudAPI;
    }
})();
