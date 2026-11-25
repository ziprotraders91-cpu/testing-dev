/* ============================================================================
   SIMPLICITY ERP - UNIFIED CENTRAL MASTER HUB (CREATE / ALTER / DELETE)
   File: core/central-master.js • Supports: Kariger, JobWork, Work Group, Party, Multi-Firm
   Hardening: Save/Delete Locks • Duplicate Guard • Collision-Free IDs • PWA Safe UI
============================================================================ */

(() => {
    'use strict';

    if (window._centralMasterLoaded) {
        console.warn('[CentralMaster] Already loaded — skip duplicate');
        return;
    }
    window._centralMasterLoaded = true;

    let isSavingTmProfile = false;
    let isDeletingTmProfile = false;

    let tmMode = 'create'; // 'create' | 'alter-list' | 'alter-edit'
    let tmSelectedGroup = 'kariger';
    let tmAlterFilter = 'all';
    let tmAlterActiveIdx = 0;
    let tmReturnCallback = null;

    let tmSheetModalOpen = false;
    let tmActiveSideField = null;
    let tmSideItems = [];
    let tmSideActiveIdx = -1;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));

    const numFb = (v, fb = 0) => {
        if (v === undefined || v === null || String(v).trim() === '') return fb;
        const n = parseFloat(String(v).replace(/,/g, '').trim());
        return isNaN(n) || !isFinite(n) ? fb : n;
    };

    const uidSuffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const getStore = (k) => {
        try {
            if (typeof window.getStore === 'function') return window.getStore(k);
            return JSON.parse(localStorage.getItem(k) || '[]');
        } catch { return []; }
    };
    const setStore = (k, v) => {
        if (typeof window.setStore === 'function') window.setStore(k, v);
        else localStorage.setItem(k, JSON.stringify(v));
    };
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
    const getToday = () => (typeof window.getTodayDate === 'function') ? window.getTodayDate() : new Date().toISOString().split('T')[0];
    const toIso = (d) => {
        if (!d) return new Date().toISOString().split('T')[0];
        const s = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const p = s.split(/[-/]/);
        if (p.length === 3 && p[0].length === 2 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        return new Date().toISOString().split('T')[0];
    };

    const getKarigers = () => (typeof window.sanitizeKarigerList === 'function') ? window.sanitizeKarigerList() : arr(getStore('kariger_list')).filter((k) => k.name);
    const getJobWorkers = () => (typeof window.getJobWorkers === 'function') ? window.getJobWorkers() : arr(getStore('jobwork_workers')).filter((w) => w.name);
    const getParties = () => arr(getStore('dukan_parties')).filter((p) => p.name);

    const getFirms = () => {
        const list = arr(getStore('dukan_firms')).filter((f) => f.name);
        if (list.length) return list;
        const leg = getStore('jobwork_firm_profile');
        if (leg && typeof leg === 'object' && !Array.isArray(leg) && leg.name) {
            const migrated = [{
                id: 'firm_main', name: String(leg.name).trim().toUpperCase(),
                mob: String(leg.mobile || leg.mob || '').trim(), gst: String(leg.gst || '').trim().toUpperCase(),
                address: String(leg.address || '').trim(), city: '', agent: '', email: '', isDefault: true
            }];
            setStore('dukan_firms', migrated);
            return migrated;
        }
        return [];
    };

    const getWorkGroups = () => {
        const def = [
            { key: 'cutting', label: 'Cutting', outstation: false },
            { key: 'embroidery', label: 'Embroidery', outstation: false },
            { key: 'calender', label: 'Calender', outstation: false }
        ];
        const stored = arr(getStore('jobwork_groups'));
        const map = new Map();
        (stored.length ? stored : def).forEach((g) => {
            if (!g?.key) return;
            const k = String(g.key).trim().toLowerCase();
            if (k) map.set(k, { key: k, label: String(g.label || k).trim(), outstation: Boolean(g.outstation) });
        });
        getJobWorkers().forEach((w) => {
            const k = String(w.type || '').trim().toLowerCase();
            if (k && !map.has(k)) map.set(k, { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), outstation: false });
        });
        return Array.from(map.values());
    };

    const grpLabel = (key) => getWorkGroups().find((g) => g.key === String(key || '').toLowerCase())?.label || key;
    const isJwGroup = (key) => getWorkGroups().some((g) => g.key === key);

    const getSheets = (id) => (typeof window.getKarigerSheets === 'function') ? window.getKarigerSheets(id) : arr(getStore(`kariger_sheets_${id}`));
    const saveSheets = (id, sh) => (typeof window.saveKarigerSheets === 'function') ? window.saveKarigerSheets(id, sh) : setStore(`kariger_sheets_${id}`, arr(sh));

    const getKarkhanas = () => {
        const list = (typeof window.getKarkhanasSafe === 'function') ? window.getKarkhanasSafe() : arr(getStore('karkhana_list'));
        return list.length ? list : [{ id: 'k_main', name: 'Main Godown', isDefault: true }];
    };

    const setToast = (m) => { const el = document.getElementById('tm-toast-msg'); if (el) el.textContent = m; };

    /* ========================================================================
       STYLES & KARIGER MASTER SHEET OVERLAY
    ======================================================================== */
    const ensureStyles = () => {
        if (document.getElementById('tm-kariger-sheet-styles')) return;
        const st = document.createElement('style');
        st.id = 'tm-kariger-sheet-styles';
        st.textContent = `
            #tally-master-section input[type="number"]::-webkit-outer-spin-button,
            #tally-master-section input[type="number"]::-webkit-inner-spin-button,
            #tm-kar-sheet-overlay input[type="number"]::-webkit-outer-spin-button,
            #tm-kar-sheet-overlay input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
            .tm-kar-summary-card { background: #fdf6e2; border: 1.5px solid #d9b86c; border-radius: 6px; padding: 9px 11px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
            .tm-kar-summary-card small { display: block; font-size: 11px; color: #92400e; font-weight: 700; margin-top: 2px; }
            #tm-kar-sheet-overlay { position: fixed; inset: 0; z-index: 99990; background: rgba(17,24,39,0.72); backdrop-filter: blur(3px); display: none; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; font-family: 'Inter','Segoe UI',system-ui,sans-serif; }
            #tm-kar-sheet-overlay * { box-sizing: border-box; }
            .tm-so-shell { width: 100%; max-width: 1060px; background: #fff; border: 2px solid #d9b86c; border-radius: 8px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow: hidden; display: flex; flex-direction: column; max-height: 96vh; }
            .tm-so-topbar { background: #fdf6e2; border-bottom: 1.5px solid #e5d5a7; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
            .tm-so-topbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .tm-so-topbar h3 { margin: 0; font-size: 15.5px; font-weight: 800; color: #1f2937; }
            .tm-so-pill { background: #fff; border: 1px solid #d9b86c; color: #92400e; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; }
            .tm-so-grid { display: grid; grid-template-columns: minmax(0,1fr) 290px; flex: 1; min-height: 0; }
            .tm-so-left { padding: 12px 16px; background: #fff; border-right: 1.5px solid #e5d5a7; overflow-y: auto; }
            .tm-so-right { padding: 12px; background: #fdfcf7; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
            .tm-so-sec-lbl { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.45px; color: #92400e; margin: 9px 0 5px; padding-top: 6px; border-top: 1px dashed #e5d5a7; }
            .tm-so-sec-lbl.first { margin-top: 0; padding-top: 0; border-top: none; }
            .tm-so-row-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin-bottom: 6px; }
            .tm-so-row-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-bottom: 6px; }
            .tm-so-sancha-box { background: #fdfcf7; border: 1px solid #e5d5a7; border-radius: 6px; padding: 7px 9px; margin-bottom: 6px; }
            .tm-so-f { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            .tm-so-f label { font-size: 11px; font-weight: 700; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .tm-so-f input, .tm-so-colors input { width: 100%; min-width: 0; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12.5px; font-weight: 700; color: #111827; background: #fff; outline: none; }
            .tm-so-f input:focus, .tm-so-colors input:focus { border-color: #d9a425; background: #fffdf5; box-shadow: 0 0 0 2px rgba(242,183,29,0.22); }
            .tm-so-f input.tm-side-linked { border-color: #d9b86c; background: #fffefb; }
            .tm-so-badge { font-size: 10.5px; font-weight: 700; color: #b47d00; }
            .tm-so-colors { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; }
            .tm-side-box { background: #fff; border: 1.5px solid #d9b86c; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
            .tm-side-head { background: #fdf6e2; color: #1f2937; border-bottom: 1.5px solid #e5d5a7; padding: 8px 11px; font-size: 12.5px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }
            .tm-side-head small { font-size: 10.5px; color: #92400e; font-weight: 700; }
            .tm-side-list { max-height: 340px; overflow-y: auto; }
            .tm-side-opt { padding: 8px 11px; font-size: 12.5px; font-weight: 700; color: #1f2937; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
            .tm-side-opt:hover { background: #fef9ea; }
            .tm-side-opt.selected { background: #f2b71d; color: #1f2937; }
            .tm-side-opt small { font-size: 11px; font-weight: 800; color: #92400e; white-space: nowrap; }
            .tm-side-opt.selected small { color: #1f2937; }
            .tm-so-footer { background: #fdf6e2; border-top: 1px solid #e5d5a7; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11.5px; color: #92400e; font-weight: 700; }
            .tm-btn-del { background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer; }
            .tm-btn-del:hover { background: #fee2e2; }
            @media (max-width: 860px) { .tm-so-grid { grid-template-columns: 1fr; } .tm-so-left { border-right: none; border-bottom: 1.5px solid #e5d5a7; } .tm-so-row-4, .tm-so-colors { grid-template-columns: repeat(2, minmax(0,1fr)); } .tm-so-row-2 { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(st);
    };

    const getSelectedKarkhanaId = () => document.getElementById('tm-karkhana-id')?.value || 'k_main';
    const setSelectedKarkhana = (kId, kName = null) => {
        const list = getKarkhanas();
        const found = list.find((k) => String(k.id) === String(kId)) || list[0];
        const hid = document.getElementById('tm-karkhana-id');
        const disp = document.getElementById('tm-s-karkhana');
        if (hid) hid.value = found ? found.id : 'k_main';
        if (disp) disp.value = kName || (found ? found.name : 'Main Godown');
        updateLiveStockBadges();
    };

    const updateLiveStockBadges = () => {
        const kGodown = getSelectedKarkhanaId();
        const bName = String(document.getElementById('tm-bana-item')?.value || '').trim();
        const zName = String(document.getElementById('tm-zari-item')?.value || '').trim();
        const tName = String(document.getElementById('tm-tani-item')?.value || '').trim().toLowerCase();
        const cName = String(document.getElementById('tm-chukka-item')?.value || '').trim().toLowerCase();

        let bBacha = 0;
        if (bName && typeof window.getBanaItemStats === 'function') bBacha = numFb(window.getBanaItemStats(bName, kGodown).bacha, 0);
        else if (bName) {
            const bIt = arr(getStore('bana_stock')).find((x) => x.name?.trim().toLowerCase() === bName.toLowerCase() && ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
            if (bIt) bBacha = numFb(bIt.bacha, 0);
        }

        let zBacha = 0;
        if (zName && typeof window.getZariItemStats === 'function') zBacha = numFb(window.getZariItemStats(zName, kGodown).bacha, 0);
        else if (zName) {
            const zIt = arr(getStore('zari_stock')).find((x) => x.name?.trim().toLowerCase() === zName.toLowerCase() && ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)));
            if (zIt) zBacha = numFb(zIt.bacha, 0);
        }

        const sList = arr(getStore('sancha_items'));
        const tItem = sList.find((x) => ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)) && x.name?.trim().toLowerCase() === tName && (x.category || 'tani').toLowerCase() === 'tani');
        const cItem = sList.find((x) => ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)) && x.name?.trim().toLowerCase() === cName && (x.category || '').toLowerCase() === 'chukka');

        const setB = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        setB('tm-live-bana-badge', `Bacha: ${bBacha.toFixed(2)} Kg`);
        setB('tm-live-zari-badge', `Bacha: ${zBacha.toFixed(2)} Kg`);
        setB('tm-live-tani-badge', `Bacha: ${tItem ? numFb(tItem.bacha ?? tItem.aaya, 0).toFixed(2) : '0.00'} Kg`);
        setB('tm-live-chukka-badge', `Bacha: ${cItem ? numFb(cItem.bacha ?? cItem.aaya, 0).toFixed(2) : '0.00'} Kg`);
    };

    const updateSummaryStrip = () => {
        const el = document.getElementById('tm-kar-summary-txt');
        if (!el) return;
        const kName = document.getElementById('tm-s-karkhana')?.value || 'Main Godown';
        const rBana = document.getElementById('tm-rate-bana')?.value || '0.311';
        const rZari = document.getElementById('tm-rate-zari')?.value || '0.110';
        const rBani = document.getElementById('tm-rate-bani')?.value || '240';
        const bItem = document.getElementById('tm-bana-item')?.value || '-';
        const zItem = document.getElementById('tm-zari-item')?.value || '-';
        el.textContent = `${kName} · Bana: ${rBana} | Zari: ${rZari} | Bani: ₹${rBani} · Items: ${bItem} / ${zItem}`;
    };

    const getSideOptions = (fieldId, qText = '') => {
        const kGodown = getSelectedKarkhanaId();
        const q = String(qText || '').trim().toLowerCase();
        const items = [];
        if (fieldId === 'tm-s-karkhana') {
            getKarkhanas().forEach((k) => {
                const nm = String(k.name || '').trim();
                if (!q || nm.toLowerCase().includes(q)) items.push({ value: nm, id: k.id, meta: k.isDefault || k.id === 'k_main' ? 'Default' : 'Unit' });
            });
            return items;
        }
        const seen = new Set();
        if (fieldId === 'tm-bana-item') {
            arr(getStore('bana_stock')).forEach((b) => {
                const nm = b.name?.trim() || '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getBanaItemStats === 'function') ? numFb(window.getBanaItemStats(nm, kGodown).bacha, 0) : numFb(b.bacha, 0);
                    if (!q || nm.toLowerCase().includes(q)) items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        } else if (fieldId === 'tm-zari-item') {
            arr(getStore('zari_stock')).forEach((z) => {
                const nm = z.name?.trim() || '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = (typeof window.getZariItemStats === 'function') ? numFb(window.getZariItemStats(nm, kGodown).bacha, 0) : numFb(z.bacha, 0);
                    if (!q || nm.toLowerCase().includes(q)) items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        } else if (fieldId === 'tm-tani-item' || fieldId === 'tm-chukka-item') {
            const cat = fieldId === 'tm-chukka-item' ? 'chukka' : 'tani';
            arr(getStore('sancha_items')).filter((s) => (s.category || 'tani').toLowerCase() === cat).forEach((s) => {
                const nm = s.name?.trim() || '';
                if (nm && !seen.has(nm.toLowerCase())) {
                    seen.add(nm.toLowerCase());
                    const bacha = numFb(s.bacha ?? s.aaya, 0);
                    if (!q || nm.toLowerCase().includes(q)) items.push({ value: nm, meta: `${bacha.toFixed(2)} Kg` });
                }
            });
        }
        return items;
    };

    const renderSideList = (fieldId = null, autoHl = false) => {
        const titleEl = document.getElementById('tm-side-list-title');
        const subEl = document.getElementById('tm-side-list-sub');
        const listEl = document.getElementById('tm-side-list-body');
        if (!titleEl || !listEl) return;
        tmActiveSideField = fieldId;
        const titles = {
            'tm-s-karkhana': 'List of Karkhanas', 'tm-bana-item': 'List of Bana Items',
            'tm-zari-item': 'List of Zari Items', 'tm-tani-item': 'List of Tani Items', 'tm-chukka-item': 'List of Chukka Items'
        };
        if (!fieldId || !titles[fieldId]) {
            tmSideItems = []; tmSideActiveIdx = -1;
            titleEl.textContent = 'Sheet Help & Controls';
            if (subEl) subEl.textContent = 'Tally Mode';
            listEl.innerHTML = `<div style="padding:11px; font-size:12px; color:#4b5563; line-height:1.6;">
                <div><strong>• Enter / ↓ :</strong> Agle box par jayein</div>
                <div><strong>• ↑ / Shift+Enter :</strong> Pichhle box par</div>
                <div><strong>• Ctrl + Enter :</strong> Sheet Confirm karein</div>
                <div><strong>• Esc :</strong> Wapas pichhli screen par</div></div>`;
            return;
        }
        const inp = document.getElementById(fieldId);
        const query = fieldId === 'tm-s-karkhana' ? '' : (inp ? inp.value : '');
        tmSideItems = getSideOptions(fieldId, query);
        titleEl.textContent = titles[fieldId];
        if (subEl) subEl.textContent = `${tmSideItems.length} Available`;
        if (!tmSideItems.length) {
            tmSideActiveIdx = -1;
            listEl.innerHTML = `<div style="padding:16px 11px; text-align:center; color:#9ca3af; font-size:12px;">Koi item nahi mila.<br><small>Manual naam likh kar Enter dabayein.</small></div>`;
            return;
        }
        if (fieldId === 'tm-s-karkhana') {
            const curK = getSelectedKarkhanaId();
            const fi = tmSideItems.findIndex((it) => String(it.id) === String(curK));
            tmSideActiveIdx = fi >= 0 ? fi : 0;
        } else tmSideActiveIdx = (autoHl && query.trim()) ? 0 : -1;

        listEl.innerHTML = tmSideItems.map((it, idx) => `
            <div class="tm-side-opt${idx === tmSideActiveIdx ? ' selected' : ''}" data-sidx="${idx}" onmousedown="event.preventDefault(); tmPickSideItem(${idx});">
                <span>${esc(it.value)}</span><small>${esc(it.meta)}</small>
            </div>`).join('');
    };

    window.tmPickSideItem = (idx) => {
        if (!tmActiveSideField || !tmSideItems[idx]) return;
        const chosen = tmSideItems[idx];
        const inp = document.getElementById(tmActiveSideField);
        if (inp) inp.value = chosen.value;
        if (tmActiveSideField === 'tm-s-karkhana' && chosen.id) setSelectedKarkhana(chosen.id, chosen.value);
        else updateLiveStockBadges();
        const nxtMap = { 'tm-s-karkhana': 'tm-s-saree', 'tm-bana-item': 'tm-zari-item', 'tm-zari-item': 'tm-tani-item', 'tm-tani-item': 'tm-tani-sancha', 'tm-chukka-item': 'tm-chukka-sancha' };
        const nxt = document.getElementById(nxtMap[tmActiveSideField]);
        tmSideActiveIdx = -1;
        if (nxt) { nxt.focus(); if (nxt.select) nxt.select(); }
    };

    const syncSanchaStock = (karId, kName, kGodown, sh, oldSt) => {
        const syncOne = (cat, itemNew, wazanNew, itemOld, wazanOld, label) => {
            const changed = String(itemOld || '').toLowerCase() !== String(itemNew || '').toLowerCase();
            if (wazanNew === wazanOld && !changed) return;
            const sList = arr(getStore('sancha_items'));
            if (itemOld && changed && wazanOld > 0) {
                const fOld = sList.find((x) => ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)) && x.name?.toLowerCase() === itemOld.toLowerCase() && (x.category || 'tani').toLowerCase() === cat);
                if (fOld) { fOld.gaya = Math.max(0, numFb((numFb(fOld.gaya, 0) - wazanOld).toFixed(2), 0)); fOld.bacha = numFb((numFb(fOld.aaya, 0) - fOld.gaya).toFixed(2), 0); }
            }
            if (itemNew) {
                const fNew = sList.find((x) => ((!x.karkhanaId && kGodown === 'k_main') || String(x.karkhanaId) === String(kGodown)) && x.name?.toLowerCase() === itemNew.toLowerCase() && (x.category || 'tani').toLowerCase() === cat);
                if (fNew) {
                    const diff = (itemOld && changed) ? wazanNew : (wazanNew - wazanOld);
                    fNew.gaya = Math.max(0, numFb((numFb(fNew.gaya, 0) + diff).toFixed(2), 0));
                    fNew.bacha = numFb((numFb(fNew.aaya, 0) - fNew.gaya).toFixed(2), 0);
                }
            }
            setStore('sancha_items', sList);
            const refKey = `${karId}_${sh.id}_${cat}`;
            const hist = arr(getStore('sancha_history')).filter((h) => h.refId !== refKey);
            if (itemNew && wazanNew > 0) {
                hist.push({ id: `shist_${uidSuffix()}_${cat[0]}`, refId: refKey, date: toIso(getToday()), category: cat, name: itemNew, kariger: kName, type: `Kariger Issue (${label})`, aaya: 0, gaya: wazanNew, karkhanaId: kGodown, timestamp: Date.now() });
            }
            setStore('sancha_history', hist);
        };
        syncOne('tani', sh.taniItem, numFb(sh.taniWazan, 0), oldSt?.taniItem, numFb(oldSt?.taniWazan, 0), 'Tani');
        syncOne('chukka', sh.chukkaItem, numFb(sh.chukkaWazan, 0), oldSt?.chukkaItem, numFb(oldSt?.chukkaWazan, 0), 'Chukka');
    };

    const ensureSheetOverlayDOM = () => {
        if (document.getElementById('tm-kar-sheet-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'tm-kar-sheet-overlay';
        ov.innerHTML = `
            <div class="tm-so-shell" role="dialog" aria-modal="true">
                <div class="tm-so-topbar">
                    <div class="tm-so-topbar-left">
                        <h3>Kariger Master Sheet Setup</h3>
                        <span class="tm-so-pill" id="tm-so-kar-pill">New Kariger</span>
                        <span class="tm-so-pill" id="tm-sheet-link-badge">Auto-Save: Tani 1</span>
                    </div>
                    <button type="button" class="tm-esc-btn" onclick="tmCloseSheetOverlay(false)">← [Esc] Back</button>
                </div>
                <div class="tm-so-grid">
                    <div class="tm-so-left">
                        <input type="hidden" id="tm-karkhana-id" value="k_main">
                        <div class="tm-so-sec-lbl first">1. Karkhana &amp; Saree Design</div>
                        <div class="tm-so-row-2">
                            <div class="tm-so-f"><label>Karkhana :</label><input type="text" id="tm-s-karkhana" class="tm-side-linked" readonly placeholder="Main Godown"></div>
                            <div class="tm-so-f"><label>Saree Design :</label><input type="text" id="tm-s-saree" placeholder="Jaise: Banarasi Katan" autocomplete="off"></div>
                        </div>
                        <div class="tm-so-sec-lbl">2. Rates &amp; Opening Balance</div>
                        <div class="tm-so-row-4">
                            <div class="tm-so-f"><label>Bana Rate/Saree</label><input type="text" inputmode="decimal" id="tm-rate-bana" value="0.311"></div>
                            <div class="tm-so-f"><label>Zari Rate/Saree</label><input type="text" inputmode="decimal" id="tm-rate-zari" value="0.110"></div>
                            <div class="tm-so-f"><label>Bani/Saree (₹)</label><input type="text" inputmode="decimal" id="tm-rate-bani" value="240"></div>
                            <div class="tm-so-f"><label>Pichla Bana (Kg)</label><input type="text" inputmode="decimal" id="tm-pichla-bana" value="0"></div>
                            <div class="tm-so-f"><label>Pichla Zari (Kg)</label><input type="text" inputmode="decimal" id="tm-pichla-zari" value="0"></div>
                            <div class="tm-so-f"><label>Pichla Bani (₹)</label><input type="text" inputmode="decimal" id="tm-pichla-bani" value="0"></div>
                            <div class="tm-so-f"><label>Bana Waste (Kg)</label><input type="text" inputmode="decimal" id="tm-waste-bana" value="0"></div>
                            <div class="tm-so-f"><label>Zari Waste (Kg)</label><input type="text" inputmode="decimal" id="tm-waste-zari" value="0"></div>
                        </div>
                        <div class="tm-so-sec-lbl">3. Raw Material Items (Side List)</div>
                        <div class="tm-so-row-2">
                            <div class="tm-so-f"><label>1. Bana Item :</label><input type="text" id="tm-bana-item" class="tm-side-linked" autocomplete="off"><small class="tm-so-badge" id="tm-live-bana-badge">Bacha: 0.00 Kg</small></div>
                            <div class="tm-so-f"><label>2. Zari Item :</label><input type="text" id="tm-zari-item" class="tm-side-linked" autocomplete="off"><small class="tm-so-badge" id="tm-live-zari-badge">Bacha: 0.00 Kg</small></div>
                        </div>
                        <div class="tm-so-sec-lbl">4. Sancha Selection (Tani &amp; Chukka)</div>
                        <div class="tm-so-sancha-box"><div class="tm-so-row-4" style="margin-bottom:0;">
                            <div class="tm-so-f"><label>3. Tani Item :</label><input type="text" id="tm-tani-item" class="tm-side-linked" autocomplete="off"><small class="tm-so-badge" id="tm-live-tani-badge">Bacha: 0.00 Kg</small></div>
                            <div class="tm-so-f"><label>Sancha Name :</label><input type="text" id="tm-tani-sancha" autocomplete="off"></div>
                            <div class="tm-so-f"><label>Wazan (Kg) :</label><input type="text" inputmode="decimal" id="tm-tani-wazan" placeholder="0.00"></div>
                            <div class="tm-so-f"><label>Tani Saree (Pcs) :</label><input type="text" inputmode="decimal" id="tm-tani-pcs" value="72"></div>
                        </div></div>
                        <div class="tm-so-sancha-box"><div class="tm-so-row-4" style="margin-bottom:0;">
                            <div class="tm-so-f"><label>4. Chukka Item :</label><input type="text" id="tm-chukka-item" class="tm-side-linked" autocomplete="off"><small class="tm-so-badge" id="tm-live-chukka-badge">Bacha: 0.00 Kg</small></div>
                            <div class="tm-so-f"><label>Sancha Name :</label><input type="text" id="tm-chukka-sancha" autocomplete="off"></div>
                            <div class="tm-so-f"><label>Wazan (Kg) :</label><input type="text" inputmode="decimal" id="tm-chukka-wazan" placeholder="0.00"></div>
                            <div class="tm-so-f"><label>Chukka Saree (Pcs) :</label><input type="text" inputmode="decimal" id="tm-chukka-pcs" value="72"></div>
                        </div></div>
                        <div class="tm-so-sec-lbl">5. Tani Ke 8 Colors (Optional)</div>
                        <div class="tm-so-colors">
                            <input id="tm-color-1" placeholder="1. Rani"><input id="tm-color-2" placeholder="2. Lal"><input id="tm-color-3" placeholder="3. Mehendi"><input id="tm-color-4" placeholder="4. Blue">
                            <input id="tm-color-5" placeholder="5. Peela"><input id="tm-color-6" placeholder="6. Wine"><input id="tm-color-7" placeholder="7. Firozi"><input id="tm-color-8" placeholder="8. Mungia">
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:10px; border-top:1.5px solid #efe4c4;">
                            <button type="button" class="tm-esc-btn" onclick="tmCloseSheetOverlay(false)">← Back [Esc]</button>
                            <button type="button" class="tm-btn-yes" onclick="tmConfirmSheetOverlay()">Done &amp; Continue [Ctrl+Enter]</button>
                        </div>
                    </div>
                    <div class="tm-so-right">
                        <div class="tm-side-box">
                            <div class="tm-side-head"><span id="tm-side-list-title">List of Items</span><small id="tm-side-list-sub">Select</small></div>
                            <div class="tm-side-list" id="tm-side-list-body"></div>
                        </div>
                    </div>
                </div>
                <div class="tm-so-footer"><span>[Enter / ↓] Agla Box · [↑ ↓] Side List · [Ctrl+Enter] Confirm</span><span>Kariger Master Sheet</span></div>
            </div>
        `;
        document.body.appendChild(ov);
        const sideIds = ['tm-s-karkhana', 'tm-bana-item', 'tm-zari-item', 'tm-tani-item', 'tm-chukka-item'];
        sideIds.forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('focus', () => renderSideList(fid, false));
            el.addEventListener('click', () => renderSideList(fid, false));
            el.addEventListener('input', () => { updateLiveStockBadges(); renderSideList(fid, true); });
        });
        ov.querySelectorAll('input').forEach((el) => {
            if (!sideIds.includes(el.id)) el.addEventListener('focus', () => renderSideList(null, false));
        });
    };

    window.tmOpenSheetOverlay = (focusFirst = true) => {
        ensureStyles(); ensureSheetOverlayDOM();
        tmSheetModalOpen = true;
        const pill = document.getElementById('tm-so-kar-pill');
        if (pill) pill.textContent = (document.getElementById('tm-name')?.value || '').trim().toUpperCase() || 'NEW KARIGER';
        const sec = document.getElementById('tally-master-section');
        if (sec) sec.style.visibility = 'hidden';
        const ov = document.getElementById('tm-kar-sheet-overlay');
        if (ov) ov.style.display = 'flex';
        updateLiveStockBadges();
        renderSideList('tm-s-karkhana', false);
        if (focusFirst) setTimeout(() => document.getElementById('tm-s-karkhana')?.focus(), 30);
    };

    window.tmCloseSheetOverlay = (advance = false) => {
        tmSheetModalOpen = false;
        const ov = document.getElementById('tm-kar-sheet-overlay');
        if (ov) ov.style.display = 'none';
        const sec = document.getElementById('tally-master-section');
        if (sec) sec.style.visibility = 'visible';
        updateSummaryStrip();
        if (advance) {
            setToast('✅ Kariger Master Sheet set! Mobile/Address bharein ya [Ctrl+Enter] se Save karein.');
            setTimeout(() => document.getElementById('tm-mobile')?.focus(), 30);
        } else {
            setTimeout(() => document.getElementById(tmMode === 'alter-edit' ? 'tm-name' : 'tm-group')?.focus(), 30);
        }
    };
    window.tmConfirmSheetOverlay = () => window.tmCloseSheetOverlay(true);

    const resetSheetInputs = () => {
        const setV = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
        const navK = document.getElementById('app-karkhana-select')?.value;
        setSelectedKarkhana((navK && navK !== 'all') ? navK : 'k_main');
        setV('tm-s-saree', ''); setV('tm-rate-bana', '0.311'); setV('tm-rate-zari', '0.110'); setV('tm-rate-bani', '240');
        setV('tm-pichla-bana', '0'); setV('tm-pichla-zari', '0'); setV('tm-pichla-bani', '0'); setV('tm-waste-bana', '0'); setV('tm-waste-zari', '0');
        setV('tm-bana-item', ''); setV('tm-zari-item', ''); setV('tm-tani-item', ''); setV('tm-tani-sancha', ''); setV('tm-tani-wazan', ''); setV('tm-tani-pcs', '72');
        setV('tm-chukka-item', ''); setV('tm-chukka-sancha', ''); setV('tm-chukka-wazan', ''); setV('tm-chukka-pcs', '72');
        for (let i = 1; i <= 8; i++) setV(`tm-color-${i}`, '');
        const p = document.getElementById('tm-sheet-link-badge'); if (p) p.textContent = 'Auto-Save: Tani 1';
        updateLiveStockBadges(); updateSummaryStrip();
    };

    const loadSheetInputs = (karId, prof = null) => {
        resetSheetInputs();
        if (prof) {
            setSelectedKarkhana(prof.karkhanaId || 'k_main', prof.karkhanaName || null);
            const sEl = document.getElementById('tm-s-saree'); if (sEl) sEl.value = prof.saree || '';
        }
        const shs = getSheets(karId); const sh = shs.length ? shs[shs.length - 1] : null;
        if (!sh) return;
        const setV = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
        setV('tm-rate-bana', sh.rateBana ?? 0.311); setV('tm-rate-zari', sh.rateZari ?? 0.110); setV('tm-rate-bani', sh.rateBani ?? 240);
        setV('tm-pichla-bana', sh.pichlaBana || 0); setV('tm-pichla-zari', sh.pichlaZari || 0); setV('tm-pichla-bani', sh.pichlaBani || 0);
        setV('tm-waste-bana', sh.banaWaste || 0); setV('tm-waste-zari', sh.zariWaste || 0);
        setV('tm-bana-item', sh.banaItem || ''); setV('tm-zari-item', sh.zariItem || '');
        setV('tm-tani-item', sh.taniItem || ''); setV('tm-tani-sancha', sh.taniSancha || ''); setV('tm-tani-wazan', sh.taniWazan || ''); setV('tm-tani-pcs', sh.taniPcs ?? 72);
        setV('tm-chukka-item', sh.chukkaItem || ''); setV('tm-chukka-sancha', sh.chukkaSancha || ''); setV('tm-chukka-wazan', sh.chukkaWazan || ''); setV('tm-chukka-pcs', sh.chukkaPcs ?? 72);
        for (let i = 1; i <= 8; i++) setV(`tm-color-${i}`, sh.colors?.[i - 1] || '');
        const p = document.getElementById('tm-sheet-link-badge'); if (p) p.textContent = `Linked Sheet: ${sh.title || 'Tani 1'}`;
        updateLiveStockBadges(); updateSummaryStrip();
    };

    /* ========================================================================
       CENTRAL DOM & DYNAMIC GROUPS RENDERING
    ======================================================================== */
    const renderRightGroupList = () => {
        const box = document.getElementById('tm-group-list');
        if (!box) return;
        const groups = getWorkGroups();
        const list = [
            { grp: 'kariger', label: 'Kariger (Weaver)', tag: 'Kariger + F9 Sheet' },
            ...groups.map((g) => ({ grp: g.key, label: g.label, tag: g.outstation ? 'JobWork · Bill+Slip' : 'JobWork' })),
            { grp: 'dukan_party', label: 'Dukan Party (Buyer)', tag: 'Buyer / Sale' },
            { grp: 'dukan_firm', label: 'Firm / Company', tag: 'Billing (2-3 Firms)' },
            { grp: 'work_group', label: '+ New Work Group', tag: 'Stone, Jhalar...' }
        ];
        box.innerHTML = list.map((it) => `
            <div class="tm-group-opt ${it.grp === tmSelectedGroup ? 'selected' : ''}" data-grp="${esc(it.grp)}" data-label="${esc(it.label)}" onclick="tmPickGroup('${esc(it.grp)}', true)">
                <span>${esc(it.label)}</span><small>${esc(it.tag)}</small>
            </div>`).join('');
    };

    const updateCountsBar = () => {
        const el = document.getElementById('tm-live-counts');
        if (el) el.textContent = `Kariger: ${getKarigers().length} · JobWorkers: ${getJobWorkers().length} · Parties: ${getParties().length} · Firms: ${getFirms().length}`;
    };

    window.initCentralMasterDOM = () => {
        ensureStyles(); ensureSheetOverlayDOM();
        const sec = document.getElementById('tally-master-section');
        if (!sec || sec.dataset.tmInitialized === '1') return;

        sec.innerHTML = `
            <div class="tm-topbar">
                <div class="tm-topbar-left">
                    <h2 id="tm-screen-title">Central Master Hub (Tally Style)</h2>
                    <div class="tm-mode-tabs">
                        <button type="button" class="tm-tab-btn active" id="tm-tab-create" onclick="openTallyCreateModule(null, null)">+ Create</button>
                        <button type="button" class="tm-tab-btn" id="tm-tab-alter" onclick="openTallyAlterModule('all', null)">✏️ Alter / Delete</button>
                    </div>
                </div>
                <button type="button" class="tm-esc-btn" onclick="tmHandleEscKey()">← [Esc] Back</button>
            </div>

            <div id="tm-alter-view" class="tm-alter-wrap" style="display:none;">
                <div class="tm-alter-controls">
                    <input type="text" id="tm-alter-search" class="tm-alter-search" placeholder="🔍 Naam, Mobile, City, GST ya Group search karein..." autocomplete="off">
                    <div class="tm-alter-pills">
                        <button type="button" class="tm-tab-btn active" data-tm-filter="all" onclick="tmSetAlterFilter('all')">Sabhi</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="kariger" onclick="tmSetAlterFilter('kariger')">Kariger</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="jobwork" onclick="tmSetAlterFilter('jobwork')">JobWork</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="work_group" onclick="tmSetAlterFilter('work_group')">Work Group</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="dukan_party" onclick="tmSetAlterFilter('dukan_party')">Dukan Party</button>
                        <button type="button" class="tm-tab-btn" data-tm-filter="dukan_firm" onclick="tmSetAlterFilter('dukan_firm')">Firm</button>
                    </div>
                </div>
                <div class="tm-alter-list" id="tm-alter-list"></div>
            </div>

            <div id="tm-form-view">
                <div class="tm-form-grid">
                    <div class="tm-left-pane">
                        <input type="hidden" id="tm-edit-id"><input type="hidden" id="tm-edit-source">
                        <div class="tm-row"><label id="tm-name-lbl">Name :</label><input type="text" id="tm-name" placeholder="Jaise: FARHAN / SHARMA SILK" autocomplete="off"></div>
                        <div class="tm-row"><label>Under (Group) :</label><input type="text" id="tm-group" placeholder="Kariger / Cutting / Party / Firm / Work Group..." autocomplete="off"></div>

                        <div id="tm-kariger-fields" class="tm-divider" style="display:none;">
                            <div class="tm-sec-lbl">Kariger Master Sheet (Auto-Linked)</div>
                            <div class="tm-kar-summary-card">
                                <div><strong style="font-size:12.5px;">Tani 1 Master Sheet Details</strong><small id="tm-kar-summary-txt">Main Godown · Bana: 0.311 | Zari: 0.110 | Bani: ₹240</small></div>
                                <button type="button" class="tm-btn-yes" style="padding:5px 11px; font-size:11.5px;" onclick="tmOpenSheetOverlay(true)">Open Sheet Form [F9]</button>
                            </div>
                        </div>

                        <div id="tm-workgroup-fields" class="tm-divider" style="display:none;">
                            <div class="tm-sec-lbl">Work Group Settings</div>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12.5px; font-weight:700; background:#fffbeb; border:1px solid #fde68a; padding:9px 11px; border-radius:6px;">
                                <input type="checkbox" id="tm-wg-outstation">
                                Outstation Bill + Packing Slip Chahiye (Transport, JW No., Design)
                            </label>
                        </div>

                        <div id="tm-jw-group-edit-row" class="tm-row" style="display:none; margin-top:8px;">
                            <label>Change Work Group :</label>
                            <select id="tm-jw-grp-select" style="width:100%; padding:7px 9px; border:1px solid #d1d5db; border-radius:5px; font-weight:700;"></select>
                        </div>

                        <div id="tm-contact-fields" class="tm-divider">
                            <div class="tm-sec-lbl" id="tm-contact-lbl">Contact &amp; Mailing Details</div>
                            <div class="tm-row"><label>Mobile No. :</label><input type="tel" id="tm-mobile" maxlength="12" placeholder="10-digit Mobile"></div>
                            <div class="tm-row"><label>Address :</label><input type="text" id="tm-address" placeholder="Market / Mohalla / Address"></div>
                            <div class="tm-row" id="tm-gst-row"><label>GSTIN / TIN :</label><input type="text" id="tm-gst" placeholder="GST No. (Optional)"></div>
                            <div class="tm-row" id="tm-date-row"><label>Join Date :</label><input type="date" id="tm-date"></div>
                        </div>

                        <div id="tm-dukan-fields" class="tm-divider" style="display:none;">
                            <div class="tm-row"><label id="tm-city-lbl">City (To) :</label><input type="text" id="tm-city" placeholder="Jaise: HYDERABAD / VARANASI"></div>
                            <div class="tm-row"><label>Agent Name :</label><input type="text" id="tm-agent" placeholder="Agent ka Naam"></div>
                            <div class="tm-row" id="tm-marka-row"><label>Default Marka :</label><input type="text" id="tm-marka" placeholder="SSH / HYD"></div>
                            <div class="tm-row" id="tm-tr-row"><label>Transport :</label><input type="text" id="tm-tr" placeholder="Transport Name"></div>
                            <div class="tm-row" id="tm-email-row" style="display:none;"><label>Email ID :</label><input type="text" id="tm-email" placeholder="firm@gmail.com"></div>
                            <div class="tm-row" id="tm-default-row" style="display:none;"><label>Default Firm :</label><input type="text" id="tm-firm-default" value="No" readonly autocomplete="off"></div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; gap:10px;">
                            <button type="button" class="tm-esc-btn" id="tm-back-to-alter-btn" style="display:none;" onclick="openTallyAlterModule()">← Alter List</button>
                            <button type="button" class="tm-btn-del" id="tm-delete-btn" style="display:none;" onclick="tmDeleteProfile()">🗑️ Delete</button>
                            <div style="margin-left:auto;"><button type="button" class="tm-btn-yes" onclick="tmAskAccept()">Save [Ctrl+Enter]</button></div>
                        </div>
                    </div>

                    <div class="tm-right-pane">
                        <div class="tm-group-box" id="tm-group-list-box">
                            <div class="tm-group-head">List of Groups</div>
                            <div id="tm-group-list" style="max-height:360px; overflow-y:auto;"></div>
                        </div>
                        <div class="tm-group-box" id="tm-default-picker-box" style="display:none; margin-top:10px;">
                            <div class="tm-group-head">Default Billing Firm?</div>
                            <div class="tm-group-opt" onclick="tmSetFirmDefault('Yes')"><span>Yes (Default Firm)</span><small>Auto-Fill</small></div>
                            <div class="tm-group-opt" onclick="tmSetFirmDefault('No')"><span>No</span><small>Manual Pick</small></div>
                        </div>
                        <div class="tm-group-box" id="tm-alter-info-box" style="display:none;">
                            <div class="tm-group-head">Alteration Safety Info</div>
                            <div style="padding:12px; font-size:12.5px; color:#4b5563; line-height:1.6;">
                                <div><strong>Type:</strong> <span id="tm-alter-grp-label">-</span></div>
                                <div><strong>ID:</strong> <span id="tm-alter-id-label" style="font-size:11px; color:#9ca3af;">-</span></div>
                            </div>
                        </div>
                        <div class="tm-accept-box" id="tm-accept-box">
                            <strong id="tm-accept-title">Accept?</strong>
                            <div style="display:flex; gap:8px; justify-content:center;">
                                <button type="button" class="tm-btn-yes" id="tm-btn-yes" onclick="tmSaveProfile()">Yes (Y)</button>
                                <button type="button" class="tm-btn-no" id="tm-btn-no" onclick="tmCancelAccept()">No (N)</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tm-status-strip">
                <span class="tm-toast" id="tm-toast-msg">Central Tally Master Ready — Enter se Group chunein.</span>
                <span id="tm-live-counts"></span>
            </div>
        `;
        sec.dataset.tmInitialized = '1';

        document.getElementById('tm-group')?.addEventListener('input', function () {
            if (tmMode !== 'create') return;
            const q = this.value.trim().toLowerCase();
            const opts = Array.from(document.querySelectorAll('#tm-group-list .tm-group-opt'));
            let first = null;
            opts.forEach((el) => {
                const ok = !q || el.dataset.grp.includes(q) || el.dataset.label.toLowerCase().includes(q);
                el.style.display = ok ? 'flex' : 'none';
                if (ok && !first) first = el;
            });
            if (first) {
                opts.forEach((o) => o.classList.remove('selected'));
                first.classList.add('selected');
                tmSelectedGroup = first.dataset.grp;
            }
        });

        document.getElementById('tm-firm-default')?.addEventListener('focus', () => {
            const box = document.getElementById('tm-default-picker-box');
            if (box && tmSelectedGroup === 'dukan_firm') box.style.display = 'block';
        });

        document.getElementById('tm-alter-search')?.addEventListener('input', () => { tmAlterActiveIdx = 0; renderAlterList(); });
    };

    window.tmSetFirmDefault = (val) => {
        const el = document.getElementById('tm-firm-default');
        if (el) el.value = val;
        window.tmAskAccept();
    };

    window.tmPickGroup = (grp, openSheetOrFocus) => {
        tmSelectedGroup = grp || 'kariger';
        const labelMap = { kariger: 'Kariger (Weaver)', dukan_party: 'Dukan Party (Buyer)', dukan_firm: 'Firm / Company', work_group: '+ New Work Group' };
        const grpInp = document.getElementById('tm-group');
        if (grpInp) grpInp.value = labelMap[tmSelectedGroup] || grpLabel(tmSelectedGroup);

        document.querySelectorAll('#tm-group-list .tm-group-opt').forEach((el) => {
            el.classList.toggle('selected', el.dataset.grp === tmSelectedGroup);
            el.style.display = 'flex';
        });

        const show = (id, yes) => { const e = document.getElementById(id); if (e) e.style.display = yes ? (id.endsWith('-row') ? 'grid' : 'block') : 'none'; };
        show('tm-kariger-fields', tmSelectedGroup === 'kariger');
        show('tm-workgroup-fields', tmSelectedGroup === 'work_group');
        show('tm-contact-fields', tmSelectedGroup !== 'work_group');
        show('tm-dukan-fields', tmSelectedGroup === 'dukan_party' || tmSelectedGroup === 'dukan_firm');
        show('tm-gst-row', tmSelectedGroup !== 'kariger');
        show('tm-date-row', tmSelectedGroup === 'kariger' || isJwGroup(tmSelectedGroup));
        show('tm-marka-row', tmSelectedGroup === 'dukan_party');
        show('tm-tr-row', tmSelectedGroup === 'dukan_party');
        show('tm-email-row', tmSelectedGroup === 'dukan_firm');
        show('tm-default-row', tmSelectedGroup === 'dukan_firm');
        show('tm-default-picker-box', false);

        const cityLbl = document.getElementById('tm-city-lbl');
        if (cityLbl) cityLbl.textContent = tmSelectedGroup === 'dukan_firm' ? 'City (From) :' : 'City (To) :';
        const nameLbl = document.getElementById('tm-name-lbl');
        if (nameLbl) nameLbl.textContent = tmSelectedGroup === 'work_group' ? 'Work Group Name :' : 'Name :';

        if (!openSheetOrFocus) return;
        if (tmSelectedGroup === 'kariger') window.tmOpenSheetOverlay(true);
        else if (tmSelectedGroup === 'work_group') setTimeout(() => document.getElementById('tm-wg-outstation')?.focus(), 25);
        else setTimeout(() => document.getElementById('tm-mobile')?.focus(), 25);
    };

    window.openTallyCreateModule = (presetGroup = null, onBack = null) => {
        window.initCentralMasterDOM();
        if (tmSheetModalOpen) window.tmCloseSheetOverlay(false);
        if (onBack !== undefined) tmReturnCallback = (typeof onBack === 'function') ? onBack : null;

        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dv = document.getElementById('dashboard-view'); if (dv) dv.style.display = 'none';
        const sec = document.getElementById('tally-master-section'); if (sec) sec.style.display = 'block';

        tmMode = 'create';
        const groups = getWorkGroups();
        let startGrp = 'kariger';
        if (presetGroup === 'jobwork') startGrp = groups[0]?.key || 'cutting';
        else if (presetGroup === 'party' || presetGroup === 'Party') startGrp = 'dukan_party';
        else if (presetGroup === 'firm' || presetGroup === 'Firm') startGrp = 'dukan_firm';
        else if (presetGroup) startGrp = presetGroup;

        tmSelectedGroup = startGrp;
        document.getElementById('tm-screen-title').textContent = 'Central Master Creation (Tally Style)';
        document.getElementById('tm-tab-create').classList.add('active');
        document.getElementById('tm-tab-alter').classList.remove('active');
        document.getElementById('tm-alter-view').style.display = 'none';
        document.getElementById('tm-form-view').style.display = 'block';
        document.getElementById('tm-back-to-alter-btn').style.display = 'none';
        document.getElementById('tm-delete-btn').style.display = 'none';
        document.getElementById('tm-jw-group-edit-row').style.display = 'none';
        document.getElementById('tm-group-list-box').style.display = 'block';
        document.getElementById('tm-alter-info-box').style.display = 'none';
        document.getElementById('tm-accept-box').style.display = 'none';

        renderRightGroupList();
        ['tm-edit-id', 'tm-edit-source', 'tm-name', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-city', 'tm-agent', 'tm-marka', 'tm-tr', 'tm-email'].forEach((id) => {
            const e = document.getElementById(id); if (e) e.value = '';
        });
        document.getElementById('tm-date').value = toIso(getToday());
        document.getElementById('tm-wg-outstation').checked = false;
        document.getElementById('tm-firm-default').value = getFirms().length === 0 ? 'Yes' : 'No';

        const grpInp = document.getElementById('tm-group');
        if (grpInp) { grpInp.readOnly = false; grpInp.value = ''; }

        resetSheetInputs();
        updateCountsBar();
        if (presetGroup) window.tmPickGroup(startGrp, false);
        else {
            document.getElementById('tm-kariger-fields').style.display = 'none';
            document.getElementById('tm-workgroup-fields').style.display = 'none';
            document.getElementById('tm-dukan-fields').style.display = 'none';
            document.getElementById('tm-contact-fields').style.display = 'block';
            document.getElementById('tm-gst-row').style.display = 'none';
        }
        setToast('Name daalein aur Under (Group) me Master chunein!');
        setTimeout(() => document.getElementById('tm-name')?.focus(), 40);
    };

    window.openTallyAlterModule = (presetFilter = null, onBack = null) => {
        window.initCentralMasterDOM();
        if (tmSheetModalOpen) window.tmCloseSheetOverlay(false);
        if (onBack !== undefined) tmReturnCallback = (typeof onBack === 'function') ? onBack : null;

        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dv = document.getElementById('dashboard-view'); if (dv) dv.style.display = 'none';
        const sec = document.getElementById('tally-master-section'); if (sec) sec.style.display = 'block';

        tmMode = 'alter-list';
        if (presetFilter) tmAlterFilter = presetFilter;
        document.getElementById('tm-screen-title').textContent = 'Central Master Alteration (Search / Edit / Del)';
        document.getElementById('tm-tab-create').classList.remove('active');
        document.getElementById('tm-tab-alter').classList.add('active');
        document.getElementById('tm-alter-view').style.display = 'block';
        document.getElementById('tm-form-view').style.display = 'none';
        document.getElementById('tm-accept-box').style.display = 'none';

        document.querySelectorAll('#tm-alter-view [data-tm-filter]').forEach((b) => b.classList.toggle('active', b.dataset.tmFilter === tmAlterFilter));
        tmAlterActiveIdx = 0;
        const sInp = document.getElementById('tm-alter-search'); if (sInp) sInp.value = '';
        renderAlterList();
        updateCountsBar();
        setToast('Naam search karein · ↑ ↓ Arrow se chunein · Enter se Edit / Delete karein.');
        setTimeout(() => sInp?.focus(), 40);
    };

    window.tmSetAlterFilter = (f) => {
        tmAlterFilter = f || 'all';
        tmAlterActiveIdx = 0;
        document.querySelectorAll('#tm-alter-view [data-tm-filter]').forEach((b) => b.classList.toggle('active', b.dataset.tmFilter === tmAlterFilter));
        renderAlterList();
    };

    const getCombinedProfiles = () => {
        const list = [];
        getKarigers().forEach((k) => list.push({ id: k.id, source: 'kariger_list', filterCat: 'kariger', group: 'kariger', groupLabel: 'Kariger', name: k.name, mobile: k.mobile || '', address: k.mohalla || k.address || '', gst: '', saree: k.saree || '', karkhanaId: k.karkhanaId || 'k_main', karkhanaName: k.karkhanaName || 'Main Godown', date: k.date || '' }));
        getJobWorkers().forEach((w) => {
            const t = String(w.type || 'cutting').toLowerCase();
            list.push({ id: w.id, source: 'jobwork_workers', filterCat: 'jobwork', group: t, groupLabel: grpLabel(t), name: w.name, mobile: w.mobile || '', address: w.address || '', gst: w.gst || '', date: w.date || '' });
        });
        getWorkGroups().forEach((g) => list.push({ id: g.key, source: 'jobwork_groups', filterCat: 'work_group', group: 'work_group', groupLabel: g.outstation ? 'Group (Bill+Slip)' : 'Work Group', name: g.label, outstation: g.outstation }));
        getParties().forEach((p) => list.push({ id: p.id, source: 'dukan_parties', filterCat: 'dukan_party', group: 'dukan_party', groupLabel: 'Dukan Party', name: p.name, mobile: p.mob || '', address: p.address || '', gst: p.gst || '', city: p.city || '', agent: p.agent || '', marka: p.marka || '', transport: p.transport || '' }));
        getFirms().forEach((f) => list.push({ id: f.id, source: 'dukan_firms', filterCat: 'dukan_firm', group: 'dukan_firm', groupLabel: f.isDefault ? 'Firm ★ Default' : 'Firm', name: f.name, mobile: f.mob || '', address: f.address || '', gst: f.gst || '', city: f.city || '', agent: f.agent || '', email: f.email || '', isDefault: Boolean(f.isDefault) }));
        return list;
    };

    const renderAlterList = () => {
        const box = document.getElementById('tm-alter-list'); if (!box) return;
        const q = (document.getElementById('tm-alter-search')?.value || '').trim().toLowerCase();
        const items = getCombinedProfiles().filter((p) => (tmAlterFilter === 'all' || p.filterCat === tmAlterFilter) && (!q || `${p.name} ${p.groupLabel} ${p.mobile} ${p.address} ${p.city || ''} ${p.gst || ''} ${p.saree || ''}`.toLowerCase().includes(q)));
        if (!items.length) { box.innerHTML = '<div style="padding:24px; text-align:center; color:#9ca3af; font-size:13px;">Koi profile nahi mili.</div>'; return; }
        if (tmAlterActiveIdx >= items.length) tmAlterActiveIdx = 0;

        box.innerHTML = items.map((p, idx) => `
            <div class="tm-alter-row ${idx === tmAlterActiveIdx ? 'active' : ''}" data-idx="${idx}" onclick="tmOpenAlterEdit('${esc(p.id)}', '${esc(p.source)}')">
                <div><strong>${esc(p.name)}</strong>${p.mobile ? ` <small style="color:#6b7280;">(${esc(p.mobile)})</small>` : ''}</div>
                <div><span class="tm-grp-pill">${esc(p.groupLabel)}</span></div>
                <div class="tm-alter-hide-sm"><small style="color:#6b7280;">${esc(p.city || p.address || p.saree || '-')}</small></div>
                <div style="text-align:right; font-weight:700; font-size:12px;">Edit →</div>
            </div>`).join('');
    };

    window.tmOpenAlterEdit = (id, source) => {
        const found = getCombinedProfiles().find((p) => String(p.id) === String(id) && p.source === source);
        if (!found) return;
        tmMode = 'alter-edit';
        document.getElementById('tm-screen-title').textContent = `Alter: ${found.name}`;
        document.getElementById('tm-alter-view').style.display = 'none';
        document.getElementById('tm-form-view').style.display = 'block';
        document.getElementById('tm-back-to-alter-btn').style.display = 'inline-block';
        document.getElementById('tm-delete-btn').style.display = 'inline-block';
        document.getElementById('tm-group-list-box').style.display = 'none';
        document.getElementById('tm-alter-info-box').style.display = 'block';
        document.getElementById('tm-accept-box').style.display = 'none';

        document.getElementById('tm-edit-id').value = found.id;
        document.getElementById('tm-edit-source').value = found.source;
        document.getElementById('tm-name').value = found.name;
        document.getElementById('tm-mobile').value = found.mobile || '';
        document.getElementById('tm-address').value = found.address || '';
        document.getElementById('tm-gst').value = found.gst || '';
        document.getElementById('tm-date').value = toIso(found.date || getToday());
        document.getElementById('tm-city').value = found.city || '';
        document.getElementById('tm-agent').value = found.agent || '';
        document.getElementById('tm-marka').value = found.marka || '';
        document.getElementById('tm-tr').value = found.transport || '';
        document.getElementById('tm-email').value = found.email || '';
        document.getElementById('tm-firm-default').value = found.isDefault ? 'Yes' : 'No';
        document.getElementById('tm-wg-outstation').checked = Boolean(found.outstation);

        const grpInp = document.getElementById('tm-group'); if (grpInp) grpInp.readOnly = true;
        window.tmPickGroup(found.group, false);

        const jwRow = document.getElementById('tm-jw-group-edit-row');
        const jwSel = document.getElementById('tm-jw-grp-select');
        if (found.source === 'jobwork_workers' && jwRow && jwSel) {
            jwSel.innerHTML = getWorkGroups().map((g) => `<option value="${esc(g.key)}" ${g.key === found.group ? 'selected' : ''}>${esc(g.label)}</option>`).join('');
            jwRow.style.display = 'grid';
        } else if (jwRow) jwRow.style.display = 'none';

        if (found.group === 'kariger') loadSheetInputs(found.id, found);
        document.getElementById('tm-alter-grp-label').textContent = found.groupLabel;
        document.getElementById('tm-alter-id-label').textContent = found.id;
        setTimeout(() => document.getElementById('tm-name')?.focus(), 40);
    };

    window.tmAskAccept = () => {
        if (tmSheetModalOpen) return window.tmConfirmSheetOverlay();
        const name = (document.getElementById('tm-name')?.value || '').trim();
        if (!name) {
            setToast('⚠️ Pehle Name bharein!');
            return document.getElementById('tm-name')?.focus();
        }
        document.getElementById('tm-accept-title').textContent = tmMode === 'alter-edit' ? 'Update Profile?' : 'Accept & Save?';
        document.getElementById('tm-accept-box').style.display = 'block';
        document.getElementById('tm-btn-yes')?.focus();
    };
    window.tmCancelAccept = () => { document.getElementById('tm-accept-box').style.display = 'none'; document.getElementById('tm-name')?.focus(); };

    window.tmSaveProfile = () => {
        const editId = (document.getElementById('tm-edit-id')?.value || '').trim();
        const editSource = (document.getElementById('tm-edit-source')?.value || '').trim();
        const rawName = (document.getElementById('tm-name')?.value || '').trim();
        const name = rawName.toUpperCase();
        const mobile = (document.getElementById('tm-mobile')?.value || '').trim();
        const address = (document.getElementById('tm-address')?.value || '').trim();
        const gst = (document.getElementById('tm-gst')?.value || '').trim().toUpperCase();
        const dateVal = toIso((document.getElementById('tm-date')?.value || '').trim() || getToday());

        if (!name) {
            setToast('⚠️ Pehle Name bharein!');
            document.getElementById('tm-accept-box').style.display = 'none';
            document.getElementById('tm-name')?.focus();
            return;
        }

        if (isSavingTmProfile) return;
        isSavingTmProfile = true;

        try {
            // Duplicate Name Check (sirf naya banate waqt, edit me nahi)
            if (!editId) {
                const isKariger = (tmSelectedGroup === 'kariger');
                const isParty = (tmSelectedGroup === 'dukan_party');
                const isFirm = (tmSelectedGroup === 'dukan_firm');
                const isJw = getWorkGroups().some((g) => g.key === tmSelectedGroup);

                if (isKariger && getKarigers().some((k) => String(k.name || '').trim().toUpperCase() === name)) {
                    document.getElementById('tm-accept-box').style.display = 'none';
                    setToast('⚠️ Is naam ka Kariger pehle se maujood hai!');
                    document.getElementById('tm-name')?.focus();
                    return;
                }
                if (isParty && getParties().some((p) => String(p.name || '').trim().toUpperCase() === name)) {
                    document.getElementById('tm-accept-box').style.display = 'none';
                    setToast('⚠️ Is naam ka Dukan Party pehle se maujood hai!');
                    document.getElementById('tm-name')?.focus();
                    return;
                }
                if (isFirm && getFirms().some((f) => String(f.name || '').trim().toUpperCase() === name)) {
                    document.getElementById('tm-accept-box').style.display = 'none';
                    setToast('⚠️ Is naam ki Firm pehle se maujood hai!');
                    document.getElementById('tm-name')?.focus();
                    return;
                }
                if (isJw && getJobWorkers().some((w) => String(w.name || '').trim().toUpperCase() === name)) {
                    document.getElementById('tm-accept-box').style.display = 'none';
                    setToast('⚠️ Is naam ka Job Worker pehle se maujood hai!');
                    document.getElementById('tm-name')?.focus();
                    return;
                }
            }

            if (tmSelectedGroup === 'kariger' || editSource === 'kariger_list') {
                const kId = getSelectedKarkhanaId() || 'k_main';
                const kName = (typeof window.getKarkhanaNameById === 'function') ? window.getKarkhanaNameById(kId) : (document.getElementById('tm-s-karkhana')?.value || 'Main Godown');
                const saree = (document.getElementById('tm-s-saree')?.value || '').trim();
                const list = getKarigers();
                const targetKarId = editId || `kar_${uidSuffix()}`;
                if (editId) {
                    const it = list.find((x) => String(x.id) === String(editId));
                    if (it) Object.assign(it, { name, saree, mobile, mohalla: address, date: dateVal, karkhanaId: kId, karkhanaName: kName });
                } else list.push({ id: targetKarId, name, saree, mobile, mohalla: address, date: dateVal, karkhanaId: kId, karkhanaName: kName });
                setStore('kariger_list', list);

                const shs = getSheets(targetKarId);
                let sh = shs.length ? shs[shs.length - 1] : null;
                const oldSt = sh ? { taniItem: sh.taniItem, taniWazan: sh.taniWazan, chukkaItem: sh.chukkaItem, chukkaWazan: sh.chukkaWazan } : {};
                if (!sh) { sh = { id: 'tani_1', title: 'Tani 1', note: '', rows: [] }; shs.push(sh); }
                Object.assign(sh, {
                    rateBana: numFb(document.getElementById('tm-rate-bana')?.value, 0.311),
                    rateZari: numFb(document.getElementById('tm-rate-zari')?.value, 0.110),
                    rateBani: numFb(document.getElementById('tm-rate-bani')?.value, 240),
                    pichlaBana: numFb(document.getElementById('tm-pichla-bana')?.value, 0),
                    pichlaZari: numFb(document.getElementById('tm-pichla-zari')?.value, 0),
                    pichlaBani: numFb(document.getElementById('tm-pichla-bani')?.value, 0),
                    banaWaste: numFb(document.getElementById('tm-waste-bana')?.value, 0),
                    zariWaste: numFb(document.getElementById('tm-waste-zari')?.value, 0),
                    banaItem: String(document.getElementById('tm-bana-item')?.value || '').trim(),
                    zariItem: String(document.getElementById('tm-zari-item')?.value || '').trim(),
                    taniItem: String(document.getElementById('tm-tani-item')?.value || '').trim(),
                    taniSancha: String(document.getElementById('tm-tani-sancha')?.value || '').trim(),
                    taniWazan: numFb(document.getElementById('tm-tani-wazan')?.value, 0),
                    taniPcs: numFb(document.getElementById('tm-tani-pcs')?.value, 72),
                    chukkaItem: String(document.getElementById('tm-chukka-item')?.value || '').trim(),
                    chukkaSancha: String(document.getElementById('tm-chukka-sancha')?.value || '').trim(),
                    chukkaWazan: numFb(document.getElementById('tm-chukka-wazan')?.value, 0),
                    chukkaPcs: numFb(document.getElementById('tm-chukka-pcs')?.value, 72),
                    colors: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => String(document.getElementById(`tm-color-${i}`)?.value || '').trim()).filter(Boolean),
                    rows: Array.isArray(sh.rows) ? sh.rows : []
                });
                syncSanchaStock(targetKarId, name, kId, sh, oldSt);
                saveSheets(targetKarId, shs);
            } else if (tmSelectedGroup === 'work_group' || editSource === 'jobwork_groups') {
                const outst = Boolean(document.getElementById('tm-wg-outstation')?.checked);
                const groups = getWorkGroups();
                const key = editId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                if (!key || key === 'all' || key === 'kariger') {
                    document.getElementById('tm-accept-box').style.display = 'none';
                    setToast('⚠️ Yeh naam reserve hai!');
                    document.getElementById('tm-name')?.focus();
                    return;
                }
                if (editId) {
                    const idx = groups.findIndex((g) => g.key === editId);
                    if (idx >= 0) groups[idx] = { ...groups[idx], label: rawName, outstation: outst };
                } else {
                    if (groups.some((g) => g.key === key)) {
                        document.getElementById('tm-accept-box').style.display = 'none';
                        setToast('⚠️ Yeh Work Group pehle se maujood hai!');
                        document.getElementById('tm-name')?.focus();
                        return;
                    }
                    groups.push({ key, label: rawName, outstation: outst });
                }
                setStore('jobwork_groups', groups);
                if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache();
            } else if (tmSelectedGroup === 'dukan_party' || editSource === 'dukan_parties') {
                const list = getParties();
                const obj = { id: editId || `party_${uidSuffix()}`, name, mob: mobile, gst, address, city: (document.getElementById('tm-city')?.value || '').trim().toUpperCase(), agent: (document.getElementById('tm-agent')?.value || '').trim(), marka: (document.getElementById('tm-marka')?.value || '').trim().toUpperCase(), transport: (document.getElementById('tm-tr')?.value || '').trim(), email: '' };
                if (editId) { const i = list.findIndex((x) => x.id === editId); if (i >= 0) list[i] = obj; } else list.push(obj);
                setStore('dukan_parties', list);
            } else if (tmSelectedGroup === 'dukan_firm' || editSource === 'dukan_firms') {
                let list = getFirms();
                const isDef = document.getElementById('tm-firm-default')?.value === 'Yes';
                if (isDef) list = list.map((f) => ({ ...f, isDefault: false }));
                const obj = { id: editId || `firm_${uidSuffix()}`, name, mob: mobile, gst, address, city: (document.getElementById('tm-city')?.value || '').trim().toUpperCase(), agent: (document.getElementById('tm-agent')?.value || '').trim(), email: (document.getElementById('tm-email')?.value || '').trim(), isDefault: isDef };
                if (editId) { const i = list.findIndex((x) => x.id === editId); if (i >= 0) list[i] = obj; } else list.push(obj);
                if (list.length && !list.some((f) => f.isDefault)) list[0].isDefault = true;
                setStore('dukan_firms', list);
            } else {
                const jwList = [...getJobWorkers()];
                const wType = (editId && document.getElementById('tm-jw-grp-select')?.value) || tmSelectedGroup;
                if (editId) {
                    const it = jwList.find((x) => String(x.id) === String(editId));
                    if (it) Object.assign(it, { name, type: wType, address, mobile, gst, date: dateVal });
                } else jwList.push({ id: `jw_${uidSuffix()}`, type: wType, date: dateVal, name, address, mobile, gst });
                if (typeof window.saveJobWorkers === 'function') window.saveJobWorkers(jwList);
                else setStore('jobwork_workers', jwList);
                if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(editId || null);
                if (typeof window.updateJobWorkHubBadges === 'function') window.updateJobWorkHubBadges();
            }

            if (typeof window.populateKarigersDatalist === 'function') window.populateKarigersDatalist();
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
            updateCountsBar();
            document.getElementById('tm-accept-box').style.display = 'none';

            if (tmMode === 'alter-edit') {
                window.openTallyAlterModule();
                setToast(`✅ [${name}] update ho gaya!`);
            } else {
                window.openTallyCreateModule(tmSelectedGroup);
                setToast(`✅ [${name}] save ho gaya! Agli entry karein.`);
            }
        } catch (err) {
            console.error('[CentralMaster Save Error]', err);
            document.getElementById('tm-accept-box').style.display = 'none';
            setToast('❌ Save karne me error aaya!');
        } finally {
            isSavingTmProfile = false;
        }
    };

    window.tmDeleteProfile = () => {
        if (isDeletingTmProfile) return;

        const id = (document.getElementById('tm-edit-id')?.value || '').trim();
        const src = (document.getElementById('tm-edit-source')?.value || '').trim();
        const nm = (document.getElementById('tm-name')?.value || '').trim();
        if (!id || !src) return;

        if (src === 'jobwork_workers' && window._JWT?.getSnapshot) {
            const w = window._JWT.getSnapshot().workers.find((x) => x.id === id);
            if (w && w.pending > 0) {
                setToast(`⚠️ Is worker ke paas abhi ${w.pending} Pcs pending hai! Pehle wapas lein.`);
                return;
            }
        }
        if (src === 'jobwork_groups') {
            const wc = getJobWorkers().filter((w) => String(w.type).toLowerCase() === String(id).toLowerCase()).length;
            if (wc > 0) {
                setToast(`⚠️ Is group me abhi ${wc} workers hain! Pehle unhe delete/shift karein.`);
                return;
            }
        }

        isDeletingTmProfile = true;
        try {
            if (src === 'kariger_list') setStore('kariger_list', getKarigers().filter((x) => String(x.id) !== id));
            else if (src === 'jobwork_workers') setStore('jobwork_workers', getJobWorkers().filter((x) => String(x.id) !== id));
            else if (src === 'jobwork_groups') setStore('jobwork_groups', getWorkGroups().filter((g) => g.key !== id));
            else if (src === 'dukan_parties') setStore('dukan_parties', getParties().filter((p) => String(p.id) !== id));
            else if (src === 'dukan_firms') {
                const next = getFirms().filter((f) => String(f.id) !== id);
                if (next.length && !next.some((f) => f.isDefault)) next[0].isDefault = true;
                setStore('dukan_firms', next);
            }
            if (typeof window.populateKarigersDatalist === 'function') window.populateKarigersDatalist();
            if (typeof window.invalidateJobWorkCache === 'function') window.invalidateJobWorkCache(id);
            if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
            if (typeof window.slSyncDashboardCharts === 'function') window.slSyncDashboardCharts();
            window.openTallyAlterModule();
            setToast(`🗑️ [${nm}] delete ho gaya!`);
        } finally {
            isDeletingTmProfile = false;
        }
    };

    window.tmHandleEscKey = () => {
        if (tmSheetModalOpen) return window.tmCloseSheetOverlay(false);
        if (document.getElementById('tm-accept-box')?.style.display === 'block') return window.tmCancelAccept();
        if (tmMode === 'alter-edit') return window.openTallyAlterModule();
        if (typeof tmReturnCallback === 'function') {
            const cb = tmReturnCallback;
            tmReturnCallback = null;
            cb();
            return;
        }
        window.backToDashboard();
    };

    if (!window._tmMasterKeysBound) {
        window._tmMasterKeysBound = true;
        document.addEventListener('keydown', (e) => {
            const tmSec = document.getElementById('tally-master-section');
            const active = tmSheetModalOpen || (tmSec && tmSec.style.display !== 'none');
            if (!active) return;

            if (tmSheetModalOpen) {
                if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return window.tmCloseSheetOverlay(false); }
                if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'a')) { e.preventDefault(); e.stopImmediatePropagation(); return window.tmConfirmSheetOverlay(); }
                const ovOrder = ['tm-s-karkhana', 'tm-s-saree', 'tm-rate-bana', 'tm-rate-zari', 'tm-rate-bani', 'tm-pichla-bana', 'tm-pichla-zari', 'tm-pichla-bani', 'tm-waste-bana', 'tm-waste-zari', 'tm-bana-item', 'tm-zari-item', 'tm-tani-item', 'tm-tani-sancha', 'tm-tani-wazan', 'tm-tani-pcs', 'tm-chukka-item', 'tm-chukka-sancha', 'tm-chukka-wazan', 'tm-chukka-pcs', 'tm-color-1', 'tm-color-2', 'tm-color-3', 'tm-color-4', 'tm-color-5', 'tm-color-6', 'tm-color-7', 'tm-color-8'];
                const aid = document.activeElement?.id || '';
                const cIdx = ovOrder.indexOf(aid);
                const isSide = Boolean(tmActiveSideField && tmActiveSideField === aid && tmSideItems.length > 0);
                if (isSide && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    tmSideActiveIdx = e.key === 'ArrowDown' ? (tmSideActiveIdx + 1) % tmSideItems.length : (tmSideActiveIdx <= 0 ? tmSideItems.length - 1 : tmSideActiveIdx - 1);
                    const opts = Array.from(document.querySelectorAll('#tm-side-list-body .tm-side-opt'));
                    opts.forEach((o, i) => o.classList.toggle('selected', i === tmSideActiveIdx));
                    opts[tmSideActiveIdx]?.scrollIntoView({ block: 'nearest' });
                    return;
                }
                if (cIdx >= 0 && e.key === 'Enter') {
                    e.preventDefault();
                    if (isSide && tmSideActiveIdx >= 0) return window.tmPickSideItem(tmSideActiveIdx);
                    const nxt = document.getElementById(ovOrder[e.shiftKey ? cIdx - 1 : cIdx + 1]);
                    if (nxt) { nxt.focus(); nxt.select?.(); } else if (!e.shiftKey) window.tmConfirmSheetOverlay();
                }
                return;
            }

            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return window.tmHandleEscKey(); }
            if (tmMode === 'alter-list') {
                const rows = Array.from(document.querySelectorAll('#tm-alter-list .tm-alter-row'));
                if (!rows.length) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); rows[tmAlterActiveIdx]?.classList.remove('active'); tmAlterActiveIdx = (tmAlterActiveIdx + 1) % rows.length; rows[tmAlterActiveIdx]?.classList.add('active'); rows[tmAlterActiveIdx]?.scrollIntoView({ block: 'nearest' }); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); rows[tmAlterActiveIdx]?.classList.remove('active'); tmAlterActiveIdx = (tmAlterActiveIdx - 1 + rows.length) % rows.length; rows[tmAlterActiveIdx]?.classList.add('active'); rows[tmAlterActiveIdx]?.scrollIntoView({ block: 'nearest' }); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); rows[tmAlterActiveIdx]?.click(); }
                return;
            }
            if (document.getElementById('tm-accept-box')?.style.display === 'block') {
                if (e.key === 'Enter' && document.activeElement?.id === 'tm-btn-no') {
                    e.preventDefault(); e.stopImmediatePropagation(); window.tmCancelAccept();
                } else if (e.key.toLowerCase() === 'y' || e.key === 'Enter') {
                    e.preventDefault(); e.stopImmediatePropagation(); window.tmSaveProfile();
                } else if (e.key.toLowerCase() === 'n') {
                    e.preventDefault(); e.stopImmediatePropagation(); window.tmCancelAccept();
                }
                return;
            }
            if (e.key === 'F9' && tmSelectedGroup === 'kariger') { e.preventDefault(); e.stopImmediatePropagation(); return window.tmOpenSheetOverlay(true); }
            if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'a')) { e.preventDefault(); e.stopImmediatePropagation(); return window.tmAskAccept(); }

            const aid = document.activeElement?.id || '';
            if (aid === 'tm-group' && tmMode === 'create' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                const vis = Array.from(document.querySelectorAll('#tm-group-list .tm-group-opt')).filter((x) => x.style.display !== 'none');
                if (!vis.length) return;
                let gi = vis.findIndex((x) => x.classList.contains('selected'));
                gi = e.key === 'ArrowDown' ? (gi + 1) % vis.length : (gi - 1 + vis.length) % vis.length;
                vis.forEach((x) => x.classList.remove('selected'));
                vis[gi].classList.add('selected');
                tmSelectedGroup = vis[gi].dataset.grp;
                document.getElementById('tm-group').value = vis[gi].dataset.label;
                return;
            }

            if (aid === 'tm-firm-default') {
                const box = document.getElementById('tm-default-picker-box'); if (box) box.style.display = 'block';
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const el = document.getElementById('tm-firm-default');
                    if (el) el.value = el.value === 'Yes' ? 'No' : 'Yes';
                    return;
                }
            }

            let order = ['tm-name', 'tm-group', 'tm-mobile', 'tm-address', 'tm-date'];
            if (tmSelectedGroup === 'work_group') order = tmMode === 'create' ? ['tm-name', 'tm-group', 'tm-wg-outstation'] : ['tm-name', 'tm-wg-outstation'];
            else if (tmSelectedGroup === 'dukan_party') order = tmMode === 'create' ? ['tm-name', 'tm-group', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-city', 'tm-agent', 'tm-marka', 'tm-tr'] : ['tm-name', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-city', 'tm-agent', 'tm-marka', 'tm-tr'];
            else if (tmSelectedGroup === 'dukan_firm') order = tmMode === 'create' ? ['tm-name', 'tm-group', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-city', 'tm-agent', 'tm-email', 'tm-firm-default'] : ['tm-name', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-city', 'tm-agent', 'tm-email', 'tm-firm-default'];
            else if (isJwGroup(tmSelectedGroup)) order = tmMode === 'create' ? ['tm-name', 'tm-group', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-date'] : ['tm-name', 'tm-jw-grp-select', 'tm-mobile', 'tm-address', 'tm-gst', 'tm-date'];
            else if (tmMode === 'alter-edit') order = ['tm-name', 'tm-mobile', 'tm-address', 'tm-date'];

            const ci = order.indexOf(aid);
            if (ci >= 0 && e.key === 'Enter') {
                e.preventDefault();
                if (aid === 'tm-group') return window.tmPickGroup(tmSelectedGroup, true);
                const nxt = document.getElementById(order[e.shiftKey ? ci - 1 : ci + 1]);
                if (nxt) { nxt.focus(); nxt.select?.(); } else if (!e.shiftKey) window.tmAskAccept();
            }
        }, true);
    }
})();
