/* ============================================================================
   SIMPLICITY ERP - TALLYPRIME DASHBOARD, GATEWAY, STOCK SUMMARY & CREATE/ALTER
   File: core/tally-master.js • Developed by Farhan Jawed
   Note: Uses kariger_list, kariger_sheets_<id> & jobwork_workers (100% Supabase-safe)
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

        // Card 1: Live Stock 5-Bars
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

        // Card 2: Tani Order Ring
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

        // Card 3: Kariger Master
        const karTxt = document.getElementById('btn-total-kariger')?.textContent || '';
        const karCount = Math.max(0, Math.round(slParseNum(karTxt)));
        const karCountEl = document.getElementById('sl-kariger-count');
        if (karCountEl) karCountEl.textContent = String(karCount);

        const kSel = document.getElementById('app-karkhana-select');
        const karUnitEl = document.getElementById('sl-kariger-unit');
        if (kSel && karUnitEl && kSel.selectedIndex >= 0) {
            karUnitEl.textContent = kSel.options[kSel.selectedIndex].textContent.replace(/^[\s🌐🏢🏭]+/, '').trim() || 'Sabhi Karkhane';
        }

        // Card 4: Payments (Kul Dena, Diya, Baki)
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
            #stock-summary-section .ss-topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            #stock-summary-section .ss-topbar h2 {
                margin: 0;
                font-size: 17px;
                font-weight: 800;
                color: #1f2937;
            }
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
            #stock-summary-section .ss-esc-btn:hover {
                border-color: #d9a425;
                background: #fef9ea;
                color: #1f2937;
            }
            #stock-summary-section .ss-wrap {
                padding: 16px 20px;
                background: #ffffff;
            }
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
            #stock-summary-section .ss-row {
                cursor: pointer;
                border-bottom: 1px solid #f3f4f6;
                transition: background 0.1s ease;
            }
            #stock-summary-section .ss-row:hover { background: #fef9ea; }
            #stock-summary-section .ss-row.active {
                background: #f2b71d !important;
                color: #1f2937;
            }
            #stock-summary-section .ss-row td {
                padding: 12px 14px;
                font-size: 13.5px;
                color: #1f2937;
            }
            #stock-summary-section .ss-row.active td { font-weight: 700; }
            #stock-summary-section .ss-sub-txt {
                color: #6b7280;
                display: block;
                font-size: 11.5px;
                font-weight: 500;
                margin-top: 2px;
            }
            #stock-summary-section .ss-row.active .ss-sub-txt { color: #374151; }
            #stock-summary-section .ss-key-badge {
                display: inline-block;
                min-width: 24px;
                text-align: center;
                padding: 2px 7px;
                border-radius: 4px;
                font-size: 11.5px;
                font-weight: 800;
                background: #fdf6e2;
                border: 1px solid #d9b86c;
                color: #92400e;
            }
            #stock-summary-section .ss-row.active .ss-key-badge {
                background: #ffffff;
                color: #1f2937;
                border-color: #b47d00;
            }
            #stock-summary-section .ss-val-cell {
                font-weight: 800;
                color: #b47d00;
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            #stock-summary-section .ss-row.active .ss-val-cell { color: #1f2937; }
            #stock-summary-section .ss-status-strip {
                background: #fdf6e2;
                border-top: 1px solid #e5d5a7;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                font-size: 12px;
                color: #6b7280;
                font-weight: 600;
            }
            #stock-summary-section .ss-toast {
                color: #92400e;
                font-weight: 700;
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
       4. TALLY MASTER CREATE & ALTER MODULE (FORWARD SUB-FORM + SIDE LIST)
    ======================================================================== */
    let tmMode = 'create'; // 'create' | 'alter-list' | 'alter-edit'
    let tmSelectedGroup = 'kariger';
    let tmAlterFilter = 'all';
    let tmAlterActiveIdx = 0;

    // Kariger Master Sheet Overlay State
    let tmSheetModalOpen = false;
    let tmActiveSideField = null; // 'tm-s-karkhana' | 'tm-bana-item' | 'tm-zari-item' | 'tm-tani-item' | 'tm-chukka-item'
    let tmSideItems = [];
    let tmSideActiveIdx = -1;

    const tmEscHtml = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));

    const tmNumOrFallback = (val, fallback = 0) => {
        if (val === undefined || val === null || String(val).trim() === '') return fallback;
        const n = parseFloat(String(val).replace(/,/g, '').trim());
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const tmGetToday = () => (typeof window.getTodayDate === 'function')
        ? window.getTodayDate()
        : new Date().toISOString().split('T')[0];

    const tmToIsoDate = (d) => {
        if (!d) return new Date().toISOString().split('T')[0];
        const s = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parts = s.split(/[-/]/);
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return new Date().toISOString().split('T')[0];
    };

    const tmGetKarigers = () => {
        if (typeof window.sanitizeKarigerList === 'function') return window.sanitizeKarigerList();
        const raw = (typeof window.getStore === 'function') ? window.getStore('kariger_list') : [];
        return Array.isArray(raw) ? raw.filter((k) => k && k.name) : [];
    };

    const tmGetJobWorkers = () => {
        if (typeof window.getJobWorkers === 'function') return window.getJobWorkers();
        const raw = (typeof window.getStore === 'function') ? window.getStore('jobwork_workers') : [];
        return Array.isArray(raw) ? raw.filter((w) => w && w.name) : [];
    };

    const tmGetSheetsSafe = (karId) => {
        if (!karId) return [];
        if (typeof window.getKarigerSheets === 'function') return window.getKarigerSheets(karId);
        const raw = (typeof window.getStore === 'function') ? window.getStore(`kariger_sheets_${String(karId).trim()}`) : [];
        return Array.isArray(raw) ? raw : [];
    };

    const tmSaveSheetsSafe = (karId, sheets) => {
        if (!karId) return;
        if (typeof window.saveKarigerSheets === 'function') {
            window.saveKarigerSheets(karId, sheets);
        } else if (typeof window.setStore === 'function') {
            window.setStore(`kariger_sheets_${String(karId).trim()}`, Array.isArray(sheets) ? sheets : []);
        }
    };

    const ensureTallyMasterStyles = () => {
        const old = document.getElementById('tm-kariger-sheet-styles');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'tm-kariger-sheet-styles';
        style.textContent = `
            #tally-master-section input[type="number"]::-webkit-outer-spin-button,
            #tally-master-section input[type="number"]::-webkit-inner-spin-button,
            #tm-kar-sheet-overlay input[type="number"]::-webkit-outer-spin-button,
            #tm-kar-sheet-overlay input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none !important;
                margin: 0 !important;
            }
            #tally-master-section input[type="number"],
            #tm-kar-sheet-overlay input[type="number"] {
                -moz-appearance: textfield !important;
            }

            /* Summary Strip inside Create/Alter when Kariger Sheet is configured */
            .tm-kar-summary-card {
                background: #fdf6e2;
                border: 1.5px solid #d9b86c;
                border-radius: 6px;
                padding: 9px 11px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                margin-bottom: 6px;
            }
            .tm-kar-summary-card small {
                display: block;
                font-size: 11px;
                color: #92400e;
                font-weight: 700;
                margin-top: 2px;
            }

            /* Forward Tally Sub-Screen Overlay (Hides background Create screen) */
            #tm-kar-sheet-overlay {
                position: fixed;
                inset: 0;
                z-index: 99990;
                background: rgba(17, 24, 39, 0.72);
                backdrop-filter: blur(3px);
                display: none;
                align-items: center;
                justify-content: center;
                padding: 12px;
                box-sizing: border-box;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            #tm-kar-sheet-overlay * {
                box-sizing: border-box;
            }
            .tm-so-shell {
                width: 100%;
                max-width: 1060px;
                background: #ffffff;
                border: 2px solid #d9b86c;
                border-radius: 8px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-height: 96vh;
            }
            .tm-so-topbar {
                background: #fdf6e2;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 10px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .tm-so-topbar-left {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .tm-so-topbar h3 {
                margin: 0;
                font-size: 15.5px;
                font-weight: 800;
                color: #1f2937;
            }
            .tm-so-pill {
                background: #ffffff;
                border: 1px solid #d9b86c;
                color: #92400e;
                padding: 2px 9px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
            }
            .tm-so-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 290px;
                flex: 1;
                min-height: 0;
            }
            .tm-so-left {
                padding: 12px 16px;
                background: #ffffff;
                border-right: 1.5px solid #e5d5a7;
                overflow-y: auto;
            }
            .tm-so-right {
                padding: 12px;
                background: #fdfcf7;
                display: flex;
                flex-direction: column;
                gap: 10px;
                overflow-y: auto;
            }
            .tm-so-sec-lbl {
                font-size: 10.5px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.45px;
                color: #92400e;
                margin: 9px 0 5px 0;
                padding-top: 6px;
                border-top: 1px dashed #e5d5a7;
            }
            .tm-so-sec-lbl.first {
                margin-top: 0;
                padding-top: 0;
                border-top: none;
            }
            .tm-so-row-4 {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 8px;
                margin-bottom: 6px;
            }
            .tm-so-row-2 {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-bottom: 6px;
            }
            .tm-so-sancha-box {
                background: #fdfcf7;
                border: 1px solid #e5d5a7;
                border-radius: 6px;
                padding: 7px 9px;
                margin-bottom: 6px;
            }
            .tm-so-f {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }
            .tm-so-f label {
                font-size: 11px;
                font-weight: 700;
                color: #374151;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .tm-so-f input,
            .tm-so-colors input {
                width: 100%;
                min-width: 0;
                padding: 6px 8px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 12.5px;
                font-weight: 700;
                color: #111827;
                background: #ffffff;
                outline: none;
            }
            .tm-so-f input:focus,
            .tm-so-colors input:focus {
                border-color: #d9a425;
                background: #fffdf5;
                box-shadow: 0 0 0 2px rgba(242, 183, 29, 0.22);
            }
            .tm-so-f input.tm-side-linked {
                border-color: #d9b86c;
                background: #fffefb;
            }
            .tm-so-badge {
                font-size: 10.5px;
                font-weight: 700;
                color: #b47d00;
            }
            .tm-so-colors {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 6px;
            }

            /* Right Side List Box (Exact Tally List of Groups style) */
            .tm-side-box {
                background: #ffffff;
                border: 1.5px solid #d9b86c;
                border-radius: 6px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .tm-side-head {
                background: #fdf6e2;
                color: #1f2937;
                border-bottom: 1.5px solid #e5d5a7;
                padding: 8px 11px;
                font-size: 12.5px;
                font-weight: 800;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .tm-side-head small {
                font-size: 10.5px;
                color: #92400e;
                font-weight: 700;
            }
            .tm-side-list {
                max-height: 340px;
                overflow-y: auto;
            }
            .tm-side-opt {
                padding: 8px 11px;
                font-size: 12.5px;
                font-weight: 700;
                color: #1f2937;
                border-bottom: 1px solid #f3f4f6;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            .tm-side-opt:hover {
                background: #fef9ea;
            }
            .tm-side-opt.selected {
                background: #f2b71d;
                color: #1f2937;
            }
            .tm-side-opt small {
                font-size: 11px;
                font-weight: 800;
                color: #92400e;
                white-space: nowrap;
            }
            .tm-side-opt.selected small {
                color: #1f2937;
            }
            .tm-so-footer {
                background: #fdf6e2;
                border-top: 1px solid #e5d5a7;
                padding: 8px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                font-size: 11.5px;
                color: #92400e;
                font-weight: 700;
            }
            @media (max-width: 860px) {
                .tm-so-grid {
                    grid-template-columns: 1fr;
                }
                .tm-so-left {
                    border-right: none;
                    border-bottom: 1.5px solid #e5d5a7;
                }
                .tm-so-row-4,
                .tm-so-colors {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .tm-so-row-2 {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    };

    const bindTallyManualNumberGuard = () => {
        if (window.__tmManualNumGuardBound) return;
        window.__tmManualNumGuardBound = true;

        document.addEventListener('wheel', (e) => {
            const target = e.target;
            if (target && target.tagName === 'INPUT' && target.closest('#tally-master-section, #tm-kar-sheet-overlay')) {
                if (target.type === 'number' || target.inputMode === 'decimal') {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            const target = e.target;
            if (target && target.tagName === 'INPUT' && target.type === 'number') {
                if (target.closest('#tally-master-section, #tm-kar-sheet-overlay')) {
                    e.preventDefault();
                }
            }
        }, true);
    };

    const tmGetKarkhanasList = () => {
        let list = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : ((typeof window.getStore === 'function') ? window.getStore('karkhana_list') : []);
        if (!Array.isArray(list) || !list.length) {
            list = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }
        return list;
    };

    const tmGetSelectedKarkhanaId = () => {
        return document.getElementById('tm-karkhana-id')?.value || 'k_main';
    };

    const tmSetSelectedKarkhana = (kId, kName = null) => {
        const list = tmGetKarkhanasList();
        const found = list.find((k) => String(k.id) === String(kId)) || list[0];
        const finalId = found ? found.id : 'k_main';
        const finalName = kName || (found ? found.name : 'Main Godown');

        const hidEl = document.getElementById('tm-karkhana-id');
        const dispEl = document.getElementById('tm-s-karkhana');
        if (hidEl) hidEl.value = finalId;
        if (dispEl) dispEl.value = finalName;
        tmUpdateLiveStockBadges();
    };

    const tmGetSideOptionsForField = (fieldId, filterText = '') => {
        const kGodown = tmGetSelectedKarkhanaId();
        const q = String(filterText || '').trim().toLowerCase();
        const items = [];

        if (fieldId === 'tm-s-karkhana') {
            tmGetKarkhanasList().forEach((k) => {
                const nm = String(k.name || '').trim();
                if (!q || nm.toLowerCase().includes(q)) {
                    items.push({ value: nm, id: k.id, meta: k.isDefault || k.id === 'k_main' ? 'Default' : 'Unit' });
                }
            });
            return items;
        }

        const seen = new Set();
        if (fieldId === 'tm-bana-item') {
            const raw = (typeof window.getStore === 'function') ? window.getStore('bana_stock') : [];
            (Array.isArray(raw) ? raw : []).forEach((b) => {
                const nm = b?.name ? String(b.name).trim() : '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getBanaItemStats === 'function')
                        ? tmNumOrFallback(window.getBanaItemStats(nm, kGodown).bacha, 0)
                        : tmNumOrFallback(b.bacha, 0);
                    if (!q || nm.toLowerCase().includes(q)) {
                        items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                    }
                }
            });
        } else if (fieldId === 'tm-zari-item') {
            const raw = (typeof window.getStore === 'function') ? window.getStore('zari_stock') : [];
            (Array.isArray(raw) ? raw : []).forEach((z) => {
                const nm = z?.name ? String(z.name).trim() : '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getZariItemStats === 'function')
                        ? tmNumOrFallback(window.getZariItemStats(nm, kGodown).bacha, 0)
                        : tmNumOrFallback(z.bacha, 0);
                    if (!q || nm.toLowerCase().includes(q)) {
                        items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                    }
                }
            });
        } else if (fieldId === 'tm-tani-item' || fieldId === 'tm-chukka-item') {
            const targetCat = (fieldId === 'tm-chukka-item') ? 'chukka' : 'tani';
            const raw = (typeof window.getStore === 'function') ? window.getStore('sancha_items') : [];
            (Array.isArray(raw) ? raw : [])
                .filter((s) => s && (s.category || 'tani').toLowerCase() === targetCat)
                .forEach((s) => {
                    const nm = s?.name ? String(s.name).trim() : '';
                    if (nm && !seen.has(nm.toLowerCase())) {
                        seen.add(nm.toLowerCase());
                        const bacha = tmNumOrFallback(s.bacha !== undefined ? s.bacha : s.aaya, 0);
                        if (!q || nm.toLowerCase().includes(q)) {
                            items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                        }
                    }
                });
        }

        return items;
    };

    const tmRenderSideList = (fieldId = null, autoHighlight = false) => {
        const titleEl = document.getElementById('tm-side-list-title');
        const subEl = document.getElementById('tm-side-list-sub');
        const listEl = document.getElementById('tm-side-list-body');
        if (!titleEl || !listEl) return;

        tmActiveSideField = fieldId;

        const titleMap = {
            'tm-s-karkhana': 'List of Karkhanas',
            'tm-bana-item': 'List of Bana Items',
            'tm-zari-item': 'List of Zari Items',
            'tm-tani-item': 'List of Tani Items',
            'tm-chukka-item': 'List of Chukka Items'
        };

        if (!fieldId || !titleMap[fieldId]) {
            tmSideItems = [];
            tmSideActiveIdx = -1;
            titleEl.textContent = 'Sheet Help & Controls';
            if (subEl) subEl.textContent = 'Tally Mode';
            listEl.innerHTML = `
                <div style="padding:11px; font-size:12px; color:#4b5563; line-height:1.6;">
                    <div><strong>• Enter / ↓ :</strong> Agle box par jayein</div>
                    <div><strong>• ↑ / Shift+Enter :</strong> Pichhle box par</div>
                    <div><strong>• Item Boxes :</strong> Jab Bana, Zari, Tani ya Chukka box par jayenge toh yahan side mein unki poori list khud aa jayegi</div>
                    <div><strong>• Ctrl + Enter :</strong> Seedha Sheet Confirm karein</div>
                    <div><strong>• Esc :</strong> Wapas pichhli screen par</div>
                </div>
            `;
            return;
        }

        const inp = document.getElementById(fieldId);
        const query = (fieldId === 'tm-s-karkhana') ? '' : (inp ? inp.value : '');
        tmSideItems = tmGetSideOptionsForField(fieldId, query);

        titleEl.textContent = titleMap[fieldId];
        if (subEl) subEl.textContent = `${tmSideItems.length} Available`;

        if (!tmSideItems.length) {
            tmSideActiveIdx = -1;
            listEl.innerHTML = `<div style="padding:16px 11px; text-align:center; color:#9ca3af; font-size:12px;">Koi item nahi mila.<br><small>Naya naam manual type karke Enter dabaye.</small></div>`;
            return;
        }

        if (fieldId === 'tm-s-karkhana') {
            const curKid = tmGetSelectedKarkhanaId();
            const foundIdx = tmSideItems.findIndex((it) => String(it.id) === String(curKid));
            tmSideActiveIdx = foundIdx >= 0 ? foundIdx : 0;
        } else if (autoHighlight && query.trim()) {
            tmSideActiveIdx = 0;
        } else {
            tmSideActiveIdx = -1;
        }

        listEl.innerHTML = tmSideItems.map((it, idx) => `
            <div class="tm-side-opt${idx === tmSideActiveIdx ? ' selected' : ''}" data-sidx="${idx}" onmousedown="event.preventDefault(); tmPickSideItem(${idx});">
                <span>${tmEscHtml(it.value)}</span>
                <small>${tmEscHtml(it.meta)}</small>
            </div>
        `).join('');
    };

    window.tmPickSideItem = function (idx) {
        if (!tmActiveSideField || !tmSideItems[idx]) return;
        const chosen = tmSideItems[idx];
        const inp = document.getElementById(tmActiveSideField);
        if (inp) inp.value = chosen.value;

        if (tmActiveSideField === 'tm-s-karkhana' && chosen.id) {
            tmSetSelectedKarkhana(chosen.id, chosen.value);
        } else {
            tmUpdateLiveStockBadges();
        }

        const nextMap = {
            'tm-s-karkhana': 'tm-s-saree',
            'tm-bana-item': 'tm-zari-item',
            'tm-zari-item': 'tm-tani-item',
            'tm-tani-item': 'tm-tani-sancha',
            'tm-chukka-item': 'tm-chukka-sancha'
        };
        const nxtId = nextMap[tmActiveSideField];
        tmSideActiveIdx = -1;
        if (nxtId) {
            const nxt = document.getElementById(nxtId);
            if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
        }
    };

    const tmUpdateLiveStockBadges = () => {
        const kGodown = tmGetSelectedKarkhanaId();
        const bName = String(document.getElementById('tm-bana-item')?.value || '').trim();
        const zName = String(document.getElementById('tm-zari-item')?.value || '').trim();
        const tName = String(document.getElementById('tm-tani-item')?.value || '').trim().toLowerCase();
        const cName = String(document.getElementById('tm-chukka-item')?.value || '').trim().toLowerCase();

        let bBacha = 0;
        if (bName && typeof window.getBanaItemStats === 'function') {
            bBacha = tmNumOrFallback(window.getBanaItemStats(bName, kGodown).bacha, 0);
        } else if (bName && typeof window.getStore === 'function') {
            const bList = window.getStore('bana_stock');
            const bIt = (Array.isArray(bList) ? bList : []).find((x) =>
                x && x.name && x.name.trim().toLowerCase() === bName.toLowerCase() &&
                ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown))
            );
            if (bIt) bBacha = tmNumOrFallback(bIt.bacha, 0);
        }

        let zBacha = 0;
        if (zName && typeof window.getZariItemStats === 'function') {
            zBacha = tmNumOrFallback(window.getZariItemStats(zName, kGodown).bacha, 0);
        } else if (zName && typeof window.getStore === 'function') {
            const zList = window.getStore('zari_stock');
            const zIt = (Array.isArray(zList) ? zList : []).find((x) =>
                x && x.name && x.name.trim().toLowerCase() === zName.toLowerCase() &&
                ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown))
            );
            if (zIt) zBacha = tmNumOrFallback(zIt.bacha, 0);
        }

        const sRaw = (typeof window.getStore === 'function') ? window.getStore('sancha_items') : [];
        const sList = Array.isArray(sRaw) ? sRaw : [];

        const tItem = sList.find((x) => {
            const matchK = (!x?.karkhanaId && kGodown === 'k_main') || String(x?.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === tName && (x.category || 'tani').toLowerCase() === 'tani' && matchK;
        });

        const cItem = sList.find((x) => {
            const matchK = (!x?.karkhanaId && kGodown === 'k_main') || String(x?.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === cName && (x.category || '').toLowerCase() === 'chukka' && matchK;
        });

        const setB = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        setB('tm-live-bana-badge', `Bacha: ${bBacha.toFixed(2)} Kg`);
        setB('tm-live-zari-badge', `Bacha: ${zBacha.toFixed(2)} Kg`);
        setB('tm-live-tani-badge', `Bacha: ${tItem ? tmNumOrFallback(tItem.bacha !== undefined ? tItem.bacha : tItem.aaya, 0).toFixed(2) : '0.00'} Kg`);
        setB('tm-live-chukka-badge', `Bacha: ${cItem ? tmNumOrFallback(cItem.bacha !== undefined ? cItem.bacha : cItem.aaya, 0).toFixed(2) : '0.00'} Kg`);
    };

    const tmUpdateSummaryStrip = () => {
        const kName = document.getElementById('tm-s-karkhana')?.value || 'Main Godown';
        const rBana = document.getElementById('tm-rate-bana')?.value || '0.311';
        const rZari = document.getElementById('tm-rate-zari')?.value || '0.110';
        const rBani = document.getElementById('tm-rate-bani')?.value || '240';
        const bItem = document.getElementById('tm-bana-item')?.value || '-';
        const zItem = document.getElementById('tm-zari-item')?.value || '-';
        const el = document.getElementById('tm-kar-summary-txt');
        if (el) {
            el.textContent = `${kName} · Bana: ${rBana} | Zari: ${rZari} | Bani: ₹${rBani} · Items: ${bItem} / ${zItem}`;
        }
    };

    const tmRevertSanchaStock = (itemName, category, wazan, kGodown) => {
        if (!itemName || !wazan || typeof window.getStore !== 'function') return;
        const raw = window.getStore('sancha_items');
        const sList = Array.isArray(raw) ? raw : [];
        const found = sList.find((x) => {
            const matchKid = (!x?.karkhanaId && kGodown === 'k_main') || String(x?.karkhanaId) === String(kGodown);
            return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() &&
                (x.category || 'tani').toLowerCase() === category.toLowerCase() && matchKid;
        });
        if (found) {
            found.gaya = Math.max(0, tmNumOrFallback((tmNumOrFallback(found.gaya, 0) - tmNumOrFallback(wazan, 0)).toFixed(2), 0));
            found.bacha = tmNumOrFallback((tmNumOrFallback(found.aaya, 0) - found.gaya).toFixed(2), 0);
            if (typeof window.setStore === 'function') window.setStore('sancha_items', sList);
        }
    };

    const tmSyncSanchaStockForSheet = (karId, kName, kGodown, sh, oldState) => {
        if (typeof window.getStore !== 'function' || typeof window.setStore !== 'function') return;

        const oldTaniItem = oldState?.taniItem || '';
        const oldTaniWazan = tmNumOrFallback(oldState?.taniWazan, 0);
        const newTaniWazan = tmNumOrFallback(sh.taniWazan, 0);
        const taniItemChanged = oldTaniItem.toLowerCase() !== String(sh.taniItem || '').toLowerCase();

        if (newTaniWazan !== oldTaniWazan || taniItemChanged) {
            if (oldTaniItem && taniItemChanged && oldTaniWazan > 0) {
                tmRevertSanchaStock(oldTaniItem, 'tani', oldTaniWazan, kGodown);
            }
            if (sh.taniItem) {
                const sRaw = window.getStore('sancha_items');
                const sList = Array.isArray(sRaw) ? sRaw : [];
                const tFound = sList.find((x) => {
                    const matchKid = (!x?.karkhanaId && kGodown === 'k_main') || String(x?.karkhanaId) === String(kGodown);
                    return x && x.name && x.name.toLowerCase() === sh.taniItem.toLowerCase() &&
                        (x.category || 'tani').toLowerCase() === 'tani' && matchKid;
                });
                if (tFound) {
                    const diffT = (oldTaniItem && taniItemChanged) ? newTaniWazan : (newTaniWazan - oldTaniWazan);
                    tFound.gaya = Math.max(0, tmNumOrFallback((tmNumOrFallback(tFound.gaya, 0) + diffT).toFixed(2), 0));
                    tFound.bacha = tmNumOrFallback((tmNumOrFallback(tFound.aaya, 0) - tFound.gaya).toFixed(2), 0);
                    window.setStore('sancha_items', sList);
                }
            }
            const hRaw = window.getStore('sancha_history');
            let sHist = Array.isArray(hRaw) ? hRaw : [];
            const refKey = `${karId}_${sh.id}_tani`;
            sHist = sHist.filter((h) => !h || h.refId !== refKey);
            if (sh.taniItem && newTaniWazan > 0) {
                sHist.push({
                    id: `shist_${Date.now()}_t`,
                    refId: refKey,
                    date: tmToIsoDate(tmGetToday()),
                    category: 'tani',
                    name: sh.taniItem,
                    kariger: kName,
                    type: 'Kariger Issue (Tani)',
                    aaya: 0,
                    gaya: newTaniWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            window.setStore('sancha_history', sHist);
        }

        const oldChukkaItem = oldState?.chukkaItem || '';
        const oldChukkaWazan = tmNumOrFallback(oldState?.chukkaWazan, 0);
        const newChukkaWazan = tmNumOrFallback(sh.chukkaWazan, 0);
        const chukkaItemChanged = oldChukkaItem.toLowerCase() !== String(sh.chukkaItem || '').toLowerCase();

        if (newChukkaWazan !== oldChukkaWazan || chukkaItemChanged) {
            if (oldChukkaItem && chukkaItemChanged && oldChukkaWazan > 0) {
                tmRevertSanchaStock(oldChukkaItem, 'chukka', oldChukkaWazan, kGodown);
            }
            if (sh.chukkaItem) {
                const sRaw2 = window.getStore('sancha_items');
                const sList2 = Array.isArray(sRaw2) ? sRaw2 : [];
                const cFound = sList2.find((x) => {
                    const matchKid = (!x?.karkhanaId && kGodown === 'k_main') || String(x?.karkhanaId) === String(kGodown);
                    return x && x.name && x.name.toLowerCase() === sh.chukkaItem.toLowerCase() &&
                        (x.category || '').toLowerCase() === 'chukka' && matchKid;
                });
                if (cFound) {
                    const diffC = (oldChukkaItem && chukkaItemChanged) ? newChukkaWazan : (newChukkaWazan - oldChukkaWazan);
                    cFound.gaya = Math.max(0, tmNumOrFallback((tmNumOrFallback(cFound.gaya, 0) + diffC).toFixed(2), 0));
                    cFound.bacha = tmNumOrFallback((tmNumOrFallback(cFound.aaya, 0) - cFound.gaya).toFixed(2), 0);
                    window.setStore('sancha_items', sList2);
                }
            }
            const hRaw2 = window.getStore('sancha_history');
            let sHist2 = Array.isArray(hRaw2) ? hRaw2 : [];
            const refKey2 = `${karId}_${sh.id}_chukka`;
            sHist2 = sHist2.filter((h) => !h || h.refId !== refKey2);
            if (sh.chukkaItem && newChukkaWazan > 0) {
                sHist2.push({
                    id: `shist_${Date.now()}_c`,
                    refId: refKey2,
                    date: tmToIsoDate(tmGetToday()),
                    category: 'chukka',
                    name: sh.chukkaItem,
                    kariger: kName,
                    type: 'Kariger Issue (Chukka)',
                    aaya: 0,
                    gaya: newChukkaWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            window.setStore('sancha_history', sHist2);
        }
    };
    const ensureKarigerSheetOverlayDOM = () => {
        if (document.getElementById('tm-kar-sheet-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tm-kar-sheet-overlay';
        overlay.innerHTML = `
            <div class="tm-so-shell" role="dialog" aria-modal="true">
                <div class="tm-so-topbar">
                    <div class="tm-so-topbar-left">
                        <h3 id="tm-so-title">Kariger Master Sheet Setup</h3>
                        <span class="tm-so-pill" id="tm-so-kar-pill">New Kariger</span>
                        <span class="tm-so-pill" id="tm-sheet-link-badge">Auto-Save: Tani 1</span>
                    </div>
                    <button type="button" class="tm-esc-btn" onclick="tmCloseSheetOverlay(false)">← [Esc] Back</button>
                </div>

                <div class="tm-so-grid">
                    <div class="tm-so-left">
                        <input type="hidden" id="tm-karkhana-id" value="k_main">

                        <div class="tm-so-sec-lbl first">1. Karkhana &amp; Saree Design</div>
                        <div class="tm-so-row-2">
                            <div class="tm-so-f">
                                <label for="tm-s-karkhana">Karkhana (Side List se chunein) :</label>
                                <input type="text" id="tm-s-karkhana" class="tm-side-linked" readonly placeholder="Main Godown" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-s-saree">Saree Design :</label>
                                <input type="text" id="tm-s-saree" placeholder="Jaise: Banarasi Katan" autocomplete="off">
                            </div>
                        </div>

                        <div class="tm-so-sec-lbl">2. Rates &amp; Opening Balance (Manual Entry)</div>
                        <div class="tm-so-row-4">
                            <div class="tm-so-f">
                                <label for="tm-rate-bana">Bana Rate/Saree</label>
                                <input type="text" inputmode="decimal" id="tm-rate-bana" value="0.311" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-rate-zari">Zari Rate/Saree</label>
                                <input type="text" inputmode="decimal" id="tm-rate-zari" value="0.110" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-rate-bani">Bani/Saree (₹)</label>
                                <input type="text" inputmode="decimal" id="tm-rate-bani" value="240" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-pichla-bana">Pichla Bana (Kg)</label>
                                <input type="text" inputmode="decimal" id="tm-pichla-bana" value="0" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-pichla-zari">Pichla Zari (Kg)</label>
                                <input type="text" inputmode="decimal" id="tm-pichla-zari" value="0" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-pichla-bani">Pichla Bani (₹)</label>
                                <input type="text" inputmode="decimal" id="tm-pichla-bani" value="0" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-waste-bana">Bana Waste (Kg)</label>
                                <input type="text" inputmode="decimal" id="tm-waste-bana" value="0" autocomplete="off">
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-waste-zari">Zari Waste (Kg)</label>
                                <input type="text" inputmode="decimal" id="tm-waste-zari" value="0" autocomplete="off">
                            </div>
                        </div>

                        <div class="tm-so-sec-lbl">3. Raw Material Items (Right Side List se chunein)</div>
                        <div class="tm-so-row-2">
                            <div class="tm-so-f">
                                <label for="tm-bana-item">1. Bana Item :</label>
                                <input type="text" id="tm-bana-item" class="tm-side-linked" placeholder="Type karein ya Side List chunein..." autocomplete="off">
                                <small class="tm-so-badge" id="tm-live-bana-badge">Bacha: 0.00 Kg</small>
                            </div>
                            <div class="tm-so-f">
                                <label for="tm-zari-item">2. Zari Item :</label>
                                <input type="text" id="tm-zari-item" class="tm-side-linked" placeholder="Type karein ya Side List chunein..." autocomplete="off">
                                <small class="tm-so-badge" id="tm-live-zari-badge">Bacha: 0.00 Kg</small>
                            </div>
                        </div>

                        <div class="tm-so-sec-lbl">4. Sancha Selection (Tani &amp; Chukka)</div>
                        <div class="tm-so-sancha-box">
                            <div class="tm-so-row-4" style="margin-bottom:0;">
                                <div class="tm-so-f">
                                    <label for="tm-tani-item">3. Tani Item :</label>
                                    <input type="text" id="tm-tani-item" class="tm-side-linked" placeholder="Side List..." autocomplete="off">
                                    <small class="tm-so-badge" id="tm-live-tani-badge">Bacha: 0.00 Kg</small>
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-tani-sancha">Sancha Name :</label>
                                    <input type="text" id="tm-tani-sancha" placeholder="Azhar / Arman" autocomplete="off">
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-tani-wazan">Wazan (Kg) :</label>
                                    <input type="text" inputmode="decimal" id="tm-tani-wazan" placeholder="0.00" autocomplete="off">
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-tani-pcs">Tani Saree (Pcs) :</label>
                                    <input type="text" inputmode="decimal" id="tm-tani-pcs" value="72" autocomplete="off">
                                </div>
                            </div>
                        </div>

                        <div class="tm-so-sancha-box">
                            <div class="tm-so-row-4" style="margin-bottom:0;">
                                <div class="tm-so-f">
                                    <label for="tm-chukka-item">4. Chukka Item :</label>
                                    <input type="text" id="tm-chukka-item" class="tm-side-linked" placeholder="Side List..." autocomplete="off">
                                    <small class="tm-so-badge" id="tm-live-chukka-badge">Bacha: 0.00 Kg</small>
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-chukka-sancha">Sancha Name :</label>
                                    <input type="text" id="tm-chukka-sancha" placeholder="Sancha Naam..." autocomplete="off">
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-chukka-wazan">Wazan (Kg) :</label>
                                    <input type="text" inputmode="decimal" id="tm-chukka-wazan" placeholder="0.00" autocomplete="off">
                                </div>
                                <div class="tm-so-f">
                                    <label for="tm-chukka-pcs">Chukka Saree (Pcs) :</label>
                                    <input type="text" inputmode="decimal" id="tm-chukka-pcs" value="72" autocomplete="off">
                                </div>
                            </div>
                        </div>

                        <div class="tm-so-sec-lbl">5. Tani Ke 8 Colors (Optional Matching)</div>
                        <div class="tm-so-colors">
                            <input type="text" id="tm-color-1" placeholder="1. Rani" autocomplete="off">
                            <input type="text" id="tm-color-2" placeholder="2. Lal" autocomplete="off">
                            <input type="text" id="tm-color-3" placeholder="3. Mehendi" autocomplete="off">
                            <input type="text" id="tm-color-4" placeholder="4. Blue" autocomplete="off">
                            <input type="text" id="tm-color-5" placeholder="5. Peela" autocomplete="off">
                            <input type="text" id="tm-color-6" placeholder="6. Wine" autocomplete="off">
                            <input type="text" id="tm-color-7" placeholder="7. Firozi" autocomplete="off">
                            <input type="text" id="tm-color-8" placeholder="8. Mungia" autocomplete="off">
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1.5px solid #efe4c4; gap:8px;">
                            <button type="button" class="tm-esc-btn" onclick="tmCloseSheetOverlay(false)">← Back [Esc]</button>
                            <button type="button" class="tm-btn-yes" onclick="tmConfirmSheetOverlay()">Done &amp; Continue [Ctrl+Enter]</button>
                        </div>
                    </div>

                    <div class="tm-so-right">
                        <div class="tm-side-box">
                            <div class="tm-side-head">
                                <span id="tm-side-list-title">List of Items</span>
                                <small id="tm-side-list-sub">Select</small>
                            </div>
                            <div class="tm-side-list" id="tm-side-list-body"></div>
                        </div>
                    </div>
                </div>

                <div class="tm-so-footer">
                    <span>[Enter / ↓] Agla Box · [↑ ↓] Side List Chunein · [Ctrl+Enter] Sheet Confirm &amp; Aage Badhein</span>
                    <span>TallyPrime Kariger Master Sheet</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const sideFieldIds = ['tm-s-karkhana', 'tm-bana-item', 'tm-zari-item', 'tm-tani-item', 'tm-chukka-item'];
        sideFieldIds.forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('focus', () => tmRenderSideList(fid, false));
            el.addEventListener('click', () => tmRenderSideList(fid, false));
            el.addEventListener('input', () => {
                tmUpdateLiveStockBadges();
                tmRenderSideList(fid, true);
            });
        });

        const allOverlayInputs = overlay.querySelectorAll('input');
        allOverlayInputs.forEach((el) => {
            if (!sideFieldIds.includes(el.id)) {
                el.addEventListener('focus', () => tmRenderSideList(null, false));
            }
        });
    };

    window.tmOpenSheetOverlay = function (focusFirst = true) {
        ensureTallyMasterStyles();
        ensureKarigerSheetOverlayDOM();
        tmSheetModalOpen = true;

        const nameVal = (document.getElementById('tm-name')?.value || '').trim().toUpperCase() || 'NEW KARIGER';
        const pill = document.getElementById('tm-so-kar-pill');
        if (pill) pill.textContent = nameVal;

        const deskSec = document.getElementById('tally-master-section');
        if (deskSec) deskSec.style.visibility = 'hidden';

        const overlay = document.getElementById('tm-kar-sheet-overlay');
        if (overlay) overlay.style.display = 'flex';

        tmUpdateLiveStockBadges();
        tmRenderSideList('tm-s-karkhana', false);

        if (focusFirst) {
            setTimeout(() => {
                const first = document.getElementById('tm-s-karkhana');
                if (first) first.focus();
            }, 30);
        }
    };

    window.tmCloseSheetOverlay = function (advanceToContact = false) {
        tmSheetModalOpen = false;
        const overlay = document.getElementById('tm-kar-sheet-overlay');
        if (overlay) overlay.style.display = 'none';

        const deskSec = document.getElementById('tally-master-section');
        if (deskSec) deskSec.style.visibility = 'visible';

        tmUpdateSummaryStrip();

        if (advanceToContact) {
            tmSetToast('✅ Kariger Master Sheet set! Mobile/Address bharein ya [Ctrl+Enter] se Save karein.');
            setTimeout(() => document.getElementById('tm-mobile')?.focus(), 30);
        } else {
            const target = (tmMode === 'alter-edit') ? 'tm-name' : 'tm-group';
            setTimeout(() => document.getElementById(target)?.focus(), 30);
        }
    };

    window.tmConfirmSheetOverlay = function () {
        window.tmCloseSheetOverlay(true);
    };

    const ensureTallyMasterDOM = () => {
        ensureTallyMasterStyles();
        bindTallyManualNumberGuard();
        ensureKarigerSheetOverlayDOM();

        const sec = document.getElementById('tally-master-section');
        if (!sec || sec.dataset.tmInitialized === '1') return;

        sec.innerHTML = `
            <div class="tm-topbar">
                <div class="tm-topbar-left">
                    <h2 id="tm-screen-title">Profile Creation (Tally Style)</h2>
                    <div class="tm-mode-tabs">
                        <button type="button" class="tm-tab-btn active" id="tm-tab-create" onclick="openTallyCreateModule()">+ Create</button>
                        <button type="button" class="tm-tab-btn" id="tm-tab-alter" onclick="openTallyAlterModule()">✏️ Alter (Search &amp; Edit)</button>
                    </div>
                </div>
                <button type="button" class="tm-esc-btn" onclick="tmHandleEscKey()">← [Esc] Back</button>
            </div>

            <div id="tm-alter-view" class="tm-alter-wrap" style="display:none;">
                <div class="tm-alter-controls">
                    <input type="text" id="tm-alter-search" class="tm-alter-search" placeholder="🔍 Naam, Mobile ya Mohalla type karke search karein..." autocomplete="off">
                    <div class="tm-alter-pills">
                        <button type="button" class="tm-tab-btn active" data-tm-filter="all" onclick="tmSetAlterFilter('all')">Sabhi</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="kariger" onclick="tmSetAlterFilter('kariger')">Kariger</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="cutting" onclick="tmSetAlterFilter('cutting')">Cutting</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="embroidery" onclick="tmSetAlterFilter('embroidery')">Embroidery</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="calender" onclick="tmSetAlterFilter('calender')">Calender</button>
                    </div>
                </div>
                <div class="tm-alter-list" id="tm-alter-list"></div>
            </div>

            <div id="tm-form-view">
                <div class="tm-form-grid">
                    <div class="tm-left-pane">
                        <input type="hidden" id="tm-edit-id">
                        <input type="hidden" id="tm-edit-source">

                        <div class="tm-row">
                            <label for="tm-name">Name :</label>
                            <input type="text" id="tm-name" placeholder="Jaise: FARHAN" autocomplete="off">
                        </div>

                        <div class="tm-row">
                            <label for="tm-group">Under (Group) :</label>
                            <input type="text" id="tm-group" placeholder="Kariger / Cutting / Embroidery / Calender..." autocomplete="off">
                        </div>

                        <!-- HIDDEN UNTIL KARIGER GROUP IS SELECTED -->
                        <div id="tm-kariger-fields" class="tm-divider" style="display:none;">
                            <div class="tm-sec-lbl">Kariger Master Sheet (Auto-Linked)</div>
                            <div class="tm-kar-summary-card">
                                <div>
                                    <strong style="font-size:12.5px; color:#1f2937;">Tani 1 Master Sheet Details</strong>
                                    <small id="tm-kar-summary-txt">Main Godown · Bana: 0.311 | Zari: 0.110 | Bani: ₹240</small>
                                </div>
                                <button type="button" class="tm-btn-yes" style="padding:5px 11px; font-size:11.5px;" onclick="tmOpenSheetOverlay(true)">Open Sheet Form [F9]</button>
                            </div>
                        </div>

                        <div id="tm-jobwork-fields" class="tm-divider" style="display:none;">
                            <div class="tm-sec-lbl" id="tm-jw-sec-lbl">JobWork Details (Auto-Save: JobWork)</div>
                            <div style="font-size:12px; color:#6b7280; background:#fffbeb; border:1px solid #fde68a; padding:8px 10px; border-radius:6px;">
                                Save karte hi ye worker seedha <strong id="tm-jw-target-txt">JobWork → Cutting</strong> list me aur Supabase me sync ho jayega.
                            </div>
                        </div>

                        <div class="tm-divider">
                            <div class="tm-sec-lbl">Contact &amp; Mailing Details</div>
                            <div class="tm-row">
                                <label for="tm-mobile">Mobile No. :</label>
                                <input type="tel" id="tm-mobile" maxlength="12" placeholder="10-digit Mobile">
                            </div>
                            <div class="tm-row">
                                <label for="tm-address">Address / Mohalla :</label>
                                <input type="text" id="tm-address" placeholder="Mohalla / City">
                            </div>
                            <div class="tm-row">
                                <label for="tm-date">Join Date :</label>
                                <input type="date" id="tm-date">
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; gap:10px;">
                            <button type="button" class="tm-esc-btn" id="tm-back-to-alter-btn" style="display:none;" onclick="openTallyAlterModule()">← Alter List</button>
                            <div style="margin-left:auto; display:flex; gap:8px;">
                                <button type="button" class="tm-btn-yes" onclick="tmAskAccept()">Save [Ctrl+Enter]</button>
                            </div>
                        </div>
                    </div>

                    <div class="tm-right-pane">
                        <div class="tm-group-box" id="tm-group-list-box">
                            <div class="tm-group-head">List of Groups</div>
                            <div id="tm-group-list">
                                <div class="tm-group-opt selected" data-grp="kariger" data-label="Kariger" onclick="tmPickGroup('kariger', true)"><span>Kariger (Weaver)</span><small>Kariger + Sheet</small></div>
                                <div class="tm-group-opt" data-grp="cutting" data-label="Cutting" onclick="tmPickGroup('cutting', true)"><span>Cutting</span><small>JobWork</small></div>
                                <div class="tm-group-opt" data-grp="embroidery" data-label="Embroidery" onclick="tmPickGroup('embroidery', true)"><span>Embroidery</span><small>JobWork</small></div>
                                <div class="tm-group-opt" data-grp="calender" data-label="Calender" onclick="tmPickGroup('calender', true)"><span>Calender</span><small>JobWork</small></div>
                            </div>
                        </div>

                        <div class="tm-group-box" id="tm-alter-info-box" style="display:none;">
                            <div class="tm-group-head">Alteration Safety Info</div>
                            <div style="padding:12px; font-size:12.5px; color:#4b5563; line-height:1.6;">
                                <div><strong>Group:</strong> <span id="tm-alter-grp-label">-</span></div>
                                <div><strong>ID:</strong> <span id="tm-alter-id-label" style="font-size:11px; color:#9ca3af;">-</span></div>
                                <div style="margin-top:6px; font-size:11.5px; color:#92400e;">Purani Tani / JobWork sheets aur Supabase sync surakshit rakhne ke liye Group lock hai.</div>
                            </div>
                        </div>

                        <div class="tm-accept-box" id="tm-accept-box">
                            <strong id="tm-accept-title">Accept?</strong>
                            <div style="display:flex; gap:8px; justify-content:center;">
                                <button type="button" class="tm-btn-yes" id="tm-btn-yes" onclick="tmSaveProfile()">Yes (Y)</button>
                                <button type="button" class="tm-btn-no" onclick="tmCancelAccept()">No (N)</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tm-status-strip">
                <span class="tm-toast" id="tm-toast-msg">Tally Master Ready — Enter se Group chunein, Kariger par Sheet khud khulegi.</span>
                <span id="tm-live-counts">Kariger: 0 · Cutting: 0 · Embroidery: 0 · Calender: 0</span>
            </div>
        `;
        sec.dataset.tmInitialized = '1';

        const grpInput = document.getElementById('tm-group');
        if (grpInput) {
            grpInput.addEventListener('input', function () {
                if (tmMode !== 'create') return;
                const q = this.value.trim().toLowerCase();
                const opts = Array.from(document.querySelectorAll('#tm-group-list .tm-group-opt'));
                let firstMatch = null;
                opts.forEach((el) => {
                    const match = !q || el.dataset.grp.includes(q) || el.dataset.label.toLowerCase().includes(q);
                    el.style.display = match ? 'flex' : 'none';
                    if (match && !firstMatch) firstMatch = el;
                });
                if (firstMatch) {
                    opts.forEach((o) => o.classList.remove('selected'));
                    firstMatch.classList.add('selected');
                    tmSelectedGroup = firstMatch.dataset.grp;
                }
            });
        }

        const alterSearch = document.getElementById('tm-alter-search');
        if (alterSearch) {
            alterSearch.addEventListener('input', () => {
                tmAlterActiveIdx = 0;
                tmRenderAlterList();
            });
        }
    };

    const tmResetKarigerSheetInputs = () => {
        const setV = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        const navKid = document.getElementById('app-karkhana-select')?.value;
        const defaultKid = (navKid && navKid !== 'all') ? navKid : 'k_main';
        tmSetSelectedKarkhana(defaultKid);

        setV('tm-s-saree', '');
        setV('tm-rate-bana', '0.311');
        setV('tm-rate-zari', '0.110');
        setV('tm-rate-bani', '240');
        setV('tm-pichla-bana', '0');
        setV('tm-pichla-zari', '0');
        setV('tm-pichla-bani', '0');
        setV('tm-waste-bana', '0');
        setV('tm-waste-zari', '0');
        setV('tm-bana-item', '');
        setV('tm-zari-item', '');
        setV('tm-tani-item', '');
        setV('tm-tani-sancha', '');
        setV('tm-tani-wazan', '');
        setV('tm-tani-pcs', '72');
        setV('tm-chukka-item', '');
        setV('tm-chukka-sancha', '');
        setV('tm-chukka-wazan', '');
        setV('tm-chukka-pcs', '72');
        for (let i = 1; i <= 8; i++) setV(`tm-color-${i}`, '');
        const pill = document.getElementById('tm-sheet-link-badge');
        if (pill) pill.textContent = 'Auto-Save: Tani 1';
        tmUpdateLiveStockBadges();
        tmUpdateSummaryStrip();
    };

    const tmLoadKarigerSheetInputs = (karId, karProfile = null) => {
        tmResetKarigerSheetInputs();
        if (karProfile) {
            tmSetSelectedKarkhana(karProfile.karkhanaId || 'k_main', karProfile.karkhanaName || null);
            const sEl = document.getElementById('tm-s-saree');
            if (sEl) sEl.value = karProfile.saree || '';
        }

        const sheets = tmGetSheetsSafe(karId);
        const sh = sheets.length ? sheets[sheets.length - 1] : null;
        if (!sh) {
            tmUpdateSummaryStrip();
            return;
        }

        const setV = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = (v !== undefined && v !== null) ? v : '';
        };
        setV('tm-rate-bana', sh.rateBana !== undefined ? sh.rateBana : 0.311);
        setV('tm-rate-zari', sh.rateZari !== undefined ? sh.rateZari : 0.110);
        setV('tm-rate-bani', sh.rateBani !== undefined ? sh.rateBani : 240);
        setV('tm-pichla-bana', sh.pichlaBana || 0);
        setV('tm-pichla-zari', sh.pichlaZari || 0);
        setV('tm-pichla-bani', sh.pichlaBani || 0);
        setV('tm-waste-bana', sh.banaWaste || 0);
        setV('tm-waste-zari', sh.zariWaste || 0);

        setV('tm-bana-item', sh.banaItem || '');
        setV('tm-zari-item', sh.zariItem || '');
        setV('tm-tani-item', sh.taniItem || '');
        setV('tm-tani-sancha', sh.taniSancha || '');
        setV('tm-tani-wazan', sh.taniWazan || '');
        setV('tm-tani-pcs', sh.taniPcs !== undefined ? sh.taniPcs : 72);
        setV('tm-chukka-item', sh.chukkaItem || '');
        setV('tm-chukka-sancha', sh.chukkaSancha || '');
        setV('tm-chukka-wazan', sh.chukkaWazan || '');
        setV('tm-chukka-pcs', sh.chukkaPcs !== undefined ? sh.chukkaPcs : 72);

        for (let i = 1; i <= 8; i++) {
            setV(`tm-color-${i}`, (sh.colors && sh.colors[i - 1]) ? sh.colors[i - 1] : '');
        }

        const pill = document.getElementById('tm-sheet-link-badge');
        if (pill) pill.textContent = `Linked Sheet: ${sh.title || 'Tani 1'}`;
        tmUpdateLiveStockBadges();
        tmUpdateSummaryStrip();
    };

    const tmUpdateCountsBar = () => {
        const kars = tmGetKarigers();
        const jws = tmGetJobWorkers();
        const cutC = jws.filter((w) => String(w.type || '').toLowerCase() === 'cutting').length;
        const embC = jws.filter((w) => String(w.type || '').toLowerCase() === 'embroidery').length;
        const calC = jws.filter((w) => String(w.type || '').toLowerCase() === 'calender').length;
        const el = document.getElementById('tm-live-counts');
        if (el) el.textContent = `Kariger: ${kars.length} · Cutting: ${cutC} · Embroidery: ${embC} · Calender: ${calC}`;
    };

    const tmSetToast = (msg) => {
        const el = document.getElementById('tm-toast-msg');
        if (el) el.textContent = msg;
    };

    window.tmPickGroup = function (grp, openSheetOrFocus) {
        tmSelectedGroup = grp || 'kariger';
        const labelMap = { kariger: 'Kariger', cutting: 'Cutting', embroidery: 'Embroidery', calender: 'Calender' };
        const grpInput = document.getElementById('tm-group');
        if (grpInput) grpInput.value = labelMap[tmSelectedGroup] || 'Kariger';

        document.querySelectorAll('#tm-group-list .tm-group-opt').forEach((el) => {
            el.classList.toggle('selected', el.dataset.grp === tmSelectedGroup);
            el.style.display = 'flex';
        });

        const isKar = (tmSelectedGroup === 'kariger');
        const karBox = document.getElementById('tm-kariger-fields');
        const jwBox = document.getElementById('tm-jobwork-fields');

        if (!isKar) {
            if (karBox) karBox.style.display = 'none';
            if (jwBox) jwBox.style.display = 'block';
            const lbl = labelMap[tmSelectedGroup] || 'Cutting';
            const sLbl = document.getElementById('tm-jw-sec-lbl');
            const tTxt = document.getElementById('tm-jw-target-txt');
            if (sLbl) sLbl.textContent = `JobWork Details (Auto-Save: ${lbl})`;
            if (tTxt) tTxt.textContent = `JobWork → ${lbl}`;
            if (openSheetOrFocus) {
                document.getElementById('tm-mobile')?.focus();
            }
        } else {
            if (jwBox) jwBox.style.display = 'none';
            if (karBox) karBox.style.display = 'block';
            tmUpdateSummaryStrip();
            if (openSheetOrFocus) {
                window.tmOpenSheetOverlay(true);
            }
        }
    };

    window.openTallyCreateModule = function () {
        ensureTallyMasterDOM();
        if (tmSheetModalOpen) window.tmCloseSheetOverlay(false);

        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('tally-master-section');
        if (sec) sec.style.display = 'block';

        tmMode = 'create';
        tmSelectedGroup = 'kariger';
        document.getElementById('tm-screen-title').textContent = 'Profile Creation (Tally Style)';
        document.getElementById('tm-tab-create').classList.add('active');
        document.getElementById('tm-tab-alter').classList.remove('active');
        document.getElementById('tm-alter-view').style.display = 'none';
        document.getElementById('tm-form-view').style.display = 'block';
        document.getElementById('tm-back-to-alter-btn').style.display = 'none';
        document.getElementById('tm-group-list-box').style.display = 'block';
        document.getElementById('tm-alter-info-box').style.display = 'none';
        document.getElementById('tm-accept-box').style.display = 'none';

        // Shuru me Kariger Master Sheet form HIDE rahega (sirf Group select karne par khulega)
        document.getElementById('tm-kariger-fields').style.display = 'none';
        document.getElementById('tm-jobwork-fields').style.display = 'none';

        const grpInp = document.getElementById('tm-group');
        if (grpInp) {
            grpInp.readOnly = false;
            grpInp.value = '';
        }
        document.querySelectorAll('#tm-group-list .tm-group-opt').forEach((el) => {
            el.classList.toggle('selected', el.dataset.grp === 'kariger');
            el.style.display = 'flex';
        });

        document.getElementById('tm-edit-id').value = '';
        document.getElementById('tm-edit-source').value = '';
        document.getElementById('tm-name').value = '';
        document.getElementById('tm-mobile').value = '';
        document.getElementById('tm-address').value = '';
        document.getElementById('tm-date').value = tmToIsoDate(tmGetToday());

        tmResetKarigerSheetInputs();
        tmUpdateCountsBar();
        tmSetToast('Name daalein aur Under (Group) me Kariger select karein — Sheet form khud khulega!');
        setTimeout(() => document.getElementById('tm-name')?.focus(), 40);
    };

    window.openTallyAlterModule = function () {
        ensureTallyMasterDOM();
        if (tmSheetModalOpen) window.tmCloseSheetOverlay(false);

        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('tally-master-section');
        if (sec) sec.style.display = 'block';

        tmMode = 'alter-list';
        document.getElementById('tm-screen-title').textContent = 'Master Alteration (Search & Edit Profile)';
        document.getElementById('tm-tab-create').classList.remove('active');
        document.getElementById('tm-tab-alter').classList.add('active');
        document.getElementById('tm-alter-view').style.display = 'block';
        document.getElementById('tm-form-view').style.display = 'none';
        document.getElementById('tm-accept-box').style.display = 'none';

        tmAlterActiveIdx = 0;
        const sInp = document.getElementById('tm-alter-search');
        if (sInp) sInp.value = '';
        tmRenderAlterList();
        tmUpdateCountsBar();
        tmSetToast('Naam search karein · ↑ ↓ Arrow se chunein · Enter se Edit karein.');
        setTimeout(() => sInp?.focus(), 40);
    };

    window.tmSetAlterFilter = function (filterVal) {
        tmAlterFilter = filterVal || 'all';
        tmAlterActiveIdx = 0;
        document.querySelectorAll('#tm-alter-view [data-tm-filter]').forEach((b) => {
            b.classList.toggle('active', b.dataset.tmFilter === tmAlterFilter);
        });
        tmRenderAlterList();
    };

    const tmGetCombinedProfiles = () => {
        const list = [];
        tmGetKarigers().forEach((k) => {
            list.push({
                id: k.id,
                source: 'kariger_list',
                group: 'kariger',
                groupLabel: 'Kariger',
                name: k.name || '',
                mobile: k.mobile || '',
                address: k.mohalla || k.address || '',
                saree: k.saree || '',
                karkhanaId: k.karkhanaId || 'k_main',
                karkhanaName: k.karkhanaName || 'Main Godown',
                date: k.date || ''
            });
        });
        tmGetJobWorkers().forEach((w) => {
            const t = String(w.type || 'cutting').toLowerCase();
            const lbl = t === 'embroidery' ? 'Embroidery' : (t === 'calender' ? 'Calender' : 'Cutting');
            list.push({
                id: w.id,
                source: 'jobwork_workers',
                group: t,
                groupLabel: lbl,
                name: w.name || '',
                mobile: w.mobile || '',
                address: w.address || '',
                saree: '',
                karkhanaId: '',
                karkhanaName: '',
                date: w.date || ''
            });
        });
        return list;
    };

    const tmRenderAlterList = () => {
        const container = document.getElementById('tm-alter-list');
        if (!container) return;
        const q = (document.getElementById('tm-alter-search')?.value || '').trim().toLowerCase();

        const items = tmGetCombinedProfiles().filter((p) => {
            if (tmAlterFilter !== 'all' && p.group !== tmAlterFilter) return false;
            if (!q) return true;
            return `${p.name} ${p.groupLabel} ${p.mobile} ${p.address} ${p.saree} ${p.karkhanaName}`.toLowerCase().includes(q);
        });

        if (!items.length) {
            container.innerHTML = '<div style="padding:24px; text-align:center; color:#9ca3af; font-size:13px;">Koi profile nahi mili.</div>';
            return;
        }
        if (tmAlterActiveIdx >= items.length) tmAlterActiveIdx = 0;

        container.innerHTML = items.map((p, idx) => {
            const meta = p.group === 'kariger'
                ? `${tmEscHtml(p.karkhanaName)}${p.saree ? ' · ' + tmEscHtml(p.saree) : ''}${p.address ? ' · ' + tmEscHtml(p.address) : ''}`
                : `${tmEscHtml(p.address || '-')}${p.mobile ? ' · ' + tmEscHtml(p.mobile) : ''}`;
            return `
                <div class="tm-alter-row ${idx === tmAlterActiveIdx ? 'active' : ''}" data-idx="${idx}" onclick="tmOpenAlterEdit('${tmEscHtml(p.id)}', '${tmEscHtml(p.source)}')">
                    <div><strong>${tmEscHtml(p.name)}</strong>${p.mobile ? ` <small style="color:#6b7280;">(${tmEscHtml(p.mobile)})</small>` : ''}</div>
                    <div><span class="tm-grp-pill">${tmEscHtml(p.groupLabel)}</span></div>
                    <div class="tm-alter-hide-sm"><small style="color:#6b7280;">${meta || '-'}</small></div>
                    <div style="text-align:right; font-weight:700; font-size:12px;">Edit →</div>
                </div>`;
        }).join('');
    };

    window.tmOpenAlterEdit = function (id, source) {
        const found = tmGetCombinedProfiles().find((p) => String(p.id) === String(id) && p.source === source);
        if (!found) return;

        tmMode = 'alter-edit';
        document.getElementById('tm-screen-title').textContent = `Alter Profile: ${found.name}`;
        document.getElementById('tm-alter-view').style.display = 'none';
        document.getElementById('tm-form-view').style.display = 'block';
        document.getElementById('tm-back-to-alter-btn').style.display = 'inline-block';
        document.getElementById('tm-group-list-box').style.display = 'none';
        document.getElementById('tm-alter-info-box').style.display = 'block';
        document.getElementById('tm-accept-box').style.display = 'none';

        document.getElementById('tm-edit-id').value = found.id;
        document.getElementById('tm-edit-source').value = found.source;
        document.getElementById('tm-name').value = found.name;
        document.getElementById('tm-mobile').value = found.mobile;
        document.getElementById('tm-address').value = found.address;
        document.getElementById('tm-date').value = tmToIsoDate(found.date || tmGetToday());

        const grpInp = document.getElementById('tm-group');
        if (grpInp) grpInp.readOnly = true;

        window.tmPickGroup(found.group, false);

        if (found.group === 'kariger') {
            tmLoadKarigerSheetInputs(found.id, found);
        }

        document.getElementById('tm-alter-grp-label').textContent = found.groupLabel;
        document.getElementById('tm-alter-id-label').textContent = found.id;
        tmSetToast(`Editing [${found.name}] — [F9] se Master Sheet edit karein, [Ctrl+Enter] se Update.`);
        setTimeout(() => document.getElementById('tm-name')?.focus(), 40);
    };

    window.tmAskAccept = function () {
        if (tmSheetModalOpen) {
            window.tmConfirmSheetOverlay();
            return;
        }
        const name = (document.getElementById('tm-name')?.value || '').trim();
        if (!name) {
            alert('Pehle Name bharein!');
            document.getElementById('tm-name')?.focus();
            return;
        }
        const box = document.getElementById('tm-accept-box');
        const title = document.getElementById('tm-accept-title');
        if (title) title.textContent = (tmMode === 'alter-edit') ? 'Update Profile? (Accept)' : 'Accept?';
        if (box) box.style.display = 'block';
        document.getElementById('tm-btn-yes')?.focus();
    };

    window.tmCancelAccept = function () {
        const box = document.getElementById('tm-accept-box');
        if (box) box.style.display = 'none';
        document.getElementById('tm-date')?.focus();
    };

    window.tmSaveProfile = function () {
        const editId = (document.getElementById('tm-edit-id')?.value || '').trim();
        const editSource = (document.getElementById('tm-edit-source')?.value || '').trim();
        const name = (document.getElementById('tm-name')?.value || '').trim().toUpperCase();
        const mobile = (document.getElementById('tm-mobile')?.value || '').trim();
        const address = (document.getElementById('tm-address')?.value || '').trim();
        const dateVal = tmToIsoDate((document.getElementById('tm-date')?.value || '').trim() || tmGetToday());

        if (!name) return;

        if (tmSelectedGroup === 'kariger' || editSource === 'kariger_list') {
            const kId = tmGetSelectedKarkhanaId() || 'k_main';
            const kName = (typeof window.getKarkhanaNameById === 'function')
                ? window.getKarkhanaNameById(kId)
                : (document.getElementById('tm-s-karkhana')?.value || 'Main Godown');
            const saree = (document.getElementById('tm-s-saree')?.value || '').trim();

            const list = tmGetKarigers();
            const targetKarId = editId || `kar_${Date.now()}`;

            if (editId) {
                const it = list.find((x) => String(x.id) === String(editId));
                if (it) {
                    it.name = name;
                    it.saree = saree;
                    it.mobile = mobile;
                    it.mohalla = address;
                    it.date = dateVal;
                    it.karkhanaId = kId;
                    it.karkhanaName = kName;
                }
            } else {
                list.push({
                    id: targetKarId,
                    name: name,
                    saree: saree,
                    mobile: mobile,
                    mohalla: address,
                    date: dateVal,
                    karkhanaId: kId,
                    karkhanaName: kName
                });
            }
            if (typeof window.setStore === 'function') window.setStore('kariger_list', list);

            // Kariger Master Sheet (Tani 1 / Latest Sheet) ko seedha save & sync karein
            const sheets = tmGetSheetsSafe(targetKarId);
            let targetSheet = sheets.length ? sheets[sheets.length - 1] : null;
            const oldSheetState = targetSheet ? {
                taniItem: targetSheet.taniItem || '',
                taniWazan: tmNumOrFallback(targetSheet.taniWazan, 0),
                chukkaItem: targetSheet.chukkaItem || '',
                chukkaWazan: tmNumOrFallback(targetSheet.chukkaWazan, 0)
            } : { taniItem: '', taniWazan: 0, chukkaItem: '', chukkaWazan: 0 };

            if (!targetSheet) {
                targetSheet = {
                    id: 'tani_1',
                    title: 'Tani 1',
                    note: '',
                    rows: []
                };
                sheets.push(targetSheet);
            }

            targetSheet.rateBana = tmNumOrFallback(document.getElementById('tm-rate-bana')?.value, 0.311);
            targetSheet.rateZari = tmNumOrFallback(document.getElementById('tm-rate-zari')?.value, 0.110);
            targetSheet.rateBani = tmNumOrFallback(document.getElementById('tm-rate-bani')?.value, 240);
            targetSheet.pichlaBana = tmNumOrFallback(document.getElementById('tm-pichla-bana')?.value, 0);
            targetSheet.pichlaZari = tmNumOrFallback(document.getElementById('tm-pichla-zari')?.value, 0);
            targetSheet.pichlaBani = tmNumOrFallback(document.getElementById('tm-pichla-bani')?.value, 0);
            targetSheet.banaWaste = tmNumOrFallback(document.getElementById('tm-waste-bana')?.value, 0);
            targetSheet.zariWaste = tmNumOrFallback(document.getElementById('tm-waste-zari')?.value, 0);

            targetSheet.banaItem = String(document.getElementById('tm-bana-item')?.value || '').trim();
            targetSheet.zariItem = String(document.getElementById('tm-zari-item')?.value || '').trim();
            targetSheet.taniItem = String(document.getElementById('tm-tani-item')?.value || '').trim();
            targetSheet.taniSancha = String(document.getElementById('tm-tani-sancha')?.value || '').trim();
            targetSheet.taniWazan = tmNumOrFallback(document.getElementById('tm-tani-wazan')?.value, 0);
            targetSheet.taniPcs = tmNumOrFallback(document.getElementById('tm-tani-pcs')?.value, 72);
            targetSheet.chukkaItem = String(document.getElementById('tm-chukka-item')?.value || '').trim();
            targetSheet.chukkaSancha = String(document.getElementById('tm-chukka-sancha')?.value || '').trim();
            targetSheet.chukkaWazan = tmNumOrFallback(document.getElementById('tm-chukka-wazan')?.value, 0);
            targetSheet.chukkaPcs = tmNumOrFallback(document.getElementById('tm-chukka-pcs')?.value, 72);

            const newColors = [];
            for (let i = 1; i <= 8; i++) {
                const cVal = String(document.getElementById(`tm-color-${i}`)?.value || '').trim();
                if (cVal) newColors.push(cVal);
            }
            targetSheet.colors = newColors;
            if (!Array.isArray(targetSheet.rows)) targetSheet.rows = [];

            tmSyncSanchaStockForSheet(targetKarId, name, kId, targetSheet, oldSheetState);
            tmSaveSheetsSafe(targetKarId, sheets);
        } else {
            const jwList = [...tmGetJobWorkers()];
            if (editId) {
                const it = jwList.find((x) => String(x.id) === String(editId));
                if (it) {
                    it.name = name;
                    it.address = address;
                    it.mobile = mobile;
                    it.date = dateVal;
                }
            } else {
                jwList.push({
                    id: `jw_${Date.now()}`,
                    type: tmSelectedGroup,
                    date: dateVal,
                    name: name,
                    address: address,
                    mobile: mobile
                });
            }
            if (typeof window.saveJobWorkers === 'function') {
                window.saveJobWorkers(jwList);
            } else if (typeof window.setStore === 'function') {
                window.setStore('jobwork_workers', jwList);
            }
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(editId || null);
            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
        }

        if (typeof window.populateKarigersDatalist === 'function') window.populateKarigersDatalist();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        window.slSyncDashboardCharts();
        tmUpdateCountsBar();

        document.getElementById('tm-accept-box').style.display = 'none';

        if (tmMode === 'alter-edit') {
            window.openTallyAlterModule();
            tmSetToast(`✅ [${name}] + Master Sheet update ho gayi!`);
        } else {
            window.openTallyCreateModule();
            tmSetToast(
                tmSelectedGroup === 'kariger'
                    ? `✅ [${name}] + Tani 1 Master Sheet save ho gayi! Agli entry karein.`
                    : `✅ [${name}] (${tmSelectedGroup.toUpperCase()}) save ho gaya! Agli entry karein.`
            );
        }
    };

    window.tmHandleEscKey = function () {
        if (tmSheetModalOpen) {
            window.tmCloseSheetOverlay(false);
            return;
        }
        const acc = document.getElementById('tm-accept-box');
        if (acc && acc.style.display === 'block') {
            window.tmCancelAccept();
            return;
        }
        if (tmMode === 'alter-edit') {
            window.openTallyAlterModule();
            return;
        }
        window.backToDashboard();
    };

    /* ========================================================================
       5. GLOBAL KEYBOARD SHORTCUTS (STOCK SUMMARY + CREATE/ALTER + OVERLAY)
    ======================================================================== */
    document.addEventListener('keydown', (e) => {
        const desk = document.getElementById('desktop-screen');
        if (!desk || desk.style.display === 'none') return;

        // 0A. Inside Forward Kariger Master Sheet Overlay (Takes top priority)
        if (tmSheetModalOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.tmCloseSheetOverlay(false);
                return;
            }
            if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'a')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.tmConfirmSheetOverlay();
                return;
            }

            const overlayOrder = [
                'tm-s-karkhana', 'tm-s-saree',
                'tm-rate-bana', 'tm-rate-zari', 'tm-rate-bani',
                'tm-pichla-bana', 'tm-pichla-zari', 'tm-pichla-bani',
                'tm-waste-bana', 'tm-waste-zari',
                'tm-bana-item', 'tm-zari-item',
                'tm-tani-item', 'tm-tani-sancha', 'tm-tani-wazan', 'tm-tani-pcs',
                'tm-chukka-item', 'tm-chukka-sancha', 'tm-chukka-wazan', 'tm-chukka-pcs',
                'tm-color-1', 'tm-color-2', 'tm-color-3', 'tm-color-4',
                'tm-color-5', 'tm-color-6', 'tm-color-7', 'tm-color-8'
            ];

            const activeEl = document.activeElement;
            const activeId = activeEl?.id || '';
            const curIdx = overlayOrder.indexOf(activeId);
            const isSideField = Boolean(tmActiveSideField && tmActiveSideField === activeId && tmSideItems.length > 0);

            if (isSideField && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                if (e.key === 'ArrowDown') {
                    tmSideActiveIdx = (tmSideActiveIdx + 1) % tmSideItems.length;
                } else {
                    tmSideActiveIdx = (tmSideActiveIdx <= 0) ? (tmSideItems.length - 1) : (tmSideActiveIdx - 1);
                }
                const listEl = document.getElementById('tm-side-list-body');
                const opts = listEl ? Array.from(listEl.querySelectorAll('.tm-side-opt')) : [];
                opts.forEach((o, i) => o.classList.toggle('selected', i === tmSideActiveIdx));
                opts[tmSideActiveIdx]?.scrollIntoView({ block: 'nearest' });
                return;
            }

            if (curIdx >= 0) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isSideField && tmSideActiveIdx >= 0 && tmSideItems[tmSideActiveIdx]) {
                        window.tmPickSideItem(tmSideActiveIdx);
                        return;
                    }
                    if (e.shiftKey) {
                        if (curIdx > 0) {
                            const prev = document.getElementById(overlayOrder[curIdx - 1]);
                            if (prev) { prev.focus(); if (prev.select) prev.select(); }
                        }
                        return;
                    }
                    if (curIdx < overlayOrder.length - 1) {
                        const nxt = document.getElementById(overlayOrder[curIdx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else {
                        window.tmConfirmSheetOverlay();
                    }
                    return;
                }

                if (!isSideField && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    if (e.key === 'ArrowDown' && curIdx < overlayOrder.length - 1) {
                        const nxt = document.getElementById(overlayOrder[curIdx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else if (e.key === 'ArrowUp' && curIdx > 0) {
                        const prev = document.getElementById(overlayOrder[curIdx - 1]);
                        if (prev) { prev.focus(); if (prev.select) prev.select(); }
                    }
                }
            }
            return;
        }

        const anyModalOpen = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display && m.style.display !== 'none');
        if (anyModalOpen) return;

        // 0. Inside Stock Summary Hub screen
        const ssSec = document.getElementById('stock-summary-section');
        if (ssSec && ssSec.style.display !== 'none') {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.backToDashboard();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                ssHighlightRow(ssActiveIdx + 1);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                ssHighlightRow(ssActiveIdx - 1);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.ssOpenStockGroup(ssActiveIdx);
                return;
            }
            if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                if (k === 'b') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(0); return; }
                if (k === 'z') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(1); return; }
                if (k === 'n') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(2); return; }
                if (k === 'e') { e.preventDefault(); e.stopImmediatePropagation(); window.ssOpenStockGroup(3); return; }
            }
            return;
        }

        // 1. Inside Tally Create / Alter screen
        const tmSec = document.getElementById('tally-master-section');
        if (tmSec && tmSec.style.display !== 'none') {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.tmHandleEscKey();
                return;
            }

            if (tmMode === 'alter-list') {
                const rows = Array.from(document.querySelectorAll('#tm-alter-list .tm-alter-row'));
                if (!rows.length) return;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    rows[tmAlterActiveIdx]?.classList.remove('active');
                    tmAlterActiveIdx = (tmAlterActiveIdx + 1) % rows.length;
                    rows[tmAlterActiveIdx]?.classList.add('active');
                    rows[tmAlterActiveIdx]?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    rows[tmAlterActiveIdx]?.classList.remove('active');
                    tmAlterActiveIdx = (tmAlterActiveIdx - 1 + rows.length) % rows.length;
                    rows[tmAlterActiveIdx]?.classList.add('active');
                    rows[tmAlterActiveIdx]?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    rows[tmAlterActiveIdx]?.click();
                }
                return;
            }

            const accBox = document.getElementById('tm-accept-box');
            if (accBox && accBox.style.display === 'block') {
                if (e.key.toLowerCase() === 'y' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    window.tmSaveProfile();
                } else if (e.key.toLowerCase() === 'n') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    window.tmCancelAccept();
                }
                return;
            }

            if (e.key === 'F9' && tmSelectedGroup === 'kariger') {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.tmOpenSheetOverlay(true);
                return;
            }

            if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'a')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.tmAskAccept();
                return;
            }

            const activeEl = document.activeElement;
            const activeId = activeEl?.id || '';

            if (activeId === 'tm-group' && tmMode === 'create' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                const visible = Array.from(document.querySelectorAll('#tm-group-list .tm-group-opt')).filter((x) => x.style.display !== 'none');
                if (!visible.length) return;
                let gIdx = visible.findIndex((x) => x.classList.contains('selected'));
                gIdx = (e.key === 'ArrowDown') ? (gIdx + 1) % visible.length : (gIdx - 1 + visible.length) % visible.length;
                visible.forEach((x) => x.classList.remove('selected'));
                visible[gIdx].classList.add('selected');
                tmSelectedGroup = visible[gIdx].dataset.grp;
                document.getElementById('tm-group').value = visible[gIdx].dataset.label;
                return;
            }

            const order = (tmMode === 'alter-edit')
                ? ['tm-name', 'tm-mobile', 'tm-address', 'tm-date']
                : ['tm-name', 'tm-group', 'tm-mobile', 'tm-address', 'tm-date'];

            const curIdx = order.indexOf(activeId);
            if (curIdx >= 0) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeId === 'tm-group') {
                        window.tmPickGroup(tmSelectedGroup, true);
                        return;
                    }
                    if (e.shiftKey) {
                        if (curIdx > 0) {
                            const prev = document.getElementById(order[curIdx - 1]);
                            if (prev) { prev.focus(); if (prev.select) prev.select(); }
                        }
                        return;
                    }
                    if (curIdx < order.length - 1) {
                        const nxt = document.getElementById(order[curIdx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else {
                        window.tmAskAccept();
                    }
                    return;
                }

                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (e.key === 'ArrowDown' && curIdx < order.length - 1) {
                        const nxt = document.getElementById(order[curIdx + 1]);
                        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
                    } else if (e.key === 'ArrowUp' && curIdx > 0) {
                        const prev = document.getElementById(order[curIdx - 1]);
                        if (prev) { prev.focus(); if (prev.select) prev.select(); }
                    }
                }
            }
            return;
        }

        // 2. Dashboard Gateway Arrow + Letter Shortcuts
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
       6. NAVBAR KARKHANA DROPDOWN & GLOBAL MODULE NAVIGATION
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
                if (typeof window.switchDashboardKarkhanaTab === 'function') {
                    window.switchDashboardKarkhanaTab(val);
                }
                if (typeof window.triggerActiveSectionRefresh === 'function') {
                    window.triggerActiveSectionRefresh();
                }
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
        if (typeof window.renderDashboardDayBook === 'function') {
            window.renderDashboardDayBook();
        }
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
        if (tmSheetModalOpen) window.tmCloseSheetOverlay(false);
        window.__slReturnToStockSummary = false;
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = window.innerWidth <= 860 ? 'block' : 'flex';
        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }
        window.slSyncDashboardCharts();
    };

    /* ========================================================================
       7. PWA SERVICE WORKER & APP BOOTSTRAP
    ======================================================================== */
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js?v=3.4')
                .then(() => console.log('✅ [PWA] Service Worker Active v3.4.'))
                .catch((err) => console.warn('⚠️ [PWA] SW Registration failed:', err));
        });
    }

    const initAppShell = () => {
        ensureTallyMasterDOM();
        ensureStockSummaryDOM();
        window.populateNavbarKarkhanaDropdown();
        slInitBadgeObserver();
        if (typeof window.checkAutoLogin === 'function') {
            window.checkAutoLogin();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAppShell);
    } else {
        initAppShell();
    }
})();
