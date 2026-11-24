/* ============================================================================
   NAMING & BARCODING:
   - 2-Button Menu: [Design & Barcode] & [Barcode Register]
   - Clean Form (No Register Clutter)
   - Dedicated Barcode Register with Universal Search + Edit / Delete / TSC Print
   - Fixed TSC 2-Up (50x25mm x 2) Thermal Alignment & Crisp Print Settings
   File: dukan-erp/dukan-barcode.js
============================================================================ */
(() => {
    'use strict';

    const D = window.DukanERP;
    if (!D) {
        console.error('[dukan-barcode] DukanERP core load nahi hua!');
        return;
    }

    let viewMode = 'choice'; // 'choice' | 'form' | 'register'
    let choiceIdx = 0;
    let editId = '';
    let fromRegister = false;
    let linkedSareeName = '';
    let linkedKarkhanaId = 'k_main';
    let regSearch = '';
    let regPage = 1;
    let regNav = 0;

    D.openBarcode = () => {
        D.screen = 'barcode';
        D.onCustomFieldEnter = null;
        viewMode = 'choice';
        choiceIdx = 0;
        editId = '';
        fromRegister = false;
        linkedSareeName = '';
        linkedKarkhanaId = 'k_main';
        regSearch = '';
        regPage = 1;
        regNav = 0;
        D.onEsc = () => {
            if (viewMode === 'form') {
                viewMode = fromRegister ? 'register' : 'choice';
                editId = '';
                fromRegister = false;
                render();
            } else if (viewMode === 'register') {
                viewMode = 'choice';
                render();
            } else {
                window.openDukanGateway();
            }
        };
        render();
    };

    D.bcOpenChoice = (idx) => {
        choiceIdx = idx;
        if (idx === 0) {
            viewMode = 'form';
            editId = '';
            fromRegister = false;
            linkedSareeName = '';
            linkedKarkhanaId = 'k_main';
            render('bc-kar');
        } else {
            viewMode = 'register';
            regPage = 1;
            regNav = 0;
            render();
        }
    };

    D.bcBackToChoice = () => {
        viewMode = 'choice';
        editId = '';
        fromRegister = false;
        render();
    };

    window.dkBcRegPage = (p) => {
        regPage = p;
        regNav = 0;
        render();
    };

    function renderChoiceScreen() {
        const designs = D.get('dukan_designs');
        const finRows = D.getFinishedStockRows();

        const left = `
            <div style="background:#fdf6e2; border:1px solid #e5d5a7; border-radius:8px; padding:12px; margin-bottom:14px;">
                <strong style="font-size:15px;">Naming &amp; Barcoding Menu</strong>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">
                    Naya Design/Sticker banane ya Saved Barcode Register dekhne ke liye option chunein
                </div>
            </div>
            <button type="button" class="dk-choice-btn ${choiceIdx === 0 ? 'active' : ''}" onclick="DukanERP.bcOpenChoice(0)">
                <span>🏷️ Design &amp; Barcode (New / Sticker Print)</span>
                <span class="dk-cnt-pill">${finRows.length} Fin</span>
            </button>
            <button type="button" class="dk-choice-btn ${choiceIdx === 1 ? 'active' : ''}" onclick="DukanERP.bcOpenChoice(1)">
                <span>📋 Barcode Register (All Saved List)</span>
                <span class="dk-cnt-pill">${designs.length}</span>
            </button>
        `;

        D.renderShell(`<h2>Naming &amp; Barcoding (TSC 2-Up Sticker)</h2>`, left, '[↑ ↓] Option Chunein · [Enter] Kholein · [Esc] Back');
        D.renderSide('Barcoding Summary', `${designs.length} Saved`, [
            { label: 'Design & Barcode', meta: 'Naya Naming / Print', active: choiceIdx === 0 },
            { label: 'Barcode Register', meta: `${designs.length} Designs Saved`, active: choiceIdx === 1 },
            { label: 'Finished Stock Items', meta: `${finRows.length} Active` }
        ], false);

        D.bindFormControls({
            listNav: {
                selector: '#dk-left .dk-choice-btn',
                getIdx: () => choiceIdx,
                setIdx: (i) => { choiceIdx = i; },
                onEnter: (i) => D.bcOpenChoice(i)
            }
        });
        setTimeout(() => document.querySelectorAll('#dk-left .dk-choice-btn')[choiceIdx]?.focus(), 20);
    }

    function renderRegisterScreen() {
        const designs = D.get('dukan_designs');
        const getFiltered = () => {
            const q = regSearch.trim().toLowerCase();
            if (!q) return designs.filter(Boolean);
            return designs.filter((d) => {
                if (!d) return false;
                const bachi = D.getDesignFinishedStock(d);
                const blob = `${d.design || ''} ${d.kariger || ''} ${d.sareeName || ''} ${d.specs || ''} ${d.code || ''} ${bachi}`.toLowerCase();
                return blob.includes(q);
            });
        };

        const showRegSide = (d) => {
            if (!d) return D.renderSide('Barcode Register', '0', [], false);
            const bachi = D.getDesignFinishedStock(d);
            D.renderSide(d.design, d.code || '-', [
                { label: `Code: ${d.code || '-'}`, meta: 'Barcode', active: true },
                { label: `Specs: ${d.specs || '-'}`, meta: 'Top Line' },
                { label: `Kariger: ${d.kariger || '-'}`, meta: d.sareeName || '' },
                { label: `Finished Bachi: ${bachi} Pc`, meta: 'Live Stock' }
            ], false);
        };

        const drawRows = () => {
            const flt = getFiltered();
            const pg = D.paginate(flt, regPage);
            if (regNav >= pg.rows.length) regNav = 0;

            const tb = document.getElementById('bc-reg-tb');
            if (tb) {
                tb.innerHTML = pg.rows.length ? pg.rows.map((d, i) => {
                    const bachi = D.getDesignFinishedStock(d);
                    const safeId = D.esc(String(d.id || ''));
                    return `
                        <tr class="dk-nav-row ${i === regNav ? 'active' : ''}" onclick="DukanERP.bcEditFromReg('${safeId}')">
                            <td><strong>${D.esc(d.design)}</strong><br><small>${D.esc(d.specs || '-')}</small></td>
                            <td><b>${D.esc(d.code || '-')}</b></td>
                            <td>${D.esc(d.kariger || '-')}<br><small>${D.esc(d.sareeName || '-')}</small></td>
                            <td><strong style="color:#15803d;">${bachi} Pc</strong></td>
                            <td style="white-space:nowrap;">
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.bcEditFromReg('${safeId}')">✏️ Edit</button>
                                <button type="button" class="dk-btn" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.bcQuickPrint('${safeId}')">🖨️ TSC</button>
                                <button type="button" class="dk-btn-del" style="padding:3px 7px;font-size:11px;" onclick="event.stopPropagation(); DukanERP.deleteDesignById('${safeId}')">🗑️ Del</button>
                            </td>
                        </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Koi barcode / design nahi mila</td></tr>`;
            }

            const pgBox = document.getElementById('bc-reg-pg');
            if (pgBox) pgBox.innerHTML = D.pagerHTML(pg, 'dkBcRegPage');
            showRegSide(pg.rows[regNav]);
        };

        const headL = `
            <h2>Barcode Register (${designs.length})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.bcOpenChoice(0)">+ Design &amp; Barcode</button>
            <button type="button" class="dk-btn" onclick="DukanERP.bcBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-row">
                <label>🔍 Universal Search :</label>
                <input id="bc-reg-q" value="${D.esc(regSearch)}" placeholder="Design, Barcode Code, Kariger, Saree ya Specs likhein..." autocomplete="off">
            </div>
            <table class="dk-tbl">
                <thead>
                    <tr>
                        <th>Design / Specs</th>
                        <th>Barcode Code</th>
                        <th>Kariger / Saree</th>
                        <th>Finished Bachi</th>
                        <th>Action (Edit / Del / Print)</th>
                    </tr>
                </thead>
                <tbody id="bc-reg-tb"></tbody>
            </table>
            <div id="bc-reg-pg"></div>
        `;

        D.renderShell(headL, left, '[↑ ↓] Select · [Enter / Click] Edit & Delete kholein · [Esc] Menu');
        drawRows();

        const qEl = document.getElementById('bc-reg-q');
        if (qEl) {
            qEl.addEventListener('input', () => {
                regSearch = qEl.value;
                regPage = 1;
                regNav = 0;
                drawRows();
            });
            qEl.focus();
        }

        D.bindFormControls({
            listNav: {
                selector: '#bc-reg-tb .dk-nav-row',
                searchId: 'bc-reg-q',
                getIdx: () => regNav,
                setIdx: (i) => { regNav = i; },
                onHighlight: (i) => showRegSide(D.paginate(getFiltered(), regPage).rows[i]),
                onEnter: (i) => {
                    const row = D.paginate(getFiltered(), regPage).rows[i];
                    if (row) D.bcEditFromReg(row.id);
                }
            }
        });
    }

    function renderFormScreen(focusId = 'bc-kar') {
        const designs = D.get('dukan_designs');
        const finRows = D.getFinishedStockRows();
        const karigers = D.getKarigers();
        const cur = editId ? designs.find((x) => x && x.id === editId) : null;

        const curKar = cur?.kariger || '';
        const curSaree = cur?.sareeName || linkedSareeName || '';
        const liveFin = cur ? D.getDesignFinishedStock(cur) : 0;

        const headL = `
            <h2>Design &amp; Barcode (${cur ? `Edit: ${D.esc(cur.design)}` : 'New Naming'})</h2>
            <button type="button" class="dk-tab" onclick="DukanERP.bcOpenChoice(1)">📋 Barcode Register (${designs.length})</button>
            <button type="button" class="dk-btn" onclick="DukanERP.bcBackToChoice()">← Menu</button>
        `;

        const left = `
            <div class="dk-row"><label>Finished Kariger :</label><input id="bc-kar" value="${D.esc(curKar)}" placeholder="Finished Stock / Kariger chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Saree (Finished) :</label><input id="bc-saree" value="${D.esc(curSaree)}" placeholder="Finished stage ka saree naam" autocomplete="off"></div>
            <div class="dk-row"><label>Design Name :</label><input id="bc-des" value="${D.esc(cur?.design || '')}" placeholder="Jaise: RASHMIKA" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Top Specs Line :</label><input id="bc-spec" value="${D.esc(cur?.specs || '3.60 CM EMB. JHALAR')}" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Barcode Code :</label><input id="bc-code" value="${D.esc(cur?.code || '')}" placeholder="Jaise: D.NO.6610" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Finished Stock (Live) :</label><input id="bc-fin" value="${liveFin} Pcs (Saree Finished Tab)" readonly style="background:#f9fafb;color:#15803d;"></div>
            <div class="dk-row"><label>Sticker Qty &amp; Size :</label>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <input type="number" id="bc-pqty" value="${liveFin > 0 ? liveFin : 10}" style="width:80px;">
                    <select id="bc-psize">
                        <option value="tsc2up">TSC 2-Up Roll (50×25mm × 2)</option>
                        <option value="tsc1up">TSC 1-Up Roll (50×25mm)</option>
                        <option value="a4">A4 Sticker Sheet</option>
                    </select>
                    <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;width:auto;cursor:pointer;">
                        <input type="checkbox" id="bc-textonly" onchange="DukanERP.updSticker()" style="width:auto;">
                        Bina Barcode (2-Line)
                    </label>
                </div>
            </div>

            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; background:#fdf6e2; border:1px solid #e5d5a7; padding:12px; border-radius:8px; margin:10px 0;">
                <div class="dk-sticker" id="dk-sticker-prev"></div>
                <div style="display:flex; flex-direction:column; gap:7px;">
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askBarcodeSave()">💾 ${cur ? 'Update' : 'Save'} Naming [Ctrl+Enter]</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printStickers()">🖨️ Print TSC Stickers</button>
                    ${cur ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteDesign()">🗑️ Delete Design</button>` : ''}
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>${cur ? 'Update' : 'Save'} Design &amp; Barcode?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveDesign()">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('bc-spec');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left, '[Enter] Agla Box · [Ctrl+Enter] Save · [Esc] Back');
        D.updSticker();

        D.bindFormControls({
            focusOrder: ['bc-kar', 'bc-saree', 'bc-des', 'bc-spec', 'bc-code', 'bc-pqty'],
            sideBindings: {
                'bc-kar': {
                    title: `Finished Stock (${finRows.length}) & Karigers`,
                    getItems: (q) => {
                        const ql = q.toLowerCase();
                        const items = [];
                        finRows
                            .filter((r) => r && (!ql || `${r.karigerName || ''} ${r.sareeName || ''}`.toLowerCase().includes(ql)))
                            .forEach((r) => {
                                const ex = designs.find((d) => d &&
                                    String(d.kariger || '').toUpperCase() === r.karigerName &&
                                    (!d.sareeName || String(d.sareeName).toUpperCase() === r.sareeName)
                                );
                                items.push({
                                    label: `${r.karigerName} · ${r.sareeName}`,
                                    meta: `${r.bachi} Pc Fin${ex ? ` → ${ex.design}` : ''}`,
                                    karigerName: r.karigerName,
                                    sareeName: r.sareeName,
                                    karkhanaId: r.karkhanaId,
                                    bachi: r.bachi,
                                    existingId: ex?.id || ''
                                });
                            });
                        karigers
                            .filter((k) => k && k.name && (!ql || `${k.name} ${k.saree || ''}`.toLowerCase().includes(ql)))
                            .slice(0, 40)
                            .forEach((k) => {
                                const nm = String(k.name).toUpperCase();
                                const ex = designs.find((d) => d && String(d.kariger || '').toUpperCase() === nm);
                                items.push({
                                    label: nm,
                                    meta: ex ? `Design: ${ex.design}` : (k.saree || 'Kariger'),
                                    karigerName: nm,
                                    sareeName: k.saree || '',
                                    karkhanaId: k.karkhanaId || 'k_main',
                                    bachi: 0,
                                    existingId: ex?.id || ''
                                });
                            });
                        return items.slice(0, 60);
                    },
                    onPick: (it) => {
                        linkedSareeName = it.sareeName || '';
                        linkedKarkhanaId = it.karkhanaId || 'k_main';
                        if (it.existingId) {
                            editId = it.existingId;
                            D.toast(`🔗 [${it.karigerName}] ka purana design load hua — Top Specs / Code update karein!`);
                            render('bc-spec');
                        } else {
                            editId = '';
                            document.getElementById('bc-kar').value = it.karigerName || '';
                            document.getElementById('bc-saree').value = it.sareeName || '';
                            const finEl = document.getElementById('bc-fin');
                            if (finEl) finEl.value = `${it.bachi || 0} Pcs (Saree Finished Tab)`;
                            D.focusField('bc-des');
                        }
                    }
                },
                'bc-des': {
                    title: 'Saved Designs',
                    noAutoHighlight: true,
                    getItems: (q) => designs
                        .filter((d) => d && (!q || `${d.design || ''} ${d.kariger || ''}`.toLowerCase().includes(q.toLowerCase())))
                        .slice(0, 60)
                        .map((d) => ({ id: d.id, label: d.design, meta: `${d.kariger} · ${D.getDesignFinishedStock(d)} Pc` })),
                    onPick: (it) => {
                        const typed = (document.getElementById('bc-des')?.value || '').trim().toUpperCase();
                        if (typed && typed !== it.label) {
                            const cd = document.getElementById('bc-code');
                            if (cd && !cd.value.trim()) cd.value = `${typed}-KT`;
                            D.updSticker();
                            D.focusField('bc-spec');
                        } else {
                            D.loadDesign(it.id);
                        }
                    }
                }
            },
            defaultSide: () => D.renderSide('Finished Saree Stock', `${finRows.length} Items`, finRows.slice(0, 40).map((r) => ({
                label: `${r.karigerName} · ${r.sareeName}`, meta: `${r.bachi} Pc`
            })), false),
            onFinishForm: () => D.askBarcodeSave()
        });

        D.focusField(focusId);
    }

    function render(focusId = 'bc-kar') {
        if (viewMode === 'choice') return renderChoiceScreen();
        if (viewMode === 'register') return renderRegisterScreen();
        return renderFormScreen(focusId);
    }

    D.bcEditFromReg = (id) => {
        editId = id;
        fromRegister = true;
        viewMode = 'form';
        render('bc-spec');
    };

    D.loadDesign = (id) => {
        editId = id;
        viewMode = 'form';
        render('bc-spec');
    };

    D.updSticker = () => {
        const sp = (document.getElementById('bc-spec')?.value || '3.60 CM EMB. JHALAR').toUpperCase();
        const nm = (document.getElementById('bc-des')?.value || 'RASHMIKA').toUpperCase();
        const cd = (document.getElementById('bc-code')?.value || (nm ? `${nm}-KT` : 'RASHMIKA-KT')).toUpperCase();
        const textOnly = !!document.getElementById('bc-textonly')?.checked;
        const box = document.getElementById('dk-sticker-prev');
        if (!box) return;
        if (textOnly) {
            box.innerHTML = `
                <div style="font-size:11px; font-weight:800; color:#000; line-height:1.2; margin-bottom:6px;">${D.esc(sp)}</div>
                <div style="font-size:15px; font-weight:900; color:#000; line-height:1.2; letter-spacing:0.6px;">${D.esc(cd || nm)}</div>
            `;
        } else {
            box.innerHTML = `
                <div style="font-size:10px; font-weight:800; color:#000; line-height:1.15;">${D.esc(sp)}</div>
                <div style="font-size:15px; font-weight:800; color:#000; line-height:1.15; margin:1px 0;">${D.esc(nm)}</div>
                <div style="padding:0 10px;">${D.barcodeSVG(cd, 26)}</div>
                <div style="font-size:11px; font-weight:800; color:#000; line-height:1.15;">${D.esc(cd)}</div>
            `;
        }
    };

    D.askBarcodeSave = () => {
        const des = (document.getElementById('bc-des')?.value || '').trim();
        if (!des) { D.toast('⚠️ Design Name bharein!'); return D.focusField('bc-des'); }
        D.askAccept(() => D.saveDesign());
    };

    D.saveDesign = () => {
        const kariger = (document.getElementById('bc-kar')?.value || '').trim().toUpperCase();
        const sareeName = (document.getElementById('bc-saree')?.value || '').trim().toUpperCase();
        const design = (document.getElementById('bc-des')?.value || '').trim().toUpperCase();
        if (!design) return D.focusField('bc-des');
        const specs = (document.getElementById('bc-spec')?.value || '').trim().toUpperCase();
        const code = (document.getElementById('bc-code')?.value || `${design}-KT`).trim().toUpperCase();

        const list = D.get('dukan_designs');
        const existing = editId ? list.find((x) => x && x.id === editId) : list.find((x) => x && x.design === design);
        if (existing) {
            existing.kariger = kariger || existing.kariger;
            existing.sareeName = sareeName || existing.sareeName || design;
            existing.karkhanaId = linkedKarkhanaId || existing.karkhanaId || 'k_main';
            existing.design = design;
            existing.specs = specs;
            existing.code = code;
        } else {
            list.push({
                id: `des_${Date.now()}`,
                kariger,
                sareeName: sareeName || design,
                karkhanaId: linkedKarkhanaId || 'k_main',
                design,
                specs,
                code
            });
        }
        D.set('dukan_designs', list);
        D.toast(`✅ [${design}] save ho gaya!`);
        editId = '';
        linkedSareeName = '';
        if (fromRegister) {
            fromRegister = false;
            viewMode = 'register';
        }
        render('bc-kar');
    };

    D.deleteDesign = () => {
        if (!editId) return;
        D.deleteDesignById(editId);
    };

    D.deleteDesignById = (id) => {
        const list = D.get('dukan_designs');
        const target = list.find((x) => x && x.id === id);
        if (!target) return;
        if (!confirm(`Kya aap [${target.design}] Design & Barcode delete karna chahte hain?`)) return;
        D.set('dukan_designs', list.filter((x) => x && x.id !== id));
        D.toast(`🗑️ [${target.design}] delete ho gaya!`);
        editId = '';
        if (fromRegister || viewMode === 'register') {
            fromRegister = false;
            viewMode = 'register';
        }
        render('bc-kar');
    };

    /* ========================================================================
       FIXED TSC PRINT ENGINE:
       - Exact 104mm x 25mm 2-Up alignment (1mm margin + 50mm + 2mm gap + 50mm + 1mm)
       - 24.4mm safe row height + no trailing blank page
       - Crisp thermal contrast & anti-blur SVG rendering
    ======================================================================== */
    function printStickerJob(sp, nm, cd, count, mode, textOnly = false) {
        const svg = D.barcodeSVG(cd, 26);

        const cellHTML = textOnly
            ? `<div class="lbl lbl-2line">
                   <div class="sp sp-2line">${D.esc(sp)}</div>
                   <div class="cd cd-2line">${D.esc(cd || nm)}</div>
               </div>`
            : `<div class="lbl">
                   <div class="sp">${D.esc(sp)}</div>
                   <div class="nm">${D.esc(nm)}</div>
                   <div class="bc">${svg}</div>
                   <div class="cd">${D.esc(cd)}</div>
               </div>`;

        let bodyHTML = '';
        let pageCSS = '';

        if (mode === 'tsc2up') {
            pageCSS = `
                @page { size: 104mm 25mm; margin: 0; }
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 104mm;
                    background: #fff;
                }
                .row2 {
                    width: 104mm;
                    height: 24.4mm;
                    max-height: 24.4mm;
                    padding: 0 1mm;
                    box-sizing: border-box;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 2mm;
                    overflow: hidden;
                }
                .row2:not(:last-child) {
                    page-break-after: always;
                    break-after: page;
                }
                .lbl {
                    width: 50mm;
                    height: 23.6mm;
                    padding: 0.8mm 1.5mm;
                    box-sizing: border-box;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }`;
            for (let i = 0; i < count; i += 2) {
                bodyHTML += `<div class="row2">${cellHTML}${i + 1 < count ? cellHTML : '<div class="lbl"></div>'}</div>`;
            }
        } else if (mode === 'tsc1up') {
            pageCSS = `
                @page { size: 50mm 25mm; margin: 0; }
                html, body { margin: 0 !important; padding: 0 !important; width: 50mm; background: #fff; }
                .lbl {
                    width: 50mm;
                    height: 24.2mm;
                    padding: 0.8mm 1.5mm;
                    box-sizing: border-box;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }
                .lbl:not(:last-child) { page-break-after: always; break-after: page; }`;
            bodyHTML = Array(count).fill(cellHTML).join('');
        } else {
            pageCSS = `
                @page { size: A4; margin: 8mm; }
                html, body { margin: 0; padding: 0; background: #fff; }
                body { display: flex; flex-wrap: wrap; gap: 3mm; align-content: flex-start; }
                .lbl {
                    width: 50mm;
                    height: 25mm;
                    border: 1px dashed #ccc;
                    padding: 1mm 1.5mm;
                    box-sizing: border-box;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    overflow: hidden;
                }`;
            bodyHTML = Array(count).fill(cellHTML).join('');
        }

        const w = window.open('', '_blank', 'width=850,height=600');
        if (!w) {
            D.toast('⚠️ Print popup block ho gaya! Browser me popup allow karein.');
            return;
        }
        w.document.open();
        w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>TSC Sticker Print</title>
<style>
    * {
        font-family: Arial, Helvetica, sans-serif;
        color: #000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    ${pageCSS}
    .sp {
        font-size: 8.2pt;
        font-weight: 800;
        line-height: 1.1;
        white-space: nowrap;
        max-width: 47mm;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: -0.2px;
    }
    .nm {
        font-size: 11.5pt;
        font-weight: 900;
        line-height: 1.1;
        margin: 0.6mm 0;
        max-width: 47mm;
        white-space: nowrap;
        overflow: hidden;
    }
    .bc {
        width: 39mm;
        height: 7mm;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .bc svg {
        width: 100%;
        height: 100%;
        shape-rendering: crispEdges;
    }
    .cd {
        font-size: 8.8pt;
        font-weight: 800;
        line-height: 1.1;
        margin-top: 0.5mm;
        letter-spacing: 0.3px;
    }
    /* Photo-style 2-line layout (jab Bina Barcode tick ho) */
    .lbl-2line { justify-content: center; gap: 2.2mm; }
    .sp-2line { font-size: 8.8pt; font-weight: 800; letter-spacing: -0.25px; max-width: 47.5mm; }
    .cd-2line { font-size: 11.5pt; font-weight: 900; letter-spacing: 0.7px; margin-top: 0; }
</style>
</head>
<body>${bodyHTML}</body>
</html>`);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
    }

    D.printStickers = () => {
        const count = Math.max(1, parseInt(document.getElementById('bc-pqty')?.value || 1, 10));
        const mode = document.getElementById('bc-psize')?.value || 'tsc2up';
        const textOnly = !!document.getElementById('bc-textonly')?.checked;
        const sp = (document.getElementById('bc-spec')?.value || '3.60 CM EMB. JHALAR').toUpperCase();
        const nm = (document.getElementById('bc-des')?.value || 'RASHMIKA').toUpperCase();
        const cd = (document.getElementById('bc-code')?.value || `${nm}-KT`).toUpperCase();
        printStickerJob(sp, nm, cd, count, mode, textOnly);
    };

    D.bcQuickPrint = (id) => {
        const d = D.get('dukan_designs').find((x) => x && x.id === id);
        if (!d) return;
        const bachi = D.getDesignFinishedStock(d);
        const qtyStr = prompt(`[${d.design}] ke kitne TSC 2-Up stickers print karne hain?`, String(bachi > 0 ? bachi : 10));
        if (!qtyStr) return;
        const count = Math.max(1, parseInt(qtyStr, 10) || 1);
        const textOnly = !!document.getElementById('bc-textonly')?.checked;
        printStickerJob(d.specs || '3.60 CM EMB. JHALAR', d.design, d.code || `${d.design}-KT`, count, 'tsc2up', textOnly);
    };
})();
