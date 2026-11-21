/* ============================================================================
   SIMPLICITY ERP (THE TALLY BRIDGE) - DUKAN CORE ENGINE (FINISHED STOCK LINKED)
   File: dukan-erp/dukan-core.js
============================================================================ */
(() => {
    'use strict';

    const D = window.DukanERP = {
        screen: 'gateway',
        gwIdx: 0,
        pageSize: 25,
        focusOrder: [],
        sideBindings: {},
        sideItems: [],
        sideIdx: -1,
        sideNavigated: false,
        activeSideId: null,
        listNav: null,
        onFinishForm: null,
        onEsc: null,
        lastToast: ''
    };

    D.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));

    D.num = (v) => {
        const n = parseFloat(String(v ?? '').replace(/,/g, '').trim());
        return isNaN(n) || !isFinite(n) ? 0 : n;
    };

    D.today = () => {
        const raw = (typeof window.getTodayDate === 'function') ? String(window.getTodayDate() || '').trim() : '';
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        const m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    D.fmtDate = (iso) => {
        const s = String(iso || '').trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
    };

    D.get = (key) => {
        try {
            if (typeof window.getStore === 'function') {
                const res = window.getStore(key);
                return Array.isArray(res) ? res : [];
            }
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) { return []; }
    };

    D.set = (key, arr) => {
        const list = Array.isArray(arr) ? arr : [];
        try {
            if (typeof window.setStore === 'function') window.setStore(key, list);
            else localStorage.setItem(key, JSON.stringify(list));
        } catch (_) {}
    };

    D.getKarigers = () => {
        if (typeof window.sanitizeKarigerList === 'function') return window.sanitizeKarigerList();
        return D.get('kariger_list').filter((k) => k && k.name);
    };

    D.toast = (msg) => {
        D.lastToast = msg;
        const el = document.getElementById('dk-toast-msg');
        if (el) el.textContent = msg;
    };

    /* -------------------- REAL FINISHED SAREE STOCK (saree_history) -------------------- */
    D.getFinishedStockRows = () => {
        const history = D.get('saree_history');
        if (typeof window.groupSareeStockByTab === 'function') {
            return window.groupSareeStockByTab(history, 'finished', 'all') || [];
        }
        const map = new Map();
        history.forEach((h) => {
            if (!h) return;
            const t = String(h.type || '').trim().toLowerCase();
            if (t !== 'finished' && t !== 'finish' && t !== 'calender') return;
            const sName = String(h.sareeName || h.name || h.saree || 'GENERAL SAREE').trim().toUpperCase();
            const kName = String(h.karigerName || h.kariger || 'KARKHANA').trim().toUpperCase();
            const kid = String(h.karkhanaId || 'k_main').trim() || 'k_main';
            const key = `${sName}___${kName}___${kid}`;
            if (!map.has(key)) map.set(key, { sareeName: sName, karigerName: kName, karkhanaId: kid, godamName: kid, aai: 0, gai: 0, bachi: 0 });
            const e = map.get(key);
            const isOut = (h.isOut === true) || (D.num(h.gai) > 0);
            if (isOut) e.gai += D.num(h.gai !== undefined ? h.gai : h.pcs);
            else e.aai += D.num(h.aai !== undefined ? h.aai : h.pcs);
        });
        const out = [];
        map.forEach((e) => { e.bachi = Math.max(0, Math.round(e.aai - e.gai)); out.push(e); });
        return out;
    };

    D.getDesignFinishedStock = (designOrObj) => {
        const rows = D.getFinishedStockRows();
        const designs = D.get('dukan_designs');
        const dObj = typeof designOrObj === 'string'
            ? designs.find((x) => String(x.design || '').toUpperCase() === designOrObj.trim().toUpperCase())
            : designOrObj;

        const targetDes = String(typeof designOrObj === 'string' ? designOrObj : (dObj?.design || '')).trim().toUpperCase();
        if (!targetDes) return 0;

        let matched = [];
        if (dObj && dObj.sareeName && dObj.kariger) {
            matched = rows.filter((r) =>
                r.sareeName === String(dObj.sareeName).toUpperCase() &&
                r.karigerName === String(dObj.kariger).toUpperCase() &&
                (!dObj.karkhanaId || r.karkhanaId === dObj.karkhanaId)
            );
        }
        if (!matched.length && dObj && dObj.sareeName) {
            matched = rows.filter((r) => r.sareeName === String(dObj.sareeName).toUpperCase());
        }
        if (!matched.length) {
            matched = rows.filter((r) => r.sareeName === targetDes);
        }
        return matched.reduce((sum, r) => sum + D.num(r.bachi), 0);
    };

    D.getSellableDesignOptions = () => {
        const designs = D.get('dukan_designs');
        const finRows = D.getFinishedStockRows();
        const list = designs.map((d) => ({
            design: String(d.design || '').toUpperCase(),
            kariger: d.kariger || '',
            sareeName: d.sareeName || d.design,
            karkhanaId: d.karkhanaId || 'k_main',
            finishedQty: D.getDesignFinishedStock(d)
        }));
        const linkedKeys = new Set(list.map((x) => `${x.sareeName}___${x.kariger}`.toUpperCase()));
        finRows.forEach((r) => {
            if (D.num(r.bachi) > 0 && !linkedKeys.has(`${r.sareeName}___${r.karigerName}`) && !list.some((x) => x.design === r.sareeName)) {
                list.push({
                    design: r.sareeName,
                    kariger: r.karigerName,
                    sareeName: r.sareeName,
                    karkhanaId: r.karkhanaId,
                    finishedQty: D.num(r.bachi)
                });
            }
        });
        return list;
    };

    D.deductFinishedStock = (designName, qty, meta = {}) => {
        let rem = Math.round(D.num(qty));
        const targetDes = String(designName || '').trim().toUpperCase();
        if (!targetDes || rem <= 0) return;

        const designs = D.get('dukan_designs');
        const dObj = designs.find((x) => String(x.design || '').toUpperCase() === targetDes);
        const finRows = D.getFinishedStockRows();

        let candidates = [];
        if (dObj && dObj.sareeName && dObj.kariger) {
            candidates = finRows.filter((r) => r.bachi > 0 && r.sareeName === String(dObj.sareeName).toUpperCase() && r.karigerName === String(dObj.kariger).toUpperCase());
        }
        if (!candidates.length && dObj && dObj.sareeName) {
            candidates = finRows.filter((r) => r.bachi > 0 && r.sareeName === String(dObj.sareeName).toUpperCase());
        }
        if (!candidates.length) {
            candidates = finRows.filter((r) => r.bachi > 0 && r.sareeName === targetDes);
        }

        const history = D.get('saree_history');
        const now = Date.now();
        let idx = 0;

        candidates.forEach((r) => {
            if (rem <= 0) return;
            const take = Math.min(rem, Math.round(D.num(r.bachi)));
            if (take <= 0) return;
            rem -= take;
            history.push({
                id: `saree_out_${now}_${idx++}_ch`,
                date: meta.date || D.today(),
                sareeName: r.sareeName,
                karigerName: r.karigerName,
                kariger: r.karigerName,
                partyName: meta.partyName || 'DUKAN PARTY',
                karkhanaId: r.karkhanaId || 'k_main',
                type: 'finished',
                typeLabel: `Dukan Challan #${meta.chNo || '-'}${meta.marka ? ` (${meta.marka})` : ''}`,
                aai: 0,
                gai: take,
                isOut: true,
                refId: meta.refId || `ch_${now}`,
                timestamp: now + idx
            });
        });

        if (rem > 0) {
            history.push({
                id: `saree_out_${now}_${idx}_ch`,
                date: meta.date || D.today(),
                sareeName: dObj?.sareeName || targetDes,
                karigerName: dObj?.kariger || 'DUKAN',
                kariger: dObj?.kariger || 'DUKAN',
                partyName: meta.partyName || 'DUKAN PARTY',
                karkhanaId: dObj?.karkhanaId || 'k_main',
                type: 'finished',
                typeLabel: `Dukan Challan #${meta.chNo || '-'}${meta.marka ? ` (${meta.marka})` : ''}`,
                aai: 0,
                gai: rem,
                isOut: true,
                refId: meta.refId || `ch_${now}`,
                timestamp: now + idx + 1
            });
        }

        D.set('saree_history', history);
        if (typeof window.invalidateSareeCalcCache === 'function') window.invalidateSareeCalcCache();
        if (typeof window.updateDashboardBadgeTotals === 'function') window.updateDashboardBadgeTotals();
    };

    D.getOrderProgress = (ord) => {
        const challans = D.get('dukan_challans').filter((c) => c.orderId === ord.id);
        const sentMap = {};
        challans.forEach((c) => {
            (c.items || []).forEach((it) => {
                const k = String(it.name || '').trim().toUpperCase();
                sentMap[k] = (sentMap[k] || 0) + D.num(it.qty);
            });
        });
        const items = (ord.items || []).map((it) => {
            const k = String(it.name || '').trim().toUpperCase();
            const ordered = D.num(it.qty);
            const sent = ord.status === 'Complete' && !challans.length ? ordered : (sentMap[k] || 0);
            const baki = Math.max(0, ordered - sent);
            return { ...it, ordered, sent, baki };
        });
        const allDone = items.length > 0 && items.every((x) => x.baki <= 0);
        const searchParts = [
            ord.no, ord.date, D.fmtDate(ord.date), ord.marka, ord.partyName, ord.agent, ord.transport,
            ...items.map((x) => x.name),
            ...challans.flatMap((c) => [
                c.no, c.date, D.fmtDate(c.date), c.marka,
                ...(c.items || []).map((ci) => `${ci.name} ${ci.qty}`)
            ])
        ];
        return { items, allDone, challans, searchText: searchParts.filter(Boolean).join(' ').toLowerCase() };
    };

    D.paginate = (arr, page = 1, size = D.pageSize) => {
        const total = arr.length;
        const pages = Math.max(1, Math.ceil(total / size));
        const p = Math.max(1, Math.min(page, pages));
        const start = (p - 1) * size;
        return { rows: arr.slice(start, start + size), page: p, pages, total, start };
    };

    D.pagerHTML = (pg, fnName) => `
        <div class="dk-pager">
            <span>Showing ${pg.total ? pg.start + 1 : 0}-${Math.min(pg.start + D.pageSize, pg.total)} of ${pg.total} (25/Page)</span>
            <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" class="dk-btn" ${pg.page <= 1 ? 'disabled' : ''} onclick="${fnName}(${pg.page - 1})">◀ Prev</button>
                <span>Page ${pg.page}/${pg.pages}</span>
                <button type="button" class="dk-btn" ${pg.page >= pg.pages ? 'disabled' : ''} onclick="${fnName}(${pg.page + 1})">Next ▶</button>
            </div>
        </div>
    `;

    const C39 = {
        '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn',
        '6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn','A':'wnnnnwnnw','B':'nnwnnwnnw',
        'C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn',
        'I':'nnwnnwwnn','J':'nnnnwwwnn','K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww',
        'O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
        'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn',
        '-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn'
    };
    D.barcodeSVG = (txt, h = 38) => {
        const clean = `*${String(txt || 'SAREE').toUpperCase().replace(/[^0-9A-Z\-. ]/g, '')}*`;
        let x = 2; const bars = [];
        for (let i = 0; i < clean.length; i++) {
            const p = C39[clean[i]] || C39['-'];
            for (let j = 0; j < 9; j++) {
                const w = p[j] === 'w' ? 2.8 : 1.1;
                if (j % 2 === 0) bars.push(`<rect x="${x}" y="1" width="${w}" height="${h}" fill="#111827"/>`);
                x += w;
            }
            x += 1.4;
        }
        return `<svg viewBox="0 0 ${Math.ceil(x + 2)} ${h + 2}" width="100%" height="${h}" preserveAspectRatio="none">${bars.join('')}</svg>`;
    };

    D.ensureStyles = () => {
        if (document.getElementById('dk-tally-styles')) return;
        const st = document.createElement('style');
        st.id = 'dk-tally-styles';
        st.textContent = `
            #dukan-section { padding:0 !important; background:transparent !important; box-shadow:none !important; border:none !important; font-family:'Inter',system-ui,sans-serif; }
            .dk-gw-card { max-width:500px; margin:12px auto; background:#fff; border:1px solid #e5d5a7; border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,0.08); overflow:hidden; }
            .dk-gw-head { background:#fdf6e2; border-bottom:1px solid #e5d5a7; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; font-weight:800; font-size:14.5px; }
            .dk-gw-sec { font-size:10px; font-weight:800; text-transform:uppercase; color:#92400e; padding:10px 16px 4px; letter-spacing:0.5px; }
            .dk-gw-row { width:100%; border:none; background:transparent; padding:9px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:13.5px; font-weight:600; color:#1f2937; text-align:left; }
            .dk-gw-row:hover { background:#fef9ea; }
            .dk-gw-row.active { background:#eab01e; color:#fff; font-weight:700; }
            .dk-gw-row small { font-size:11px; color:#6b7280; font-weight:600; }
            .dk-gw-row.active small { color:#fef9ea; }
            .dk-gw-key { text-decoration:underline; font-weight:800; color:#b45309; }
            .dk-gw-row.active .dk-gw-key { color:#fff; }
            .dk-card { width:100%; max-width:1160px; margin:6px auto; background:rgba(255,255,255,0.97); border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,0.08); overflow:hidden; }
            .dk-head { padding:11px 18px; border-bottom:1px solid #eceff3; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
            .dk-head-l { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
            .dk-head h2 { margin:0; font-size:16px; font-weight:800; color:#1f2937; }
            .dk-tab { border:1px solid #d1d5db; background:#fff; color:#374151; padding:5px 12px; border-radius:999px; font-size:11.5px; font-weight:700; cursor:pointer; }
            .dk-tab.active { background:#eab01e; border-color:#d99b07; color:#fff; }
            .dk-btn { border:1px solid #d1d5db; background:#f9fafb; color:#374151; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; }
            .dk-btn:hover:not(:disabled) { border-color:#d99b07; background:#fef9ea; }
            .dk-btn:disabled { opacity:0.45; cursor:not-allowed; }
            .dk-btn-gold { background:#eab01e; border:1px solid #d99b07; color:#fff; padding:7px 16px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; }
            .dk-btn-gold:focus, .dk-btn:focus { outline:2px solid #92400e; outline-offset:1px; box-shadow:0 0 0 3px rgba(234,176,30,0.35); }
            .dk-body { display:grid; grid-template-columns:1.6fr 0.85fr; gap:16px; padding:14px 18px; align-items:start; }
            .dk-row { display:grid; grid-template-columns:155px 1fr; align-items:center; gap:10px; margin-bottom:8px; }
            .dk-row label { font-size:12.5px; font-weight:700; color:#374151; }
            .dk-row input, .dk-row select { width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:5px; font-size:12.5px; font-weight:600; outline:none; background:#fff; }
            .dk-row input:focus, .dk-row select:focus { border-color:#eab01e; background:#fffdf5; box-shadow:0 0 0 2px rgba(234,176,30,0.22); }
            .dk-sec { font-size:10.5px; font-weight:800; color:#92400e; text-transform:uppercase; letter-spacing:0.4px; margin:10px 0 7px; padding-top:8px; border-top:1px dashed #e5e7eb; }
            .dk-side-box { background:#fff; border:1px solid #e5d5a7; border-radius:6px; overflow:hidden; position:sticky; top:10px; }
            .dk-side-head { padding:9px 14px; font-size:12.5px; font-weight:800; border-bottom:1px solid #e5d5a7; background:#fdf6e2; display:flex; justify-content:space-between; }
            .dk-side-head small { color:#92400e; font-weight:700; }
            .dk-side-list { max-height:420px; overflow-y:auto; }
            .dk-side-opt { padding:8px 13px; border-bottom:1px solid #f3f4f6; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12.5px; font-weight:600; }
            .dk-side-opt:hover { background:#fef9ea; }
            .dk-side-opt.selected { background:#eab01e; color:#111827; font-weight:800; }
            .dk-side-opt small { font-size:11px; color:#6b7280; font-weight:600; text-align:right; }
            .dk-side-opt.selected small { color:#1f2937; }
            .dk-tbl { width:100%; border-collapse:collapse; margin-top:6px; border:1px solid #e5e7eb; font-size:12px; background:#fff; }
            .dk-tbl th { background:#fdf6e2; padding:7px 8px; text-align:left; font-weight:800; border-bottom:1px solid #e5d5a7; }
            .dk-tbl td { padding:5px 7px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
            .dk-tbl input { width:100%; padding:5px 6px; border:1px solid #d1d5db; border-radius:4px; font-size:12px; font-weight:600; outline:none; }
            .dk-tbl input:focus { border-color:#eab01e; background:#fffdf5; }
            .dk-nav-row { cursor:pointer; }
            .dk-nav-row:hover { background:#fef9ea; }
            .dk-nav-row.active { background:#eab01e !important; color:#111827 !important; font-weight:700; }
            .dk-nav-row.active small, .dk-nav-row.active span { color:#1f2937 !important; }
            .dk-choice-btn { width:100%; border:1.5px solid #e5d5a7; background:#fff; border-radius:8px; padding:13px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; margin-bottom:10px; font-size:14px; font-weight:700; color:#1f2937; text-align:left; }
            .dk-choice-btn:hover { background:#fef9ea; }
            .dk-choice-btn.active { background:#eab01e; border-color:#d99b07; color:#111827; }
            .dk-cnt-pill { background:#fdf6e2; border:1px solid #d9b86c; color:#92400e; padding:3px 12px; border-radius:999px; font-size:12px; font-weight:800; }
            .dk-choice-btn.active .dk-cnt-pill { background:#fff; color:#1f2937; }
            .dk-accept { display:none; background:#fdf6e2; border:1.5px solid #d9b86c; border-radius:8px; padding:10px 14px; margin-top:10px; justify-content:space-between; align-items:center; gap:10px; }
            .dk-pager { display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:11.5px; font-weight:700; color:#6b7280; flex-wrap:wrap; gap:8px; }
            .dk-foot { padding:9px 18px; border-top:1px solid #eceff3; background:#fafafa; display:flex; justify-content:space-between; font-size:11.5px; color:#92400e; font-weight:700; }
            .dk-sticker { width:240px; border:1.5px dashed #d9b86c; border-radius:8px; padding:10px 12px; background:#fff; text-align:center; }
            .dk-ord-book { border:2px solid #991b1b; border-radius:6px; background:#fff; overflow:hidden; }
            .dk-ord-hdr { background:#fff5f5; border-bottom:2px solid #991b1b; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
            .dk-ord-grid { display:grid; grid-template-columns:1fr 245px; }
            .dk-ord-main { border-right:1.5px solid #991b1b; display:flex; flex-direction:column; }
            .dk-ord-ms { padding:7px 10px; border-bottom:1.5px solid #991b1b; display:flex; align-items:center; gap:8px; background:#fffafa; }
            .dk-ord-ms input { flex:1; border:none; border-bottom:1px dashed #991b1b; font-size:13.5px; font-weight:800; outline:none; background:transparent; padding:3px 4px; }
            .dk-ord-tbl { width:100%; border-collapse:collapse; font-size:12px; }
            .dk-ord-tbl th { background:#fef2f2; color:#991b1b; border-bottom:1.5px solid #991b1b; border-right:1px solid #fca5a5; padding:6px; font-weight:800; }
            .dk-ord-tbl td { border-bottom:1px solid #fecaca; border-right:1px solid #fecaca; padding:4px; }
            .dk-ord-tbl input { width:100%; border:none; padding:4px 5px; font-size:12px; font-weight:600; outline:none; background:transparent; }
            .dk-ord-tbl input:focus { background:#fffbeb; }
            .dk-ord-side { background:#fffdfd; display:flex; flex-direction:column; }
            .dk-ord-box { border-bottom:1px solid #fca5a5; padding:6px 8px; }
            .dk-ord-box label { display:block; font-size:10.5px; font-weight:800; color:#991b1b; margin-bottom:2px; }
            .dk-ord-box input { width:100%; border:1px solid #e5e7eb; border-radius:3px; padding:4px 6px; font-size:12px; font-weight:700; outline:none; }
            .dk-ord-box input:focus { border-color:#eab01e; background:#fffbeb; }
            .dk-ord-2 { display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid #fca5a5; }
            .dk-ord-2 > div { padding:6px 8px; }
            .dk-ord-2 > div:first-child { border-right:1px solid #fca5a5; }
            .dk-ord-2 label { display:block; font-size:10.5px; font-weight:800; color:#991b1b; margin-bottom:2px; }
            .dk-ord-2 input { width:100%; border:1px solid #e5e7eb; border-radius:3px; padding:4px 6px; font-size:12px; font-weight:700; outline:none; }
            @media (max-width:900px) { .dk-body, .dk-ord-grid { grid-template-columns:1fr; } .dk-ord-main { border-right:none; border-bottom:1.5px solid #991b1b; } .dk-row { grid-template-columns:1fr; gap:4px; } }
        `;
        document.head.appendChild(st);
    };

    D.renderSide = (title, sub, items, highlightFirst = true) => {
        D.sideItems = items || [];
        const pre = D.sideItems.findIndex((x) => x.active);
        D.sideIdx = pre >= 0 ? pre : (highlightFirst && D.sideItems.length ? 0 : -1);

        const tEl = document.getElementById('dk-side-title');
        const sEl = document.getElementById('dk-side-sub');
        const lEl = document.getElementById('dk-side-items');
        if (!tEl || !lEl) return;

        tEl.textContent = title;
        if (sEl) sEl.textContent = sub;
        if (!D.sideItems.length) {
            lEl.innerHTML = `<div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">Koi list item nahi</div>`;
            return;
        }
        lEl.innerHTML = D.sideItems.map((it, i) => `
            <div class="dk-side-opt ${i === D.sideIdx ? 'selected' : ''}" data-sidx="${i}" onmousedown="event.preventDefault(); DukanERP.pickSide(${i})">
                <span>${D.esc(it.label)}</span>
                <small>${D.esc(it.meta || '')}</small>
            </div>
        `).join('');
    };

    D.pickSide = (idx) => {
        const b = D.activeSideId ? D.sideBindings[D.activeSideId] : null;
        if (!b || !D.sideItems[idx]) return;
        D.sideIdx = idx;
        b.onPick(D.sideItems[idx], idx);
    };

    D.bindFormControls = (cfg = {}) => {
        D.focusOrder = cfg.focusOrder || [];
        D.sideBindings = cfg.sideBindings || {};
        D.listNav = cfg.listNav || null;
        D.onFinishForm = cfg.onFinishForm || null;
        D.activeSideId = null;
        D.sideNavigated = false;

        Object.keys(D.sideBindings).forEach((fid) => {
            const el = document.getElementById(fid);
            if (!el) return;
            const b = D.sideBindings[fid];
            const refreshSide = (isTyping) => {
                D.activeSideId = fid;
                const val = el.value || '';
                const items = b.getItems(val);
                const hl = isTyping ? Boolean(val.trim()) : !b.noAutoHighlight;
                if (!isTyping) D.sideNavigated = false;
                else if (val.trim()) D.sideNavigated = true;
                D.renderSide(b.title, `${items.length} Found`, items, hl);
            };
            el.addEventListener('focus', () => refreshSide(false));
            el.addEventListener('click', () => refreshSide(false));
            el.addEventListener('input', () => refreshSide(true));
        });

        D.focusOrder.forEach((fid) => {
            if (D.sideBindings[fid]) return;
            const el = document.getElementById(fid);
            if (!el) return;
            el.addEventListener('focus', () => {
                D.activeSideId = null;
                D.sideNavigated = false;
                if (cfg.defaultSide) cfg.defaultSide();
            });
        });
    };

    D.focusField = (id) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) { el.focus(); if (el.select) el.select(); }
        }, 15);
    };

    D.moveFocus = (curId, dir = 1) => {
        const idx = D.focusOrder.indexOf(curId);
        if (idx < 0) return;
        const nextIdx = idx + dir;
        if (nextIdx >= 0 && nextIdx < D.focusOrder.length) {
            D.focusField(D.focusOrder[nextIdx]);
        } else if (dir > 0 && typeof D.onFinishForm === 'function') {
            D.onFinishForm();
        }
    };

    D.askAccept = (yesFn, noFn) => {
        const box = document.getElementById('dk-accept-box');
        if (!box) return yesFn();
        box.style.display = 'flex';
        D._acceptYes = yesFn;
        D._acceptNo = noFn || (() => { box.style.display = 'none'; });
        setTimeout(() => document.getElementById('dk-accept-yes')?.focus(), 15);
    };

    D.renderShell = (headLeftHTML, leftBodyHTML, footLeft = '[Enter] Agla Box · [Shift+Enter] Pichhla Box · [Ctrl+Enter] Save · [Esc] Back') => {
        const sec = document.getElementById('dukan-section');
        if (!sec) return;
        const msg = D.lastToast || footLeft;
        D.lastToast = '';
        sec.innerHTML = `
            <div class="dk-card">
                <div class="dk-head">
                    <div class="dk-head-l">${headLeftHTML}</div>
                    <button type="button" class="dk-btn" onclick="DukanERP.handleEsc()">← [Esc] Back</button>
                </div>
                <div class="dk-body">
                    <div id="dk-left">${leftBodyHTML}</div>
                    <div class="dk-side-box">
                        <div class="dk-side-head"><span id="dk-side-title">List</span><small id="dk-side-sub">Select</small></div>
                        <div class="dk-side-list" id="dk-side-items"></div>
                    </div>
                </div>
                <div class="dk-foot">
                    <span id="dk-toast-msg">${D.esc(msg)}</span>
                    <span>Simplicity · The Tally Bridge</span>
                </div>
            </div>
        `;
    };

    D.handleEsc = () => {
        const acc = document.getElementById('dk-accept-box');
        if (acc && acc.style.display === 'flex') {
            acc.style.display = 'none';
            if (typeof D._acceptNo === 'function') D._acceptNo();
            return;
        }
        if (typeof D.onEsc === 'function') D.onEsc();
        else window.openDukanGateway();
    };

    const GW_ITEMS = [
        { k: 'c', label: '<span class="dk-gw-key">C</span>reate (Firm / Party / Alter)', meta: 'Master Setup', fn: () => D.openCreate() },
        { k: 'p', label: '<span class="dk-gw-key">P</span>arty Register', meta: 'Party → Pending / Complete', fn: () => D.openPartyRegister() },
        { k: 'n', label: '<span class="dk-gw-key">N</span>aming &amp; Barcoding', meta: 'Finished → Sticker', fn: () => D.openBarcode() },
        { k: 'o', label: '<span class="dk-gw-key">O</span>rder Form', meta: 'Batch Format', fn: () => D.openOrderForm() },
        { k: 'h', label: 'C<span class="dk-gw-key">h</span>allan &amp; Packing Slip', meta: 'Finished Minus + Slip', fn: () => D.openChallan() },
        { k: 'd', label: 'Pen<span class="dk-gw-key">d</span>ing Order (All)', meta: 'Party Wise', fn: () => D.openAllOrders('Pending') },
        { k: 'l', label: 'Comp<span class="dk-gw-key">l</span>ete Order (All)', meta: 'Party Wise', fn: () => D.openAllOrders('Complete') }
    ];

    window.openDukanGateway = function () {
        D.ensureStyles();
        document.querySelectorAll('.module-section').forEach((s) => s.style.display = 'none');
        const dView = document.getElementById('dashboard-view');
        if (dView) dView.style.display = 'none';
        const sec = document.getElementById('dukan-section');
        if (!sec) return;
        sec.style.display = 'block';
        D.screen = 'gateway';
        D.focusOrder = [];
        D.sideBindings = {};
        D.listNav = null;
        D.onEsc = null;

        const ords = D.get('dukan_orders');
        GW_ITEMS[5].meta = `${ords.filter((o) => o.status !== 'Complete').length} Pending`;
        GW_ITEMS[6].meta = `${ords.filter((o) => o.status === 'Complete').length} Complete`;

        sec.innerHTML = `
            <div class="dk-gw-card">
                <div class="dk-gw-head">
                    <span>Gateway of Dukan Management</span>
                    <button type="button" class="dk-btn" onclick="backToDashboard()">← [Esc] Main Gateway</button>
                </div>
                <div class="dk-gw-sec">Masters</div>
                ${renderGwRow(0)}
                <div class="dk-gw-sec">Registers &amp; Barcoding</div>
                ${renderGwRow(1)}${renderGwRow(2)}
                <div class="dk-gw-sec">Orders &amp; Dispatch</div>
                ${renderGwRow(3)}${renderGwRow(4)}
                <div class="dk-gw-sec">Reports (All Parties)</div>
                ${renderGwRow(5)}${renderGwRow(6)}
                <div class="dk-gw-head" style="border-top:1px solid #e5d5a7; border-bottom:none; font-size:11px; color:#92400e; font-weight:700;">
                    <span>↑ ↓ Arrow · [Enter] Kholein · [Esc] Back</span>
                    <span>The Tally Bridge</span>
                </div>
            </div>
        `;
    };

    function renderGwRow(i) {
        const it = GW_ITEMS[i];
        return `<button type="button" class="dk-gw-row ${i === D.gwIdx ? 'active' : ''}" onclick="DukanERP.runGw(${i})"><span>${it.label}</span><small>${D.esc(it.meta)}</small></button>`;
    }

    D.runGw = (i) => { D.gwIdx = i; if (GW_ITEMS[i]) GW_ITEMS[i].fn(); };

    document.addEventListener('keydown', (e) => {
        const sec = document.getElementById('dukan-section');
        if (!sec || sec.style.display === 'none') return;

        if (D.screen === 'gateway') {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); window.backToDashboard(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); D.gwIdx = (D.gwIdx + 1) % GW_ITEMS.length; window.openDukanGateway(); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); D.gwIdx = (D.gwIdx - 1 + GW_ITEMS.length) % GW_ITEMS.length; window.openDukanGateway(); return; }
            if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); D.runGw(D.gwIdx); return; }
            if (!e.ctrlKey && !e.altKey && e.key.length === 1) {
                const idx = GW_ITEMS.findIndex((x) => x.k === e.key.toLowerCase());
                if (idx >= 0) { e.preventDefault(); e.stopImmediatePropagation(); D.runGw(idx); }
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault(); e.stopImmediatePropagation();
            D.handleEsc();
            return;
        }

        const acc = document.getElementById('dk-accept-box');
        if (acc && acc.style.display === 'flex') {
            if (e.key.toLowerCase() === 'y' || (e.key === 'Enter' && document.activeElement?.id !== 'dk-accept-no')) {
                e.preventDefault(); e.stopImmediatePropagation();
                if (typeof D._acceptYes === 'function') D._acceptYes();
                return;
            }
            if (e.key.toLowerCase() === 'n') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (typeof D._acceptNo === 'function') D._acceptNo();
                return;
            }
        }

        if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'a')) {
            if (typeof D.onFinishForm === 'function') {
                e.preventDefault(); e.stopImmediatePropagation();
                D.onFinishForm();
                return;
            }
        }

        const activeEl = document.activeElement;
        const activeId = activeEl?.id || '';

        if (e.key === 'Enter' && e.shiftKey && activeId && D.focusOrder.includes(activeId)) {
            e.preventDefault(); e.stopImmediatePropagation();
            D.moveFocus(activeId, -1);
            return;
        }

        if (activeEl?.tagName === 'BUTTON' && !activeEl.classList.contains('dk-choice-btn')) {
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopImmediatePropagation();
                activeEl.click();
            }
            return;
        }

        if (activeId && D.sideBindings[activeId]) {
            D.activeSideId = activeId;
            const b = D.sideBindings[activeId];
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!D.sideItems.length) return;
                e.preventDefault(); e.stopImmediatePropagation();
                D.sideNavigated = true;
                if (D.sideIdx < 0) D.sideIdx = e.key === 'ArrowDown' ? 0 : D.sideItems.length - 1;
                else D.sideIdx = e.key === 'ArrowDown'
                    ? (D.sideIdx + 1) % D.sideItems.length
                    : (D.sideIdx - 1 + D.sideItems.length) % D.sideItems.length;
                const opts = Array.from(document.querySelectorAll('#dk-side-items .dk-side-opt'));
                opts.forEach((o, i) => o.classList.toggle('selected', i === D.sideIdx));
                opts[D.sideIdx]?.scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopImmediatePropagation();
                const valTrim = String(activeEl.value || '').trim();
                if (typeof b.onEmptyEnter === 'function' && !valTrim && !D.sideNavigated) {
                    b.onEmptyEnter();
                    return;
                }
                if (D.sideIdx >= 0 && D.sideItems[D.sideIdx]) {
                    D.pickSide(D.sideIdx);
                } else {
                    D.moveFocus(activeId, 1);
                }
                return;
            }
        }

        if (D.listNav) {
            const rows = Array.from(document.querySelectorAll(D.listNav.selector));
            const inSearch = Boolean(D.listNav.searchId && activeId === D.listNav.searchId);
            const onChoice = Boolean(activeEl?.classList.contains('dk-choice-btn'));
            const onBody = (!activeEl || activeEl === document.body);
            if (rows.length && (inSearch || onChoice || onBody)) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    let cur = D.listNav.getIdx();
                    cur = e.key === 'ArrowDown' ? (cur + 1) % rows.length : (cur - 1 + rows.length) % rows.length;
                    D.listNav.setIdx(cur);
                    rows.forEach((r, i) => r.classList.toggle('active', i === cur));
                    rows[cur]?.scrollIntoView({ block: 'nearest' });
                    if (typeof D.listNav.onHighlight === 'function') D.listNav.onHighlight(cur);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    D.listNav.onEnter(D.listNav.getIdx());
                    return;
                }
            }
        }

        if (activeId && D.focusOrder.includes(activeId)) {
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (typeof D.onCustomFieldEnter === 'function' && D.onCustomFieldEnter(activeId)) return;
                D.moveFocus(activeId, 1);
                return;
            }
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && activeEl.tagName !== 'SELECT') {
                e.preventDefault(); e.stopImmediatePropagation();
                D.moveFocus(activeId, e.key === 'ArrowDown' ? 1 : -1);
            }
        }
    }, true);
})();
