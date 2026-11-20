/* ============================================================================
   DUKAN MASTER: CREATE & ALTER (FIRM / PARTY) — Profile me Agent Field
   File: dukan-erp/dukan-master.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let mode = 'create'; // 'create' | 'alter'
    let type = 'Party';  // 'Firm' | 'Party'
    let editId = '';

    D.openCreate = (initMode = 'create', initType = 'Party') => {
        D.screen = 'create';
        D.onEsc = null;
        mode = initMode; type = initType; editId = '';
        render();
    };

    function render() {
        const firms = D.get('dukan_firms');
        const parties = D.get('dukan_parties');
        const curList = type === 'Firm' ? firms : parties;
        const rec = editId ? curList.find((x) => x.id === editId) : null;

        const headL = `
            <h2>Dukan Master (Tally Style)</h2>
            <button type="button" class="dk-tab ${mode==='create'?'active':''}" onclick="DukanERP.setMasterMode('create')">+ Create</button>
            <button type="button" class="dk-tab ${mode==='alter'?'active':''}" onclick="DukanERP.setMasterMode('alter')">Alter (Firm / Party)</button>
        `;

        const left = `
            <div class="dk-row"><label>Type (Under) :</label><input id="dm-type" value="${type}" readonly></div>
            <div class="dk-row"><label>${type} Name :</label><input id="dm-name" value="${D.esc(rec?.name||'')}" placeholder="Jaise: ${type==='Firm'?'INDIAN FABRICS':'SHARMA SILK HOUSE'}"></div>
            <div class="dk-sec">${type} Profile Details</div>
            <div class="dk-row"><label>Mobile No. :</label><input id="dm-mob" value="${D.esc(rec?.mob||'')}" placeholder="10-digit Mobile"></div>
            <div class="dk-row"><label>GSTIN / TIN :</label><input id="dm-gst" value="${D.esc(rec?.gst||'')}" placeholder="GST No."></div>
            <div class="dk-row"><label>Address :</label><input id="dm-addr" value="${D.esc(rec?.address||'')}" placeholder="Market / Address"></div>
            <div class="dk-row"><label>City (To) :</label><input id="dm-city" value="${D.esc(rec?.city||'')}" placeholder="Jaise: HYDERABAD"></div>
            <div class="dk-row"><label>Agent Name :</label><input id="dm-agent" value="${D.esc(rec?.agent||'')}" placeholder="Agent ka Naam"></div>
            ${type === 'Party' ? `
                <div class="dk-row"><label>Default Marka :</label><input id="dm-marka" value="${D.esc(rec?.marka||'')}" placeholder="SSH / HYD"></div>
                <div class="dk-row"><label>Transport :</label><input id="dm-tr" value="${D.esc(rec?.transport||'')}" placeholder="Transport Name"></div>
            ` : `
                <div class="dk-row"><label>Email ID :</label><input id="dm-email" value="${D.esc(rec?.email||'')}" placeholder="firm@gmail.com"></div>
            `}
            <div style="text-align:right; margin-top:12px;">
                <button type="button" class="dk-btn-gold" onclick="DukanERP.saveMaster()">${rec ? 'Update' : 'Save'} [Ctrl+Enter]</button>
            </div>
        `;

        D.renderShell(headL, left, `${type}s: ${curList.length} · Profile me Agent field active`);

        if (mode === 'create') {
            D.setSide('List of Masters', 'Create Mode', [
                { label: 'Party (Buyer / Vyapari)', meta: `${parties.length} Saved`, active: type === 'Party', t: 'Party' },
                { label: 'Firm (Apni Dukan)', meta: `${firms.length} Saved`, active: type === 'Firm', t: 'Firm' },
                { label: 'Alter Existing (Edit)', meta: 'Switch', active: false, m: 'alter' }
            ], (it) => {
                if (it.m) mode = 'alter';
                if (it.t) type = it.t;
                editId = '';
                render();
            }, 'dm-type');
        } else {
            const sideArr = [
                { label: '📁 Switch: Party List', meta: `${parties.length}`, active: false, sw: 'Party' },
                { label: '📁 Switch: Firm List', meta: `${firms.length}`, active: false, sw: 'Firm' },
                ...curList.slice(0, 60).map((x) => ({
                    label: x.name, meta: x.city || x.mob || type, active: x.id === editId, id: x.id
                }))
            ];
            D.setSide(`Alter — ${type} List`, `${curList.length} Total`, sideArr, (it) => {
                if (it.sw) { type = it.sw; editId = ''; }
                else if (it.id) { editId = it.id; }
                render();
            });
        }
        setTimeout(() => document.getElementById('dm-name')?.focus(), 30);
    }

    D.setMasterMode = (m) => { mode = m; editId = ''; render(); };

    D.saveMaster = () => {
        const name = (document.getElementById('dm-name')?.value || '').trim().toUpperCase();
        if (!name) return alert(`${type} Name bharein!`);
        const key = type === 'Firm' ? 'dukan_firms' : 'dukan_parties';
        const list = D.get(key);
        const obj = {
            id: editId || `${type.toLowerCase()}_${Date.now()}`,
            name,
            mob: (document.getElementById('dm-mob')?.value || '').trim(),
            gst: (document.getElementById('dm-gst')?.value || '').trim().toUpperCase(),
            address: (document.getElementById('dm-addr')?.value || '').trim(),
            city: (document.getElementById('dm-city')?.value || '').trim().toUpperCase(),
            agent: (document.getElementById('dm-agent')?.value || '').trim(),
            marka: (document.getElementById('dm-marka')?.value || '').trim().toUpperCase(),
            transport: (document.getElementById('dm-tr')?.value || '').trim(),
            email: (document.getElementById('dm-email')?.value || '').trim()
        };
        if (editId) {
            const idx = list.findIndex((x) => x.id === editId);
            if (idx >= 0) list[idx] = obj;
        } else list.push(obj);
        D.set(key, list);
        editId = '';
        alert(`✅ ${type} [${name}] save ho gaya!`);
        render();
    };
})();
