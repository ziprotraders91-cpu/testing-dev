/* ============================================================================
   SIMPLICITY ERP - HIGH-SCALE FINANCIAL YEAR SESSION CONTROLLER
   File: session/session.js • Developed by Farhan Jawed
   Architecture: Global Cloud Active Session Lock (Cross-Device Auto-Sync)
   Guarantee: Phone & Computer always stay on the EXACT SAME financial session!
============================================================================ */

(() => {
    'use strict';

    const LOCAL_PURGE_CHUNK_SIZE = 50;
    const DEFAULT_BOOTSTRAP_SESSION = '2026-2027';

    const yieldEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

    const getEffectiveUserId = () => {
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
                return String(stored).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            }
        } catch (_) {}
        return '10001';
    };

    const getDeletedSessionsList = () => {
        const uId = getEffectiveUserId();
        const delKey = `${uId}_app_deleted_sessions`;
        try {
            const raw = (window.APP_MEMORY_CACHE && window.APP_MEMORY_CACHE[delKey]) || localStorage.getItem(delKey);
            if (raw) {
                const parsed = (typeof raw === 'string') ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                return Array.isArray(parsed) ? parsed.map(s => String(s).trim()) : [];
            }
        } catch (_) {}
        return [];
    };

    const unmarkDeletedSession = async (sess) => {
        if (!sess) return;
        const clean = String(sess).replace(/['"]+/g, '').trim();
        const uId = getEffectiveUserId();
        const delKey = `${uId}_app_deleted_sessions`;

        let delList = getDeletedSessionsList().filter(s => s !== clean);
        localStorage.setItem(delKey, JSON.stringify(delList));
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[delKey] = delList;
        if (typeof window.idbPut === 'function') await window.idbPut(delKey, delList);

        if (typeof window.CloudEngine?.cloudWrite === 'function') {
            await window.CloudEngine.cloudWrite(delKey, delList);
        }
    };

    const getAppSessions = () => {
        const uId = getEffectiveUserId();
        const userKey = `${uId}_app_sessions_list`;
        const deletedSet = new Set(getDeletedSessionsList());

        const activeRaw = localStorage.getItem(`${uId}_app_active_session`);
        if (activeRaw && /^\d{4}-\d{4}$/.test(activeRaw.trim())) {
            const cleanActive = activeRaw.trim();
            if (deletedSet.has(cleanActive)) {
                const hasFreshData = localStorage.getItem(`${uId}_${cleanActive}_kariger_list`) || 
                                     localStorage.getItem(`${uId}_${cleanActive}_saree_stock`) ||
                                     localStorage.getItem(`${uId}_${cleanActive}_bana_stock`);
                if (hasFreshData) {
                    deletedSet.delete(cleanActive);
                    unmarkDeletedSession(cleanActive);
                }
            }
        }

        let list = [];
        try {
            const raw = (window.APP_MEMORY_CACHE && window.APP_MEMORY_CACHE[userKey]) || localStorage.getItem(userKey);
            if (raw) {
                list = (typeof raw === 'string') ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
            }
        } catch (_) {
            list = [];
        }

        const sessionSet = new Set();
        if (Array.isArray(list)) {
            list.forEach((s) => {
                const clean = String(s || '').replace(/['"]+/g, '').trim();
                if (/^\d{4}-\d{4}$/.test(clean) && !deletedSet.has(clean)) {
                    sessionSet.add(clean);
                }
            });
        }

        try {
            const len = localStorage.length;
            const prefixRegex = new RegExp(`^${uId}_(\\d{4}-\\d{4})_`);
            for (let i = 0; i < len; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                const match = k.match(prefixRegex);
                if (match && match[1]) {
                    const sFound = match[1];
                    if (!deletedSet.has(sFound)) {
                        sessionSet.add(sFound);
                    }
                }
            }
            if (activeRaw && /^\d{4}-\d{4}$/.test(activeRaw.trim()) && !deletedSet.has(activeRaw.trim())) {
                sessionSet.add(activeRaw.trim());
            }
        } catch (_) {}

        if (sessionSet.size === 0) {
            sessionSet.add(DEFAULT_BOOTSTRAP_SESSION);
        }

        const finalList = Array.from(sessionSet).sort();

        try {
            localStorage.setItem(userKey, JSON.stringify(finalList));
            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[userKey] = finalList;
            if (typeof window.idbPut === 'function') window.idbPut(userKey, finalList);
        } catch (_) {}

        return finalList;
    };

    const getActiveFinancialSession = () => {
        const uId = getEffectiveUserId();
        const userKey = `${uId}_app_active_session`;
        const deletedSet = new Set(getDeletedSessionsList());

        let sess = (window.APP_MEMORY_CACHE && window.APP_MEMORY_CACHE[userKey]) || localStorage.getItem(userKey);

        if (sess) {
            const clean = String(sess).replace(/['"]+/g, '').trim();
            if (deletedSet.has(clean)) {
                const hasFreshData = localStorage.getItem(`${uId}_${clean}_kariger_list`) || 
                                     localStorage.getItem(`${uId}_${clean}_saree_stock`);
                if (hasFreshData) {
                    deletedSet.delete(clean);
                    unmarkDeletedSession(clean);
                }
            }
        }

        if (!sess || typeof sess !== 'string' || sess === '[]' || sess === 'null' || deletedSet.has(String(sess).replace(/['"]+/g, '').trim())) {
            const list = getAppSessions();
            sess = list[list.length - 1] || DEFAULT_BOOTSTRAP_SESSION;

            try {
                localStorage.setItem(userKey, sess);
                if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[userKey] = sess;
                if (typeof window.idbPut === 'function') window.idbPut(userKey, sess);
            } catch (_) {}
        }

        return String(sess).replace(/['"]+/g, '').trim() || DEFAULT_BOOTSTRAP_SESSION;
    };

    const populateSessionDropdown = () => {
        const sel = document.getElementById('app-session-select');
        if (!sel) return;

        sel.innerHTML = '';
        const sessions = getAppSessions();
        const activeSess = getActiveFinancialSession();

        sessions.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = `📅 ${s}`;
            if (String(s) === String(activeSess)) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    };

    const initCloudSessionSync = async () => {
        const uId = getEffectiveUserId();
        const sessionsKey = `${uId}_app_sessions_list`;
        const activeKey = `${uId}_app_active_session`;
        const deletedKey = `${uId}_app_deleted_sessions`;

        try {
            let cloudActive = null;
            let cloudSessions = null;

            if (window.supabaseClient || window.supabase) {
                const client = window.supabaseClient || window.supabase;
                if (client && typeof client.from === 'function') {
                    const { data } = await client.from('app_store').select('id, data, value, key');
                    if (data && Array.isArray(data)) {
                        data.forEach((row) => {
                            const rKey = row.key || row.id;
                            const rVal = row.data !== undefined ? row.data : row.value;
                            if (rKey.includes('app_active_session')) cloudActive = rVal;
                            if (rKey.includes('app_sessions_list')) cloudSessions = rVal;
                        });
                    }
                }
            }

            if (cloudSessions) {
                let parsedList = (typeof cloudSessions === 'string') ? JSON.parse(cloudSessions) : cloudSessions;
                if (Array.isArray(parsedList) && parsedList.length > 0) {
                    const localList = getAppSessions();
                    let merged = Array.from(new Set([...localList, ...parsedList])).sort();
                    localStorage.setItem(sessionsKey, JSON.stringify(merged));
                    if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[sessionsKey] = merged;
                }
            }

            if (cloudActive) {
                const cleanCloudActive = String(cloudActive).replace(/['"]+/g, '').trim();
                const curActive = getActiveFinancialSession();

                if (cleanCloudActive && /^\d{4}-\d{4}$/.test(cleanCloudActive) && cleanCloudActive !== curActive) {
                    localStorage.setItem(activeKey, cleanCloudActive);
                    if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[activeKey] = cleanCloudActive;
                    window.location.reload();
                    return;
                }
            }

            populateSessionDropdown();
        } catch (err) {
            console.warn('[SessionSync] Cloud sync fallback:', err);
        }
    };

    /* ========================================================================
       ⭐ SESSION SWITCH: SUPABASE APP_STORE PAR PUSH KARKE HI RELOAD HOGA
       ======================================================================== */
    const switchAppFinancialSession = async (targetSession) => {
        const activeSess = getActiveFinancialSession();
        if (!targetSession || targetSession === activeSess) return;

        if (!confirm(`Kya aap Session badal kar '${targetSession}' me jana chahte hain?\nYe session aapke sabhi devices (Phone & Computer) par active ho jayega.`)) {
            populateSessionDropdown();
            return;
        }

        const cleanTarget = String(targetSession).replace(/['"]+/g, '').trim();
        const uId = getEffectiveUserId();

        try {
            if (typeof window.detachSupabaseRealtime === 'function') {
                window.detachSupabaseRealtime();
            }

            // 1. Local update
            localStorage.setItem(`${uId}_app_active_session`, cleanTarget);
            if (window.APP_MEMORY_CACHE) {
                window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = cleanTarget;
            }

            if (typeof window.idbPut === 'function') {
                await window.idbPut(`${uId}_app_active_session`, cleanTarget);
            }

            // 2. ⭐ SUPABASE CLOUD APP_STORE ME DIRECT PUSH
            const sb = window.supabaseClient || window.supabase;
            if (sb && typeof sb.from === 'function') {
                const now = new Date().toISOString();
                await sb.from('app_store').upsert({
                    id: `${uId}_app_active_session`,
                    user_id: uId,
                    data: cleanTarget,
                    key: `${uId}_app_active_session`,
                    value: cleanTarget,
                    updated_at: now
                }, { onConflict: 'id' });

                await sb.from('app_store').upsert({
                    id: `${uId}_app_sessions_list`,
                    user_id: uId,
                    data: getAppSessions(),
                    key: `${uId}_app_sessions_list`,
                    value: getAppSessions(),
                    updated_at: now
                }, { onConflict: 'id' });
            }

            if (typeof window.clearMemoryCache === 'function') {
                window.clearMemoryCache();
            }

            // 3. 300ms ka safe delay taaki network write complete ho sake
            setTimeout(() => {
                window.location.reload();
            }, 300);

        } catch (err) {
            console.error('[SessionSwitch] Error:', err);
            window.location.reload();
        }
    };

    const openSessionClosingModal = () => {
        const modal = document.getElementById('session-closing-modal');
        if (!modal) return;

        const curDisplay = document.getElementById('session-current-display');
        const cur = getActiveFinancialSession();
        if (curDisplay) curDisplay.value = cur;

        const newInp = document.getElementById('session-new-input');
        if (newInp) {
            const parts = cur.split('-');
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                newInp.value = `${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`;
            } else {
                newInp.value = '';
            }
        }

        const delSel = document.getElementById('session-delete-select');
        if (delSel) {
            delSel.innerHTML = "<option value=''>-- Chunein --</option>";
            const sessions = getAppSessions();
            sessions.forEach((s) => {
                delSel.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }

        modal.style.display = 'flex';
    };

    const closeSessionClosingModal = () => {
        const modal = document.getElementById('session-closing-modal');
        if (!modal) return;
        modal.style.display = 'none';
    };

    const sessionAPI = {
        getEffectiveUserId,
        getAppSessions,
        getActiveFinancialSession,
        populateSessionDropdown,
        switchAppFinancialSession,
        openSessionClosingModal,
        closeSessionClosingModal,
        initCloudSessionSync,
        unmarkDeletedSession
    };

    Object.keys(sessionAPI).forEach((fnName) => {
        window[fnName] = sessionAPI[fnName];
    });

    window.SessionEngine = Object.assign(window.SessionEngine || {}, sessionAPI);

    const initRunner = () => {
        populateSessionDropdown();
        initCloudSessionSync();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRunner);
    } else {
        initRunner();
    }
})();
