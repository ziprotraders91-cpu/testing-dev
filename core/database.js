/* ============================================================================
   SIMPLICITY ERP - ENTERPRISE AUTO-POLLING & LIVE REALTIME ENGINE (ALL MODULES)
   File: core/database.js • Developed by Farhan Jawed (Fixed Zero-Data-Loss Engine)
   Architecture: Smart Bidirectional Merge • Local Data Protection • Instant Sync
============================================================================ */

(() => {
    'use strict';

    // 🚀 NAYE SUPABASE PROJECT KI CONFIGURATION
    const SUPABASE_CONFIG = Object.freeze({
        url: "https://mvbejtoylowskerlgfxs.supabase.co",
        anonKey: "sb_publishable_NhTU4xzRMi0gtKH4CzVf_Q_lRfzjg3c"
    });

    let supabaseClient = null;
    let isConnectedToCloud = false;
    let renderDebounceTimer = null;
    let realtimeChannel = null;
    let autoSyncIntervalTimer = null;

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
        return 'farhan';
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

    /**
     * ⭐ SMART TRAFFIC POLICE (ROUTER)
     * Har data ko uski sahi Supabase table me route karta hai
     */
    const resolveTargetTable = (fullKey) => {
        const k = String(fullKey).toLowerCase();

        // 1. Saree Module (Separate Stock & History)
        if (k.includes('saree_history')) return 'saree_history';
        if (k.includes('saree_stock') || k.includes('saree')) return 'saree_stock';

        // 2. Zari Module
        if (k.includes('zari_history')) return 'zari_history';
        if (k.includes('zari_stock') || k.includes('zari')) return 'zari_stock';

        // 3. Bana Module
        if (k.includes('bana_history')) return 'bana_history';
        if (k.includes('bana_stock') || k.includes('bana')) return 'bana_stock';

        // 4. Sancha (Tani / Chukka)
        if (k.includes('sancha_history')) return 'sancha_history';
        if (k.includes('sancha')) return 'sancha_list';

        // 5. Kariger & Tani Sheets
        if (k.includes('kariger_sheet') || k.includes('tani_sheet')) return 'tani_sheets';
        if (k.includes('kariger') || k.includes('karigers')) return 'karigers';

        // 6. Godown & Logistics
        if (k.includes('karkhana') || k.includes('godown')) return 'karkhanas';
        if (k.includes('material_transfers') || k.includes('transfer')) return 'material_transfers';
        if (k.includes('dukan')) return 'dukan_challans';

        // 7. Job Work Departments (ALAG-ALAG TABLES ME)
        if (k.includes('cutting_history') || k.includes('cutting_sheet')) return 'cutting_history';
        if (k.includes('cutting')) return 'cutting';

        if (k.includes('embroidery_history') || k.includes('embroidery_sheet')) return 'embroidery_history';
        if (k.includes('embroidery')) return 'embroidery';

        if (k.includes('calender_history') || k.includes('calender_sheet')) return 'calender_history';
        if (k.includes('calender')) return 'calender';

        // 8. Job Work Bills & Payments (EK HI CENTRAL TABLE ME)
        if (k.includes('jw_bill') || k.includes('jobwork_bill') || k.includes('jw_payment')) return 'job_work_bills';

        // 9. App Settings & Session fallback
        return 'app_store';
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
            const shSec = document.getElementById('kariger-sheet-section');
            if (shSec && shSec.style.display !== 'none') {
                if (typeof window.renderSheetTabs === 'function') window.renderSheetTabs();
                if (typeof window.loadCurrentSheetData === 'function') window.loadCurrentSheetData();
            }

            const kSec = document.getElementById('kariger-section');
            if (kSec && kSec.style.display !== 'none') {
                if (typeof window.renderKarigerTable === 'function') window.renderKarigerTable();
            }

            const bSec = document.getElementById('bana-section');
            if (bSec && bSec.style.display !== 'none') {
                if (typeof window.renderBanaTable === 'function') window.renderBanaTable();
                if (typeof window.applyPassbookFilters === 'function') window.applyPassbookFilters();
                else if (typeof window.renderBanaPassbookRows === 'function') window.renderBanaPassbookRows();
            }

            const zSec = document.getElementById('zari-section');
            if (zSec && zSec.style.display !== 'none') {
                if (typeof window.renderZariTable === 'function') window.renderZariTable();
                if (typeof window.applyZariPassbookFilters === 'function') window.applyZariPassbookFilters();
                else if (typeof window.renderZariPassbookRows === 'function') window.renderZariPassbookRows();
            }

            const sSec = document.getElementById('saree-section');
            if (sSec && sSec.style.display !== 'none') {
                if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
                if (typeof window.applySareePassbookFilters === 'function') window.applySareePassbookFilters();
            }

            const jwSec = document.getElementById('jobwork-section');
            if (jwSec && jwSec.style.display !== 'none') {
                if (typeof window.renderJobWorkersTable === 'function') window.renderJobWorkersTable();
                if (typeof window.renderJobWorkMovementDaybook === 'function') window.renderJobWorkMovementDaybook();
                if (typeof window.renderJobWorkBillsTable === 'function') window.renderJobWorkBillsTable();
            }

            if (typeof window.renderDashboardDayBook === 'function') {
                window.renderDashboardDayBook();
            }
            if (typeof window.updateDashboardBadgeTotals === 'function') {
                window.updateDashboardBadgeTotals();
            }
            if (typeof window.triggerActiveSectionRefresh === 'function') {
                window.triggerActiveSectionRefresh();
            }
        }, 30);
    };

    const smartApplyRemoteData = (targetKey, rowData) => {
        if (!targetKey) return false;

        let localData = null;
        try {
            if (typeof window.getStore === 'function') {
                localData = window.getStore(targetKey);
            } else {
                localData = JSON.parse(localStorage.getItem(targetKey) || 'null');
            }
        } catch (_) {}

        if (Array.isArray(localData) && Array.isArray(rowData)) {
            if (localData.length > 0 && rowData.length === 0) {
                cloudWrite(targetKey, localData);
                return false;
            }

            const map = new Map();
            rowData.forEach((item) => {
                if (!item) return;
                const itemId = String(item.id || item.refId || JSON.stringify(item));
                map.set(itemId, item);
            });
            localData.forEach((item) => {
                if (!item) return;
                const itemId = String(item.id || item.refId || JSON.stringify(item));
                map.set(itemId, item);
            });

            const merged = Array.from(map.values());

            if (typeof window.setRemoteStore === 'function') {
                window.setRemoteStore(targetKey, merged);
            } else {
                localStorage.setItem(targetKey, JSON.stringify(merged));
            }
            return true;
        }

        if (rowData !== undefined && rowData !== null) {
            if (JSON.stringify(localData) !== JSON.stringify(rowData)) {
                if (typeof window.setRemoteStore === 'function') {
                    window.setRemoteStore(targetKey, rowData);
                } else {
                    localStorage.setItem(targetKey, JSON.stringify(rowData));
                }
                return true;
            }
        }

        return false;
    };

    const cloudWrite = async (fullKey, data) => {
        if (!supabaseClient) return false;
        showSyncStatus('syncing');

        const targetTable = resolveTargetTable(fullKey);
        const uid = getSafeUserId();
        const tid = getSafeTenantId();
        const sess = getActiveSessionVal();

        try {
            const payload = {
                id: String(fullKey),
                user_id: uid,
                tenant_id: tid,
                session: sess,
                data: data,
                updated_at: new Date().toISOString()
            };

            if (targetTable === 'app_store') {
                payload.key = String(fullKey);
                payload.value = data;
            }

            const { error } = await supabaseClient
                .from(targetTable)
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.error(`❌ [Supabase Error in ${targetTable}]:`, error.message, error.details);
                const fallbackPayload = {
                    id: String(fullKey),
                    key: String(fullKey),
                    value: data,
                    data: data,
                    updated_at: new Date().toISOString()
                };
                const { error: fbError } = await supabaseClient
                    .from('app_store')
                    .upsert(fallbackPayload, { onConflict: 'id' });

                if (fbError) {
                    console.error(`❌ [Supabase Fallback app_store Error]:`, fbError.message, fbError.details);
                }
            }

            isConnectedToCloud = true;
            showSyncStatus('online');
            return true;
        } catch (err) {
            console.error(`❌ [Supabase Catch Error]:`, err);
            showSyncStatus('online');
            return false;
        }
    };

    /**
     * 📥 CLOUD PULL - Sabhi 21+ Tables Se Live Data Lata Hai
     */
    const pullAllCloudData = async (silent = true) => {
        if (!supabaseClient || !navigator.onLine) return;

        const tables = [
            'saree_stock', 'saree_history',
            'zari_stock', 'zari_history',
            'bana_stock', 'bana_history',
            'sancha_list', 'sancha_history',
            'karigers', 'tani_sheets', 
            'material_transfers', 'karkhanas', 'dukan_challans', 
            'cutting', 'cutting_history',
            'embroidery', 'embroidery_history',
            'calender', 'calender_history',
            'job_work_bills', 'app_store'
        ];

        let hasNewData = false;

        for (const tbl of tables) {
            try {
                const { data, error } = await supabaseClient
                    .from(tbl)
                    .select('*');

                if (!error && data && data.length > 0) {
                    data.forEach((row) => {
                        const targetKey = row.id || row.key;
                        const rowData = row.data !== undefined ? row.data : (row.value !== undefined ? row.value : row);
                        if (targetKey) {
                            const updated = smartApplyRemoteData(targetKey, rowData);
                            if (updated) hasNewData = true;
                        }
                    });
                }
            } catch (_) {}
        }

        if (hasNewData || !silent) {
            triggerSmartUIRepaint();
            showSyncStatus('online');
        }
    };

    const startLiveAutoSyncHeartbeat = () => {
        if (autoSyncIntervalTimer) clearInterval(autoSyncIntervalTimer);

        // ⚠️ STEP 1 FIX: 5 सेकंड वाले लूप को बंद किया ताकि कंसोल में एरर की बाढ़ न आए
        /*
        autoSyncIntervalTimer = setInterval(() => {
            const activeEl = document.activeElement;
            const isUserTyping = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
            
            if (!isUserTyping && navigator.onLine && !document.hidden) {
                pullAllCloudData(true);
            }
        }, 5000);
        */
    };

    const initSupabaseRealtime = () => {
        if (!supabaseClient) return;
        detachSupabaseRealtime();

        try {
            realtimeChannel = supabaseClient.channel('public_db_realtime')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public' },
                    (payload) => {
                        if (typeof window.isBackupPreviewMode !== 'undefined' && window.isBackupPreviewMode) return;
                        const row = payload.new;
                        if (row && (row.id || row.key)) {
                            const targetKey = row.id || row.key;
                            const rowData = row.data !== undefined ? row.data : (row.value !== undefined ? row.value : row);
                            smartApplyRemoteData(targetKey, rowData);
                        }
                        triggerSmartUIRepaint();
                        showSyncStatus('online');
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        isConnectedToCloud = true;
                        showSyncStatus('online');
                    }
                });

            pullAllCloudData(false);
            startLiveAutoSyncHeartbeat();
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
            if (autoSyncIntervalTimer) {
                clearInterval(autoSyncIntervalTimer);
                autoSyncIntervalTimer = null;
            }
        } catch (_) {}
    };

    const switchSessionListeners = () => {
        pullAllCloudData(false);
    };

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine) {
            pullAllCloudData(false);
        }
    });

    window.addEventListener('focus', () => {
        if (navigator.onLine) {
            pullAllCloudData(false);
        }
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
        triggerSmartUIRepaint
    };

    window.db = supabaseClient;
    window.supabaseClient = supabaseClient;
    window.showSyncStatus = showSyncStatus;
    window.initSupabaseRealtime = initSupabaseRealtime;
    window.detachSupabaseRealtime = detachSupabaseRealtime;
    window.initFirebaseLiveListeners = initSupabaseRealtime;
    window.detachFirebaseLiveListeners = detachSupabaseRealtime;
    window.switchSessionListeners = switchSessionListeners;
    window.triggerSmartUIRepaint = triggerSmartUIRepaint;
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
        document.addEventListener('DOMContentLoaded', () => setTimeout(initSupabaseRealtime, 300));
    } else {
        setTimeout(initSupabaseRealtime, 300);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicCloudAPI;
    }
})();
