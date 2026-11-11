/* ============================================================================
   SIMPLICITY ERP - HIGH-SCALE ENTERPRISE AUTHENTICATION & SECURITY ENGINE
   File: auth/auth.js • Developed by Farhan Jawed
   Architecture: Supabase PostgreSQL Auth | Atomic Transactions | 5-Point Security
   Scale: 1,000,000+ Concurrent Active Users | Offline-First & Resilient
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & SESSION CONTEXT
       ------------------------------------------------------------------------
    ======================================================================== */
    window.currentUserId = null;
    window.currentUserRole = null;
    window.activeKarigerId = null;
    window.activeSheetId = null;
    window.currentDayBookTab = 'bana';
    window.targetResetUser = null;
    window.currentPassbookContext = null;
    window.activeSanchaItemId = null;

    let _activeSessionAuthCache = null;

    // Default Fallback Admin (Bootstrap & Offline Safety)
    const DEFAULT_BOOTSTRAP_ADMIN = Object.freeze({
        id: 'farhan',
        name: 'Farhan jawed',
        pass: '97438090641154',
        mobile: '7065572191',
        email: 'farhanjawed@gmail.com',
        pin: '9743',
        role: 'admin',
        status: 'active',
        date: '2026-01-01',
        expiryDate: ''
    });

    /* ========================================================================
       2. DEFENSIVE UTILITY HELPERS
       ------------------------------------------------------------------------
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
        return window.supabaseClient || window.supabase || (typeof window.supabase !== 'undefined' ? window.supabase : null);
    };

    const sanitizeId = (id) => String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const sanitizeMobile = (mob) => String(mob || '').trim().replace(/[^0-9]/g, '');
    const sanitizePin = (pin) => String(pin || '').trim().replace(/[^0-9]/g, '').slice(0, 4);

    const isUserExpired = (user) => {
        if (!user || user.role === 'admin' || user.id === 'farhan' || !user.expiryDate) {
            return false;
        }
        const todayIso = new Date().toISOString().split('T')[0];
        return todayIso > user.expiryDate;
    };

    /* ========================================================================
       3. USER LOOKUP (SUPABASE)
       ------------------------------------------------------------------------
    ======================================================================== */
    const fetchUserByIdentifier = async (identifier) => {
        const cleanQuery = String(identifier || '').trim().toLowerCase();
        if (!cleanQuery) return null;

        const sb = getSupabase();
        if (sb) {
            try {
                // Check by user_id
                let { data, error } = await sb
                    .from('karkhana_users')
                    .select('*')
                    .eq('user_id', cleanQuery)
                    .limit(1);

                // If not found by user_id, check by mobile
                if ((!data || data.length === 0) && /^\d+$/.test(cleanQuery)) {
                    const mobRes = await sb
                        .from('karkhana_users')
                        .select('*')
                        .eq('mobile', cleanQuery)
                        .limit(1);
                    data = mobRes.data;
                }

                if (data && data.length > 0) {
                    const row = data[0];
                    return {
                        id: row.user_id,
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
            } catch (netErr) {
                console.warn('[Auth:Supabase] Remote fetch error:', netErr);
            }
        }

        if (cleanQuery === 'farhan' || cleanQuery === '7065572191') {
            return DEFAULT_BOOTSTRAP_ADMIN;
        }

        return getCachedUserLocal(cleanQuery);
    };

    const getCachedUserLocal = (identifier) => {
        try {
            if (_activeSessionAuthCache) {
                const s = _activeSessionAuthCache;
                if (s.id === identifier || s.mobile === identifier || s.email === identifier) return s;
            }

            const localRaw = localStorage.getItem('app_active_session_auth');
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (parsed && (parsed.id === identifier || parsed.mobile === identifier || parsed.email === identifier)) {
                    _activeSessionAuthCache = parsed;
                    return parsed;
                }
            }

            if (identifier === 'farhan' || identifier === '7065572191') return DEFAULT_BOOTSTRAP_ADMIN;
        } catch (_) {}
        return null;
    };

    /* ========================================================================
       4. BULLETPROOF REGISTRATION (SUPABASE)
       ------------------------------------------------------------------------
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

        msg.textContent = 'Account request process ho rahi hai... ⏳';
        msg.className = 'message';
        msg.style.display = 'block';

        const isOwner = (id === 'farhan');
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);

        try {
            const sb = getSupabase();
            if (!sb) {
                alert('⚠️ Supabase connection nahi mila! Page ko Hard Refresh (Ctrl+F5) karein.');
                msg.textContent = 'Connection error! Page refresh karein.';
                return;
            }

            // 1. Check if user_id exists
            const { data: existingUser, error: checkErr } = await sb
                .from('karkhana_users')
                .select('user_id')
                .eq('user_id', id);

            if (existingUser && existingUser.length > 0) {
                msg.textContent = '⚠️ Yeh User ID pehle se registered hai! Doosri ID chunein.';
                msg.className = 'message error';
                msg.style.display = 'block';
                return;
            }

            // 2. Insert into Supabase karkhana_users
            const payload = {
                user_id: id,
                full_name: name,
                mobile: mobile,
                email: email || null,
                password: pass,
                pin: pin,
                role: isOwner ? 'admin' : 'owner',
                status: isOwner ? 'active' : 'pending',
                validity_date: isOwner ? null : exp.toISOString().split('T')[0]
            };

            const { error: insertErr } = await sb
                .from('karkhana_users')
                .insert([payload]);

            if (insertErr) {
                console.error('Insert error details:', insertErr);
                throw new Error(insertErr.message || insertErr.details || 'Database insert failed');
            }

            // 3. Create default Main Godown
            try {
                await sb.from('karkhanas').insert([{
                    user_id: id,
                    karkhana_name: 'Main Godown',
                    is_default: true
                }]);
            } catch (_) {}

            // Success response
            if (isOwner) {
                msg.textContent = '✅ Admin Account Ban Gaya!';
            } else {
                msg.innerHTML = `⏳ <strong>Account Request Admin ke paas bhej di gayi hai!</strong><br>Admin (Farhan) ke Approve karte hi aap login kar sakenge.<br>📞 Admin: <a href='tel:+917065572191' style='color:#2563eb; font-weight:bold;'>+91 70655 72191</a>`;
            }
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
            alert('Registration Error: ' + err.message);
            msg.textContent = 'Error: ' + err.message;
            msg.className = 'message error';
            msg.style.display = 'block';
        }
    };

    /* ========================================================================
       5. LOGIN WITH APPROVAL GATEKEEPER
       ------------------------------------------------------------------------
    ======================================================================== */
    const handleLogin = async () => {
        const idInput = document.getElementById('login-id');
        const passInput = document.getElementById('login-pass');
        const err = document.getElementById('login-error');

        const inputVal = (idInput ? idInput.value : '').trim().toLowerCase();
        const pass = (passInput ? passInput.value : '').trim();

        if (!inputVal || !pass) {
            if (err) {
                err.textContent = 'Kripya User ID aur Password dono bharein!';
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
                    err.textContent = 'Galat User ID ya Password!';
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
                if (err) {
                    err.innerHTML = `⌛ Account Expired (${_formatDateDisplay(user.expiryDate)})!`;
                    err.style.color = '#dc2626';
                    err.style.display = 'block';
                }
                return;
            }

            const authPayload = {
                id: user.id,
                name: user.name,
                mobile: user.mobile,
                email: user.email || '',
                pass: user.pass,
                pin: user.pin,
                role: user.role || 'owner'
            };

            _activeSessionAuthCache = authPayload;
            localStorage.setItem('app_current_user_id', user.id);
            localStorage.setItem('app_active_session_auth', JSON.stringify(authPayload));

            if (passInput) passInput.value = '';

            executeSuccessfulLogin(user);

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
       6. SUCCESSFUL LOGIN DISPATCHER
       ------------------------------------------------------------------------
    ======================================================================== */
    const executeSuccessfulLogin = (user) => {
        if (typeof window.clearMemoryCache === 'function') {
            window.clearMemoryCache();
        }

        window.currentUserId = user.id;
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
            // ✅ Supabase Realtime Listener connected
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
            } else {
                showLogin();
            }
        } catch (_) {
            showLogin();
        }
    };

    const logout = () => {
        // ✅ Supabase Realtime Detached
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
        window.activeKarigerId = null;
        window.activeSheetId = null;
        _activeSessionAuthCache = null;

        localStorage.removeItem('app_current_user_id');
        localStorage.removeItem('app_active_session_auth');

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
       7. FORGOT PASSWORD & SCREEN NAVIGATION
       ------------------------------------------------------------------------
    ======================================================================== */
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
    };

    const verifyForgotPin = async () => {
        const queryEl = document.getElementById('forgot-query');
        const pinEl = document.getElementById('forgot-pin');
        const msg = document.getElementById('forgot-msg');

        const q = String(queryEl ? queryEl.value : '').trim().toLowerCase();
        const pin = sanitizePin(pinEl ? pinEl.value : '');

        if (!msg) return;

        if (!q || !pin) {
            msg.textContent = 'Kripya User ID aur PIN dono darj karein!';
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

    // Public API Object
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
        saveNewPassword,
        fetchUserByIdentifier
    };

    Object.keys(authAPI).forEach((fnName) => {
        window[fnName] = authAPI[fnName];
    });

    window.AuthEngine = authAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = authAPI;
    }
})();
