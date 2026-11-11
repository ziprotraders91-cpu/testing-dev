/* ============================================================================
   SIMPLICITY ERP - ⚡ MASTER STOCK EXPRESS ENGINE (BADA COUNTER & ZERO-MOUSE)
   Folder: stock-express / File: stock-express.js
   Developed for: Farhan Jawed
   Features:
   - Bada Wide Screen (880px Counter Layout like Kariger Express)
   - Strict Keyboard Capture (F1/F2/F3/F4 no conflict with Kariger Express)
   - Bana, Zari & Sancha (Tani/Chukka) Inward Engine
   - Purana vs Naya Mode with Datalist Auto-Complete
   - Live Godown Stock Display & Instant A6 Print
============================================================================ */

(() => {
    'use strict';

    let activeCategory = 'bana'; // 'bana' | 'zari' | 'sancha'
    let stockMode = 'purana';     // 'purana' | 'naya'
    let sanchaCat = 'tani';       // 'tani' | 'chukka'
    let lastSavedStockEntry = null;

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];
    };

    // Datalists Builder
    const getStockExpressDatalists = () => {
        const rawBana = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const uB = [];
        let banaOpts = '';
        rawBana.forEach((b) => {
            const n = b?.name ? b.name.trim() : '';
            if (n && uB.indexOf(n.toLowerCase()) === -1) {
                uB.push(n.toLowerCase());
                banaOpts += `<option value="${esc(n)}">`;
            }
        });

        const rawZari = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
        const uZ = [];
        let zariOpts = '';
        rawZari.forEach((z) => {
            const n = z?.name ? z.name.trim() : '';
            if (n && uZ.indexOf(n.toLowerCase()) === -1) {
                uZ.push(n.toLowerCase());
                zariOpts += `<option value="${esc(n)}">`;
            }
        });

        const rawSancha = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const uS = [];
        let sanchaOpts = '';
        rawSancha.forEach((s) => {
            const n = s?.name ? s.name.trim() : '';
            if (n && uS.indexOf(n.toLowerCase()) === -1) {
                uS.push(n.toLowerCase());
                sanchaOpts += `<option value="${esc(n)}">`;
            }
        });

        return { banaOpts, zariOpts, sanchaOpts };
    };

    // 1. OPEN STOCK EXPRESS MODAL (BADA COUNTER)
    window.openStockExpressModal = () => {
        const existing = document.getElementById('master-stock-express-modal');
        if (existing) existing.remove();

        activeCategory = 'bana';
        stockMode = 'purana';
        sanchaCat = 'tani';
        lastSavedStockEntry = null;

        const today = getToday();
        const { banaOpts } = getStockExpressDatalists();

        const activeKid = (typeof window.getActiveKarkhanaId === 'function') 
            ? window.getActiveKarkhanaId() 
            : (window.currentDashboardKarkhanaFilter || 'k_main');
        const godamName = (typeof window.getKarkhanaNameById === 'function') 
            ? window.getKarkhanaNameById(activeKid) 
            : 'Main Godown';

        const modalHtml = `
        <div id="master-stock-express-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:880px; border-radius:12px; box-shadow:0 25px 40px -5px rgba(0,0,0,0.5); overflow:hidden; font-family:sans-serif; max-height:96vh; display:flex; flex-direction:column;">
                
                <!-- Header -->
                <div style="background:#0f172a; color:#fff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:22px;">⚡</span>
                        <h3 style="margin:0; font-size:16px; letter-spacing:0.5px;">STOCK EXPRESS • कच्चा माल आवक व स्टॉक काउन्टर</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:11px; background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:4px; font-weight:bold;">[F1/F2/F3] Category | [F4] Purana/Naya | [Esc] Close</span>
                        <button type="button" onclick="closeStockExpressModal()" style="background:transparent; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                </div>

                <!-- Body -->
                <div style="padding:16px; overflow-y:auto; flex:1;">
                    
                    <!-- 3 BADE CATEGORY TABS -->
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px;">
                        <button type="button" id="stk-cat-bana" onclick="switchStockCategory('bana')" style="background:#059669; color:#fff; border:none; padding:12px 8px; border-radius:8px; font-weight:900; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                            🧶 1. BANA [F1 / Alt+1]
                        </button>
                        <button type="button" id="stk-cat-zari" onclick="switchStockCategory('zari')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:12px 8px; border-radius:8px; font-weight:900; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:6px;">
                            ✨ 2. ZARI [F2 / Alt+2]
                        </button>
                        <button type="button" id="stk-cat-sancha" onclick="switchStockCategory('sancha')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:12px 8px; border-radius:8px; font-weight:900; font-size:14px; cursor:pointer; display:flex; justify-content:center; align-items:center; gap:6px;">
                            ⚙️ 3. SANCHA [F3 / Alt+3]
                        </button>
                    </div>

                    <!-- Godown & Sub-Mode Switch Bar -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div style="font-size:13px; color:#1e293b;">
                            🏢 <strong>जमा गोदाम:</strong> <span style="color:#0284c7; font-weight:bold;">${esc(godamName)}</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="stk-mode-purana" onclick="setStockExpressMode('purana')" style="background:#1e3a8a; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">
                                🔵 Purana Item [F4]
                            </button>
                            <button type="button" id="stk-mode-naya" onclick="setStockExpressMode('naya')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:6px 14px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">
                                🟢 + Naya Item
                            </button>
                        </div>
                    </div>

                    <!-- 2-Column Bada Layout -->
                    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:14px;">
                        
                        <!-- COLUMN 1: ITEM SELECTION & DETAILS -->
                        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:14px;">
                            <h4 id="stk-col1-title" style="margin:0 0 10px 0; color:#059669; font-size:13px; border-bottom:1.5px solid #cbd5e1; padding-bottom:5px;">
                                📦 Item Ki Jankari
                            </h4>

                            <!-- Date Input -->
                            <div style="margin-bottom:10px;">
                                <label style="font-size:11px; font-weight:bold; color:#475569;">तारीख (Date):</label>
                                <input type="date" id="stk-date" value="${today}" data-next="stk-item-name" style="width:100%; padding:8px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            </div>

                            <!-- Purana Item (Datalist Auto-Complete) -->
                            <div id="stk-box-purana" style="margin-bottom:10px;">
                                <label id="stk-lbl-purana" style="font-size:11px; font-weight:bold; color:#1e3a8a;">बाना का नाम (1-2 अक्षर लिखें):</label>
                                <input type="text" id="stk-item-name" list="stk-items-dl" data-next="stk-qty" placeholder="Type 1-2 letters..." autocomplete="off" style="width:100%; padding:9px 12px; border:2px solid #059669; border-radius:6px; font-size:15px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                <datalist id="stk-items-dl">${banaOpts}</datalist>
                            </div>

                            <!-- Naya Item Input -->
                            <div id="stk-box-naya" style="display:none; margin-bottom:10px;">
                                <label id="stk-lbl-naya" style="font-size:11px; font-weight:bold; color:#059669;">नए आइटम का पूरा नाम:</label>
                                <input type="text" id="stk-new-name" data-next="stk-qty" placeholder="Naya naam likhein..." autocomplete="off" style="width:100%; padding:9px 12px; border:2px solid #10b981; border-radius:6px; font-size:15px; font-weight:bold; box-sizing:border-box; background:#ecfdf5;">
                            </div>

                            <!-- Sancha Specific Fields (Tani vs Chukka) -->
                            <div id="stk-box-sancha" style="display:none; background:#eff6ff; border:1px solid #bfdbfe; padding:10px; border-radius:8px; margin-bottom:10px;">
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                                    <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                                        <input type="radio" name="stk_sancha_type" value="tani" checked onchange="setSanchaCategory('tani')"> 🧵 Tani (ताना)
                                    </label>
                                    <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                                        <input type="radio" name="stk_sancha_type" value="chukka" onchange="setSanchaCategory('chukka')"> ⚙️ Chukka (चुक्का)
                                    </label>
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#0284c7;">Kahan Se Aayi / Rangrej (Optional):</label>
                                    <input type="text" id="stk-sancha-person" placeholder="jaise: Guddu Rangrej / Store" style="width:100%; padding:7px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; box-sizing:border-box;">
                                </div>
                            </div>
                        </div>

                        <!-- COLUMN 2: WAZAN & LIVE STOCK CARD -->
                        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 10px 0; color:#1e3a8a; font-size:13px; border-bottom:1.5px solid #cbd5e1; padding-bottom:5px;">
                                    ⚖️ वज़न व आवक हिसाब
                                </h4>

                                <!-- Wazan (Qty) -->
                                <div style="margin-bottom:12px;">
                                    <label style="font-size:11px; font-weight:bold; color:#374151;">कितना वज़न आया (Wazan Kg me):</label>
                                    <input type="number" step="0.01" id="stk-qty" placeholder="0.00 Kg" style="width:100%; padding:10px 12px; border:2px solid #059669; border-radius:6px; font-size:20px; font-weight:900; color:#059669; box-sizing:border-box;">
                                </div>

                                <!-- Note / Party -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:11px; font-weight:bold; color:#475569;">सप्लायर / बिल नंबर / नोट (Optional):</label>
                                    <input type="text" id="stk-note" placeholder="jaise: Bill No 120 / Mandi Se" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; box-sizing:border-box;">
                                </div>

                                <!-- Live Stock Indicator Banner -->
                                <div style="background:#f0fdf4; border:1.5px dashed #86efac; border-radius:8px; padding:12px; text-align:center;">
                                    <div style="font-size:11px; color:#64748b; font-weight:bold;">गोदाम में मौजूदा बचा स्टॉक:</div>
                                    <div id="stk-live-bacha-display" style="font-size:22px; font-weight:900; color:#059669; margin-top:2px;">
                                        0.00 Kg
                                    </div>
                                    <div id="stk-live-hint" style="font-size:11px; color:#64748b; margin-top:3px;">
                                        नाम चुनते ही स्टॉक यहाँ दिखेगा
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer Action Bar -->
                <div style="background:#f1f5f9; padding:12px 18px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div id="stk-status-msg" style="font-size:12px; font-weight:bold; color:#059669;"></div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" id="stk-print-btn" onclick="printLastSavedStockSlip()" style="background:#1e3a8a; color:#ffffff; border:none; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            🖨️ A6 Parchi [Alt+P]
                        </button>
                        <button type="button" id="stk-submit-btn" onclick="submitMasterStockExpress()" style="background:#059669; color:#ffffff; border:none; padding:11px 26px; border-radius:8px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 4px 6px rgba(5,150,105,0.3); display:inline-flex; align-items:center; gap:8px;">
                            💾 स्टॉक जमा करें [ ENTER ]
                        </button>
                    </div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        bindStockExpressEvents();
    };

    // 2. KEYBOARD LISTENERS & SHORTCUT FIX (CAPTURE PHASE + STOP PROPAGATION)
    const bindStockExpressEvents = () => {
        const modal = document.getElementById('master-stock-express-modal');
        if (!modal) return;

        const nameInp = document.getElementById('stk-item-name');
        const qtyInp = document.getElementById('stk-qty');

        setTimeout(() => { if (nameInp) nameInp.focus(); }, 120);

        // Enter Chaining between Inputs
        const allInputs = modal.querySelectorAll('input[data-next]');
        allInputs.forEach((inp) => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextId = inp.getAttribute('data-next');
                    const nextEl = document.getElementById(nextId);
                    if (nextEl) {
                        nextEl.focus();
                        if (typeof nextEl.select === 'function') nextEl.select();
                    }
                }
            });
        });

        // Enter on QTY saves immediately
        if (qtyInp) {
            qtyInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitMasterStockExpress();
                }
            });
        }

        // Live Stock Update on Input
        if (nameInp) {
            nameInp.addEventListener('input', updateStockExpressLiveStats);
        }

        // ⭐ CAPTURE PHASE (`true`) SE BIND KIYA HAI TAHO KARIGER EXPRESS CONFLICT NA HO
        window.removeEventListener('keydown', handleStockExpressGlobalKeydown, true);
        window.addEventListener('keydown', handleStockExpressGlobalKeydown, true);
    };

    // 🔹 FIXED SHORTCUT HANDLER (STRICT CAPTURE + STOP PROPAGATION)
    const handleStockExpressGlobalKeydown = (e) => {
        const modal = document.getElementById('master-stock-express-modal');
        if (!modal || modal.style.display === 'none') return;

        // Escape to Close
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            closeStockExpressModal();
            return;
        }

        // ⭐ F1 or Alt+1 -> Bana (Kariger Express ko 100% block kiya)
        if (e.key === 'F1' || (e.altKey && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('bana');
            return;
        }

        // ⭐ F2 or Alt+2 -> Zari
        if (e.key === 'F2' || (e.altKey && (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('zari');
            return;
        }

        // ⭐ F3 or Alt+3 -> Sancha
        if (e.key === 'F3' || (e.altKey && (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3'))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            switchStockCategory('sancha');
            return;
        }

        // ⭐ F4 -> Toggle Purana / Naya
        if (e.key === 'F4') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            setStockExpressMode(stockMode === 'purana' ? 'naya' : 'purana');
            return;
        }

        // Alt+P -> Print
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            printLastSavedStockSlip();
            return;
        }
    };

    window.closeStockExpressModal = () => {
        window.removeEventListener('keydown', handleStockExpressGlobalKeydown, true);
        const modal = document.getElementById('master-stock-express-modal');
        if (modal) modal.remove();
    };

    // 3. CATEGORY & MODE SWITCHERS
    window.switchStockCategory = (cat) => {
        activeCategory = cat;
        const btnB = document.getElementById('stk-cat-bana');
        const btnZ = document.getElementById('stk-cat-zari');
        const btnS = document.getElementById('stk-cat-sancha');
        const boxSancha = document.getElementById('stk-box-sancha');
        const submitBtn = document.getElementById('stk-submit-btn');
        const col1Title = document.getElementById('stk-col1-title');
        const dl = document.getElementById('stk-items-dl');
        const nameInp = document.getElementById('stk-item-name');

        const { banaOpts, zariOpts, sanchaOpts } = getStockExpressDatalists();

        [btnB, btnZ, btnS].forEach(b => {
            if (b) { b.style.background = '#f1f5f9'; b.style.color = '#475569'; b.style.border = '1px solid #cbd5e1'; }
        });

        if (cat === 'bana') {
            if (btnB) { btnB.style.background = '#059669'; btnB.style.color = '#fff'; btnB.style.border = 'none'; }
            if (boxSancha) boxSancha.style.display = 'none';
            if (submitBtn) submitBtn.style.background = '#059669';
            if (col1Title) { col1Title.style.color = '#059669'; col1Title.textContent = '🧶 Bana Ki Jankari'; }
            if (dl) dl.innerHTML = banaOpts;
            document.getElementById('stk-lbl-purana').textContent = 'बाना का नाम (1-2 अक्षर लिखें):';
            document.getElementById('stk-lbl-naya').textContent = 'नए बाना का पूरा नाम:';
        } else if (cat === 'zari') {
            if (btnZ) { btnZ.style.background = '#ea580c'; btnZ.style.color = '#fff'; btnZ.style.border = 'none'; }
            if (boxSancha) boxSancha.style.display = 'none';
            if (submitBtn) submitBtn.style.background = '#ea580c';
            if (col1Title) { col1Title.style.color = '#ea580c'; col1Title.textContent = '✨ Zari Ki Jankari'; }
            if (dl) dl.innerHTML = zariOpts;
            document.getElementById('stk-lbl-purana').textContent = 'जरी का नाम (1-2 अक्षर लिखें):';
            document.getElementById('stk-lbl-naya').textContent = 'नई जरी का पूरा नाम:';
        } else if (cat === 'sancha') {
            if (btnS) { btnS.style.background = '#0284c7'; btnS.style.color = '#fff'; btnS.style.border = 'none'; }
            if (boxSancha) boxSancha.style.display = 'block';
            if (submitBtn) submitBtn.style.background = '#0284c7';
            if (col1Title) { col1Title.style.color = '#0284c7'; col1Title.textContent = '⚙️ Sancha Ki Jankari'; }
            if (dl) dl.innerHTML = sanchaOpts;
            document.getElementById('stk-lbl-purana').textContent = 'साँचा/तानी का नाम (1-2 अक्षर लिखें):';
            document.getElementById('stk-lbl-naya').textContent = 'नए साँचे का पूरा नाम:';
        }

        if (nameInp) {
            nameInp.value = '';
            nameInp.focus();
        }
        updateStockExpressLiveStats();
    };

    window.setStockExpressMode = (mode) => {
        stockMode = mode;
        const btnP = document.getElementById('stk-mode-purana');
        const btnN = document.getElementById('stk-mode-naya');
        const boxP = document.getElementById('stk-box-purana');
        const boxN = document.getElementById('stk-box-naya');

        if (mode === 'purana') {
            if (btnP) { btnP.style.background = '#1e3a8a'; btnP.style.color = '#fff'; }
            if (btnN) { btnN.style.background = '#f1f5f9'; btnN.style.color = '#475569'; }
            if (boxP) boxP.style.display = 'block';
            if (boxN) boxN.style.display = 'none';
            document.getElementById('stk-item-name')?.focus();
        } else {
            if (btnP) { btnP.style.background = '#f1f5f9'; btnP.style.color = '#475569'; }
            if (btnN) { btnN.style.background = '#10b981'; btnN.style.color = '#fff'; }
            if (boxP) boxP.style.display = 'none';
            if (boxN) boxN.style.display = 'block';
            document.getElementById('stk-new-name')?.focus();
        }
    };

    window.setSanchaCategory = (cat) => {
        sanchaCat = cat;
        updateStockExpressLiveStats();
    };

    // 4. LIVE STOCK CHECKER
    const updateStockExpressLiveStats = () => {
        const val = document.getElementById('stk-item-name')?.value.trim();
        const disp = document.getElementById('stk-live-bacha-display');
        const hint = document.getElementById('stk-live-hint');
        const targetKid = (typeof window.getActiveKarkhanaId === 'function') 
            ? window.getActiveKarkhanaId() 
            : (window.currentDashboardKarkhanaFilter || 'k_main');

        if (!val) {
            if (disp) disp.textContent = '0.00 Kg';
            if (hint) hint.textContent = 'नाम चुनते ही स्टॉक यहाँ दिखेगा';
            return;
        }

        let bacha = 0;
        if (activeCategory === 'bana' && typeof window.getBanaItemStats === 'function') {
            bacha = safeNum(window.getBanaItemStats(val, targetKid).bacha);
        } else if (activeCategory === 'zari' && typeof window.getZariItemStats === 'function') {
            bacha = safeNum(window.getZariItemStats(val, targetKid).bacha);
        } else if (activeCategory === 'sancha' && typeof window.getSanchaItemStats === 'function') {
            bacha = safeNum(window.getSanchaItemStats(null, val, sanchaCat, targetKid).bacha);
        }

        if (disp) disp.textContent = `${bacha.toFixed(2)} Kg`;
        if (hint) hint.textContent = `मौजूदा गोदाम में उपलब्ध स्टॉक`;
    };

    // 5. ATOMIC SUBMIT (SAVES TO BANA / ZARI / SANCHA REGISTERS)
    window.submitMasterStockExpress = () => {
        const date = document.getElementById('stk-date')?.value || getToday();
        const isNew = (stockMode === 'naya');

        const nameInp = isNew ? document.getElementById('stk-new-name') : document.getElementById('stk-item-name');
        const name = String(nameInp?.value || '').trim();
        const qty = safeNum(document.getElementById('stk-qty')?.value);
        const note = String(document.getElementById('stk-note')?.value || '').trim();
        const targetKid = (typeof window.getActiveKarkhanaId === 'function') 
            ? window.getActiveKarkhanaId() 
            : (window.currentDashboardKarkhanaFilter || 'k_main');

        if (!name) {
            alert('कृपया आइटम का सही नाम लिखिए!');
            nameInp?.focus();
            return;
        }

        if (qty <= 0) {
            alert('कृपया सही वज़न (Kg me) भरिए!');
            document.getElementById('stk-qty')?.focus();
            return;
        }

        const now = Date.now();

        // --- 1. BANA INWARD ---
        if (activeCategory === 'bana') {
            const list = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                item.date = date;
            } else {
                list.push({
                    id: `bana_${now}`,
                    date, name, aaya: qty, gaya: 0, bacha: qty,
                    karkhanaId: targetKid, timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('bana_stock', list);

            const hist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
            hist.push({
                id: `bhist_${now}`,
                date, name,
                kariger: note || 'Godown Purchase',
                type: 'Khareed (Inward)',
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('bana_history', hist);

            if (typeof window.renderBanaTable === 'function') window.renderBanaTable();

        // --- 2. ZARI INWARD ---
        } else if (activeCategory === 'zari') {
            const list = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                item.date = date;
            } else {
                list.push({
                    id: `zari_${now}`,
                    date, name, aaya: qty, gaya: 0, bacha: qty,
                    karkhanaId: targetKid, timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('zari_stock', list);

            const hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
            hist.push({
                id: `zhist_${now}`,
                date, name,
                kariger: note || 'Godown Purchase',
                type: 'Khareed (Inward)',
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

            if (typeof window.renderZariTable === 'function') window.renderZariTable();

        // --- 3. SANCHA (TANI/CHUKKA) INWARD ---
        } else if (activeCategory === 'sancha') {
            const person = String(document.getElementById('stk-sancha-person')?.value || '').trim();
            const category = sanchaCat;
            const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];

            const item = list.find((x) => {
                const cat = x.category || 'tani';
                const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === name.toLowerCase() && cat.toLowerCase() === category.toLowerCase() && matchK;
            });

            if (item) {
                item.aaya = safeNum((safeNum(item.aaya) + qty).toFixed(2));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                if (person) item.person = person;
                item.date = date;
            } else {
                list.push({
                    id: `sancha_${now}`,
                    date, name, category,
                    aaya: qty, gaya: 0, bacha: qty,
                    person: person || '-',
                    karkhanaId: targetKid,
                    timestamp: now
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_items', list);

            const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
            hist.push({
                id: `shist_${now}`,
                date, name, category,
                kariger: person || note || 'Factory Inward',
                type: `Khareed / Inward (${category === 'tani' ? 'Tani' : 'Chukka'})`,
                aaya: qty, gaya: 0,
                karkhanaId: targetKid,
                isOpening: false,
                timestamp: now
            });
            if (typeof window.setStore === 'function') window.setStore('sancha_history', hist);

            if (typeof window.renderSanchaTable === 'function') window.renderSanchaTable();
        }

        // Cache Transaction for A6 Print
        lastSavedStockEntry = {
            category: activeCategory.toUpperCase(),
            name: name,
            qty: qty,
            date: date,
            kGodown: targetKid,
            note: note || '-'
        };

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        // Clear Inputs & Re-focus for next item
        document.getElementById('stk-qty').value = '';
        document.getElementById('stk-note').value = '';
        if (nameInp) {
            nameInp.value = '';
            nameInp.focus();
        }

        const catTitle = activeCategory === 'bana' ? 'बाना' : (activeCategory === 'zari' ? 'जरी' : 'साँचा');
        const statusMsg = document.getElementById('stk-status-msg');
        if (statusMsg) {
            statusMsg.innerHTML = `✅ <strong>${esc(name)}</strong> (+${qty.toFixed(2)} Kg ${catTitle}) स्टॉक में जमा हो गया!`;
        }

        updateStockExpressLiveStats();
    };

    // 6. A6 THERMAL PRINT SLIP
    window.printLastSavedStockSlip = () => {
        if (!lastSavedStockEntry) return alert('प्रिंट करने के लिए कोई रीसेंट एंट्री नहीं मिली!');

        const t = lastSavedStockEntry;
        const kName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(t.kGodown) : 'Main Godown';

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup blocked hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Stock Voucher - ${esc(t.name)}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
                    .highlight { background: #eee; border: 1px solid #000; padding: 6px; font-size: 14px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>⚡ कच्चा माल आवक पर्ची (STOCK VOUCHER)</p>
                    </div>
                    <div class="row"><span><strong>तारीख:</strong></span><span>${esc(t.date)}</span></div>
                    <div class="row"><span><strong>गोदाम:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>कैटेगरी:</strong></span><span>${esc(t.category)}</span></div>
                    <div class="row"><span><strong>आइटम का नाम:</strong></span><span><strong>${esc(t.name)}</strong></span></div>
                    <div class="row"><span><strong>नोट / सप्लायर:</strong></span><span>${esc(t.note)}</span></div>
                    <div class="highlight">
                        जमा वज़न: +${t.qty.toFixed(2)} Kg
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>___________</div>
                        <div>हस्ताक्षर लाने वाला<br><br>___________</div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 600);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

})();
