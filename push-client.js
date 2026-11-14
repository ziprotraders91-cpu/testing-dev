/* ============================================================================
   SIMPLICITY ERP - UNIVERSAL WORKER PUSH NOTIFICATION HELPER
   File: push-client.js • Works for Sancha, Rangai & Kariger Portals
============================================================================ */
(() => {
    'use strict';

    const SUPABASE_URL = 'https://mvbejtoylowskerlgfxs.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_NhTU4xzRMi0gtKH4CzVf_Q_lRfzjg3c';
    const EDGE_URL = 'https://mvbejtoylowskerlgfxs.supabase.co/functions/v1/send-push';

    const detectPortal = () => {
        const p = (window.location.pathname || '').toLowerCase();
        if (p.includes('rangai-portal')) return { type: 'rangai', tokenKey: 'rangai_portal_token' };
        if (p.includes('kariger-portal')) return { type: 'kariger', tokenKey: 'kariger_portal_token' };
        return { type: 'sancha', tokenKey: 'sancha_portal_token' };
    };

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    let sb = null;
    const getSb = () => {
        if (sb) return sb;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return sb;
    };

    const updateBtnState = (state) => {
        const btn = document.getElementById('erp-push-btn');
        if (!btn) return;
        if (state === 'on') {
            btn.textContent = '🔔 Alerts ON';
            btn.style.background = '#16a34a';
            btn.style.borderColor = '#16a34a';
            btn.style.color = '#ffffff';
        } else if (state === 'loading') {
            btn.textContent = '⏳ Wait...';
            btn.style.background = '#475569';
            btn.style.borderColor = '#475569';
            btn.style.color = '#ffffff';
        } else {
            btn.textContent = '🔕 Alerts ON Karein';
            btn.style.background = '#d97706';
            btn.style.borderColor = '#d97706';
            btn.style.color = '#ffffff';
        }
    };

    const fetchPublicKey = async (client) => {
        const { data } = await client.rpc('get_push_public_key');
        if (data && data.ok && data.public_key) {
            return data.public_key;
        }
        const res = await fetch(EDGE_URL);
        const json = await res.json();
        return json && json.public_key ? json.public_key : null;
    };

    const syncSubscription = async (interactive = false) => {
        const portal = detectPortal();
        const token = localStorage.getItem(portal.tokenKey) || '';
        if (!token) return;

        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            if (interactive) {
                alert('Is browser me Push Notification support nahi hai. Chrome me open karein (ya iPhone par pehle Add to Home Screen karke App kholein).');
            }
            return;
        }

        if (interactive) updateBtnState('loading');

        try {
            let perm = Notification.permission;
            if (perm === 'default' && interactive) {
                perm = await Notification.requestPermission();
            }

            if (perm !== 'granted') {
                updateBtnState('off');
                if (interactive) {
                    alert('Notification Allow nahi hua! Phone/Chrome ki Site Settings me jaakar Notifications ko Allow karein.');
                }
                return;
            }

            const client = getSb();
            if (!client) {
                if (interactive) updateBtnState('off');
                return;
            }

            const reg = await navigator.serviceWorker.ready;
            reg.update().catch(() => {});

            const pubKey = await fetchPublicKey(client);
            if (!pubKey) {
                updateBtnState('off');
                if (interactive) alert('Push Server key nahi mili. Edge Function check karein.');
                return;
            }

            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(pubKey)
                });
            }

            const json = sub.toJSON();
            const { data, error } = await client.rpc('register_push_subscription', {
                p_portal_type: portal.type,
                p_token: token,
                p_endpoint: json.endpoint,
                p_p256dh: json.keys?.p256dh || '',
                p_auth: json.keys?.auth || ''
            });

            if (error || !data || !data.ok) {
                updateBtnState('off');
                if (interactive) alert('Save nahi hua: ' + (error?.message || data?.error || 'Try again'));
                return;
            }

            updateBtnState('on');
            if (interactive) {
                alert('✅ Notifications Chalu Ho Gayi! Ab naya kaam aate hi phone par turant notification bajega.');
            }
        } catch (err) {
            updateBtnState('off');
            if (interactive) alert('Notification error: ' + (err?.message || err));
        }
    };

    const injectPushButton = () => {
        const actionsBar = document.querySelector('#portal-screen .top-actions');
        if (!actionsBar || document.getElementById('erp-push-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'erp-push-btn';
        btn.type = 'button';
        btn.className = 'icon-btn';
        btn.onclick = () => syncSubscription(true);
        actionsBar.insertBefore(btn, actionsBar.firstChild);

        if ('Notification' in window && Notification.permission === 'granted') {
            updateBtnState('on');
            syncSubscription(false);
        } else {
            updateBtnState('off');
        }
    };

    const boot = () => {
        injectPushButton();
        const portal = detectPortal();
        const origSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function (k, v) {
            origSetItem(k, v);
            if (k === portal.tokenKey && v) {
                setTimeout(() => {
                    injectPushButton();
                    if ('Notification' in window && Notification.permission === 'granted') {
                        syncSubscription(false);
                    }
                }, 400);
            }
        };
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
