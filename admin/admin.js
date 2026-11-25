/* ============================================================================
   SIMPLICITY ERP - LIVE ADMIN CONTROL, STORAGE MONITOR & PER-KARIGER BILLING
   File: admin/admin.js • Developed by Farhan Jawed
   Architecture: Supabase Realtime + Accurate Storage RPC + Secured Full User Purge
   Hardening: Action Locks • XSS-Safe Delegation • 1000+ Pagination • PWA Safe UI
============================================================================ */

(() => {
    'use strict';

    if (window._adminEngineLoaded) {
        console.warn('[Admin] Already loaded — skip duplicate');
        return;
    }
    window._adminEngineLoaded = true;

    const GMAIL_ENGINE_URL = 'https://script.google.com/macros/s/AKfycbzuHcuZf6gS4jIP2fS4Y7kGLw6MG2k_h9BDEdO2HOsredwvuJeys3m0Y-zCRlIX060bYQ/exec';
    const GMAIL_ENGINE_SECRET = 'simplicity_erp_mail_2026';
    const BILLING_CONFIG_ID = 'farhan_global_billing_config';
    const ADMIN_PAGE_SIZE = 50;

    const DEFAULT_BILLING_CONFIG = Object.freeze({
        perKarigerRate: '15',
        minCharge: '0',
        accountHolder: 'FARHAN JAWED',
        bankName: 'State Bank of India',
        accountNumber: '',
        ifscCode: '',
        upiId: 'farhan275101-2@oksbi',
        whatsappNo: '917065572191',
        qrImageBase64: '',
        note: 'Payment karne ke baad screenshot WhatsApp par bhej dein.'
    });

    window.adminUsersData = [];
    window.adminStorageMap = {};
    window.adminKarigerCountMap = {};
    let currentBillingCfg = { ...DEFAULT_BILLING_CONFIG };
    let supabaseAdminChannel = null;
    let currentAdminFilter = 'all';
    let currentAdminSearch = '';
    let currentAdminPage = 1;
    let pendingQrBase64 = null;

    // Concurrency Locks
    let isFetchingUsers = false;
    let isSavingBilling = false;
    const adminBusyUids = new Set();

    const getSupabaseAdmin = () => {
        return window.supabaseClient || (window.CloudEngine && window.CloudEngine.supabase) || null;
    };

    const getLocalTodayIso = () => {
        if (typeof window.getTodayDate === 'function') {
            const d = window.getTodayDate();
            if (d && /^\d{4}-\d{2}-\d{2}$/.test(String(d))) return String(d);
        }
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const parseLocalIsoDate = (isoStr) => {
        const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    };

    const formatDate = (d) => {
        if (typeof window.formatDateDisplay === 'function') return window.formatDateDisplay(d);
        if (!d) return '-';
        const p = String(d).split('-');
        return (p.length === 3 && p[0].length === 4) ? `${p[2]}-${p[1]}-${p[0]}` : d;
    };

    const formatBytes = (bytes) => {
        const b = Number(bytes) || 0;
        if (b <= 0) return '0 KB';
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
        return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const setAdminBanner = (msg, type = 'info') => {
        const el = document.getElementById('adm-status-banner');
        if (!el) {
            if (msg) console[type === 'error' ? 'warn' : 'log']('[Admin]', msg);
            return;
        }
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        const palette = {
            success: { bg: '#ecfdf5', fg: '#065f46', bd: '#a7f3d0' },
            error: { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' },
            info: { bg: '#eff6ff', fg: '#1e40af', bd: '#bfdbfe' }
        };
        const p = palette[type] || palette.info;
        el.style.display = 'block';
        el.style.background = p.bg;
        el.style.color = p.fg;
        el.style.borderColor = p.bd;
        el.textContent = msg;

        clearTimeout(el.__hideTimer);
        el.__hideTimer = setTimeout(() => {
            el.style.display = 'none';
        }, 5500);
    };

    const setBillingStatusMsg = (msg, isError = true) => {
        const el = document.getElementById('adm-bill-status');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.style.display = 'block';
        el.style.color = isError ? '#b91c1c' : '#15803d';
        el.style.background = isError ? '#fef2f2' : '#ecfdf5';
        el.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
        el.textContent = msg;
    };

    const sendAdminApprovalEmail = async (payload) => {
        try {
            const res = await fetch(GMAIL_ENGINE_URL, {
                method: 'POST',
                body: JSON.stringify({ secret: GMAIL_ENGINE_SECRET, ...payload })
            });
            return await res.json();
        } catch (_) {
            return { ok: false };
        }
    };

    const loadBillingConfig = async () => {
        let cfg = { ...DEFAULT_BILLING_CONFIG };
        try {
            const localRaw = localStorage.getItem('app_global_billing_config');
            if (localRaw) cfg = { ...cfg, ...JSON.parse(localRaw) };
        } catch (_) {}

        const sb = getSupabaseAdmin();
        if (sb && navigator.onLine) {
            try {
                const { data } = await sb
                    .from('app_store')
                    .select('data, value')
                    .eq('id', BILLING_CONFIG_ID)
                    .limit(1);
                if (data && data.length > 0) {
                    const cloudObj = data[0].data || data[0].value;
                    if (cloudObj && typeof cloudObj === 'object') {
                        cfg = { ...cfg, ...cloudObj };
                        try { localStorage.setItem('app_global_billing_config', JSON.stringify(cfg)); } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        currentBillingCfg = cfg;
        return cfg;
    };

    const closeAdminActionModal = () => {
        const m = document.getElementById('adm-action-modal');
        if (m) m.remove();
    };

    const openAdminActionModal = ({ title, bodyHtml, confirmLabel, confirmColor = '#0f766e', onConfirm }) => {
        closeAdminActionModal();
        const html = `
        <div id="adm-action-modal" style="position:fixed; inset:0; background:rgba(15,23,42,0.75); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box; font-family:sans-serif;">
            <div style="background:#ffffff; width:100%; max-width:420px; border-radius:14px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.4);">
                <div style="background:#0f172a; color:#ffffff; padding:13px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:15px; font-weight:800;">${esc(title)}</h3>
                    <button type="button" id="adm-act-close-x" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div style="padding:16px;">
                    ${bodyHtml}
                    <div id="adm-act-err" style="display:none; margin-top:10px; font-size:12px; font-weight:700; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:8px 10px; border-radius:7px;"></div>
                    <div style="display:flex; gap:8px; margin-top:14px;">
                        <button type="button" id="adm-act-confirm-btn" style="flex:1; background:${confirmColor}; color:#ffffff; border:none; padding:10px; border-radius:8px; font-size:13.5px; font-weight:800; cursor:pointer;">${esc(confirmLabel)}</button>
                        <button type="button" id="adm-act-cancel-btn" style="background:#e2e8f0; color:#334155; border:none; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);

        const setErr = (m) => {
            const errEl = document.getElementById('adm-act-err');
            if (!errEl) return;
            errEl.style.display = m ? 'block' : 'none';
            errEl.textContent = m || '';
        };

        document.getElementById('adm-act-close-x')?.addEventListener('click', closeAdminActionModal);
        document.getElementById('adm-act-cancel-btn')?.addEventListener('click', closeAdminActionModal);
        document.getElementById('adm-act-confirm-btn')?.addEventListener('click', async () => {
            if (typeof onConfirm === 'function') {
                await onConfirm(setErr, closeAdminActionModal);
            }
        });
    };

    const bindAdminDelegatedEvents = (adminSec) => {
        if (!adminSec || adminSec.dataset.admEventsBound === '1') return;
        adminSec.dataset.admEventsBound = '1';

        adminSec.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-adm-act]');
            if (!btn) return;
            const act = btn.dataset.admAct;
            const uid = btn.dataset.uid || '';

            if (act === 'toggle-pass') toggleAdminRowPass(btn);
            else if (act === 'approve') approveUserByAdmin(uid);
            else if (act === 'delete') deleteUserByAdmin(uid);
            else if (act === 'block') toggleUserBlockStatus(uid);
            else if (act === 'pass') resetUserPasswordByAdmin(uid);
            else if (act === 'extend') extendValidity(uid, 30);
            else if (act === 'page-prev') {
                if (currentAdminPage > 1) {
                    currentAdminPage--;
                    renderAdminUsersTable();
                }
            } else if (act === 'page-next') {
                currentAdminPage++;
                renderAdminUsersTable();
            }
        });

        adminSec.addEventListener('change', (e) => {
            const inp = e.target.closest('input[data-adm-expiry]');
            if (!inp) return;
            const uid = inp.dataset.uid || '';
            if (uid) updateUserExpiryDate(uid, inp.value);
        });

        if (!window._adminEscBound) {
            window._adminEscBound = true;
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (document.getElementById('adm-action-modal')) {
                    closeAdminActionModal();
                } else if (document.getElementById('admin-billing-modal')) {
                    closeAdminBillingModal();
                }
            });
        }
    };

    const buildModernAdminShell = () => {
        const adminSec = document.getElementById('admin-section');
        if (!adminSec || adminSec.dataset.modernBuilt === 'true') return;

        adminSec.dataset.modernBuilt = 'true';
        adminSec.innerHTML = `
            <style>
                .adm-wrap { font-family: sans-serif; max-width: 1220px; margin: 0 auto; }
                .adm-topbar {
                    background: #0f172a; color: #ffffff; padding: 14px 18px; border-radius: 14px;
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
                    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.25); margin-bottom: 14px;
                }
                .adm-top-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
                .adm-stats {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
                    gap: 10px; margin-bottom: 14px;
                }
                .adm-stat-card {
                    background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px;
                    padding: 12px 14px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
                }
                .adm-stat-card small { font-size: 11px; font-weight: 700; display: block; margin-bottom: 4px; }
                .adm-stat-card h3 { margin: 0; font-size: 20px; font-weight: 900; }
                .adm-toolbar {
                    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px;
                    padding: 10px 12px; margin-bottom: 14px; display: flex;
                    justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
                }
                .adm-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
                .adm-tab-btn {
                    background: #ffffff; color: #334155; border: 1px solid #cbd5e1;
                    padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;
                }
                .adm-tab-btn.active {
                    background: #0f172a; color: #ffffff; border-color: #0f172a;
                }
                .adm-search {
                    padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
                    font-size: 13px; min-width: 210px; flex: 1; max-width: 320px; box-sizing: border-box;
                }
                .adm-table-card {
                    background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px;
                    overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
                }
                .adm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
                .adm-table thead tr { background: #0f172a; color: #ffffff; text-align: left; }
                .adm-table th { padding: 11px 10px; font-weight: 700; font-size: 12px; white-space: nowrap; }
                .adm-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .adm-table tbody tr:hover { background: #f8fafc; }
                @media (max-width: 640px) {
                    .adm-topbar { padding: 12px 14px; }
                    .adm-search { max-width: 100%; width: 100%; }
                }
            </style>

            <div class="adm-wrap">
                <div class="adm-topbar">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <button type="button" onclick="backToDashboard()" style="background:#1e293b; color:#ffffff; border:1px solid #334155; padding:7px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer;">← Dashboard</button>
                        <div>
                            <h2 style="margin:0; font-size:17px; font-weight:800; color:#ffffff;">👑 Master Admin Control</h2>
                            <div style="font-size:11.5px; color:#94a3b8;">Users Approval, Storage Monitor &amp; Kariger Billing</div>
                        </div>
                    </div>
                    <div class="adm-top-actions">
                        <button type="button" onclick="openAdminBillingModal()" style="background:#2563eb; color:#ffffff; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:800; cursor:pointer;">💳 Payment / QR</button>
                        <button type="button" id="admin-refresh-users-btn" onclick="refreshAdminUsersList(false)" style="background:#0f766e; color:#ffffff; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:800; cursor:pointer;">🔄 Refresh List</button>
                    </div>
                </div>

                <div id="adm-status-banner" style="display:none; padding:10px 14px; border-radius:10px; border:1.5px solid #bfdbfe; font-size:12.5px; font-weight:700; margin-bottom:12px;"></div>

                <div class="adm-stats">
                    <div class="adm-stat-card">
                        <small style="color:#64748b;">👥 Kul Users</small>
                        <h3 id="adm-stat-total" style="color:#0f172a;">0</h3>
                    </div>
                    <div class="adm-stat-card" style="background:#ecfdf5; border-color:#a7f3d0;">
                        <small style="color:#047857;">🟢 Active</small>
                        <h3 id="adm-stat-active" style="color:#047857;">0</h3>
                    </div>
                    <div class="adm-stat-card" style="background:#fffbeb; border-color:#fde68a;">
                        <small style="color:#b45309;">⏳ Pending</small>
                        <h3 id="adm-stat-pending" style="color:#b45309;">0</h3>
                    </div>
                    <div class="adm-stat-card" style="background:#fef2f2; border-color:#fecaca;">
                        <small style="color:#b91c1c;">⛔ Blocked / Exp</small>
                        <h3 id="adm-stat-blocked" style="color:#b91c1c;">0</h3>
                    </div>
                    <div class="adm-stat-card" style="background:#f0fdfa; border-color:#99f6e4;">
                        <small style="color:#0f766e;">🧵 Kul Karigers</small>
                        <h3 id="adm-stat-karigers" style="color:#0f766e;">0</h3>
                    </div>
                    <div class="adm-stat-card" style="background:#eff6ff; border-color:#bfdbfe;">
                        <small style="color:#1d4ed8;">💾 Total Cloud Data</small>
                        <h3 id="adm-stat-storage" style="color:#1d4ed8;">0 KB</h3>
                    </div>
                </div>

                <div id="admin-pending-approval-banner" style="display:none;"></div>

                <div class="adm-toolbar">
                    <div class="adm-tabs">
                        <button type="button" class="adm-tab-btn active" id="adm-tab-all" onclick="setAdminUsersFilter('all')">Sabhi</button>
                        <button type="button" class="adm-tab-btn" id="adm-tab-pending" onclick="setAdminUsersFilter('pending')">⏳ Pending</button>
                        <button type="button" class="adm-tab-btn" id="adm-tab-active" onclick="setAdminUsersFilter('active')">🟢 Active</button>
                        <button type="button" class="adm-tab-btn" id="adm-tab-blocked" onclick="setAdminUsersFilter('blocked')">⛔ Blocked / Expired</button>
                    </div>
                    <input type="text" id="admin-search-input" class="adm-search" placeholder="🔍 Naam, User ID ya Mobile search..." oninput="handleAdminUserSearch(this.value)">
                </div>

                <div class="adm-table-card">
                    <div class="table-responsive" style="overflow-x:auto;">
                        <table class="adm-table">
                            <thead>
                                <tr>
                                    <th style="width:36px; text-align:center;">#</th>
                                    <th>Karkhana / Naam</th>
                                    <th>Mobile &amp; ID</th>
                                    <th>Karigers &amp; Bill</th>
                                    <th>Storage</th>
                                    <th>Password</th>
                                    <th>Join &amp; Validity</th>
                                    <th>Status</th>
                                    <th style="text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="admin-users-table-body"></tbody>
                        </table>
                    </div>
                    <div id="adm-pagination-bar" style="display:none; justify-content:space-between; align-items:center; padding:10px 14px; border-top:1px solid #e2e8f0; background:#f8fafc; flex-wrap:wrap; gap:8px; font-size:12px;"></div>
                </div>
            </div>
        `;
        bindAdminDelegatedEvents(adminSec);
    };

    const fetchAllUsersPaginated = async (sb) => {
        const allRows = [];
        const pageSize = 1000;
        let from = 0;

        while (true) {
            const { data, error } = await sb
                .from('karkhana_users')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) throw error;
            if (!Array.isArray(data) || data.length === 0) break;
            allRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
        }
        return allRows;
    };

    const fetchAllUsersStorageMap = async (sb) => {
        if (!sb) return {};
        try {
            const { data, error } = await sb.rpc('get_all_users_storage_usage');
            if (error) {
                console.warn('[Admin] Storage usage RPC error:', error.message);
            } else if (Array.isArray(data)) {
                const map = {};
                data.forEach((r) => {
                    if (r && r.uid) {
                        const key = String(r.uid).trim().toLowerCase();
                        if (key) {
                            map[key] = (map[key] || 0) + (Number(r.total_bytes) || 0);
                        }
                    }
                });
                window.adminStorageMap = map;
                return map;
            }
        } catch (err) {
            console.warn('[Admin] Storage usage exception:', err);
        }
        return window.adminStorageMap || {};
    };

    const fetchAllUsersKarigerCounts = async (sb) => {
        if (!sb) return {};
        try {
            const { data, error } = await sb.rpc('get_all_users_kariger_counts');
            if (error) {
                console.warn('[Admin] Kariger counts RPC error:', error.message);
            } else if (Array.isArray(data)) {
                const map = {};
                data.forEach((r) => {
                    if (r && r.uid) {
                        const key = String(r.uid).trim().toLowerCase();
                        if (key) {
                            map[key] = (map[key] || 0) + (Number(r.kariger_count) || 0);
                        }
                    }
                });
                window.adminKarigerCountMap = map;
                return map;
            }
        } catch (err) {
            console.warn('[Admin] Kariger counts exception:', err);
        }
        return window.adminKarigerCountMap || {};
    };

    const mapUserRows = (rows) => {
        const arr = [];
        let pendingCount = 0;
        if (Array.isArray(rows)) {
            rows.forEach((row) => {
                const st = String(row.status || '').toLowerCase().trim();
                if (st === 'pending' || st === 'pending_approval' || st === 'waiting') {
                    pendingCount++;
                }
                arr.push({
                    id: row.user_id,
                    name: row.full_name || row.user_id,
                    mobile: row.mobile || '-',
                    email: row.email || '',
                    pass: row.password || '-',
                    pin: row.pin || '',
                    role: row.role || 'owner',
                    status: row.status || 'active',
                    date: row.created_at ? row.created_at.split('T')[0] : '-',
                    expiryDate: row.validity_date || ''
                });
            });
        }
        return { arr, pendingCount };
    };

    function openAdminModule() {
        const uid = String(window.currentUserId || localStorage.getItem('app_current_user_id') || '').trim().toLowerCase();
        const role = String(window.currentUserRole || '').trim().toLowerCase();

        if (role !== 'admin' && uid !== 'farhan') {
            console.warn('[Admin] Unauthorized access blocked.');
            const errEl = document.getElementById('login-error');
            if (errEl) {
                errEl.textContent = '⛔ Sirf Master Admin (Farhan) is panel ko access kar sakte hain!';
                errEl.style.display = 'block';
            }
            return;
        }

        if (typeof window.hideAllSections === 'function') {
            window.hideAllSections();
        } else {
            document.querySelectorAll('.module-section').forEach((s) => { s.style.display = 'none'; });
            const dView = document.getElementById('dashboard-view');
            if (dView) dView.style.display = 'none';
        }

        const adminSec = document.getElementById('admin-section');
        if (adminSec) adminSec.style.display = 'block';

        buildModernAdminShell();
        renderAdminUsersTable();
        fetchAndListenAdminUsers();
    }

    async function fetchAndListenAdminUsers(callback) {
        const sb = getSupabaseAdmin();
        if (!sb) {
            if (typeof callback === 'function') callback(false, 'Supabase DB not connected');
            return;
        }

        if (isFetchingUsers) return;
        isFetchingUsers = true;

        try {
            const [usersRows] = await Promise.all([
                fetchAllUsersPaginated(sb),
                fetchAllUsersStorageMap(sb),
                fetchAllUsersKarigerCounts(sb),
                loadBillingConfig()
            ]);

            const { arr } = mapUserRows(usersRows);
            window.adminUsersData = arr;
            renderAdminUsersTable();
            if (typeof callback === 'function') callback(true, arr);

            if (!supabaseAdminChannel) {
                supabaseAdminChannel = sb.channel('admin-users-live')
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'karkhana_users' },
                        () => {
                            const sec = document.getElementById('admin-section');
                            if (sec && sec.style.display !== 'none') {
                                fetchAndListenAdminUsers();
                            }
                        }
                    )
                    .subscribe();
            }
        } catch (err) {
            console.error('[Admin] Supabase fetch error:', err);
            setAdminBanner('❌ Users load karne me error: ' + (err?.message || 'Connection check karein'), 'error');
            if (typeof callback === 'function') callback(false, err.message);
        } finally {
            isFetchingUsers = false;
        }
    }

    function setAdminUsersFilter(tab) {
        currentAdminFilter = tab || 'all';
        currentAdminPage = 1;
        ['all', 'pending', 'active', 'blocked'].forEach((t) => {
            const btn = document.getElementById(`adm-tab-${t}`);
            if (btn) btn.classList.toggle('active', t === currentAdminFilter);
        });
        renderAdminUsersTable();
    }

    function handleAdminUserSearch(val) {
        currentAdminSearch = String(val || '').trim().toLowerCase();
        currentAdminPage = 1;
        renderAdminUsersTable();
    }

    function toggleAdminRowPass(btn) {
        if (!btn) return;
        const wrap = btn.parentElement;
        const span = wrap ? wrap.querySelector('.adm-pass-val') : null;
        if (!span) return;
        const isHidden = span.dataset.shown !== 'true';
        if (isHidden) {
            span.textContent = decodeURIComponent(span.dataset.raw || '');
            span.dataset.shown = 'true';
            btn.textContent = '🙈';
        } else {
            span.textContent = '••••••';
            span.dataset.shown = 'false';
            btn.textContent = '👁️';
        }
    }

    function renderAdminUsersTable() {
        buildModernAdminShell();

        const users = Array.isArray(window.adminUsersData) ? window.adminUsersData : [];
        const storageMap = window.adminStorageMap || {};
        const karigerMap = window.adminKarigerCountMap || {};
        const ratePerKariger = Math.max(0, Number(currentBillingCfg.perKarigerRate ?? 15) || 0);
        const minCharge = Math.max(0, Number(currentBillingCfg.minCharge ?? 0) || 0);
        const tbody = document.getElementById('admin-users-table-body');
        if (!tbody) return;

        let tot = 0, act = 0, blk = 0, pnd = 0;
        let totalServerBytes = 0;
        let totalKarigers = 0;
        const pendingUsersList = [];
        const todayIso = getLocalTodayIso();

        Object.keys(storageMap).forEach((k) => {
            totalServerBytes += Number(storageMap[k]) || 0;
        });

        const enriched = users.filter(Boolean).map((u) => {
            const uIdStr = String(u.id || '').trim();
            const uKey = uIdStr.toLowerCase();
            const isOwner = (uKey === 'farhan' || String(u.role || '').toLowerCase() === 'admin');
            const st = String(u.status || '').toLowerCase().trim();
            const isPending = !isOwner && (st === 'pending' || st === 'pending_approval' || st === 'waiting');
            const isBlocked = !isOwner && (st === 'blocked');
            const isExpired = !isOwner && Boolean(u.expiryDate && u.expiryDate < todayIso);
            const usedBytes = Number(storageMap[uKey]) || 0;
            const kCount = Number(karigerMap[uKey]) || 0;
            const billAmt = isOwner ? 0 : Math.max(minCharge, kCount * ratePerKariger);

            tot++;
            totalKarigers += kCount;
            if (isPending) {
                pnd++;
                pendingUsersList.push(u);
            } else if (isBlocked || isExpired) {
                blk++;
            } else {
                act++;
            }

            return { u, uIdStr, isOwner, isPending, isBlocked, isExpired, usedBytes, kCount, billAmt };
        });

        const elTot = document.getElementById('adm-stat-total');
        const elAct = document.getElementById('adm-stat-active');
        const elPnd = document.getElementById('adm-stat-pending');
        const elBlk = document.getElementById('adm-stat-blocked');
        const elKar = document.getElementById('adm-stat-karigers');
        const elStg = document.getElementById('adm-stat-storage');
        if (elTot) elTot.textContent = tot;
        if (elAct) elAct.textContent = act;
        if (elPnd) elPnd.textContent = pnd;
        if (elBlk) elBlk.textContent = blk;
        if (elKar) elKar.textContent = totalKarigers;
        if (elStg) elStg.textContent = formatBytes(totalServerBytes);

        const filtered = enriched.filter((item) => {
            if (currentAdminFilter === 'pending' && !item.isPending) return false;
            if (currentAdminFilter === 'active' && (item.isPending || item.isBlocked || item.isExpired)) return false;
            if (currentAdminFilter === 'blocked' && !(item.isBlocked || item.isExpired)) return false;
            if (currentAdminSearch) {
                const hay = `${item.u.name || ''} ${item.uIdStr} ${item.u.mobile || ''} ${item.u.email || ''}`.toLowerCase();
                if (!hay.includes(currentAdminSearch)) return false;
            }
            return true;
        });

        const pagBar = document.getElementById('adm-pagination-bar');

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748b; font-weight:600;">${users.length ? 'Koi user filter se match nahi hua.' : 'Users load ho rahe hain ya koi user nahi mila...'}</td></tr>`;
            if (pagBar) pagBar.style.display = 'none';
        } else {
            const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE) || 1;
            if (currentAdminPage > totalPages) currentAdminPage = totalPages;
            if (currentAdminPage < 1) currentAdminPage = 1;
            const startIdx = (currentAdminPage - 1) * ADMIN_PAGE_SIZE;
            const pageItems = filtered.slice(startIdx, startIdx + ADMIN_PAGE_SIZE);

            let rowsHtml = '';
            pageItems.forEach((item, idx) => {
                const { u, uIdStr, isOwner, isPending, isBlocked, isExpired, usedBytes, kCount, billAmt } = item;
                const safeIdAttr = esc(uIdStr);

                let stBadge = '';
                if (isOwner) {
                    stBadge = `<span style="background:#0f172a; color:#38bdf8; padding:4px 10px; border-radius:20px; font-weight:800; font-size:11px; white-space:nowrap;">👑 Owner</span>`;
                } else if (isPending) {
                    stBadge = `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:4px 10px; border-radius:20px; font-weight:800; font-size:11px; white-space:nowrap;">⏳ Pending</span>`;
                } else if (isBlocked) {
                    stBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:20px; font-weight:800; font-size:11px; white-space:nowrap;">⛔ Blocked</span>`;
                } else if (isExpired) {
                    stBadge = `<span style="background:#ffedd5; color:#c2410c; padding:4px 10px; border-radius:20px; font-weight:800; font-size:11px; white-space:nowrap;">⌛ Expired</span>`;
                } else {
                    stBadge = `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:20px; font-weight:800; font-size:11px; white-space:nowrap;">🟢 Active</span>`;
                }

                let actionBtns = '';
                if (isPending) {
                    actionBtns = `
                        <button type="button" data-adm-act="approve" data-uid="${safeIdAttr}" style="background:#0f766e; color:#fff; border:none; font-weight:700; padding:6px 10px; border-radius:6px; font-size:11.5px; cursor:pointer;">✅ Approve</button>
                        <button type="button" data-adm-act="delete" data-uid="${safeIdAttr}" style="background:#dc2626; color:#fff; border:none; font-weight:700; padding:6px 10px; border-radius:6px; font-size:11.5px; cursor:pointer;">🗑️ Reject</button>
                    `;
                } else if (!isOwner) {
                    actionBtns = `
                        <button type="button" data-adm-act="block" data-uid="${safeIdAttr}" style="background:${isBlocked ? '#0f766e' : '#f59e0b'}; color:#fff; border:none; font-weight:700; padding:5px 9px; border-radius:6px; font-size:11px; cursor:pointer;">${isBlocked ? 'Unblock' : 'Block'}</button>
                        <button type="button" data-adm-act="pass" data-uid="${safeIdAttr}" style="background:#0284c7; color:#fff; border:none; font-weight:700; padding:5px 9px; border-radius:6px; font-size:11px; cursor:pointer;">🔑 Pass</button>
                        <button type="button" data-adm-act="delete" data-uid="${safeIdAttr}" style="background:#dc2626; color:#fff; border:none; font-weight:700; padding:5px 8px; border-radius:6px; font-size:11px; cursor:pointer;">🗑️</button>
                    `;
                } else {
                    actionBtns = `<span style="color:#0f766e; font-weight:800; font-size:11.5px;">Full Control</span>`;
                }

                let expiryDisplay = '';
                if (isOwner) {
                    expiryDisplay = `<div style="font-size:11px; color:#64748b;">Join: ${esc(formatDate(u.date))}</div><strong style="color:#0f766e; font-size:12px;">Lifetime</strong>`;
                } else if (isPending) {
                    expiryDisplay = `<div style="font-size:11px; color:#64748b;">Req: ${esc(formatDate(u.date))}</div><span style="color:#b45309; font-weight:700; font-size:11.5px;">Approval Ka Intezar</span>`;
                } else {
                    expiryDisplay = `
                        <div style="font-size:11px; color:#64748b; margin-bottom:3px;">Join: ${esc(formatDate(u.date))}</div>
                        <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                            <input type="date" data-adm-expiry="1" data-uid="${safeIdAttr}" value="${esc(u.expiryDate || '')}" style="padding:3px 5px; font-size:11px; border-radius:5px; border:1px solid #cbd5e1;">
                            <button type="button" data-adm-act="extend" data-uid="${safeIdAttr}" style="padding:4px 7px; font-size:10.5px; font-weight:700; border-radius:5px; border:none; background:#2563eb; color:#fff; cursor:pointer;">+30D</button>
                        </div>
                    `;
                }

                const karigerCellHtml = isOwner
                    ? `<div style="font-weight:800; color:#0f766e; white-space:nowrap;">🧵 ${kCount} Kariger</div><div style="font-size:11px; color:#64748b;">Admin Free</div>`
                    : `<div style="font-weight:800; color:#0f172a; white-space:nowrap;">🧵 ${kCount} Kariger</div><div style="font-size:11.5px; font-weight:800; color:#0f766e; white-space:nowrap;">₹ ${billAmt.toLocaleString('en-IN')} /mo</div>`;

                const encodedPass = encodeURIComponent(String(u.pass || '-'));
                const storageText = formatBytes(usedBytes);

                rowsHtml += `
                    <tr>
                        <td style="text-align:center; font-weight:700; color:#64748b;">${startIdx + idx + 1}</td>
                        <td>
                            <strong style="color:#0f172a; font-size:13px;">${esc(u.name || '-')}</strong>
                            ${u.email ? `<div style="font-size:11px; color:#64748b;">${esc(u.email)}</div>` : ''}
                        </td>
                        <td>
                            <div style="font-weight:600; color:#334155;">📞 ${esc(u.mobile || '-')}</div>
                            <code style="background:#f1f5f9; color:#1e3a8a; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">ID: ${esc(uIdStr)}</code>
                        </td>
                        <td>${karigerCellHtml}</td>
                        <td>
                            <span style="display:inline-block; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:3px 8px; border-radius:6px; font-weight:800; font-size:11.5px; white-space:nowrap;">💾 ${esc(storageText)}</span>
                        </td>
                        <td>
                            <div style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #e2e8f0; padding:3px 8px; border-radius:6px;">
                                <span class="adm-pass-val" data-raw="${encodedPass}" data-shown="false" style="font-weight:800; color:#1e3a8a; letter-spacing:1px;">••••••</span>
                                <button type="button" data-adm-act="toggle-pass" style="background:transparent; border:none; cursor:pointer; font-size:13px; padding:0;" title="Show/Hide Password">👁️</button>
                            </div>
                        </td>
                        <td>${expiryDisplay}</td>
                        <td>${stBadge}</td>
                        <td style="text-align:center; white-space:nowrap;">${actionBtns}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = rowsHtml;

            if (pagBar) {
                if (totalPages > 1) {
                    pagBar.style.display = 'flex';
                    pagBar.innerHTML = `
                        <span style="color:#475569; font-weight:600;">Showing <strong>${startIdx + 1}</strong> - <strong>${Math.min(startIdx + ADMIN_PAGE_SIZE, filtered.length)}</strong> of <strong>${filtered.length}</strong> Users</span>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button type="button" data-adm-act="page-prev" ${currentAdminPage <= 1 ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} class="adm-tab-btn">◀ Prev</button>
                            <span style="font-weight:800; color:#0f172a;">${currentAdminPage} / ${totalPages}</span>
                            <button type="button" data-adm-act="page-next" ${currentAdminPage >= totalPages ? 'disabled style="opacity:0.45; cursor:not-allowed;"' : ''} class="adm-tab-btn">Next ▶</button>
                        </div>`;
                } else {
                    pagBar.style.display = 'none';
                }
            }
        }

        const pendingBanner = document.getElementById('admin-pending-approval-banner');
        if (pendingBanner) {
            if (pendingUsersList.length > 0) {
                let pHtml = `
                    <div style="background:#fffbeb; border:1.5px solid #f59e0b; border-radius:12px; padding:14px; margin-bottom:14px;">
                        <div style="color:#b45309; font-size:14px; font-weight:800; margin-bottom:10px;">🔔 Naye Account Approval Requests (${pendingUsersList.length}):</div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                `;
                pendingUsersList.forEach((pu) => {
                    const pId = esc(String(pu.id || '').trim());
                    pHtml += `
                        <div style="background:#ffffff; border:1px solid #fde68a; border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div>
                                <strong style="color:#0f172a; font-size:13.5px;">👤 ${esc(pu.name || '-')}</strong>
                                &bull; <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">ID: ${pId}</code>
                                &bull; <span style="font-size:12.5px;">📞 ${esc(pu.mobile || '-')}</span>
                                <div style="font-size:11px; color:#64748b; margin-top:2px;">Request Date: ${esc(formatDate(pu.date))}</div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button type="button" data-adm-act="approve" data-uid="${pId}" style="background:#0f766e; color:#fff; border:none; font-weight:800; padding:8px 14px; border-radius:8px; font-size:12px; cursor:pointer;">✅ Approve Karein</button>
                                <button type="button" data-adm-act="delete" data-uid="${pId}" style="background:#dc2626; color:#fff; border:none; font-weight:800; padding:8px 12px; border-radius:8px; font-size:12px; cursor:pointer;">🗑️ Reject</button>
                            </div>
                        </div>
                    `;
                });
                pHtml += `</div></div>`;
                pendingBanner.innerHTML = pHtml;
                pendingBanner.style.display = 'block';
            } else {
                pendingBanner.style.display = 'none';
            }
        }
    }

    async function refreshAdminUsersList(silent = false) {
        if (isFetchingUsers) return;
        isFetchingUsers = true;

        const btn = document.getElementById('admin-refresh-users-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing...'; }

        const sb = getSupabaseAdmin();
        if (!sb) {
            isFetchingUsers = false;
            if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh List'; }
            if (!silent) setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');
            return;
        }

        try {
            const [usersRows] = await Promise.all([
                fetchAllUsersPaginated(sb),
                fetchAllUsersStorageMap(sb),
                fetchAllUsersKarigerCounts(sb),
                loadBillingConfig()
            ]);

            const { arr, pendingCount } = mapUserRows(usersRows);
            window.adminUsersData = arr;
            renderAdminUsersTable();

            if (!silent) {
                setAdminBanner(
                    `✅ Refresh Ho Gaya! Kul Users: ${arr.length} • Approval Pending: ${pendingCount} • Active/Others: ${arr.length - pendingCount}`,
                    'success'
                );
            }
        } catch (err) {
            setAdminBanner('❌ Refresh Error: ' + (err?.message || 'Unknown error'), 'error');
        } finally {
            isFetchingUsers = false;
            if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh List'; }
        }
    }

    async function approveUserByAdmin(uid) {
        const key = String(uid || '').trim().toLowerCase();
        if (!key || adminBusyUids.has(key)) return;

        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        const formattedExp = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;

        const sb = getSupabaseAdmin();
        if (!sb) return setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');

        adminBusyUids.add(key);
        try {
            const targetUser = (window.adminUsersData || []).find((x) => String(x.id).toLowerCase() === key);

            const { error } = await sb
                .from('karkhana_users')
                .update({
                    status: 'active',
                    validity_date: formattedExp
                })
                .eq('user_id', uid);

            if (error) throw error;

            let mailNote = '';
            if (targetUser && targetUser.email && targetUser.email.includes('@')) {
                const mailRes = await sendAdminApprovalEmail({
                    type: 'approved_notice',
                    toEmail: targetUser.email,
                    name: targetUser.name || uid,
                    userId: uid,
                    validityDate: formatDate(formattedExp),
                    appUrl: window.location.origin + window.location.pathname
                });
                if (mailRes && mailRes.ok) {
                    mailNote = ' (Gmail par Welcome Email bhi bhej diya gaya)';
                }
            }

            setAdminBanner(`🎉 User '${uid}' APPROVE ho gaya!${mailNote}`, 'success');
            await refreshAdminUsersList(true);
        } catch (err) {
            setAdminBanner('❌ Approve error: ' + (err?.message || err), 'error');
        } finally {
            adminBusyUids.delete(key);
        }
    }

    async function updateUserExpiryDate(uid, dateVal) {
        const key = String(uid || '').trim().toLowerCase();
        if (!key || adminBusyUids.has(key)) return;

        const cleanDate = String(dateVal || '').trim();
        if (cleanDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
            setAdminBanner('⚠️ Sahi date format (YYYY-MM-DD) chunein!', 'error');
            renderAdminUsersTable();
            return;
        }

        const sb = getSupabaseAdmin();
        if (!sb) return;

        adminBusyUids.add(key);
        try {
            const { error } = await sb
                .from('karkhana_users')
                .update({ validity_date: cleanDate || null })
                .eq('user_id', uid);
            if (error) throw error;

            const target = (window.adminUsersData || []).find((x) => String(x.id).toLowerCase() === key);
            if (target) target.expiryDate = cleanDate || '';
            renderAdminUsersTable();
            setAdminBanner(`✅ '${uid}' ki validity date update ho gayi.`, 'success');
        } catch (err) {
            console.error('Expiry update error:', err);
            setAdminBanner('❌ Expiry update error: ' + (err?.message || err), 'error');
            renderAdminUsersTable();
        } finally {
            adminBusyUids.delete(key);
        }
    }

    async function extendValidity(uid, days) {
        const key = String(uid || '').trim().toLowerCase();
        if (!key || adminBusyUids.has(key)) return;

        const u = (window.adminUsersData || []).find((x) => String(x.id).toLowerCase() === key);
        const parsedExp = (u && u.expiryDate) ? parseLocalIsoDate(u.expiryDate) : null;
        const todayStart = parseLocalIsoDate(getLocalTodayIso()) || new Date();
        const base = (parsedExp && parsedExp > todayStart) ? parsedExp : new Date();
        base.setDate(base.getDate() + days);
        const formatted = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;

        const sb = getSupabaseAdmin();
        if (!sb) return setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');

        adminBusyUids.add(key);
        try {
            const { error } = await sb
                .from('karkhana_users')
                .update({
                    validity_date: formatted,
                    status: 'active'
                })
                .eq('user_id', uid);

            if (error) throw error;

            setAdminBanner(`✅ '${uid}' ki validity ${days} din badh gayi (${formatDate(formatted)})!`, 'success');
            await refreshAdminUsersList(true);
        } catch (err) {
            setAdminBanner('❌ Validity update error: ' + (err?.message || err), 'error');
        } finally {
            adminBusyUids.delete(key);
        }
    }

    function resetUserPasswordByAdmin(uid) {
        const key = String(uid || '').trim().toLowerCase();
        if (!key || adminBusyUids.has(key)) return;

        const sb = getSupabaseAdmin();
        if (!sb) return setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');

        const suggested = Math.floor(100000 + Math.random() * 900000).toString();
        openAdminActionModal({
            title: `🔑 Reset Password (${uid})`,
            bodyHtml: `
                <div style="font-size:12.5px; color:#334155; margin-bottom:8px;">User <strong>${esc(uid)}</strong> ke liye naya password daalein:</div>
                <input type="text" id="adm-reset-pass-inp" value="${suggested}" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1.5px solid #0284c7; border-radius:7px; font-size:14px; font-weight:800;">
            `,
            confirmLabel: 'Save Password',
            confirmColor: '#0284c7',
            onConfirm: async (setErr, closeModal) => {
                const newPass = String(document.getElementById('adm-reset-pass-inp')?.value || '').trim();
                if (!newPass || newPass.length < 4) {
                    setErr('⚠️ Kam se kam 4 akshar ka password daalein!');
                    return;
                }
                if (adminBusyUids.has(key)) return;
                adminBusyUids.add(key);
                try {
                    const { error } = await sb
                        .from('karkhana_users')
                        .update({ password: newPass })
                        .eq('user_id', uid);

                    if (error) throw error;
                    closeModal();
                    setAdminBanner(`✅ '${uid}' ka password update ho gaya!`, 'success');
                    await refreshAdminUsersList(true);
                } catch (err) {
                    setErr('❌ Password reset error: ' + (err?.message || err));
                } finally {
                    adminBusyUids.delete(key);
                }
            }
        });
        setTimeout(() => document.getElementById('adm-reset-pass-inp')?.select(), 40);
    }

    async function toggleUserBlockStatus(uid) {
        const key = String(uid || '').trim().toLowerCase();
        if (key === 'farhan') return setAdminBanner('⛔ Master Admin block nahi ho sakta!', 'error');
        if (!key || adminBusyUids.has(key)) return;

        const u = (window.adminUsersData || []).find((x) => String(x.id).toLowerCase() === key);
        const nextStatus = (u && u.status === 'blocked') ? 'active' : 'blocked';

        const sb = getSupabaseAdmin();
        if (!sb) return setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');

        adminBusyUids.add(key);
        try {
            const { error } = await sb
                .from('karkhana_users')
                .update({ status: nextStatus })
                .eq('user_id', uid);

            if (error) throw error;

            setAdminBanner(`✅ '${uid}' ab ${nextStatus === 'blocked' ? 'BLOCK' : 'UNBLOCK (Active)'} ho gaya!`, 'success');
            await refreshAdminUsersList(true);
        } catch (err) {
            setAdminBanner('❌ Block/Unblock error: ' + (err?.message || err), 'error');
        } finally {
            adminBusyUids.delete(key);
        }
    }

    function deleteUserByAdmin(uid) {
        const cleanUid = String(uid || '').trim();
        const uidLower = cleanUid.toLowerCase();
        if (!uidLower || uidLower === 'farhan' || uidLower === 'app' || uidLower === 'admin') {
            return setAdminBanner('⛔ Master Admin delete nahi ho sakta!', 'error');
        }
        if (adminBusyUids.has(uidLower)) return;

        const sb = getSupabaseAdmin();
        if (!sb) return setAdminBanner('⚠️ Supabase connect nahi hai!', 'error');

        const targetUser = (window.adminUsersData || []).find((x) => String(x.id || '').trim().toLowerCase() === uidLower);
        const st = String(targetUser?.status || '').toLowerCase().trim();
        const isPending = (st === 'pending' || st === 'pending_approval' || st === 'waiting');

        const bodyHtml = isPending
            ? `<div style="font-size:13px; color:#7f1d1d; background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px;">
                ⚠️ Kya aap user <strong>${esc(cleanUid)}</strong> ki pending request permanently <strong>REJECT &amp; DELETE</strong> karna chahte hain?
               </div>`
            : `<div style="font-size:12.5px; color:#7f1d1d; background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px; margin-bottom:10px;">
                ⚠️ Isse <strong>${esc(cleanUid)}</strong> ka login aur Supabase par maujood SAARA data (Karigers, Sheets, Stock, Payments, Dukan, JobWork, Portals) hamesha ke liye delete ho jayega!
               </div>
               <label style="font-size:12px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Confirm karne ke liye User ID '<strong>${esc(cleanUid)}</strong>' type karein:</label>
               <input type="text" id="adm-del-confirm-inp" placeholder="${esc(cleanUid)}" autocomplete="off" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1.5px solid #dc2626; border-radius:7px; font-size:13px; font-weight:800;">`;

        openAdminActionModal({
            title: isPending ? `🗑️ Reject User (${cleanUid})` : `🗑️ Permanent Delete (${cleanUid})`,
            bodyHtml,
            confirmLabel: isPending ? 'Yes, Reject & Delete' : 'Permanently Delete',
            confirmColor: '#dc2626',
            onConfirm: async (setErr, closeModal) => {
                if (!isPending) {
                    const typed = String(document.getElementById('adm-del-confirm-inp')?.value || '').trim().toLowerCase();
                    if (typed !== uidLower) {
                        setErr(`❌ User ID '${cleanUid}' match nahi hua!`);
                        document.getElementById('adm-del-confirm-inp')?.focus();
                        return;
                    }
                }
                if (adminBusyUids.has(uidLower)) return;
                adminBusyUids.add(uidLower);

                try {
                    let adminAuth = {};
                    try { adminAuth = JSON.parse(localStorage.getItem('app_active_session_auth') || '{}'); } catch (_) {}

                    const { data: deletedRows, error } = await sb.rpc('delete_user_completely', {
                        p_user_id: cleanUid,
                        p_admin_id: adminAuth.id || window.currentUserId || 'farhan',
                        p_admin_pass: adminAuth.pass || ''
                    });

                    if (error) throw error;

                    if (typeof window.wipeUserLocalCache === 'function') {
                        await window.wipeUserLocalCache(cleanUid);
                    }

                    if (window.adminStorageMap) delete window.adminStorageMap[uidLower];
                    if (window.adminKarigerCountMap) delete window.adminKarigerCountMap[uidLower];

                    closeModal();
                    setAdminBanner(`🗑️ User '${cleanUid}' aur uska poora data (${Number(deletedRows) || 0} records) permanently delete ho gaya!`, 'success');
                    await refreshAdminUsersList(true);
                } catch (err) {
                    setErr('❌ Delete error: ' + (err?.message || err));
                } finally {
                    adminBusyUids.delete(uidLower);
                }
            }
        });
        if (!isPending) {
            setTimeout(() => document.getElementById('adm-del-confirm-inp')?.focus(), 40);
        }
    }

    /* ========================================================================
       6. ADMIN PAYMENT / QR SETTINGS MODAL (PER KARIGER RATE x ₹15)
    ======================================================================== */
    const renderAdminQrPreview = (base64Img, upiId, holderName) => {
        const box = document.getElementById('adm-bill-qr-preview');
        if (!box) return;
        if (base64Img) {
            box.innerHTML = `<img src="${base64Img}" alt="QR Code" style="width:140px; height:140px; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1; background:#fff;">`;
        } else if (upiId) {
            const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(holderName || 'FARHAN JAWED')}&cu=INR`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUri)}`;
            box.innerHTML = `<img src="${qrUrl}" alt="Auto UPI QR" style="width:140px; height:140px; object-fit:contain; border-radius:8px; border:1px solid #cbd5e1; background:#fff; padding:4px;">`;
        } else {
            box.innerHTML = `<div style="font-size:11.5px; color:#64748b;">UPI ID daalein ya QR Photo upload karein</div>`;
        }
    };

    async function openAdminBillingModal() {
        closeAdminBillingModal();

        const cfg = await loadBillingConfig();
        pendingQrBase64 = cfg.qrImageBase64 || '';

        const html = `
        <div id="admin-billing-modal" style="position:fixed; inset:0; background:rgba(15,23,42,0.75); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:480px; border-radius:14px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.4); font-family:sans-serif; max-height:94vh; display:flex; flex-direction:column;">
                <div style="background:#0f172a; color:#ffffff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; font-size:16px; font-weight:800;">💳 Per-Kariger Billing &amp; QR Settings</h3>
                        <div style="font-size:11px; color:#94a3b8;">Client ke Master Sheet Karigers × Rate ke hisab se payment banega</div>
                    </div>
                    <button type="button" onclick="closeAdminBillingModal()" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div style="padding:16px 18px; overflow-y:auto; flex:1;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#0f766e; display:block; margin-bottom:3px;">1 Kariger ka Rate (₹):</label>
                            <input type="number" min="0" id="adm-bill-rate" value="${esc(cfg.perKarigerRate ?? '15')}" placeholder="15" style="width:100%; padding:8px; border:1.5px solid #0f766e; border-radius:7px; font-size:14px; box-sizing:border-box; font-weight:900; color:#0f766e;">
                        </div>
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">Minimum Bill (₹, 0=Off):</label>
                            <input type="number" min="0" id="adm-bill-min" value="${esc(cfg.minCharge ?? '0')}" placeholder="0" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box; font-weight:700;">
                        </div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">WhatsApp Number (Screenshot ke liye):</label>
                        <input type="text" id="adm-bill-wa" value="${esc(cfg.whatsappNo)}" placeholder="917065572191" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">UPI ID (GPay / PhonePe / Paytm):</label>
                        <input type="text" id="adm-bill-upi" value="${esc(cfg.upiId)}" placeholder="farhan275101-2@oksbi" oninput="refreshAdminQrPreviewFromInputs()" style="width:100%; padding:8px; border:1.5px solid #2563eb; border-radius:7px; font-size:13px; box-sizing:border-box; font-weight:700;">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">Account Holder Name:</label>
                            <input type="text" id="adm-bill-holder" value="${esc(cfg.accountHolder)}" oninput="refreshAdminQrPreviewFromInputs()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">Bank Name:</label>
                            <input type="text" id="adm-bill-bank" value="${esc(cfg.bankName)}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">Bank A/C No (Optional):</label>
                            <input type="text" id="adm-bill-ac" value="${esc(cfg.accountNumber)}" placeholder="Account Number" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">IFSC Code (Optional):</label>
                            <input type="text" id="adm-bill-ifsc" value="${esc(cfg.ifscCode)}" placeholder="SBIN000...." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:13px; box-sizing:border-box;">
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px; text-align:center;">
                        <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:4px;">QR Code Preview</div>
                        <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Client ko uske (Kariger × ₹Rate) ke hisab se amount ke saath QR dikhega</div>
                        <div id="adm-bill-qr-preview" style="display:flex; justify-content:center; margin-bottom:10px;"></div>
                        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
                            <label style="background:#0f172a; color:#fff; padding:6px 12px; border-radius:7px; font-size:11.5px; font-weight:700; cursor:pointer;">
                                📷 Apna QR Photo Upload Karein
                                <input type="file" accept="image/*" style="display:none;" onchange="handleAdminQrFileUpload(event)">
                            </label>
                            <button type="button" onclick="clearAdminQrImage()" style="background:#e2e8f0; color:#334155; border:none; padding:6px 10px; border-radius:7px; font-size:11.5px; font-weight:700; cursor:pointer;">Auto UPI QR Use Karein</button>
                        </div>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-size:11.5px; font-weight:700; color:#334155; display:block; margin-bottom:3px;">Client ke liye Message:</label>
                        <input type="text" id="adm-bill-note" value="${esc(cfg.note)}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:7px; font-size:12.5px; box-sizing:border-box;">
                    </div>

                    <div id="adm-bill-status" style="display:none; font-size:12px; font-weight:700; padding:8px 10px; border-radius:7px; border:1px solid #fecaca; margin-bottom:10px;"></div>

                    <div style="display:flex; gap:8px;">
                        <button type="button" id="adm-bill-save-btn" onclick="saveAdminBillingSettings()" style="flex:1; background:#0f766e; color:#fff; border:none; padding:11px; border-radius:8px; font-size:14px; font-weight:800; cursor:pointer;">💾 Save Payment Settings</button>
                        <button type="button" onclick="closeAdminBillingModal()" style="background:#e2e8f0; color:#334155; border:none; padding:11px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;">Close</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        renderAdminQrPreview(pendingQrBase64, cfg.upiId, cfg.accountHolder);
    }

    function refreshAdminQrPreviewFromInputs() {
        const upi = document.getElementById('adm-bill-upi')?.value.trim() || '';
        const holder = document.getElementById('adm-bill-holder')?.value.trim() || '';
        renderAdminQrPreview(pendingQrBase64, upi, holder);
    }

    function clearAdminQrImage() {
        pendingQrBase64 = '';
        refreshAdminQrPreviewFromInputs();
    }

    function handleAdminQrFileUpload(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        if (!file.type || !file.type.startsWith('image/')) {
            setBillingStatusMsg('⚠️ Sirf valid Image file (PNG/JPG/WebP) upload karein!', true);
            if (event.target) event.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setBillingStatusMsg('⚠️ QR Image 5 MB se chhoti honi chahiye!', true);
            if (event.target) event.target.value = '';
            return;
        }

        setBillingStatusMsg('');
        const reader = new FileReader();
        reader.onerror = () => {
            setBillingStatusMsg('❌ Image read karne me error aaya!', true);
        };
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => {
                setBillingStatusMsg('❌ Invalid ya corrupt image file!', true);
            };
            img.onload = () => {
                const maxSide = 360;
                let w = img.width;
                let h = img.height;
                if (w > maxSide || h > maxSide) {
                    const ratio = Math.min(maxSide / w, maxSide / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                pendingQrBase64 = canvas.toDataURL('image/jpeg', 0.85);
                refreshAdminQrPreviewFromInputs();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function closeAdminBillingModal() {
        const m = document.getElementById('admin-billing-modal');
        if (m) m.remove();
    }

    async function saveAdminBillingSettings() {
        if (isSavingBilling) return;
        setBillingStatusMsg('');

        const rateNum = Number(document.getElementById('adm-bill-rate')?.value ?? 15);
        const minNum = Number(document.getElementById('adm-bill-min')?.value ?? 0);
        const upiVal = String(document.getElementById('adm-bill-upi')?.value || '').trim();
        const waDigits = String(document.getElementById('adm-bill-wa')?.value || '917065572191').replace(/[^0-9]/g, '');

        if (isNaN(rateNum) || rateNum < 0) {
            setBillingStatusMsg('⚠️ Sahi Per-Kariger Rate daalein!', true);
            return;
        }
        if (isNaN(minNum) || minNum < 0) {
            setBillingStatusMsg('⚠️ Minimum Bill 0 ya usse zyada hona chahiye!', true);
            return;
        }
        if (upiVal && !upiVal.includes('@')) {
            setBillingStatusMsg('⚠️ Sahi UPI ID daalein (e.g. name@bank)!', true);
            return;
        }

        const btn = document.getElementById('adm-bill-save-btn');
        isSavingBilling = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Saving... ⏳'; }

        const payload = {
            perKarigerRate: String(rateNum),
            minCharge: String(minNum),
            whatsappNo: waDigits || '917065572191',
            upiId: upiVal,
            accountHolder: String(document.getElementById('adm-bill-holder')?.value || '').trim(),
            bankName: String(document.getElementById('adm-bill-bank')?.value || '').trim(),
            accountNumber: String(document.getElementById('adm-bill-ac')?.value || '').trim(),
            ifscCode: String(document.getElementById('adm-bill-ifsc')?.value || '').trim().toUpperCase(),
            qrImageBase64: pendingQrBase64 || '',
            note: String(document.getElementById('adm-bill-note')?.value || '').trim(),
            updatedAt: new Date().toISOString()
        };

        try {
            const sb = getSupabaseAdmin();
            if (sb) {
                if (!navigator.onLine) {
                    setBillingStatusMsg('⚠️ Billing settings save karne ke liye internet online hona zaroori hai!', true);
                    return;
                }
                const rowObj = {
                    id: BILLING_CONFIG_ID,
                    user_id: 'farhan',
                    tenant_id: 'farhan',
                    session: 'global',
                    key: 'billing_config',
                    data: payload,
                    value: payload,
                    updated_at: new Date().toISOString()
                };
                const { error } = await sb.from('app_store').upsert(rowObj, { onConflict: 'id' });
                if (error) throw error;
            }

            // Update local cache only after Cloud succeeds
            currentBillingCfg = payload;
            try {
                localStorage.setItem('app_global_billing_config', JSON.stringify(payload));
            } catch (_) {}

            closeAdminBillingModal();
            renderAdminUsersTable();
            setAdminBanner(`✅ Billing Settings save ho gayi! Rate: ₹${payload.perKarigerRate} / Kariger`, 'success');
        } catch (err) {
            setBillingStatusMsg('❌ Save error: ' + (err?.message || 'Connection check karein'), true);
        } finally {
            isSavingBilling = false;
            if (btn) { btn.disabled = false; btn.textContent = '💾 Save Payment Settings'; }
        }
    }

    window.openAdminModule = openAdminModule;
    window.renderAdminUsersTable = renderAdminUsersTable;
    window.approveUserByAdmin = approveUserByAdmin;
    window.updateUserExpiryDate = updateUserExpiryDate;
    window.extendValidity = extendValidity;
    window.resetUserPasswordByAdmin = resetUserPasswordByAdmin;
    window.toggleUserBlockStatus = toggleUserBlockStatus;
    window.deleteUserByAdmin = deleteUserByAdmin;
    window.refreshAdminUsersList = refreshAdminUsersList;
    window.setAdminUsersFilter = setAdminUsersFilter;
    window.handleAdminUserSearch = handleAdminUserSearch;
    window.toggleAdminRowPass = toggleAdminRowPass;
    window.openAdminBillingModal = openAdminBillingModal;
    window.closeAdminBillingModal = closeAdminBillingModal;
    window.saveAdminBillingSettings = saveAdminBillingSettings;
    window.handleAdminQrFileUpload = handleAdminQrFileUpload;
    window.clearAdminQrImage = clearAdminQrImage;
    window.refreshAdminQrPreviewFromInputs = refreshAdminQrPreviewFromInputs;
})();
