/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE CALENDER FINISHING UI & SHEET ENGINE
   File: calender/calender-ui.js • Developed by Farhan Jawed (Synced with JobWorkEngine)
   Architecture: High-Speed Batch HTML String | Full JobWork Hub Synchronization
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & CONTEXT POOL
       ======================================================================== */
    window.activeCalenderWorkerId = null;
    window.activeCalenderSheetId = null;
    window.activeCalenderSheetIndex = 0;

    let workerSearchDebounceTimer = null;

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
            if (el) el.textContent = (val !== undefined && val !== null) ? String(val) : '';
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
       3. INTER-MODULE FALLBACK BRIDGES
       ======================================================================== */
    const getCalenderWorkers = () => {
        if (typeof window.getJobWorkers === 'function') {
            return window.getJobWorkers().filter((w) => w && String(w.type || '').toLowerCase() === 'calender');
        }
        const all = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        return all.filter((w) => w && String(w.type || '').toLowerCase() === 'calender');
    };

    const getCalenderWorkerAbsentInfo = (workerId) => {
        if (typeof window.getJobWorkerLastActiveInfo === 'function') {
            return window.getJobWorkerLastActiveInfo(workerId);
        }
        return { lastDate: '-', daysAbsent: 0 };
    };

    const getCalenderWorkerOverallSummary = (workerId) => {
        if (typeof window.getJobWorkerOverallSummary === 'function') {
            return window.getJobWorkerOverallSummary(workerId);
        }
        return { totGayi: 0, totAayi: 0, totDmg: 0, pendingSaree: 0 };
    };

    const calculateCalenderSheetTotals = (sh) => {
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
        if (typeof window.invalidateCalenderCalcCache === 'function') {
            window.invalidateCalenderCalcCache();
        }
        if (typeof window.invalidateJobWorkCache === 'function') {
            window.invalidateJobWorkCache(workerId);
        }
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }
    };

    /* ========================================================================
       4. NAVIGATION & DIRECTORY CONTROLLER
       ======================================================================== */
    const openCalenderModule = () => {
        window.currentJobWorkMode = 'calender';
        if (typeof window.openJobWorkSubSection === 'function') {
            window.openJobWorkSubSection('calender');
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
        if (titleEl) titleEl.textContent = '🎛️ Calender Workers List';

        const addBtnEl = document.getElementById('jw-add-worker-btn-text');
        if (addBtnEl) addBtnEl.textContent = '+ Naya Calender Kariger';

        renderCalenderWorkersTable();
    };

    /* ========================================================================
       5. WORKER TABLE RENDERER
       ======================================================================== */
    const renderCalenderWorkersTable = () => {
        const tbody = document.getElementById('jw-workers-table-body');
        if (!tbody) return;

        let list = getCalenderWorkers();

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
            list = list.filter((w) => getCalenderWorkerAbsentInfo(w.id).daysAbsent >= minDays);
        }

        let totGayi = 0, totAayi = 0, totDmg = 0;
        const allCalender = getCalenderWorkers();
        allCalender.forEach((w) => {
            const sum = getCalenderWorkerOverallSummary(w.id);
            totGayi += safeNum(sum.totGayi);
            totAayi += safeNum(sum.totAayi);
            totDmg  += safeNum(sum.totDmg);
        });

        setText('jw-stat-total-gayi', `${totGayi} Pcs`);
        setText('jw-stat-total-aayi', `${totAayi} Pcs`);
        setText('jw-stat-total-damage', `${totDmg} Pcs`);

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Koi Calender Kariger nahi mila.</td></tr>';
            return;
        }

        let html = '';
        list.forEach((w) => {
            const act = getCalenderWorkerAbsentInfo(w.id);

            let statusBadge = '';
            if (act.daysAbsent >= 30) {
                statusBadge = `<span class="badge-red" style="font-size:11px;">⚠️ ${act.daysAbsent} Din se gayab</span>`;
            } else if (act.daysAbsent >= 15) {
                statusBadge = `<span style="background:#fff7ed; color:#ea580c; border:1px solid #fed7aa; padding:2px 6px; border-radius:20px; font-weight:700; font-size:11px;">🟠 ${act.daysAbsent} Din hue</span>`;
            } else {
                statusBadge = '<span class="badge-green" style="font-size:11px;">🟢 Active</span>';
            }

            const tagadaBtn = (act.daysAbsent >= 15)
                ? ` <button type="button" class="quick-btn btn-out" style="font-size:11px;" onclick="sendCalenderTagadaWhatsApp('${esc(w.id)}', ${act.daysAbsent})">📲 तगादा</button>`
                : '';

            html += `<tr>
                <td>${formatDisplay(w.date)}</td>
                <td><strong>${esc(w.name)}</strong></td>
                <td>${esc(w.address || '-')}</td>
                <td>${esc(w.mobile || '-')}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" onclick="openCalenderSheet('${esc(w.id)}')">📊 Khata Sheet</button>
                    ${tagadaBtn}
                    <button type="button" class="edit-btn" onclick="editCalenderWorker('${esc(w.id)}')">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteCalenderWorker('${esc(w.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    /* ========================================================================
       6. WORKER CRUD CONTROLLER
       ======================================================================== */
    const toggleCalenderWorkerForm = () => {
        if (typeof window.toggleJobWorkerForm === 'function') {
            window.toggleJobWorkerForm();
            return;
        }
        const f = document.getElementById('add-jw-worker-form');
        if (!f) return;
        f.style.display = (f.style.display !== 'block') ? 'block' : 'none';
    };

    const cancelCalenderWorkerEdit = () => {
        if (typeof window.cancelJobWorkerEdit === 'function') {
            window.cancelJobWorkerEdit();
            return;
        }
    };

    const saveCalenderWorker = () => {
        if (typeof window.saveNewJobWorker === 'function') {
            window.saveNewJobWorker();
            return;
        }
    };

    const editCalenderWorker = (id) => {
        if (typeof window.editJobWorker === 'function') {
            window.editJobWorker(id);
            return;
        }
    };

    const deleteCalenderWorker = (id) => {
        if (typeof window.deleteJobWorker === 'function') {
            window.deleteJobWorker(id);
            return;
        }
    };

    /* ========================================================================
       ⭐ OPEN CALENDER SHEET (SEAMLESSLY SYNCED WITH JOBWORK ENGINE)
       ======================================================================== */
    const openCalenderSheet = (id) => {
        // Sync both IDs taaki batch line bina rukawat save ho sake
        window.activeCalenderWorkerId = id;
        window.activeJobWorkerId = id;

        if (window.JobWorkEngine && typeof window.JobWorkEngine.openJobWorkerSheet === 'function') {
            window.JobWorkEngine.openJobWorkerSheet(id);
            return;
        }
        if (typeof window.openJobWorkerSheet === 'function') {
            window.openJobWorkerSheet(id);
            return;
        }

        const w = getCalenderWorkers().find((x) => String(x.id) === String(id));
        if (!w) return alert('Kariger nahi mila!');

        setDisplay('jw-workers-view', 'none');
        setDisplay('jw-sheet-view', 'block');

        const banner = document.getElementById('jw-sheet-banner-name');
        if (banner) banner.textContent = `${w.name} (Calender Finishing Khata)`;

        loadCurrentCalenderSheetData();
    };

    const loadCurrentCalenderSheetData = () => {
        if (window.JobWorkEngine && typeof window.JobWorkEngine.loadCurrentJobWorkSheet === 'function') {
            window.JobWorkEngine.loadCurrentJobWorkSheet();
            return;
        }
        if (typeof window.loadCurrentJobWorkSheet === 'function') {
            window.loadCurrentJobWorkSheet();
            return;
        }
    };

    const deleteCalenderRow = (rowId) => {
        if (typeof window.deleteJobWorkBatchRow === 'function') {
            window.deleteJobWorkBatchRow(rowId);
            return;
        }
    };

    const sendCalenderTagadaWhatsApp = (workerId, days) => {
        if (typeof window.sendJobWorkerTagadaWhatsApp === 'function') {
            window.sendJobWorkerTagadaWhatsApp(workerId, days);
            return;
        }
    };

    /* ========================================================================
       7. GLOBAL EXPORT
       ======================================================================== */
    const calenderUIAPI = {
        openCalenderModule,
        renderCalenderWorkersTable,
        toggleCalenderWorkerForm,
        cancelCalenderWorkerEdit,
        saveCalenderWorker,
        editCalenderWorker,
        deleteCalenderWorker,
        openCalenderSheet,
        loadCurrentCalenderSheetData,
        deleteCalenderRow,
        sendCalenderTagadaWhatsApp,
        getCalenderWorkers,
        getCalenderWorkerAbsentInfo,
        getCalenderWorkerOverallSummary,
        calculateCalenderSheetTotals
    };

    Object.keys(calenderUIAPI).forEach((fnName) => {
        window[fnName] = calenderUIAPI[fnName];
    });

    window.CalenderUIEngine = calenderUIAPI;

    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('jw-search-worker-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(workerSearchDebounceTimer);
                workerSearchDebounceTimer = setTimeout(() => {
                    renderCalenderWorkersTable();
                }, 200);
            });
        }
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = calenderUIAPI;
    }
})();
