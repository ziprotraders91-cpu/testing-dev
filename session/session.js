/* ============================================================================
   SIMPLICITY ERP - HIGH-SCALE FINANCIAL YEAR SESSION CONTROLLER
   File: session/session.js • Developed by Farhan Jawed
   Architecture: Clean Direct Sessions • Auto-Injected Modals • Atomic RPC Delete
   Security & PWA: No Backdoor Passwords • Async Locks • Inline PWA Confirmations
============================================================================ */

(() => {
    'use strict';

    const DEFAULT_BOOTSTRAP_SESSION = '2026-2027';

    // Async Double-Click / Re-entry Locks
    let isDeletingSession = false;
    let isSwitchingSession = false;

    const hasLoggedInUser = () => {
        try {
            if (window.currentUserId && String(window.currentUserId).trim() && window.currentUserId !== 'app') {
                return true;
            }
            if (localStorage.getItem('app_active_session_auth')) return true;
            const stored = localStorage.getItem('app_current_user_id') ||
                           localStorage.getItem('currentUserId') ||
                           sessionStorage.getItem('currentUserId');
            return Boolean(stored && String(stored).trim() && String(stored).trim() !== 'app');
        } catch (_) {
            return false;
        }
    };

    const resolveUserId = () => {
        try {
            if (window.StorageEngine && typeof window.StorageEngine.getEffectiveUserId === 'function') {
                const sid = window.StorageEngine.getEffectiveUserId();
                if (sid && sid !== 'app') return String(sid).trim();
            }
            if (window.currentUserId && String(window.currentUserId).trim() && window.currentUserId !== 'app') {
                return String(window.currentUserId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            }
            if (window.currentUserProfile && window.currentUserProfile.id) {
                return String(window.currentUserProfile.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            }
            const authData = localStorage.getItem('app_active_session_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed && parsed.id) {
                    return String(parsed.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                }
            }
            const stored = localStorage.getItem('app_current_user_id') ||
                           localStorage.getItem('currentUserId') ||
                           sessionStorage.getItem('currentUserId');
            if (stored) {
                const clean = String(stored).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                if (clean && clean !== 'app') return clean;
            }
        } catch (_) {}
        return 'farhan';
    };

    const getEffectiveUserId = () => resolveUserId();

    const getSafeTenantId = (uid) => {
        try {
            if (window.currentTenantId) return String(window.currentTenantId).trim();
            const stored = localStorage.getItem('app_current_tenant_id') || localStorage.getItem('tenantId');
            if (stored) return String(stored).trim();
        } catch (_) {}
        return uid;
    };

    const getSupabase = () => {
        return window.supabaseClient || window.CloudEngine?.supabase || window.supabase || null;
    };

    const setDeleteStatus = (msg, isError = true) => {
        const el = document.getElementById('session-del-status');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.style.display = 'block';
        el.style.color = isError ? '#b91c1c' : '#15803d';
        el.style.background = isError ? '#fee2e2' : '#dcfce7';
        el.style.borderColor = isError ? '#fca5a5' : '#86efac';
        el.textContent = msg;
    };

    const hideDeleteConfirmBar = () => {
        const bar = document.getElementById('session-del-confirm-bar');
        if (bar) bar.style.display = 'none';
    };

    const ensureSessionModals = () => {
        if (!document.body) return;

        if (!document.getElementById('session-closing-modal')) {
            const closingHtml = `
                <div id="session-closing-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.72); z-index:99998; align-items:center; justify-content:center; padding:14px; box-sizing:border-box;" role="dialog" aria-modal="true">
                    <div class="modal-card" style="background:#ffffff; width:100%; max-width:500px; max-height:92vh; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);">
                        <div class="modal-header" style="background:#1e3a8a; color:#ffffff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h3 style="margin:0; font-size:17px; color:#ffffff;">📅 Financial Year Closing & Session</h3>
                                <small style="color:#bfdbfe; font-size:11.5px;">Purane saal ka hisab naye saal me opening le jayein</small>
                            </div>
                            <button type="button" class="close-modal-btn" onclick="closeSessionClosingModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">✕</button>
                        </div>
                        <div class="modal-body" style="padding:16px; overflow-y:auto;">
                            <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; padding:14px; margin-bottom:16px;">
                                <div style="font-weight:800; color:#1e3a8a; font-size:14px; margin-bottom:10px;">🚀 Naya Financial Year Shuru Karein</div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                                    <div>
                                        <label style="font-size:11.5px; font-weight:700; color:#334155;">Chalu Session:</label>
                                        <input type="text" id="session-current-display" readonly style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#e2e8f0; font-weight:800; color:#0f172a; margin-top:4px; box-sizing:border-box;">
                                    </div>
                                    <div>
                                        <label style="font-size:11.5px; font-weight:700; color:#1e40af;">Naya Session (Format: YYYY-YYYY):</label>
                                        <input type="text" id="session-new-input" placeholder="2027-2028" style="width:100%; padding:8px; border:1.5px solid #2563eb; border-radius:6px; font-weight:800; color:#1e3a8a; margin-top:4px; box-sizing:border-box;">
                                    </div>
                                </div>
                                <div style="font-size:11.5px; color:#475569; margin-bottom:12px; line-height:1.45;">
                                    ✅ Karigers + Tani Opening Balance (Bana/Zari/Bani)<br>
                                    ✅ Saree Stock (All 5 Stages) • Bana • Zari • Sancha • Job Workers<br>
                                    🔒 Purana session 100% safe rahega — aap jab chahein wapas dekh sakte hain.
                                </div>
                                <button type="button" class="btn" onclick="startSequentialYearClosing()" style="width:100%; background:linear-gradient(135deg,#2563eb,#7c3aed); color:#ffffff; border:none; padding:11px; border-radius:8px; font-weight:800; font-size:14px; cursor:pointer;">
                                    🚀 Naya Saal Shuru Karein (Year Closing)
                                </button>
                            </div>

                            <div style="background:#fef2f2; border:1.5px solid #fecaca; border-radius:10px; padding:14px;">
                                <div style="font-weight:800; color:#b91c1c; font-size:13.5px; margin-bottom:8px;">⚠️ Delete Zone (Purana / Test Session Hatayein)</div>
                                <div style="margin-bottom:8px;">
                                    <label style="font-size:11.5px; font-weight:700; color:#7f1d1d;">Delete Karne Ke Liye Session Chunein:</label>
                                    <select id="session-delete-select" style="width:100%; padding:8px; border:1px solid #fca5a5; border-radius:6px; background:#ffffff; margin-top:4px; font-weight:700; box-sizing:border-box;"></select>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                                    <div>
                                        <label style="font-size:11px; font-weight:700; color:#7f1d1d;">User ID:</label>
                                        <input type="text" id="session-del-user-id" placeholder="User ID" style="width:100%; padding:7px; border:1px solid #fca5a5; border-radius:6px; margin-top:3px; box-sizing:border-box;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; font-weight:700; color:#7f1d1d;">Password:</label>
                                        <input type="password" id="session-del-password" placeholder="Password" style="width:100%; padding:7px; border:1px solid #fca5a5; border-radius:6px; margin-top:3px; box-sizing:border-box;">
                                    </div>
                                </div>
                                <div id="session-del-status" style="display:none; font-size:12px; font-weight:700; padding:7px 10px; border-radius:6px; border:1px solid #fca5a5; margin-bottom:8px;"></div>
                                <div id="session-del-confirm-bar" style="display:none; background:#ffffff; border:1.5px solid #dc2626; border-radius:7px; padding:10px; margin-bottom:8px;">
                                    <div id="session-del-confirm-text" style="font-size:12px; font-weight:800; color:#991b1b; margin-bottom:8px;"></div>
                                    <div style="display:flex; gap:8px;">
                                        <button type="button" id="session-del-confirm-yes" style="flex:1; background:#dc2626; color:#ffffff; border:none; padding:7px; border-radius:6px; font-weight:800; font-size:12px; cursor:pointer;">Haan, Delete Karein</button>
                                        <button type="button" id="session-del-confirm-no" style="flex:1; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:7px; border-radius:6px; font-weight:700; font-size:12px; cursor:pointer;">Cancel</button>
                                    </div>
                                </div>
                                <button type="button" id="session-del-trigger-btn" onclick="confirmAndDeleteSessionWithAuth()" style="width:100%; background:#dc2626; color:#ffffff; border:none; padding:9px; border-radius:7px; font-weight:800; font-size:13px; cursor:pointer;">
                                    🗑️ Session Delete Karein
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', closingHtml);

            ['session-delete-select', 'session-del-user-id', 'session-del-password'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => {
                        setDeleteStatus('');
                        hideDeleteConfirmBar();
                    });
                    el.addEventListener('change', () => {
                        setDeleteStatus('');
                        hideDeleteConfirmBar();
                    });
                }
            });

            const noBtn = document.getElementById('session-del-confirm-no');
            if (noBtn) {
                noBtn.addEventListener('click', () => {
                    hideDeleteConfirmBar();
                    setDeleteStatus('');
                });
            }

            if (!window.__sessionEscBound) {
                window.__sessionEscBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        const m = document.getElementById('session-closing-modal');
                        if (m && m.style.display !== 'none') {
                            closeSessionClosingModal();
                        }
                    }
                });
            }
        }

        if (!document.getElementById('session-transfer-modal')) {
            const transferHtml = `
                <div id="session-transfer-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:99999; align-items:center; justify-content:center; padding:14px; box-sizing:border-box;" role="dialog" aria-modal="true">
                    <div class="modal-card" style="background:#ffffff; width:100%; max-width:480px; border-radius:14px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.45);">
                        <div class="modal-header" style="background:#0f172a; color:#ffffff; padding:14px 18px;">
                            <h3 style="margin:0; font-size:16px; color:#ffffff;">⚙️ Year Closing Chal Rahi Hai...</h3>
                        </div>
                        <div class="modal-body" style="padding:18px;"></div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', transferHtml);
        }
    };

    /**
     * Sabhi valid sessions ki clean list nikaalta hai
     */
    const getAppSessions = () => {
        const uId = getEffectiveUserId();
        const userKey = `${uId}_app_sessions_list`;

        let list = [];
        try {
            const raw = localStorage.getItem(userKey);
            if (raw) list = JSON.parse(raw);
        } catch (_) {
            list = [];
        }

        let cleanList = Array.isArray(list)
            ? list.map((s) => String(s).replace(/['"]+/g, '').trim()).filter((s) => /^\d{4}-\d{4}$/.test(s))
            : [];

        if (cleanList.length === 0) {
            cleanList = [DEFAULT_BOOTSTRAP_SESSION];
        }

        cleanList = Array.from(new Set(cleanList)).sort();
        try {
            localStorage.setItem(userKey, JSON.stringify(cleanList));
            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[userKey] = cleanList;
        } catch (_) {}

        return cleanList;
    };

    /**
     * Current Active Session nikaalta hai
     */
    const getActiveFinancialSession = () => {
        const uId = getEffectiveUserId();
        const userKey = `${uId}_app_active_session`;
        const validSessions = getAppSessions();

        let sess = localStorage.getItem(userKey);
        if (sess) {
            sess = String(sess).replace(/['"]+/g, '').trim();
        }

        if (!sess || !/^\d{4}-\d{4}$/.test(sess) || !validSessions.includes(sess)) {
            sess = validSessions[validSessions.length - 1] || DEFAULT_BOOTSTRAP_SESSION;
            try { localStorage.setItem(userKey, sess); } catch (_) {}
            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[userKey] = sess;
        }

        return sess;
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

    const saveToAppStoreSafe = async (key, value, sessOverride = null) => {
        const sb = getSupabase();
        if (!sb || typeof sb.from !== 'function' || !navigator.onLine) return false;

        const uId = getEffectiveUserId();
        const tid = getSafeTenantId(uId);
        const sessVal = sessOverride || getActiveFinancialSession();
        const now = new Date().toISOString();

        try {
            const { error } = await sb.from('app_store').upsert({
                id: key,
                user_id: uId,
                tenant_id: tid,
                session: sessVal,
                data: value,
                key: key,
                value: value,
                updated_at: now
            }, { onConflict: 'id' });

            if (error) {
                console.error('[app_store upsert error]:', error.message);
                return false;
            }
            return true;
        } catch (err) {
            console.warn('[app_store safe write]:', err);
            return false;
        }
    };

    const initCloudSessionSync = async () => {
        if (window.isBackupPreviewMode) return;
        if (!hasLoggedInUser()) return;

        const uId = getEffectiveUserId();
        const sessionsKey = `${uId}_app_sessions_list`;
        const activeKey = `${uId}_app_active_session`;

        try {
            const sb = getSupabase();
            if (sb && typeof sb.from === 'function' && navigator.onLine) {
                const { data, error } = await sb
                    .from('app_store')
                    .select('id, key, data, value')
                    .in('id', [sessionsKey, activeKey]);

                if (error) {
                    console.warn('[SessionSync] app_store read error:', error.message);
                } else if (data && Array.isArray(data)) {
                    let updatedSessions = null;
                    let cloudActive = null;

                    data.forEach((row) => {
                        const rId = String(row.id || row.key || '');
                        const rVal = row.data !== undefined ? row.data : row.value;

                        if (rId === sessionsKey && Array.isArray(rVal) && rVal.length > 0) {
                            const clean = rVal
                                .map((s) => String(s).replace(/['"]+/g, '').trim())
                                .filter((s) => /^\d{4}-\d{4}$/.test(s));
                            if (clean.length > 0) {
                                updatedSessions = Array.from(new Set(clean)).sort();
                            }
                        }

                        if (rId === activeKey && rVal) {
                            const cand = String(rVal).replace(/['"]+/g, '').trim();
                            if (/^\d{4}-\d{4}$/.test(cand)) {
                                cloudActive = cand;
                            }
                        }
                    });

                    if (updatedSessions) {
                        localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));
                        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[sessionsKey] = updatedSessions;
                    }

                    if (cloudActive) {
                        const validList = getAppSessions();
                        if (!validList.includes(cloudActive)) {
                            validList.push(cloudActive);
                            validList.sort();
                            localStorage.setItem(sessionsKey, JSON.stringify(validList));
                            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[sessionsKey] = validList;
                        }
                        const curActive = getActiveFinancialSession();
                        if (cloudActive !== curActive) {
                            localStorage.setItem(activeKey, cloudActive);
                            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[activeKey] = cloudActive;
                            if (typeof window.clearMemoryCache === 'function') window.clearMemoryCache();
                            window.location.reload();
                            return;
                        }
                    }
                }
            }
            populateSessionDropdown();
        } catch (err) {
            console.warn('[SessionSync] Cloud fallback:', err);
        }
    };

    const switchAppFinancialSession = async (targetSession) => {
        if (isSwitchingSession) return;
        const activeSess = getActiveFinancialSession();
        const cleanTarget = String(targetSession || '').replace(/['"]+/g, '').trim();
        if (!cleanTarget || cleanTarget === activeSess) return;

        isSwitchingSession = true;
        const uId = getEffectiveUserId();

        try {
            if (typeof window.detachSupabaseRealtime === 'function') {
                window.detachSupabaseRealtime();
            }

            localStorage.setItem(`${uId}_app_active_session`, cleanTarget);
            if (window.APP_MEMORY_CACHE) {
                window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = cleanTarget;
            }

            await saveToAppStoreSafe(`${uId}_app_sessions_list`, getAppSessions(), cleanTarget);
            await saveToAppStoreSafe(`${uId}_app_active_session`, cleanTarget, cleanTarget);

            if (typeof window.clearMemoryCache === 'function') {
                window.clearMemoryCache();
            }

            setTimeout(() => {
                window.location.reload();
            }, 250);
        } catch (err) {
            console.error('[SessionSwitch] Error:', err);
            isSwitchingSession = false;
            window.location.reload();
        }
    };

    const openSessionClosingModal = () => {
        ensureSessionModals();
        const modal = document.getElementById('session-closing-modal');
        if (!modal) return;

        setDeleteStatus('');
        hideDeleteConfirmBar();

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

        const delUid = document.getElementById('session-del-user-id');
        const delPass = document.getElementById('session-del-password');
        if (delUid) delUid.value = '';
        if (delPass) delPass.value = '';

        modal.style.display = 'flex';
    };

    const closeSessionClosingModal = () => {
        const modal = document.getElementById('session-closing-modal');
        if (!modal) return;
        setDeleteStatus('');
        hideDeleteConfirmBar();
        modal.style.display = 'none';
    };

    const clearSessionFromIndexedDB = async (uId, targetSess) => {
        if (!('indexedDB' in window)) return;
        const prefix = `${uId}_${targetSess}_`;

        try {
            await new Promise((resolve) => {
                // Open without hardcoded version so it matches whatever version exists
                const req = window.indexedDB.open('SimplicityERP_DB');
                req.onsuccess = (e) => {
                    const dbase = e.target.result;
                    try {
                        const storeNames = [];
                        if (dbase.objectStoreNames.contains('app_store')) storeNames.push('app_store');
                        if (dbase.objectStoreNames.contains('sync_queue')) storeNames.push('sync_queue');
                        if (!storeNames.length) {
                            try { dbase.close(); } catch (_) {}
                            return resolve();
                        }

                        const tx = dbase.transaction(storeNames, 'readwrite');

                        if (dbase.objectStoreNames.contains('app_store')) {
                            const appStore = tx.objectStore('app_store');
                            const curReq = appStore.openKeyCursor();
                            curReq.onsuccess = (ev) => {
                                const cursor = ev.target.result;
                                if (cursor) {
                                    if (String(cursor.key).startsWith(prefix)) {
                                        appStore.delete(cursor.key);
                                    }
                                    cursor.continue();
                                }
                            };
                        }

                        if (dbase.objectStoreNames.contains('sync_queue')) {
                            const qStore = tx.objectStore('sync_queue');
                            const qReq = qStore.openCursor();
                            qReq.onsuccess = (ev) => {
                                const cursor = ev.target.result;
                                if (cursor) {
                                    const val = cursor.value;
                                    const tKey = String(val?.targetKey || '');
                                    if (tKey.startsWith(prefix) || String(cursor.key).includes(prefix)) {
                                        qStore.delete(cursor.key);
                                    }
                                    cursor.continue();
                                }
                            };
                        }

                        tx.oncomplete = () => {
                            try { dbase.close(); } catch (_) {}
                            resolve();
                        };
                        tx.onerror = () => {
                            try { dbase.close(); } catch (_) {}
                            resolve();
                        };
                    } catch (_) {
                        try { dbase.close(); } catch (_) {}
                        resolve();
                    }
                };
                req.onerror = () => resolve();
            });
        } catch (_) {}
    };

    const executeConfirmedSessionDelete = async (uId, targetSess) => {
        if (isDeletingSession) return false;
        isDeletingSession = true;

        const yesBtn = document.getElementById('session-del-confirm-yes');
        if (yesBtn) {
            yesBtn.disabled = true;
            yesBtn.textContent = 'Deleting...';
        }

        try {
            let sessions = getAppSessions().filter((s) => s !== targetSess);
            if (sessions.length === 0) sessions = [DEFAULT_BOOTSTRAP_SESSION];

            let nextActive = getActiveFinancialSession();
            if (nextActive === targetSess || !sessions.includes(nextActive)) {
                nextActive = sessions[sessions.length - 1] || DEFAULT_BOOTSTRAP_SESSION;
            }

            // 1. Cloud RPC first (if Supabase is active) so local & cloud never desync
            const sb = getSupabase();
            const hasCloudRpc = Boolean(sb && typeof sb.rpc === 'function');
            if (hasCloudRpc) {
                if (!navigator.onLine) {
                    setDeleteStatus('⚠️ Internet band hai! Cloud session delete karne ke liye online hona zaroori hai.', true);
                    return false;
                }

                const { data: rpcRes, error: rpcErr } = await sb.rpc('delete_user_session_data', {
                    p_user_id: uId,
                    p_session: targetSess
                });
                if (rpcErr || (rpcRes && rpcRes.ok === false)) {
                    console.error('[SessionDelete RPC Error]:', rpcErr || rpcRes);
                    setDeleteStatus(`❌ Cloud delete fail hua: ${rpcErr?.message || rpcRes?.error || 'RPC Error'}`, true);
                    return false;
                }
            }

            if (typeof window.detachSupabaseRealtime === 'function') {
                window.detachSupabaseRealtime();
            }

            // 2. Update local session lists & sync updated list to Cloud
            localStorage.setItem(`${uId}_app_sessions_list`, JSON.stringify(sessions));
            localStorage.setItem(`${uId}_app_active_session`, nextActive);
            localStorage.removeItem(`${uId}_app_deleted_sessions`);

            if (hasCloudRpc) {
                await saveToAppStoreSafe(`${uId}_app_sessions_list`, sessions, nextActive);
                await saveToAppStoreSafe(`${uId}_app_active_session`, nextActive, nextActive);
            }

            // 3. Wipe localStorage session keys & delta cursors
            const keysToRemove = [];
            const sessPrefix = `${uId}_${targetSess}_`;
            const cursorSuffix = `_${uId}_${targetSess}`;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (k.startsWith(sessPrefix) || (k.startsWith('erp_delta_sync_') && k.endsWith(cursorSuffix))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));

            // 4. Wipe IndexedDB session keys
            await clearSessionFromIndexedDB(uId, targetSess);

            if (typeof window.clearMemoryCache === 'function') {
                window.clearMemoryCache();
            }

            hideDeleteConfirmBar();
            setDeleteStatus(`✅ Session '${targetSess}' Cloud aur Local dono se delete ho gaya! Reload ho raha hai...`, false);
            setTimeout(() => window.location.reload(), 450);
            return true;
        } catch (err) {
            console.error('[SessionDelete] Error:', err);
            setDeleteStatus('❌ Delete ke dauran error aaya. Dobara koshish karein.', true);
            return false;
        } finally {
            isDeletingSession = false;
            if (yesBtn) {
                yesBtn.disabled = false;
                yesBtn.textContent = 'Haan, Delete Karein';
            }
        }
    };

    /* ========================================================================
       🗑️ CLEAN ATOMIC SESSION DELETE (NO BACKDOOR, PWA INLINE CONFIRM, RPC)
       ======================================================================== */
    const confirmAndDeleteSessionWithAuth = async () => {
        if (isDeletingSession) return false;

        const delSel = document.getElementById('session-delete-select');
        const targetSess = delSel ? delSel.value : '';
        const uInp = String(document.getElementById('session-del-user-id')?.value || '').trim().toLowerCase();
        const pInp = String(document.getElementById('session-del-password')?.value || '').trim();

        if (!targetSess) {
            console.warn('[SessionDelete] Pehle delete karne ke liye session chunein!');
            setDeleteStatus('⚠️ Pehle delete karne ke liye session chunein!', true);
            return false;
        }
        if (!uInp || !pInp) {
            console.warn('[SessionDelete] User ID aur Password daalna zaroori hai!');
            setDeleteStatus('⚠️ User ID aur Password daalna zaroori hai!', true);
            return false;
        }

        const uId = getEffectiveUserId();

        // Strict auth via active logged-in session only (no hardcoded backdoors)
        let authenticated = false;
        try {
            const authRaw = localStorage.getItem('app_active_session_auth');
            if (authRaw) {
                const s = JSON.parse(authRaw);
                const matchId = (s.id && String(s.id).toLowerCase() === uInp) || (uInp === uId.toLowerCase());
                const storedPass = (s.pass !== undefined && s.pass !== null) ? String(s.pass).trim() : '';
                if (matchId && storedPass !== '' && storedPass === pInp) {
                    authenticated = true;
                }
            }
        } catch (_) {}

        if (!authenticated) {
            console.warn('[SessionDelete] Galat User ID ya Password!');
            setDeleteStatus('❌ Galat User ID ya Password! Session delete nahi hoga.', true);
            return false;
        }

        const sessions = getAppSessions();
        if (sessions.length <= 1) {
            console.warn('[SessionDelete] Aakhri bacha hua Session delete nahi ho sakta!');
            setDeleteStatus('❌ Aakhri bacha hua Session delete nahi ho sakta!', true);
            return false;
        }

        // PWA-Safe Inline 2-Step Confirmation (replaces native window.confirm)
        const confirmBar = document.getElementById('session-del-confirm-bar');
        const confirmTxt = document.getElementById('session-del-confirm-text');
        const yesBtn = document.getElementById('session-del-confirm-yes');

        if (confirmBar && confirmTxt && yesBtn) {
            setDeleteStatus('');
            confirmTxt.textContent = `⚠️ KYA AAP SACH ME '${targetSess}' KA PURA DATA DELETE KARNA CHAHTE HAIN? Cloud aur Local dono se hamesha ke liye mit jayega!`;
            confirmBar.style.display = 'block';
            yesBtn.onclick = () => executeConfirmedSessionDelete(uId, targetSess);
            yesBtn.focus();
            return true;
        }

        return await executeConfirmedSessionDelete(uId, targetSess);
    };

    const sessionAPI = {
        getEffectiveUserId,
        getAppSessions,
        getActiveFinancialSession,
        populateSessionDropdown,
        switchAppFinancialSession,
        openSessionClosingModal,
        closeSessionClosingModal,
        confirmAndDeleteSessionWithAuth,
        initCloudSessionSync,
        ensureSessionModals
    };

    Object.keys(sessionAPI).forEach((fnName) => {
        window[fnName] = sessionAPI[fnName];
    });

    window.SessionEngine = Object.assign(window.SessionEngine || {}, sessionAPI);

    const initRunner = () => {
        const uId = getEffectiveUserId();
        try { localStorage.removeItem(`${uId}_app_deleted_sessions`); } catch (_) {}

        ensureSessionModals();
        populateSessionDropdown();
        initCloudSessionSync();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRunner);
    } else {
        initRunner();
    }
})();
