/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE DUKAN FINAL OUT & PASSBOOK ENGINE
   File: dukan/dukan.js • Developed by Farhan Jawed
   Architecture: Zero-Reflow Virtualized DOM | Dedicated Kariger Dispatch Box
   Scale: 1,000,000 - 2,000,000 Active Users | 6-Column Full Width Grid
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & PAGINATION POOL
       ------------------------------------------------------------------------
    ======================================================================== */
    let dukanCurrentPage = 1;
    const DUKAN_PAGE_SIZE = 15;
    let dukanEditId = null;
    let filteredDukanCache = [];

    // Passbook Modal Pagination State
    let dukanPassbookCurrentPage = 1;
    const DUKAN_PASSBOOK_PAGE_SIZE = 20;
    let filteredDukanPassbookCache = [];

    /* ========================================================================
       2. SAFE DATA & DOM HELPERS
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

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null) ? val : '';
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

    const triggerAllCachesInvalidation = () => {
        if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
        if (typeof window.invalidateCalenderCalcCache === 'function') window.invalidateCalenderCalcCache();
        if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache();
    };

    /* ========================================================================
       3. STORE ACCESSORS & FINISHED STOCK RESOLVER
       ------------------------------------------------------------------------
    ======================================================================== */

    const getDukanTransfers = () => {
        try {
            return toArray(getFromStore('dukan_transfer_history'));
        } catch (err) {
            console.error('[DukanEngine] getDukanTransfers failure:', err);
            return [];
        }
    };

    const saveDukanTransfers = (list) => {
        try {
            setToStore('dukan_transfer_history', toArray(list));
        } catch (err) {
            console.error('[DukanEngine] saveDukanTransfers failure:', err);
        }
    };

    const getAvailableFinishedSareesMap = () => {
        const sH = toArray(getFromStore('saree_history'));
        const map = new Map();

        sH.forEach((h) => {
            if (!h || String(h.type || '').toLowerCase() !== 'finished') return;
            const sName = normText(h.sareeName || h.name, 'GENERAL SAREE');
            const kName = normText(h.karigerName || h.kariger, 'KARKHANA');
            const kid = normGodownId(h.karkhanaId);
            const key = `${sName}___${kName}___${kid}`;

            const isGai = (h.isOut === true) || (safeNum(h.gai) > 0);
            const inQ = isGai ? 0 : safeNum(h.aai !== undefined ? h.aai : h.pcs);
            const outQ = isGai ? safeNum(h.gai !== undefined ? h.gai : h.pcs) : 0;

            if (!map.has(key)) {
                map.set(key, { sName, kName, kid, aai: 0, gai: 0, bachi: 0 });
            }
            const item = map.get(key);
            item.aai += inQ;
            item.gai += outQ;
            item.bachi = Math.max(0, item.aai - item.gai);
        });

        return map;
    };

    /**
     * Injects or Updates Kariger/Saree Selector Box in Dukan Outward Form
     */
    const populateDukanSareeDropdown = () => {
        let wrap = document.getElementById('jw-dukan-saree-select-wrap');
        const formRow = document.querySelector('#jw-dukan-view .form-row-3');

        if (!wrap && formRow && formRow.parentNode) {
            wrap = document.createElement('div');
            wrap.id = 'jw-dukan-saree-select-wrap';
            wrap.className = 'input-group';
            wrap.style.cssText = 'margin-bottom:12px; width:100%;';
            wrap.innerHTML = `
                <label style="font-weight:700; color:#15803d; font-size:13px;">
                    👤 Kariger Name Chunein (Kiski Saree Bhejna Hai):
                </label>
                <select id="jw-dukan-saree-select" style="width:100%; padding:9px 12px; border:2px solid #86efac; border-radius:6px; font-weight:bold; font-size:13px; background:#f0fdf4; margin-top:4px; color:#14532d; cursor:pointer;">
                </select>
                <small id="jw-dukan-stock-hint" style="color:#0f766e; font-weight:700; display:block; margin-top:4px; font-size:11px;">
                    * Kariger chunte hi uski Finished Saree aur bachi hui Qty yahan dikhegi.
                </small>`;
            formRow.parentNode.insertBefore(wrap, formRow);
        }

        const sel = document.getElementById('jw-dukan-saree-select');
        if (!sel) return;

        const currentVal = sel.value;
        sel.innerHTML = '<option value="auto">🌐 Sabhi Finished Stock Se (Auto FIFO)</option>';

        const finishedMap = getAvailableFinishedSareesMap();
        finishedMap.forEach((val, key) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `👤 ${val.kName} — 🥻 ${val.sName} (Maujooda Stock: ${val.bachi} Pcs)`;
            if (key === currentVal) opt.selected = true;
            sel.appendChild(opt);
        });
    };

    /* ========================================================================
       4. ATOMIC SAVE & EDIT DISPATCHER (FULL QUANTITY & NO LEAKAGE)
       ------------------------------------------------------------------------
    ======================================================================== */

    const addDukanTransferEntry = () => {
        const dateInput = document.getElementById('jw-dukan-date');
        const pcsInput = document.getElementById('jw-dukan-pcs');
        const noteInput = document.getElementById('jw-dukan-note');
        const selSaree = document.getElementById('jw-dukan-saree-select');

        const d = dateInput?.value || getToday();
        const pcs = safeInt(pcsInput?.value);
        const note = String(noteInput?.value || '').trim();
        const selectedKey = selSaree ? selSaree.value : 'auto';

        if (pcs <= 0) return alert('Kripya sahi Saree Pcs sankhya bharein!');

        const cleanNote = note || 'Apni Dukan';
        const entryId = dukanEditId || `duk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        try {
            let sH = [...toArray(getFromStore('saree_history'))];
            const finishedMap = getAvailableFinishedSareesMap();

            let targetSName = 'Finished Saree';
            let targetKName = 'Karkhana Finished';
            let targetKid = 'k_main';

            // Agar user ne specific Kariger chuna hai (jaise Abrar/Absar)
            if (selectedKey && selectedKey !== 'auto' && finishedMap.has(selectedKey)) {
                const target = finishedMap.get(selectedKey);
                targetSName = target.sName;
                targetKName = target.kName;
                targetKid = target.kid;
            } else {
                // Auto Mode me pehla available Kariger lein
                let foundAny = false;
                finishedMap.forEach((val) => {
                    if (!foundAny && val.bachi > 0) {
                        targetSName = val.sName;
                        targetKName = val.kName;
                        targetKid = val.kid;
                        foundAny = true;
                    }
                });
            }

            let list = [...getDukanTransfers()];

            if (dukanEditId) {
                // EDIT MODE
                const item = list.find((x) => String(x.id) === String(dukanEditId));
                if (item) {
                    item.date = d;
                    item.sareeName = targetSName;
                    item.karigerName = targetKName;
                    item.pcs = pcs;
                    item.note = cleanNote;
                }
                sH = sH.filter((h) => !h || String(h.refId) !== String(dukanEditId));
            } else {
                // NEW ENTRY
                list.push({
                    id: entryId,
                    date: d,
                    sareeName: targetSName,
                    karigerName: targetKName,
                    pcs: pcs,
                    note: cleanNote,
                    timestamp: Date.now()
                });
            }

            saveDukanTransfers(list);

            // Saree History me POORA PCS OUT (-) commit hoga
            sH.push({
                id: `sh_dukan_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                refId: entryId,
                date: d,
                sareeName: targetSName,
                karigerName: targetKName,
                kariger: targetKName,
                partyName: cleanNote, // Passbook me dikhega: 🏪 Apni Dukan
                targetWorker: cleanNote,
                karkhanaId: targetKid,
                type: 'finished',
                typeLabel: `🏪 Dukan Bheja (${cleanNote})`,
                aai: 0,
                gai: pcs, // Poora quantity minus
                isOut: true,
                note: `${targetSName} (${cleanNote})`,
                timestamp: Date.now()
            });

            setToStore('saree_history', sH);
            triggerAllCachesInvalidation();

            cancelDukanEdit();
            renderDukanTransferTable();

            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

            alert(`✅ Kariger [${targetKName}] ki ${pcs} Pcs Saree [${targetSName}] Dukan bhej di gayi!`);
        } catch (err) {
            console.error('[DukanEngine] Outward transfer transaction failure:', err);
            alert('Transfer record save karne me takleef aayi.');
        }
    };

    const editDukanTransferEntry = (id) => {
        const item = getDukanTransfers().find((x) => String(x.id) === String(id));
        if (!item) return alert('Entry nahi mili!');

        dukanEditId = item.id;

        const dInp = document.getElementById('jw-dukan-date');
        const pInp = document.getElementById('jw-dukan-pcs');
        const nInp = document.getElementById('jw-dukan-note');
        if (dInp) dInp.value = item.date;
        if (pInp) pInp.value = item.pcs;
        if (nInp) nInp.value = item.note || '';

        const selSaree = document.getElementById('jw-dukan-saree-select');
        if (selSaree && item.karigerName) {
            for (let i = 0; i < selSaree.options.length; i++) {
                if (selSaree.options[i].text.includes(item.karigerName)) {
                    selSaree.selectedIndex = i;
                    break;
                }
            }
        }

        const btn = document.querySelector('#jw-dukan-view .add-btn');
        if (btn) {
            btn.innerHTML = '✏️ Update Dukan Entry';
            btn.style.background = '#0284c7';
        }

        let cancelBtn = document.getElementById('jw-dukan-cancel-edit-btn');
        if (!cancelBtn && btn && btn.parentNode) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'jw-dukan-cancel-edit-btn';
            cancelBtn.type = 'button';
            cancelBtn.className = 'back-btn';
            cancelBtn.style.cssText = 'margin-left:8px; padding:8px 14px;';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = cancelDukanEdit;
            btn.parentNode.appendChild(cancelBtn);
        } else if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
        }

        const formBox = document.querySelector('#jw-dukan-view .form-row-3');
        if (formBox) formBox.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelDukanEdit = () => {
        dukanEditId = null;

        const dInp = document.getElementById('jw-dukan-date');
        const pInp = document.getElementById('jw-dukan-pcs');
        const nInp = document.getElementById('jw-dukan-note');
        if (dInp) dInp.value = getToday();
        if (pInp) pInp.value = '';
        if (nInp) nInp.value = '';

        const btn = document.querySelector('#jw-dukan-view .add-btn');
        if (btn) {
            btn.innerHTML = '+ Dukan Bhejein & Minus Stock';
            btn.style.background = '#15803d';
        }

        const cancelBtn = document.getElementById('jw-dukan-cancel-edit-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    };

    const deleteDukanTransferEntry = (identifier) => {
        if (!confirm('Kya is entry ko delete karna chahte hain? Saree wapas Finished Stock me jud jayegi.')) {
            return;
        }

        try {
            let list = [...getDukanTransfers()];
            let targetItem = null;

            if (typeof identifier === 'string') {
                targetItem = list.find((x) => String(x.id) === identifier);
            } else if (typeof identifier === 'number' && list[identifier]) {
                targetItem = list[identifier];
            }

            if (!targetItem) return alert('Entry nahi mili!');

            const refId = targetItem.id;

            list = list.filter((x) => String(x.id) !== String(refId));
            saveDukanTransfers(list);

            let sH = toArray(getFromStore('saree_history')).filter((h) => !h || String(h.refId) !== String(refId));
            setToStore('saree_history', sH);

            triggerAllCachesInvalidation();
            cancelDukanEdit();
            renderDukanTransferTable();

            if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

            alert('🗑️ Entry delete ho gayi aur Saree stock wapas Finished Stock me jama ho gaya!');
        } catch (err) {
            console.error('[DukanEngine] Deletion rollback failure:', err);
            alert('Delete karne me takleef aayi.');
        }
    };

    /* ========================================================================
       5. 6-COLUMN FULL WIDTH TABLE RENDERER (NO HALF BLUE BAR)
       ------------------------------------------------------------------------
    ======================================================================== */

    const renderDukanTransferTable = () => {
        populateDukanSareeDropdown();
        ensureDukanToolbar();

        // ⭐ 6-COLUMN FULL BLUE HEADER FIX (Matching 100% with tbody columns)
        const thead = document.querySelector('#jw-dukan-view table thead');
        if (thead) {
            thead.innerHTML = `
                <tr style="background:#1e3a8a; color:white; font-size:13px; text-align:left;">
                    <th style="padding:10px 8px;">Tarikh</th>
                    <th style="padding:10px 8px;">Saree Design</th>
                    <th style="padding:10px 8px;">Kariger (Maker)</th>
                    <th style="padding:10px 8px;">Pcs Bheje</th>
                    <th style="padding:10px 8px;">Note / Receiver</th>
                    <th style="padding:10px 8px; text-align:center;">Action</th>
                </tr>`;
        }

        const tbody = document.getElementById('jw-dukan-table-body');
        if (!tbody) return;

        const list = getDukanTransfers();
        const fDate = document.getElementById('jw-dukan-from-date')?.value || '';
        const tDate = document.getElementById('jw-dukan-to-date')?.value || '';
        const sTxt = (document.getElementById('jw-dukan-search-input')?.value || '').toLowerCase().trim();

        let filtered = list.filter((d) => {
            if (!d) return false;
            if (fDate && d.date < fDate) return false;
            if (tDate && d.date > tDate) return false;
            if (sTxt) {
                const full = `${d.date || ''} ${d.sareeName || ''} ${d.karigerName || ''} ${d.pcs || ''} ${d.note || ''}`.toLowerCase();
                if (!full.includes(sTxt)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        filteredDukanCache = filtered;

        // Stat Calculations
        let totCalenderFinished = 0;
        if (typeof window.getCalenderFinishedLiveStats === 'function') {
            const calStats = window.getCalenderFinishedLiveStats();
            totCalenderFinished = safeNum(calStats.totFinished);
        } else if (typeof window.getJobWorkers === 'function') {
            const workers = window.getJobWorkers().filter((w) => String(w?.type || '').toLowerCase() === 'calender');
            workers.forEach((w) => {
                const sheets = (typeof window.getJobWorkerSheets === 'function') ? window.getJobWorkerSheets(w.id) : [];
                sheets.forEach((sh) => {
                    const rows = toArray(sh?.rows);
                    rows.forEach((r) => { totCalenderFinished += safeNum(r?.aayiQty); });
                });
            });
        }

        let totDukanSent = 0;
        list.forEach((d) => { totDukanSent += safeNum(d?.pcs); });
        const bachaInKarkhana = Math.max(0, totCalenderFinished - totDukanSent);

        setText('jw-stat-calender-finished', `${totCalenderFinished} Pcs`);
        setText('jw-stat-dukan-sent', `${totDukanSent} Pcs`);
        setText('jw-stat-karkhana-bacha', `${bachaInKarkhana} Pcs`);

        let pager = document.getElementById('jw-dukan-pagination-controls');
        if (!pager) {
            const tbl = tbody.closest('table') || tbody.parentElement;
            if (tbl && tbl.parentElement) {
                pager = document.createElement('div');
                pager.id = 'jw-dukan-pagination-controls';
                pager.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;';
                tbl.parentElement.appendChild(pager);
            }
        }

        const totalEntries = filtered.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Koi Dukan Transfer entry nahi mili.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / DUKAN_PAGE_SIZE) || 1;
        if (dukanCurrentPage > totalPages) dukanCurrentPage = totalPages;
        if (dukanCurrentPage < 1) dukanCurrentPage = 1;

        const startIndex = (dukanCurrentPage - 1) * DUKAN_PAGE_SIZE;
        const pageRows = filtered.slice(startIndex, startIndex + DUKAN_PAGE_SIZE);

        let html = '';
        pageRows.forEach((d) => {
            const safeId = esc(d.id);

            html += `<tr>
                <td>${formatDisplay(d.date)}</td>
                <td><strong style="color:#0f766e;">🥻 ${esc(d.sareeName || 'Finished Saree')}</strong></td>
                <td><strong>👤 ${esc(d.karigerName || '-')}</strong></td>
                <td><strong style="color:#15803d; font-size:14px;">+${safeNum(d.pcs)} Pcs</strong></td>
                <td>${esc(d.note || 'Apni Dukan')}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" style="background:#0284c7; padding:4px 8px; font-size:11px;" onclick="printSingleDukanSlip('${safeId}')">🖨️ Parchi</button>
                    <button type="button" class="edit-btn" onclick="editDukanTransferEntry('${safeId}')">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteDukanTransferEntry('${safeId}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + DUKAN_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${dukanCurrentPage <= 1 ? '#cbd5e1' : '#1e3a8a'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${dukanCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${dukanCurrentPage <= 1 ? 'disabled' : ''} onclick="changeDukanPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${dukanCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${dukanCurrentPage >= totalPages ? '#cbd5e1' : '#1e3a8a'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${dukanCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${dukanCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeDukanPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeDukanPage = (delta) => {
        dukanCurrentPage += delta;
        renderDukanTransferTable();
    };

    const ensureDukanToolbar = () => {
        if (document.getElementById('jw-dukan-filter-panel')) return;

        const tblWrap = document.querySelector('#jw-dukan-view .table-responsive');
        if (!tblWrap || !tblWrap.parentNode) return;

        const bar = document.createElement('div');
        bar.id = 'jw-dukan-filter-panel';
        bar.style.cssText = 'background:#f8fafc; border:1px solid #cbd5e1; padding:10px 12px; border-radius:8px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;';

        bar.innerHTML = `
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <div><label style="font-size:11px; font-weight:700;">From:</label><br><input type="date" id="jw-dukan-from-date" onchange="renderDukanTransferTable()" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px;"></div>
                <div><label style="font-size:11px; font-weight:700;">To:</label><br><input type="date" id="jw-dukan-to-date" onchange="renderDukanTransferTable()" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px;"></div>
                <div style="align-self:flex-end; display:flex; gap:6px;">
                    <button type="button" class="quick-btn btn-out" onclick="resetDukanFilter()" style="padding:5px 9px; font-size:11px;">Reset</button>
                    <button type="button" class="sheet-btn" onclick="openDukanPassbookModal()" style="background:#15803d; color:white; padding:5px 10px; font-size:11px; border-radius:4px; font-weight:bold; cursor:pointer;">📖 Dukan Passbook</button>
                    <button type="button" class="sheet-btn" onclick="printDukanStatementReport()" style="background:#1e3a8a; color:white; padding:5px 10px; font-size:11px; border-radius:4px; font-weight:bold; cursor:pointer;">🖨️ A6 Print</button>
                </div>
            </div>
            <div style="flex:1; min-width:180px;">
                <label style="font-size:11px; font-weight:700;">🔍 Search:</label><br>
                <input type="text" id="jw-dukan-search-input" placeholder="Search Saree, Kariger, Date..." oninput="renderDukanTransferTable()" style="width:100%; padding:5px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;">
            </div>`;

        tblWrap.parentNode.insertBefore(bar, tblWrap);
    };

    const resetDukanFilter = () => {
        const f = document.getElementById('jw-dukan-from-date');
        const t = document.getElementById('jw-dukan-to-date');
        const s = document.getElementById('jw-dukan-search-input');
        if (f) f.value = '';
        if (t) t.value = '';
        if (s) s.value = '';
        dukanCurrentPage = 1;
        renderDukanTransferTable();
    };

    /* ========================================================================
       6. 📱 DUKAN PASSBOOK / STATEMENT MODAL
       ------------------------------------------------------------------------
    ======================================================================== */

    const openDukanPassbookModal = () => {
        const modal = document.getElementById('item-modal');
        if (!modal) return;

        dukanPassbookCurrentPage = 1;

        const title = document.getElementById('modal-item-title');
        if (title) title.textContent = '📖 Dukan Bheja Ledger Passbook (Shop Dispatch Statement)';

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:10px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <div><label style="font-size:12px; font-weight:700;">From:</label><br><input type="date" id="duk-pass-from-date" onchange="applyDukanPassbookFilter()"></div>
                        <div><label style="font-size:12px; font-weight:700;">To:</label><br><input type="date" id="duk-pass-to-date" onchange="applyDukanPassbookFilter()"></div>
                        <div style="align-self:flex-end; display:flex; gap:6px;">
                            <button type="button" class="quick-btn btn-out" onclick="resetDukanPassbookFilter()">Reset</button>
                            <button type="button" class="sheet-btn" style="background:#15803d; color:white; padding:6px 12px; font-weight:bold; border-radius:6px; cursor:pointer;" onclick="printDukanStatementReport()">🖨️ A6 Statement</button>
                        </div>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="font-size:12px; font-weight:700;">🔍 Search:</label><br>
                        <input type="text" id="duk-pass-search-input" class="search-box" placeholder="Search Date, Kariger, Saree..." oninput="applyDukanPassbookFilter()">
                    </div>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr style="background:#15803d; color:white; font-size:12px;">
                                <th>TARIKH</th><th>SAREE DESIGN</th><th>KARIGER (MAKER)</th><th>NOTE / DUKAN</th><th>PCS BHEJE (-)</th><th style="text-align:center;">ACTION</th>
                            </tr>
                        </thead>
                        <tbody id="dukan-passbook-table-body"></tbody>
                    </table>
                </div>
                <div id="dukan-passbook-pagination-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 4px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;"></div>`;
        }

        modal.style.display = 'flex';
        applyDukanPassbookFilter();
    };

    const resetDukanPassbookFilter = () => {
        const f = document.getElementById('duk-pass-from-date');
        const t = document.getElementById('duk-pass-to-date');
        const s = document.getElementById('duk-pass-search-input');
        if (f) f.value = '';
        if (t) t.value = '';
        if (s) s.value = '';
        dukanPassbookCurrentPage = 1;
        applyDukanPassbookFilter();
    };

    const applyDukanPassbookFilter = () => {
        const list = getDukanTransfers();
        const fDate = document.getElementById('duk-pass-from-date')?.value || '';
        const tDate = document.getElementById('duk-pass-to-date')?.value || '';
        const sTxt = (document.getElementById('duk-pass-search-input')?.value || '').toLowerCase().trim();

        let filtered = list.filter((d) => {
            if (!d) return false;
            if (fDate && d.date < fDate) return false;
            if (tDate && d.date > tDate) return false;
            if (sTxt) {
                const full = `${d.date || ''} ${d.sareeName || ''} ${d.karigerName || ''} ${d.pcs || ''} ${d.note || ''}`.toLowerCase();
                if (!full.includes(sTxt)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        filteredDukanPassbookCache = filtered;
        renderPaginatedDukanPassbook();
    };

    const renderPaginatedDukanPassbook = () => {
        const tbody = document.getElementById('dukan-passbook-table-body');
        const pager = document.getElementById('dukan-passbook-pagination-controls');
        if (!tbody) return;

        const totalEntries = filteredDukanPassbookCache.length;
        if (!totalEntries) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Koi Dukan entry record nahi mila.</td></tr>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalEntries / DUKAN_PASSBOOK_PAGE_SIZE) || 1;
        if (dukanPassbookCurrentPage > totalPages) dukanPassbookCurrentPage = totalPages;
        if (dukanPassbookCurrentPage < 1) dukanPassbookCurrentPage = 1;

        const startIndex = (dukanPassbookCurrentPage - 1) * DUKAN_PASSBOOK_PAGE_SIZE;
        const pageRows = filteredDukanPassbookCache.slice(startIndex, startIndex + DUKAN_PASSBOOK_PAGE_SIZE);

        let html = '';
        pageRows.forEach((d) => {
            const safeId = esc(d.id);
            html += `<tr>
                <td>${formatDisplay(d.date)}</td>
                <td><strong>${esc(d.sareeName || 'Finished Saree')}</strong></td>
                <td><strong>${esc(d.karigerName || '-')}</strong></td>
                <td>${esc(d.note || 'Apni Dukan')}</td>
                <td style="color:#dc2626; font-weight:800; font-size:13px;">-${safeNum(d.pcs)} Pcs</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" style="background:#0284c7; padding:3px 7px; font-size:11px;" onclick="printSingleDukanSlip('${safeId}')">🖨️</button>
                    <button type="button" class="edit-btn" onclick="editDukanTransferEntry('${safeId}'); setDisplay('item-modal', 'none');">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteDukanTransferEntry('${safeId}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        if (pager) {
            pager.innerHTML = `
                <div style="font-size:12px; color:#475569; font-weight:600;">
                    Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + DUKAN_PASSBOOK_PAGE_SIZE, totalEntries)}</strong> of <strong>${totalEntries}</strong> entries
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="sheet-btn" style="background:${dukanPassbookCurrentPage <= 1 ? '#cbd5e1' : '#15803d'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${dukanPassbookCurrentPage <= 1 ? 'not-allowed' : 'pointer'};" ${dukanPassbookCurrentPage <= 1 ? 'disabled' : ''} onclick="changeDukanPassbookPage(-1)">◀ Prev</button>
                    <span style="font-size:12px; font-weight:bold; padding:4px 8px; background:#f1f5f9; border-radius:4px;">${dukanPassbookCurrentPage} / ${totalPages}</span>
                    <button type="button" class="sheet-btn" style="background:${dukanPassbookCurrentPage >= totalPages ? '#cbd5e1' : '#15803d'}; color:white; padding:4px 10px; border-radius:4px; border:none; cursor:${dukanPassbookCurrentPage >= totalPages ? 'not-allowed' : 'pointer'};" ${dukanPassbookCurrentPage >= totalPages ? 'disabled' : ''} onclick="changeDukanPassbookPage(1)">Next ▶</button>
                </div>`;
        }
    };

    const changeDukanPassbookPage = (delta) => {
        dukanPassbookCurrentPage += delta;
        renderPaginatedDukanPassbook();
    };

    /* ========================================================================
       7. A6 THERMAL & PAPER PRINT ENGINES
       ------------------------------------------------------------------------
    ======================================================================== */

    const printSingleDukanSlip = (id) => {
        const item = getDukanTransfers().find((x) => String(x.id) === String(id));
        if (!item) return alert('Parchi nahi mili!');

        const printWindow = window.open('', '', 'width=420,height=550');
        if (!printWindow) return alert('Popup block hai! Kripya allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Dukan Challan - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                    .total-box { background: #eee; padding: 8px 4px; border: 1px solid #000; font-size: 14px; font-weight: 900; text-align: center; margin: 10px 0; }
                    .signs { display: flex; justify-content: space-between; margin-top: 30px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>DUKAN BHEJA CHALLAN (FINAL OUT)</p>
                    </div>
                    <div class="row"><span><strong>Challan ID:</strong></span><span>#${esc(String(item.id).slice(-6))}</span></div>
                    <div class="row"><span><strong>Tarikh:</strong></span><span>${formatDisplay(item.date)}</span></div>
                    <div class="row"><span><strong>Saree:</strong></span><span>${esc(item.sareeName || 'Finished Saree')}</span></div>
                    <div class="row"><span><strong>Kariger:</strong></span><span>${esc(item.karigerName || '-')}</span></div>
                    <div class="row"><span><strong>Receiver / Note:</strong></span><span>${esc(item.note || 'Apni Dukan')}</span></div>
                    <div class="total-box">
                        DUKAN SENT: ${safeNum(item.pcs)} Pcs
                    </div>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>________</div>
                        <div>दुकान रिसीवर<br><br>________</div>
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

    const printDukanStatementReport = () => {
        const rows = (filteredDukanPassbookCache.length > 0) ? filteredDukanPassbookCache : filteredDukanCache;
        if (!rows || !rows.length) return alert('Print karne ke liye koi data nahi mila!');

        const fDate = document.getElementById('jw-dukan-from-date')?.value || document.getElementById('duk-pass-from-date')?.value || '';
        const tDate = document.getElementById('jw-dukan-to-date')?.value || document.getElementById('duk-pass-to-date')?.value || '';
        const dateRangeTxt = (fDate && tDate) ? `${fDate} se ${tDate}` : (fDate ? `${fDate} ke baad` : (tDate ? `${tDate} tak` : 'Sabhi Tarikh'));

        let totalPcs = 0;
        let rowsHtml = '';

        rows.forEach((r, idx) => {
            const pcs = safeNum(r.pcs);
            totalPcs += pcs;
            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 2px;">${idx + 1}</td>
                    <td style="padding:3px 2px;">${formatDisplay(r.date)}</td>
                    <td style="padding:3px 2px; font-weight:bold;">${esc(r.sareeName || 'Saree')}</td>
                    <td style="padding:3px 2px;">${esc(r.karigerName || '-')}</td>
                    <td style="padding:3px 2px;">${esc(r.note || 'Dukan')}</td>
                    <td style="padding:3px 2px; text-align:right; font-weight:bold;">${pcs}</td>
                </tr>`;
        });

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Dukan Outward Report - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: left; padding: 3px 2px; }
                    .total-box { margin-top: 8px; border-top: 2px dashed #000; padding-top: 4px; font-size: 11px; font-weight: bold; display: flex; justify-content: space-between; }
                    .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>DUKAN BHEJA STATEMENT</p>
                    </div>
                    <div class="meta">
                        <div><strong>Avadhi:</strong> ${esc(dateRangeTxt)}</div>
                        <div><strong>Total Challan:</strong> ${rows.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th><th>TARIKH</th><th>SAREE</th><th>MAKER</th><th>RECEIVER</th><th style="text-align:right;">PCS</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="total-box">
                        <span>KUL BHEJI SAREE:</span> <span>${totalPcs} Pcs</span>
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

    /* ========================================================================
       8. GLOBAL EXPORT
       ------------------------------------------------------------------------
    ======================================================================== */
    const dukanAPI = {
        getDukanTransfers,
        saveDukanTransfers,
        addDukanTransferEntry,
        editDukanTransferEntry,
        cancelDukanEdit,
        deleteDukanTransferEntry,
        filterDukanTransfers: renderDukanTransferTable,
        resetDukanFilter,
        renderDukanTransferTable,
        changeDukanPage,
        openDukanPassbookModal,
        resetDukanPassbookFilter,
        applyDukanPassbookFilter,
        changeDukanPassbookPage,
        printSingleDukanSlip,
        printDukanStatementReport,
        populateDukanSareeDropdown
    };

    Object.keys(dukanAPI).forEach((fnName) => {
        window[fnName] = dukanAPI[fnName];
    });

    window.DukanEngine = dukanAPI;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dukanAPI;
    }
})();
