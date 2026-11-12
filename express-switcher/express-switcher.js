/* ============================================================================
   SIMPLICITY ERP - ⚡ GLOBAL EXPRESS MODE SWITCHER
   Folder: express-switcher / File: express-switcher.js
   Developed for: Farhan Jawed
   Shortcuts:
   - [Alt + K] -> Kariger Express
   - [Alt + S] -> Stock Express
   - [Alt + J] -> JobWork Express
   - [Alt + T] -> Tani Express
============================================================================ */

(() => {
    'use strict';

    const getCurrentOpenExpress = () => {
        if (document.getElementById('kariger-express-modal')) return 'kariger';
        if (document.getElementById('master-stock-express-modal')) return 'stock';
        if (document.getElementById('master-jobwork-express-modal')) return 'jobwork';
        if (document.getElementById('master-tani-express-modal')) return 'tani';
        return null;
    };

    const closeAllExpressModals = () => {
        if (typeof window.closeAltCKarigerModal === 'function') window.closeAltCKarigerModal();
        if (typeof window.closeExpressNewTaniModal === 'function') window.closeExpressNewTaniModal();
        if (typeof window.closeKarigerExpressModal === 'function') window.closeKarigerExpressModal();
        if (typeof window.closeStockExpressModal === 'function') window.closeStockExpressModal();
        if (typeof window.closeJobWorkExpressModal === 'function') window.closeJobWorkExpressModal();
        if (typeof window.closeTaniExpressModal === 'function') window.closeTaniExpressModal();
    };

    const switchExpressMode = (target) => {
        const current = getCurrentOpenExpress();
        if (current === target) return; // Wahi mode pehle se khula ho to data na ude

        closeAllExpressModals();

        if (target === 'kariger' && typeof window.openKarigerExpressModal === 'function') {
            window.openKarigerExpressModal();
        } else if (target === 'stock' && typeof window.openStockExpressModal === 'function') {
            window.openStockExpressModal();
        } else if (target === 'jobwork' && typeof window.openJobWorkExpressModal === 'function') {
            window.openJobWorkExpressModal();
        } else if (target === 'tani' && typeof window.openTaniExpressModal === 'function') {
            window.openTaniExpressModal();
        }
    };

    const handleExpressSwitchKeydown = (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;

        // Sirf login hone ke baad hi kaam kare
        const desktop = document.getElementById('desktop-screen');
        if (!desktop || desktop.style.display === 'none') return;

        const key = String(e.key || '').toLowerCase();
        const code = String(e.code || '');

        let target = null;
        if (code === 'KeyK' || key === 'k') target = 'kariger';
        else if (code === 'KeyS' || key === 's') target = 'stock';
        else if (code === 'KeyJ' || key === 'j') target = 'jobwork';
        else if (code === 'KeyT' || key === 't') target = 'tani';

        if (!target) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        switchExpressMode(target);
    };

    if (!window.__expressSwitcherBound) {
        window.addEventListener('keydown', handleExpressSwitchKeydown, true);
        window.__expressSwitcherBound = true;
    }

    window.ExpressSwitcher = {
        switchExpressMode,
        closeAllExpressModals
    };
})();
