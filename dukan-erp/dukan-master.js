/* ============================================================================
   DUKAN MASTER: CREATE, ALTER & DELETE (FIRM / PARTY) + DEFAULT FIRM
   File: dukan-erp/dukan-master.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    let mode = 'create';
    let type = 'Party';
    let editId = '';

    function ensureMigratedFirms() {
        const firms = D.get('dukan_firms');
        if (firms.length) return firms;
        try {
            const legacy = (typeof window.getStore === 'function')
                ? window.getStore('jobwork_firm_profile')
                : JSON.parse(localStorage.getItem('jobwork_firm_profile') || 'null');
            if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && legacy.name) {
                const migrated = [{
                    id: 'firm_main',
                    name: String(legacy.name || 'INDIAN FABRICS').trim().toUpperCase(),
                    mob: String(legacy.mobile || legacy.mob || '').trim(),
                    gst: String(legacy.gst || '').trim().toUpperCase(),
                    address: String(legacy.address || '').trim(),
                    city: '',
                    agent: '',
                    email: '',
                    isDefault: true
                }];
                D.set('dukan_firms', migrated);
                return migrated;
            }
        } catch (_) {}
        return firms;
    }

    D.openCreate = (initMode = 'create', initType = 'Party') => {
        D.screen = 'create';
        D.onEsc = null;
        D.onCustomFieldEnter = null;
        ensureMigratedFirms();
        mode = initMode;
        type = initType;
        editId = '';
        render('dm-name');
    };

    function render(focusId = 'dm-name') {
        const firms = ensureMigratedFirms();
        const parties = D.get('dukan_parties');
        const curList = type === 'Firm' ? firms : parties;
        const rec = editId ? curList.find((x) => x.id === editId) : null;
        const defVal = rec ? (rec.isDefault ? 'Yes' : 'No') : (firms.length === 0 ? 'Yes' : 'No');

        const headL = `
            <h2>Dukan Master (Tally Style)</h2>
            <button type="button" class="dk-tab ${mode==='create'?'active':''}" onclick="DukanERP.setMasterMode('create')">+ Create</button>
            <button type="button" class="dk-tab ${mode==='alter'?'active':''}" onclick="DukanERP.setMasterMode('alter')">Alter / Delete (Firm / Party)</button>
        `;

        const left = `
            <div class="dk-row"><label>Type (Under) :</label><input id="dm-type" value="${type}" autocomplete="off"></div>
            ${mode === 'alter' ? `<div class="dk-row"><label>Search ${type} :</label><input id="dm-pick" value="${D.esc(rec?.name || '')}" placeholder="Type karke list se chunein..." autocomplete="off"></div>` : ''}
            <div class="dk-row"><label>${type} Name :</label><input id="dm-name" value="${D.esc(rec?.name || '')}" placeholder="Jaise: ${type==='Firm'?'INDIAN FABRICS':'SHARMA SILK HOUSE'}" autocomplete="off"></div>
            <div class="dk-sec">${type} Profile Details</div>
            <div class="dk-row"><label>Mobile No. :</label><input id="dm-mob" value="${D.esc(rec?.mob || '')}" placeholder="10-digit Mobile"></div>
            <div class="dk-row"><label>GSTIN / TIN :</label><input id="dm-gst" value="${D.esc(rec?.gst || '')}" placeholder="GST No."></div>
            <div class="dk-row"><label>Address :</label><input id="dm-addr" value="${D.esc(rec?.address || '')}" placeholder="Market / Address"></div>
            <div class="dk-row"><label>City (${type === 'Firm' ? 'From' : 'To'}) :</label><input id="dm-city" value="${D.esc(rec?.city || '')}" placeholder="Jaise: ${type === 'Firm' ? 'VARANASI' : 'HYDERABAD'}"></div>
            <div class="dk-row"><label>Agent Name :</label><input id="dm-agent" value="${D.esc(rec?.agent || '')}" placeholder="Agent ka Naam"></div>
            ${type === 'Party' ? `
                <div class="dk-row"><label>Default Marka :</label><input id="dm-marka" value="${D.esc(rec?.marka || '')}" placeholder="SSH / HYD"></div>
                <div class="dk-row"><label>Transport :</label><input id="dm-tr" value="${D.esc(rec?.transport || '')}" placeholder="Transport Name"></div>
            ` : `
                <div class="dk-row"><label>Email ID :</label><input id="dm-email" value="${D.esc(rec?.email || '')}" placeholder="firm@gmail.com"></div>
                <div class="dk-row"><label>Default Firm :</label><input id="dm-default" value="${defVal}" readonly autocomplete="off"></div>
            `}
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                ${rec ? `<button type="button" class="dk-btn-del" onclick="DukanERP.deleteMaster()">🗑️ Delete ${type}</button>` : ''}
                <button type="button" class="dk-btn-gold" onclick="DukanERP.askMasterSave()">${rec ? 'Update' : 'Save'} [Ctrl+Enter]</button>
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
                : ['dm-type', 'dm-pick', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-email', 'dm-default'])
            : (type === 'Party'
                ? ['dm-type', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-marka', 'dm-tr']
                : ['dm-type', 'dm-name', 'dm-mob', 'dm-gst', 'dm-addr', 'dm-city', 'dm-agent', 'dm-email', 'dm-default']);

        const sideBindings = {
            'dm-type': {
                title: 'List of Masters',
                getItems: () => [
                    { label: 'Party (Buyer / Vyapari)', meta: `${parties.length} Saved`, active: type === 'Party', t: 'Party' },
                    { label: 'Firm (Apni Dukan / Billing)', meta: `${firms.length} Saved`, active: type === 'Firm', t: 'Firm' },
                    { label: mode === 'create' ? 'Switch to Alter (Edit/Del)' : 'Switch to Create', meta: 'Mode', active: false, m: mode === 'create' ? 'alter' : 'create' }
                ],
                onPick: (it) => {
                    if (it.m) mode = it.m;
                    if (it.t) type = it.t;
                    editId = '';
                    render(mode === 'alter' ? 'dm-pick' : 'dm-name');
                }
            }
        };

        if (type === 'Firm') {
            sideBindings['dm-default'] = {
                title: 'Default Firm?',
                getItems: () => {
                    const cur = document.getElementById('dm-default')?.value === 'Yes';
                    return [
                        { label: 'Yes (Default Firm)', meta: 'Auto-Fill', active: cur, val: 'Yes' },
                        { label: 'No', meta: 'Manual Pick', active: !cur, val: 'No' }
                    ];
                },
                onPick: (it) => {
                    const el = document.getElementById('dm-default');
                    if (el) el.value = it.val;
                    D.askMasterSave();
                }
            };
        }

        if (mode === 'alter') {
            sideBindings['dm-pick'] = {
                title: `List of ${type}s (Alter)`,
                getItems: (q) => curList
                    .filter((x) => !q || `${x.name} ${x.city} ${x.mob}`.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60)
                    .map((x) => ({
                        id: x.id,
                        label: x.name,
                        meta: `${x.isDefault ? '★ Default · ' : ''}${x.city || x.mob || ''}`,
                        active: x.id === editId
                    })),
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
        let list = D.get(key);
        const isDef = type === 'Firm' && document.getElementById('dm-default')?.value === 'Yes';
        if (isDef) {
            list = list.map((f) => ({ ...f, isDefault: false }));
        }
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
            email: (document.getElementById('dm-email')?.value || '').trim(),
            ...(type === 'Firm' ? { isDefault: isDef } : {})
        };
        if (editId) {
            const idx = list.findIndex((x) => x.id === editId);
            if (idx >= 0) list[idx] = obj;
        } else list.push(obj);

        if (type === 'Firm' && list.length && !list.some((f) => f.isDefault)) {
            list[0].isDefault = true;
        }
        D.set(key, list);
        D.toast(`✅ ${type} [${name}] save ho gaya!`);
        editId = '';
        render(mode === 'alter' ? 'dm-pick' : 'dm-name');
    };

    D.deleteMaster = () => {
        if (!editId) return;
        if (!confirm(`Kya aap is ${type} ko delete karna chahte hain?`)) return;
        const key = type === 'Firm' ? 'dukan_firms' : 'dukan_parties';
        const next = D.get(key).filter((x) => x.id !== editId);
        if (type === 'Firm' && next.length && !next.some((f) => f.isDefault)) {
            next[0].isDefault = true;
        }
        D.set(key, next);
        D.toast(`🗑️ ${type} delete ho gaya!`);
        editId = '';
        render('dm-pick');
    };
})();
