/* Shared utilities: CSV, number formatting, date helpers
   Added to centralize common functions without changing existing files.
*/

(function () {
    // Robust CSV line parser — supports quoted fields and commas inside quotes
    window.parseCSVLine = function (line) {
        if (line == null) return [];
        const res = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') { // escaped quote
                        cur += '"'; i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur += ch;
                }
            } else {
                if (ch === ',') {
                    res.push(cur);
                    cur = '';
                } else if (ch === '"') {
                    inQuotes = true;
                } else {
                    cur += ch;
                }
            }
        }
        res.push(cur);
        return res.map(s => (s || '').trim());
    };

    // Format number with thousands separators and optional max fraction digits
    window.fmtNum = function (v, maxFractionDigits = 2) {
        const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/,/g, ''));
        if (!isFinite(n)) return '—';
        return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
    };

    // Abbreviated formatting similar to bdFmt (billion, million, thousand)
    window.fmtNumShort = function (v) {
        const raw = String(v || '').replace(/,/g, '').trim();
        const n = parseFloat(raw);
        if (isNaN(n) || raw === '') return '—';
        if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' مليار';
        if (Math.abs(n) >= 1_000_000)     return (n / 1_000_000).toFixed(2) + ' م';
        if (Math.abs(n) >= 1_000)         return (n / 1_000).toFixed(1) + ' ك';
        return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    // Date helpers
    window.parseDateISO = function (s) {
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    };

    window.formatTimeLocalized = function (date, locale = 'ar-SA') {
        if (!date) return '—';
        const d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString(locale);
    };

    // Small numeric parser used across the project
    window.parseNum = function (v) {
        const n = parseFloat(String(v || '').replace(/,/g, '').trim());
        return isNaN(n) ? 0 : n;
    };

    // Namespace for future maintenance while preserving globals
    window.Utils = {
        parseCSVLine: window.parseCSVLine,
        fmtNum: window.fmtNum,
        fmtNumShort: window.fmtNumShort,
        parseDateISO: window.parseDateISO,
        formatTimeLocalized: window.formatTimeLocalized,
        parseNum: window.parseNum
    };

})();
