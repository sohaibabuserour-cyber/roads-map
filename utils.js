/* Shared utilities: CSV, number formatting, date helpers */

// Robust CSV line parser — supports quoted fields and commas inside quotes
function parseCSVLine(line) {
    if (line == null) return [];
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else { cur += ch; }
        } else {
            if (ch === ',') { res.push(cur); cur = ''; }
            else if (ch === '"') { inQuotes = true; }
            else { cur += ch; }
        }
    }
    res.push(cur);
    return res.map(s => (s || '').trim());
}

// Format number with thousands separators
function fmtNum(v, maxFractionDigits = 2) {
    const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/,/g, ''));
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
}

// Abbreviated formatting (billion, million, thousand)
function fmtNumShort(v) {
    const raw = String(v || '').replace(/,/g, '').trim();
    const n = parseFloat(raw);
    if (isNaN(n) || raw === '') return '—';
    if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' مليار';
    if (Math.abs(n) >= 1_000_000)     return (n / 1_000_000).toFixed(2) + ' م';
    if (Math.abs(n) >= 1_000)         return (n / 1_000).toFixed(1) + ' ك';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Date helpers
function parseDateISO(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function formatTimeLocalized(date, locale = 'ar-SA') {
    if (!date) return '—';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(locale);
}

function parseNum(v) {
    const n = parseFloat(String(v || '').replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
}

// أيضاً على window للتوافق مع الكود القديم
window.parseCSVLine       = parseCSVLine;
window.fmtNum             = fmtNum;
window.fmtNumShort        = fmtNumShort;
window.parseDateISO       = parseDateISO;
window.formatTimeLocalized = formatTimeLocalized;
window.parseNum           = parseNum;
window.Utils = { parseCSVLine, fmtNum, fmtNumShort, parseDateISO, formatTimeLocalized, parseNum };
