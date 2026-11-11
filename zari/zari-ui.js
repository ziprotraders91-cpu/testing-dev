/* ========================================================
   SIMPLICITY ERP - ZARI STOCK & PAGINATED PASSBOOK ENGINE (WITH LIVE SEARCH & A6 PRINT)
   File: zari/zari-ui.js • Developed by Farhan Jawed
   (Multi-Godam Stock, Edit/Delete, Kariger Lock, Fast Mobile Pagination, Live Search & A6 Print)
======================================================== */

(() => {
    'use strict';

    window.currentZariKarkhanaFilter = 'all';
    window.currentPassbookZariItem = '';

    // 📱 PAGINATION STATE
    let zariPassbookCurrentPage = 1;
    const ZARI_PAGE_SIZE = 20;
    let filteredZariPassbookCache = [];

    // Main Zari Stock Table Pagination State
    let zariStockCurrentPage = 1;
    const ZARI_STOCK_PAGE_SIZE = 15;
    let currentZariFilteredRowsCache = [];

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const setDisplay = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.style.display = val;
    };

    /* ========================================================================
       1. NAVIGATION & TABS
       ------------------------------------------------------------------------
    ======================================================================== */
    const openZariModule = () => {
        setDisplay('dashboard-view', 'none');
        setDisplay('zari-section', 'block');

        renderZariKarkhanaTabs();
        populateZariExistingDropdown();
        renderZariTable();
        bindZariSearchInput();
    };

    const renderZariKarkhanaTabs = () => {
        const bar = document.getElementById('zari-karkhana-tabs-bar');
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

        const isAllActive = (window.currentZariKarkhanaFilter === 'all') ? ' active' : '';
        let html = `<button type="button" class="sheet-tab${isAllActive}" onclick="switchZariKarkhanaTab('all')">👥 Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = (String(window.currentZariKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchZariKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchZariKarkhanaTab = (kId) => {
        window.currentZariKarkhanaFilter = kId || 'all';
        zariStockCurrentPage = 1;
        renderZariKarkhanaTabs();
        populateZariExistingDropdown();
        renderZariTable();
    };

    /* ========================================================================
       2. INWARD PURCHASE ENGINE
       ------------------------------------------------------------------------
    ======================================================================== */
    const toggleZariForm = () => {
        const f = document.getElementById('add-zari-form');
        if (!f) return;
        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('zari-date');
            if (dInp) {
                dInp.value = (typeof window.getTodayDate === 'function') 
                    ? window.getTodayDate() 
                    : new Date().toISOString().split('T')[0];
            }
        }
    };

    const toggleZariItemType = () => {
        const isNew = document.getElementById('zari-type-new') 
            ? document.getElementById('zari-type-new').checked 
            : true;
        setDisplay('zari-existing-group', isNew ? 'none' : 'block');
        setDisplay('zari-new-group', isNew ? 'block' : 'none');
    };

    const populateZariExistingDropdown = () => {
        const sel = document.getElementById('zari-select-existing');
        if (!sel) return;
        sel.innerHTML = '';
        const list = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
        const unique = [];

        list.forEach((z) => {
            const n = z?.name ? z.name.trim() : '';
            if (n && unique.indexOf(n.toLowerCase()) === -1) {
                unique.push(n.toLowerCase());
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                sel.appendChild(opt);
            }
        });
    };

    const saveNewZari = () => {
        const isNew = document.getElementById('zari-type-new') 
            ? document.getElementById('zari-type-new').checked 
            : true;

        const nameInp = isNew ? document.getElementById('zari-new-name') : document.getElementById('zari-select-existing');
        const name = String(nameInp?.value || '').trim();

        const date = document.getElementById('zari-date')?.value || 
                    ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);

        const qtyInp = document.getElementById('zari-aaya');
        const qty = safeNum(qtyInp?.value);

        if (!name) return alert('Zari Item ka naam zaroori hai!');
        if (qty <= 0) return alert('Wazan (Qty) daalein!');

        const targetKid = (window.currentZariKarkhanaFilter !== 'all') ? window.currentZariKarkhanaFilter : 'k_main';
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
                id: `zari_${Date.now()}`,
                date,
                name,
                aaya: qty,
                gaya: 0,
                bacha: qty,
                karkhanaId: targetKid,
                timestamp: Date.now()
            });
        }
        if (typeof window.setStore === 'function') window.setStore('zari_stock', list);

        const hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        hist.push({
            id: `zhist_${Date.now()}`,
            date,
            name,
            kariger: 'Godown Purchase',
            type: 'Khareed (Inward)',
            aaya: qty,
            gaya: 0,
            karkhanaId: targetKid,
            timestamp: Date.now()
        });
        if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

        const newNameEl = document.getElementById('zari-new-name');
        if (newNameEl) newNameEl.value = '';
        if (qtyInp) qtyInp.value = '';

        toggleZariForm();
        populateZariExistingDropdown();
        renderZariTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert(`✅ ${qty.toFixed(2)} Kg Zari Stock me jama ho gayi!`);
    };

    // 🔍 LIVE SEARCH BINDER (Instant search on typing)
    const bindZariSearchInput = () => {
        const searchInp = document.getElementById('search-zari-input');
        if (searchInp && !searchInp.dataset.bound) {
            searchInp.dataset.bound = 'true';
            searchInp.addEventListener('input', () => {
                zariStockCurrentPage = 1;
                renderZariTable();
            });
        }
    };

    const filterZari = () => {
        zariStockCurrentPage = 1;
        renderZariTable();
    };

    /* ========================================================================
       3. MAIN ZARI TABLE RENDERER (WITH LIVE SEARCH, PAGINATION & PRINT)
       ------------------------------------------------------------------------
    ======================================================================== */
    const renderZariTable = () => {
        bindZariSearchInput();

        const tbody = document.getElementById('zari-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const rawStock = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
        const uniqueNames = [];

        rawStock.forEach((z) => {
            if (!z || !z.name) return;
            const n = z.name.trim();
            if (uniqueNames.map(x => x.toLowerCase()).indexOf(n.toLowerCase()) === -1) {
                uniqueNames.push(n);
            }
        });

        const rows = [];
        uniqueNames.forEach((name) => {
            if (typeof window.getZariItemStats === 'function') {
                const stats = window.getZariItemStats(name, window.currentZariKarkhanaFilter);
                if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                    rows.push(stats);
                }
            }
        });

        const searchInp = document.getElementById('search-zari-input');
        const txt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        // Universal Search: Name, Date, Aaya, Gaya, Bacha
        const filteredRows = txt 
            ? rows.filter(r => `${r.name || ''} ${r.date || ''} ${r.aaya || ''} ${r.gaya || ''} ${r.bacha || ''}`.toLowerCase().includes(txt)) 
            : rows;

        currentZariFilteredRowsCache = filteredRows;

        // Auto-inject A6 Print Button next to search box if not present
        if (searchInp && searchInp.parentElement && !document.getElementById('zari-stock-print-btn')) {
            const printBtn = document.createElement('button');
            printBtn.id = 'zari-stock-print-btn';
            printBtn.type = 'button';
            printBtn.className = 'sheet-btn';
            printBtn.style.cssText = 'background:#ea580c; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer; margin-left:8px; display:inline-flex; align-items:center; gap:4px;';
            printBtn.innerHTML = '🖨️ A6 Print';
            printBtn.onclick = () => printZariStockReport();
            if (searchInp.nextSibling) {
                searchInp.parentElement.insertBefore(printBtn, searchInp.nextSibling);
            } else {
                searchInp.parentElement.appendChild(printBtn);
            }
        }

        let totalBacha = 0;
        rows.forEach(r => { totalBacha += safeNum(r.bacha); });

        const totalEntries = filteredRows.length;
        let pager = document.getElementById('zari-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'zari-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:20px; color:#888;'>Koi Zari Stock nahi mila.</td></tr>";
            if (pager) pager.innerHTML = '';
        } else {
            const totalPages = Math.ceil(totalEntries / ZARI_STOCK_PAGE_SIZE) || 1;
            if (zariStockCurrentPage > totalPages) zariStockCurrentPage = totalPages;
            if (zariStockCurrentPage < 1) zariStockCurrentPage = 1;

            const startIndex = (zariStockCurrentPage - 1) * ZARI_STOCK_PAGE_SIZE;
            const pageRows = filteredRows.slice(startIndex, startIndex + ZARI_STOCK_PAGE_SIZE);

            let html = '';
            pageRows.forEach((z) => {
                const bacha = safeNum(z.bacha);
                const safeName = encodeURIComponent(z.name);

                let transferBtn = '';
                if (bacha > 0) {
                    transferBtn = `<button type="button" class="sheet-btn" style="background:#f59e0b; color:#ffffff; padding:4px 9px; font-weight:bold; margin-left:6px; border-radius:4px; border:none; cursor:pointer;" onclick="openZariTransferModal('${safeName}', ${bacha})">🚚 Bhejo</button>`;
                }

                html += `<tr>
                    <td>${esc(z.date || '-')}</td>
                    <td><strong style="color:#1e3a8a;">${esc(z.name)}</strong></td>
                    <td style="color:#059669; font-weight:700;">+${safeNum(z.aaya).toFixed(2)}</td>
                    <td style="color:#ea580c; font-weight:700;">-${safeNum(z.gaya).toFixed(2)}</td>
                    <td style="font-weight:800; color:#1e3a8a; background:#eff6ff; font-size:14px;">${bacha.toFixed(2)} Kg</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button type="button" class="sheet-btn" style="background:#ea580c; padding:4px 10px; font-weight:bold; border-radius:4px; border:none; color:white; cursor:pointer;" onclick="openZariPassbook('${safeName}')">📖 Passbook</button>
                        ${transferBtn}
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;

            // Render Stock Pagination Controls
            if (pager) {
                pager.innerHTML = `
                    <div style="font-size:12px; color:#475569; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + ZARI_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="sheet-btn" style="background:${zariStockCurrentPage <= 1 ? '#cbd5e1' : '#ea580c'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${zariStockCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${zariStockCurrentPage <= 1 ? 'disabled' : ''} onclick="changeZariStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${zariStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="sheet-btn" style="background:${zariStockCurrentPage >= totalPages ? '#cbd5e1' : '#ea580c'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${zariStockCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${zariStockCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeZariStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const opVal = document.getElementById('zari-opening-val');
        if (opVal) opVal.textContent = `${totalBacha.toFixed(2)} Kg Kul Bachi`;
    };

    const changeZariStockPage = (delta) => {
        zariStockCurrentPage += delta;
        renderZariTable();
    };

    /* ========================================================================
       4. INTER-GODOWN TRANSFER POPUP
       ------------------------------------------------------------------------
    ======================================================================== */
    const openZariTransferModal = (safeName, availableBacha) => {
        const itemName = decodeURIComponent(safeName);
        const existingModal = document.getElementById('zari-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = (typeof window.getKarkhanasSafe === 'function') 
            ? window.getKarkhanasSafe() 
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);

        const currentKid = (window.currentZariKarkhanaFilter !== 'all') ? window.currentZariKarkhanaFilter : 'k_main';
        const currentGodamName = (typeof window.getKarkhanaNameById === 'function') 
            ? window.getKarkhanaNameById(currentKid) 
            : currentKid;

        let godownOptions = '';
        karkhanas.forEach((k) => {
            if (String(k.id) !== String(currentKid)) {
                const isMain = (k.id === 'k_main' || k.isDefault);
                godownOptions += `<option value="${esc(k.id)}">${isMain ? '🏢 ' : '🏭 '}${esc(k.name)}</option>`;
            }
        });

        const today = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0];

        const modalHtml = `
            <div id="zari-transfer-popup-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:460px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
                    <div style="background:#ea580c; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">🚚 Zari Stock Transfer</h3>
                        <button type="button" onclick="closeZariTransferModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:8px; padding:10px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Zari Item:</strong> ${esc(itemName)}</div>
                            <div><strong>Bhejne Wala Godam:</strong> ${esc(currentGodamName)}</div>
                            <div style="color:#ea580c; font-weight:bold; font-size:14px; margin-top:4px;">Maujooda Bacha Wazan: ${availableBacha.toFixed(2)} Kg</div>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Kahan Bhejna Hai (Destination Godam):</label><br>
                            <select id="zari-dest-godam" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px;">
                                ${godownOptions}
                            </select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kitna Wazan (Kg):</label><br>
                                <input type="number" step="0.01" id="zari-transfer-qty" max="${availableBacha}" min="0.01" value="${availableBacha}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh:</label><br>
                                <input type="date" id="zari-transfer-date" value="${today}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Note / Parchi No. (Optional):</label><br>
                            <input type="text" id="zari-transfer-note" placeholder="e.g. Mubarakpur unit ke liye bheja" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <button type="button" onclick="submitZariTransferForm('${safeName}', '${currentKid}', ${availableBacha})" style="background:#ea580c; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            🚀 Zari Transfer Confirm Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeZariTransferModal = () => {
        const modal = document.getElementById('zari-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const submitZariTransferForm = (safeName, fromKid, maxAvailable) => {
        const itemName = decodeURIComponent(safeName);
        const toKid = document.getElementById('zari-dest-godam')?.value;
        const qty = safeNum(document.getElementById('zari-transfer-qty')?.value);
        const d = document.getElementById('zari-transfer-date')?.value || 
                 ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : '');
        const note = String(document.getElementById('zari-transfer-note')?.value || '').trim();

        if (!toKid) return alert('Kripya Paane wala Godam chunein!');
        if (qty <= 0) return alert('Kripya sahi wazan (Kg) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable.toFixed(2)} Kg bachi hai!`);

        let success = false;
        if (typeof window.transferZariStock === 'function') {
            success = window.transferZariStock(d, itemName, fromKid, toKid, qty, note);
        }

        if (success) {
            closeZariTransferModal();
            renderZariTable();
            alert(`✅ ${qty.toFixed(2)} Kg Zari safalta-poorvak transfer ho gayi!`);
        }
    };

    /* ========================================================================
       5. 📱 PAGINATED ZARI PASSBOOK ENGINE (WITH A6 PRINT)
       ------------------------------------------------------------------------
    ======================================================================== */
    const openZariPassbook = (safeName) => {
        window.currentPassbookZariItem = decodeURIComponent(safeName);
        zariPassbookCurrentPage = 1;

        const modal = document.getElementById('item-modal');
        if (!modal) return;

        const title = document.getElementById('modal-item-title');
        if (title) title.textContent = `📖 Zari Passbook: ${window.currentPassbookZariItem}`;

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div><label style="font-size:12px; font-weight:700;">From Date:</label><br><input type="date" id="zari-pass-from-date" onchange="applyZariPassbookFilters()"></div>
                        <div><label style="font-size:12px; font-weight:700;">To Date:</label><br><input type="date" id="zari-pass-to-date" onchange="applyZariPassbookFilters()"></div>
                        <div style="align-self:flex-end; display:flex; gap:6px;">
                            <button type="button" class="quick-btn btn-out" onclick="resetZariPassbookFilters()">Reset</button>
                            <button type="button" class="sheet-btn" style="background:#ea580c; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer;" onclick="printZariPassbookFiltered()">🖨️ A6 Print</button>
                        </div>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:12px; font-weight:700;">🔍 Search:</label><br>
                        <input type="text" id="zari-pass-search-input" class="search-box" placeholder="Search Date, Kariger..." oninput="applyZariPassbookFilters()">
                    </div>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr style="background:#ea580c; color:white; font-size:12px;">
                                <th>TARIKH</th><th>DETAIL (TYPE)</th><th>KARIGER / SOURCE</th><th>AAYI (Kg)</th><th>GAYI (Kg)</th><th style="text-align:center;">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="zari-passbook-table-body"></tbody>
                    </table>
                </div>
                <div id="zari-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;"></div>`;
        }

        modal.style.display = 'flex';
        applyZariPassbookFilters();
    };

    const resetZariPassbookFilters = () => {
        const fDate = document.getElementById('zari-pass-from-date');
        const tDate = document.getElementById('zari-pass-to-date');
        const sInp = document.getElementById('zari-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        zariPassbookCurrentPage = 1;
        applyZariPassbookFilters();
    };

    const applyZariPassbookFilters = () => {
        const targetItemLower = window.currentPassbookZariItem.toLowerCase();
        const allHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];

        let hist = allHist.filter((x) => {
            if (!x?.name) return false;
            if (x.name.toLowerCase() !== targetItemLower) return false;

            if (window.currentZariKarkhanaFilter !== 'all') {
                const rowKid = x.karkhanaId || 'k_main';
                return String(rowKid) === String(window.currentZariKarkhanaFilter);
            }
            return true;
        });

        const fDate = document.getElementById('zari-pass-from-date')?.value || '';
        const tDate = document.getElementById('zari-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('zari-pass-search-input')?.value || '').toLowerCase().trim();

        if (fDate) hist = hist.filter(x => x.date >= fDate);
        if (tDate) hist = hist.filter(x => x.date <= tDate);

        if (sTxt) {
            hist = hist.filter((x) => {
                const rowString = `${x.date || ''} ${x.type || ''} ${x.kariger || ''} ${x.aaya || x.qty || ''} ${x.gaya || ''}`.toLowerCase();
                return rowString.includes(sTxt);
            });
        }

        hist.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredZariPassbookCache = hist;
        renderPaginatedZariPassbook();
    };

    const renderPaginatedZariPassbook = () => {
        const tbody = document.getElementById('zari-passbook-table-body');
        const pager = document.getElementById('zari-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredZariPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding:15px; color:#888;'>Koi entry nahi mili.</td></tr>";
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / ZARI_PAGE_SIZE);
        if (zariPassbookCurrentPage > totalPages) zariPassbookCurrentPage = totalPages;
        if (zariPassbookCurrentPage < 1) zariPassbookCurrentPage = 1;

        const startIndex = (zariPassbookCurrentPage - 1) * ZARI_PAGE_SIZE;
        const pageRows = filteredZariPassbookCache.slice(startIndex, startIndex + ZARI_PAGE_SIZE);

        let html = '';
        pageRows.forEach((r) => {
            const aayaQty = safeNum(r.aaya || r.qty);
            const gayaQty = safeNum(r.gaya);

            const isOpeningEntry = r.isOpening || (r.type && r.type.toLowerCase().includes('opening'));
            const isKarigerEntry = (r.type && r.type.toLowerCase().includes('kariger')) || 
                                  (r.kariger && r.kariger.toLowerCase().includes('kariger sheet'));

            const karigerDisplay = isOpeningEntry 
                ? '📦 31st March Closing (Opening)' 
                : ((r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? `👤 ${esc(r.kariger)}` : '📦 Factory Inward');

            const singlePrintBtn = `<button type="button" title="A6 Slip Print" class="sheet-btn" style="background:#0284c7; color:#ffffff; padding:4px 7px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="printSingleZariPassbookEntry('${esc(r.id)}')">🖨️</button>`;

            let actBtn = '';
            if (isOpeningEntry) {
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#64748b; font-size:11px; font-weight:700;'>🔒 Opening Lock</span>
                    ${singlePrintBtn}
                </div>`;
            } else if (isKarigerEntry) {
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#64748b; font-size:11px; font-weight:700;'>🔒 Kariger Sheet</span>
                    ${singlePrintBtn}
                </div>`;
            } else {
                actBtn = `
                    <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                        <button type="button" class="sheet-btn" style="background:#3b82f6; color:#ffffff; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="openZariEditModal('${esc(r.id)}')">✏️ Edit</button>
                        <button type="button" class="sheet-btn" style="background:#ef4444; color:#ffffff; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="deleteZariHistoryEntry('${esc(r.id)}')">🗑️ Del</button>
                        ${singlePrintBtn}
                    </div>`;
            }

            html += `<tr>
                <td>${esc(r.date || '-')}</td>
                <td><strong>${esc(r.type || 'Godam Inward')}</strong></td>
                <td style="color:#1e3a8a; font-weight:700;">${karigerDisplay}</td>
                <td style="color:#059669; font-weight:700;">${aayaQty > 0 ? `+${aayaQty.toFixed(2)}` : '-'}</td>
                <td style="color:#ea580c; font-weight:700;">${gayaQty > 0 ? `-${gayaQty.toFixed(2)}` : '-'}</td>
                <td style="text-align:center; white-space:nowrap;">${actBtn}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        // Render Pagination Controls
        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + ZARI_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${zariPassbookCurrentPage <= 1 ? '#cbd5e1' : '#ea580c'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${zariPassbookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${zariPassbookCurrentPage <= 1 ? 'disabled' : ''} onclick="changeZariPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${zariPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${zariPassbookCurrentPage >= totalPages ? '#cbd5e1' : '#ea580c'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${zariPassbookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${zariPassbookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeZariPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeZariPassbookPage = (delta) => {
        zariPassbookCurrentPage += delta;
        renderPaginatedZariPassbook();
    };

    /* ========================================================================
       6. A6 PAPER & THERMAL PRINTER PRINT ENGINES
       ------------------------------------------------------------------------
    ======================================================================== */
    const getZariKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    // 1. Main Zari Stock Report Print
    const printZariStockReport = () => {
        const rows = currentZariFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi data nahi hai!');
        }

        const kName = getZariKarkhanaPrintName(window.currentZariKarkhanaFilter);
        const today = new Date().toLocaleDateString('hi-IN');

        let totalAaya = 0;
        let totalGaya = 0;
        let totalBacha = 0;

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            const aaya = safeNum(r.aaya);
            const gaya = safeNum(r.gaya);
            const bacha = safeNum(r.bacha);

            totalAaya += aaya;
            totalGaya += gaya;
            totalBacha += bacha;

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:4px 2px;">${idx + 1}</td>
                    <td style="padding:4px 2px; font-weight:bold;">${esc(r.name)}</td>
                    <td style="padding:4px 2px; text-align:right;">+${aaya.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right;">-${gaya.toFixed(2)}</td>
                    <td style="padding:4px 2px; text-align:right; font-weight:bold;">${bacha.toFixed(2)}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Zari Stock Report - A6</title>
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
                        <p><strong>ZARI STOCK STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Items:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>ZARI ITEM</th><th style="text-align:right;">AAYI</th><th style="text-align:right;">GAYI</th><th style="text-align:right;">BACHI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aayi:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gayi:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI STOCK:</span> <span>${totalBacha.toFixed(2)} Kg</span>
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

    // 2. Filtered Zari Passbook Statement Print
    const printZariPassbookFiltered = () => {
        const rows = filteredZariPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const itemName = window.currentPassbookZariItem || 'Zari Item';
        const kName = getZariKarkhanaPrintName(window.currentZariKarkhanaFilter);
        const fDate = document.getElementById('zari-pass-from-date')?.value || '';
        const tDate = document.getElementById('zari-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAaya = 0;
        let totalGaya = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const aaya = safeNum(r.aaya || r.qty);
            const gaya = safeNum(r.gaya);

            totalAaya += aaya;
            totalGaya += gaya;

            const party = (r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? r.kariger : (r.type || 'Inward');

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${esc(r.date || '-')}</td>
                    <td style="padding:3px 2px; font-weight:600;">${esc(party)}</td>
                    <td style="padding:3px 2px; text-align:right;">${aaya > 0 ? `+${aaya.toFixed(2)}` : '-'}</td>
                    <td style="padding:3px 2px; text-align:right;">${gaya > 0 ? `-${gaya.toFixed(2)}` : '-'}</td>
                </tr>`;
        });

        const netBalance = totalAaya - totalGaya;

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Zari Passbook - A6</title>
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
                        <p><strong>ZARI PASSBOOK STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Item Naam:</strong> ${esc(itemName)}</div>
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Filter Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Kul Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>SOURCE / PARTY</th><th style="text-align:right;">AAYI</th><th style="text-align:right;">GAYI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aayi:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gayi:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BALANCE:</span> <span>${netBalance.toFixed(2)} Kg</span>
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

    // 3. Single Entry Slip Print
    const printSingleZariPassbookEntry = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const itemName = entry.name || window.currentPassbookZariItem || 'Zari Item';
        const kName = getZariKarkhanaPrintName(entry.karkhanaId || window.currentZariKarkhanaFilter);
        const aaya = safeNum(entry.aaya || entry.qty);
        const gaya = safeNum(entry.gaya);
        const isAaya = aaya > 0;
        const wazanDisplay = isAaya ? `+${aaya.toFixed(2)} Kg` : `-${gaya.toFixed(2)} Kg`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Zari Voucher - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                    .total-highlight { background: #eee; padding: 6px 4px; border: 1px solid #000; font-size: 13px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>ZARI LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${esc(entry.date || '-')}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>Item:</strong></span><span>${esc(itemName)}</span></div>
                    <div class="row"><span><strong>Type:</strong></span><span>${esc(entry.type || 'Entry')}</span></div>
                    <div class="row"><span><strong>Kariger / Party:</strong></span><span>${esc(entry.kariger || '-')}</span></div>
                    <div class="total-highlight">
                        WAZAN: ${wazanDisplay}
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>________</div>
                        <div>हस्ताक्षर पाने वाला<br><br>________</div>
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
       7. DELETE & EDIT ENGINES
       ------------------------------------------------------------------------
    ======================================================================== */
    const deleteZariHistoryEntry = (histId) => {
        if (!confirm('Kya aap sach me ye entry DELETE karna chahte hain?\nStock balance wapas sahi settle ho jayega.')) return;

        let hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(histId));
        if (!entry) return alert('Entry nahi mili!');

        const isTransfer = (entry.refId && String(entry.refId).includes('tr_zari')) || 
                           (entry.type && entry.type.toLowerCase().includes('transfer'));
        const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

        if (isTransfer && entry.refId) {
            hist = hist.filter(x => x.refId !== entry.refId);
            const transfers = (window.safeArray ? window.safeArray(window.getStore('material_transfers')) : []).filter(t => t.id !== entry.refId);
            if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);
        } else {
            hist = hist.filter(x => String(x.id) !== String(histId));
        }

        if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

        if (isPurchase) {
            const qty = safeNum(entry.aaya || entry.qty);
            const list = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
            const targetKid = entry.karkhanaId || 'k_main';

            const item = list.find((x) => {
                const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && matchKid;
            });

            if (item) {
                item.aaya = Math.max(0, safeNum((safeNum(item.aaya) - qty).toFixed(2)));
                item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                if (typeof window.setStore === 'function') window.setStore('zari_stock', list);
            }
        }

        applyZariPassbookFilters();
        renderZariTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert('🗑️ Entry safalta-poorvak delete ho gayi!');
    };

    const openZariEditModal = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const existingModal = document.getElementById('zari-edit-popup-modal');
        if (existingModal) existingModal.remove();

        const currentQty = safeNum(entry.aaya || entry.gaya || entry.qty);
        const isAaya = safeNum(entry.aaya) > 0;
        const typeLabel = isAaya ? 'Aaya (Inward)' : 'Gaya (Outward)';

        const modalHtml = `
            <div id="zari-edit-popup-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:420px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); overflow:hidden;">
                    <div style="background:#ea580c; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">✏️ Edit Zari Entry</h3>
                        <button type="button" onclick="closeZariEditModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#fff7ed; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Item:</strong> ${esc(entry.name)}</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh (Date):</label><br>
                            <input type="date" id="zari-edit-date" value="${entry.date || ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Party / Source / Note:</label><br>
                            <input type="text" id="zari-edit-kariger" value="${esc(entry.kariger || '')}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:16px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Wazan (${typeLabel} Kg me):</label><br>
                            <input type="number" step="0.01" id="zari-edit-qty" value="${currentQty.toFixed(2)}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <button type="button" onclick="saveZariHistoryEdit('${esc(id)}')" style="background:#ea580c; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            💾 Badlaav Safe Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeZariEditModal = () => {
        const modal = document.getElementById('zari-edit-popup-modal');
        if (modal) modal.remove();
    };

    const saveZariHistoryEdit = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const entry = hist.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const newDate = document.getElementById('zari-edit-date')?.value;
        const newKariger = String(document.getElementById('zari-edit-kariger')?.value || '').trim();
        const newQty = safeNum(document.getElementById('zari-edit-qty')?.value);

        if (newQty <= 0) return alert('Kripya sahi wazan (Kg) darj karein!');

        const oldAaya = safeNum(entry.aaya);
        const isTransfer = (entry.refId && String(entry.refId).includes('tr_zari')) || 
                           (entry.type && entry.type.toLowerCase().includes('transfer'));
        const isPurchase = !isTransfer && (entry.type && (entry.type.toLowerCase().includes('khareed') || entry.type.toLowerCase().includes('inward')));

        entry.date = newDate;
        entry.kariger = newKariger || 'Godown Purchase';

        if (oldAaya > 0) {
            const aayaDiff = newQty - oldAaya;
            entry.aaya = newQty;

            if (isPurchase) {
                const list = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
                const targetKid = entry.karkhanaId || 'k_main';

                const item = list.find((x) => {
                    const matchKid = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && matchKid;
                });

                if (item) {
                    item.aaya = safeNum((safeNum(item.aaya) + aayaDiff).toFixed(2));
                    item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('zari_stock', list);
                }
            }
        } else {
            entry.gaya = newQty;
            entry.qty = newQty;
        }

        if (isTransfer && entry.refId) {
            const pair = hist.find(x => x && x.refId === entry.refId && String(x.id) !== String(id));
            if (pair) {
                pair.date = newDate;
                if (pair.aaya > 0) pair.aaya = newQty;
                if (pair.gaya > 0) pair.gaya = newQty;
            }

            const transfers = window.safeArray ? window.safeArray(window.getStore('material_transfers')) : [];
            const tr = transfers.find(t => t && t.id === entry.refId);
            if (tr) {
                tr.date = newDate;
                tr.qty = newQty;
                tr.quantity = newQty;
                if (typeof window.setStore === 'function') window.setStore('material_transfers', transfers);
            }
        }

        if (typeof window.setStore === 'function') window.setStore('zari_history', hist);

        closeZariEditModal();
        applyZariPassbookFilters();
        renderZariTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
        alert('✅ Zari entry safalta-poorvak update ho gayi!');
    };

    /* ========================================================================
       8. GLOBAL EXPORTS
       ------------------------------------------------------------------------
    ======================================================================== */
    const zariUIAPI = {
        openZariModule,
        renderZariKarkhanaTabs,
        switchZariKarkhanaTab,
        toggleZariForm,
        toggleZariItemType,
        populateZariExistingDropdown,
        saveNewZari,
        bindZariSearchInput,
        filterZari,
        renderZariTable,
        changeZariStockPage,
        printZariStockReport,
        openZariTransferModal,
        closeZariTransferModal,
        submitZariTransferForm,
        openZariPassbook,
        resetZariPassbookFilters,
        applyZariPassbookFilters,
        renderPaginatedZariPassbook,
        changeZariPassbookPage,
        printZariPassbookFiltered,
        printSingleZariPassbookEntry,
        deleteZariHistoryEntry,
        openZariEditModal,
        closeZariEditModal,
        saveZariHistoryEdit
    };

    Object.keys(zariUIAPI).forEach((fn) => { window[fn] = zariUIAPI[fn]; });
    window.ZariUIEngine = zariUIAPI;
})();
