/* ============================================================================
   NAMING & BARCODING: Finished Stock Link + Edit/Delete + TSC 2-Up Sticker Print
   File: dukan-erp/dukan-barcode.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let editId = '';
    let linkedSareeName = '';
    let linkedKarkhanaId = 'k_main';
    let page = 1;

    D.openBarcode = () => {
        D.screen = 'barcode';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        editId = ''; linkedSareeName = ''; linkedKarkhanaId = 'k_main'; page = 1;
        render('bc-kar');
    };

    window.dkBcPage = (p) => { page = p; render('bc-kar'); };

    function render(focusId = 'bc-kar') {
        const designs = D.get('dukan_designs');
        const finRows = D.getFinishedStockRows();
        const karigers = D.getKarigers();
        const cur = editId ? designs.find((x) => x.id === editId) : null;
        const pg = D.paginate(designs, page);

        const curKar = cur?.kariger || '';
        const curSaree = cur?.sareeName || linkedSareeName || '';
        const liveFin = cur ? D.getDesignFinishedStock(cur) : 0;

        const left = `
            <div class="dk-row"><label>Finished Kariger :</label><input id="bc-kar" value="${D.esc(curKar)}" placeholder="Finished Stock / Kariger chunein..." autocomplete="off"></div>
            <div class="dk-row"><label>Saree (Finished) :</label><input id="bc-saree" value="${D.esc(curSaree)}" placeholder="Finished stage ka saree naam" autocomplete="off"></div>
            <div class="dk-row"><label>Design Name :</label><input id="bc-des" value="${D.esc(cur?.design || '')}" placeholder="Jaise: RASHMIKA" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Top Specs Line :</label><input id="bc-spec" value="${D.esc(cur?.specs || '3.60 CM EMB. JHALAR')}" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Barcode Code :</label><input id="bc-code" value="${D.esc(cur?.code || '')}" placeholder="Jaise: RASHMIKA-KT" oninput="DukanERP.updSticker()" autocomplete="off"></div>
            <div class="dk-row"><label>Finished Stock (Live) :</label><input id="bc-fin" value="${liveFin} Pcs (Saree Finished Tab)" readonly style="background:#f9fafb;color:#15803d;"></div>
            <div class="dk-row"><label>Print Stickers (Qty) :</label><input type="number" id="bc-pqty" value="${liveFin > 0 ? liveFin : 10}"></div>

            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; background:#fdf6e2; border:1px solid #e5d5a7; padding:10px; border-radius:8px; margin:8px 0;">
                <div class="dk-sticker" id="dk-sticker-prev"></div>
                <div style="display:flex; flex-direction:column; gap:7px;">
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.askBarcodeSave()">💾 ${cur ? 'Update' : 'Save'} Naming [Ctrl+Enter]</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printStickers()">🏷️ Print TSC 2-Up Stickers</button>
                    ${cur ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteDesign('${cur.id}')">🗑️ Delete Design</button>` : ''}
                </div>
            </div>

            <div class="dk-accept" id="dk-accept-box">
                <strong>${cur ? 'Update' : 'Save'} Design &amp; Barcode Link?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveDesign()">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('bc-spec');">No (N)</button>
                </div>
            </div>

            <table class="dk-tbl">
                <thead><tr><th>Kariger</th><th>Finished Saree</th><th>Design Name</th><th>Specs / Code</th><th>Finished Bachi</th></tr></thead>
                <tbody>${pg.rows.length ? pg.rows.map((d) => {
                    const bachi = D.getDesignFinishedStock(d);
                    return `
                    <tr class="dk-nav-row ${d.id === editId ? 'active' : ''}" onclick="DukanERP.loadDesign('${d.id}')">
                        <td>${D.esc(d.kariger)}</td>
                        <td>${D.esc(d.sareeName || '-')}</td>
                        <td><strong>${D.esc(d.design)}</strong></td>
                        <td><small>${D.esc(d.specs)}<br><b>${D.esc(d.code)}</b></small></td>
                        <td><strong style="color:#15803d;">${bachi} Pc</strong></td>
                    </tr>`;
                }).join('') : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Abhi koi design naming nahi hui</td></tr>`}
                </tbody>
            </table>
            ${D.pagerHTML(pg, 'dkBcPage')}
        `;

        D.renderShell(`<h2>Naming &amp; Barcoding (TSC 2-Up Roll)</h2>`, left, 'Click karke kisi bhi Design ko Edit/Delete/Print karein');
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
                            .filter((r) => !ql || `${r.karigerName} ${r.sareeName}`.toLowerCase().includes(ql))
                            .forEach((r) => {
                                const ex = designs.find((d) =>
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
                            .filter((k) => !ql || `${k.name} ${k.saree}`.toLowerCase().includes(ql))
                            .slice(0, 40)
                            .forEach((k) => {
                                const nm = String(k.name).toUpperCase();
                                const ex = designs.find((d) => String(d.kariger || '').toUpperCase() === nm);
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
                        .filter((d) => !q || `${d.design} ${d.kariger}`.toLowerCase().includes(q.toLowerCase()))
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

    D.loadDesign = (id) => { editId = id; render('bc-spec'); };

    D.updSticker = () => {
        const sp = (document.getElementById('bc-spec')?.value || '3.60 CM EMB. JHALAR').toUpperCase();
        const nm = (document.getElementById('bc-des')?.value || 'RASHMIKA').toUpperCase();
        const cd = (document.getElementById('bc-code')?.value || (nm ? `${nm}-KT` : 'RASHMIKA-KT')).toUpperCase();
        const box = document.getElementById('dk-sticker-prev');
        if (!box) return;
        box.innerHTML = `
            <div style="font-size:10.5px; font-weight:800; line-height:1.15;">${D.esc(sp)}</div>
            <div style="font-size:16px; font-weight:800; line-height:1.1; margin:1px 0 3px;">${D.esc(nm)}</div>
            <div style="width:86%; margin:0 auto;">${D.barcodeSVG(cd, 28)}</div>
            <div style="font-size:11.5px; font-weight:800; line-height:1.15; margin-top:2px;">${D.esc(cd)}</div>
        `;
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
        const existing = editId ? list.find((x) => x.id === editId) : list.find((x) => x.design === design);
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
        editId = ''; linkedSareeName = '';
        render('bc-kar');
    };

    D.deleteDesign = (id) => {
        if (!confirm('Kya aap is Design / Barcode ko delete karna chahte hain?')) return;
        D.set('dukan_designs', D.get('dukan_designs').filter((x) => x.id !== id));
        D.toast('🗑️ Design delete ho gaya!');
        editId = '';
        render('bc-kar');
    };

    // Exact TSC 2-Up (50mm x 25mm x 2) Thermal Barcode Roll Print
    D.printStickers = () => {
        const count = Math.max(1, parseInt(document.getElementById('bc-pqty')?.value || 1, 10));
        const sp = (document.getElementById('bc-spec')?.value || '3.60 CM EMB. JHALAR').toUpperCase();
        const nm = (document.getElementById('bc-des')?.value || 'RASHMIKA').toUpperCase();
        const cd = (document.getElementById('bc-code')?.value || (nm ? `${nm}-KT` : 'RASHMIKA-KT')).toUpperCase();
        const cellHTML = `
            <div class="lbl">
                <div class="t1">${D.esc(sp)}</div>
                <div class="t2">${D.esc(nm)}</div>
                <div class="bc">${D.barcodeSVG(cd, 26)}</div>
                <div class="t3">${D.esc(cd)}</div>
            </div>
        `;
        let rowsHTML = '';
        for (let i = 0; i < count; i += 2) {
            rowsHTML += `<div class="row">${cellHTML}${i + 1 < count ? cellHTML : '<div class="lbl"></div>'}</div>`;
        }
        const w = window.open('', '_blank', 'width=500,height=400');
        w.document.write(`<html><head><style>
            @page { size: 102mm 25mm; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
            .row { width: 102mm; height: 25mm; display: flex; justify-content: space-between; align-items: center; page-break-after: always; padding: 0 1mm; }
            .row:last-child { page-break-after: auto; }
            .lbl { width: 49mm; height: 23mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
            .t1 { font-size: 7.5pt; font-weight: 700; line-height: 1.1; white-space: nowrap; }
            .t2 { font-size: 11.5pt; font-weight: 800; line-height: 1.1; margin: 0.5mm 0 1mm; white-space: nowrap; }
            .bc { width: 38mm; height: 7.5mm; display: flex; align-items: center; }
            .bc svg { width: 100%; height: 100%; }
            .t3 { font-size: 8.5pt; font-weight: 700; line-height: 1.1; margin-top: 0.5mm; white-space: nowrap; }
        </style></head><body>${rowsHTML}</body></html>`);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 200);
    };
})();
