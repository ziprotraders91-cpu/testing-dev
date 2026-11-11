/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE EMBROIDERY UI & SHEET ENGINE
   File: embroidery/embroidery-ui.js • Developed by Farhan Jawed
   Architecture: Lightweight Clean List (No Pagination) | Synced with JobWorkEngine
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & CONTEXT POOL
       ======================================================================== */
    window.activeEmbroideryWorkerId = null;
    window.activeEmbroiderySheetId = null;
    window.activeEmbroiderySheetIndex = 0;

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

    /* ========================================================================
       3. INTER-MODULE DATA BRIDGES
       ======================================================================== */
    const getEmbroideryWorkers = () => {
        if (typeof window.getJobWorkers === 'function') {
            return window.getJobWorkers().filter((w) => w && String(w.type || '').toLowerCase() === 'embroidery');
        }
        const all = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        return all.filter((w) => w && String(w.type || '').toLowerCase() === 'embroidery');
    };

    const getEmbroideryWorkerAbsentInfo = (workerId) => {
        if (typeof window.getJobWorkerLastActiveInfo === 'function') {
            return window.getJobWorkerLastActiveInfo(workerId);
        }
        return { lastDate: '-', daysAbsent: 0 };
    };

    const getEmbroideryWorkerOverallSummary = (workerId) => {
        if (typeof window.getJobWorkerOverallSummary === 'function') {
            return window.getJobWorkerOverallSummary(workerId);
        }
        return { totGayi: 0, totAayi: 0, totDmg: 0, pendingSaree: 0 };
    };

    const calculateEmbroiderySheetTotals = (sh) => {
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
        if (typeof window.invalidateEmbroideryCalcCache === 'function') {
            window.invalidateEmbroideryCalcCache();
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
    const openEmbroideryModule = () => {
        window.currentJobWorkMode = 'embroidery';

        if (typeof window.hideAllSections === 'function') window.hideAllSections();

        setDisplay('jobwork-section', 'block');
        setDisplay('jw-hub-view', 'none');
        setDisplay('jw-sheet-view', 'none');
        setDisplay('jw-dukan-view', 'none');
        setDisplay('jw-billing-view', 'none');
        setDisplay('jw-movement-view', 'none');
        setDisplay('jw-workers-view', 'block');

        const titleEl = document.getElementById('jw-workers-title');
        if (titleEl) titleEl.textContent = '🪡 Embroidery Workers List';

        const addBtnEl = document.getElementById('jw-add-worker-btn-text');
        if (addBtnEl) addBtnEl.textContent = '+ Naya Embroidery Kariger';

        renderEmbroideryWorkersTable();
    };

    /* ========================================================================
       5. WORKER TABLE RENDERER (CLEAN NO-PAGINATION LIST)
       ======================================================================== */
    const renderEmbroideryWorkersTable = () => {
        const tbody = document.getElementById('jw-workers-table-body');
        if (!tbody) return;

        let list = getEmbroideryWorkers();

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
            list = list.filter((w) => getEmbroideryWorkerAbsentInfo(w.id).daysAbsent >= minDays);
        }

        let totGayi = 0, totAayi = 0, totDmg = 0;
        const allEmb = getEmbroideryWorkers();
        allEmb.forEach((w) => {
            const sum = getEmbroideryWorkerOverallSummary(w.id);
            totGayi += safeNum(sum.totGayi);
            totAayi += safeNum(sum.totAayi);
            totDmg  += safeNum(sum.totDmg);
        });

        setText('jw-stat-total-gayi', `${totGayi} Pcs`);
        setText('jw-stat-total-aayi', `${totAayi} Pcs`);
        setText('jw-stat-total-damage', `${totDmg} Pcs`);

        // Pager remove karein taaki calender/cutting jaisa clean dikhe
        const existingPager = document.getElementById('calender-pagination-controls') || 
                              document.getElementById('cutting-pagination-controls') ||
                              document.getElementById('embroidery-pagination-controls');
        if (existingPager) existingPager.innerHTML = '';

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Koi Embroidery Kariger nahi mila.</td></tr>';
            return;
        }

        let html = '';
        list.forEach((w) => {
            const act = getEmbroideryWorkerAbsentInfo(w.id);
            let statusBadge = '';
            if (act.daysAbsent >= 30) {
                statusBadge = `<span class="badge-red" style="font-size:11px;">⚠️ ${act.daysAbsent} Din se gayab</span>`;
            } else if (act.daysAbsent >= 15) {
                statusBadge = `<span style="background:#fff7ed; color:#ea580c; border:1px solid #fed7aa; padding:2px 6px; border-radius:20px; font-weight:700; font-size:11px;">🟠 ${act.daysAbsent} Din hue</span>`;
            } else {
                statusBadge = '<span class="badge-green" style="font-size:11px;">🟢 Active</span>';
            }

            const tagadaBtn = (act.daysAbsent >= 15)
                ? ` <button type="button" class="quick-btn btn-out" style="font-size:11px;" onclick="sendEmbroideryTagadaWhatsApp('${esc(w.id)}', ${act.daysAbsent})">📲 तगादा</button>`
                : '';

            html += `<tr>
                <td>${formatDisplay(w.date)}</td>
                <td><strong>${esc(w.name)}</strong></td>
                <td>${esc(w.address || '-')}</td>
                <td>${esc(w.mobile || '-')}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" onclick="openEmbroiderySheet('${esc(w.id)}')">📊 Khata Sheet</button>
                    ${tagadaBtn}
                    <button type="button" class="edit-btn" onclick="editEmbroideryWorker('${esc(w.id)}')">✏️</button>
                    <button type="button" class="delete-btn" onclick="deleteEmbroideryWorker('${esc(w.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    /* ========================================================================
       6. WORKER CRUD CONTROLLER
       ======================================================================== */
    const toggleEmbroideryWorkerForm = () => {
        if (typeof window.toggleJobWorkerForm === 'function') {
            window.toggleJobWorkerForm();
            return;
        }
        const f = document.getElementById('add-jw-worker-form');
        if (!f) return;
        f.style.display = (f.style.display !== 'block') ? 'block' : 'none';
    };

    const cancelEmbroideryWorkerEdit = () => {
        if (typeof window.cancelJobWorkerEdit === 'function') {
            window.cancelJobWorkerEdit();
            return;
        }
    };

    const saveEmbroideryWorker = () => {
        if (typeof window.saveNewJobWorker === 'function') {
            window.saveNewJobWorker();
            return;
        }
    };

    const editEmbroideryWorker = (id) => {
        if (typeof window.editJobWorker === 'function') {
            window.editJobWorker(id);
            return;
        }
    };

    const deleteEmbroideryWorker = (id) => {
        if (typeof window.deleteJobWorker === 'function') {
            window.deleteJobWorker(id);
            return;
        }
    };

    /* ========================================================================
       7. OPEN EMBROIDERY SHEET
       ======================================================================== */
    const openEmbroiderySheet = (id) => {
        window.activeEmbroideryWorkerId = id;
        window.activeJobWorkerId = id;

        if (window.JobWorkEngine && typeof window.JobWorkEngine.openJobWorkerSheet === 'function') {
            window.JobWorkEngine.openJobWorkerSheet(id);
            return;
        }
        if (typeof window.openJobWorkerSheet === 'function') {
            window.openJobWorkerSheet(id);
            return;
        }

        const w = getEmbroideryWorkers().find((x) => String(x.id) === String(id));
        if (!w) return alert('Kariger nahi mila!');

        setDisplay('jw-workers-view', 'none');
        setDisplay('jw-sheet-view', 'block');

        const banner = document.getElementById('jw-sheet-banner-name');
        if (banner) banner.textContent = `${w.name} (Embroidery Khata)`;

        loadCurrentEmbroiderySheetData();
    };

    const loadCurrentEmbroiderySheetData = () => {
        if (window.JobWorkEngine && typeof window.JobWorkEngine.loadCurrentJobWorkSheet === 'function') {
            window.JobWorkEngine.loadCurrentJobWorkSheet();
            return;
        }
        if (typeof window.loadCurrentJobWorkSheet === 'function') {
            window.loadCurrentJobWorkSheet();
            return;
        }
    };

    const deleteEmbroideryRow = (rowId) => {
        if (typeof window.deleteJobWorkBatchRow === 'function') {
            window.deleteJobWorkBatchRow(rowId);
            return;
        }
    };

    const sendEmbroideryTagadaWhatsApp = (workerId, days) => {
        if (typeof window.sendJobWorkerTagadaWhatsApp === 'function') {
            window.sendJobWorkerTagadaWhatsApp(workerId, days);
            return;
        }
    };

    /* ========================================================================
       8. GLOBAL EXPORTS
       ======================================================================== */
    const embroideryUIAPI = {
        openEmbroideryModule,
        renderEmbroideryWorkersTable,
        toggleEmbroideryWorkerForm,
        cancelEmbroideryWorkerEdit,
        saveEmbroideryWorker,
        editEmbroideryWorker,
        deleteEmbroideryWorker,
        openEmbroiderySheet,
        loadCurrentEmbroiderySheetData,
        deleteEmbroideryRow,
        sendEmbroideryTagadaWhatsApp,
        getEmbroideryWorkers,
        getEmbroideryWorkerAbsentInfo,
        getEmbroideryWorkerOverallSummary,
        calculateEmbroiderySheetTotals
    };

    Object.keys(embroideryUIAPI).forEach((fnName) => {
        window[fnName] = embroideryUIAPI[fnName];
    });

    window.EmbroideryUIEngine = embroideryUIAPI;

    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('jw-search-worker-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(workerSearchDebounceTimer);
                workerSearchDebounceTimer = setTimeout(() => {
                    if (window.currentJobWorkMode === 'embroidery') {
                        renderEmbroideryWorkersTable();
                    }
                }, 200);
            });
        }
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = embroideryUIAPI;
    }
})();
