/* ============================================================================
   DUKAN MASTER BRIDGE -> REDIRECTS TO CENTRAL TALLY MASTER HUB
   File: dukan-erp/dukan-master.js
============================================================================ */
(() => {
    const D = window.DukanERP;
    if (!D) return;

    D.openCreate = (initMode = 'create', initType = 'Party') => {
        const backToDukan = () => {
            if (typeof window.openDukanGateway === 'function') {
                window.openDukanGateway();
            }
        };
        const filterOrGroup = String(initType || '').toLowerCase() === 'firm'
            ? 'dukan_firm'
            : 'dukan_party';

        if (initMode === 'alter' && typeof window.openTallyAlterModule === 'function') {
            window.openTallyAlterModule(filterOrGroup, backToDukan);
        } else if (typeof window.openTallyCreateModule === 'function') {
            window.openTallyCreateModule(filterOrGroup, backToDukan);
        }
    };
})();
