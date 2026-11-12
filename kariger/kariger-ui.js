/* ============================================================================
   SIMPLICITY ERP - WEAVER (KARIGER) UI & SHEET CONTROLLER
   File: kariger/kariger-ui.js • Developed by Farhan Jawed
   Features:
   - Kariger Master with Dynamic Mohalla / Address Box
   - Strict Gatekeeper: No New Sheet without 'Ready' Tani
   - Instant Tani Order Deduction as soon as Sheet is Created
   - Auto-Populates Sancha + Rangai Name into Sancha Box
   - Auto-Fills Bana Color & 8 New Colors into Master Sheet
   - 100% Untouched Manual Wazan System (Sancha Stock Safe)
============================================================================ */

(() => {
    'use strict';

    window.activeKarigerId = null;
    window.activeSheetIndex = 0;
    window.currentKarigerKarkhanaFilter = 'all';
    window.currentKarigerPage = 1;
    window.karigerPageSize = 50;
    window.editingRowIndex = null;

    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = (v !== undefined && v !== null) ? v : '';
    };

    const setText = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (v !== undefined && v !== null) ? v : '';
    };

    const esc = (s) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(s);
        return String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    };

    const safeNum = (val, fallback = 0) => {
        const n = parseFloat(val);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    };

    const sanitizeKarigerList = () => {
        const raw = (typeof window.getStore === 'function') ? window.getStore('kariger_list') : localStorage.getItem('kariger_list');
        const list = window.safeArray ? window.safeArray(raw) : (Array.isArray(raw) ? raw : []);
        return list.filter((k) => k && k.name && String(k.name).trim() !== '');
    };

    const getKarigerAbsentDays = (kId, joinDate) => {
        if (!kId) return 0;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(kId) : [];
        let lastDate = joinDate || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);

        sheets.forEach((sh) => {
            const rows = window.safeArray ? window.safeArray(sh.rows) : [];
            rows.forEach((r) => {
                if (r && r.date && r.date > lastDate) {
                    lastDate = r.date;
                }
            });
        });

        const today = new Date((typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);
        const last = new Date(lastDate);
        const diffTime = today - last;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    /* ========================================================================
       1. NAVIGATION & KARIGER MASTER (WITH MOHALLA BOX INJECTION)
       ------------------------------------------------------------------------
    ======================================================================== */
    const ensureKarigerMohallaField = () => {
        if (document.getElementById('kar-mohalla')) return;

        const mobileInp = document.getElementById('kar-mobile');
        if (!mobileInp) return;

        const container = mobileInp.closest('div') || mobileInp.parentElement;
        if (!container || !container.parentElement) return;

        const wrap = document.createElement('div');
        wrap.id = 'kar-mohalla-wrapper';
        wrap.style.cssText = 'margin-bottom:10px;';
        wrap.innerHTML = `
            <label style="font-size:12px; font-weight:700; color:#374151;">محلہ / پتہ (MOHALLA / ADDRESS):</label><br>
            <input type="text" id="kar-mohalla" placeholder="" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; margin-top:4px; box-sizing:border-box;">
        `;

        container.parentElement.insertBefore(wrap, container.nextSibling);
    };

    const openKarigerModule = () => {
        const dView = document.getElementById('dashboard-view');
        const shView = document.getElementById('kariger-sheet-section');
        const kSec = document.getElementById('kariger-section');
        if (dView) dView.style.display = 'none';
        if (shView) shView.style.display = 'none';
        if (kSec) kSec.style.display = 'block';

        window.currentKarigerPage = 1;
        ensureKarigerMohallaField();
        renderKarigerKarkhanaTabs();
        populateKarigerKarkhanaDropdown();
        renderKarigerTable();
        bindKarigerSearchInput();
    };

    const backToDashboard = () => {
        const kSec = document.getElementById('kariger-section');
        const shSec = document.getElementById('kariger-sheet-section');
        const dView = document.getElementById('dashboard-view');
        if (kSec) kSec.style.display = 'none';
        if (shSec) shSec.style.display = 'none';
        if (dView) dView.style.display = 'block';

        if (typeof window.updateDashboardBadgeTotals === 'function') {
            window.updateDashboardBadgeTotals();
        }
    };

    const renderKarigerKarkhanaTabs = () => {
        const bar = document.getElementById('kariger-karkhana-tabs-bar');
        if (!bar) return;

        const allKarigers = sanitizeKarigerList();
        let karkhanas = (typeof window.getKarkhanasSafe === 'function') ? window.getKarkhanasSafe() : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!karkhanas.length) karkhanas = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        const isAllActive = window.currentKarigerKarkhanaFilter === 'all';
        let html = `<button type="button" class="sheet-tab ${isAllActive ? 'active' : ''}" onclick="switchKarigerKarkhanaTab('all')">👥 Sabhi (${allKarigers.length})</button>`;

        karkhanas.forEach((k) => {
            const count = allKarigers.filter((w) => 
                String(w.karkhanaId) === String(k.id) || (!w.karkhanaId && (k.isDefault || k.id === 'k_main'))
            ).length;
            const isMain = (k.id === 'k_main' || k.isDefault);
            const icon = isMain ? '🏢 ' : '🏭 ';
            const isActive = String(window.currentKarigerKarkhanaFilter) === String(k.id) ? 'active' : '';
            html += `<button type="button" class="sheet-tab ${isActive}" onclick="switchKarigerKarkhanaTab('${esc(k.id)}')">${icon}${esc(k.name)} (${count})</button>`;
        });

        bar.innerHTML = html;
    };

    const switchKarigerKarkhanaTab = (kId) => {
        window.currentKarigerKarkhanaFilter = kId || 'all';
        window.currentKarigerPage = 1;
        renderKarigerKarkhanaTabs();
        populateKarigerKarkhanaDropdown();
        renderKarigerTable();
    };

    const bindKarigerSearchInput = () => {
        const searchInput = document.getElementById('search-kariger-input');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = 'true';
            searchInput.addEventListener('input', () => {
                window.currentKarigerPage = 1;
                renderKarigerTable();
            });
        }
    };

    const filterKariger = () => {
        window.currentKarigerPage = 1;
        renderKarigerTable();
    };

    const renderKarigerTable = () => {
        bindKarigerSearchInput();

        const tbody = document.getElementById('kariger-table-body');
        if (!tbody) return;

        let list = sanitizeKarigerList();

        if (window.currentKarigerKarkhanaFilter !== 'all') {
            list = list.filter((k) => 
                String(k.karkhanaId) === String(window.currentKarigerKarkhanaFilter) || 
                (!k.karkhanaId && window.currentKarigerKarkhanaFilter === 'k_main')
            );
        }

        const searchInput = document.getElementById('search-kariger-input');
        const txt = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (txt) {
            list = list.filter((k) => {
                const kName = k.karkhanaName || ((typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : '');
                return `${k.name || ''} ${k.saree || ''} ${k.mobile || ''} ${k.mohalla || ''} ${kName || ''} ${k.date || ''}`.toLowerCase().includes(txt);
            });
        }

        const absentFilterEl = document.getElementById('kariger-absent-filter');
        const absentFilterVal = parseInt(absentFilterEl ? absentFilterEl.value : 0, 10) || 0;
        if (absentFilterVal > 0) {
            list = list.filter((k) => getKarigerAbsentDays(k.id, k.date) >= absentFilterVal);
        }

        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / window.karigerPageSize) || 1;
        if (window.currentKarigerPage > totalPages) window.currentKarigerPage = totalPages;
        if (window.currentKarigerPage < 1) window.currentKarigerPage = 1;

        const pagBar = document.getElementById('kariger-pagination-bar');
        if (pagBar) {
            if (!totalItems) {
                pagBar.style.display = 'none';
            } else {
                pagBar.style.display = 'flex';
                const startIdx = (window.currentKarigerPage - 1) * window.karigerPageSize + 1;
                const endIdx = Math.min(window.currentKarigerPage * window.karigerPageSize, totalItems);

                pagBar.innerHTML = `
                    <div style="color:#2563eb; font-weight:600;">📊 Dikh rahe hain: ${startIdx} - ${endIdx} (Kul: ${totalItems})</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button type="button" class="quick-btn btn-out" onclick="prevKarigerPage()">◀️ Pichla</button>
                        <span style="background:#fff; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-weight:600;">Page ${window.currentKarigerPage} / ${totalPages}</span>
                        <button type="button" class="quick-btn btn-in" onclick="nextKarigerPage()">Agla ▶️</button>
                    </div>`;
            }
        }

        if (!totalItems) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">Koi Kariger nahi mila${absentFilterVal > 0 ? ` jo ${absentFilterVal} din se absent ho.` : '.'}</td></tr>`;
            return;
        }

        const startIndex = (window.currentKarigerPage - 1) * window.karigerPageSize;
        const pageList = list.slice(startIndex, startIndex + window.karigerPageSize);

        let html = '';
        pageList.forEach((k, idx) => {
            const actualIdx = startIndex + idx + 1;
            const kName = k.karkhanaName || ((typeof window.getKarkhanaNameById === 'function') 
                ? window.getKarkhanaNameById(k.karkhanaId) 
                : 'Main Godown');

            const isMain = (!k.karkhanaId || k.karkhanaId === 'k_main');
            const kBadge = `<span class="badge-blue" style="font-size:11px; background:${isMain ? '#eff6ff' : '#fef3c7'}; color:${isMain ? '#1d4ed8' : '#b45309'}; padding:3px 7px; border-radius:6px;">${isMain ? '🏢 ' : '🏭 '}${esc(kName)}</span>`;

            const absentDays = getKarigerAbsentDays(k.id, k.date);
            let absentBadge = '';
            if (absentDays >= 30) {
                absentBadge = ` <span style="background:#fef2f2; color:#b91c1c; border:1px solid #f87171; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">🔴 ${absentDays} Din Gayab</span>`;
            } else if (absentDays >= 15) {
                absentBadge = ` <span style="background:#fffbeb; color:#b45309; border:1px solid #fcd34d; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">⚠️ ${absentDays} Din Gayab</span>`;
            }

            const mohallaDisplay = k.mohalla ? `<br><small style="color:#64748b; font-size:11px;">📍 ${esc(k.mohalla)}</small>` : '';

            html += `<tr>
                <td>${actualIdx}</td>
                <td>${kBadge}</td>
                <td><strong>${esc(k.name)}</strong>${absentBadge}${mohallaDisplay}</td>
                <td>${esc(k.saree || '-')}</td>
                <td>${esc(k.mobile || '-')}</td>
                <td>${esc(k.date || '-')}</td>
                <td style="text-align:center;">
                    <button type="button" class="sheet-btn" onclick="openKarigerSheet('${esc(k.id)}')">📊 Tani Khata</button> 
                    <button type="button" class="edit-btn" onclick="editKariger('${esc(k.id)}')">✏️</button> 
                    <button type="button" class="delete-btn" onclick="deleteKariger('${esc(k.id)}')">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
    };

    const nextKarigerPage = () => { window.currentKarigerPage++; renderKarigerTable(); };
    const prevKarigerPage = () => { if (window.currentKarigerPage > 1) { window.currentKarigerPage--; renderKarigerTable(); } };

    const populateKarigerKarkhanaDropdown = () => {
        const sel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        if (!sel) return;
        sel.innerHTML = '';
        let kList = (typeof window.getKarkhanasSafe === 'function') ? window.getKarkhanasSafe() : (window.safeArray ? window.safeArray(window.getStore('karkhana_list')) : []);
        if (!kList.length) kList = [{ id: 'k_main', name: 'Main Godown', isDefault: true }];

        kList.forEach((k) => {
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.textContent = `${k.id === 'k_main' ? '🏢 ' : '🏭 '}${k.name}`;
            sel.appendChild(opt);
        });

        if (window.currentKarigerKarkhanaFilter !== 'all') {
            sel.value = window.currentKarigerKarkhanaFilter;
        }
    };

    const toggleKarigerForm = () => {
        const f = document.getElementById('add-kariger-form');
        if (!f) return;
        const isOpening = (f.style.display !== 'block');
        f.style.display = isOpening ? 'block' : 'none';
        if (isOpening) {
            ensureKarigerMohallaField();
            setVal('kar-date', (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);
            setVal('kar-mohalla', '');
            populateKarigerKarkhanaDropdown();
        }
    };

    const saveKariger = () => {
        ensureKarigerMohallaField();
        const editId = (document.getElementById('kar-edit-id')?.value) || '';
        const n = String(document.getElementById('kar-name')?.value || '').trim().toUpperCase();
        const s = String(document.getElementById('kar-saree')?.value || '').trim();
        const m = String(document.getElementById('kar-mobile')?.value || '').trim();
        const moh = String(document.getElementById('kar-mohalla')?.value || '').trim();
        const d = String(document.getElementById('kar-date')?.value || '') || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : '');

        if (!n) return alert('Kariger ka naam zaroori hai!');

        const kSel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        const chosenKid = kSel ? kSel.value : (window.currentKarigerKarkhanaFilter !== 'all' ? window.currentKarigerKarkhanaFilter : 'k_main');
        const kName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(chosenKid) : 'Main Godown';

        let list = sanitizeKarigerList();

        if (editId) {
            const it = list.find((x) => String(x.id) === String(editId));
            if (it) {
                it.name = n;
                it.saree = s;
                it.mobile = m;
                it.mohalla = moh;
                it.date = d;
                it.karkhanaId = chosenKid;
                it.karkhanaName = kName;
            }
        } else {
            list.push({
                id: `kar_${Date.now()}`,
                name: n,
                saree: s,
                mobile: m,
                mohalla: moh,
                date: d,
                karkhanaId: chosenKid,
                karkhanaName: kName
            });
        }

        if (typeof window.setStore === 'function') window.setStore('kariger_list', list);
        toggleKarigerForm();
        renderKarigerKarkhanaTabs();
        renderKarigerTable();
        alert('✅ Kariger safalta-poorvak save ho gaya!');
    };

    const editKariger = (id) => {
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(id));
        if (!k) return;
        const f = document.getElementById('add-kariger-form');
        if (f) f.style.display = 'block';

        ensureKarigerMohallaField();

        setVal('kar-edit-id', k.id);
        setVal('kar-name', k.name);
        setVal('kar-saree', k.saree || '');
        setVal('kar-mobile', k.mobile || '');
        setVal('kar-mohalla', k.mohalla || k.address || k.pata || '');
        setVal('kar-date', k.date || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : ''));

        const kSel = document.getElementById('kar-karkhana') || document.getElementById('kar-karkhana-select');
        if (kSel) kSel.value = k.karkhanaId || 'k_main';
    };

    const deleteKariger = (id) => {
        if (!confirm('Kya is Kariger ko delete karna chahte hain?')) return;
        const list = sanitizeKarigerList().filter((x) => String(x.id) !== String(id));
        if (typeof window.setStore === 'function') window.setStore('kariger_list', list);
        renderKarigerKarkhanaTabs();
        renderKarigerTable();
    };

    /* ========================================================================
       2. LIVE STOCK DISPLAY & DATALISTS
       ------------------------------------------------------------------------
    ======================================================================== */
    const populateSheetDatalists = () => {
        const banaDl = document.getElementById('sheet-bana-dl');
        if (banaDl) {
            banaDl.innerHTML = '';
            const uB = [];
            const rawBana = window.safeArray ? window.safeArray(window.getStore('bana_stock')) : [];
            rawBana.forEach((b) => {
                if (b && b.name && uB.indexOf(b.name.trim().toLowerCase()) === -1) {
                    uB.push(b.name.trim().toLowerCase());
                    const opt = document.createElement('option');
                    opt.value = b.name.trim();
                    banaDl.appendChild(opt);
                }
            });
        }

        const zariDl = document.getElementById('sheet-zari-dl');
        if (zariDl) {
            zariDl.innerHTML = '';
            const uZ = [];
            const rawZari = window.safeArray ? window.safeArray(window.getStore('zari_stock')) : [];
            rawZari.forEach((z) => {
                if (z && z.name && uZ.indexOf(z.name.trim().toLowerCase()) === -1) {
                    uZ.push(z.name.trim().toLowerCase());
                    const opt = document.createElement('option');
                    opt.value = z.name.trim();
                    zariDl.appendChild(opt);
                }
            });
        }

        const taniDl = document.getElementById('sheet-sancha-tani-dl');
        if (taniDl) {
            taniDl.innerHTML = '';
            const uT = [];
            const rawSancha = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            rawSancha.filter((s) => (s?.category || 'tani') === 'tani').forEach((s) => {
                if (s && s.name && uT.indexOf(s.name.trim().toLowerCase()) === -1) {
                    uT.push(s.name.trim().toLowerCase());
                    const opt = document.createElement('option');
                    opt.value = s.name.trim();
                    taniDl.appendChild(opt);
                }
            });
        }

        const chukDl = document.getElementById('sheet-sancha-chukka-dl');
        if (chukDl) {
            chukDl.innerHTML = '';
            const uC = [];
            const rawSancha = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            rawSancha.filter((s) => (s?.category || '') === 'chukka').forEach((s) => {
                if (s && s.name && uC.indexOf(s.name.trim().toLowerCase()) === -1) {
                    uC.push(s.name.trim().toLowerCase());
                    const opt = document.createElement('option');
                    opt.value = s.name.trim();
                    chukDl.appendChild(opt);
                }
            });
        }
    };

    const updateLiveStockDisplay = () => {
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        const bName = String(document.getElementById('line-bana-name')?.value || '').trim();
        const zName = String(document.getElementById('line-zari-name')?.value || '').trim();
        const tName = String(document.getElementById('sheet-tani-item')?.value || '').trim().toLowerCase();
        const cName = String(document.getElementById('sheet-chukka-item')?.value || '').trim().toLowerCase();

        let bBacha = 0;
        if (bName && typeof window.getBanaItemStats === 'function') {
            bBacha = safeNum(window.getBanaItemStats(bName, kGodown).bacha);
        }

        let zBacha = 0;
        if (zName && typeof window.getZariItemStats === 'function') {
            zBacha = safeNum(window.getZariItemStats(zName, kGodown).bacha);
        }

        const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const tItem = sList.find((x) => {
            const matchK = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === tName && matchK;
        });

        const cItem = sList.find((x) => {
            const matchK = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.trim().toLowerCase() === cName && matchK;
        });

        setText('live-bana-stock-badge', `Bacha: ${bBacha.toFixed(2)} Kg`);
        setText('live-zari-stock-badge', `Bacha: ${zBacha.toFixed(2)} Kg`);
        setText('live-tani-stock-badge', `Bacha: ${tItem ? safeNum(tItem.bacha !== undefined ? tItem.bacha : tItem.aaya).toFixed(2) : '0.00'} Kg`);
        setText('live-chukka-stock-badge', `Bacha: ${cItem ? safeNum(cItem.bacha !== undefined ? cItem.bacha : cItem.aaya).toFixed(2) : '0.00'} Kg`);
    };

    /* ========================================================================
       3. TANI KHATA CONTROLLER & STRICT GATEKEEPER
       ------------------------------------------------------------------------
    ======================================================================== */
    const openKarigerSheet = (id) => {
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(id));
        if (!k) return alert('Kariger nahi mila!');

        window.activeKarigerId = k.id;
        window.editingRowIndex = null;

        if (typeof window.syncKarigerSheetLive === 'function') {
            window.syncKarigerSheetLive(k.id);
        } else if (window.CloudEngine && typeof window.CloudEngine.syncKarigerSheetLive === 'function') {
            window.CloudEngine.syncKarigerSheetLive(k.id);
        }

        const kSec = document.getElementById('kariger-section');
        const shSec = document.getElementById('kariger-sheet-section');
        if (kSec) kSec.style.display = 'none';
        if (shSec) shSec.style.display = 'block';

        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        setText('sheet-kariger-title', `${k.name} (${kGodamName}) - Saree: ${k.saree || '-'}`);
        setVal('row-date', (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);

        const waBtn = document.querySelector('button[onclick*="sendKarigerWhatsAppParchi"]');
        if (waBtn && waBtn.parentElement && !document.getElementById('btn-print-kariger-sheet')) {
            const printBtn = document.createElement('button');
            printBtn.id = 'btn-print-kariger-sheet';
            printBtn.type = 'button';
            printBtn.className = 'sheet-btn';
            printBtn.style.cssText = 'background:#1e3a8a; color:#ffffff; padding:6px 12px; font-weight:bold; border-radius:6px; border:none; cursor:pointer; margin-left:6px; display:inline-flex; align-items:center; gap:4px;';
            printBtn.innerHTML = '🖨️ A6 Print Khata';
            printBtn.onclick = () => openKarigerPrintModal();
            waBtn.parentElement.insertBefore(printBtn, waBtn.nextSibling);
        }

        let sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        if (!sheets || !sheets.length) {
            sheets = [{
                id: 'tani_1', title: 'Tani 1',
                pichlaBana: 0, pichlaZari: 0, pichlaBani: 0,
                banaWaste: 0, zariWaste: 0,
                rateBana: 0.311, rateZari: 0.110, rateBani: 240,
                taniPcs: 72, chukkaPcs: 72, colors: [],
                note: '', rows: []
            }];
            if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        }

        window.activeSheetIndex = sheets.length ? sheets.length - 1 : 0;

        populateSheetDatalists();
        renderSheetTabs();
        loadCurrentSheetData();
    };

    const renderSheetTabs = () => {
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const box = document.getElementById('sheet-tabs-container');
        if (!box) return;
        box.innerHTML = '';
        sheets.forEach((sh, idx) => {
            if (!sh) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `sheet-tab ${idx === window.activeSheetIndex ? 'active' : ''}`;
            btn.innerHTML = `${esc(sh.title)}${sheets.length > 1 ? `<span class="del-tab-btn" onclick="deleteTaniSheet(${idx}, event)"> ×</span>` : ''}`;
            btn.onclick = () => switchTaniSheetTab(idx);
            box.appendChild(btn);
        });
    };

    const switchTaniSheetTab = (idx) => {
        window.activeSheetIndex = idx;
        window.editingRowIndex = null;
        const btn = document.getElementById('row-submit-btn');
        if (btn) btn.textContent = '+ Line Jodein & Stock Minus';
        renderSheetTabs();
        loadCurrentSheetData();
    };

    // ⭐ STRICT GATEKEEPER + INSTANT ORDER MINUS
    const addNewTaniSheet = () => {
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kName = kariger ? String(kariger.name || '').trim().toUpperCase() : '';

        // 1. Tani Order me check karein ki kya is kariger ki Ready Tani maujood hai
        const rawOrders = (typeof window.getStore === 'function') ? window.getStore('tani_orders_list') : localStorage.getItem('tani_orders_list');
        const orders = window.safeArray ? window.safeArray(rawOrders) : (Array.isArray(rawOrders) ? rawOrders : []);

        const readyTani = orders.find(o => {
            if (!o) return false;
            const isReady = String(o.status || '').toLowerCase() === 'ready';
            const oKariger = String(o.kariger || '').trim().toUpperCase();
            return isReady && oKariger === kName;
        });

        // Agar Ready nahi hai to aage badhne hi na de (STRICT GATEKEEPER)
        if (!readyTani) {
            return alert(`⚠️ تانی ابھی تیار نہیں ہے!\n\nکاریگر [${kariger?.name || 'Kariger'}] کا نیا تانہ ابھی رنگائی سے تیار ہو کر نہیں آیا ہے (Status: 'Ready' نہیں ہے)۔\n\nپہلے Tani Order & Rangai ماڈیول میں جا کر تانے کو 'Ready' مارک کریں، تبھی نئی شیٹ کھلے گی!`);
        }

        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const cur = sheets[window.activeSheetIndex] || sheets[sheets.length - 1];
        const calc = (cur && typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(cur)
            : { remainingBana: 0, remainingZari: 0, remainingAmt: 0 };

        const nextNum = sheets.length + 1;

        // 2. Naye ready taane ke 8 colors extract karein (purani sheet se copy nahi hoga!)
        const newColors = [];
        if (Array.isArray(readyTani.matchingTable)) {
            readyTani.matchingTable.forEach(m => {
                if (m) newColors.push(m.saree || m.bana || m.border || '');
            });
        }

        // 3. Saancha box me Sancha aur Rangai dono ka naam
        const sanchaRangiCombined = `${readyTani.sancha || ''}${readyTani.rangi ? ' | Rangi: ' + readyTani.rangi : ''}`.trim();

        // 4. ⭐ SHEET BANATE HI TANI ORDER LIST SE TURANT MINUS KARNA (INSTANT DEDUCTION)
        if (window.TaniOrderEngine && typeof window.TaniOrderEngine.markTaniMountedOnLoom === 'function') {
            window.TaniOrderEngine.markTaniMountedOnLoom(readyTani.id, kName);
        } else {
            readyTani.status = 'loom';
            if (!Array.isArray(readyTani.statusHistory)) readyTani.statusHistory = [];
            readyTani.statusHistory.push({
                status: 'loom',
                date: (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0],
                note: `🪡 Kariger ${kName} ne Loom par taana chadha liya (Consumed)`,
                timestamp: Date.now()
            });
            if (typeof window.setStore === 'function') {
                window.setStore('tani_orders_list', orders);
            }
        }

        // 5. Nayi Sheet create karein
        sheets.push({
            id: `tani_${nextNum}`,
            title: `Tani ${nextNum}`,
            pichlaBana: safeNum(calc.remainingBana),
            pichlaZari: safeNum(calc.remainingZari),
            pichlaBani: safeNum(calc.remainingAmt),
            banaWaste: 0,
            zariWaste: 0,
            rateBana: cur ? safeNum(cur.rateBana, 0.311) : 0.311,
            rateZari: cur ? safeNum(cur.rateZari, 0.110) : 0.110,
            rateBani: cur ? safeNum(cur.rateBani, 240) : 240,
            taniPcs: safeNum(readyTani.pcs, 72),
            chukkaPcs: cur ? safeNum(cur.chukkaPcs, 72) : 72,
            taniSancha: sanchaRangiCombined,
            banaItem: readyTani.bana || '',
            colors: newColors,
            linkedTaniOrderId: readyTani.id,
            linkedTaniOrderNo: readyTani.orderNo,
            note: `Tani #${readyTani.orderNo} (Sancha: ${readyTani.sancha || '-'}, Rangi: ${readyTani.rangi || '-'})`,
            rows: []
        });

        if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        window.activeSheetIndex = sheets.length - 1;
        renderSheetTabs();
        loadCurrentSheetData();

        alert(`✅ Tani #${readyTani.orderNo} safalta-poorvak load ho gayi aur Tani Order list se minus ho gayi!\n• Saancha: ${readyTani.sancha || '-'}\n• Rangi: ${readyTani.rangi || '-'}\n• Bana: ${readyTani.bana || '-'}`);
    };

    const revertSanchaStock = (itemName, category, wazan) => {
        if (!itemName || !wazan) return;
        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
        const found = sList.find((x) => {
            const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
            return x && x.name && x.name.toLowerCase() === itemName.toLowerCase() && (x.category || 'tani').toLowerCase() === category.toLowerCase() && matchKid;
        });

        if (found) {
            found.gaya = Math.max(0, safeNum((safeNum(found.gaya) - safeNum(wazan)).toFixed(2)));
            found.bacha = safeNum((safeNum(found.aaya) - found.gaya).toFixed(2));
            if (typeof window.setStore === 'function') window.setStore('sancha_items', sList);
        }
    };

    const deleteTaniSheet = (idx, e) => {
        if (e) e.stopPropagation();
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        if (sheets.length <= 1) return alert('Pehli Tani Sheet delete nahi ho sakti!');
        if (!confirm('Kya is Tani Sheet ko delete karna chahte hain?')) return;

        const delSh = sheets[idx];
        if (delSh) {
            if (delSh.taniItem && safeNum(delSh.taniWazan) > 0) {
                revertSanchaStock(delSh.taniItem, 'tani', safeNum(delSh.taniWazan));
            }
            if (delSh.chukkaItem && safeNum(delSh.chukkaWazan) > 0) {
                revertSanchaStock(delSh.chukkaItem, 'chukka', safeNum(delSh.chukkaWazan));
            }
        }

        sheets.splice(idx, 1);
        if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        window.activeSheetIndex = 0;
        renderSheetTabs();
        loadCurrentSheetData();
    };

    const loadCurrentSheetData = () => {
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex] || sheets[0];
        if (!sh) return;

        setVal('rate-bana-input', (sh.rateBana !== undefined) ? sh.rateBana : 0.311);
        setVal('rate-zari-input', (sh.rateZari !== undefined) ? sh.rateZari : 0.110);
        setVal('rate-bani-input', (sh.rateBani !== undefined) ? sh.rateBani : 240);
        setVal('pichla-bana-input', sh.pichlaBana || 0);
        setVal('pichla-zari-input', sh.pichlaZari || 0);
        setVal('pichla-bani-input', sh.pichlaBani || 0);
        setVal('waste-bana-input', sh.banaWaste || 0);
        setVal('waste-zari-input', sh.zariWaste || 0);

        setVal('line-bana-name', sh.banaItem || '');
        setVal('line-zari-name', sh.zariItem || '');
        setVal('sheet-tani-item', sh.taniItem || '');
        setVal('sheet-tani-sancha', sh.taniSancha || '');
        setVal('sheet-tani-wazan', sh.taniWazan || '');
        setVal('sheet-chukka-item', sh.chukkaItem || '');
        setVal('sheet-chukka-sancha', sh.chukkaSancha || '');
        setVal('sheet-chukka-wazan', sh.chukkaWazan || '');

        setVal('sheet-tani-pcs', (sh.taniPcs !== undefined) ? sh.taniPcs : 72);
        setVal('sheet-chukka-pcs', (sh.chukkaPcs !== undefined) ? sh.chukkaPcs : 72);

        for (let i = 1; i <= 8; i++) {
            setVal(`sheet-color-${i}`, (sh.colors && sh.colors[i - 1]) ? sh.colors[i - 1] : '');
        }

        renderSheetRows(sh);
        updateLiveStockDisplay();
    };

    /* ========================================================================
       ⭐ 4. SAVE CONFIG (MANUAL WAZAN INTACT + TANI ORDER MINUS)
       ------------------------------------------------------------------------
    ======================================================================== */
    const saveCurrentSheetConfig = () => {
        if (!window.activeKarigerId) return;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh) return;

        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kName = kariger ? kariger.name : 'Kariger';
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        sh.rateBana = safeNum(document.getElementById('rate-bana-input')?.value, 0.311);
        sh.rateZari = safeNum(document.getElementById('rate-zari-input')?.value, 0.110);
        sh.rateBani = safeNum(document.getElementById('rate-bani-input')?.value, 240);
        sh.pichlaBana = safeNum(document.getElementById('pichla-bana-input')?.value);
        sh.pichlaZari = safeNum(document.getElementById('pichla-zari-input')?.value);
        sh.pichlaBani = safeNum(document.getElementById('pichla-bani-input')?.value);
        sh.banaWaste = safeNum(document.getElementById('waste-bana-input')?.value);
        sh.zariWaste = safeNum(document.getElementById('waste-zari-input')?.value);

        sh.banaItem = String(document.getElementById('line-bana-name')?.value || '').trim();
        sh.zariItem = String(document.getElementById('line-zari-name')?.value || '').trim();

        sh.taniPcs = safeNum(document.getElementById('sheet-tani-pcs')?.value, 72);
        sh.chukkaPcs = safeNum(document.getElementById('sheet-chukka-pcs')?.value, 72);

        sh.colors = [];
        for (let i = 1; i <= 8; i++) {
            const cVal = String(document.getElementById(`sheet-color-${i}`)?.value || '').trim();
            if (cVal) sh.colors.push(cVal);
        }

        // ⚠️ AAPKI HIYADAT: MANUAL WAZAN SYSTEM 100% SURAKSHIT AUR EXACT HAI
        const oldTaniWazan = safeNum(sh.taniWazan);
        const newTaniWazan = safeNum(document.getElementById('sheet-tani-wazan')?.value);
        const oldChukkaWazan = safeNum(sh.chukkaWazan);
        const newChukkaWazan = safeNum(document.getElementById('sheet-chukka-wazan')?.value);

        const oldTaniItem = sh.taniItem || '';
        const oldChukkaItem = sh.chukkaItem || '';

        sh.taniItem = String(document.getElementById('sheet-tani-item')?.value || '').trim();
        sh.taniSancha = String(document.getElementById('sheet-tani-sancha')?.value || '').trim();
        sh.taniWazan = newTaniWazan;
        sh.chukkaItem = String(document.getElementById('sheet-chukka-item')?.value || '').trim();
        sh.chukkaSancha = String(document.getElementById('sheet-chukka-sancha')?.value || '').trim();
        sh.chukkaWazan = newChukkaWazan;

        // Manual Tani Wazan stock deduction
        if (sh.taniItem && (newTaniWazan !== oldTaniWazan || sh.taniItem !== oldTaniItem)) {
            const sList = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            if (oldTaniItem && oldTaniItem !== sh.taniItem && oldTaniWazan > 0) {
                revertSanchaStock(oldTaniItem, 'tani', oldTaniWazan);
            }
            const tFound = sList.find((x) => {
                const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                return x && x.name && x.name.toLowerCase() === sh.taniItem.toLowerCase() && (x.category || 'tani').toLowerCase() === 'tani' && matchKid;
            });
            if (tFound) {
                const diffT = newTaniWazan - oldTaniWazan;
                tFound.gaya = Math.max(0, safeNum((safeNum(tFound.gaya) + diffT).toFixed(2)));
                tFound.bacha = safeNum((safeNum(tFound.aaya) - tFound.gaya).toFixed(2));
                if (typeof window.setStore === 'function') window.setStore('sancha_items', sList);
            }

            let sHist = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
            const refKey = `${window.activeKarigerId}_${sh.id}_tani`;
            sHist = sHist.filter((h) => !h || h.refId !== refKey);

            if (newTaniWazan > 0) {
                sHist.push({
                    id: `shist_${Date.now()}_t`,
                    refId: refKey,
                    date: (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0],
                    category: 'tani',
                    name: sh.taniItem,
                    kariger: kName,
                    type: 'Kariger Issue (Tani)',
                    aaya: 0,
                    gaya: newTaniWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_history', sHist);
        }

        // Manual Chukka Wazan stock deduction
        if (sh.chukkaItem && (newChukkaWazan !== oldChukkaWazan || sh.chukkaItem !== oldChukkaItem)) {
            const sList2 = window.safeArray ? window.safeArray(window.getStore('sancha_items')) : [];
            if (oldChukkaItem && oldChukkaItem !== sh.chukkaItem && oldChukkaWazan > 0) {
                revertSanchaStock(oldChukkaItem, 'chukka', oldChukkaWazan);
            }
            const cFound = sList2.find((x) => {
                const matchKid = (!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown);
                return x && x.name && x.name.toLowerCase() === sh.chukkaItem.toLowerCase() && (x.category || '').toLowerCase() === 'chukka' && matchKid;
            });
            if (cFound) {
                const diffC = newChukkaWazan - oldChukkaWazan;
                cFound.gaya = Math.max(0, safeNum((safeNum(cFound.gaya) + diffC).toFixed(2)));
                cFound.bacha = safeNum((safeNum(cFound.aaya) - cFound.gaya).toFixed(2));
                if (typeof window.setStore === 'function') window.setStore('sancha_items', sList2);
            }

            let sHist2 = window.safeArray ? window.safeArray(window.getStore('sancha_history')) : [];
            const refKey2 = `${window.activeKarigerId}_${sh.id}_chukka`;
            sHist2 = sHist2.filter((h) => !h || h.refId !== refKey2);

            if (newChukkaWazan > 0) {
                sHist2.push({
                    id: `shist_${Date.now()}_c`,
                    refId: refKey2,
                    date: (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0],
                    category: 'chukka',
                    name: sh.chukkaItem,
                    kariger: kName,
                    type: 'Kariger Issue (Chukka)',
                    aaya: 0,
                    gaya: newChukkaWazan,
                    karkhanaId: kGodown,
                    timestamp: Date.now()
                });
            }
            if (typeof window.setStore === 'function') window.setStore('sancha_history', sHist2);
        }

        // TANI ORDER AUTO-MINUS SYNC
        const linkedId = sh.linkedTaniOrderId || sh.linkedTaniOrderNo;
        if (linkedId) {
            if (window.TaniOrderEngine && typeof window.TaniOrderEngine.markTaniMountedOnLoom === 'function') {
                window.TaniOrderEngine.markTaniMountedOnLoom(linkedId, kName);
            } else {
                const rawOrders = (typeof window.getStore === 'function') ? window.getStore('tani_orders_list') : localStorage.getItem('tani_orders_list');
                const orders = window.safeArray ? window.safeArray(rawOrders) : (Array.isArray(rawOrders) ? rawOrders : []);
                const it = orders.find(x => String(x.id) === String(linkedId) || String(x.orderNo) === String(linkedId));
                if (it) {
                    it.status = 'loom';
                    if (typeof window.setStore === 'function') window.setStore('tani_orders_list', orders);
                }
            }
        }

        if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);
        renderSheetRows(sh);
        updateLiveStockDisplay();
    };

    /* ========================================================================
       5. LINE ROW SAVE / EDIT / DELETE (WITH AUTO ROLLOVER)
       ------------------------------------------------------------------------
    ======================================================================== */
    const saveTaniRow = () => {
        if (!window.activeKarigerId) return alert('Pehle Kariger chunein!');
        let sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh) return;

        const kariger = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const kName = kariger ? kariger.name : 'Kariger';
        const sDesign = (kariger && kariger.saree) ? kariger.saree : 'General Saree';
        const kGodown = kariger ? (kariger.karkhanaId || 'k_main') : 'k_main';

        const d = (document.getElementById('row-date')?.value) || 
                  ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0]);

        const bCone = safeNum(document.getElementById('row-cone')?.value);
        const bLess = safeNum(document.getElementById('row-lesstp')?.value);
        const zQty = safeNum(document.getElementById('row-zariqty')?.value);
        const topi = safeNum(document.getElementById('row-topi')?.value);

        const saree = safeNum(document.getElementById('row-saree')?.value);
        const lott = safeNum(document.getElementById('row-lott')?.value);
        const paid = safeNum(document.getElementById('row-paid')?.value);
        const retB = safeNum(document.getElementById('row-retbana')?.value);
        const retZ = safeNum(document.getElementById('row-retzari')?.value);

        const banaItemName = String(document.getElementById('line-bana-name')?.value || sh.banaItem || '').trim();
        const zariItemName = String(document.getElementById('line-zari-name')?.value || sh.zariItem || '').trim();
        sh.banaItem = banaItemName;
        sh.zariItem = zariItemName;

        const liveTargetInput = document.getElementById('sheet-tani-pcs')?.value;
        const targetTaniPcs = safeNum(liveTargetInput !== undefined && liveTargetInput !== '' ? liveTargetInput : sh.taniPcs, 72);
        sh.taniPcs = targetTaniPcs;

        const nBana = Math.max(0, bCone - bLess);
        const nZari = Math.max(0, zQty - topi);

        const isEditing = (window.editingRowIndex !== null && sh.rows[window.editingRowIndex]);
        const rowId = isEditing ? sh.rows[window.editingRowIndex].id : `row_${Date.now()}`;

        if (isEditing) {
            let sHistOld = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
            sHistOld = sHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
            if (typeof window.setStore === 'function') window.setStore('saree_history', sHistOld);

            let bHistOld = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
            bHistOld = bHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
            if (typeof window.setStore === 'function') window.setStore('bana_history', bHistOld);

            let zHistOld = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
            zHistOld = zHistOld.filter((h) => !h || String(h.refId) !== String(rowId));
            if (typeof window.setStore === 'function') window.setStore('zari_history', zHistOld);
        }

        const rowObj = {
            id: rowId,
            date: d,
            cone: bCone,
            lessTp: bLess,
            netBana: safeNum(nBana.toFixed(2)),
            zariQty: zQty,
            topi: topi,
            netZari: safeNum(nZari.toFixed(2)),
            saree: saree,
            lott: lott,
            paid: paid,
            retBana: retB,
            retZari: retZ,
            banaItem: banaItemName,
            zariItem: zariItemName
        };

        sh.rows = window.safeArray ? window.safeArray(sh.rows) : [];

        let savedIndex = 0;
        if (isEditing) {
            savedIndex = window.editingRowIndex;
            sh.rows[window.editingRowIndex] = rowObj;
            window.editingRowIndex = null;
            const sBtn = document.getElementById('row-submit-btn');
            if (sBtn) sBtn.textContent = '+ Line Jodein & Stock Minus';
        } else {
            savedIndex = sh.rows.length;
            sh.rows.push(rowObj);
        }

        if (typeof window.saveKarigerSheets === 'function') {
            window.saveKarigerSheets(window.activeKarigerId, sheets);
        }

        const freshSaree = Math.max(0, saree - lott);

        if (typeof window.recordSareeFromKariger === 'function') {
            window.recordSareeFromKariger(d, sDesign, kName, kGodown, freshSaree, lott, rowId);
        } else {
            let sHist = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
            sHist = sHist.filter((h) => !h || String(h.refId) !== String(rowId));

            if (freshSaree > 0) {
                sHist.push({
                    id: `saree_${Date.now()}_f`,
                    refId: rowId,
                    date: d,
                    sareeName: sDesign,
                    karigerName: kName,
                    karkhanaId: kGodown,
                    type: 'fresh',
                    typeLabel: 'Fresh Saree (Kariger Sheet)',
                    aai: freshSaree,
                    gai: 0,
                    timestamp: Date.now()
                });
            }

            if (lott > 0) {
                sHist.push({
                    id: `saree_${Date.now()}_l`,
                    refId: rowId,
                    date: d,
                    sareeName: sDesign,
                    karigerName: kName,
                    karkhanaId: kGodown,
                    type: 'lott',
                    typeLabel: 'Lott Saree (Kariger Sheet)',
                    aai: lott,
                    gai: 0,
                    timestamp: Date.now() + 1
                });
            }

            if (typeof window.setStore === 'function') {
                window.setStore('saree_history', sHist);
            }
        }

        if (banaItemName && (nBana > 0 || retB > 0)) {
            const bHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
            bHist.push({
                id: `bhist_${Date.now()}`,
                refId: rowId,
                date: d,
                name: banaItemName,
                kariger: kName,
                type: 'Kariger Issue',
                aaya: retB > 0 ? retB : 0,
                gaya: nBana > 0 ? nBana : 0,
                karkhanaId: kGodown,
                timestamp: Date.now()
            });
            if (typeof window.setStore === 'function') window.setStore('bana_history', bHist);
        }

        if (zariItemName && (nZari > 0 || retZ > 0)) {
            const zHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
            zHist.push({
                id: `zhist_${Date.now()}`,
                refId: rowId,
                date: d,
                name: zariItemName,
                kariger: kName,
                type: 'Kariger Issue',
                aaya: retZ > 0 ? retZ : 0,
                gaya: nZari > 0 ? nZari : 0,
                karkhanaId: kGodown,
                timestamp: Date.now()
            });
            if (typeof window.setStore === 'function') window.setStore('zari_history', zHist);
        }

        setVal('row-saree', '');
        setVal('row-lott', '');
        setVal('row-cone', '');
        setVal('row-lesstp', '');
        setVal('row-zariqty', '');
        setVal('row-topi', '');
        setVal('row-paid', '');
        setVal('row-retbana', '');
        setVal('row-retzari', '');

        const totalsAfter = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(sh)
            : { remainingAmt: 0, remainingBana: 0, remainingZari: 0, totSaree: 0 };

        const deliveredSoFar = safeNum(totalsAfter.totSaree);
        const isLastSheet = (window.activeSheetIndex === sheets.length - 1);
        const savedSheetIndex = window.activeSheetIndex;

        if (!isEditing && isLastSheet && targetTaniPcs > 0 && deliveredSoFar >= targetTaniPcs) {
            alert(`🎉 मुबारक!\n\n${kName} की [${sh.title}] (${targetTaniPcs} साड़ी) पूरी हो गई!\n\nनई तानी जोड़ने के लिए '+ Nayi Tani Sheet' बटन दबाएं (अगर नया ताना तैयार है)।`);
            renderSheetRows(sh);
            updateLiveStockDisplay();
        } else {
            renderSheetRows(sh);
            updateLiveStockDisplay();

            if (confirm('✅ Line jud gayi!\n\nKya aap is le-den ki A6 Thermal Parchi print karna chahte hain?')) {
                printSingleKarigerRowSlip(savedIndex, savedSheetIndex);
            }
        }
    };

    const editTaniRow = (idx) => {
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh || !sh.rows || !sh.rows[idx]) return;
        const r = sh.rows[idx];

        window.editingRowIndex = idx;
        setVal('row-date', r.date || ((typeof window.getTodayDate === 'function') ? window.getTodayDate() : ''));
        setVal('row-cone', r.cone || '');
        setVal('row-lesstp', r.lessTp || '');
        setVal('row-zariqty', r.zariQty || '');
        setVal('row-topi', r.topi || '');
        setVal('row-saree', r.saree || '');
        setVal('row-lott', r.lott || '');
        setVal('row-paid', r.paid || '');
        setVal('row-retbana', r.retBana || '');
        setVal('row-retzari', r.retZari || '');

        const sBtn = document.getElementById('row-submit-btn');
        if (sBtn) sBtn.textContent = '✏️ Update Line';
        window.scrollTo({ top: 350, behavior: 'smooth' });
    };

    const deleteTaniRow = (idx) => {
        if (!confirm('Kya aap is row ko delete karna chahte hain?')) return;
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!sh || !sh.rows || !sh.rows[idx]) return;

        const r = sh.rows[idx];

        let sHist = window.safeArray ? window.safeArray(window.getStore('saree_history')) : [];
        sHist = sHist.filter((h) => !h || String(h.refId) !== String(r.id));
        if (typeof window.setStore === 'function') window.setStore('saree_history', sHist);

        let bHist = window.safeArray ? window.safeArray(window.getStore('bana_history')) : [];
        bHist = bHist.filter((h) => !h || String(h.refId) !== String(r.id));
        if (typeof window.setStore === 'function') window.setStore('bana_history', bHist);

        let zHist = window.safeArray ? window.safeArray(window.getStore('zari_history')) : [];
        zHist = zHist.filter((h) => !h || String(h.refId) !== String(r.id));
        if (typeof window.setStore === 'function') window.setStore('zari_history', zHist);

        sh.rows.splice(idx, 1);
        if (typeof window.saveKarigerSheets === 'function') window.saveKarigerSheets(window.activeKarigerId, sheets);

        renderSheetRows(sh);
        updateLiveStockDisplay();
        alert('🗑️ Line delete ho gayi!');
    };

    /* ========================================================================
       6. 9-COLUMN SHEET ROWS RENDERER & CALCULATIONS
       ------------------------------------------------------------------------
    ======================================================================== */
    const renderSheetRows = (sh) => {
        const tbody = document.getElementById('sheet-table-body');
        if (!tbody) return;

        const rows = window.safeArray ? window.safeArray(sh?.rows) : [];

        let totS = 0, totL = 0, totB = 0, totZ = 0, totP = 0, totRB = 0, totRZ = 0;

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:15px; color:#888;">Is Tani me koi entry nahi hai.</td></tr>';
        } else {
            let html = '';
            rows.forEach((r, idx) => {
                if (!r) return;
                totS  += safeNum(r.saree);
                totL  += safeNum(r.lott);
                totB  += safeNum(r.netBana);
                totZ  += safeNum(r.netZari);
                totP  += safeNum(r.paid);
                totRB += safeNum(r.retBana);
                totRZ += safeNum(r.retZari);

                html += `<tr>
                    <td>${esc(r.date || '-')}</td>
                    <td><strong style="color:#059669;">${r.netBana ? safeNum(r.netBana).toFixed(2) : '-'}</strong></td>
                    <td><strong style="color:#ea580c;">${r.netZari ? safeNum(r.netZari).toFixed(2) : '-'}</strong></td>
                    <td>${safeNum(r.saree)}</td>
                    <td style="color:#dc2626;"><strong>${safeNum(r.lott)}</strong></td>
                    <td style="color:#059669; font-weight:700;">₹ ${safeNum(r.paid)}</td>
                    <td>${safeNum(r.retBana)}</td>
                    <td>${safeNum(r.retZari)}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        <button type="button" title="Is Line Ki Parchi Print" class="sheet-btn" style="background:#0284c7; color:#fff; padding:3px 7px; font-size:11px; font-weight:bold; border-radius:4px; border:none; cursor:pointer;" onclick="printSingleKarigerRowSlip(${idx})">🖨️</button>
                        <button type="button" class="edit-btn" onclick="editTaniRow(${idx})">✏️</button> 
                        <button type="button" class="delete-btn" onclick="deleteTaniRow(${idx})">🗑️</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }

        setText('tot-bana-net', totB.toFixed(2));
        setText('tot-zari-net', totZ.toFixed(2));
        setText('tot-saree', totS);
        setText('tot-lott', totL);
        setText('tot-paid', `₹ ${totP.toFixed(2)}`);
        setText('tot-ret-bana', totRB.toFixed(2));
        setText('tot-ret-zari', totRZ.toFixed(2));

        const c = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(sh)
            : {
                totSaree: 0, totLott: 0, netSaree: 0, grossBani: 0, totPaid: 0, remainingAmt: 0,
                totBana: 0, retBana: 0, banaConsumption: 0, banaWaste: 0, remainingBana: 0,
                totZari: 0, retZari: 0, zariConsumption: 0, zariWaste: 0, remainingZari: 0
            };

        setText('calc-tot-saree', c.totSaree);
        setText('calc-tot-lott', `- ${c.totLott}`);
        setText('calc-net-saree', c.netSaree);
        setText('calc-bani-rate', `₹ ${sh.rateBani !== undefined ? sh.rateBani : 240}`);
        setText('calc-gross-bani', `₹ ${c.grossBani.toFixed(2)}`);
        setText('calc-last-tani-bani', `+ ₹ ${safeNum(sh.pichlaBani).toFixed(2)}`);
        setText('calc-tot-paid', `- ₹ ${c.totPaid.toFixed(2)}`);
        setText('calc-remaining-amt', `₹ ${c.remainingAmt.toFixed(2)}`);

        setText('calc-last-tani-bana', safeNum(sh.pichlaBana).toFixed(2));
        setText('calc-tot-bana', c.totBana.toFixed(2));
        setText('calc-ret-bana', `- ${c.retBana.toFixed(2)}`);
        setText('calc-bana-consumption', c.banaConsumption.toFixed(2));
        setText('calc-bana-wastage', `- ${safeNum(sh.banaWaste).toFixed(2)}`);
        setText('calc-remaining-bana', c.remainingBana.toFixed(2));

        setText('calc-last-tani-zari', safeNum(sh.pichlaZari).toFixed(2));
        setText('calc-tot-zari', c.totZari.toFixed(2));
        setText('calc-ret-zari', `- ${c.retZari.toFixed(2)}`);
        setText('calc-zari-consumption', c.zariConsumption.toFixed(2));
        setText('calc-zari-wastage', `- ${safeNum(sh.zariWaste).toFixed(2)}`);
        setText('calc-remaining-zari', c.remainingZari.toFixed(2));
    };

    /* ========================================================================
       7. PRINT ENGINES & WHATSAPP
       ------------------------------------------------------------------------
    ======================================================================== */
    const printSingleKarigerRowSlip = (idx, sheetIdx = null) => {
        if (!window.activeKarigerId) return alert('Pehle Kariger chunein!');
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const targetSheetIdx = (sheetIdx !== null && sheetIdx !== undefined) ? sheetIdx : window.activeSheetIndex;
        const sh = sheets[targetSheetIdx];
        if (!k || !sh || !sh.rows || !sh.rows[idx]) return alert('Row entry nahi mili!');

        const r = sh.rows[idx];
        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        const sDesign = k.saree || 'General Saree';

        const printWindow = window.open('', '', 'width=420,height=580');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Kariger Parchi - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 11px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 90mm; margin: 0 auto; border: 1.5px dashed #000; padding: 8px; box-sizing: border-box; }
                    .header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { margin-bottom: 8px; font-size: 11px; border-bottom: 1px dashed #666; padding-bottom: 6px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
                    th, td { padding: 4px 2px; text-align: left; border-bottom: 1px dashed #aaa; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 10px; }
                    .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>कारीगर ले-देन पर्ची (RAW MATERIAL & WORK)</p>
                    </div>
                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(k.name)}</span><span><strong>तारीख:</strong> ${esc(r.date || '-')}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(sDesign)}</span><span><strong>खाता:</strong> ${esc(sh.title)}</span></div>
                        <div class="meta-row"><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span><span><strong>मो.:</strong> ${esc(k.mobile || '-')}</span></div>
                    </div>
                    <table>
                        <thead>
                            <tr><th>विवरण (ITEM / DETAIL)</th><th style="text-align:right;">मात्रा / वज़न</th></tr>
                        </thead>
                        <tbody>
                            ${safeNum(r.netBana) > 0 ? `<tr><td>बाना दिया (${esc(r.banaItem || sh.banaItem || 'बाना')})</td><td style="text-align:right; font-weight:bold;">${safeNum(r.netBana).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.netZari) > 0 ? `<tr><td>जरी दिया (${esc(r.zariItem || sh.zariItem || 'जरी')})</td><td style="text-align:right; font-weight:bold;">${safeNum(r.netZari).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.saree) > 0 ? `<tr><td>साड़ी जमा</td><td style="text-align:right; font-weight:bold; color:#059669;">+${safeNum(r.saree)} Pcs</td></tr>` : ''}
                            ${safeNum(r.lott) > 0 ? `<tr><td>लोट साड़ी</td><td style="text-align:right; font-weight:bold; color:#dc2626;">-${safeNum(r.lott)} Pcs</td></tr>` : ''}
                            ${safeNum(r.paid) > 0 ? `<tr><td>मजदूरी दिया (Paid)</td><td style="text-align:right; font-weight:bold; color:#059669;">₹ ${safeNum(r.paid).toFixed(2)}</td></tr>` : ''}
                            ${safeNum(r.retBana) > 0 ? `<tr><td>वापस बाना</td><td style="text-align:right;">${safeNum(r.retBana).toFixed(2)} Kg</td></tr>` : ''}
                            ${safeNum(r.retZari) > 0 ? `<tr><td>वापस जरी</td><td style="text-align:right;">${safeNum(r.retZari).toFixed(2)} Kg</td></tr>` : ''}
                        </tbody>
                    </table>
                    <div class="signs">
                        <div>हस्ताक्षर मुंशी<br><br>___________</div>
                        <div>हस्ताक्षर कारीगर<br><br>___________</div>
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

    const openKarigerPrintModal = () => {
        const existingModal = document.getElementById('kariger-print-options-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="kariger-print-options-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:420px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); overflow:hidden;">
                    <div style="background:#1e3a8a; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">🖨️ Tani Khata Print (A6 Format)</h3>
                        <button type="button" onclick="closeKarigerPrintModal()" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <p style="font-size:13px; color:#374151; margin-top:0;">Aap is Tani Khata ko kis format me print karna chahte hain?</p>
                        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:8px; margin-bottom:15px;">
                            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="chk-include-tani-summary" checked style="margin-top:3px; cursor:pointer;">
                                <div>
                                    <strong style="color:#1e3a8a; font-size:13px;">Niche wali Summary sath me print karein</strong>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">(Gross Mazdoori, Diya, Baaki Rupya, aur Bana/Zari ka bacha wazan sath me aayega)</div>
                                </div>
                            </label>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" onclick="confirmPrintKarigerSheet()" style="background:#1e3a8a; color:#ffffff; border:none; flex:1; padding:10px; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">
                                🚀 Print Shuru Karein
                            </button>
                            <button type="button" onclick="closeKarigerPrintModal()" style="background:#e2e8f0; color:#334155; border:none; padding:10px 14px; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const closeKarigerPrintModal = () => {
        const modal = document.getElementById('kariger-print-options-modal');
        if (modal) modal.remove();
    };

    const confirmPrintKarigerSheet = () => {
        const includeSummary = document.getElementById('chk-include-tani-summary')?.checked ?? true;
        closeKarigerPrintModal();
        printKarigerTaniSheet(includeSummary);
    };

    const printKarigerTaniSheet = (includeSummary = true) => {
        if (!window.activeKarigerId) return alert('Pehle Kariger chunein!');
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!k || !sh) return alert('Khata nahi mila!');

        const kGodamName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(k.karkhanaId) : 'Main Godown';
        const sDesign = k.saree || 'General Saree';
        const today = new Date().toLocaleDateString('hi-IN');
        const rows = window.safeArray ? window.safeArray(sh.rows) : [];

        let totS = 0, totL = 0, totB = 0, totZ = 0, totP = 0, totRB = 0, totRZ = 0;
        let rowsHtml = '';

        rows.forEach((r) => {
            totS  += safeNum(r.saree);
            totL  += safeNum(r.lott);
            totB  += safeNum(r.netBana);
            totZ  += safeNum(r.netZari);
            totP  += safeNum(r.paid);
            totRB += safeNum(r.retBana);
            totRZ += safeNum(r.retZari);

            rowsHtml += `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:3px 1px;">${esc(r.date || '-')}</td>
                    <td style="padding:3px 1px; text-align:right;">${r.netBana ? safeNum(r.netBana).toFixed(2) : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${r.netZari ? safeNum(r.netZari).toFixed(2) : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.saree) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.lott) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.paid) ? `₹${safeNum(r.paid)}` : '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.retBana) || '-'}</td>
                    <td style="padding:3px 1px; text-align:right;">${safeNum(r.retZari) || '-'}</td>
                </tr>`;
        });

        const c = (typeof window.calculateSheetTotals === 'function')
            ? window.calculateSheetTotals(sh)
            : {
                totSaree: totS, totLott: totL, netSaree: totS - totL, grossBani: 0, totPaid: totP, remainingAmt: 0,
                totBana: totB, retBana: totRB, banaConsumption: 0, banaWaste: 0, remainingBana: 0,
                totZari: totZ, retZari: totRZ, zariConsumption: 0, zariWaste: 0, remainingZari: 0
            };

        let summaryHtml = '';
        if (includeSummary) {
            summaryHtml = `
                <div style="margin-top:8px; border-top:1.5px dashed #000; padding-top:4px;">
                    <div style="font-weight:bold; font-size:11px; margin-bottom:3px; background:#f1f5f9; padding:2px 4px; border:1px solid #cbd5e1;">💰 मजदूरी & साड़ी हिसाब</div>
                    <div style="display:flex; justify-content:space-between; font-size:10px;">
                        <span>कुल साड़ी: ${c.totSaree} Pcs | लोट: -${c.totLott} Pcs</span>
                        <span><strong>नेट साड़ी: ${c.netSaree} Pcs</strong></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>बनी रेट: ₹ ${sh.rateBani !== undefined ? sh.rateBani : 240} | पिछली: +₹ ${safeNum(sh.pichlaBani).toFixed(2)}</span>
                        <span>ग्रॉस: ₹ ${c.grossBani.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>दिया गया: -₹ ${c.totPaid.toFixed(2)}</span>
                        <span style="font-size:11px; font-weight:bold; color:#000;">अंतिम बाकी: ₹ ${c.remainingAmt.toFixed(2)}</span>
                    </div>

                    <div style="font-weight:bold; font-size:11px; margin:6px 0 3px; background:#f1f5f9; padding:2px 4px; border:1px solid #cbd5e1;">🧶 कच्चा माल हिसाब (बाना & जरी)</div>
                    <div style="display:flex; justify-content:space-between; font-size:10px;">
                        <span>बाना (खपत: ${c.banaConsumption.toFixed(2)} Kg)</span>
                        <span><strong>बचा बाना: ${c.remainingBana.toFixed(2)} Kg</strong></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
                        <span>जरी (खपत: ${c.zariConsumption.toFixed(2)} Kg)</span>
                        <span><strong>बची जरी: ${c.remainingZari.toFixed(2)} Kg</strong></span>
                    </div>
                </div>`;
        }

        const printWindow = window.open('', '', 'width=450,height=650');
        if (!printWindow) return alert('Popup block hai! Kripya browser me popup allow karein.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Tani Khata - A6</title>
                <style>
                    @page { size: A6 portrait; margin: 4mm; }
                    body { font-family: monospace, sans-serif; font-size: 10px; margin: 0; padding: 4mm; color: #000; }
                    .ticket { width: 100%; max-width: 96mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
                    .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; }
                    .header p { margin: 2px 0 0; font-size: 10px; font-weight: bold; }
                    .meta { font-size: 10px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
                    th { border-top: 1px solid #000; border-bottom: 1px solid #000; text-align: right; padding: 3px 1px; font-size: 9px; }
                    th:first-child { text-align: left; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #aaa; padding-top: 6px; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h2>SIMPLICITY ERP</h2>
                        <p>तानी खाता पर्ची (${esc(sh.title)})</p>
                    </div>
                    <div class="meta">
                        <div class="meta-row"><span><strong>कारीगर:</strong> ${esc(k.name)}</span><span><strong>तारीख:</strong> ${today}</span></div>
                        <div class="meta-row"><span><strong>साड़ी (Design):</strong> ${esc(sDesign)}</span><span><strong>गोदाम:</strong> ${esc(kGodamName)}</span></div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>TARIKH</th><th>BANA</th><th>ZARI</th><th>SAREE</th><th>LOTT</th><th>PAID</th><th>RET.B</th><th>RET.Z</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot>
                            <tr style="border-top:1px solid #000; font-weight:bold;">
                                <td>TOTAL</td>
                                <td style="text-align:right;">${totB.toFixed(2)}</td>
                                <td style="text-align:right;">${totZ.toFixed(2)}</td>
                                <td style="text-align:right;">${totS}</td>
                                <td style="text-align:right;">${totL}</td>
                                <td style="text-align:right;">₹${totP}</td>
                                <td style="text-align:right;">${totRB.toFixed(2)}</td>
                                <td style="text-align:right;">${totRZ.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    ${summaryHtml}
                    <div class="footer">
                        <p>हस्ताक्षर कारीगर: ________________ &nbsp; मुंशी: ________________</p>
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

    const sendKarigerWhatsAppParchi = () => {
        if (!window.activeKarigerId) return;
        const k = sanitizeKarigerList().find((x) => String(x.id) === String(window.activeKarigerId));
        const sheets = (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(window.activeKarigerId) : [];
        const sh = sheets[window.activeSheetIndex];
        if (!k || !sh) return;

        const c = (typeof window.calculateSheetTotals === 'function') ? window.calculateSheetTotals(sh) : {};

        let mob = String(k.mobile || '').trim().replace(/[^0-9]/g, '');
        if (!mob || mob.length < 10) {
            mob = prompt('Kariger ka 10-digit WhatsApp number:', mob);
            if (!mob) return;
            mob = mob.trim().replace(/[^0-9]/g, '');
        }
        if (mob.length === 10) mob = `91${mob}`;

        const msg = `🧵 *SIMPLICITY KARKHANA ERP*\n` +
                    `👤 *कारीगर:* ${k.name}\n` +
                    `📑 *खाता:* ${sh.title}\n` +
                    `🥻 कुल साड़ी: *${c.totSaree || 0} Pcs*\n` +
                    `⚠️ लोट साड़ी: *${c.totLott || 0} Pcs*\n` +
                    `✅ नेट साड़ी: *${c.netSaree || 0} Pcs*\n` +
                    `🧶 बाना बकाया: *${c.remainingBana || 0} Kg*\n` +
                    `✨ जरी बकाया: *${c.remainingZari || 0} Kg*\n` +
                    `💰 कुल मजदूरी: *₹ ${c.grossBani || 0}*\n` +
                    `💵 दिया गया: *₹ ${c.totPaid || 0}*\n` +
                    `🔴 *अंतिम बाकी रुपया: ₹ ${c.remainingAmt || 0}*`;

        window.open(`https://wa.me/${mob}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    /* ========================================================================
       8. GLOBAL EXPORTS
       ------------------------------------------------------------------------
    ======================================================================== */
    const karigerUIAPI = {
        openKarigerModule,
        backToDashboard,
        renderKarigerKarkhanaTabs,
        switchKarigerKarkhanaTab,
        bindKarigerSearchInput,
        filterKariger,
        renderKarigerTable,
        nextKarigerPage,
        prevKarigerPage,
        populateKarigerKarkhanaDropdown,
        toggleKarigerForm,
        saveKariger,
        editKariger,
        deleteKariger,
        populateSheetDatalists,
        updateLiveStockDisplay,
        openKarigerSheet,
        renderSheetTabs,
        switchTaniSheetTab,
        addNewTaniSheet,
        deleteTaniSheet,
        loadCurrentSheetData,
        saveCurrentSheetConfig,
        saveTaniRow,
        editTaniRow,
        deleteTaniRow,
        renderSheetRows,
        printSingleKarigerRowSlip,
        openKarigerPrintModal,
        closeKarigerPrintModal,
        confirmPrintKarigerSheet,
        printKarigerTaniSheet,
        sendKarigerWhatsAppParchi,
        getKarigerAbsentDays,
        sanitizeKarigerList,
        ensureKarigerMohallaField
    };

    Object.keys(karigerUIAPI).forEach((fnName) => {
        window[fnName] = karigerUIAPI[fnName];
    });

    window.KarigerUIEngine = karigerUIAPI;
})();
