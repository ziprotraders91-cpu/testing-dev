/* ============================================================================
   SIMPLICITY ERP - JOB WORK HUB MODULAR UI & FORMS INJECTOR
   File: jobwork-ui/jobwork-forms.js • Keeps index.html Clean & Lightweight
   Includes: Hub | Workers | Monthly Sheet (Batch) | Dukan | Bills | DayBook | Modals
============================================================================ */

(() => {
    'use strict';

    const injectStyles = () => {
        if (document.getElementById('jw-forms-injected-style')) return;
        const st = document.createElement('style');
        st.id = 'jw-forms-injected-style';
        st.textContent = `
            #jw-calender-stock-source-wrap { grid-column: 1 / -1; width: 100%; box-sizing: border-box; }
            .jw-card-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
            .jw-stat-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; text-align: center; }
            .jw-stat-box small { display: block; font-size: 11.5px; font-weight: 700; color: #64748b; }
            .jw-stat-box h4 { margin: 4px 0 0; font-size: 18px; font-weight: 900; }
            .jw-box { background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
        `;
        document.head.appendChild(st);
    };

    const JOBWORK_SECTION_HTML = `
        <div class="module-header">
            <button type="button" class="back-btn" onclick="backToDashboard()">← Dashboard</button>
            <h2 style="color:#0d9488;">✂️ Job Work Hub</h2>
        </div>

        <!-- 1. HUB 6 CARDS MENU VIEW -->
        <div id="jw-hub-view">
            <div class="menu-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
                <div class="menu-btn" style="border-top:4px solid #ef4444;" onclick="openJobWorkSubSection('cutting')">
                    <span class="icon">✂️</span>
                    <span class="title">1. Booti Cutting</span>
                    <span class="menu-badge" id="jw-hub-badge-cutting" style="background:#fee2e2; color:#b91c1c;">0 Kariger</span>
                </div>
                <div class="menu-btn" style="border-top:4px solid #ec4899;" onclick="openJobWorkSubSection('embroidery')">
                    <span class="icon">🪡</span>
                    <span class="title">2. Embroidery</span>
                    <span class="menu-badge" id="jw-hub-badge-embroidery" style="background:#fce7f3; color:#be185d;">0 Kariger</span>
                </div>
                <div class="menu-btn" style="border-top:4px solid #0284c7;" onclick="openJobWorkSubSection('calender')">
                    <span class="icon">🎛️</span>
                    <span class="title">3. Calender</span>
                    <span class="menu-badge" id="jw-hub-badge-calender" style="background:#e0f2fe; color:#0369a1;">0 Kariger</span>
                </div>
                <div class="menu-btn" style="border-top:4px solid #10b981;" onclick="openJobWorkSubSection('dukan')">
                    <span class="icon">🏪</span>
                    <span class="title">4. Dukan Bheja</span>
                    <span class="menu-badge" id="jw-hub-badge-dukan" style="background:#d1fae5; color:#047857;">0 Pcs Bheje</span>
                </div>
                <div class="menu-btn" style="border-top:4px solid #8b5cf6;" onclick="openJobWorkSubSection('billing')">
                    <span class="icon">💳</span>
                    <span class="title">5. Bills & Hisab</span>
                    <span class="menu-badge" id="jw-hub-badge-billing" style="background:#ede9fe; color:#6d28d9;">Baki: ₹ 0</span>
                </div>
                <div class="menu-btn" style="border-top:4px solid #f59e0b;" onclick="openJobWorkSubSection('movement')">
                    <span class="icon">🔄</span>
                    <span class="title">6. Tracking Day-Book</span>
                    <span class="menu-badge" style="background:#fef3c7; color:#b45309;">Live Day-Book</span>
                </div>
            </div>
        </div>

        <!-- 2. WORKERS LIST VIEW (CUTTING / EMBROIDERY / CALENDER) -->
        <div id="jw-workers-view" style="display:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; flex-wrap:wrap; gap:8px;">
                <button type="button" class="back-btn" onclick="showJobWorkHub()">← Hub Menu</button>
                <h3 id="jw-workers-title" style="color:#0f766e; margin:0;">Workers Directory</h3>
                <button type="button" class="add-btn" onclick="toggleJobWorkerForm()"><span id="jw-add-worker-btn-text">+ Naya Kariger</span></button>
            </div>

            <div class="jw-card-grid-3">
                <div class="jw-stat-box" style="background:#fef2f2; border-color:#fecaca;">
                    <small style="color:#b91c1c;">📤 Kul Saree Gayi</small>
                    <h4 id="jw-stat-total-gayi" style="color:#dc2626;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                    <small style="color:#15803d;">📥 Kul Wapas Aayi</small>
                    <h4 id="jw-stat-total-aayi" style="color:#059669;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#fff7ed; border-color:#fed7aa;">
                    <small style="color:#c2410c;">⚠️ Kul Damage</small>
                    <h4 id="jw-stat-total-damage" style="color:#ea580c;">0 Pcs</h4>
                </div>
            </div>

            <div class="filter-panel">
                <input type="text" id="jw-search-worker-input" class="search-box" placeholder="🔍 Search Kariger Naam, Pata, Mobile..." oninput="if(window.currentJobWorkMode==='embroidery' && window.renderEmbroideryWorkersTable){renderEmbroideryWorkersTable();}else if(window.JobWorkEngine){JobWorkEngine.filterJobWorkWorkers();}">
                <select id="jw-absent-filter" class="search-box" style="max-width:190px;" onchange="if(window.currentJobWorkMode==='embroidery' && window.renderEmbroideryWorkersTable){renderEmbroideryWorkersTable();}else if(window.JobWorkEngine){JobWorkEngine.filterJobWorkWorkers();}">
                    <option value="0">Sabhi Kariger</option>
                    <option value="15">⚠️ 15 Din se Absent</option>
                    <option value="20">⚠️ 20 Din se Absent</option>
                    <option value="30">🔴 30 Din se Absent</option>
                    <option value="40">🔴 40 Din se Absent</option>
                </select>
            </div>

            <div id="add-jw-worker-form" class="custom-form" style="display:none; margin-bottom:14px;">
                <input type="hidden" id="jw-worker-edit-id">
                <div class="form-row-4">
                    <div class="input-group"><label>Tarikh</label><input type="date" id="jw-worker-date"></div>
                    <div class="input-group"><label>Kariger Naam</label><input type="text" id="jw-worker-name" placeholder="Kariger ka naam..."></div>
                    <div class="input-group"><label>Pata / Mohalla</label><input type="text" id="jw-worker-address" placeholder="Address..."></div>
                    <div class="input-group"><label>Mobile</label><input type="tel" id="jw-worker-mobile" maxlength="10" placeholder="10-digit Mobile"></div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                    <button type="button" id="jw-worker-cancel-btn" class="back-btn" style="display:none;" onclick="cancelJobWorkerEdit()">Cancel Edit</button>
                    <button type="button" class="back-btn" onclick="toggleJobWorkerForm()">Band Karein</button>
                    <button type="button" id="jw-worker-save-btn" class="add-btn" onclick="saveNewJobWorker()">Save Kariger</button>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr style="background:#0d9488; color:white;">
                            <th>Tarikh</th><th>Naam</th><th>Pata</th><th>Mobile</th><th>Status</th><th style="text-align:center;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="jw-workers-table-body"></tbody>
                </table>
            </div>
        </div>

        <!-- 3. WORKER MONTHLY KHATA SHEET VIEW -->
        <div id="jw-sheet-view" style="display:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; flex-wrap:wrap; gap:8px;">
                <button type="button" class="back-btn" onclick="closeJobWorkerSheet()">← Workers List</button>
                <div style="text-align:center;">
                    <h3 id="jw-sheet-banner-name" style="color:#1e3a8a; margin:0;">Worker Khata Sheet</h3>
                    <small id="jw-sheet-active-badge" style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-weight:700;">Month 1</small>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="add-btn" style="background:#25D366;" onclick="shareJobWorkOnWhatsApp()">📲 WhatsApp</button>
                    <button type="button" class="add-btn" onclick="addNewJobWorkerMonthlySheet()">+ Naya Mahina</button>
                </div>
            </div>

            <div id="jw-month-tabs-container" class="sheet-tabs-bar" style="margin-bottom:12px;"></div>

            <!-- Summary + Pichli Baki -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap:8px; margin-bottom:12px;">
                <div class="jw-stat-box" style="background:#f8fafc;">
                    <small>Pichli Baki Saree</small>
                    <input type="number" id="jw-top-pichli-saree" value="0" onchange="saveJobWorkSheetConfig()" style="width:90px; text-align:center; padding:4px; font-weight:800; border:1px solid #cbd5e1; border-radius:6px; margin-top:4px;">
                </div>
                <div class="jw-stat-box" style="background:#fef2f2; border-color:#fecaca;">
                    <small style="color:#b91c1c;">📤 Gayi Saree</small>
                    <h4 id="jw-card-total-gayi" style="color:#dc2626;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                    <small style="color:#15803d;">📥 Wapas Aayi</small>
                    <h4 id="jw-card-total-aayi" style="color:#059669;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#fff7ed; border-color:#fed7aa;">
                    <small style="color:#c2410c;">⚠️ Damage</small>
                    <h4 id="jw-card-total-lott" style="color:#ea580c;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#eff6ff; border-color:#93c5fd;">
                    <small style="color:#1e40af;">⚖️ Abhi Baki</small>
                    <h4 id="jw-calc-baki-saree-display" style="color:#1d4ed8;">0 Pcs Baki</h4>
                </div>
            </div>

            <!-- 1. SAREE GAYI (OUTWARD BATCH) -->
            <div class="jw-box" style="background:#fff1f2; border-color:#fda4af;">
                <div style="font-weight:800; color:#be123c; margin-bottom:8px;">📤 1. Saree Gayi (Batch Entry):</div>
                <div class="form-row-4" style="align-items:end;">
                    <div class="input-group"><label>Tarikh</label><input type="date" id="jw-form-diya-date"></div>
                    <div class="input-group"><label>Kariger (Maker)</label><input type="text" id="jw-diya-karigar" list="dl-karigers-list" placeholder="Maker naam..."></div>
                    <div class="input-group"><label>Qty (Pcs)</label><input type="number" id="jw-diya-qty" placeholder="0"></div>
                    <div style="display:flex; align-items:flex-end;">
                        <button type="button" class="add-btn" style="background:#e11d48; width:100%;" onclick="addDiyaBatchKarigarItem()">+ Jodein</button>
                    </div>
                </div>
                <small id="jw-cutting-notice" style="display:none; color:#9f1239; font-weight:700; margin-top:4px;"></small>
                <div id="jw-diya-batch-chips" style="margin-top:8px;"></div>
                <div id="jw-diya-batch-total-text" style="font-size:12.5px; font-weight:800; color:#be123c; margin-top:4px;"></div>
            </div>

            <!-- 2. WAPAS AAYI (INWARD BATCH) -->
            <div class="jw-box" style="background:#f0fdf4; border-color:#86efac;">
                <div style="font-weight:800; color:#15803d; margin-bottom:8px;">📥 2. Wapas Aayi (Batch Entry):</div>
                <div class="form-row-4" style="align-items:end;">
                    <div class="input-group"><label>Tarikh</label><input type="date" id="jw-form-aayi-date"></div>
                    <div class="input-group"><label>Kariger (Maker)</label><input type="text" id="jw-aayi-karigar" list="dl-karigers-list" placeholder="Maker naam..."></div>
                    <div class="input-group"><label>Qty (Pcs)</label><input type="number" id="jw-aayi-qty" placeholder="0"></div>
                    <div class="input-group"><label>Naap (Optional)</label><input type="text" id="jw-aayi-naap" placeholder="3.60"></div>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                    <button type="button" class="add-btn" style="background:#16a34a;" onclick="addAayiBatchKarigarItem()">+ Aayi Jodein</button>
                </div>
                <div id="jw-aayi-batch-chips" style="margin-top:8px;"></div>
                <div id="jw-aayi-batch-total-text" style="font-size:12.5px; font-weight:800; color:#15803d; margin-top:4px;"></div>
            </div>

            <!-- 3. DAMAGE & SAVE BATCH -->
            <div class="jw-box" style="background:#fffbeb; border-color:#fde68a;">
                <div class="form-row-3" style="align-items:end;">
                    <div class="input-group"><label style="color:#ea580c;">⚠️ Damage Saree (Pcs)</label><input type="number" id="jw-form-damage-pcs" placeholder="0"></div>
                    <div class="input-group"><label style="color:#dc2626;">Damage Fine (₹)</label><input type="number" step="0.01" id="jw-form-damage-amt" placeholder="0"></div>
                    <div style="display:flex; align-items:flex-end;">
                        <button type="button" class="add-btn" style="background:#1e3a8a; width:100%; padding:10px; font-weight:800;" onclick="saveJobWorkBatchLine()">💾 Save Batch Entry</button>
                    </div>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr style="background:#1e3a8a; color:white; font-size:12px;">
                            <th>TARIKH</th><th>GAYI SAREE</th><th>DETAIL</th><th>WAPAS AAYI</th><th>DETAIL</th><th>DAMAGE</th><th>FINE (₹)</th><th style="text-align:center;">ACTION</th>
                        </tr>
                    </thead>
                    <tbody id="jw-sheet-rows-body"></tbody>
                </table>
            </div>
        </div>

        <!-- 4. DUKAN BHEJA VIEW -->
        <div id="jw-dukan-view" style="display:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; flex-wrap:wrap; gap:8px;">
                <button type="button" class="back-btn" onclick="showJobWorkHub()">← Hub Menu</button>
                <h3 style="color:#15803d; margin:0;">🏪 Dukan Bheja (Final Out Register)</h3>
            </div>

            <div class="jw-card-grid-3">
                <div class="jw-stat-box" style="background:#eff6ff; border-color:#bfdbfe;">
                    <small style="color:#1e40af;">✨ Calender Finished</small>
                    <h4 id="jw-stat-calender-finished" style="color:#1d4ed8;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                    <small style="color:#15803d;">🏪 Kul Dukan Bheji</small>
                    <h4 id="jw-stat-dukan-sent" style="color:#15803d;">0 Pcs</h4>
                </div>
                <div class="jw-stat-box" style="background:#fffbeb; border-color:#fde68a;">
                    <small style="color:#b45309;">📦 Karkhana Bacha</small>
                    <h4 id="jw-stat-karkhana-bacha" style="color:#d97706;">0 Pcs</h4>
                </div>
            </div>

            <div class="jw-box" style="background:#f0fdf4; border-color:#86efac;">
                <div style="font-weight:800; color:#15803d; margin-bottom:10px;">🏪 Naya Dukan Challan Banayein:</div>
                <div class="form-row-3">
                    <div class="input-group"><label>Tarikh</label><input type="date" id="jw-dukan-date"></div>
                    <div class="input-group"><label>Pcs Bheje (Qty)</label><input type="number" id="jw-dukan-pcs" placeholder="0"></div>
                    <div class="input-group"><label>Note / Dukan Receiver</label><input type="text" id="jw-dukan-note" placeholder="Apni Dukan / Party naam..."></div>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                    <button type="button" class="add-btn" style="background:#15803d;" onclick="addDukanTransferEntry()">+ Dukan Bhejein & Minus Stock</button>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr style="background:#1e3a8a; color:white;">
                            <th>Tarikh</th><th>Saree Design</th><th>Kariger (Maker)</th><th>Pcs Bheje</th><th>Note / Receiver</th><th style="text-align:center;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="jw-dukan-table-body"></tbody>
                </table>
            </div>
        </div>

        <!-- 5. JOB WORK BILLING VIEW -->
        <div id="jw-billing-view" style="display:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; flex-wrap:wrap; gap:8px;">
                <button type="button" class="back-btn" onclick="showJobWorkHub()">← Hub Menu</button>
                <h3 style="color:#7c3aed; margin:0;">💳 Job Work Bills & Hisab</h3>
                <button type="button" class="add-btn" style="background:#7c3aed;" onclick="toggleAddJwBillForm()">+ Naya Bill</button>
            </div>

            <div class="jw-card-grid-3">
                <div class="jw-stat-box" style="background:#f5f3ff; border-color:#ddd6fe;">
                    <small style="color:#5b21b6;">🧾 Kul Bill Amount</small>
                    <h4 id="jw-bill-stat-total" style="color:#7c3aed;">₹ 0.00</h4>
                </div>
                <div class="jw-stat-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                    <small style="color:#15803d;">🟢 Kul Paid</small>
                    <h4 id="jw-bill-stat-paid" style="color:#059669;">₹ 0.00</h4>
                </div>
                <div class="jw-stat-box" style="background:#fef2f2; border-color:#fecaca;">
                    <small style="color:#b91c1c;">🔴 Dena Baki</small>
                    <h4 id="jw-bill-stat-pending" style="color:#dc2626;">₹ 0.00</h4>
                </div>
            </div>

            <div class="sheet-tabs-bar" style="margin-bottom:10px;">
                <button type="button" class="sheet-tab active" id="btn-jw-bill-pending" onclick="switchJwBillTab('pending')">🔴 Baki Bills</button>
                <button type="button" class="sheet-tab" id="btn-jw-bill-paid" onclick="switchJwBillTab('paid')">✅ Paid / Clear Bills</button>
            </div>

            <div class="filter-panel">
                <input type="text" id="jw-search-bill-input" class="search-box" placeholder="🔍 Search Worker, Bill No, Tarikh..." oninput="if(window.JobWorkEngine) JobWorkEngine.filterJwBills()">
            </div>

            <div id="add-jw-bill-form" class="custom-form" style="display:none; margin-bottom:14px;">
                <div class="form-row-3" style="margin-bottom:8px;">
                    <div class="input-group"><label>Tarikh</label><input type="date" id="jw-bill-input-date"></div>
                    <div class="input-group"><label>Job Worker Chunein</label><select id="jw-bill-input-worker"></select></div>
                    <div class="input-group"><label>Bill No.</label><input type="text" id="jw-bill-input-no" placeholder="jaise: 101"></div>
                </div>
                <div class="form-row-3">
                    <div class="input-group"><label>Saree Pcs</label><input type="number" id="jw-bill-input-pcs" placeholder="0"></div>
                    <div class="input-group"><label>Total Bill Amount (₹)</label><input type="number" step="0.01" id="jw-bill-input-amt" placeholder="0.00"></div>
                    <div class="input-group"><label>Note</label><input type="text" id="jw-bill-input-note" placeholder="Bill detail..."></div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                    <button type="button" class="back-btn" onclick="toggleAddJwBillForm()">Cancel</button>
                    <button type="button" class="add-btn" style="background:#7c3aed;" onclick="saveJobWorkNewBill()">💾 Save Bill</button>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead id="jw-bills-table-thead"></thead>
                    <tbody id="jw-bills-table-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- 6. JOB WORK DAY-BOOK VIEW -->
        <div id="jw-movement-view" style="display:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; flex-wrap:wrap; gap:8px;">
                <button type="button" class="back-btn" onclick="showJobWorkHub()">← Hub Menu</button>
                <h3 style="color:#d97706; margin:0;">🔄 Job Work Day-Book & Tracking</h3>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="date" id="jw-mov-date" onchange="renderJwMovementDaybook()" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-weight:bold;">
                    <button type="button" class="today-btn" onclick="setJwMovementToday()" style="padding:6px 12px; background:#d97706; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📅 Aaj</button>
                </div>
            </div>

            <div class="daybook-btn-grid" style="margin-bottom:12px;">
                <button type="button" class="daybook-tab-btn active" id="btn-jw-mov-cutting" onclick="switchJwMovementTab('cutting')">
                    <span class="day-icon">✂️</span><div><div class="day-title">Cutting</div><div class="day-sub" id="sub-jw-mov-cutting">-</div></div>
                </button>
                <button type="button" class="daybook-tab-btn" id="btn-jw-mov-embroidery" onclick="switchJwMovementTab('embroidery')">
                    <span class="day-icon">🪡</span><div><div class="day-title">Embroidery</div><div class="day-sub" id="sub-jw-mov-embroidery">-</div></div>
                </button>
                <button type="button" class="daybook-tab-btn" id="btn-jw-mov-calender" onclick="switchJwMovementTab('calender')">
                    <span class="day-icon">🎛️</span><div><div class="day-title">Calender</div><div class="day-sub" id="sub-jw-mov-calender">-</div></div>
                </button>
                <button type="button" class="daybook-tab-btn" id="btn-jw-mov-payment" onclick="switchJwMovementTab('payment')">
                    <span class="day-icon">💳</span><div><div class="day-title">Payment</div><div class="day-sub" id="sub-jw-mov-payment">-</div></div>
                </button>
            </div>

            <div class="filter-panel">
                <input type="text" id="jw-mov-search" class="search-box" placeholder="🔍 Search Worker, Sheet, Bill No..." oninput="if(window.JobWorkEngine) JobWorkEngine.renderJwMovementDaybook()">
            </div>

            <div class="table-responsive">
                <table>
                    <thead id="jw-mov-table-thead"></thead>
                    <tbody id="jw-mov-table-tbody"></tbody>
                    <tfoot id="jw-mov-table-tfoot"></tfoot>
                </table>
            </div>
        </div>
    `;

    const MODALS_HTML = `
        <!-- JOB WORK BATCH BREAKDOWN MODAL -->
        <div id="jw-batch-modal" class="modal-overlay" style="display:none;" role="dialog" aria-modal="true">
            <div class="modal-card" style="max-width:540px;">
                <div class="modal-header">
                    <div>
                        <h3 id="jw-batch-modal-title" style="margin:0;">Batch Breakdown</h3>
                        <small id="jw-batch-modal-subtitle" style="color:#64748b; font-weight:bold;"></small>
                    </div>
                    <button type="button" class="close-modal-btn" onclick="closeJwBatchModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr style="background:#0f766e; color:#fff;">
                                    <th>#</th><th>Kariger</th><th>Qty</th><th style="text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="jw-batch-modal-tbody"></tbody>
                            <tfoot id="jw-batch-modal-tfoot"></tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- JOB WORK BILL PAYMENT MODAL -->
        <div id="jw-pay-modal" class="modal-overlay" style="display:none;" role="dialog" aria-modal="true">
            <div class="modal-card" style="max-width:440px;">
                <div class="modal-header">
                    <div>
                        <h3 style="margin:0; color:#7c3aed;">💰 Bill Payment Karein</h3>
                        <small id="jw-pay-modal-worker-text" style="color:#475569; font-weight:bold;"></small>
                    </div>
                    <button type="button" class="close-modal-btn" onclick="closeJwPayModal()">✕</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="jw-pay-bill-id">
                    <div id="jw-pay-modal-baki-text" style="background:#fef2f2; color:#dc2626; font-weight:800; padding:8px 12px; border-radius:8px; margin-bottom:12px;"></div>
                    <div class="input-group" style="margin-bottom:8px;"><label>Tarikh</label><input type="date" id="jw-pay-date"></div>
                    <div class="input-group" style="margin-bottom:8px;"><label>Payment Amount (₹)</label><input type="number" step="0.01" id="jw-pay-amount"></div>
                    <div class="input-group" style="margin-bottom:8px;">
                        <label>Mode</label>
                        <select id="jw-pay-mode">
                            <option value="Cash">Cash</option>
                            <option value="UPI / Online">UPI / Online</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>
                    <div class="input-group" style="margin-bottom:12px;"><label>Note</label><input type="text" id="jw-pay-note"></div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" class="back-btn" onclick="closeJwPayModal()">Cancel</button>
                        <button type="button" class="add-btn" style="background:#059669;" onclick="saveJobWorkPayment()">💾 Save Payment</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const initJobWorkFormsUI = () => {
        injectStyles();
        const sec = document.getElementById('jobwork-section');
        if (sec) {
            sec.innerHTML = JOBWORK_SECTION_HTML;
        }
        if (!document.getElementById('jw-batch-modal')) {
            document.body.insertAdjacentHTML('beforeend', MODALS_HTML);
        }
    };

    if (document.readyState === 'loading') {
        initJobWorkFormsUI();
    } else {
        initJobWorkFormsUI();
    }
})();
