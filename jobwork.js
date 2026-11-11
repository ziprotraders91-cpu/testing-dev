/* ============================================================================
   SIMPLICITY ERP - HIGH-PERFORMANCE JOB WORK HUB, BATCH & BILLING ENGINE
   File: jobwork.js • Developed by Farhan Jawed (Item-Level Stock Source Locking)
   Processes: Cutting (Fresh) | Embroidery (Fresh/Cutting) | Calender (Fresh/Cutting/Embroidery) | Dukan
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. GLOBAL STATE & MEMOIZATION POOL
       ======================================================================== */
    window.currentJobWorkMode = 'hub';
    window.activeJobWorkerId = null;
    window.activeJobSheetId = null;
    window.currentDiyaBatch = [];
    window.currentAayiBatch = [];
    window.activeBatchModalInfo = null;
    window.currentJwBillTab = 'pending';
    window.currentJwMovementTab = 'cutting';

    const WORKER_SUMMARY_CACHE = new Map();
    const WORKER_ACTIVE_CACHE = new Map();
    const KARIGER_STOCK_CACHE = new Map();

    const invalidateJobWorkCache = (workerId) => {
        if (workerId) {
            WORKER_SUMMARY_CACHE.delete(String(workerId).trim());
            WORKER_ACTIVE_CACHE.delete(String(workerId).trim());
        } else {
            WORKER_SUMMARY_CACHE.clear();
            WORKER_ACTIVE_CACHE.clear();
        }
        KARIGER_STOCK_CACHE.clear();

        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }
        if (typeof window.invalidateCalenderCalcCache === 'function') {
            window.invalidateCalenderCalcCache();
        }
        if (typeof window.invalidateCuttingCalcCache === 'function') {
            window.invalidateCuttingCalcCache();
        }
    };

    /* ========================================================================
       2. SAFE DOM & DATA SANITIZATION UTILITIES
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
        } catch (e) {
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

    const setDisplay = (id, val) => {
        if (typeof window.setDisplay === 'function') {
            window.setDisplay(id, val);
        } else {
            const el = document.getElementById(id);
            if (el) el.style.display = val;
        }
    };

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null) ? val : '';
    };

    const getToday = () => {
        if (typeof window.getTodayDate === 'function') {
            return window.getTodayDate();
        }
        return new Date().toISOString().split('T')[0];
    };

    const formatDisplay = (d) => {
        if (typeof window.formatDateDisplay === 'function') {
            return window.formatDateDisplay(d);
        }
        return (d || '-');
    };

    /* ========================================================================
       3. NAVIGATION & HUB CONTROLLER
       ======================================================================== */
    const openJobWorkModule = () => {
        if (typeof window.hideAllSections === 'function') window.hideAllSections();
        setDisplay('jobwork-section', 'block');
        showJobWorkHub();
    };

    const showJobWorkHub = () => {
        window.currentJobWorkMode = 'hub';
        window.activeJobWorkerId = null;
        window.activeJobSheetId = null;

        setDisplay('jw-hub-view', 'block');
        setDisplay('jw-workers-view', 'none');
        setDisplay('jw-sheet-view', 'none');
        setDisplay('jw-dukan-view', 'none');
        setDisplay('jw-billing-view', 'none');
        setDisplay('jw-movement-view', 'none');

        updateJobWorkHubBadges();
    };

    const openJobWorkSubSection = (mode) => {
        window.currentJobWorkMode = mode;
        setDisplay('jw-hub-view', 'none');

        if (mode === 'cutting' || mode === 'embroidery' || mode === 'calender') {
            setDisplay('jw-sheet-view', 'none');
            setDisplay('jw-dukan-view', 'none');
            setDisplay('jw-billing-view', 'none');
            setDisplay('jw-movement-view', 'none');
            setDisplay('jw-workers-view', 'block');

            const titleEl = document.getElementById('jw-workers-title');
            const addBtnEl = document.getElementById('jw-add-worker-btn-text');

            if (mode === 'cutting') {
                if (titleEl) titleEl.textContent = '✂️ Booti Cutting Workers List';
                if (addBtnEl) addBtnEl.textContent = '+ Naya Cutting Kariger';
            } else if (mode === 'embroidery') {
                if (titleEl) titleEl.textContent = '🪡 Embroidery Workers List';
                if (addBtnEl) addBtnEl.textContent = '+ Naya Embroidery Kariger';
            } else {
                if (titleEl) titleEl.textContent = '🎛️ Calender Workers List';
                if (addBtnEl) addBtnEl.textContent = '+ Naya Calender Kariger';
            }

            renderJobWorkWorkersTable();
        } else if (mode === 'dukan') {
            setDisplay('jw-workers-view', 'none');
            setDisplay('jw-sheet-view', 'none');
            setDisplay('jw-billing-view', 'none');
            setDisplay('jw-movement-view', 'none');
            setDisplay('jw-dukan-view', 'block');

            if (typeof window.renderDukanTransferTable === 'function') {
                window.renderDukanTransferTable();
            }
        } else if (mode === 'billing') {
            setDisplay('jw-workers-view', 'none');
            setDisplay('jw-sheet-view', 'none');
            setDisplay('jw-dukan-view', 'none');
            setDisplay('jw-movement-view', 'none');
            setDisplay('jw-billing-view', 'block');

            initJobWorkBillingView();
        } else if (mode === 'movement') {
            setDisplay('jw-workers-view', 'none');
            setDisplay('jw-sheet-view', 'none');
            setDisplay('jw-dukan-view', 'none');
            setDisplay('jw-billing-view', 'none');
            setDisplay('jw-movement-view', 'block');

            setJwMovementToday();
        }
    };

    const updateJobWorkHubBadges = () => {
        const workers = getJobWorkers();
        const cutCount = workers.filter((w) => String(w?.type || '').toLowerCase() === 'cutting').length;
        const embCount = workers.filter((w) => String(w?.type || '').toLowerCase() === 'embroidery').length;
        const calCount = workers.filter((w) => String(w?.type || '').toLowerCase() === 'calender').length;

        setText('jw-hub-badge-cutting', `${cutCount} Kariger`);
        setText('jw-hub-badge-embroidery', `${embCount} Kariger`);
        setText('jw-hub-badge-calender', `${calCount} Kariger`);

        let totSent = 0;
        if (typeof window.getDukanTransfers === 'function') {
            window.getDukanTransfers().forEach((d) => {
                totSent += safeNum(d?.pcs);
            });
        }
        setText('jw-hub-badge-dukan', `${totSent} Pcs Bheje`);

        const billStats = getJwBillingStats();
        setText('jw-hub-badge-billing', `Baki: ₹ ${billStats.pending.toFixed(0)}`);
    };

    /* ========================================================================
       4. WORKER REGISTRY
       ======================================================================== */
    const getJobWorkers = () => toArray(getFromStore('jobwork_workers'));

    const saveJobWorkers = (list) => {
        setToStore('jobwork_workers', toArray(list));
        invalidateJobWorkCache();
    };

    const getJobWorkerLastActiveInfo = (workerId) => {
        if (!workerId) return { lastDate: '-', daysAbsent: 0 };
        const cleanId = String(workerId).trim();

        if (WORKER_ACTIVE_CACHE.has(cleanId)) {
            return WORKER_ACTIVE_CACHE.get(cleanId);
        }

        let latestDate = null;
        const sheets = getJobWorkerSheets(cleanId);

        if (sheets.length > 0) {
            const lastSheet = sheets[sheets.length - 1];
            const rows = toArray(lastSheet?.rows);
            for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i]?.date) {
                    latestDate = rows[i].date;
                    break;
                }
            }
        }

        const w = getJobWorkers().find((x) => String(x.id) === cleanId);
        if (!latestDate) latestDate = w?.date || null;

        if (!latestDate) {
            const res = { lastDate: '-', daysAbsent: 0 };
            WORKER_ACTIVE_CACHE.set(cleanId, res);
            return res;
        }

        const parseTimestamp = (d) => {
            const p = String(d).trim().split('-');
            if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
                return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
            }
            return new Date(`${d}T00:00:00`).getTime();
        };

        const todayTime = Date.now();
        const lastDateTime = parseTimestamp(latestDate);
        const diffDays = Math.max(0, Math.floor((todayTime - lastDateTime) / (1000 * 60 * 60 * 24)));

        const result = { lastDate: latestDate, daysAbsent: diffDays };
        WORKER_ACTIVE_CACHE.set(cleanId, result);
        return result;
    };

    const toggleJobWorkerForm = () => {
        const f = document.getElementById('add-jw-worker-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dEl = document.getElementById('jw-worker-date');
            if (dEl) dEl.value = getToday();
            cancelJobWorkerEdit();
        }
    };

    const cancelJobWorkerEdit = () => {
        const setV = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        setV('jw-worker-edit-id', '');
        setV('jw-worker-name', '');
        setV('jw-worker-address', '');
        setV('jw-worker-mobile', '');
        setV('jw-worker-date', getToday());

        const btn = document.getElementById('jw-worker-save-btn');
        if (btn) btn.textContent = 'Save Kariger';
        setDisplay('jw-worker-cancel-btn', 'none');
    };

    const saveNewJobWorker = () => {
        const editId = document.getElementById('jw-worker-edit-id')?.value || '';
        const d = document.getElementById('jw-worker-date')?.value || getToday();
        const n = String(document.getElementById('jw-worker-name')?.value || '').trim().toUpperCase();
        const addr = String(document.getElementById('jw-worker-address')?.value || '').trim();
        const m = String(document.getElementById('jw-worker-mobile')?.value || '').trim();

        if (!n) return alert('Kariger ka naam zaroori hai!');

        const list = [...getJobWorkers()];
        let targetId = editId;

        if (editId) {
            const it = list.find((x) => String(x.id) === String(editId));
            if (it) {
                it.name = n;
                it.address = addr;
                it.mobile = m;
                it.date = d;
            }
        } else {
            targetId = `jw_${Date.now()}`;
            list.push({
                id: targetId,
                type: window.currentJobWorkMode,
                date: d,
                name: n,
                address: addr,
                mobile: m
            });
        }

        saveJobWorkers(list);
        invalidateJobWorkCache(targetId);
        cancelJobWorkerEdit();
        setDisplay('add-jw-worker-form', 'none');
        renderJobWorkWorkersTable();
        updateJobWorkHubBadges();

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }
    };

    const editJobWorker = (workerId) => {
        const w = getJobWorkers().find((x) => String(x.id) === String(workerId));
        if (!w) return;

        setDisplay('add-jw-worker-form', 'block');

        const setV = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        setV('jw-worker-edit-id', w.id);
        setV('jw-worker-date', w.date || getToday());
        setV('jw-worker-name', w.name);
        setV('jw-worker-address', w.address || '');
        setV('jw-worker-mobile', w.mobile || '');

        const btn = document.getElementById('jw-worker-save-btn');
        if (btn) btn.textContent = 'Update Kariger';
        setDisplay('jw-worker-cancel-btn', 'inline-block');
    };

    const deleteJobWorker = (workerId) => {
        if (!confirm('Kya is Job Worker ko delete karna chahte hain?')) return;
        saveJobWorkers(getJobWorkers().filter((x) => String(x.id) !== String(workerId)));
        
        try {
            localStorage.removeItem(`jobwork_sheets_${workerId}`);
        } catch (e) {}

        invalidateJobWorkCache(workerId);
        renderJobWorkWorkersTable();
        updateJobWorkHubBadges();
        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }
    };

    const filterJobWorkWorkers = () => {
        renderJobWorkWorkersTable();
    };

    /* ========================================================================
       5. WORKER TABLE RENDERER
       ======================================================================== */
    const renderJobWorkWorkersTable = () => {
        const tbody = document.getElementById('jw-workers-table-body');
        if (!tbody) return;

        let filtered = getJobWorkers().filter((w) => w && String(w.type || '').toLowerCase() === String(window.currentJobWorkMode || '').toLowerCase());
        const searchInput = document.getElementById('jw-search-worker-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (txt) {
            filtered = filtered.filter((w) => 
                `${w.name || ''} ${w.address || ''} ${w.mobile || ''}`.toLowerCase().includes(txt)
            );
        }

        const absentFilterEl = document.getElementById('jw-absent-filter');
        const minDays = safeInt(absentFilterEl ? absentFilterEl.value : 0);
        if (minDays > 0) {
            filtered = filtered.filter((w) => getJobWorkerLastActiveInfo(w.id).daysAbsent >= minDays);
        }

        let totGayi = 0, totAayi = 0, totDmg = 0;
        const allTypeWorkers = getJobWorkers().filter((w) => w && String(w.type || '').toLowerCase() === String(window.currentJobWorkMode || '').toLowerCase());
        allTypeWorkers.forEach((w) => {
            const sum = getJobWorkerOverallSummary(w.id);
            totGayi += sum.totGayi;
            totAayi += sum.totAayi;
            totDmg += sum.totDmg;
        });

        setText('jw-stat-total-gayi', `${totGayi} Pcs`);
        setText('jw-stat-total-aayi', `${totAayi} Pcs`);
        setText('jw-stat-total-damage', `${totDmg} Pcs`);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Koi Kariger nahi mila.</td></tr>';
            return;
        }

        let html = '';
        filtered.forEach((w) => {
            const act = getJobWorkerLastActiveInfo(w.id);
            let statusBadge = '';
            if (act.daysAbsent >= 30) {
                statusBadge = `<span class="badge-red" style="font-size:11px;">⚠️ ${act.daysAbsent} Din se nahi aaye</span>`;
            } else if (act.daysAbsent >= 15) {
                statusBadge = `<span style="background:#fff7ed; color:#ea580c; border:1px solid #fed7aa; padding:3px 7px; border-radius:20px; font-weight:700; font-size:11px;">🟠 ${act.daysAbsent} Din hue</span>`;
            } else {
                statusBadge = '<span class="badge-green" style="font-size:11px;">🟢 Active</span>';
            }

            const tagadaBtn = (act.daysAbsent >= 15)
                ? ` <button type="button" class="quick-btn btn-out" style="background:#fee2e2; border-color:#fca5a5; font-size:11px;" onclick="JobWorkEngine.sendJobWorkerTagadaWhatsApp('${esc(w.id)}', ${act.daysAbsent})">📲 तगादा</button>`
                : '';

            html += `<tr>
                <td>${formatDisplay(w.date)}</td>
                <td><strong>${esc(w.name)}</strong></td>
                <td>${esc(w.address || '-')}</td>
                <td>${esc(w.mobile || '-')}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="sheet-btn" onclick="JobWorkEngine.openJobWorkerSheet('${esc(w.id)}')">📊 Sheet Khata</button> 
                    ${tagadaBtn} 
                    <button type="button" class="edit-btn" onclick="JobWorkEngine.editJobWorker('${esc(w.id)}')">✏️</button> 
                    <button type="button" class="delete-btn" onclick="JobWorkEngine.deleteJobWorker('${esc(w.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    const sendJobWorkerTagadaWhatsApp = (workerId, days) => {
        const w = getJobWorkers().find((x) => String(x.id) === String(workerId));
        if (!w) return;

        const sum = getJobWorkerOverallSummary(workerId);
        let typeTitle = 'कटिंग';
        if (w.type === 'calender') typeTitle = 'कैलेंडर';
        else if (w.type === 'embroidery') typeTitle = 'कढ़ाई / एम्ब्रॉयडरी';

        const msg = `🪡 *SIMPLICITY ERP*\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `सलाम ${w.name} भाई,\n\n` +
            `कारखाने से साड़ी (${typeTitle}) का काम ले जाए आपको *${days} दिन* हो चुके हैं।\n` +
            `📦 आपके पास बकाया साड़ी: *${sum.pendingSaree} Pcs*\n\n` +
            `कृपया जल्द से जल्द आकर तैयार साड़ी जमा करें।\n━━━━━━━━━━━━━━━━━━━━━\n_Simplicity ERP • by Farhan Jawed_`;

        let mob = String(w.mobile || '').trim().replace(/[^0-9]/g, '');
        if (mob.length === 11 && mob.startsWith('0')) mob = mob.substring(1);
        if (!mob || mob.length < 10) {
            mob = prompt(`${w.name} ka 10-digit WhatsApp number:`, mob);
            if (!mob) return;
            mob = mob.trim().replace(/[^0-9]/g, '');
            if (mob.length === 11 && mob.startsWith('0')) mob = mob.substring(1);
        }
        if (mob.length === 10) mob = `91${mob}`;

        window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       6. SHEET STORAGE & TOTALS ENGINE
       ======================================================================== */
    const getJobWorkerSheets = (workerId) => {
        if (!workerId) return [];
        const sheets = toArray(getFromStore(`jobwork_sheets_${workerId}`));
        sheets.forEach((sh) => {
            if (sh) sh.rows = toArray(sh.rows);
        });
        return sheets;
    };

    const saveJobWorkerSheets = (workerId, sheets) => {
        if (!workerId) return;
        const clean = toArray(sheets);
        clean.forEach((sh) => {
            if (sh) sh.rows = toArray(sh.rows);
        });

        setToStore(`jobwork_sheets_${workerId}`, clean);
        invalidateJobWorkCache(workerId);
    };

    const calculateJobWorkSheetTotals = (sh) => {
        const def = {
            closingPendingSaree: 0,
            closingBakiAmt: 0,
            totGayiQty: 0,
            totAayiQty: 0,
            totDamageAmt: 0,
            totDamagePcs: 0,
            pendingSaree: 0
        };

        if (!sh || typeof sh !== 'object') return def;

        const rows = toArray(sh.rows);
        let gayiQ = 0, aayiQ = 0, dmgAmt = 0, dmgPcs = 0;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r) continue;
            gayiQ  += safeNum(r.gayiQty);
            aayiQ  += safeNum(r.aayiQty);
            dmgAmt += safeNum(r.damageAmt);
            dmgPcs += safeNum(r.damagePcs);
        }

        const pichliSaree = safeNum(sh.closingPendingSaree);
        return {
            closingPendingSaree: pichliSaree,
            closingBakiAmt: safeNum(sh.closingBakiAmt),
            totGayiQty: gayiQ,
            totAayiQty: aayiQ,
            totDamageAmt: dmgAmt,
            totDamagePcs: dmgPcs,
            pendingSaree: Math.max(0, (pichliSaree + gayiQ) - (aayiQ + dmgPcs))
        };
    };

    const getJobWorkerOverallSummary = (workerId) => {
        if (!workerId) return { totGayi: 0, totAayi: 0, totDmg: 0, pendingSaree: 0 };
        const cleanId = String(workerId).trim();

        if (WORKER_SUMMARY_CACHE.has(cleanId)) {
            return WORKER_SUMMARY_CACHE.get(cleanId);
        }

        const sheets = getJobWorkerSheets(cleanId);
        if (!sheets.length) {
            const empty = { totGayi: 0, totAayi: 0, totDmg: 0, pendingSaree: 0 };
            WORKER_SUMMARY_CACHE.set(cleanId, empty);
            return empty;
        }

        let gTot = 0, aTot = 0, dTot = 0;
        sheets.forEach((sh) => {
            const c = calculateJobWorkSheetTotals(sh);
            gTot += c.totGayiQty;
            aTot += c.totAayiQty;
            dTot += c.totDamagePcs;
        });

        const lastSheetCalc = calculateJobWorkSheetTotals(sheets[sheets.length - 1]);
        const summary = {
            totGayi: gTot,
            totAayi: aTot,
            totDmg: dTot,
            pendingSaree: lastSheetCalc.pendingSaree
        };

        WORKER_SUMMARY_CACHE.set(cleanId, summary);
        return summary;
    };

    /* ========================================================================
       7. LIVE KARIGER SAREE STOCK CHECKER (FRESH | CUTTING | EMBROIDERY)
       ======================================================================== */
    const getKarigerAvailableSareeStock = (karigerName) => {
        const kName = String(karigerName || '').trim().toUpperCase();
        if (!kName) return { fresh: 0, cutting: 0, embroidery: 0, total: 0 };

        if (KARIGER_STOCK_CACHE.has(kName)) {
            return KARIGER_STOCK_CACHE.get(kName);
        }

        const sH = toArray(getFromStore('saree_history'));
        let fAai = 0, fGai = 0, cAai = 0, cGai = 0, eAai = 0, eGai = 0;

        for (let i = 0; i < sH.length; i++) {
            const r = sH[i];
            if (!r) continue;
            const rk = String(r.karigerName || r.kariger || '').trim().toUpperCase();
            if (rk === kName) {
                const t = String(r.type || 'fresh').toLowerCase();
                const isGai = (r.isOut === true) || (safeNum(r.gai) > 0);
                const a = isGai ? 0 : safeNum(r.aai !== undefined && r.aai !== null ? r.aai : r.pcs);
                const g = isGai ? safeNum(r.gai !== undefined && r.gai !== null ? r.gai : r.pcs) : 0;

                if (t === 'fresh') {
                    fAai += a;
                    fGai += g;
                } else if (t === 'cutting' || t === 'cut') {
                    cAai += a;
                    cGai += g;
                } else if (t === 'embroidery' || t === 'emb') {
                    eAai += a;
                    eGai += g;
                }
            }
        }

        const fBacha = Math.max(0, fAai - fGai);
        const cBacha = Math.max(0, cAai - cGai);
        const eBacha = Math.max(0, eAai - eGai);
        const stock = { 
            fresh: fBacha, 
            cutting: cBacha, 
            embroidery: eBacha, 
            total: fBacha + cBacha + eBacha 
        };

        KARIGER_STOCK_CACHE.set(kName, stock);
        return stock;
    };

    const updateJwKarigerLiveStockBadge = () => {
        const kInp = document.getElementById('jw-diya-karigar');
        if (!kInp) return;

        const kName = String(kInp.value || '').trim().toUpperCase();
        let badge = document.getElementById('jw-kariger-live-stock-badge');

        if (!badge && kInp.parentNode) {
            badge = document.createElement('div');
            badge.id = 'jw-kariger-live-stock-badge';
            badge.style.cssText = 'margin-top:6px; font-size:12px; font-weight:700; border-radius:6px; padding:6px 10px; display:none;';
            kInp.parentNode.insertBefore(badge, kInp.nextSibling);
        }

        if (!badge) return;

        if (!kName) {
            badge.style.display = 'none';
            return;
        }

        const stock = getKarigerAvailableSareeStock(kName);
        const worker = getJobWorkers().find((x) => String(x.id) === String(window.activeJobWorkerId));
        const wType = String(worker?.type || '').toLowerCase();

        badge.style.display = 'block';
        badge.style.background = '#f0fdf4';
        badge.style.border = '1px solid #86efac';
        badge.style.color = '#166534';

        const sourceSelectEl = document.getElementById('jw-batch-source-select');
        const curSource = sourceSelectEl ? sourceSelectEl.value : (wType === 'cutting' ? 'fresh' : 'cutting');

        let stockHtml = `🧵 <strong>${esc(kName)} Stock:</strong> <span style="color:#0284c7; margin-left:4px;">Fresh: <b>${stock.fresh}</b></span> | <span style="color:#0d9488;">Cutting: <b>${stock.cutting}</b></span> | <span style="color:#d97706;">Embroidery: <b>${stock.embroidery}</b></span>`;

        let selStock = stock.fresh;
        if (curSource === 'cutting') selStock = stock.cutting;
        else if (curSource === 'embroidery') selStock = stock.embroidery;

        stockHtml += `<br><small style="color:#475569;">👉 Saree <b>${curSource.toUpperCase()} STOCK</b> se jayegi (Available: <b>${selStock} Pcs</b>)</small>`;
        if (selStock <= 0) {
            badge.style.background = '#fff1f2';
            badge.style.border = '1px solid #fecdd3';
            badge.style.color = '#9f1239';
        }

        badge.innerHTML = stockHtml;
    };

    /* ========================================================================
       8. SHEET VIEW & TABS CONTROLLER (WITH PERMANENT ROCK-SOLID SELECTOR)
       ======================================================================== */
    const openJobWorkerSheet = (workerId) => {
        const w = getJobWorkers().find((x) => String(x.id) === String(workerId));
        if (!w) return alert('Kariger nahi mila!');

        window.activeJobWorkerId = w.id;
        window.activeCuttingWorkerId = w.id;
        window.activeCalenderWorkerId = w.id;

        let typeTitle = 'Booti Cutting';
        if (w.type === 'calender') typeTitle = 'Calender';
        else if (w.type === 'embroidery') typeTitle = 'Embroidery';

        let sess = '2026-2027';
        if (typeof window.getActiveFinancialSession === 'function') {
            sess = window.getActiveFinancialSession();
        }

        const bannerEl = document.getElementById('jw-sheet-banner-name');
        if (bannerEl) bannerEl.textContent = `${w.name} (${typeTitle} • ${sess} Khata)`;

        const dToday = getToday();
        const dDiyaEl = document.getElementById('jw-form-diya-date');
        const dAayiEl = document.getElementById('jw-form-aayi-date');
        if (dDiyaEl) dDiyaEl.value = dToday;
        if (dAayiEl) dAayiEl.value = dToday;

        window.currentDiyaBatch = [];
        window.currentAayiBatch = [];
        renderDiyaBatchChips();
        renderAayiBatchChips();
        populateKarigersDatalist();

        // ⭐ DROP-DOWN CONTAINER INJECTION RIGHT INSIDE 1. SAREE GAYI BOX
        let stockSelectWrap = document.getElementById('jw-calender-stock-source-wrap');
        const kInp = document.getElementById('jw-diya-karigar');

        if (!stockSelectWrap && kInp) {
            stockSelectWrap = document.createElement('div');
            stockSelectWrap.id = 'jw-calender-stock-source-wrap';
            const rowContainer = kInp.parentElement;
            if (rowContainer && rowContainer.parentNode) {
                rowContainer.parentNode.insertBefore(stockSelectWrap, rowContainer);
            }
        }

        const cuttingNotice = document.getElementById('jw-cutting-notice');

        if (stockSelectWrap) {
            stockSelectWrap.style.cssText = 'margin:8px 0 12px 0; padding:10px 14px; background:#f8fafc; border:1.5px solid #0284c7; border-radius:8px; display:flex; align-items:center; flex-wrap:wrap; gap:12px; font-size:13px;';

            if (w.type === 'calender') {
                stockSelectWrap.style.display = 'flex';
                stockSelectWrap.innerHTML = `
                    <label for="jw-batch-source-select" style="font-weight:800; color:#0369a1;">📦 Saree Kahan Se Bhej Rahe Hain?</label>
                    <select id="jw-batch-source-select" onchange="JobWorkEngine.updateJwKarigerLiveStockBadge()" style="padding:6px 12px; font-weight:bold; font-size:13px; border-radius:6px; border:2px solid #0284c7; background:#ffffff; color:#0f172a; cursor:pointer;">
                        <option value="cutting" selected>✂️ Cutting Stock Se</option>
                        <option value="embroidery">🪡 Embroidery Stock Se</option>
                        <option value="fresh">🥻 Fresh Godown Stock Se</option>
                    </select>
                `;
                if (cuttingNotice) cuttingNotice.style.display = 'none';
            } else if (w.type === 'embroidery') {
                stockSelectWrap.style.display = 'flex';
                stockSelectWrap.innerHTML = `
                    <label for="jw-batch-source-select" style="font-weight:800; color:#0369a1;">📦 Saree Kahan Se Bhej Rahe Hain?</label>
                    <select id="jw-batch-source-select" onchange="JobWorkEngine.updateJwKarigerLiveStockBadge()" style="padding:6px 12px; font-weight:bold; font-size:13px; border-radius:6px; border:2px solid #0284c7; background:#ffffff; color:#0f172a; cursor:pointer;">
                        <option value="cutting" selected>✂️ Cutting Stock Se</option>
                        <option value="fresh">🥻 Fresh Godown Stock Se</option>
                    </select>
                `;
                if (cuttingNotice) cuttingNotice.style.display = 'none';
            } else {
                stockSelectWrap.style.display = 'none';
                if (cuttingNotice) cuttingNotice.style.display = 'block';
            }
        }

        if (kInp) {
            kInp.oninput = updateJwKarigerLiveStockBadge;
            kInp.onchange = updateJwKarigerLiveStockBadge;
        }
        updateJwKarigerLiveStockBadge();

        setDisplay('jw-workers-view', 'none');
        setDisplay('jw-sheet-view', 'block');

        let sheets = getJobWorkerSheets(window.activeJobWorkerId);
        if (!sheets || !sheets.length) {
            sheets = [{
                id: `jw_sh_${Date.now()}`,
                title: `Month 1 (${dToday.substring(0, 7)})`,
                closingPendingSaree: 0,
                closingBakiAmt: 0,
                rows: []
            }];
            saveJobWorkerSheets(window.activeJobWorkerId, sheets);
        }

        window.activeJobSheetId = sheets[sheets.length - 1].id;
        renderJobWorkSheetTabs();
        loadCurrentJobWorkSheet();
    };

    const closeJobWorkerSheet = () => {
        window.activeJobWorkerId = null;
        window.activeJobSheetId = null;
        window.currentDiyaBatch = [];
        window.currentAayiBatch = [];

        setDisplay('jw-sheet-view', 'none');
        setDisplay('jw-workers-view', 'block');
        renderJobWorkWorkersTable();
        updateJobWorkHubBadges();
    };

    const renderJobWorkSheetTabs = () => {
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const box = document.getElementById('jw-month-tabs-container');
        if (!box) return;

        box.innerHTML = '';
        sheets.forEach((sh) => {
            if (!sh) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `sheet-tab ${String(sh.id) === String(window.activeJobSheetId) ? 'active' : ''}`;
            btn.innerHTML = `${esc(sh.title)}${sheets.length > 1 ? `<span class="del-tab-btn" onclick="JobWorkEngine.deleteJobWorkerMonthlySheet('${esc(sh.id)}', event)"> ×</span>` : ''}`;
            btn.onclick = () => switchJobWorkerSheetTab(sh.id);
            box.appendChild(btn);
        });
    };

    const switchJobWorkerSheetTab = (id) => {
        window.activeJobSheetId = id;
        renderJobWorkSheetTabs();
        loadCurrentJobWorkSheet();
    };

    const addNewJobWorkerMonthlySheet = () => {
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const cur = sheets.find((s) => s && String(s.id) === String(window.activeJobSheetId)) || sheets[sheets.length - 1];
        const calc = cur ? calculateJobWorkSheetTotals(cur) : { pendingSaree: 0 };

        const newS = {
            id: `jw_sh_${Date.now()}`,
            title: `Month ${sheets.length + 1} (${getToday().substring(0, 7)})`,
            closingPendingSaree: calc.pendingSaree,
            closingBakiAmt: 0,
            rows: []
        };

        sheets.push(newS);
        saveJobWorkerSheets(window.activeJobWorkerId, sheets);
        window.activeJobSheetId = newS.id;
        renderJobWorkSheetTabs();
        loadCurrentJobWorkSheet();
        alert('✅ Naya Mahina jud gaya! Pichla hisab carry-forward ho gaya.');
    };

    const deleteJobWorkerMonthlySheet = (sheetId, e) => {
        if (e) e.stopPropagation();
        let sheets = getJobWorkerSheets(window.activeJobWorkerId);
        if (sheets.length <= 1) return alert('Pehli sheet delete nahi ho sakti!');
        if (!confirm('Kya is Mahine ki Sheet ko delete karna chahte hain?')) return;

        sheets = sheets.filter((s) => s && String(s.id) !== String(sheetId));
        saveJobWorkerSheets(window.activeJobWorkerId, sheets);
        window.activeJobSheetId = sheets[0].id;
        renderJobWorkSheetTabs();
        loadCurrentJobWorkSheet();
    };

    const loadCurrentJobWorkSheet = () => {
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const sh = sheets.find((s) => s && String(s.id) === String(window.activeJobSheetId)) || sheets[0];
        if (!sh) return;

        window.activeJobSheetId = sh.id;
        setText('jw-sheet-active-badge', sh.title);

        const elPichliSaree = document.getElementById('jw-top-pichli-saree');
        if (elPichliSaree) elPichliSaree.value = sh.closingPendingSaree || 0;

        renderJobWorkSheetTable(sh);
    };

    const saveJobWorkSheetConfig = () => {
        if (!window.activeJobWorkerId) return;
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const sh = sheets.find((s) => s && String(s.id) === String(window.activeJobSheetId));
        if (!sh) return;

        sh.closingPendingSaree = safeInt(document.getElementById('jw-top-pichli-saree')?.value);
        saveJobWorkerSheets(window.activeJobWorkerId, sheets);
        renderJobWorkSheetTable(sh);
    };

    const populateKarigersDatalist = () => {
        const dl = document.getElementById('dl-karigers-list');
        if (!dl) return;

        dl.innerHTML = '';
        const list = toArray(getFromStore('kariger_list'));
        list.forEach((k) => {
            if (k?.name) {
                const opt = document.createElement('option');
                opt.value = k.name;
                dl.appendChild(opt);
            }
        });
    };

    /* ========================================================================
       9. BATCH DIALOG & CHIP BUILDERS (WITH ITEM-LEVEL SOURCE LOCK)
       ======================================================================== */
    const addDiyaBatchKarigarItem = () => {
        const kInp = document.getElementById('jw-diya-karigar');
        const qInp = document.getElementById('jw-diya-qty');

        const kName = String(kInp?.value || '').trim().toUpperCase();
        const qty = safeInt(qInp?.value);

        if (!kName || qty <= 0) return alert('Karigar aur Saree QTY bharein!');

        const worker = getJobWorkers().find((x) => String(x.id) === String(window.activeJobWorkerId));
        const wType = String(worker?.type || '').toLowerCase();

        // ⭐ CURRENT SELECTED SOURCE IS LOCKED DIRECTLY ONTO THIS CHIP ITEM
        const selEl = document.getElementById('jw-batch-source-select');
        let itemSource = 'fresh';
        if (wType === 'calender') {
            itemSource = selEl ? selEl.value : 'cutting';
        } else if (wType === 'embroidery') {
            itemSource = selEl ? selEl.value : 'cutting';
        } else {
            itemSource = 'fresh';
        }

        window.currentDiyaBatch.push({
            id: `d_item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            karigar: kName,
            qty: qty,
            source: itemSource // ⭐ Saved right with the chip
        });

        if (kInp) kInp.value = '';
        if (qInp) qInp.value = '';
        if (kInp) kInp.focus();

        renderDiyaBatchChips();
        updateJwKarigerLiveStockBadge();
    };

    const removeDiyaBatchItem = (idx) => {
        window.currentDiyaBatch.splice(idx, 1);
        renderDiyaBatchChips();
        updateJwKarigerLiveStockBadge();
    };

    const renderDiyaBatchChips = () => {
        const wrap = document.getElementById('jw-diya-batch-chips');
        const totText = document.getElementById('jw-diya-batch-total-text');
        if (!wrap) return;

        let html = '';
        let tot = 0;

        window.currentDiyaBatch.forEach((item, idx) => {
            tot += item.qty;
            const srcBadge = item.source ? `<small style="background:#0284c7; color:#ffffff; padding:1px 5px; border-radius:4px; margin-left:3px;">${item.source.toUpperCase()}</small>` : '';

            html += `<span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:3px 8px; border-radius:14px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:4px; margin:2px;">
                ${esc(item.karigar)}: ${item.qty} Pcs${srcBadge} 
                <span style="cursor:pointer; color:#ef4444; margin-left:2px;" onclick="JobWorkEngine.removeDiyaBatchItem(${idx})">✕</span>
            </span>`;
        });

        wrap.innerHTML = html;
        if (totText) {
            totText.textContent = window.currentDiyaBatch.length ? `👉 Gayi Saree Batch Total: ${tot} Pcs` : '';
        }
    };

    const addAayiBatchKarigarItem = () => {
        const kInp = document.getElementById('jw-aayi-karigar');
        const qInp = document.getElementById('jw-aayi-qty');
        const naapInp = document.getElementById('jw-aayi-naap');

        const kName = String(kInp?.value || '').trim().toUpperCase();
        const qty = safeInt(qInp?.value);
        const naap = naapInp ? String(naapInp.value || '').trim() : '';

        if (!kName || qty <= 0) return alert('Karigar aur Saree QTY bharein!');

        window.currentAayiBatch.push({
            id: `a_item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            karigar: kName,
            qty,
            naap: naap || '3.60'
        });

        if (kInp) kInp.value = '';
        if (qInp) qInp.value = '';
        if (kInp) kInp.focus();

        renderAayiBatchChips();
    };

    const removeAayiBatchItem = (idx) => {
        window.currentAayiBatch.splice(idx, 1);
        renderAayiBatchChips();
    };

    const renderAayiBatchChips = () => {
        const wrap = document.getElementById('jw-aayi-batch-chips');
        const totText = document.getElementById('jw-aayi-batch-total-text');
        if (!wrap) return;

        let html = '';
        let tot = 0;

        window.currentAayiBatch.forEach((item, idx) => {
            tot += item.qty;
            const naapText = item.naap ? ` (Naap: ${esc(item.naap)})` : '';
            html += `<span style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:3px 8px; border-radius:14px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:4px; margin:2px;">
                ${esc(item.karigar)}: ${item.qty} Pcs${naapText}
                <span style="cursor:pointer; color:#dc2626;" onclick="JobWorkEngine.removeAayiBatchItem(${idx})">✕</span>
            </span>`;
        });

        wrap.innerHTML = html;
        if (totText) {
            totText.textContent = window.currentAayiBatch.length ? `👉 Wapas Aayi Batch Total: ${tot} Pcs` : '';
        }
    };

    /* ========================================================================
       10. ATOMIC BATCH DISPATCHER & STOCK RECONCILIATION ENGINE
       ======================================================================== */
    const saveJobWorkBatchLine = () => {
        if (!window.activeJobWorkerId) return;
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const sh = sheets.find((s) => s && String(s.id) === String(window.activeJobSheetId));
        if (!sh) return;

        const worker = getJobWorkers().find((x) => String(x.id) === String(window.activeJobWorkerId));
        const workerName = worker ? worker.name : 'Worker';
        const wType = String(worker?.type || '').toLowerCase();

        let totGayi = 0;
        window.currentDiyaBatch.forEach((x) => { totGayi += safeInt(x.qty); });
        let totAayi = 0;
        window.currentAayiBatch.forEach((x) => { totAayi += safeInt(x.qty); });

        const damagePcs = safeInt(document.getElementById('jw-form-damage-pcs')?.value);
        const damageAmt = safeNum(document.getElementById('jw-form-damage-amt')?.value);

        if (totGayi === 0 && totAayi === 0 && damagePcs === 0) {
            return alert('Jane ya Aane wali saree ke karigar [+] jodein!');
        }

        const batchRowId = `jwb_${Date.now()}`;
        const dDate = document.getElementById('jw-form-diya-date')?.value || getToday();
        const aDate = document.getElementById('jw-form-aayi-date')?.value || getToday();

        const allKars = toArray(getFromStore('kariger_list'));
        let sH = [...toArray(getFromStore('saree_history'))];

        let processLabel = 'Cutting';
        if (wType === 'calender') processLabel = 'Calender';
        else if (wType === 'embroidery') processLabel = 'Embroidery';
        const targetLabel = `${workerName} (${processLabel})`;

        const resolveKarigerMeta = (wKarName) => {
            for (let i = sH.length - 1; i >= 0; i--) {
                const h = sH[i];
                if (h && String(h.karigerName || h.kariger || '').trim().toUpperCase() === wKarName) {
                    if (h.sareeName) {
                        return { saree: String(h.sareeName).trim().toUpperCase(), godown: h.karkhanaId || 'k_main' };
                    }
                }
            }
            const foundKar = allKars.find((k) => k?.name && k.name.trim().toUpperCase() === wKarName);
            return {
                saree: String(foundKar?.saree || 'GENERAL SAREE').trim().toUpperCase(),
                godown: foundKar?.karkhanaId || 'k_main'
            };
        };

        // 1. SAREE GAYI (Outward Entry) ➔ Deducts strictly from each item's OWN locked source
        if (totGayi > 0) {
            window.currentDiyaBatch.forEach((item, itemIdx) => {
                const wKarName = String(item.karigar || 'General').trim().toUpperCase();
                const meta = resolveKarigerMeta(wKarName);
                const itemSource = item.source || (wType === 'cutting' ? 'fresh' : 'cutting');

                sH.push({
                    id: `sh_diya_${Date.now()}_${itemIdx}_${Math.floor(Math.random() * 1000)}`,
                    refId: batchRowId,
                    date: dDate,
                    sareeName: meta.saree,
                    karigerName: wKarName,
                    kariger: wKarName,
                    partyName: targetLabel,
                    targetWorker: targetLabel,
                    karkhanaId: meta.godown,
                    type: itemSource, // ⭐ Cuts from chosen stock: 'fresh' | 'cutting' | 'embroidery'
                    typeLabel: `📤 ${targetLabel} ko bheja [${itemSource.toUpperCase()} Stock]`,
                    aai: 0,
                    gai: safeNum(item.qty),
                    isOut: true,
                    note: `${targetLabel} ko bheja (${itemSource})`,
                    timestamp: Date.now() + itemIdx
                });
            });
        }

        // 2. SAREE AAYI (Inward Entry) ➔ Routes into next stage
        if (totAayi > 0) {
            window.currentAayiBatch.forEach((item, itemIdx) => {
                const wKarName = String(item.karigar || 'General').trim().toUpperCase();
                const meta = resolveKarigerMeta(wKarName);

                let destTab = 'cutting';
                let icon = '✂️';
                if (wType === 'calender') {
                    destTab = 'finished'; // Calender -> Finished
                    icon = '✨';
                } else if (wType === 'embroidery') {
                    destTab = 'embroidery'; // Embroidery -> Embroidery
                    icon = '🪡';
                }

                sH.push({
                    id: `sh_aayi_${Date.now()}_${itemIdx}_${Math.floor(Math.random() * 1000)}`,
                    refId: batchRowId,
                    date: aDate,
                    sareeName: meta.saree,
                    karigerName: wKarName,
                    kariger: wKarName,
                    partyName: targetLabel,
                    targetWorker: targetLabel,
                    karkhanaId: meta.godown,
                    type: destTab,
                    typeLabel: `${icon} ${targetLabel} se Tayyar Aayi${item.naap ? ` [Naap: ${item.naap}]` : ''}`,
                    aai: safeNum(item.qty),
                    gai: 0,
                    isOut: false,
                    note: `${targetLabel} se tayyar aayi${item.naap ? ` (Naap: ${item.naap})` : ''}`,
                    naap: item.naap || '',
                    timestamp: Date.now() + 100 + itemIdx
                });
            });
        }

        // 3. DAMAGE SAREE (Lott Entry)
        if (damagePcs > 0) {
            sH.push({
                id: `sh_dmg_${Date.now()}`,
                refId: batchRowId,
                date: getToday(),
                sareeName: 'Damage Saree',
                karigerName: workerName,
                kariger: workerName,
                partyName: targetLabel,
                targetWorker: targetLabel,
                karkhanaId: 'k_main',
                type: 'lott',
                typeLabel: `⚠️ ${targetLabel} se Damage Aayi (Fine: ₹${damageAmt})`,
                aai: damagePcs,
                gai: 0,
                isOut: false,
                note: `Damage Fine: ₹${damageAmt}`,
                timestamp: Date.now() + 200
            });
        }

        setToStore('saree_history', sH);

        sh.rows = toArray(sh.rows);
        sh.rows.push({
            id: batchRowId,
            date: (totGayi > 0) ? dDate : aDate,
            gayiQty: totGayi,
            gayiItems: [...window.currentDiyaBatch],
            aayiQty: totAayi,
            aayiItems: [...window.currentAayiBatch],
            damagePcs,
            damageAmt
        });

        saveJobWorkerSheets(window.activeJobWorkerId, sheets);

        window.currentDiyaBatch = [];
        window.currentAayiBatch = [];
        renderDiyaBatchChips();
        renderAayiBatchChips();
        updateJwKarigerLiveStockBadge();

        const dmgPcsEl = document.getElementById('jw-form-damage-pcs');
        const dmgAmtEl = document.getElementById('jw-form-damage-amt');
        if (dmgPcsEl) dmgPcsEl.value = '';
        if (dmgAmtEl) dmgAmtEl.value = '';

        invalidateJobWorkCache(window.activeJobWorkerId);
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }

        renderJobWorkSheetTable(sh);
        updateJobWorkHubBadges();

        if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        alert(`✅ Batch Entry Save ho gayi!\n• Gayi: -${totGayi} Pcs\n• Aayi: +${totAayi} Pcs (${processLabel})`);
    };

    const renderJobWorkSheetTable = (sh) => {
        const tbody = document.getElementById('jw-sheet-rows-body');
        if (!tbody) return;

        const rows = toArray(sh?.rows);

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:15px; color:#888;">Is Mahine me abhi koi entry nahi hui hai.</td></tr>';
        } else {
            let html = '';
            rows.forEach((r, idx) => {
                if (!r) return;
                const gayiBtn = (r.gayiQty > 0)
                    ? `<button type="button" class="detail-btn" style="background:#e11d48; font-size:11px;" onclick="JobWorkEngine.openJwBatchModal('${esc(sh.id)}', '${esc(r.id)}', 'gayi')">📖 ${r.gayiItems ? r.gayiItems.length : 1} Kariger</button>`
                    : '-';

                const aayiBtn = (r.aayiQty > 0)
                    ? `<button type="button" class="detail-btn" style="background:#059669; font-size:11px;" onclick="JobWorkEngine.openJwBatchModal('${esc(sh.id)}', '${esc(r.id)}', 'aayi')">📖 ${r.aayiItems ? r.aayiItems.length : 1} Kariger</button>`
                    : '-';

                html += `<tr>
                    <td>${formatDisplay(r.date)}</td>
                    <td>${r.gayiQty > 0 ? `<strong style="color:#dc2626;">-${r.gayiQty} Pcs</strong>` : '-'}</td>
                    <td>${gayiBtn}</td>
                    <td>${r.aayiQty > 0 ? `<strong style="color:#059669;">+${r.aayiQty} Pcs</strong>` : '-'}</td>
                    <td>${aayiBtn}</td>
                    <td>${r.damagePcs > 0 ? `<strong style="color:#ea580c;">⚠️ ${r.damagePcs} Pcs</strong>` : '-'}</td>
                    <td>${r.damageAmt > 0 ? `₹ ${r.damageAmt}` : '-'}</td>
                    <td style="text-align:center;"><button type="button" class="delete-btn" onclick="JobWorkEngine.deleteJobWorkBatchRow(${idx})">🗑️ Delete</button></td>
                </tr>`;
            });

            tbody.innerHTML = html;
        }

        const c = calculateJobWorkSheetTotals(sh);
        setText('jw-card-total-gayi', `${c.totGayiQty} Pcs`);
        setText('jw-card-total-aayi', `${c.totAayiQty} Pcs`);
        setText('jw-card-total-lott', `${c.totDamagePcs} Pcs`);
        setText('jw-calc-baki-saree-display', `${c.pendingSaree} Pcs Baki`);
    };

    const deleteJobWorkBatchRow = (idx) => {
        if (!confirm('Kya is poori Batch Line ko delete karna chahte hain? Saree stock theek ho jayega.')) return;
        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const sh = sheets.find((s) => s && String(s.id) === String(window.activeJobSheetId));
        if (!sh) return;

        const r = toArray(sh.rows)[idx];
        if (!r) return;

        if (r.id) {
            let sH = toArray(getFromStore('saree_history')).filter((h) => !h || String(h.refId) !== String(r.id));
            setToStore('saree_history', sH);
        }

        sh.rows.splice(idx, 1);
        saveJobWorkerSheets(window.activeJobWorkerId, sheets);

        invalidateJobWorkCache(window.activeJobWorkerId);
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }

        renderJobWorkSheetTable(sh);
        updateJobWorkHubBadges();

        if (typeof window.renderSareeTable === 'function') window.renderSareeTable();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();

        alert('🗑️ Line delete ho gayi aur Stock theek ho gaya!');
    };

    /* ========================================================================
       11. BATCH BREAKDOWN MODAL
       ======================================================================== */
    const openJwBatchModal = (sheetId, rowId, type) => {
        window.activeBatchModalInfo = { sheetId, rowId, type };
        const sh = getJobWorkerSheets(window.activeJobWorkerId).find((s) => s && String(s.id) === String(sheetId));
        const r = sh ? toArray(sh.rows).find((x) => x && String(x.id) === String(rowId)) : null;
        if (!r) return;

        setText('jw-batch-modal-title', (type === 'gayi') ? '📤 Gayi Saree Batch Breakdown' : '📥 Wapas Aayi Batch Breakdown');
        setText('jw-batch-modal-subtitle', `Tarikh: ${formatDisplay(r.date)} | Kul Pcs: ${type === 'gayi' ? r.gayiQty : r.aayiQty}`);

        renderJwBatchModalTable();
        setDisplay('jw-batch-modal', 'flex');
    };

    const closeJwBatchModal = () => {
        setDisplay('jw-batch-modal', 'none');
        window.activeBatchModalInfo = null;
    };

    const renderJwBatchModalTable = () => {
        if (!window.activeBatchModalInfo) return;
        const sh = getJobWorkerSheets(window.activeJobWorkerId).find((s) => s && String(s.id) === String(window.activeBatchModalInfo.sheetId));
        const r = sh ? toArray(sh.rows).find((x) => x && String(x.id) === String(window.activeBatchModalInfo.rowId)) : null;
        if (!r) return;

        const tbody = document.getElementById('jw-batch-modal-tbody');
        const tfoot = document.getElementById('jw-batch-modal-tfoot');
        if (!tbody) return;

        const items = (window.activeBatchModalInfo.type === 'gayi') 
            ? toArray(r.gayiItems) 
            : toArray(r.aayiItems);

        let tot = 0;
        let html = '';

        items.forEach((item, idx) => {
            const qty = safeNum(item.qty);
            tot += qty;
            const srcText = item.source ? ` <span style="font-size:10px; background:#eff6ff; color:#1d4ed8; padding:1px 5px; border-radius:4px;">${item.source.toUpperCase()}</span>` : '';

            html += `<tr>
                <td>${idx + 1}</td>
                <td><strong>${esc(item.karigar)}</strong>${srcText}${item.naap ? ` <small style="color:#d97706;">(${esc(item.naap)})</small>` : ''}</td>
                <td><strong style="color:#0d9488;">${qty} Pcs</strong></td>
                <td style="text-align:center;">
                    <button type="button" class="edit-btn" onclick="JobWorkEngine.editJwBatchItem(${idx})">✏️</button> 
                    <button type="button" class="delete-btn" onclick="JobWorkEngine.deleteJwBatchItem(${idx})">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
        if (tfoot) {
            tfoot.innerHTML = `<tr style="background:#f0fdf4; font-weight:800; border-top:2px solid #0d9488;"><td colspan="2">TOTAL:</td><td style="color:#0d9488;">${tot} Pcs</td><td>-</td></tr>`;
        }
    };

    const editJwBatchItem = (itemIdx) => {
        if (!window.activeBatchModalInfo) return;
        const sh = getJobWorkerSheets(window.activeJobWorkerId).find((s) => s && String(s.id) === String(window.activeBatchModalInfo.sheetId));
        const r = sh ? toArray(sh.rows).find((x) => x && String(x.id) === String(window.activeBatchModalInfo.rowId)) : null;
        if (!r) return;

        const isGayi = (window.activeBatchModalInfo.type === 'gayi');
        const items = isGayi ? toArray(r.gayiItems) : toArray(r.aayiItems);
        const it = items[itemIdx];
        if (!it) return;

        const newKarName = prompt('Karigar Ka Naam:', it.karigar);
        if (!newKarName) return;

        const newQty = safeInt(prompt('Saree Qty (Pcs):', it.qty));
        if (newQty <= 0) return alert('Sahi Qty daalein!');

        it.karigar = newKarName.trim().toUpperCase();
        it.qty = newQty;

        let newTot = 0;
        items.forEach((x) => { newTot += safeNum(x.qty); });

        if (isGayi) r.gayiQty = newTot; else r.aayiQty = newTot;

        saveJobWorkerSheets(window.activeJobWorkerId, getJobWorkerSheets(window.activeJobWorkerId));
        renderJwBatchModalTable();
        renderJobWorkSheetTable(sh);
        updateJobWorkHubBadges();
    };

    const deleteJwBatchItem = (itemIdx) => {
        if (!confirm('Kya is item ko delete karna chahte hain?')) return;
        if (!window.activeBatchModalInfo) return;

        const sheets = getJobWorkerSheets(window.activeJobWorkerId);
        const sh = sheets.find((s) => s && String(s.id) === String(window.activeBatchModalInfo.sheetId));
        const r = sh ? toArray(sh.rows).find((x) => x && String(x.id) === String(window.activeBatchModalInfo.rowId)) : null;
        if (!r) return;

        const isGayi = (window.activeBatchModalInfo.type === 'gayi');
        const items = isGayi ? toArray(r.gayiItems) : toArray(r.aayiItems);

        items.splice(itemIdx, 1);
        let newTot = 0;
        items.forEach((x) => { newTot += safeNum(x.qty); });

        if (isGayi) r.gayiQty = newTot; else r.aayiQty = newTot;

        saveJobWorkerSheets(window.activeJobWorkerId, sheets);
        renderJwBatchModalTable();
        renderJobWorkSheetTable(sh);
        updateJobWorkHubBadges();
    };

    /* ========================================================================
       12. BILLING & PAYMENTS ENGINE
       ======================================================================== */
    const getJwBills = () => toArray(getFromStore('jw_bills_list'));
    const saveJwBills = (list) => setToStore('jw_bills_list', toArray(list));

    const getJwPayments = () => toArray(getFromStore('jw_payments_list'));
    const saveJwPayments = (list) => setToStore('jw_payments_list', toArray(list));

    const initJobWorkBillingView = () => {
        populateWorkerSelectOptions();
        const dInp = document.getElementById('jw-bill-input-date');
        if (dInp) dInp.value = getToday();
        renderJwBillsTable();
    };

    const populateWorkerSelectOptions = () => {
        const sel = document.getElementById('jw-bill-input-worker');
        if (!sel) return;

        sel.innerHTML = '';
        const workers = getJobWorkers();
        if (!workers.length) {
            sel.innerHTML = '<option value="">Pehle Naya Kariger Banayein</option>';
            return;
        }

        workers.forEach((w) => {
            const opt = document.createElement('option');
            opt.value = w.id;
            let tag = 'Cutting';
            if (w.type === 'calender') tag = 'Calender';
            else if (w.type === 'embroidery') tag = 'Embroidery';
            opt.textContent = `${w.name} (${tag})`;
            sel.appendChild(opt);
        });
    };

    const toggleAddJwBillForm = () => {
        const f = document.getElementById('add-jw-bill-form');
        if (!f) return;

        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';

        if (isOpening) {
            const dInp = document.getElementById('jw-bill-input-date');
            if (dInp) dInp.value = getToday();
        }
    };

    const saveJobWorkNewBill = () => {
        const d = document.getElementById('jw-bill-input-date')?.value || getToday();
        const billNo = String(document.getElementById('jw-bill-input-no')?.value || '-').trim();
        const note = String(document.getElementById('jw-bill-input-note')?.value || billNo).trim();
        const wId = document.getElementById('jw-bill-input-worker')?.value || '';
        const pcs = safeInt(document.getElementById('jw-bill-input-pcs')?.value);
        const amt = safeNum(document.getElementById('jw-bill-input-amt')?.value);

        if (!wId || amt <= 0) return alert('Worker aur Sahi Bill Amount (₹) bharein!');

        const worker = getJobWorkers().find((x) => String(x.id) === String(wId));
        const bills = [...getJwBills()];

        bills.push({
            id: `bill_${Date.now()}`,
            billNo,
            date: d || getToday(),
            workerId: wId,
            workerName: worker ? worker.name : 'Worker',
            workType: worker ? worker.type : 'Job Work',
            pcs,
            billAmt: amt,
            paidAmt: 0,
            note
        });

        saveJwBills(bills);
        toggleAddJwBillForm();
        renderJwBillsTable();
        updateJobWorkHubBadges();
        alert(`✅ Bill No: ${billNo} save ho gaya!`);
    };

    const getJwBillingStats = () => {
        let totBilled = 0, totPaid = 0;
        getJwBills().forEach((b) => {
            if (!b) return;
            totBilled += safeNum(b.billAmt);
            totPaid += safeNum(b.paidAmt);
        });
        return { total: totBilled, paid: totPaid, pending: Math.max(0, totBilled - totPaid) };
    };

    const switchJwBillTab = (tab) => {
        window.currentJwBillTab = tab;
        const btnP = document.getElementById('btn-jw-bill-pending');
        const btnPd = document.getElementById('btn-jw-bill-paid');
        if (btnP) btnP.className = (tab === 'pending') ? 'sheet-tab active' : 'sheet-tab';
        if (btnPd) btnPd.className = (tab === 'paid') ? 'sheet-tab active' : 'sheet-tab';
        renderJwBillsTable();
    };

    const filterJwBills = () => {
        const searchInput = document.getElementById('jw-search-bill-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (!txt) {
            renderJwBillsTable();
            return;
        }

        const filtered = getJwBills().filter((b) => 
            b && `${b.workerName || ''} ${b.billNo || ''} ${b.date || ''}`.toLowerCase().includes(txt)
        );
        renderJwBillsTable(filtered);
    };

    const renderJwBillsTable = (customList) => {
        const thead = document.getElementById('jw-bills-table-thead');
        const tbody = document.getElementById('jw-bills-table-tbody');
        if (!thead || !tbody) return;

        const stats = getJwBillingStats();
        setText('jw-bill-stat-total', `₹ ${stats.total.toFixed(2)}`);
        setText('jw-bill-stat-paid', `₹ ${stats.paid.toFixed(2)}`);
        setText('jw-bill-stat-pending', `₹ ${stats.pending.toFixed(2)}`);

        const isPending = (window.currentJwBillTab === 'pending');
        thead.innerHTML = `<tr style="background:${isPending ? '#dc2626' : '#059669'}; color:white;">
            <th>Date</th><th>Bill No.</th><th>Job Worker</th><th>Process</th><th>Saree Pcs</th><th>Total (₹)</th><th>Paid (₹)</th><th>Baki (₹)</th><th>Status</th><th style="text-align:center;">Action</th></tr>`;

        const filtered = (customList || getJwBills()).filter((b) => {
            if (!b) return false;
            const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
            return isPending ? (baki > 0) : (baki <= 0);
        });

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:#888;">${isPending ? 'Koi dena baki nahi hai!' : 'Abhi koi paid bill nahi hai.'}</td></tr>`;
            return;
        }

        let html = '';
        filtered.forEach((b) => {
            const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
            const payBtn = (baki > 0)
                ? `<button type="button" class="quick-btn btn-in" style="background:#059669; color:white; font-size:11px;" onclick="JobWorkEngine.openJwPayModal('${esc(b.id)}')">💰 Pay</button> `
                : '';

            let procTitle = '✂️ Cutting';
            if (b.workType === 'calender') procTitle = '🎛️ Calender';
            else if (b.workType === 'embroidery') procTitle = '🪡 Embroidery';

            html += `<tr>
                <td>${formatDisplay(b.date)}</td>
                <td><strong style="color:#7c3aed;">${esc(b.billNo || '-')}</strong></td>
                <td><strong>${esc(b.workerName)}</strong></td>
                <td>${procTitle}</td>
                <td>${b.pcs > 0 ? `${b.pcs} Pcs` : '-'}</td>
                <td><strong style="color:#dc2626;">₹ ${safeNum(b.billAmt).toFixed(2)}</strong></td>
                <td><strong style="color:#059669;">₹ ${safeNum(b.paidAmt).toFixed(2)}</strong></td>
                <td><strong style="color:#ea580c;">₹ ${baki.toFixed(2)}</strong></td>
                <td>${baki > 0 ? '<span class="badge-red">Baki</span>' : '<span class="badge-green">✅ Clear</span>'}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="detail-btn" style="background:#7c3aed; font-size:11px;" onclick="JobWorkEngine.viewJwBillPassbook('${esc(b.id)}')">📖</button> 
                    ${payBtn}
                    <button type="button" class="whatsapp-btn" style="padding:4px 8px; font-size:11px;" onclick="JobWorkEngine.sendJwPaymentWhatsAppReceipt('${esc(b.id)}')">📲</button> 
                    <button type="button" class="delete-btn" onclick="JobWorkEngine.deleteJwBill('${esc(b.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    const viewJwBillPassbook = (billId) => {
        const b = getJwBills().find((x) => String(x.id) === String(billId));
        if (!b) return;

        const payments = getJwPayments().filter((p) => p && String(p.billId) === String(billId));
        setText('modal-item-title', `📖 Bill History: ${b.billNo || '-'} (${b.workerName})`);

        const tbody = document.getElementById('modal-history-body');
        if (!tbody) return;

        if (!payments.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">Is Bill par koi payment nahi hai.</td></tr>';
        } else {
            let html = '';
            payments.forEach((p) => {
                html += `<tr>
                    <td>${formatDisplay(p.date)}</td>
                    <td>${esc(p.note || 'Bill Payment')} (${esc(p.mode)})</td>
                    <td style="color:#059669; font-weight:700;">₹ ${safeNum(p.amount).toFixed(2)}</td>
                    <td style="text-align:center;"><button type="button" class="delete-btn" onclick="JobWorkEngine.deleteJwPaymentEntry('${esc(p.id)}', '${esc(billId)}')">🗑️</button></td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }

        setDisplay('item-modal', 'flex');
    };

    const deleteJwPaymentEntry = (payId, billId) => {
        if (!confirm('Kya is payment record ko delete karna chahte hain?')) return;
        const payments = getJwPayments();
        const p = payments.find((x) => x && String(x.id) === String(payId));
        if (!p) return;

        const bills = [...getJwBills()];
        const b = bills.find((x) => x && String(x.id) === String(billId));
        if (b) {
            b.paidAmt = Math.max(0, safeNum(b.paidAmt) - safeNum(p.amount));
            saveJwBills(bills);
        }

        saveJwPayments(payments.filter((x) => !x || String(x.id) !== String(payId)));
        viewJwBillPassbook(billId);
        renderJwBillsTable();
        updateJobWorkHubBadges();
        alert('🗑️ Payment delete ho gaya!');
    };

    const openJwPayModal = (billId) => {
        const b = getJwBills().find((x) => String(x.id) === String(billId));
        if (!b) return;

        const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));
        const setV = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };

        setV('jw-pay-bill-id', b.id);
        setText('jw-pay-modal-worker-text', `Bill: ${b.billNo || '-'} | ${b.workerName}`);
        setText('jw-pay-modal-baki-text', `Abhi Dena Baki: ₹ ${baki.toFixed(2)}`);
        setV('jw-pay-date', getToday());
        setV('jw-pay-amount', baki);
        setV('jw-pay-note', `Payment for Bill ${b.billNo || ''}`);

        setDisplay('jw-pay-modal', 'flex');
    };

    const closeJwPayModal = () => {
        setDisplay('jw-pay-modal', 'none');
    };

    const saveJobWorkPayment = () => {
        const billId = document.getElementById('jw-pay-bill-id')?.value;
        const d = document.getElementById('jw-pay-date')?.value || getToday();
        const payAmt = safeNum(document.getElementById('jw-pay-amount')?.value);
        const mode = document.getElementById('jw-pay-mode')?.value || 'Cash';
        const note = String(document.getElementById('jw-pay-note')?.value || '').trim();

        if (payAmt <= 0) return alert('Sahi Payment Amount bharein!');

        const bills = [...getJwBills()];
        const b = bills.find((x) => String(x.id) === String(billId));
        if (!b) return;

        b.paidAmt = safeNum(b.paidAmt) + payAmt;
        saveJwBills(bills);

        const payments = [...getJwPayments()];
        payments.push({
            id: `pay_${Date.now()}`,
            billId,
            billNo: b.billNo || '-',
            date: d,
            workerName: b.workerName,
            amount: payAmt,
            mode,
            note
        });

        saveJwPayments(payments);
        closeJwPayModal();
        renderJwBillsTable();
        updateJobWorkHubBadges();
        alert(`✅ ₹${payAmt} Payment save ho gaya!`);
    };

    const sendJwPaymentWhatsAppReceipt = (billId) => {
        const b = getJwBills().find((x) => String(x.id) === String(billId));
        if (!b) return;

        const worker = getJobWorkers().find((w) => String(w.id) === String(b.workerId));
        const baki = Math.max(0, safeNum(b.billAmt) - safeNum(b.paidAmt));

        const text = `🧾 *JOB WORK PAYMENT RASEED* 🧾\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `📄 *Bill No:* ${b.billNo || '-'}\n👤 *Job Worker:* ${b.workerName}\n📅 *Tarikh:* ${formatDisplay(getToday())}\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 Total Bill: ₹ ${safeNum(b.billAmt).toFixed(2)}\n🟢 Paid: ₹ ${safeNum(b.paidAmt).toFixed(2)}\n-------------------------------------\n` +
            (baki > 0 ? `🔴 *BAKI HAI: ₹ ${baki.toFixed(2)}*\n` : '🟢 *STATUS: CHUKTA HO GAYA*\n') +
            `━━━━━━━━━━━━━━━━━━━━━\n_Simplicity ERP • by Farhan Jawed_`;

        let mobile = worker ? String(worker.mobile || '').trim().replace(/[^0-9]/g, '') : '';
        if (mobile.length === 11 && mobile.startsWith('0')) mobile = mobile.substring(1);
        if (!mobile || mobile.length < 10) {
            mobile = prompt('WhatsApp Number (10-digit):', mobile);
            if (!mobile) return;
            mobile = mobile.trim().replace(/[^0-9]/g, '');
            if (mobile.length === 11 && mobile.startsWith('0')) mobile = mobile.substring(1);
        }
        if (mobile.length === 10) mobile = `91${mobile}`;

        window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const deleteJwBill = (billId) => {
        if (!confirm('Kya is Bill ko delete karna chahte hain? Sabhi jude payments bhi delete honge.')) return;
        saveJwBills(getJwBills().filter((x) => !x || String(x.id) !== String(billId)));
        saveJwPayments(getJwPayments().filter((p) => !p || String(p.billId) !== String(billId)));
        renderJwBillsTable();
        updateJobWorkHubBadges();
        alert('🗑️ Bill delete ho gaya!');
    };

    const shareJobWorkOnWhatsApp = () => {
        if (!window.activeJobWorkerId || !window.activeJobSheetId) return alert('Pehle koi Khata Sheet kholein!');
        const w = getJobWorkers().find((x) => String(x.id) === String(window.activeJobWorkerId));
        const sheet = getJobWorkerSheets(window.activeJobWorkerId).find((s) => s && String(s.id) === String(window.activeJobSheetId));
        if (!w || !sheet) return alert('Data nahi mila!');

        let procTitle = 'BOOTI CUTTING';
        if (w.type === 'calender') procTitle = 'CALENDER';
        else if (w.type === 'embroidery') procTitle = 'EMBROIDERY';

        const c = calculateJobWorkSheetTotals(sheet);
        const text = `🧾 *${procTitle} HISAB PARCHI* 🧾\n━━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 *Kariger:* ${w.name}\n📅 *Mahina:* ${sheet.title}\n📅 *Tarikh:* ${formatDisplay(getToday())}\n━━━━━━━━━━━━━━━━━━━━━\n` +
            (c.closingPendingSaree > 0 ? `➕ Pichli Baki: *${c.closingPendingSaree} Pcs*\n` : '') +
            `🔴 Kul Gayi: *${c.totGayiQty} Pcs*\n🟢 Wapas Aayi: *${c.totAayiQty} Pcs*\n` +
            (c.totDamagePcs > 0 ? `⚠️ Damage: *${c.totDamagePcs} Pcs*\n` : '') +
            `-------------------------------------\n🟠 *ABHI BAKI SAREE: ${c.pendingSaree} Pcs*\n━━━━━━━━━━━━━━━━━━━━━\n_Simplicity ERP • by Farhan Jawed_`;

        let mobile = String(w.mobile || '').trim().replace(/[^0-9]/g, '');
        if (mobile.length === 11 && mobile.startsWith('0')) mobile = mobile.substring(1);
        if (!mobile || mobile.length < 10) {
            mobile = prompt('WhatsApp Number (10-digit):', mobile);
            if (!mobile) return;
            mobile = mobile.trim().replace(/[^0-9]/g, '');
            if (mobile.length === 11 && mobile.startsWith('0')) mobile = mobile.substring(1);
        }
        if (mobile.length === 10) mobile = `91${mobile}`;

        window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`, '_blank');
    };

    /* ========================================================================
       13. DAILY MOVEMENT DAYBOOK ENGINE
       ======================================================================== */
    const setJwMovementToday = () => {
        const dEl = document.getElementById('jw-mov-date');
        if (dEl) dEl.value = getToday();
        renderJwMovementDaybook();
    };

    const switchJwMovementTab = (tab) => {
        window.currentJwMovementTab = tab;
        ['cutting', 'embroidery', 'calender', 'payment'].forEach((t) => {
            const el = document.getElementById(`btn-jw-mov-${t}`);
            if (el) {
                if (t === tab) el.classList.add('active'); else el.classList.remove('active');
            }
        });
        renderJwMovementDaybook();
    };

    const renderJwMovementDaybook = () => {
        const d = document.getElementById('jw-mov-date')?.value || getToday();
        const thead = document.getElementById('jw-mov-table-thead');
        const tbody = document.getElementById('jw-mov-table-tbody');
        const tfoot = document.getElementById('jw-mov-table-tfoot');
        if (!thead || !tbody || !tfoot) return;

        const txt = (document.getElementById('jw-mov-search')?.value || '').toLowerCase().trim();
        let cutG = 0, cutA = 0, embG = 0, embA = 0, calG = 0, calA = 0, payOut = 0;
        const cuttingRows = [], embroideryRows = [], calenderRows = [], paymentRows = [];

        getJobWorkers().forEach((w) => {
            const wType = String(w.type || '').toLowerCase();
            getJobWorkerSheets(w.id).forEach((sh) => {
                const rows = toArray(sh.rows);
                rows.forEach((r) => {
                    if (!r || r.date !== d) return;
                    const gQty = safeNum(r.gayiQty);
                    const aQty = safeNum(r.aayiQty);

                    if (wType === 'calender') {
                        if (gQty > 0 || aQty > 0) {
                            calG += gQty;
                            calA += aQty;
                            calenderRows.push({ worker: w.name, sheet: sh.title, gayi: gQty, aayi: aQty, damagePcs: r.damagePcs || 0 });
                        }
                    } else if (wType === 'embroidery') {
                        if (gQty > 0 || aQty > 0) {
                            embG += gQty;
                            embA += aQty;
                            embroideryRows.push({ worker: w.name, sheet: sh.title, gayi: gQty, aayi: aQty, damagePcs: r.damagePcs || 0 });
                        }
                    } else {
                        if (gQty > 0 || aQty > 0) {
                            cutG += gQty;
                            cutA += aQty;
                            cuttingRows.push({ worker: w.name, sheet: sh.title, gayi: gQty, aayi: aQty, damagePcs: r.damagePcs || 0 });
                        }
                    }
                });
            });
        });

        getJwPayments().forEach((p) => {
            if (p && p.date === d) {
                const amt = safeNum(p.amount);
                payOut += amt;
                paymentRows.push({
                    worker: p.workerName || '-',
                    billNo: p.billNo || '-',
                    amount: amt,
                    mode: p.mode || 'Cash'
                });
            }
        });

        setText('sub-jw-mov-cutting', `Gayi: -${cutG} | Aayi: +${cutA}`);
        setText('sub-jw-mov-embroidery', `Gayi: -${embG} | Aayi: +${embA}`);
        setText('sub-jw-mov-calender', `Gayi: -${calG} | Aayi: +${calA}`);
        setText('sub-jw-mov-payment', `Diya: -₹ ${payOut.toFixed(0)}`);

        if (window.currentJwMovementTab === 'cutting') {
            thead.innerHTML = '<tr style="background:#e11d48; color:white;"><th>Cutting Kariger</th><th>Sheet</th><th style="text-align:center;">📤 Gayi</th><th style="text-align:center;">📥 Wapas Aayi</th><th>⚠️ Damage</th></tr>';
            const filteredCut = cuttingRows.filter((r) => !txt || `${r.worker} ${r.sheet}`.toLowerCase().includes(txt));
            if (!filteredCut.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:18px; color:#888;">Koi entry nahi hai.</td></tr>';
            } else {
                let html = '';
                filteredCut.forEach((r) => {
                    html += `<tr><td><strong>${esc(r.worker)}</strong></td><td>${esc(r.sheet)}</td><td style="text-align:center;"><strong style="color:#dc2626;">-${r.gayi} Pcs</strong></td><td style="text-align:center;"><strong style="color:#059669;">+${r.aayi} Pcs</strong></td><td>${r.damagePcs > 0 ? `⚠️ ${r.damagePcs}` : '-'}</td></tr>`;
                });
                tbody.innerHTML = html;
            }
            tfoot.innerHTML = `<tr style="background:#fff1f2; font-weight:800; border-top:2px solid #e11d48;"><td colspan="2">TOTAL CUTTING:</td><td style="color:#dc2626; text-align:center;">-${cutG} Pcs</td><td style="color:#059669; text-align:center;">+${cutA} Pcs</td><td>-</td></tr>`;
        } else if (window.currentJwMovementTab === 'embroidery') {
            thead.innerHTML = '<tr style="background:#d97706; color:white;"><th>Embroidery Kariger</th><th>Sheet</th><th style="text-align:center;">📤 Gayi</th><th style="text-align:center;">📥 Wapas Aayi</th><th>⚠️ Damage</th></tr>';
            const filteredEmb = embroideryRows.filter((r) => !txt || `${r.worker} ${r.sheet}`.toLowerCase().includes(txt));
            if (!filteredEmb.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:18px; color:#888;">Koi entry nahi hai.</td></tr>';
            } else {
                let html = '';
                filteredEmb.forEach((r) => {
                    html += `<tr><td><strong>${esc(r.worker)}</strong></td><td>${esc(r.sheet)}</td><td style="text-align:center;"><strong style="color:#dc2626;">-${r.gayi} Pcs</strong></td><td style="text-align:center;"><strong style="color:#059669;">+${r.aayi} Pcs</strong></td><td>${r.damagePcs > 0 ? `⚠️ ${r.damagePcs}` : '-'}</td></tr>`;
                });
                tbody.innerHTML = html;
            }
            tfoot.innerHTML = `<tr style="background:#fef3c7; font-weight:800; border-top:2px solid #d97706;"><td colspan="2">TOTAL EMBROIDERY:</td><td style="color:#dc2626; text-align:center;">-${embG} Pcs</td><td style="color:#059669; text-align:center;">+${embA} Pcs</td><td>-</td></tr>`;
        } else if (window.currentJwMovementTab === 'calender') {
            thead.innerHTML = '<tr style="background:#0284c7; color:white;"><th>Calender Kariger</th><th>Sheet</th><th style="text-align:center;">📤 Gayi</th><th style="text-align:center;">📥 Wapas Aayi</th><th>⚠️ Damage</th></tr>';
            const filteredCal = calenderRows.filter((r) => !txt || `${r.worker} ${r.sheet}`.toLowerCase().includes(txt));
            if (!filteredCal.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:18px; color:#888;">Koi entry nahi hai.</td></tr>';
            } else {
                let html = '';
                filteredCal.forEach((r) => {
                    html += `<tr><td><strong>${esc(r.worker)}</strong></td><td>${esc(r.sheet)}</td><td style="text-align:center;"><strong style="color:#dc2626;">-${r.gayi} Pcs</strong></td><td style="text-align:center;"><strong style="color:#059669;">+${r.aayi} Pcs</strong></td><td>${r.damagePcs > 0 ? `⚠️ ${r.damagePcs}` : '-'}</td></tr>`;
                });
                tbody.innerHTML = html;
            }
            tfoot.innerHTML = `<tr style="background:#e0f2fe; font-weight:800; border-top:2px solid #0284c7;"><td colspan="2">TOTAL CALENDER:</td><td style="color:#dc2626; text-align:center;">-${calG} Pcs</td><td style="color:#059669; text-align:center;">+${calA} Pcs</td><td>-</td></tr>`;
        } else if (window.currentJwMovementTab === 'payment') {
            thead.innerHTML = '<tr style="background:#7c3aed; color:white;"><th>Job Worker</th><th>Bill No.</th><th>Mode</th><th style="text-align:center;">Diya (Paid)</th></tr>';
            const filteredPay = paymentRows.filter((r) => !txt || `${r.worker} ${r.billNo}`.toLowerCase().includes(txt));
            if (!filteredPay.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:18px; color:#888;">Koi payment nahi diya gaya.</td></tr>';
            } else {
                let html = '';
                filteredPay.forEach((r) => {
                    html += `<tr><td><strong>${esc(r.worker)}</strong></td><td>${esc(r.billNo)}</td><td>${esc(r.mode)}</td><td style="text-align:center;"><strong style="color:#dc2626;">- ₹ ${r.amount.toFixed(2)}</strong></td></tr>`;
                });
                tbody.innerHTML = html;
            }
            tfoot.innerHTML = `<tr style="background:#f3e8ff; font-weight:800; border-top:2px solid #7c3aed;"><td colspan="3">TOTAL BHUGTAN:</td><td style="color:#dc2626; text-align:center;">- ₹ ${payOut.toFixed(2)}</td></tr>`;
        }
    };

    /* ========================================================================
       14. GLOBAL EXPORT
       ======================================================================== */
    const jobWorkAPI = {
        openJobWorkModule,
        showJobWorkHub,
        openJobWorkSubSection,
        updateJobWorkHubBadges,
        getJobWorkers,
        saveJobWorkers,
        getJobWorkerLastActiveInfo,
        toggleJobWorkerForm,
        cancelJobWorkerEdit,
        saveNewJobWorker,
        editJobWorker,
        deleteJobWorker,
        filterJobWorkWorkers,
        renderJobWorkWorkersTable,
        sendJobWorkerTagadaWhatsApp,
        getJobWorkerSheets,
        saveJobWorkerSheets,
        calculateJobWorkSheetTotals,
        getJobWorkerOverallSummary,
        getKarigerAvailableSareeStock,
        updateJwKarigerLiveStockBadge,
        openJobWorkerSheet,
        closeJobWorkerSheet,
        renderJobWorkSheetTabs,
        switchJobWorkerSheetTab,
        addNewJobWorkerMonthlySheet,
        deleteJobWorkerMonthlySheet,
        loadCurrentJobWorkSheet,
        saveJobWorkSheetConfig,
        populateKarigersDatalist,
        addDiyaBatchKarigarItem,
        removeDiyaBatchItem,
        renderDiyaBatchChips,
        addAayiBatchKarigarItem,
        removeAayiBatchItem,
        renderAayiBatchChips,
        saveJobWorkBatchLine,
        renderJobWorkSheetTable,
        deleteJobWorkBatchRow,
        openJwBatchModal,
        closeJwBatchModal,
        renderJwBatchModalTable,
        editJwBatchItem,
        deleteJwBatchItem,
        getJwBills,
        saveJwBills,
        getJwPayments,
        saveJwPayments,
        initJobWorkBillingView,
        populateWorkerSelectOptions,
        toggleAddJwBillForm,
        saveJobWorkNewBill,
        getJwBillingStats,
        switchJwBillTab,
        filterJwBills,
        renderJwBillsTable,
        viewJwBillPassbook,
        deleteJwPaymentEntry,
        openJwPayModal,
        closeJwPayModal,
        saveJobWorkPayment,
        sendJwPaymentWhatsAppReceipt,
        deleteJwBill,
        shareJobWorkOnWhatsApp,
        setJwMovementToday,
        switchJwMovementTab,
        renderJwMovementDaybook,
        invalidateJobWorkCache
    };

    Object.keys(jobWorkAPI).forEach((fnName) => {
        window[fnName] = jobWorkAPI[fnName];
    });

    window.JobWorkEngine = jobWorkAPI;

    document.addEventListener('DOMContentLoaded', () => {
        const workerSearch = document.getElementById('jw-search-worker-input');
        if (workerSearch) {
            const debounced = (typeof window.debounce === 'function') 
                ? window.debounce(filterJobWorkWorkers, 250) 
                : filterJobWorkWorkers;
            workerSearch.addEventListener('input', debounced);
        }

        const billSearch = document.getElementById('jw-search-bill-input');
        if (billSearch) {
            const debounced = (typeof window.debounce === 'function') 
                ? window.debounce(filterJwBills, 250) 
                : filterJwBills;
            billSearch.addEventListener('input', debounced);
        }

        const movSearch = document.getElementById('jw-mov-search');
        if (movSearch) {
            const debounced = (typeof window.debounce === 'function') 
                ? window.debounce(renderJwMovementDaybook, 250) 
                : renderJwMovementDaybook;
            movSearch.addEventListener('input', debounced);
        }
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = jobWorkAPI;
    }
})();
