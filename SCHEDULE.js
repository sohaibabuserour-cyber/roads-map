/* ============================================================
   SCHEDULE.js — معادلات وحسابات البرنامج الزمني فقط
   يحسب:
     • تراكمي القيمة المخططة
     • نسبة المخطط اليومي    = القيمة المخططة / إجمالي القيمة × 100
     • تراكمي نسبة المخطط    = مجموع نسبة المخطط اليومي حتى التاريخ
   مدخلات: مصفوفة صفوف خام { date, plannedValue } مرتبة أو غير مرتبة
   مخرجات: مصفوفة { date, plannedValue, cumPlannedValue, dailyPct, cumDailyPct }
   ============================================================ */

(function (global) {
    'use strict';

    /* ---------- Helpers ---------- */
    function toNum(v) {
        if (v == null || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g, '').trim());
        return isNaN(n) ? 0 : n;
    }

    function parseDate(s) {
        if (!s) return null;
        if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
        // يدعم YYYY-MM-DD و DD/MM/YYYY
        const str = String(s).trim();
        let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
        m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function fmtDate(d) {
        if (!d) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    /* ---------- Items tab: بنود + تاريخ البداية/النهاية ----------
       rows: [{ item, startDate, endDate }]
       يرتب الصفوف حسب تاريخ البداية ويحسب مدة البند بالأيام
    */
    function processItemsTab(rows) {
        return (rows || [])
            .map(r => {
                const s = parseDate(r.startDate);
                const e = parseDate(r.endDate);
                const days = (s && e) ? Math.max(1, Math.round((e - s) / 86400000) + 1) : 0;
                return {
                    item     : (r.item || '').toString().trim(),
                    startDate: fmtDate(s),
                    endDate  : fmtDate(e),
                    days     : days
                };
            })
            .filter(r => r.item)
            .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    }

    /* ---------- Plan tab: حسابات المعادلات ----------
       rows: [{ date, plannedValue }]
       opts.totalValue: إذا مرّرت إجمالي خارجي — تُحسب النسب نسبة له،
                        وإلا فالإجمالي = مجموع القيم.
    */
    function processPlanTab(rows, opts) {
        opts = opts || {};
        const cleaned = (rows || [])
            .map(r => ({ date: parseDate(r.date), plannedValue: toNum(r.plannedValue) }))
            .filter(r => r.date)
            .sort((a, b) => a.date - b.date);

        const sum = cleaned.reduce((acc, r) => acc + r.plannedValue, 0);
        const total = toNum(opts.totalValue) > 0 ? toNum(opts.totalValue) : sum;
        const out = [];
        let cumVal = 0;
        let cumPct = 0;

        cleaned.forEach(r => {
            cumVal += r.plannedValue;
            const dailyPct = total > 0 ? (r.plannedValue / total) * 100 : 0;
            cumPct += dailyPct;
            out.push({
                date            : fmtDate(r.date),
                plannedValue    : r.plannedValue,
                cumPlannedValue : +cumVal.toFixed(2),
                dailyPct        : +dailyPct.toFixed(4),
                cumDailyPct     : +Math.min(cumPct, 100).toFixed(4)
            });
        });

        return { totalValue: total, rows: out };
    }

    /* ---------- توليد جدول خطي من بند (start→end, value) ----------
       يقسّم قيمة البند بالتساوي على الأيام بين البداية والنهاية.
       مفيد إذا المستخدم أدخل البنود فقط ويريد توليد الخطة اليومية.
    */
    function buildPlanFromItems(items) {
        const merge = {}; // dateStr → value
        (items || []).forEach(it => {
            const s = parseDate(it.startDate);
            const e = parseDate(it.endDate);
            const v = toNum(it.value);
            if (!s || !e || v <= 0) return;
            const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
            const per = v / days;
            for (let i = 0; i < days; i++) {
                const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
                const k = fmtDate(d);
                merge[k] = (merge[k] || 0) + per;
            }
        });
        return Object.keys(merge).sort().map(d => ({ date: d, plannedValue: +merge[d].toFixed(2) }));
    }

    /* ---------- CSV ↔ Rows ---------- */
    function parseCSV(text) {
        if (!text) return [];
        const split = (window.parseCSVLine) || function (line) { return line.split(','); };
        const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
        if (!lines.length) return [];
        const headers = split(lines[0]).map(h => h.trim());
        return lines.slice(1).map(line => {
            const cols = split(line);
            const obj = {};
            headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
            return obj;
        });
    }

    /* ---------- Export ---------- */
    global.Schedule = {
        toNum, parseDate, fmtDate,
        processItemsTab,
        processPlanTab,
        buildPlanFromItems,
        parseCSV
    };
})(window);
