/* ============================================================================
   SIMPLICITY ERP - ⚡ MASTER KARIGER EXPRESS ENGINE (AUTO-TANI & BADA COUNTER)
   Folder: kariger-express / File: kariger-express.js
   Developed for: Farhan Jawed
   Features:
   - Auto-Tani Detection: Target (65/70/72) Poori Hote Hi Nayi Tani Auto-Create & Alert!
   - Auto Carry-Forward: Bacha Bana, Bachi Zari & Baki Mazdoori Nayi Tani Me Transfer
   - Spacious & Legible Inputs (No Up/Down Spinner Arrows on Qty)
   - Zero-Mouse Rapid Enter Chaining & Instant A6 Thermal Print
============================================================================ */

(() => {
    'use strict';

    let selectedKariger = null;
    let currentActiveSheet = null;
    let activeSheetIndex = 0;
    let prevDeliveredSarees = 0;
    let lastSavedTransaction = null;

    /* ========================================================================
       1. SAFE HELPERS & DATA STORES
       ------------------------------------------------------------------------
    ======================================================================== */
    const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof window.safeArray === 'function') return window.safeArray(v);
        return [];
    };

    const getFromStore = (key) => {
        if (typeof window.getStore === 'function') return window.getStore(key);
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch {
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

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];
    };

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function') 
            ? window.formatDateDisplay(d) 
            : (d || '-');
    };

    const normText = (txt, fallback = '') => {
        return String(txt || fallback).trim().toUpperCase();
    };

    // Live Godown Stock Helpers
    const getBanaStockBacha = (itemName, kGodown) => {
        if (!itemName) return 0;
        if (typeof window.getBanaItemStats === 'function') {
            return safeNum(window.getBanaItemStats(itemName, kGodown).bacha);
        }
        const raw = toArray(getFromStore('bana_stock'));
        const item = raw.find(x => x && x.name && x.name.toLowerCase() === itemName.toLowerCase() && 
            ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
        return item ? safeNum(item.bacha) : 0;
    };

    const getZariStockBacha = (itemName, kGodown) => {
        if (!itemName) return 0;
        if (typeof window.getZariItemStats === 'function') {
            return safeNum(window.getZariItemStats(itemName, kGodown).bacha);
        }
        const raw = toArray(getFromStore('zari_stock'));
        const item = raw.find(x => x && x.name && x.name.toLowerCase() === itemName.toLowerCase() && 
            ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
        return item ? safeNum(item.bacha) : 0;
    };

    // Auto-Build Datalists (Kariger, Bana, Zari, Sancha Tani, Sancha Chukka)
    const getKarigerExpressDatalists = () => {
        const rawKarigers = toArray(getFromStore('kariger_list'));
        let kOpts = '';
        rawKarigers.forEach((k) => {
            if (k && k.name) {
                const sDesign = k.saree ? ` [${k.saree}]` : '';
                kOpts += `<option value="${esc(k.name)}">${esc(k.name)}${esc(sDesign)}</option>`;
            }
        });

        const rawBana = toArray(getFromStore('bana_stock'));
        const uB = [];
        let bOpts = '';
        rawBana.forEach((b) => {
            if (b && b.name && uB.indexOf(b.name.trim().toLowerCase()) === -1) {
                uB.push(b.name.trim().toLowerCase());
                bOpts += `<option value="${esc(b.name.trim())}">`;
            }
        });

        const rawZari = toArray(getFromStore('zari_stock'));
        const uZ = [];
        let zOpts = '';
        rawZari.forEach((z) => {
            if (z && z.name && uZ.indexOf(z.name.trim().toLowerCase()) === -1) {
                uZ.push(z.name.trim().toLowerCase());
                zOpts += `<option value="${esc(z.name.trim())}">`;
            }
        });

        const rawSancha = toArray(getFromStore('sancha_items'));
        let taniOpts = '';
        let chukkaOpts = '';
        const uT = [], uC = [];

        rawSancha.forEach((s) => {
            if (!s || !s.name) return;
            const cat = String(s.category || 'tani').toLowerCase();
            const bacha = safeNum(s.bacha !== undefined ? s.bacha : s.aaya);
            if (cat === 'tani' && uT.indexOf(s.name.trim().toLowerCase()) === -1) {
                uT.push(s.name.trim().toLowerCase());
                taniOpts += `<option value="${esc(s.name.trim())}">${esc(s.name.trim())} (Bacha: ${bacha.toFixed(2)} Kg)</option>`;
            } else if (cat === 'chukka' && uC.indexOf(s.name.trim().toLowerCase()) === -1) {
                uC.push(s.name.trim().toLowerCase());
                chukkaOpts += `<option value="${esc(s.name.trim())}">${esc(s.name.trim())} (Bacha: ${bacha.toFixed(2)} Kg)</option>`;
            }
        });

        return { kOpts, bOpts, zOpts, taniOpts, chukkaOpts };
    };

    // Sancha Stock Deduction Engine
    const deductSanchaStockItem = (itemName, category, wazan, kGodown, refKey, kName) => {
        if (!itemName || !wazan || wazan <= 0) return;
        const sList = toArray(getFromStore('sancha_items'));
        const found = sList.find((x) => {
            const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() && 
                   String(x.category || 'tani').toLowerCase() === category.toLowerCase() && matchKid;
        });

        if (found) {
            found.gaya = Math.max(0, safeNum((safeNum(found.gaya) + safeNum(wazan)).toFixed(2)));
            found.bacha = safeNum((safeNum(found.aaya) - found.gaya).toFixed(2));
            setToStore('sancha_items', sList);
        }

        let sHist = toArray(getFromStore('sancha_history'));
        sHist.push({
            id: `shist_${Date.now()}_${category.charAt(0)}`,
            refId: refKey,
            date: getToday(),
            category: category,
            name: itemName,
            kariger: kName,
            type: `Kariger Issue (${category === 'tani' ? 'Tani' : 'Chukka'})`,
            aaya: 0,
            gaya: safeNum(wazan),
            karkhanaId: kGodown,
            timestamp: Date.now()
        });
        setToStore('sancha_history', sHist);
    };

    /* ========================================================================
       2. OPEN KARIGER EXPRESS COUNTER (BADA & KHULA 960px LAYOUT)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.openKarigerExpressModal = () => {
        const existing = document.getElementById('kariger-express-modal');
        if (existing) existing.remove();

        selectedKariger = null;
        currentActiveSheet = null;
        activeSheetIndex = 0;
        prevDeliveredSarees = 0;
        lastSavedTransaction = null;

        const { kOpts, bOpts, zOpts } = getKarigerExpressDatalists();
        const today = getToday();

        const modalHtml = `
        <div id="kariger-express-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; padding:10px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:960px; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.65); overflow:hidden; font-family:sans-serif; max-height:97vh; display:flex; flex-direction:column;">
                
                <!-- Modal Top Header -->
                <div style="background:#0f172a; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;">⚡</span>
                        <h3 style="margin:0; font-size:17px; font-weight:800; letter-spacing:0.5px;">KARIGER EXPRESS • कारीगर बैठक काउन्टर</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; background:#1e293b; color:#38bdf8; padding:4px 10px; border-radius:6px; font-weight:bold;">[Alt+C] Naya Kariger | [Enter] Next | [F2] Search | [Alt+P] Print</span>
                        <button type="button" onclick="closeKarigerExpressModal()" style="background:transparent; border:none; color:#fff; font-size:26px; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                </div>

                <!-- Form Body -->
                <div style="padding:16px 20px; overflow-y:auto; flex:1;">
                    
                    <!-- Row 1: Date & Kariger Selector with Alt+C Button -->
                    <div style="display:grid; grid-template-columns:160px 1fr auto; gap:12px; margin-bottom:14px; align-items:flex-end;">
                        <div>
                            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">तारीख (Date):</label>
                            <input type="date" id="kexp-date" value="${today}" data-next="kexp-kariger-input" style="width:100%; padding:11px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <label style="font-size:12px; font-weight:bold; color:#1e3a8a;">कारीगर का नाम चुनें (F2 Search):</label>
                                <span style="font-size:11px; color:#64748b;">(Naya banane ke liye Alt+C)</span>
                            </div>
                            <input type="text" id="kexp-kariger-input" list="kexp-kariger-dl" data-next="kexp-saree-qty" placeholder="Kariger naam likhein..." autocomplete="off" style="width:100%; padding:11px 14px; border:2px solid #2563eb; border-radius:8px; font-size:16px; font-weight:bold; box-sizing:border-box; background:#eff6ff; color:#0f172a;">
                            <datalist id="kexp-kariger-dl">${kOpts}</datalist>
                        </div>
                        <div>
                            <button type="button" id="kexp-btn-alt-c" onclick="openAltCKarigerModal()" style="background:#10b981; color:#fff; border:none; padding:12px 18px; border-radius:8px; font-weight:900; font-size:14px; cursor:pointer; white-space:nowrap; box-shadow:0 3px 6px rgba(16,185,129,0.3);">
                                ➕ Naya Kariger [Alt+C]
                            </button>
                        </div>
                    </div>

                    <!-- TANI SELECTION TABS & NEW TANI BUTTON -->
                    <div id="kexp-tani-tabs-bar" style="display:none; margin-bottom:12px; background:#f1f5f9; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <div id="kexp-tani-chips-container" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;"></div>
                        <button type="button" onclick="openExpressNewTaniModal()" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                            ➕ Nayi Tani [Alt+N]
                        </button>
                    </div>

                    <!-- Live Weaver Snapshot Banner -->
                    <div id="kexp-weaver-banner" style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:16px;">
                        <span style="font-size:13px; color:#64748b;">कारीगर चुनिए, तानी का पूरा हिसाब और कलर यहाँ दिखेंगे...</span>
                    </div>

                    <!-- 3-Column Express Grid -->
                    <div style="display:grid; grid-template-columns:1fr 1fr 1.15fr; gap:14px;">
                        
                        <!-- COLUMN 1: SAREE & RETURN -->
                        <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:10px; padding:14px;">
                            <h4 style="margin:0 0 12px 0; color:#065f46; font-size:14px; border-bottom:1.5px solid #a7f3d0; padding-bottom:6px;">📦 माल आया (Inward)</h4>
                            
                            <div style="margin-bottom:10px;">
                                <label style="font-size:12px; font-weight:bold; color:#065f46; display:block; margin-bottom:3px;">साड़ी संख्या (Pcs):</label>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-saree-qty" data-next="kexp-saree-lott" placeholder="0" oninput="calculateKarigerExpressLive()" style="width:100%; padding:10px 12px; border:2.5px solid #10b981; border-radius:8px; font-size:20px; font-weight:900; color:#065f46; box-sizing:border-box; background:#ffffff; text-align:center;">
                            </div>
                            <div style="margin-bottom:10px;">
                                <label style="font-size:11px; font-weight:bold; color:#b91c1c; display:block; margin-bottom:3px;">लॉट / कट साड़ी (Pcs):</label>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-saree-lott" data-next="kexp-ret-bana" placeholder="0" oninput="calculateKarigerExpressLive()" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:15px; font-weight:bold; color:#dc2626; box-sizing:border-box; background:#ffffff; text-align:center;">
                            </div>
                            <div style="margin-bottom:10px;">
                                <label style="font-size:11px; font-weight:bold; color:#374151; display:block; margin-bottom:3px;">बचा बाना वापसी (Kg):</label>
                                <input type="text" inputmode="decimal" id="kexp-ret-bana" data-next="kexp-ret-zari" placeholder="0.00" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#374151; display:block; margin-bottom:3px;">बची जरी वापसी (Kg):</label>
                                <input type="text" inputmode="decimal" id="kexp-ret-zari" data-next="kexp-bana-name" placeholder="0.00" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                            </div>
                        </div>

                        <!-- COLUMN 2: BANA & ZARI ISSUE -->
                        <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; padding:14px;">
                            <h4 style="margin:0 0 12px 0; color:#1e40af; font-size:14px; border-bottom:1.5px solid #bfdbfe; padding-bottom:6px;">🧶 कच्चा माल दिया (Outward)</h4>
                            
                            <div style="margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                                    <label style="font-size:11px; font-weight:bold; color:#374151;">बाना आइटम चुनें:</label>
                                    <small id="kexp-live-bana-badge" style="color:#059669; font-weight:bold; font-size:11px;">Bacha: 0.00 Kg</small>
                                </div>
                                <input type="text" id="kexp-bana-name" list="kexp-bana-dl" data-next="kexp-bana-cone" placeholder="Bana..." oninput="updateExpressStockBadges()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                <datalist id="kexp-bana-dl">${bOpts}</datalist>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">Bana Gross:</label>
                                    <input type="text" inputmode="decimal" id="kexp-bana-cone" data-next="kexp-bana-lesstp" placeholder="0.00" oninput="calculateKarigerExpressLive()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#dc2626; display:block; margin-bottom:3px;">Less TP:</label>
                                    <input type="text" inputmode="decimal" id="kexp-bana-lesstp" data-next="kexp-zari-name" placeholder="0.00" oninput="calculateKarigerExpressLive()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                </div>
                            </div>

                            <div style="margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                                    <label style="font-size:11px; font-weight:bold; color:#374151;">जरी आइटम चुनें:</label>
                                    <small id="kexp-live-zari-badge" style="color:#ea580c; font-weight:bold; font-size:11px;">Bacha: 0.00 Kg</small>
                                </div>
                                <input type="text" id="kexp-zari-name" list="kexp-zari-dl" data-next="kexp-zari-qty" placeholder="Zari..." oninput="updateExpressStockBadges()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                <datalist id="kexp-zari-dl">${zOpts}</datalist>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">Zari Gross:</label>
                                    <input type="text" inputmode="decimal" id="kexp-zari-qty" data-next="kexp-zari-topi" placeholder="0.00" oninput="calculateKarigerExpressLive()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#dc2626; display:block; margin-bottom:3px;">Topi Less:</label>
                                    <input type="text" inputmode="decimal" id="kexp-zari-topi" data-next="kexp-paid-amount" placeholder="0.00" oninput="calculateKarigerExpressLive()" style="width:100%; padding:9px 10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box; background:#ffffff;">
                                </div>
                            </div>
                        </div>

                        <!-- COLUMN 3: MAZDOORI & ROKAD -->
                        <div style="background:#fff7ed; border:1.5px solid #fed7aa; border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 12px 0; color:#9a3412; font-size:14px; border-bottom:1.5px solid #fed7aa; padding-bottom:6px;">💰 मजदूरी व रोकड़ हिसाब</h4>
                                
                                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                                    <span>बानी रेट (प्रति साड़ी):</span>
                                    <strong id="kexp-disp-bani-rate">₹ 0.00</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:10px;">
                                    <span>आज की मजदूरी (Gross):</span>
                                    <strong id="kexp-disp-gross-bani" style="color:#059669; font-size:14px;">₹ 0.00</strong>
                                </div>

                                <div style="margin-bottom:12px;">
                                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">आज रोकड़ / खर्चे दिया (₹):</label>
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" id="kexp-paid-amount" placeholder="₹0" oninput="calculateKarigerExpressLive()" style="width:100%; padding:10px 12px; border:2.5px solid #ea580c; border-radius:8px; font-size:18px; font-weight:900; color:#c2410c; box-sizing:border-box; background:#ffffff;">
                                </div>

                                <div style="background:#ffffff; border:2px dashed #fdba74; border-radius:8px; padding:10px; text-align:center;">
                                    <div style="font-size:12px; color:#64748b; font-weight:bold;">कारीगर का अंतिम बाकी रुपया:</div>
                                    <div id="kexp-disp-net-balance" style="font-size:22px; font-weight:900; color:#1e3a8a; margin-top:3px;">₹ 0.00</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer Action Bar -->
                <div style="background:#f1f5f9; padding:12px 20px; border-top:1.5px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div id="kexp-status-msg" style="font-size:13px; font-weight:bold; color:#059669;"></div>
                    <div style="display:flex; gap:10px;">
                        <button type="button" id="kexp-print-btn" onclick="printLastSavedExpressSlip()" style="background:#1e3a8a; color:#ffffff; border:none; padding:11px 18px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            🖨️ A6 Parchi [Alt+P]
                        </button>
                        <button type="button" id="kexp-submit-btn" onclick="submitKarigerExpress()" style="background:#059669; color:#ffffff; border:none; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 4px 6px rgba(5,150,105,0.3); display:inline-flex; align-items:center; gap:8px;">
                            💾 पक्का करें & पर्ची [ ENTER ]
                        </button>
                    </div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        bindKarigerExpressEvents();
    };

    /* ========================================================================
       3. TANI SELECTION & SWITCHER BAR
       ------------------------------------------------------------------------
    ======================================================================== */
    const renderKarigerExpressTaniTabs = () => {
        const bar = document.getElementById('kexp-tani-tabs-bar');
        const container = document.getElementById('kexp-tani-chips-container');
        if (!bar || !container || !selectedKariger) {
            if (bar) bar.style.display = 'none';
            return;
        }

        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        if (!sheets.length) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        let html = '';

        sheets.forEach((sh, idx) => {
            const isActive = (idx === activeSheetIndex);
            html += `<button type="button" onclick="switchExpressTaniSheet(${idx})" style="background:${isActive ? '#2563eb' : '#ffffff'}; color:${isActive ? '#ffffff' : '#334155'}; border:1px solid ${isActive ? '#1d4ed8' : '#cbd5e1'}; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                ${esc(sh.title || `Tani ${idx + 1}`)}
            </button>`;
        });

        container.innerHTML = html;
    };

    window.switchExpressTaniSheet = (idx) => {
        activeSheetIndex = idx;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        currentActiveSheet = sheets[idx] || sheets[sheets.length - 1];

        renderKarigerExpressTaniTabs();
        updateWeaverBannerSnapshot();
        calculateKarigerExpressLive();
    };

    const updateWeaverBannerSnapshot = () => {
        const banner = document.getElementById('kexp-weaver-banner');
        if (!banner || !selectedKariger || !currentActiveSheet) return;

        const k = selectedKariger;
        const calc = (typeof window.calculateSheetTotals === 'function') 
            ? window.calculateSheetTotals(currentActiveSheet) 
            : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

        prevDeliveredSarees = safeNum(calc.totSaree);

        const rateBani = safeNum(currentActiveSheet.rateBani, 240);
        const totalTaniTarget = safeNum(currentActiveSheet.taniPcs, 72);
        
        const taniSancha = currentActiveSheet.taniSancha || 'N/A';
        const chukkaSancha = currentActiveSheet.chukkaSancha || 'N/A';
        const taniItem = currentActiveSheet.taniItem || 'Tani';

        const colorsArr = Array.isArray(currentActiveSheet.colors) ? currentActiveSheet.colors : [];
        let colorsHtml = '';
        if (colorsArr.length) {
            colorsArr.forEach((c, idx) => {
                if (c && String(c).trim()) {
                    colorsHtml += `<span style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:11px; font-weight:bold; padding:2px 7px; border-radius:4px;">${idx + 1}. ${esc(c)}</span> `;
                }
            });
        }
        if (!colorsHtml) colorsHtml = `<span style="color:#94a3b8; font-size:11px;">Color matching set nahi hai</span>`;

        if (currentActiveSheet.banaItem && !document.getElementById('kexp-bana-name').value) {
            document.getElementById('kexp-bana-name').value = currentActiveSheet.banaItem;
        }
        if (currentActiveSheet.zariItem && !document.getElementById('kexp-zari-name').value) {
            document.getElementById('kexp-zari-name').value = currentActiveSheet.zariItem;
        }

        updateExpressStockBadges();

        banner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                <span style="font-size:14px; font-weight:bold; color:#1e3a8a;">👤 ${esc(k.name)} (${esc(k.saree || 'Satan')})</span>
                <span style="font-size:12px; color:#475569;">
                    🧵 <strong>${esc(currentActiveSheet.title || 'Tani')}</strong> | 
                    ⚙️ साँचा: <strong>${esc(taniSancha)}</strong> (${esc(taniItem)}) | 
                    चुक्का: <strong>${esc(chukkaSancha)}</strong>
                </span>
                <span style="font-size:12.5px; color:#b45309;">पिछला बकाया: <strong>₹ ${safeNum(calc.remainingAmt).toFixed(2)}</strong></span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div id="kexp-live-tani-progress" style="font-size:13px;">
                    🎯 कुल तानी: <strong>${totalTaniTarget} Pcs</strong> | 📥 अब तक आई: <strong style="color:#059669;">${prevDeliveredSarees} Pcs</strong> | ⏳ बाकी: <strong style="color:#dc2626;">${Math.max(0, totalTaniTarget - prevDeliveredSarees)} Pcs</strong>
                </div>
                <div style="font-size:12px;">
                    बचा बाना: <strong style="color:#059669;">${safeNum(calc.remainingBana).toFixed(2)} Kg</strong> | 
                    बची जरी: <strong style="color:#ea580c;">${safeNum(calc.remainingZari).toFixed(2)} Kg</strong>
                </div>
            </div>
            <div style="margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-size:11px; font-weight:bold; color:#475569;">🎨 8 Colors:</span>
                ${colorsHtml}
            </div>
        `;
        document.getElementById('kexp-disp-bani-rate').textContent = `₹ ${rateBani.toFixed(2)}`;
    };

    /* ========================================================================
       4. ⚡ ALT + C MODAL: NEW WEAVER SETUP
       ------------------------------------------------------------------------
    ======================================================================== */
    window.openAltCKarigerModal = () => {
        const existing = document.getElementById('alt-c-kariger-modal');
        if (existing) existing.remove();

        const { taniOpts, chukkaOpts } = getKarigerExpressDatalists();
        const activeKid = (selectedKariger && selectedKariger.karkhanaId) ? selectedKariger.karkhanaId : 'k_main';

        let karkhanas = (typeof window.getKarkhanasSafe === 'function') 
            ? window.getKarkhanasSafe() 
            : toArray(getFromStore('karkhana_list'));
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        let karkhanaOptions = '';
        karkhanas.forEach((k) => {
            const isSel = (String(k.id) === String(activeKid));
            karkhanaOptions += `<option value="${esc(k.id)}" ${isSel ? 'selected' : ''}>${k.id === 'k_main' ? '🏢 ' : '🏭 '}${esc(k.name)}</option>`;
        });

        const modalHtml = `
        <div id="alt-c-kariger-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:1000005; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:680px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); overflow:hidden; font-family:sans-serif; max-height:95vh; display:flex; flex-direction:column;">
                
                <div style="background:linear-gradient(135deg, #059669, #0f766e); color:#fff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; font-size:15px; display:flex; align-items:center; gap:6px;">⚡ नया कारीगर व तानी 1 सेटअप <span style="background:#34d399; color:#064e3b; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:800;">Alt + C Mode</span></h3>
                        <small style="color:#a7f3d0; font-size:11px;">[Enter] Next Field | [Ctrl+Enter] Save & Load in Express | [Esc] Close</small>
                    </div>
                    <button type="button" onclick="closeAltCKarigerModal()" style="background:transparent; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
                </div>

                <div style="padding:14px; overflow-y:auto; flex:1;">
                    
                    <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="font-weight:800; color:#0f766e; font-size:12px; margin-bottom:6px;">👤 1. कारीगर की जानकारी:</div>
                        <div style="display:grid; grid-template-columns:1.5fr 1.2fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">कारीगर का पूरा नाम:</label>
                                <input type="text" id="altc-kar-name" placeholder="jaise: Guddu Ansari" autocomplete="off" style="width:100%; padding:8px 10px; border:2px solid #059669; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">साड़ी का नाम (Design):</label>
                                <input type="text" id="altc-kar-saree" placeholder="jaise: Satan / Minakari" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">मोबाइल नंबर:</label>
                                <input type="tel" id="altc-kar-mobile" placeholder="10-digit Mobile" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">गोदाम (Karkhana):</label>
                                <select id="altc-kar-godown" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:bold;">${karkhanaOptions}</select>
                            </div>
                        </div>
                    </div>

                    <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="font-weight:800; color:#1e40af; font-size:12px; margin-bottom:6px;">🧵 2. ताना व साँचा सेटअप (Tani 1):</div>
                        <div style="display:grid; grid-template-columns:1.5fr 1fr 0.8fr 0.8fr; gap:6px; margin-bottom:8px;">
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">Tani Item Chunein:</label>
                                <input type="text" id="altc-tani-item" list="altc-tani-dl" placeholder="Tani Item..." style="width:100%; padding:6px 8px; border:1px solid #93c5fd; border-radius:4px; font-size:11.5px; font-weight:bold; box-sizing:border-box;">
                                <datalist id="altc-tani-dl">${taniOpts}</datalist>
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">साँचा नाम (Maker):</label>
                                <input type="text" id="altc-tani-sancha" placeholder="jaise: Azhar" style="width:100%; padding:6px 8px; border:1px solid #93c5fd; border-radius:4px; font-size:11.5px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">Wazan (Kg):</label>
                                <input type="number" step="0.01" id="altc-tani-wazan" placeholder="0.00" style="width:100%; padding:6px 8px; border:1px solid #93c5fd; border-radius:4px; font-size:11.5px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">🎯 Tani Saree:</label>
                                <input type="number" id="altc-tani-pcs" value="72" style="width:100%; padding:6px 8px; border:1.5px solid #2563eb; border-radius:4px; font-size:12px; font-weight:bold; box-sizing:border-box;">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1.5fr 1fr 0.8fr 0.8fr; gap:6px;">
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#7c3aed;">Chukka Item Chunein:</label>
                                <input type="text" id="altc-chukka-item" list="altc-chukka-dl" placeholder="Chukka Item..." style="width:100%; padding:6px 8px; border:1px solid #d8b4fe; border-radius:4px; font-size:11.5px; font-weight:bold; box-sizing:border-box;">
                                <datalist id="altc-chukka-dl">${chukkaOpts}</datalist>
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#7c3aed;">साँचा नाम (Chukka):</label>
                                <input type="text" id="altc-chukka-sancha" placeholder="jaise: Arman" style="width:100%; padding:6px 8px; border:1px solid #d8b4fe; border-radius:4px; font-size:11.5px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#7c3aed;">Wazan (Kg):</label>
                                <input type="number" step="0.01" id="altc-chukka-wazan" placeholder="0.00" style="width:100%; padding:6px 8px; border:1px solid #d8b4fe; border-radius:4px; font-size:11.5px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#7c3aed;">🎯 Chukka Pcs:</label>
                                <input type="number" id="altc-chukka-pcs" value="72" style="width:100%; padding:6px 8px; border:1.5px solid #7c3aed; border-radius:4px; font-size:12px; font-weight:bold; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <div style="background:#fff7ed; border:1.5px solid #fed7aa; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="font-weight:800; color:#9a3412; font-size:12px; margin-bottom:6px;">💰 3. मजदूरी व कच्चा माल खपत रेट:</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">बानी रेट (₹ प्रति साड़ी):</label>
                                <input type="number" id="altc-rate-bani" value="240" style="width:100%; padding:6px 8px; border:1.5px solid #ea580c; border-radius:4px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">बाना रेट (Kg/साड़ी):</label>
                                <input type="number" step="0.001" id="altc-rate-bana" value="0.311" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:11px; font-weight:bold; color:#334155;">जरी रेट (Kg/साड़ी):</label>
                                <input type="number" step="0.001" id="altc-rate-zari" value="0.110" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; font-weight:bold; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:8px; padding:10px; box-sizing:border-box; width:100%;">
                        <label style="font-size:11px; font-weight:bold; color:#b45309; display:block; margin-bottom:6px;">
                            🎨 Tani Ke 8 Colors (Optional Matching):
                        </label>
                        <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; margin-bottom:6px;">
                            <input type="text" id="altc-col-1" placeholder="1. Rani" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-2" placeholder="2. Lal" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-3" placeholder="3. Mehendi" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-4" placeholder="4. Blue" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px;">
                            <input type="text" id="altc-col-5" placeholder="5. Peela" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-6" placeholder="6. Wine" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-7" placeholder="7. Firozi" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                            <input type="text" id="altc-col-8" placeholder="8. Mungia" style="width:100%; min-width:0; box-sizing:border-box; padding:6px; font-size:11.5px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
                        </div>
                    </div>

                </div>

                <div style="background:#f1f5f9; padding:12px 18px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                    <button type="button" onclick="closeAltCKarigerModal()" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-size:13px; cursor:pointer;">✕ Cancel [Esc]</button>
                    <button type="button" onclick="saveAltCKariger()" style="background:#059669; color:#fff; border:none; padding:9px 24px; border-radius:6px; font-size:14px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(5,150,105,0.3);">
                        💾 Kariger Save & Express me Load [Ctrl+↵]
                    </button>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => { document.getElementById('altc-kar-name')?.focus(); }, 100);
    };

    window.closeAltCKarigerModal = () => {
        const modal = document.getElementById('alt-c-kariger-modal');
        if (modal) modal.remove();
    };

    window.saveAltCKariger = () => {
        const nameInp = document.getElementById('altc-kar-name');
        const name = String(nameInp?.value || '').trim().toUpperCase();
        const saree = String(document.getElementById('altc-kar-saree')?.value || '').trim();
        const mobile = String(document.getElementById('altc-kar-mobile')?.value || '').trim();
        const kGodown = document.getElementById('altc-kar-godown')?.value || 'k_main';

        if (!name) {
            alert('कृपया नए कारीगर का नाम लिखिए!');
            nameInp?.focus();
            return;
        }

        const now = Date.now();
        const newKarigerId = `kar_${now}`;

        // 1. Commit to Kariger List
        const list = toArray(getFromStore('kariger_list'));
        const newKarObj = {
            id: newKarigerId,
            name: name,
            saree: saree || 'General Saree',
            mobile: mobile,
            date: getToday(),
            karkhanaId: kGodown
        };
        list.push(newKarObj);
        setToStore('kariger_list', list);

        // 2. Tani 1 Sheet Setup
        const rateBani = safeNum(document.getElementById('altc-rate-bani')?.value, 240);
        const rateBana = safeNum(document.getElementById('altc-rate-bana')?.value, 0.311);
        const rateZari = safeNum(document.getElementById('altc-rate-zari')?.value, 0.110);
        const taniPcs = safeNum(document.getElementById('altc-tani-pcs')?.value, 72);
        const chukkaPcs = safeNum(document.getElementById('altc-chukka-pcs')?.value, 72);

        const taniItem = String(document.getElementById('altc-tani-item')?.value || '').trim();
        const taniSancha = String(document.getElementById('altc-tani-sancha')?.value || '').trim();
        const taniWazan = safeNum(document.getElementById('altc-tani-wazan')?.value, 0);

        const chukkaItem = String(document.getElementById('altc-chukka-item')?.value || '').trim();
        const chukkaSancha = String(document.getElementById('altc-chukka-sancha')?.value || '').trim();
        const chukkaWazan = safeNum(document.getElementById('altc-chukka-wazan')?.value, 0);

        const colors = [];
        for (let i = 1; i <= 8; i++) {
            const cVal = String(document.getElementById(`altc-col-${i}`)?.value || '').trim();
            if (cVal) colors.push(cVal);
        }

        const newSheetObj = {
            id: 'tani_1',
            title: 'Tani 1',
            pichlaBana: 0,
            pichlaZari: 0,
            pichlaBani: 0,
            banaWaste: 0,
            zariWaste: 0,
            rateBana: rateBana,
            rateZari: rateZari,
            rateBani: rateBani,
            taniPcs: taniPcs,
            chukkaPcs: chukkaPcs,
            taniItem: taniItem,
            taniSancha: taniSancha,
            taniWazan: taniWazan,
            chukkaItem: chukkaItem,
            chukkaSancha: chukkaSancha,
            chukkaWazan: chukkaWazan,
            colors: colors,
            note: 'Naya Kariger (Alt+C Mode)',
            rows: []
        };

        const sheets = [newSheetObj];
        if (typeof window.saveKarigerSheets === 'function') {
            window.saveKarigerSheets(newKarigerId, sheets);
        } else {
            setToStore(`kariger_sheets_${newKarigerId}`, sheets);
        }

        if (taniItem && taniWazan > 0) {
            deductSanchaStockItem(taniItem, 'tani', taniWazan, kGodown, `${newKarigerId}_tani_1_t`, name);
        }
        if (chukkaItem && chukkaWazan > 0) {
            deductSanchaStockItem(chukkaItem, 'chukka', chukkaWazan, kGodown, `${newKarigerId}_tani_1_c`, name);
        }

        closeAltCKarigerModal();

        const kInp = document.getElementById('kexp-kariger-input');
        if (kInp) {
            kInp.value = name;
        }

        selectedKariger = newKarObj;
        currentActiveSheet = newSheetObj;
        activeSheetIndex = 0;

        renderKarigerExpressTaniTabs();
        updateWeaverBannerSnapshot();
        calculateKarigerExpressLive();

        setTimeout(() => {
            const sareeInp = document.getElementById('kexp-saree-qty');
            if (sareeInp) sareeInp.focus();
        }, 150);

        alert(`✅ Naya Kariger [${name}] Tani 1 (${taniPcs} Pcs) ke sath ban gaya aur Express me select ho gaya!`);
    };

    /* ========================================================================
       5. ➕ NAYI TANI MODAL & MANUAL CARRIAGE
       ------------------------------------------------------------------------
    ======================================================================== */
    window.openExpressNewTaniModal = () => {
        if (!selectedKariger || !currentActiveSheet) {
            return alert('Pehle koi Kariger chunein!');
        }

        const existing = document.getElementById('express-new-tani-modal');
        if (existing) existing.remove();

        const { taniOpts, chukkaOpts } = getKarigerExpressDatalists();
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(selectedKariger.id) : [];
        const nextNum = sheets.length + 1;

        const calc = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(currentActiveSheet)
            : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

        const pBana = safeNum(calc.remainingBana);
        const pZari = safeNum(calc.remainingZari);
        const pBani = safeNum(calc.remainingAmt);

        const modalHtml = `
        <div id="express-new-tani-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:1000005; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:600px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); overflow:hidden; font-family:sans-serif; max-height:95vh; display:flex; flex-direction:column;">
                
                <div style="background:#0284c7; color:#fff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:15px;">🧵 Nayi Tani Chadhayein • Tani ${nextNum} (${esc(selectedKariger.name)})</h3>
                    <button type="button" onclick="closeExpressNewTaniModal()" style="background:transparent; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
                </div>

                <div style="padding:14px; overflow-y:auto; flex:1;">
                    
                    <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <div style="font-size:11px; font-weight:bold; color:#15803d; margin-bottom:4px;">📦 Pichli Tani Se Aaya Baki Hisaab (Carry Forward):</div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#166534;">
                            <span>बचा बाना: +${pBana.toFixed(2)} Kg</span>
                            <span>बची जरी: +${pZari.toFixed(2)} Kg</span>
                            <span>बकाया रुपया: ₹ ${pBani.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:10px;">
                        <div style="font-weight:bold; color:#1e40af; font-size:11.5px; margin-bottom:6px;">🧵 Naya Taana / Sancha Chunein:</div>
                        <div style="display:grid; grid-template-columns:1.5fr 1fr 0.8fr 0.8fr; gap:6px;">
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">Tani Item:</label>
                                <input type="text" id="ntani-tani-item" list="ntani-tani-dl" placeholder="Tani Item..." style="width:100%; padding:7px; font-size:12px; font-weight:bold; border:1px solid #93c5fd; border-radius:4px; box-sizing:border-box;">
                                <datalist id="ntani-tani-dl">${taniOpts}</datalist>
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">साँचा नाम:</label>
                                <input type="text" id="ntani-tani-sancha" value="${esc(currentActiveSheet.taniSancha || '')}" style="width:100%; padding:7px; font-size:12px; border:1px solid #93c5fd; border-radius:4px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">Wazan (Kg):</label>
                                <input type="number" step="0.01" id="ntani-tani-wazan" placeholder="0.00" style="width:100%; padding:7px; font-size:12px; border:1px solid #93c5fd; border-radius:4px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold; color:#1e3a8a;">🎯 Target:</label>
                                <input type="number" id="ntani-tani-pcs" value="${currentActiveSheet.taniPcs || 72}" style="width:100%; padding:7px; font-size:12px; font-weight:bold; border:1.5px solid #2563eb; border-radius:4px; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:10px;">
                        <div style="font-weight:bold; color:#9a3412; font-size:11.5px; margin-bottom:6px;">💰 Mazdoori Rate:</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                            <div>
                                <label style="font-size:10px; font-weight:bold;">Bani (₹/Saree):</label>
                                <input type="number" id="ntani-rate-bani" value="${currentActiveSheet.rateBani || 240}" style="width:100%; padding:6px; font-size:12px; font-weight:bold; border:1px solid #ea580c; border-radius:4px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold;">Bana Rate:</label>
                                <input type="number" step="0.001" id="ntani-rate-bana" value="${currentActiveSheet.rateBana || 0.311}" style="width:100%; padding:6px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:10px; font-weight:bold;">Zari Rate:</label>
                                <input type="number" step="0.001" id="ntani-rate-zari" value="${currentActiveSheet.rateZari || 0.110}" style="width:100%; padding:6px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                </div>

                <div style="background:#f1f5f9; padding:12px 18px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-between;">
                    <button type="button" onclick="closeExpressNewTaniModal()" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; cursor:pointer;">Cancel</button>
                    <button type="button" onclick="saveExpressNewTani(${nextNum}, ${pBana}, ${pZari}, ${pBani})" style="background:#0284c7; color:#fff; border:none; padding:9px 22px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer;">
                        🚀 Tani ${nextNum} Chadhayein
                    </button>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.closeExpressNewTaniModal = () => {
        const modal = document.getElementById('express-new-tani-modal');
        if (modal) modal.remove();
    };

    window.saveExpressNewTani = (nextNum, pBana, pZari, pBani) => {
        const kId = selectedKariger.id;
        const kGodown = selectedKariger.karkhanaId || 'k_main';

        const taniItem = String(document.getElementById('ntani-tani-item')?.value || '').trim();
        const taniSancha = String(document.getElementById('ntani-tani-sancha')?.value || '').trim();
        const taniWazan = safeNum(document.getElementById('ntani-tani-wazan')?.value, 0);
        const taniPcs = safeNum(document.getElementById('ntani-tani-pcs')?.value, 72);

        const rateBani = safeNum(document.getElementById('ntani-rate-bani')?.value, 240);
        const rateBana = safeNum(document.getElementById('ntani-rate-bana')?.value, 0.311);
        const rateZari = safeNum(document.getElementById('ntani-rate-zari')?.value, 0.110);

        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];

        const newSheetObj = {
            id: `tani_${nextNum}`,
            title: `Tani ${nextNum}`,
            pichlaBana: pBana,
            pichlaZari: pZari,
            pichlaBani: pBani,
            banaWaste: 0,
            zariWaste: 0,
            rateBana: rateBana,
            rateZari: rateZari,
            rateBani: rateBani,
            taniPcs: taniPcs,
            chukkaPcs: currentActiveSheet.chukkaPcs || 72,
            taniItem: taniItem || currentActiveSheet.taniItem || '',
            taniSancha: taniSancha || currentActiveSheet.taniSancha || '',
            taniWazan: taniWazan,
            chukkaItem: currentActiveSheet.chukkaItem || '',
            chukkaSancha: currentActiveSheet.chukkaSancha || '',
            chukkaWazan: 0,
            colors: Array.isArray(currentActiveSheet.colors) ? [...currentActiveSheet.colors] : [],
            note: `Tani ${nextNum} (Kariger Express Mode)`,
            rows: []
        };

        sheets.push(newSheetObj);
        if (typeof window.saveKarigerSheets === 'function') {
            window.saveKarigerSheets(kId, sheets);
        } else {
            setToStore(`kariger_sheets_${kId}`, sheets);
        }

        if (taniItem && taniWazan > 0) {
            deductSanchaStockItem(taniItem, 'tani', taniWazan, kGodown, `${kId}_tani_${nextNum}_t`, selectedKariger.name);
        }

        closeExpressNewTaniModal();

        activeSheetIndex = sheets.length - 1;
        currentActiveSheet = newSheetObj;

        renderKarigerExpressTaniTabs();
        updateWeaverBannerSnapshot();
        calculateKarigerExpressLive();

        alert(`✅ Tani ${nextNum} safalta-poorvak shuru ho gayi! Pichla hisab carry-forward ho gaya.`);
    };

    /* ========================================================================
       6. ZERO-MOUSE KEYBOARD CHAINING & SHORTCUT LISTENERS
       ------------------------------------------------------------------------
    ======================================================================== */
    const bindKarigerExpressEvents = () => {
        const modal = document.getElementById('kariger-express-modal');
        if (!modal) return;

        const karigerInp = document.getElementById('kexp-kariger-input');
        const paidInp = document.getElementById('kexp-paid-amount');

        setTimeout(() => { if (karigerInp) karigerInp.focus(); }, 120);

        // Enter Chaining
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

        // Kariger Autocomplete Selection
        karigerInp.addEventListener('input', () => {
            const val = karigerInp.value.trim().toLowerCase();
            const raw = toArray(getFromStore('kariger_list'));
            const k = raw.find(x => x && x.name && x.name.toLowerCase() === val);

            if (k) {
                selectedKariger = k;
                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                activeSheetIndex = sheets.length ? sheets.length - 1 : 0;
                currentActiveSheet = sheets[activeSheetIndex] || null;

                renderKarigerExpressTaniTabs();
                updateWeaverBannerSnapshot();
                calculateKarigerExpressLive();
            } else {
                selectedKariger = null;
                currentActiveSheet = null;
                renderKarigerExpressTaniTabs();
                document.getElementById('kexp-weaver-banner').innerHTML = `<span style="font-size:12px; color:#94a3b8;">कारीगर चुनिए, तानी का पूरा हिसाब और कलर यहाँ दिखेंगे...</span>`;
                document.getElementById('kexp-disp-bani-rate').textContent = `₹ 0.00`;
                calculateKarigerExpressLive();
            }
        });

        paidInp.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitKarigerExpress();
            }
        });

        window.removeEventListener('keydown', handleKarigerExpressKeydown, true);
        window.addEventListener('keydown', handleKarigerExpressKeydown, true);
    };

    const handleKarigerExpressKeydown = (e) => {
        const modal = document.getElementById('kariger-express-modal');
        if (!modal || modal.style.display === 'none') return;

        // If Alt+C modal is open
        const altCModal = document.getElementById('alt-c-kariger-modal');
        if (altCModal) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeAltCKarigerModal();
                return;
            }
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                saveAltCKariger();
                return;
            }
            return;
        }

        // Escape -> Close Kariger Express
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeKarigerExpressModal();
            return;
        }

        // Alt + C -> Naya Kariger Form
        if (e.altKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openAltCKarigerModal();
            return;
        }

        // Alt + N -> Nayi Tani Modal
        if (e.altKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openExpressNewTaniModal();
            return;
        }

        // F2 -> Search Kariger
        if (e.key === 'F2') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const inp = document.getElementById('kexp-kariger-input');
            if (inp) { inp.focus(); inp.select(); }
            return;
        }

        // Alt + P -> Print
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            printLastSavedExpressSlip();
            return;
        }
    };

    window.closeKarigerExpressModal = () => {
        window.removeEventListener('keydown', handleKarigerExpressKeydown, true);
        const modal = document.getElementById('kariger-express-modal');
        if (modal) modal.remove();
        selectedKariger = null;
        currentActiveSheet = null;
    };

    // Live Calculation
    window.calculateKarigerExpressLive = () => {
        const saree = safeNum(document.getElementById('kexp-saree-qty')?.value);
        const lott = safeNum(document.getElementById('kexp-saree-lott')?.value);
        const paid = safeNum(document.getElementById('kexp-paid-amount')?.value);

        const rateBani = currentActiveSheet ? safeNum(currentActiveSheet.rateBani, 240) : 240;
        
        let pichlaAmt = 0;
        if (currentActiveSheet && typeof window.calculateSheetTotals === 'function') {
            pichlaAmt = safeNum(window.calculateSheetTotals(currentActiveSheet).remainingAmt);
        }

        const netSaree = Math.max(0, saree - lott);
        const grossBani = netSaree * rateBani;
        const netRemaining = (pichlaAmt + grossBani) - paid;

        const dispGross = document.getElementById('kexp-disp-gross-bani');
        const dispNet = document.getElementById('kexp-disp-net-balance');

        if (dispGross) dispGross.textContent = `₹ ${grossBani.toFixed(2)}`;
        if (dispNet) {
            dispNet.textContent = `₹ ${netRemaining.toFixed(2)}`;
            dispNet.style.color = netRemaining > 0 ? '#dc2626' : '#059669';
        }

        const progEl = document.getElementById('kexp-live-tani-progress');
        if (progEl && currentActiveSheet) {
            const totalTaniTarget = safeNum(currentActiveSheet.taniPcs, 72);
            const liveTotalDelivered = prevDeliveredSarees + saree;
            const liveRemainingOnLoom = Math.max(0, totalTaniTarget - liveTotalDelivered);
            progEl.innerHTML = `🎯 कुल तानी: <strong>${totalTaniTarget} Pcs</strong> | 📥 अब तक आई: <strong style="color:#059669;">${liveTotalDelivered} Pcs</strong> | ⏳ बाकी: <strong style="color:#dc2626;">${liveRemainingOnLoom} Pcs</strong>`;
        }
    };

    window.updateExpressStockBadges = () => {
        const kGodown = selectedKariger ? (selectedKariger.karkhanaId || 'k_main') : 'k_main';
        const bName = String(document.getElementById('kexp-bana-name')?.value || '').trim();
        const zName = String(document.getElementById('kexp-zari-name')?.value || '').trim();

        const bBacha = getBanaStockBacha(bName, kGodown);
        const zBacha = getZariStockBacha(zName, kGodown);

        const bBadge = document.getElementById('kexp-live-bana-badge');
        const zBadge = document.getElementById('kexp-live-zari-badge');

        if (bBadge) bBadge.textContent = `Bacha: ${bBacha.toFixed(2)} Kg`;
        if (zBadge) zBadge.textContent = `Bacha: ${zBacha.toFixed(2)} Kg`;
    };

    /* ========================================================================
       7. ATOMIC SUBMIT & AUTO-TANI COMPLETE ROLLOVER ENGINE (WITH PROMINENT ALERT)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.submitKarigerExpress = () => {
        if (!selectedKariger) {
            alert('कृपया कारीगर का सही नाम चुनिए (या Alt+C से नया बनाइए)!');
            document.getElementById('kexp-kariger-input')?.focus();
            return;
        }

        const kId = selectedKariger.id;
        const kName = selectedKariger.name;
        const sDesign = selectedKariger.saree || 'General Saree';
        const kGodown = selectedKariger.karkhanaId || 'k_main';
        const date = document.getElementById('kexp-date')?.value || getToday();

        const bCone = safeNum(document.getElementById('kexp-bana-cone')?.value);
        const bLess = safeNum(document.getElementById('kexp-bana-lesstp')?.value);
        const zQty = safeNum(document.getElementById('kexp-zari-qty')?.value);
        const topi = safeNum(document.getElementById('kexp-zari-topi')?.value);

        const saree = safeNum(document.getElementById('kexp-saree-qty')?.value);
        const lott = safeNum(document.getElementById('kexp-saree-lott')?.value);
        const paid = safeNum(document.getElementById('kexp-paid-amount')?.value);
        const retB = safeNum(document.getElementById('kexp-ret-bana')?.value);
        const retZ = safeNum(document.getElementById('kexp-ret-zari')?.value);

        const banaItemName = String(document.getElementById('kexp-bana-name')?.value || '').trim();
        const zariItemName = String(document.getElementById('kexp-zari-name')?.value || '').trim();

        if (saree === 0 && bCone === 0 && zQty === 0 && paid === 0 && retB === 0 && retZ === 0) {
            return alert('कम से कम एक एंट्री (साड़ी, बाना, जरी या पेमेंट) भरिए!');
        }

        const nBana = Math.max(0, bCone - bLess);
        const nZari = Math.max(0, zQty - topi);
        const rowId = `row_${Date.now()}`;

        let sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];
        if (!sheets || !sheets.length) {
            sheets = [{
                id: 'tani_1', title: 'Tani 1',
                pichlaBana: 0, pichlaZari: 0, pichlaBani: 0,
                banaWaste: 0, zariWaste: 0,
                rateBana: 0.311, rateZari: 0.110, rateBani: 240,
                taniPcs: 72, chukkaPcs: 72, colors: [],
                note: '', rows: []
            }];
        }

        const activeSheet = sheets[activeSheetIndex] || sheets[sheets.length - 1];
        if (banaItemName) activeSheet.banaItem = banaItemName;
        if (zariItemName) activeSheet.zariItem = zariItemName;

        const rowObj = {
            id: rowId,
            date: date,
            cone: bCone,
            lessTp: bLess,
            netBana: safeNum(nBana.toFixed(2)),
            zariQty: zQty,
            topi: topi,
            netZari: safeNum(nZari.toFixed(2)),
            saree: saree,
            lott: lott,
            paid: paid,
            retBana: retB,
            retZari: retZ,
            banaItem: banaItemName,
            zariItem: zariItemName
        };

        if (!activeSheet.rows) activeSheet.rows = [];
        activeSheet.rows.push(rowObj);

        if (typeof window.saveKarigerSheets === 'function') {
            window.saveKarigerSheets(kId, sheets);
        } else {
            setToStore(`kariger_sheets_${kId}`, sheets);
        }

        const freshSaree = Math.max(0, saree - lott);
        let sHist = toArray(getFromStore('saree_history'));

        if (freshSaree > 0) {
            sHist.push({
                id: `saree_${Date.now()}_f`,
                refId: rowId,
                date: date,
                sareeName: sDesign,
                karigerName: kName,
                kariger: kName,
                partyName: kName,
                karkhanaId: kGodown,
                type: 'fresh',
                typeLabel: 'Fresh Saree (Kariger Sheet)',
                aai: freshSaree,
                gai: 0,
                isOut: false,
                timestamp: Date.now()
            });
        }
        if (lott > 0) {
            sHist.push({
                id: `saree_${Date.now()}_l`,
                refId: rowId,
                date: date,
                sareeName: sDesign,
                karigerName: kName,
                kariger: kName,
                partyName: kName,
                karkhanaId: kGodown,
                type: 'lott',
                typeLabel: 'Lott Saree (Kariger Sheet)',
                aai: lott,
                gai: 0,
                isOut: false,
                timestamp: Date.now() + 1
            });
        }
        setToStore('saree_history', sHist);

        if (banaItemName && (nBana > 0 || retB > 0)) {
            const bHist = toArray(getFromStore('bana_history'));
            bHist.push({
                id: `bhist_${Date.now()}`,
                refId: rowId,
                date: date,
                name: banaItemName,
                kariger: kName,
                type: 'Kariger Issue',
                aaya: retB > 0 ? retB : 0,
                gaya: nBana > 0 ? nBana : 0,
                karkhanaId: kGodown,
                timestamp: Date.now()
            });
            setToStore('bana_history', bHist);
        }

        if (zariItemName && (nZari > 0 || retZ > 0)) {
            const zHist = toArray(getFromStore('zari_history'));
            zHist.push({
                id: `zhist_${Date.now()}`,
                refId: rowId,
                date: date,
                name: zariItemName,
                kariger: kName,
                type: 'Kariger Issue',
                aaya: retZ > 0 ? retZ : 0,
                gaya: nZari > 0 ? nZari : 0,
                karkhanaId: kGodown,
                timestamp: Date.now()
            });
            setToStore('zari_history', zHist);
        }

        if (paid > 0) {
            const payList = toArray(getFromStore('payment_history'));
            payList.push({
                id: `pay_${Date.now()}`,
                date: date,
                party: kName,
                type: 'कारीगर मजदूरी',
                amount: paid,
                mode: 'Cash',
                timestamp: Date.now()
            });
            setToStore('payment_history', payList);
        }

        // Totals of active sheet after entry
        const totalsAfter = (typeof window.calculateSheetTotals === 'function') 
            ? window.calculateSheetTotals(activeSheet) 
            : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

        const targetTaniPcs = safeNum(activeSheet.taniPcs, 72);
        const deliveredSoFar = safeNum(totalsAfter.totSaree);

        // ⭐ AUTO-TANI COMPLETE & ROLLOVER TRIGGER
        let isTaniCompleted = false;
        let completedTaniTitle = activeSheet.title;
        let nextTaniTitle = '';
        let pBana = 0, pZari = 0, pBani = 0;

        if (targetTaniPcs > 0 && deliveredSoFar >= targetTaniPcs) {
            isTaniCompleted = true;
            const nextNum = sheets.length + 1;
            nextTaniTitle = `Tani ${nextNum}`;

            pBana = safeNum(totalsAfter.remainingBana);
            pZari = safeNum(totalsAfter.remainingZari);
            pBani = safeNum(totalsAfter.remainingAmt);

            // Nayi Sheet create karein aur pichla hisab auto-transfer karein
            const autoNewSheet = {
                id: `tani_${nextNum}`,
                title: nextTaniTitle,
                pichlaBana: pBana,
                pichlaZari: pZari,
                pichlaBani: pBani,
                banaWaste: 0,
                zariWaste: 0,
                rateBana: safeNum(activeSheet.rateBana, 0.311),
                rateZari: safeNum(activeSheet.rateZari, 0.110),
                rateBani: safeNum(activeSheet.rateBani, 240),
                taniPcs: targetTaniPcs,
                chukkaPcs: safeNum(activeSheet.chukkaPcs, 72),
                taniItem: activeSheet.taniItem || '',
                taniSancha: activeSheet.taniSancha || '',
                taniWazan: 0,
                chukkaItem: activeSheet.chukkaItem || '',
                chukkaSancha: activeSheet.chukkaSancha || '',
                chukkaWazan: 0,
                colors: Array.isArray(activeSheet.colors) ? [...activeSheet.colors] : [],
                note: `Auto Rollover: ${completedTaniTitle} (${targetTaniPcs} Saree Poori Hui)`,
                rows: []
            };

            sheets.push(autoNewSheet);

            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(kId, sheets);
            } else {
                setToStore(`kariger_sheets_${kId}`, sheets);
            }

            activeSheetIndex = sheets.length - 1;
            currentActiveSheet = autoNewSheet;
        }

        lastSavedTransaction = {
            karigerName: kName,
            sDesign: sDesign,
            kGodown: kGodown,
            date: date,
            taniTitle: completedTaniTitle,
            sanchaMaker: activeSheet.taniSancha || 'N/A',
            taniPcs: targetTaniPcs,
            deliveredSarees: deliveredSoFar,
            colors: activeSheet.colors || [],
            saree: saree,
            lott: lott,
            netBana: nBana,
            banaItem: banaItemName,
            netZari: nZari,
            zariItem: zariItemName,
            retBana: retB,
            retZari: retZ,
            paid: paid,
            netRemaining: safeNum(totalsAfter.remainingAmt),
            isTaniCompleted: isTaniCompleted,
            nextTaniTitle: nextTaniTitle
        };

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        // फॉर्म इनपुट खाली करें
        document.getElementById('kexp-saree-qty').value = '';
        document.getElementById('kexp-saree-lott').value = '';
        document.getElementById('kexp-ret-bana').value = '';
        document.getElementById('kexp-ret-zari').value = '';
        document.getElementById('kexp-bana-cone').value = '';
        document.getElementById('kexp-bana-lesstp').value = '';
        document.getElementById('kexp-zari-qty').value = '';
        document.getElementById('kexp-zari-topi').value = '';
        document.getElementById('kexp-paid-amount').value = '';

        const statusMsg = document.getElementById('kexp-status-msg');
        if (statusMsg) {
            if (isTaniCompleted) {
                statusMsg.innerHTML = `🎉 <strong>${esc(kName)}</strong> ki ${esc(completedTaniTitle)} (${targetTaniPcs} Pcs) poori hui! Nayi ${esc(nextTaniTitle)} auto-create ho gayi!`;
            } else {
                statusMsg.innerHTML = `✅ <strong>${esc(kName)}</strong> (${esc(completedTaniTitle)}) का हिसाब जुड़ गया!`;
            }
        }

        // ⭐ 1. अगर ताना पूरा हुआ है, तो सबसे पहले स्क्रीन पर बड़ा पॉपअप अलर्ट दिखाएं!
        if (isTaniCompleted) {
            alert(`🎉 मुबारक!\n\n${kName} की [${completedTaniTitle}] (${targetTaniPcs} साड़ी) पूरी हो गई!\n\n✨ नई [${nextTaniTitle}] अपने आप शुरू हो गई है।\n• बचा बाना: +${pBana.toFixed(2)} Kg\n• बची जरी: +${pZari.toFixed(2)} Kg\n• बकाया रुपया: ₹ ${pBani.toFixed(2)}\nनई तानी में ट्रांसफर हो गया है!`);
        }

        // ⭐ 2. इसके बाद पर्ची ऑटो-प्रिंट होगी
        printLastSavedExpressSlip();

        const kInp = document.getElementById('kexp-kariger-input');
        if (kInp) {
            kInp.value = '';
            kInp.focus();
        }
        selectedKariger = null;
        currentActiveSheet = null;
        renderKarigerExpressTaniTabs();
        document.getElementById('kexp-weaver-banner').innerHTML = `<span style="font-size:12px; color:#94a3b8;">कारीगर चुनिए, तानी का पूरा हिसाब और कलर यहाँ दिखेंगे...</span>`;
    };

    /* ========================================================================
       8. A6 THERMAL SLIP PRINT (WITH AUTO-TANI COMPLETE BANNER)
       ------------------------------------------------------------------------
    ======================================================================== */
    window.printLastSavedExpressSlip = () => {
        if (!lastSavedTransaction) {
            return alert('प्रिंट करने के लिए कोई रीसेंट हिसाब नहीं मिला!');
        }

        const t = lastSavedTransaction;
        const kGodamName = (typeof window.getKarkhanaNameById === 'function') 
            ? window.getKarkhanaNameById(t.kGodown) 
            : 'Main Godown';

        const remainingOnLoom = Math.max(0, t.taniPcs - t.deliveredSarees);
        const colorsTxt = (t.colors && t.colors.length) ? t.colors.join(', ') : 'N/A';

        const printWindow = window.open('', '', 'width=420,height=600');
        if (!printWindow) return alert('Popup block hai! Kripya allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Baithak Parchi - ${esc(t.karigerName)}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { margin-bottom: 6px; font-size: 10.5px; border-bottom: 1.5px dashed #666; padding-bottom: 4px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 6px 0; }
                    th, td { padding: 3px 2px; text-align: left; border-bottom: 1px dashed #ccc; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 10px; }
                    .highlight-box { background: #f4f4f4; border: 1px solid #000; padding: 4px 6px; margin: 6px 0; font-size: 11px; font-weight: bold; }
                    .completed-banner { background: #eee; border: 1.5px solid #000; padding: 5px; text-align: center; font-weight: 900; font-size: 11px; margin-bottom: 6px; }
                    .signs { display: flex; justify-content: space-between; margin-top: 22px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>⚡ बैठक ले-देन पर्ची (EXPRESS RECEIPT)</p>
                    </div>

                    ${t.isTaniCompleted ? `
                    <div class="completed-banner">
                        🎉 ताना पूरा हुआ: ${esc(t.taniTitle)} (${t.taniPcs} Saree)<br>
                        ✨ अगली ताना (${esc(t.nextTaniTitle)}) स्वतः शुरू हो गई!
                    </div>` : ''}

                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(t.karigerName)}</span><span><strong>तारीख:</strong> ${esc(t.date)}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(t.sDesign)}</span><span><strong>खाता:</strong> ${esc(t.taniTitle)}</span></div>
                        <div class="meta-row"><span><strong>साँचा (Maker):</strong> ${esc(t.sanchaMaker)}</span><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span></div>
                    </div>

                    <div class="highlight-box">
                        <div style="display:flex; justify-content:space-between;">
                            <span>कुल तानी: ${t.taniPcs} Pcs</span>
                            <span>अब तक आई: ${t.deliveredSarees} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:2px;">
                            <span>लूम पर बाकी: ${remainingOnLoom} Pcs</span>
                        </div>
                        <div style="font-size:9.5px; font-weight:normal; margin-top:3px; color:#333;">
                            रंग (Colors): ${esc(colorsTxt)}
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr><th>विवरण (ITEM / DETAIL)</th><th style="text-align:right;">मात्रा / वज़न</th></tr>
                        </thead>
                        <tbody>
                            ${t.saree > 0 ? `<tr><td>साड़ी जमा</td><td style="text-align:right; font-weight:bold;">+${t.saree} Pcs</td></tr>` : ''}
                            ${t.lott > 0 ? `<tr><td>लोट साड़ी</td><td style="text-align:right; font-weight:bold;">-${t.lott} Pcs</td></tr>` : ''}
                            ${t.netBana > 0 ? `<tr><td>बाना दिया (${esc(t.banaItem || 'बाना')})</td><td style="text-align:right; font-weight:bold;">${t.netBana.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.netZari > 0 ? `<tr><td>जरी दी (${esc(t.zariItem || 'जरी')})</td><td style="text-align:right; font-weight:bold;">${t.netZari.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.retBana > 0 ? `<tr><td>वापस बाना</td><td style="text-align:right;">${t.retBana.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.retZari > 0 ? `<tr><td>वापस जरी</td><td style="text-align:right;">${t.retZari.toFixed(2)} Kg</td></tr>` : ''}
                            ${t.paid > 0 ? `<tr><td>मजदूरी दिया (Paid)</td><td style="text-align:right; font-weight:bold;">₹ ${t.paid.toFixed(2)}</td></tr>` : ''}
                        </tbody>
                    </table>

                    <div style="border-top:1.5px dashed #000; padding-top:4px; font-size:11.5px; font-weight:bold; display:flex; justify-content:space-between;">
                        <span>अंतिम बाकी रुपया:</span>
                        <span>₹ ${t.netRemaining.toFixed(2)}</span>
                    </div>

                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>___________</div>
                        <div>हस्ताक्षर कारीगर<br><br>___________</div>
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

    /* ========================================================================
       9. GLOBAL EXPORT
       ------------------------------------------------------------------------
    ======================================================================== */
    window.KarigerExpressEngine = {
        openKarigerExpressModal,
        closeKarigerExpressModal,
        openAltCKarigerModal,
        closeAltCKarigerModal,
        saveAltCKariger,
        openExpressNewTaniModal,
        closeExpressNewTaniModal,
        saveExpressNewTani,
        switchExpressTaniSheet,
        calculateKarigerExpressLive,
        updateExpressStockBadges,
        submitKarigerExpress,
        printLastSavedExpressSlip
    };

})();
