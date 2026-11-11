/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE SANCHA (TANI & CHUKKA) STOCK & PASSBOOK
   File: sancha/sancha-ui.js • Developed by Farhan Jawed
   (Accurate Category Routing • Instant Live Search • A6 Thermal Print)
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & PAGINATION CONTEXT
       ======================================================================== */
    window.currentSanchaCategory = 'tani'; // 'tani' or 'chukka'
    window.currentSanchaKarkhanaFilter = 'all';
    window.currentPassbookSanchaItem = '';

    // 📱 PASSBOOK PAGINATION STATE
    let sanchaPassbookCurrentPage = 1;
    const SANCHA_PAGE_SIZE = 20;
    let filteredSanchaPassbookCache = [];

    // Main Sancha Stock Table Pagination State
    let sanchaStockCurrentPage = 1;
    const SANCHA_STOCK_PAGE_SIZE = 15;
    let currentSanchaFilteredRowsCache = [];

    /* ========================================================================
       2. SAFE DOM & DATA SANITIZATION UTILITIES
       ======================================================================== */
    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const triggerSanchaCacheInvalidation = () => {
        if (typeof window.invalidateSanchaCalcCache === 'function') {
            window.invalidateSanchaCalcCache();
        } else if (window.SanchaCalcEngine && typeof window.SanchaCalcEngine.invalidateSanchaCalcCache === 'function') {
            window.SanchaCalcEngine.invalidateSanchaCalcCache();
        }
    };

    /* ========================================================================
       3. NAVIGATION & CATEGORY / BRANCH CONTROLLERS
       ======================================================================== */
    const openSanchaModule = () => {
        setDisplay('dashboard-view', 'none');
        setDisplay('sancha-section', 'block');

        renderSanchaKarkhanaTabs();
        populateSanchaExistingDropdown();
        renderSanchaTable();
        bindSanchaSearchInput();
    };

    const switchSanchaCategory = (cat) => {
        window.currentSanchaCategory = String(cat || 'tani').toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        sanchaStockCurrentPage = 1;

        const tabT = document.getElementById('tab-sancha-tani');
        const tabC = document.getElementById('tab-sancha-chukka');
        if (tabT) tabT.className = (window.currentSanchaCategory === 'tani') ? 'sheet-tab active' : 'sheet-tab';
        if (tabC) tabC.className = (window.currentSanchaCategory === 'chukka') ? 'sheet-tab active' : 'sheet-tab';

        // Safe Radio Button Selector
        const rTani = document.querySelector('input[name="sancha-cat"][value="tani"]');
        const rChuk = document.querySelector('input[name="sancha-cat"][value="chukka"]');
        if (rTani && window.currentSanchaCategory === 'tani') rTani.checked = true;
        if (rChuk && window.currentSanchaCategory === 'chukka') rChuk.checked = true;

        populateSanchaExistingDropdown();
        renderSanchaTable();
    };

    const renderSanchaKarkhanaTabs = () => {
        const bar = document.getElementById('sancha-karkhana-tabs-bar');
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

        const isAllActive = window.currentSanchaKarkhanaFilter === 'all';
        let html = `<button type="button" class="sheet-tab ${isAllActive ? 'active' : ''}" onclick="switchSanchaKarkhanaTab('all')">👥 Sabhi Karkhane</button>`;

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = String(window.currentSanchaKarkhanaFilter) === String(k.id) ? 'active' : '';
            html += `<button type="button" class="sheet-tab ${isActive}" onclick="switchSanchaKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchSanchaKarkhanaTab = (kId) => {
        window.currentSanchaKarkhanaFilter = kId || 'all';
        sanchaStockCurrentPage = 1;
        renderSanchaKarkhanaTabs();
        populateSanchaExistingDropdown();
        renderSanchaTable();
    };

    const bindSanchaSearchInput = () => {
        const searchInp = document.getElementById('search-sancha-input');
        if (searchInp && !searchInp.dataset.bound) {
            searchInp.dataset.bound = 'true';
            searchInp.addEventListener('input', () => {
                sanchaStockCurrentPage = 1;
                renderSanchaTable();
            });
        }
    };

    const filterSancha = () => {
        sanchaStockCurrentPage = 1;
        renderSanchaTable();
    };

    /* ========================================================================
       4. INWARD INVENTORY PURCHASE ENGINE (Khareed)
       ======================================================================== */
    const toggleAddSanchaForm = () => {
        const f = document.getElementById('add-sancha-item-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('sancha-date');
            if (dInp) {
                dInp.value = (typeof window.getTodayDate === 'function') 
                    ? window.getTodayDate() 
                    : new Date().toISOString().split('T')[0];
            }

            // Sync radio button to current active tab
            const rTani = document.querySelector('input[name="sancha-cat"][value="tani"]');
            const rChuk = document.querySelector('input[name="sancha-cat"][value="chukka"]');
            if (window.currentSanchaCategory === 'chukka' && rChuk) rChuk.checked = true;
            else if (rTani) rTani.checked = true;

            toggleSanchaFormOptions();
        }
    };

    const toggleSanchaFormOptions = () => {
        const isNew = document.getElementById('sancha-type-new') 
            ? document.getElementById('sancha-type-new').checked 
            : true;

        setDisplay('sancha-existing-group', isNew ? 'none' : 'block');
        setDisplay('sancha-new-group', isNew ? 'block' : 'none');

        // Robust category check (Value based)
        const selectedRadio = document.querySelector('input[name="sancha-cat"]:checked');
        if (selectedRadio) {
            window.currentSanchaCategory = String(selectedRadio.value).toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        }

        populateSanchaExistingDropdown();
    };

    const populateSanchaExistingDropdown = () => {
        const sel = document.getElementById('sancha-select-existing');
        if (!sel) return;

        sel.innerHTML = '';
        const currentCat = window.currentSanchaCategory || 'tani';
        const list = (window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [])
            .filter((s) => {
                const cat = s.category || 'tani';
                return cat.toLowerCase() === currentCat.toLowerCase();
            });

        const unique = new Set();
        list.forEach((s) => {
            const name = s?.name ? s.name.trim() : '';
            if (name && !unique.has(name.toLowerCase())) {
                unique.add(name.toLowerCase());
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            }
        });
    };

    const saveNewSanchaStock = () => {
        const isNew = document.getElementById('sancha-type-new') 
            ? document.getElementById('sancha-type-new').checked 
            : true;

        const nameInp = isNew ? document.getElementById('sancha-new-name') : document.getElementById('sancha-select-existing');
        const name = String(nameInp?.value || '').trim();

        const date = document.getElementById('sancha-date')?.value || 
                    ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);

        const qtyInp = document.getElementById('sancha-qty');
        const qty = safeNum(qtyInp?.value);
        const person = String(document.getElementById('sancha-person')?.value || '').trim();

        // 🎯 100% FOOLPROOF CHUKKA VS TANI CHECK
        let category = window.currentSanchaCategory || 'tani';
        const checkedCatRadio = document.querySelector('input[name="sancha-cat"]:checked');
        if (checkedCatRadio && checkedCatRadio.value) {
            category = String(checkedCatRadio.value).toLowerCase() === 'chukka' ? 'chukka' : 'tani';
        }

        if (!name) return alert('Sancha Item ka naam zaroori hai!');
        if (qty <= 0) return alert('Wazan (Qty Kg me) daalein!');

        const targetKid = (window.currentSanchaKarkhanaFilter !== 'all') ? window.currentSanchaKarkhanaFilter : 'k_main';
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
                id: `sancha_${Date.now()}`,
                date,
                name,
                category,
                aaya: qty,
                gaya: 0,
                bacha: qty,
                person: person || '-',
                karkhanaId: targetKid,
                timestamp: Date.now()
            });
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_items', list);
        }

        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        hist.push({
            id: `shist_${Date.now()}`,
            date,
            name,
            category,
            kariger: person || 'Factory Inward',
            type: `Khareed / Inward (${category === 'tani' ? 'Tani' : 'Chukka'})`,
            aaya: qty,
            gaya: 0,
            karkhanaId: targetKid,
            isOpening: false,
            timestamp: Date.now()
        });

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        const newNameEl = document.getElementById('sancha-new-name');
        if (newNameEl) newNameEl.value = '';
        if (qtyInp) qtyInp.value = '';
        const personEl = document.getElementById('sancha-person');
        if (personEl) personEl.value = '';

        triggerSanchaCacheInvalidation();
        toggleAddSanchaForm();
        switchSanchaCategory(category); // Automatically switch view to the added category
        alert(`✅ Sancha (${category === 'tani' ? 'Tani' : 'Chukka'}) Stock me jama ho gaya!`);
    };

    /* ========================================================================
       5. MAIN TABLE RENDERER
       ======================================================================== */
    const renderSanchaTable = () => {
        bindSanchaSearchInput();

        const tbody = document.getElementById('sancha-table-body');
        if (!tbody) return;

        const currentCat = window.currentSanchaCategory || 'tani';

        const rawStock = (window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [])
            .filter((s) => {
                const cat = s.category || 'tani';
                return cat.toLowerCase() === currentCat.toLowerCase();
            });

        const uniqueNames = [...new Set(rawStock.map((s) => (s?.name ? s.name.trim() : '')).filter(Boolean))];

        const rows = [];
        uniqueNames.forEach((name) => {
            if (typeof window.getSanchaItemStats === 'function') {
                const stats = window.getSanchaItemStats(null, name, currentCat, window.currentSanchaKarkhanaFilter);
                if (stats.aaya > 0 || stats.gaya > 0 || stats.bacha > 0) {
                    const foundOriginal = rawStock.find((x) => x?.name && x.name.toLowerCase() === name.toLowerCase());
                    stats.person = foundOriginal ? (foundOriginal.person || '-') : '-';
                    rows.push(stats);
                }
            }
        });

        const searchInp = document.getElementById('search-sancha-input');
        const txt = searchInp ? searchInp.value.toLowerCase().trim() : '';

        const filteredRows = txt 
            ? rows.filter((s) => `${s.name || ''} ${s.person || ''} ${s.date || ''} ${s.category || ''} ${s.bacha || ''}`.toLowerCase().includes(txt)) 
            : rows;

        currentSanchaFilteredRowsCache = filteredRows;

        if (searchInp && searchInp.parentElement && !document.getElementById('sancha-stock-print-btn')) {
            const printBtn = document.createElement('button');
            printBtn.id = 'sancha-stock-print-btn';
            printBtn.type = 'button';
            printBtn.className = 'sheet-btn';
            printBtn.style.cssText = 'background:#0284c7; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer; margin-left:8px; display:inline-flex; align-items:center; gap:4px;';
            printBtn.innerHTML = '🖨️ A6 Print';
            printBtn.onclick = () => printSanchaStockReport();
            if (searchInp.nextSibling) {
                searchInp.parentElement.insertBefore(printBtn, searchInp.nextSibling);
            } else {
                searchInp.parentElement.appendChild(printBtn);
            }
        }

        let totalBacha = 0;
        rows.forEach(r => { totalBacha += safeNum(r.bacha); });

        const totalEntries = filteredRows.length;
        let pager = document.getElementById('sancha-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'sancha-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">Koi ${currentCat === 'tani' ? 'Tani' : 'Chukka'} Stock nahi mila.</td></tr>`;
            if (pager) pager.innerHTML = '';
        } else {
            const totalPages = Math.ceil(totalEntries / SANCHA_STOCK_PAGE_SIZE) || 1;
            if (sanchaStockCurrentPage > totalPages) sanchaStockCurrentPage = totalPages;
            if (sanchaStockCurrentPage < 1) sanchaStockCurrentPage = 1;

            const startIndex = (sanchaStockCurrentPage - 1) * SANCHA_STOCK_PAGE_SIZE;
            const pageRows = filteredRows.slice(startIndex, startIndex + SANCHA_STOCK_PAGE_SIZE);

            let html = '';
            pageRows.forEach((s) => {
                const bacha = safeNum(s.bacha);
                const safeName = encodeURIComponent(s.name);
                const safeCat = encodeURIComponent(s.category);

                let transferBtn = '';
                if (bacha > 0) {
                    transferBtn = `<button type="button" class="sheet-btn" style="background:#f59e0b; color:#ffffff; padding:4px 9px; font-weight:bold; margin-left:6px; border-radius:4px; border:none; cursor:pointer;" onclick="openSanchaTransferModal('${safeName}', '${safeCat}', ${bacha})">🚚 Bhejo</button>`;
                }

                html += `<tr>
                    <td>${esc(s.date || '-')}</td>
                    <td><span class="badge-blue">${s.category === 'chukka' ? '⚙️ Chukka' : '🧵 Tani'}</span></td>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td style="color:#059669; font-weight:700;">+${safeNum(s.aaya).toFixed(2)}</td>
                    <td style="color:#ea580c; font-weight:700;">-${safeNum(s.gaya).toFixed(2)}</td>
                    <td style="font-weight:800; color:#0284c7; background:#eff6ff; font-size:14px;">${bacha.toFixed(2)} Kg</td>
                    <td>${esc(s.person || '-')}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button type="button" class="sheet-btn" style="background:#0284c7; padding:4px 10px; font-weight:bold; border-radius:4px; border:none; color:white; cursor:pointer;" onclick="openSanchaPassbook('${safeName}')">📖 Passbook</button>
                        ${transferBtn}
                    </td>
                </tr>`;
            });

            tbody.innerHTML = html;

            if (pager) {
                pager.innerHTML = `
                    <div style="font-size:12px; color:#475569; font-weight:600;">
                        Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SANCHA_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="sheet-btn" style="background:${sanchaStockCurrentPage <= 1 ? '#cbd5e1' : '#0284c7'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sanchaStockCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${sanchaStockCurrentPage <= 1 ? 'disabled' : ''} onclick="changeSanchaStockPage(-1)">◀ Prev</button>
                        <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${sanchaStockCurrentPage} / ${totalPages}</span>
                        <button type="button" class="sheet-btn" style="background:${sanchaStockCurrentPage >= totalPages ? '#cbd5e1' : '#0284c7'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sanchaStockCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${sanchaStockCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeSanchaStockPage(1)">Next ▶</button>
                    </div>`;
            }
        }

        const opVal = document.getElementById('sancha-opening-val');
        if (opVal) {
            opVal.textContent = `${totalBacha.toFixed(2)} Kg Kul ${currentCat === 'tani' ? 'Tani' : 'Chukka'} Bacha`;
        }
    };

    const changeSanchaStockPage = (delta) => {
        sanchaStockCurrentPage += delta;
        renderSanchaTable();
    };

    /* ========================================================================
       6. INTER-GODOWN TRANSFER MODAL
       ======================================================================== */
    const openSanchaTransferModal = (safeName, safeCat, availableBacha) => {
        const itemName = decodeURIComponent(safeName);
        const category = decodeURIComponent(safeCat);

        const existingModal = document.getElementById('sancha-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }

        const currentKid = (window.currentSanchaKarkhanaFilter !== 'all') ? window.currentSanchaKarkhanaFilter : 'k_main';
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

        const today = (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];

        const catLabel = category === 'chukka' ? 'Chukka' : 'Tani';

        const modalHtml = `
            <div id="sancha-transfer-popup-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:460px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
                    <div style="background:#0284c7; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">🚚 Sancha (${catLabel}) Stock Transfer</h3>
                        <button type="button" onclick="closeSanchaTransferModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Item:</strong> ${esc(itemName)} (${catLabel})</div>
                            <div><strong>Bhejne Wala Godam:</strong> ${esc(currentGodamName)}</div>
                            <div style="color:#0284c7; font-weight:bold; font-size:14px; margin-top:4px;">Maujooda Bacha Wazan: ${availableBacha.toFixed(2)} Kg</div>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Kahan Bhejna Hai (Destination Godam):</label><br>
                            <select id="sancha-dest-godam" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px;">
                                ${godownOptions}
                            </select>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kitna Wazan (Kg):</label><br>
                                <input type="number" step="0.01" id="sancha-transfer-qty" max="${availableBacha}" min="0.01" value="${availableBacha}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh:</label><br>
                                <input type="date" id="sancha-transfer-date" value="${today}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Note / Parchi No. (Optional):</label><br>
                            <input type="text" id="sancha-transfer-note" placeholder="e.g. Khairabad loom ke liye Tani bheji" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                        </div>
                        <button type="button" onclick="submitSanchaTransferForm('${safeName}', '${safeCat}', '${currentKid}', ${availableBacha})" style="background:#0284c7; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            🚀 Sancha Transfer Confirm Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeSanchaTransferModal = () => {
        const modal = document.getElementById('sancha-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const submitSanchaTransferForm = (safeName, safeCat, fromKid, maxAvailable) => {
        const itemName = decodeURIComponent(safeName);
        const category = decodeURIComponent(safeCat);
        const toKid = document.getElementById('sancha-dest-godam')?.value;
        const qty = safeNum(document.getElementById('sancha-transfer-qty')?.value);
        const d = document.getElementById('sancha-transfer-date')?.value || 
                 ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : '');
        const note = String(document.getElementById('sancha-transfer-note')?.value || '').trim();

        if (!toKid) return alert('Kripya Paane wala Godam chunein!');
        if (qty <= 0) return alert('Kripya sahi wazan (Kg) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable.toFixed(2)} Kg bachi hai!`);

        let success = false;
        if (typeof window.transferSanchaStock === 'function') {
            success = window.transferSanchaStock(d, itemName, category, fromKid, toKid, qty, note);
        }

        if (success) {
            triggerSanchaCacheInvalidation();
            closeSanchaTransferModal();
            renderSanchaTable();
            alert(`✅ ${qty.toFixed(2)} Kg Sancha (${category === 'chukka' ? 'Chukka' : 'Tani'}) safalta-poorvak transfer ho gayi!`);
        }
    };

    /* ========================================================================
       7. 📱 20-ITEM PAGINATED SANCHA PASSBOOK ENGINE (WITH A6 PRINT)
       ======================================================================== */
    const openSanchaPassbook = (itemName) => {
        window.currentPassbookSanchaItem = decodeURIComponent(itemName);
        sanchaPassbookCurrentPage = 1;

        const modal = document.getElementById('item-modal');
        if (!modal) return;

        const title = document.getElementById('modal-item-title');
        const catLabel = window.currentSanchaCategory === 'tani' ? 'Tani' : 'Chukka';
        if (title) title.textContent = `📖 Sancha Passbook: ${window.currentPassbookSanchaItem} (${catLabel})`;

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div><label style="font-size:12px; font-weight:700;">From Date:</label><br><input type="date" id="sancha-pass-from-date" onchange="applySanchaPassbookFilters()"></div>
                        <div><label style="font-size:12px; font-weight:700;">To Date:</label><br><input type="date" id="sancha-pass-to-date" onchange="applySanchaPassbookFilters()"></div>
                        <div style="align-self:flex-end; display:flex; gap:6px;">
                            <button type="button" class="quick-btn btn-out" onclick="resetSanchaPassbookFilters()">Reset</button>
                            <button type="button" class="sheet-btn" style="background:#0284c7; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer;" onclick="printSanchaPassbookFiltered()">🖨️ A6 Print</button>
                        </div>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:12px; font-weight:700;">🔍 Search:</label><br>
                        <input type="text" id="sancha-pass-search-input" class="search-box" placeholder="Search Date, Kariger, Qty..." oninput="applySanchaPassbookFilters()">
                    </div>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr style="background:#0284c7; color:white; font-size:12px;">
                                <th>TARIKH</th><th>DETAIL (TYPE)</th><th>KARIGER / PERSON</th><th>AAYA (Kg)</th><th>GAYA (Kg)</th><th style="text-align:center;">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="sancha-passbook-table-body"></tbody>
                    </table>
                </div>
                <div id="sancha-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;"></div>`;
        }

        modal.style.display = 'flex';
        applySanchaPassbookFilters();
    };

    const resetSanchaPassbookFilters = () => {
        const fDate = document.getElementById('sancha-pass-from-date');
        const tDate = document.getElementById('sancha-pass-to-date');
        const sInp = document.getElementById('sancha-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        sanchaPassbookCurrentPage = 1;
        applySanchaPassbookFilters();
    };

    const applySanchaPassbookFilters = () => {
        const targetItemLower = window.currentPassbookSanchaItem.toLowerCase();
        const targetCatLower = (window.currentSanchaCategory || 'tani').toLowerCase();
        const allHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];

        let hist = allHist.filter((x) => {
            if (!x?.name) return false;
            const nameMatch = x.name.toLowerCase() === targetItemLower;
            const catMatch = (x.category || 'tani').toLowerCase() === targetCatLower;
            if (!nameMatch || !catMatch) return false;

            if (window.currentSanchaKarkhanaFilter !== 'all') {
                const rowKid = x.karkhanaId || 'k_main';
                return String(rowKid) === String(window.currentSanchaKarkhanaFilter);
            }
            return true;
        });

        const fDate = document.getElementById('sancha-pass-from-date')?.value || '';
        const tDate = document.getElementById('sancha-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('sancha-pass-search-input')?.value || '').toLowerCase().trim();

        if (fDate) hist = hist.filter((x) => x.date >= fDate);
        if (tDate) hist = hist.filter((x) => x.date <= tDate);

        if (sTxt) {
            hist = hist.filter((x) => {
                const rowString = `${x.date || ''} ${x.type || ''} ${x.kariger || ''} ${x.aaya || x.qty || ''} ${x.gaya || ''}`.toLowerCase();
                return rowString.includes(sTxt);
            });
        }

        hist.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredSanchaPassbookCache = hist;
        renderPaginatedSanchaPassbook();
    };

    const renderPaginatedSanchaPassbook = () => {
        const tbody = document.getElementById('sancha-passbook-table-body');
        const pager = document.getElementById('sancha-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredSanchaPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Koi entry nahi mili.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / SANCHA_PAGE_SIZE);
        if (sanchaPassbookCurrentPage > totalPages) sanchaPassbookCurrentPage = totalPages;
        if (sanchaPassbookCurrentPage < 1) sanchaPassbookCurrentPage = 1;

        const startIndex = (sanchaPassbookCurrentPage - 1) * SANCHA_PAGE_SIZE;
        const pageRows = filteredSanchaPassbookCache.slice(startIndex, startIndex + SANCHA_PAGE_SIZE);

        let html = '';
        pageRows.forEach((r) => {
            const aayaQty = safeNum(r.aaya);
            const gayaQty = safeNum(r.gaya !== undefined ? r.gaya : r.qty);

            const isOpening = (r.isOpening === true) || String(r.type || '').includes('Opening') || String(r.kariger || '').includes('Opening');
            const isKariger = String(r.type || '').includes('Kariger Issue') || String(r.kariger || '').includes('Kariger');

            const singlePrintBtn = `<button type="button" title="A6 Slip Print" class="sheet-btn" style="background:#0284c7; color:#ffffff; padding:4px 7px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="printSingleSanchaPassbookEntry('${esc(r.id)}')">🖨️</button>`;

            let typeDisplay = '';
            let karigerDisplay = '';
            let actionBtns = '';

            if (isOpening) {
                typeDisplay = `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">📦 Opening Stock (Pichle Saal Se)</span>`;
                karigerDisplay = `<span style="color:#b45309; font-weight:bold;">📦 Pichla Bacha Stock</span>`;
                actionBtns = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#64748b; font-size:11px; font-weight:700;'>🔒 Opening Lock</span>
                    ${singlePrintBtn}
                </div>`;
            } else if (isKariger) {
                typeDisplay = `<strong style="color:#1e3a8a;">${esc(r.type || 'Kariger Issue')}</strong>`;
                karigerDisplay = `👤 ${esc(r.kariger || '-')}`;
                actionBtns = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#64748b; font-size:11px; font-weight:700;'>🔒 Kariger Sheet</span>
                    ${singlePrintBtn}
                </div>`;
            } else {
                typeDisplay = `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">🏭 Nayi Khareed / Inward</span>`;
                karigerDisplay = (r.kariger && r.kariger !== '-' && r.kariger !== 'undefined') ? `👤 ${esc(r.kariger)}` : '📦 Factory Inward';
                actionBtns = `
                    <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                        <button type="button" class="sheet-btn" style="background:#3b82f6; color:#ffffff; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="openSanchaEditModal('${esc(r.id)}')">✏️ Edit</button>
                        <button type="button" class="sheet-btn" style="background:#ef4444; color:#ffffff; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="deleteSanchaHistoryEntry('${esc(r.id)}')">🗑️ Del</button>
                        ${singlePrintBtn}
                    </div>`;
            }

            html += `<tr>
                <td>${esc(r.date || '-')}</td>
                <td>${typeDisplay}</td>
                <td>${karigerDisplay}</td>
                <td style="color:#059669; font-weight:700;">${aayaQty ? `+${aayaQty.toFixed(2)} Kg` : '-'}</td>
                <td style="color:#ea580c; font-weight:700;">${gayaQty ? `-${gayaQty.toFixed(2)} Kg` : '-'}</td>
                <td style="text-align:center; white-space:nowrap;">${actionBtns}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SANCHA_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${sanchaPassbookCurrentPage <= 1 ? '#cbd5e1' : '#0284c7'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sanchaPassbookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${sanchaPassbookCurrentPage <= 1 ? 'disabled' : ''} onclick="changeSanchaPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${sanchaPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${sanchaPassbookCurrentPage >= totalPages ? '#cbd5e1' : '#0284c7'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sanchaPassbookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${sanchaPassbookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeSanchaPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeSanchaPassbookPage = (delta) => {
        sanchaPassbookCurrentPage += delta;
        renderPaginatedSanchaPassbook();
    };

    /* ========================================================================
       8. A6 PRINT ENGINES
       ======================================================================== */
    const getSanchaKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhane (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printSanchaStockReport = () => {
        const rows = currentSanchaFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi Sancha stock nahi mila!');
        }

        const kName = getSanchaKarkhanaPrintName(window.currentSanchaKarkhanaFilter);
        const catLabel = ((window.currentSanchaCategory || 'tani') === 'chukka' ? 'CHUKKA' : 'TANI') + ' STOCK';
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
                    <td style="padding:4px 2px;">${esc(r.person || '-')}</td>
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
                <title>Sancha Stock Report - A6</title>
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
                        <p><strong>SANCHA ${catLabel} STATEMENT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Karkhana:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Items:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>ITEM</th><th>PERSON</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th><th style="text-align:right;">BACHA</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aaya:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gaya:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHA STOCK:</span> <span>${totalBacha.toFixed(2)} Kg</span>
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

    const printSanchaPassbookFiltered = () => {
        const rows = filteredSanchaPassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const itemName = window.currentPassbookSanchaItem || 'Sancha Item';
        const catLabel = ((window.currentSanchaCategory || 'tani') === 'chukka' ? 'Chukka' : 'Tani');
        const kName = getSanchaKarkhanaPrintName(window.currentSanchaKarkhanaFilter);
        const fDate = document.getElementById('sancha-pass-from-date')?.value || '';
        const tDate = document.getElementById('sancha-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAaya = 0;
        let totalGaya = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const aaya = safeNum(r.aaya);
            const gaya = safeNum(r.gaya !== undefined ? r.gaya : r.qty);

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
                <title>Sancha Passbook - A6</title>
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
                        <p><strong>SANCHA PASSBOOK (${catLabel.toUpperCase()})</strong></p>
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
                                <th>TARIKH</th><th>SOURCE / PARTY</th><th style="text-align:right;">AAYA</th><th style="text-align:right;">GAYA</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aaya:</span> <span>+${totalAaya.toFixed(2)} Kg</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gaya:</span> <span>-${totalGaya.toFixed(2)} Kg</span>
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

    const printSingleSanchaPassbookEntry = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && x.id === id);
        if (!entry) return alert('Entry nahi mili!');

        const itemName = entry.name || window.currentPassbookSanchaItem || 'Sancha Item';
        const catLabel = (entry.category || window.currentSanchaCategory || 'tani').toUpperCase();
        const kName = getSanchaKarkhanaPrintName(entry.karkhanaId || window.currentSanchaKarkhanaFilter);
        const aaya = safeNum(entry.aaya);
        const gaya = safeNum(entry.gaya !== undefined ? entry.gaya : entry.qty);
        const isAaya = aaya > 0;
        const wazanDisplay = isAaya ? `+${aaya.toFixed(2)} Kg` : `-${gaya.toFixed(2)} Kg`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Sancha Voucher - A6</title>
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
                        <p>SANCHA (${catLabel}) LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${esc(entry.date || '-')}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(kName)}</span></div>
                    <div class="row"><span><strong>Item:</strong></span><span>${esc(itemName)}</span></div>
                    <div class="row"><span><strong>Type:</strong></span><span>${esc(entry.type || 'Movement')}</span></div>
                    <div class="row"><span><strong>Kariger / Person:</strong></span><span>${esc(entry.kariger || '-')}</span></div>
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
       9. DELETE & EDIT ENGINES
       ======================================================================== */
    const deleteSanchaHistoryEntry = (id) => {
        if (!confirm('Kya aap sach me ye Passbook entry DELETE karna chahte hain?\nIsse stock balance wapas sahi settle ho jayega.')) return;

        let hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && x.id === id);
        if (!entry) return alert('Entry nahi mili!');

        const isPurchase = (String(entry.type || '').includes('Khareed') || String(entry.type || '').includes('Inward'));
        const isTransfer = (entry.refId || String(entry.type || '').includes('Transfer'));

        if (isTransfer && entry.refId) {
            hist = hist.filter((x) => x.refId !== entry.refId);
        } else {
            hist = hist.filter((x) => x.id !== id);
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        if (isPurchase) {
            const qtyToDeduct = safeNum(entry.aaya);
            const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            const targetKid = entry.karkhanaId || 'k_main';
            const cat = (entry.category || window.currentSanchaCategory || 'tani').toLowerCase();

            const item = list.find((x) => {
                const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && (x.category || 'tani').toLowerCase() === cat && matchK;
            });

            if (item) {
                item.aaya = Math.max(0, safeNum((safeNum(item.aaya) - qtyToDeduct).toFixed(2)));
                item.bacha = Math.max(0, safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2)));
                if (typeof window.setStore === 'function') window.setStore('sancha_items', list);
            }
        }

        triggerSanchaCacheInvalidation();
        applySanchaPassbookFilters();
        renderSanchaTable();
        alert('✅ Entry safalta-poorvak delete ho gayi!');
    };

    const openSanchaEditModal = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && x.id === id);
        if (!entry) return alert('Entry nahi mili!');

        const existingModal = document.getElementById('sancha-edit-popup-modal');
        if (existingModal) existingModal.remove();

        const currentQty = safeNum(entry.aaya || entry.gaya || entry.qty);
        const isAaya = safeNum(entry.aaya) > 0;
        const typeLabel = isAaya ? 'Aaya (Inward)' : 'Gaya (Outward)';

        const modalHtml = `
            <div id="sancha-edit-popup-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:420px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); overflow:hidden;">
                    <div style="background:#1e3a8a; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">✏️ Edit Sancha Entry</h3>
                        <button type="button" onclick="closeSanchaEditModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div style="background:#f1f5f9; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Item:</strong> ${esc(entry.name)} (${entry.category === 'chukka' ? 'Chukka' : 'Tani'})</div>
                            <div><strong>Type:</strong> ${esc(entry.type || '-')}</div>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh (Date):</label><br>
                            <input type="date" id="sancha-edit-date" value="${entry.date || ''}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Kariger / Person Name:</label><br>
                            <input type="text" id="sancha-edit-person" value="${esc(entry.kariger || '')}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:16px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Wazan (${typeLabel} Kg me):</label><br>
                            <input type="number" step="0.01" id="sancha-edit-qty" value="${currentQty.toFixed(2)}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; margin-top:4px; box-sizing:border-box;">
                        </div>
                        <button type="button" onclick="saveSanchaHistoryEdit('${esc(id)}')" style="background:#2563eb; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            💾 Badlaav Safe Karein
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeSanchaEditModal = () => {
        const modal = document.getElementById('sancha-edit-popup-modal');
        if (modal) modal.remove();
    };

    const saveSanchaHistoryEdit = (id) => {
        const hist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const entry = hist.find((x) => x && x.id === id);
        if (!entry) return alert('Entry nahi mili!');

        const newDate = document.getElementById('sancha-edit-date')?.value;
        const newPerson = String(document.getElementById('sancha-edit-person')?.value || '').trim();
        const newQty = safeNum(document.getElementById('sancha-edit-qty')?.value);

        if (newQty <= 0) return alert('Kripya sahi wazan (Kg) darj karein!');

        const oldAaya = safeNum(entry.aaya);
        const isPurchase = (String(entry.type || '').includes('Khareed') || String(entry.type || '').includes('Inward'));
        const isTransfer = (entry.refId || String(entry.type || '').includes('Transfer'));

        entry.date = newDate;
        entry.kariger = newPerson || '-';

        if (oldAaya > 0) {
            const aayaDiff = newQty - oldAaya;
            entry.aaya = newQty;

            if (isPurchase) {
                const list = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
                const targetKid = entry.karkhanaId || 'k_main';
                const cat = (entry.category || window.currentSanchaCategory || 'tani').toLowerCase();

                const item = list.find((x) => {
                    const matchK = (!x.karkhanaId && targetKid === 'k_main') || String(x.karkhanaId) === String(targetKid);
                    return x?.name && x.name.toLowerCase() === entry.name.toLowerCase() && (x.category || 'tani').toLowerCase() === cat && matchK;
                });

                if (item) {
                    item.aaya = safeNum((safeNum(item.aaya) + aayaDiff).toFixed(2));
                    item.bacha = safeNum((safeNum(item.aaya) - safeNum(item.gaya)).toFixed(2));
                    if (typeof window.setStore === 'function') window.setStore('sancha_items', list);
                }
            }
        } else {
            entry.gaya = newQty;
            entry.qty = newQty;
        }

        if (isTransfer && entry.refId) {
            const pair = hist.find((x) => x && x.refId === entry.refId && x.id !== id);
            if (pair) {
                pair.date = newDate;
                if (pair.aaya > 0) pair.aaya = newQty;
                if (pair.gaya > 0) pair.gaya = newQty;
            }
        }

        if (typeof window.setStore === 'function') {
            window.setStore('sancha_history', hist);
        }

        triggerSanchaCacheInvalidation();
        closeSanchaEditModal();
        applySanchaPassbookFilters();
        renderSanchaTable();

        alert('✅ Sancha entry safalta-poorvak update ho gayi!');
    };

    /* ========================================================================
       10. GLOBAL EXPORT
       ======================================================================== */
    const sanchaUIAPI = {
        openSanchaModule,
        switchSanchaCategory,
        renderSanchaKarkhanaTabs,
        switchSanchaKarkhanaTab,
        toggleAddSanchaForm,
        toggleSanchaFormOptions,
        populateSanchaExistingDropdown,
        saveNewSanchaStock,
        bindSanchaSearchInput,
        filterSancha,
        renderSanchaTable,
        changeSanchaStockPage,
        printSanchaStockReport,
        openSanchaTransferModal,
        closeSanchaTransferModal,
        submitSanchaTransferForm,
        openSanchaPassbook,
        resetSanchaPassbookFilters,
        applySanchaPassbookFilters,
        changeSanchaPassbookPage,
        printSanchaPassbookFiltered,
        printSingleSanchaPassbookEntry,
        deleteSanchaHistoryEntry,
        openSanchaEditModal,
        closeSanchaEditModal,
        saveSanchaHistoryEdit
    };

    Object.keys(sanchaUIAPI).forEach((fnName) => {
        window[fnName] = sanchaUIAPI[fnName];
    });

    window.SanchaUIEngine = sanchaUIAPI;
})();
