/* ============================================================================
   SIMPLICITY ERP - HIGH-SCALE ENTERPRISE AUTHENTICATION & SECURITY ENGINE
   File: auth/auth.js • Developed by Farhan Jawed
   Architecture: Supabase PostgreSQL Auth + account_uid Reset Protection + Gmail OTP
============================================================================ */

(() => {
    'use strict';

    const GMAIL_ENGINE_URL = 'https://script.google.com/macros/s/AKfycbzuHcuZf6gS4jIP2fS4Y7kGLw6MG2k_h9BDEdO2HOsredwvuJeys3m0Y-zCRlIX060bYQ/exec';
    const GMAIL_ENGINE_SECRET = 'simplicity_erp_mail_2026';

    /* ========================================================================
       1. GLOBAL STATE & SESSION CONTEXT
    ======================================================================== */
    window.currentUserId = null;
    window.currentUserRole = null;
    window.currentTenantId = null;
    window.activeKarigerId = null;
    window.activeSheetId = null;
    window.currentDayBookTab = 'bana';
    window.targetResetUser = null;
    window.currentPassbookContext = null;
    window.activeSanchaItemId = null;

    let _activeSessionAuthCache = null;
    let _expiredLoginUser = null;

    /* ========================================================================
       2. DEFENSIVE UTILITY HELPERS
    ======================================================================== */
    const _setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const _getTodayDate = () => {
        if (typeof window.getTodayDate === 'function') return window.getTodayDate();
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    };

    const _formatDateDisplay = (d) => {
        if (typeof window.formatDateDisplay === 'function') return window.formatDateDisplay(d);
        if (!d) return '-';
        const p = String(d).split('-');
        return (p.length === 3 && p[0].length === 4) ? `${p[2]}-${p[1]}-${p[0]}` : d;
    };

    const getSupabase = () => {
        return window.supabaseClient || (window.CloudEngine && window.CloudEngine.supabase) || null;
    };

    const sanitizeId = (id) => String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const sanitizeMobile = (mob) => String(mob || '').trim().replace(/[^0-9]/g, '');
    const sanitizePin = (pin) => String(pin || '').trim().replace(/[^0-9]/g, '').slice(0, 4);

    const maskEmail = (email) => {
        const parts = String(email || '').split('@');
        if (parts.length !== 2) return '***';
        const name = parts[0];
        const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
        return `${visible}***@${parts[1]}`;
    };

    const callGmailEngine = async (payload) => {
        try {
            const res = await fetch(GMAIL_ENGINE_URL, {
                method: 'POST',
                body: JSON.stringify({ secret: GMAIL_ENGINE_SECRET, ...payload })
            });
            const data = await res.json();
            return data || { ok: false, error: 'Invalid response' };
        } catch (err) {
            return { ok: false, error: err?.message || 'Network error' };
        }
    };

    const isUserExpired = (user) => {
        if (!user || user.role === 'admin' || user.id === 'farhan' || !user.expiryDate) {
            return false;
        }
        const todayIso = new Date().toISOString().split('T')[0];
        return todayIso > user.expiryDate;
    };

    const clearUnprefixedLocalData = (keepUserId = null) => {
        try {
            const unprefixedKeys = [
                'karkhana_list', 'kariger_list', 'tani_orders_list', 'tani_learned_colors',
                'tani_learned_rangi', 'sancha_items', 'sancha_history', 'bana_stock',
                'bana_history', 'zari_stock', 'zari_history', 'saree_stock', 'saree_history',
                'payments', 'payment_list', 'material_transfers', 'dukan_challans',
                'dukan_firms', 'dukan_parties', 'dukan_designs', 'dukan_orders',
                'jobwork_workers', 'jobwork_groups', 'jobwork_firm_profile', 'jw_challan_seq',
                'jw_bills_list', 'jw_payments_list',
                'kariger_portal_tenant_id', 'kariger_portal_firm_name',
                'app_active_session', 'app_current_tenant_id', 'tenantId',
                'tenant_id', 'erp_tenant_id', 'current_tenant_id', 'user_id', 'currentUserId'
            ];
            unprefixedKeys.forEach((k) => localStorage.removeItem(k));

            if (keepUserId) {
                const toRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k) continue;
                    if (
                        k === 'app_current_user_id' ||
                        k === 'app_active_session_auth' ||
                        k === 'app_last_user_id' ||
                        k === 'app_global_billing_config' ||
                        k === `erp_account_uid_${keepUserId}` ||
                        k.includes(`_${keepUserId}_`)
                    ) {
                        continue;
                    }
                    if (!k.startsWith(`${keepUserId}_`)) {
                        toRemove.push(k);
                    }
                }
                toRemove.forEach((k) => localStorage.removeItem(k));
            }
        } catch (_) {}
    };

    const openExpiredRenewModal = () => {
        if (typeof window.openClientPaymentModal === 'function') {
            window.openClientPaymentModal(_expiredLoginUser || { id: 'Client', name: 'Karkhana User' });
        } else {
            alert('Payment QR ke liye Admin se contact karein: +91 70655 72191');
        }
    };

    /* ========================================================================
       3. USER LOOKUP (SUPABASE: USER ID + MOBILE + GMAIL)
    ======================================================================== */
    const fetchUserByIdentifier = async (identifier) => {
        const cleanQuery = String(identifier || '').trim().toLowerCase();
        if (!cleanQuery) return null;

        const sb = getSupabase();
        if (sb) {
            try {
                // 1. Check by user_id
                let { data, error } = await sb
                    .from('karkhana_users')
                    .select('*')
                    .eq('user_id', cleanQuery)
                    .limit(1);

                // 2. Check by mobile
                if (!error && (!data || data.length === 0) && /^\d+$/.test(cleanQuery)) {
                    const mobRes = await sb
                        .from('karkhana_users')
                        .select('*')
                        .eq('mobile', cleanQuery)
                        .limit(1);
                    data = mobRes.data;
                    error = mobRes.error;
                }

                // 3. Check by Gmail / Email
                if (!error && (!data || data.length === 0) && cleanQuery.includes('@')) {
                    const emailRes = await sb
                        .from('karkhana_users')
                        .select('*')
                        .ilike('email', cleanQuery)
                        .limit(1);
                    data = emailRes.data;
                    error = emailRes.error;
                }

                if (!error) {
                    if (data && data.length > 0) {
                        const row = data[0];
                        return {
                            id: row.user_id,
                            accountUid: row.account_uid || '',
                            name: row.full_name,
                            pass: row.password,
                            mobile: row.mobile,
                            email: row.email || '',
                            pin: row.pin,
                            role: row.role || 'owner',
                            status: row.status || 'active',
                            date: row.created_at ? row.created_at.split('T')[0] : _getTodayDate(),
                            expiryDate: row.validity_date || ''
                        };
                    }
                    // Server par check hua aur user nahi mila (deleted) — local cache fallback mat dein!
                    return null;
                }
            } catch (netErr) {
                console.warn('[Auth:Supabase] Remote fetch error:', netErr);
            }
        }

        // Sirf offline / network failure par local cache use karein
        return !navigator.onLine ? getCachedUserLocal(cleanQuery) : null;
    };

    const getCachedUserLocal = (identifier) => {
        try {
            if (_activeSessionAuthCache) {
                const s = _activeSessionAuthCache;
                if (s.id === identifier || s.mobile === identifier || (s.email && s.email.toLowerCase() === identifier)) return s;
            }

            const localRaw = localStorage.getItem('app_active_session_auth');
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (parsed && (parsed.id === identifier || parsed.mobile === identifier || (parsed.email && parsed.email.toLowerCase() === identifier))) {
                    _activeSessionAuthCache = parsed;
                    return parsed;
                }
            }
        } catch (_) {}
        return null;
    };

    /* ========================================================================
       4. BULLETPROOF REGISTRATION (5-POINT CHECK + ADMIN GMAIL ALERT)
    ======================================================================== */
    const handleRegister = async () => {
        const nameEl = document.getElementById('reg-name');
        const mobEl = document.getElementById('reg-mobile');
        const idEl = document.getElementById('reg-id');
        const passEl = document.getElementById('reg-pass');
        const pinEl = document.getElementById('reg-pin');
        const emailEl = document.getElementById('reg-email');
        const msg = document.getElementById('signup-msg');

        const name = String(nameEl ? nameEl.value : '').trim();
        const mobile = sanitizeMobile(mobEl ? mobEl.value : '');
        const id = sanitizeId(idEl ? idEl.value : '');
        const pass = String(passEl ? passEl.value : '').trim();
        const pin = sanitizePin(pinEl ? pinEl.value : '');
        const email = String(emailEl ? emailEl.value : '').trim().toLowerCase();

        if (!msg) return;

        if (!name || !id || !pass || !mobile || pin.length !== 4) {
            msg.textContent = 'Sabhi details bharein (4-digit PIN zaroori hai)!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        if (mobile.length !== 10) {
            msg.textContent = 'Kripya 10-digit ka valid mobile number darj karein!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        const cleanNameLower = name.toLowerCase().replace(/\s+/g, '');
        if (id.includes('farhan') || cleanNameLower.includes('farhan')) {
            msg.innerHTML = '⛔ <strong>Farhan</strong> naam ya ID se naya account banana strictly block hai!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        msg.textContent = 'Details verify ho rahi hain... ⏳';
        msg.className = 'message';
        msg.style.display = 'block';

        try {
            const sb = getSupabase();
            if (!sb) {
                alert('⚠️ Supabase connection nahi mila! Page ko Refresh karein.');
                msg.textContent = 'Connection error! Page refresh karein.';
                return;
            }

            const [nameRes, idRes, mobRes, emailRes, pinRes] = await Promise.all([
                sb.from('karkhana_users').select('user_id').ilike('full_name', name).limit(1),
                sb.from('karkhana_users').select('user_id').eq('user_id', id).limit(1),
                sb.from('karkhana_users').select('user_id').eq('mobile', mobile).limit(1),
                email ? sb.from('karkhana_users').select('user_id').ilike('email', email).limit(1) : Promise.resolve({ data: [] }),
                sb.from('karkhana_users').select('user_id').eq('pin', pin).limit(1)
            ]);

            if (nameRes.error) throw nameRes.error;
            if (idRes.error) throw idRes.error;
            if (mobRes.error) throw mobRes.error;
            if (emailRes.error) throw emailRes.error;
            if (pinRes.error) throw pinRes.error;

            if (nameRes.data && nameRes.data.length > 0) {
                msg.textContent = '⚠️ Koi aur name select karein';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }
            if (idRes.data && idRes.data.length > 0) {
                msg.textContent = '⚠️ Koi aur user ID select karein';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }
            if (mobRes.data && mobRes.data.length > 0) {
                msg.textContent = '⚠️ Koi aur mobile number select karein';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }
            if (email && emailRes.data && emailRes.data.length > 0) {
                msg.textContent = '⚠️ Koi aur gmail select karein';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }
            if (pinRes.data && pinRes.data.length > 0) {
                msg.textContent = '⚠️ Koi aur secret PIN select karein';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }

            const exp = new Date();
            exp.setDate(exp.getDate() + 30);

            const payload = {
                user_id: id,
                full_name: name,
                mobile: mobile,
                email: email || null,
                password: pass,
                pin: pin,
                role: 'owner',
                status: 'pending',
                validity_date: exp.toISOString().split('T')[0]
            };

            const { error: insertErr } = await sb
                .from('karkhana_users')
                .insert([payload]);

            if (insertErr) throw insertErr;

            await sb.from('karkhanas').upsert([{
                user_id: id,
                karkhana_key: 'k_main',
                karkhana_name: 'Main Godown',
                is_default: true
            }], { onConflict: 'user_id,karkhana_key' });

            // Agar isi phone par pehle is ID ka purana data tha toh use bhi turant saaf kar dein
            if (typeof window.wipeUserLocalCache === 'function') {
                await window.wipeUserLocalCache(id);
            }

            callGmailEngine({
                type: 'signup_alert',
                name: name,
                userId: id,
                mobile: mobile,
                email: email || '-'
            });

            msg.innerHTML = `⏳ <strong>Account Request Admin ke paas bhej di gayi hai!</strong><br>Admin (Farhan) ke Approve karte hi aap login kar sakenge.<br>📞 Admin: <a href='tel:+917065572191' style='color:#2563eb; font-weight:bold;'>+91 70655 72191</a>`;
            msg.className = 'message success';
            msg.style.display = 'block';

            setTimeout(() => {
                showLogin();
                if (nameEl) nameEl.value = '';
                if (mobEl) mobEl.value = '';
                if (idEl) idEl.value = '';
                if (passEl) passEl.value = '';
                if (pinEl) pinEl.value = '';
                if (emailEl) emailEl.value = '';
                msg.style.display = 'none';
            }, 4500);

        } catch (err) {
            console.error('[Auth:Register] Error:', err);
            msg.textContent = 'Registration Error: ' + err.message;
            msg.className = 'message error';
            msg.style.display = 'block';
        }
    };

    /* ========================================================================
       5. LOGIN WITH APPROVAL & EXPIRED RENEW GATEKEEPER
    ======================================================================== */
    const handleLogin = async () => {
        const idInput = document.getElementById('login-id');
        const passInput = document.getElementById('login-pass');
        const err = document.getElementById('login-error');

        const inputVal = (idInput ? idInput.value : '').trim().toLowerCase();
        const pass = (passInput ? passInput.value : '').trim();

        if (!inputVal || !pass) {
            if (err) {
                err.textContent = 'Kripya User ID/Mobile/Gmail aur Password dono bharein!';
                err.style.display = 'block';
            }
            return;
        }

        if (err) {
            err.textContent = 'Checking credentials... ⏳';
            err.style.display = 'block';
            err.style.color = '#2563eb';
        }

        try {
            const user = await fetchUserByIdentifier(inputVal);

            if (!user || String(user.pass).trim() !== String(pass).trim()) {
                if (err) {
                    err.textContent = 'Galat User ID / Mobile / Gmail ya Password!';
                    err.style.color = '#dc2626';
                    err.style.display = 'block';
                }
                return;
            }

            const userStatus = String(user.status || '').toLowerCase().trim();

            if (userStatus === 'pending') {
                if (err) {
                    err.innerHTML = `⏳ <strong>Account Approval Pending Hai!</strong><br>Admin (Farhan) se approve karwayein:<br>📞 <a href='tel:+917065572191' style='color:#2563eb; font-weight:800;'>+91 70655 72191</a>`;
                    err.style.color = '#dc2626';
                    err.style.display = 'block';
                }
                return;
            }

            if (userStatus === 'blocked') {
                if (err) {
                    err.innerHTML = '⛔ Account Block hai! Admin se contact karein.';
                    err.style.color = '#dc2626';
                    err.style.display = 'block';
                }
                return;
            }

            if (isUserExpired(user)) {
                _expiredLoginUser = {
                    id: user.id,
                    name: user.name,
                    expiryDate: user.expiryDate
                };
                if (err) {
                    err.innerHTML = `⌛ <strong>Account Expired (${_formatDateDisplay(user.expiryDate)})!</strong><br>
                        <button type="button" onclick="openExpiredRenewModal()" style="margin-top:8px; background:#0f766e; color:#fff; border:none; padding:9px 14px; border-radius:7px; font-weight:800; font-size:12.5px; cursor:pointer;">💳 QR Dekhein & Renew Karein</button>`;
                    err.style.color = '#dc2626';
                    err.style.display = 'block';
                }
                return;
            }

            const authPayload = {
                id: user.id,
                accountUid: user.accountUid || '',
                name: user.name,
                mobile: user.mobile,
                email: user.email || '',
                pass: user.pass,
                pin: user.pin,
                role: user.role || 'owner',
                status: user.status || 'active',
                expiryDate: user.expiryDate || ''
            };

            _activeSessionAuthCache = authPayload;
            localStorage.setItem('app_current_user_id', user.id);
            localStorage.setItem('app_active_session_auth', JSON.stringify(authPayload));

            if (passInput) passInput.value = '';

            await executeSuccessfulLogin(user);

        } catch (authErr) {
            console.error('[Auth:Login] Exception:', authErr);
            if (err) {
                err.textContent = 'Login error: ' + (authErr.message || 'Check connection');
                err.style.color = '#dc2626';
                err.style.display = 'block';
            }
        }
    };

    /* ========================================================================
       6. SUCCESSFUL LOGIN DISPATCHER (WITH account_uid WIPE PROTECTION)
    ======================================================================== */
    const executeSuccessfulLogin = async (user) => {
        if (typeof window.clearMemoryCache === 'function') {
            window.clearMemoryCache();
        }

        // ⭐ DELETE + SAME USERNAME RECREATE PROTECTION:
        // Agar cloud par is username ka account_uid badal gaya hai (naya account bana hai),
        // toh IndexedDB, sync_queue aur delta cursors ko preload se PEHLE 100% wipe karein!
        const uidKey = `erp_account_uid_${user.id}`;
        const storedAccUid = localStorage.getItem(uidKey);
        if (user.accountUid && storedAccUid !== user.accountUid) {
            if (typeof window.wipeUserLocalCache === 'function') {
                await window.wipeUserLocalCache(user.id);
            }
            try { localStorage.setItem(uidKey, user.accountUid); } catch (_) {}
        }

        const lastUid = localStorage.getItem('app_last_user_id');
        if (lastUid && lastUid !== user.id) {
            clearUnprefixedLocalData(user.id);
        } else {
            clearUnprefixedLocalData(null);
        }
        localStorage.setItem('app_last_user_id', user.id);

        window.currentUserId = user.id;
        window.currentTenantId = user.id;
        window.currentUserRole = user.role || (user.id === 'farhan' ? 'admin' : 'owner');

        const err = document.getElementById('login-error');
        if (err) err.style.display = 'none';

        _setDisplay('login-wrapper', 'none');
        _setDisplay('desktop-screen', 'flex');

        const welcomeEl = document.getElementById('welcome-text');
        if (welcomeEl) {
            welcomeEl.textContent = (window.currentUserRole === 'admin')
                ? `👑 Swagat hai Admin, ${user.name}!`
                : `Swagat hai, ${user.name}!`;
        }

        _setDisplay('nav-admin-btn', window.currentUserRole === 'admin' ? 'inline-block' : 'none');

        const finishLoginInit = () => {
            if (typeof window.initSupabaseRealtime === 'function') {
                window.initSupabaseRealtime();
            } else if (typeof window.initFirebaseLiveListeners === 'function') {
                window.initFirebaseLiveListeners();
            }
            if (typeof window.populateNavbarKarkhanaDropdown === 'function') {
                window.populateNavbarKarkhanaDropdown();
            }
            if (typeof window.populateSessionDropdown === 'function') {
                window.populateSessionDropdown();
            }
            if (typeof window.initCloudSessionSync === 'function') {
                window.initCloudSessionSync();
            }
            if (typeof window.backToDashboard === 'function') {
                window.backToDashboard();
            }
            if (typeof window.showSyncStatus === 'function') {
                window.showSyncStatus('online');
            }
        };

        if (typeof window.initIndexedDBPreload === 'function') {
            window.initIndexedDBPreload(finishLoginInit);
        } else {
            finishLoginInit();
        }
    };

    const checkAutoLogin = () => {
        try {
            const savedUid = localStorage.getItem('app_current_user_id');
            const savedSessionRaw = localStorage.getItem('app_active_session_auth');

            if (!savedUid || !savedSessionRaw) {
                showLogin();
                return;
            }

            const savedSession = JSON.parse(savedSessionRaw);
            _activeSessionAuthCache = savedSession;

            if (savedSession && savedSession.id && !isUserExpired(savedSession)) {
                executeSuccessfulLogin(savedSession);

                if (navigator.onLine) {
                    fetchUserByIdentifier(savedSession.id).then(async (freshUser) => {
                        // ⭐ Agar Admin ne user DELETE kar diya ya same username se NAYA account ban gaya:
                        if (
                            !freshUser ||
                            (freshUser.accountUid && savedSession.accountUid && freshUser.accountUid !== savedSession.accountUid)
                        ) {
                            if (typeof window.wipeUserLocalCache === 'function') {
                                await window.wipeUserLocalCache(savedSession.id);
                            }
                            alert('⛔ Yeh account delete ya reset ho chuka hai! Kripya dobara login karein.');
                            logout();
                            return;
                        }

                        const st = String(freshUser.status || '').toLowerCase().trim();
                        if (st === 'blocked' || st === 'pending' || isUserExpired(freshUser)) {
                            _expiredLoginUser = {
                                id: freshUser.id,
                                name: freshUser.name,
                                expiryDate: freshUser.expiryDate
                            };
                            alert('⛔ Aapka account block ya expire ho chuka hai! Renew karne ke liye payment karein ya Admin se contact karein.');
                            logout();
                        } else {
                            try {
                                const updated = {
                                    ...savedSession,
                                    accountUid: freshUser.accountUid || savedSession.accountUid || '',
                                    name: freshUser.name,
                                    email: freshUser.email || savedSession.email || '',
                                    role: freshUser.role || savedSession.role,
                                    status: freshUser.status || 'active',
                                    expiryDate: freshUser.expiryDate || ''
                                };
                                _activeSessionAuthCache = updated;
                                localStorage.setItem('app_active_session_auth', JSON.stringify(updated));
                                if (updated.accountUid) {
                                    localStorage.setItem(`erp_account_uid_${updated.id}`, updated.accountUid);
                                }
                            } catch (_) {}
                        }
                    }).catch(() => {});
                }
            } else {
                showLogin();
            }
        } catch (_) {
            showLogin();
        }
    };

    const logout = () => {
        if (typeof window.detachSupabaseRealtime === 'function') {
            window.detachSupabaseRealtime();
        } else if (typeof window.detachFirebaseLiveListeners === 'function') {
            window.detachFirebaseLiveListeners();
        }

        if (typeof window.clearMemoryCache === 'function') {
            window.clearMemoryCache();
        }

        window.currentUserId = null;
        window.currentUserRole = null;
        window.currentTenantId = null;
        window.activeKarigerId = null;
        window.activeSheetId = null;
        _activeSessionAuthCache = null;

        localStorage.removeItem('app_current_user_id');
        localStorage.removeItem('app_active_session_auth');
        clearUnprefixedLocalData(null);

        const idInput = document.getElementById('login-id');
        const passInput = document.getElementById('login-pass');
        const err = document.getElementById('login-error');
        if (idInput) idInput.value = '';
        if (passInput) passInput.value = '';
        if (err) err.style.display = 'none';

        _setDisplay('desktop-screen', 'none');
        _setDisplay('login-wrapper', 'flex');
        showLogin();
    };

    /* ========================================================================
       7. FORGOT PASSWORD (4-DIGIT PIN + GMAIL OTP SYSTEM)
    ======================================================================== */
    const ensureForgotGmailOtpUI = () => {
        const step1 = document.getElementById('forgot-step-1');
        if (!step1 || document.getElementById('forgot-gmail-otp-wrap')) return;

        const wrap = document.createElement('div');
        wrap.id = 'forgot-gmail-otp-wrap';
        wrap.style.cssText = 'margin-top:12px; padding-top:12px; border-top:1px dashed #cbd5e1;';
        wrap.innerHTML = `
            <button type="button" id="btn-send-gmail-otp" onclick="sendForgotGmailOtp()" style="width:100%; background:#0f172a; color:#ffffff; border:none; padding:10px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;">
                📧 PIN Bhool Gaye? Gmail par OTP Bhejein
            </button>
            <div id="forgot-otp-entry" style="display:none; margin-top:10px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:10px;">
                <div class="input-group" style="margin-bottom:8px;">
                    <label for="forgot-otp-input" style="color:#0f766e; font-weight:700;">Gmail par aaya 6-Digit OTP daalein</label>
                    <input type="text" id="forgot-otp-input" maxlength="6" inputmode="numeric" placeholder="6-digit OTP">
                </div>
                <button type="button" id="btn-verify-gmail-otp" onclick="verifyForgotGmailOtp()" style="width:100%; background:#0f766e; color:#ffffff; border:none; padding:10px; border-radius:8px; font-size:13px; font-weight:800; cursor:pointer;">
                    ✅ Verify Gmail OTP
                </button>
            </div>
        `;
        step1.appendChild(wrap);
    };

    const showSignup = () => {
        _setDisplay('login-box', 'none');
        _setDisplay('forgot-box', 'none');
        _setDisplay('signup-box', 'block');
    };

    const showLogin = () => {
        _setDisplay('signup-box', 'none');
        _setDisplay('forgot-box', 'none');
        _setDisplay('login-box', 'block');
    };

    const showForgotPassword = () => {
        _setDisplay('login-box', 'none');
        _setDisplay('signup-box', 'none');
        _setDisplay('forgot-box', 'block');
        _setDisplay('forgot-step-1', 'block');
        _setDisplay('forgot-step-2', 'none');

        ensureForgotGmailOtpUI();
        _setDisplay('forgot-otp-entry', 'none');
        const otpInp = document.getElementById('forgot-otp-input');
        if (otpInp) otpInp.value = '';
        const msg = document.getElementById('forgot-msg');
        if (msg) msg.style.display = 'none';
        window.targetResetUser = null;
    };

    const verifyForgotPin = async () => {
        const queryEl = document.getElementById('forgot-query');
        const pinEl = document.getElementById('forgot-pin');
        const msg = document.getElementById('forgot-msg');

        const q = String(queryEl ? queryEl.value : '').trim().toLowerCase();
        const pin = sanitizePin(pinEl ? pinEl.value : '');

        if (!msg) return;

        if (!q || !pin) {
            msg.textContent = 'Kripya User ID / Mobile / Gmail aur PIN dono darj karein!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        msg.textContent = 'Details verify ho rahi hain... ⏳';
        msg.className = 'message';
        msg.style.display = 'block';

        const user = await fetchUserByIdentifier(q);

        if (!user || sanitizePin(user.pin) !== pin) {
            msg.textContent = 'Galat User details ya PIN!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        window.targetResetUser = user;
        _setDisplay('forgot-step-1', 'none');
        _setDisplay('forgot-step-2', 'block');
        msg.textContent = '✅ PIN Verified! Naya password banayein.';
        msg.className = 'message success';
        msg.style.display = 'block';
    };

    const sendForgotGmailOtp = async () => {
        const queryEl = document.getElementById('forgot-query');
        const msg = document.getElementById('forgot-msg');
        const btn = document.getElementById('btn-send-gmail-otp');
        const q = String(queryEl ? queryEl.value : '').trim().toLowerCase();

        if (!msg) return;
        if (!q) {
            msg.textContent = 'Pehle upar apna User ID, Mobile ya Gmail daalein!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'OTP Bhej Rahe Hain... ⏳'; }
        msg.textContent = 'Account aur Gmail check ho raha hai... ⏳';
        msg.className = 'message';
        msg.style.display = 'block';

        const user = await fetchUserByIdentifier(q);
        if (!user) {
            if (btn) { btn.disabled = false; btn.textContent = '📧 PIN Bhool Gaye? Gmail par OTP Bhejein'; }
            msg.textContent = 'Is User ID / Mobile / Gmail se koi account nahi mila!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        if (!user.email || !user.email.includes('@')) {
            if (btn) { btn.disabled = false; btn.textContent = '📧 PIN Bhool Gaye? Gmail par OTP Bhejein'; }
            msg.textContent = 'Is account mein koi Gmail link nahi hai! Kripya 4-Digit PIN se reset karein.';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        const res = await callGmailEngine({
            type: 'send_otp',
            toEmail: user.email,
            name: user.name,
            userId: user.id
        });

        if (btn) { btn.disabled = false; btn.textContent = '🔄 Dobara Gmail par OTP Bhejein'; }

        if (res && res.ok) {
            window.targetResetUser = user;
            _setDisplay('forgot-otp-entry', 'block');
            msg.textContent = `✅ 6-Digit OTP aapke Gmail (${maskEmail(user.email)}) par bhej diya gaya hai! (Na dikhe to Spam folder check karein)`;
            msg.className = 'message success';
            msg.style.display = 'block';
        } else {
            msg.textContent = 'OTP bhejne mein dikkat aayi: ' + (res?.error || 'Internet check karein');
            msg.className = 'message error';
            msg.style.display = 'block';
        }
    };

    const verifyForgotGmailOtp = async () => {
        const otpEl = document.getElementById('forgot-otp-input');
        const msg = document.getElementById('forgot-msg');
        const btn = document.getElementById('btn-verify-gmail-otp');
        const otp = String(otpEl ? otpEl.value : '').replace(/[^0-9]/g, '').trim();

        if (!msg) return;
        if (!window.targetResetUser || !window.targetResetUser.email) {
            msg.textContent = 'Pehle Gmail par OTP mangwayein!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }
        if (otp.length !== 6) {
            msg.textContent = 'Kripya 6-digit OTP daalein!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Verify Ho Raha Hai... ⏳'; }

        const res = await callGmailEngine({
            type: 'verify_otp',
            toEmail: window.targetResetUser.email,
            otp: otp
        });

        if (btn) { btn.disabled = false; btn.textContent = '✅ Verify Gmail OTP'; }

        if (res && res.ok) {
            _setDisplay('forgot-step-1', 'none');
            _setDisplay('forgot-step-2', 'block');
            msg.textContent = '✅ Gmail OTP Verified! Ab naya password banayein.';
            msg.className = 'message success';
            msg.style.display = 'block';
        } else {
            msg.textContent = res?.error || 'Galat ya Expire ho chuka OTP!';
            msg.className = 'message error';
            msg.style.display = 'block';
        }
    };

    const saveNewPassword = async () => {
        const p1El = document.getElementById('forgot-new-pass');
        const p2El = document.getElementById('forgot-confirm-pass');
        const msg = document.getElementById('forgot-msg');

        const p1 = String(p1El ? p1El.value : '').trim();
        const p2 = String(p2El ? p2El.value : '').trim();

        if (!msg) return;

        if (!p1 || p1 !== p2) {
            msg.textContent = 'Dono password match hone chahiye!';
            msg.className = 'message error';
            msg.style.display = 'block';
            return;
        }

        if (!window.targetResetUser) return;

        try {
            window.targetResetUser.pass = p1;

            const sb = getSupabase();
            if (sb) {
                const { error } = await sb
                    .from('karkhana_users')
                    .update({ password: p1 })
                    .eq('user_id', window.targetResetUser.id);

                if (error) throw error;
            }

            msg.textContent = '✅ Password update ho gaya! Login karein.';
            msg.className = 'message success';
            msg.style.display = 'block';

            setTimeout(() => {
                showLogin();
                if (p1El) p1El.value = '';
                if (p2El) p2El.value = '';
                msg.style.display = 'none';
            }, 1200);
        } catch (err) {
            console.error('[Auth:saveNewPassword] Error:', err);
            msg.textContent = 'Password save nahi ho paya!';
            msg.className = 'message error';
            msg.style.display = 'block';
        }
    };

    const authAPI = {
        showSignup,
        showLogin,
        showForgotPassword,
        handleRegister,
        handleLogin,
        executeSuccessfulLogin,
        checkAutoLogin,
        logout,
        verifyForgotPin,
        sendForgotGmailOtp,
        verifyForgotGmailOtp,
        saveNewPassword,
        fetchUserByIdentifier,
        openExpiredRenewModal
    };

    Object.keys(authAPI).forEach((fnName) => {
        window[fnName] = authAPI[fnName];
    });

    window.AuthEngine = authAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = authAPI;
    }
})();
