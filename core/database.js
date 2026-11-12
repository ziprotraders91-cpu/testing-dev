/* ============================================================================
   SIMPLICITY ERP - ENTERPRISE AUTO-POLLING & LIVE REALTIME ENGINE (ALL MODULES)
   File: core/database.js • Developed by Farhan Jawed
   Architecture: 100% Automated Multi-Godam Cloud Synchronizer (Zero Manual Console)
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
            const stored = localStorage.getItem('app_current_user_id') || localStorage.getItem('currentUserId');
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
            const stored = localStorage.getItem('app_current_tenant_id') || localStorage.getItem('tenantId');
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
            const stored = localStorage.getItem(`${uId}_app_active_session`) || localStorage.getItem('app_active_session');
            if (stored) return String(stored).replace(/['"]+/g, '').trim();
        } catch (_) {}
        return '2026-2027';
    };

    /**
     * ⭐ AUTO PUSH KARKHANAS (Main Godown + Bahadurganj)
     */
    const autoPushKarkhanasToSupabase = async () => {
        if (!supabaseClient || !navigator.onLine) return;
        const uid = getSafeUserId();

        let list = [];
        try {
            if (typeof window.getKarkhanasSafe === 'function') {
                list = window.getKarkhanasSafe();
            }
            if (!Array.isArray(list) || list.length === 0) {
                list = JSON.parse(localStorage.getItem('karkhana_list') || localStorage.getItem(`${uid}_karkhana_list`) || '[]');
            }
        } catch (_) {}

        if (!Array.isArray(list) || list.length === 0) {
            list = [
                { id: 'k_main', name: 'Main Godown', isDefault: true },
                { id: 'k_bahadurganj', name: 'Bahadurganj', isDefault: false }
            ];
        }

        try {
            // Purani rows hatao
            await supabaseClient.from('karkhanas').delete().eq('user_id', uid);

            // Nayi rows daalo
            const rows = list.map((k, idx) => ({
                user_id: uid,
                karkhana_name: String(k.name || 'Karkhana').trim(),
                is_default: Boolean(k.isDefault || k.id === 'k_main'),
                created_at: new Date().toISOString()
            }));

            // Pehle bina explicit ID ke daal kar dekho
            let { error } = await supabaseClient.from('karkhanas').insert(rows);

            // Agar table integer ID mangti hai toh ID ke sath daalo
            if (error) {
                const rowsWithId = rows.map((r, i) => ({ ...r, id: i + 1 }));
                await supabaseClient.from('karkhanas').insert(rowsWithId);
            }
            console.log('🟢 [Auto-Sync] karkhanas cloud table updated!');
        } catch (err) {
            console.warn('[autoPushKarkhanasToSupabase]:', err);
        }
    };

    const resolveTargetTable = (fullKey) => {
        const k = String(fullKey).toLowerCase();

        if (k.includes('karkhana_list')) return 'KARKHANA_ACTION';
        if (k.includes('session') || k.includes('app_store') || k.includes('info_ledger')) return 'app_store';
        if (k.includes('saree_history')) return 'saree_history';
        if (k.includes('saree_stock') || k.includes('saree_items') || k.includes('saree')) return 'saree_stock';
        if (k.includes('zari_history')) return 'zari_history';
        if (k.includes('zari_stock') || k.includes('zari')) return 'zari_stock';
        if (k.includes('bana_history')) return 'bana_history';
        if (k.includes('bana_stock') || k.includes('bana')) return 'bana_stock';
        if (k.includes('sancha_history')) return 'sancha_history';
        if (k.includes('sancha_items') || k.includes('sancha_list') || k.includes('sancha')) return 'sancha_list';
        if (k.includes('kariger_sheet') || k.includes('tani_sheet')) return 'tani_sheets';
        if (k.includes('kariger_list') || k.includes('karigers') || k.includes('kariger')) return 'karigers';
        if (k.includes('payments') || k.includes('payment_list')) return 'payments';
        if (k.includes('material_transfer') || k.includes('transfer')) return 'material_transfers';
        if (k.includes('dukan')) return 'dukan_challans';

        // Explicit history passbook routing
        if (k.includes('embroidery_history')) return 'embroidery_history';
        if (k.includes('cutting_history')) return 'cutting_history';
        if (k.includes('calender_history')) return 'calender_history';

        // ⭐ KHATA SHEETS ROUTING (Kariger Type ke anusaar Master Table me)
        if (k.includes('jobwork_sheets_') || k.includes('jw_sheet_')) {
            const workerId = k.replace(/.*jobwork_sheets_/, '').replace(/.*jw_sheet_/, '');
            let workers = [];
            try {
                if (typeof window.getStore === 'function') workers = window.getStore('jobwork_workers') || [];
                if (!workers.length) workers = JSON.parse(localStorage.getItem('jobwork_workers') || '[]');
            } catch (_) {}
            const found = workers.find(w => w && String(w.id).toLowerCase() === workerId.toLowerCase());
            const wType = String(found?.type || '').toLowerCase();

            if (wType === 'embroidery') return 'embroidery';
            if (wType === 'calender') return 'calender';
            return 'cutting';
        }

        // ⭐ JOB WORK KARIGERS (Routing to respective tables)
        if (k.includes('jobwork_workers') || k.includes('cutting_workers') || k.includes('calender_workers') || k.includes('embroidery_workers')) {
            return 'WORKERS_ACTION';
        }

        if (k.includes('jw_bill') || k.includes('jobwork_bill') || k.includes('jw_payment')) {
            return 'job_work_bills';
        }

        return 'app_store';
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

    const triggerSmartUIRepaint = () => {
        const activeEl = document.activeElement;
        const isUserTyping = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
        if (isUserTyping) return;

        if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
        renderDebounceTimer = setTimeout(() => {
            if (typeof window.populateNavbarKarkhanaDropdown === 'function') window.populateNavbarKarkhanaDropdown();
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
            if (currentStr === newStr) return false;

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

        if (targetTable === 'KARKHANA_ACTION') {
            await autoPushKarkhanasToSupabase();
            return true;
        }

        const uid = getSafeUserId();
        const tid = getSafeTenantId();
        const sess = getActiveSessionVal();

        if (!uid) return false;
        showSyncStatus('syncing');

        try {
            // ⭐ 1. WORKERS SYNC (Embroidery, Cutting, Calender)
            if (targetTable === 'WORKERS_ACTION') {
                const workersList = Array.isArray(data) ? data : [];

                // Master copy app_store me taaki data safe rahe
                try {
                    await supabaseClient.from('app_store').upsert({
                        id: `${uid}_${sess}_jobwork_workers`,
                        user_id: uid, tenant_id: tid, session: sess,
                        key: 'jobwork_workers',
                        data: workersList,
                        value: workersList,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                } catch (_) {}

                // Embroidery Table (Embroidery Karigers)
                try {
                    const embWorkers = workersList.filter(w => String(w?.type || '').toLowerCase() === 'embroidery');
                    await supabaseClient.from('embroidery').upsert({
                        id: `${uid}_${sess}_embroidery_workers`,
                        user_id: uid, tenant_id: tid, session: sess,
                        data: embWorkers,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                } catch (_) {}

                // Cutting Table (Cutting Karigers)
                try {
                    const cutWorkers = workersList.filter(w => String(w?.type || '').toLowerCase() === 'cutting');
                    await supabaseClient.from('cutting').upsert({
                        id: `${uid}_${sess}_cutting_workers`,
                        user_id: uid, tenant_id: tid, session: sess,
                        data: cutWorkers,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                } catch (_) {}

                // Calender Table (Calender Karigers)
                try {
                    const calWorkers = workersList.filter(w => String(w?.type || '').toLowerCase() === 'calender');
                    await supabaseClient.from('calender').upsert({
                        id: `${uid}_${sess}_calender_workers`,
                        user_id: uid, tenant_id: tid, session: sess,
                        data: calWorkers,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                } catch (_) {}

                isConnectedToCloud = true;
                showSyncStatus('online');
                return true;
            }

            const cleanKey = String(fullKey).replace(`${uid}_${sess}_`, '').replace(`${uid}_`, '');
            const recordId = `${uid}_${sess}_${cleanKey}`;

            if (targetTable === 'app_store') {
                await supabaseClient.from('app_store').delete().eq('id', recordId);
                await supabaseClient.from('app_store').insert({
                    id: recordId,
                    user_id: uid,
                    tenant_id: tid,
                    session: sess,
                    data: data,
                    key: String(fullKey),
                    value: data,
                    updated_at: new Date().toISOString()
                });
                isConnectedToCloud = true;
                showSyncStatus('online');
                return true;
            }

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

            // ⭐ 2. PASSBOOK / LEN-DEN SYNC (Aai, Gai, Kab Aai) TO RESPECTIVE HISTORY TABLES
            if (targetTable === 'saree_history' && Array.isArray(data)) {
                // Saree stock grouped
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

                // 🪡 Embroidery Passbook History -> embroidery_history
                try {
                    const embHistory = data.filter(r => {
                        if (!r) return false;
                        const t = String(r.type || '').toLowerCase();
                        const lbl = String(r.typeLabel || '').toLowerCase();
                        const p = String(r.partyName || r.targetWorker || r.note || '').toLowerCase();
                        return t === 'embroidery' || lbl.includes('embroidery') || p.includes('embroidery') || lbl.includes('कढ़ाई');
                    });
                    if (embHistory.length > 0) {
                        await supabaseClient.from('embroidery_history').upsert({
                            id: `${uid}_${sess}_embroidery_history`,
                            user_id: uid, tenant_id: tid, session: sess,
                            data: embHistory, updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                    }
                } catch (_) {}

                // ✂️ Cutting Passbook History -> cutting_history
                try {
                    const cutHistory = data.filter(r => {
                        if (!r) return false;
                        const t = String(r.type || '').toLowerCase();
                        const lbl = String(r.typeLabel || '').toLowerCase();
                        const p = String(r.partyName || r.targetWorker || r.note || '').toLowerCase();
                        return t === 'cutting' || lbl.includes('cutting') || p.includes('cutting') || lbl.includes('कटिंग');
                    });
                    if (cutHistory.length > 0) {
                        await supabaseClient.from('cutting_history').upsert({
                            id: `${uid}_${sess}_cutting_history`,
                            user_id: uid, tenant_id: tid, session: sess,
                            data: cutHistory, updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                    }
                } catch (_) {}

                // 🎛️ Calender Passbook History -> calender_history
                try {
                    const calHistory = data.filter(r => {
                        if (!r) return false;
                        const t = String(r.type || '').toLowerCase();
                        const lbl = String(r.typeLabel || '').toLowerCase();
                        const p = String(r.partyName || r.targetWorker || r.note || '').toLowerCase();
                        return t === 'finished' || lbl.includes('calender') || p.includes('calender') || lbl.includes('कैलेंडर');
                    });
                    if (calHistory.length > 0) {
                        await supabaseClient.from('calender_history').upsert({
                            id: `${uid}_${sess}_calender_history`,
                            user_id: uid, tenant_id: tid, session: sess,
                            data: calHistory, updated_at: new Date().toISOString()
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

    const pullAllCloudData = async (silent = true) => {
        if (!supabaseClient || !navigator.onLine || isSyncingInProgress) return;
        const uid = getSafeUserId();
        if (!uid) return;

        isSyncingInProgress = true;
        if (!silent) showSyncStatus('syncing');

        // ⭐ 1. Karkhanas table auto-sync
        try {
            const { data: kData } = await supabaseClient.from('karkhanas').select('*').eq('user_id', uid);
            if (Array.isArray(kData) && kData.length > 0) {
                const kList = kData.map(row => ({
                    id: row.is_default ? 'k_main' : `k_${row.id}`,
                    name: row.karkhana_name,
                    isDefault: Boolean(row.is_default)
                }));
                smartApplyRemoteData('karkhana_list', kList);
            } else {
                await autoPushKarkhanasToSupabase();
            }
        } catch (_) {}

        // ⭐ 2. Baaki Sabhi Tables
        const tables = [
            'app_store',
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

        for (const tbl of tables) {
            try {
                const { data, error } = await supabaseClient
                    .from(tbl)
                    .select('*')
                    .eq('user_id', uid);

                if (!error && data && data.length > 0) {
                    data.forEach((row) => {
                        let localKey = row.id || row.key;
                        const sess = getActiveSessionVal();
                        const prefix = `${uid}_${sess}_`;

                        if (localKey && localKey.startsWith(prefix)) {
                            localKey = localKey.replace(prefix, '');
                        }

                        const mappedLocalKey = mapCloudKeyToLocalKey(localKey, tbl);
                        const rowData = row.data !== undefined ? row.data : (row.value !== undefined ? row.value : row);

                        if (mappedLocalKey && rowData !== undefined) {
                            // Agar workers table se aa raha hai toh local jobwork_workers me merge karein
                            if (mappedLocalKey === 'embroidery_workers' || mappedLocalKey === 'cutting_workers' || mappedLocalKey === 'calender_workers') {
                                const existing = (typeof window.getStore === 'function') 
                                    ? (window.getStore('jobwork_workers') || []) 
                                    : JSON.parse(localStorage.getItem('jobwork_workers') || '[]');
                                const incomingType = mappedLocalKey.replace('_workers', '');
                                const others = existing.filter(w => String(w?.type || '').toLowerCase() !== incomingType);
                                const merged = [...others, ...(Array.isArray(rowData) ? rowData : [])];
                                const updated = smartApplyRemoteData('jobwork_workers', merged);
                                if (updated) hasNewData = true;
                            } else {
                                const updated = smartApplyRemoteData(mappedLocalKey, rowData);
                                if (updated) hasNewData = true;
                            }
                        }
                    });
                }
            } catch (_) {}
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
                        if (!row || row.user_id !== uid) return;

                        const rKey = String(row.key || row.id || '');
                        if (rKey.includes('app_active_session')) {
                            const cloudActiveSess = String(row.data !== undefined ? row.data : row.value).replace(/['"]+/g, '').trim();
                            const currentLocalSess = getActiveSessionVal();

                            if (/^\d{4}-\d{4}$/.test(cloudActiveSess) && cloudActiveSess !== currentLocalSess) {
                                localStorage.setItem(`${uid}_app_active_session`, cloudActiveSess);
                                window.location.reload();
                                return;
                            }
                        }

                        if (!isSyncingInProgress) {
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
        switchSessionListeners,
        cloudWrite,
        pullAllCloudData,
        autoPushKarkhanasToSupabase,
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
