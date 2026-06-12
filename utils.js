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

function parseNum(v) {
    const n = parseFloat(String(v || '').replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
}

// HTML escape for safe template insertion
function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

// Extract Google Sheet ID from URL or return trimmed raw id
function extractSheetId(idOrUrl) {
    if (!idOrUrl) return '';
    let id = String(idOrUrl).trim();
    if (/\/d\//.test(id)) {
        const m = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (m) return m[1];
    }
    return id;
}

function sheetIdFromUrl(url) {
    return extractSheetId(url);
}

function getConfigScriptUrl(configKey, windowVarName, localStorageKey) {
    return (window.sheetIdsConfig && window.sheetIdsConfig[configKey])
        || (windowVarName && window[windowVarName])
        || (localStorageKey && localStorage.getItem(localStorageKey))
        || '';
}

function getConfigSheetId(configKey, ...fallbacks) {
    let id = (window.sheetIdsConfig && window.sheetIdsConfig[configKey]) || '';
    if (!id) {
        for (const fb of fallbacks) {
            if (fb) { id = fb; break; }
        }
    }
    return extractSheetId(id);
}

function getCurrentUser() {
    return (window.currentUser && (window.currentUser.name || window.currentUser.email))
        || (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.email))
        || 'unknown';
}

/* Normalize item numbers:
   "1.10" → "1.1"   |   "1.00" → "1"   |   "1.0" → "1"   |   "01" → "1" */
function normItemNo(s) {
    let str = (s == null ? '' : String(s)).trim();
    if (!str) return '';
    const m = str.match(/^([0-9.\-_/\s]+)(.*)$/);
    if (!m) return str;
    let core = m[1].trim();
    const suffix = m[2] || '';
    if (/^\d+\.\d+$/.test(core))       core = String(parseFloat(core));
    else if (/^\d+\.0*$/.test(core))   core = core.replace(/\.0*$/, '');
    else if (/^0+\d+$/.test(core))     core = String(parseInt(core, 10));
    return core + suffix;
}

function cmpItemNo(a, b) {
    const sa = String(a == null ? '' : a).trim();
    const sb = String(b == null ? '' : b).trim();
    const pa = sa.split(/[.\-_/\s]+/).map(s => { const n = parseFloat(s); return (s !== '' && !isNaN(n)) ? n : s; });
    const pb = sb.split(/[.\-_/\s]+/).map(s => { const n = parseFloat(s); return (s !== '' && !isNaN(n)) ? n : s; });
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i], y = pb[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        if (typeof x === 'number' && typeof y === 'number') { if (x !== y) return x - y; }
        else { const r = String(x).localeCompare(String(y), 'ar', { numeric: true }); if (r) return r; }
    }
    return 0;
}

// Parse CSV / TSV / semicolon-delimited text into row arrays
function parseDelimitedText(text) {
    const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
    let delim = ',';
    if (sample.indexOf('\t') > -1) delim = '\t';
    else if (sample.indexOf(';') > -1 && sample.split(';').length > sample.split(',').length) delim = ';';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    return lines.map(l => delim === ','
        ? parseCSVLine(l)
        : l.split(delim).map(s => s.trim().replace(/^"|"$/g, '')));
}

function detectHeaderRow(row, keywords) {
    return row.some(c => keywords.some(k => String(c || '').toLowerCase().includes(k)));
}

// Normalize date values to YYYY-MM-DD for <input type="date">
function normDateInput(v) {
    if (!v) return '';
    if (v instanceof Date) return _dateToInputVal(v);
    const d = _parseAnyDate(v);
    if (d) return _dateToInputVal(d);
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? s : _dateToInputVal(d2);
}

// أيضاً على window للتوافق مع الكود القديم
window.parseCSVLine        = parseCSVLine;
window.fmtNum              = fmtNum;
window.fmtNumShort         = fmtNumShort;
window._parseAnyDate       = _parseAnyDate;
window._fmtDate            = _fmtDate;
window._dateToStorage      = _dateToStorage;
window._dateToInputVal     = _dateToInputVal;
window.parseNum            = parseNum;
window.escHtml             = escHtml;
window._esc                = escHtml;
window.extractSheetId      = extractSheetId;
window.sheetIdFromUrl      = sheetIdFromUrl;
window.getConfigScriptUrl  = getConfigScriptUrl;
window.getConfigSheetId    = getConfigSheetId;
window.getCurrentUser      = getCurrentUser;
window.normItemNo          = normItemNo;
window._normItemNo         = normItemNo;
window.cmpItemNo           = cmpItemNo;
window._cmpItemNo          = cmpItemNo;
window.parseDelimitedText  = parseDelimitedText;
window.detectHeaderRow     = detectHeaderRow;
window.normDateInput       = normDateInput;
window._normDateInput      = normDateInput;
window.Utils = {
    parseCSVLine, fmtNum, fmtNumShort,
    _parseAnyDate, _fmtDate, _dateToStorage, _dateToInputVal,
    parseNum, escHtml, extractSheetId, sheetIdFromUrl,
    getConfigScriptUrl, getConfigSheetId, getCurrentUser,
    normItemNo, cmpItemNo, parseDelimitedText, detectHeaderRow, normDateInput
};
