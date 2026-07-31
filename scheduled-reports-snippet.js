/**
 * ══════════════════════════════════════════════════════════════
 *  📅 جدولة تقارير دورية حقيقية — Cloudflare Worker Cron
 * ══════════════════════════════════════════════════════════════
 *
 * ليش هذا الملف موجود؟
 * الجدولة اللي بالتطبيق (Index.html) تشتغل فقط لما المدير يفتح
 * التطبيق بعد بداية الفترة الجديدة — يعني لو محد فتح التطبيق،
 * ما يُنشأ تقرير إطلاقاً. الحل الحقيقي هو Cron Trigger على
 * Cloudflare Worker، يشتغل بجدول ثابت بغض النظر عن استخدام التطبيق.
 *
 * كيف تركّبه (خطوات):
 * 1. هذا مو ملف مستقل يُنشر لحاله — هو دالة `scheduled` تضيفها
 *    لنفس الـ Worker الموجود عندك أصلاً على:
 *    https://cctv-notifications.ahmedjassim300.workers.dev
 *    (افتح مشروع الـWorker بلوحة Cloudflare أو بمجلد wrangler المحلي)
 *
 * 2. انسخ محتوى دالة `handleScheduled` بالأسفل، وأضفها لملف
 *    الـWorker index.js/worker.js الموجود عندك، وأضف بالتصدير:
 *
 *      export default {
 *        async fetch(request, env, ctx) { ... الكود الموجود عندك ... },
 *        async scheduled(event, env, ctx) {
 *          ctx.waitUntil(handleScheduled(event, env));
 *        }
 *      };
 *
 * 3. أضف Cron Trigger من لوحة Cloudflare:
 *    Workers & Pages → اختر الـWorker → Settings → Trigger Events → Cron Triggers
 *    أو بملف wrangler.toml أضف:
 *
 *      [triggers]
 *      crons = ["0 5 * * 1", "0 5 1 * *"]
 *      # أول تعبير: كل إثنين الساعة 5 صباحاً UTC (تقرير أسبوعي)
 *      # ثاني تعبير: أول كل شهر الساعة 5 صباحاً UTC (تقرير شهري)
 *      # عدّل الوقت حسب توقيت العراق (UTC+3) إذا تحتاج وقت محدد بالضبط
 *
 * 4. تأكد متغيرات البيئة موجودة بالـWorker (نفس المستخدمة أصلاً
 *    لإرسال الإشعارات، إذا مو موجودة أضفها كـ Secrets):
 *      FIREBASE_DB_URL     → مثال: https://cctv-b01fb-default-rtdb.firebaseio.com
 *      FIREBASE_AUTH_TOKEN → توكن Bearer نفسه المستخدم بإرسال الإشعارات
 *
 * شنو تسوي هذي الدالة بالضبط؟
 * - تتحقق أي فترة (أسبوعية/شهرية) حانت جدولتها الآن حسب event.cron
 * - تتأكد من إعدادات المدير بـ reportSchedule (احترام تفعيل/تعطيل
 *   نفس المفتاح اللي بالتطبيق)
 * - تتأكد ما تكرر توليد نفس الفترة مرتين (نفس منطق lastGenerated)
 * - تُرسل إشعار Push لكل المدراء يخبرهم إن التقرير جاهز
 *   (تستخدم نفس آلية الإشعارات الموجودة أصلاً بالـWorker)
 * - ⚠️ توليد HTML التقرير نفسه (الجداول والإحصائيات) يبقى صف
 *   بالتطبيق (buildMonthlyReportHTML) لأنه معقد ومرتبط بمنطق
 *   العرض؛ هذا الـWorker فقط "يوقظ" التطبيق بإشعار يخلي أول
 *   مدير يفتحه يولّد التقرير فوراً (نفس آلية checkAutoRefresh
 *   الموجودة، لكن بدل ما تنتظر فتح عشوائي، تدفع إشعار فعلي
 *   بالوقت الصحيح). لو تحتاج توليد التقرير بالكامل من طرف
 *   الخادم بدون فتح التطبيق إطلاقاً، ذاك تغيير أكبر (يحتاج نقل
 *   منطق buildMonthlyReportHTML لجافاسكربت خادمي مستقل) — أخبرني
 *   إذا تريده وأبنيه لك كخطوة تالية.
 */

async function handleScheduled(event, env) {
  const now = new Date();
  const isWeeklyCron = event.cron === '0 5 * * 1';   // عدّل حسب تعبير الكرون اللي اخترته
  const isMonthlyCron = event.cron === '0 5 1 * *';  // عدّل حسب تعبير الكرون اللي اخترته

  const dbUrl = env.FIREBASE_DB_URL;
  const authToken = env.FIREBASE_AUTH_TOKEN;

  async function fbGet(path) {
    const res = await fetch(`${dbUrl}/cctv/${path}.json?auth=${authToken}`);
    return res.json();
  }
  async function fbSet(path, value) {
    await fetch(`${dbUrl}/cctv/${path}.json?auth=${authToken}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
  }
  async function sendManagerPush(title, body) {
    const users = (await fbGet('users')) || {};
    const managerTokens = Object.values(users)
      .filter((u) => u && u.role === 'manager' && u.fcmToken)
      .map((u) => u.fcmToken);
    for (const token of managerTokens) {
      // استبدل هذا باستدعاء دالة الإرسال الموجودة أصلاً بالـWorker عندك
      // (نفس اللي يُستخدم بإشعارات الأعطال العاجلة مثلاً)
      await sendFcmNotification(token, title, body, env);
    }
  }

  if (isWeeklyCron) {
    const schedule = await fbGet('reportSchedule/weekly');
    if (schedule === true) {
      const weekKey = getIsoWeekKey(now);
      const last = await fbGet('weeklyReports/_meta/lastGenerated');
      if (last !== weekKey) {
        await sendManagerPush(
          '📆 حان وقت التقرير الأسبوعي',
          'افتح التطبيق لتوليد تقرير الأسبوع تلقائياً'
        );
        // ملاحظة: التوليد الفعلي يصير من طرف التطبيق عند فتحه
        // (نفس منطق weeklyReportAutoCheck) — هذا الإشعار فقط يذكّر
        // المدير بالوقت الصحيح بدل انتظار فتح عشوائي للتطبيق.
      }
    }
  }

  if (isMonthlyCron) {
    const schedule = await fbGet('reportSchedule/monthly');
    if (schedule !== false) {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const last = await fbGet('monthlyReports/_meta/lastGenerated');
      if (last !== monthKey) {
        await sendManagerPush(
          '📅 حان وقت التقرير الشهري',
          'افتح التطبيق لتوليد تقرير الشهر تلقائياً'
        );
      }
    }
  }
}

function getIsoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ضع هنا نفس دالة إرسال FCM المستخدمة أصلاً بالـWorker عندك،
// أو اربطها إذا كانت مُصدَّرة من ملف آخر بنفس المشروع
async function sendFcmNotification(token, title, body, env) {
  // TODO: انسخ الجسم الفعلي من دالة الإشعارات الموجودة أصلاً بالـWorker
  console.log('Would send FCM:', { token, title, body });
}
