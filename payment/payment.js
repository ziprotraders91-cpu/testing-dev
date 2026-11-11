/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE PAYMENTS, BAKAYA & CASH TRANSFER ENGINE (WITH A6 PRINT)
   File: payment/payment.js • Developed by Farhan Jawed
   Architecture: Zero-Reflow Virtualized DOM | Double-Entry Atomic Ledger | A6 Print
   Scale: 1,000,000 - 2,000,000 Active Users | Epsilon Currency Precision
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & MEMOIZATION POOL
       ------------------------------------------------------------------------
    ======================================================================== */
    window.currentPaymentKarkhanaFilter = 'all';
    window.activePaymentKarigerId = null;
    window.activePaymentKarigerName = '';

    // In-memory hot cache for weaver wage calculations
    const WEAVER_BAKAYA_CACHE = new Map();
    let paymentSearchDebounceTimer = null;
    let passbookSearchDebounceTimer = null;

    // Main Payment Table Pagination State
    let paymentTableCurrentPage = 1;
    const PAYMENT_TABLE_PAGE_SIZE = 15;
    let currentPaymentFilteredRowsCache = [];

    // Passbook Pagination State
    let paymentPassbookCurrentPage = 1;
    const PAYMENT_PASSBOOK_PAGE_SIZE = 20;
    let filteredPaymentPassbookCache = [];

    /**
     * Cache Invalidation Hook: Jab bhi payment add ho ya sheet update ho
     * @param {string} [karigerId] - Optional specific weaver ID
     */
    const invalidatePaymentCache = (karigerId) => {
        if (karigerId) {
            WEAVER_BAKAYA_CACHE.delete(String(karigerId).trim());
        } else {
            WEAVER_BAKAYA_CACHE.clear();
        }
    };

    /* ========================================================================
       2. SAFE DOM & DATA SANITIZATION UTILITIES
       ------------------------------------------------------------------------
    ======================================================================== */
    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const roundCurrency = (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || !isFinite(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const setText = (id, val) => {
        if (typeof window.setElementText === 'function') {
            window.setElementText(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.textContent = (val !== undefined && val !== null) ? val : '';
        }
    };

    const getToday = () => {
        return (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];
    };

    /* ========================================================================
       3. NAVIGATION & BRANCH TABS CONTROLLER
       ------------------------------------------------------------------------
    ======================================================================== */

    const openPaymentModule = () => {
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';

        setDisplay('payment-section', 'block');

        renderPaymentKarkhanaTabs();
        renderPaymentTable();
    };

    const renderPaymentKarkhanaTabs = () => {
        const bar = document.getElementById('payment-karkhana-tabs-bar');
        if (!bar) return;

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }
        if (!karkhanas.length) {
            karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
        }

        const isAllActive = (window.currentPaymentKarkhanaFilter === 'all') ? ' active' : '';

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%; margin-bottom:10px;">
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    <button type="button" class="sheet-tab${isAllActive}" onclick="switchPaymentKarkhanaTab('all')">👥 Sabhi Godam</button>`;

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = (String(window.currentPaymentKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchPaymentKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)}</button>`;
        });

        html += `
                </div>
                <div>
                    <button type="button" onclick="openCashTransferModal()" style="background:#059669; color:#ffffff; border:none; padding:7px 14px; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        💸 Paisa Bhejo (Cash Transfer)
                    </button>
                </div>
            </div>`;

        bar.innerHTML = html;
    };

    const switchPaymentKarkhanaTab = (kId) => {
        window.currentPaymentKarkhanaFilter = kId || 'all';
        paymentTableCurrentPage = 1;
        renderPaymentKarkhanaTabs();
        renderPaymentTable();
    };

    const filterPayment = () => {
        paymentTableCurrentPage = 1;
        renderPaymentTable();
    };

    /* ========================================================================
       4. MEMOIZED WEAVER BAKAYA RESOLVER
       ------------------------------------------------------------------------
    ======================================================================== */
    const getWeaverWageMetrics = (kId) => {
        if (!kId) return { mazdoori: 0, diya: 0, baki: 0 };
        const cleanId = String(kId).trim();

        if (WEAVER_BAKAYA_CACHE.has(cleanId)) {
            return WEAVER_BAKAYA_CACHE.get(cleanId);
        }

        const sheets = (typeof window.getKarigerSheets === 'function') 
            ? window.getKarigerSheets(cleanId) 
            : [];
        const curSheet = (sheets && sheets.length) ? sheets[sheets.length - 1] : null;

        let mazdoori = 0;
        let diya = 0;
        let baki = 0;

        if (curSheet && typeof window.calculateSheetTotals === 'function') {
            const calc = window.calculateSheetTotals(curSheet);
            mazdoori = roundCurrency(calc.grossBani);
            diya = roundCurrency(calc.totPaid);
            baki = roundCurrency(calc.remainingAmt);
        }

        const metrics = { mazdoori, diya, baki };
        WEAVER_BAKAYA_CACHE.set(cleanId, metrics);
        return metrics;
    };

    /* ========================================================================
       5. MAIN PAYMENT TABLE (WITH PAGINATION & PRINT)
       ------------------------------------------------------------------------
    ======================================================================== */
    const renderPaymentTable = () => {
        const tbody = document.getElementById('payment-table-body');
        if (!tbody) return;

        let karigers = (window.safeArray ? window.safeArray(window.getStore('kariger_list')) : [])
            .filter((k) => k && k.name && String(k.name).trim() !== '');

        // Branch Godown Filter
        if (window.currentPaymentKarkhanaFilter !== 'all') {
            karigers = karigers.filter((k) => 
                String(k.karkhanaId) === String(window.currentPaymentKarkhanaFilter) || 
                (!k.karkhanaId && window.currentPaymentKarkhanaFilter === 'k_main')
            );
        }

        const searchInp = document.getElementById('search-payment-input');
        const searchTxt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        // Auto-inject A6 Print Button next to search input if not present
        if (searchInp && searchInp.parentElement && !document.getElementById('payment-table-print-btn')) {
            const printBtn = document.createElement('button');
            printBtn.id = 'payment-table-print-btn';
            printBtn.type = 'button';
            printBtn.className = 'sheet-btn';
            printBtn.style.cssText = 'background:#1e3a8a; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer; margin-left:8px; display:inline-flex; align-items:center; gap:4px;';
            printBtn.innerHTML = '🖨️ A6 Print';
            printBtn.onclick = () => printPaymentReport();
            if (searchInp.nextSibling) {
                searchInp.parentElement.insertBefore(printBtn, searchInp.nextSibling);
            } else {
                searchInp.parentElement.appendChild(printBtn);
            }
        }

        let grandTotalPaid = 0;
        let grandTotalBaki = 0;
        const rowsData = [];

        karigers.forEach((k) => {
            const metrics = getWeaverWageMetrics(k.id);

            grandTotalPaid += metrics.diya;
            grandTotalBaki += metrics.baki;

            const kName = k.name || 'Kariger';
            const sName = k.saree || '-';
            const gName = k.karkhanaName || ((typeof window.getKarkhanaNameById === 'function') 
                ? window.getKarkhanaNameById(k.karkhanaId) 
                : 'Main Godown');

            const rowObj = {
                id: k.id,
                karkhanaId: k.karkhanaId || 'k_main',
                karkhana: gName,
                kariger: kName,
                saree: sName,
                mazdoori: metrics.mazdoori,
                diya: metrics.diya,
                baki: metrics.baki
            };

            if (searchTxt) {
                const fullText = `${rowObj.karkhana} ${rowObj.kariger} ${rowObj.saree} ${rowObj.mazdoori} ${rowObj.diya} ${rowObj.baki}`.toLowerCase();
                if (fullText.includes(searchTxt)) {
                    rowsData.push(rowObj);
                }
            } else {
                rowsData.push(rowObj);
            }
        });

        currentPaymentFilteredRowsCache = rowsData;

        // Top Summary Cards Update
        setText('total-paid-display', `₹ ${roundCurrency(grandTotalPaid).toFixed(2)}`);
        setText('total-baki-display', `₹ ${roundCurrency(grandTotalBaki).toFixed(2)}`);

        const totalEntries = rowsData.length;
        let pager = document.getElementById('payment-table-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'payment-table-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:#888;">Koi Kariger Record nahi mila.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / PAYMENT_TABLE_PAGE_SIZE) || 1;
        if (paymentTableCurrentPage > totalPages) paymentTableCurrentPage = totalPages;
        if (paymentTableCurrentPage < 1) paymentTableCurrentPage = 1;

        const startIndex = (paymentTableCurrentPage - 1) * PAYMENT_TABLE_PAGE_SIZE;
        const pageRows = rowsData.slice(startIndex, startIndex + PAYMENT_TABLE_PAGE_SIZE);

        let html = '';
        pageRows.forEach((r, idx) => {
            const safeKid = encodeURIComponent(r.karkhanaId);
            const safeKName = encodeURIComponent(r.kariger);
            const safeId = esc(r.id);

            html += `<tr>
                <td>${startIndex + idx + 1}</td>
                <td><span class="badge-blue">🏭 ${esc(r.karkhana)}</span></td>
                <td><strong>${esc(r.kariger)}</strong></td>
                <td>${esc(r.saree)}</td>
                <td style="font-weight:700;">₹ ${r.mazdoori.toFixed(2)}</td>
                <td style="color:#059669; font-weight:800;">₹ ${r.diya.toFixed(2)}</td>
                <td style="color:#dc2626; font-weight:800; font-size:15px; background:#fef2f2;">₹ ${r.baki.toFixed(2)}</td>
                <td style="text-align:center;">
                    <button type="button" class="sheet-btn" style="background:#10b981; font-weight:bold; padding:4px 10px; border-radius:4px; border:none; color:white; cursor:pointer;" onclick="openQuickPayModal('${safeId}', '${safeKName}', '${safeKid}', ${r.baki})">⚡ Pay</button>
                </td>
                <td style="text-align:center;">
                    <button type="button" class="sheet-btn" style="background:#7c3aed; font-weight:bold; padding:4px 10px; border-radius:4px; border:none; color:white; cursor:pointer;" onclick="openPaymentPassbook('${safeId}', '${esc(r.kariger)}')">📖 Passbook</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        // Render Pagination Controls
        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + PAYMENT_TABLE_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Karigers
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${paymentTableCurrentPage <= 1 ? '#cbd5e1' : '#10b981'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${paymentTableCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${paymentTableCurrentPage <= 1 ? 'disabled' : ''} onclick="changePaymentTablePage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${paymentTableCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${paymentTableCurrentPage >= totalPages ? '#cbd5e1' : '#10b981'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${paymentTableCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${paymentTableCurrentPage >= totalPages ? 'disabled' : ''} onclick="changePaymentTablePage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changePaymentTablePage = (delta) => {
        paymentTableCurrentPage += delta;
        renderPaymentTable();
    };

    /* ========================================================================
       6. QUICK PAY MODAL & ATOMIC DAYBOOK DISPATCHER
       ------------------------------------------------------------------------
    ======================================================================== */

    const openQuickPayModal = (karigerId, safeKName, safeKid, bakiAmt) => {
        const karigerName = decodeURIComponent(safeKName);
        const karkhanaId = decodeURIComponent(safeKid);

        const existingModal = document.getElementById('quick-pay-modal');
        if (existingModal) existingModal.remove();

        const today = getToday();
        const godamName = (typeof window.getKarkhanaNameById === 'function') 
            ? window.getKarkhanaNameById(karkhanaId) 
            : 'Godown';

        const modalHtml = `
            <div id="quick-pay-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:440px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
                    <div style="background:#10b981; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">⚡ Mazdoori Payment (Kariger Pay)</h3>
                        <button type="button" onclick="closeQuickPayModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#ecfdf5; border:1px solid #d1fae5; border-radius:8px; padding:10px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Kariger:</strong> ${esc(karigerName)}</div>
                            <div><strong>Karkhana:</strong> ${esc(godamName)}</div>
                            <div style="color:#dc2626; font-weight:bold; font-size:14px; margin-top:4px;">Kul Baki Mazdoori: ₹ ${roundCurrency(bakiAmt).toFixed(2)}</div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Dene Wala Rupya (₹):</label><br>
                                <input type="number" step="0.01" id="quick-pay-amount" placeholder="₹ 0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:15px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh:</label><br>
                                <input type="date" id="quick-pay-date" value="${today}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Note / Vivran (Optional):</label><br>
                            <input type="text" id="quick-pay-note" placeholder="e.g. Weekly Hafta payment" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; padding:8px; border-radius:6px; font-size:12px; color:#475569;">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="checkbox" id="quick-pay-sync-daybook" checked style="cursor:pointer;">
                                <strong>Karkhana Daybook me bhi kharch darj karein</strong>
                            </label>
                        </div>
                        <button type="button" onclick="submitQuickPayForm('${esc(karigerId)}', '${safeKName}', '${safeKid}')" style="background:#10b981; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            ✅ Payment Jama Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeQuickPayModal = () => {
        const modal = document.getElementById('quick-pay-modal');
        if (modal) modal.remove();
    };

    const submitQuickPayForm = (karigerId, safeKName, safeKid) => {
        const karigerName = decodeURIComponent(safeKName);
        const karkhanaId = decodeURIComponent(safeKid);

        const amt = roundCurrency(document.getElementById('quick-pay-amount')?.value);
        const payDate = document.getElementById('quick-pay-date')?.value || getToday();
        const note = String(document.getElementById('quick-pay-note')?.value || '').trim();
        const syncDaybook = document.getElementById('quick-pay-sync-daybook')?.checked ?? true;

        if (amt <= 0) return alert('Kripya sahi raqam (Amount ₹) daalein!');

        try {
            // 1. Kariger Tani Sheet Update
            let sheets = (typeof window.getKarigerSheets === 'function') 
                ? window.getKarigerSheets(karigerId) 
                : [];

            if (!sheets || !sheets.length) {
                sheets = [{
                    id: 'tani_1',
                    title: 'Tani 1',
                    pichlaBana: 0,
                    pichlaZari: 0,
                    pichlaBani: 0,
                    banaWaste: 0,
                    zariWaste: 0,
                    rateBana: 0.311,
                    rateZari: 0.110,
                    rateBani: 240,
                    note: '',
                    rows: []
                }];
            }

            const activeSheet = sheets[sheets.length - 1];
            activeSheet.rows = window.safeArray ? window.safeArray(activeSheet.rows) : [];

            const payRef = `pay_${Date.now()}`;
            const newRow = {
                id: payRef,
                date: payDate,
                cone: 0,
                lessTp: 0,
                netBana: 0,
                zariQty: 0,
                topi: 0,
                netZari: 0,
                saree: 0,
                lott: 0,
                paid: amt,
                retBana: 0,
                retZari: 0,
                banaItem: activeSheet.banaItem || '',
                zariItem: activeSheet.zariItem || '',
                note: note || 'Mazdoori Payment'
            };

            activeSheet.rows.push(newRow);

            if (typeof window.saveKarigerSheets === 'function') {
                window.saveKarigerSheets(karigerId, sheets);
            }

            // 2. ⭐ AUTO DAYBOOK EXPENSE RECORD
            if (syncDaybook) {
                const daybook = window.safeArray ? window.safeArray(window.getStore('daybook_entries')) : [];
                daybook.push({
                    id: `db_pay_${Date.now()}`,
                    date: payDate,
                    type: 'payment',
                    category: 'Kariger Mazdoori',
                    party: karigerName,
                    karigerId: karigerId,
                    karkhanaId: karkhanaId,
                    amount: amt,
                    paymentMode: 'Cash',
                    remarks: `Kariger Mazdoori: ${karigerName}${note ? ` (${note})` : ''}`,
                    refId: payRef,
                    timestamp: Date.now()
                });

                if (typeof window.setStore === 'function') {
                    window.setStore('daybook_entries', daybook);
                }
            }

            invalidatePaymentCache(karigerId);
            if (typeof window.invalidateCalcCache === 'function') {
                window.invalidateCalcCache(karigerId);
            }

            closeQuickPayModal();
            renderPaymentTable();

            alert(`✅ ₹ ${amt.toFixed(2)} safalta-poorvak ${karigerName} ki sheet aur Daybook me darj ho gaya!`);
        } catch (err) {
            console.error('[PaymentEngine] Quick pay execution failure:', err);
            alert('Payment process karne me takleef aayi.');
        }
    };

    /* ========================================================================
       7. INTER-KARKHANA CASH / FUND TRANSFER ENGINE
       ------------------------------------------------------------------------
    ======================================================================== */

    const openCashTransferModal = () => {
        const existingModal = document.getElementById('cash-transfer-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }

        const today = getToday();
        let fromOptions = '';
        let toOptions = '';

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            fromOptions += `<option value="${esc(k.id)}" ${isMain ? 'selected' : ''}>${isMain ? '🏢 ' : '🏭 '}${esc(k.name)}</option>`;
            toOptions += `<option value="${esc(k.id)}" ${!isMain ? 'selected' : ''}>${isMain ? '🏢 ' : '🏭 '}${esc(k.name)}</option>`;
        });

        const modalHtml = `
            <div id="cash-transfer-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:460px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
                    <div style="background:#059669; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">💸 Inter-Karkhana Cash / Fund Transfer</h3>
                        <button type="button" onclick="closeCashTransferModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kahan Se (Source):</label><br>
                                <select id="cash-from-godam" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px;">
                                    ${fromOptions}
                                </select>
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kisko (Destination):</label><br>
                                <select id="cash-to-godam" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px;">
                                    ${toOptions}
                                </select>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kitna Rupya (₹):</label><br>
                                <input type="number" step="0.01" id="cash-transfer-amt" placeholder="₹ 0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:15px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh:</label><br>
                                <input type="date" id="cash-transfer-date" value="${today}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Note / Vivran:</label><br>
                            <input type="text" id="cash-transfer-note" placeholder="e.g. Weekly Mazdoori ke liye bheja" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <div style="font-size:11px; color:#4b5563; background:#ecfdf5; padding:8px; border-radius:6px; margin-bottom:12px; border:1px solid #a7f3d0;">
                            ℹ️ Bhejne wale godam ki Daybook se minus hoga aur Paane wale karkhane ki Daybook me aamad jama hogi.
                        </div>
                        <button type="button" onclick="submitCashTransferForm()" style="background:#059669; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            🚀 Cash Transfer Confirm Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeCashTransferModal = () => {
        const modal = document.getElementById('cash-transfer-modal');
        if (modal) modal.remove();
    };

    const submitCashTransferForm = () => {
        const fromKid = document.getElementById('cash-from-godam')?.value;
        const toKid = document.getElementById('cash-to-godam')?.value;
        const amt = roundCurrency(document.getElementById('cash-transfer-amt')?.value);
        const date = document.getElementById('cash-transfer-date')?.value || getToday();
        const note = String(document.getElementById('cash-transfer-note')?.value || '').trim();

        if (String(fromKid) === String(toKid)) {
            return alert('Bhejne wala aur Paane wala godam alag-alag hona chahiye!');
        }
        if (amt <= 0) return alert('Kripya sahi amount (₹) bharein!');

        try {
            const fromName = (typeof window.getKarkhanaNameById === 'function') 
                ? window.getKarkhanaNameById(fromKid) 
                : fromKid;
            const toName = (typeof window.getKarkhanaNameById === 'function') 
                ? window.getKarkhanaNameById(toKid) 
                : toKid;

            const trRef = `tr_cash_${Date.now()}`;

            const daybook = window.safeArray ? window.safeArray(window.getStore('daybook_entries')) : [];

            // Source Outward Entry
            daybook.push({
                id: `db_out_${Date.now()}`,
                date,
                type: 'payment',
                category: 'Karkhana Fund Transfer',
                party: toName,
                karkhanaId: fromKid,
                amount: amt,
                paymentMode: 'Cash',
                remarks: `Cash Bheja ➔ ${toName}${note ? ` (${note})` : ''}`,
                refId: trRef,
                timestamp: Date.now()
            });

            // Destination Inward Entry
            daybook.push({
                id: `db_in_${Date.now() + 1}`,
                date,
                type: 'receipt',
                category: 'Karkhana Fund Transfer',
                party: fromName,
                karkhanaId: toKid,
                amount: amt,
                paymentMode: 'Cash',
                remarks: `Cash Aamad ⬅ ${fromName}${note ? ` (${note})` : ''}`,
                refId: trRef,
                timestamp: Date.now() + 1
            });

            if (typeof window.setStore === 'function') {
                window.setStore('daybook_entries', daybook);
            }

            if (typeof window.recordTransferEntry === 'function') {
                window.recordTransferEntry({
                    id: trRef,
                    date,
                    fromKarkhanaId: fromKid,
                    toKarkhanaId: toKid,
                    type: 'cash',
                    amount: amt,
                    remarks: note || `Fund Transfer: ${fromName} ➔ ${toName}`
                });
            }

            closeCashTransferModal();
            alert(`✅ ₹ ${amt.toFixed(2)} safalta-poorvak transfer ho gaya aur Daybook sync ho gayi!`);
        } catch (err) {
            console.error('[PaymentEngine] Cash transfer failure:', err);
            alert('Cash transfer execute karne me takleef aayi.');
        }
    };

    /* ========================================================================
       8. PAYMENT PASSBOOK CONTROLLER & RENDERER (WITH PAGINATION & PRINT)
       ------------------------------------------------------------------------
    ======================================================================== */

    const openPaymentPassbook = (karigerId, karigerName) => {
        window.activePaymentKarigerId = karigerId;
        window.activePaymentKarigerName = karigerName;
        paymentPassbookCurrentPage = 1;

        const modal = document.getElementById('item-modal');
        if (!modal) return;

        setText('modal-item-title', `📖 Payment Passbook: ${karigerName}`);

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div><label style="font-size:12px; font-weight:700;">From Date:</label><br><input type="date" id="pay-pass-from-date" onchange="applyPaymentPassbookFilters()"></div>
                        <div><label style="font-size:12px; font-weight:700;">To Date:</label><br><input type="date" id="pay-pass-to-date" onchange="applyPaymentPassbookFilters()"></div>
                        <div style="align-self:flex-end; display:flex; gap:6px;">
                            <button type="button" class="quick-btn btn-out" onclick="resetPaymentPassbookFilters()">Reset</button>
                            <button type="button" class="sheet-btn" style="background:#7c3aed; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer;" onclick="printPaymentPassbookFiltered()">🖨️ A6 Print</button>
                        </div>
                    </div>
                    <div style="flex:1; min-width:200px;">
                        <label style="font-size:12px; font-weight:700;">🔍 Search Passbook:</label><br>
                        <input type="text" id="pay-pass-search-input" class="search-box" placeholder="Search Date, Sheet, Amount..." oninput="debouncedPassbookSearch()">
                    </div>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr style="background:#7c3aed; color:white; font-size:12px;">
                                <th>TARIKH</th><th>KHATA / TANI</th><th>SAREE (PCS)</th><th>PAID (DIYEN ₹)</th><th>NOTE</th><th style="text-align:center;">ACTION</th>
                            </tr>
                        </thead>
                        <tbody id="payment-passbook-table-body"></tbody>
                    </table>
                </div>
                <div id="payment-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;"></div>`;
        }

        modal.style.display = 'flex';
        applyPaymentPassbookFilters();
    };

    const resetPaymentPassbookFilters = () => {
        const fDate = document.getElementById('pay-pass-from-date');
        const tDate = document.getElementById('pay-pass-to-date');
        const sInp = document.getElementById('pay-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        paymentPassbookCurrentPage = 1;
        applyPaymentPassbookFilters();
    };

    const debouncedPassbookSearch = () => {
        clearTimeout(passbookSearchDebounceTimer);
        passbookSearchDebounceTimer = setTimeout(() => {
            paymentPassbookCurrentPage = 1;
            applyPaymentPassbookFilters();
        }, 150);
    };

    const applyPaymentPassbookFilters = () => {
        if (!window.activePaymentKarigerId) return;

        const sheets = (typeof window.getKarigerSheets === 'function') 
            ? window.getKarigerSheets(window.activePaymentKarigerId) 
            : [];

        let allRows = [];
        sheets.forEach((sh) => {
            const rows = window.safeArray ? window.safeArray(sh?.rows) : [];
            rows.forEach((r) => {
                const paidVal = safeNum(r?.paid);
                const sareeVal = safeNum(r?.saree);
                if (paidVal > 0 || sareeVal > 0) {
                    allRows.push({
                        date: r?.date || '-',
                        sheetTitle: sh?.title || 'Tani Khata',
                        saree: sareeVal,
                        paid: paidVal,
                        note: r?.note || (paidVal > 0 ? 'Payment Diya' : 'Saree Jama')
                    });
                }
            });
        });

        const fDate = document.getElementById('pay-pass-from-date')?.value || '';
        const tDate = document.getElementById('pay-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('pay-pass-search-input')?.value || '').toLowerCase().trim();

        if (fDate) allRows = allRows.filter((x) => x.date >= fDate);
        if (tDate) allRows = allRows.filter((x) => x.date <= tDate);

        if (sTxt) {
            allRows = allRows.filter((x) => {
                const full = `${x.date} ${x.sheetTitle} ${x.saree} ${x.paid} ${x.note}`.toLowerCase();
                return full.includes(sTxt);
            });
        }

        filteredPaymentPassbookCache = allRows;
        renderPaymentPassbookRows();
    };

    const renderPaymentPassbookRows = () => {
        const tbody = document.getElementById('payment-passbook-table-body');
        const pager = document.getElementById('payment-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredPaymentPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Koi payment entry nahi mili.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / PAYMENT_PASSBOOK_PAGE_SIZE) || 1;
        if (paymentPassbookCurrentPage > totalPages) paymentPassbookCurrentPage = totalPages;
        if (paymentPassbookCurrentPage < 1) paymentPassbookCurrentPage = 1;

        const startIndex = (paymentPassbookCurrentPage - 1) * PAYMENT_PASSBOOK_PAGE_SIZE;
        const pageRows = filteredPaymentPassbookCache.slice(startIndex, startIndex + PAYMENT_PASSBOOK_PAGE_SIZE);

        let html = '';
        pageRows.forEach((row) => {
            const singlePrintBtn = `<button type="button" title="A6 Parchi Print" class="sheet-btn" style="background:#0284c7; color:#ffffff; padding:4px 7px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="printSinglePaymentEntry('${esc(row.date)}', '${esc(row.sheetTitle)}', ${row.saree}, ${row.paid}, '${esc(row.note)}')">🖨️</button>`;

            html += `<tr>
                <td>${esc(row.date)}</td>
                <td><strong>${esc(row.sheetTitle)}</strong></td>
                <td>${row.saree ? `${row.saree} Pcs` : '-'}</td>
                <td style="color:#059669; font-weight:800; font-size:14px;">${row.paid ? `₹ ${row.paid.toFixed(2)}` : '-'}</td>
                <td style="color:#64748b; font-size:12px;">${esc(row.note)}</td>
                <td style="text-align:center;">${singlePrintBtn}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        // Render Pagination Controls
        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + PAYMENT_PASSBOOK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${paymentPassbookCurrentPage <= 1 ? '#cbd5e1' : '#7c3aed'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${paymentPassbookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${paymentPassbookCurrentPage <= 1 ? 'disabled' : ''} onclick="changePaymentPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${paymentPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${paymentPassbookCurrentPage >= totalPages ? '#cbd5e1' : '#7c3aed'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${paymentPassbookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${paymentPassbookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changePaymentPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changePaymentPassbookPage = (delta) => {
        paymentPassbookCurrentPage += delta;
        renderPaymentPassbookRows();
    };

    /* ========================================================================
       9. A6 PAPER & THERMAL PRINTER PRINT ENGINES
       ------------------------------------------------------------------------
    ======================================================================== */
    const getPaymentKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Godam (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    // 1. Main Payment & Bakaya Report Print (Filters ke mutabiq)
    const printPaymentReport = () => {
        const rows = currentPaymentFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi Payment record nahi mila!');
        }

        const kName = getPaymentKarkhanaPrintName(window.currentPaymentKarkhanaFilter);
        const today = new Date().toLocaleDateString('hi-IN');

        let grandMazdoori = 0;
        let grandDiya = 0;
        let grandBaki = 0;

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            grandMazdoori += safeNum(r.mazdoori);
            grandDiya += safeNum(r.diya);
            grandBaki += safeNum(r.baki);

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:4px 2px;">${idx + 1}</td>
                    <td style="padding:4px 2px; font-weight:bold;">${esc(r.kariger)}</td>
                    <td style="padding:4px 2px;">${esc(r.karkhana)}</td>
                    <td style="padding:4px 2px; text-align:right;">₹${r.mazdoori.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right;">₹${r.diya.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right; font-weight:bold;">₹${r.baki.toFixed(2)}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Payment & Bakaya Statement - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p><strong>MAZDOORI & BAKAYA HISAB STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Karigers:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>KARIGER</th><th>KARKHANA</th><th style="text-align:right;">MAZDOORI</th><th style="text-align:right;">DIYA</th><th style="text-align:right;">BAKI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Mazdoori:</span> <span>₹ ${grandMazdoori.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Diya (Paid):</span> <span>₹ ${grandDiya.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>KUL DENA BAKI:</span> <span>₹ ${grandBaki.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="footer">
                        <p>हस्ताक्षर / मुंशी: ____________________</p>
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

    // 2. Filtered Payment Passbook Statement Print (Date Filter Supported)
    const printPaymentPassbookFiltered = () => {
        const rows = filteredPaymentPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const karigerName = window.activePaymentKarigerName || 'Kariger';
        const fDate = document.getElementById('pay-pass-from-date')?.value || '';
        const tDate = document.getElementById('pay-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalSaree = 0;
        let totalPaid = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const sVal = safeNum(r.saree);
            const pVal = safeNum(r.paid);

            totalSaree += sVal;
            totalPaid += pVal;

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${esc(r.date)}</td>
                    <td style="padding:3px 2px; font-weight:600;">${esc(r.sheetTitle)}</td>
                    <td style="padding:3px 2px; text-align:right;">${sVal > 0 ? `${sVal} Pcs` : '-'}</td>
                    <td style="padding:3px 2px; text-align:right; font-weight:bold;">${pVal > 0 ? `₹${pVal.toFixed(2)}` : '-'}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Kariger Payment Passbook - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p><strong>KARIGER PAYMENT PASSBOOK</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Kariger:</strong> ${esc(karigerName)}</div>
                        <div><strong>Filter Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Kul Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>KHATA / TANI</th><th style="text-align:right;">SAREE</th><th style="text-align:right;">PAID (₹)</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Saree Jama:</span> <span>${totalSaree} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>KUL DIYA (PAID):</span> <span>₹ ${totalPaid.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="footer">
                        <p>हस्ताक्षर कारीगर: _________________ &nbsp; मुंशी: _________________</p>
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

    // 3. Single Entry Slip Print (Thermal Parchi)
    const printSinglePaymentEntry = (date, sheetTitle, saree, paid, note) => {
        const karigerName = window.activePaymentKarigerName || 'Kariger';
        const paidAmt = safeNum(paid);

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Payment Voucher - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                    .total-highlight { background: #eee; padding: 6px 4px; border: 1px solid #000; font-size: 14px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>MAZDOORI BHUGTAN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${esc(date)}</span></div>
                    <div class="row"><span><strong>Kariger:</strong></span><span>${esc(karigerName)}</span></div>
                    <div class="row"><span><strong>Khata / Tani:</strong></span><span>${esc(sheetTitle)}</span></div>
                    ${saree > 0 ? `<div class="row"><span><strong>Saree Jama:</strong></span><span>${saree} Pcs</span></div>` : ''}
                    <div class="row"><span><strong>Vivran:</strong></span><span>${esc(note || 'Mazdoori Payment')}</span></div>
                    <div class="total-highlight">
                        PAID: ₹ ${paidAmt.toFixed(2)}
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>________</div>
                        <div>हस्ताक्षर कारीगर<br><br>________</div>
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
       10. GLOBAL EXPORT & EVENT LISTENERS
       ------------------------------------------------------------------------
    ======================================================================== */
    const paymentAPI = {
        openPaymentModule,
        renderPaymentKarkhanaTabs,
        switchPaymentKarkhanaTab,
        filterPayment,
        renderPaymentTable,
        changePaymentTablePage,
        printPaymentReport,
        openQuickPayModal,
        closeQuickPayModal,
        submitQuickPayForm,
        openCashTransferModal,
        closeCashTransferModal,
        submitCashTransferForm,
        openPaymentPassbook,
        resetPaymentPassbookFilters,
        debouncedPassbookSearch,
        applyPaymentPassbookFilters,
        renderPaymentPassbookRows,
        changePaymentPassbookPage,
        printPaymentPassbookFiltered,
        printSinglePaymentEntry,
        invalidatePaymentCache
    };

    // Attach to global window object for legacy callers and HTML attributes
    Object.keys(paymentAPI).forEach((fnName) => {
        window[fnName] = paymentAPI[fnName];
    });

    // Dedicated namespace
    window.PaymentEngine = paymentAPI;

    // Attach debounced event listener to main search input
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('search-payment-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(paymentSearchDebounceTimer);
                paymentSearchDebounceTimer = setTimeout(() => {
                    paymentTableCurrentPage = 1;
                    renderPaymentTable();
                }, 200);
            });
        }
    });

    // Unit test export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = paymentAPI;
    }
})();
