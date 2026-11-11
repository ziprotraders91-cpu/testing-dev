/* ========================================================
   SIMPLICITY ERP - LIVE ADMIN CONTROL & REALTIME USER APPROVAL
   File: admin/admin.js • Developed by Farhan Jawed
   Architecture: Supabase PostgreSQL Realtime Engine
======================================================== */

window.adminUsersData = [];
var supabaseAdminChannel = null;

const getSupabaseAdmin = () => {
    return window.supabaseClient || window.supabase || (typeof window.supabase !== 'undefined' ? window.supabase : null);
};

// 👑 1. ADMIN PANEL OPEN
function openAdminModule() {
    var uid = (typeof currentUserId !== "undefined" ? String(currentUserId).trim().toLowerCase() : "");
    var role = (typeof currentUserRole !== "undefined" ? String(currentUserRole).trim().toLowerCase() : "");

    if (role !== "admin" && uid !== "farhan") {
        return alert("⛔ Sirf Master Admin (Farhan) is panel ko access kar sakte hain!");
    }

    if (typeof hideAllSections === "function") hideAllSections();
    if (typeof setDisplay === "function") {
        setDisplay("admin-section", "block");
    } else {
        var el = document.getElementById("admin-section");
        if (el) el.style.display = "block";
    }

    renderAdminUsersTable();
    fetchAndListenAdminUsers();
}

// 🌐 2. SUPABASE REALTIME LISTENER & FETCH
async function fetchAndListenAdminUsers(callback) {
    var sb = getSupabaseAdmin();
    if (!sb) {
        if (typeof callback === "function") callback(false, "Supabase DB not connected");
        return;
    }

    try {
        const { data, error } = await sb
            .from('karkhana_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        var arr = [];
        if (data && Array.isArray(data)) {
            data.forEach(function(row) {
                arr.push({
                    id: row.user_id,
                    name: row.full_name || row.user_id,
                    mobile: row.mobile || "-",
                    email: row.email || "",
                    pass: row.password || "-",
                    pin: row.pin || "",
                    role: row.role || "owner",
                    status: row.status || "active",
                    date: row.created_at ? row.created_at.split('T')[0] : "2026-01-01",
                    expiryDate: row.validity_date || ""
                });
            });
        }

        // Ensure Farhan Master Admin is present
        if (!arr.some(function(u) { return String(u.id).toLowerCase() === "farhan"; })) {
            arr.unshift({
                id: "farhan",
                name: "Farhan jawed",
                mobile: "7065572191",
                pass: "97438090641154",
                role: "admin",
                status: "active",
                date: "2026-01-01",
                expiryDate: ""
            });
        }

        window.adminUsersData = arr;

        try {
            localStorage.setItem("app_users", JSON.stringify(arr));
            localStorage.setItem("farhan_app_users", JSON.stringify(arr));
            if (typeof APP_MEMORY_CACHE !== "undefined") {
                APP_MEMORY_CACHE["app_users"] = arr;
                APP_MEMORY_CACHE["farhan_app_users"] = arr;
            }
        } catch (_) {}

        renderAdminUsersTable();
        if (typeof callback === "function") callback(true, arr);

        // Attach Realtime Listener for Instant Live Approval Requests
        if (!supabaseAdminChannel) {
            supabaseAdminChannel = sb.channel('admin-users-live')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'karkhana_users' },
                    function() {
                        fetchAndListenAdminUsers();
                    }
                )
                .subscribe();
        }

    } catch (err) {
        console.error("[Admin] Supabase fetch error:", err);
        if (typeof callback === "function") callback(false, err.message);
    }
}

