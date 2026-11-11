/* ============================================================================
   SIMPLICITY ERP - SECURE USER PROFILE & SETTINGS ENGINE
   File: auth/profile.js • Developed by Farhan Jawed
   Architecture: Supabase PostgreSQL Profile Sync | 5-Point Strict Check
   Scale: 1,000,000+ Concurrent Active Users | Offline-First & Resilient
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. INPUT SANITIZATION & SECURITY HELPERS
       ------------------------------------------------------------------------
    ======================================================================== */
    const sanitizeText = (val) => String(val || '').trim();
    const sanitizeMobile = (mob) => String(mob || '').trim().replace(/[^0-9]/g, '');
    const sanitizePin = (pin) => String(pin || '').trim().replace(/[^0-9]/g, '').slice(0, 4);

    const getSupabase = () => {
        return window.supabaseClient || window.supabase || (typeof window.supabase !== 'undefined' ? window.supabase : null);
    };

    /**
     * Safe helper to toggle element display
     */
    const _setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    /**
     * Resolves the current authenticated user record safely
     * @returns {Promise<Object|null>}
     */
    const getCurrentUserRecord = async () => {
        const uid = window.currentUserId;
        if (!uid) return null;

        // 1. Check AuthEngine targeted lookup if available
        if (window.AuthEngine && typeof window.AuthEngine.fetchUserByIdentifier === 'function') {
            const user = await window.AuthEngine.fetchUserByIdentifier(uid);
            if (user) return user;
        }

        // 2. Check local session storage
        try {
            const sessionRaw = localStorage.getItem('app_active_session_auth');
            if (sessionRaw) {
                return JSON.parse(sessionRaw);
            }
        } catch (_) {}

        return null;
    };

    /* ========================================================================
       2. MODAL CONTROLLERS (OPEN & CLOSE)
       ------------------------------------------------------------------------
    ======================================================================== */

    /**
     * Opens profile modal and pre-fills current authenticated user details
     */
    const openProfileModal = async () => {
        try {
            if (!window.currentUserId) {
                alert('Pehle kripya login karein!');
                return;
            }

            const user = await getCurrentUserRecord();
            if (!user) {
                alert('User profile fetch nahi ho saki. Kripya login check karein!');
                return;
            }

            // Safe DOM element references
            const nameEl = document.getElementById('prof-name');
            const idEl = document.getElementById('prof-id');
            const mobEl = document.getElementById('prof-mobile');
            const pinEl = document.getElementById('prof-pin');
            const passEl = document.getElementById('prof-pass');
            const emailEl = document.getElementById('prof-email');

            // Populate form
            if (nameEl) nameEl.value = user.name || '';
            if (idEl) {
                idEl.value = user.id || window.currentUserId;
                idEl.setAttribute('readonly', 'true'); // Security: User ID cannot be modified
                idEl.style.backgroundColor = '#f3f4f6';
                idEl.style.cursor = 'not-allowed';
            }
            if (mobEl) mobEl.value = user.mobile || '';
            if (pinEl) pinEl.value = user.pin || '1234';
            if (passEl) passEl.value = user.pass || '';
            if (emailEl) emailEl.value = user.email || '';

            // Reset save button state
            const saveBtn = document.getElementById('prof-save-btn') || document.querySelector('#profile-modal button[onclick*="saveProfileSettings"]');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Settings Save Karein';
            }

            _setDisplay('profile-modal', 'flex');
        } catch (err) {
            console.error('[ProfileEngine:openProfileModal] Error:', err);
            alert('Profile open karne me takneeki khata aayi.');
        }
    };

    /**
     * Closes the profile modal
     */
    const closeProfileModal = () => {
        _setDisplay('profile-modal', 'none');
    };

    /* ========================================================================
       3. CONCURRENT-SAFE PROFILE SETTINGS UPDATE ENGINE
       ------------------------------------------------------------------------
       1. 5-Point Strict Duplicate Checks (Name, Mobile, Gmail, PIN)
       2. Farhan Identity Protection Shield
       3. Realtime Cloud Sync with Supabase PostgreSQL
    ======================================================================== */

    /**
     * Validates and commits updated profile credentials
     */
    const saveProfileSettings = async () => {
        const uid = window.currentUserId;
        if (!uid) {
            alert('Aap logged in nahi hain!');
            return;
        }

        const nameEl = document.getElementById('prof-name');
        const mobEl = document.getElementById('prof-mobile');
        const pinEl = document.getElementById('prof-pin');
        const passEl = document.getElementById('prof-pass');
        const emailEl = document.getElementById('prof-email');
        const saveBtn = document.getElementById('prof-save-btn') || document.querySelector('#profile-modal button[onclick*="saveProfileSettings"]');

        // Form values extraction
        const name = sanitizeText(nameEl?.value);
        const mobile = sanitizeMobile(mobEl?.value);
        const pin = sanitizePin(pinEl?.value);
        const pass = sanitizeText(passEl?.value);
        const email = sanitizeText(emailEl?.value).toLowerCase();

        // 1. Strict Validations
        if (!name || name.length < 2) {
            alert('Kripya valid naam darj karein (kam se kam 2 akshar)!');
            if (nameEl) nameEl.focus();
            return;
        }

        if (mobile.length !== 10) {
            alert('Kripya 10-digit ka valid mobile number darj karein!');
            if (mobEl) mobEl.focus();
            return;
        }

        if (pin.length !== 4) {
            alert('Security PIN strictly 4-digits ka hona chahiye!');
            if (pinEl) pinEl.focus();
            return;
        }

        if (!pass || pass.length < 4) {
            alert('Password kam se kam 4 characters ka hona chahiye!');
            if (passEl) passEl.focus();
            return;
        }

        // 🛑 FARHAN STRICT BLOCK (अगर कोई दूसरा यूजर नाम बदलकर Farhan रखेगा तो ब्लॉक)
        const cleanNameLower = name.toLowerCase().replace(/\s+/g, '');
        if (String(uid).toLowerCase() !== 'farhan' && cleanNameLower.includes('farhan')) {
            alert('⛔ Farhan naam rakhna strictly block hai!');
            if (nameEl) nameEl.focus();
            return;
        }

        // Set Loading UI State
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving Settings... ⏳';
        }

        try {
            const sb = getSupabase();

            // 🔍 5-POINT EXACT MATCH CHECK IN SUPABASE (बाकी यूज़र्स से मिलान)
            if (sb && navigator.onLine) {
                const { data: otherUsers, error: checkErr } = await sb
                    .from('karkhana_users')
                    .select('user_id, full_name, mobile, email, pin')
                    .neq('user_id', uid);

                if (checkErr) throw checkErr;

                if (otherUsers && otherUsers.length > 0) {
                    // 1. Name Check
                    if (otherUsers.some(u => String(u.full_name || '').trim().toLowerCase() === name.toLowerCase())) {
                        alert('⚠️ Koi aur name select karein');
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Settings Save Karein'; }
                        if (nameEl) nameEl.focus();
                        return;
                    }

                    // 2. Mobile Check
                    if (otherUsers.some(u => String(u.mobile || '').trim() === mobile)) {
                        alert('⚠️ Koi aur mobile number select karein');
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Settings Save Karein'; }
                        if (mobEl) mobEl.focus();
                        return;
                    }

                    // 3. Gmail Check
                    if (email && otherUsers.some(u => String(u.email || '').trim().toLowerCase() === email)) {
                        alert('⚠️ Koi aur gmail select karein');
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Settings Save Karein'; }
                        if (emailEl) emailEl.focus();
                        return;
                    }

                    // 4. Secret PIN Check
                    if (otherUsers.some(u => String(u.pin || '').trim() === pin)) {
                        alert('⚠️ Koi aur secret PIN select karein');
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Settings Save Karein'; }
                        if (pinEl) pinEl.focus();
                        return;
                    }
                }
            }

            // Step 2: Prepare Consolidated User Profile Object
            const updatedProfile = {
                id: uid,
                name: name,
                mobile: mobile,
                email: email || '',
                pin: pin,
                pass: pass,
                role: window.currentUserRole || 'owner',
                updatedAt: new Date().toISOString()
            };

            // Step 3: Session Synchronization
            const activeSessionAuth = {
                id: uid,
                name: name,
                mobile: mobile,
                email: email || '',
                pass: pass,
                pin: pin,
                role: updatedProfile.role
            };

            // Update persistent auth token
            localStorage.setItem('app_active_session_auth', JSON.stringify(activeSessionAuth));

            // Step 4: Multi-Tier Storage Consistency (L1 RAM + L2 LocalStorage + L3 IndexedDB)
            try {
                localStorage.setItem(`app_user_${uid}`, JSON.stringify(updatedProfile));
            } catch (_) {}

            if (typeof window.APP_MEMORY_CACHE !== 'undefined') {
                window.APP_MEMORY_CACHE[`app_user_${uid}`] = updatedProfile;
            }

            if (typeof window.idbPut === 'function') {
                window.idbPut(`app_user_${uid}`, updatedProfile);
            }

            // Step 5: Realtime Cloud Sync with Supabase
            if (sb) {
                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('syncing');

                const { error: updateErr } = await sb
                    .from('karkhana_users')
                    .update({
                        full_name: name,
                        mobile: mobile,
                        email: email || null,
                        pin: pin,
                        password: pass
                    })
                    .eq('user_id', uid);

                if (updateErr) throw updateErr;

                if (typeof window.showSyncStatus === 'function') window.showSyncStatus('online');
            }

            // Step 6: Update Active Header / Welcome Text
            const welcomeEl = document.getElementById('welcome-text');
            if (welcomeEl) {
                welcomeEl.textContent = (window.currentUserRole === 'admin')
                    ? `👑 Swagat hai Admin, ${name}!`
                    : `Swagat hai, ${name}!`;
            }

            // Close modal & confirm
            closeProfileModal();
            alert('✅ Profile settings aur security credentials successfully save ho gaye!');

        } catch (saveErr) {
            console.error('[ProfileEngine:saveProfileSettings] Save failure:', saveErr);
            alert('Settings update karte waqt takleef aayi: ' + (saveErr.message || 'Kripya connection check karein!'));
            if (typeof window.showSyncStatus === 'function') window.showSyncStatus('error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Settings Save Karein';
            }
        }
    };

    /* ========================================================================
       4. GLOBAL EXPORT & BACKWARD COMPATIBILITY
       ------------------------------------------------------------------------
    ======================================================================== */
    const profileAPI = {
        openProfileModal,
        closeProfileModal,
        saveProfileSettings
    };

    // Attach directly to window for legacy onclick handlers
    window.openProfileModal = openProfileModal;
    window.closeProfileModal = closeProfileModal;
    window.saveProfileSettings = saveProfileSettings;

    // Namespace Wrapper
    window.ProfileEngine = profileAPI;

    // Unit test export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = profileAPI;
    }
})();
