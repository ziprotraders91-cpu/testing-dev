/* ============================================================================
   SIMPLICITY ERP - 5-STAGE ENTERPRISE BULLETPROOF YEAR CLOSING ENGINE
   File: session/session-closing.js • Developed by Farhan Jawed
   Architecture: Row-by-Row Delta Sync + IndexedDB + Strict Session Isolation
============================================================================ */

(() => {
    'use strict';

    const STAGE1_KARIGER_CHUNK_SIZE = 25;
    const STAGE5_IDB_CHUNK_SIZE = 40;
    const STAGE5_CLOUD_ROW_CHUNK = 200;
    const UI_THREAD_YIELD_MS = 16;

    let pendingTransferNewSession = null;
    let isClosingInProgress = false;
    let pipelineState = null;

    const yieldThread = (ms = UI_THREAD_YIELD_MS) => new Promise((resolve) => setTimeout(resolve, ms));

    const safeNum = (val, fallback = 0, decimals = 2) => {
        const n = parseFloat(val);
        return (isNaN(n) || !isFinite(n)) ? fallback : Number(n.toFixed(decimals));
    };

    const safeInt = (val, fallback = 0) => {
        const n = parseInt(val, 10);
        return (isNaN(n) || !isFinite(n)) ? fallback : n;
    };

    const getSafeUserId = () => {
        try {
            if (window.StorageEngine && typeof window.StorageEngine.getEffectiveUserId === 'function') {
                const sid = window.StorageEngine.getEffectiveUserId();
                if (sid && sid !== 'app') return String(sid).trim();
            }
            if (window.currentUserId && String(window.currentUserId).trim() && window.currentUserId !== 'app') {
                return String(window.currentUserId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            }
            if (window.currentUserProfile && window.currentUserProfile.id) {
                return String(window.currentUserProfile.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            }
            const authData = localStorage.getItem('app_active_session_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed && parsed.id) {
                    return String(parsed.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                }
            }
            const stored = localStorage.getItem('app_current_user_id') ||
                           localStorage.getItem('currentUserId') ||
                           sessionStorage.getItem('currentUserId');
            if (stored) {
                const clean = String(stored).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
                if (clean && clean !== 'app') return clean;
            }
        } catch (_) {}
        return 'farhan';
    };

    const getSafeTenantId = (uid) => {
        try {
            if (window.currentTenantId) return String(window.currentTenantId).trim();
            const stored = localStorage.getItem('app_current_tenant_id') || localStorage.getItem('tenantId');
            if (stored) return String(stored).trim();
        } catch (_) {}
        return uid;
    };

    const getSupabase = () => {
        return window.supabaseClient || window.CloudEngine?.supabase || window.supabase || null;
    };

    const getUniqueItemNamesCaseInsensitive = (list) => {
        const map = new Map();
        (list || []).forEach((it) => {
            const n = (it?.name || '').trim();
            if (n && !map.has(n.toLowerCase())) {
                map.set(n.toLowerCase(), n);
            }
        });
        return Array.from(map.values());
    };

    const safeSetLocalStorage = (key, val) => {
        try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
        } catch (_) {}
    };

    const clearSessionDeltaCursors = (uId, sess) => {
        try {
            const suffix = `_${uId}_${sess}`;
            const toDel = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('erp_delta_sync_') && k.endsWith(suffix)) {
                    toDel.push(k);
                }
            }
            toDel.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
    };

    const enqueueDeltaFallback = async (uId, fullKey, rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        try {
            const req = window.indexedDB.open('SimplicityERP_DB', 2);
            await new Promise((resolve) => {
                req.onsuccess = (e) => {
                    try {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('sync_queue')) return resolve(false);
                        const tx = db.transaction('sync_queue', 'readwrite');
                        tx.objectStore('sync_queue').put({
                            id: `delta_${uId}_${fullKey}`,
                            mode: 'ROW_DELTA',
                            targetKey: fullKey,
                            upserts: rows,
                            deletes: [],
                            timestamp: Date.now()
                        });
                        tx.oncomplete = () => resolve(true);
                        tx.onerror = () => resolve(false);
                    } catch (_) {
                        resolve(false);
                    }
                };
                req.onerror = () => resolve(false);
            });
        } catch (_) {}
    };

    const updateProgressUI = (stageNum, statusText, pct, mainPct, isCompleted = false) => {
        const bar = document.getElementById(`stage-bar-${stageNum}`);
        const status = document.getElementById(`stage-status-${stageNum}`);
        const badge = document.getElementById(`stage-badge-${stageNum}`);
        const mainBar = document.getElementById('transfer-main-bar');

        if (bar) bar.style.width = `${pct}%`;
        if (mainBar && mainPct !== null) mainBar.style.width = `${mainPct}%`;
        if (status) status.textContent = statusText;

        if (badge) {
            if (isCompleted) {
                badge.textContent = '✅ Done';
                badge.style.background = '#ecfdf5';
                badge.style.color = '#059669';
            } else {
                badge.textContent = '⏳ Working...';
                badge.style.background = '#eff6ff';
                badge.style.color = '#2563eb';
            }
        }
    };

    const initPipelineState = () => ({
        stage1_oldKarigers: [],
        stage1_newKarigerSheetsMap: {},
        stage2_newSareeHistory: [],
        stage2_totFreshPcs: 0,
        stage2_totFinPcs: 0,
        stage2_totLottPcs: 0,
        stage3_newBanaStock: [],
        stage3_newBanaHistory: [],
        stage3_newZariStock: [],
        stage3_newZariHistory: [],
        stage4_newSanchaItems: [],
        stage4_newSanchaHistory: [],
        stage4_oldJwWorkers: []
    });

    const startSequentialYearClosing = async () => {
        if (isClosingInProgress) return;

        const curSess = window.getActiveFinancialSession ? window.getActiveFinancialSession() : '2026-2027';
        const newSessEl = document.getElementById('session-new-input');
        const newSess = String(newSessEl?.value || '').trim();

        if (!newSess) return alert('Naye Saal ka naam daalein! (Jaise: 2027-2028)');
        if (!/^\d{4}-\d{4}$/.test(newSess)) return alert('Sahi format daalein! (Jaise: 2027-2028)');
        if (newSess === curSess) return alert('Naya session purane se alag hona chahiye!');

        const sessions = window.getAppSessions ? window.getAppSessions() : [];
        if (sessions.includes(newSess)) {
            return alert('Ye Session pehle se bana hua hai! Pehle ise Delete Zone se delete karein, fir fresh banayein.');
        }

        const uId = getSafeUserId();

        if (typeof window.ensureSessionModals === 'function') {
            window.ensureSessionModals();
        }

        if (typeof window.detachSupabaseRealtime === 'function') {
            window.detachSupabaseRealtime();
        }

        if (typeof window.closeSessionClosingModal === 'function') {
            window.closeSessionClosingModal();
        }

        pendingTransferNewSession = newSess;
        isClosingInProgress = true;
        pipelineState = initPipelineState();

        const modal = document.getElementById('session-transfer-modal');
        if (!modal) {
            isClosingInProgress = false;
            return;
        }

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#e2e8f0; height:10px; margin-bottom:14px; border-radius:5px; overflow:hidden;">
                    <div id="transfer-main-bar" style="background:#2563eb; width:0%; height:100%; transition:width 0.2s;"></div>
                </div>
                <div><span id="stage-badge-1" class="badge-blue">Waiting</span> <small id="stage-status-1">1. Kariger Opening</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-1" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-2" class="badge-blue">Waiting</span> <small id="stage-status-2">2. Saree Opening Stock (All 5 Stages)</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-2" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-3" class="badge-blue">Waiting</span> <small id="stage-status-3">3. Bana & Zari Exact Match</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-3" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-4" class="badge-blue">Waiting</span> <small id="stage-status-4">4. Sancha & Jobwork Workers</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-4" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-5" class="badge-blue">Waiting</span> <small id="stage-status-5">5. Safe IndexedDB & Cloud Commit</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-5" style="background:#2563eb; width:0%; height:100%;"></div></div></div>`;
        }

        modal.style.display = 'flex';

        try {
            await yieldThread(80);
            await runStage1_KarigersAsync(curSess, newSess);
            await runStage2_SareeStockAsync(curSess, newSess);
            await runStage3_BanaZariStockAsync(curSess, newSess);
            await runStage4_SanchaAndJobworkAsync(curSess, newSess);
            await runStage5_FinalizeCommitAsync(curSess, newSess, uId);
        } catch (pipelineErr) {
            console.error('[SessionClosing] Pipeline error:', pipelineErr);
            alert(`Year closing me dikkat: ${pipelineErr.message || pipelineErr}`);
            if (modal) modal.style.display = 'none';
            if (typeof window.initSupabaseRealtime === 'function') {
                window.initSupabaseRealtime();
            }
        } finally {
            isClosingInProgress = false;
        }
    };

    const runStage1_KarigersAsync = async (curSess, newSess) => {
        const rawList = window.safeArray ? window.safeArray(window.getStore('kariger_list')) : [];
        const rawKarigers = rawList.filter((k) => k && k.id && k.name && String(k.name).trim() !== '');
        pipelineState.stage1_oldKarigers = rawKarigers.map((k) => ({ ...k }));
        const total = rawKarigers.length;

        for (let i = 0; i < total; i += STAGE1_KARIGER_CHUNK_SIZE) {
            const end = Math.min(i + STAGE1_KARIGER_CHUNK_SIZE, total);

            for (let j = i; j < end; j++) {
                const k = rawKarigers[j];
                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                const lastSheet = sheets.length ? sheets[sheets.length - 1] : null;

                const calc = (lastSheet && typeof window.calculateSheetTotals === 'function')
                    ? window.calculateSheetTotals(lastSheet)
                    : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

                pipelineState.stage1_newKarigerSheetsMap[k.id] = [{
                    id: 'tani_1',
                    title: `Tani 1 (Opening ${newSess})`,
                    pichlaBana: safeNum(calc.remainingBana, 0, 3),
                    pichlaZari: safeNum(calc.remainingZari, 0, 3),
                    pichlaBani: safeNum(calc.remainingAmt, 0, 2),
                    banaWaste: 0,
                    zariWaste: 0,
                    rateBana: (lastSheet && lastSheet.rateBana !== undefined && lastSheet.rateBana !== null) ? safeNum(lastSheet.rateBana, 0.311, 3) : 0.311,
                    rateZari: (lastSheet && lastSheet.rateZari !== undefined && lastSheet.rateZari !== null) ? safeNum(lastSheet.rateZari, 0.110, 3) : 0.110,
                    rateBani: (lastSheet && lastSheet.rateBani !== undefined && lastSheet.rateBani !== null) ? safeNum(lastSheet.rateBani, 240, 2) : 240,
                    taniPcs: lastSheet ? safeInt(lastSheet.taniPcs, 72) : 72,
                    chukkaPcs: lastSheet ? safeInt(lastSheet.chukkaPcs, 72) : 72,
                    colors: (lastSheet && Array.isArray(lastSheet.colors)) ? [...lastSheet.colors] : [],
                    banaItem: lastSheet ? (lastSheet.banaItem || '') : '',
                    zariItem: lastSheet ? (lastSheet.zariItem || '') : '',
                    taniItem: lastSheet ? (lastSheet.taniItem || '') : '',
                    taniSancha: lastSheet ? (lastSheet.taniSancha || '') : '',
                    taniWazan: 0,
                    chukkaItem: lastSheet ? (lastSheet.chukkaItem || '') : '',
                    chukkaSancha: lastSheet ? (lastSheet.chukkaSancha || '') : '',
                    chukkaWazan: 0,
                    note: `📦 31st March (${curSess}) Closing se Aaya Opening Balance`,
                    rows: []
                }];
            }

            const pct = total > 0 ? Math.floor((end / total) * 100) : 100;
            updateProgressUI(1, `⏳ ${end} / ${total} Karigers Done`, pct, Math.floor(pct * 0.20));
            await yieldThread();
        }

        updateProgressUI(1, `✅ Done (${total} Karigers)`, 100, 20, true);
        await yieldThread(30);
    };

    const runStage2_SareeStockAsync = async (curSess, newSess) => {
        if (typeof window.invalidateSareeCalcCache === 'function') {
            window.invalidateSareeCalcCache();
        }
        const rawHistory = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0];
        const tabs = ['fresh', 'cutting', 'embroidery', 'finished', 'lott'];
        const baseTs = Date.now();
        let seq = 0;

        for (const k of karkhanas) {
            for (const tb of tabs) {
                const rows = (typeof window.groupSareeStockByTab === 'function')
                    ? window.groupSareeStockByTab(rawHistory, tb, k.id)
                    : [];

                for (const r of rows) {
                    const bachiQty = safeInt(r.bachi !== undefined ? r.bachi : (r.aai - r.gai));
                    if (bachiQty <= 0) continue;

                    if (tb === 'fresh') pipelineState.stage2_totFreshPcs += bachiQty;
                    else if (tb === 'finished') pipelineState.stage2_totFinPcs += bachiQty;
                    else if (tb === 'lott') pipelineState.stage2_totLottPcs += bachiQty;

                    seq++;
                    const sUniqueId = `saree_open_${tb}_${baseTs}_${seq}`;
                    const maker = r.karigerName || '📦 Pichla Bacha Stock';

                    pipelineState.stage2_newSareeHistory.push({
                        id: sUniqueId,
                        date: todayStr,
                        sareeName: r.sareeName || 'GENERAL SAREE',
                        karigerName: maker,
                        kariger: maker,
                        partyName: '📦 Pichla Bacha Stock',
                        karkhanaId: k.id,
                        type: tb,
                        typeLabel: `📦 Opening Stock (${curSess} Se Aaya)`,
                        aai: bachiQty,
                        gai: 0,
                        isOut: false,
                        isOpening: true,
                        note: 'Opening Stock',
                        timestamp: baseTs + seq
                    });
                }
                await yieldThread();
            }
        }

        updateProgressUI(2, `✅ Saree Ready (Fresh: ${pipelineState.stage2_totFreshPcs}, Fin: ${pipelineState.stage2_totFinPcs})`, 100, 40, true);
        await yieldThread(30);
    };

    const runStage3_BanaZariStockAsync = async (curSess, newSess) => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0];
        const baseTs = Date.now();
        let bSeq = 0, zSeq = 0;

        const rawBana = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const rawBHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const uniqueBanaNames = getUniqueItemNamesCaseInsensitive([...rawBana, ...rawBHist]);

        for (const bName of uniqueBanaNames) {
            for (const k of karkhanas) {
                const statsK = (typeof window.getBanaItemStats === 'function') ? window.getBanaItemStats(bName, k.id) : { bacha: 0 };
                const bachaVal = Math.max(0, safeNum(statsK.bacha));
                if (bachaVal <= 0) continue;

                bSeq++;
                pipelineState.stage3_newBanaStock.push({
                    id: `bana_open_${baseTs}_${bSeq}`,
                    name: bName,
                    date: todayStr,
                    aaya: bachaVal,
                    openingAaya: bachaVal,
                    gaya: 0,
                    bacha: bachaVal,
                    karkhanaId: k.id,
                    isOpening: true,
                    note: `📦 Opening Stock (${curSess} Se Aaya)`,
                    timestamp: baseTs + bSeq
                });

                pipelineState.stage3_newBanaHistory.push({
                    id: `bhist_open_${baseTs}_${bSeq}`,
                    date: todayStr,
                    name: bName,
                    kariger: '📦 Pichla Bacha Stock',
                    type: `📦 Opening Stock (${curSess} Se Aaya)`,
                    aaya: bachaVal,
                    gaya: 0,
                    karkhanaId: k.id,
                    isOpening: true,
                    timestamp: baseTs + bSeq
                });
            }
            await yieldThread();
        }

        const rawZari = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
        const rawZHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const uniqueZariNames = getUniqueItemNamesCaseInsensitive([...rawZari, ...rawZHist]);

        for (const zName of uniqueZariNames) {
            for (const k of karkhanas) {
                const statsZK = (typeof window.getZariItemStats === 'function') ? window.getZariItemStats(zName, k.id) : { bacha: 0 };
                const bachaValZ = Math.max(0, safeNum(statsZK.bacha));
                if (bachaValZ <= 0) continue;

                zSeq++;
                pipelineState.stage3_newZariStock.push({
                    id: `zari_open_${baseTs}_${zSeq}`,
                    name: zName,
                    date: todayStr,
                    aaya: bachaValZ,
                    openingAaya: bachaValZ,
                    gaya: 0,
                    bacha: bachaValZ,
                    karkhanaId: k.id,
                    isOpening: true,
                    note: `📦 Opening Stock (${curSess} Se Aaya)`,
                    timestamp: baseTs + zSeq
                });

                pipelineState.stage3_newZariHistory.push({
                    id: `zhist_open_${baseTs}_${zSeq}`,
                    date: todayStr,
                    name: zName,
                    kariger: '📦 Pichla Bacha Stock',
                    type: `📦 Opening Stock (${curSess} Se Aaya)`,
                    aaya: bachaValZ,
                    gaya: 0,
                    karkhanaId: k.id,
                    isOpening: true,
                    timestamp: baseTs + zSeq
                });
            }
            await yieldThread();
        }

        updateProgressUI(3, `✅ Bana & Zari Reconciled`, 100, 60, true);
        await yieldThread(30);
    };

    const runStage4_SanchaAndJobworkAsync = async (curSess, newSess) => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function')
            ? window.getKarkhanasSafe()
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0];
        const rawSancha = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const rawSHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
        const baseTs = Date.now();
        let sSeq = 0;

        for (const cat of ['tani', 'chukka']) {
            const catCombined = [...rawSancha, ...rawSHist].filter(
                (s) => s && s.name && String(s.category || 'tani').toLowerCase() === cat
            );
            const uniqueCatNames = getUniqueItemNamesCaseInsensitive(catCombined);

            for (const itemName of uniqueCatNames) {
                const origItem = rawSancha.find(
                    (x) => x && x.name && x.name.trim().toLowerCase() === itemName.toLowerCase() &&
                           String(x.category || 'tani').toLowerCase() === cat
                );
                const personLabel = (origItem && origItem.person) ? origItem.person : '-';

                for (const k of karkhanas) {
                    const stats = (typeof window.getSanchaItemStats === 'function')
                        ? window.getSanchaItemStats(null, itemName, cat, k.id)
                        : { bacha: 0 };
                    const bacha = Math.max(0, safeNum(stats.bacha));
                    if (bacha <= 0) continue;

                    sSeq++;
                    pipelineState.stage4_newSanchaItems.push({
                        id: `sancha_open_${cat}_${baseTs}_${sSeq}`,
                        name: itemName,
                        category: cat,
                        aaya: bacha,
                        openingAaya: bacha,
                        gaya: 0,
                        bacha: bacha,
                        person: personLabel,
                        date: todayStr,
                        karkhanaId: k.id,
                        isOpening: true,
                        note: `📦 Opening Stock (${curSess} Se Aaya)`,
                        timestamp: baseTs + sSeq
                    });

                    pipelineState.stage4_newSanchaHistory.push({
                        id: `shist_open_${cat}_${baseTs}_${sSeq}`,
                        date: todayStr,
                        name: itemName,
                        category: cat,
                        kariger: personLabel !== '-' ? personLabel : '📦 Pichla Bacha Stock',
                        type: `📦 Opening Stock (${curSess} Se Aaya)`,
                        aaya: bacha,
                        gaya: 0,
                        karkhanaId: k.id,
                        isOpening: true,
                        timestamp: baseTs + sSeq
                    });
                }
                await yieldThread();
            }
        }

        // Jobwork: Sirf Workers Master List (bina purane hisab/sheets/bills ke)
        const rawWorkers = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        pipelineState.stage4_oldJwWorkers = rawWorkers
            .filter((w) => w && w.id && w.name)
            .map((w) => ({ ...w }));

        updateProgressUI(4, '✅ Sancha & Job Work Workers Ready', 100, 80, true);
        await yieldThread(30);
    };

    const runStage5_FinalizeCommitAsync = async (curSess, newSess, uId) => {
        updateProgressUI(5, '⏳ Local IndexedDB me Save ho raha hai...', 10, 82);

        const tid = getSafeTenantId(uId);
        const sb = getSupabase();

        // Naye session ke stale cursors saaf karein; curSess ko abhi bilkul touch na karein
        clearSessionDeltaCursors(uId, newSess);

        const generalPayloads = [
            { key: 'kariger_list', data: pipelineState.stage1_oldKarigers },
            { key: 'saree_history', data: pipelineState.stage2_newSareeHistory },
            { key: 'bana_stock', data: pipelineState.stage3_newBanaStock },
            { key: 'bana_history', data: pipelineState.stage3_newBanaHistory },
            { key: 'zari_stock', data: pipelineState.stage3_newZariStock },
            { key: 'zari_history', data: pipelineState.stage3_newZariHistory },
            { key: 'sancha_items', data: pipelineState.stage4_newSanchaItems },
            { key: 'sancha_history', data: pipelineState.stage4_newSanchaHistory },
            { key: 'jobwork_workers', data: pipelineState.stage4_oldJwWorkers }
        ];

        // 1. General stores: IndexedDB + RAM + Snapshot + Await Cloud Delta (with explicit newSess)
        for (let idx = 0; idx < generalPayloads.length; idx++) {
            const { key, data } = generalPayloads[idx];
            const fullKey = `${uId}_${newSess}_${key}`;

            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = data;
            if (typeof window.StorageEngine?.updateRowSnapshot === 'function') {
                window.StorageEngine.updateRowSnapshot(fullKey, data);
            }
            if (typeof window.idbPut === 'function') {
                await window.idbPut(fullKey, data);
            }

            let ok = false;
            if (navigator.onLine && typeof window.CloudEngine?.cloudWriteDelta === 'function') {
                ok = await window.CloudEngine.cloudWriteDelta(fullKey, data, [], newSess);
            }
            if (!ok && data.length > 0) {
                await enqueueDeltaFallback(uId, fullKey, data);
            }

            const pct = 10 + Math.floor(((idx + 1) / generalPayloads.length) * 35);
            updateProgressUI(5, `💾 Core Module ${idx + 1}/${generalPayloads.length} Saved`, pct, 82 + Math.floor(pct * 0.08));
            await yieldThread();
        }

        // 2. Kariger Tani Sheets: Local IndexedDB in chunks + Supabase 200-row batch upsert
        const karigerKeys = Object.keys(pipelineState.stage1_newKarigerSheetsMap);
        const totalKarigers = karigerKeys.length;
        const taniSchema = window.CloudEngine?.ROW_SYNC_SCHEMAS?.tani_sheets;
        const allSqlTaniRows = [];

        for (let i = 0; i < totalKarigers; i += STAGE5_IDB_CHUNK_SIZE) {
            const end = Math.min(i + STAGE5_IDB_CHUNK_SIZE, totalKarigers);

            for (let j = i; j < end; j++) {
                const kId = karigerKeys[j];
                const sheetData = pipelineState.stage1_newKarigerSheetsMap[kId];
                const sourceKey = `kariger_sheets_${kId}`;
                const fullKey = `${uId}_${newSess}_${sourceKey}`;

                if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = sheetData;
                if (typeof window.StorageEngine?.updateRowSnapshot === 'function') {
                    window.StorageEngine.updateRowSnapshot(fullKey, sheetData);
                }
                if (typeof window.idbPut === 'function') {
                    await window.idbPut(fullKey, sheetData);
                }

                if (taniSchema && typeof taniSchema.toSqlRow === 'function') {
                    const ctx = { uid: uId, tid, sess: newSess, sourceKey, shortKey: sourceKey, fullKey };
                    sheetData.forEach((sh) => {
                        allSqlTaniRows.push({
                            fullKey,
                            sheetObj: sh,
                            sqlRow: taniSchema.toSqlRow(sh, ctx)
                        });
                    });
                }
            }

            const localPct = 45 + (totalKarigers > 0 ? Math.floor((end / totalKarigers) * 25) : 25);
            updateProgressUI(5, `💾 Local Save: ${end} / ${totalKarigers} Karigers`, localPct, 89);
            await yieldThread();
        }

        // Supabase 200-row batch upsert for tani_sheets
        const totalSqlRows = allSqlTaniRows.length;
        if (totalSqlRows > 0) {
            for (let i = 0; i < totalSqlRows; i += STAGE5_CLOUD_ROW_CHUNK) {
                const end = Math.min(i + STAGE5_CLOUD_ROW_CHUNK, totalSqlRows);
                const batchItems = allSqlTaniRows.slice(i, end);
                let chunkOk = false;

                if (navigator.onLine && sb && typeof sb.from === 'function') {
                    try {
                        const { error } = await sb
                            .from('tani_sheets')
                            .upsert(batchItems.map((x) => x.sqlRow), { onConflict: 'id' });
                        if (!error) {
                            chunkOk = true;
                        } else {
                            console.error('[SessionClosing tani_sheets batch error]:', error.message);
                        }
                    } catch (err) {
                        console.error('[SessionClosing tani_sheets batch exception]:', err);
                    }
                }

                if (!chunkOk) {
                    for (const item of batchItems) {
                        await enqueueDeltaFallback(uId, item.fullKey, [item.sheetObj]);
                    }
                }

                const cloudPct = 70 + Math.floor((end / totalSqlRows) * 25);
                updateProgressUI(5, `☁️ Cloud Upload: ${end} / ${totalSqlRows} Sheets`, cloudPct, 90 + Math.floor((end / totalSqlRows) * 9));
                await yieldThread();
            }
        }

        // 3. Sabse Aakhri Me: Session List aur Active Session commit karein
        const sessions = window.getAppSessions ? window.getAppSessions().slice() : [];
        if (!sessions.includes(newSess)) sessions.push(newSess);
        sessions.sort();

        safeSetLocalStorage(`${uId}_app_sessions_list`, sessions);
        safeSetLocalStorage(`${uId}_app_active_session`, newSess);
        localStorage.removeItem(`${uId}_app_deleted_sessions`);

        if (window.APP_MEMORY_CACHE) {
            window.APP_MEMORY_CACHE[`${uId}_app_sessions_list`] = sessions;
            window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = newSess;
        }

        if (navigator.onLine && sb && typeof sb.from === 'function') {
            const nowIso = new Date().toISOString();
            try {
                const { error } = await sb.from('app_store').upsert([
                    {
                        id: `${uId}_app_sessions_list`,
                        user_id: uId,
                        tenant_id: tid,
                        session: newSess,
                        data: sessions,
                        key: `${uId}_app_sessions_list`,
                        value: sessions,
                        updated_at: nowIso
                    },
                    {
                        id: `${uId}_app_active_session`,
                        user_id: uId,
                        tenant_id: tid,
                        session: newSess,
                        data: newSess,
                        key: `${uId}_app_active_session`,
                        value: newSess,
                        updated_at: nowIso
                    }
                ], { onConflict: 'id' });
                if (error) {
                    console.error('[SessionClosing app_store upsert error]:', error.message);
                }
            } catch (cErr) {
                console.warn('[SessionClosing app_store upsert]:', cErr);
            }
        }

        updateProgressUI(5, '✅ All Data Committed Successfully', 100, 100, true);
        await yieldThread(80);

        showClosingCelebrationScreen(newSess);
    };

    const showClosingCelebrationScreen = (newSess) => {
        const modal = document.getElementById('session-transfer-modal');
        if (!modal) return;
        const modalBody = modal.querySelector('.modal-body');
        if (!modalBody) return;

        const kCount = pipelineState.stage1_oldKarigers.length;
        const freshPcs = pipelineState.stage2_totFreshPcs;
        const finPcs = pipelineState.stage2_totFinPcs;

        modalBody.innerHTML = `
            <div style="text-align:center; padding:15px;">
                <div style="font-size:55px; margin-bottom:8px;">🎉 ✨ 🚀</div>
                <h2 style="color:#1e3a8a; font-size:22px; font-weight:800; margin-bottom:6px;">NAYA SAAL MUBARAK HO!</h2>
                <p style="color:#059669; font-size:14px; font-weight:700;">Session '${newSess}' 100% Shuru Ho Gaya!</p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:14px; margin:16px 0; text-align:left; font-size:13px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>🧵 <strong>Kariger:</strong> ${kCount} Safe</div>
                    <div>🥻 <strong>Fresh Saree:</strong> ${freshPcs} Pcs</div>
                    <div>✨ <strong>Finished Saree:</strong> ${finPcs} Pcs</div>
                    <div>👷 <strong>Job Workers:</strong> ${pipelineState.stage4_oldJwWorkers.length} Ready</div>
                </div>
                <button type="button" class="btn" style="background:linear-gradient(135deg, #10b981, #059669); font-size:15px; font-weight:bold; padding:12px 24px; border-radius:8px; border:none; color:#ffffff; cursor:pointer;" onclick="completeNewSessionStartup('${newSess}')">🚀 Naye Saal Me Kaam Shuru Karein</button>
            </div>`;

        pipelineState = null;
    };

    /* ========================================================================
       ⭐ GUARANTEED ACTIVE SESSION SWITCH (DIRECT ADVANCEMENT)
       ======================================================================== */
    const completeNewSessionStartup = async (targetSess) => {
        const modal = document.getElementById('session-transfer-modal');
        if (modal) modal.style.display = 'none';

        const uId = getSafeUserId();
        const tid = getSafeTenantId(uId);
        const s = targetSess || pendingTransferNewSession || '2026-2027';

        localStorage.removeItem(`${uId}_app_deleted_sessions`);
        safeSetLocalStorage(`${uId}_app_active_session`, s);
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = s;

        let curSessions = window.getAppSessions ? window.getAppSessions().slice() : [];
        if (!curSessions.includes(s)) curSessions.push(s);
        curSessions.sort();
        safeSetLocalStorage(`${uId}_app_sessions_list`, curSessions);
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[`${uId}_app_sessions_list`] = curSessions;

        const sb = getSupabase();
        if (navigator.onLine && sb && typeof sb.from === 'function') {
            const now = new Date().toISOString();
            try {
                const { error } = await sb.from('app_store').upsert([
                    {
                        id: `${uId}_app_sessions_list`,
                        user_id: uId,
                        tenant_id: tid,
                        session: s,
                        data: curSessions,
                        key: `${uId}_app_sessions_list`,
                        value: curSessions,
                        updated_at: now
                    },
                    {
                        id: `${uId}_app_active_session`,
                        user_id: uId,
                        tenant_id: tid,
                        session: s,
                        data: s,
                        key: `${uId}_app_active_session`,
                        value: s,
                        updated_at: now
                    }
                ], { onConflict: 'id' });
                if (error) {
                    console.error('[SessionClosing startup app_store error]:', error.message);
                }
            } catch (cErr) {
                console.error('[SessionClosing app_store write]:', cErr);
            }
        }

        if (typeof window.clearMemoryCache === 'function') {
            window.clearMemoryCache();
        }

        setTimeout(() => {
            window.location.reload();
        }, 250);
    };

    const sessionClosingAPI = {
        startSequentialYearClosing,
        completeNewSessionStartup,
        safeSetLocalStorage
    };

    Object.keys(sessionClosingAPI).forEach((fnName) => {
        window[fnName] = sessionClosingAPI[fnName];
    });

    window.SessionEngine = Object.assign(window.SessionEngine || {}, sessionClosingAPI);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sessionClosingAPI;
    }
})();
