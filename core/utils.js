/**
 * ============================================================================
 * SIMPLICITY ERP - HIGH-PERFORMANCE CORE UTILITY ENGINE
 * File: core/utils.js
 * Architecture: Vanilla JavaScript PWA (Enterprise-Scale Multi-Tenant)
 * Developed by: Farhan Jawed
 * Target Scale: 400,000+ Active Users | Offline-First & Realtime Sync Safe
 * ============================================================================
 */

(() => {
    'use strict';

    /* ========================================================================
       PERFORMANCE CACHE & MEMOIZATION (GC & Main-Thread Optimization)
       ------------------------------------------------------------------------
       Loop ke andar baar-baar `new Intl...` ya Regex create karne se Garbage
       Collector trigger hota hai aur UI freeze ho jati hai.
       In instances ko module level par single-ton cache kiya gaya hai.
    ======================================================================== */
    const INR_CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const INR_NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const HTML_ESCAPE_LOOKUP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    };
    const HTML_ESCAPE_REGEX = /[&<>"'`]/g;

    /**
     * 1. ULTRA-FAST SAFE ARRAY CONVERTER
     * ------------------------------------------------------------------------
     * Firebase push dictionaries { "-NwX...": {...} }, LocalStorage JSON strings,
     * aur raw arrays ko high-speed for-loops se sanitize karta hai.
     * High-scale data (10,000+ items) par chained `.filter().map()` ke muqable
     * yeh direct memory allocation karta hai taaki garbage collection spike na ho.
     *
     * @param {any} data - Raw input (Array, Firebase Object, JSON string, null)
     * @returns {Array} - Guaranteed clean array (Never throws)
     */
    const safeArray = (data) => {
        if (!data) return [];

        try {
            let target = data;

            // Step 1: High-Speed JSON String Detection & Parsing
            if (typeof data === 'string') {
                const trimmed = data.trim();
                if (!trimmed) return [];
                const firstChar = trimmed[0];
                if (firstChar !== '[' && firstChar !== '{') return [];
                
                try {
                    target = JSON.parse(trimmed);
                } catch (parseErr) {
                    console.warn('[Utils:safeArray] Corrupt JSON string discarded safely:', parseErr);
                    return [];
                }
            }

            // Step 2: Native Array Fast-Path (Single-pass for loop)
            if (Array.isArray(target)) {
                const len = target.length;
                const result = [];
                for (let i = 0; i < len; i++) {
                    const item = target[i];
                    if (item !== null && item !== undefined) {
                        result.push(item);
                    }
                }
                return result;
            }

            // Step 3: Firebase Object / Dictionary Conversion
            if (typeof target === 'object' && target !== null) {
                const keys = Object.keys(target);
                const kLen = keys.length;
                if (kLen === 0) return [];

                // Fast check: Numeric indices (e.g., serialized array objects { "0": {...} })
                let isNumeric = true;
                for (let i = 0; i < kLen; i++) {
                    if (isNaN(parseInt(keys[i], 10))) {
                        isNumeric = false;
                        break;
                    }
                }

                const result = [];

                if (isNumeric) {
                    // Sequential sort for numeric keys
                    keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                    for (let i = 0; i < kLen; i++) {
                        const val = target[keys[i]];
                        if (val !== null && val !== undefined) {
                            result.push(val);
                        }
                    }
                } else {
                    // Firebase UUID Push Keys (Inject key as .id if not present)
                    for (let i = 0; i < kLen; i++) {
                        const key = keys[i];
                        const val = target[key];
                        if (val !== null && val !== undefined) {
                            if (typeof val === 'object' && !Array.isArray(val)) {
                                if (!val.id) val.id = key;
                                result.push(val);
                            } else {
                                result.push({ id: key, value: val });
                            }
                        }
                    }
                }
                return result;
            }

            return [];
        } catch (fatalError) {
            console.error('[Utils:safeArray] Unexpected failure prevented:', fatalError);
            return [];
        }
    };

    /**
     * 2. STRICT LOCAL TODAY DATE (DD-MM-YYYY)
     * ------------------------------------------------------------------------
     * Device ke current local timezone ke mutabiq zero-padded date return karta hai.
     * Output strictly: 'DD-MM-YYYY' (e.g., '24-05-2026').
     *
     * @returns {string} Date strictly in 'DD-MM-YYYY' format
     */
    const getTodayDate = () => {
        try {
            const now = new Date();
            const d = String(now.getDate()).padStart(2, '0');
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            return `${d}-${m}-${y}`;
        } catch (err) {
            console.error('[Utils:getTodayDate] System clock failure:', err);
            const d = new Date();
            return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        }
    };

    /**
     * 3. BI-DIRECTIONAL DATE TRANSFORMATION HELPERS
     * ------------------------------------------------------------------------
     * Database/Input format ('YYYY-MM-DD') <---> Indian Display Format ('DD-MM-YYYY')
     */

    /**
     * Converts 'YYYY-MM-DD' to 'DD-MM-YYYY' (Zero regex overhead, ultra-fast split).
     * @param {string} d - Database/HTML input date string
     * @returns {string} - Display date 'DD-MM-YYYY' or fallback '-'
     */
    const formatDateDisplay = (d) => {
        if (!d || typeof d !== 'string') return '-';
        const parts = d.trim().split('-');
        // If YYYY-MM-DD -> convert to DD-MM-YYYY
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return d;
    };

    /**
     * Converts 'DD-MM-YYYY' back to 'YYYY-MM-DD' (For <input type="date"> or IndexedDB queries).
     * @param {string} d - Display date string 'DD-MM-YYYY'
     * @returns {string} - ISO date string 'YYYY-MM-DD' or fallback empty string
     */
    const parseDisplayDate = (d) => {
        if (!d || typeof d !== 'string') return '';
        const parts = d.trim().split('-');
        // If DD-MM-YYYY -> convert to YYYY-MM-DD
        if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return d;
    };

    /**
     * 4. HIGH-FREQUENCY EVENT PERFORMANCE HELPERS (Search & Input Throttling)
     * ------------------------------------------------------------------------
     */

    /**
     * DEBOUNCE: Delays execution until user stops typing.
     * Ideal for search inputs: `search-karigar-input`, `search-bana-input`.
     *
     * @param {Function} func - Function to execute
     * @param {number} [wait=300] - Delay in milliseconds
     * @returns {Function}
     */
    const debounce = (func, wait = 300) => {
        let timeoutId;
        const debounced = function (...args) {
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
        debounced.cancel = () => clearTimeout(timeoutId);
        return debounced;
    };

    /**
     * THROTTLE: Guarantees execution at most once per time window.
     * Ideal for scroll listeners, window resizing, or rapid submit buttons.
     *
     * @param {Function} func - Function to execute
     * @param {number} [limit=200] - Interval in milliseconds
     * @returns {Function}
     */
    const throttle = (func, limit = 200) => {
        let inThrottle = false;
        let lastRan;
        let lastFunc;

        return function (...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                lastRan = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (Date.now() - lastRan >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, Math.max(limit - (Date.now() - lastRan), 0));
            }
        };
    };

    /**
     * 5. HIGH-SCALE NUMBER & CURRENCY FORMATTERS (Indian Numbering System)
     * ------------------------------------------------------------------------
     */

    /**
     * Formats number to Indian Rupee standard format (e.g., ₹1,50,000.00).
     * @param {number|string} num - Value to format
     * @returns {string} - Formatted currency string with safe fallback '₹0.00'
     */
    const formatCurrency = (num) => {
        try {
            const parsed = typeof num === 'number' ? num : parseFloat(num);
            if (isNaN(parsed) || !isFinite(parsed)) return '₹0.00';
            return INR_CURRENCY_FORMATTER.format(parsed);
        } catch {
            return '₹0.00';
        }
    };

    /**
     * Formats numbers to clean decimal representation with Indian commas (e.g., 1,50,000.50).
     * @param {number|string} num - Number to format
     * @param {number} [decimals=2] - Number of decimal digits
     * @returns {string} - Clean formatted string
     */
    const formatNumber = (num, decimals = 2) => {
        try {
            const parsed = typeof num === 'number' ? num : parseFloat(num);
            if (isNaN(parsed) || !isFinite(parsed)) return (0).toFixed(decimals);

            // Use memoized formatter if default 2 decimals
            if (decimals === 2) {
                return INR_NUMBER_FORMATTER.format(parsed);
            }

            return new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(parsed);
        } catch {
            return (0).toFixed(decimals);
        }
    };

    /**
     * 6. DOM SAFETY & XSS DEFENSE HELPERS (Null-Element Guards)
     * ------------------------------------------------------------------------
     */

    /**
     * Fast XSS Sanitizer: Replaces malicious characters with HTML entities.
     * Table render karte waqt 10x faster than creating DOM elements.
     *
     * @param {string|number} str - Unsanitized string
     * @returns {string} - Safe escaped HTML string
     */
    const sanitizeHTML = (str) => {
        if (str === null || str === undefined) return '';
        return String(str).replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_LOOKUP[match]);
    };

    /**
     * Safely changes element display with null-checks to eliminate TypeError crashes.
     * @param {string|HTMLElement} target - Element ID or HTMLElement
     * @param {string} [displayStyle='block'] - Target display value ('none', 'flex', 'block', etc.)
     */
    const setDisplay = (target, displayStyle = 'block') => {
        try {
            if (!target) return;
            const el = typeof target === 'string' ? document.getElementById(target) : target;
            if (el && el instanceof HTMLElement) {
                el.style.display = displayStyle;
            }
        } catch (domErr) {
            console.warn('[Utils:setDisplay] Safe guard triggered on:', target, domErr);
        }
    };

    /**
     * Safely assigns textContent to a DOM element without throwing if missing.
     * @param {string|HTMLElement} target - Element ID or HTMLElement
     * @param {string|number} text - Content to display
     */
    const setElementText = (target, text) => {
        try {
            if (!target) return;
            const el = typeof target === 'string' ? document.getElementById(target) : target;
            if (el && el instanceof HTMLElement) {
                el.textContent = text !== null && text !== undefined ? String(text) : '';
            }
        } catch (domErr) {
            console.warn('[Utils:setElementText] Safe guard triggered on:', target, domErr);
        }
    };

    /**
     * Date range filter checker for Daybook & Ledger views.
     * Handles both 'DD-MM-YYYY' and 'YYYY-MM-DD' without timezone drift.
     *
     * @param {string} itemDate - Record date
     * @param {string} fromDate - Range start
     * @param {string} toDate - Range end
     * @returns {boolean}
     */
    const isDateInRange = (itemDate, fromDate, toDate) => {
        if (!itemDate) return true;

        const toTimestamp = (d) => {
            if (!d) return null;
            const clean = String(d).trim();
            const p = clean.split('-');
            // If DD-MM-YYYY, convert to ISO YYYY-MM-DD
            if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
                return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
            }
            return new Date(`${clean}T00:00:00`).getTime();
        };

        const target = toTimestamp(itemDate);
        const start = toTimestamp(fromDate);
        const end = toTimestamp(toDate);

        if (start && target < start) return false;
        if (end && target > end) return false;
        return true;
    };

    /* ========================================================================
       GLOBAL NAMESPACE EXPOSURE (Vanilla JS PWA Architecture)
       ------------------------------------------------------------------------
       Direct global access (e.g., `safeArray(...)`) as well as `Utils.safeArray(...)`
       ensure backward compatibility with your other files (`karigar-calc.js`, etc.).
    ======================================================================== */
    const publicAPI = {
        safeArray,
        getTodayDate,
        formatDateDisplay,
        parseDisplayDate,
        debounce,
        throttle,
        formatCurrency,
        formatNumber,
        sanitizeHTML,
        escapeHTML: sanitizeHTML, // Alias
        setDisplay,
        setElementText,
        isDateInRange
    };

    // Attach all functions to window for backward compatibility
    Object.keys(publicAPI).forEach((key) => {
        window[key] = publicAPI[key];
    });

    // Namespace wrapper
    window.Utils = publicAPI;

    // CommonJS / Node testing fallback
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicAPI;
    }
})();
