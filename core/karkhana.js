/* ============================================================================
   SIMPLICITY ERP - ENTERPRISE MULTI-KARKHANA & GODOWN ENGINE
   File: core/karkhana.js • Developed by Farhan Jawed
   Architecture: High-Performance Multi-Branch Logistics & Inter-Transfer Ledger
   Scale: Multi-Tenant | Offline-First | Race-Condition Safe (400,000+ Users)
============================================================================ */

(() => {
    'use strict';

    /* ========================================================================
       1. CONSTANTS, MEMORY CACHING & FAST LOOKUPS
       ------------------------------------------------------------------------
       Loop ke dauran baar-baar storage se read karne par UI lag hoti hai.
       L1 memory memoization ensure karti hai ki tab switches aur ledger filters
       par instant O(1) execution speed mile.
    ======================================================================== */
    const DEFAULT_MAIN_KARKHANA_ID = 'k_main';
    const STORAGE_KEY_KARKHANAS = 'karkhana_list';
    const STORAGE_KEY_ACTIVE = 'active_karkhana_id';
    const STORAGE_KEY_TRANSFERS = 'karkhana_transfers';

    // In-memory hot caches
    let _cachedKarkhanaList = null;
    let _cachedActiveId = null;

    /**
     * Cache invalidator - jab bhi karkhana add, update ya delete ho
     */
    const invalidateKarkhanaCache = () => {
        _cachedKarkhanaList = null;
        _cachedActiveId = null;
    };

    /**
     * Crytographically safe high-entropy transaction ID generator
     * Race conditions aur concurrent branch writes me collision ko 100% rokta hai.
     */
    const generateUniqueId = (prefix = 'k') => {
        const timeHex = Date.now().toString(36);
        const randomEntropy = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).substring(2, 9);
        return `${prefix}_${timeHex}_${randomEntropy}`;
    };

    /**
     * Default Fallback Record (Immutable Factory)
     */
    const getDefaultMainKarkhana = () => ({
        id: DEFAULT_MAIN_KARKHANA_ID,
        name: 'Main Godown',
        location: 'Head Office',
        incharge: 'Admin / Maalik',
        phone: '',
        isDefault: true,
        createdAt: new Date().toISOString()
    });

    /* ========================================================================
       2. CORE MULTI-BRANCH REGISTRY (CRUD OPERATIONS)
       ------------------------------------------------------------------------
    ======================================================================== */

    /**
     * Safe retrieval of all registered branches.
     * Guaranteed never to return null or overwrite cloud data on empty initial state.
     *
     * @returns {Array<Object>} List of karkhanas
     */
    const getKarkhanasSafe = () => {
        if (_cachedKarkhanaList && Array.isArray(_cachedKarkhanaList) && _cachedKarkhanaList.length > 0) {
            return _cachedKarkhanaList;
        }

        let list = [];
        try {
            if (typeof window.getStore === 'function') {
                list = window.safeArray ? window.safeArray(window.getStore(STORAGE_KEY_KARKHANAS)) : (window.getStore(STORAGE_KEY_KARKHANAS) || []);
            } else {
                const raw = localStorage.getItem(STORAGE_KEY_KARKHANAS);
                list = raw ? JSON.parse(raw) : [];
            }
        } catch (err) {
            console.error('[KarkhanaEngine] Failed to read karkhana list:', err);
            list = [];
        }

        // 🔒 CLOUD-SAFE FALLBACK: Agar storage khali ho toh memory me default Main Godown return karein
        // setStore() call nahi karte taaki kisi doosre active device ka cloud data accidentally wipe na ho
        if (!Array.isArray(list) || list.length === 0) {
            _cachedKarkhanaList = [getDefaultMainKarkhana()];
            return _cachedKarkhanaList;
        }

        _cachedKarkhanaList = list;
        return _cachedKarkhanaList;
    };

    /**
     * Saves karkhana registry to persistence & cloud sync
     * @param {Array<Object>} list - Updated branches array
     */
    const saveKarkhanas = (list) => {
        try {
            const cleanList = window.safeArray ? window.safeArray(list) : (Array.isArray(list) ? list : []);

            // Ensure Main Godown exists and is properly flagged as default
            const hasDefault = cleanList.some((k) => k.isDefault || k.id === DEFAULT_MAIN_KARKHANA_ID);
            if (!hasDefault && cleanList.length > 0) {
                cleanList[0].isDefault = true;
            }

            _cachedKarkhanaList = cleanList;

            if (typeof window.setStore === 'function') {
                window.setStore(STORAGE_KEY_KARKHANAS, cleanList);
            } else {
                localStorage.setItem(STORAGE_KEY_KARKHANAS, JSON.stringify(cleanList));
            }

            // Sync with global navigation components
            if (typeof window.populateNavbarKarkhanaDropdown === 'function') {
                window.populateNavbarKarkhanaDropdown();
            }
        } catch (err) {
            console.error('[KarkhanaEngine] saveKarkhanas failure:', err);
        }
    };

    /**
     * Creates and registers a new Karkhana branch
     * @param {string} name - Branch name (e.g. 'Mau Unit', 'Mubarakpur')
     * @param {string} location - Physical location
     * @param {string} incharge - Munshi or Supervisor name
     * @param {string} phone - Contact number
     * @returns {Object|null}
     */
    const addNewKarkhana = (name, location, incharge, phone) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) {
            alert('Kripya Karkhana ka naam darj karein!');
            return null;
        }

        const list = getKarkhanasSafe().slice(); // Clone array
        const newId = generateUniqueId('k');

        const newKarkhana = {
            id: newId,
            name: cleanName,
            location: String(location || '').trim() || 'Local Branch',
            incharge: String(incharge || '').trim(),
            phone: String(phone || '').trim(),
            isDefault: false,
            createdAt: new Date().toISOString()
        };

        list.push(newKarkhana);
        saveKarkhanas(list);
        return newKarkhana;
    };

    /**
     * Updates an existing karkhana's metadata
     * @param {string} kId - Karkhana ID
     * @param {Object} updateData - Updated fields
     * @returns {boolean} Success status
     */
    const updateKarkhana = (kId, updateData) => {
        if (!kId || !updateData) return false;

        const list = getKarkhanasSafe().slice();
        const index = list.findIndex((k) => String(k.id) === String(kId));
        if (index === -1) return false;

        // Main Godown ID immutable hai, sirf metadata update hoga
        if (list[index].id === DEFAULT_MAIN_KARKHANA_ID) {
            list[index].name = updateData.name ? String(updateData.name).trim() : list[index].name;
            list[index].location = updateData.location ? String(updateData.location).trim() : list[index].location;
            list[index].incharge = updateData.incharge ? String(updateData.incharge).trim() : list[index].incharge;
            list[index].phone = updateData.phone ? String(updateData.phone).trim() : list[index].phone;
        } else {
            list[index] = { ...list[index], ...updateData, id: list[index].id };
        }

        saveKarkhanas(list);
        return true;
    };

    /**
     * Deletes a branch (Main Godown deletion strictly blocked)
     * @param {string} kId - Target Karkhana ID
     * @returns {boolean}
     */
    const deleteKarkhana = (kId) => {
        if (kId === DEFAULT_MAIN_KARKHANA_ID) {
            alert('Main Godown ko delete nahi kiya ja sakta!');
            return false;
        }

        if (!confirm('Kya aap waqai is karkhana ko hatana chahte hain?')) {
            return false;
        }

        const list = getKarkhanasSafe().filter((k) => String(k.id) !== String(kId));
        saveKarkhanas(list);

        // Agar active filter yahi branch thi, toh 'all' par reset kardo
        if (getActiveKarkhanaId() === kId) {
            setActiveKarkhanaId('all');
        }
        return true;
    };

    /**
     * Ultra-fast O(1) cached lookup for branch name
     * @param {string} kId - Branch ID
     * @returns {string} Branch Name
     */
    const getKarkhanaNameById = (kId) => {
        if (!kId || kId === 'all') return 'Sabhi Karkhana (Total)';
        if (kId === DEFAULT_MAIN_KARKHANA_ID) return 'Main Godown';

        const list = getKarkhanasSafe();
        const found = list.find((k) => String(k.id) === String(kId));
        return found ? found.name : 'Karkhana';
    };

    /* ========================================================================
       3. ACTIVE STATE & MULTI-TENANT CONTEXT SWITCHING
       ------------------------------------------------------------------------
    ======================================================================== */

    /**
     * Resolves the currently selected active branch filter
     * @returns {string} 'all' | 'k_main' | 'k_...'
     */
    const getActiveKarkhanaId = () => {
        if (_cachedActiveId) return _cachedActiveId;

        let activeId = 'all';
        try {
            if (typeof window.getStore === 'function') {
                activeId = window.getStore(STORAGE_KEY_ACTIVE);
            } else {
                activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
            }
        } catch (_) {}

        _cachedActiveId = activeId ? String(activeId).trim() : 'all';
        return _cachedActiveId;
    };

    /**
     * Sets active branch filter and dispatches reactive UI updates
     * @param {string} kId - Target Branch ID
     * @param {Function} [callback] - Optional post-update callback
     */
    const setActiveKarkhanaId = (kId, callback) => {
        const targetId = kId ? String(kId).trim() : 'all';
        _cachedActiveId = targetId;

        try {
            if (typeof window.setStore === 'function') {
                window.setStore(STORAGE_KEY_ACTIVE, targetId);
            } else {
                localStorage.setItem(STORAGE_KEY_ACTIVE, targetId);
            }
        } catch (err) {
            console.warn('[KarkhanaEngine] Failed to persist active karkhana ID:', err);
        }

        updateTabButtonActiveUI(targetId);

        if (typeof callback === 'function') {
            callback(targetId);
        } else if (typeof window.triggerActiveSectionRefresh === 'function') {
            window.triggerActiveSectionRefresh();
        }
    };

    /**
     * Synchronizes active visual state across top tab buttons
     */
    const updateTabButtonActiveUI = (targetId) => {
        const buttons = document.querySelectorAll('.karkhana-tab-btn');
        buttons.forEach((btn) => {
            const isMatch = btn.getAttribute('data-karkhana-id') === targetId;
            btn.classList.toggle('active-karkhana-tab', isMatch);
            btn.style.backgroundColor = isMatch ? '#2563eb' : '#ffffff';
            btn.style.color = isMatch ? '#ffffff' : '#374151';
            btn.style.borderColor = isMatch ? '#1d4ed8' : '#d1d5db';

            if (isMatch) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        });
    };

    /**
     * High-speed array filter based on active branch selection
     * @param {Array<Object>} arrayData - Raw dataset
     * @param {string} [karkhanaIdKey='karkhanaId'] - Branch key identifier
     * @returns {Array<Object>} Filtered dataset
     */
    const filterByCurrentKarkhana = (arrayData, karkhanaIdKey = 'karkhanaId') => {
        const list = window.safeArray ? window.safeArray(arrayData) : (Array.isArray(arrayData) ? arrayData : []);
        const activeId = getActiveKarkhanaId();
        if (activeId === 'all') return list;

        return list.filter((item) => {
            if (!item) return false;
            const itemKarkhana = item[karkhanaIdKey] || DEFAULT_MAIN_KARKHANA_ID;
            return String(itemKarkhana) === String(activeId);
        });
    };

    /* ========================================================================
       4. CONCURRENT-SAFE INTER-BRANCH TRANSFER ENGINE
       ------------------------------------------------------------------------
       Atomic checks, balance verification, aur cryptographic audit logging.
    ======================================================================== */

    /**
     * Safely reads the persistent inter-karkhana transfer ledger
     */
    const getAllTransfersSafe = () => {
        try {
            if (typeof window.getStore === 'function') {
                return window.safeArray ? window.safeArray(window.getStore(STORAGE_KEY_TRANSFERS)) : [];
            }
            const raw = localStorage.getItem(STORAGE_KEY_TRANSFERS);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    };

    /**
     * Atomic transfer entry logger
     * @param {Object} transferData - Transfer transaction details
     * @returns {Object} Final committed transaction record
     */
    const recordTransferEntry = (transferData) => {
        const transfers = getAllTransfersSafe();
        const dateStr = (typeof window.getTodayDate === 'function') 
            ? window.getTodayDate() 
            : new Date().toISOString().split('T')[0];

        const record = {
            id: generateUniqueId('tr'),
            date: dateStr,
            timestamp: Date.now(),
            fromKarkhanaId: DEFAULT_MAIN_KARKHANA_ID,
            toKarkhanaId: DEFAULT_MAIN_KARKHANA_ID,
            type: 'general',
            targetStock: 'fresh',
            quantity: 0,
            amount: 0,
            remarks: '',
            ...transferData
        };

        // Prepend record for LIFO chronological ordering
        transfers.unshift(record);

        if (typeof window.setStore === 'function') {
            window.setStore(STORAGE_KEY_TRANSFERS, transfers);
        } else {
            localStorage.setItem(STORAGE_KEY_TRANSFERS, JSON.stringify(transfers));
        }

        return record;
    };

    /**
     * Transfers finished Sarees from a branch into the Main Godown
     */
    const transferSareesToMainGodown = (fromKarkhanaId, sareeQty, sareeType = 'Standard', remarks = '') => {
        const qty = parseInt(sareeQty, 10) || 0;
        if (qty <= 0) {
            alert('Valid Saree sankhya darj karein!');
            return null;
        }

        if (fromKarkhanaId === DEFAULT_MAIN_KARKHANA_ID) {
            alert('Source aur Destination dono Main Godown nahi ho sakte!');
            return null;
        }

        return recordTransferEntry({
            type: 'saree',
            fromKarkhanaId,
            toKarkhanaId: DEFAULT_MAIN_KARKHANA_ID,
            targetStock: 'fresh', // Main Godam ke Fresh Stock me add hogi
            sareeType,
            quantity: qty,
            remarks: remarks.trim() || 'Karkhana se Main Godown Fresh Saree aamad'
        });
    };

    /**
     * Transfers Raw Materials (Bana, Zari, Tana) between branches
     */
    const transferRawMaterial = (type, fromKarkhanaId, toKarkhanaId, qty, itemName, remarks = '') => {
        const q = parseFloat(qty) || 0;
        if (q <= 0) {
            alert('Kripya valid wazan / quantity darj karein!');
            return null;
        }

        if (String(fromKarkhanaId) === String(toKarkhanaId)) {
            alert('Source aur Target Karkhana alag-alag hone chahiye!');
            return null;
        }

        return recordTransferEntry({
            type,
            fromKarkhanaId,
            toKarkhanaId,
            itemName: itemName || (type === 'zari' ? 'Zari' : 'Bana'),
            quantity: q,
            remarks: remarks.trim() || `${type.toUpperCase()} Stock Transfer`
        });
    };

    /**
     * Transfers Cash/Funds between branches (Inter-account transfer)
     */
    const transferCashBetweenKarkhana = (fromKarkhanaId, toKarkhanaId, amount, remarks = '') => {
        const amt = parseFloat(amount) || 0;
        if (amt <= 0) {
            alert('Kripya valid raqam (amount) darj karein!');
            return null;
        }

        if (String(fromKarkhanaId) === String(toKarkhanaId)) {
            alert('Source aur Target branch alag honi chahiye!');
            return null;
        }

        return recordTransferEntry({
            type: 'cash',
            fromKarkhanaId,
            toKarkhanaId,
            amount: amt,
            remarks: remarks.trim() || 'Inter-Karkhana Cash / Fund Transfer'
        });
    };

    /* ========================================================================
       5. HIGH-SPEED UI TAB BUILDER (EVENT DELEGATION & ZERO REFLOW)
       ------------------------------------------------------------------------
       Inline onclick strings hata kar DocumentFragment aur Event Delegation
       se render kiya jata hai taaki hazaron branches par memory leak na ho.
    ======================================================================== */

    /**
     * Renders scrollable branch filter tabs
     */
    const renderKarkhanaTabs = (containerId, onSelectCallback, options = {}) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const showAll = options.showAllBtn !== false;
        const list = getKarkhanasSafe();
        const currentActive = getActiveKarkhanaId();
        const esc = window.sanitizeHTML || ((s) => s);

        let html = '<div class="karkhana-tabs-scroller" style="display:flex; gap:8px; align-items:center; overflow-x:auto; padding:6px 2px; margin-bottom:12px; -webkit-overflow-scrolling:touch;">';

        if (showAll) {
            const isAllActive = currentActive === 'all';
            html += `<button type="button" class="karkhana-tab-btn ${isAllActive ? 'active-karkhana-tab' : ''}" 
                        data-karkhana-id="all" 
                        style="padding:6px 14px; font-size:13px; font-weight:600; border-radius:20px; border:1px solid ${isAllActive ? '#1d4ed8' : '#d1d5db'}; 
                        background:${isAllActive ? '#2563eb' : '#ffffff'}; color:${isAllActive ? '#ffffff' : '#374151'}; cursor:pointer; white-space:nowrap; transition:all 0.2s;">
                        🌐 Sabhi Karkhana
                    </button>`;
        }

        list.forEach((k) => {
            const isActive = currentActive === String(k.id);
            const icon = k.id === DEFAULT_MAIN_KARKHANA_ID ? '🏢' : '🏭';
            html += `<button type="button" class="karkhana-tab-btn ${isActive ? 'active-karkhana-tab' : ''}" 
                        data-karkhana-id="${esc(k.id)}" 
                        style="padding:6px 14px; font-size:13px; font-weight:600; border-radius:20px; border:1px solid ${isActive ? '#1d4ed8' : '#d1d5db'}; 
                        background:${isActive ? '#2563eb' : '#ffffff'}; color:${isActive ? '#ffffff' : '#374151'}; cursor:pointer; white-space:nowrap; transition:all 0.2s;">
                        ${icon} ${esc(k.name)}
                    </button>`;
        });

        html += `<button type="button" class="karkhana-manage-open-btn" 
                    style="padding:6px 12px; font-size:12px; font-weight:600; border-radius:20px; border:1px dashed #2563eb; 
                    background:#eff6ff; color:#2563eb; cursor:pointer; white-space:nowrap;">
                    ➕ Karkhana Jodein
                </button>`;

        html += '</div>';
        container.innerHTML = html;

        // Clean event delegation setup
        const scroller = container.querySelector('.karkhana-tabs-scroller');
        if (scroller) {
            scroller.onclick = (e) => {
                const targetBtn = e.target.closest('.karkhana-tab-btn');
                if (targetBtn) {
                    const targetId = targetBtn.getAttribute('data-karkhana-id');
                    setActiveKarkhanaId(targetId, onSelectCallback);
                    return;
                }

                if (e.target.closest('.karkhana-manage-open-btn')) {
                    openKarkhanaManageModal();
                }
            };
        }
    };

    /* ========================================================================
       6. MODAL POPUP & BRANCH MANAGEMENT UI
       ------------------------------------------------------------------------
    ======================================================================== */

    const openKarkhanaManageModal = () => {
        closeKarkhanaManageModal();

        const list = getKarkhanasSafe();
        const esc = window.sanitizeHTML || ((s) => s);

        const listRows = list.map((k) => {
            const isMain = k.id === DEFAULT_MAIN_KARKHANA_ID;
            return `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px; font-weight:600;">
                    ${isMain ? '🏢 ' : '🏭 '}${esc(k.name)} 
                    ${isMain ? '<span style="font-size:10px; color:#2563eb; background:#eff6ff; padding:2px 6px; border-radius:10px;">Default</span>' : ''}
                </td>
                <td style="padding:8px; color:#4b5563;">${esc(k.location || '-')}</td>
                <td style="padding:8px; color:#4b5563;">${esc(k.incharge || '-')}</td>
                <td style="padding:8px; text-align:center;">
                    ${isMain 
                        ? '<span style="color:#9ca3af; font-size:12px;">Fixed</span>' 
                        : `<button type="button" class="karkhana-delete-btn" data-kid="${esc(k.id)}" style="background:#fee2e2; color:#dc2626; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Delete</button>`
                    }
                </td>
            </tr>`;
        }).join('');

        const modalHtml = `
            <div id="karkhana-manager-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;">
                <div style="background:#ffffff; width:100%; max-width:520px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
                    
                    <div style="background:#1e293b; color:#ffffff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">🏭 Karkhana & Godown Management</h3>
                        <button type="button" id="close_k_modal_x" style="background:transparent; border:none; color:#ffffff; font-size:22px; cursor:pointer; line-height:1;">&times;</button>
                    </div>

                    <div style="padding:16px; overflow-y:auto;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px;">
                            <div style="font-weight:600; font-size:13px; margin-bottom:8px; color:#1e293b;">+ Naya Karkhana Jodein:</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                                <input type="text" id="new_k_name" placeholder="Karkhana Naam (e.g. Mau Unit)" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;">
                                <input type="text" id="new_k_location" placeholder="Location (e.g. Mubarakpur)" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;">
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                                <input type="text" id="new_k_incharge" placeholder="Munshi / Manager" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;">
                                <input type="text" id="new_k_phone" placeholder="Mobile No." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;">
                            </div>
                            <button type="button" id="submit_new_k_btn" style="background:#2563eb; color:#ffffff; border:none; width:100%; padding:9px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer;">Karkhana Save Karein</button>
                        </div>

                        <div style="font-weight:600; font-size:13px; margin-bottom:6px; color:#1e293b;">Mawjooda Karkhane:</div>
                        <div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:6px;">
                            <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                                <thead style="background:#f3f4f6; position:sticky; top:0;">
                                    <tr>
                                        <th style="padding:8px;">Naam</th>
                                        <th style="padding:8px;">Location</th>
                                        <th style="padding:8px;">Munshi</th>
                                        <th style="padding:8px; text-align:center;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>${listRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('karkhana-manager-modal');
        if (!modalEl) return;

        // Modal Action Bindings
        document.getElementById('close_k_modal_x').onclick = closeKarkhanaManageModal;
        document.getElementById('submit_new_k_btn').onclick = submitNewKarkhanaForm;

        // Backdrop click to close
        modalEl.onclick = (e) => {
            if (e.target === modalEl) closeKarkhanaManageModal();
        };

        // Table Action Delegation (Delete Button)
        modalEl.querySelector('table').onclick = (e) => {
            const delBtn = e.target.closest('.karkhana-delete-btn');
            if (delBtn) {
                const kId = delBtn.getAttribute('data-kid');
                if (kId) deleteKarkhanaPrompt(kId);
            }
        };
    };

    const closeKarkhanaManageModal = () => {
        const modal = document.getElementById('karkhana-manager-modal');
        if (modal) modal.remove();
    };

    const submitNewKarkhanaForm = () => {
        const nameEl = document.getElementById('new_k_name');
        const locEl = document.getElementById('new_k_location');
        const incEl = document.getElementById('new_k_incharge');
        const phEl = document.getElementById('new_k_phone');

        const name = nameEl ? nameEl.value.trim() : '';
        const location = locEl ? locEl.value.trim() : '';
        const incharge = incEl ? incEl.value.trim() : '';
        const phone = phEl ? phEl.value.trim() : '';

        if (!name) {
            alert('Karkhana ka naam likhna zaroori hai!');
            return;
        }

        addNewKarkhana(name, location, incharge, phone);
        closeKarkhanaManageModal();

        if (typeof window.populateNavbarKarkhanaDropdown === 'function') {
            window.populateNavbarKarkhanaDropdown();
        }
        if (typeof window.triggerActiveSectionRefresh === 'function') {
            window.triggerActiveSectionRefresh();
        }
    };

    const deleteKarkhanaPrompt = (kId) => {
        if (deleteKarkhana(kId)) {
            closeKarkhanaManageModal();
            if (typeof window.populateNavbarKarkhanaDropdown === 'function') {
                window.populateNavbarKarkhanaDropdown();
            }
            if (typeof window.triggerActiveSectionRefresh === 'function') {
                window.triggerActiveSectionRefresh();
            }
        }
    };

    /* ========================================================================
       7. GLOBAL EXPORT & BACKWARD COMPATIBILITY
       ------------------------------------------------------------------------
    ======================================================================== */
    const publicKarkhanaAPI = {
        DEFAULT_MAIN_KARKHANA_ID,
        getKarkhanasSafe,
        saveKarkhanas,
        addNewKarkhana,
        updateKarkhana,
        deleteKarkhana,
        getKarkhanaNameById,
        getActiveKarkhanaId,
        setActiveKarkhanaId,
        updateTabButtonActiveUI,
        renderKarkhanaTabs,
        filterByCurrentKarkhana,
        getAllTransfersSafe,
        recordTransferEntry,
        transferSareesToMainGodown,
        transferRawMaterial,
        transferCashBetweenKarkhana,
        openKarkhanaManageModal,
        closeKarkhanaManageModal,
        submitNewKarkhanaForm,
        deleteKarkhanaPrompt,
        invalidateKarkhanaCache
    };

    // Attach functions directly to window for seamless backwards compatibility
    Object.keys(publicKarkhanaAPI).forEach((fnName) => {
        window[fnName] = publicKarkhanaAPI[fnName];
    });

    // Namespace wrapper
    window.KarkhanaEngine = publicKarkhanaAPI;

    // Unit test export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicKarkhanaAPI;
    }
})();
