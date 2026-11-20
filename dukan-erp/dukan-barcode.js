/* ============================================================================
   NAMING & BARCODING: Baithak Kariger -> Design Name + Exact Sticker Print
   File: dukan-erp/dukan-barcode.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let editId = '';
    let page = 1;

    D.openBarcode = () => {
        D.screen = 'barcode';
        D.onEsc = null;
        editId = ''; page = 1;
        render();
    };

    window.dkBcPage = (p) => { page = p; render(); };

    function render() {
        const designs = D.get('dukan_designs');
        const cur = editId ? designs.find((x) => x.id === editId) : null;
        const pg = D.paginate(designs, page);

        const left = `
            <div class="dk-row"><label>Kariger (Baithak) :</label><input id="bc-kar" value="${D.esc(cur?.kariger || '')}" placeholder="Jaise: FARHAN"></div>
            <div class="dk-row"><label>Design Name :</label><input id="bc-des" value="${D.esc(cur?.design || '')}" placeholder="Jaise: RASHMIKA" oninput="DukanERP.updSticker()"></div>
            <div class="dk-row"><label>Top Specs Line :</label><input id="bc-spec" value="${D.esc(cur?.specs || '3.60 CM EMB JHALAR')}" oninput="DukanERP.updSticker()"></div>
            <div class="dk-row"><label>Barcode Code :</label><input id="bc-code" value="${D.esc(cur?.code || '')}" placeholder="Jaise: RASHMIKA KT" oninput="DukanERP.updSticker()"></div>
            <div class="dk-row"><label>Fresh Qty (Pcs) :</label><input type="number" id="bc-qty" value="${D.num(cur?.freshQty || 20)}"></div>
            <div class="dk-row"><label>Print Stickers :</label><input type="number" id="bc-pqty" value="10"></div>

            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; background:#fdf6e2; border:1px solid #e5d5a7; padding:10px; border-radius:8px; margin:10px 0;">
                <div class="dk-sticker" id="dk-sticker-prev"></div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button type="button" class="dk-btn-gold" onclick="DukanERP.saveDesign()">💾 Save Naming</button>
                    <button type="button" class="dk-btn" onclick="DukanERP.printStickers()">🖨️ Print Stickers</button>
                </div>
            </div>

            <table class="dk-tbl">
                <thead><tr><th>Kariger</th><th>Design Name</th><th>Specs</th><th>Code</th><th>Fresh Stock</th></tr></thead>
                <tbody>${pg.rows.map((d) => `
                    <tr class="click-row ${d.id === editId ? 'active' : ''}" onclick="DukanERP.loadDesign('${d.id}')">
                        <td>${D.esc(d.kariger)}</td><td><strong>${D.esc(d.design)}</strong></td>
                        <td>${D.esc(d.specs)}</td><td>${D.esc(d.code)}</td><td><strong>${D.num(d.freshQty)} Pc</strong></td>
                    </tr>`).join('')}</tbody>
            </table>
            ${D.pagerHTML(pg, 'dkBcPage')}
        `;

        D.renderShell(`<h2>Naming &amp; Barcoding</h2>`, left, 'Baithak saree ko Design Name aur Barcode dein');
        D.updSticker();

        D.setSide('List of Designs', `${designs.length} Items`, designs.slice(0, 60).map((d) => ({
            id: d.id, label: d.design, meta: `${d.kariger} · ${D.num(d.freshQty)} Pc`, active: d.id === editId
        })), (it) => D.loadDesign(it.id), 'bc-des');
    }

    D.loadDesign = (id) => { editId = id; render(); };

    D.updSticker = () => {
        const sp = document.getElementById('bc-spec')?.value || '3.60 CM EMB JHALAR';
        const nm = document.getElementById('bc-des')?.value || 'RASHMIKA';
        const cd = document.getElementById('bc-code')?.value || (nm ? nm + ' KT' : 'RASHMIKA KT');
        const box = document.getElementById('dk-sticker-prev');
        if (!box) return;
        box.innerHTML = `
            <div style="font-size:11px; font-weight:800;">${D.esc(sp.toUpperCase())}</div>
            <div style="font-size:18px; font-weight:800; margin:2px 0;">${D.esc(nm.toUpperCase())}</div>
            ${D.barcodeSVG(cd, 34)}
            <div style="font-size:12px; font-weight:800;">${D.esc(cd.toUpperCase())}</div>
        `;
    };

    D.saveDesign = () => {
        const kariger = (document.getElementById('bc-kar')?.value || '').trim().toUpperCase();
        const design = (document.getElementById('bc-des')?.value || '').trim().toUpperCase();
        if (!design) return alert('Design Name bharein!');
        const specs = (document.getElementById('bc-spec')?.value || '').trim().toUpperCase();
        const code = (document.getElementById('bc-code')?.value || `${design} KT`).trim().toUpperCase();
        const freshQty = D.num(document.getElementById('bc-qty')?.value);

        const list = D.get('dukan_designs');
        const obj = { id: editId || `des_${Date.now()}`, kariger, design, specs, code, freshQty };
        if (editId) {
            const idx = list.findIndex((x) => x.id === editId);
            if (idx >= 0) list[idx] = obj;
        } else list.push(obj);
        D.set('dukan_designs', list);
        editId = '';
        render();
    };

    D.printStickers = () => {
        const count = Math.max(1, parseInt(document.getElementById('bc-pqty')?.value || 1, 10));
        const html = document.getElementById('dk-sticker-prev')?.innerHTML || '';
        const w = window.open('', '_blank', 'width=800,height=600');
        w.document.write(`<html><head><style>body{font-family:Inter,sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:10px}.st{width:50mm;border:1px dashed #ccc;padding:6px;text-align:center;page-break-inside:avoid}</style></head><body>${Array(count).fill(`<div class="st">${html}</div>`).join('')}</body></html>`);
        w.document.close(); w.print();
    };
})();
