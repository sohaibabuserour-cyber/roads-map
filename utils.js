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

// Parse dates from sheets, Excel serials, DD-MM-YYYY, YYYY-MM-DD, M/D/YYYY, etc.
function _parseAnyDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        if (val < 100000) {
            const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    const s = String(val).trim();
    if (!s) return null;
    const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
    const dmy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy2) return new Date(`${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

// Display format: DD-MM-YYYY (or — if empty)
function _fmtDate(val) {
    if (!val && val !== 0) return '—';
    const d = _parseAnyDate(val);
    if (!d) return String(val);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Sheet storage format: DD-MM-YYYY
function _dateToStorage(val) {
    if (!val && val !== 0) return '';
    const d = _parseAnyDate(val);
    if (!d) return String(val);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
}

// HTML <input type="date"> format: YYYY-MM-DD
function _dateToInputVal(val) {
    if (!val && val !== 0) return '';
    const d = _parseAnyDate(val);
    if (!d) return '';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
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
window.parseCSVLine        = parseCSVLine;
window.fmtNum              = fmtNum;
window.fmtNumShort         = fmtNumShort;
window.parseDateISO        = parseDateISO;
window._parseAnyDate       = _parseAnyDate;
window._fmtDate            = _fmtDate;
window._dateToStorage      = _dateToStorage;
window._dateToInputVal     = _dateToInputVal;
window.formatTimeLocalized = formatTimeLocalized;
window.parseNum            = parseNum;
window.Utils = {
    parseCSVLine, fmtNum, fmtNumShort, parseDateISO,
    _parseAnyDate, _fmtDate, _dateToStorage, _dateToInputVal,
    formatTimeLocalized, parseNum
};
