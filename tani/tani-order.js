/* ============================================================================
   SIMPLICITY ERP - TANI ORDER, RANGAI & A6 PARCHI ENGINE
   File: tani/tani-order.js • Developed by Farhan Jawed
   Features: 
   - Kariger Auto-Select + Auto-Fill Mohalla (Address from Kariger Master)
   - Sancha, Rangai, and 8-Colors Smart Auto-Complete Datalists
   - Multi-Select Checkboxes for Contrast Styles (Multiple tick supported)
   - Auto-Increment Locked Serial Parchi No. (No typing required)
   - Form strictly hidden by default, toggles on demand
   - Har Mahine ka Alag Page / Monthly Tabs Bar
   - Built-in Clean Pagination (15 Orders Per Page)
   - High-Precision A6 Physical Slip Print (Matches Physical Pad)
   - WhatsApp Parchi Sharing & Realtime Cloud Sync
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & CONTEXT
       ======================================================================== */
    window.currentTaniOrderTab = 'all';
    window.currentTaniMonthFilter = 'all';
    window.activeTaniStatusOrderId = null;

    let taniOrderCurrentPage = 1;
    const TANI_PAGE_SIZE = 15;
    let filteredTaniOrdersCache = [];

    // Banarasi Karkhana Standard Color Palette
    const POPULAR_COLORS = [
        'Rani', 'Firozi', 'Lal', 'Mehendi', 'Blue', 'Peela', 'Wine', 
        'Mungia', 'Rama Green', 'Bottle Green', 'Jamuni', 'Peach', 
        'Gajari', 'Morpankhi', 'Mustard', 'Black', 'White', 'Zari', 'Resham'
    ];

    /* ========================================================================
       2. SAFE SANITIZATION & STORAGE BRIDGES
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

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null) ? String(val) : '';
    };

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
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

    /* ========================================================================
       3. DATA REPOSITORY & AUTO SERIAL NUMBER
       ======================================================================== */
    const getTaniOrders = () => toArray(getFromStore('tani_orders_list'));

    const saveTaniOrdersList = (list) => {
        setToStore('tani_orders_list', toArray(list));
        updateTaniOrderBadges();
        renderTaniMonthTabs();
        renderTaniOrdersTable();
    };

    const getNextParchiNumber = () => {
        const list = getTaniOrders();
        if (!list.length) return '367';
        let maxNum = 366;
        list.forEach((item) => {
            const n = safeInt(item.orderNo);
            if (n > maxNum) maxNum = n;
        });
        return String(maxNum + 1);
    };

    /* ========================================================================
       4. SMART AUTO-COMPLETE DATALISTS & AUTO-FILL MOHALLA
       ======================================================================== */
    const setupAutoDatalists = () => {
        // 1. Color Datalist
        let dlColors = document.getElementById('dl-tani-colors');
        if (!dlColors) {
            dlColors = document.createElement('datalist');
            dlColors.id = 'dl-tani-colors';
            document.body.appendChild(dlColors);
        }
        dlColors.innerHTML = POPULAR_COLORS.map(c => `<option value="${c}">`).join('');

        // 2. Rangai Wala Datalist
        let dlRangi = document.getElementById('dl-tani-rangi');
        if (!dlRangi) {
            dlRangi = document.createElement('datalist');
            dlRangi.id = 'dl-tani-rangi';
            document.body.appendChild(dlRangi);
        }
        const existingRangi = [...new Set(getTaniOrders().map(o => o.rangi).filter(Boolean))];
        dlRangi.innerHTML = existingRangi.map(r => `<option value="${esc(r)}">`).join('');

        const rangiInp = document.getElementById('tani-order-rangi');
        if (rangiInp) rangiInp.setAttribute('list', 'dl-tani-rangi');

        // 3. Sancha Datalist
        let dlSancha = document.getElementById('dl-tani-sancha');
        if (!dlSancha) {
            dlSancha = document.createElement('datalist');
            dlSancha.id = 'dl-tani-sancha';
            document.body.appendChild(dlSancha);
        }
        const sanchaItems = toArray(getFromStore('sancha_items') || getFromStore('sancha_list'));
        const sanchaNames = [...new Set([
            ...sanchaItems.map(s => s.name || s.sanchaName).filter(Boolean),
            ...getTaniOrders().map(o => o.sancha).filter(Boolean)
        ])];
        dlSancha.innerHTML = sanchaNames.map(s => `<option value="${esc(s)}">`).join('');

        const sanchaInp = document.getElementById('tani-order-sancha');
        if (sanchaInp) sanchaInp.setAttribute('list', 'dl-tani-sancha');

        // 4. Kariger selection ➔ Auto-Fill Mohalla
        const karigerInp = document.getElementById('tani-order-kariger');
        if (karigerInp) {
            karigerInp.setAttribute('list', 'dl-karigers-list');
            karigerInp.oninput = autoFillKarigerMohalla;
            karigerInp.onchange = autoFillKarigerMohalla;
        }
    };

    const autoFillKarigerMohalla = () => {
        const karigerInp = document.getElementById('tani-order-kariger');
        const mohallaInp = document.getElementById('tani-order-mohalla');
        if (!karigerInp || !mohallaInp) return;

        const kName = String(karigerInp.value || '').trim().toUpperCase();
        if (!kName) return;

        const allKarigers = toArray(getFromStore('kariger_list'));
        const found = allKarigers.find(k => k && String(k.name || '').trim().toUpperCase() === kName);

        if (found) {
            const addr = found.address || found.mohalla || found.pata || '';
            if (addr) mohallaInp.value = addr;
        }
    };

    /* ========================================================================
       5. 8-COLORS TABLE BUILDER & MULTI-CONTRAST CHECKBOXES
       ======================================================================== */
    const build8ColorInputs = () => {
        const tbody = document.getElementById('tani-colors-table-tbody');
        if (!tbody) return;

        if (tbody.children.length === 8) return;

        let html = '';
        const defaultPlaceholders = [
            { s: 'Rani', b: 'Firozi', bn: 'Zari' },
            { s: 'Lal', b: 'Green', bn: 'Resham' },
            { s: 'Mehendi', b: 'Wine', bn: 'Zari' },
            { s: 'Blue', b: 'Peela', bn: 'Resham' },
            { s: 'Peela', b: 'Rani', bn: 'Zari' },
            { s: 'Wine', b: 'Firozi', bn: 'Resham' },
            { s: 'Firozi', b: 'Lal', bn: 'Zari' },
            { s: 'Mungia', b: 'Rani', bn: 'Resham' }
        ];

        for (let i = 1; i <= 8; i++) {
            const def = defaultPlaceholders[i - 1];
            html += `<tr>
                <td style="text-align:center; font-weight:800; color:#b45309; background:#fffbeb;">${i}</td>
                <td><input type="text" id="tani-col-saree-${i}" list="dl-tani-colors" placeholder="${def.s}" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold;"></td>
                <td><input type="text" id="tani-col-border-${i}" list="dl-tani-colors" placeholder="${def.b}" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold;"></td>
                <td><input type="text" id="tani-col-bana-${i}" list="dl-tani-colors" placeholder="${def.bn}" style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold;"></td>
            </tr>`;
        }

        tbody.innerHTML = html;
        upgradeContrastToMultiCheckboxes();
    };

    const upgradeContrastToMultiCheckboxes = () => {
        const rRadios = document.querySelectorAll('input[name="tani_contrast_style"]');
        if (!rRadios.length) return;
        rRadios.forEach(r => {
            r.type = 'checkbox';
        });
    };

    /* ========================================================================
       6. VIEW INITIALIZER (FORM STRICTLY CLOSED BY DEFAULT)
       ======================================================================== */
    const initTaniOrderView = () => {
        // Form strictly band rahega by default
        setDisplay('add-tani-order-form', 'none');

        setupAutoDatalists();
        build8ColorInputs();

        taniOrderCurrentPage = 1;
        updateTaniOrderBadges();
        renderTaniMonthTabs();
        renderTaniOrdersTable();
    };

    const toggleTaniOrderForm = () => {
        const f = document.getElementById('add-tani-order-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            setupAutoDatalists();
            build8ColorInputs();
            resetTaniOrderForm();
            window.scrollTo({ top: f.offsetTop - 30, behavior: 'smooth' });
        }
    };

    const resetTaniOrderForm = () => {
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };

        setVal('tani-edit-id', '');
        setVal('tani-order-date', getToday());

        // Serial No. Automatic aur Locked (No typing needed)
        const noEl = document.getElementById('tani-order-no');
        if (noEl) {
            noEl.value = getNextParchiNumber();
            noEl.readOnly = true;
            noEl.style.backgroundColor = '#fef3c7';
            noEl.style.cursor = 'not-allowed';
            noEl.title = 'Automatic Serial Number';
        }

        setVal('tani-order-sancha', '');
        setVal('tani-order-kariger', '');
        setVal('tani-order-mohalla', '');
        setVal('tani-order-paai', '100');
        setVal('tani-order-border', '');
        setVal('tani-order-bana', '');
        setVal('tani-order-meter', '');
        setVal('tani-order-pcs', '72');
        setVal('tani-order-rangi', '');

        for (let i = 1; i <= 8; i++) {
            setVal(`tani-col-saree-${i}`, '');
            setVal(`tani-col-border-${i}`, '');
            setVal(`tani-col-bana-${i}`, '');
        }

        upgradeContrastToMultiCheckboxes();
        document.querySelectorAll('input[name="tani_contrast_style"]').forEach(c => {
            c.checked = (c.value === 'aanchal_blouse');
        });

        const rInit = document.querySelector('input[name="tani_initial_status"][value="sancha"]');
        if (rInit) rInit.checked = true;
    };

    /* ========================================================================
       7. HAR MAHINE KA ALAG PAGE (MONTHLY TABS ENGINE)
       ======================================================================== */
    const renderTaniMonthTabs = () => {
        let bar = document.getElementById('tani-monthly-tabs-bar');
        const orderSection = document.getElementById('tani-order-section');
        const filterTabsBar = document.querySelector('#tani-order-section .sheet-tabs-bar');

        if (!bar && orderSection && filterTabsBar) {
            bar = document.createElement('div');
            bar.id = 'tani-monthly-tabs-bar';
            bar.className = 'sheet-tabs-bar';
            bar.style.cssText = 'margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;';
            filterTabsBar.parentNode.insertBefore(bar, filterTabsBar.nextSibling);
        }

        if (!bar) return;

        const list = getTaniOrders();
        const monthsSet = new Set();

        list.forEach(item => {
            if (item.date && item.date.length >= 7) {
                monthsSet.add(item.date.substring(0, 7)); // e.g. "2026-11"
            }
        });

        const curMonthStr = getToday().substring(0, 7);
        monthsSet.add(curMonthStr);

        const sortedMonths = Array.from(monthsSet).sort().reverse();

        let html = `<span style="font-size:12px; font-weight:800; color:#b45309; margin-right:4px;">📅 Mahina:</span>`;
        const isAllActive = (window.currentTaniMonthFilter === 'all') ? 'active' : '';
        html += `<button type="button" class="sheet-tab ${isAllActive}" style="padding:4px 10px; font-size:12px;" onclick="TaniOrderEngine.switchTaniMonth('all')">Sabhi Mahine</button>`;

        sortedMonths.forEach(m => {
            const isActive = (window.currentTaniMonthFilter === m) ? 'active' : '';
            const dObj = new Date(`${m}-01`);
            const label = dObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            html += `<button type="button" class="sheet-tab ${isActive}" style="padding:4px 10px; font-size:12px;" onclick="TaniOrderEngine.switchTaniMonth('${m}')">${label}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchTaniMonth = (monthKey) => {
        window.currentTaniMonthFilter = monthKey;
        taniOrderCurrentPage = 1;
        renderTaniMonthTabs();
        renderTaniOrdersTable();
    };

    /* ========================================================================
       8. SAVE & UPDATE ORDER PARCHI
       ======================================================================== */
    const saveTaniOrder = () => {
        const editId = document.getElementById('tani-edit-id')?.value || '';
        const orderNo = String(document.getElementById('tani-order-no')?.value || '').trim() || getNextParchiNumber();
        const date = document.getElementById('tani-order-date')?.value || getToday();
        const sancha = String(document.getElementById('tani-order-sancha')?.value || '').trim().toUpperCase();
        const kariger = String(document.getElementById('tani-order-kariger')?.value || '').trim().toUpperCase();
        const mohalla = String(document.getElementById('tani-order-mohalla')?.value || '').trim();

        const paai = String(document.getElementById('tani-order-paai')?.value || '').trim();
        const border = String(document.getElementById('tani-order-border')?.value || '').trim();
        const bana = String(document.getElementById('tani-order-bana')?.value || '').trim();
        const meter = safeNum(document.getElementById('tani-order-meter')?.value);
        const pcs = safeInt(document.getElementById('tani-order-pcs')?.value);
        const rangi = String(document.getElementById('tani-order-rangi')?.value || '').trim().toUpperCase();

        if (!sancha && !kariger) {
            return alert('Sancha naam ya Kariger ka naam zaroori hai!');
        }

        const matchingTable = [];
        for (let i = 1; i <= 8; i++) {
            const sCol = String(document.getElementById(`tani-col-saree-${i}`)?.value || '').trim();
            const bCol = String(document.getElementById(`tani-col-border-${i}`)?.value || '').trim();
            const bnCol = String(document.getElementById(`tani-col-bana-${i}`)?.value || '').trim();
            if (sCol || bCol || bnCol) {
                matchingTable.push({ row: i, saree: sCol, border: bCol, bana: bnCol });
            }
        }

        // Multi-select contrast checkboxes
        const selectedContrasts = [];
        const contrastLabels = [];
        document.querySelectorAll('input[name="tani_contrast_style"]:checked').forEach(c => {
            selectedContrasts.push(c.value);
            if (c.value === 'aanchal_blouse') contrastLabels.push('آنچل بلاؤز');
            else if (c.value === 'border_only') contrastLabels.push('صرف بارڈر');
            else if (c.value === 'self') contrastLabels.push('سیلف');
        });

        const contrastVal = selectedContrasts.length ? selectedContrasts.join(', ') : 'aanchal_blouse';
        const contrastLabel = contrastLabels.length ? contrastLabels.join(' + ') : 'آنچل بلاؤز کنٹراس';

        const initRadio = document.querySelector('input[name="tani_initial_status"]:checked');
        const initialStatus = initRadio ? initRadio.value : 'sancha';

        const list = [...getTaniOrders()];
        let targetId = editId;

        if (editId) {
            const it = list.find((x) => String(x.id) === String(editId));
            if (it) {
                it.orderNo = orderNo;
                it.date = date;
                it.sancha = sancha;
                it.kariger = kariger;
                it.mohalla = mohalla;
                it.paai = paai;
                it.border = border;
                it.bana = bana;
                it.meter = meter;
                it.pcs = pcs;
                it.rangi = rangi;
                it.matchingTable = matchingTable;
                it.contrastVal = contrastVal;
                it.contrastLabel = contrastLabel;
                it.selectedContrasts = selectedContrasts;
                it.updatedAt = Date.now();
            }
        } else {
            targetId = `tani_${Date.now()}`;
            list.unshift({
                id: targetId,
                orderNo,
                date,
                sancha,
                kariger,
                mohalla,
                paai,
                border,
                bana,
                meter,
                pcs,
                rangi,
                matchingTable,
                contrastVal,
                contrastLabel,
                selectedContrasts,
                status: initialStatus,
                statusHistory: [
                    { status: initialStatus, date: getToday(), note: 'Order Diya Gaya' }
                ],
                createdAt: Date.now()
            });
        }

        saveTaniOrdersList(list);
        setDisplay('add-tani-order-form', 'none'); // Save hote hi band
        alert(`✅ Parchi No: #${orderNo} save ho gayi!`);
    };

    /* ========================================================================
       9. TRACKING PIPELINE & STATUS CONTROLLER
       ======================================================================== */
    const switchTaniOrderTab = (tab) => {
        window.currentTaniOrderTab = tab;
        taniOrderCurrentPage = 1;

        const tabs = ['all', 'sancha', 'baithak', 'rangai', 'ready'];
        tabs.forEach((t) => {
            const el = document.getElementById(`tab-tani-${t}`);
            if (el) {
                if (t === tab) el.classList.add('active');
                else el.classList.remove('active');
            }
        });
        renderTaniOrdersTable();
    };

    const updateTaniOrderBadges = () => {
        const list = getTaniOrders();
        let sanchaCount = 0, baithakCount = 0, rangaiCount = 0, readyCount = 0;

        list.forEach((item) => {
            const st = String(item.status || 'sancha').toLowerCase();
            if (st === 'sancha') sanchaCount++;
            else if (st === 'baithak') baithakCount++;
            else if (st === 'rangai') rangaiCount++;
            else if (st === 'ready') readyCount++;
        });

        setText('tani-stat-total', list.length);
        setText('tani-stat-sancha', sanchaCount);
        setText('tani-stat-baithak', baithakCount);
        setText('tani-stat-rangai', rangaiCount);
        setText('tani-stat-ready', readyCount);

        const dashBadge = document.getElementById('btn-total-tani-orders');
        if (dashBadge) {
            dashBadge.textContent = `${rangaiCount} Rangai | ${readyCount} Ready`;
            if (rangaiCount > 0) {
                dashBadge.style.background = '#fce7f3';
                dashBadge.style.color = '#be185d';
            } else {
                dashBadge.style.background = '#fef3c7';
                dashBadge.style.color = '#b45309';
            }
        }
    };

    const openTaniStatusModal = (orderId) => {
        const order = getTaniOrders().find((x) => String(x.id) === String(orderId));
        if (!order) return;

        window.activeTaniStatusOrderId = order.id;
        const sub = document.getElementById('tani-status-modal-sub');
        if (sub) {
            sub.textContent = `Parchi #${order.orderNo} | Sancha: ${order.sancha || '-'} | Kariger: ${order.kariger || '-'}`;
        }
        setDisplay('tani-status-modal', 'flex');
    };

    const closeTaniStatusModal = () => {
        setDisplay('tani-status-modal', 'none');
        window.activeTaniStatusOrderId = null;
    };

    const applyTaniStatusChange = (newStatus) => {
        if (!window.activeTaniStatusOrderId) return;
        const list = [...getTaniOrders()];
        const item = list.find((x) => String(x.id) === String(window.activeTaniStatusOrderId));
        if (!item) return;

        const prevStatus = item.status;
        item.status = newStatus;
        if (!Array.isArray(item.statusHistory)) item.statusHistory = [];

        let statusNote = 'Status Badla Gaya';
        if (newStatus === 'baithak') statusNote = 'Sancha wala Tani Baithak me le aaya';
        else if (newStatus === 'rangai') {
            statusNote = (prevStatus === 'sancha') ? '⚡ Direct Sanche se Rangai Par Gayi' : 'Baithak se Rangai wale ko Diya';
        } else if (newStatus === 'ready') statusNote = '🟢 Rang Ke Tayyar Aayi (Karkhana Ready!)';

        item.statusHistory.push({
            status: newStatus,
            date: getToday(),
            note: statusNote,
            timestamp: Date.now()
        });

        saveTaniOrdersList(list);
        closeTaniStatusModal();
        alert(`✅ Status Update: ${statusNote}`);
    };

    /* ========================================================================
       10. TABLE RENDERER WITH BUILT-IN PAGINATION & MONTH FILTER
       ======================================================================== */
    const renderTaniOrdersTable = () => {
        const tbody = document.getElementById('tani-orders-table-body');
        if (!tbody) return;

        let list = getTaniOrders();

        // 1. Month Filter
        if (window.currentTaniMonthFilter !== 'all') {
            list = list.filter((item) => item.date && item.date.startsWith(window.currentTaniMonthFilter));
        }

        // 2. Search Text Filter
        const searchInput = document.getElementById('search-tani-order-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (txt) {
            list = list.filter((item) => 
                `${item.orderNo || ''} ${item.sancha || ''} ${item.kariger || ''} ${item.mohalla || ''} ${item.rangi || ''}`.toLowerCase().includes(txt)
            );
        }

        // 3. Pipeline Tab Filter
        if (window.currentTaniOrderTab !== 'all') {
            list = list.filter((item) => String(item.status || 'sancha').toLowerCase() === window.currentTaniOrderTab);
        }

        filteredTaniOrdersCache = list;
        const totalEntries = list.length;

        // Pagination Controls Container
        let pager = document.getElementById('tani-order-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'tani-order-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:25px; color:#888;">Koi Tani Order Parchi nahi mili.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / TANI_PAGE_SIZE) || 1;
        if (taniOrderCurrentPage > totalPages) taniOrderCurrentPage = totalPages;
        if (taniOrderCurrentPage < 1) taniOrderCurrentPage = 1;

        const startIndex = (taniOrderCurrentPage - 1) * TANI_PAGE_SIZE;
        const pageRows = list.slice(startIndex, startIndex + TANI_PAGE_SIZE);

        let html = '';
        pageRows.forEach((item) => {
            const st = String(item.status || 'sancha').toLowerCase();
            let statusBadge = '';
            let nextBtnHtml = '';

            if (st === 'sancha') {
                statusBadge = '<span style="background:#fef9c3; color:#a16207; border:1px solid #fde047; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">🟡 1. Sancha Par</span>';
                nextBtnHtml = `
                    <button type="button" class="quick-btn btn-in" style="background:#ea580c; color:white; font-size:11px; padding:3px 6px;" onclick="quickStatusMove('${esc(item.id)}', 'baithak')">📦 Baithak Aayi</button>
                    <button type="button" class="quick-btn btn-out" style="background:#be185d; color:white; font-size:11px; padding:3px 6px; margin-left:3px;" onclick="quickStatusMove('${esc(item.id)}', 'rangai')">⚡ Direct Rangai</button>`;
            } else if (st === 'baithak') {
                statusBadge = '<span style="background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">📦 2. Baithak Me Padi</span>';
                nextBtnHtml = `<button type="button" class="quick-btn btn-out" style="background:#be185d; color:white; font-size:11px; padding:3px 8px;" onclick="quickStatusMove('${esc(item.id)}', 'rangai')">🟣 Rangai Ko Bhejo</button>`;
            } else if (st === 'rangai') {
                statusBadge = '<span style="background:#fce7f3; color:#be185d; border:1px solid #fbcfe8; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">🟣 3. Rangai Par</span>';
                nextBtnHtml = `<button type="button" class="quick-btn btn-in" style="background:#15803d; color:white; font-size:11px; padding:3px 8px;" onclick="quickStatusMove('${esc(item.id)}', 'ready')">🟢 Rang Ke Aayi (Ready)</button>`;
            } else if (st === 'ready') {
                statusBadge = '<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">🟢 4. Karkhana Ready!</span>';
                nextBtnHtml = '<span style="color:#15803d; font-size:11px; font-weight:bold;">✅ Loom Ready</span>';
            }

            const matchingCount = Array.isArray(item.matchingTable) ? item.matchingTable.length : 0;

            html += `<tr>
                <td><strong style="color:#b45309; font-size:14px;">#${esc(item.orderNo || '-')}</strong></td>
                <td>${formatDisplay(item.date)}</td>
                <td>
                    <strong style="color:#0284c7;">${esc(item.sancha || '-')}</strong><br>
                    <small style="color:#475569;">👤 ${esc(item.kariger || '-')}</small>
                </td>
                <td>
                    <strong>${safeNum(item.meter)} Mtr</strong><br>
                    <small style="color:#dc2626; font-weight:bold;">${safeInt(item.pcs)} Saree</small>
                </td>
                <td><strong style="color:#7c3aed;">🎨 ${esc(item.rangi || '-')}</strong></td>
                <td>
                    <span style="font-size:11px; font-weight:bold; color:#0f766e;">${matchingCount} Colors</span><br>
                    <small style="color:#64748b; font-size:10px;">${esc(item.contrastLabel || 'Self')}</small>
                </td>
                <td>${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    ${nextBtnHtml}
                    <button type="button" title="Manually Select" style="padding:2px 5px; font-size:11px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; margin-left:3px;" onclick="openTaniStatusModal('${esc(item.id)}')">⚙️</button>
                </td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" style="background:#b45309; color:white; padding:4px 8px; font-size:11px;" onclick="printTaniOrderA6('${esc(item.id)}')">🖨️ A6 Print</button>
                    <button type="button" class="whatsapp-btn" style="padding:4px 8px; font-size:11px;" onclick="sendTaniOrderWhatsApp('${esc(item.id)}')">📲</button>
                    <button type="button" class="edit-btn" onclick="editTaniOrder('${esc(item.id)}')">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteTaniOrder('${esc(item.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + TANI_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Parchi
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${taniOrderCurrentPage <= 1 ? '#cbd5e1' : '#b45309'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${taniOrderCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${taniOrderCurrentPage <= 1 ? 'disabled' : ''} onclick="changeTaniOrderPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${taniOrderCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${taniOrderCurrentPage >= totalPages ? '#cbd5e1' : '#b45309'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${taniOrderCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${taniOrderCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeTaniOrderPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeTaniOrderPage = (delta) => {
        taniOrderCurrentPage += delta;
        renderTaniOrdersTable();
    };

    const quickStatusMove = (id, newStatus) => {
        window.activeTaniStatusOrderId = id;
        applyTaniStatusChange(newStatus);
    };

    const editTaniOrder = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return;

        setDisplay('add-tani-order-form', 'block');
        setupAutoDatalists();
        build8ColorInputs();

        const setVal = (fid, v) => {
            const el = document.getElementById(fid);
            if (el) el.value = v;
        };

        setVal('tani-edit-id', item.id);
        setVal('tani-order-date', item.date || getToday());
        setVal('tani-order-no', item.orderNo || '');
        setVal('tani-order-sancha', item.sancha || '');
        setVal('tani-order-kariger', item.kariger || '');
        setVal('tani-order-mohalla', item.mohalla || '');
        setVal('tani-order-paai', item.paai || '');
        setVal('tani-order-border', item.border || '');
        setVal('tani-order-bana', item.bana || '');
        setVal('tani-order-meter', item.meter || '');
        setVal('tani-order-pcs', item.pcs || '');
        setVal('tani-order-rangi', item.rangi || '');

        for (let i = 1; i <= 8; i++) {
            setVal(`tani-col-saree-${i}`, '');
            setVal(`tani-col-border-${i}`, '');
            setVal(`tani-col-bana-${i}`, '');
        }

        if (Array.isArray(item.matchingTable)) {
            item.matchingTable.forEach((row) => {
                if (row && row.row) {
                    setVal(`tani-col-saree-${row.row}`, row.saree || '');
                    setVal(`tani-col-border-${row.row}`, row.border || '');
                    setVal(`tani-col-bana-${row.row}`, row.bana || '');
                }
            });
        }

        upgradeContrastToMultiCheckboxes();
        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : (item.contrastVal ? item.contrastVal.split(',').map(s => s.trim()) : []);
        document.querySelectorAll('input[name="tani_contrast_style"]').forEach(c => {
            c.checked = selContrasts.includes(c.value);
        });

        const formEl = document.getElementById('add-tani-order-form');
        if (formEl) window.scrollTo({ top: formEl.offsetTop - 30, behavior: 'smooth' });
    };

    const deleteTaniOrder = (id) => {
        if (!confirm('Kya is Tani Order Parchi ko delete karna chahte hain?')) return;
        const list = getTaniOrders().filter((x) => String(x.id) !== String(id));
        saveTaniOrdersList(list);
    };

    /* ========================================================================
       11. 🖨️ A6 PHYSICAL SLIP PRINT (EXACT REPLICA OF THE PAPER PAD)
       ======================================================================== */
    const printTaniOrderA6 = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return alert('Parchi nahi mili!');

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

        const selContrasts = Array.isArray(item.selectedContrasts) ? item.selectedContrasts : (item.contrastVal ? item.contrastVal.split(',').map(s => s.trim()) : ['aanchal_blouse']);
        const isAanchal = selContrasts.includes('aanchal_blouse') ? '☑' : '☐';
        const isBorder = selContrasts.includes('border_only') ? '☑' : '☐';
        const isSelf = selContrasts.includes('self') ? '☑' : '☐';

        const printWin = window.open('', '', 'width=450,height=700');
        if (!printWin) return alert('Popup block hai! Browser me popup allow karein.');

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
       12. 📲 WHATSAPP PARCHI SHARING
       ======================================================================== */
    const sendTaniOrderWhatsApp = (id) => {
        const item = getTaniOrders().find((x) => String(x.id) === String(id));
        if (!item) return;

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
       13. GLOBAL WINDOW EXPORTS (DIRECT ACCESSIBILITY)
       ======================================================================== */
    const taniOrderAPI = {
        initTaniOrderView,
        toggleTaniOrderForm,
        resetTaniOrderForm,
        saveTaniOrder,
        switchTaniOrderTab,
        switchTaniMonth,
        updateTaniOrderBadges,
        openTaniStatusModal,
        closeTaniStatusModal,
        applyTaniStatusChange,
        quickStatusMove,
        renderTaniOrdersTable,
        renderTaniMonthTabs,
        editTaniOrder,
        deleteTaniOrder,
        printTaniOrderA6,
        sendTaniOrderWhatsApp,
        getTaniOrders,
        changeTaniOrderPage
    };

    window.initTaniOrderView = initTaniOrderView;
    window.toggleTaniOrderForm = toggleTaniOrderForm;
    window.resetTaniOrderForm = resetTaniOrderForm;
    window.saveTaniOrder = saveTaniOrder;
    window.switchTaniOrderTab = switchTaniOrderTab;
    window.switchTaniMonth = switchTaniMonth;
    window.updateTaniOrderBadges = updateTaniOrderBadges;
    window.openTaniStatusModal = openTaniStatusModal;
    window.closeTaniStatusModal = closeTaniStatusModal;
    window.applyTaniStatusChange = applyTaniStatusChange;
    window.quickStatusMove = quickStatusMove;
    window.renderTaniOrdersTable = renderTaniOrdersTable;
    window.renderTaniMonthTabs = renderTaniMonthTabs;
    window.editTaniOrder = editTaniOrder;
    window.deleteTaniOrder = deleteTaniOrder;
    window.printTaniOrderA6 = printTaniOrderA6;
    window.sendTaniOrderWhatsApp = sendTaniOrderWhatsApp;
    window.changeTaniOrderPage = changeTaniOrderPage;
    window.TaniOrderEngine = taniOrderAPI;

    const bindSearch = () => {
        const searchInput = document.getElementById('search-tani-order-input');
        if (searchInput) {
            searchInput.oninput = () => {
                taniOrderCurrentPage = 1;
                renderTaniOrdersTable();
            };
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindSearch();
            initTaniOrderView();
        });
    } else {
        bindSearch();
        initTaniOrderView();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = taniOrderAPI;
    }
})();
