/* ============================================================================
   SIMPLICITY ERP - JOBWORK TRAIL MODULE (PART 4/6: STYLES & SCREENS PART 1)
   File: jobwork-trail/jwt-screens-1.js
============================================================================ */

(() => {
    'use strict';

    const J = (window._JWT = window._JWT || {});

    /* ========================================================================
       9. STYLES & SHELL DOM INJECTION
    ======================================================================== */
    J.injectStyles = () => {
        const old = document.getElementById('jwt-styles');
        if (old) old.remove();
        const st = document.createElement('style');
        st.id = 'jwt-styles';
        st.textContent = `
            #jw-trail-section {
                padding: 0 !important; overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #1f2937; background: #ffffff;
            }
            #jw-trail-section * { box-sizing: border-box; }
            #jw-trail-section .jwt-topbar {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7;
                padding: 9px 16px; display: flex; justify-content: space-between;
                align-items: center; gap: 10px; flex-wrap: wrap;
            }
            #jw-trail-section .jwt-topbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            #jw-trail-section .jwt-topbar h2 { margin: 0; font-size: 15.5px; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-pill {
                font-size: 11.5px; font-weight: 700; color: #92400e;
                background: #ffffff; border: 1px solid #d9b86c; padding: 2px 9px; border-radius: 999px;
            }
            #jw-trail-section .jwt-esc {
                background: #ffffff; border: 1px solid #d1d5db; color: #374151;
                padding: 4px 11px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            }
            #jw-trail-section .jwt-esc:hover { border-color: #d9a425; background: #fef9ea; }
            #jw-trail-section .jwt-save {
                background: #f2b71d; border: 1px solid #d9a425; color: #1f2937;
                padding: 5px 13px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer;
            }
            #jw-trail-section .jwt-save:hover { background: #e5aa12; }
            #jw-trail-section .jwt-del {
                background: #ffffff; border: 1px solid #fca5a5; color: #b91c1c;
                padding: 4px 10px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;
            }
            #jw-trail-section .jwt-del:hover { background: #fef2f2; }

            #jw-trail-section .jwt-menu-shell {
                max-width: 540px; margin: 18px auto; border: 1.5px solid #d9b86c;
                border-radius: 6px; overflow: hidden; background: #ffffff;
                box-shadow: 0 6px 20px rgba(0,0,0,0.05);
            }
            #jw-trail-section .jwt-menu-head {
                background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 9px 16px;
                font-size: 13px; font-weight: 800; color: #1f2937;
                display: flex; justify-content: space-between; align-items: center;
            }
            #jw-trail-section .jwt-sec-lbl {
                padding: 8px 18px 4px; font-size: 10.5px; font-weight: 800; color: #92400e;
                text-transform: uppercase; letter-spacing: 0.5px; background: #fdfcf7; border-top: 1px solid #f3efe0;
            }
            #jw-trail-section .jwt-sec-lbl.first { border-top: none; }
            #jw-trail-section .jwt-menu-item {
                width: 100%; text-align: left; background: #ffffff; border: none;
                border-bottom: 1px solid #f3f4f6; padding: 10px 18px; font-size: 13px;
                font-weight: 600; color: #1f2937; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
            }
            #jw-trail-section .jwt-menu-item:hover { background: #fef9ea; }
            #jw-trail-section .jwt-menu-item.active { background: #f2b71d !important; font-weight: 800; color: #1f2937; }
            #jw-trail-section .jwt-menu-key { color: #b45309; font-weight: 900; text-decoration: underline; }
            #jw-trail-section .jwt-menu-item.active .jwt-menu-key { color: #1f2937; }
            #jw-trail-section .jwt-menu-val { font-size: 11.5px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-menu-item.active .jwt-menu-val { color: #1f2937; }

            #jw-trail-section .jwt-kpi-5 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7; }
            #jw-trail-section .jwt-kpi-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e5d5a7; border-radius: 5px; overflow: hidden; background: #fdfcf7; margin-bottom: 10px; }
            #jw-trail-section .jwt-kpi-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7; }
            #jw-trail-section .jwt-kpi-cell { padding: 9px 14px; border-right: 1px solid #e5d5a7; }
            #jw-trail-section .jwt-kpi-cell:last-child { border-right: none; background: #fdf6e2; }
            #jw-trail-section .jwt-kpi-cell small { display: block; font-size: 11px; color: #6b7280; font-weight: 700; }
            #jw-trail-section .jwt-kpi-cell strong { display: block; font-size: 16px; color: #b47d00; font-weight: 900; margin-top: 2px; }

            #jw-trail-section table { width: 100%; min-width: 0 !important; border-collapse: collapse; border: 1px solid #e5d5a7; font-size: 12px; background: #fff; }
            #jw-trail-section th { background: #fdf6e2; color: #1f2937; font-size: 11px; font-weight: 800; padding: 7px 9px; text-align: left; border-bottom: 1.5px solid #e5d5a7; }
            #jw-trail-section td { padding: 7px 9px; border-bottom: 1px solid #f3f4f6; color: #1f2937; vertical-align: middle; }
            #jw-trail-section tr.jwt-row { cursor: pointer; }
            #jw-trail-section tr.jwt-row:hover { background: #fef9ea; }
            #jw-trail-section tr.jwt-row.active { background: #f2b71d !important; font-weight: 700; }
            #jw-trail-section .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
            #jw-trail-section .gold-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; color: #b47d00; }
            #jw-trail-section tr.jwt-row.active .gold-num { color: #1f2937; }
            #jw-trail-section .trail { font-size: 11px; font-weight: 700; color: #92400e; }
            #jw-trail-section .trail-muted { font-size: 11px; color: #6b7280; font-weight: 600; }
            #jw-trail-section .trail-done { font-size: 11px; font-weight: 800; color: #065f46; }

            #jw-trail-section .jwt-split { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(380px, 1.05fr); }
            #jw-trail-section .jwt-pane-l { padding: 12px 14px; border-right: 1.5px solid #e5d5a7; }
            #jw-trail-section .jwt-pane-r { padding: 10px 12px; background: #fdfcf7; }
            #jw-trail-section .jwt-frow { display: grid; grid-template-columns: 125px minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 6px; }
            #jw-trail-section .jwt-frow label { font-size: 11.5px; font-weight: 700; color: #374151; }
            #jw-trail-section .jwt-inp {
                width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px;
                font-size: 12.5px; font-weight: 700; color: #111827; background: #fff; outline: none;
            }
            #jw-trail-section .jwt-inp:focus { border-color: #d9a425; background: #fffdf5; box-shadow: 0 0 0 2px rgba(242,183,29,0.22); }
            #jw-trail-section .jwt-sidebox { border: 1.5px solid #d9b86c; border-radius: 5px; background: #fff; overflow: hidden; }
            #jw-trail-section .jwt-sidebox-head { background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 7px 10px; font-size: 12px; font-weight: 800; color: #1f2937; display: flex; justify-content: space-between; }
            #jw-trail-section .jwt-side-list-big { max-height: 430px; overflow-y: auto; }
            #jw-trail-section .jwt-side-opt {
                padding: 9px 11px; border-bottom: 1px solid #f3f4f6; cursor: pointer;
                display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-size: 12.5px;
            }
            #jw-trail-section .jwt-side-opt:hover { background: #fef9ea; }
            #jw-trail-section .jwt-side-opt.active { background: #f2b71d !important; font-weight: 700; }
            #jw-trail-section .jwt-accept-bar {
                background: #fdf6e2; border: 1.5px solid #d9a425; border-radius: 5px;
                padding: 7px 12px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;
            }
            #jw-trail-section .jwt-subnav { display: flex; gap: 14px; padding: 0 16px; border-bottom: 1.5px solid #e5d5a7; background: #fdfcf7; overflow-x: auto; }
            #jw-trail-section .jwt-tab { background: none; border: none; border-bottom: 2.5px solid transparent; padding: 8px 4px; font-size: 12px; font-weight: 700; color: #6b7280; cursor: pointer; white-space: nowrap; }
            #jw-trail-section .jwt-tab.active { color: #1f2937; border-bottom-color: #d9a425; font-weight: 800; }
            #jw-trail-section .jwt-footer { background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 7px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11px; color: #92400e; font-weight: 700; }
            #jwt-toast { position: fixed; bottom: 16px; right: 16px; z-index: 999999; padding: 9px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700; display: none; box-shadow: 0 8px 20px rgba(0,0,0,0.28); }
            @media (max-width: 860px) {
                #jw-trail-section .jwt-split { grid-template-columns: 1fr; }
                #jw-trail-section .jwt-pane-l { border-right: none; border-bottom: 1.5px solid #e5d5a7; }
                #jw-trail-section .jwt-kpi-5, #jw-trail-section .jwt-kpi-4, #jw-trail-section .jwt-kpi-3 { grid-template-columns: repeat(2, 1fr); }
                #jw-trail-section .jwt-frow { grid-template-columns: 1fr; gap: 3px; }
            }
        `;
        document.head.appendChild(st);
    };

    J.ensureSectionDOM = () => {
        J.injectStyles();
        let sec = document.getElementById('jw-trail-section');
        if (sec) return sec;

        sec = document.createElement('section');
        sec.id = 'jw-trail-section';
        sec.className = 'module-section';
        sec.style.display = 'none';
        sec.innerHTML = `
            <div class="jwt-topbar">
                <div class="jwt-topbar-left">
                    <button type="button" class="jwt-esc" id="jwt-back-btn" onclick="jwtHandleEsc()">&larr; [Esc] Back</button>
                    <h2 id="jwt-title">JobWork Hub</h2>
                    <span class="jwt-pill" id="jwt-godam-pill">Sabhi Karkhane</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button type="button" class="jwt-esc" id="jwt-top-print-btn" style="display:none;" onclick="jwtPrintCurrentScreen()">Print [Alt+P]</button>
                    <span id="jwt-top-hint" style="font-size:11.5px; font-weight:700; color:#92400e;">Tally Mode</span>
                </div>
            </div>
            <div id="jwt-body"></div>
        `;
        const main = document.querySelector('#desktop-screen .main-container');
        if (main) main.appendChild(sec);
        else document.body.appendChild(sec);
        return sec;
    };

    /* ========================================================================
       10. NAVIGATION HELPERS WITH EXACT CURSOR RESTORE
    ======================================================================== */
    window.jwtGo = (view, preserveCursor = false) => {
        if (J.s.curView) J.s.viewCursor[J.s.curView] = J.s.menuIdx;
        J.s.curView = view;
        J.s.menuIdx = preserveCursor ? (J.s.viewCursor[view] || 0) : 0;
        J.s.regPrintRowInfo = null;
        J.armNavGuard();
        J.renderScreen();
    };

    J.jwtBackTo = (parentView) => {
        if (J.s.curView) J.s.viewCursor[J.s.curView] = J.s.menuIdx;
        J.s.curView = parentView;
        J.s.menuIdx = J.s.viewCursor[parentView] || 0;
        J.s.regPrintRowInfo = null;
        J.armNavGuard();
        J.renderScreen();
        setTimeout(() => {
            const sec = document.getElementById('jw-trail-section');
            sec?.querySelector('.jwt-menu-item.active, tbody tr.jwt-row.active')?.scrollIntoView({ block: 'nearest' });
        }, 15);
    };

    J.setTopHeader = (title, backLabel, hint = '[↑ ↓] Chunein · [Enter] Kholein · [Esc] Back', showPrint = false) => {
        const tEl = document.getElementById('jwt-title');
        const bEl = document.getElementById('jwt-back-btn');
        const gEl = document.getElementById('jwt-godam-pill');
        const hEl = document.getElementById('jwt-top-hint');
        const pEl = document.getElementById('jwt-top-print-btn');
        if (tEl) tEl.textContent = title;
        if (bEl) bEl.textContent = backLabel;
        if (gEl) gEl.textContent = J.getGodamLabel(J.getActiveGodam());
        if (hEl) hEl.textContent = hint;
        if (pEl) pEl.style.display = showPrint ? 'inline-block' : 'none';
    };

    /* ========================================================================
       11. SCREEN RENDERERS PART 1 (GATEWAY, MASTER, REGISTER, VOUCHER, HIST)
    ======================================================================== */
    J.renderScreensPart1 = (body, snap) => {
        const s = J.s;

        // 1. GATEWAY
        if (s.curView === 'gateway') {
            J.setTopHeader('JobWork Hub', '← [Esc] Dashboard', '[↑ ↓] + [Enter] · [Esc] Dashboard', false);
            const items = [
                { sec: 'JobWork Master', key: 'c', label: '<span class="jwt-menu-key">C</span>reate (Worker / Group)', val: 'New', action: "jwtGo('create-menu')" },
                { key: 'a', label: '<span class="jwt-menu-key">A</span>lter (Worker / Group)', val: 'Edit / Del', action: "jwtGo('alter-menu')" },
                { key: 'j', label: '<span class="jwt-menu-key">J</span>ob Work Register', val: `${snap.totals.pending} Pending`, action: "jwtGo('jw-groups')" },
                { sec: 'Report & Stock', key: 'o', label: '<span class="jwt-menu-key">O</span>wner Report', val: `${snap.totals.total} Pcs`, action: "jwtGo('owner-menu')" },
                { key: 's', label: '<span class="jwt-menu-key">S</span>aree Stock', val: `${snap.totals.raw + snap.totals.finished + snap.totals.lott} Pcs`, action: "jwtGo('stock-list')" },
                { sec: 'Out & Account', key: 'f', label: '<span class="jwt-menu-key">F</span>inal Out (Dispatch)', val: 'Batch Out', action: "jwtOpenFinalOut()" },
                { key: 'b', label: '<span class="jwt-menu-key">B</span>ills &amp; Hisab', val: 'Hisab', action: "jwtGo('bills-menu')" }
            ];
            if (s.menuIdx >= items.length || s.menuIdx < 0) s.menuIdx = 0;

            let html = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head"><span>Gateway of Job Work</span><span style="font-size:11px; color:#92400e;">[C/A/J/O/S/F/B]</span></div>`;
            items.forEach((it, i) => {
                if (it.sec) html += `<div class="jwt-sec-lbl ${i === 0 ? 'first' : ''}">${J.esc(it.sec)}</div>`;
                html += `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" data-key="${it.key}" onclick="jwtSetMenuIdx(${i}); ${it.action}">
                    <span>${it.label}</span><span class="jwt-menu-val">${J.esc(it.val)}</span>
                </button>`;
            });
            html += `<div class="jwt-footer"><span>[&uarr; &darr;] Upar-Niche &middot; [Enter] Select</span><span>[Esc] Dashboard</span></div></div></div>`;
            body.innerHTML = html;
            return true;
        }

        // 2. CREATE MENU (WORKER / GROUP / FIRM PROFILE)
        if (s.curView === 'create-menu') {
            J.setTopHeader('Create (Worker / Group / Firm)', '← [Esc] Gateway');
            const firm = J.getFirmProfile();
            const opts = [
                { label: '1. Create JobWorker', val: `${snap.workers.length} Workers`, action: "jwtSetMenuIdx(0); jwtOpenCreateWorker()" },
                { label: '2. Create New Work Group', val: `${snap.groups.length} Groups`, action: "jwtSetMenuIdx(1); jwtOpenCreateGroup()" },
                { label: '3. Firm Profile (From Name, Address, GST)', val: firm.name, action: "jwtSetMenuIdx(2); jwtGo('firm-profile')" }
            ];
            if (s.menuIdx >= opts.length || s.menuIdx < 0) s.menuIdx = 0;
            body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head"><span>Create Master</span></div>
                ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${J.esc(o.val)}</span></button>`).join('')}
                <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
            </div></div>`;
            return true;
        }

        // FIRM PROFILE (FROM + GST NO.)
        if (s.curView === 'firm-profile') {
            const f = J.getFirmProfile();
            J.setTopHeader('Firm Profile (Challan From & GST)', '← [Esc] Back');
            s.crAcceptOpen = false;
            body.innerHTML = `<div style="padding:16px; max-width:540px;">
                <div class="jwt-frow"><label>Firm Name (From) :</label><input type="text" id="jwt-fm-name" class="jwt-inp" value="${J.esc(f.name)}" placeholder="e.g. INDIAN FABRICS"></div>
                <div class="jwt-frow"><label>Address :</label><input type="text" id="jwt-fm-addr" class="jwt-inp" value="${J.esc(f.address)}" placeholder="e.g. Madanpura, Varanasi"></div>
                <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-fm-mob" class="jwt-inp" value="${J.esc(f.mobile)}" placeholder="Mobile No."></div>
                <div class="jwt-frow"><label>GST No. (GSTIN) :</label><input type="text" id="jwt-fm-gst" class="jwt-inp" value="${J.esc(f.gst)}" placeholder="e.g. 09ABCDE1234F1Z5"></div>
                <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                    <strong style="font-size:12px;">Accept? Firm Details Save Karein?</strong>
                    <div style="display:flex; gap:6px;">
                        <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtSaveFirmProfile()">Yes [Y / Enter]</button>
                        <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                    </div>
                </div>
                <div style="text-align:right; margin-top:10px;"><button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Save Firm [Enter]</button></div>
            </div>`;
            const order = ['jwt-fm-name', 'jwt-fm-addr', 'jwt-fm-mob', 'jwt-fm-gst'];
            order.forEach((id, i) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (i < order.length - 1) document.getElementById(order[i + 1])?.focus();
                        else window.jwtAskCrAccept();
                    }
                });
            });
            setTimeout(() => document.getElementById('jwt-fm-name')?.focus(), 25);
            return true;
        }

        // 2A. CREATE JOBWORKER (WITH GST NO.)
        if (s.curView === 'create-worker') {
            J.setTopHeader('Create JobWorker', '← [Esc] Create Menu', '[Enter] Agla Box · [↑↓] Group Chunein · [Esc] Back');
            const groups = snap.groups;
            if (!groups.some((g) => g.key === s.selectedCreateGroupKey) && groups.length) s.selectedCreateGroupKey = groups[0].key;
            s.createSideIdx = Math.max(0, groups.findIndex((g) => g.key === s.selectedCreateGroupKey));
            s.crAcceptOpen = false;

            body.innerHTML = `<div class="jwt-split">
                <div class="jwt-pane-l">
                    <div class="jwt-frow"><label>Worker / Party Name :</label><input type="text" id="jwt-cw-name" class="jwt-inp" placeholder="e.g. G K FABRICS"></div>
                    <div class="jwt-frow"><label>Under (Work Group) :</label><input type="text" id="jwt-cw-grp" class="jwt-inp" readonly value="${J.esc(J.grpLabel(s.selectedCreateGroupKey))}"></div>
                    <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-cw-mob" maxlength="10" class="jwt-inp" placeholder="10-digit Mobile"></div>
                    <div class="jwt-frow"><label>Address / City :</label><input type="text" id="jwt-cw-addr" class="jwt-inp" placeholder="e.g. Ring Road, Surat"></div>
                    <div class="jwt-frow"><label>GST No. (Optional) :</label><input type="text" id="jwt-cw-gst" class="jwt-inp" placeholder="e.g. 24ABCDE1234F1Z5"></div>
                    <div class="jwt-frow"><label>Join Date :</label><input type="date" id="jwt-cw-date" class="jwt-inp" value="${J.getTodayIso()}"></div>
                    <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Worker Save Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtSaveNewWorker()">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:10px;"><button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Save Worker [Ctrl+Enter]</button></div>
                </div>
                <div class="jwt-pane-r">
                    <div class="jwt-sidebox">
                        <div class="jwt-sidebox-head"><span>List of Work Groups</span><small>${groups.length}</small></div>
                        <div id="jwt-cw-side-list" class="jwt-side-list-big">${groups.map((g, i) => `
                            <div class="jwt-side-opt ${i === s.createSideIdx ? 'active' : ''}" onmousedown="event.preventDefault(); jwtPickCwGroup(${i})">
                                <span>${J.esc(g.label)}</span><small>${g.outstation ? 'Bill+Slip' : 'JobWork'}</small>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
            J.bindCreateWorkerKeys();
            setTimeout(() => document.getElementById('jwt-cw-name')?.focus(), 25);
            return true;
        }

        // 2B. CREATE NEW WORK GROUP (WITH OUTSTATION TICK)
        if (s.curView === 'create-group') {
            J.setTopHeader('Create New Work Group', '← [Esc] Create Menu');
            s.crAcceptOpen = false;
            body.innerHTML = `<div class="jwt-split">
                <div class="jwt-pane-l">
                    <div class="jwt-frow"><label>Work Group Name :</label><input type="text" id="jwt-cg-name" class="jwt-inp" placeholder="e.g. Swarovski, Jhalar, Stone"></div>
                    <div style="margin:8px 0 10px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:5px; padding:8px 10px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:700;">
                            <input type="checkbox" id="jwt-cg-outstation">
                            Outstation Bill + Packing Slip Chahiye (Transport, JW No., Design)
                        </label>
                    </div>
                    <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Naya Group Save Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtSaveNewGroup()">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="text-align:right;"><button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Save Group [Enter]</button></div>
                </div>
                <div class="jwt-pane-r">
                    <div class="jwt-sidebox">
                        <div class="jwt-sidebox-head"><span>Existing Work Groups</span><small>${snap.groups.length}</small></div>
                        <div class="jwt-side-list-big">${snap.groups.map((g) => `<div class="jwt-side-opt"><span>${J.esc(g.label)}</span><small>${g.outstation ? 'Bill+Slip' : 'Active'}</small></div>`).join('')}</div>
                    </div>
                </div>
            </div>`;
            const gInp = document.getElementById('jwt-cg-name');
            if (gInp) {
                gInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAskCrAccept(); } });
                setTimeout(() => gInp.focus(), 25);
            }
            return true;
        }

        // 3. ALTER MENU
        if (s.curView === 'alter-menu') {
            J.setTopHeader('Alter (Worker / Group / Firm)', '← [Esc] Gateway');
            const firm = J.getFirmProfile();
            const opts = [
                { label: '1. Alter JobWorker (Edit / Delete / GST)', val: `${snap.workers.length} Workers`, action: "jwtSetMenuIdx(0); jwtGo('alter-worker-list')" },
                { label: '2. Alter JobWork Group (Rename / Outstation / Delete)', val: `${snap.groups.length} Groups`, action: "jwtSetMenuIdx(1); jwtGo('alter-group-list')" },
                { label: '3. Alter Firm Profile (From Name, Address, GST)', val: firm.name, action: "jwtSetMenuIdx(2); jwtGo('firm-profile')" }
            ];
            if (s.menuIdx >= opts.length || s.menuIdx < 0) s.menuIdx = 0;
            body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head"><span>Alter Master</span></div>
                ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${J.esc(o.val)}</span></button>`).join('')}
                <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Gateway</span></div>
            </div></div>`;
            return true;
        }

        if (s.curView === 'alter-worker-list') {
            J.setTopHeader('Alter JobWorker — List', '← [Esc] Alter Menu', '[↑ ↓] Chunein · [Enter] Edit / Delete · [/] Search');
            const q = (document.getElementById('jwt-aw-search')?.value || '').trim().toLowerCase();
            const list = snap.workers.filter((w) => !q || `${w.name} ${J.grpLabel(w.group)} ${w.mobile} ${w.address} ${w.gst}`.toLowerCase().includes(q));
            if (s.menuIdx >= list.length || s.menuIdx < 0) s.menuIdx = Math.max(0, list.length - 1);

            body.innerHTML = `<div style="padding:12px 16px;">
                <input type="text" id="jwt-aw-search" class="jwt-inp" style="margin-bottom:10px;" value="${J.esc(q)}" placeholder="Search Worker..." oninput="jwtFilterList()">
                <table>
                    <thead><tr><th>Worker Name</th><th>Work Group</th><th>Mobile &amp; Address</th><th class="num">Pending</th><th style="text-align:right;">Action</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map((w, i) => `
                            <tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenAlterWorkerEdit('${J.esc(w.id)}')">
                                <td><strong>${J.esc(w.name)}</strong>${w.gst ? `<div class="trail-muted">GST: ${J.esc(w.gst)}</div>` : ''}</td>
                                <td>${J.esc(J.grpLabel(w.group))}</td>
                                <td>${J.esc(w.mobile || '-')} &middot; ${J.esc(w.address || '-')}</td>
                                <td class="gold-num">${w.pending} Pcs</td>
                                <td style="text-align:right;">Edit / Del &rarr;</td>
                            </tr>`).join('') : `<tr><td colspan="5" style="text-align:center; padding:18px; color:#6b7280;">Koi worker nahi mila.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            J.bindSearchKey('jwt-aw-search');
            return true;
        }

        if (s.curView === 'alter-worker-edit') {
            const w = snap.workers.find((x) => x.id === s.alterEditWorkerId);
            if (!w) { J.jwtBackTo('alter-worker-list'); return true; }
            J.setTopHeader(`Alter Worker: ${w.name}`, '← [Esc] Workers List');
            const groups = snap.groups;
            s.crAcceptOpen = false;

            body.innerHTML = `<div class="jwt-split">
                <div class="jwt-pane-l">
                    <div class="jwt-frow"><label>Worker / Party Name :</label><input type="text" id="jwt-ew-name" class="jwt-inp" value="${J.esc(w.name)}"></div>
                    <div class="jwt-frow"><label>Work Group :</label>
                        <select id="jwt-ew-grp" class="jwt-inp">
                            ${groups.map((g) => `<option value="${J.esc(g.key)}" ${g.key === w.group ? 'selected' : ''}>${J.esc(g.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="jwt-frow"><label>Mobile No. :</label><input type="tel" id="jwt-ew-mob" maxlength="10" class="jwt-inp" value="${J.esc(w.mobile)}"></div>
                    <div class="jwt-frow"><label>Address / City :</label><input type="text" id="jwt-ew-addr" class="jwt-inp" value="${J.esc(w.address)}"></div>
                    <div class="jwt-frow"><label>GST No. :</label><input type="text" id="jwt-ew-gst" class="jwt-inp" value="${J.esc(w.gst)}" placeholder="GSTIN"></div>
                    <div class="jwt-frow"><label>Join Date :</label><input type="date" id="jwt-ew-date" class="jwt-inp" value="${J.esc(J.toIsoDate(w.date) || J.getTodayIso())}"></div>
                    <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                        <strong style="font-size:12px;">Accept? Worker Update Karein?</strong>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtUpdateWorker('${J.esc(w.id)}')">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:12px; gap:8px;">
                        <button type="button" class="jwt-del" onclick="jwtDeleteWorker('${J.esc(w.id)}')">Delete Worker</button>
                        <button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Update Worker [Ctrl+Enter]</button>
                    </div>
                </div>
                <div class="jwt-pane-r">
                    <div class="jwt-sidebox">
                        <div class="jwt-sidebox-head"><span>Worker Stock Info</span></div>
                        <div style="padding:12px; font-size:12.5px; line-height:1.7;">
                            <div><strong>Diya:</strong> ${w.diya} Pcs</div>
                            <div><strong>Aai:</strong> ${w.aai} Pcs</div>
                            <div><strong>Pending:</strong> ${w.pending} Pcs</div>
                        </div>
                    </div>
                </div>
            </div>`;
            setTimeout(() => document.getElementById('jwt-ew-name')?.focus(), 25);
            return true;
        }

        if (s.curView === 'alter-group-list') {
            J.setTopHeader('Alter JobWork Group — List', '← [Esc] Alter Menu');
            const groups = snap.groups;
            if (s.menuIdx >= groups.length || s.menuIdx < 0) s.menuIdx = Math.max(0, groups.length - 1);

            body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head"><span>Select Work Group to Alter / Delete</span></div>
                ${groups.map((g, i) => {
                    const wc = snap.workers.filter((w) => w.group === g.key).length;
                    return `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtOpenAlterGroupEdit('${J.esc(g.key)}')">
                        <span>${J.esc(g.label)} ${g.outstation ? '<small class="trail">[Bill+Slip]</small>' : ''}</span>
                        <span class="jwt-menu-val">${wc} Workers</span>
                    </button>`;
                }).join('')}
                <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Alter Menu</span></div>
            </div></div>`;
            return true;
        }

        if (s.curView === 'alter-group-edit') {
            const g = snap.groups.find((x) => x.key === s.alterEditGroupKey);
            if (!g) { J.jwtBackTo('alter-group-list'); return true; }
            J.setTopHeader(`Alter Work Group: ${g.label}`, '← [Esc] Groups List');
            const wc = snap.workers.filter((w) => w.group === g.key).length;
            s.crAcceptOpen = false;

            body.innerHTML = `<div style="padding:16px; max-width:540px;">
                <div class="jwt-frow"><label>Group Name :</label><input type="text" id="jwt-eg-name" class="jwt-inp" value="${J.esc(g.label)}"></div>
                <div style="margin:8px 0 10px; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:5px; padding:8px 10px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; font-weight:700;">
                        <input type="checkbox" id="jwt-eg-outstation" ${g.outstation ? 'checked' : ''}>
                        Outstation Bill + Packing Slip Chahiye (Transport, JW No., Design)
                    </label>
                </div>
                <div style="font-size:12px; color:#6b7280; margin:6px 0 12px;">Is group me abhi <strong>${wc} Workers</strong> hain.</div>
                <div id="jwt-cr-accept" class="jwt-accept-bar" style="display:none;">
                    <strong style="font-size:12px;">Accept? Group Update Karein?</strong>
                    <div style="display:flex; gap:6px;">
                        <button type="button" id="jwt-cr-yes" class="jwt-save" onclick="jwtUpdateGroup('${J.esc(g.key)}')">Yes [Y / Enter]</button>
                        <button type="button" class="jwt-esc" onclick="jwtCancelCrAccept()">No [N / Esc]</button>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px; margin-top:10px;">
                    <button type="button" class="jwt-del" onclick="jwtDeleteGroup('${J.esc(g.key)}')">Delete Group</button>
                    <button type="button" class="jwt-save" onclick="jwtAskCrAccept()">Update Group [Enter]</button>
                </div>
            </div>`;
            const el = document.getElementById('jwt-eg-name');
            if (el) {
                el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.jwtAskCrAccept(); } });
                setTimeout(() => { el.focus(); el.select(); }, 25);
            }
            return true;
        }

        // 4. JOBWORK REGISTER
        if (s.curView === 'jw-groups') {
            J.setTopHeader('Job Work Register — Select Work Group', '← [Esc] Gateway');
            const groups = snap.groups;
            if (s.menuIdx >= groups.length || s.menuIdx < 0) s.menuIdx = 0;

            body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head"><span>Select JobWork Group</span><span>Pending</span></div>
                ${groups.map((g, i) => {
                    const ws = snap.workers.filter((w) => w.group === g.key);
                    const pend = ws.reduce((sum, w) => sum + w.pending, 0);
                    return `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtSelectJwGroup('${J.esc(g.key)}')">
                        <span>${J.esc(g.label)} <small style="color:#6b7280;">(${ws.length} Workers${g.outstation ? ' · Bill+Slip' : ''})</small></span>
                        <span class="jwt-menu-val">${pend} Pcs</span>
                    </button>`;
                }).join('')}
                <div class="jwt-footer"><span>[&uarr; &darr;] Group Chunein &middot; [Enter] Workers List</span><span>[Esc] Gateway</span></div>
            </div></div>`;
            return true;
        }

        if (s.curView === 'jw-workers') {
            const gLbl = J.grpLabel(s.activeGroupKey);
            J.setTopHeader(`List of ${gLbl} Workers`, '← [Esc] Work Groups', '[↑ ↓] Worker Chunein · [Enter] Kholein · [/] Search');
            const q = (document.getElementById('jwt-jww-search')?.value || '').trim().toLowerCase();
            const list = snap.workers
                .filter((w) => w.group === s.activeGroupKey)
                .filter((w) => !q || `${w.name} ${w.mobile} ${w.address}`.toLowerCase().includes(q));
            if (s.menuIdx >= list.length || s.menuIdx < 0) s.menuIdx = Math.max(0, list.length - 1);

            body.innerHTML = `<div style="padding:12px 16px;">
                <input type="text" id="jwt-jww-search" class="jwt-inp" style="margin-bottom:10px;" value="${J.esc(q)}" placeholder="Search ${J.esc(gLbl)} Worker..." oninput="jwtFilterList()">
                <table>
                    <thead><tr><th>Worker Name</th><th>Mobile &amp; Address</th><th class="num">Diya</th><th class="num">Aai</th><th class="num">Pending Pcs</th><th style="text-align:right;">Open</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map((w, i) => `
                            <tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" onclick="jwtSetMenuIdx(${i}); jwtSelectWorker('${J.esc(w.id)}')">
                                <td><strong>${J.esc(w.name)}</strong></td>
                                <td>${J.esc(w.mobile || '-')} &middot; ${J.esc(w.address || '-')}</td>
                                <td class="num">${w.diya}</td>
                                <td class="num">${w.aai}</td>
                                <td class="gold-num">${w.pending} Pcs</td>
                                <td style="text-align:right;">Open &rarr;</td>
                            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; padding:20px; color:#6b7280;">Is group me koi worker nahi hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            J.bindSearchKey('jwt-jww-search');
            return true;
        }

        if (s.curView === 'jw-worker-menu') {
            const w = snap.workers.find((x) => x.id === s.activeWorkerId);
            if (!w) { J.jwtBackTo('jw-workers'); return true; }
            const gLbl = J.grpLabel(w.group);
            J.setTopHeader(`${w.name} (${gLbl})`, '← [Esc] Workers List', '[↑ ↓] + [Enter] · [Esc] Workers List', true);

            const opts = [
                { label: `1. ${gLbl} Out (Saree Bhejein)`, val: 'Godam ➔ Worker', action: "jwtSetMenuIdx(0); jwtOpenWorkerVoucher('out')" },
                { label: `2. ${gLbl} In (Saree Wapas Lein)`, val: `${w.pending} Pending`, action: "jwtSetMenuIdx(1); jwtOpenWorkerVoucher('in')" },
                { label: '3. Worker Register (Edit / Delete / Print)', val: `Diya ${w.diya} / Aai ${w.aai}`, action: "jwtSetMenuIdx(2); jwtOpenWorkerHist()" }
            ];
            if (s.menuIdx >= opts.length || s.menuIdx < 0) s.menuIdx = 0;

            body.innerHTML = `<div style="padding:10px 16px;"><div class="jwt-menu-shell">
                <div class="jwt-menu-head">
                    <span>${J.esc(w.name)} (${J.esc(gLbl)})</span>
                    <span style="color:#b47d00;">Pending: ${w.pending} Pcs</span>
                </div>
                ${opts.map((o, i) => `<button type="button" class="jwt-menu-item ${i === s.menuIdx ? 'active' : ''}" onclick="${o.action}"><span>${o.label}</span><span class="jwt-menu-val">${J.esc(o.val)}</span></button>`).join('')}
                <div class="jwt-footer"><span>[&uarr; &darr;] + [Enter]</span><span>[Esc] Workers List</span></div>
            </div></div>`;
            return true;
        }

        // VOUCHER (OUT / IN)
        if (s.curView === 'jw-voucher') {
            const w = snap.workers.find((x) => x.id === s.activeWorkerId);
            if (!w) { J.jwtBackTo('jw-workers'); return true; }
            const grpObj = J.getGroupObj(w.group);
            const gLbl = grpObj.label;
            const isOut = (s.vchDir === 'out');
            const isOutstationOut = (isOut && grpObj.outstation);
            const firm = J.getFirmProfile();

            if (!s.vchMeta.date) s.vchMeta.date = J.getTodayIso();
            if (isOutstationOut && !s.vchMeta.jwNo) s.vchMeta.jwNo = J.getNextChallanNo();

            J.setTopHeader(`${w.name} — ${gLbl} ${isOut ? 'Out' : 'In'}`, '← [Esc] Worker Menu', 'Kariger ➔ Stage ➔ Pcs · Khali Kariger Enter = Save', true);

            const sourceBatches = isOut ? snap.godamBatches.filter((b) => b.bucket === 'unfinished' && b.pcs > 0) : w.pendingItems;
            const totBatchPcs = s.vchBatch.reduce((sum, x) => sum + x.qty, 0);
            const defDest = (w.group === 'calender') ? 'finished' : 'godam';

            body.innerHTML = `<div class="jwt-split">
                <div class="jwt-pane-l">
                    <div class="jwt-frow"><label>Tarikh :</label><input type="date" id="jwt-vch-date" class="jwt-inp" value="${J.esc(s.vchMeta.date)}"></div>
                    ${isOutstationOut ? `
                        <div class="jwt-frow"><label>From (Firm) :</label>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <input type="text" class="jwt-inp" readonly value="${J.esc(firm.name)}${firm.gst ? ` (GST: ${J.esc(firm.gst)})` : ''}">
                                <button type="button" tabindex="-1" class="jwt-esc" onclick="jwtGo('firm-profile')">Edit</button>
                            </div>
                        </div>
                        <div class="jwt-frow"><label>JobWork No. :</label><input type="text" id="jwt-vch-jwno" class="jwt-inp" value="${J.esc(s.vchMeta.jwNo)}"></div>
                        <div class="jwt-frow"><label>Transport :</label><input type="text" id="jwt-vch-trans" class="jwt-inp" value="${J.esc(s.vchMeta.transport)}" placeholder="e.g. Patel / VRL Transport"></div>
                        <div class="jwt-frow"><label>L.R. / Bale :</label><input type="text" id="jwt-vch-lr" class="jwt-inp" value="${J.esc(s.vchMeta.lrNo)}" placeholder="e.g. 4589 / 1 Bale"></div>
                        <div class="jwt-frow"><label>Design / Work :</label><input type="text" id="jwt-vch-design" class="jwt-inp" value="${J.esc(s.vchMeta.designNote)}" placeholder="e.g. Swarovski D.No 402"></div>
                    ` : ''}
                    <div class="jwt-frow"><label>Kariger :</label><input type="text" id="jwt-vch-kariger" class="jwt-inp" autocomplete="off" placeholder="Name likhein ya ↑↓ (Khali Enter=Save)"></div>
                    <div class="jwt-frow"><label>Stage Batch :</label><input type="text" id="jwt-vch-stage" class="jwt-inp" readonly placeholder="Stage chunein..."></div>
                    ${!isOut ? `<div class="jwt-frow"><label>Wapas Kahan :</label>
                        <select id="jwt-vch-dest" class="jwt-inp">
                            <option value="godam" ${defDest === 'godam' ? 'selected' : ''}>Godam (${J.esc(gLbl)} Complete)</option>
                            <option value="finished" ${defDest === 'finished' ? 'selected' : ''}>Final Tayyar (Finished)</option>
                            <option value="lott">Lott / Damage</option>
                        </select>
                    </div>` : ''}
                    <div class="jwt-frow">
                        <label>Pcs :</label>
                        <div style="display:flex; gap:6px;">
                            <input type="text" inputmode="numeric" id="jwt-vch-qty" class="jwt-inp" placeholder="0" style="flex:1;">
                            <button type="button" tabindex="-1" class="jwt-save" onclick="jwtAddVchItem()">+ Add</button>
                        </div>
                    </div>

                    <div style="margin-top:8px; border:1px solid #e5d5a7; border-radius:5px; overflow:hidden;">
                        <div class="jwt-sidebox-head"><span>${isOut ? 'Out' : 'In'} Batch</span><strong>${totBatchPcs} Pcs (${s.vchBatch.length})</strong></div>
                        <div style="max-height:155px; overflow-y:auto;">
                            <table>
                                <thead><tr><th>#</th><th>Kariger</th><th>Saree &amp; Trail</th>${!isOut ? '<th>Kahan</th>' : ''}<th class="num">Pcs</th><th></th></tr></thead>
                                <tbody>
                                    ${s.vchBatch.length ? s.vchBatch.map((it, idx) => `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td><strong>${J.esc(it.maker)}</strong></td>
                                            <td>${J.esc(it.saree)}<div class="trail">${J.esc(J.formatTrail(it.doneStages, 'unfinished'))}</div></td>
                                            ${!isOut ? `<td>${it.dest === 'finished' ? 'Fin' : (it.dest === 'lott' ? 'Lott' : 'Gdm')}</td>` : ''}
                                            <td class="gold-num">${it.qty}</td>
                                            <td style="text-align:center;"><button type="button" tabindex="-1" class="jwt-esc" style="padding:1px 6px;" onclick="jwtRemoveVchItem(${idx})">&times;</button></td>
                                        </tr>`).join('') : `<tr><td colspan="${isOut ? 5 : 6}" style="text-align:center; padding:10px; color:#6b7280;">Batch khali hai.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap;">
                        <span class="trail-muted">${s.vchBatch.length ? 'Khali Kariger par Enter ya Save dabayein' : 'Kariger ➔ Stage ➔ Pcs add karein'}</span>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${s.lastChallanObj && s.lastChallanObj.isOutstation ? `
                                <button type="button" tabindex="-1" class="jwt-esc" onclick="jwtPrintLastChallan()">Last Challan [Alt+P]</button>
                                <button type="button" tabindex="-1" class="jwt-esc" onclick="jwtPrintLastPackingSlip()">Last Slip [Alt+L]</button>
                            ` : ''}
                            ${s.vchBatch.length ? `<button type="button" class="jwt-save" onclick="jwtAskVchAccept()">Save Batch [Ctrl+Enter]</button>` : ''}
                        </div>
                    </div>

                    <div id="jwt-vch-accept" class="jwt-accept-bar" style="display:${s.vchAcceptOpen ? 'flex' : 'none'};">
                        <strong style="font-size:12px;">Accept? Batch Save Karein?</strong>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button type="button" class="jwt-save" onclick="jwtCommitVch('challan')">Save &amp; Challan [P]</button>
                            ${isOutstationOut ? `<button type="button" class="jwt-save" onclick="jwtCommitVch('slip')">Save &amp; Packing Slip [L]</button>` : ''}
                            ${isOutstationOut ? `<button type="button" class="jwt-save" onclick="jwtCommitVch('both')">Save &amp; Both [B]</button>` : ''}
                            <button type="button" id="jwt-vch-yes" class="jwt-save" onclick="jwtCommitVch('')">Yes [Y / Enter]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCancelVchAccept()">No [N]</button>
                        </div>
                    </div>
                </div>

                <div class="jwt-pane-r">
                    <div class="jwt-sidebox">
                        <div class="jwt-sidebox-head"><span id="jwt-vch-r-title">1. List of Karigers</span><small id="jwt-vch-r-cnt">0</small></div>
                        <div id="jwt-vch-r-list" class="jwt-side-list-big"></div>
                    </div>
                </div>
            </div>`;
            J.renderVchRightPanel(sourceBatches);
            J.bindVchVoucherKeys(sourceBatches, isOutstationOut);
            const focusTarget = (isOutstationOut && s.vchBatch.length === 0 && !s.vchMeta.transport) ? 'jwt-vch-trans' : 'jwt-vch-kariger';
            setTimeout(() => document.getElementById(focusTarget)?.focus(), 25);
            return true;
        }

        // WORKER REGISTER HISTORY (DATE RANGE + FIXED EDIT + PRINT CHOICE BAR)
        if (s.curView === 'jw-worker-hist') {
            const w = snap.workers.find((x) => x.id === s.activeWorkerId);
            if (!w) { J.jwtBackTo('jw-workers'); return true; }
            const isGroupOutst = J.getGroupObj(w.group).outstation;
            J.setTopHeader(`${w.name} — Register (Edit / Print)`, '← [Esc] Worker Menu', '[↑ ↓] Row · [E] Edit · [P] Print · [Alt+P] Statement', true);

            const sheets = J.safeArr(J.getStoreSafe(`jobwork_sheets_${w.id}`));
            const allRows = [];
            sheets.forEach((sh) => J.safeArr(sh.rows).forEach((r) => allRows.push({ sheetId: sh.id, r })));
            allRows.reverse();

            const dFrom = s.regDateFrom || '';
            const dTo = s.regDateTo || '';
            const rows = allRows.filter(({ r }) => {
                const iso = J.toIsoDate(r.date);
                if (dFrom && (!iso || iso < dFrom)) return false;
                if (dTo && (!iso || iso > dTo)) return false;
                return true;
            });

            if (s.menuIdx >= rows.length || s.menuIdx < 0) s.menuIdx = Math.max(0, rows.length - 1);

            let periodOut = 0, periodIn = 0, periodLott = 0;
            rows.forEach(({ r }) => {
                periodOut += J.safeInt(r.gayiQty);
                periodIn += J.safeInt(r.aayiQty);
                periodLott += J.safeInt(r.damagePcs);
            });
            const periodNet = periodOut - (periodIn + periodLott);

            let editBoxHtml = '';
            if (s.editWorkerRowInfo) {
                const target = allRows.find((x) => String(x.sheetId) === String(s.editWorkerRowInfo.sheetId) && String(x.r.id) === String(s.editWorkerRowInfo.rowId));
                if (target) {
                    const r = target.r;
                    const isOut = J.safeInt(r.gayiQty) > 0;
                    const items = isOut ? J.safeArr(r.gayiItems) : J.safeArr(r.aayiItems);
                    const showOutstEdit = isOut && (r.isOutstation || isGroupOutst);
                    editBoxHtml = `<div style="background:#fdfcf7; border:1.5px solid #d9b86c; border-radius:6px; padding:12px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="color:#92400e;">Edit Entry (${isOut ? 'OUT' : 'IN'})</strong>
                            <button type="button" class="jwt-esc" onclick="jwtCancelEditWorkerRow()">Cancel [Esc]</button>
                        </div>
                        <div class="jwt-frow" style="max-width:360px;"><label>Tarikh :</label><input type="date" id="jwt-eh-date" class="jwt-inp" value="${J.esc(J.toIsoDate(r.date) || J.getTodayIso())}"></div>
                        ${showOutstEdit ? `
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; margin-bottom:8px;">
                                <div><label style="font-size:11px; font-weight:700;">JW No.</label><input type="text" id="jwt-eh-jwno" class="jwt-inp" value="${J.esc(r.jwNo || '')}"></div>
                                <div><label style="font-size:11px; font-weight:700;">Transport</label><input type="text" id="jwt-eh-trans" class="jwt-inp" value="${J.esc(r.transport || '')}"></div>
                                <div><label style="font-size:11px; font-weight:700;">L.R. / Bale</label><input type="text" id="jwt-eh-lr" class="jwt-inp" value="${J.esc(r.lrNo || '')}"></div>
                                <div><label style="font-size:11px; font-weight:700;">Design</label><input type="text" id="jwt-eh-design" class="jwt-inp" value="${J.esc(r.designNote || '')}"></div>
                            </div>
                        ` : ''}
                        ${items.length ? items.map((it, idx) => `
                            <div style="display:grid; grid-template-columns:1.5fr 100px ${!isOut ? '140px' : ''}; gap:8px; align-items:center; margin-bottom:6px;">
                                <div style="font-size:12px;"><strong>${J.esc(it.karigar || '-')}</strong> (${J.esc(it.saree || 'Saree')}) <span class="trail">[${J.esc(J.formatTrail(it.doneStages || [], it.destBucket || 'unfinished'))}]</span></div>
                                <input type="text" inputmode="numeric" id="jwt-eh-qty-${idx}" class="jwt-inp" value="${J.safeInt(it.qty)}">
                                ${!isOut ? `<select id="jwt-eh-dest-${idx}" class="jwt-inp">
                                    <option value="unfinished" ${(it.destBucket || 'unfinished') === 'unfinished' ? 'selected' : ''}>Godam WIP</option>
                                    <option value="finished" ${it.destBucket === 'finished' ? 'selected' : ''}>Finished</option>
                                    <option value="lott" ${it.destBucket === 'lott' ? 'selected' : ''}>Lott</option>
                                </select>` : ''}
                            </div>`).join('') : `<div class="trail-muted" style="padding:6px 0;">Is purani (legacy) entry ke items edit nahi ho sakte.</div>`}
                        ${items.length ? `<div style="text-align:right; margin-top:8px;">
                            <button type="button" class="jwt-save" onclick="jwtSaveWorkerHistEdit('${J.esc(target.sheetId)}', '${J.esc(r.id)}')">Save Changes</button>
                        </div>` : ''}
                    </div>`;
                }
            }

            let regPrintBarHtml = '';
            if (s.regPrintRowInfo) {
                const pTarget = allRows.find((x) => String(x.sheetId) === String(s.regPrintRowInfo.sheetId) && String(x.r.id) === String(s.regPrintRowInfo.rowId));
                if (pTarget) {
                    regPrintBarHtml = `<div id="jwt-reg-print-bar" class="jwt-accept-bar" style="margin-top:0; margin-bottom:10px;">
                        <strong style="font-size:12px;">Kya Print Karna Hai? (${J.esc(pTarget.r.jwNo || J.fmtDate(pTarget.r.date))})</strong>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button type="button" class="jwt-save" onclick="jwtPrintWorkerRow('${J.esc(pTarget.sheetId)}', '${J.esc(pTarget.r.id)}', 'challan')">Print Challan [P]</button>
                            <button type="button" class="jwt-save" onclick="jwtPrintWorkerRow('${J.esc(pTarget.sheetId)}', '${J.esc(pTarget.r.id)}', 'slip')">Packing Slip [L]</button>
                            <button type="button" class="jwt-save" onclick="jwtPrintWorkerRow('${J.esc(pTarget.sheetId)}', '${J.esc(pTarget.r.id)}', 'both')">Both (Challan+Slip) [B]</button>
                            <button type="button" class="jwt-esc" onclick="jwtCloseRegPrint()">Cancel [Esc]</button>
                        </div>
                    </div>`;
                }
            }

            body.innerHTML = `<div style="padding:12px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div><strong>${J.esc(w.name)}</strong> (${J.esc(J.grpLabel(w.group))}) &middot; Diya: ${w.diya} &middot; Aai: ${w.aai} &middot; <strong style="color:#b47d00;">Pending: ${w.pending} Pcs</strong></div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="jwt-esc" onclick="jwtShareWorkerWhatsApp('${J.esc(w.id)}')">WhatsApp</button>
                        <button type="button" class="jwt-save" onclick="jwtPrintWorkerStatement('${J.esc(w.id)}')">Print Statement [Alt+P]</button>
                    </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#fdfcf7; border:1px solid #e5d5a7; border-radius:5px; padding:8px 10px; margin-bottom:10px;">
                    <strong style="font-size:11.5px; color:#92400e;">Date Filter:</strong>
                    <label style="font-size:11.5px; font-weight:700;">From</label>
                    <input type="date" id="jwt-reg-from" class="jwt-inp" style="width:145px;" value="${J.esc(dFrom)}" onchange="jwtApplyRegDates()">
                    <label style="font-size:11.5px; font-weight:700;">To</label>
                    <input type="date" id="jwt-reg-to" class="jwt-inp" style="width:145px;" value="${J.esc(dTo)}" onchange="jwtApplyRegDates()">
                    ${(dFrom || dTo) ? `<button type="button" class="jwt-esc" onclick="jwtClearRegDates()">All Dates</button>` : ''}
                    <span class="trail-muted" style="margin-left:auto;">${rows.length} Entries</span>
                </div>

                <div class="jwt-kpi-4">
                    <div class="jwt-kpi-cell"><small>${(dFrom || dTo) ? 'Selected Period' : 'Total'} Out (Gaya)</small><strong>${periodOut} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>${(dFrom || dTo) ? 'Selected Period' : 'Total'} In (Aaya)</small><strong>${periodIn} Pcs${periodLott ? ` (+${periodLott} Lott)` : ''}</strong></div>
                    <div class="jwt-kpi-cell"><small>Period Net (Out − In)</small><strong>${periodNet} Pcs</strong></div>
                    <div class="jwt-kpi-cell"><small>Kul Pending (Abhi Baki)</small><strong>${w.pending} Pcs</strong></div>
                </div>

                ${editBoxHtml}
                ${regPrintBarHtml}

                <table>
                    <thead><tr><th>Tarikh</th><th>Type</th><th>Batch Detail &amp; Transport / Design</th><th class="num">Out</th><th class="num">In / Lott</th><th style="text-align:right;">Actions</th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(({ sheetId, r }, i) => {
                            const gQ = J.safeInt(r.gayiQty);
                            const aQ = J.safeInt(r.aayiQty) + J.safeInt(r.damagePcs);
                            const isOutRow = gQ > 0;
                            const isRowOutst = isOutRow && (r.isOutstation || isGroupOutst);
                            const items = isOutRow ? J.safeArr(r.gayiItems) : J.safeArr(r.aayiItems);
                            const det = items.length
                                ? items.map((it) => `${J.esc(it.karigar || '-')} (${J.esc(it.saree || 'Saree')} &middot; ${J.esc(J.formatTrail(it.doneStages || [], it.destBucket || 'unfinished'))}: ${it.qty})`).join('<br>')
                                : '-';
                            const metaLine = isRowOutst
                                ? `<div class="trail">${J.esc(r.jwNo || '')} ${r.transport ? `· ${J.esc(r.transport)}` : ''} ${r.designNote ? `· ${J.esc(r.designNote)}` : ''}</div>`
                                : '';
                            return `<tr class="jwt-row ${i === s.menuIdx ? 'active' : ''}" data-shid="${J.esc(sheetId)}" data-rid="${J.esc(r.id)}" data-outst="${isRowOutst ? '1' : '0'}" onclick="jwtSetMenuIdx(${i}); highlightRegRow(${i});">
                                <td>${J.esc(J.fmtDate(r.date))}</td>
                                <td><strong>${isOutRow ? 'OUT' : (J.safeInt(r.damagePcs) > 0 && J.safeInt(r.aayiQty) === 0 ? 'LOTT' : 'IN')}</strong></td>
                                <td>${det}${metaLine}</td>
                                <td class="num">${gQ > 0 ? `-${gQ}` : '-'}</td>
                                <td class="gold-num">${aQ > 0 ? `+${aQ}` : '-'}</td>
                                <td style="text-align:right; white-space:nowrap;">
                                    <button type="button" class="jwt-esc" onclick="event.stopPropagation(); jwtEditWorkerRow('${J.esc(sheetId)}', '${J.esc(r.id)}')">Edit</button>
                                    ${isRowOutst
                                        ? `<button type="button" class="jwt-esc" onclick="event.stopPropagation(); jwtAskRegPrint('${J.esc(sheetId)}', '${J.esc(r.id)}')">Print ▾</button>`
                                        : `<button type="button" class="jwt-esc" onclick="event.stopPropagation(); jwtPrintWorkerRow('${J.esc(sheetId)}', '${J.esc(r.id)}', 'challan')">Print</button>`}
                                    <button type="button" class="jwt-del" onclick="event.stopPropagation(); jwtDeleteWorkerHistRow('${J.esc(sheetId)}', '${J.esc(r.id)}')">Del</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="6" style="text-align:center; padding:18px; color:#6b7280;">Is date range me koi entry nahi hai.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
            return true;
        }

        return false;
    };
})();
