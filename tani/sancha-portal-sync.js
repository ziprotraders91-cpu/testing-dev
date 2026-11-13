/* ============================================================================
   SIMPLICITY ERP - SANCHA + RANGAI PORTAL 2-WAY SYNC & WORKER MANAGER
   File: tani/sancha-portal-sync.js • Developed for: Farhan Jawed
============================================================================ */

(() => {
    'use strict';

    let isPulling = false;
    let pollTimer = null;
    let cachedWorkers = [];
    let editingWorkerId = null;
    let cachedRangaiWorkers = [];
    let editingRangaiWorkerId = null;
    let tableObserverStarted = false;

    const getSupabase = () => {
        return window.supabaseClient || window.db || null;
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof window.safeArray === 'function') return window.safeArray(v);
        return [];
    };

    const getFromStore = (key) => {
        if (typeof window.getStore === 'function') return window.getStore(key);
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (_) {
            return [];
        }
    };

    const setToStore = (key, val) => {
        if (typeof window.setStore === 'function') {
            window.setStore(key, val);
        } else {
            localStorage.setItem(key, JSON.stringify(val));
        }
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function')
            ? window.getTodayDate()
            : new Date().toISOString().split('T')[0];
    };

    const getOwnerCreds = () => {
        try {
            const raw = localStorage.getItem('app_active_session_auth');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.id || !parsed.pass) return null;
            return {
                id: String(parsed.id).trim().toLowerCase(),
                pass: String(parsed.pass).trim(),
                name: String(parsed.name || 'Simplicity ERP').trim()
            };
        } catch (_) {
            return null;
        }
    };

    const getActiveSession = (uid) => {
        try {
            if (typeof window.getActiveFinancialSession === 'function') {
                return window.getActiveFinancialSession();
            }
            const stored = localStorage.getItem(`${uid}_app_active_session`) || localStorage.getItem('app_active_session');
            if (stored) return String(stored).replace(/['"]+/g, '').trim();
        } catch (_) {}
        return '2026-2027';
    };

    const getPortalUrl = () => {
        try {
            const href = window.location.href.split('?')[0].split('#')[0];
            if (href.endsWith('/')) return `${href}sancha.html`;
            return href.replace(/[^/]*$/, 'sancha.html');
        } catch (_) {
            return 'sancha.html';
        }
    };

    const getRangaiPortalUrl = () => {
        try {
            const href = window.location.href.split('?')[0].split('#')[0];
            if (href.endsWith('/')) return `${href}rangai-portal/`;
            return href.replace(/[^/]*$/, 'rangai-portal/');
        } catch (_) {
            return 'rangai-portal/';
        }
    };

    /* ========================================================================
       0. AUTO-INJECT BUTTONS & LIVE RANGAI TABLE BADGES (NO index.html EDIT)
       ======================================================================== */
    const decorateTaniTableRangaiBadges = () => {
        const tbody = document.getElementById('tani-orders-table-body');
        if (!tbody) return;

        const list = toArray(getFromStore('tani_orders_list'));
        if (!list.length) return;

        const orderByNo = new Map();
        list.forEach((o) => {
            if (o && o.orderNo) orderByNo.set(`#${String(o.orderNo).trim()}`, o);
        });

        tbody.querySelectorAll('tr').forEach((tr) => {
            if (tr.querySelector('.rangai-portal-subbadge')) return;
            const firstTd = tr.querySelector('td:first-child');
            const statusTd = tr.querySelector('td:nth-child(7)');
            if (!firstTd || !statusTd) return;

            const noTxt = firstTd.textContent.trim();
            const item = orderByNo.get(noTxt);
            if (!item || !item.rangi) return;

            const st = String(item.status || '').toLowerCase();
            const rSt = String(item.rangiPortalStatus || '').toLowerCase();

            let badgeHtml = '';
            if (st === 'rangai' && rSt === 'processing') {
                badgeHtml = '<div class="rangai-portal-subbadge" style="margin-top:4px;"><span style="background:#fae8ff; color:#86198f; border:1px solid #f0abfc; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:800;">🎨 Rangai Processing</span></div>';
            } else if (st === 'rangai' && rSt === 'pending') {
                badgeHtml = '<div class="rangai-portal-subbadge" style="margin-top:4px;"><span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:700;">⏳ Rangai Pending</span></div>';
            } else if (st === 'ready' && rSt === 'completed') {
                badgeHtml = '<div class="rangai-portal-subbadge" style="margin-top:4px;"><span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:800;">✅ Rangai Complete</span></div>';
            }

            if (badgeHtml) {
                statusTd.insertAdjacentHTML('beforeend', badgeHtml);
            }
        });
    };

    const startTableObserver = () => {
        if (tableObserverStarted) return;
        const tbody = document.getElementById('tani-orders-table-body');
        if (!tbody || typeof MutationObserver === 'undefined') return;
        tableObserverStarted = true;
        const obs = new MutationObserver(() => decorateTaniTableRangaiBadges());
        obs.observe(tbody, { childList: true });
        decorateTaniTableRangaiBadges();
    };

    const injectSanchaPortalButtons = () => {
        startTableObserver();
        const header = document.querySelector('#tani-order-section .module-header');
        if (!header || document.getElementById('sancha-portal-btn-group')) return;

        const existingAddBtn = header.querySelector('button[onclick="toggleTaniOrderForm()"]');
        const wrap = document.createElement('div');
        wrap.id = 'sancha-portal-btn-group';
        wrap.style.cssText = 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;';

        const syncBtn = document.createElement('button');
        syncBtn.type = 'button';
        syncBtn.className = 'add-btn';
        syncBtn.style.background = '#0284c7';
        syncBtn.textContent = '🔄 Sync Portals';
        syncBtn.onclick = () => syncSanchaPortalNow(syncBtn);

        const mgrBtn = document.createElement('button');
        mgrBtn.type = 'button';
        mgrBtn.className = 'add-btn';
        mgrBtn.style.background = '#0f766e';
        mgrBtn.textContent = '👷 Sancha Logins';
        mgrBtn.onclick = () => openSanchaWorkerManagerModal();

        const rangaiBtn = document.createElement('button');
        rangaiBtn.type = 'button';
        rangaiBtn.className = 'add-btn';
        rangaiBtn.style.background = '#86198f';
        rangaiBtn.textContent = '🎨 Rangai Logins';
        rangaiBtn.onclick = () => openRangaiWorkerManagerModal();

        wrap.appendChild(syncBtn);
        wrap.appendChild(mgrBtn);
        wrap.appendChild(rangaiBtn);

        if (existingAddBtn && existingAddBtn.parentNode === header) {
            header.insertBefore(wrap, existingAddBtn);
            wrap.appendChild(existingAddBtn);
        } else {
            header.appendChild(wrap);
        }
    };

    /* ========================================================================
       1. 2-WAY ORDER SYNC (SANCHA -> RANGAI -> KARKHANA READY)
       ======================================================================== */
    const pushTaniOrderToSanchaPortal = async (order) => {
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds || !navigator.onLine) return false;
        if (!order || !order.id) return false;

        const stLower = String(order.status || 'sancha').toLowerCase();
        const hasSancha = Boolean(String(order.sancha || '').trim());
        const hasRangi = Boolean(String(order.rangi || '').trim());
        if (!hasSancha && !(stLower === 'rangai' && hasRangi)) return false;

        try {
            const payload = {
                id: String(order.id),
                orderNo: String(order.orderNo || ''),
                session: getActiveSession(creds.id),
                date: String(order.date || ''),
                sancha: String(order.sancha || '').trim().toUpperCase(),
                kariger: String(order.kariger || '').trim().toUpperCase(),
                mohalla: String(order.mohalla || '').trim(),
                paai: String(order.paai || '').trim(),
                border: String(order.border || '').trim(),
                bana: String(order.bana || '').trim(),
                meter: Number(order.meter || 0),
                pcs: parseInt(order.pcs || 0, 10) || 0,
                rangi: String(order.rangi || '').trim().toUpperCase(),
                matchingTable: Array.isArray(order.matchingTable) ? order.matchingTable : [],
                contrastLabel: String(order.contrastLabel || ''),
                selectedContrasts: Array.isArray(order.selectedContrasts) ? order.selectedContrasts : [],
                status: stLower
            };

            const { data, error } = await sb.rpc('erp_upsert_sancha_order', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_order: payload
            });

            if (error || !data || !data.ok) {
                console.warn('[PortalSync] Push skipped/failed:', error?.message || data?.error);
                return false;
            }

            if (stLower === 'rangai' && hasRangi) {
                await sb.rpc('erp_set_order_rangi_pending', {
                    p_owner_id: creds.id,
                    p_owner_pass: creds.pass,
                    p_order_id: String(order.id)
                });
            }

            return true;
        } catch (err) {
            console.warn('[PortalSync] Push exception:', err);
            return false;
        }
    };

    const deleteTaniOrderFromSanchaPortal = async (orderId) => {
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds || !navigator.onLine || !orderId) return false;

        try {
            await sb.rpc('erp_delete_sancha_order', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_order_id: String(orderId)
            });
            return true;
        } catch (_) {
            return false;
        }
    };

    const pushUnpushedSanchaOrders = async () => {
        const list = toArray(getFromStore('tani_orders_list'));
        const toPush = list.filter((o) => {
            if (!o || o.sanchaPortalPushed) return false;
            const st = String(o.status || 'sancha').toLowerCase();
            return (st === 'sancha' && String(o.sancha || '').trim()) || (st === 'rangai' && String(o.rangi || '').trim());
        });
        if (!toPush.length) return;

        let pushedAny = false;
        for (const item of toPush) {
            const ok = await pushTaniOrderToSanchaPortal(item);
            if (ok) {
                item.sanchaPortalPushed = true;
                pushedAny = true;
            }
        }
        if (pushedAny) {
            setToStore('tani_orders_list', list);
        }
    };

    const pullSanchaOrderStatuses = async (silent = true) => {
        injectSanchaPortalButtons();
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds || !navigator.onLine || isPulling) return false;

        isPulling = true;
        try {
            await pushUnpushedSanchaOrders();

            const [sRes, rRes] = await Promise.all([
                sb.rpc('erp_pull_sancha_orders', { p_owner_id: creds.id, p_owner_pass: creds.pass }),
                sb.rpc('erp_pull_rangai_orders', { p_owner_id: creds.id, p_owner_pass: creds.pass })
            ]);

            const sOrders = (!sRes.error && sRes.data && sRes.data.ok && Array.isArray(sRes.data.orders)) ? sRes.data.orders : [];
            const rOrders = (!rRes.error && rRes.data && rRes.data.ok && Array.isArray(rRes.data.orders)) ? rRes.data.orders : [];

            if (!sOrders.length && !rOrders.length) {
                isPulling = false;
                return false;
            }

            const sMap = new Map();
            sOrders.forEach((r) => { if (r && r.order_id) sMap.set(String(r.order_id), r); });

            const rMap = new Map();
            rOrders.forEach((r) => { if (r && r.order_id) rMap.set(String(r.order_id), r); });

            const list = [...toArray(getFromStore('tani_orders_list'))];
            let hasChanged = false;

            list.forEach((item) => {
                if (!item || !item.id) return;
                const oid = String(item.id);
                const remS = sMap.get(oid);
                const remR = rMap.get(oid);

                if (!Array.isArray(item.statusHistory)) item.statusHistory = [];

                // A) Sancha Portal Status
                if (remS) {
                    const remStatus = String(remS.sancha_status || 'pending').toLowerCase();
                    const prevPortalStatus = String(item.sanchaPortalStatus || 'pending').toLowerCase();

                    if (prevPortalStatus !== remStatus) {
                        item.sanchaPortalStatus = remStatus;
                        item.sanchaPortalPushed = true;
                        if (remS.accepted_at) item.sanchaAcceptedAt = remS.accepted_at;
                        if (remS.completed_at) item.sanchaCompletedAt = remS.completed_at;

                        if (remStatus === 'processing') {
                            if (!item.statusHistory.some((h) => h && h.portalEvent === 'processing')) {
                                item.statusHistory.push({
                                    status: item.status || 'sancha',
                                    portalEvent: 'processing',
                                    date: getToday(),
                                    note: '⚙️ Sancha wala ne Tani Accept kar li (Processing)',
                                    timestamp: Date.now()
                                });
                            }
                        } else if (remStatus === 'completed') {
                            const rStCheck = String(remR?.rangi_status || 'waiting').toLowerCase();
                            if (String(item.status || 'sancha').toLowerCase() === 'sancha') {
                                item.status = (rStCheck !== 'waiting') ? 'rangai' : 'baithak';
                            }
                            if (!item.statusHistory.some((h) => h && h.portalEvent === 'completed')) {
                                item.statusHistory.push({
                                    status: item.status,
                                    portalEvent: 'completed',
                                    date: getToday(),
                                    note: '✅ Sancha wala ne Tani Complete kar di',
                                    timestamp: Date.now()
                                });
                            }
                        }
                        hasChanged = true;
                    }
                }

                // B) Rangai Portal Status
                if (remR) {
                    const remRStatus = String(remR.rangi_status || 'waiting').toLowerCase();
                    const prevRStatus = String(item.rangiPortalStatus || 'waiting').toLowerCase();

                    if (remRStatus !== 'waiting' && prevRStatus !== remRStatus) {
                        item.rangiPortalStatus = remRStatus;
                        item.sanchaPortalPushed = true;
                        if (remR.rangi_accepted_at) item.rangiAcceptedAt = remR.rangi_accepted_at;
                        if (remR.rangi_completed_at) item.rangiCompletedAt = remR.rangi_completed_at;

                        const curErpSt = String(item.status || '').toLowerCase();

                        if (remRStatus === 'pending') {
                            if (curErpSt === 'sancha' || curErpSt === 'baithak') {
                                item.status = 'rangai';
                            }
                            if (!item.statusHistory.some((h) => h && h.portalEvent === 'rangi_pending')) {
                                item.statusHistory.push({
                                    status: item.status,
                                    portalEvent: 'rangi_pending',
                                    date: getToday(),
                                    note: '🎨 Sancha se Complete hokar Rangai Request me gaya',
                                    timestamp: Date.now()
                                });
                            }
                        } else if (remRStatus === 'processing') {
                            if (curErpSt === 'sancha' || curErpSt === 'baithak') {
                                item.status = 'rangai';
                            }
                            if (!item.statusHistory.some((h) => h && h.portalEvent === 'rangi_processing')) {
                                item.statusHistory.push({
                                    status: item.status,
                                    portalEvent: 'rangi_processing',
                                    date: getToday(),
                                    note: '🎨 Rangai wala ne Tani Accept kar li (Processing)',
                                    timestamp: Date.now()
                                });
                            }
                        } else if (remRStatus === 'completed') {
                            if (curErpSt !== 'loom') {
                                item.status = 'ready';
                            }
                            if (!item.statusHistory.some((h) => h && h.portalEvent === 'rangi_completed')) {
                                item.statusHistory.push({
                                    status: item.status,
                                    portalEvent: 'rangi_completed',
                                    date: getToday(),
                                    note: '🟢 Rangai Complete → Karkhana/Baithak Ready!',
                                    timestamp: Date.now()
                                });
                            }
                        }
                        hasChanged = true;
                    }
                }
            });

            if (hasChanged) {
                setToStore('tani_orders_list', list);
                if (typeof window.updateTaniOrderBadges === 'function') window.updateTaniOrderBadges();
                if (typeof window.renderTaniMonthTabs === 'function') window.renderTaniMonthTabs();
                if (typeof window.renderTaniOrdersTable === 'function') window.renderTaniOrdersTable();
            } else if (!silent) {
                if (typeof window.renderTaniOrdersTable === 'function') window.renderTaniOrdersTable();
            }

            decorateTaniTableRangaiBadges();
            isPulling = false;
            return true;
        } catch (err) {
            console.warn('[PortalSync] Pull exception:', err);
            isPulling = false;
            return false;
        }
    };

    const syncSanchaPortalNow = async (btnEl) => {
        const origText = btnEl ? btnEl.textContent : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = '⏳ Syncing...';
        }
        await pullSanchaOrderStatuses(false);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = origText || '🔄 Sync Portals';
        }
    };

    /* ========================================================================
       2. SANCHA WORKER ACCOUNT MANAGER MODAL (OWNER ONLY)
       ======================================================================== */
    const openSanchaWorkerManagerModal = () => {
        const creds = getOwnerCreds();
        if (!creds) return alert('Pehle Owner ID se login karein!');

        const existing = document.getElementById('sancha-worker-manager-modal');
        if (existing) existing.remove();

        editingWorkerId = null;
        const portalLink = getPortalUrl();

        const modalHtml = `
        <div id="sancha-worker-manager-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.86); z-index:999999; display:flex; align-items:center; justify-content:center; padding:10px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:760px; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.65); overflow:hidden; font-family:sans-serif; max-height:95vh; display:flex; flex-direction:column;">
                <div style="background:#0f172a; color:#fff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; font-size:16px;">👷 Sancha Worker Logins (Mobile Portal)</h3>
                        <small style="color:#94a3b8; font-size:11px;">Har Sancha wale ka Mobile + 4-Digit PIN yahan se banayein</small>
                    </div>
                    <button type="button" onclick="closeSanchaWorkerManagerModal()" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1;">
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px 12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="font-size:12px; color:#1e3a8a; word-break:break-all;">
                            <strong>📱 Sancha Mobile Link:</strong><br>
                            <span id="swm-portal-url" style="color:#0284c7; font-weight:bold;">${esc(portalLink)}</span>
                        </div>
                        <button type="button" onclick="copySanchaPortalLink()" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📋 Copy Link</button>
                    </div>
                    <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:14px;">
                        <div id="swm-form-title" style="font-weight:800; color:#0f766e; font-size:13px; margin-bottom:10px;">➕ Naya Sancha Login Banayein:</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Sancha Wale Ka Naam:</label>
                                <input type="text" id="swm-name" placeholder="jaise: AZHAR" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #0f766e; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Parchi Sancha Naam:</label>
                                <input type="text" id="swm-alias" placeholder="Same ya Alias (e.g. AZHAR)" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Mobile No (Login ID):</label>
                                <input type="tel" maxlength="10" id="swm-mobile" placeholder="10-digit Mobile" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #2563eb; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#b91c1c; display:block; margin-bottom:2px;">4-Digit PIN:</label>
                                <input type="text" maxlength="4" inputmode="numeric" id="swm-pin" placeholder="1234" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #dc2626; border-radius:6px; font-size:14px; font-weight:900; text-align:center;">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 140px auto; gap:8px; align-items:flex-end;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Aapke Karkhane Ka Naam (Jo unko dikhe):</label>
                                <input type="text" id="swm-firm" value="${esc(creds.name)}" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Status:</label>
                                <select id="swm-status" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                    <option value="active">🟢 Active</option>
                                    <option value="blocked">🔴 Blocked</option>
                                </select>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="swm-cancel-edit" onclick="resetSanchaWorkerForm()" style="display:none; background:#64748b; color:#fff; border:none; padding:9px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Cancel</button>
                                <button type="button" id="swm-save-btn" onclick="saveSanchaWorkerFromModal()" style="background:#059669; color:#fff; border:none; padding:9px 18px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer;">💾 Save ID</button>
                            </div>
                        </div>
                        <div id="swm-msg" style="font-size:12px; font-weight:bold; margin-top:8px; display:none;"></div>
                    </div>
                    <div class="table-responsive" style="border:1px solid #cbd5e1; border-radius:8px;">
                        <table style="width:100%; border-collapse:collapse; font-size:12px;">
                            <thead>
                                <tr style="background:#0f766e; color:#fff; text-align:left;">
                                    <th style="padding:8px;">Sancha Naam</th>
                                    <th style="padding:8px;">Parchi Match</th>
                                    <th style="padding:8px;">Mobile</th>
                                    <th style="padding:8px;">PIN</th>
                                    <th style="padding:8px;">Status</th>
                                    <th style="padding:8px; text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="swm-table-body">
                                <tr><td colspan="6" style="text-align:center; padding:16px; color:#64748b;">Loading... ⏳</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        loadSanchaWorkersTable();
    };

    const closeSanchaWorkerManagerModal = () => {
        const modal = document.getElementById('sancha-worker-manager-modal');
        if (modal) modal.remove();
        editingWorkerId = null;
    };

    const copySanchaPortalLink = async () => {
        const url = getPortalUrl();
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                alert('✅ Sancha Mobile Link copy ho gaya!\n\n' + url);
            } else {
                prompt('Link copy karein:', url);
            }
        } catch (_) {
            prompt('Link copy karein:', url);
        }
    };

    const showSwmMsg = (text, isErr = false) => {
        const el = document.getElementById('swm-msg');
        if (!el) return;
        el.textContent = text;
        el.style.color = isErr ? '#dc2626' : '#059669';
        el.style.display = 'block';
    };

    const resetSanchaWorkerForm = () => {
        editingWorkerId = null;
        const creds = getOwnerCreds();
        if (document.getElementById('swm-form-title')) document.getElementById('swm-form-title').textContent = '➕ Naya Sancha Login Banayein:';
        if (document.getElementById('swm-name')) document.getElementById('swm-name').value = '';
        if (document.getElementById('swm-alias')) document.getElementById('swm-alias').value = '';
        if (document.getElementById('swm-mobile')) document.getElementById('swm-mobile').value = '';
        if (document.getElementById('swm-pin')) document.getElementById('swm-pin').value = '';
        if (document.getElementById('swm-firm')) document.getElementById('swm-firm').value = creds ? creds.name : 'Simplicity ERP';
        if (document.getElementById('swm-status')) document.getElementById('swm-status').value = 'active';
        if (document.getElementById('swm-cancel-edit')) document.getElementById('swm-cancel-edit').style.display = 'none';
        if (document.getElementById('swm-save-btn')) document.getElementById('swm-save-btn').textContent = '💾 Save ID';
    };

    const loadSanchaWorkersTable = async () => {
        const tbody = document.getElementById('swm-table-body');
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!tbody) return;

        if (!sb || !creds) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">Supabase ya Login session nahi mila.</td></tr>';
            return;
        }

        try {
            const { data, error } = await sb.rpc('erp_list_sancha_workers', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass
            });

            if (error || !data || !data.ok) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">${esc(error?.message || data?.error || 'Load failed')}</td></tr>`;
                return;
            }

            cachedWorkers = Array.isArray(data.workers) ? data.workers : [];
            if (!cachedWorkers.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#64748b;">Abhi koi Sancha ID nahi bani hai. Upar se banayein!</td></tr>';
                return;
            }

            let html = '';
            cachedWorkers.forEach((w) => {
                const isActive = (w.status === 'active');
                html += `<tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px; font-weight:bold; color:#0f172a;">${esc(w.worker_name)}</td>
                    <td style="padding:8px; color:#0284c7; font-weight:bold;">${esc(w.sancha_alias)}</td>
                    <td style="padding:8px; font-weight:bold;">${esc(w.mobile)}</td>
                    <td style="padding:8px; font-weight:900; color:#b45309;">${esc(w.pin)}</td>
                    <td style="padding:8px;">
                        <span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold; background:${isActive ? '#dcfce7' : '#fee2e2'}; color:${isActive ? '#15803d' : '#dc2626'};">
                            ${isActive ? '🟢 Active' : '🔴 Blocked'}
                        </span>
                    </td>
                    <td style="padding:8px; text-align:center; white-space:nowrap;">
                        <button type="button" onclick="shareSanchaWorkerWhatsApp('${esc(w.id)}')" style="background:#22c55e; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">📲 Share</button>
                        <button type="button" onclick="editSanchaWorkerRow('${esc(w.id)}')" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-left:3px;">✏️</button>
                        <button type="button" onclick="deleteSanchaWorkerRow('${esc(w.id)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-left:3px;">🗑️</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">Error: ${esc(err.message)}</td></tr>`;
        }
    };

    const saveSanchaWorkerFromModal = async () => {
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds) return showSwmMsg('Supabase connection nahi mila!', true);

        const name = String(document.getElementById('swm-name')?.value || '').trim().toUpperCase();
        const alias = String(document.getElementById('swm-alias')?.value || '').trim().toUpperCase() || name;
        const mobile = String(document.getElementById('swm-mobile')?.value || '').replace(/[^0-9]/g, '');
        const pin = String(document.getElementById('swm-pin')?.value || '').replace(/[^0-9]/g, '').slice(0, 4);
        const firm = String(document.getElementById('swm-firm')?.value || '').trim() || creds.name;
        const status = document.getElementById('swm-status')?.value || 'active';

        if (!name || mobile.length !== 10 || pin.length !== 4) {
            return showSwmMsg('⚠️ Naam, 10-digit Mobile Number aur 4-digit PIN zaroori hai!', true);
        }

        const btn = document.getElementById('swm-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving... ⏳'; }

        try {
            const { data, error } = await sb.rpc('erp_save_sancha_worker', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_worker_id: editingWorkerId || null,
                p_worker_name: name,
                p_sancha_alias: alias,
                p_firm_name: firm,
                p_mobile: mobile,
                p_pin: pin,
                p_status: status
            });

            if (btn) { btn.disabled = false; btn.textContent = editingWorkerId ? '💾 Update ID' : '💾 Save ID'; }

            if (error || !data || !data.ok) {
                return showSwmMsg('❌ ' + (error?.message || data?.error || 'Save nahi ho paya'), true);
            }

            showSwmMsg(`✅ [${name}] ki Sancha ID save ho gayi!`, false);
            resetSanchaWorkerForm();
            loadSanchaWorkersTable();
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = '💾 Save ID'; }
            showSwmMsg('❌ Error: ' + err.message, true);
        }
    };

    const editSanchaWorkerRow = (workerId) => {
        const w = cachedWorkers.find((x) => String(x.id) === String(workerId));
        if (!w) return;
        editingWorkerId = w.id;
        document.getElementById('swm-form-title').textContent = `✏️ Edit Sancha Login: ${w.worker_name}`;
        document.getElementById('swm-name').value = w.worker_name || '';
        document.getElementById('swm-alias').value = w.sancha_alias || '';
        document.getElementById('swm-mobile').value = w.mobile || '';
        document.getElementById('swm-pin').value = w.pin || '';
        document.getElementById('swm-firm').value = w.firm_name || '';
        document.getElementById('swm-status').value = w.status || 'active';
        document.getElementById('swm-cancel-edit').style.display = 'inline-block';
        document.getElementById('swm-save-btn').textContent = '💾 Update ID';
    };

    const deleteSanchaWorkerRow = async (workerId) => {
        if (!confirm('Kya aap is Sancha wale ka login account delete karna chahte hain?')) return;
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds) return;

        try {
            const { data, error } = await sb.rpc('erp_delete_sancha_worker', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_worker_id: workerId
            });
            if (error || !data || !data.ok) {
                return alert('Delete nahi ho paya: ' + (error?.message || data?.error));
            }
            loadSanchaWorkersTable();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const shareSanchaWorkerWhatsApp = (workerId) => {
        const w = cachedWorkers.find((x) => String(x.id) === String(workerId));
        if (!w) return;
        const url = getPortalUrl();
        const msg = `⚙️ *${w.firm_name} - Sancha Portal Login*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 *Naam:* ${w.worker_name}\n` +
            `📱 *App Link:* ${url}\n\n` +
            `🔑 *Login ID (Mobile):* ${w.mobile}\n` +
            `🔒 *Secret PIN:* ${w.pin}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Link khol kar Mobile No aur PIN daalein, aur "Add to Home Screen" kar lein.`;

        window.open(`https://api.whatsapp.com/send?phone=91${w.mobile}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       3. RANGAI WORKER ACCOUNT MANAGER MODAL (OWNER ONLY)
       ======================================================================== */
    const openRangaiWorkerManagerModal = () => {
        const creds = getOwnerCreds();
        if (!creds) return alert('Pehle Owner ID se login karein!');

        const existing = document.getElementById('rangai-worker-manager-modal');
        if (existing) existing.remove();

        editingRangaiWorkerId = null;
        const portalLink = getRangaiPortalUrl();

        const modalHtml = `
        <div id="rangai-worker-manager-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.86); z-index:999999; display:flex; align-items:center; justify-content:center; padding:10px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:760px; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.65); overflow:hidden; font-family:sans-serif; max-height:95vh; display:flex; flex-direction:column;">
                <div style="background:#4a044e; color:#fff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; font-size:16px;">🎨 Rangai Worker Logins (Mobile Portal)</h3>
                        <small style="color:#f5d0fe; font-size:11px;">Har Rangai wale ka Mobile + 4-Digit PIN yahan se banayein</small>
                    </div>
                    <button type="button" onclick="closeRangaiWorkerManagerModal()" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1;">
                    <div style="background:#fdf4ff; border:1px solid #f0abfc; border-radius:8px; padding:10px 12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="font-size:12px; color:#701a75; word-break:break-all;">
                            <strong>📱 Rangai Mobile Link:</strong><br>
                            <span style="color:#a21caf; font-weight:bold;">${esc(portalLink)}</span>
                        </div>
                        <button type="button" onclick="copyRangaiPortalLink()" style="background:#a21caf; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📋 Copy Link</button>
                    </div>
                    <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:14px;">
                        <div id="rwm-form-title" style="font-weight:800; color:#86198f; font-size:13px; margin-bottom:10px;">➕ Naya Rangai Login Banayein:</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Rangai Wale Ka Naam:</label>
                                <input type="text" id="rwm-name" placeholder="jaise: IRFAN" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #86198f; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Parchi Rangi Naam:</label>
                                <input type="text" id="rwm-alias" placeholder="Same jo Parchi me likhte hain" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Mobile No (Login ID):</label>
                                <input type="tel" maxlength="10" id="rwm-mobile" placeholder="10-digit Mobile" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #2563eb; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#b91c1c; display:block; margin-bottom:2px;">4-Digit PIN:</label>
                                <input type="text" maxlength="4" inputmode="numeric" id="rwm-pin" placeholder="1234" style="width:100%; box-sizing:border-box; padding:8px; border:1.5px solid #dc2626; border-radius:6px; font-size:14px; font-weight:900; text-align:center;">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 140px auto; gap:8px; align-items:flex-end;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Aapke Karkhane Ka Naam (Jo unko dikhe):</label>
                                <input type="text" id="rwm-firm" value="${esc(creds.name)}" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155; display:block; margin-bottom:2px;">Status:</label>
                                <select id="rwm-status" style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                    <option value="active">🟢 Active</option>
                                    <option value="blocked">🔴 Blocked</option>
                                </select>
                            </div>
                            <div style="display:flex; gap:6px;">
                                <button type="button" id="rwm-cancel-edit" onclick="resetRangaiWorkerForm()" style="display:none; background:#64748b; color:#fff; border:none; padding:9px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Cancel</button>
                                <button type="button" id="rwm-save-btn" onclick="saveRangaiWorkerFromModal()" style="background:#86198f; color:#fff; border:none; padding:9px 18px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer;">💾 Save ID</button>
                            </div>
                        </div>
                        <div id="rwm-msg" style="font-size:12px; font-weight:bold; margin-top:8px; display:none;"></div>
                    </div>
                    <div class="table-responsive" style="border:1px solid #cbd5e1; border-radius:8px;">
                        <table style="width:100%; border-collapse:collapse; font-size:12px;">
                            <thead>
                                <tr style="background:#701a75; color:#fff; text-align:left;">
                                    <th style="padding:8px;">Rangai Naam</th>
                                    <th style="padding:8px;">Parchi Match</th>
                                    <th style="padding:8px;">Mobile</th>
                                    <th style="padding:8px;">PIN</th>
                                    <th style="padding:8px;">Status</th>
                                    <th style="padding:8px; text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="rwm-table-body">
                                <tr><td colspan="6" style="text-align:center; padding:16px; color:#64748b;">Loading... ⏳</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        loadRangaiWorkersTable();
    };

    const closeRangaiWorkerManagerModal = () => {
        const modal = document.getElementById('rangai-worker-manager-modal');
        if (modal) modal.remove();
        editingRangaiWorkerId = null;
    };

    const copyRangaiPortalLink = async () => {
        const url = getRangaiPortalUrl();
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                alert('✅ Rangai Mobile Link copy ho gaya!\n\n' + url);
            } else {
                prompt('Link copy karein:', url);
            }
        } catch (_) {
            prompt('Link copy karein:', url);
        }
    };

    const showRwmMsg = (text, isErr = false) => {
        const el = document.getElementById('rwm-msg');
        if (!el) return;
        el.textContent = text;
        el.style.color = isErr ? '#dc2626' : '#059669';
        el.style.display = 'block';
    };

    const resetRangaiWorkerForm = () => {
        editingRangaiWorkerId = null;
        const creds = getOwnerCreds();
        if (document.getElementById('rwm-form-title')) document.getElementById('rwm-form-title').textContent = '➕ Naya Rangai Login Banayein:';
        if (document.getElementById('rwm-name')) document.getElementById('rwm-name').value = '';
        if (document.getElementById('rwm-alias')) document.getElementById('rwm-alias').value = '';
        if (document.getElementById('rwm-mobile')) document.getElementById('rwm-mobile').value = '';
        if (document.getElementById('rwm-pin')) document.getElementById('rwm-pin').value = '';
        if (document.getElementById('rwm-firm')) document.getElementById('rwm-firm').value = creds ? creds.name : 'Simplicity ERP';
        if (document.getElementById('rwm-status')) document.getElementById('rwm-status').value = 'active';
        if (document.getElementById('rwm-cancel-edit')) document.getElementById('rwm-cancel-edit').style.display = 'none';
        if (document.getElementById('rwm-save-btn')) document.getElementById('rwm-save-btn').textContent = '💾 Save ID';
    };

    const loadRangaiWorkersTable = async () => {
        const tbody = document.getElementById('rwm-table-body');
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!tbody) return;

        if (!sb || !creds) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">Supabase ya Login session nahi mila.</td></tr>';
            return;
        }

        try {
            const { data, error } = await sb.rpc('erp_list_rangai_workers', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass
            });

            if (error || !data || !data.ok) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">${esc(error?.message || data?.error || 'Load failed')}</td></tr>`;
                return;
            }

            cachedRangaiWorkers = Array.isArray(data.workers) ? data.workers : [];
            if (!cachedRangaiWorkers.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:#64748b;">Abhi koi Rangai ID nahi bani hai. Upar se banayein!</td></tr>';
                return;
            }

            let html = '';
            cachedRangaiWorkers.forEach((w) => {
                const isActive = (w.status === 'active');
                html += `<tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px; font-weight:bold; color:#0f172a;">${esc(w.worker_name)}</td>
                    <td style="padding:8px; color:#86198f; font-weight:bold;">${esc(w.rangi_alias)}</td>
                    <td style="padding:8px; font-weight:bold;">${esc(w.mobile)}</td>
                    <td style="padding:8px; font-weight:900; color:#b45309;">${esc(w.pin)}</td>
                    <td style="padding:8px;">
                        <span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold; background:${isActive ? '#dcfce7' : '#fee2e2'}; color:${isActive ? '#15803d' : '#dc2626'};">
                            ${isActive ? '🟢 Active' : '🔴 Blocked'}
                        </span>
                    </td>
                    <td style="padding:8px; text-align:center; white-space:nowrap;">
                        <button type="button" onclick="shareRangaiWorkerWhatsApp('${esc(w.id)}')" style="background:#22c55e; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">📲 Share</button>
                        <button type="button" onclick="editRangaiWorkerRow('${esc(w.id)}')" style="background:#fdf4ff; color:#86198f; border:1px solid #f0abfc; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-left:3px;">✏️</button>
                        <button type="button" onclick="deleteRangaiWorkerRow('${esc(w.id)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-left:3px;">🗑️</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#dc2626;">Error: ${esc(err.message)}</td></tr>`;
        }
    };

    const saveRangaiWorkerFromModal = async () => {
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds) return showRwmMsg('Supabase connection nahi mila!', true);

        const name = String(document.getElementById('rwm-name')?.value || '').trim().toUpperCase();
        const alias = String(document.getElementById('rwm-alias')?.value || '').trim().toUpperCase() || name;
        const mobile = String(document.getElementById('rwm-mobile')?.value || '').replace(/[^0-9]/g, '');
        const pin = String(document.getElementById('rwm-pin')?.value || '').replace(/[^0-9]/g, '').slice(0, 4);
        const firm = String(document.getElementById('rwm-firm')?.value || '').trim() || creds.name;
        const status = document.getElementById('rwm-status')?.value || 'active';

        if (!name || mobile.length !== 10 || pin.length !== 4) {
            return showRwmMsg('⚠️ Naam, 10-digit Mobile Number aur 4-digit PIN zaroori hai!', true);
        }

        const btn = document.getElementById('rwm-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving... ⏳'; }

        try {
            const { data, error } = await sb.rpc('erp_save_rangai_worker', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_worker_id: editingRangaiWorkerId || null,
                p_worker_name: name,
                p_rangi_alias: alias,
                p_firm_name: firm,
                p_mobile: mobile,
                p_pin: pin,
                p_status: status
            });

            if (btn) { btn.disabled = false; btn.textContent = editingRangaiWorkerId ? '💾 Update ID' : '💾 Save ID'; }

            if (error || !data || !data.ok) {
                return showRwmMsg('❌ ' + (error?.message || data?.error || 'Save nahi ho paya'), true);
            }

            showRwmMsg(`✅ [${name}] ki Rangai ID save ho gayi!`, false);
            resetRangaiWorkerForm();
            loadRangaiWorkersTable();
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = '💾 Save ID'; }
            showRwmMsg('❌ Error: ' + err.message, true);
        }
    };

    const editRangaiWorkerRow = (workerId) => {
        const w = cachedRangaiWorkers.find((x) => String(x.id) === String(workerId));
        if (!w) return;
        editingRangaiWorkerId = w.id;
        document.getElementById('rwm-form-title').textContent = `✏️ Edit Rangai Login: ${w.worker_name}`;
        document.getElementById('rwm-name').value = w.worker_name || '';
        document.getElementById('rwm-alias').value = w.rangi_alias || '';
        document.getElementById('rwm-mobile').value = w.mobile || '';
        document.getElementById('rwm-pin').value = w.pin || '';
        document.getElementById('rwm-firm').value = w.firm_name || '';
        document.getElementById('rwm-status').value = w.status || 'active';
        document.getElementById('rwm-cancel-edit').style.display = 'inline-block';
        document.getElementById('rwm-save-btn').textContent = '💾 Update ID';
    };

    const deleteRangaiWorkerRow = async (workerId) => {
        if (!confirm('Kya aap is Rangai wale ka login account delete karna chahte hain?')) return;
        const sb = getSupabase();
        const creds = getOwnerCreds();
        if (!sb || !creds) return;

        try {
            const { data, error } = await sb.rpc('erp_delete_rangai_worker', {
                p_owner_id: creds.id,
                p_owner_pass: creds.pass,
                p_worker_id: workerId
            });
            if (error || !data || !data.ok) {
                return alert('Delete nahi ho paya: ' + (error?.message || data?.error));
            }
            loadRangaiWorkersTable();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const shareRangaiWorkerWhatsApp = (workerId) => {
        const w = cachedRangaiWorkers.find((x) => String(x.id) === String(workerId));
        if (!w) return;
        const url = getRangaiPortalUrl();
        const msg = `🎨 *${w.firm_name} - Rangai Portal Login*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 *Naam:* ${w.worker_name}\n` +
            `📱 *App Link:* ${url}\n\n` +
            `🔑 *Login ID (Mobile):* ${w.mobile}\n` +
            `🔒 *Secret PIN:* ${w.pin}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `Link khol kar Mobile No aur PIN daalein, aur "Add to Home Screen" kar lein.`;

        window.open(`https://api.whatsapp.com/send?phone=91${w.mobile}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       4. BACKGROUND AUTO-POLLING & WINDOW HOOKS
       ======================================================================== */
    const startPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            const sec = document.getElementById('tani-order-section');
            const desktop = document.getElementById('desktop-screen');
            if (desktop && desktop.style.display !== 'none' && sec && sec.style.display !== 'none') {
                pullSanchaOrderStatuses(true);
            }
        }, 20000);
    };

    window.addEventListener('focus', () => {
        const desktop = document.getElementById('desktop-screen');
        if (desktop && desktop.style.display !== 'none' && navigator.onLine) {
            pullSanchaOrderStatuses(true);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSanchaPortalButtons);
    } else {
        injectSanchaPortalButtons();
    }

    startPolling();

    const api = {
        injectSanchaPortalButtons,
        pushTaniOrderToSanchaPortal,
        deleteTaniOrderFromSanchaPortal,
        pullSanchaOrderStatuses,
        syncSanchaPortalNow,
        openSanchaWorkerManagerModal,
        closeSanchaWorkerManagerModal,
        copySanchaPortalLink,
        resetSanchaWorkerForm,
        saveSanchaWorkerFromModal,
        editSanchaWorkerRow,
        deleteSanchaWorkerRow,
        shareSanchaWorkerWhatsApp,
        openRangaiWorkerManagerModal,
        closeRangaiWorkerManagerModal,
        copyRangaiPortalLink,
        resetRangaiWorkerForm,
        saveRangaiWorkerFromModal,
        editRangaiWorkerRow,
        deleteRangaiWorkerRow,
        shareRangaiWorkerWhatsApp
    };

    Object.keys(api).forEach((k) => { window[k] = api[k]; });
    window.SanchaPortalSync = api;
})();
