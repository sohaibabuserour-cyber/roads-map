/* ============================================================
   config.js — المصدر الوحيد لجميع الثوابت والـ URLs الثابتة
   يُحمَّل أول ملف في index.html قبل أي ملف آخر

   الترتيب المطلوب في index.html:
       <script src="config.js"></script>
       <script src="utils.js"></script>
       <script src="SCHEDULE.js"></script>
       <script src="main.js"></script>
       ...
   ============================================================ */

/* ══════════════════════════════════════════════════════
   1. GOOGLE SHEETS — Sheet IDs (fallback defaults)
      يمكن تجاوزها عبر sheetIdsConfig المحفوظ في
      localStorage أو categories.json
   ══════════════════════════════════════════════════════ */

/** شيت المستخدمين — بيانات تسجيل الدخول */
const USERS_SHEET_ID = "1maViL4HSsI5XsjnAOGM-2D98g0Ow_pawZ-A_R_Y9I_0";

/** شيت الإشعارات — عمود A، كل صف = إشعار */
const NOTIFICATIONS_SHEET_ID = "1AV4umnW_s_bUOIrLBQouCsoAmPJI4yV3aOfPhKfM9C8";

/** شيت التدفقات النقدية — المقاولون */
const CASHFLOW_CONTRACTORS_SHEET = "1xmSUQNR02prdGK9P6QiJo8ybVKwdVZAE74yUkUTbVYA";

/** شيت التدفقات النقدية — الشركة */
const CASHFLOW_COMPANY_SHEET = "1HTV35zXKroQdPJJ0XDew5rFgLwRX73-16AbtI1IymYA";

/**
 * شيت البنود (BOQ) — يُحدَّث ديناميكياً من sheetIdsConfig.
 * معرَّف بـ var (وليس const) لأن main.js يُعيد تعيينه عند
 * تحميل categories.json أو حفظ الإعدادات.
 */
var BILLS_SHEET_ID = "";


/* ══════════════════════════════════════════════════════
   2. GOOGLE APPS SCRIPT — Script URLs
   ══════════════════════════════════════════════════════ */

/**
 * سكريبت كتابة بيانات المستخدمين (الاسم / كلمة المرور / الصورة).
 * اتركه فارغاً إذا لم يُنشَر — التغييرات ستُحفظ في الجلسة فقط.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXQqn8MfdZOozZgPlNSNFS4Ji4jY0jy24FNB1aIyzIdaYQz3eTMQ6_ORBU2hGowMld/exec";

/** سكريبت مستخلصات الشركة */
const CCF_URL = "https://script.google.com/macros/s/AKfycbz3QFPW-Sd7OhC5WeIuY0H9pnrfy1fApXghA8hhh8I_svbMHp9Kc39CPAs6v05lOkhE/exec";

/** سكريبت مستخلصات المقاولين */
const CONCF_URL = "https://script.google.com/macros/s/AKfycbwJCZePc58kGZI3ta3aoHOZ6JjCWi-tSI67mz6Hrcy9wvGyZlXDvZIy0bjxuhUYZQkrXA/exec";


/* ══════════════════════════════════════════════════════
   3. ملفات محلية
   ══════════════════════════════════════════════════════ */

/** ملف الإعدادات الرئيسي — البنود والمجموعات والإحداثيات */
const CONFIG_FILE = "categories.json";


/* ══════════════════════════════════════════════════════
   4. إعدادات الجلسة
   ══════════════════════════════════════════════════════ */

/** مدة الخمول قبل إنهاء الجلسة تلقائياً (2 ساعة بالمللي ثانية) */
const INACTIVITY_MS = 2 * 60 * 60 * 1000;


/* ══════════════════════════════════════════════════════
   5. ثوابت عرض المعدات
   ══════════════════════════════════════════════════════ */

/** لوحة ألوان داشبورد المعدات */
const EQ_PALETTE = [
    '#f5c842', '#27ae6a', '#2196f3', '#9c27b0',
    '#ff9800', '#e91e63', '#00bcd4', '#8bc34a',
    '#ff5722', '#607d8b'
];

/**
 * أعمدة تُستثنى من حسابات المعدات
 * (مشتركة بين viewequipment.js و main.js)
 */
const EQ_SKIP = new Set([
    'ID', 'BAYAN', 'البيان', 'DESCRIPTION',
    'بيان', 'البند', 'BAND', 'ALBND', 'ITEM', 'ALBAYAN'
]);


/* ══════════════════════════════════════════════════════
   6. تصدير على window للتوافق مع الكود الحالي
      (كل ملف يقرأها كـ globals مباشرة — لا تغيير مطلوب)
   ══════════════════════════════════════════════════════ */
window.USERS_SHEET_ID            = USERS_SHEET_ID;
window.NOTIFICATIONS_SHEET_ID    = NOTIFICATIONS_SHEET_ID;
window.CASHFLOW_CONTRACTORS_SHEET = CASHFLOW_CONTRACTORS_SHEET;
window.CASHFLOW_COMPANY_SHEET    = CASHFLOW_COMPANY_SHEET;
window.BILLS_SHEET_ID            = BILLS_SHEET_ID;
window.APPS_SCRIPT_URL           = APPS_SCRIPT_URL;
window.CCF_URL                   = CCF_URL;
window.CONCF_URL                 = CONCF_URL;
window.CONFIG_FILE               = CONFIG_FILE;
window.INACTIVITY_MS             = INACTIVITY_MS;
window.EQ_PALETTE                = EQ_PALETTE;
window.EQ_SKIP                   = EQ_SKIP;