// 📊 3. TABLE & APPROVAL BANNER RENDERER
function renderAdminUsersTable() {
    var users = window.adminUsersData;
    
    if (!users || !users.length) {
        try {
            users = JSON.parse(localStorage.getItem("app_users")) || 
                    JSON.parse(localStorage.getItem("farhan_app_users")) || [];
        } catch (_) {
            users = [];
        }
    }

    if (!users.length) {
        users = [{
            id: "farhan",
            name: "Farhan jawed",
            mobile: "7065572191",
            pass: "97438090641154",
            role: "admin",
            status: "active",
            date: "2026-01-01"
        }];
    }

    var tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    var tot = 0, act = 0, blk = 0, pnd = 0;
    var pendingUsersList = [];
    var rowsHtml = "";

    users.forEach(function(u, idx) {
        if (!u) return;
        tot++;

        var uIdStr = String(u.id || "").trim();
        var isOwner = (uIdStr.toLowerCase() === "farhan" || u.role === "admin");
        
        // ⭐ Case-Insensitive Pending Check
        var st = String(u.status || "").toLowerCase().trim();
        var isPending = !isOwner && (st === "pending" || st === "pending_approval" || st === "waiting");
        var isBlocked = (st === "blocked");
        var isExpired = false;

        if (u.expiryDate) {
            var today = new Date().toISOString().split("T")[0];
            if (u.expiryDate < today) isExpired = true;
        }

        if (isPending) {
            pnd++;
            pendingUsersList.push(u);
        } else if (isBlocked || isExpired) {
            blk++;
        } else {
            act++;
        }

        // Status Badges
        var stBadge = "";
        if (isOwner) {
            stBadge = "<span class='badge-green' style='background:#10b981; color:#fff; padding:3px 8px; border-radius:12px; font-weight:700;'>👑 Owner</span>";
        } else if (isPending) {
            stBadge = "<span style='background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:3px 8px; border-radius:12px; font-weight:700; font-size:11px;'>⏳ Approval Pending</span>";
        } else if (isBlocked) {
            stBadge = "<span class='badge-red' style='background:#ef4444; color:#fff; padding:3px 8px; border-radius:12px; font-weight:700;'>⛔ Blocked</span>";
        } else if (isExpired) {
            stBadge = "<span class='badge-red' style='background:#f97316; color:#fff; padding:3px 8px; border-radius:12px; font-weight:700;'>⌛ Expired</span>";
        } else {
            stBadge = "<span class='badge-green' style='background:#10b981; color:#fff; padding:3px 8px; border-radius:12px; font-weight:700;'>Active</span>";
        }

        // Action Buttons
        var actionBtns = "";
        var safeId = uIdStr.replace(/'/g, "\\'");

        if (isPending) {
            actionBtns = "<button type='button' class='quick-btn' style='background:#059669; color:white; font-weight:bold; padding:6px 12px; border-radius:6px; cursor:pointer;' onclick='approveUserByAdmin(\"" + safeId + "\")'>✅ Approve</button> " +
                         "<button type='button' class='delete-btn' style='padding:6px 10px;' onclick='deleteUserByAdmin(\"" + safeId + "\")'>🗑️ Reject</button>";
        } else if (!isOwner) {
            actionBtns = "<button type='button' class='quick-btn " + (isBlocked ? "btn-in" : "btn-out") + "' onclick='toggleUserBlockStatus(\"" + safeId + "\")'>" + (isBlocked ? "Unblock" : "Block") + "</button> " +
                         "<button type='button' class='edit-btn' onclick='resetUserPasswordByAdmin(\"" + safeId + "\")'>🔑 Pass</button> " +
                         "<button type='button' class='delete-btn' onclick='deleteUserByAdmin(\"" + safeId + "\")'>🗑️</button>";
        } else {
            actionBtns = "<span style='color:#059669; font-weight:bold; font-size:12px;'>👑 Full Control</span>";
        }

        var expiryDisplay = "";
        if (isOwner) {
            expiryDisplay = "<strong style='color:#059669;'>Lifetime</strong>";
        } else if (isPending) {
            expiryDisplay = "<span style='color:#b45309; font-weight:bold;'>Approval Ka Intezar</span>";
        } else {
            expiryDisplay = "<input type='date' value='" + (u.expiryDate || "") + "' onchange='updateUserExpiryDate(\"" + safeId + "\", this.value)' style='padding:2px 4px;font-size:11px;border-radius:4px;border:1px solid #cbd5e1;'> " + 
                            (typeof formatDateDisplay === "function" ? formatDateDisplay(u.expiryDate) : (u.expiryDate || "-")) + 
                            " <button type='button' onclick='extendValidity(\"" + safeId + "\", 30)' style='padding:2px 6px;font-size:10px;border-radius:4px;border:none;background:#2563eb;color:white;cursor:pointer;'>+30D</button>";
        }

        rowsHtml += "<tr>" +
            "<td>" + (idx + 1) + "</td>" +
            "<td><strong>" + (u.name || "-") + "</strong></td>" +
            "<td>" + (u.mobile || "-") + "</td>" +
            "<td><code>" + uIdStr + "</code></td>" +
            "<td><strong style='color:#1e3a8a;'>" + (u.pass || "-") + "</strong></td>" +
            "<td>" + (typeof formatDateDisplay === "function" ? formatDateDisplay(u.date) : (u.date || "-")) + "</td>" +
            "<td>" + expiryDisplay + "</td>" +
            "<td>" + stBadge + "</td>" +
            "<td style='text-align:center; white-space:nowrap;'>" + actionBtns + "</td>" +
        "</tr>";
    });

    tbody.innerHTML = rowsHtml;

    // 🔔 AUTO-INJECT APPROVAL BANNER (Table ke theek upar)
    var adminSec = document.getElementById("admin-section");
    var pendingBanner = document.getElementById("admin-pending-approval-banner");
    
    if (!pendingBanner && adminSec) {
        pendingBanner = document.createElement("div");
        pendingBanner.id = "admin-pending-approval-banner";
        var tableWrap = adminSec.querySelector(".table-responsive");
        if (tableWrap) adminSec.insertBefore(pendingBanner, tableWrap);
        else adminSec.appendChild(pendingBanner);
    }

    if (pendingBanner) {
        if (pendingUsersList.length > 0) {
            var pHtml = "<div style='background:#fffbeb; border:2px solid #f59e0b; border-radius:12px; padding:14px; margin-bottom:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);'>" +
                "<div style='color:#b45309; font-size:15px; font-weight:800; margin-bottom:10px;'>🔔 Naye Account Approval Requests (" + pendingUsersList.length + "):</div>" +
                "<div style='display:flex; flex-direction:column; gap:8px;'>";

            pendingUsersList.forEach(function(pu) {
                var pId = String(pu.id).replace(/'/g, "\\'");
                pHtml += "<div style='background:white; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;'>" +
                    "<div>" +
                        "<strong style='color:#1e3a8a; font-size:14px;'>👤 " + (pu.name || "-") + "</strong> &bull; <code>ID: " + pu.id + "</code> &bull; 📞 " + (pu.mobile || "-") +
                        "<div style='font-size:11px; color:#64748b;'>Request Date: " + (typeof formatDateDisplay === "function" ? formatDateDisplay(pu.date) : (pu.date || "-")) + "</div>" +
                    "</div>" +
                    "<div style='display:flex; gap:8px;'>" +
                        "<button type='button' class='quick-btn' style='background:#059669; color:white; font-weight:bold; padding:8px 16px; border-radius:6px; cursor:pointer;' onclick='approveUserByAdmin(\"" + pId + "\")'>✅ Approve Karein</button>" +
                        "<button type='button' class='delete-btn' style='padding:8px 12px;' onclick='deleteUserByAdmin(\"" + pId + "\")'>🗑️ Reject</button>" +
                    "</div>" +
                "</div>";
            });

            pHtml += "</div></div>";
            pendingBanner.innerHTML = pHtml;
            pendingBanner.style.display = "block";
        } else {
            pendingBanner.style.display = "none";
        }
    }
}

// 🔄 4. REFRESH BUTTON (SUPABASE)
async function refreshAdminUsersList() {
    var btn = document.getElementById("admin-refresh-users-btn");
    if (btn) btn.textContent = "⏳ Syncing...";

    var sb = getSupabaseAdmin();
    if (!sb) {
        if (btn) btn.textContent = "🔄 Refresh List";
        return alert("⚠️ Supabase connect nahi hai!");
    }

    try {
        const { data, error } = await sb
            .from('karkhana_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        var arr = [];
        var pendingCount = 0;

        if (data && Array.isArray(data)) {
            data.forEach(function(row) {
                var st = String(row.status || "").toLowerCase().trim();
                if (st === "pending" || st === "pending_approval" || st === "waiting") {
                    pendingCount++;
                }
                arr.push({
                    id: row.user_id,
                    name: row.full_name || row.user_id,
                    mobile: row.mobile || "-",
                    email: row.email || "",
                    pass: row.password || "-",
                    pin: row.pin || "",
                    role: row.role || "owner",
                    status: row.status || "active",
                    date: row.created_at ? row.created_at.split('T')[0] : "2026-01-01",
                    expiryDate: row.validity_date || ""
                });
            });
        }

        if (!arr.some(function(u) { return String(u.id).toLowerCase() === "farhan"; })) {
            arr.unshift({
                id: "farhan",
                name: "Farhan jawed",
                mobile: "7065572191",
                pass: "97438090641154",
                role: "admin",
                status: "active",
                date: "2026-01-01",
                expiryDate: ""
            });
        }

        window.adminUsersData = arr;
        try {
            localStorage.setItem("app_users", JSON.stringify(arr));
        } catch (_) {}

        renderAdminUsersTable();
        if (btn) btn.textContent = "🔄 Refresh List";

        alert("✅ Refresh Ho Gaya!\n\n📊 Kul Users: " + arr.length + "\n⏳ Approval Pending: " + pendingCount + "\n🟢 Active: " + (arr.length - pendingCount));

    } catch (err) {
        if (btn) btn.textContent = "🔄 Refresh List";
        alert("❌ Refresh Error: " + err.message);
    }
}

// ✅ 5. ADMIN ACTIONS (SUPABASE POSTGRESQL MUTATIONS)

async function approveUserByAdmin(uid) {
    var exp = new Date();
    exp.setDate(exp.getDate() + 30);
    var formattedExp = exp.toISOString().split("T")[0];

    var sb = getSupabaseAdmin();
    if (!sb) return alert("Supabase connect nahi hai!");

    try {
        const { error } = await sb
            .from('karkhana_users')
            .update({
                status: 'active',
                validity_date: formattedExp
            })
            .eq('user_id', uid);

        if (error) throw error;

        alert("🎉 User '" + uid + "' APPROVE ho gaya!\nAb wo turant login kar sakta hai.");
        refreshAdminUsersList();
    } catch (err) {
        alert("Approve error: " + err.message);
    }
}

async function updateUserExpiryDate(uid, dateVal) {
    var sb = getSupabaseAdmin();
    if (!sb) return;

    try {
        await sb
            .from('karkhana_users')
            .update({ validity_date: dateVal })
            .eq('user_id', uid);
    } catch (err) {
        console.error("Expiry update error:", err);
    }
}

async function extendValidity(uid, days) {
    var u = (window.adminUsersData || []).find(function(x) { return String(x.id) === String(uid); });
    var base = (u && u.expiryDate && new Date(u.expiryDate) > new Date()) ? new Date(u.expiryDate) : new Date();
    base.setDate(base.getDate() + days);
    var formatted = base.toISOString().split("T")[0];

    var sb = getSupabaseAdmin();
    if (!sb) return alert("Supabase connect nahi hai!");

    try {
        const { error } = await sb
            .from('karkhana_users')
            .update({
                validity_date: formatted,
                status: 'active'
            })
            .eq('user_id', uid);

        if (error) throw error;

        alert("✅ Validity 30 din badh gayi!");
        refreshAdminUsersList();
    } catch (err) {
        alert("Validity update error: " + err.message);
    }
}

async function resetUserPasswordByAdmin(uid) {
    var newPass = prompt("Naya password daalein:", Math.floor(100000 + Math.random() * 900000).toString());
    if (!newPass || !newPass.trim()) return;

    var sb = getSupabaseAdmin();
    if (!sb) return alert("Supabase connect nahi hai!");

    try {
        const { error } = await sb
            .from('karkhana_users')
            .update({ password: newPass.trim() })
            .eq('user_id', uid);

        if (error) throw error;

        alert("✅ Password update ho gaya!");
        refreshAdminUsersList();
    } catch (err) {
        alert("Password reset error: " + err.message);
    }
}

async function toggleUserBlockStatus(uid) {
    if (String(uid).toLowerCase() === "farhan") return alert("⛔ Master Admin block nahi ho sakta!");
    var u = (window.adminUsersData || []).find(function(x) { return String(x.id) === String(uid); });
    var nextStatus = (u && u.status === "blocked") ? "active" : "blocked";

    var sb = getSupabaseAdmin();
    if (!sb) return alert("Supabase connect nahi hai!");

    try {
        const { error } = await sb
            .from('karkhana_users')
            .update({ status: nextStatus })
            .eq('user_id', uid);

        if (error) throw error;

        refreshAdminUsersList();
    } catch (err) {
        alert("Block/Unblock error: " + err.message);
    }
}

async function deleteUserByAdmin(uid) {
    if (String(uid).toLowerCase() === "farhan") return alert("⛔ Master Admin delete nahi ho sakta!");
    if (!confirm("Kya aap sach me is User ko delete/reject karna chahte hain?")) return;

    var sb = getSupabaseAdmin();
    if (!sb) return alert("Supabase connect nahi hai!");

    try {
        const { error } = await sb
            .from('karkhana_users')
            .delete()
            .eq('user_id', uid);

        if (error) throw error;

        alert("🗑️ User delete ho gaya!");
        refreshAdminUsersList();
    } catch (err) {
        alert("Delete error: " + err.message);
    }
}

// Window bindings
window.openAdminModule = openAdminModule;
window.renderAdminUsersTable = renderAdminUsersTable;
window.approveUserByAdmin = approveUserByAdmin;
window.updateUserExpiryDate = updateUserExpiryDate;
window.extendValidity = extendValidity;
window.resetUserPasswordByAdmin = resetUserPasswordByAdmin;
window.toggleUserBlockStatus = toggleUserBlockStatus;
window.deleteUserByAdmin = deleteUserByAdmin;
window.refreshAdminUsersList = refreshAdminUsersList;
