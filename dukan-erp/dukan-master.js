/* ============================================================================
   DUKAN MASTER: CREATE & ALTER (FIRM / PARTY) — Profile me Agent Field
   File: dukan-erp/dukan-master.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let mode = 'create';
    let type = 'Party';
    let editId = '';

    D.openCreate = (initMode = 'create', initType = 'Party') => {
        D.screen = 'create';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        mode = initMode; type = initType; editId = '';
        render('dm-name');
    };

    function render(focusId = 'dm-name') {
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
            <div class="dk-row"><label>Type (Under) :</label><input id="dm-type" value="${type}" autocomplete="off"></div>
            ${mode === 'alter' ? `<div class="dk-row"><label>Search ${type} :</label><input id="dm-pick" value="${D.esc(rec?.name || '')}" placeholder="Type karke list se chunein..." autocomplete="off"></div>` : ''}
            <div class="dk-row"><label>${type} Name :</label><input id="dm-name" value="${D.esc(rec?.name || '')}" placeholder="Jaise: ${type==='Firm'?'INDIAN FABRICS':'SHARMA SILK HOUSE'}" autocomplete="off"></div>
            <div class="dk-sec">${type} Profile Details</div>
            <div class="dk-row"><label>Mobile No. :</label><input id="dm-mob" value="${D.esc(rec?.mob || '')}" placeholder="10-digit Mobile"></div>
            <div class="dk-row"><label>GSTIN / TIN :</label><input id="dm-gst" value="${D.esc(rec?.gst || '')}" placeholder="GST No."></div>
            <div class="dk-row"><label>Address :</label><input id="dm-addr" value="${D.esc(rec?.address || '')}" placeholder="Market / Address"></div>
            <div class="dk-row"><label>City (To) :</label><input id="dm-city" value="${D.esc(rec?.city || '')}" placeholder="Jaise: HYDERABAD"></div>
            <div class="dk-row"><label>Agent Name :</label><input id="dm-agent" value="${D.esc(rec?.agent || '')}" placeholder="Agent ka Naam"></div>
            ${type === 'Party' ? `
                <div class="dk-row"><label>Default Marka :</label><input id="dm-marka" value="${D.esc(rec?.marka || '')}" placeholder="SSH / HYD"></div>
                <div class="dk-row"><label>Transport :</label><input id="dm-tr" value="${D.esc(rec?.transport || '')}" placeholder="Transport Name"></div>
            ` : `
                <div class="dk-row"><label>Email ID :</label><input id="dm-email" value="${D.esc(rec?.email || '')}" placeholder="firm@gmail.com"></div>
            `}
            <div style="text-align:right; margin-top:10px;">
                <button type="button" class="dk-btn-gold" onclick="DukanERP.askMasterSave()">Save [Ctrl+Enter]</button>
            </div>
            <div class="dk-accept" id="dk-accept-box">
                <strong>${rec ? 'Update' : 'Accept & Save'} ${type}?</strong>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="dk-btn-gold" id="dk-accept-yes" onclick="DukanERP.saveMaster()">Yes (Y)</button>
                    <button type="button" class="dk-btn" id="dk-accept-no" onclick="document.getElementById('dk-accept-box').style.display='none'; DukanERP.focusField('dm-name');">No (N)</button>
                </div>
            </div>
        `;

        D.renderShell(headL, left);

        const focusOrder = mode === 'alter'
            ? (type === 'Party'
                ? ['dm-type', 'dm-pick', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-marka', 'dm-tr']
                : ['dm-type', 'dm-pick', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-email'])
            : (type === 'Party'
                ? ['dm-type', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-marka', 'dm-tr']
                : ['dm-type', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-email']);

        const sideBindings = {
            'dm-type': {
                title: 'List of Masters',
                getItems: () => [
                    { label: 'Party (Buyer / Vyapari)', meta: `${parties.length} Saved`, active: type === 'Party', t: 'Party' },
                    { label: 'Firm (Apni Dukan)', meta: `${firms.length} Saved`, active: type === 'Firm', t: 'Firm' },
                    { label: mode === 'create' ? 'Switch to Alter (Edit)' : 'Switch to Create', meta: 'Mode', active: false, m: mode === 'create' ? 'alter' : 'create' }
                ],
                onPick: (it) => {
                    if (it.m) mode = it.m;
                    if (it.t) type = it.t;
                    editId = '';
                    render(mode === 'alter' ? 'dm-pick' : 'dm-name');
                }
            }
        };

        if (mode === 'alter') {
            sideBindings['dm-pick'] = {
                title: `List of ${type}s (Alter)`,
                getItems: (q) => curList
                    .filter((x) => !q || `${x.name} ${x.city} ${x.mob}`.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60)
                    .map((x) => ({ id: x.id, label: x.name, meta: x.city || x.mob || '', active: x.id === editId })),
                onPick: (it) => { editId = it.id; render('dm-name'); }
            };
        }

        D.bindFormControls({
            focusOrder,
            sideBindings,
            defaultSide: () => D.renderSide('Master Info', type, [
                { label: `Active Type: ${type}`, meta: mode.toUpperCase(), active: true },
                { label: `Total Parties: ${parties.length}`, meta: 'Saved' },
                { label: `Total Firms: ${firms.length}`, meta: 'Saved' }
            ], false),
            onFinishForm: () => D.askMasterSave()
        });

        D.focusField(focusId);
    }

    D.setMasterMode = (m) => { mode = m; editId = ''; render(m === 'alter' ? 'dm-pick' : 'dm-name'); };
    D.askMasterSave = () => {
        const nm = (document.getElementById('dm-name')?.value || '').trim();
        if (!nm) { D.toast('⚠️ Pehle Name bharein!'); return D.focusField('dm-name'); }
        D.askAccept(() => D.saveMaster());
    };

    D.saveMaster = () => {
        const name = (document.getElementById('dm-name')?.value || '').trim().toUpperCase();
        if (!name) return D.focusField('dm-name');
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
        D.toast(`✅ ${type} [${name}] save ho gaya!`);
        editId = '';
        render(mode === 'alter' ? 'dm-pick' : 'dm-name');
    };
})();
