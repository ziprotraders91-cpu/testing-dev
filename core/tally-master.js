/* ============================================================================
   SIMPLICITY ERP - TALLYPRIME DASHBOARD, GATEWAY, STOCK SUMMARY & BOOTSTRAP
   File: core/tally-master.js • Developed by Farhan Jawed
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. LOGIN PASSWORD TOGGLE & PROMO SLIDESHOW
    ======================================================================== */
    window.slToggleLoginPass = function () {
        const p = document.getElementById('login-pass');
        if (p) p.type = p.type === 'password' ? 'text' : 'password';
    };

    const slSlides = [
        {
            icon: '🧵',
            title: 'Kariger Mobile Portal',
            desc: 'Ab har kariger apne mobile par 4-digit PIN se apna Loom Progress, Bana, Zari aur Baki Mazdoori 24×7 live dekh sakta hai.',
            link: 'landing.html#kariger_portal',
            cta: 'Get more'
        },
        {
            icon: '📜',
            title: 'Auto Tani & Rangai Order',
            desc: 'Parchi banate hi automatic Sancha aur phir Rangai wale ke mobile par chali jaati hai. Ready hone par hi Loom sheet khulti hai.',
            link: 'landing.html#tani_order',
            cta: 'Explore'
        },
        {
            icon: '⚡',
            title: 'Zero-Mouse Express Counter',
            desc: 'Baithak aur mandi ke rush mein sirf Enter dabakar Saree, Bana, Zari, Rokad entry aur A6 thermal parchi 1 second mein print karein.',
            link: 'landing.html#express',
            cta: 'Dekhein'
        },
        {
            icon: '🔄',
            title: '1-Click Year Closing & Sync',
            desc: 'Offline PWA speed ke saath 1 click mein pichla balance naye saal mein shift karein aur multi-device live cloud sync payein.',
            link: 'landing.html#closing_backup',
            cta: 'Learn more'
        }
    ];

    let slCurrentSlide = 0;
    window.slSetSlide = function (idx) {
        slCurrentSlide = idx;
        const card = document.getElementById('slPromoCard');
        const item = slSlides[idx];
        if (!card || !item) return;

        card.classList.add('sl-fade');
        setTimeout(() => {
            const iconEl = document.getElementById('slPromoIcon');
            const titleEl = document.getElementById('slPromoTitle');
            const descEl = document.getElementById('slPromoDesc');
            const btnEl = document.getElementById('slPromoBtn');
            if (iconEl) iconEl.textContent = item.icon;
            if (titleEl) titleEl.textContent = item.title;
            if (descEl) descEl.textContent = item.desc;
            if (btnEl) {
                btnEl.href = item.link;
                btnEl.textContent = item.cta;
            }
            card.classList.remove('sl-fade');
        }, 160);

        document.querySelectorAll('#login-wrapper .sl-dot').forEach((d, i) => {
            d.classList.toggle('active', i === idx);
        });
    };

    setInterval(() => {
        const wrap = document.getElementById('login-wrapper');
        if (wrap && wrap.style.display !== 'none') {
            window.slSetSlide((slCurrentSlide + 1) % slSlides.length);
        }
    }, 4500);

    /* ========================================================================
       2. GATEWAY SELECTION & DASHBOARD LIVE 4-CARD SYNC
    ======================================================================== */
    window.slGwClick = function (btn, fn) {
        document.querySelectorAll('#dashboard-view .gw-item').forEach((el) => el.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (typeof fn === 'function') fn();
    };

    const slParseNum = (str, regex) => {
        if (!str) return 0;
        const m = String(str).match(regex || /[-+]?\d+(?:\.\d+)?/);
        return m ? parseFloat(m[0]) || 0 : 0;
    };

    const slSyncStockSummaryValues = (banaVal, zariVal, taniVal, chukkaVal, sareeVal) => {
        const gwValEl = document.getElementById('btn-total-stock-summary');
        if (gwValEl) {
            const fmtShort = (n) => (n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1));
            gwValEl.textContent = `${fmtShort(banaVal + zariVal)} Kg · ${Math.round(sareeVal)} Pc`;
        }

        const ssBana = document.getElementById('ss-val-bana');
        const ssZari = document.getElementById('ss-val-zari');
        const ssSancha = document.getElementById('ss-val-sancha');
        const ssSaree = document.getElementById('ss-val-saree');

        if (ssBana) ssBana.textContent = `Bacha: ${banaVal.toFixed(2)} Kg`;
        if (ssZari) ssZari.textContent = `Bacha: ${zariVal.toFixed(2)} Kg`;
        if (ssSancha) ssSancha.textContent = `Tani: ${taniVal.toFixed(1)} Kg · Chukka: ${chukkaVal.toFixed(1)} Kg`;
        if (ssSaree) ssSaree.textContent = `Stock: ${Math.round(sareeVal)} Pcs`;
    };

    window.slSyncDashboardCharts = function () {
        const todayEl = document.getElementById('sl-today-date');
        if (todayEl) {
            try {
                todayEl.textContent = new Date().toLocaleDateString('en-IN', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                });
            } catch (_) {}
        }

        const sesSel = document.getElementById('app-session-select');
        const perEl = document.getElementById('sl-period-label');
        if (sesSel && perEl && sesSel.value) {
            perEl.textContent = 'Session ' + sesSel.value;
        }

        const banaTxt = document.getElementById('btn-total-bana')?.textContent || '';
        const zariTxt = document.getElementById('btn-total-zari')?.textContent || '';
        const sanchaTxt = document.getElementById('btn-total-sancha')?.textContent || '';
        const sareeTxt = document.getElementById('btn-total-saree')?.textContent || '';

        const banaVal = slParseNum(banaTxt);
        const zariVal = slParseNum(zariTxt);

        let taniVal = 0;
        let chukkaVal = 0;
        const taniM = sanchaTxt.match(/Tani:\s*([-+]?\d+(?:\.\d+)?)/i);
        const chukkaM = sanchaTxt.match(/Chukka:\s*([-+]?\d+(?:\.\d+)?)/i);
        if (taniM || chukkaM) {
            taniVal = taniM ? parseFloat(taniM[1]) || 0 : 0;
            chukkaVal = chukkaM ? parseFloat(chukkaM[1]) || 0 : 0;
        } else {
            taniVal = slParseNum(sanchaTxt);
        }
        const sareeVal = slParseNum(sareeTxt);

        slSyncStockSummaryValues(banaVal, zariVal, taniVal, chukkaVal, sareeVal);

        const fmtKg = (n) => (n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1));
        const setBar = (idVal, idH, label, pct) => {
            const vEl = document.getElementById(idVal);
            const hEl = document.getElementById(idH);
            if (vEl) vEl.textContent = label;
            if (hEl) hEl.style.height = Math.max(14, Math.min(92, pct)) + '%';
        };

        const maxKg = Math.max(banaVal, zariVal, taniVal, chukkaVal, 1);
        setBar('sl-bar-val-bana', 'sl-bar-h-bana', fmtKg(banaVal), (banaVal / maxKg) * 88);
        setBar('sl-bar-val-zari', 'sl-bar-h-zari', fmtKg(zariVal), (zariVal / maxKg) * 88);
        setBar('sl-bar-val-tani', 'sl-bar-h-tani', fmtKg(taniVal), (taniVal / maxKg) * 88);
        setBar('sl-bar-val-chukka', 'sl-bar-h-chukka', fmtKg(chukkaVal), (chukkaVal / maxKg) * 88);
        setBar(
            'sl-bar-val-saree',
            'sl-bar-h-saree',
            Math.round(sareeVal) + ' Pc',
            sareeVal > 0 ? Math.max(22, Math.min(82, (sareeVal / Math.max(sareeVal, 100)) * 88)) : 14
        );

        let readyC = 0, rangaiC = 0, sanchaC = 0, totalC = 0;
        try {
            if (typeof window.getStore === 'function') {
                const list = window.getStore('tani_orders_list');
                if (Array.isArray(list)) {
                    list.forEach((o) => {
                        if (!o) return;
                        const st = String(o.status || '').toLowerCase();
                        if (st === 'ready') readyC++;
                        else if (st === 'rangai') rangaiC++;
                        else sanchaC++;
                    });
                    totalC = list.length;
                }
            }
        } catch (_) {}

        if (totalC === 0) {
            const taniOrdTxt = document.getElementById('btn-total-tani-orders')?.textContent || '';
            const rM = taniOrdTxt.match(/(\d+)\s*Ready/i);
            const rgM = taniOrdTxt.match(/(\d+)\s*Rangai/i);
            const sM = taniOrdTxt.match(/(\d+)\s*Sancha/i);
            if (rM) readyC = parseInt(rM[1], 10) || 0;
            if (rgM) rangaiC = parseInt(rgM[1], 10) || 0;
            if (sM) sanchaC = parseInt(sM[1], 10) || 0;
            totalC = readyC + rangaiC + sanchaC;
        }

        const circ = 238.76;
        const readyDash = totalC > 0 ? (readyC / totalC) * circ : 0;
        const rangaiDash = totalC > 0 ? (rangaiC / totalC) * circ : 0;
        const pct = totalC > 0 ? Math.round((readyC / totalC) * 100) : 0;

        const ringReady = document.getElementById('sl-ring-ready');
        const ringRangai = document.getElementById('sl-ring-rangai');
        if (ringReady) ringReady.setAttribute('stroke-dasharray', `${readyDash.toFixed(1)} ${circ}`);
        if (ringRangai) {
            ringRangai.setAttribute('stroke-dasharray', `${rangaiDash.toFixed(1)} ${circ}`);
            ringRangai.setAttribute('stroke-dashoffset', `-${readyDash.toFixed(1)}`);
        }

        const elPct = document.getElementById('sl-ring-pct');
        const elTot = document.getElementById('sl-tani-total-lbl');
        const elLR = document.getElementById('sl-leg-ready');
        const elLRg = document.getElementById('sl-leg-rangai');
        const elLS = document.getElementById('sl-leg-sancha');
        if (elPct) elPct.textContent = pct + '%';
        if (elTot) elTot.textContent = totalC + ' Parchi';
        if (elLR) elLR.textContent = String(readyC);
        if (elLRg) elLRg.textContent = String(rangaiC);
        if (elLS) elLS.textContent = String(sanchaC);

        const karTxt = document.getElementById('btn-total-kariger')?.textContent || '';
        const karCount = Math.max(0, Math.round(slParseNum(karTxt)));
        const karCountEl = document.getElementById('sl-kariger-count');
        if (karCountEl) karCountEl.textContent = String(karCount);

        const kSel = document.getElementById('app-karkhana-select');
        const karUnitEl = document.getElementById('sl-kariger-unit');
        if (kSel && karUnitEl && kSel.selectedIndex >= 0) {
            karUnitEl.textContent = kSel.options[kSel.selectedIndex].textContent.replace(/^[\s🌐🏢🏭]+/, '').trim() || 'Sabhi Karkhane';
        }

        const payTxt = document.getElementById('btn-total-payment')?.textContent || '';
        const diyaM = payTxt.match(/Diya:\s*₹?\s*([-+]?\d+(?:,\d+)*(?:\.\d+)?)/i);
        const bakiM = payTxt.match(/Baki:\s*₹?\s*([-+]?\d+(?:,\d+)*(?:\.\d+)?)/i);
        const diyaVal = diyaM ? (parseFloat(diyaM[1].replace(/,/g, '')) || 0) : 0;
        const bakiVal = bakiM ? (parseFloat(bakiM[1].replace(/,/g, '')) || 0) : 0;
        const kulDena = diyaVal + Math.max(0, bakiVal);
        const payPct = kulDena > 0 ? Math.max(0, Math.min(100, Math.round((diyaVal / kulDena) * 100))) : 0;

        const fmtInr = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
        const elPayHero = document.getElementById('sl-pay-baki-hero');
        const elPayTot = document.getElementById('sl-pay-total');
        const elPayPaid = document.getElementById('sl-pay-paid');
        const elPayBaki = document.getElementById('sl-pay-baki');
        const elPayPill = document.getElementById('sl-pay-pct-pill');
        const elPayFill = document.getElementById('sl-pay-bar-fill');
        if (elPayHero) elPayHero.textContent = fmtInr(bakiVal);
        if (elPayTot) elPayTot.textContent = fmtInr(kulDena);
        if (elPayPaid) elPayPaid.textContent = fmtInr(diyaVal);
        if (elPayBaki) elPayBaki.textContent = fmtInr(bakiVal);
        if (elPayPill) elPayPill.textContent = payPct + '% Paid';
        if (elPayFill) elPayFill.style.width = payPct + '%';
    };

    const slInitBadgeObserver = () => {
        const watchIds = [
            'btn-total-bana', 'btn-total-zari', 'btn-total-sancha', 'btn-total-saree',
            'btn-total-tani-orders', 'btn-total-kariger', 'btn-total-payment'
        ];
        const obs = new MutationObserver(() => window.slSyncDashboardCharts());
        watchIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) obs.observe(el, { childList: true, characterData: true, subtree: true });
        });
        window.slSyncDashboardCharts();
    };

    /* ========================================================================
       3. TALLY STOCK SUMMARY HUB (BANA / ZARI / SANCHA / SAREE DRILL-DOWN)
    ======================================================================== */
    let ssActiveIdx = 0;

    const ensureStockSummaryStyles = () => {
        const old = document.getElementById('ss-tally-styles');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'ss-tally-styles';
        style.textContent = `
            #stock-summary-section {
                padding: 0 !important;
                overflow: hidden;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #stock-summary-section .ss-topbar {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            #stock-summary-section .ss-topbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
            #stock-summary-section .ss-topbar h2 { margin: 0; font-size: 17px; font-weight: 800; color: #1f2937; }
            #stock-summary-section .ss-godown-pill {
                background: #ffffff;
                border: 1px solid #d9b86c;
                color: #92400e;
                padding: 3px 10px;
                border-radius: 999px;
                font-size: 11.5px;
                font-weight: 700;
            }
            #stock-summary-section .ss-esc-btn {
                background: #ffffff;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                padding: 6px 13px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.12s ease;
            }
            #stock-summary-section .ss-esc-btn:hover { border-color: #d9a425; background: #fef9ea; color: #1f2937; }
            #stock-summary-section .ss-wrap { padding: 16px 20px; background: #ffffff; }
            #stock-summary-section .ss-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                overflow: hidden;
                background: #ffffff;
            }
            #stock-summary-section .ss-table th {
                background: #fdf6e2;
                color: #1f2937;
                font-size: 12px;
                font-weight: 800;
                padding: 10px 14px;
                text-align: left;
                border-bottom: 1.5px solid #e5d5a7;
            }
            #stock-summary-section .ss-row { cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.1s ease; }
            #stock-summary-section .ss-row:hover { background: #fef9ea; }
            #stock-summary-section .ss-row.active { background: #f2b71d !important; color: #1f2937; }
            #stock-summary-section .ss-row td { padding: 12px 14px; font-size: 13.5px; color: #1f2937; }
            #stock-summary-section .ss-row.active td { font-weight: 700; }
            #stock-summary-section .ss-sub-txt { color: #6b7280; display: block; font-size: 11.5px; font-weight: 500; margin-top: 2px; }
            #stock-summary-section .ss-row.active .ss-sub-txt { color: #374151; }
            #stock-summary-section .ss-key-badge {
                display: inline-block; min-width: 24px; text-align: center; padding: 2px 7px; border-radius: 4px;
                font-size: 11.5px; font-weight: 800; background: #fdf6e2; border: 1px solid #d9b86c; color: #92400e;
            }
            #stock-summary-section .ss-row.active .ss-key-badge { background: #ffffff; color: #1f2937; border-color: #b47d00; }
            #stock-summary-section .ss-val-cell { font-weight: 800; color: #b47d00; text-align: right; font-variant-numeric: tabular-nums; }
            #stock-summary-section .ss-row.active .ss-val-cell { color: #1f2937; }
            #stock-summary-section .ss-status-strip {
                background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 10px 20px;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
                flex-wrap: wrap; font-size: 12px; color: #6b7280; font-weight: 600;
            }
            #stock-summary-section .ss-toast { color: #92400e; font-weight: 700; }
            @media (max-width: 768px) {
                #stock-summary-section { overflow: visible !important; }
                #stock-summary-section .ss-topbar { padding: 10px 12px; }
                #stock-summary-section .ss-wrap { padding: 10px 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                #stock-summary-section .ss-table { min-width: 520px; }
                #stock-summary-section .ss-status-strip { display: none; }
            }
        `;
        document.head.appendChild(style);
    };

    const ensureStockSummaryDOM = () => {
        ensureStockSummaryStyles();
        const sec = document.getElementById('stock-summary-section');
        if (!sec || sec.dataset.ssInitialized === '1') return;

        sec.innerHTML = `
            <div class="ss-topbar">
                <div class="ss-topbar-left">
                    <h2>Stock Summary</h2>
                    <span class="ss-godown-pill" id="ss-godown-badge">Sabhi Karkhane</span>
                </div>
                <button type="button" class="ss-esc-btn" onclick="backToDashboard()">← [Esc] Back</button>
            </div>
            <div class="ss-wrap">
                <table class="ss-table">
                    <thead>
                        <tr>
                            <th style="width:55px;">#</th>
                            <th>Stock Group (Particulars)</th>
                            <th style="width:100px; text-align:center;">Key</th>
                            <th style="text-align:right;">Available Stock (Closing)</th>
                            <th style="width:110px; text-align:right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="ss-row active" data-ss-idx="0" onclick="ssOpenStockGroup(0)">
                            <td>1</td>
                            <td><strong>Bana Stock</strong><small class="ss-sub-txt">Raw Bana Yarn &amp; Kariger Issue Register</small></td>
                            <td style="text-align:center;"><span class="ss-key-badge">B</span></td>
                            <td class="ss-val-cell" id="ss-val-bana">Bacha: 0.00 Kg</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                        <tr class="ss-row" data-ss-idx="1" onclick="ssOpenStockGroup(1)">
                            <td>2</td>
                            <td><strong>Zari Stock</strong><small class="ss-sub-txt">Zari &amp; Metallic Thread Register</small></td>
                            <td style="text-align:center;"><span class="ss-key-badge">Z</span></td>
                            <td class="ss-val-cell" id="ss-val-zari">Bacha: 0.00 Kg</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                        <tr class="ss-row" data-ss-idx="2" onclick="ssOpenStockGroup(2)">
                            <td>3</td>
                            <td><strong>Sancha (Tani &amp; Chukka)</strong><small class="ss-sub-txt">Tani &amp; Chukka Warp Stock Register</small></td>
                            <td style="text-align:center;"><span class="ss-key-badge">N</span></td>
                            <td class="ss-val-cell" id="ss-val-sancha">Tani: 0.0 Kg · Chukka: 0.0 Kg</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                        <tr class="ss-row" data-ss-idx="3" onclick="ssOpenStockGroup(3)">
                            <td>4</td>
                            <td><strong>Saree Stock</strong><small class="ss-sub-txt">Fresh, Cutting, Embroidery, Finished &amp; Lott</small></td>
                            <td style="text-align:center;"><span class="ss-key-badge">E</span></td>
                            <td class="ss-val-cell" id="ss-val-saree">Stock: 0 Pcs</td>
                            <td style="text-align:right; font-weight:700; font-size:12px;">Open →</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="ss-status-strip">
                <span class="ss-toast">[↑ ↓] Group Chunein · [Enter] ya [B / Z / N / E] se Stock Kholein · [Esc] Back</span>
                <span>4 Stock Groups</span>
            </div>
        `;
        sec.dataset.ssInitialized = '1';
    };

    const ssHighlightRow = (idx) => {
        const rows = Array.from(document.querySelectorAll('#stock-summary-section .ss-row'));
        if (!rows.length) return;
        ssActiveIdx = ((idx % rows.length) + rows.length) % rows.length;
        rows.forEach((r, i) => r.classList.toggle('active', i === ssActiveIdx));
    };

    window.ssOpenStockGroup = function (idx) {
        ssHighlightRow(idx);
        window.__slReturnToStockSummary = true;
        const sec = document.getElementById('stock-summary-section');
        if (sec) sec.style.display = 'none';

        setTimeout(() => {
            if (idx === 0 && typeof window.openBanaModule === 'function') window.openBanaModule();
            else if (idx === 1 && typeof window.openZariModule === 'function') window.openZariModule();
            else if (idx === 2 && typeof window.openSanchaModule === 'function') window.openSanchaModule();
            else if (idx === 3 && typeof window.openSareeModule === 'function') window.openSareeModule();
        }, 0);
    };

    window.openStockSummaryModule = function () {
        ensureStockSummaryDOM();
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('stock-summary-section');
        if (sec) sec.style.display = 'block';

        const kSel = document.getElementById('app-karkhana-select');
        const badgeEl = document.getElementById('ss-godown-badge');
        if (kSel && badgeEl && kSel.selectedIndex >= 0) {
            badgeEl.textContent = kSel.options[kSel.selectedIndex].textContent.replace(/^[\s🌐🏢🏭]+/, '').trim() || 'Sabhi Karkhane';
        }

        ssHighlightRow(ssActiveIdx);
        window.slSyncDashboardCharts();
    };

    /* ========================================================================
       4. DASHBOARD & STOCK SUMMARY KEYBOARD SHORTCUTS
    ======================================================================== */
    document.addEventListener('keydown', (e) => {
        const desk = document.getElementById('desktop-screen');
        if (!desk || desk.style.display === 'none') return;

        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display && m.style.display !== 'none');
        if (anyModalOpen) return;

        // Inside Stock Summary Hub screen
        const ssSec = document.getElementById('stock-summary-section');
        if (ssSec && ssSec.style.display !== 'none') {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.backToDashboard();
                return;
            }
            if (e.key === 'ArrowDown') { e.preventDefault(); ssHighlightRow(ssActiveIdx + 1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); ssHighlightRow(ssActiveIdx - 1); return; }
            if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(ssActiveIdx); return; }
            if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                if (k === 'b') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(0); return; }
                if (k === 'z') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(1); return; }
                if (k === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(2); return; }
                if (k === 'e') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(3); return; }
            }
            return;
        }

        // Dashboard Gateway Arrow + Letter Shortcuts
        const dash = document.getElementById('dashboard-view');
        if (!dash || dash.style.display === 'none') return;

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        const items = Array.from(document.querySelectorAll('#dashboard-view .gw-item'));
        if (!items.length) return;
        let idx = items.findIndex((el) => el.classList.contains('active'));
        if (idx < 0) idx = 0;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[idx].classList.remove('active');
            items[(idx + 1) % items.length].classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[idx].classList.remove('active');
            items[(idx - 1 + items.length) % items.length].classList.add('active');
        } else if (e.key === 'Enter' && (tag !== 'BUTTON' || document.activeElement.classList.contains('gw-item'))) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const targetItem = document.activeElement?.classList.contains('gw-item') ? document.activeElement : items[idx];
            setTimeout(() => targetItem?.click(), 0);
        } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
            const k = e.key.toLowerCase();
            const targetBtn = items.find((el) => el.dataset.gwKey === k);
            if (targetBtn) {
                e.preventDefault();
                e.stopImmediatePropagation();
                setTimeout(() => targetBtn.click(), 0);
                return;
            }
            if (k === 'b' && typeof window.openBanaModule === 'function') { e.preventDefault(); e.stopImmediatePropagation(); window.__slReturnToStockSummary = false; setTimeout(() => window.openBanaModule(), 0); }
            else if (k === 'z' && typeof window.openZariModule === 'function') { e.preventDefault(); e.stopImmediatePropagation(); window.__slReturnToStockSummary = false; setTimeout(() => window.openZariModule(), 0); }
            else if (k === 'n' && typeof window.openSanchaModule === 'function') { e.preventDefault(); e.stopImmediatePropagation(); window.__slReturnToStockSummary = false; setTimeout(() => window.openSanchaModule(), 0); }
            else if (k === 'e' && typeof window.openSareeModule === 'function') { e.preventDefault(); e.stopImmediatePropagation(); window.__slReturnToStockSummary = false; setTimeout(() => window.openSareeModule(), 0); }
        }
    });

    /* ========================================================================
       5. NAVBAR KARKHANA DROPDOWN & GLOBAL MODULE NAVIGATION
    ======================================================================== */
    window.populateNavbarKarkhanaDropdown = function () {
        const sel = document.getElementById('app-karkhana-select');
        if (!sel) return;
        sel.innerHTML = '';

        const list = (typeof window.getKarkhanasSafe === 'function') ? window.getKarkhanasSafe() : [];
        const activeKid = (typeof window.getActiveKarkhanaId === 'function') ? window.getActiveKarkhanaId() : 'all';

        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = '🌐 Sabhi Karkhane';
        if (activeKid === 'all') optAll.selected = true;
        sel.appendChild(optAll);

        list.forEach((k) => {
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.textContent = (k.id === 'k_main' || k.isDefault ? '🏢 ' : '🏭 ') + k.name;
            if (String(k.id) === String(activeKid)) opt.selected = true;
            sel.appendChild(opt);
        });
    };

    window.handleNavbarKarkhanaChange = function (val) {
        if (typeof window.setActiveKarkhanaId === 'function') {
            window.setActiveKarkhanaId(val, () => {
                if (typeof window.switchDashboardKarkhanaTab === 'function') window.switchDashboardKarkhanaTab(val);
                if (typeof window.triggerActiveSectionRefresh === 'function') window.triggerActiveSectionRefresh();
                window.slSyncDashboardCharts();
            });
        }
    };

    window.openDayBookModule = function () {
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const dbSec = document.getElementById('daybook-section');
        if (dbSec) dbSec.style.display = 'block';
        if (typeof window.renderDashboardDayBook === 'function') window.renderDashboardDayBook();
    };

    window.openTaniOrderModule = function () {
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const taniSec = document.getElementById('tani-order-section');
        if (taniSec) taniSec.style.display = 'block';
        if (window.TaniOrderEngine && typeof window.TaniOrderEngine.initTaniOrderView === 'function') {
            window.TaniOrderEngine.initTaniOrderView();
        }
    };

    window.backToDashboard = function () {
        if (typeof window.tmCloseSheetOverlay === 'function') window.tmCloseSheetOverlay(false);
        window.__slReturnToStockSummary = false;
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = window.innerWidth <= 860 ? 'block' : 'flex';
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        window.slSyncDashboardCharts();
    };

    /* ========================================================================
       6. PWA SERVICE WORKER & APP BOOTSTRAP
    ======================================================================== */
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js?v=3.5')
                .then(() => console.log('✅ [PWA] Service Worker Active v3.5.'))
                .catch((err) => console.warn('⚠️ [PWA] SW Registration failed:', err));
        });
    }

    const initAppShell = () => {
        if (typeof window.initCentralMasterDOM === 'function') window.initCentralMasterDOM();
        ensureStockSummaryDOM();
        window.populateNavbarKarkhanaDropdown();
        slInitBadgeObserver();
        if (typeof window.checkAutoLogin === 'function') window.checkAutoLogin();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAppShell);
    } else {
        initAppShell();
    }
})();
