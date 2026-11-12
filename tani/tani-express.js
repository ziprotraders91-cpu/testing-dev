/* ============================================================================
   SIMPLICITY ERP - ⚡ MASTER TANI ORDER EXPRESS ENGINE (BADA COUNTER & ZERO-MOUSE)
   Folder: tani / File: tani-express.js
   Developed for: Farhan Jawed
   Features:
   - 940px Bada Khula Counter Layout (Matching Kariger & Stock Express)
   - 100% Clean Blank Input Boxes (No Placeholders / Pre-filled values)
   - Auto-Increment Serial No. Starting from #1 (Locked)
   - Kariger Dropdown Strictly from Kariger Master + 100% Auto-Fill Mohalla
   - Dynamic Auto-Learning Colors Memory (No hardcoded colors)
   - Complete 8-Colors Matching Matrix & Multi-Contrast Styles
   - Zero-Mouse Rapid Enter Chaining between Inputs
   - Instant A6 Thermal / Physical Pad Urdu Slip Print [Alt + P]
   - Instant WhatsApp Parchi Sharing [Alt + W]
============================================================================ */

(() => {
    'use strict';

    let lastSavedTaniExpressOrder = null;

    /* ========================================================================
       1. SAFE SANITIZATION & STORAGE BRIDGES
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

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    // Valid YYYY-MM-DD date format
    const getToday = () => {
        let rawDate = (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];

        if (typeof rawDate === 'string' && rawDate.includes('-')) {
            const parts = rawDate.split('-');
            if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        return rawDate || new Date().toISOString().split('T')[0];
    };

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function') 
            ? window.formatDateDisplay(d) 
            : (d || '-');
    };

    /* ========================================================================
       2. REPOSITORY, AUTO SERIAL (#1) & LEARNED COLORS
       ======================================================================== */
    const getTaniOrders = () => toArray(getFromStore('tani_orders_list'));

    const getNextParchiNumber = () => {
        const list = getTaniOrders();
        if (!list.length) return '1';
        let maxNum = 0;
        list.forEach((item) => {
            const n = safeInt(item.orderNo);
            if (n > maxNum) maxNum = n;
        });
        return String(maxNum + 1);
    };

    const getLearnedColors = () => {
        const stored = toArray(getFromStore('tani_learned_colors'));
        const orders = getTaniOrders();
        const colorsSet = new Set(stored.map(c => String(c).trim()).filter(Boolean));

        orders.forEach(o => {
            if (o.border) colorsSet.add(String(o.border).trim());
            if (o.bana) colorsSet.add(String(o.bana).trim());
            if (Array.isArray(o.matchingTable)) {
                o.matchingTable.forEach(row => {
                    if (row.saree) colorsSet.add(String(row.saree).trim());
                    if (row.border) colorsSet.add(String(row.border).trim());
                    if (row.bana) colorsSet.add(String(row.bana).trim());
                });
            }
        });

        return Array.from(colorsSet).sort((a, b) => a.localeCompare(b));
    };

    const saveNewLearnedColors = (newColors = []) => {
        if (!newColors.length) return;
        const current = getLearnedColors();
        const updatedSet = new Set([...current, ...newColors.map(c => String(c).trim()).filter(Boolean)]);
        setToStore('tani_learned_colors', Array.from(updatedSet));
    };

    const getTaniExpressDatalists = () => {
        // 1. Karigers strictly from master
        const allKarigers = toArray(getFromStore('kariger_list')).filter(k => k && k.name && String(k.name).trim());
        let karigerOpts = allKarigers.map(k => `<option value="${esc(k.name)}">`).join('');

        // 2. Sanchas from stock (tani category)
        const sanchaItems = toArray(getFromStore('sancha_items')).filter(s => (s?.category || 'tani').toLowerCase() === 'tani');
        const sanchaNames = [...new Set([
            ...sanchaItems.map(s => s.name).filter(Boolean),
            ...getTaniOrders().map(o => o.sancha).filter(Boolean)
        ])];
        let sanchaOpts = sanchaNames.map(s => `<option value="${esc(s)}">`).join('');

        // 3. Learned Rangis
        const learnedRangi = toArray(getFromStore('tani_learned_rangi'));
        const existingRangi = [...new Set([
            ...learnedRangi,
            ...getTaniOrders().map(o => o.rangi).filter(Boolean)
        ])];
        let rangiOpts = existingRangi.map(r => `<option value="${esc(r)}">`).join('');

        // 4. Learned Colors
        const colors = getLearnedColors();
        let colorOpts = colors.map(c => `<option value="${esc(c)}">`).join('');

        return { karigerOpts, sanchaOpts, rangiOpts, colorOpts };
    };

    /* ========================================================================
       3. OPEN TANI EXPRESS MODAL (BADA 940px COUNTER)
       ======================================================================== */
    window.openTaniExpressModal = () => {
        const existing = document.getElementById('master-tani-express-modal');
        if (existing) existing.remove();

        const today = getToday();
        const nextOrderNo = getNextParchiNumber();
        const { karigerOpts, sanchaOpts, rangiOpts, colorOpts } = getTaniExpressDatalists();

        // 8 Row Color Inputs Generator (Completely Blank - No Placeholders)
        let colorRowsHtml = '';
        for (let i = 1; i <= 8; i++) {
            colorRowsHtml += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="text-align:center; font-weight:900; color:#b45309; background:#fffbeb; padding:5px 4px; font-size:12px;">${i}</td>
                <td style="padding:4px;"><input type="text" id="texp-col-saree-${i}" list="texp-colors-dl" placeholder="" data-next="texp-col-border-${i}" style="width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid #cbd5e1; border-radius:5px; font-weight:bold; font-size:12px;"></td>
                <td style="padding:4px;"><input type="text" id="texp-col-border-${i}" list="texp-colors-dl" placeholder="" data-next="texp-col-bana-${i}" style="width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid #cbd5e1; border-radius:5px; font-weight:bold; font-size:12px;"></td>
                <td style="padding:4px;"><input type="text" id="texp-col-bana-${i}" list="texp-colors-dl" placeholder="" data-next="${i === 8 ? 'texp-submit-btn' : `texp-col-saree-${i + 1}`}" style="width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid #cbd5e1; border-radius:5px; font-weight:bold; font-size:12px;"></td>
            </tr>`;
        }

        const modalHtml = `
        <div id="master-tani-express-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; padding:10px; box-sizing:border-box;">
            <div style="background:#ffffff; width:100%; max-width:940px; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.65); overflow:hidden; font-family:sans-serif; max-height:97vh; display:flex; flex-direction:column;">
                
                <!-- Modal Top Header -->
                <div style="background:#0f172a; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;">⚡</span>
                        <h3 style="margin:0; font-size:17px; font-weight:800; letter-spacing:0.5px;">TANI ORDER EXPRESS • तानी आर्डर व रंगाई काउन्टर</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; background:#1e293b; color:#38bdf8; padding:4px 10px; border-radius:6px; font-weight:bold;">[Enter] Next Box | [Alt+P] A6 Print | [Alt+W] WhatsApp | [Esc] Close</span>
                        <button type="button" onclick="closeTaniExpressModal()" style="background:transparent; border:none; color:#fff; font-size:26px; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                </div>

                <!-- Form Body -->
                <div style="padding:16px 20px; overflow-y:auto; flex:1;">
                    
                    <!-- 2-Column Balanced Counter Grid -->
                    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:16px;">
                        
                        <!-- COLUMN 1: PARCHI SPECS, WEAVER & MEASUREMENTS -->
                        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:12px; padding:16px;">
                            <h4 style="margin:0 0 12px 0; color:#b45309; font-size:14px; border-bottom:1.5px solid #cbd5e1; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                                <span>📜 तानी पर्ची विवरण (Order Details)</span>
                                <span style="background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:900;">Parchi No: #${nextOrderNo}</span>
                            </h4>

                            <!-- Row 1: Order No & Date -->
                            <div style="display:grid; grid-template-columns:120px 1fr; gap:10px; margin-bottom:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">पर्ची नं (Locked):</label>
                                    <input type="text" id="texp-order-no" value="${nextOrderNo}" readonly style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #fde68a; border-radius:6px; font-size:15px; font-weight:900; background:#fef3c7; color:#b45309; text-align:center; cursor:not-allowed;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">तारीख (Date):</label>
                                    <input type="date" id="texp-order-date" value="${today}" data-next="texp-kariger" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; background:#ffffff;">
                                </div>
                            </div>

                            <!-- Row 2: Kariger Name (Strict Master) & Mohalla (Auto-Fill) -->
                            <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:10px; margin-bottom:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#1e3a8a; display:block; margin-bottom:3px;">कारीगर का नाम (Master Sheet):</label>
                                    <input type="text" id="texp-kariger" list="texp-karigers-dl" data-next="texp-sancha" placeholder="" autocomplete="off" style="width:100%; box-sizing:border-box; padding:10px; border:2px solid #2563eb; border-radius:6px; font-size:14px; font-weight:bold; background:#eff6ff;">
                                    <datalist id="texp-karigers-dl">${karigerOpts}</datalist>
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">محلہ / پتہ (Auto-Filled):</label>
                                    <input type="text" id="texp-mohalla" data-next="texp-sancha" placeholder="" style="width:100%; box-sizing:border-box; padding:10px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; background:#ffffff;">
                                </div>
                            </div>

                            <!-- Row 3: Sancha & Rangai Wala -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#0284c7; display:block; margin-bottom:3px;">سانچہ (Sancha Maker/No):</label>
                                    <input type="text" id="texp-sancha" list="texp-sancha-dl" data-next="texp-rangi" placeholder="" autocomplete="off" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                    <datalist id="texp-sancha-dl">${sanchaOpts}</datalist>
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#7c3aed; display:block; margin-bottom:3px;">رنگی (Dyer Wala):</label>
                                    <input type="text" id="texp-rangi" list="texp-rangi-dl" data-next="texp-meter" placeholder="" autocomplete="off" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                    <datalist id="texp-rangi-dl">${rangiOpts}</datalist>
                                </div>
                            </div>

                            <!-- Row 4: Meter, Pcs & Paai -->
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#374151; display:block; margin-bottom:3px;">मीटर (Length):</label>
                                    <input type="number" step="0.01" id="texp-meter" data-next="texp-pcs" placeholder="" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; text-align:center;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#dc2626; display:block; margin-bottom:3px;">عدد (Saree Pcs):</label>
                                    <input type="number" id="texp-pcs" data-next="texp-paai" placeholder="" style="width:100%; box-sizing:border-box; padding:9px; border:2px solid #dc2626; border-radius:6px; font-size:16px; font-weight:900; color:#dc2626; text-align:center;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#374151; display:block; margin-bottom:3px;">پائی (Density):</label>
                                    <input type="text" id="texp-paai" data-next="texp-border" placeholder="" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; text-align:center;">
                                </div>
                            </div>

                            <!-- Row 5: Border Design & Bana Spec -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">بارڈر (Border Design):</label>
                                    <input type="text" id="texp-border" data-next="texp-bana" placeholder="" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                </div>
                                <div>
                                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">بانا (Bana Spec/Color):</label>
                                    <input type="text" id="texp-bana" data-next="texp-col-saree-1" placeholder="" style="width:100%; box-sizing:border-box; padding:9px; border:1.5px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold;">
                                </div>
                            </div>
                        </div>

                        <!-- COLUMN 2: 8-COLORS MATCHING MATRIX & CONTRAST -->
                        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 10px 0; color:#0f766e; font-size:14px; border-bottom:1.5px solid #cbd5e1; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                                    <span>🎨 8-Colors Matching Table</span>
                                    <small style="color:#64748b; font-size:11px; font-weight:normal;">(Auto-Learned Memory)</small>
                                </h4>

                                <!-- 8 Rows Table -->
                                <div style="border:1.5px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:12px;">
                                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                        <thead>
                                            <tr style="background:#0f766e; color:white; text-align:center;">
                                                <th style="padding:6px 4px; width:30px;">#</th>
                                                <th style="padding:6px;">ساڑی (Saree)</th>
                                                <th style="padding:6px;">بارڈر (Border)</th>
                                                <th style="padding:6px;">بانا (Bana)</th>
                                            </tr>
                                        </thead>
                                        <tbody id="texp-colors-table-tbody">
                                            ${colorRowsHtml}
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Dynamic Datalist for Learned Colors -->
                                <datalist id="texp-colors-dl">${colorOpts}</datalist>

                                <!-- Multi-Contrast Checkbox Strip -->
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; font-size:11.5px; font-weight:bold; color:#334155;">
                                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                                        <input type="checkbox" name="texp_contrast" value="aanchal_blouse" checked> آنچل بلاؤز
                                    </label>
                                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                                        <input type="checkbox" name="texp_contrast" value="border_only"> صرف بارڈر
                                    </label>
                                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                                        <input type="checkbox" name="texp_contrast" value="self"> سیلف (Self)
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer Action Bar -->
                <div style="background:#f1f5f9; padding:12px 20px; border-top:1.5px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div id="texp-status-msg" style="font-size:13px; font-weight:bold; color:#059669;"></div>
                    <div style="display:flex; gap:10px;">
                        <button type="button" id="texp-btn-close" onclick="closeTaniExpressModal()" style="background:#cbd5e1; color:#334155; border:none; padding:11px 16px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer;">
                            ✕ [Esc] Radd
                        </button>
                        <button type="button" id="texp-btn-whatsapp" onclick="sendTaniExpressWhatsApp()" style="background:#22c55e; color:#ffffff; border:none; padding:11px 16px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            📲 [Alt+W] WhatsApp
                        </button>
                        <button type="button" id="texp-btn-print" onclick="printLastSavedTaniExpressSlip()" style="background:#b45309; color:#ffffff; border:none; padding:11px 18px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            🖨️ [Alt+P] A6 Print
                        </button>
                        <button type="button" id="texp-submit-btn" onclick="submitTaniExpress()" style="background:#0f766e; color:#ffffff; border:none; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 4px 6px rgba(15,118,110,0.3); display:inline-flex; align-items:center; gap:8px;">
                            💾 पर्ची सेव करें [ ENTER ]
                        </button>
                    </div>
                </div>

            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        bindTaniExpressEvents();
    };

    /* ========================================================================
       4. KEYBOARD EVENTS, AUTO-FILL & ENTER CHAINING
       ======================================================================== */
    const bindTaniExpressEvents = () => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal) return;

        const karigerInp = document.getElementById('texp-kariger');
        const mohallaInp = document.getElementById('texp-mohalla');

        setTimeout(() => { if (karigerInp) karigerInp.focus(); }, 120);

        // Enter Chaining between inputs
        const allInputs = modal.querySelectorAll('input[data-next]');
        allInputs.forEach((inp) => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextId = inp.getAttribute('data-next');
                    if (nextId === 'texp-submit-btn') {
                        submitTaniExpress();
                        return;
                    }
                    const nextEl = document.getElementById(nextId);
                    if (nextEl) {
                        nextEl.focus();
                        if (typeof nextEl.select === 'function') nextEl.select();
                    }
                }
            });
        });

        // Kariger Auto-Fill Mohalla
        if (karigerInp && mohallaInp) {
            const autoFill = () => {
                const kName = String(karigerInp.value || '').trim().toUpperCase();
                if (!kName) return;
                const allKarigers = toArray(getFromStore('kariger_list'));
                const found = allKarigers.find(k => k && String(k.name || '').trim().toUpperCase() === kName);
                if (found) {
                    mohallaInp.value = found.mohalla || found.address || found.pata || '';
                }
            };
            karigerInp.addEventListener('input', autoFill);
            karigerInp.addEventListener('change', autoFill);
        }

        window.removeEventListener('keydown', handleTaniExpressGlobalKeydown, true);
        window.addEventListener('keydown', handleTaniExpressGlobalKeydown, true);
    };

    const handleTaniExpressGlobalKeydown = (e) => {
        const modal = document.getElementById('master-tani-express-modal');
        if (!modal || modal.style.display === 'none') return;

        // Escape to Close
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            closeTaniExpressModal();
            return;
        }

        // Alt + P -> Print A6 Slip
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            printLastSavedTaniExpressSlip();
            return;
        }

        // Alt + W -> WhatsApp Parchi
        if (e.altKey && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            sendTaniExpressWhatsApp();
            return;
        }
    };

    window.closeTaniExpressModal = () => {
        window.removeEventListener('keydown', handleTaniExpressGlobalKeydown, true);
        const modal = document.getElementById('master-tani-express-modal');
        if (modal) modal.remove();
    };

    /* ========================================================================
       5. ATOMIC SUBMIT (SAVES TO TANI_ORDERS_LIST & REFRESHES SYSTEM)
       ======================================================================== */
    window.submitTaniExpress = () => {
        const orderNo = String(document.getElementById('texp-order-no')?.value || '').trim() || getNextParchiNumber();
        const date = document.getElementById('texp-order-date')?.value || getToday();
        const kariger = String(document.getElementById('texp-kariger')?.value || '').trim().toUpperCase();
        const mohalla = String(document.getElementById('texp-mohalla')?.value || '').trim();
        const sancha = String(document.getElementById('texp-sancha')?.value || '').trim().toUpperCase();
        const rangi = String(document.getElementById('texp-rangi')?.value || '').trim().toUpperCase();

        const meter = safeNum(document.getElementById('texp-meter')?.value);
        const pcs = safeInt(document.getElementById('texp-pcs')?.value);
        const paai = String(document.getElementById('texp-paai')?.value || '').trim();
        const border = String(document.getElementById('texp-border')?.value || '').trim();
        const bana = String(document.getElementById('texp-bana')?.value || '').trim();

        if (!kariger) {
            alert('कृपया कारीगर का नाम चुनिए!');
            document.getElementById('texp-kariger')?.focus();
            return;
        }

        // Kariger Master Validation
        const allKarigers = toArray(getFromStore('kariger_list'));
        const karigerExists = allKarigers.some(k => k && String(k.name || '').trim().toUpperCase() === kariger);
        if (!karigerExists) {
            alert('चुना गया कारीगर Master Sheet में नहीं है! कृपया सही कारीगर चुनें।');
            document.getElementById('texp-kariger')?.focus();
            return;
        }

        const matchingTable = [];
        const usedColors = [];

        if (border) usedColors.push(border);
        if (bana) usedColors.push(bana);

        for (let i = 1; i <= 8; i++) {
            const sCol = String(document.getElementById(`texp-col-saree-${i}`)?.value || '').trim();
            const bCol = String(document.getElementById(`texp-col-border-${i}`)?.value || '').trim();
            const bnCol = String(document.getElementById(`texp-col-bana-${i}`)?.value || '').trim();
            if (sCol || bCol || bnCol) {
                matchingTable.push({ row: i, saree: sCol, border: bCol, bana: bnCol });
                if (sCol) usedColors.push(sCol);
                if (bCol) usedColors.push(bCol);
                if (bnCol) usedColors.push(bnCol);
            }
        }

        // Memory save for dynamic colors
        saveNewLearnedColors(usedColors);

        // Memory save for Rangi wala
        if (rangi) {
            const rList = toArray(getFromStore('tani_learned_rangi'));
            if (!rList.includes(rangi)) {
                rList.push(rangi);
                setToStore('tani_learned_rangi', rList);
            }
        }

        // Multi-contrast styles
        const selectedContrasts = [];
        const contrastLabels = [];
        document.querySelectorAll('input[name="texp_contrast"]:checked').forEach(c => {
            selectedContrasts.push(c.value);
            if (c.value === 'aanchal_blouse') contrastLabels.push('آنچل بلاؤز');
            else if (c.value === 'border_only') contrastLabels.push('صرف بارڈر');
            else if (c.value === 'self') contrastLabels.push('سیلف');
        });

        const contrastVal = selectedContrasts.length ? selectedContrasts.join(', ') : 'aanchal_blouse';
        const contrastLabel = contrastLabels.length ? contrastLabels.join(' + ') : 'آنچل بلاؤز کنٹراس';

        const list = getTaniOrders();
        const targetId = `tani_${Date.now()}`;

        const newOrderObj = {
            id: targetId,
            orderNo: orderNo,
            date: date,
            sancha: sancha,
            kariger: kariger,
            mohalla: mohalla,
            paai: paai,
            border: border,
            bana: bana,
            meter: meter,
            pcs: pcs,
            rangi: rangi,
            matchingTable: matchingTable,
            contrastVal: contrastVal,
            contrastLabel: contrastLabel,
            selectedContrasts: selectedContrasts,
            status: 'sancha',
            statusHistory: [
                { status: 'sancha', date: date, note: 'Tani Express Entry' }
            ],
            createdAt: Date.now()
        };

        list.unshift(newOrderObj);
        setToStore('tani_orders_list', list);

        lastSavedTaniExpressOrder = newOrderObj;

        // Sync and refresh main tani order tables/badges if open in background
        if (typeof window.updateTaniOrderBadges === 'function') window.updateTaniOrderBadges();
        if (typeof window.renderTaniMonthTabs === 'function') window.renderTaniMonthTabs();
        if (typeof window.renderTaniOrdersTable === 'function') window.renderTaniOrdersTable();

        const statusMsg = document.getElementById('texp-status-msg');
        if (statusMsg) {
            statusMsg.innerHTML = `✅ Parchi #${orderNo} (${kariger}) safalta-poorvak save ho gayi!`;
        }

        // Reset inputs for next parchi immediately
        const nextNum = getNextParchiNumber();
        const noEl = document.getElementById('texp-order-no');
        if (noEl) noEl.value = nextNum;

        const kInp = document.getElementById('texp-kariger');
        if (kInp) {
            kInp.value = '';
            kInp.focus();
        }
        document.getElementById('texp-mohalla').value = '';
        document.getElementById('texp-sancha').value = '';
        document.getElementById('texp-rangi').value = '';
        document.getElementById('texp-meter').value = '';
        document.getElementById('texp-pcs').value = '';
        document.getElementById('texp-paai').value = '';
        document.getElementById('texp-border').value = '';
        document.getElementById('texp-bana').value = '';

        for (let i = 1; i <= 8; i++) {
            const sEl = document.getElementById(`texp-col-saree-${i}`);
            const bEl = document.getElementById(`texp-col-border-${i}`);
            const bnEl = document.getElementById(`texp-col-bana-${i}`);
            if (sEl) sEl.value = '';
            if (bEl) bEl.value = '';
            if (bnEl) bnEl.value = '';
        }

        // Ask for A6 print confirmation
        if (confirm(`✅ Parchi #${orderNo} save ho gayi!\n\nKya aap iski Urdu A6 Parchi print karna chahte hain?`)) {
            printLastSavedTaniExpressSlip();
        }
    };

    /* ========================================================================
       6. A6 PHYSICAL SLIP PRINT (EXACT NASTALIQ URDU REPLICA)
       ======================================================================== */
    window.printLastSavedTaniExpressSlip = () => {
        if (!lastSavedTaniExpressOrder) {
            return alert('प्रिंट करने के लिए कोई रीसेंट तानी पर्ची नहीं मिली!');
        }

        const item = lastSavedTaniExpressOrder;
        const matching = Array.isArray(item.matchingTable) ? item.matchingTable : [];
        let rowsHtml = '';

        for (let i = 1; i <= 8; i++) {
            const rowData = matching.find((m) => m.row === i) || { saree: '', border: '', bana: '' };
            rowsHtml += `
                <tr>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.saree || '-')}</td>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.border || '-')}</td>
                    <td style="border:1.5px solid #8b0000; padding:4px; text-align:center; font-weight:bold;">${esc(rowData.bana || '-')}</td>
                </tr>`;
        }

        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : ['aanchal_blouse'];
        const isAanchal = selContrasts.includes('aanchal_blouse') ? '☑' : '☐';
        const isBorder = selContrasts.includes('border_only') ? '☑' : '☐';
        const isSelf = selContrasts.includes('self') ? '☑' : '☐';

        const printWin = window.open('', '', 'width=450,height=700');
        if (!printWin) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="ur" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>Tani Parchi #${item.orderNo}</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: 'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #8b0000; direction: rtl; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; border: 2px solid #8b0000; padding: 6px; box-sizing: border-box; }
                    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #8b0000; padding-bottom: 4px; margin-bottom: 6px; }
                    .top-no { font-size: 18px; font-weight: 900; }
                    .header-line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
                    .main-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 4px; margin-top: 6px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border: 1.5px solid #8b0000; padding: 3px; background: #fff5f5; font-size: 11px; text-align: center; }
                    .spec-col { display: flex; flex-direction: column; justify-content: space-between; border-right: 1.5px solid #8b0000; padding-right: 6px; }
                    .spec-item { border-bottom: 1px solid #8b0000; padding: 4px 2px; font-size: 11px; display: flex; justify-content: space-between; }
                    .bottom-strip { border-top: 1.5px solid #8b0000; margin-top: 8px; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="top-bar">
                        <div class="top-no">${item.orderNo}</div>
                        <div style="font-size:12px; font-weight:bold;">سانچہ: <strong>${esc(item.sancha || '-')}</strong></div>
                        <div style="font-size:11px;">تاریخ: <strong>${formatDisplay(item.date)}</strong></div>
                    </div>

                    <div class="header-line">
                        <div>کاریگر کا نام: <strong>${esc(item.kariger || '-')}</strong></div>
                        <div>محلہ: <strong>${esc(item.mohalla || '-')}</strong></div>
                    </div>

                    <div class="main-grid">
                        <div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ساڑی</th>
                                        <th>بارڈر</th>
                                        <th>بانا</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                        </div>

                        <div class="spec-col">
                            <div class="spec-item"><span>پائی:</span> <strong>${esc(item.paai || '-')}</strong></div>
                            <div class="spec-item"><span>بارڈر:</span> <strong>${esc(item.border || '-')}</strong></div>
                            <div class="spec-item"><span>بانا:</span> <strong>${esc(item.bana || '-')}</strong></div>
                            <div class="spec-item"><span>میٹر:</span> <strong>${safeNum(item.meter)} Mtr</strong></div>
                            <div class="spec-item"><span>عدد:</span> <strong style="font-size:13px;">${safeInt(item.pcs)} Saree</strong></div>
                            <div class="spec-item" style="border-bottom:none;"><span>رنگی:</span> <strong style="font-size:12px;">${esc(item.rangi || '-')}</strong></div>
                        </div>
                    </div>

                    <div class="bottom-strip">
                        <div>${isAanchal} آنچل بلاؤز کنٹراس</div>
                        <div>${isBorder} صرف بارڈر کنٹراس</div>
                        <div>${isSelf} سیلف</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 700);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWin.document.close();
    };

    /* ========================================================================
       7. 📲 WHATSAPP PARCHI SHARING
       ======================================================================== */
    window.sendTaniExpressWhatsApp = () => {
        if (!lastSavedTaniExpressOrder) {
            return alert('व्हाट्सएप पर भेजने के लिए कोई रीसेंट पर्ची नहीं मिली!');
        }

        const item = lastSavedTaniExpressOrder;
        let msg = `📜 *TANI ORDER & RANGAI PARCHI #${item.orderNo}*\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `📅 *Tarikh:* ${formatDisplay(item.date)}\n` +
            `⚙️ *Sancha:* ${item.sancha || '-'}\n` +
            `👤 *Kariger:* ${item.kariger || '-'}${item.mohalla ? ` (${item.mohalla})` : ''}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📏 *Meter:* ${safeNum(item.meter)} Mtr\n` +
            `🥻 *Adad (Saree):* ${safeInt(item.pcs)} Pcs\n` +
            `🧵 *Paai:* ${item.paai || '-'}\n` +
            `✨ *Border:* ${item.border || '-'}\n` +
            `🧶 *Bana:* ${item.bana || '-'}\n` +
            `🎨 *Rangi Wala:* ${item.rangi || '-'}\n` +
            `🎯 *Matching:* ${item.contrastLabel || 'Self'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n`;

        if (Array.isArray(item.matchingTable) && item.matchingTable.length > 0) {
            msg += `🎨 *8 COLORS MATCHING:*\n`;
            item.matchingTable.forEach((m) => {
                msg += `• Row ${m.row}: Saree: ${m.saree || '-'} | Border: ${m.border || '-'} | Bana: ${m.bana || '-'}\n`;
            });
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        }

        msg += `_Simplicity ERP • by Farhan Jawed_`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       8. GLOBAL EXPORTS
       ======================================================================== */
    window.TaniExpressEngine = {
        openTaniExpressModal,
        closeTaniExpressModal,
        submitTaniExpress,
        printLastSavedTaniExpressSlip,
        sendTaniExpressWhatsApp
    };

})();
