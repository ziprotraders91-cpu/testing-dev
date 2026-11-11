/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE BOOTI CUTTING UI & SHEET ENGINE
   File: cutting/cutting-ui.js • Developed by Farhan Jawed (Synced with JobWorkEngine)
   Architecture: Zero-Reflow Virtualized DOM | Full JobWork Hub Synchronization
============================================================================ */

(() => {
    'use strict';

    window.activeCuttingWorkerId = null;
    window.activeCuttingSheetId = null;
    window.activeCuttingSheetIndex = 0;

    let workerSearchDebounceTimer = null;

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

    const formatDisplay = (d) => {
        return (typeof window.formatDateDisplay === 'function') 
            ? window.formatDateDisplay(d) 
            : (d || '-');
    };

    const getCuttingWorkers = () => {
        if (typeof window.getJobWorkers === 'function') {
            return window.getJobWorkers().filter((w) => w && String(w.type || '').toLowerCase() === 'cutting');
        }
        const all = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        return all.filter((w) => w && String(w.type || '').toLowerCase() === 'cutting');
    };

    const getCuttingWorkerAbsentInfo = (workerId) => {
        if (typeof window.getJobWorkerLastActiveInfo === 'function') {
            return window.getJobWorkerLastActiveInfo(workerId);
        }
        return { lastDate: '-', daysAbsent: 0 };
    };

    const getCuttingWorkerOverallSummary = (workerId) => {
        if (typeof window.getJobWorkerOverallSummary === 'function') {
            return window.getJobWorkerOverallSummary(workerId);
        }
        return { totGayi: 0, totAayi: 0, totDmg: 0, pendingSaree: 0 };
    };

    const calculateCuttingSheetTotals = (sh) => {
        if (typeof window.calculateJobWorkSheetTotals === 'function') {
            return window.calculateJobWorkSheetTotals(sh);
        }
        return {
            totGayiQty: 0,
            totAayiQty: 0,
            totDamagePcs: 0,
            totDamageAmt: 0,
            pendingSaree: 0
        };
    };

    const triggerCacheInvalidation = (workerId) => {
        if (typeof window.invalidateCuttingCalcCache === 'function') {
            window.invalidateCuttingCalcCache();
        }
        if (typeof window.invalidateJobWorkCache === 'function') {
            window.invalidateJobWorkCache(workerId);
        }
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }
    };

    /* ========================================================================
       NAVIGATION & DIRECTORY
       ======================================================================== */
    const openCuttingModule = () => {
        window.currentJobWorkMode = 'cutting';
        if (typeof window.openJobWorkSubSection === 'function') {
            window.openJobWorkSubSection('cutting');
            return;
        }

        if (typeof window.hideAllSections === 'function') window.hideAllSections();

        setDisplay('jobwork-section', 'block');
        setDisplay('jw-hub-view', 'none');
        setDisplay('jw-sheet-view', 'none');
        setDisplay('jw-dukan-view', 'none');
        setDisplay('jw-billing-view', 'none');
        setDisplay('jw-movement-view', 'none');
        setDisplay('jw-workers-view', 'block');

        const titleEl = document.getElementById('jw-workers-title');
        if (titleEl) titleEl.textContent = '✂️ Booti Cutting Workers List';

        const addBtnEl = document.getElementById('jw-add-worker-btn-text');
        if (addBtnEl) addBtnEl.textContent = '+ Naya Cutting Kariger';

        renderCuttingWorkersTable();
    };

    /* ========================================================================
       WORKER TABLE RENDERER
       ======================================================================== */
    const renderCuttingWorkersTable = () => {
        const tbody = document.getElementById('jw-workers-table-body');
        if (!tbody) return;

        let list = getCuttingWorkers();

        const searchInput = document.getElementById('jw-search-worker-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (txt) {
            list = list.filter((w) => 
                `${w.name || ''} ${w.address || ''} ${w.mobile || ''}`.toLowerCase().includes(txt)
            );
        }

        const absentFilterEl = document.getElementById('jw-absent-filter');
        const minDays = safeInt(absentFilterEl ? absentFilterEl.value : 0);
        if (minDays > 0) {
            list = list.filter((w) => getCuttingWorkerAbsentInfo(w.id).daysAbsent >= minDays);
        }

        let totGayi = 0, totAayi = 0, totDmg = 0;
        const allCutting = getCuttingWorkers();
        allCutting.forEach((w) => {
            const sum = getCuttingWorkerOverallSummary(w.id);
            totGayi += safeNum(sum.totGayi);
            totAayi += safeNum(sum.totAayi);
            totDmg  += safeNum(sum.totDmg);
        });

        setText('jw-stat-total-gayi', `${totGayi} Pcs`);
        setText('jw-stat-total-aayi', `${totAayi} Pcs`);
        setText('jw-stat-total-damage', `${totDmg} Pcs`);

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Koi Cutting Kariger nahi mila.</td></tr>';
            return;
        }

        let html = '';
        list.forEach((w) => {
            const act = getCuttingWorkerAbsentInfo(w.id);
            let statusBadge = '';
            if (act.daysAbsent >= 30) {
                statusBadge = `<span class="badge-red" style="font-size:11px;">⚠️ ${act.daysAbsent} Din se gayab</span>`;
            } else if (act.daysAbsent >= 15) {
                statusBadge = `<span style="background:#fff7ed; color:#ea580c; border:1px solid #fed7aa; padding:2px 6px; border-radius:20px; font-weight:700; font-size:11px;">🟠 ${act.daysAbsent} Din hue</span>`;
            } else {
                statusBadge = '<span class="badge-green" style="font-size:11px;">🟢 Active</span>';
            }

            const tagadaBtn = (act.daysAbsent >= 15)
                ? ` <button type="button" class="quick-btn btn-out" style="font-size:11px;" onclick="sendCuttingTagadaWhatsApp('${esc(w.id)}', ${act.daysAbsent})">📲 तगादा</button>`
                : '';

            html += `<tr>
                <td>${formatDisplay(w.date)}</td>
                <td><strong>${esc(w.name)}</strong></td>
                <td>${esc(w.address || '-')}</td>
                <td>${esc(w.mobile || '-')}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" onclick="openCuttingSheet('${esc(w.id)}')">📊 Khata Sheet</button>
                    ${tagadaBtn}
                    <button type="button" class="edit-btn" onclick="editCuttingWorker('${esc(w.id)}')">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteCuttingWorker('${esc(w.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    /* ========================================================================
       WORKER CRUD
       ======================================================================== */
    const toggleCuttingWorkerForm = () => {
        if (typeof window.toggleJobWorkerForm === 'function') {
            window.toggleJobWorkerForm();
            return;
        }
        const f = document.getElementById('add-jw-worker-form');
        if (!f) return;
        f.style.display = (f.style.display !== 'block') ? 'block' : 'none';
    };

    const cancelCuttingWorkerEdit = () => {
        if (typeof window.cancelJobWorkerEdit === 'function') {
            window.cancelJobWorkerEdit();
            return;
        }
    };

    const saveCuttingWorker = () => {
        if (typeof window.saveNewJobWorker === 'function') {
            window.saveNewJobWorker();
            return;
        }
    };

    const editCuttingWorker = (id) => {
        if (typeof window.editJobWorker === 'function') {
            window.editJobWorker(id);
            return;
        }
    };

    const deleteCuttingWorker = (id) => {
        if (typeof window.deleteJobWorker === 'function') {
            window.deleteJobWorker(id);
            return;
        }
    };

    /* ========================================================================
       ⭐ OPEN CUTTING SHEET (SEAMLESSLY SYNCED WITH JOBWORK ENGINE)
       ======================================================================== */
    const openCuttingSheet = (id) => {
        // Ensure dono IDs sync rahein taaki batch line save ho sake
        window.activeCuttingWorkerId = id;
        window.activeJobWorkerId = id;

        // Agar JobWorkEngine ka main sheet open function maujood hai to use call karo
        if (window.JobWorkEngine && typeof window.JobWorkEngine.openJobWorkerSheet === 'function') {
            window.JobWorkEngine.openJobWorkerSheet(id);
            return;
        }
        if (typeof window.openJobWorkerSheet === 'function') {
            window.openJobWorkerSheet(id);
            return;
        }

        // Fallback
        const w = getCuttingWorkers().find((x) => String(x.id) === String(id));
        if (!w) return alert('Kariger nahi mila!');

        setDisplay('jw-workers-view', 'none');
        setDisplay('jw-sheet-view', 'block');

        const banner = document.getElementById('jw-sheet-banner-name');
        if (banner) banner.textContent = `${w.name} (Booti Cutting Khata)`;

        loadCurrentCuttingSheetData();
    };

    const loadCurrentCuttingSheetData = () => {
        if (window.JobWorkEngine && typeof window.JobWorkEngine.loadCurrentJobWorkSheet === 'function') {
            window.JobWorkEngine.loadCurrentJobWorkSheet();
            return;
        }
        if (typeof window.loadCurrentJobWorkSheet === 'function') {
            window.loadCurrentJobWorkSheet();
            return;
        }
    };

    const deleteCuttingRow = (rowId) => {
        if (typeof window.deleteJobWorkBatchRow === 'function') {
            window.deleteJobWorkBatchRow(rowId);
            return;
        }
    };

    const sendCuttingTagadaWhatsApp = (workerId, days) => {
        if (typeof window.sendJobWorkerTagadaWhatsApp === 'function') {
            window.sendJobWorkerTagadaWhatsApp(workerId, days);
            return;
        }
    };

    /* ========================================================================
       EXPORTS
       ======================================================================== */
    const cuttingUIAPI = {
        openCuttingModule,
        renderCuttingWorkersTable,
        toggleCuttingWorkerForm,
        cancelCuttingWorkerEdit,
        saveCuttingWorker,
        editCuttingWorker,
        deleteCuttingWorker,
        openCuttingSheet,
        loadCurrentCuttingSheetData,
        deleteCuttingRow,
        sendCuttingTagadaWhatsApp,
        getCuttingWorkers,
        getCuttingWorkerAbsentInfo,
        getCuttingWorkerOverallSummary,
        calculateCuttingSheetTotals
    };

    Object.keys(cuttingUIAPI).forEach((fnName) => {
        window[fnName] = cuttingUIAPI[fnName];
    });

    window.CuttingUIEngine = cuttingUIAPI;

    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('jw-search-worker-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(workerSearchDebounceTimer);
                workerSearchDebounceTimer = setTimeout(() => {
                    renderCuttingWorkersTable();
                }, 200);
            });
        }
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = cuttingUIAPI;
    }
})();
