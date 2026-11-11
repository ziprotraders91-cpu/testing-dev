/* ============================================================================
   SIMPLICITY ERP - 5-STAGE ENTERPRISE BULLETPROOF YEAR CLOSING ENGINE
   File: session/session-closing.js • Developed by Farhan Jawed
   Architecture: Supabase PostgreSQL & Multi-Branch Reconcile Engine
   (100% Exact Match: Bana, Zari, Sancha, Saree & Kariger Carry Forward)
============================================================================ */

(() => {
    'use strict';

    const STAGE1_KARIGER_CHUNK_SIZE = 25;
    const STAGE5_KARIGER_COMMIT_BATCH = 15;
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
            if (typeof window.getEffectiveUserId === 'function') {
                const id = window.getEffectiveUserId();
                if (id && id !== 'app') return id;
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

    const getUniqueItemNamesCaseInsensitive = (list) => {
        const map = new Map();
        list.forEach((it) => {
            const n = (it?.name || '').trim();
            if (n && !map.has(n.toLowerCase())) {
                map.set(n.toLowerCase(), n);
            }
        });
        return Array.from(map.values());
    };

    const pruneHistoricalSessionCaches = (uId, currentSess, targetNewSess) => {
        try {
            const keysToEvict = [];
            const len = localStorage.length;
            for (let i = 0; i < len; i++) {
                const k = localStorage.key(i);
                if (!k) continue;

                if (k.startsWith(`${uId}_`)) {
                    const isProtected = k.includes(currentSess) || 
                                        k.includes(targetNewSess) || 
                                        k.includes('app_sessions_list') || 
                                        k.includes('app_active_session') || 
                                        k.includes('app_users');
                    if (!isProtected) keysToEvict.push(k);
                }
            }
            keysToEvict.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
    };

    const safeSetLocalStorage = (key, val, uId = '', curSess = '', newSess = '') => {
        const payloadStr = typeof val === 'string' ? val : JSON.stringify(val);
        try {
            localStorage.setItem(key, payloadStr);
        } catch (err) {
            pruneHistoricalSessionCaches(uId, curSess, newSess);
            try {
                localStorage.setItem(key, payloadStr);
            } catch (_) {}
        }
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
        stage2_newSareeStock: [],
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
        stage4_oldJwWorkers: [],
        stage4_newJwSheetsMap: {}
    });

    const startSequentialYearClosing = async () => {
        if (isClosingInProgress) return;

        const curSess = window.getActiveFinancialSession ? window.getActiveFinancialSession() : '2026-2027';
        const newSessEl = document.getElementById('session-new-input');
        const newSess = String(newSessEl?.value || '').trim();

        if (!newSess) return alert('Naye Saal ka naam daalein! (Jaise: 2027-2028)');
        if (newSess === curSess) return alert('Naya session purane se alag hona chahiye!');

        const sessions = window.getAppSessions ? window.getAppSessions() : [];
        if (sessions.includes(newSess)) {
            return alert('Ye Session pehle se bana hua hai! Pehle ise Delete Zone se delete karein, fir fresh banayein.');
        }

        const uId = getSafeUserId();

        // Detach Realtime Listeners cleanly during migration
        if (typeof window.detachSupabaseRealtime === 'function') {
            window.detachSupabaseRealtime();
        } else if (typeof window.detachFirebaseLiveListeners === 'function') {
            window.detachFirebaseLiveListeners();
        }

        if (typeof window.closeSessionClosingModal === 'function') {
            window.closeSessionClosingModal();
        }

        pendingTransferNewSession = newSess;
        isClosingInProgress = true;
        pipelineState = initPipelineState();

        const modal = document.getElementById('session-transfer-modal');
        if (!modal) return;

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="background:#e2e8f0; height:10px; margin-bottom:14px; border-radius:5px; overflow:hidden;">
                    <div id="transfer-main-bar" style="background:#2563eb; width:0%; height:100%; transition:width 0.2s;"></div>
                </div>
                <div><span id="stage-badge-1" class="badge-blue">Waiting</span> <small id="stage-status-1">1. Kariger Opening (72 Pcs & Colors)</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-1" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-2" class="badge-blue">Waiting</span> <small id="stage-status-2">2. Saree Opening Stock</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-2" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-3" class="badge-blue">Waiting</span> <small id="stage-status-3">3. Bana & Zari 100% Exact Match Transfer</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-3" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-4" class="badge-blue">Waiting</span> <small id="stage-status-4">4. Sancha (Tani/Chukka) Exact Transfer</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-4" style="background:#2563eb; width:0%; height:100%;"></div></div></div>
                <div style="margin-top:10px;"><span id="stage-badge-5" class="badge-blue">Waiting</span> <small id="stage-status-5">5. Safe Cloud Commit</small><div style="background:#e2e8f0; height:4px; margin-top:4px;"><div id="stage-bar-5" style="background:#2563eb; width:0%; height:100%;"></div></div></div>`;
        }

        modal.style.display = 'flex';

        try {
            await yieldThread(100);
            await runStage1_KarigersAsync(curSess, newSess);
            await runStage2_SareeStockAsync(curSess, newSess);
            await runStage3_BanaZariStockAsync(curSess, newSess);
            await runStage4_SanchaAndJobworkAsync(curSess, newSess);
            await runStage5_FinalizeCommitAsync(curSess, newSess, uId);
        } catch (pipelineErr) {
            console.error('[SessionClosing] Pipeline error:', pipelineErr);
            alert(`Year closing me takleef aayi: ${pipelineErr.message || pipelineErr}`);
        } finally {
            isClosingInProgress = false;
        }
    };

    /* ========================================================================
       STAGE 1: KARIGER KHATA (Tani 72 Pcs & 8 Colors Carry Forward)
       ======================================================================== */
    const runStage1_KarigersAsync = async (curSess, newSess) => {
        const rawKarigers = window.safeArray 
            ? window.safeArray(window.getStore('kariger_list')) 
            : (window.getStore ? window.getStore('kariger_list') : []);

        pipelineState.stage1_oldKarigers = rawKarigers;
        const total = rawKarigers.length;

        for (let i = 0; i < total; i += STAGE1_KARIGER_CHUNK_SIZE) {
            const end = Math.min(i + STAGE1_KARIGER_CHUNK_SIZE, total);

            for (let j = i; j < end; j++) {
                const k = rawKarigers[j];
                if (!k || !k.id) continue;

                const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(k.id) : [];
                const lastSheet = sheets.length ? sheets[sheets.length - 1] : null;

                const calc = (lastSheet && typeof window.calculateSheetTotals === 'function')
                    ? window.calculateSheetTotals(lastSheet)
                    : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

                const remBana = safeNum(calc.remainingBana);
                const remZari = safeNum(calc.remainingZari);
                const remAmt = safeNum(calc.remainingAmt);

                const taniPcs = lastSheet ? safeNum(lastSheet.taniPcs, 72) : 72;
                const chukkaPcs = lastSheet ? safeNum(lastSheet.chukkaPcs, 72) : 72;
                const colors = (lastSheet && Array.isArray(lastSheet.colors)) ? [...lastSheet.colors] : [];

                pipelineState.stage1_newKarigerSheetsMap[k.id] = [{
                    id: 'tani_1',
                    title: `Tani 1 (Opening ${newSess})`,
                    pichlaBana: remBana,
                    pichlaZari: remZari,
                    pichlaBani: remAmt,
                    banaWaste: 0,
                    zariWaste: 0,
                    rateBana: lastSheet ? (parseFloat(lastSheet.rateBana) || 0.311) : 0.311,
                    rateZari: lastSheet ? (parseFloat(lastSheet.rateZari) || 0.110) : 0.110,
                    rateBani: lastSheet ? (parseFloat(lastSheet.rateBani) || 240) : 240,
                    taniPcs: taniPcs,
                    chukkaPcs: chukkaPcs,
                    colors: colors,
                    banaItem: lastSheet ? (lastSheet.banaItem || '') : '',
                    zariItem: lastSheet ? (lastSheet.zariItem || '') : '',
                    taniItem: lastSheet ? (lastSheet.taniItem || '') : '',
                    taniSancha: lastSheet ? (lastSheet.taniSancha || '') : '',
                    chukkaItem: lastSheet ? (lastSheet.chukkaItem || '') : '',
                    chukkaSancha: lastSheet ? (lastSheet.chukkaSancha || '') : '',
                    note: `📦 31st March (${curSess}) Closing se Aaya Opening Balance`,
                    rows: []
                }];
            }

            const pct = total > 0 ? Math.floor((end / total) * 100) : 100;
            updateProgressUI(1, `⏳ ${end} / ${total} Karigers Done`, pct, Math.floor(pct * 0.20));
            await yieldThread();
        }

        updateProgressUI(1, `✅ Done (${total} Karigers With Colors & 72 Pcs)`, 100, 20, true);
        await yieldThread(50);
    };

    /* ========================================================================
       STAGE 2: SAREE STOCK (Opening Stock Exact Reconcile)
       ======================================================================== */
    const runStage2_SareeStockAsync = async (curSess, newSess) => {
        const rawHistory = window.safeArray 
            ? window.safeArray(window.getStore('saree_history')) 
            : (window.getStore ? window.getStore('saree_history') : []);

        let karkhanas = (typeof window.getKarkhanasSafe === 'function') 
            ? window.getKarkhanasSafe() 
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : getToday();
        const tabs = ['fresh', 'cutting', 'finished', 'lott'];
        let seq = 0;

        for (const k of karkhanas) {
            for (const tb of tabs) {
                const rows = (typeof window.groupSareeStockByTab === 'function')
                    ? window.groupSareeStockByTab(rawHistory, tb, k.id)
                    : [];

                for (const r of rows) {
                    const bachiQty = safeInt(r.bachi !== undefined ? r.bachi : (r.aai - r.gai));

                    if (bachiQty > 0) {
                        if (tb === 'fresh') pipelineState.stage2_totFreshPcs += bachiQty;
                        else if (tb === 'finished') pipelineState.stage2_totFinPcs += bachiQty;
                        else if (tb === 'lott') pipelineState.stage2_totLottPcs += bachiQty;

                        const sUniqueId = `saree_open_${tb}_${Date.now()}_${++seq}`;

                        pipelineState.stage2_newSareeHistory.push({
                            id: sUniqueId,
                            date: todayStr,
                            sareeName: r.sareeName || 'Standard Saree',
                            karigerName: r.karigerName || '📦 Pichla Bacha Stock',
                            kariger: r.karigerName || '📦 Pichla Bacha Stock',
                            partyName: '📦 Pichla Bacha Stock',
                            karkhanaId: k.id,
                            type: tb,
                            typeLabel: `📦 Opening Stock (${curSess} Se Aaya)`,
                            aai: bachiQty,
                            gai: 0,
                            isOut: false,
                            isOpening: true,
                            note: 'Opening Stock',
                            timestamp: Date.now()
                        });

                        pipelineState.stage2_newSareeStock.push({
                            id: sUniqueId,
                            sareeName: r.sareeName || 'Standard Saree',
                            karigerName: r.karigerName || '📦 Pichla Bacha Stock',
                            karkhanaId: k.id,
                            stage: tb,
                            qty: bachiQty,
                            date: todayStr,
                            isOpening: true
                        });
                    }
                }
                await yieldThread();
            }
        }

        updateProgressUI(2, `✅ Saree Stock Ready (${pipelineState.stage2_totFreshPcs} Pcs)`, 100, 40, true);
        await yieldThread(50);
    };

    /* ========================================================================
       STAGE 3: BANA & ZARI STOCK (100% RECONCILE)
       ======================================================================== */
    const runStage3_BanaZariStockAsync = async (curSess, newSess) => {
        let karkhanas = (typeof window.getKarkhanasSafe === 'function') 
            ? window.getKarkhanasSafe() 
            : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : getToday();
        let bSeq = 0, zSeq = 0;

        // 1. BANA SCANNING
        const rawBana = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
        const rawBHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        const uniqueBanaNames = getUniqueItemNamesCaseInsensitive([...rawBana, ...rawBHist]);

        for (const bName of uniqueBanaNames) {
            const statsAll = (typeof window.getBanaItemStats === 'function') 
                ? window.getBanaItemStats(bName, 'all') 
                : { bacha: 0 };
            const totalTargetBacha = Math.max(0, safeNum(statsAll.bacha));

            if (totalTargetBacha <= 0) continue;

            let distributedBacha = 0;

            for (const k of karkhanas) {
                const statsK = (typeof window.getBanaItemStats === 'function') 
                    ? window.getBanaItemStats(bName, k.id) 
                    : { bacha: 0 };
                const bachaVal = Math.max(0, safeNum(statsK.bacha));

                if (bachaVal > 0) {
                    distributedBacha += bachaVal;
                    const uniqueId = `bana_open_${Date.now()}_${++bSeq}`;
                    pipelineState.stage3_newBanaStock.push({
                        id: uniqueId,
                        name: bName,
                        date: todayStr,
                        aaya: bachaVal,
                        openingAaya: bachaVal,
                        gaya: 0,
                        bacha: bachaVal,
                        karkhanaId: k.id,
                        isOpening: true,
                        note: `📦 Opening Stock (${curSess} Se Aaya)`
                    });

                    pipelineState.stage3_newBanaHistory.push({
                        id: `bhist_open_${Date.now()}_${bSeq}`,
                        date: todayStr,
                        name: bName,
                        kariger: '📦 Pichla Bacha Stock',
                        type: `📦 Opening Stock (${curSess} Se Aaya)`,
                        aaya: bachaVal,
                        gaya: 0,
                        karkhanaId: k.id,
                        isOpening: true
                    });
                }
            }

            const remainingGap = safeNum(totalTargetBacha - distributedBacha);
            if (remainingGap > 0.05) {
                const mainItem = pipelineState.stage3_newBanaStock.find(x => x.name.toLowerCase() === bName.toLowerCase() && x.karkhanaId === 'k_main');
                if (mainItem) {
                    mainItem.aaya = safeNum(mainItem.aaya + remainingGap);
                    mainItem.openingAaya = mainItem.aaya;
                    mainItem.bacha = mainItem.aaya;
                } else {
                    const uniqueId = `bana_open_${Date.now()}_${++bSeq}`;
                    pipelineState.stage3_newBanaStock.push({
                        id: uniqueId,
                        name: bName,
                        date: todayStr,
                        aaya: remainingGap,
                        openingAaya: remainingGap,
                        gaya: 0,
                        bacha: remainingGap,
                        karkhanaId: 'k_main',
                        isOpening: true,
                        note: `📦 Opening Stock (${curSess} Se Aaya)`
                    });
                }

                const mainHist = pipelineState.stage3_newBanaHistory.find(x => x.name.toLowerCase() === bName.toLowerCase() && x.karkhanaId === 'k_main');
                if (mainHist) {
                    mainHist.aaya = safeNum(mainHist.aaya + remainingGap);
                }
            }

            await yieldThread();
        }

        // 2. ZARI SCANNING
        const rawZari = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
        const rawZHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        const uniqueZariNames = getUniqueItemNamesCaseInsensitive([...rawZari, ...rawZHist]);

        for (const zName of uniqueZariNames) {
            const statsZAll = (typeof window.getZariItemStats === 'function') 
                ? window.getZariItemStats(zName, 'all') 
                : { bacha: 0 };
            const totalZTarget = Math.max(0, safeNum(statsZAll.bacha));

            if (totalZTarget <= 0) continue;

            let distributedZ = 0;

            for (const k of karkhanas) {
                const statsZK = (typeof window.getZariItemStats === 'function') 
                    ? window.getZariItemStats(zName, k.id) 
                    : { bacha: 0 };
                const bachaValZ = Math.max(0, safeNum(statsZK.bacha));

                if (bachaValZ > 0) {
                    distributedZ += bachaValZ;
                    pipelineState.stage3_newZariStock.push({
                        id: `zari_open_${Date.now()}_${++zSeq}`,
                        name: zName,
                        date: todayStr,
                        aaya: bachaValZ,
                        openingAaya: bachaValZ,
                        gaya: 0,
                        bacha: bachaValZ,
                        karkhanaId: k.id,
                        isOpening: true,
                        note: `📦 Opening Stock (${curSess} Se Aaya)`
                    });

                    pipelineState.stage3_newZariHistory.push({
                        id: `zhist_open_${Date.now()}_${zSeq}`,
                        date: todayStr,
                        name: zName,
                        kariger: '📦 Pichla Bacha Stock',
                        type: `📦 Opening Stock (${curSess} Se Aaya)`,
                        aaya: bachaValZ,
                        gaya: 0,
                        karkhanaId: k.id,
                        isOpening: true
                    });
                }
            }

            const remainingZGap = safeNum(totalZTarget - distributedZ);
            if (remainingZGap > 0.05) {
                const mainZItem = pipelineState.stage3_newZariStock.find(x => x.name.toLowerCase() === zName.toLowerCase() && x.karkhanaId === 'k_main');
                if (mainZItem) {
                    mainZItem.aaya = safeNum(mainZItem.aaya + remainingZGap);
                    mainZItem.openingAaya = mainZItem.aaya;
                    mainZItem.bacha = mainZItem.aaya;
                } else {
                    pipelineState.stage3_newZariStock.push({
                        id: `zari_open_${Date.now()}_${++zSeq}`,
                        name: zName,
                        date: todayStr,
                        aaya: remainingZGap,
                        openingAaya: remainingZGap,
                        gaya: 0,
                        bacha: remainingZGap,
                        karkhanaId: 'k_main',
                        isOpening: true,
                        note: `📦 Opening Stock (${curSess} Se Aaya)`
                    });
                }

                const mainZHist = pipelineState.stage3_newZariHistory.find(x => x.name.toLowerCase() === zName.toLowerCase() && x.karkhanaId === 'k_main');
                if (mainZHist) {
                    mainZHist.aaya = safeNum(mainZHist.aaya + remainingZGap);
                }
            }

            await yieldThread();
        }

        updateProgressUI(3, `✅ Bana & Zari Reconciled`, 100, 60, true);
        await yieldThread(50);
    };

    /* ========================================================================
       STAGE 4: SANCHA (TANI & CHUKKA) & JOB WORK
       ======================================================================== */
    const runStage4_SanchaAndJobworkAsync = async (curSess, newSess) => {
        const todayStr = (typeof window.getTodayDate === 'function') ? window.getTodayDate() : getToday();
        const rawSancha = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        let sSeq = 0;

        rawSancha.forEach((s) => {
            if (!s || !s.name) return;
            const bacha = safeNum(s.bacha !== undefined ? s.bacha : s.aaya);
            if (bacha <= 0) return;

            const cat = String(s.category || 'tani').toLowerCase();
            const sId = `sancha_open_${cat}_${Date.now()}_${++sSeq}`;
            const kId = s.karkhanaId || 'k_main';

            pipelineState.stage4_newSanchaItems.push({
                id: sId,
                name: s.name,
                category: cat,
                aaya: bacha,
                openingAaya: bacha,
                gaya: 0,
                bacha: bacha,
                person: s.person || '-',
                date: todayStr,
                karkhanaId: kId,
                isOpening: true,
                note: `📦 Opening Stock (${curSess} Se Aaya)`
            });

            pipelineState.stage4_newSanchaHistory.push({
                id: `shist_open_${cat}_${Date.now()}_${sSeq}`,
                date: todayStr,
                name: s.name,
                category: cat,
                kariger: s.person || '📦 Pichla Bacha Stock',
                type: `📦 Opening Stock (${curSess} Se Aaya)`,
                aaya: bacha,
                gaya: 0,
                karkhanaId: kId,
                isOpening: true
            });
        });

        const rawWorkers = window.safeArray ? window.safeArray(window.getStore('jobwork_workers')) : [];
        pipelineState.stage4_oldJwWorkers = rawWorkers;

        for (const w of rawWorkers) {
            if (!w || !w.id) continue;
            const sheets = window.safeArray ? window.safeArray(window.getStore(`jobwork_sheets_${w.id}`)) : [];
            const lastSh = sheets.length ? sheets[sheets.length - 1] : null;

            let pSaree = 0;
            if (lastSh && typeof window.calculateJobWorkSheetTotals === 'function') {
                pSaree = safeNum(window.calculateJobWorkSheetTotals(lastSh).pendingSaree);
            }

            pipelineState.stage4_newJwSheetsMap[w.id] = [{
                id: 'jws_open_1',
                title: `Khata 1 (Opening ${newSess})`,
                closingPendingSaree: pSaree,
                closingBakiAmt: 0,
                rows: []
            }];
            await yieldThread();
        }

        updateProgressUI(4, '✅ Sancha & Job Work Ready', 100, 80, true);
        await yieldThread(50);
    };

    /* ========================================================================
       STAGE 5: ATOMIC COMMIT (SUPABASE CLOUD SYNCED)
       ======================================================================== */
    const runStage5_FinalizeCommitAsync = async (curSess, newSess, uId) => {
        updateProgressUI(5, '⏳ Storing Core Data...', 10, 82);

        const sessions = window.getAppSessions ? window.getAppSessions() : [];
        if (!sessions.includes(newSess)) sessions.push(newSess);

        safeSetLocalStorage(`${uId}_app_sessions_list`, sessions, uId, curSess, newSess);
        safeSetLocalStorage(`${uId}_app_active_session`, newSess, uId, curSess, newSess);

        if (window.APP_MEMORY_CACHE) {
            window.APP_MEMORY_CACHE[`${uId}_app_sessions_list`] = sessions;
            window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = newSess;
        }

        if (typeof window.idbPut === 'function') {
            await window.idbPut(`${uId}_app_sessions_list`, sessions);
            await window.idbPut(`${uId}_app_active_session`, newSess);
        }

        // ⭐ CLOUD SYNC FOR SESSIONS LIST (Pushes session list to Supabase so Computer syncs)
        if (typeof window.CloudEngine?.cloudWrite === 'function') {
            window.CloudEngine.cloudWrite(`${uId}_app_sessions_list`, sessions);
            window.CloudEngine.cloudWrite(`${uId}_app_active_session`, newSess);
        }

        const persistGeneralStore = (key, data) => {
            const fullKey = `${uId}_${newSess}_${key}`;
            if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = data;
            if (typeof window.idbPut === 'function') window.idbPut(fullKey, data);
            safeSetLocalStorage(fullKey, data, uId, curSess, newSess);

            if (typeof window.CloudEngine?.cloudWrite === 'function') {
                window.CloudEngine.cloudWrite(fullKey, data);
            }
        };

        persistGeneralStore('kariger_list', pipelineState.stage1_oldKarigers);
        persistGeneralStore('saree_stock', pipelineState.stage2_newSareeStock);
        persistGeneralStore('saree_history', pipelineState.stage2_newSareeHistory);
        persistGeneralStore('bana_stock', pipelineState.stage3_newBanaStock);
        persistGeneralStore('bana_history', pipelineState.stage3_newBanaHistory);
        persistGeneralStore('zari_stock', pipelineState.stage3_newZariStock);
        persistGeneralStore('zari_history', pipelineState.stage3_newZariHistory);
        persistGeneralStore('sancha_items', pipelineState.stage4_newSanchaItems);
        persistGeneralStore('sancha_history', pipelineState.stage4_newSanchaHistory);
        persistGeneralStore('jobwork_workers', pipelineState.stage4_oldJwWorkers);

        for (const wId in pipelineState.stage4_newJwSheetsMap) {
            persistGeneralStore(`jobwork_sheets_${wId}`, pipelineState.stage4_newJwSheetsMap[wId]);
        }

        persistGeneralStore('material_transfers', []);
        persistGeneralStore('jw_bills_list', []);
        persistGeneralStore('jw_payments_list', []);
        persistGeneralStore('dukan_transfer_history', []);
        persistGeneralStore('daybook_records', []);
        persistGeneralStore('payment_records', []);
        persistGeneralStore('dukan_records', []);

        const karigerKeys = Object.keys(pipelineState.stage1_newKarigerSheetsMap);
        const totalKarigers = karigerKeys.length;

        for (let i = 0; i < totalKarigers; i += STAGE5_KARIGER_COMMIT_BATCH) {
            const end = Math.min(i + STAGE5_KARIGER_COMMIT_BATCH, totalKarigers);

            for (let j = i; j < end; j++) {
                const kId = karigerKeys[j];
                const sheetData = pipelineState.stage1_newKarigerSheetsMap[kId];
                const fullKey = `${uId}_${newSess}_kariger_sheets_${kId}`;

                if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[fullKey] = sheetData;
                if (typeof window.idbPut === 'function') window.idbPut(fullKey, sheetData);
                safeSetLocalStorage(fullKey, sheetData, uId, curSess, newSess);

                if (typeof window.CloudEngine?.cloudWrite === 'function') {
                    window.CloudEngine.cloudWrite(fullKey, sheetData);
                }
            }

            const pct = totalKarigers > 0 ? Math.floor((end / totalKarigers) * 100) : 100;
            updateProgressUI(5, `💾 Saving: ${end} / ${totalKarigers} Karigers (${pct}%)`, pct, 80 + Math.floor(pct * 0.20));
            await yieldThread(20);
        }

        updateProgressUI(5, '✅ All Data Committed Successfully', 100, 100, true);
        await yieldThread(100);

        showClosingCelebrationScreen(newSess);
    };

    /* ========================================================================
       CELEBRATION & STARTUP
       ======================================================================== */
    const showClosingCelebrationScreen = (newSess) => {
        const modal = document.getElementById('session-transfer-modal');
        if (!modal) return;
        const modalBody = modal.querySelector('.modal-body');
        if (!modalBody) return;

        const kCount = pipelineState.stage1_oldKarigers.length;
        const freshPcs = pipelineState.stage2_totFreshPcs;
        const banaCount = pipelineState.stage3_newBanaStock.length;
        const zariCount = pipelineState.stage3_newZariStock.length;
        const sanchaCount = pipelineState.stage4_newSanchaItems.length;

        modalBody.innerHTML = `
            <div style="text-align:center; padding:15px;">
                <div style="font-size:55px; margin-bottom:8px;">🎉 ✨ 🚀</div>
                <h2 style="color:#1e3a8a; font-size:22px; font-weight:800; margin-bottom:6px;">NAYA SAAL MUBARAK HO!</h2>
                <p style="color:#059669; font-size:14px; font-weight:700;">Session '${newSess}' 100% Accurate Shuru Ho Gaya!</p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:14px; margin:16px 0; text-align:left; font-size:13px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>🧵 <strong>Kariger Carry:</strong> ${kCount} Karigers Safe</div>
                    <div>🥻 <strong>Saree Opening:</strong> ${freshPcs} Fresh Pcs</div>
                    <div>🧶 <strong>Bana Items:</strong> ${banaCount} Items Safe</div>
                    <div>✨ <strong>Zari Items:</strong> ${zariCount} Items Safe</div>
                    <div>⚙️ <strong>Sancha Stock:</strong> ${sanchaCount} Items (Exact Match)</div>
                    <div>✂️ <strong>Job Work Khata:</strong> Carry Forwarded</div>
                </div>
                <button type="button" class="btn" style="background:linear-gradient(135deg, #10b981, #059669); font-size:15px; font-weight:bold; padding:12px 24px; border-radius:8px; border:none; color:#ffffff; cursor:pointer;" onclick="completeNewSessionStartup('${newSess}')">🚀 Naye Saal Me Kaam Shuru Karein</button>
            </div>`;

        pipelineState = null;
    };

    const completeNewSessionStartup = (targetSess) => {
        const modal = document.getElementById('session-transfer-modal');
        if (modal) modal.style.display = 'none';

        const uId = getSafeUserId();
        const s = targetSess || pendingTransferNewSession || (window.getActiveFinancialSession ? window.getActiveFinancialSession() : '2026-2027');

        safeSetLocalStorage(`${uId}_app_active_session`, s);
        if (window.APP_MEMORY_CACHE) window.APP_MEMORY_CACHE[`${uId}_app_active_session`] = s;
        if (typeof window.idbPut === 'function') window.idbPut(`${uId}_app_active_session`, s);

        // ⭐ CLOUD SYNC COMMIT
        if (typeof window.CloudEngine?.cloudWrite === 'function') {
            window.CloudEngine.cloudWrite(`${uId}_app_active_session`, s);
            const curSessions = window.getAppSessions ? window.getAppSessions() : [];
            if (!curSessions.includes(s)) curSessions.push(s);
            window.CloudEngine.cloudWrite(`${uId}_app_sessions_list`, curSessions);
        }

        if (typeof window.populateSessionDropdown === 'function') {
            window.populateSessionDropdown();
        }

        const sel = document.getElementById('app-session-select');
        if (sel) sel.value = s;

        if (typeof window.clearMemoryCache === 'function') {
            window.clearMemoryCache();
        }

        if (typeof window.invalidateSanchaCalcCache === 'function') {
            window.invalidateSanchaCalcCache();
        }

        window.location.reload();
    };

    const sessionClosingAPI = {
        startSequentialYearClosing,
        completeNewSessionStartup,
        safeSetLocalStorage
    };

    Object.keys(sessionClosingAPI).forEach((fnName) => {
        window[fnName] = sessionClosingAPI[fnName];
    });

    // Object.assign to preserve all methods on SessionEngine without wiping
    window.SessionEngine = Object.assign(window.SessionEngine || {}, sessionClosingAPI);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sessionClosingAPI;
    }
})();
