/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE SAREE STOCK & 5-TAB PIPELINE UI (WITH A6 PRINT)
   File: saree/saree-ui.js • Developed by Farhan Jawed (Multi-Stage Passbook Synchronized)
   Tabs: Fresh | Cutting | Embroidery | Finished | Lott
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & CONTEXT POOL
       ======================================================================== */
    window.currentSareeTab = 'fresh';
    window.currentSareeKarkhanaFilter = 'all';
    window.currentPassbookSareeKey = '';
    window.currentPassbookSareeTitle = '';

    let sareePassbookCurrentPage = 1;
    const SAREE_PAGE_SIZE = 20;
    let filteredSareePassbookCache = [];

    let sareeStockCurrentPage = 1;
    const SAREE_STOCK_PAGE_SIZE = 15;
    let currentSareeFilteredRowsCache = [];

    let sareeSearchDebounceTimer = null;

    /* ========================================================================
       2. SAFE DOM & DATA SANITIZATION UTILITIES
       ======================================================================== */
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

    const normText = (txt, fallback = '') => {
        return String(txt || fallback).trim().toUpperCase();
    };

    const normGodownId = (kid) => {
        if (!kid || kid === 'all') return 'all';
        const clean = String(kid).trim();
        return (!clean || clean === 'k_main') ? 'k_main' : clean;
    };

    const normTabName = (t) => {
        const clean = String(t || 'fresh').trim().toLowerCase();
        if (clean === 'cutting' || clean === 'cut') return 'cutting';
        if (clean === 'embroidery' || clean === 'emb') return 'embroidery';
        if (clean === 'finished' || clean === 'finish' || clean === 'calender') return 'finished';
        if (clean === 'lott' || clean === 'lot' || clean === 'damage') return 'lott';
        return 'fresh';
    };

    const triggerSareeCacheInvalidation = () => {
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        } else if (window.SareeCalcEngine && typeof window.SareeCalcEngine.invalidateSareeCalcCache === 'function') {
            window.SareeCalcEngine.invalidateSareeCalcCache();
        }
    };

    /* ========================================================================
       3. NAVIGATION & 5-TAB PIPELINE CONTROLLER
       ======================================================================== */
    const openSareeModule = () => {
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';

        setDisplay('saree-section', 'block');

        renderSareeKarkhanaTabs();
        switchSareeStockTab(window.currentSareeTab || 'fresh');
    };

    const switchSareeStockTab = (tabName) => {
        window.currentSareeTab = normTabName(tabName);
        sareeStockCurrentPage = 1;

        const tabs = ['fresh', 'cutting', 'embroidery', 'finished', 'lott'];
        tabs.forEach((t) => {
            const el = document.getElementById(`tab-saree-${t}`);
            if (el) {
                if (t === window.currentSareeTab) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        renderSareeTable();
    };

    const renderSareeKarkhanaTabs = () => {
        const bar = document.getElementById('saree-karkhana-tabs-bar');
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

        const isAllActive = (window.currentSareeKarkhanaFilter === 'all') ? ' active' : '';
        let html = `<button type="button" class="sheet-tab${isAllActive}" onclick="switchSareeKarkhanaTab('all')">👥 Sabhi Godam</button>`;

        karkhanas.forEach((k) => {
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = (String(window.currentSareeKarkhanaFilter) === String(k.id)) ? ' active' : '';
            html += `<button type="button" class="sheet-tab${isActive}" onclick="switchSareeKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)}</button>`;
        });

        bar.innerHTML = html;
    };

    const switchSareeKarkhanaTab = (kId) => {
        window.currentSareeKarkhanaFilter = kId || 'all';
        sareeStockCurrentPage = 1;
        renderSareeKarkhanaTabs();
        renderSareeTable();
    };

    const filterSaree = () => {
        sareeStockCurrentPage = 1;
        renderSareeTable();
    };

    /* ========================================================================
       4. DIRECT MANUAL INWARD ENGINE
       ======================================================================== */
    const toggleSareeForm = () => {
        const f = document.getElementById('add-saree-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('saree-date');
            if (dInp) dInp.value = getToday();
        }
    };

    const saveNewSareeStock = () => {
        const d = document.getElementById('saree-date')?.value || getToday();
        const name = normText(document.getElementById('saree-name')?.value);
        const source = normText(document.getElementById('saree-kariger')?.value, 'DIRECT INWARD');
        const pcs = safeInt(document.getElementById('saree-pcs')?.value);

        if (!name || pcs <= 0) return alert('Saree ka naam aur Sahi Pcs bharein!');

        const targetKid = (window.currentSareeKarkhanaFilter !== 'all') ? window.currentSareeKarkhanaFilter : 'k_main';

        const history = (window.safeArray ? window.safeArray(window.getStore('saree_history')) : []).slice();
        history.push({
            id: `saree_man_${Date.now()}`,
            date: d,
            sareeName: name,
            karigerName: source,
            kariger: source,
            partyName: source,
            karkhanaId: targetKid,
            type: window.currentSareeTab,
            typeLabel: `Direct Godown Inward (${window.currentSareeTab.toUpperCase()})`,
            aai: pcs,
            gai: 0,
            isOut: false,
            isOpening: false,
            note: 'Direct Entry',
            timestamp: Date.now()
        });

        if (typeof window.setStore === 'function') {
            window.setStore('saree_history', history);
        }

        triggerSareeCacheInvalidation();
        toggleSareeForm();

        const sNameEl = document.getElementById('saree-name');
        const sKarEl = document.getElementById('saree-kariger');
        const sPcsEl = document.getElementById('saree-pcs');
        if (sNameEl) sNameEl.value = '';
        if (sKarEl) sKarEl.value = '';
        if (sPcsEl) sPcsEl.value = '';

        renderSareeTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }

        alert(`✅ ${pcs} Pcs Saree Stock me jama ho gayi!`);
    };

    /* ========================================================================
       5. MAIN TABLE RENDERER
       ======================================================================== */
    const renderSareeTable = () => {
        const thead = document.getElementById('saree-table-head');
        const tbody = document.getElementById('saree-table-body');
        if (!thead || !tbody) return;

        let headerBg = '#2563eb';
        let tabTitle = 'Fresh Saree';

        if (window.currentSareeTab === 'cutting') {
            headerBg = '#0d9488'; 
            tabTitle = 'Cutting Saree';
        } else if (window.currentSareeTab === 'embroidery') {
            headerBg = '#d97706';
            tabTitle = 'Embroidery Saree';
        } else if (window.currentSareeTab === 'finished') {
            headerBg = '#7c3aed'; 
            tabTitle = 'Finished Saree';
        } else if (window.currentSareeTab === 'lott') {
            headerBg = '#dc2626'; 
            tabTitle = 'Lott Saree';
        }

        thead.innerHTML = `
            <tr style="background:${headerBg}; color:white; font-size:13px; text-align:left;">
                <th>Tarikh</th>
                <th>Saree Name</th>
                <th>Karigar (Maker)</th>
                <th>Godam</th>
                <th>Aai Saree</th>
                <th>Gai Saree</th>
                <th>Bachi Saree</th>
                <th style="text-align:center;">Action</th>
            </tr>`;

        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];

        let rows = [];
        if (typeof window.groupSareeStockByTab === 'function') {
            rows = window.groupSareeStockByTab(history, window.currentSareeTab, window.currentSareeKarkhanaFilter);
        }

        const searchInput = document.getElementById('search-saree-input');
        const searchText = searchInput ? searchInput.value : '';
        if (typeof window.searchSareeData === 'function') {
            rows = window.searchSareeData(rows, searchText);
        }

        currentSareeFilteredRowsCache = rows;

        const totalEntries = rows.length;
        let pager = document.getElementById('saree-stock-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'saree-stock-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        if (!totalEntries) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:25px; color:#888;">Koi ${tabTitle} Stock nahi mila.</td></tr>`;
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / SAREE_STOCK_PAGE_SIZE) || 1;
        if (sareeStockCurrentPage > totalPages) sareeStockCurrentPage = totalPages;
        if (sareeStockCurrentPage < 1) sareeStockCurrentPage = 1;

        const startIndex = (sareeStockCurrentPage - 1) * SAREE_STOCK_PAGE_SIZE;
        const pageRows = rows.slice(startIndex, startIndex + SAREE_STOCK_PAGE_SIZE);

        let html = '';
        pageRows.forEach((row) => {
            const safeSaree = encodeURIComponent(row.sareeName);
            const safeKariger = encodeURIComponent(row.karigerName);
            const safeKid = encodeURIComponent(row.karkhanaId);
            const bachi = safeInt(row.bachi);

            let transferBtn = '';
            if (bachi > 0) {
                transferBtn = `<button type="button" class="sheet-btn" style="background:#f59e0b; color:#ffffff; padding:4px 9px; font-weight:bold; margin-left:5px; border-radius:4px; border:none; cursor:pointer;" onclick="openSareeTransferModal('${safeSaree}', '${safeKariger}', '${safeKid}', ${bachi})">🚚 Bhejo</button>`;
            }

            html += `<tr>
                <td>${formatDisplay(row.date)}</td>
                <td><strong style="color:#1e3a8a;">${esc(row.sareeName)}</strong></td>
                <td>👤 ${esc(row.karigerName)}</td>
                <td>🏭 ${esc(row.godamName)}</td>
                <td style="color:#059669; font-weight:800; font-size:14px;">+${safeInt(row.aai)}</td>
                <td style="color:#dc2626; font-weight:800; font-size:14px;">${safeInt(row.gai) > 0 ? `-${safeInt(row.gai)}` : '0'}</td>
                <td style="color:#2563eb; font-weight:800; font-size:15px; background:#eff6ff;">${bachi} Pcs</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" style="background:${headerBg}; padding:4px 10px; font-weight:bold; border-radius:4px; border:none; color:white; cursor:pointer;" onclick="openSareePassbook('${safeSaree}', '${safeKariger}', '${safeKid}')">📖 Passbook</button>
                    ${transferBtn}
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SAREE_STOCK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> Items
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${sareeStockCurrentPage <= 1 ? '#cbd5e1' : headerBg}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sareeStockCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${sareeStockCurrentPage <= 1 ? 'disabled' : ''} onclick="changeSareeStockPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${sareeStockCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${sareeStockCurrentPage >= totalPages ? '#cbd5e1' : headerBg}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sareeStockCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${sareeStockCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeSareeStockPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeSareeStockPage = (delta) => {
        sareeStockCurrentPage += delta;
        renderSareeTable();
    };

    /* ========================================================================
       6. TRANSFER MODAL
       ======================================================================== */
    const openSareeTransferModal = (safeSaree, safeKariger, safeKid, availableBachi) => {
        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const currentKid = decodeURIComponent(safeKid);

        const existingModal = document.getElementById('saree-transfer-popup-modal');
        if (existingModal) existingModal.remove();

        let karkhanas = [];
        if (typeof window.getKarkhanasSafe === 'function') {
            karkhanas = window.getKarkhanasSafe();
        } else {
            karkhanas = window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : [];
        }

        const currentGodamName = (typeof window.getKarkhanaNameById === 'function') 
            ? window.getKarkhanaNameById(currentKid) 
            : currentKid;

        let godownOptions = '';
        karkhanas.forEach((k) => {
            if (String(k.id) !== String(currentKid)) {
                const isMain = (k.id === 'k_main' || k.isDefault);
                const selected = (isMain || currentKid !== 'k_main') ? 'selected' : '';
                godownOptions += `<option value="${esc(k.id)}" ${selected}>${isMain ? '🏢 ' : '🏭 '}${esc(k.name)}</option>`;
            }
        });

        const today = getToday();

        const modalHtml = `
            <div id="saree-transfer-popup-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:480px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
                    
                    <div style="background:#1e3a8a; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">🚚 Saree Transfer / Stage Bhejein</h3>
                        <button type="button" onclick="closeSareeTransferModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>

                    <div style="padding:16px;">
                        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; margin-bottom:12px; font-size:13px;">
                            <div><strong>Saree:</strong> ${esc(sName)}</div>
                            <div><strong>Bunne Wala (Maker):</strong> ${esc(kName)}</div>
                            <div><strong>Current Godam:</strong> ${esc(currentGodamName)} (${window.currentSareeTab.toUpperCase()})</div>
                            <div style="color:#1d4ed8; font-weight:bold; font-size:14px; margin-top:4px;">Maujooda Bachi Saree: ${availableBachi} Pcs</div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Aap kya karna chahte hain?</label><br>
                            <select id="saree-transfer-action-type" onchange="toggleSareeTransferFields()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px;">
                                <option value="godown_transfer">🏢 Doosre Godam / Main Godown Bhejein (Fresh Stock me)</option>
                                <option value="stage_move">🔄 Agli Process me Bhejein (Cutting / Embroidery / Finished)</option>
                            </select>
                        </div>

                        <div id="box-godown-transfer" style="display:block;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Kahan Bhejna Hai (Destination Godam):</label><br>
                            <select id="saree-dest-godam" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; margin-bottom:10px;">
                                ${godownOptions}
                            </select>
                            <div style="font-size:11px; color:#059669; margin-bottom:8px;">ℹ️ Note: Main Godown jane par ye saree automatic <strong>Fresh Saree</strong> stock me jama hogi.</div>
                        </div>

                        <div id="box-stage-move" style="display:none;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Konsi Stage me Bhejna Hai:</label><br>
                            <select id="saree-dest-stage" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; margin-bottom:10px;">
                                ${window.currentSareeTab !== 'cutting' ? '<option value="cutting">✂️ Cutting Saree</option>' : ''}
                                ${window.currentSareeTab !== 'embroidery' ? '<option value="embroidery">🪡 Embroidery Saree</option>' : ''}
                                ${window.currentSareeTab !== 'finished' ? '<option value="finished">✨ Finished Saree</option>' : ''}
                                ${window.currentSareeTab !== 'lott' ? '<option value="lott">📦 Lott Saree</option>' : ''}
                                ${window.currentSareeTab !== 'fresh' ? '<option value="fresh">🌱 Fresh Saree</option>' : ''}
                            </select>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Kitni Saree (Pcs):</label><br>
                                <input type="number" id="saree-transfer-qty" max="${availableBachi}" min="1" value="${availableBachi}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#374151;">Tarikh:</label><br>
                                <input type="date" id="saree-transfer-date" value="${today}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                            </div>
                        </div>

                        <div style="margin-bottom:14px;">
                            <label style="font-size:12px; font-weight:700; color:#374151;">Note / Gaadi / Parchi No. (Optional):</label><br>
                            <input type="text" id="saree-transfer-note" placeholder="e.g. Tempo se bheja gaya" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box;">
                        </div>

                        <button type="button" onclick="submitSareeTransferForm('${safeSaree}', '${safeKariger}', '${safeKid}', ${availableBachi})" style="background:#2563eb; color:#ffffff; border:none; width:100%; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">
                            🚀 Saree Transfer Confirm Karein
                        </button>

                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeSareeTransferModal = () => {
        const modal = document.getElementById('saree-transfer-popup-modal');
        if (modal) modal.remove();
    };

    const toggleSareeTransferFields = () => {
        const actionType = document.getElementById('saree-transfer-action-type')?.value;
        const godownBox = document.getElementById('box-godown-transfer');
        const stageBox = document.getElementById('box-stage-move');

        if (actionType === 'godown_transfer') {
            if (godownBox) godownBox.style.display = 'block';
            if (stageBox) stageBox.style.display = 'none';
        } else {
            if (godownBox) godownBox.style.display = 'none';
            if (stageBox) stageBox.style.display = 'block';
        }
    };

    const submitSareeTransferForm = (safeSaree, safeKariger, safeKid, maxAvailable) => {
        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const fromKid = decodeURIComponent(safeKid);

        const actionType = document.getElementById('saree-transfer-action-type')?.value;
        const qty = safeInt(document.getElementById('saree-transfer-qty')?.value);
        const d = document.getElementById('saree-transfer-date')?.value || getToday();
        const note = String(document.getElementById('saree-transfer-note')?.value || '').trim();

        if (qty <= 0) return alert('Kripya sahi Saree sankhya (Pcs) bharein!');
        if (qty > maxAvailable) return alert(`Aapke paas sirf ${maxAvailable} Pcs hain!`);

        let success = false;

        if (actionType === 'godown_transfer') {
            const toKid = document.getElementById('saree-dest-godam')?.value;
            if (!toKid) return alert('Kripya Destination Godam chunein!');

            if (typeof window.transferSareeBetweenKarkhana === 'function') {
                success = window.transferSareeBetweenKarkhana(d, sName, kName, fromKid, toKid, qty, window.currentSareeTab, note);
            }
        } else {
            const toStage = document.getElementById('saree-dest-stage')?.value;
            if (!toStage) return alert('Kripya Agli Stage chunein!');

            if (typeof window.moveSareePipelineStage === 'function') {
                success = window.moveSareePipelineStage(d, sName, kName, fromKid, qty, window.currentSareeTab, toStage, note);
            }
        }

        if (success) {
            triggerSareeCacheInvalidation();
            closeSareeTransferModal();
            renderSareeTable();

            if (typeof window.updateDashboardBadgeTotals === 'function') {
                window.updateDashboardBadgeTotals();
            }

            alert('✅ Saree safalta-poorvak transfer ho gayi!');
        }
    };

    /* ========================================================================
       7. 📱 PASSBOOK CONTROLLER (MULTI-STAGE OUTWARD & INWARD TRACKING)
       ======================================================================== */
    const openSareePassbook = (safeSaree, safeKariger, safeKid) => {
        const sName = decodeURIComponent(safeSaree);
        const kName = decodeURIComponent(safeKariger);
        const kId = decodeURIComponent(safeKid);

        window.currentPassbookSareeKey = `${normText(sName)}___${normText(kName)}___${normGodownId(kId)}`.toLowerCase();
        window.currentPassbookSareeTitle = `${sName} (${kName})`;
        sareePassbookCurrentPage = 1;

        const modal = document.getElementById('item-modal');
        if (!modal) return;

        const tabLabels = {
            fresh: 'Fresh Saree Khata',
            cutting: 'Cutting Saree Khata',
            embroidery: 'Embroidery Saree Khata',
            finished: 'Finished Saree Khata',
            lott: 'Lott Saree Khata'
        };

        const title = document.getElementById('modal-item-title');
        if (title) title.textContent = `📖 Passbook: ${window.currentPassbookSareeTitle} • ${tabLabels[window.currentSareeTab] || 'Stock'}`;

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div><label style="font-size:12px; font-weight:700;">From Date:</label><br><input type="date" id="saree-pass-from-date" onchange="applySareePassbookFilters()"></div>
                        <div><label style="font-size:12px; font-weight:700;">To Date:</label><br><input type="date" id="saree-pass-to-date" onchange="applySareePassbookFilters()"></div>
                        <div style="align-self:flex-end; display:flex; gap:6px;">
                            <button type="button" class="quick-btn btn-out" onclick="resetSareePassbookFilters()">Reset</button>
                            <button type="button" class="sheet-btn" style="background:#1e3a8a; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer;" onclick="printSareePassbookFiltered()">🖨️ A6 Print</button>
                        </div>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:12px; font-weight:700;">🔍 Search:</label><br>
                        <input type="text" id="saree-pass-search-input" class="search-box" placeholder="Search Party, Worker, Note, Qty..." oninput="applySareePassbookFilters()">
                    </div>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr style="background:#1e3a8a; color:white; font-size:12px;">
                                <th>TARIKH</th>
                                <th>DETAIL (VIVRAN)</th>
                                <th>KAHAN GAYI / KISSE AAYI (PARTY)</th>
                                <th>AAI (+)</th>
                                <th>GAYI (-)</th>
                                <th style="text-align:center;">ACTION</th>
                            </tr>
                        </thead>
                        <tbody id="saree-passbook-table-body"></tbody>
                    </table>
                </div>
                <div id="saree-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;"></div>`;
        }

        modal.style.display = 'flex';
        applySareePassbookFilters();
    };

    const resetSareePassbookFilters = () => {
        const fDate = document.getElementById('saree-pass-from-date');
        const tDate = document.getElementById('saree-pass-to-date');
        const sInp = document.getElementById('saree-pass-search-input');
        if (fDate) fDate.value = '';
        if (tDate) tDate.value = '';
        if (sInp) sInp.value = '';
        sareePassbookCurrentPage = 1;
        applySareePassbookFilters();
    };

    const applySareePassbookFilters = () => {
        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];

        let list = history.filter((r) => {
            if (!r) return false;
            const sName = normText(r.sareeName || r.name, 'GENERAL SAREE');
            const kName = normText(r.karigerName || r.kariger, 'KARKHANA');
            const kid = normGodownId(r.karkhanaId);
            const key = `${sName}___${kName}___${kid}`.toLowerCase();
            const t = normTabName(r.type);

            return key === window.currentPassbookSareeKey && t === window.currentSareeTab.toLowerCase();
        });

        const fDate = document.getElementById('saree-pass-from-date')?.value || '';
        const tDate = document.getElementById('saree-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('saree-pass-search-input')?.value || '').toLowerCase().trim();

        if (fDate) list = list.filter((item) => item.date >= fDate);
        if (tDate) list = list.filter((item) => item.date <= tDate);

        if (sTxt) {
            list = list.filter((item) => {
                const fullText = `${item.date || ''} ${item.sareeName || ''} ${item.karigerName || ''} ${item.partyName || ''} ${item.targetWorker || ''} ${item.typeLabel || ''} ${item.note || ''} ${item.aai || ''} ${item.gai || ''}`.toLowerCase();
                return fullText.includes(sTxt);
            });
        }

        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        filteredSareePassbookCache = list;
        renderPaginatedSareePassbook();
    };

    /* ========================================================================
       RENDER PASSBOOK ROWS (WITH EXPLICIT PROCESS TAGS)
       ======================================================================== */
    const renderPaginatedSareePassbook = () => {
        const tbody = document.getElementById('saree-passbook-table-body');
        const pager = document.getElementById('saree-passbook-pagination-controls');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalEntries = filteredSareePassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Is Stage par abhi koi len-den nahi hua hai.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / SAREE_PAGE_SIZE) || 1;
        if (sareePassbookCurrentPage > totalPages) sareePassbookCurrentPage = totalPages;
        if (sareePassbookCurrentPage < 1) sareePassbookCurrentPage = 1;

        const startIndex = (sareePassbookCurrentPage - 1) * SAREE_PAGE_SIZE;
        const pageRows = filteredSareePassbookCache.slice(startIndex, startIndex + SAREE_PAGE_SIZE);

        let html = '';
        pageRows.forEach((r) => {
            const isGai = (r.isOut === true) || (safeNum(r.gai) > 0) || String(r.typeLabel || '').includes('➔') || String(r.typeLabel || '').includes('Bheja') || String(r.note || '').includes('bheja');
            const inQty = isGai ? 0 : safeInt(r.aai !== undefined ? r.aai : r.pcs);
            const outQty = isGai ? safeInt(r.gai !== undefined ? r.gai : r.pcs) : 0;

            const isOpening = (r.isOpening === true) || String(r.typeLabel || '').includes('Opening');
            const isKarigerSheet = Boolean(r.refId && String(r.refId).startsWith('tani_') || String(r.typeLabel || '').includes('Kariger Sheet'));

            const singlePrintBtn = `<button type="button" title="A6 Slip Print" class="sheet-btn" style="background:#0284c7; color:#ffffff; padding:4px 7px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="printSingleSareePassbookEntry('${esc(r.id)}')">🖨️</button>`;

            let typeDisplay = '';
            let partyDisplay = '';
            let actBtn = '';

            if (isOpening) {
                typeDisplay = `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">📦 Opening Stock</span>`;
                partyDisplay = `<span style="color:#b45309; font-weight:bold;">📦 Pichla Bacha Stock</span>`;
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#64748b; font-size:11px; font-weight:700;'>🔒 Opening</span>
                    ${singlePrintBtn}
                </div>`;
            } else if (isGai) {
                const destination = r.partyName || r.targetWorker || r.note || 'Outward';
                let icon = '👉 ';
                const destLower = String(destination).toLowerCase();

                if (destLower.includes('embroidery')) icon = '🪡 ';
                else if (destLower.includes('calender')) icon = '🎛️ ';
                else if (destLower.includes('cutting')) icon = '✂️ ';
                else if (destLower.includes('dukan')) icon = '🏪 ';

                typeDisplay = `<strong style="color:#dc2626;">${esc(r.typeLabel || 'Saree Out')}</strong>`;
                partyDisplay = `<strong style="color:#dc2626;">${icon}${esc(destination)}</strong>`;
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#dc2626; font-size:11px; font-weight:700;'>📤 Outward</span>
                    ${singlePrintBtn}
                </div>`;
            } else if (isKarigerSheet) {
                typeDisplay = `<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">🌱 Kariger Sheet Se Aai</span>`;
                partyDisplay = `👤 <strong>${esc(r.karigerName || r.kariger || '-')}</strong> <small style="color:#64748b;">(Maker)</small>`;
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <span style='color:#059669; font-size:11px; font-weight:700;'>🔒 Tani Sheet</span>
                    ${singlePrintBtn}
                </div>`;
            } else {
                const source = r.partyName || r.targetWorker || r.note || 'Inward';
                let icon = '📥 ';
                const srcLower = String(source).toLowerCase();

                if (srcLower.includes('embroidery')) icon = '🪡 ';
                else if (srcLower.includes('calender')) icon = '🎛️ ';
                else if (srcLower.includes('cutting')) icon = '✂️ ';

                typeDisplay = `<strong style="color:#059669;">${esc(r.typeLabel || 'Tayyar Saree Aai')}</strong>`;
                partyDisplay = `<strong style="color:#059669;">${icon}${esc(source)}</strong>`;
                actBtn = `<div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <button type="button" class="delete-btn" onclick="deleteManualSareeEntry('${esc(r.id)}')">🗑️</button>
                    ${singlePrintBtn}
                </div>`;
            }

            html += `<tr>
                <td>${formatDisplay(r.date)}</td>
                <td>${typeDisplay}</td>
                <td>${partyDisplay}</td>
                <td style="color:#059669; font-weight:800;">${inQty > 0 ? `+${inQty} Pcs` : '-'}</td>
                <td style="color:#dc2626; font-weight:800;">${outQty > 0 ? `-${outQty} Pcs` : '-'}</td>
                <td style="text-align:center;">${actBtn}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + SAREE_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${sareePassbookCurrentPage <= 1 ? '#cbd5e1' : '#1e3a8a'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sareePassbookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${sareePassbookCurrentPage <= 1 ? 'disabled' : ''} onclick="changeSareePassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${sareePassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${sareePassbookCurrentPage >= totalPages ? '#cbd5e1' : '#1e3a8a'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${sareePassbookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${sareePassbookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeSareePassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeSareePassbookPage = (delta) => {
        sareePassbookCurrentPage += delta;
        renderPaginatedSareePassbook();
    };

    const deleteManualSareeEntry = (id) => {
        if (!confirm('Kya aap sach me ye manual entry delete karna chahte hain?')) return;

        let history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        history = history.filter((x) => x && String(x.id) !== String(id));

        if (typeof window.setStore === 'function') {
            window.setStore('saree_history', history);
        }

        triggerSareeCacheInvalidation();
        applySareePassbookFilters();
        renderSareeTable();

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }

        alert('✅ Entry delete ho gayi!');
    };

    /* ========================================================================
       8. PRINT ENGINES
       ======================================================================== */
    const getSareeKarkhanaPrintName = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Godam (All Units)';
        if (typeof window.getKarkhanaNameById === 'function') {
            return window.getKarkhanaNameById(kId);
        }
        return kId;
    };

    const printSareeStockReport = () => {
        const rows = currentSareeFilteredRowsCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi saree stock nahi mila!');
        }

        const kName = getSareeKarkhanaPrintName(window.currentSareeKarkhanaFilter);
        const stageName = (window.currentSareeTab || 'fresh').toUpperCase() + ' SAREE';
        const today = new Date().toLocaleDateString('hi-IN');

        let totalAai = 0;
        let totalGai = 0;
        let totalBachi = 0;

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            const aai = safeInt(r.aai);
            const gai = safeInt(r.gai);
            const bachi = safeInt(r.bachi);

            totalAai += aai;
            totalGai += gai;
            totalBachi += bachi;

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:4px 2px;">${idx + 1}</td>
                    <td style="padding:4px 2px; font-weight:bold;">${esc(r.sareeName)}</td>
                    <td style="padding:4px 2px;">${esc(r.karigerName || '-')}</td>
                    <td style="padding:4px 2px; text-align:right;">+${aai}</td>
                    <td style="padding:4px 2px; text-align:right;">-${gai}</td>
                    <td style="padding:4px 2px; text-align:right; font-weight:bold;">${bachi}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Stock Report - A6</title>
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
                        <p><strong>${stageName} STOCK REPORT</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Godam:</strong> ${esc(kName)}</div>
                        <div><strong>Print Tarikh:</strong> ${today}</div>
                        <div><strong>Total Saree Types:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>SAREE</th><th>MAKER</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th><th style="text-align:right;">BACHI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aai Saree:</span> <span>+${totalAai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gai Saree:</span> <span>-${totalGai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI SAREE:</span> <span>${totalBachi} Pcs</span>
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

    const printSareePassbookFiltered = () => {
        const rows = filteredSareePassbookCache;
        if (!rows || !rows.length) {
            return alert('Print karne ke liye koi passbook entry nahi mili!');
        }

        const title = window.currentPassbookSareeTitle || 'Saree Passbook';
        const tabStage = (window.currentSareeTab || 'fresh').toUpperCase();
        const fDate = document.getElementById('saree-pass-from-date')?.value || '';
        const tDate = document.getElementById('saree-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalAai = 0;
        let totalGai = 0;

        let rowsHtml = '';
        rows.forEach((r) => {
            const isGai = (r.isOut === true) || (safeNum(r.gai) > 0) || String(r.typeLabel || '').includes('➔') || String(r.typeLabel || '').includes('Bheja') || String(r.note || '').includes('bheja');
            const inQty = isGai ? 0 : safeInt(r.aai !== undefined ? r.aai : r.pcs);
            const outQty = isGai ? safeInt(r.gai !== undefined ? r.gai : r.pcs) : 0;

            totalAai += inQty;
            totalGai += outQty;

            const partyInfo = r.partyName || r.targetWorker || r.note || r.karigerName || 'Movement';
            const vivran = r.typeLabel || 'Saree Movement';

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${formatDisplay(r.date)}</td>
                    <td style="padding:3px 2px; font-weight:600;">${esc(vivran)}</td>
                    <td style="padding:3px 2px;">${esc(partyInfo)}</td>
                    <td style="padding:3px 2px; text-align:right;">${inQty > 0 ? `+${inQty}` : '-'}</td>
                    <td style="padding:3px 2px; text-align:right;">${outQty > 0 ? `-${outQty}` : '-'}</td>
                </tr>`;
        });

        const netBalance = totalAai - totalGai;

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Passbook - A6</title>
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
                        <p><strong>SAREE PASSBOOK STATEMENT (${tabStage})</strong></p>
                    </div>
                    <div class="meta">
                        <div><strong>Saree Details:</strong> ${esc(title)}</div>
                        <div><strong>Filter Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Kul Entries:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>DETAIL</th><th>PARTY</th><th style="text-align:right;">AAI</th><th style="text-align:right;">GAI</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Aai Saree:</span> <span>+${totalAai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                            <span>Kul Gai Saree:</span> <span>-${totalGai} Pcs</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px dashed #000; padding-top:3px;">
                            <span>NET BACHI SAREE:</span> <span>${netBalance} Pcs</span>
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

    const printSingleSareePassbookEntry = (id) => {
        const history = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        const entry = history.find(x => x && String(x.id) === String(id));
        if (!entry) return alert('Entry nahi mili!');

        const sName = entry.sareeName || entry.name || 'Saree';
        const party = entry.partyName || entry.targetWorker || entry.karigerName || entry.kariger || '-';
        const godamName = getSareeKarkhanaPrintName(entry.karkhanaId);
        const isGai = (entry.isOut === true) || (safeNum(entry.gai) > 0) || String(entry.typeLabel || '').includes('➔') || String(entry.note || '').includes('bheja');
        const pcs = isGai ? safeInt(entry.gai !== undefined ? entry.gai : entry.pcs) : safeInt(entry.aai !== undefined ? entry.aai : entry.pcs);
        const pcsDisplay = isGai ? `-${pcs} Pcs` : `+${pcs} Pcs`;

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Saree Voucher - A6</title>
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
                        <p>SAREE LEN-DEN PARCHI</p>
                    </div>
                    <div class="row"><span><strong>Parchi ID:</strong></span><span>#${esc(String(entry.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${formatDisplay(entry.date)}</span></div>
                    <div class="row"><span><strong>Godam:</strong></span><span>${esc(godamName)}</span></div>
                    <div class="row"><span><strong>Saree Name:</strong></span><span>${esc(sName)}</span></div>
                    <div class="row"><span><strong>Party / Karigar:</strong></span><span>${esc(party)}</span></div>
                    <div class="row"><span><strong>Detail:</strong></span><span>${esc(entry.typeLabel || entry.type || 'Movement')}</span></div>
                    <div class="total-highlight">
                        KUL SAREE: ${pcsDisplay}
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
       9. GLOBAL EXPORT
       ======================================================================== */
    const sareeUIAPI = {
        openSareeModule,
        switchSareeStockTab,
        renderSareeKarkhanaTabs,
        switchSareeKarkhanaTab,
        filterSaree,
        changeSareeStockPage,
        printSareeStockReport,
        toggleSareeForm,
        saveNewSareeStock,
        renderSareeTable,
        openSareeTransferModal,
        closeSareeTransferModal,
        toggleSareeTransferFields,
        submitSareeTransferForm,
        openSareePassbook,
        resetSareePassbookFilters,
        applySareePassbookFilters,
        changeSareePassbookPage,
        printSareePassbookFiltered,
        printSingleSareePassbookEntry,
        deleteManualSareeEntry
    };

    Object.keys(sareeUIAPI).forEach((fnName) => {
        window[fnName] = sareeUIAPI[fnName];
    });

    window.SareeUIEngine = sareeUIAPI;

    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('search-saree-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(sareeSearchDebounceTimer);
                sareeSearchDebounceTimer = setTimeout(() => {
                    sareeStockCurrentPage = 1;
                    renderSareeTable();
                }, 200);
            });
        }
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sareeUIAPI;
    }
})();
